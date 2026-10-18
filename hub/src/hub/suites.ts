import { suiteCandidate, type SuiteCandidate } from './suite-candidate.ts';
import type { DropletDependencies } from '../executor/droplet/dependencies.ts';
import { realClock, type Clock, type ClockTimer } from './clock.ts';
// Durable hub-owned suite jobs. A worker can outlive hub shutdown; restart watches its receipt/PID.
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile, stat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { hubShards, balanceCloseShards } from '../suite-shards.ts';
import { lintTests, testLintReport } from '../test-lint.ts';
import { suiteCheckCommand } from '../suite-check.ts';
import { planTierReport, tierReport, tierPlanWorkers, timingReceipts, type TierPlan, type SuiteDryRun } from '../suite-tier-report.ts';
import { durationBudgetReport, durationBudgetSummary, type DurationBudgetContext } from '../suite-duration-budget.ts';
import { baselineTimings, durationBudgetContext } from '../suite-duration-context.ts';
import { readDurationManifest } from '../suite-durations.ts';
import type { ProjectConfig } from '../init/config.ts';
import { suiteLimits } from '../suite-limits.ts';
import type { VerifyOccasion, SuiteStatus, VerificationQueue, VerificationHolder, DurationStats, SuiteSlot, SuiteSlotResult } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import type { Store } from './store.ts';
import { LocalExecutor } from '../executor/local.ts';
import { DropletExecutor, RemoteBudgetFull } from '../executor/droplet/droplet.ts';
import { readLeases, readLease, leaseDir, type DropletLease } from '../executor/droplet/lease.ts';
import { machineEnv } from '../executor/droplet/machine.ts';
import { testTiming } from '../executor/droplet/watchdog.ts';
import type { ExecutorKind, HostGate, Lease, Platform, RunRef } from '../executor/executor.ts';
import { idNumber } from '../tracker/item.ts';
import { describeSelection, sameSuiteSelection, type SuiteSelection, type SuiteRequest } from '../suite-selection.ts';
import { parseCoverageMap, type CoverageMap } from '../suite-coverage.ts';
import { VerificationWait } from './verification-wait.ts';
import { classifyCover, deriveCover, recentCovers } from './suite-cover.ts';
import { quarantineResults, quarantineSummary, suiteTestFailures } from '../suite-quarantine.ts';
import { suiteAdmissionTimeouts } from '../test-admission-outcome.ts';
import { machineHealthFromLog, type MachineHealth, type ShardMachineHealth } from '../executor/droplet/health.ts';

export type SuiteActor = { name: string; sessionId: string; shell: true };
export type SuiteJob = {
  health?: MachineHealth;
  shardHealth?: ShardMachineHealth[];
  hostGate?: HostGate;
  cover?: import('../protocol.ts').CoverRecord;
  limits?: import('../suite-limits.ts').SuiteLimits;
  config?: ProjectConfig;
  followsConfig?: boolean;
  workerPolicy?: { local: number; droplet: number };
  workersOverride?: number;
  occasion?: VerifyOccasion; shards?: SuiteJob[]; parentRun?: string; shardName?: string; shardingSkipped?: string; shardingSkipLogged?: boolean; groupMerged?: boolean;
  workers?: number; fallbackWorkers?: number; size?: string;
  executor: ExecutorKind; requestedExecutor?: ExecutorKind; requireRemote?: boolean; fallback?: string; fallbackLogged?: boolean; remoteAcquireAttempted?: boolean; timedOut?: boolean; platform?: Platform; lease?: Lease; remoteLogStart?: number; nextPoll?: number;
  machine?: { name?: string; size?: string; region?: string; lifetimeMs: number | null; costUsd: number | null };
  submissionKey?: string;
  id: string; mode: string; cwd: string; topic: string; to: string[]; actor: SuiteActor | null;
  head: string; branch: string; log: string; result: string; gate: string;
  pid: number | null; started: string | null; outcome: { code: number; cause: string } | null;
  artifact: string | null; reported: boolean; error: string | null; cleaned?: boolean;
  accountingWaitStarted?: string; accountingPending?: boolean;
  cancelled?: boolean;
  tree?: string | null; finished?: string;
  cached?: { run: string; head: string; tree: string };
  cacheBypass?: string;
  admittedAt?: string; completedAt?: string; waitMs?: number | null; runMs?: number | null;
  timingEstimated?: boolean;
  tierPlan?: TierPlan; tierReported?: boolean; durationBase?: string; budgetReported?: boolean;
  selection?: SuiteSelection;
  integrated?: boolean;
  queued?: string; priority?: number; item?: string | null;
  state?: 'queued' | 'launching' | 'running' | 'finished';
  locks?: string[]; requesterDied?: boolean;
};
export type VerifyResult = { executor: ExecutorKind; id: string; state: NonNullable<SuiteJob['state']>; result: 'passed' | 'failed' | 'cancelled' | null; head: string; finished: string | null; artifact: string | null; cached?: SuiteJob['cached'] };
export type StagePlatform = 'Linux droplet' | 'macOS';
export type StageCover = { id: string; head: string; tree: string; platform: StagePlatform };
const verifyResult = (job: SuiteJob): VerifyResult => ({ executor: job.executor, id: job.id, state: job.state ?? 'running', result: job.state !== 'finished' ? null : job.cancelled || job.requesterDied ? 'cancelled' : job.outcome ? job.outcome.code === 0 ? 'passed' : 'failed' : null, head: job.head, finished: job.finished ?? job.completedAt ?? null, artifact: job.artifact, ...(job.cached ? { cached: { ...job.cached } } : {}) });

