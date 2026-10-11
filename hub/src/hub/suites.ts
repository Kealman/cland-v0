// Durable hub-owned suite jobs. A worker can outlive hub shutdown; restart watches its receipt/PID.
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidateTree } from '../verification-tree.ts';
import { pidAlive } from '../project.ts';
import { promisify } from 'node:util';
import type { SuiteStatus, VerificationQueue, VerificationHolder, DurationStats } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import type { Store } from './store.ts';
import { systemProcesses, endProcess } from '../system-processes.ts';
import { processStartedAsync } from './lock.ts';
import { compatibilityOccupied, compatibilityHolder } from '../suite-lock.ts';
import { selectPackageSuite, describeSelection, type SuiteSelection, type SuiteRequest } from '../suite-selection.ts';

export type SuiteActor = { name: string; sessionId: string; shell: true };
export type SuiteJob = {
  id: string; mode: string; cwd: string; topic: string; to: string[]; actor: SuiteActor | null;
  head: string; branch: string; log: string; result: string; gate: string;
  pid: number | null; started: string | null; outcome: { code: number; cause: string } | null;
  artifact: string | null; reported: boolean; error: string | null; cleaned?: boolean;
  cancelled?: boolean;
  tree?: string | null; finished?: string;
  cached?: { run: string; head: string; tree: string };
  admittedAt?: string; completedAt?: string; waitMs?: number | null; runMs?: number | null;
  timingEstimated?: boolean;
  selection?: SuiteSelection;
  integrated?: boolean;
  queued?: string; priority?: number; item?: string | null;
  state?: 'queued' | 'launching' | 'running' | 'finished';
  locks?: string[]; requesterDied?: boolean;
};
export type SuiteSchedulerOptions = { budget?: number; cacheMaxAgeMs?: number; locks?: string[]; requesterDead?: (actor: SuiteActor) => boolean; log?: LogFn; onQueue?: (queue: VerificationQueue) => void };
const KEY = 'suite-jobs';
const exec = promisify(execFile);
const METRICS_WINDOW = 20;
function elapsed(since: string | undefined | null, now: number): number | null {
  const start = Date.parse(since ?? '');
  return Number.isFinite(start) ? Math.max(0, now - start) : null;
}
function durations(values: Array<number | null | undefined>): DurationStats {
  const sorted = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const n = sorted.length;
  return { count: n, medianMs: n ? n % 2 ? sorted[Math.floor(n / 2)]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : null, p90Ms: n ? sorted[Math.ceil(n * 0.9) - 1]! : null };
}
export function suiteSummary(log: string): string {
  const text = log.replace(/\x1b\[[0-9;]*m/g, '');
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/^(?:#|ℹ) (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/gm)) counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + Number(match[2]));
  const failures = text.split('\n').filter(line => /^(?:\s*not ok \d+|✖ )/.test(line)).slice(0, 12).map(line => line.slice(0, 200));
  const timings = text.split('\n').filter(line => /^(?:verification queue wait |shard duration |suite duration )/.test(line)).slice(-8).map(line => line.slice(0, 300));
  return `${counts.size ? [...counts].map(([k, v]) => `${k} ${v}`).join('; ') : 'counts unavailable (suite did not finish)'}${timings.length ? `\n${timings.join('\n')}` : ''}${failures.length ? `\nFailures:\n${failures.join('\n')}` : ''}`;
}

export class Suites {
  readonly #store: Store;
  readonly #root: string;
  readonly #report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>;
  readonly #jobs: SuiteJob[];
  readonly #timer: ReturnType<typeof setInterval>;
  #checking: Promise<void> | null = null;
  readonly #inspecting = new Map<string, Promise<void>>();
  readonly #starting = new Set<Promise<unknown>>();
  #closed = false;
  readonly #launching = new Set<string>();
  readonly #budget: number;
  readonly #options: SuiteSchedulerOptions;
  #lastQueue = '';
  #compatibility: Awaited<ReturnType<typeof compatibilityHolder>> = null;
  constructor(store: Store, root: string, report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>, options: SuiteSchedulerOptions = {}) {
    this.#options = options;
    this.#budget = Math.min(options.budget ?? 1, 1);
    if ((options.budget ?? 1) > 1) options.log?.({ event: 'verification-budget-capped', configured: options.budget, effective: this.#budget, reason: 'resource overlap remains disabled after T-215', reservedFor: 'T-218' });
    this.#store = store; this.#root = root; this.#report = report;
    this.#jobs = JSON.parse(store.meta(KEY) ?? '[]') as SuiteJob[];
    for (const job of this.#jobs) {
      job.state ??= job.outcome || job.reported ? 'finished' : 'running';
      // T-232 stores the worker's ps start identity and exit receipt. Recover a
      // second-resolution estimate without replacing the identity used for cleanup.
      const started = Date.parse(job.started ?? '');
      if (!job.admittedAt && job.pid && Number.isFinite(started)) {
        job.admittedAt = new Date(Math.max(started, Date.parse(job.queued ?? '') || started)).toISOString();
        job.timingEstimated = true;
      }
      const completion = job.cached ? store.message(`suite:${job.id}`)?.ts : job.finished ?? store.message(`suite:${job.id}`)?.ts;
      if (job.reported && job.outcome && completion && !job.completedAt) {
        job.timingEstimated = true;
        this.#recordTiming(job, completion);
      }
    }
    this.#save();
    this.#timer = setInterval(() => { void this.#check(); }, 1000);
    this.#timer.unref();
  }
  #save = () => { this.#store.setMeta(KEY, JSON.stringify(this.#jobs)); };
  #active = (job: SuiteJob) => !job.reported && (!job.outcome || (job.outcome.code !== 0 && !job.cleaned));
  #recordTiming(job: SuiteJob, completedAt: string): void {
    if (job.completedAt) return;
    job.completedAt = completedAt;
    const completed = Date.parse(completedAt);
    job.waitMs = job.cached ? 0 : job.pid && !job.admittedAt ? null : elapsed(job.queued, Date.parse(job.admittedAt ?? completedAt));
    job.runMs = job.cached || (!job.admittedAt && !job.pid) ? 0 : elapsed(job.admittedAt, completed);
    this.#options.log?.({ event: 'verification-timing', id: job.id, item: job.item ?? null, session: job.actor?.name ?? 'human', branch: job.branch, head: job.head, mode: job.selection?.mode ?? job.mode, cached: Boolean(job.cached), queuedAt: job.queued ?? null, admittedAt: job.admittedAt ?? null, completedAt, waitMs: job.waitMs, runMs: job.runMs, estimated: job.timingEstimated ?? false });
  }
  async cancel(id: string | undefined, actor: SuiteActor | null, authorize: () => void): Promise<{ id: string; topic: string; cancelled: true }> {
    if (this.#closed) throw new Error('hub is closing');
    authorize();
    const job = id ? this.#jobs.find(job => job.id === id)
      : this.#jobs.findLast(job => this.#active(job) && (job.actor?.sessionId ?? null) === (actor?.sessionId ?? null));
    if (!job) throw new Error(id ? `no suite named ${id}` : 'this session has no suite queued or running');
    if (actor && job.actor?.sessionId !== actor.sessionId) throw new Error('cannot cancel another session’s suite; only the human may cancel any run');
    // Reconcile only this run. Other submissions, cleanup and reports must not delay cancellation.
    await this.#inspectJob(job);
    if (this.#closed) throw new Error('hub is closing');
    authorize();
    if (!job.cancelled) {
      if (job.outcome || job.reported) throw new Error('suite already finished');
      // Persist before signalling: restart, late receipts and reporting retries retain this outcome.
      job.cancelled = true; job.outcome = { code: 143, cause: 'cancelled' }; this.#save();
    }
    void this.#inspectJob(job);
    return { id: job.id, topic: job.topic, cancelled: true };
  }
  start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { priority?: number; item?: string | null; integrated?: boolean; fresh?: boolean }, authorize: () => void): Promise<{ id: string; pid: number | null; topic: string; position: number; cached?: SuiteJob['cached'] }> {
    if (this.#closed) return Promise.reject(new Error('hub is closing'));
    const work = this.#start(input, authorize);
    this.#starting.add(work);
    void work.finally(() => this.#starting.delete(work)).catch(() => {});
    return work;
  }
  async #start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { priority?: number; item?: string | null; integrated?: boolean; fresh?: boolean }, authorize: () => void): Promise<{ id: string; pid: number | null; topic: string; position: number; cached?: SuiteJob['cached'] }> {
    const identity = input.actor?.sessionId ?? 'human';
    if (this.#jobs.some(job => this.#active(job) && (job.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    const id = randomUUID();
    const dir = join(this.#root, '.cland', 'run', 'suites', id);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const git = async (args: string[]) => exec('git', args, { cwd: input.cwd }).then(r => r.stdout.trim(), () => 'unknown');
    const [head, branch, selection] = await Promise.all([git(['rev-parse', 'HEAD']), git(['branch', '--show-current']), selectPackageSuite(input.cwd, input.mode as SuiteRequest)]);
    const tree = await candidateTree(input.cwd, head);
    const cached = !input.fresh && tree ? this.#cached(tree, selection.mode) : undefined;
    authorize();
    // Recheck after I/O: concurrent submissions cannot both reserve a session.
    if (this.#jobs.some(job => this.#active(job) && (job.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    const job: SuiteJob = { ...input, integrated: input.integrated === true && branch === 'dev', queued: new Date().toISOString(), priority: input.priority ?? Number.MAX_SAFE_INTEGER, state: 'queued', locks: this.#options.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock'], selection, tree, id, head, branch, log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready'), pid: null, started: null, outcome: null, artifact: null, reported: false, error: null };
    // Persist the complete request before acknowledging it. No waiting worker exists.
    await writeFile(job.log, `Suite ${id} · ${input.mode}\n${describeSelection(selection)}\nWorktree ${input.cwd}\nBranch ${branch}\nHead ${head}\nQueued ${job.queued}\n`, { mode: 0o600 });
    if (cached) {
      const artifact = this.#store.resolveArtifact(cached.artifact!)!;
      const originalLog = await readFile(artifact.path, 'utf8').catch(() => null);
      if (originalLog !== null && await candidateTree(input.cwd, head) === tree) {
        job.cached = { run: cached.id, head: cached.head, tree: tree! };
        job.finished = cached.finished!;
        job.outcome = { code: 0, cause: 'cached' }; job.state = 'finished';
        await writeFile(job.log, `Cached candidate ${tree}\nOriginal run ${cached.id} · head ${cached.head}\nRequested head ${head}\n\n${originalLog}`, { mode: 0o600 });
      }
    }
    authorize();
    if (this.#closed) throw new Error('hub is closing');
    if (this.#jobs.some(j => this.#active(j) && (j.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    this.#jobs.push(job); this.#save();
    await this.#check();
    return { id, pid: job.pid, topic: job.topic, position: job.state === 'queued' ? this.#queue().findIndex(j => j.id === id) + 1 : 1, ...(job.cached ? { cached: job.cached } : {}) };
  }
  #cached(tree: string, mode: SuiteSelection['mode']): SuiteJob | undefined {
    // A failed or pending fresh attempt supersedes earlier green evidence for this key.
    const job = this.#jobs.findLast(j => !j.cached && j.tree === tree && j.selection?.mode === mode);
    if (!job || job.outcome?.code !== 0 || !job.reported || !job.finished || !job.artifact) return undefined;
    const age = Date.now() - Date.parse(job.finished);
    const artifact = this.#store.resolveArtifact(job.artifact);
    return age >= 0 && age < (this.#options.cacheMaxAgeMs ?? 86400000) && artifact && artifact.status !== 'archived' && !artifact.fileDeleted ? job : undefined;
  }
  #queue(): SuiteJob[] {
    return this.#jobs.filter(j => j.state === 'queued' && !j.outcome).sort((a, b) => Number(b.integrated === true) - Number(a.integrated === true) || (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || (a.queued ?? '').localeCompare(b.queued ?? ''));
  }
  async #launch(job: SuiteJob): Promise<void> {
    const dir = join(this.#root, '.cland', 'run', 'suites', job.id);
    job.state = 'launching'; job.admittedAt = new Date().toISOString(); this.#launching.add(job.id); this.#save();
    const admit = () => { if (job.outcome) throw new Error('suite cancelled before worker admission'); };
    try {
      // A queued build cannot silently turn into a different tested head.
      const head = await exec('git', ['rev-parse', 'HEAD'], { cwd: job.cwd }).then(r => r.stdout.trim(), () => 'unknown');
      if (head !== job.head) throw new Error(`cancelled: queued head changed from ${job.head} to ${head}; submit verification again`);
      await writeFile(join(dir, 'job.json'), JSON.stringify(job), { mode: 0o600 });
      const fd = await open(job.log, 'a');
      try {
        admit();
        const env = { ...process.env };
        // Package scripts need a fresh Node test context.
        delete env.NODE_TEST_CONTEXT;
        delete env.CLAND_SUITE_LEASE;
        const child = spawn(process.execPath, [fileURLToPath(new URL('./suite-worker.ts', import.meta.url)), join(dir, 'job.json')], { cwd: job.cwd, env, detached: true, stdio: ['ignore', fd.fd, fd.fd] });
        child.once('error', error => { if (this.#closed) return; job.outcome ??= { code: 1, cause: `worker could not start: ${error.message}` }; this.#save(); });
        child.once('close', (code, signal) => {
          if (this.#closed) return;
          if (signal || code !== 0) job.outcome ??= { code: code ?? 1, cause: signal ? `worker killed by ${signal}` : `worker exited ${code}` };
          // A zero worker exit is a pass only when its durable package result exists.
          this.#save(); void this.#check();
        });
        child.unref();
        job.pid = child.pid ?? null;
        job.started = job.pid ? await processStartedAsync(job.pid) : null;
        this.#save();
        if (!job.pid || !job.started) throw new Error('cannot establish suite worker process identity');
        admit();
        job.state = 'running'; this.#save();
        await writeFile(job.gate, 'ready');
      } finally { await fd.close(); }
    } catch (error) {
      // Keep the failure receipt: the inspector only terminates identity-verified processes.
      job.outcome ??= { code: 1, cause: error instanceof Error ? error.message : String(error) }; this.#save();
    } finally { this.#launching.delete(job.id); if (job.cancelled) void this.#inspectJob(job); }
  }
  #check(): Promise<void> {
    if (this.#checking) return this.#checking;
    if (this.#closed) return Promise.resolve();
    this.#checking = this.#tick().catch(error => { this.#options.log?.({ event: 'verification-admission-blocked', error: String(error) }); }).then(async () => {
      if (this.#closed || !this.#options.onQueue) return;
      const queue = await this.queue();
      if (this.#closed) return;
      const signature = JSON.stringify({ ...queue, at: undefined });
      if (signature !== this.#lastQueue) { this.#lastQueue = signature; this.#options.onQueue(queue); }
    }).catch(error => { this.#options.log?.({ event: 'verification-queue-failed', error: String(error) }); }).finally(() => { this.#checking = null; });
    return this.#checking;
  }
  async #tick(): Promise<void> {
    await Promise.all(this.#jobs.map(job => this.#inspectJob(job)));
    if (this.#closed) return;
    const active = this.#jobs.filter(j => !j.reported && (j.state !== 'queued' && !j.outcome || j.outcome && j.outcome.code !== 0 && !j.cleaned)).length;
    if (active >= this.#budget) return;
    const next = this.#queue()[0];
    if (next && !await compatibilityOccupied(next.locks!) && !this.#closed && next.state === 'queued' && !next.outcome) await this.#launch(next);
  }
  #inspectJob(job: SuiteJob): Promise<void> {
    const pending = this.#inspecting.get(job.id);
    if (pending) return pending;
    if (this.#closed || job.reported || this.#launching.has(job.id)) return Promise.resolve();
    const work = this.#inspect(job).catch(() => { /* saved errors are retried on the next tick */ }).finally(() => { this.#inspecting.delete(job.id); });
    this.#inspecting.set(job.id, work);
    return work;
  }
  async #inspect(job: SuiteJob): Promise<void> {
    if (job.state === 'queued' && !job.outcome) {
      if (!job.actor || !this.#options.requesterDead?.(job.actor)) return;
      job.requesterDied = true;
      job.outcome = { code: 130, cause: 'cancelled: requester died before admission' };
    }
    try {
      const receipt = await readFile(job.result, 'utf8').then(text => JSON.parse(text) as { code: number; cause: string; finished?: string }, () => null);
      if (receipt && !job.cancelled && !job.requesterDied) {
        job.outcome = { code: receipt.code, cause: receipt.cause };
        if (receipt.finished) job.finished = receipt.finished;
      }
      if (job.cached && !this.#store.message(`suite:${job.id}`) && await candidateTree(job.cwd, job.head) !== job.tree) {
        delete job.cached; job.outcome = { code: 1, cause: 'cached candidate changed; submit verification again' };
      }
      if (!job.outcome) {
        if (job.pid && pidAlive(job.pid)) {
          const current = await processStartedAsync(job.pid);
          if (job.started === null || current === null || current === job.started) return;
        }
        job.outcome = { code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' };
      }
      job.state = 'finished';
      this.#save();
      if (job.outcome.code !== 0 && !job.cleaned) {
        if (job.pid && !job.started && pidAlive(job.pid)) throw new Error('suite cleanup waiting for a verified worker identity; process preserved');
        if (job.pid && job.started) {
          // Launch failures can leave the worker live; endProcess rechecks its positive PID
          // immediately before signalling. Missing/reused leaders preserve unrelated processes.
          if (!await endProcess({ pid: job.pid, pidStarted: job.started }, () => {}, job.cancelled ? 10000 : 500, undefined, { allowReused: true })) throw new Error('suite cleanup could not verify the worker identity');
          const rows = await systemProcesses();
          const leader = rows.find(row => row.pid === job.pid);
          if (!leader || leader.started === job.started) {
            for (const row of rows.filter(row => row.group === job.pid && row.pid !== job.pid)) {
              if (!await endProcess({ pid: row.pid, pidStarted: row.started }, () => {}, 500, undefined, { allowReused: true })) throw new Error('suite crash cleanup could not verify a surviving process');
            }
          }
        }
        job.cleaned = true; this.#save();
      }
      this.#recordTiming(job, !job.cached && job.outcome.code === 0 && receipt?.finished ? receipt.finished : new Date().toISOString());
      this.#save();
      await this.#report(job, id => {
        if (job.artifact !== null && job.artifact !== id) throw new Error('suite artifact checkpoint already settled');
        job.artifact = id; this.#save();
      });
      job.reported = true; job.error = null; this.#save();
    } catch (error) { job.error = error instanceof Error ? error.message : String(error); this.#save(); }
  }
  requesterExited(sessionId: string): void {
    for (const job of this.#jobs) {
      if (job.actor?.sessionId !== sessionId || job.state !== 'queued' || job.outcome) continue;
      job.requesterDied = true;
      job.outcome = { code: 130, cause: 'cancelled: requester died before admission' };
    }
    this.#save(); void this.#check();
  }
  status(): SuiteStatus[] {
    return this.#jobs.map(job => ({
      id: job.id, pid: job.pid, topic: job.topic, reported: job.reported, outcome: job.outcome, error: job.error,
      state: job.state ?? 'running', queued: job.queued ?? null, priority: job.priority ?? null,
      item: job.item ?? null, head: job.head, branch: job.branch, integrated: job.integrated ?? false,
      ...(job.selection ? { selection: job.selection } : {}),
      tree: job.tree ?? null, finished: job.finished ?? null, ...(job.cached ? { cached: job.cached } : {}),
      admittedAt: job.admittedAt ?? null, completedAt: job.completedAt ?? null, waitMs: job.waitMs ?? null, runMs: job.runMs ?? null,
      timingEstimated: job.timingEstimated ?? false,
    }));
  }
  async queue(): Promise<VerificationQueue> {
    this.#compatibility = await compatibilityHolder(this.#options.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock']);
    return this.snapshot();
  }
  /** Project metadata reads never wait for compatibility OS probes. The scheduler
   * refreshes ownership each tick; explicit queue reads inspect it immediately. */
  snapshot(): VerificationQueue {
    const shim = this.#compatibility;
    const now = Date.now();
    const recent = this.#jobs.filter(j => j.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!)).slice(0, METRICS_WINDOW);
    const metrics = { window: METRICS_WINDOW, count: recent.length, wait: durations(recent.map(j => j.waitMs)), run: durations(recent.map(j => j.runMs)) };
    // Cache hits are already completed at submission. They count in the metrics but must
    // not bias the estimate for an actual queued execution, which missed the cache.
    const estimate = (mode: string | null) => durations(recent.filter(j => !j.cached && j.outcome?.code === 0 && j.admittedAt && (mode === null || (j.selection?.mode ?? j.mode) === mode)).map(j => j.runMs)).medianMs;
    const active = this.#jobs.find(j => j.state !== 'queued' && (j.pid !== null || j.state === 'launching') && this.#active(j));
    let holder: VerificationHolder | null = null;
    if (shim && (!active || shim.holder?.pid !== active.pid)) {
      holder = { kind: 'hand run', id: null, session: null, item: null, mode: null, pid: shim.holder?.pid ?? null, worktree: shim.holder?.worktree ?? null, since: shim.since, runMs: elapsed(shim.since, now), etaMs: null };
    } else if (active) {
      holder = { kind: 'run', id: active.id, session: active.actor?.name ?? 'human', item: active.item ?? null, mode: active.selection?.mode ?? active.mode, pid: active.pid, worktree: active.cwd, since: active.admittedAt ?? null, runMs: elapsed(active.admittedAt, now), etaMs: null };
    }
    if (holder) {
      const expected = estimate(holder.mode);
      holder.etaMs = expected === null || holder.runMs === null || (holder.kind === 'hand run' && !shim?.holder) ? null : Math.max(0, expected - holder.runMs);
    }
    let eta = holder ? holder.etaMs : 0;
    const queued = this.#queue();
    // A racing hand run can own the shim while the admitted worker waits for it.
    if (active && holder?.kind === 'hand run') queued.unshift(active);
    return { version: 1, at: new Date(now).toISOString(), holder,
      waiters: queued.map((j, i) => {
        const mode = j.selection?.mode ?? j.mode;
        const expectedRunMs = estimate(mode);
        const waiter = { id: j.id, session: j.actor?.name ?? 'human', item: j.item ?? null, mode, worktree: j.cwd, position: i + 1, queuedAt: j.queued ?? null, waitMs: elapsed(j.queued, now) ?? 0, etaMs: eta, expectedRunMs };
        eta = eta === null || expectedRunMs === null ? null : eta + expectedRunMs;
        return waiter;
      }), metrics };
  }
  async close(): Promise<void> { this.#closed = true; clearInterval(this.#timer); await Promise.allSettled(this.#starting); await this.#checking; await Promise.allSettled(this.#inspecting.values()); }
}
