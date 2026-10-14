// Durable hub-owned suite jobs. A worker can outlive hub shutdown; restart watches its receipt/PID.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile, stat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { lintHubShards, lintHubShardTree, ShardManifestError } from '../suite-shards.ts';
import { candidateTree } from '../verification-tree.ts';
import { promisify } from 'node:util';
import type { SuiteStatus, VerificationQueue, VerificationHolder, DurationStats, SuiteSlot, SuiteSlotResult } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import type { Store } from './store.ts';
import { LocalExecutor } from '../executor/local.ts';
import { DropletExecutor } from '../executor/droplet/droplet.ts';
import { readLeases, readLease, leaseDir, type DropletLease } from '../executor/droplet/lease.ts';
import { machineEnv } from '../executor/droplet/machine.ts';
import { testTiming } from '../executor/droplet/watchdog.ts';
import type { ExecutorKind, Lease, Platform, RunRef } from '../executor/executor.ts';
import { idNumber } from '../tracker/item.ts';
import { selectPackageSuite, describeSelection, type SuiteSelection, type SuiteRequest } from '../suite-selection.ts';

export type SuiteActor = { name: string; sessionId: string; shell: true };
export type SuiteJob = {
  executor: ExecutorKind; platform?: Platform; lease?: Lease; remoteLogStart?: number; nextPoll?: number;
  machine?: { name?: string; size?: string; region?: string; lifetimeMs: number | null; costUsd: number | null };
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
export type VerifyResult = { executor: ExecutorKind; id: string; state: NonNullable<SuiteJob['state']>; result: 'passed' | 'failed' | 'cancelled' | null; head: string; finished: string | null; artifact: string | null; cached?: SuiteJob['cached'] };
const verifyResult = (job: SuiteJob): VerifyResult => ({ executor: job.executor, id: job.id, state: job.state ?? 'running', result: job.state !== 'finished' ? null : job.cancelled || job.requesterDied ? 'cancelled' : job.outcome ? job.outcome.code === 0 ? 'passed' : 'failed' : null, head: job.head, finished: job.finished ?? job.completedAt ?? null, artifact: job.artifact, ...(job.cached ? { cached: { ...job.cached } } : {}) });

export type SuiteSchedulerOptions = { executor?: ExecutorKind; lifetimeMs?: number; budget?: number; cacheMaxAgeMs?: number; locks?: string[]; requesterDead?: (actor: SuiteActor) => boolean; log?: LogFn; onQueue?: (queue: VerificationQueue) => void; onJob?: (job: Readonly<SuiteJob>) => void };
type HumanSlot = Omit<SuiteSlot, 'type'> & { queued: string; admittedAt?: string; left?: boolean };
const HUMAN_GRACE_MS = 10_000;
const KEY = 'suite-jobs';
const exec = promisify(execFile);
const METRICS_WINDOW = 20;
const runRef = (job: SuiteJob): RunRef => ({ id: job.id, cwd: job.cwd, head: job.head, mode: job.mode, log: job.log, result: job.result, gate: job.gate, ...(job.tree !== undefined ? { tree: job.tree } : {}), ...(job.selection ? { selection: job.selection } : {}), ...(job.queued ? { queued: job.queued } : {}), ...(job.locks ? { locks: job.locks } : {}) });
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
  readonly #local: LocalExecutor;
  readonly #droplet: DropletExecutor;
  readonly #hostGates = new Map<string, ChildProcess>();
  readonly #launchWork = new Set<Promise<void>>();
  readonly #reaping: Promise<void>;
  #compatibility: Awaited<ReturnType<LocalExecutor['holder']>> = null;
  constructor(store: Store, root: string, report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>, options: SuiteSchedulerOptions = {}) {
    this.#options = options;
    this.#budget = Math.min(options.budget ?? 1, 1);
    if ((options.budget ?? 1) > 1) options.log?.({ event: 'verification-budget-capped', configured: options.budget, effective: this.#budget, reason: 'resource overlap remains disabled after T-215', reservedFor: 'T-218' });
    this.#store = store; this.#root = root; this.#report = report;
    this.#jobs = JSON.parse(store.meta(KEY) ?? '[]') as SuiteJob[];
    this.#local = new LocalExecutor(this.#locks(), (lease, worker) => {
      if (this.#closed) return;
      const job = this.#jobs.find(job => job.id === lease.run);
      if (!job) return;
      job.lease = lease; job.pid = worker.pid; job.started = worker.started;
      job.outcome ??= worker.outcome;
      this.#save(job);
    }, id => { if (this.#jobs.find(job => job.id === id)?.outcome) throw new Error('suite cancelled before worker admission'); });
    this.#droplet = new DropletExecutor(root, store, options.log);
    for (const [index, job] of this.#jobs.entries()) {
      this.#order.set(job.id, index);
      job.executor ??= 'local';
      job.state ??= job.outcome || job.reported ? 'finished' : 'running';
      if (job.executor === 'local' && !job.cached && !job.reported && job.state !== 'queued') job.lease = this.#local.restore(runRef(job), job, job.lease);
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
    this.#reaping = this.#local.reap().catch(error => { this.#options.log?.({ event: 'verification-reap-blocked', error: String(error) }); });
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
    this.#options.log?.({ event: 'verification-timing', id: job.id, item: job.item ?? null, session: job.actor?.name ?? 'human', branch: job.branch, head: job.head, mode: job.selection?.mode ?? job.mode, executor: job.executor, platform: job.platform ?? null, cached: Boolean(job.cached), queuedAt: job.queued ?? null, admittedAt: job.admittedAt ?? null, completedAt, waitMs: job.waitMs, runMs: job.runMs, estimated: job.timingEstimated ?? false });
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
      this.#stopHostGate(job.id);
    }
    void this.#inspectJob(job);
    return { id: job.id, topic: job.topic, cancelled: true };
  }
  start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { priority?: number; item?: string | null; integrated?: boolean; fresh?: boolean; executor?: ExecutorKind }, authorize: () => void): Promise<{ id: string; pid: number | null; topic: string; position: number; cached?: SuiteJob['cached'] }> {
    if (this.#closed) return Promise.reject(new Error('hub is closing'));
    const work = this.#start(input, authorize);
    this.#starting.add(work);
    void work.finally(() => this.#starting.delete(work)).catch(() => {});
    return work;
  }
  async #start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { priority?: number; item?: string | null; integrated?: boolean; fresh?: boolean; executor?: ExecutorKind }, authorize: () => void): Promise<{ id: string; pid: number | null; topic: string; position: number; cached?: SuiteJob['cached'] }> {
    const executor = input.executor ?? this.#options.executor ?? 'local';
    if (executor !== 'local' && executor !== 'droplet') throw new Error('executor must be local or droplet');
    const identity = input.actor?.sessionId ?? 'human';
    if (this.#jobs.some(job => this.#active(job) && (job.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    const id = randomUUID();
    const dir = join(this.#root, '.cland', 'run', 'suites', id);
    const git = async (args: string[]) => exec('git', args, { cwd: input.cwd }).then(r => r.stdout.trim(), () => 'unknown');
    const [head, branch, selection] = await Promise.all([git(['rev-parse', 'HEAD']), git(['branch', '--show-current']), selectPackageSuite(input.cwd, input.mode as SuiteRequest)]);
    const tree = await candidateTree(input.cwd, head);
    if (executor === 'droplet' && !tree) throw new Error('dirty worktree cannot be bundled for droplet');
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
    const job: SuiteJob = { ...input, executor, integrated: input.integrated === true && branch === 'dev', queued: new Date().toISOString(), priority: input.priority ?? Number.MAX_SAFE_INTEGER, state: 'queued', locks: this.#options.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock'], selection, tree, id, head, branch, log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready'), pid: null, started: null, outcome: null, artifact: null, reported: false, error: null };
    // Persist the complete request before acknowledging it. No waiting worker exists.
    await writeFile(job.log, `Suite ${id} · ${input.mode}\n${describeSelection(selection)}\nWorktree ${input.cwd}\nBranch ${branch}\nHead ${head}\nQueued ${job.queued}\n`, { mode: 0o600 });
    if (cached) {
      const artifact = this.#store.resolveArtifact(cached.artifact!)!;
      const originalLog = await readFile(artifact.path, 'utf8').catch(() => null);
      if (originalLog !== null && await candidateTree(input.cwd, head) === tree) {
        job.executor = cached.executor;
        if (cached.platform) job.platform = { ...cached.platform };
        if (cached.machine) job.machine = { ...cached.machine };
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
    job.state = 'launching'; job.admittedAt ??= new Date().toISOString(); this.#launching.add(job.id); this.#save(job);
    try {
      const run = runRef(job);
      if (job.executor === 'droplet') {
        // lease.json owns delivery/admission facts; hub.db may predate the SSH reply.
        if (job.lease) job.lease = await readLease(leaseDir(this.#root, job.lease as DropletLease));
        else {
          const restored = (await readLeases(this.#root)).find(lease => lease.run === job.id && lease.state !== 'released');
          if (restored) job.lease = restored;
        }
        if (job.lease && Date.parse(job.lease.deadline) <= Date.now()) throw new Error('remote machine lifetime expired');
        if (!(job.lease as DropletLease | undefined)?.execution?.delivered) {
          if (await candidateTree(job.cwd, job.head) !== job.tree) throw new Error('dirty or changed worktree cannot be bundled for droplet');
          if (!job.lease) {
            await this.#hostGate(job);
            if (job.cancelled) throw new Error('cancelled');
            if (await candidateTree(job.cwd, job.head) !== job.tree) throw new Error('candidate changed during host typecheck');
            job.lease = await this.#droplet.acquire(run, new Date(Date.now() + (this.#options.lifetimeMs ?? 6600000)).toISOString());
          }
          job.remoteLogStart ??= (await stat(job.log)).size;
          this.#save(job);
          await this.#droplet.deliver(job.lease as DropletLease, run);
        }
        const lease = job.lease as DropletLease;
        job.remoteLogStart ??= (await stat(job.log)).size;
        this.#save(job);
        if (job.cancelled) throw new Error('cancelled');
        if (!lease.execution?.started) await this.#droplet.start(lease, run);
        if (!lease.execution?.started) { job.nextPoll = Date.now() + testTiming('CLAND_TEST_DROPLET_RUN_POLL_MS', 10000); this.#save(job); return; }
      } else {
        const head = await exec('git', ['rev-parse', 'HEAD'], { cwd: job.cwd }).then(r => r.stdout.trim(), () => 'unknown');
        if (head !== job.head) throw new Error(`cancelled: queued head changed from ${job.head} to ${head}; submit verification again`);
        job.lease = await this.#local.acquire(run, new Date(Date.now() + 15000).toISOString());
        this.#save(job);
        await this.#local.prepare(job.tree ?? job.head);
        await this.#local.deliver(job.lease, run);
        await this.#local.start(job.lease, run);
      }
      job.state = 'running'; this.#save(job);
    } catch (error) {
      // Keep the failure receipt: the inspector only terminates identity-verified processes.
      job.outcome ??= { code: 1, cause: error instanceof Error ? error.message : String(error) }; this.#save(job);
    } finally { this.#launching.delete(job.id); if (job.cancelled) void this.#inspectJob(job); }
  }
  #stopHostGate(id: string): void {
    const child = this.#hostGates.get(id);
    if (child?.pid && child.exitCode === null && child.signalCode === null) try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  }
  async #hostGate(job: SuiteJob): Promise<void> {
    await appendFile(job.log, '\nHost gate: npm run typecheck\n');
    const env = machineEnv(); delete env.NODE_TEST_CONTEXT; delete env.CLAND_SUITE_LEASE;
    const fd = await open(job.log, 'a');
    try {
      const child = spawn('npm', ['run', 'typecheck'], { cwd: job.cwd, env, detached: true, stdio: ['ignore', fd.fd, fd.fd] });
      this.#hostGates.set(job.id, child);
      const code = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code ?? 1)); });
      if (code !== 0) throw new Error(`host typecheck failed (exit ${code}); no droplet created`);
    } finally { this.#hostGates.delete(job.id); await fd.close(); }
  }
  #launchRemote(job: SuiteJob): void {
    const work = this.#launch(job).finally(() => this.#launchWork.delete(work));
    this.#launchWork.add(work);
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
    await this.#reaping;
    for (const job of this.#jobs) if (job.executor === 'droplet' && job.state === 'launching' && !job.outcome && Date.now() >= (job.nextPoll ?? 0) && !this.#launching.has(job.id)) this.#launchRemote(job);
    await Promise.all(this.#jobs.map(job => this.#inspectJob(job)));
    if (this.#closed) return;
    const active = this.#jobs.filter(j => !j.reported && (j.state !== 'queued' && !j.outcome || j.outcome && j.outcome.code !== 0 && !j.cleaned)).length;
    if (active >= this.#budget) return;
    this.#compatibility = await this.#local.holder();
    for (const [owner, slot] of this.#humans) {
      if (slot.left || !slot.admittedAt) continue;
      if (this.#compatibility?.holder?.token === slot.token) return;
      if (Date.now() - Date.parse(slot.admittedAt) < HUMAN_GRACE_MS) return;
      this.leave(owner, 'admission grace expired');
    }
    const next = this.#ordered()[0];
    if (!next || (!('actor' in next) || next.executor === 'local') && await this.#local.occupied() || this.#closed) return;
    if ('actor' in next) {
      if (next.state === 'queued' && !next.outcome) { if (next.executor === 'droplet') this.#launchRemote(next); else await this.#launch(next); }
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
      const remote = job.executor === 'droplet';
      if (remote && !job.outcome && Date.now() < (job.nextPoll ?? 0)) return;
      if (remote) job.nextPoll = Date.now() + testTiming('CLAND_TEST_DROPLET_RUN_POLL_MS', 10000);
      const receipt = job.lease ? remote ? await this.#droplet.status(job.lease as DropletLease) : await this.#local.status(job.lease) : null;
      if (remote && job.lease && job.remoteLogStart !== undefined) {
        try { await this.#collectLog(job); }
        catch (error) { if (receipt?.state !== 'lost' && !job.cancelled) throw error; }
        if (receipt?.state === 'done' || receipt?.state === 'lost') await writeFile(job.result, JSON.stringify({ code: receipt.code ?? 1, cause: receipt.cause ?? '', finished: receipt.finished ?? new Date().toISOString(), ...(receipt.platform ? { platform: receipt.platform } : {}) }));
      }
      if (receipt?.platform) job.platform = receipt.platform;
      if (receipt?.finished) job.finished = receipt.finished;
      if (receipt && (receipt.finished || !job.outcome) && (receipt.state === 'done' || receipt.state === 'lost') && !job.cancelled && !job.requesterDied) {
        job.outcome = { code: receipt.code ?? 1, cause: receipt.cause ?? '' };
      }
      if (job.cached && !this.#store.message(`suite:${job.id}`) && await candidateTree(job.cwd, job.head) !== job.tree) {
        delete job.cached; job.outcome = { code: 1, cause: 'cached candidate changed; submit verification again' };
      }
      if (!job.outcome) {
        if (receipt && ['pending', 'running', 'paused', 'unknown'].includes(receipt.state)) return;
        job.outcome = { code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' };
      }
      if (remote) await writeFile(job.result, JSON.stringify({ ...job.outcome, finished: job.finished ?? new Date().toISOString(), ...(job.platform ? { platform: job.platform } : {}) }));
      job.state = 'finished';
      this.#save(job);
      if (!job.cleaned) {
        if (job.lease) {
          if (remote) {
            const lease = job.lease as DropletLease;
            if (job.cancelled) {
              await this.#droplet.cancel(lease, 'SIGTERM');
              await this.#collectLog(job).catch(() => {});
            }
            const released = await this.#droplet.release(lease);
            job.machine = { name: lease.name, size: lease.size, region: lease.region, ...released };
            this.#save(job);
            if (released.costUsd === null) throw new Error('remote machine release not yet confirmed');
          } else {
            if (job.cancelled) await this.#local.cancel(job.lease, 'SIGTERM');
            await this.#local.release(job.lease);
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
  async #collectLog(job: SuiteJob): Promise<void> {
    if (job.remoteLogStart === undefined) return;
    for (;;) {
      // Local byte size is authoritative after a crash between append and checkpoint.
      const offset = (await stat(job.log)).size - job.remoteLogStart;
      const chunk = await this.#droplet.log(job.lease as DropletLease, offset);
      if (chunk.next === offset) return;
      await appendFile(job.log, chunk.bytes);
      if (chunk.next - offset < 262144) return;
    }
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
      executor: job.executor, ...(job.platform ? { platform: job.platform } : {}),
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
    this.#compatibility = await this.#local.holder();
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
    const active = this.#jobs.find(j => j.state !== 'queued' && (j.pid !== null || j.executor === 'droplet' || j.state === 'launching') && this.#active(j));
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
  async close(): Promise<void> { this.#closed = true; for (const owner of this.#humans.keys()) this.leave(owner, 'hub closing'); clearInterval(this.#timer); for (const id of this.#hostGates.keys()) this.#stopHostGate(id); await Promise.allSettled(this.#starting); await this.#checking; await Promise.allSettled(this.#launchWork); await this.#reaping; await Promise.allSettled(this.#inspecting.values()); }
}