// A supplied context is a complete snapshot; undefined reads Git, null omits budget reporting.
export type SuiteSchedulerOptions = { compatibility?: import('../executor/local.ts').LocalCompatibility; durationContext?: DurationBudgetContext | null; candidate?: SuiteCandidate; clock?: Clock; dropletServices?: DropletDependencies; waitClock?: Clock; projectConfig?: () => ProjectConfig; env?: NodeJS.ProcessEnv; executor?: ExecutorKind; localFallback?: boolean; lifetimeMs?: number; runTimeoutMs?: number; runTimeout?: string; onAccountingConfirmed?: (job: Readonly<SuiteJob>) => void | Promise<void>; onFallback?: (job: Readonly<SuiteJob>, cause: string) => void; budget?: number; remoteBudget?: number; shards?: number; onShardingSkipped?: (job: Readonly<SuiteJob>, cause: string) => void; cacheMaxAgeMs?: number; waitP90TargetMs?: number; locks?: string[]; requesterDead?: (actor: SuiteActor) => boolean; log?: LogFn; onQueue?: (queue: VerificationQueue) => void; onJob?: (job: Readonly<SuiteJob>) => void };
type HumanSlot = Omit<SuiteSlot, 'type'> & { queued: string; admittedAt?: string; left?: boolean };
const HUMAN_GRACE_MS = 10_000;
const ACCOUNTING_WAIT_MS = 120_000;
const KEY = 'suite-jobs';
// Hub-derived: callers cannot accidentally rotate the key when retrying a lost reply.
const submissionKey = (input: Pick<SuiteJob, 'actor' | 'cwd' | 'mode'>, head: string): string => createHash('sha256').update(JSON.stringify([input.actor?.sessionId ?? 'human', input.cwd, head, input.mode])).digest('hex');
const METRICS_WINDOW = 20;
const runRef = (job: SuiteJob): RunRef => ({ ...(job.hostGate ? { hostGate: job.hostGate } : {}), ...(job.limits ? { limits: job.limits } : {}), ...(job.config ? { config: job.config } : {}), id: job.id, cwd: job.cwd, head: job.head, ...(job.integrated ? { integrated: true } : {}), mode: job.mode, log: job.log, result: job.result, gate: job.gate, ...(job.workers !== undefined ? { workers: job.workers } : {}), ...(job.size ? { size: job.size } : {}), ...(job.tree !== undefined ? { tree: job.tree } : {}), ...(job.selection ? { selection: job.selection } : {}), ...(job.queued ? { queued: job.queued } : {}), ...(job.locks ? { locks: job.locks } : {}) });
export function machineAccounting(machine: NonNullable<SuiteJob['machine']>): string {
  return `lifetime ${machine.lifetimeMs === null ? 'pending confirmation' : Math.round(machine.lifetimeMs / 1000) + ' s'} · cost ${machine.costUsd === null ? 'pending confirmation' : '$' + machine.costUsd.toFixed(4)}`;
}
function elapsed(since: string | undefined | null, now: number): number | null {
  const start = Date.parse(since ?? '');
  return Number.isFinite(start) ? Math.max(0, now - start) : null;
}
function durations(values: Array<number | null | undefined>): DurationStats {
  const sorted = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const n = sorted.length;
  return { count: n, medianMs: n ? n % 2 ? sorted[Math.floor(n / 2)]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : null, p90Ms: n ? sorted[Math.ceil(n * 0.9) - 1]! : null };
}
export function suiteSummary(log: string, quarantineStatus?: string[]): string {
  const text = log.replace(/\x1b\[[0-9;]*m/g, '');
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/^(?:#|ℹ) (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/gm)) counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + Number(match[2]));
  const structured = suiteTestFailures(text);
  const admissions = suiteAdmissionTimeouts(text);
  const failures = (structured === null ? text.split('\n').filter(line => /^(?:\s*not ok \d+|✖ |duration budget: |shard failure )/.test(line))
    : [...structured.map(f => `${f.file}::${f.name}`), ...text.split('\n').filter(line => /^(?:✖ load gate: |duration budget: |shard failure )/.test(line))]).slice(0, 12).map(line => line.slice(0, 200));
  const merged = text.includes('\n--- close shards ---\n');
  const timings = merged
    ? text.split('\n--- close shards ---\n')[1]!.split('\n').filter(line => /^(?:shard duration shard-\d+ |total cost |occasion |suite duration .*overall wall)/.test(line)).map(line => line.slice(0, 300))
    : text.split('\n').filter(line => /^(?:verification queue wait |shard duration |suite duration )/.test(line)).slice(-8).map(line => line.slice(0, 300));
  timings.push(...durationBudgetSummary(text.split('\n')));
  timings.push(...text.split('\n').filter(line => /^duration regression /.test(line)).slice(0, 5));
  timings.push(...text.split('\n').filter(line => /^suite budget overhead /.test(line)).slice(-1));
  timings.push(...text.split('\n').filter(line => /^typecheck: /.test(line)));
  timings.push(...text.split('\n').filter(line => /^test lint (?:\(report only\):|finding:|tier:)/.test(line)));
  timings.push(...text.split('\n').filter(line => /^load gate workers /.test(line)));
  timings.push(...text.split('\n').filter(line => /^load gate: .* skipped, not load-gated;/.test(line)));
  timings.push(...text.split('\n').filter(line => /^load gate admission blocked:/.test(line)));
  timings.push(...text.split('\n').filter(line => /^quarantine load gate: /.test(line)));
  // Keep every failed repetition's full error/stack next to the count summary.
  const loadDiagnostics = text.split('\n').filter(line => line.startsWith('load gate failure '));
  timings.push(...loadDiagnostics);
  const tierLines = text.split('\n').filter(line => /^tier (?:T[1-4]:|share:)/.test(line));
  const lastTiers = new Map<string, string>();
  for (const line of tierLines) lastTiers.set(line.split(':')[0]!, line);
  const quarantined = quarantineStatus ?? quarantineSummary(quarantineResults(text));
  return `${counts.size ? [...counts].map(([k, v]) => `${k} ${v}`).join('; ') : 'counts unavailable (suite did not finish)'}${admissions.length ? `\nadmission timeouts ${admissions.length}\n${admissions.map(a => `${a.file ? a.file + ': ' : ''}${a.message}`).join('\n')}` : ''}${timings.length ? `\n${timings.join('\n')}` : ''}${failures.length ? `\nFailures:\n${failures.join('\n')}` : ''}${quarantined.length ? `\nQuarantine:\n${quarantined.join('\n')}` : ''}${lastTiers.size ? `\n${['tier T1', 'tier T2', 'tier T3', 'tier T4', 'tier share'].flatMap(key => lastTiers.has(key) ? [lastTiers.get(key)!] : []).join('\n')}` : ''}`;
}

export { SuiteAdmissionError } from './suite-candidate.ts';

export class Suites {
  readonly #candidate: SuiteCandidate;
  readonly #env: NodeJS.ProcessEnv;
  readonly #store: Store;
  readonly #root: string;
  readonly #report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>;
  readonly #jobs: SuiteJob[];
  readonly #waitMetrics: VerificationWait;
  readonly #waitTimer: ClockTimer;
  readonly #latestItems = new Map<number, SuiteJob>();
  readonly #latestBranches = new Map<string, SuiteJob>();
  readonly #order = new Map<string, number>();
  readonly #cards = new Map<string, string>();
  readonly #clock: Clock;
  readonly #timer: ClockTimer;
  #checking: Promise<void> | null = null;
  readonly #inspecting = new Map<string, Promise<void>>();
  readonly #starting = new Set<Promise<unknown>>();
  #closed = false;
  readonly #launching = new Set<string>();
  readonly #planning = new Set<string>();
  readonly #budget: number;
  #remoteBudget: number;
  #options: SuiteSchedulerOptions;
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
    this.#clock = options.clock ?? realClock;
    this.#env = options.env ?? process.env;
    this.#candidate = options.candidate ?? suiteCandidate(this.#env);
    this.#budget = Math.min(options.budget ?? 1, 1);
    this.#remoteBudget = options.remoteBudget ?? 4;
    if ((options.budget ?? 1) > 1) options.log?.({ event: 'verification-budget-capped', configured: options.budget, effective: this.#budget, reason: 'resource overlap remains disabled after T-215', reservedFor: 'T-218' });
    this.#store = store; this.#root = root; this.#report = report;
    this.#jobs = JSON.parse(store.meta(KEY) ?? '[]') as SuiteJob[];
    this.#waitMetrics = new VerificationWait(store, this.#jobs, options.projectConfig?.().verification.waitP90TargetMs ?? options.waitP90TargetMs, options.log, options.waitClock ?? this.#clock);
    this.#local = new LocalExecutor(this.#locks(), (lease, worker) => {
      if (this.#closed) return;
      const job = this.#jobs.find(job => job.id === lease.run);
      if (!job) return;
      job.lease = lease; job.pid = worker.pid; job.started = worker.started;
      job.outcome ??= worker.outcome;
      this.#save(job);
    }, id => { if (this.#jobs.find(job => job.id === id)?.outcome) throw new Error('suite cancelled before worker admission'); }, options.env, options.compatibility);
    this.#droplet = new DropletExecutor(root, store, options.log, options.env, options.projectConfig, { ...options.dropletServices, clock: this.#clock });
    for (const [index, job] of this.#jobs.entries()) {
      this.#order.set(job.id, index);
      job.executor ??= 'local';
      job.state ??= job.outcome || job.reported ? 'finished' : 'running';
      if (job.state !== 'queued' && !job.config && options.projectConfig) job.config = options.projectConfig();
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
    // Scheduling and metrics share hub time; local workers retain OS deadlines.
    this.#waitTimer = (options.waitClock ?? this.#clock).setInterval(() => this.#waitMetrics.record(), 1000);
    this.#waitTimer.unref();
    this.#timer = this.#clock.setInterval(() => { void this.#check(); }, 1000);
    this.#timer.unref();
  }
  configure(config: ProjectConfig): void {
    this.#options = { ...this.#options, ...config.verification };
    this.#remoteBudget = config.verification.remoteBudget;
    this.#waitMetrics.configure(config.verification.waitP90TargetMs);
    for (const job of this.#jobs) if (job.state === 'queued' && !job.config && job.followsConfig) { job.executor = config.verification.executor; job.requestedExecutor = job.executor; job.requireRemote = job.executor === 'droplet' && !config.verification.localFallback; }
    this.#save();
  }
  #captureConfig(job: SuiteJob): void {
    if (job.config || !this.#options.projectConfig) return;
    job.config = this.#options.projectConfig();
    const v = job.config.verification;
    job.workerPolicy = { local: v.workers, droplet: v.droplet.workers ?? v.workers };
    job.workers = job.workersOverride ?? job.workerPolicy[job.executor];
    job.fallbackWorkers = job.workersOverride ?? job.workerPolicy.local;
    job.limits = { testTimeoutMs: v.testTimeoutMs, stallTimeoutMs: v.stallTimeoutMs, loadGateWorkers: v.loadGateWorkers, workers: job.workers };
    this.#save(job);
  }
  #save = (job?: SuiteJob) => {
    this.#store.setMeta(KEY, JSON.stringify(this.#jobs));
    if (job && !job.parentRun) this.#remember(job, true);
  };
  #remember(job: SuiteJob, announce: boolean): void {
    if (!this.#order.has(job.id)) this.#order.set(job.id, this.#order.size);
    const later = (previous: SuiteJob | undefined) => !previous || this.#order.get(job.id)! >= this.#order.get(previous.id)!;
    if (job.item && later(this.#latestItems.get(idNumber(job.item)))) this.#latestItems.set(idNumber(job.item), job);
    if (job.branch && later(this.#latestBranches.get(job.branch))) this.#latestBranches.set(job.branch, job);
    // A successful report checkpoints the log artifact across async I/O. Publish its
    // terminal card once with that artifact, or immediately if reporting is blocked.
    if (announce && job.state === 'finished' && !job.reported && !job.error) return;
    // Report recovery makes a finished result eligible for stage evidence even
    // when its public result card was already published with a delivery error.
    const card = JSON.stringify([verifyResult(job), job.reported]);
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
  /** Completed integrated full receipts, never a cache label borrowed from another platform. */
  stageCovers(include?: Readonly<SuiteJob>): StageCover[] {
    const originals = new Map(this.#jobs.map(job => [job.id, job]));
    return [...this.#jobs.filter(job => job.id !== include?.id), ...(include ? [include] : [])].flatMap<StageCover>(job => {
      if (!job.integrated || job.branch !== 'dev' || !job.tree || job.selection?.mode !== 'full' || job.outcome?.code !== 0 || job.cancelled || job.requesterDied || !job.reported && job !== include) return [];
      if (job.executor === 'local' && job.platform?.os === 'darwin') return [{ id: job.id, head: job.head, tree: job.tree, platform: 'macOS' as const }];
      const source = job.cached ? originals.get(job.cached.run) : job;
      if (job.executor === 'droplet' && source?.occasion === 'stage' && job.platform?.os === 'linux'
        && (source.shards ? source.shards.length >= 2 && source.shards.every(shard => shard.outcome?.code === 0 && shard.platform?.os === 'linux') : !!source.shardingSkipped)) {
        return [{ id: job.id, head: job.head, tree: job.tree, platform: 'Linux droplet' as const }];
      }
      return [];
    });
  }
  stageMissing(tree: string | null | undefined, include?: Readonly<SuiteJob>): StagePlatform[] {
    const covers = this.stageCovers(include).filter(cover => cover.tree === tree);
    return (['Linux droplet', 'macOS'] as const).filter(platform => !covers.some(cover => cover.platform === platform));
  }
  #active = (job: SuiteJob) => !job.reported && (!job.outcome || (job.outcome.code !== 0 && !job.cleaned));
  #recordTiming(job: SuiteJob, completedAt: string): void {
    if (job.completedAt) return;
    job.completedAt = completedAt;
    const completed = Date.parse(completedAt);
    job.waitMs = job.cached ? 0 : job.pid && !job.admittedAt ? null : elapsed(job.queued, Date.parse(job.admittedAt ?? completedAt));
    job.runMs = job.cached || (!job.admittedAt && !job.pid) ? 0 : elapsed(job.admittedAt, completed);
    this.#options.log?.({ event: 'verification-timing', id: job.id, item: job.item ?? null, session: job.actor?.name ?? 'human', branch: job.branch, head: job.head, mode: job.selection?.mode ?? job.mode, executor: job.executor, platform: job.platform ?? null, health: job.health ?? null, shardHealth: job.shardHealth ?? null, cached: Boolean(job.cached), queuedAt: job.queued ?? null, admittedAt: job.admittedAt ?? null, completedAt, waitMs: job.waitMs, runMs: job.runMs, estimated: job.timingEstimated ?? false });
  }
  async cancel(id: string | undefined, actor: SuiteActor | null, authorize: () => void): Promise<{ id: string; topic: string; cancelled: true }> {
    if (this.#closed) throw new Error('hub is closing');
    authorize();
    const job = id ? this.#jobs.find(job => job.id === id || job.shards?.some(shard => shard.id === id))
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
      for (const shard of job.shards ?? []) { shard.cancelled = true; shard.outcome ??= job.outcome; this.#stopHostGate(shard.id); }
      this.#save(job);
    }
    void this.#inspectJob(job);
    return { id: job.id, topic: job.topic, cancelled: true };
  }
  classify(id: string, cause: string, note: string, by: string, authorize: () => void): { id: string; cover: import('../protocol.ts').CoverRecord } {
    if (this.#closed) throw new Error('hub is closing');
    authorize();
    const job = this.#jobs.find(job => job.id === id);
    if (!job) throw new Error(`no suite named ${id}`);
    job.cover = classifyCover(job, cause, note, by, this.#clock.now().toISOString());
    this.#save(job);
    this.#options.log?.({ event: 'verification-cover-classified', id, head: job.head, cover: job.cover });
    return { id, cover: job.cover };
  }
  start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { priority?: number; item?: string | null; integrated?: boolean; fresh?: boolean; dryRun?: boolean; executor?: ExecutorKind; workers?: number; size?: string; occasion?: VerifyOccasion }, authorize: () => void): Promise<{ id: string; pid: number | null; topic: string; position: number; reused?: true; cached?: SuiteJob['cached'] } | SuiteDryRun> {
    if (this.#closed) return Promise.reject(new Error('hub is closing'));
    const work = this.#start(input, authorize);
    this.#starting.add(work);
    void work.finally(() => this.#starting.delete(work)).catch(() => {});
    return work;
  }
  async #start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { priority?: number; item?: string | null; integrated?: boolean; fresh?: boolean; dryRun?: boolean; executor?: ExecutorKind; workers?: number; size?: string; occasion?: VerifyOccasion }, authorize: () => void): Promise<{ id: string; pid: number | null; topic: string; position: number; reused?: true; cached?: SuiteJob['cached'] } | SuiteDryRun> {
    const config = this.#options.projectConfig?.();
    const settings = { ...this.#options };
    const executor = input.executor ?? settings.executor ?? 'local';
    if (executor !== 'local' && executor !== 'droplet') throw new Error('executor must be local or droplet');
    if (input.workers !== undefined && (!Number.isSafeInteger(input.workers) || input.workers < 1)) throw new Error('workers must be a positive integer');
    if (input.size !== undefined) {
      if (executor !== 'droplet') throw new Error('size requires the droplet executor');
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(input.size)) throw new Error('size must be a nonempty slug');
      authorize();
      await this.#droplet.validateSize(input.size, config);
    }
    // Validate the candidate as before; only the hub owns execution policy.
    if (input.cwd !== this.#root) await suiteLimits(input.cwd, executor, this.#env);
    const limits = config ? { testTimeoutMs: config.verification.testTimeoutMs, stallTimeoutMs: config.verification.stallTimeoutMs, loadGateWorkers: config.verification.loadGateWorkers, workers: executor === 'droplet' ? config.verification.droplet.workers ?? config.verification.workers : config.verification.workers } : await suiteLimits(this.#root, executor, this.#env);
    const workers = input.workers ?? limits.workers;
    if (!input.dryRun && this.#jobs.some(job => this.#active(job) && (job.actor?.sessionId ?? 'human') === (input.actor?.sessionId ?? 'human'))) {
      // A retry needs only the current head, not another expensive candidate inspection.
      const existing = this.#existingSubmission(input, await this.#candidate.head(input.cwd), authorize);
      if (existing) return existing;
    }
    const id = randomUUID();
    const dir = join(this.#root, '.cland', 'run', 'suites', id);
    const { head, branch, selection, tree, tierPlan, budgetBase } = await this.#candidate.inspect(input.cwd, input.mode as SuiteRequest, workers);
    if (input.occasion && (!input.integrated || branch !== 'dev' || !tree || selection.fetchedDev !== head || input.mode !== 'all')) throw new Error('occasion requires an integrated dev full request (verify all) with fresh origin/dev fetch proof at its head');

    if (input.dryRun) {
      const context = this.#options.durationContext !== undefined ? this.#options.durationContext : await durationBudgetContext(input.cwd, { ...(budgetBase ? { base: budgetBase } : {}), env: this.#env });
      const budgetLines = context ? durationBudgetSummary(durationBudgetReport(context.manifest, context.tiers, baselineTimings(context, tierPlan.flatMap(row => row.files)), context.base)) : [];
      if (executor === 'droplet' && input.executor === 'droplet') {
        if (!tree) throw new Error('dirty worktree cannot be bundled for droplet');
        await this.#droplet.checkSpend(input.size, config);
      }
      if (head !== 'unknown' && await this.#candidate.head(input.cwd) !== head) throw new Error('head changed during admission; try dry-run again');
      authorize();
      return { dryRun: true, head, executor, workers, selection, tiers: tierPlan,
        lines: [describeSelection(selection), `planned tiers: ${tierPlan.map(row => row.tier).join(', ') || 'unavailable (no tier manifest)'}`, ...tierReport(tierPlan), ...budgetLines, ...testLintReport(await lintTests(input.cwd))] };
    }
    const existing = this.#existingSubmission(input, head, authorize);
    if (existing) return existing;
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const cacheExecutor = input.occasion === 'stage' ? executor : input.executor === 'droplet' ? 'droplet' : undefined;
    const cached = !input.fresh && tree ? this.#cached(tree, selection, workers, input.size, cacheExecutor, input.occasion) : undefined;
    const cacheBypass = !input.fresh && tree && input.executor === 'droplet' && !cached && this.#cached(tree, selection, workers, input.size)?.executor === 'local'
      ? 'explicit --executor droplet requires a droplet green; cached green ran locally' : undefined;

    // Older candidate runners and fixture packages remain usable. Coverage is
    // recorded only by a capable runner on a clean integrated full dev run.
    if (input.integrated && branch === 'dev' && tree && selection.mode === 'full' && !cached && (await readFile(join(input.cwd, 'hub/test/run-suite.ts'), 'utf8').catch(() => '')).includes('reduceCoverage')) selection.recordCoverage = { head, tree, run: id };
    authorize();
    const workerPolicy = config ? { local: config.verification.workers, droplet: config.verification.droplet.workers ?? config.verification.workers } : { local: (await suiteLimits(this.#root, 'local', this.#env)).workers, droplet: (await suiteLimits(this.#root, 'droplet', this.#env)).workers };
    const fallbackWorkers = input.workers ?? workerPolicy.local;
    const job: SuiteJob = { ...input, submissionKey: submissionKey(input, head), tierPlan, ...(budgetBase ? { durationBase: budgetBase } : {}), limits, workerPolicy, ...(input.workers !== undefined ? { workersOverride: input.workers } : {}), followsConfig: input.executor === undefined, workers, fallbackWorkers, executor, requestedExecutor: executor, requireRemote: executor === 'droplet' && (input.executor === 'droplet' || !(config?.verification.localFallback ?? settings.localFallback ?? true)), integrated: input.integrated === true && branch === 'dev', queued: this.#clock.now().toISOString(), priority: input.priority ?? Number.MAX_SAFE_INTEGER, state: 'queued', locks: settings.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock'], selection, tree, id, head, branch, log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready'), pid: null, started: null, outcome: null, artifact: null, reported: false, error: null };
    if (cacheBypass) job.cacheBypass = cacheBypass;
    // Persist the complete request before acknowledging it. No waiting worker exists.
    await writeFile(job.log, `Suite ${id} · ${input.mode}\n${describeSelection(selection)}\nWorktree ${input.cwd}\nBranch ${branch}\nHead ${head}\nWorkers ${workers} · source ${input.workers !== undefined ? 'explicit --workers' : 'hub config'}${input.size ? ` · size ${input.size}` : ''}\nQueued ${job.queued}\n`, { mode: 0o600 });
    if (cacheBypass) await appendFile(job.log, `Cache bypassed: ${cacheBypass}\n`);
    if (cached) {
      const artifact = this.#store.resolveArtifact(cached.artifact!)!;
      const originalLog = await readFile(artifact.path, 'utf8').catch(() => null);
      if (originalLog !== null && await this.#candidate.tree(input.cwd, head) === tree) {
        job.executor = cached.executor;
        if (cached.platform) job.platform = { ...cached.platform };
        if (cached.machine) job.machine = { ...cached.machine };
        if (cached.health) job.health = structuredClone(cached.health);
        if (cached.shardHealth) job.shardHealth = structuredClone(cached.shardHealth);
        job.cached = { run: cached.id, head: cached.head, tree: tree! };
        job.finished = cached.finished!;
        job.outcome = { code: 0, cause: 'cached' }; job.state = 'finished';
        await writeFile(job.log, `Cached candidate ${tree}\nOriginal run ${cached.id} · head ${cached.head}\nRequested head ${head}\n\n${originalLog}`, { mode: 0o600 });
      }
    }
    if (!job.cached && job.requireRemote) {
      if (!tree) throw new Error('dirty worktree cannot be bundled for droplet');
      await this.#droplet.checkSpend(input.size, config);
    }
    if (head !== 'unknown' && await this.#candidate.head(input.cwd) !== head) throw new Error('head changed during submission; submit verification again');
    authorize();
    if (this.#closed) throw new Error('hub is closing');
    // No await between the last identity fence and persistence: overlapping retries join one run.
    const concurrent = this.#existingSubmission(input, head, authorize);
    if (concurrent) return concurrent;
    this.#jobs.push(job); this.#save(job);
    if (!job.cached && executor === 'droplet' && (!this.#env.DIGITALOCEAN_TOKEN || !tree)) this.#fallback(job, !this.#env.DIGITALOCEAN_TOKEN ? 'DIGITALOCEAN_TOKEN is required' : 'dirty worktree cannot be bundled for droplet');
    await this.#check();
    return { id, pid: job.pid, topic: job.topic, position: job.state === 'queued' ? this.#ordered().findIndex(j => j.id === id) + 1 : 1, ...(job.cached ? { cached: job.cached } : {}) };
  }
  #existingSubmission(input: Pick<SuiteJob, 'actor' | 'cwd' | 'mode'>, head: string, authorize: () => void): { id: string; pid: number | null; topic: string; position: number; reused?: true; cached?: SuiteJob['cached'] } | null {
    authorize();
    const active = this.#jobs.find(job => this.#active(job) && (job.actor?.sessionId ?? 'human') === (input.actor?.sessionId ?? 'human'));
    if (!active) return null;
    if ((active.submissionKey ?? submissionKey(active, active.head)) !== submissionKey(input, head)) throw new Error('this session already has a suite queued or running');
    return { reused: true, id: active.id, pid: active.pid, topic: active.topic, position: active.state === 'queued' ? this.#ordered().findIndex(job => job.id === active.id) + 1 : 1, ...(active.cached ? { cached: active.cached } : {}) };
  }
  /** Targeted tests inspect the machine fence without joining or changing it. */
  async checkSlot(lease?: { pid: number; started: string; token: string }): Promise<{ admitted: true }> {
    const owner = (await this.#local.holder())?.holder;
    const job = owner && this.#jobs.find(j => j.executor === 'local' && j.integrated && j.pid === owner.pid && j.started === owner.started && !j.cleaned && !j.reported);
    const cover = owner?.integrated ?? job?.id;
    if (cover && owner && !(lease && lease.pid === owner.pid && lease.started === owner.started && lease.token === owner.token)) {
      throw new Error(`cover-quiet: integrated run ${cover} holds the local test slot; wait for it to finish (only the human may set CLAND_TEST_IGNORE_COVER=1)`);
    }
    return { admitted: true };
  }
  // Connection-owned reservations have no worker or result; a restart closes their owners.
  slot(input: SuiteSlot, owner: object): SuiteSlotResult {
    let slot = this.#humans.get(owner);
    if (!slot) {
      slot = { ...input, id: randomUUID(), queued: this.#clock.now().toISOString() };
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
      this.#options.log?.({ event: 'verification-human-left', id: slot.id, session: 'human', cwd: slot.cwd, head: slot.head, mode: slot.mode, reason, waitMs: elapsed(slot.queued, Date.parse(slot.admittedAt ?? this.#clock.now().toISOString())) });
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
  #cached(tree: string, selection: SuiteSelection, workers: number, size?: string, requiredExecutor?: ExecutorKind, occasion?: VerifyOccasion): SuiteJob | undefined {
    // Cancellations say nothing about the tree; failed or pending attempts still supersede green evidence.
    // Pre-admission head changes carry their cancellation in the outcome rather than a flag.
    const job = this.#jobs.findLast(j => (!requiredExecutor || j.executor === requiredExecutor) && !j.cached && !j.cancelled && !j.requesterDied && !j.outcome?.cause.startsWith('cancelled: queued head changed') && j.tree === tree && sameSuiteSelection(j.selection, selection) && (j.workers ?? 4) === workers && j.size === size
      && (occasion !== 'stage' || requiredExecutor === 'local' || j.occasion === 'stage'));
    if (!job || job.outcome?.code !== 0 || !job.reported || !job.finished || !job.artifact) return undefined;
    // Choose the newest compatible attempt before checking platform/success;
    // otherwise a failed or unreported fresh stage run resurrects an older green.
    if (occasion === 'stage' && !this.stageCovers().some(cover => cover.id === job.id && cover.platform === (requiredExecutor === 'local' ? 'macOS' : 'Linux droplet'))) return undefined;
    const age = this.#clock.now().getTime() - Date.parse(job.finished);
    const artifact = this.#store.resolveArtifact(job.artifact);
    return age >= 0 && age < (this.#options.cacheMaxAgeMs ?? 86400000) && artifact && artifact.status !== 'archived' && !artifact.fileDeleted ? job : undefined;
  }
  #queue(): SuiteJob[] {
    return this.#jobs.filter(j => j.state === 'queued' && !j.outcome).sort((a, b) => Number(b.integrated === true) - Number(a.integrated === true) || (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || (a.queued ?? '').localeCompare(b.queued ?? ''));
  }
  async #launch(job: SuiteJob): Promise<void> {
    job.state = 'launching'; job.admittedAt ??= this.#clock.now().toISOString(); this.#launching.add(job.id); this.#save(job);
    try {
      if (job.shards) { await this.#launchShards(job); return; }
      // Once remote collection starts, local bytes would count as remote output.
      // Pending delivery/start receipts can re-enter launch with that boundary set.
      if (job.remoteLogStart === undefined) await appendFile(job.log, `Workers ${job.workers} · source ${job.workersOverride !== undefined ? 'explicit --workers' : 'hub config'} · admitted\n`);
      const run = runRef(job);
      if (job.executor === 'droplet') {
        // lease.json owns delivery/admission facts; hub.db may predate the SSH reply.
        if (job.lease) job.lease = await readLease(leaseDir(this.#root, job.lease as DropletLease));
        else {
          const restored = (await readLeases(this.#root)).find(lease => lease.run === job.id && lease.state !== 'released');
          if (restored) job.lease = restored;
        }
        if (job.lease && Date.parse(job.lease.deadline) <= this.#clock.now().getTime()) throw new Error('remote machine lifetime expired');
        if (!(job.lease as DropletLease | undefined)?.execution?.delivered) {
          if (!job.lease && (!job.tree || await this.#candidate.tree(job.cwd, job.integrated ? undefined : job.head) !== job.tree)) { this.#fallback(job, 'dirty or changed worktree cannot be bundled for droplet'); return; }
          if (!job.lease) {
            if (!job.parentRun) await this.#hostGate(job);
            if (job.hostGate) run.hostGate = job.hostGate;
            if (job.cancelled) throw new Error('cancelled');
            if (await this.#candidate.tree(job.cwd, job.integrated ? undefined : job.head) !== job.tree) { this.#fallback(job, 'dirty or changed worktree cannot be bundled for droplet'); return; }
            if (job.remoteAcquireAttempted) { this.#fallback(job, 'previous droplet acquisition was interrupted'); return; }
            job.remoteAcquireAttempted = true; this.#save(job);
            try { job.lease = await this.#droplet.acquire(run, new Date(this.#clock.now().getTime() + (job.config?.verification.lifetimeMs ?? this.#options.lifetimeMs ?? 6600000)).toISOString(), undefined, job.config); }
            catch (error) {
              if (job.cancelled) throw error;
              if (job.requireRemote && !job.parentRun && error instanceof RemoteBudgetFull) {
                job.state = 'queued';
                delete job.admittedAt; delete job.remoteAcquireAttempted; delete job.config;
                this.#save(job);
                return;
              }
              this.#fallback(job, error instanceof Error ? error.message : 'provider unavailable'); return;
            }
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
        if (!lease.execution?.started) { job.nextPoll = this.#clock.now().getTime() + testTiming('CLAND_TEST_DROPLET_RUN_POLL_MS', 10000, this.#options.env); this.#save(job); return; }
      } else {
        const head = await this.#candidate.head(job.cwd);
        if (head !== job.head && !(job.integrated && job.tree && await this.#candidate.tree(job.cwd) === job.tree)) throw new Error(`cancelled: queued head changed from ${job.head} to ${head}; submit verification again`);
        job.lease = await this.#local.acquire(run, new Date(Date.now() + 15000).toISOString());
        this.#save(job);
        await this.#local.prepare(job.tree ?? job.head);
        await this.#local.deliver(job.lease, run);
        await this.#local.start(job.lease, run);
      }
      job.state = 'running'; this.#save(job);
    } catch (error) {
      // Failed acquisition can leave an unconfirmed provider resource. Retain its
      // durable lease so group completion waits for confirmed release as well.
      if ((job.parentRun || job.requireRemote) && !job.lease) {
        const lease = (await readLeases(this.#root)).find(lease => lease.run === job.id);
        if (lease) job.lease = lease;
      }
      // Keep the failure receipt: the inspector only terminates identity-verified processes.
      job.outcome ??= { code: 1, cause: error instanceof Error ? error.message : String(error) }; this.#save(job);
    } finally { this.#launching.delete(job.id); if (job.cancelled) void this.#inspectJob(job); }
  }
  async #planShards(job: SuiteJob, free: number): Promise<void> {
    // Cancellation may mark an outcome now, but cannot collect/report before reservation settles.
    this.#planning.add(job.id);
    try {
      const durable = (await readLeases(this.#root)).filter(lease => lease.state !== 'released').length;
      const count = Math.min(free, this.#remoteBudget - durable, job.config?.verification.shards ?? this.#options.shards ?? 2);
      let cause: string | undefined;
      if (count < 2) cause = free < 2 || this.#remoteBudget - durable < 2 ? 'fewer than 2 remote slots free' : `configured shard limit ${job.config?.verification.shards ?? this.#options.shards ?? 2}`;
      else {
        const context = this.#options.durationContext;
        const baseline = context?.base?.manifest;
        // Injected context owns allowance provenance too; retained names are timing identities.
        // Without an injected context, keep the production Git-backed lint path.
        const history = context === undefined ? {} : { legacyKeys: new Set(Object.entries(baseline?.allow ?? {})
          .filter(([, entry]) => !baseline?.budget.T1 || entry.legacy).map(([key]) => key)) };
        const plans = balanceCloseShards((await hubShards(job.cwd, false, undefined, history)).flatMap(shard => shard.targets), (await readDurationManifest(job.cwd))?.files ?? {}, count);
        job.shards ??= plans.map((plan, i) => {
          const id = `${job.id}-shard-${i + 1}`, dir = join(this.#root, '.cland/run/suites', id);
          const { shards: _shards, ...parent } = job;
          return { ...parent, id, parentRun: job.id, shardName: `shard-${i + 1}`, state: 'launching',
            selection: { mode: 'full', files: plan.files, reason: `close run shard ${i + 1}/${count}`, shard: { files: plan.files, nvim: plan.nvim }, ...(job.selection?.recordCoverage ? { recordCoverage: job.selection.recordCoverage } : {}) },
            log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready') };
        });
        for (const shard of job.shards) shard.tierPlan = await planTierReport(job.cwd, shard.selection!, job.workers ?? 4, undefined, history);
        this.#save(job);
        try { await this.#droplet.reserveShards(job.shards!.map(shard => shard.id), job.size, job.config); }
        catch (error) { cause = error instanceof Error ? error.message : String(error); }
      }
      if (cause) {
        if (job.shards) await this.#droplet.releaseShardReservations(job.shards.map(shard => shard.id));
        delete job.shards;
        job.shardingSkipped = cause; this.#save(job);
        this.#announceShardingSkip(job);
      }
    } finally { this.#planning.delete(job.id); }
  }
  #announceShardingSkip(job: SuiteJob): void {
    if (!job.shardingSkipped || job.shardingSkipLogged) return;
    this.#options.onShardingSkipped?.(job, `sharding skipped: ${job.shardingSkipped}`);
    this.#options.log?.({ event: 'verification-sharding-skipped', id: job.id, cause: job.shardingSkipped });
    job.shardingSkipLogged = true; this.#save(job);
  }
  async #launchShards(job: SuiteJob): Promise<void> {
    const shards = job.shards!;
    for (const shard of shards) {
      shard.admittedAt ??= job.admittedAt!;
      await mkdir(join(this.#root, '.cland/run/suites', shard.id), { recursive: true, mode: 0o700 });
      await writeFile(shard.log, '', { flag: 'a', mode: 0o600 });
    }
    // Repeat only an interrupted host gate; provider acquisition is reconciled per child.
    if (!shards.some(shard => shard.remoteAcquireAttempted)) await this.#hostGate(job);
    if (await this.#candidate.tree(job.cwd, job.integrated ? undefined : job.head) !== job.tree) throw new Error('dirty or changed integrated dev candidate');
    if (job.cancelled || job.outcome) throw new Error(job.outcome?.cause ?? 'cancelled');
    if (job.hostGate) for (const shard of shards) shard.hostGate = job.hostGate;
    this.#save(job);
    await Promise.all(shards.filter(shard => !shard.reported && !shard.outcome).map(shard => this.#launch(shard)));
    job.state = 'running'; this.#save(job);
  }
  async #collectShards(job: SuiteJob): Promise<boolean> {
    const shards = job.shards!;
    if (job.outcome) for (const shard of shards) {
      // Cancellation can follow a crash between reservation and child launch.
      await mkdir(join(this.#root, '.cland/run/suites', shard.id), { recursive: true, mode: 0o700 });
      await writeFile(shard.log, '', { flag: 'a', mode: 0o600 });
      shard.cancelled = true; shard.outcome ??= job.outcome;
      this.#stopHostGate(shard.id);
    }
    for (const shard of shards) if (shard.state === 'launching' && !shard.outcome && !this.#launching.has(shard.id) && this.#clock.now().getTime() >= (shard.nextPoll ?? 0)) this.#launchRemote(shard);
    await Promise.all(shards.map(shard => this.#inspectJob(shard)));
    if (shards.some(shard => !shard.reported)) return false;
    await this.#droplet.releaseShardReservations(shards.map(shard => shard.id));
    const failures = shards.filter(shard => shard.outcome?.code !== 0);
    job.accountingPending = shards.some(shard => shard.accountingPending);
    // Different machines' repeated log receipts cannot share the single-machine
    // last-valid-line reducer. Retain their original identities through caching.
    job.shardHealth = shards.map(shard => ({ run: shard.id, shard: shard.shardName!, machine: shard.machine ? {
      ...(shard.machine.name ? { name: shard.machine.name } : {}), ...(shard.machine.size ? { size: shard.machine.size } : {}), ...(shard.machine.region ? { region: shard.machine.region } : {}),
    } : null, health: shard.health ?? null }));
    delete job.health;
    job.outcome ??= { code: failures.length ? 1 : 0, cause: failures.map(shard => `${shard.shardName}: ${shard.outcome?.cause || `exit ${shard.outcome?.code}`}`).join('; ') };
    const platform = shards.find(shard => shard.platform)?.platform;
    if (platform) job.platform = platform;
    job.finished = this.#clock.now().toISOString();
    if (!failures.length && job.selection?.recordCoverage) {
      const maps = await Promise.all(shards.map(shard => readFile(join(this.#root, '.cland/run/suites', shard.id, 'coverage-map.json'), 'utf8').then(parseCoverageMap)));
      const merged: CoverageMap = { version: 1, head: job.head, tree: job.tree!, created: this.#clock.now().toISOString(), testFiles: [], files: {} };
      for (const map of maps) {
        if (map.head !== merged.head || map.tree !== merged.tree) throw new Error('shard coverage provenance mismatch');
        merged.testFiles.push(...map.testFiles);
        for (const [file, entry] of Object.entries(map.files)) {
          const target = merged.files[file] ??= { functions: [] };
          for (const fn of entry.functions) {
            const prior = target.functions.find(f => f.start === fn.start && f.end === fn.end);
            if (prior) prior.tests = [...new Set([...prior.tests, ...fn.tests])].sort();
            else target.functions.push(fn);
          }
        }
      }
      merged.testFiles.sort();
      await writeFile(join(this.#root, '.cland/run/suites', job.id, 'coverage-map.json'), JSON.stringify(merged), { mode: 0o600 });
    }
    const logs = await Promise.all(shards.map(async shard => {
      const log = await readFile(shard.log, 'utf8').catch(() => '');
      // Keep counts machine-readable and label every failure in the merged log.
      return `--- ${shard.shardName} ---\n${log.replace(/^(\s*(?:not ok \d+|✖ |duration budget: ).*)$/gm, `$1 [${shard.shardName}]`)}`;
    }));
    const lines = shards.map(shard => `shard duration ${shard.shardName} · ${shard.machine?.name ?? 'unavailable'} · ${shard.machine?.size ?? 'unknown'} ${shard.machine?.region ?? ''} · ${((shard.runMs ?? 0) / 1000).toFixed(2)}s · ${shard.machine ? machineAccounting(shard.machine) : 'cost $0.0000'}`);
    const prefix = (await readFile(job.log, 'utf8')).split('\n--- close shards ---\n')[0];
    await writeFile(job.log, `${prefix}\n--- close shards ---\noccasion ${job.occasion}\n${logs.join('\n')}\n${failures.map(shard => `shard failure ${shard.shardName}: ${shard.outcome?.cause || `exit ${shard.outcome?.code}`}`).join('\n')}\n${lines.join('\n')}\ntotal cost ${job.accountingPending ? 'pending confirmation' : '$' + shards.reduce((sum, shard) => sum + (shard.machine?.costUsd ?? 0), 0).toFixed(4)}\nsuite duration ${((this.#clock.now().getTime() - Date.parse(job.admittedAt!)) / 1000).toFixed(2)}s; overall wall from admission through collection\n`);
    job.groupMerged = true; job.cleaned = true; this.#save(job);
    return true;
  }
  #fallback(job: SuiteJob, cause: string): void {
    if (job.parentRun || job.requireRemote) throw new Error(cause);
    job.executor = 'local'; job.workers = job.fallbackWorkers ?? job.workers ?? 4; job.fallback = cause; job.state = 'queued';
    delete job.admittedAt; delete job.lease;
    this.#save(job);
    this.#announceFallback(job);
  }
  #announceFallback(job: SuiteJob): void {
    // The persisted log checkpoint also covers the notice, including old runs
    // restored after restart. Inspection retries must not repeat either one.
    if (!job.fallback || job.fallbackLogged) return;
    this.#options.onFallback?.(job, job.fallback);
    this.#options.log?.({ event: 'verification-executor-fallback', id: job.id, item: job.item ?? null, requested: 'droplet', effective: 'local', cause: job.fallback });
    job.fallbackLogged = true; this.#save(job);
  }
  #stopHostGate(id: string): void {
    const child = this.#hostGates.get(id);
    if (child?.pid && child.exitCode === null && child.signalCode === null) try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  }
  async #hostGate(job: SuiteJob): Promise<void> {
    if (this.#options.dropletServices?.hostGate) {
      job.hostGate = await this.#options.dropletServices.hostGate(runRef(job));
      this.#save(job);
      if (job.hostGate.code !== 0) throw new Error(`host typecheck failed (exit ${job.hostGate.code}); no droplet created`);
      return;
    }
    const tree = await this.#candidate.tree(job.cwd, job.integrated ? undefined : job.head);
    const command = await suiteCheckCommand(job.cwd);
    await appendFile(job.log, `\nHost gate: npm ${command.join(' ')}\n`);
    const env = machineEnv(this.#options.env); delete env.NODE_TEST_CONTEXT; delete env.CLAND_SUITE_LEASE;
    const fd = await open(job.log, 'a');
    try {
      const child = spawn('npm', command, { cwd: job.cwd, env, detached: true, stdio: ['ignore', fd.fd, fd.fd] });
      this.#hostGates.set(job.id, child);
      const code = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code ?? 1)); });
      job.hostGate = { tree, command, code };
      this.#save(job);
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
    await Promise.all(this.#jobs.filter(job => job.reported && job.accountingPending).map(job => this.#confirmAccounting(job).catch(error => {
      job.error = `accounting confirmation: ${String(error)}`; this.#save(job);
    })));
    for (const job of this.#jobs) if (job.executor === 'droplet' && job.state === 'launching' && !job.outcome && !this.#launching.has(job.id) && !await this.#restoreRemoteResult(job) && this.#clock.now().getTime() >= (job.nextPoll ?? 0)) this.#launchRemote(job);
    await Promise.all(this.#jobs.map(job => this.#inspectJob(job)));
    if (this.#closed) return;
    // Reserve launching jobs, including their asynchronous acquires, until release
    // is confirmed. A receipt alone does not free a billable remote resource.
    const active = this.#jobs.filter(j => j.state !== 'queued' && !j.cleaned && !j.reported);
    let remoteActive = active.filter(j => j.executor === 'droplet').reduce((sum, j) => sum + (j.shards?.filter(shard => !shard.cleaned).length ?? 1), 0);
    let localActive = active.filter(j => j.executor === 'local').length;
    // Human reservations expire even when no waiter needs the local slot.
    if ([...this.#humans.values()].some(slot => !slot.left && slot.admittedAt)) {
      this.#compatibility = await this.#local.holder();
      for (const [owner, slot] of this.#humans) {
        if (slot.left || !slot.admittedAt) continue;
        if (this.#compatibility?.holder?.token === slot.token || this.#clock.now().getTime() - Date.parse(slot.admittedAt) < HUMAN_GRACE_MS) localActive++;
        else this.leave(owner, 'admission grace expired');
      }
    }
    let localOccupied: boolean | undefined;
    for (const next of this.#ordered()) {
      if (this.#closed) return;
      const job = 'actor' in next ? next : null;
      if (job && (job.state !== 'queued' || job.outcome)) continue;
      if (job?.followsConfig && !job.config) {
        job.executor = this.#options.projectConfig?.().verification.executor ?? this.#options.executor ?? 'local';
        job.requestedExecutor = job.executor;
        job.requireRemote = job.executor === 'droplet' && !(this.#options.projectConfig?.().verification.localFallback ?? this.#options.localFallback ?? true);
      }
      const chosenExecutor = job?.executor;
      // Preparation and unconfirmed cleanup can occupy durable slots without a
      // running suite. Remote-only requests wait for those releases too.
      if (job?.requireRemote && (await readLeases(this.#root)).filter(lease => lease.state !== 'released').length >= this.#remoteBudget) continue;
      if (job && (job.state !== 'queued' || job.outcome)) continue;
      if (job?.executor === 'droplet' && remoteActive < this.#remoteBudget) {
        this.#captureConfig(job);
        if (job.occasion && !job.shardingSkipped) await this.#planShards(job, this.#remoteBudget - remoteActive);
        if (job.state !== 'queued' || job.outcome) continue;
        remoteActive += job.shards?.length ?? 1;
        this.#options.log?.({ event: 'verification-admitted', id: job.id, item: job.item ?? null, session: job.actor?.name ?? 'human', executor: 'droplet', remoteActive, remoteBudget: this.#remoteBudget });
        this.#launchRemote(job);
        continue;
      }
      if (job?.requireRemote) continue;
      if (localActive >= this.#budget) continue;
      localOccupied ??= await this.#local.occupied();
      if (localOccupied) continue;
      if (this.#closed || job && (job.state !== 'queued' || job.outcome || job.executor !== chosenExecutor)) continue;
      if (!job && ('actor' in next || next.left || next.admittedAt || ![...this.#humans.values()].includes(next))) continue;
      localActive++;
      if (job) {
        this.#captureConfig(job);
        if (job.executor === 'droplet') {
          if (job.occasion && !job.shardingSkipped) await this.#planShards(job, 0);
          this.#fallback(job, 'remote budget full');
        }
        await this.#launch(job);
      } else if (!('actor' in next) && !next.left && !next.admittedAt && [...this.#humans.values()].includes(next)) {
        next.admittedAt = this.#clock.now().toISOString();
        this.#options.log?.({ event: 'verification-human-admitted', id: next.id, session: 'human', cwd: next.cwd, head: next.head, mode: next.mode, waitMs: elapsed(next.queued, this.#clock.now().getTime()), graceMs: HUMAN_GRACE_MS });
      }
    }
  }

  #inspectJob(job: SuiteJob): Promise<void> {
    const pending = this.#inspecting.get(job.id);
    if (pending) return pending;
    if (this.#closed || job.reported || this.#launching.has(job.id) || this.#planning.has(job.id)) return Promise.resolve();
    const work = this.#inspect(job).catch(() => { /* saved errors are retried on the next tick */ }).finally(() => { this.#inspecting.delete(job.id); });
    this.#inspecting.set(job.id, work);
    return work;
  }
  async #restoreRemoteResult(job: SuiteJob): Promise<boolean> {
    if (job.executor !== 'droplet') return false;
    const text = await readFile(job.result, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (text === null) return false;
    const result = JSON.parse(text) as { code: number; cause?: string; finished: string; platform?: Platform; health?: MachineHealth; shardHealth?: ShardMachineHealth[] };
    if (!Number.isInteger(result.code) || typeof result.finished !== 'string' || !Number.isFinite(Date.parse(result.finished)) || result.cause !== undefined && typeof result.cause !== 'string') throw new Error('invalid remote result receipt');
    // The receipt survives deletion of the machine and can predate the last job
    // checkpoint. Reconcile it before polling or relaunching a persisted holder.
    if (!job.outcome || !job.cancelled && !job.requesterDied && !job.timedOut) job.outcome = { code: result.code, cause: result.cause ?? '' };
    job.finished = result.finished;
    if (result.platform) job.platform = result.platform;
    if (result.health) job.health = result.health;
    if (result.shardHealth) { job.shardHealth = result.shardHealth; delete job.health; }
    job.state = 'finished'; this.#save(job);
    return true;
  }
  async #confirmAccounting(job: SuiteJob): Promise<void> {
    const sources = job.shards ?? [job];
    for (const source of sources) {
      if (!source.lease || source.machine?.lifetimeMs !== null && source.machine?.costUsd !== null) continue;
      const lease = await readLease(leaseDir(this.#root, source.lease as DropletLease));
      if (lease.lease !== (source.lease as DropletLease).lease || lease.name !== (source.lease as DropletLease).name) throw new Error('accounting lease identity changed');
      if (lease.state !== 'released' || lease.lifetimeMs === undefined || lease.costUsd === undefined) return;
      source.lease = lease;
      source.machine = { name: lease.name, size: lease.size, region: lease.region, lifetimeMs: lease.lifetimeMs, costUsd: lease.costUsd };
    }
    // Publication is idempotent by run id. Save the confirmed numbers only after
    // the notice succeeds so a crash or unavailable topic retries the correction.
    await this.#options.onAccountingConfirmed?.(job);
    for (const source of sources) source.accountingPending = false;
    job.accountingPending = false; job.error = null; this.#save(job);
  }
  async #inspect(job: SuiteJob): Promise<void> {
    this.#announceFallback(job);
    this.#announceShardingSkip(job);
    if (job.state === 'queued' && !job.outcome) {
      if (!job.actor || !this.#options.requesterDead?.(job.actor)) return;
      job.requesterDied = true;
      job.outcome = { code: 130, cause: 'cancelled: requester died before admission' };
    }
    try {
      const restored = await this.#restoreRemoteResult(job);
      if (!restored && job.shards && !job.groupMerged && !await this.#collectShards(job)) return;
      const remote = job.executor === 'droplet';
      if (remote && !job.outcome && this.#clock.now().getTime() < (job.nextPoll ?? 0)) return;
      if (remote) job.nextPoll = this.#clock.now().getTime() + testTiming('CLAND_TEST_DROPLET_RUN_POLL_MS', 10000, this.#options.env);
      const timeoutMs = testTiming('CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS', job.config?.verification.runTimeoutMs ?? this.#options.runTimeoutMs ?? 4500000, this.#options.env);
      const startedAt = (job.lease as DropletLease | undefined)?.execution?.startedAt ?? job.admittedAt;
      if (remote && !job.outcome && job.lease && startedAt && this.#clock.now().getTime() - Date.parse(startedAt) > timeoutMs + testTiming('CLAND_TEST_EXECUTOR_TIMEOUT_GRACE_MS', 120000, this.#options.env)) {
        job.timedOut = true; job.outcome = { code: 124, cause: `run timeout ${job.config?.verification.runTimeout ?? this.#options.runTimeout ?? '75m'}` }; this.#save(job);
      }
      const receipt = !restored && job.lease ? remote ? await this.#droplet.status(job.lease as DropletLease) : await this.#local.status(job.lease) : null;
      if (!restored && remote && job.lease && job.remoteLogStart !== undefined) {
        try { await this.#collectLog(job); }
        catch (error) { if (receipt?.state !== 'lost' && !job.cancelled && !job.timedOut) throw error; }
        if (receipt?.state === 'done' || receipt?.state === 'lost') await writeFile(job.result, JSON.stringify({ code: receipt.code ?? 1, cause: receipt.cause ?? '', finished: receipt.finished ?? this.#clock.now().toISOString(), ...(receipt.platform ? { platform: receipt.platform } : {}) }));
      }
      if (receipt?.platform) job.platform = receipt.platform;
      if (receipt?.finished) job.finished = receipt.finished;
      if (receipt && (receipt.finished || !job.outcome) && (receipt.state === 'done' || receipt.state === 'lost') && !job.cancelled && !job.requesterDied && !job.timedOut) {
        job.outcome = { code: receipt.code ?? 1, cause: receipt.code === 124 ? `run timeout ${job.config?.verification.runTimeout ?? this.#options.runTimeout ?? '75m'}` : receipt.cause ?? '' };
      }
      if (job.cached && !this.#store.message(`suite:${job.id}`) && await this.#candidate.tree(job.cwd, job.integrated ? undefined : job.head) !== job.tree) {
        delete job.cached; job.outcome = { code: 1, cause: 'cached candidate changed; submit verification again' };
      }
      if (!job.outcome) {
        if (receipt && ['pending', 'running', 'paused', 'unknown'].includes(receipt.state)) return;
        job.outcome = { code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' };
      }
      if (remote) {
        if (!job.shards && !job.shardHealth) {
          const health = machineHealthFromLog(await readFile(job.log, 'utf8'));
          if (health) job.health = health;
        }
        await writeFile(job.result, JSON.stringify({ ...job.outcome, finished: job.finished ?? this.#clock.now().toISOString(), ...(job.platform ? { platform: job.platform } : {}), ...(job.health ? { health: job.health } : {}), ...(job.shardHealth ? { shardHealth: job.shardHealth } : {}) }));
      }
      job.state = 'finished';
      this.#save(job);
      if (!job.cleaned) {
        if (job.lease) {
          if (remote) {
            const lease = job.lease as DropletLease;
            job.accountingWaitStarted ??= this.#clock.now().toISOString();
            this.#save(job);
            if (job.cancelled || job.timedOut) {
              await this.#droplet.cancel(lease, 'SIGTERM');
              await this.#collectLog(job).catch(() => {});
            }
            if (job.selection?.recordCoverage && job.outcome.code === 0) {
              const path = join(this.#root, '.cland/run/suites', job.id, 'coverage-map.json');
              if (!await stat(path).then(() => true, () => false)) await this.#droplet.collectCoverage(lease, path);
              const map = parseCoverageMap(await readFile(path, 'utf8'));
              if (map.head !== job.head || map.tree !== job.tree) throw new Error('coverage map provenance mismatch');
            }
            // Retain the durable outcome/log while release retries. A bounded
            // window catches normal provider lag without holding a verdict
            // indefinitely; late confirmation gets its own correction notice.
            const released = await this.#droplet.release(lease, Date.parse(job.accountingWaitStarted) + ACCOUNTING_WAIT_MS).catch(error => {
              this.#options.log?.({ event: 'verification-release-deferred', id: job.id, lease: lease.lease, error: String(error) });
              return { lifetimeMs: lease.lifetimeMs ?? null, costUsd: lease.costUsd ?? null };
            });
            job.machine = { name: lease.name, size: lease.size, region: lease.region, ...released };
            this.#save(job);
            if (released.lifetimeMs === null || released.costUsd === null) {
              if (this.#clock.now().getTime() - Date.parse(job.accountingWaitStarted) < ACCOUNTING_WAIT_MS) {
                job.error = 'awaiting confirmed remote lease lifetime and cost';
                this.#save(job);
                return;
              }
              job.accountingPending = true;
            }
          } else {
            if (job.cancelled) await this.#local.cancel(job.lease, 'SIGTERM');
            await this.#local.release(job.lease);
          }
        }
        job.cleaned = true; this.#save(job);
      }
      if (job.tierPlan?.length && !job.tierReported && !job.cached) {
        const log = await readFile(job.log, 'utf8');
        const lines = tierReport(tierPlanWorkers(job.tierPlan, job.workers ?? 4), timingReceipts(log));
        if (!log.includes('\n' + lines.join('\n') + '\n')) await appendFile(job.log, lines.join('\n') + '\n');
        job.tierReported = true; this.#save(job);
      }
      if (!job.budgetReported && !job.cached && !job.parentRun) {
        try {
          const context = this.#options.durationContext !== undefined ? this.#options.durationContext : await durationBudgetContext(job.cwd, { head: job.head, ...(job.durationBase ? { base: job.durationBase } : {}), env: this.#env });
          if (context) {
            const log = await readFile(job.log, 'utf8');
            await appendFile(job.log, (log.endsWith('\n') ? '' : '\n') + durationBudgetReport(context.manifest, context.tiers, timingReceipts(log), context.base).join('\n') + '\n');
          }
        } catch { await appendFile(job.log, 'budget (report only): unavailable (report read failed)\n'); }
        job.budgetReported = true; this.#save(job);
      }
      this.#recordTiming(job, !job.cached && job.outcome.code === 0 && receipt?.finished ? receipt.finished : this.#clock.now().toISOString());
      if (job.integrated && !job.parentRun && !job.cover) {
        const cover = deriveCover(job, await readFile(job.log, 'utf8'));
        if (cover) job.cover = cover;
      }
      this.#save(job);
      if (job.parentRun) { job.reported = true; job.error = null; this.#save(job); return; }
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
  covers(): import('../protocol.ts').CoverStatus[] { return recentCovers(this.#jobs); }
  status(): SuiteStatus[] {
    return this.#jobs.map(job => ({
      ...(job.cover ? { cover: job.cover } : {}),
      ...(job.occasion ? { occasion: job.occasion } : {}),
      ...(job.workers === undefined ? {} : { workers: job.workers }), ...(job.size ? { size: job.size } : {}),
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
    const now = this.#clock.now().getTime();
    const recent = this.#jobs.filter(j => j.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!)).slice(0, METRICS_WINDOW);
    const metrics = { queueWait: this.#waitMetrics.snapshot(), window: METRICS_WINDOW, count: recent.length, wait: durations(recent.map(j => j.waitMs)), run: durations(recent.map(j => j.runMs)) };
    // Cache hits are already completed at submission. They count in the metrics but must
    // not bias the estimate for an actual queued execution, which missed the cache.
    const estimate = (mode: string | null, executor: ExecutorKind) => durations(recent.filter(j => j.executor === executor && !j.cached && j.outcome?.code === 0 && j.admittedAt && (mode === null || (j.selection?.mode ?? j.mode) === mode)).map(j => j.runMs)).medianMs;
    const occupying = this.#jobs.filter(j => j.state !== 'queued' && !j.cleaned && !j.reported);
    const active = occupying.find(j => j.executor === 'local');
    const human = [...this.#humans.values()].find(s => !s.left && s.admittedAt && (!shim || shim.holder?.token === s.token));
    const describe = (job: SuiteJob): VerificationHolder => {
      const lease = job.executor === 'droplet' ? job.lease as DropletLease | undefined : undefined;
      const runMs = elapsed(job.admittedAt, now), expected = estimate(job.selection?.mode ?? job.mode, job.executor);
      return { ...(job.occasion ? { occasion: job.occasion } : {}), ...(job.shardName ? { shard: job.shardName } : {}), kind: 'run', executor: job.executor, id: job.id, session: job.actor?.name ?? 'human', item: job.item ?? null, mode: job.selection?.mode ?? job.mode, pid: job.pid, worktree: job.cwd, since: job.admittedAt ?? null, runMs, etaMs: expected === null || runMs === null ? null : Math.max(0, expected - runMs), ...(lease ? { machine: { name: lease.name, size: lease.size, region: lease.region } } : {}) };
    };
    const remote = occupying.filter(j => j.executor === 'droplet').flatMap(job => job.shards ? job.shards.filter(shard => !shard.cleaned).map(describe) : [describe(job)]);
    let holder: VerificationHolder | null = null;
    if (shim && (!active || shim.holder?.pid !== active.pid)) {
      holder = { kind: 'hand run', executor: 'local', id: human?.id ?? null, session: human ? 'human' : null, item: null, mode: human?.mode ?? null, pid: shim.holder?.pid ?? null, worktree: shim.holder?.worktree ?? null, since: shim.since, runMs: elapsed(shim.since, now), etaMs: null };
    } else if (human) {
      holder = { kind: 'hand run', executor: 'local', id: human.id, session: 'human', item: null, mode: human.mode, pid: human.pid, worktree: human.cwd, since: human.admittedAt!, runMs: elapsed(human.admittedAt, now), etaMs: null };
    } else if (active) holder = describe(active);
    if (holder?.kind === 'hand run') {
      const expected = estimate(holder.mode, 'local');
      holder.etaMs = expected === null || holder.runMs === null || !shim?.holder ? null : Math.max(0, expected - holder.runMs);
    }
    let localEta = holder ? holder.etaMs : 0;
    const remoteEtas: Array<number | null> = [...remote.map(r => r.etaMs), ...Array.from({ length: Math.max(0, this.#remoteBudget - remote.length) }, () => 0)];
    const queued = this.#ordered();
    // A racing hand run can own the shim while the admitted worker waits for it.
    if (active && holder?.kind === 'hand run') queued.unshift(active);
    return { version: 1, at: new Date(now).toISOString(), holder, remote, remoteBudget: this.#remoteBudget, localFallback: this.#options.projectConfig?.().verification.localFallback ?? this.#options.localFallback ?? true,
      waiters: queued.map((j, i) => {
        const job = 'actor' in j ? j : null;
        const mode = job?.selection?.mode ?? j.mode;
        const executor = job?.requestedExecutor ?? job?.executor ?? 'local';
        const effective = job?.executor ?? 'local';
        const remoteIndex = remoteEtas.reduce<number>((best, eta, index) => best < 0 || eta !== null && (remoteEtas[best] === null || eta < remoteEtas[best]!) ? index : best, -1);
        const remoteEta = remoteEtas[remoteIndex] ?? null;
        const useRemote = effective === 'droplet' && (job?.requireRemote || localEta === null || remoteEta !== null && remoteEta <= localEta);
        const etaMs = useRemote ? remoteEta : localEta;
        const expectedRunMs = estimate(mode, useRemote ? 'droplet' : 'local');
        const waiter = { ...(job?.requireRemote ? { waitingFor: 'remote' as const } : {}), ...(job?.occasion ? { occasion: job.occasion } : {}), kind: job ? 'run' as const : 'hand run' as const, executor, id: j.id, session: job?.actor?.name ?? 'human', item: job?.item ?? null, mode, worktree: j.cwd, position: i + 1, queuedAt: j.queued ?? null, waitMs: elapsed(j.queued, now) ?? 0, etaMs, expectedRunMs };
        const nextEta = etaMs === null || expectedRunMs === null ? null : etaMs + expectedRunMs;
        if (useRemote) remoteEtas[remoteIndex] = nextEta;
        else localEta = nextEta;
        return waiter;
      }), metrics };
  }

  /** Observe completion of already admitted I/O; does not tick or advance time. */
  async settled(): Promise<void> {
    await this.#checking;
    await Promise.allSettled(this.#launchWork);
    await Promise.allSettled(this.#inspecting.values());
  }

  async close(): Promise<void> { this.#closed = true; for (const owner of this.#humans.keys()) this.leave(owner, 'hub closing'); this.#clock.clearInterval(this.#timer); (this.#options.waitClock ?? this.#clock).clearInterval(this.#waitTimer); for (const id of this.#hostGates.keys()) this.#stopHostGate(id); await Promise.allSettled(this.#starting); await this.#checking; await Promise.allSettled(this.#launchWork); await this.#reaping; await Promise.allSettled(this.#inspecting.values()); }
}
