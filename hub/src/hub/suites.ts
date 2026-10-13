// Durable hub-owned suite jobs. A worker can outlive hub shutdown; restart watches its receipt/PID.
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintHubShards, lintHubShardTree, ShardManifestError } from '../suite-shards.ts';
import { candidateTree } from '../verification-tree.ts';
import { pidAlive } from '../project.ts';
import { promisify } from 'node:util';
import type { SuiteStatus, VerificationQueue, VerificationHolder, DurationStats, SuiteSlot, SuiteSlotResult } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import type { Store } from './store.ts';
import { systemProcesses, endProcess } from '../system-processes.ts';
import { processStartedAsync } from './lock.ts';
import { compatibilityOccupied, compatibilityHolder } from '../suite-lock.ts';
import { idNumber } from '../tracker/item.ts';
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
export type VerifyResult = { id: string; state: NonNullable<SuiteJob['state']>; result: 'passed' | 'failed' | 'cancelled' | null; head: string; finished: string | null; artifact: string | null; cached?: SuiteJob['cached'] };
const verifyResult = (job: SuiteJob): VerifyResult => ({ id: job.id, state: job.state ?? 'running', result: job.state !== 'finished' ? null : job.cancelled || job.requesterDied ? 'cancelled' : job.outcome ? job.outcome.code === 0 ? 'passed' : 'failed' : null, head: job.head, finished: job.finished ?? job.completedAt ?? null, artifact: job.artifact, ...(job.cached ? { cached: { ...job.cached } } : {}) });

export type SuiteSchedulerOptions = { budget?: number; cacheMaxAgeMs?: number; locks?: string[]; requesterDead?: (actor: SuiteActor) => boolean; log?: LogFn; onQueue?: (queue: VerificationQueue) => void; onJob?: (job: Readonly<SuiteJob>) => void };
type HumanSlot = Omit<SuiteSlot, 'type'> & { queued: string; admittedAt?: string; left?: boolean };
const HUMAN_GRACE_MS = 10_000;
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

export class SuiteAdmissionError extends Error {
  readonly code = 'verify-shards';
  readonly files: string[];
  constructor(error: unknown) {
    super(`verify-shards: ${error instanceof Error ? error.message : String(error)}`);
    this.files = error instanceof ShardManifestError ? error.files : [];
  }
}

export class Suites {
  readonly #store: Store;
  readonly #root: string;
  readonly #report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>;
  readonly #jobs: SuiteJob[];
  readonly #latestItems = new Map<number, SuiteJob>();
  readonly #latestBranches = new Map<string, SuiteJob>();
  readonly #order = new Map<string, number>();
  readonly #cards = new Map<string, string>();
  readonly #timer: ReturnType<typeof setInterval>;
  #checking: Promise<void> | null = null;
  readonly #inspecting = new Map<string, Promise<void>>();
  readonly #starting = new Set<Promise<unknown>>();
  #closed = false;
  readonly #launching = new Set<string>();
  readonly #budget: number;
  readonly #options: SuiteSchedulerOptions;
  readonly #humans = new Map<object, HumanSlot>();
  #lastQueue = '';
  #compatibility: Awaited<ReturnType<typeof compatibilityHolder>> = null;
  constructor(store: Store, root: string, report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>, options: SuiteSchedulerOptions = {}) {
    this.#options = options;
    this.#budget = Math.min(options.budget ?? 1, 1);
    if ((options.budget ?? 1) > 1) options.log?.({ event: 'verification-budget-capped', configured: options.budget, effective: this.#budget, reason: 'resource overlap remains disabled after T-215', reservedFor: 'T-218' });
    this.#store = store; this.#root = root; this.#report = report;
    this.#jobs = JSON.parse(store.meta(KEY) ?? '[]') as SuiteJob[];
    for (const [index, job] of this.#jobs.entries()) {
      this.#order.set(job.id, index);
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
    for (const job of this.#jobs) this.#remember(job, false);
    this.#save();
    this.#timer = setInterval(() => { void this.#check(); }, 1000);
    this.#timer.unref();
  }
  #save = (job?: SuiteJob) => {
    this.#store.setMeta(KEY, JSON.stringify(this.#jobs));
    if (job) this.#remember(job, true);
  };
  #remember(job: SuiteJob, announce: boolean): void {
    if (!this.#order.has(job.id)) this.#order.set(job.id, this.#order.size);
    const later = (previous: SuiteJob | undefined) => !previous || this.#order.get(job.id)! >= this.#order.get(previous.id)!;
    if (job.item && later(this.#latestItems.get(idNumber(job.item)))) this.#latestItems.set(idNumber(job.item), job);
    if (job.branch && later(this.#latestBranches.get(job.branch))) this.#latestBranches.set(job.branch, job);
    // A successful report checkpoints the log artifact across async I/O. Publish its
    // terminal card once with that artifact, or immediately if reporting is blocked.
    if (announce && job.state === 'finished' && !job.reported && !job.error) return;
    const card = JSON.stringify(verifyResult(job));
    const moved = this.#cards.get(job.id) !== card;
    this.#cards.set(job.id, card);
    if (announce && moved) this.#options.onJob?.(job);
  }
  /** Latest submission by item or branch, reconstructed once at startup and maintained on saves. */
  latest(item: string, branch: string | null): VerifyResult | null {
    const byItem = this.#latestItems.get(idNumber(item)), byBranch = branch ? this.#latestBranches.get(branch) : undefined;
    const job = !byItem ? byBranch : !byBranch ? byItem : this.#order.get(byItem.id)! > this.#order.get(byBranch.id)! ? byItem : byBranch;
    return job ? verifyResult(job) : null;
  }
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
      job.cancelled = true; job.outcome = { code: 143, cause: 'cancelled' }; this.#save(job);
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
    const git = async (args: string[]) => exec('git', args, { cwd: input.cwd }).then(r => r.stdout.trim(), () => 'unknown');
    const [head, branch, selection] = await Promise.all([git(['rev-parse', 'HEAD']), git(['branch', '--show-current']), selectPackageSuite(input.cwd, input.mode as SuiteRequest)]);
    const tree = await candidateTree(input.cwd, head);
    // Bind lint to the captured committed build as well as the files a dirty package will execute.
    try {
      if (head !== 'unknown') await lintHubShardTree(input.cwd, head);
      await lintHubShards(input.cwd);
    } catch (error) { throw new SuiteAdmissionError(error); }
    await mkdir(dir, { recursive: true, mode: 0o700 });
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
    if (head !== 'unknown' && await git(['rev-parse', 'HEAD']) !== head) throw new Error('head changed during submission; submit verification again');
    authorize();
    if (this.#closed) throw new Error('hub is closing');
    if (this.#jobs.some(j => this.#active(j) && (j.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    this.#jobs.push(job); this.#save(job);
    await this.#check();
    return { id, pid: job.pid, topic: job.topic, position: job.state === 'queued' ? this.#ordered().findIndex(j => j.id === id) + 1 : 1, ...(job.cached ? { cached: job.cached } : {}) };
  }
  // Connection-owned reservations have no worker or result; a restart closes their owners.
  slot(input: SuiteSlot, owner: object): SuiteSlotResult {
    let slot = this.#humans.get(owner);
    if (!slot) {
      slot = { ...input, id: randomUUID(), queued: new Date().toISOString() };
      this.#humans.set(owner, slot);
      this.#options.log?.({ event: 'verification-human-queued', ...slot, session: 'human' });
      void this.#check();
    }
    if (slot.left) throw new Error('human suite reservation expired; submit again');
    return { id: slot.id, admitted: Boolean(slot.admittedAt), locks: this.#locks(), queue: this.snapshot() };
  }
  leave(owner: object, reason = 'connection closed'): void {
    const slot = this.#humans.get(owner);
    if (!slot) return;
    if (!slot.left) {
      slot.left = true;
      this.#options.log?.({ event: 'verification-human-left', id: slot.id, session: 'human', cwd: slot.cwd, head: slot.head, mode: slot.mode, reason, waitMs: elapsed(slot.queued, Date.parse(slot.admittedAt ?? new Date().toISOString())) });
    }
    if (reason === 'connection closed' || reason === 'hub closing') this.#humans.delete(owner);
    void this.#check();
  }
  async forced(input: SuiteSlot): Promise<void> {
    const queue = await this.queue();
    this.#options.log?.({ event: 'verification-forced', session: 'human', cwd: input.cwd, worktree: input.cwd, head: input.head, mode: input.mode, pid: input.pid, holder: queue.holder });
  }
  #locks(): string[] { return this.#options.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock']; }
  // Integrated dev precedes human waiters, then item rank; each group retains enqueue order.
  #ordered(): Array<SuiteJob | HumanSlot> {
    return [...this.#queue(), ...[...this.#humans.values()].filter(s => !s.left && !s.admittedAt)].sort((a, b) => {
      const integrated = (s: SuiteJob | HumanSlot) => 'actor' in s && s.integrated === true;
      const rank = (s: SuiteJob | HumanSlot) => 'actor' in s ? s.priority ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      return Number(integrated(b)) - Number(integrated(a)) || Number('actor' in a) - Number('actor' in b) || rank(a) - rank(b) || a.queued!.localeCompare(b.queued!);
    });
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
    job.state = 'launching'; job.admittedAt = new Date().toISOString(); this.#launching.add(job.id); this.#save(job);
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
        child.once('error', error => { if (this.#closed) return; job.outcome ??= { code: 1, cause: `worker could not start: ${error.message}` }; this.#save(job); });
        child.once('close', (code, signal) => {
          if (this.#closed) return;
          if (signal || code !== 0) job.outcome ??= { code: code ?? 1, cause: signal ? `worker killed by ${signal}` : `worker exited ${code}` };
          // A zero worker exit is a pass only when its durable package result exists.
          this.#save(job); void this.#check();
        });
        child.unref();
        job.pid = child.pid ?? null;
        job.started = job.pid ? await processStartedAsync(job.pid) : null;
        this.#save(job);
        if (!job.pid || !job.started) throw new Error('cannot establish suite worker process identity');
        admit();
        job.state = 'running'; this.#save(job);
        await writeFile(job.gate, 'ready');
      } finally { await fd.close(); }
    } catch (error) {
      // Keep the failure receipt: the inspector only terminates identity-verified processes.
      job.outcome ??= { code: 1, cause: error instanceof Error ? error.message : String(error) }; this.#save(job);
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
    this.#compatibility = await compatibilityHolder(this.#locks());
    for (const [owner, slot] of this.#humans) {
      if (slot.left || !slot.admittedAt) continue;
      if (this.#compatibility?.holder?.token === slot.token) return;
      if (Date.now() - Date.parse(slot.admittedAt) < HUMAN_GRACE_MS) return;
      this.leave(owner, 'admission grace expired');
    }
    const next = this.#ordered()[0];
    if (!next || await compatibilityOccupied(this.#locks()) || this.#closed) return;
    if ('actor' in next) {
      if (next.state === 'queued' && !next.outcome) await this.#launch(next);
    } else if (!next.left && !next.admittedAt && [...this.#humans.values()].includes(next)) {
      next.admittedAt = new Date().toISOString();
      this.#options.log?.({ event: 'verification-human-admitted', id: next.id, session: 'human', cwd: next.cwd, head: next.head, mode: next.mode, waitMs: elapsed(next.queued, Date.now()), graceMs: HUMAN_GRACE_MS });
    }
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
      this.#save(job);
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
        job.cleaned = true; this.#save(job);
      }
      this.#recordTiming(job, !job.cached && job.outcome.code === 0 && receipt?.finished ? receipt.finished : new Date().toISOString());
      this.#save(job);
      await this.#report(job, id => {
        if (job.artifact !== null && job.artifact !== id) throw new Error('suite artifact checkpoint already settled');
        job.artifact = id; this.#save(job);
      });
      job.reported = true; job.error = null; this.#save(job);
    } catch (error) { job.error = error instanceof Error ? error.message : String(error); this.#save(job); }
  }
  requesterExited(sessionId: string): void {
    for (const job of this.#jobs) {
      if (job.actor?.sessionId !== sessionId || job.state !== 'queued' || job.outcome) continue;
      job.requesterDied = true;
      job.outcome = { code: 130, cause: 'cancelled: requester died before admission' };
      this.#save(job);
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
    const human = [...this.#humans.values()].find(s => !s.left && s.admittedAt && (!shim || shim.holder?.token === s.token));
    let holder: VerificationHolder | null = null;
    if (shim && (!active || shim.holder?.pid !== active.pid)) {
      holder = { kind: 'hand run', id: human?.id ?? null, session: human ? 'human' : null, item: null, mode: human?.mode ?? null, pid: shim.holder?.pid ?? null, worktree: shim.holder?.worktree ?? null, since: shim.since, runMs: elapsed(shim.since, now), etaMs: null };
    } else if (human) {
      holder = { kind: 'hand run', id: human.id, session: 'human', item: null, mode: human.mode, pid: human.pid, worktree: human.cwd, since: human.admittedAt!, runMs: elapsed(human.admittedAt, now), etaMs: null };
    } else if (active) {
      holder = { kind: 'run', id: active.id, session: active.actor?.name ?? 'human', item: active.item ?? null, mode: active.selection?.mode ?? active.mode, pid: active.pid, worktree: active.cwd, since: active.admittedAt ?? null, runMs: elapsed(active.admittedAt, now), etaMs: null };
    }
    if (holder) {
      const expected = estimate(holder.mode);
      holder.etaMs = expected === null || holder.runMs === null || (holder.kind === 'hand run' && !shim?.holder) ? null : Math.max(0, expected - holder.runMs);
    }
    let eta = holder ? holder.etaMs : 0;
    const queued = this.#ordered();
    // A racing hand run can own the shim while the admitted worker waits for it.
    if (active && holder?.kind === 'hand run') queued.unshift(active);
    return { version: 1, at: new Date(now).toISOString(), holder,
      waiters: queued.map((j, i) => {
        const job = 'actor' in j ? j : null;
        const mode = job?.selection?.mode ?? j.mode;
        const expectedRunMs = estimate(mode);
        const waiter = { kind: job ? 'run' as const : 'hand run' as const, id: j.id, session: job?.actor?.name ?? 'human', item: job?.item ?? null, mode, worktree: j.cwd, position: i + 1, queuedAt: j.queued ?? null, waitMs: elapsed(j.queued, now) ?? 0, etaMs: eta, expectedRunMs };
        eta = eta === null || expectedRunMs === null ? null : eta + expectedRunMs;
        return waiter;
      }), metrics };
  }
  async close(): Promise<void> { this.#closed = true; for (const owner of this.#humans.keys()) this.leave(owner, 'hub closing'); clearInterval(this.#timer); await Promise.allSettled(this.#starting); await this.#checking; await Promise.allSettled(this.#inspecting.values()); }
}
