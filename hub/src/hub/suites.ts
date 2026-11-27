import { suiteCommandOutcome, suiteInfrastructureCauses, type SuiteInfrastructureSource } from '../suite-infrastructure.ts';
import { SuiteRetention } from '../suite-retention.ts';
import { SUITE_RETENTION_PASS_LIMIT } from '../suite-retention-policy.ts';
import { withCleanupAsync } from '../cleanup.ts';
import { hostVerifyWorktree, removeHostVerifyWorktree, validateHostVerifyWorktree, hostVerifyDirectory, type HostVerifySnapshot } from '../territory.ts';
import { RawCoverageSweep, removeRawCoverage } from '../suite-raw-coverage.ts';
import { recentCoverGreens } from '../suite-load-rerun.ts';
import { memberVerificationReason, batchT1Summary, type BatchT1 } from '../batch-member-verification.ts';
import { batchDevT3Cover, fullPeriodicDevT3Cover, DEV_T3_BACKSTOP_MS } from '../dev-t3-coverage.ts';
import { completeTierPlanReason, terminalTierPlanReason, parseTierReceipts, tierReceipt, type TierReceipt } from '../verification-tier-receipts.ts';
import { parseTimingReceipts, type TimingReceipt } from '../suite-timing-receipts.ts';

import { suiteRecoveryState, isolatedUnavailableReport, isolatedSuiteProcessOwned, isolatedSuiteEvidencePath, outsideSuitePath, sealSuiteJob } from './suite-isolation.ts';
import { lightBatchSelection, LIGHT_BATCH_POLICY } from '../batch-selection.ts';
import { wholeSuiteSelection, tierTestMask } from '../suite-completeness.ts';
import { batchInteractionSelection, batchMemberPaths } from '../suite-interactions.ts';
import { appendSuiteProvenance, withSuiteLogPublication } from '../suite-provenance.ts';
import { machineAccounting } from '../suite-accounting.ts';
export { machineAccounting } from '../suite-accounting.ts';
import { suiteAuthor } from './suite-author.ts';
import { missingDependencyHint } from '../dependency-install.ts';
import { pinVerificationPlan, verificationSteps, verificationInterrupted, verificationStepResults } from '../verification-plan.ts';
import { loadProofIdentities, skipT4LoadRepetitions, soakDeadlinePlan, soakCalibration, soakExecutionSeconds } from '../suite-load-gate-plan.ts';
import { suiteProgress, progressLines, passAccounting } from '../suite-progress.ts';
import { terminalDeadlineMetadata } from './suite-result-metadata.ts';
import { tierExecution, executionLines } from '../suite-execution.ts';
import { suiteCandidate, type SuiteCandidate } from './suite-candidate.ts';
import type { DropletDependencies } from '../executor/droplet/dependencies.ts';
import { realClock, type Clock, type ClockTimer } from './clock.ts';
// Durable hub-owned suite jobs. A worker can outlive hub shutdown; restart watches its receipt/PID.
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { aggregateSuiteLogs, readSuiteEvidence, retainedLoadProofs, suiteEvidence, suiteLogLines } from '../suite-log.ts';
import { appendFile, copyFile, readdir, mkdir, readFile, writeFile, rename, rm, stat, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { hubShards, balanceCloseShards, readTierAssignments } from '../suite-shards.ts';
import { lintTests, testLintReport } from '../test-lint.ts';
import { clandRunner, verificationCommands, recordedCommands } from '../verification-commands.ts';
import { planTierReport, projectedTierWall, tierReport, tierPlanWorkers, timingReceipts, type TierPlan, type SuiteDryRun } from '../suite-tier-report.ts';
import { durationBudgetReport, durationBudgetSummary, type DurationBudgetContext } from '../suite-duration-budget.ts';
import { baselineTimings, durationBudgetContext, durationHistory } from '../suite-duration-context.ts';
import { readDurationManifest } from '../suite-durations.ts';
import { normalizeRetainedShardPolicy, type ProjectConfig } from '../init/config.ts';
import { suiteLimits, suiteLimitsFromConfig } from '../suite-limits.ts';
import type { VerifyOccasion, SuiteStatus, VerificationQueue, VerificationHolder, DurationStats, SuiteSlot, SuiteSlotResult } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import type { Store } from './store.ts';
import { LocalExecutor } from '../executor/local.ts';
import { DropletExecutor, ProviderCapacityUnavailable, RemoteBudgetFull } from '../executor/droplet/droplet.ts';
import { readLeases, readLease, leaseDir, type DropletLease } from '../executor/droplet/lease.ts';
import { machineEnv } from '../executor/droplet/machine.ts';
import { testTiming } from '../executor/droplet/watchdog.ts';
import type { ExecutorKind, HostGate, Lease, Platform, RunRef } from '../executor/executor.ts';
import { DeliveryTransportError, coverageDownloadDiagnostic } from '../executor/droplet/run.ts';
import { ReadinessDeadlineError } from '../executor/droplet/readiness-deadline.ts';
import { idNumber } from '../tracker/item.ts';
import { diagnosticTestFile, taskSuiteSelection, describeSelection, sameSuiteSelection, type SuiteSelection, type SuiteRequest } from '../suite-selection.ts';
import { parseCoverageMap, mergeCoverageFiles } from '../suite-coverage.ts';
import { VerificationWait } from './verification-wait.ts';
import { classifyCover, deriveCover, greenWithReceipt, incompleteCollection, recentCovers } from './suite-cover.ts';
import { flakyQuarantineManifest, quarantineIdentityReason, quarantineResults, quarantineSummary, suiteTestFailures } from '../suite-quarantine.ts';
import { flakyRerunCommands, passingFlakyRepeat } from './batch-flakes.ts';
import { failingTests } from './shared-defects.ts';
import { suiteAdmissionTimeouts } from '../test-admission-outcome.ts';
import { machineHealthFromLog, type MachineHealth, type ShardMachineHealth } from '../executor/droplet/health.ts';
import { occasionSelection } from '../verification-occasion.ts';
import { unavailableWebPhase, webUnavailableLine, type WebPhaseUnavailable } from '../web-phase.ts';
import { receiptExecutionMatches } from '../verification-tree.ts';
import { VERIFY_OCCASIONS } from '../verification-policy.ts';

export type SuiteActor = { name: string; sessionId: string; shell: true };
export type SuiteAdmission = { id: string; pid: number | null; topic: string; position: number; reused?: true; cached?: SuiteJob['cached'] };
export type TestSlotWaiter = { id: string; sessionId: string; cover: string };
export type SuiteJob = {
  timingReceipts?: TimingReceipt[];
  timingSummary?: Array<{ run: string; head: string; tree: string; platform: string; command: string; step: string; samples: number }>;
  timingShards?: { state: 'sharded'; runs: string[] };
  flaky?: { owners: Record<string, string>; runs: string[]; commands?: import('../verification-commands.ts').VerificationCommands; rejected?: string };
  tierReceipts?: TierReceipt[];
  batchT3Proof?: { version: 1; run: string; head: string; tree: string };
  periodicT3Proof?: { version: 1; run: string; head: string; tree: string };
  batchT1?: BatchT1;
  webPhase?: WebPhaseUnavailable;
  commands?: import('../verification-commands.ts').VerificationCommands;
  batch?: import('../protocol.ts').BatchSuite;
  sequence?: number;
  health?: MachineHealth;
  shardHealth?: ShardMachineHealth[];
  hostGate?: HostGate;
  cover?: import('../protocol.ts').CoverRecord;
  limits?: import('../suite-limits.ts').SuiteLimits;
  config?: ProjectConfig;
  followsConfig?: boolean;
  workerPolicy?: { local: number; droplet: number };
  workersOverride?: number;
  shardWait?: { started: number; projectedSeconds: number; timeoutSeconds: number; waitedSeconds?: number; path?: 'sharded' | 'fallback'; fallback?: { size: string; workers: number }; message?: string };
  devT3Probe?: { key: string; files: string[] };
  devT3?: { previousGreenHead: string | null; previousGreenRun: string | null };
  occasion?: VerifyOccasion; shards?: SuiteJob[]; plannedShards?: number; parentRun?: string; shardName?: string; shardingSkipped?: string; shardingSkipLogged?: boolean; groupMerged?: boolean;
  workers?: number; fallbackWorkers?: number; size?: string;
  executor: ExecutorKind; requestedExecutor?: ExecutorKind; requireRemote?: boolean; fallback?: string; fallbackLogged?: boolean; remoteReclaimPending?: boolean; remoteAcquireAttempted?: boolean; timedOut?: boolean; platform?: Platform; lease?: Lease; remoteLogStart?: number; nextPoll?: number;
  remoteReplacement?: { lease: string; region: string; phase: 'readiness' | 'delivery'; state: 'releasing' | 'acquiring' | 'acquired'; replacement?: string; cause: string; accounting?: { lifetimeMs: number; costUsd: number } };
  machine?: { name?: string; size?: string; region?: string; lifetimeMs: number | null; costUsd: number | null; resources?: number };
  remoteOutputAt?: number;
  remoteOutputOffset?: number;
  submissionKey?: string;
  hostSource?: {head:string;branch:string};
  hostSnapshot?: HostVerifySnapshot;
  id: string; mode: string; cwd: string; topic: string; to: string[]; actor: SuiteActor | null;
  head: string; branch: string; log: string; result: string; gate: string;
  pid: number | null; started: string | null; outcome: { code: number; cause: string; notRun?: 'infrastructure' | 'provider-capacity' } | null;
  reportFailedPermanently?: boolean;
  provenanceFinalized?: boolean;
  finalizedLog?: { run: string; head: string; tree: string | null; path: string; source: string };
  reportFailure?: { error: string; attemptedAt: string; secondary?: string };
  reportAttempts?: number;
  reportRetryAt?: number;
  artifact: string | null; reported: boolean; error: string | null; cleaned?: boolean;
  accountingWaitStarted?: string; accountingPending?: boolean;
  packageClosure?: import('../executor/executor.ts').RunStatus['packageClosure'];
  cancelled?: boolean; interruptedAt?: string; progressReported?: boolean;
  tree?: string | null; finished?: string;
  cached?: { run: string; head: string; tree: string; occasion?: VerifyOccasion | null; executor?: ExecutorKind };
  cacheBypass?: string;
  admittedAt?: string; completedAt?: string; collectedAt?: string; waitMs?: number | null; runMs?: number | null;
  timingEstimated?: boolean;
  tierPlan?: TierPlan; tierReported?: boolean; durationBase?: string; budgetReported?: boolean;
  loadProofs?: string[];
  timingIdentities?: string[];
  batchPassingIdentities?: string[];
  batchBaselineRuns?: Partial<Record<TierPlan[number]['tier'], string | null>>;
  batchBaselineFileRuns?: Record<string, string>;
  batchBaselineSourceRuns?: string[];
  selection?: SuiteSelection;
  integrated?: boolean;
  queued?: string; priority?: number; item?: string | null;
  state?: 'queued' | 'launching' | 'running' | 'finished';
  locks?: string[]; requesterDied?: boolean;
};
/** Facts available without decoding an archived execution plan. */
export type SuiteRunFacts = Pick<SuiteJob, 'id' | 'batch' | 'devT3Probe' | 'reported' | 'outcome' | 'head' | 'tree' | 'runMs'> & { selection?: Pick<SuiteSelection, 'tiers'> };
export type VerifyResult = { webPhase?: WebPhaseUnavailable; executor: ExecutorKind; id: string; state: NonNullable<SuiteJob['state']>; result: 'passed' | 'failed' | 'cancelled' | 'unavailable' | null; head: string; finished: string | null; artifact: string | null; cached?: SuiteJob['cached'] };
export type StagePlatform = 'Linux droplet' | 'macOS';
export type StageCover = { id: string; head: string; tree: string; platform: StagePlatform; files?: string[]; target?: { epic: string; stage: string } };
const verifyResult = (job: SuiteJob): VerifyResult => ({ ...(job.webPhase ? { webPhase: job.webPhase } : {}), executor: job.executor, id: job.id, state: job.state ?? 'running', result: job.state !== 'finished' ? null : job.cancelled || job.requesterDied ? 'cancelled' : job.outcome?.notRun ? 'unavailable' : job.outcome ? job.outcome.code === 0 ? 'passed' : 'failed' : null, head: job.head, finished: job.finished ?? job.completedAt ?? null, artifact: job.artifact, ...(job.cached ? { cached: { ...job.cached } } : {}) });

// A supplied context is a complete snapshot; undefined reads Git, null omits budget reporting.
export type SuiteSchedulerOptions = { flakyOwners?: (identities: string[]) => Record<string, string>; suiteRetentionMinAgeDays?:number; suiteRetentionPassLimit?:number; runReferenced?: (id: string) => boolean; stageJobs?: (jobs: readonly SuiteJob[]) => Iterable<Readonly<SuiteJob>>; onTestSlotAvailable?: (waiter: TestSlotWaiter) => void; taskLanding?: (item: string) => { tip: string; branch: string; base: string } | null; compatibility?: import('../executor/local.ts').LocalCompatibility; durationContext?: DurationBudgetContext | null; candidate?: SuiteCandidate; clock?: Clock; dropletServices?: DropletDependencies; waitClock?: Clock; projectConfig?: () => ProjectConfig; env?: NodeJS.ProcessEnv; executor?: ExecutorKind; localFallback?: boolean; lifetimeMs?: number; runTimeoutMs?: number; runTimeout?: string; onSoakNotice?: (id: string, text: string) => void; onAccountingConfirmed?: (job: Readonly<SuiteJob>) => void | Promise<void>; onFallback?: (job: Readonly<SuiteJob>, cause: string) => void; onRemoteReclaimed?: (job: Readonly<SuiteJob>) => void; budget?: number; remoteBudget?: number; shards?: number; onShardingSkipped?: (job: Readonly<SuiteJob>, cause: string) => void; cacheMaxAgeMs?: number; waitP90TargetMs?: number; locks?: string[]; requesterDead?: (actor: SuiteActor) => boolean; log?: LogFn; onQueue?: (queue: VerificationQueue) => void; onJob?: (job: Readonly<SuiteJob>) => void };
type HumanSlot = Omit<SuiteSlot, 'type'> & { queued: string; admittedAt?: string; left?: boolean };
const HUMAN_GRACE_MS = 10_000;
const ACCOUNTING_WAIT_MS = 120_000;
export function packageClosurePending(job: Pick<SuiteJob, 'packageClosure' | 'executor' | 'lease'>): boolean {
  return !!job.packageClosure && job.executor === 'droplet' && (job.lease as DropletLease | undefined)?.state !== 'released';
}
const KEY = 'suite-jobs';
// Hub-derived: callers cannot accidentally rotate the key when retrying a lost reply.
const suiteOwner = (input: Pick<SuiteJob, 'actor' | 'occasion' | 'devT3Probe'>) => input.devT3Probe?.key ?? input.actor?.sessionId ?? (input.occasion === 'dev-t3' ? 'dev-t3' : input.occasion === 'soak' ? 'nightly-soak' : 'human');
const submissionKey = (input: Pick<SuiteJob, 'actor' | 'cwd' | 'mode' | 'occasion' | 'devT3Probe'> & { stageTargets?: SuiteSelection['stageTargets'] }, head: string): string => createHash('sha256').update(JSON.stringify([suiteOwner(input), input.cwd, head, input.mode, ...(input.stageTargets ? [input.stageTargets] : [])])).digest('hex');
const METRICS_WINDOW = 20;
const runRef = (job: SuiteJob): RunRef => ({ ...(job.tierReceipts ? { tierReceipts: job.tierReceipts } : {}), ...(job.commands ? { commands: job.commands } : {}), ...(job.hostGate ? { hostGate: job.hostGate } : {}), ...(job.limits ? { limits: job.limits } : {}), ...(job.config ? { config: job.config } : {}), id: job.id, cwd: job.cwd, head: job.head, ...(job.integrated ? { integrated: true } : {}), mode: job.mode, log: job.log, result: job.result, gate: job.gate, ...(job.workers !== undefined ? { workers: job.workers } : {}), ...(job.size ? { size: job.size } : {}), ...(job.tree !== undefined ? { tree: job.tree } : {}), ...(job.selection ? { selection: job.selection } : {}), ...(job.queued ? { queued: job.queued } : {}), ...(job.locks ? { locks: job.locks } : {}) });
function elapsed(since: string | undefined | null, now: number): number | null {
  const start = Date.parse(since ?? '');
  return Number.isFinite(start) ? Math.max(0, now - start) : null;
}
function durations(values: Array<number | null | undefined>): DurationStats {
  const sorted = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const n = sorted.length;
  return { count: n, medianMs: n ? n % 2 ? sorted[Math.floor(n / 2)]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : null, p90Ms: n ? sorted[Math.ceil(n * 0.9) - 1]! : null };
}
/** Command output is reduced to one bounded receipt before summary parsing. */
function commandExcerpt(lines: string[]): { summary: string; output?: string[] } | undefined {
  const line = lines.findLast(line => line.startsWith('suite command excerpt '));
  if (line) try {
    const row = JSON.parse(line.slice('suite command excerpt '.length));
    if (row && typeof row.summary === 'string' && (row.output === undefined || Array.isArray(row.output) && row.output.length <= 20 && row.output.every((line: unknown) => typeof line === 'string'))) return row;
  } catch { /* arbitrary stdout is not necessarily a derived command record */ }
  return undefined;
}

export function suiteSummary(log: string, quarantineStatus?: string[], options: { logArtifact?: string; priorityOnly?: boolean } & SuiteInfrastructureSource = {}): string {
  const text = suiteEvidence(log);
  const lines = text.split('\n');
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/^(?:#|ℹ) (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/gm)) counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + Number(match[2]));
  const command = counts.size ? undefined : commandExcerpt(lines);
  const structured = suiteTestFailures(text);
  const admissions = suiteAdmissionTimeouts(text);
  const failures = command?.output ?? (structured === null ? text.split('\n').filter(line => /^(?:\s*not ok \d+|✖ |duration budget: |shard failure )/.test(line))
    : [...structured.map(f => `${f.file}::${f.name}`), ...text.split('\n').filter(line => /^(?:✖ load gate: |duration budget: |shard failure )/.test(line))]).slice(0, 12).map(line => line.slice(0, 200));
  const merged = text.includes('\n--- close shards ---\n');
  const timings = merged
    ? text.split('\n--- close shards ---\n')[1]!.split('\n').filter(line => /^(?:shard (?:duration|collection) shard-\d+ |total cost |occasion |suite duration .*overall wall)/.test(line)).map(line => line.slice(0, 300))
    : text.split('\n').filter(line => /^(?:verification queue wait |shard (?:duration|collection) |suite duration )/.test(line)).slice(-8).map(line => line.slice(0, 300));
  timings.push(...text.split('\n').filter(line => /^duration regression /.test(line)).slice(0, 5));
  timings.push(...text.split('\n').filter(line => /^sharding decision: /.test(line)).slice(-1));
  timings.push(...text.split('\n').filter(line => /^suite budget overhead /.test(line)).slice(-1));
  timings.push(...text.split('\n').filter(line => /^typecheck: /.test(line)));
  timings.push(...text.split('\n').filter(line => /^load gate workers /.test(line)));
  timings.push(...text.split('\n').filter(line => /^load gate: .* skipped, not load-gated;/.test(line)));
  timings.push(...text.split('\n').filter(line => /^load gate admission blocked:/.test(line)));
  timings.push(...text.split('\n').filter(line => /^quarantine load gate: /.test(line)));
  // Keep every failed repetition's full error/stack next to the count summary.
  const loadDiagnostics = text.split('\n').filter(line => line.startsWith('load gate failure '));
  timings.push(...loadDiagnostics);
  timings.push(...text.split('\n').filter(line => line.startsWith('load-gate rerun')));
  const tierLines = text.split('\n').filter(line => /^tier (?:(?:T[0-4]|Web):|share:)/.test(line));
  timings.push(...text.split('\n').filter(line => /^shard-\d+ tier (?:T[1-4]|Web):/.test(line)));
  const lastTiers = new Map<string, string>();
  for (const line of tierLines) lastTiers.set(line.split(':')[0]!, line);
  // Repository-sized lint detail belongs to the artifact. Keep the decision
  // summaries ahead of timings and failure excerpts in the bounded delivery.
  const lintTiers = lines.filter(line => line.startsWith('test lint tier:')).length;
  const lintFindings = lines.filter(line => line.startsWith('test lint finding:')).length;
  const executedTiers = tierLines.filter(line => /^tier (?:T[0-4]|Web): exit /.test(line));
  const webPhase = unavailableWebPhase(text);
  const priority = [
    ...passAccounting(lines, counts.get('pass')),
    ...suiteInfrastructureCauses(options),
    ...(lines.some(line => line.startsWith('suite stall ')) ? [`stall process detail: log${options.logArtifact ? ' ' + options.logArtifact : ''}`] : []),
    ...lines.filter(line => line.startsWith('shard not run ')),
    ...(webPhase ? [webUnavailableLine(webPhase)] : []),
    ...executedTiers,
    ...lines.filter(line => /^(?:duration check:|duration allowance stanza )/.test(line)),
    ...['tier T1', 'tier T2', 'tier T3', 'tier T4', 'tier Web', 'tier share'].flatMap(key => !(key === 'tier Web' && webPhase) && lastTiers.has(key) && !executedTiers.includes(lastTiers.get(key)!) ? [lastTiers.get(key)!] : []),
    ...new Set(lines.filter(line => line.startsWith('test lint (report only):'))),
    ...durationBudgetSummary(lines),
    ...(lintTiers || lintFindings ? [`test lint detail: ${lintTiers} tier lines; ${lintFindings} finding lines; log${options.logArtifact ? ' ' + options.logArtifact : ''}`] : []),
  ];
  const primary = `${counts.size ? [...counts].map(([k, v]) => `${k} ${v}`).join('; ') : command?.summary ?? 'counts unavailable (suite did not finish)'}${priority.length ? `\n${priority.join('\n')}` : ''}`;
  if (options.priorityOnly) return primary;
  const quarantined = quarantineStatus ?? quarantineSummary(quarantineResults(text));
  return `${primary}${admissions.length ? `\nadmission timeouts ${admissions.length}\n${admissions.map(a => `${a.file ? a.file + ': ' : ''}${a.message}`).join('\n')}` : ''}${timings.length ? `\n${timings.join('\n')}` : ''}${failures.length ? `\nFailures:\n${failures.join('\n')}` : ''}${quarantined.length ? `\nQuarantine:\n${quarantined.join('\n')}` : ''}`;
}

export { SuiteAdmissionError } from './suite-candidate.ts';

/** Release evidence is an executed, reported full T3 receipt at this exact tree. */
export function releaseT3Cover(store: Store, tree: string): { run: string; head: string } | null {
  // Consult durable receipts so admission uses only checkpointed evidence.
  const receipts = store.suiteJobSummaries().map(text => JSON.parse(text) as { position: number; job: SuiteJob }).sort((a, b) => a.position - b.position).map(entry => entry.job);
  const job = receipts.findLast(job => job.tree === tree && job.integrated && job.branch === 'dev'
    && ['dev-t3', 'soak', 'stage', 'release'].includes(job.occasion ?? '')
    && job.state === 'finished' && job.reported && job.artifact && store.resolveArtifact(job.artifact) && job.outcome?.code === 0
    && !job.cached && !job.cancelled && !job.requesterDied && !job.batch?.diagnostic
    && wholeSuiteSelection(job.selection)
    && (job.selection.tiers?.includes('T3') ?? job.selection.soak === true));
  return job ? { run: job.id, head: job.head } : null;
}

function resourceAccounting(job: SuiteJob, lease: DropletLease, released: { lifetimeMs: number | null; costUsd: number | null }) {
  const previous = job.remoteReplacement;
  if (!previous?.accounting || previous.lease === lease.lease) return released;
  return { resources: 2, lifetimeMs: released.lifetimeMs === null ? null : released.lifetimeMs + previous.accounting.lifetimeMs,
    costUsd: released.costUsd === null ? null : released.costUsd + previous.accounting.costUsd };
}

export class Suites {
  readonly #candidate: SuiteCandidate;
  readonly #env: NodeJS.ProcessEnv;
  readonly #store: Store;
  readonly #root: string;
  readonly #report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>;
  readonly #jobs: SuiteJob[];
  readonly #stageJobs = new Map<string, SuiteJob>();
  #stageReceipts: StageCover[] | undefined;
  #stageReceiptExpiry = Infinity;
  #stageExpiryJobs = new Map<string, number>();
  #expiredStageJobs = new Set<string>();
  #stagePlatforms = new Map<string, Record<StagePlatform, number>>();
  #stageById = new Map<string, StageCover>();
  readonly #rawCoverage: RawCoverageSweep;
  readonly #retention: SuiteRetention;
  readonly #retentionReferences = new Set<string>();
  readonly #retentionParents = new Map<string, string>();
  #retentionWork: Promise<void> | undefined;
  #retentionAdmitted = false;
  #retentionTimer: ClockTimer | undefined;
  #retentionPasses = 0;
  readonly #waitMetrics: VerificationWait;
  #waitTimer: ClockTimer | null;
  readonly #latestItems = new Map<number, SuiteJob>();
  readonly #latestItemRuns = new Set<string>();
  readonly #latestBranches = new Map<string, SuiteJob>();
  readonly #order = new Map<string, number>();
  readonly #cards = new Map<string, string>();
  readonly #clock: Clock;
  readonly #timer: ClockTimer;
  #checking: Promise<void> | null = null;
  #soaking: Promise<void> | null = null;
  #periodic: Promise<void> | null = null;
  #nextDevT3Check = 0;
  readonly #pendingCollections = new Set<SuiteJob>();
  readonly #inspecting = new Map<string, Promise<void>>();
  readonly #normalizedReports = new Set<string>();
  readonly #isolatedAdmissions = new Map<string, Promise<void>>();
  #landedIdentities: Promise<string[]> | undefined;
  readonly #stageReads = new Map<string, Promise<string[]>>();
  readonly #evidence = new Map<string, string>();
  readonly #evidenceReads = new Map<string, Promise<string>>();
  readonly #starting = new Set<Promise<unknown>>();
  #closed = false;
  readonly #launching = new Set<string>();
  readonly #planning = new Set<string>();
  readonly #budget: number;
  #remoteBudget: number;
  #options: SuiteSchedulerOptions;
  readonly #humans = new Map<object, HumanSlot>();
  readonly #savedJobs = new Map<string, string>();
  readonly #timingRuns = new Map<string, string>();
  readonly #summaries = new Set<string>();
  readonly #batchBaselineWork = new Map<string, Promise<{ selection: NonNullable<SuiteSelection['loadGateBaseline']>; runs: NonNullable<SuiteJob['batchBaselineRuns']>; fileRuns: Record<string, string> }>>();
  readonly #batchBaselineStates = new Map<string, string>();
  #batchBaselineVersion = 0;
  #savedActive = '';
  #lastQueue = '';
  readonly #local: LocalExecutor;
  readonly #droplet: DropletExecutor;
  readonly #hostGates = new Map<string, ChildProcess>();
  readonly #launchWork = new Set<Promise<void>>();
  readonly #reaping: Promise<void>;
  #compatibility: Awaited<ReturnType<LocalExecutor['holder']>> = null;
  #localBlocked: { reason: string } | undefined;
  // Durable leases hold remote slots even while no suite job owns one: a
  // preparation or an unconfirmed cleanup. The published ETA reads this sweep;
  // a scheduler tick refreshes it off the admission path.
  #remoteLeases: DropletLease[] = [];
  #leaseSweep = 0;
  #leaseApplied = 0;
  #leaseRefreshing: Promise<void> | null = null;
  constructor(store: Store, root: string, report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>, options: SuiteSchedulerOptions = {}) {
    this.#options = options;
    this.#retention = new SuiteRetention(root, undefined, {remove:true,passLimit:()=>this.#options.suiteRetentionPassLimit??SUITE_RETENTION_PASS_LIMIT,now:() => this.#clock.now().getTime(),minimumAgeMs:()=> (this.#options.suiteRetentionMinAgeDays??7)*86400000,indexAbsent:id=>!this.#stageJobs.has(id)&&!this.#retentionParents.has(id)&&store.suiteJob(id)===null});
    this.#clock = options.clock ?? realClock;
    this.#env = options.env ?? process.env;
    this.#candidate = options.candidate ?? suiteCandidate(this.#env);
    this.#budget = Math.min(options.budget ?? 1, 1);
    this.#remoteBudget = options.remoteBudget ?? 4;
    if ((options.budget ?? 1) > 1) options.log?.({ event: 'verification-budget-capped', configured: options.budget, effective: this.#budget, reason: 'resource overlap remains disabled after T-215', reservedFor: 'T-218' });
    this.#store = store; this.#root = root; this.#report = report;
    this.#rawCoverage = new RawCoverageSweep(root, [], ids => { for (const id of ids) store.setMeta(`raw-coverage-swept:${id}`, '1'); }, id => store.meta(`raw-coverage-swept:${id}`) === '1');
    const history = store.suiteJobSummaries().map(text => {
      const entry = JSON.parse(text) as { position: number; job: SuiteJob };
      if (!entry.job.reported || !entry.job.cleaned || entry.job.accountingPending) {
        return JSON.parse(store.suiteJob(entry.job.id)!) as { position: number; job: SuiteJob };
      }
      this.#summaries.add(entry.job.id);
      return entry;
    }).sort((a, b) => a.position - b.position);
    const active = JSON.parse(store.meta(KEY) ?? '[]') as SuiteJob[];
    for (const job of active) this.#summaries.delete(job.id);
    this.#jobs = [...history.map(entry => entry.job).filter(job => !active.some(current => current.id === job.id)), ...active];
    this.#savedActive = store.meta(KEY) ?? '';
    const unavailableReports: SuiteJob[] = [];
    if (this.#env.CLAND_TEST_ORPHAN_ROOT === root) {
      this.#jobs = this.#jobs.map(job => {
        if (!outsideSuitePath(root, job, '', this.#env)) return job;
        options.log?.({ event: 'verification-recovery-refused', id: job.id, reason: 'stored suite path outside isolated root' });
        this.#summaries.delete(job.id);
        if (suiteRecoveryState(job) === 'finished' && job.outcome && !job.reported) {
          const report = isolatedUnavailableReport(job, root, this.#clock.now().toISOString());
          unavailableReports.push(report);
          return report;
        }
        const sealed = sealSuiteJob(job, root);
        sealed.error = `isolated verification refused recovery for ${job.id}: stored path outside root`;
        return sealed;
      });
    }

    this.#waitMetrics = new VerificationWait(store, this.#jobs, options.projectConfig?.().verification.waitP90TargetMs ?? options.waitP90TargetMs, options.log, options.waitClock ?? this.#clock);
    this.#local = new LocalExecutor(this.#locks(), (lease, worker) => {
      if (this.#closed) return;
      const job = this.#jobs.find(job => job.id === lease.run);
      if (!job) return;
      job.lease = lease; job.pid = worker.pid; job.started = worker.started;
      job.outcome ??= worker.outcome;
      this.#save(job);
    }, id => { if (this.#jobs.find(job => job.id === id)?.outcome) throw new Error('suite cancelled before worker admission'); }, options.env, options.compatibility, options.log);
    this.#droplet = new DropletExecutor(root, store, options.log, options.env, options.projectConfig, { ...options.dropletServices, clock: this.#clock });
    const isolatedRestores: SuiteJob[] = [];
    for (const [index, job] of this.#jobs.entries()) {
      job.sequence ??= index;
      this.#order.set(job.id, job.sequence);
      if (job.cleaned && job.error?.startsWith('forbidden:')) job.reportFailedPermanently = true;
      job.executor ??= 'local';
      job.state ??= suiteRecoveryState(job);
      const summary = this.#summaries.has(job.id);
      if (!summary && job.state !== 'queued' && !job.config && options.projectConfig) job.config = options.projectConfig();
      if (!summary && job.executor === 'local' && !job.cached && !job.reported && job.state !== 'queued') {
        if (this.#env.CLAND_TEST_ORPHAN_ROOT === root && job.pid) isolatedRestores.push(job);
        else job.lease = this.#local.restore(runRef(job), job, job.lease);
      }
      // T-232 stores the worker's ps start identity and exit receipt. Recover a
      // second-resolution estimate without replacing the identity used for cleanup.
      let timingChanged = false;
      const started = Date.parse(job.started ?? '');
      if (!job.admittedAt && job.pid && Number.isFinite(started)) {
        timingChanged = true;
        job.admittedAt = new Date(Math.max(started, Date.parse(job.queued ?? '') || started)).toISOString();
        job.timingEstimated = true;
      }
      const completion = job.cached ? store.message(`suite:${job.id}`)?.ts : job.finished ?? store.message(`suite:${job.id}`)?.ts;
      if (job.reported && job.outcome && completion && !job.completedAt) {
        job.timingEstimated = true;
        this.#recordTiming(job, completion);
        timingChanged = true;
      }
      if (summary && timingChanged) store.repairSuiteJobTiming(job.id, { admittedAt: job.admittedAt, completedAt: job.completedAt, waitMs: job.waitMs, runMs: job.runMs, timingEstimated: job.timingEstimated });
    }
    this.#jobs.sort((a, b) => a.sequence! - b.sequence!);
    for (const job of this.#jobs) this.#remember(job, false);
    this.#save();
    const local = this.#local, environment = this.#env;
    const admissions = isolatedRestores.map(job => {
      const admission = (async () => {
        const ownership = await isolatedSuiteProcessOwned(root, job, environment);
        if (ownership.owned) {
          job.lease = local.restore(runRef(job), { ...job, ...(ownership.identity ? { identity: ownership.identity } : {}) }, job.lease);
        } else {
          const sealed = sealSuiteJob(job, root);
          sealed.error = `isolated verification refused recovery for ${job.id}: native process ownership outside root or unavailable`;
          options.log?.({ event: 'verification-recovery-refused', id: job.id, reason: 'native process ownership outside root or unavailable' });
          // Keep references captured by an early cancellation fenced too.
          for (const key of Object.keys(job)) Reflect.deleteProperty(job, key);
          Object.assign(job, sealed);
        }
        this.#save(job);
      })();
      this.#isolatedAdmissions.set(job.id, admission);
      return admission;
    });
    for (const job of unavailableReports) {
      const preparation = (async () => {
        isolatedSuiteEvidencePath(root, job.id, job.log, environment);
        isolatedSuiteEvidencePath(root, job.id, job.result, environment);
        await mkdir(dirname(job.log), { recursive: true });
        isolatedSuiteEvidencePath(root, job.id, job.log, environment);
        isolatedSuiteEvidencePath(root, job.id, job.result, environment);
        await writeFile(job.log, 'log unavailable (outside isolated root)\n', { mode: 0o600 });
        await writeFile(job.result, JSON.stringify({ ...terminalDeadlineMetadata(job), ...job.outcome, ...(job.timingReceipts ? { timingReceipts: job.timingReceipts } : {}), ...(job.packageClosure ? { packageClosure: job.packageClosure } : {}), finished: job.finished }), { mode: 0o600 });
      })();
      this.#isolatedAdmissions.set(job.id, preparation);
      admissions.push(preparation);
    }
    this.#reaping = (admissions.length ? Promise.all(admissions).then(() => local.reconcile()) : local.reconcile())
      .catch(error => { this.#options.log?.({ event: 'verification-reap-blocked', error: String(error) }); });
    // Seed durable slots for a queue read that precedes the first tick. This never
    // gates a tick: an extra await here would delay inspection on a fake clock.
    void this.#recoverHostSnapshots().catch(error=>this.#options.log?.({event:'host-verify-sweep-incomplete',error:String(error)}));
    this.#refreshLeases();
    // Scheduling and metrics share hub time; local workers retain OS deadlines.
    this.#waitTimer = (options.waitClock ?? this.#clock).setInterval(() => this.#waitMetrics.record(), 1000);
    this.#waitTimer.unref();
    this.#timer = this.#clock.setInterval(() => { void this.#check(); this.#checkSoak(); this.#checkDevT3(); }, 1000);
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
    if (job.config) {
      normalizeRetainedShardPolicy(job.config);
      if (job.shardWait?.path === 'fallback') this.#applyWholeFallback(job);
      return;
    }
    if (!this.#options.projectConfig) return;
    job.config = structuredClone(this.#options.projectConfig());
    const v = job.config.verification;
    job.workerPolicy = { local: v.workers, droplet: v.droplet.workers ?? v.workers };
    job.workers = job.workersOverride ?? job.workerPolicy[job.executor];
    job.fallbackWorkers = job.workersOverride ?? job.workerPolicy.local;
    job.limits = suiteLimitsFromConfig(job.config, job.executor, job.workers);
    if (job.shardWait?.path === 'fallback') this.#applyWholeFallback(job);
    this.#save(job);
  }
  #save = (job?: SuiteJob, committed?: () => void) => {
    if (job?.shards) job.timingShards = { state: 'sharded', runs: job.shards.map(shard => shard.id) };
    if (job?.timingReceipts) job.timingSummary = job.timingReceipts.map(({ samples, ...owner }) => ({ ...owner, samples: samples.length }));
    this.#stageReceipts = undefined;
    if (job && !job.parentRun && !this.#order.has(job.id)) { job.sequence ??= this.#order.size; this.#order.set(job.id, job.sequence); }
    const parent = job?.parentRun ? this.#jobs.find(parent => parent.id === job.parentRun) : job;
    const changed = parent ? [parent] : this.#jobs.filter(job => !this.#summaries.has(job.id));
    const saved = new Map<string, string>();
    const active = JSON.stringify(this.#jobs.filter(current => current.state !== 'finished'));
    this.#store.transaction(() => {
      for (const current of changed) {
        if (current.shards) current.timingShards = { state: 'sharded', runs: current.shards.map(shard => shard.id) };
        this.#baselineCheckpoint(current);
        if (current.state !== 'finished') continue;
        if (!this.#summaries.has(current.id) && current.shards && current.occasion === 'dev-t3') {
          if (fullPeriodicDevT3Cover(current)) current.periodicT3Proof = { version: 1, run: current.id, head: current.head, tree: current.tree! };
          else delete current.periodicT3Proof;
        }
        // Compute from the already-loaded producer, never by hydrating history.
        if (!this.#summaries.has(current.id) && current.shards && current.occasion === 'batch') {
          if (batchDevT3Cover(current, current.tree ?? '')) current.batchT3Proof = { version: 1, run: current.id, head: current.head, tree: current.tree! };
          else delete current.batchT3Proof;
        }
        const value = JSON.stringify({ position: this.#order.get(current.id), job: current });
        const digest = createHash('sha256').update(value).digest('hex');
        if (this.#savedJobs.get(current.id) === digest) continue;
        this.#store.setMeta(`suite-job:${current.id}`, value);
        saved.set(current.id, digest);
      }
      if (active !== this.#savedActive) this.#store.setMeta(KEY, active);
    });
    // Admission owns its root as soon as the transaction commits, even when a
    // later observer fails. This callback records that exact durable boundary.
    committed?.();
    for (const [id, value] of saved) this.#savedJobs.set(id, value);
    this.#savedActive = active;
    if (job && !job.parentRun) this.#remember(job, true);
    // Include unchanged snapshots: serializing a whole retained history still
    // consumes work even when the checkpoint writes no changed database rows.
    this.#options.log?.({ event: 'verification-checkpoint', jobs: changed.length });
  };
  #remember(job: SuiteJob, announce: boolean): void {
    this.#baselineCheckpoint(job);
    this.#stageJobs.set(job.id, job);
    if (job.timingSummary?.length && job.state === 'finished' && job.reported && job.cleaned && job.outcome?.code === 0 && !job.outcome.notRun && !job.cached && !job.error && !packageClosurePending(job)) {
      this.#timingRuns.set(`${job.head}\0${job.tree}`, job.id);
      for (const row of job.timingSummary) if (row.run === job.id && row.head === job.head && row.tree === job.tree && row.platform === job.platform?.os) this.#timingRuns.set(`${job.head}\0${job.tree}\0${row.platform}`, job.id);
    }
    this.#stageReceipts = undefined;
    this.#rawCoverage.remember(job);
    if (this.#store.meta(`suite-retired:${job.id}`) !== '1') this.#retention.remember(job);
    for (const shard of job.shards ?? []) {
      this.#retentionParents.set(shard.id, job.id);
      if (this.#store.meta(`suite-retired:${shard.id}`) !== '1') this.#retention.remember({ ...shard, sequence: job.sequence ?? 0, occasion: `${job.occasion ?? 'task'}:${shard.shardName ?? 'shard'}` });
    }
    for (const id of [job.cached?.run, job.devT3?.previousGreenRun, ...Object.values(job.batchBaselineRuns ?? {}), ...job.batchBaselineSourceRuns ?? [], ...Object.values(job.batchBaselineFileRuns ?? {})]) if (id) this.#retentionReferences.add(id);
    if (job.cover) this.#retentionReferences.add(job.id);
    for (const id of job.flaky?.runs ?? []) this.#retentionReferences.add(id);
    if (!this.#order.has(job.id)) { job.sequence ??= this.#order.size; this.#order.set(job.id, job.sequence); }
    // A successful report checkpoints the log artifact across async I/O. Publish its
    // terminal card once with that artifact, or once the blocking error is persisted.
    if (packageClosurePending(job) || job.state === 'finished' && !job.reported && !job.error) return;
    const later = (previous: SuiteJob | undefined) => !previous || this.#order.get(job.id)! >= this.#order.get(previous.id)!;
    // Task frames can also be built by unrelated tracker updates. Keep their lookup
    // at the last publishable checkpoint while the live job awaits cleanup/reporting.
    const snapshot = { ...(this.#summaries.has(job.id) ? this.#jobs.find(current => current.id === job.id)! : job) };
    if (job.item && later(this.#latestItems.get(idNumber(job.item)))) {
      const previous = this.#latestItems.get(idNumber(job.item));
      if (previous) this.#latestItemRuns.delete(previous.id);
      this.#latestItems.set(idNumber(job.item), snapshot); this.#latestItemRuns.add(snapshot.id);
    }
    if (job.branch && later(this.#latestBranches.get(job.branch))) this.#latestBranches.set(job.branch, snapshot);
    // Report recovery makes a finished result eligible for stage evidence even
    // when its public result card was already published with a delivery error.
    const card = JSON.stringify([verifyResult(job), job.reported]);
    const moved = this.#cards.get(job.id) !== card;
    this.#cards.set(job.id, card);
    if (announce && moved) this.#options.onJob?.(job);
  }
  #full(job: SuiteJob, includeTimings = true): SuiteJob {
    const full = this.#summaries.has(job.id) ? (JSON.parse((includeTimings ? this.#store.suiteJob(job.id) : this.#store.suiteJobWithoutTimings(job.id))!) as { job: SuiteJob }).job : job;
    return this.#env.CLAND_TEST_ORPHAN_ROOT === this.#root && outsideSuitePath(this.#root, full, '', this.#env) ? sealSuiteJob(full, this.#root) : full;
  }
  /** Latest submission by item or branch, reconstructed once at startup and maintained on saves. */
  latest(item: string, branch: string | null): VerifyResult | null {
    const byItem = this.#latestItems.get(idNumber(item)), byBranch = branch ? this.#latestBranches.get(branch) : undefined;
    const job = !byItem ? byBranch : !byBranch ? byItem : this.#order.get(byItem.id)! > this.#order.get(byBranch.id)! ? byItem : byBranch;
    return job ? verifyResult(job) : null;
  }
  /** One indexed persisted producer; no log reads or history hydration. */
  timingReceiptForRun(run: string): TimingReceipt[] | null {
    const parent = this.#stageJobs.get(this.#retentionParents.get(run) ?? run);
    if (!parent) return null;
    const detail = this.#full(parent);
    const producer = detail.id === run ? detail : detail.shards?.find(shard => shard.id === run);
    return parseTimingReceipts(producer?.timingReceipts) ?? null;
  }
  timingReceiptId(head: string, tree: string, platform: string): string | null {
    return this.#timingRuns.get(`${head}\0${tree}\0${platform}`) ?? null;
  }
  timingReceipt(head: string, tree: string, platform?: string): { id: string; receipts: TimingReceipt[] } | null {
    const id = this.#timingRuns.get(`${head}\0${tree}${platform ? `\0${platform}` : ''}`);
    if (!id) return null;
    const job = this.#stageJobs.get(id);
    if (!job) return null;
    const receipts = parseTimingReceipts(this.#full(job).timingReceipts);
    return receipts ? { id, receipts: receipts.filter(row => row.run === id && row.head === head && row.tree === tree && (!platform || row.platform === platform)) } : null;
  }
  /** Completed integrated full receipts, never a cache label borrowed from another platform. */
  #expireStageEvidence(): void {
    const now = this.#clock.now().getTime();
    if (now < this.#stageReceiptExpiry) return;
    for (const [id, expires] of this.#stageExpiryJobs) if (expires <= now) {
      this.#expiredStageJobs.add(id); this.#stageExpiryJobs.delete(id);
    }
    this.#stageReceipts = undefined;
    this.#stageReceiptExpiry = Infinity;
    for (const expires of this.#stageExpiryJobs.values()) this.#stageReceiptExpiry = Math.min(this.#stageReceiptExpiry, expires);
  }
  stageCovers(include?: Readonly<SuiteJob>): StageCover[] {
    this.#expireStageEvidence();
    if (!this.#stageReceipts) {
      this.#stageReceipts = [];
      this.#stageReceiptExpiry = Infinity;
      this.#stageExpiryJobs.clear();
      this.#stagePlatforms.clear(); this.#stageById.clear();
      for (const job of this.#options.stageJobs?.(this.#jobs) ?? this.#jobs) for (const cover of this.#stageReceipt(job)) {
        this.#stageReceipts.push(cover); this.#stageById.set(cover.id, cover);
        for (const entry of Object.values(job.cover?.receipt?.manifest.tests ?? {})) {
          const expires = Date.parse(entry.expires);
          this.#stageReceiptExpiry = Math.min(this.#stageReceiptExpiry, expires);
          this.#stageExpiryJobs.set(job.id, Math.min(this.#stageExpiryJobs.get(job.id) ?? Infinity, expires));
        }
        const platforms = this.#stagePlatforms.get(cover.tree) ?? { 'Linux droplet': 0, macOS: 0 };
        platforms[cover.platform]++; this.#stagePlatforms.set(cover.tree, platforms);
      }
    }
    return include ? [...this.#stageReceipts.filter(cover => cover.id !== include.id), ...this.#stageReceipt(include, true)] : this.#stageReceipts;
  }
  #stageReceipt(job: Readonly<SuiteJob>, include = false): StageCover[] {
    if (job.selection?.stageTargets && job.integrated && job.branch === 'dev' && job.tree && job.executor === 'local' && job.platform?.os === 'darwin' && job.outcome?.code === 0 && !job.outcome.notRun && !job.webPhase && !job.cancelled && !job.requesterDied && (job.reported || include) && completeTierPlanReason(job) === null) {
      return job.selection.stageTargets.map(({ epic, stage, files }) => ({ id: job.id, head: job.head, tree: job.tree!, platform: 'macOS', files, target: { epic, stage } }));
    }
    if (job.selection?.stageTargets) return [];
    if (!job.integrated || job.branch !== 'dev' || !job.tree || !job.selection?.soak || !wholeSuiteSelection(job.selection) || !greenWithReceipt(job, this.#clock.now().getTime()) || job.cancelled || job.requesterDied || !job.reported && !include) return [];
    const source = job.cached ? this.#stageJobs.get(job.cached.run) : job;
    if (!source || !wholeSuiteSelection(source.selection)) return [];
    if (job.executor === 'local' && job.platform?.os === 'darwin') return [{ id: job.id, head: job.head, tree: job.tree, platform: 'macOS' }];
    if (job.executor === 'droplet' && source?.occasion === 'stage' && job.platform?.os === 'linux'
      && (source.shards ? source.shards.length >= 2 && source.shards.every(shard => (shard.outcome?.code === 0 || job.cover?.receipt && shard.outcome?.code === 1) && shard.platform?.os === 'linux') : !!source.shardingSkipped)) {
      return [{ id: job.id, head: job.head, tree: job.tree, platform: 'Linux droplet' }];
    }
    return [];
  }
  stageMissing(tree: string | null | undefined, include?: Readonly<SuiteJob>): StagePlatform[] {
    this.stageCovers();
    const counts = { ...(tree ? this.#stagePlatforms.get(tree) : undefined) };
    if (include) {
      const previous = this.#stageById.get(include.id);
      if (previous && previous.tree === tree) counts[previous.platform] = (counts[previous.platform] ?? 0) - 1;
      for (const cover of this.#stageReceipt(include, true)) if (cover.tree === tree) counts[cover.platform] = (counts[cover.platform] ?? 0) + 1;
    }
    return (['Linux droplet'] as const).filter(platform => !counts[platform]);
  }
  #active = (job: SuiteJob) => !job.reported && (!job.outcome || (job.outcome.code !== 0 && !job.cleaned));
  // Terminal report recovery without an acquired resource holds no execution
  // slot. Independently persisted leases still reserve their own slots.
  #occupying = (job: SuiteJob) => job.state !== 'queued' && !job.cleaned && !job.reported
    && !(job.executor === 'droplet' && (job.state === 'finished' || job.outcome) && !job.lease && !job.shards);
  #recordTiming(job: SuiteJob, completedAt: string): void {
    if (job.completedAt) return;
    job.completedAt = completedAt;
    const completed = Date.parse(completedAt);
    job.waitMs = job.cached ? 0 : job.pid && !job.admittedAt ? null : elapsed(job.queued, Date.parse(job.admittedAt ?? completedAt));
    job.runMs = job.cached || (!job.admittedAt && !job.pid) ? 0 : elapsed(job.admittedAt, completed);
    this.#options.log?.({ event: 'verification-timing', id: job.id, item: job.item ?? null, session: suiteAuthor(job), branch: job.branch, head: job.head, mode: job.selection?.mode ?? job.mode, executor: job.executor, platform: job.platform ?? null, health: job.health ?? null, shardHealth: job.shardHealth ?? null, cached: Boolean(job.cached), queuedAt: job.queued ?? null, admittedAt: job.admittedAt ?? null, completedAt, waitMs: job.waitMs, runMs: job.runMs, estimated: job.timingEstimated ?? false });
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
      job.cancelled = true; job.interruptedAt ??= this.#clock.now().toISOString(); job.outcome = { code: 143, cause: 'cancelled' }; this.#save(job);
      this.#stopHostGate(job.id);
      for (const shard of job.shards ?? []) { shard.cancelled = true; shard.interruptedAt ??= job.interruptedAt; shard.outcome ??= job.outcome; this.#stopHostGate(shard.id); }
      this.#save(job);
    }
    void this.#inspectJob(job);
    return { id: job.id, topic: job.topic, cancelled: true };
  }
  classify(id: string, cause: string, note: string, by: string, authorize: () => void): { id: string; cover: import('../protocol.ts').CoverRecord } {
    if (this.#closed) throw new Error('hub is closing');
    authorize();
    const summary = this.#jobs.find(job => job.id === id);
    if (!summary) throw new Error(`no suite named ${id}`);
    const job = this.#full(summary);
    job.cover = classifyCover(job, cause, note, by, this.#clock.now().toISOString());
    this.#save(job);
    summary.cover = job.cover;
    this.#options.log?.({ event: 'verification-cover-classified', id, head: job.head, cover: job.cover });
    return { id, cover: job.cover };
  }
  #hostSnapshotSweepComplete=false;
  #hostSnapshotLeftovers=new Map<string,string>();
  hostSnapshotLeftovers(){return this.#hostSnapshotSweepComplete?[...this.#hostSnapshotLeftovers].map(([path,cause])=>({path,cause})):null;}
  #hostSourceTail:Promise<unknown>=Promise.resolve();
  #hostSnapshotRecovery: Promise<void> | undefined;
  #recoverHostSnapshots():Promise<void>{
    if(this.#hostSnapshotRecovery)return this.#hostSnapshotRecovery;
    const work=this.#reaping.then(()=>this.#sweepHostSnapshots());this.#hostSnapshotRecovery=work;
    void work.finally(()=>{if(this.#hostSnapshotRecovery===work)this.#hostSnapshotRecovery=undefined;}).catch(()=>{});
    return work;
  }
  async #sweepHostSnapshots():Promise<void>{
    const base=hostVerifyDirectory(this.#root);
    const names=await readdir(base).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
    for(const name of new Set(names.map(name=>name.replace(/\.json$/,'')))){
      if(!/^[a-f0-9-]{36}$/.test(name))continue;
      const path=join(base,name);
      if(this.#jobs.some(job=>job.cwd===path&&(!job.cleaned||!job.reported||job.state==='queued'||job.state==='running')))continue;
      try{await removeHostVerifyWorktree(this.#root,path,this.#env);this.#hostSnapshotLeftovers.delete(path);}catch(error){this.#hostSnapshotLeftovers.set(path,String(error));this.#options.log?.({event:'host-verify-source-retained',path,error:String(error)});}
    }
    this.#hostSnapshotSweepComplete=true;
  }
  start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { stageTargets?: NonNullable<SuiteSelection['stageTargets']>; hostSnapshot?: HostVerifySnapshot; source?: {head:string;branch:string}; priority?: number; item?: string | null; integrated?: boolean; fresh?: boolean; dryRun?: boolean; diagnostics?: boolean; executor?: ExecutorKind; workers?: number; size?: string; occasion?: VerifyOccasion; batch?: NonNullable<SuiteJob['batch']>; batchPlanFrom?: string; devT3Probe?: NonNullable<SuiteJob['devT3Probe']> }, authorize: () => void, onAdmitted?: (admission: SuiteAdmission) => void): Promise<SuiteAdmission | SuiteDryRun> {
    if (input.batch) input = { ...input, actor: { name: 'hub', sessionId: `merge-batch:${input.batch.id}:${input.batch.diagnostic?.key ?? 'batch'}`, shell: true }, fresh: true };
    if (this.#closed) return Promise.reject(new Error('hub is closing'));
    const prepare = async()=>{
      if(!input.source)return this.#start(input,authorize,onAdmitted);
      await this.#recoverHostSnapshots();
      authorize();
      const prior=this.#jobs.find(job=>job.hostSource&&this.#active(job)&&suiteOwner(job)===suiteOwner(input)&&job.head===input.source!.head&&job.branch===input.source!.branch);
      if(prior){if(!prior.hostSnapshot)throw new Error('host snapshot ownership receipt unavailable');await validateHostVerifyWorktree(this.#root,prior.cwd,prior.hostSnapshot,this.#env);const reused=this.#existingSubmission({...input,cwd:prior.cwd},input.source.head,authorize);if(reused)return reused;}
      const cwd=join(hostVerifyDirectory(this.#root),randomUUID());
      let hostSnapshot:HostVerifySnapshot;
      try{hostSnapshot=await hostVerifyWorktree(this.#root,cwd,input.source.head,this.#env);}
      catch(error){await this.#recoverHostSnapshots();throw error;}
      try{return await this.#start({...input,cwd,hostSnapshot},authorize,onAdmitted);}
      finally{if(!this.#jobs.some(job=>job.cwd===cwd))await removeHostVerifyWorktree(this.#root,cwd,this.#env,hostSnapshot);}
    };
    const work=input.source?this.#hostSourceTail.then(prepare):prepare();
    if(input.source)this.#hostSourceTail=work.catch(()=>{});
    this.#starting.add(work);
    void work.finally(() => this.#starting.delete(work)).catch(() => {});
    return work;
  }
  async #start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { stageTargets?: NonNullable<SuiteSelection['stageTargets']>; hostSnapshot?: HostVerifySnapshot; source?: {head:string;branch:string}; priority?: number; item?: string | null; integrated?: boolean; fresh?: boolean; dryRun?: boolean; diagnostics?: boolean; executor?: ExecutorKind; workers?: number; size?: string; occasion?: VerifyOccasion; batch?: NonNullable<SuiteJob['batch']>; batchPlanFrom?: string; devT3Probe?: NonNullable<SuiteJob['devT3Probe']> }, authorize: () => void, onAdmitted?: (admission: SuiteAdmission) => void, inspect = true, repeatCommands?: import('../verification-commands.ts').VerificationCommands, repeatSoak = false): Promise<SuiteAdmission | SuiteDryRun> {
    if (input.batchPlanFrom && (!input.batch || input.batch.diagnostic || input.occasion !== 'batch')) throw new Error('pinned batch plan requires a full batch confirmation');
    const pinned = input.batchPlanFrom ? (await this.receipt(input.batchPlanFrom)).job : undefined;
    const config = this.#options.projectConfig?.();
    const settings = { ...this.#options };
    const executor = input.executor ?? settings.executor ?? 'local';
    if (executor !== 'local' && executor !== 'droplet') throw new Error('executor must be local or droplet');
    if (input.workers !== undefined && (!Number.isSafeInteger(input.workers) || input.workers < 1)) throw new Error('workers must be a positive integer');
    let capacityRefusal: ProviderCapacityUnavailable | undefined;
    if (input.size !== undefined) {
      if (executor !== 'droplet') throw new Error('size requires the droplet executor');
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(input.size)) throw new Error('size must be a nonempty slug');
      authorize();
      try { await this.#droplet.validateSize(input.size, config); }
      catch (error) {
        if (!(error instanceof ProviderCapacityUnavailable) || input.dryRun) throw error;
        capacityRefusal = error;
      }
    }
    // Validate the candidate as before; only the hub owns execution policy.
    if (input.cwd !== this.#root) await suiteLimits(input.cwd, executor, this.#env);
    const limits = config ? suiteLimitsFromConfig(config, executor) : await suiteLimits(this.#root, executor, this.#env);
    let commands = repeatCommands ? structuredClone(repeatCommands) : pinned ? structuredClone(recordedCommands(pinned)) : await verificationCommands(input.cwd, this.#root, this.#env);
    const runner = await clandRunner(input.cwd);
    if (!runner && (input.mode === 'hub' || input.mode === 'nvim')) throw new Error("hub and nvim are cland's own suite phases; this project's test runs in full: cland verify");
    const workers = input.workers ?? limits.workers;
    if (!input.dryRun && this.#jobs.some(job => this.#active(job) && suiteOwner(job) === suiteOwner(input))) {
      // A retry needs only the current head, not another expensive candidate inspection.
      const existing = this.#existingSubmission(input, await this.#candidate.head(input.cwd), authorize);
      if (existing) return existing;
    }
    const id = input.hostSnapshot?input.hostSnapshot.path.split('/').at(-1)!:randomUUID();
    const dir = join(this.#root, '.cland', 'run', 'suites', id);
    const projectTest: SuiteSelection | undefined = runner ? undefined : { mode: 'full', files: [], reason: 'project test runs in full' };
    const candidate = await this.#candidate.inspect(input.cwd, input.mode as SuiteRequest, workers, projectTest, !runner && Boolean(input.occasion && input.occasion !== 'batch'), Boolean(input.devT3Probe));
    const { head, tree, budgetBase } = candidate;
    const branch=input.source?.branch??candidate.branch;
    if(input.source&&head!==input.source.head)throw new Error(`host-flush-refused: snapshot HEAD ${head}; pinned HEAD ${input.source.head}`);
    let admitted = projectTest ? { ...projectTest, ...(candidate.selection.fetchedDev ? { fetchedDev: candidate.selection.fetchedDev } : {}) } : candidate.selection;
    // The hosting hub owns landing. A candidate-local opt-in cannot promise
    // batch coverage while this hub can still land code directly.
    if ((admitted.durationCheck || admitted.tiers?.join(',') === 'T1,T2') && !config?.merge.queue) {
      const { tiers: _tiers, durationCheck: _durationCheck, ...broad } = admitted;
      admitted = { ...broad, reason: `${broad.reason}; hosting merge queue disabled: retaining process coverage` };
    }
    // Explicit command tiers apply to any stack; cland file planning stays runner-only.
    if (runner && commands.tiers && config?.merge.queue && !admitted.tiers) admitted = taskSuiteSelection(admitted, branch, input.mode as SuiteRequest, true);
    const files = runner ? (input.stageTargets?.flatMap(target => target.files).filter((file, index, files) => files.indexOf(file) === index) ?? input.devT3Probe?.files ?? input.batch?.diagnostic?.files) : undefined;
    if (input.stageTargets && (!runner || executor !== 'local' || input.occasion !== 'stage')) throw new Error('targeted stages require a local cland stage occasion');
    const diagnosticSteps = input.batch?.diagnostic?.steps;
    if (files && (!files.length && !diagnosticSteps?.length || files.some(file => !diagnosticTestFile(file)))) throw new Error('invalid batch diagnostic files');
    const nvimTests = files?.filter(file => file.startsWith('nvim/'));
    const webDiagnostic = Boolean(files?.some(file => file.startsWith('web/')) || diagnosticSteps?.includes('Web'));
    let selection: SuiteSelection = files
      ? { mode: 'full', files, ...(input.stageTargets ? { stageTargets: structuredClone(input.stageTargets), fetchedDev: admitted.fetchedDev } : {}), reason: input.stageTargets ? 'targeted macOS stage paths' : input.devT3Probe ? 'periodic dev T3 failing-file rerun' : 'batch failing-file rerun', loadGate: false, soak: Boolean(input.stageTargets),
        shard: { files: files.filter(file => file.startsWith('hub/')), nvim: Boolean(nvimTests?.length || webDiagnostic) },
        ...(webDiagnostic ? { web: 'all' as const, ...(input.stageTargets ? { batchTests: { Web: files.filter(file => file.startsWith('web/')) } } : {}), ...(files.every(file => file.startsWith('web/')) ? { tiers: [] } : {}) } : {}),
        ...(input.stageTargets || nvimTests?.length ? { nvimTests: nvimTests ?? [] } : {}) }
      : runner ? occasionSelection(admitted, input.occasion, config?.merge.batchTiers) : admitted;
    if (runner && input.batch && !input.batch.diagnostic && !pinned) selection = await batchInteractionSelection(input.cwd, selection, input.batch.members.map(member => member.head), async (...args) => { if (!this.#candidate.git) throw new Error('candidate Git delta boundary unavailable'); return this.#candidate.git(input.cwd, args); }, undefined, config?.merge.batchInteraction ?? 'report');
    if (runner && input.batch && !input.batch.diagnostic && !pinned) selection = await lightBatchSelection(input.cwd, selection, input.batch.waiting ?? input.batch.members.length,
      () => batchMemberPaths(input.batch!.members.map(member => member.head), async (...args) => { if (!this.#candidate.git) throw new Error('candidate Git delta boundary unavailable'); return this.#candidate.git(input.cwd, args); }));
    const commandSelection = runner || !commands.tiers ? selection : occasionSelection(taskSuiteSelection(admitted, branch, input.mode as SuiteRequest, config?.merge.queue ?? false), input.occasion, config?.merge.batchTiers);
    if (!runner && commands.tiers && commandSelection.tiers) selection = { ...selection, tiers: commandSelection.tiers };
    let batchT1 = pinned?.batchT1;
    if (!pinned && input.occasion === 'batch' && input.batch && !input.batch.diagnostic && selection.tiers?.includes('T1')) {
      // Interaction fallback can add T2; it must not relax a sole-T1 configuration.
      batchT1 = (config?.merge.batchTiers ?? ['T1', 'T3']).length === 1 ? { skipped: false, members: [], reason: 'T1 is the sole configured runtime tier' } : await this.#batchT1(input.batch.members);
      selection = { ...selection, tiers: batchT1.skipped ? selection.tiers.filter(tier => tier !== 'T1') : selection.tiers };
    }
    if (repeatCommands) {
      const plan = verificationSteps(repeatCommands);
      selection = { ...selection, soak: repeatSoak || plan.some(step => step.name === 'T4'),
        ...(repeatCommands.tiers ? { tiers: plan.flatMap(step => ['T1', 'T2', 'T3', 'T4'].includes(step.name) ? [step.name as 'T1' | 'T2' | 'T3' | 'T4'] : []) } : {}) };
    }
    else if (pinned) selection = structuredClone(pinned.selection ?? selection);
    else commands = pinVerificationPlan(commands, { branch, mode: input.mode, ...(input.occasion ? { occasion: input.occasion } : {}), selection, queueEnabled: config?.merge.queue ?? false });
    if (diagnosticSteps?.length) {
      const plan = verificationSteps(commands).filter(step => diagnosticSteps.includes(step.name) || Boolean(files?.length));
      if (diagnosticSteps.some(name => !plan.some(step => step.name === name))) throw new Error('batch diagnostic step has no configured command');
      commands = { ...commands, plan };
    }
    if (input.occasion && input.occasion !== 'batch' && (!input.integrated || branch !== 'dev' || !tree || selection.fetchedDev !== head || input.mode !== 'all')) throw new Error('occasion requires an integrated dev full request (verify all) with fresh origin/dev fetch proof at its head');
    if (!pinned && runner && input.occasion && input.occasion !== 'dev-t3' && input.occasion !== 'batch' && !files) selection.loadGateBaseline = await this.#stageIdentities(input.occasion === 'soak' ? 'soak' : 'stage');
    if (runner && !input.occasion && !input.integrated && selection.loadGate) selection.loadGateKnownTests = await this.#landedTaskIdentities();
    if (runner && input.integrated && !input.devT3Probe && !input.batch?.diagnostic && !files) {
      const covers: SuiteJob[] = [];
      const completed = (job: SuiteJob) => Date.parse(job.completedAt ?? job.finished ?? '') || 0;
      for (const prior of this.#jobs) {
        if (!prior.integrated || prior.parentRun || prior.batch?.diagnostic || prior.devT3Probe
          || prior.cached || !prior.reported || !prior.outcome || prior.outcome.notRun || prior.cancelled || prior.requesterDied) continue;
        covers.push(prior);
        covers.sort((a, b) => completed(a) - completed(b));
        if (covers.length > 5) covers.shift();
      }
      selection.loadGateRerun = { head, phases: verificationSteps(commands).map(step => step.name),
        recent: recentCoverGreens(covers.map(prior => ({ completed: completed(prior),
          green: prior.outcome?.code === 0, identities: this.#full(prior).selection?.loadGateRerun?.passed ?? [] })), this.#clock.now().getTime()) };
    } else delete selection.loadGateRerun;
    let tierPlan = !runner || input.devT3Probe ? [] : input.occasion || files || admitted !== candidate.selection ? await planTierReport(input.cwd, selection, workers, undefined, durationHistory(this.#options.durationContext)) : candidate.tierPlan;
    if (input.stageTargets) {
      const planned = new Set(tierPlan.flatMap(row => row.files));
      if (!commands.tiers || !files?.length || planned.size !== files.length || files.some(file => !planned.has(file))) throw new Error('targeted stage paths need an exact executable tier plan');
    }
    selection = skipT4LoadRepetitions(selection, tierPlan);
    const soakCursors: Record<string, number> = JSON.parse(this.#store.meta('soak-cursors') ?? '{}');
    let soakDropped: string[] = [];
    if (runner && input.occasion === 'soak' && (!commands.tiers || tierPlan.length)) {
      const calibration = JSON.parse(this.#store.meta('soak-calibration') ?? 'null');
      selection = soakDeadlinePlan(selection, tierPlan, await readDurationManifest(input.cwd), config?.verification.runTimeoutMs ?? settings.runTimeoutMs ?? 4500000, soakCursors, soakCalibration(calibration));
      selection.reason += `; calibration receipt ${calibration?.run ?? 'A-19799'}`;
      if (selection.shard) {
        const completePlan = tierPlan;
        tierPlan = await planTierReport(input.cwd, selection, workers, undefined, durationHistory(this.#options.durationContext));
        const kept = new Set(tierPlan.flatMap(row => row.files));
        soakDropped = completePlan.flatMap(row => row.files.filter(file => !kept.has(file)).map(file => `unexecuted tier ${row.tier}: ${file}`));
      }
    }
    let batchBaselineRuns = pinned?.batchBaselineRuns;
    let batchBaselineFileRuns = pinned?.batchBaselineFileRuns;
    if (runner && input.occasion === 'batch' && !files) {
      if (!pinned) {
        const baseline = await this.#batchIdentities(tierPlan);
        selection.loadGateBaseline = baseline.selection;
        batchBaselineRuns = baseline.runs;
        batchBaselineFileRuns = baseline.fileRuns;
      }
      selection.loadGateFiles = tierPlan.filter(row => row.tier === 'T3').flatMap(row => row.files);
      const missing = tierPlan.filter(row => !batchBaselineRuns?.[row.tier]);
      if (!pinned && missing.length) {
        const context = this.#options.durationContext !== undefined ? this.#options.durationContext : await durationBudgetContext(input.cwd, { env: this.#env });
        const known = new Set(selection.loadGateBaseline?.tests);
        for (const row of missing) {
          const files = new Set(row.files.filter(file => context?.tiers[file] === row.tier));
          for (const identity of Object.keys(context?.manifest.tests ?? {})) if (files.has(identity.split('::')[0]!)) known.add(identity);
          selection.reason += `; baseline missing for ${row.tier}; known identities from manifest`;
        }
        selection.loadGateBaseline = { run: null, tests: [...known].sort() };
      }
    }

    if (input.dryRun) {
      const context = !runner ? null : this.#options.durationContext !== undefined ? this.#options.durationContext : await durationBudgetContext(input.cwd, { ...(budgetBase ? { base: budgetBase } : {}), env: this.#env });
      const budgetLines = context ? durationBudgetSummary(durationBudgetReport(context.manifest, context.tiers, baselineTimings(context, tierPlan.flatMap(row => row.files)), context.base)) : [];
      const lintLines = runner ? testLintReport(await lintTests(input.cwd, { reachable: input.diagnostics ?? false })) : [];
      if (executor === 'droplet' && input.executor === 'droplet') {
        if (!tree) throw new Error('dirty worktree cannot be bundled for droplet');
        await this.#droplet.checkSpend(input.size, config);
      }
      if (head !== 'unknown' && await this.#candidate.head(input.cwd) !== head) throw new Error('head changed during admission; try dry-run again');
      authorize();
      return { dryRun: true, head, executor, workers, selection, tiers: tierPlan,
        lines: [describeSelection(selection), ...(commands.plan ? [`command plan: ${commands.plan.map(step => `${step.name}: ${step.command}`).join(' · ')}`] : []), `planned tiers: ${tierPlan.map(row => row.tier).join(', ') || 'unavailable (no tier manifest)'}`, ...tierReport(tierPlan), ...lintLines.slice(0, 1), ...budgetLines, ...lintLines.slice(1), ...(runner && !input.diagnostics ? ['reachability diagnostics: `cland verify --dry-run --diagnostics`'] : [])] };
    }
    const existing = this.#existingSubmission(input, head, authorize);
    if (existing) return existing;
    let admissionCommitted = false;
    try {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const cacheExecutor = input.occasion === 'stage' || input.occasion === VERIFY_OCCASIONS.epic || input.occasion === 'release' ? executor : input.executor;
      const cached = !input.fresh && tree && !(input.occasion === 'soak' && selection.shard) ? this.#cached(tree, selection, workers, commands, input.size, cacheExecutor, input.occasion) : undefined;
      const incompatible = !input.fresh && tree && cacheExecutor && !cached ? this.#cached(tree, selection, workers, commands, input.size) : undefined;
      const cacheBypass = incompatible && !receiptExecutionMatches(incompatible, { executor: cacheExecutor })
        ? `requested executor ${cacheExecutor} · platform ${cacheExecutor === 'droplet' ? 'linux' : process.platform}; cached green executor ${incompatible.executor} · platform ${incompatible.platform?.os ?? 'unknown'}` : undefined;

      // Older candidate runners and fixture packages remain usable. Coverage is
      // recorded only by a capable runner on a clean integrated full dev run.
      if (input.integrated && branch === 'dev' && tree && wholeSuiteSelection(selection) && !cached && runner?.reduceCoverage) selection.recordCoverage = { head, tree, run: id };
      authorize();
      const workerPolicy = config ? { local: config.verification.workers, droplet: config.verification.droplet.workers ?? config.verification.workers } : { local: (await suiteLimits(this.#root, 'local', this.#env)).workers, droplet: (await suiteLimits(this.#root, 'droplet', this.#env)).workers };
      const fallbackWorkers = input.workers ?? workerPolicy.local;
      const previousGreen = input.occasion === 'dev-t3' ? this.#jobs.findLast(job => job.occasion === 'dev-t3' && job.reported && job.outcome?.code === 0 && !job.cached && !job.cancelled && !job.requesterDied) : undefined;
      const {source: hostSource, ...jobInput}=input;
      const job: SuiteJob = { ...(hostSource?{hostSource}:{}), ...jobInput, ...(input.occasion === 'dev-t3' ? { devT3: { previousGreenHead: previousGreen?.head ?? null, previousGreenRun: previousGreen?.id ?? null } } : {}), commands, ...((input.occasion === 'soak' || input.occasion === 'dev-t3') && config ? { config: structuredClone(config) } : {}), submissionKey: submissionKey(input, head), tierPlan, ...(budgetBase ? { durationBase: budgetBase } : {}), limits, workerPolicy, ...(input.workers !== undefined ? { workersOverride: input.workers } : {}), followsConfig: input.executor === undefined, workers, fallbackWorkers, executor, requestedExecutor: executor, requireRemote: executor === 'droplet' && (input.executor === 'droplet' || !(config?.verification.localFallback ?? settings.localFallback ?? true)), integrated: input.integrated === true && branch === 'dev', queued: this.#clock.now().toISOString(), priority: input.priority ?? Number.MAX_SAFE_INTEGER, state: 'queued', locks: settings.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock'], selection, tree, id, head, branch, log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready'), pid: null, started: null, outcome: null, artifact: null, reported: false, error: null };
      if (batchBaselineRuns) job.batchBaselineRuns = batchBaselineRuns;
      if (batchBaselineFileRuns) {
        job.batchBaselineFileRuns = batchBaselineFileRuns;
        job.batchBaselineSourceRuns = [...new Set(Object.values(batchBaselineFileRuns))];
      }
      if (batchT1) job.batchT1 = batchT1;
      if (cacheBypass) job.cacheBypass = cacheBypass;
      // Persist the complete request before acknowledging it. No waiting worker exists.
      await writeFile(job.log, `Suite ${id} · ${input.mode}\n${describeSelection(selection)}\nCommands: check ${commands.check || 'not set'} · test ${commands.test}\n${commands.plan ? 'Tier commands: ' + commands.plan.map(step => `${step.name} ${step.command}`).join(' · ') + '\n' : ''}Prepare: ${commands.prepare || 'not set'}\nWorktree ${input.cwd}\nBranch ${branch}\nHead ${head}\nWorkers ${workers} · source ${input.workers !== undefined ? 'explicit --workers' : 'hub config'}${input.size ? ` · size ${input.size}` : ''}\nQueued ${job.queued}\n`, { mode: 0o600 });
      if (batchT1) await appendFile(job.log, batchT1Summary(batchT1) + '\n');
      if (input.devT3Probe) await appendFile(job.log, 'Historical probe: hosting hub manifest and test lint skipped; candidate commands retained; tier projections unavailable\n');
      if (soakDropped.length) await appendFile(job.log, soakDropped.join('\n') + '\n');
      if (cacheBypass) await appendFile(job.log, `Cache bypassed: ${cacheBypass}\n`);
      if (cached) {
        const artifact = this.#store.resolveArtifact(cached.artifact!)!;
        const copied = await copyFile(artifact.path, job.log + '.cache.tmp').then(() => true, () => false);
        if (copied && await this.#candidate.tree(input.cwd, head) === tree) {
          job.executor = cached.executor;
          if (cached.platform) job.platform = { ...cached.platform };
          if (cached.machine) job.machine = { ...cached.machine };
          if (cached.health) job.health = structuredClone(cached.health);
          if (cached.shardHealth) job.shardHealth = structuredClone(cached.shardHealth);
          job.cached = { run: cached.id, head: cached.head, tree: tree!, occasion: cached.occasion ?? null, executor: cached.executor };
          job.finished = cached.finished!;
          job.outcome = { code: 0, cause: 'cached' }; job.state = 'finished';
          await appendFile(job.log + '.cache.tmp', `\nCached candidate ${tree}\nOriginal run ${cached.id} · head ${cached.head}\nOriginal occasion ${cached.occasion ?? 'none'} · executor ${cached.executor} · platform ${cached.platform?.os ?? 'unknown'}\nRequested head ${head}\n`);
          await rename(job.log + '.cache.tmp', job.log);
        } else await rm(job.log + '.cache.tmp', { force: true });
      }
      if (!job.cached && capacityRefusal) job.outcome = { code: 1, cause: capacityRefusal.message, notRun: 'provider-capacity' };
      if (!job.cached && !job.outcome && executor === 'droplet') {
        if (job.requireRemote && !tree) throw new Error('dirty worktree cannot be bundled for droplet');
        try {
          if (job.requireRemote) await this.#droplet.checkSpend(input.size, config);
          else await this.#droplet.checkReachability(input.size, config);
        }
        catch (error) {
          if (!(error instanceof ProviderCapacityUnavailable)) throw error;
          job.outcome = { code: 1, cause: error.message, notRun: 'provider-capacity' };
        }
      }
      if (head !== 'unknown' && await this.#candidate.head(input.cwd) !== head) throw new Error('head changed during submission; submit verification again');
      authorize();
      if (this.#closed) throw new Error('hub is closing');
      // No await between the last identity fence and persistence: overlapping retries join one run.
      const concurrent = this.#existingSubmission(input, head, authorize);
      if (concurrent) return concurrent;
      this.#jobs.push(job); this.#save(job, () => { admissionCommitted = true; });
      if (input.occasion === 'soak') {
        if (selection.shard) {
          for (const row of tierPlan) soakCursors[row.tier] = (soakCursors[row.tier] ?? 0) + row.files.length;
          this.#store.setMeta('soak-cursors', JSON.stringify(soakCursors));
        }
        const text = `nightly soak ${job.id}: ${selection.reason}`;
        this.#store.setMeta('soak-coverage', text);
        if (selection.shard) this.#options.onSoakNotice?.(`soak-trim:${job.id}`, text);
      }
      if (!job.cached && executor === 'droplet' && (!this.#env.DIGITALOCEAN_TOKEN || !tree)) this.#fallback(job, !this.#env.DIGITALOCEAN_TOKEN ? 'DIGITALOCEAN_TOKEN is required' : 'dirty worktree cannot be bundled for droplet');
      // Socket/RPC callers can acknowledge the durable checkpoint without changing
      // start()'s scheduler-completion contract for in-process callers.
      onAdmitted?.({ id, pid: job.pid, topic: job.topic, position: job.state === 'queued' ? this.#ordered().findIndex(j => j.id === id) + 1 : 1, ...(job.cached ? { cached: job.cached } : {}) });
      if (inspect) await this.#check();
      return { id, pid: job.pid, topic: job.topic, position: job.state === 'queued' ? this.#ordered().findIndex(j => j.id === id) + 1 : 1, ...(job.cached ? { cached: job.cached } : {}) };
    } finally {
      // All preparation writes have settled. Admission transfers ownership to
      // the indexed job; refusals and overlapping submissions own no worker.
      if (!admissionCommitted) {
        const uncommitted = this.#jobs.findIndex(job => job.id === id);
        if (uncommitted >= 0) this.#jobs.splice(uncommitted, 1);
        this.#order.delete(id);
        if (this.#batchBaselineStates.delete(id)) this.#batchBaselineVersion++;
        try { await rm(dir, { recursive: true, force: true }); }
        catch (error) {
          try { this.#options.log?.({ event: 'suite-unadmitted-directory-retained', id, path: dir, error: String(error) }); }
          catch { /* an ancillary observer must not replace the refusal */ }
        }
      }
    }
  }
  #existingSubmission(input: Pick<SuiteJob, 'actor' | 'cwd' | 'mode' | 'occasion' | 'devT3Probe'> & { executor?: ExecutorKind; size?: string; workers?: number }, head: string, authorize: () => void): { id: string; pid: number | null; topic: string; position: number; reused?: true; cached?: SuiteJob['cached'] } | null {
    authorize();
    const owned = this.#jobs.filter(job => this.#active(job) && suiteOwner(job) === suiteOwner(input));
    const key = submissionKey(input, head);
    const matching = owned.filter(job => (job.submissionKey ?? submissionKey(job, job.head)) === key);
    // Compare requested overrides, not resolved policy or a fallback executor.
    const active = matching.find(job => (job.followsConfig ? undefined : job.requestedExecutor ?? job.executor) === input.executor && job.size === input.size && job.workersOverride === input.workers);
    if (!active) {
      const config = this.#options.projectConfig?.();
      const executor = input.executor ?? config?.verification.executor ?? this.#options.executor ?? 'local';
      const name = input.actor && this.#store.nameOfSession(input.actor.sessionId);
      const coordinator = name && this.#store.roleOf(name) === 'coordinator';
      const refusal = 'this session already has a suite queued or running';
      // Local execution always retains the machine's single-run boundary.
      if (coordinator && executor === 'local' && owned.some(job => job.executor === 'local' || job.requestedExecutor === 'local')) throw new Error(refusal);
      if (owned.length && !matching.length && (!coordinator || executor !== 'droplet')) throw new Error(refusal);
      if (coordinator && executor === 'droplet') {
        const cap = config?.verification.coordinatorSuites ?? 1;
        const remoteKeys = new Set(owned.filter(job => (job.requestedExecutor ?? job.executor) === 'droplet').map(job => job.submissionKey ?? submissionKey(job, job.head)));
        if (!remoteKeys.has(key) && remoteKeys.size >= cap) throw new Error(cap === 1 ? refusal : `${refusal} (coordinator_suites cap ${cap})`);
      }
      return null;
    }
    if (active.occasion !== input.occasion || (active.submissionKey ?? submissionKey(active, active.head)) !== submissionKey(input, head)) throw new Error('this session already has a suite queued or running');
    return { reused: true, id: active.id, pid: active.pid, topic: active.topic, position: active.state === 'queued' ? this.#ordered().findIndex(job => job.id === active.id) + 1 : 1, ...(active.cached ? { cached: active.cached } : {}) };
  }
  /** Targeted tests never reserve capacity; authenticated refusals arm one wake-up. */
  async checkSlot(lease?: { pid: number; started: string; token: string }, sessionId?: string): Promise<{ admitted: true }> {
    const owner = (await this.#local.holder())?.holder;
    const job = owner && this.#jobs.find(j => j.executor === 'local' && j.integrated && j.pid === owner.pid && j.started === owner.started && !j.cleaned && !j.reported);
    const cover = owner?.integrated ?? job?.id;
    if (cover && owner && !(lease && lease.pid === owner.pid && lease.started === owner.started && lease.token === owner.token)) {
      const waiters = this.#testSlotWaiters();
      if (sessionId && !waiters.some(waiter => waiter.sessionId === sessionId)) {
        waiters.push({ id: `test-slot:${randomUUID()}`, sessionId, cover });
        this.#store.setMeta('test-slot-waiters', JSON.stringify(waiters));
      }
      const next = sessionId
        ? 'test-slot-available wake-up registered; do other work or end the turn until it arrives; no polling'
        : 'no session identity for a test-slot-available wake-up; ask the Coordinator for a release notice; no polling';
      throw new Error(`cover-quiet: integrated run ${cover} holds the local test slot; ${next} (only the human may set CLAND_TEST_IGNORE_COVER=1)`);
    }
    return { admitted: true };
  }
  #testSlotWaiters(): TestSlotWaiter[] { return JSON.parse(this.#store.meta('test-slot-waiters') ?? '[]') as TestSlotWaiter[]; }
  async #notifyTestSlot(): Promise<void> {
    if (this.#closed || !this.#options.onTestSlotAvailable || !this.#testSlotWaiters().length) return;
    if (this.#jobs.some(job => job.executor === 'local' && job.state !== 'queued' && !job.cleaned && !job.reported)
      || [...this.#humans.values()].some(slot => !slot.left && slot.admittedAt)
      || await this.#local.occupied()) return;
    if (this.#closed) return;
    // Re-read after the asynchronous observation: a concurrent refusal must not
    // be overwritten. The idempotent notice and removal commit together.
    this.#store.transaction(() => {
      for (const waiter of this.#testSlotWaiters()) this.#options.onTestSlotAvailable!(waiter);
      this.#store.setMeta('test-slot-waiters', '[]');
    });
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
  /** Every durable lease that still holds a remote slot, whether or not a job owns it. */
  async #liveLeases(): Promise<DropletLease[]> {
    const sweep = ++this.#leaseSweep;
    const leases = (await readLeases(this.#root)).filter(lease => lease.state !== 'released');
    // A later explicit sweep owns the published snapshot even when an earlier
    // tick sweep resolves after it.
    if (sweep > this.#leaseApplied) { this.#leaseApplied = sweep; this.#remoteLeases = leases; }
    return leases;
  }
  /** Refresh durable slots for the next snapshot without delaying a tick or a publish. */
  #refreshLeases(): void {
    this.#leaseRefreshing ??= this.#liveLeases().then(() => {}, error => {
      this.#options.log?.({ event: 'verification-lease-read-failed', error: String(error) });
    }).finally(() => { this.#leaseRefreshing = null; });
  }
  // Integrated dev precedes human waiters, then item rank; each group retains enqueue order.
  #ordered(): Array<SuiteJob | HumanSlot> {
    return [...this.#queue(), ...[...this.#humans.values()].filter(s => !s.left && !s.admittedAt)].sort((a, b) => {
      const integrated = (s: SuiteJob | HumanSlot) => 'actor' in s && (s.integrated === true || !!s.batch);
      const rank = (s: SuiteJob | HumanSlot) => 'actor' in s ? s.priority ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      return Number(integrated(b)) - Number(integrated(a)) || Number('actor' in a) - Number('actor' in b) || rank(a) - rank(b) || a.queued!.localeCompare(b.queued!);
    });
  }
  #landedTaskIdentities(): Promise<string[]> {
    // Admissions can overlap while a legacy log is being read. Share the entire
    // sequential backfill, then let later admissions recheck current landings.
    return this.#landedIdentities ??= this.#readLandedTaskIdentities().finally(() => { this.#landedIdentities = undefined; });
  }
  async #readLandedTaskIdentities(): Promise<string[]> {
    const known = new Set<string>();
    for (const job of this.#jobs) {
      if (!job.item || job.integrated || job.occasion || job.cached || job.cancelled || job.requesterDied
        || !job.selection?.loadGate || !job.reported || job.outcome?.code !== 0) continue;
      const landing = this.#options.taskLanding?.(job.item);
      if (!landing || landing.base !== 'dev' || landing.tip !== job.head || landing.branch !== job.branch) continue;
      // Backfill retained pre-upgrade receipts once; future runs store proof at reporting.
      const full = this.#full(job);
      if (!full.loadProofs) {
        full.loadProofs = await retainedLoadProofs(this.#evidencePath(job)).catch(() => []);
        this.#save(full);
      }
      for (const identity of full.loadProofs) known.add(identity);
    }
    return [...known].sort();
  }
  #baselineCheckpoint(job: SuiteJob): void {
    const state = JSON.stringify([job.reported, job.outcome?.code, job.outcome?.notRun, job.cancelled, job.requesterDied, job.timedOut,
      job.occasion, job.integrated, job.branch, job.selection?.mode, job.selection?.tiers, Boolean(job.batch?.diagnostic), Object.keys(job.selection?.batchTests ?? {}).sort()]);
    if (this.#batchBaselineStates.get(job.id) === state) return;
    this.#batchBaselineStates.set(job.id, state);
    this.#batchBaselineVersion++;
  }
  async #batchIdentities(plan: TierPlan): Promise<{ selection: NonNullable<SuiteSelection['loadGateBaseline']>; runs: NonNullable<SuiteJob['batchBaselineRuns']>; fileRuns: Record<string, string> }> {
    const key = JSON.stringify([this.#batchBaselineVersion, plan.map(row => [row.tier, row.files])]);
    let pending = this.#batchBaselineWork.get(key);
    if (!pending) {
      pending = this.#readBatchIdentities(plan);
      this.#batchBaselineWork.set(key, pending);
      const admitted = pending;
      void pending.finally(() => { if (this.#batchBaselineWork.get(key) === admitted) this.#batchBaselineWork.delete(key); }).catch(() => {});
    }
    return pending;
  }
  async #readBatchIdentities(plan: TierPlan): Promise<{ selection: NonNullable<SuiteSelection['loadGateBaseline']>; runs: NonNullable<SuiteJob['batchBaselineRuns']>; fileRuns: Record<string, string> }> {
    const runs: Partial<Record<TierPlan[number]['tier'], string | null>> = {};
    const fileRuns: Record<string, string> = {};
    const tests = new Set<string>();
    for (const row of plan) {
      runs[row.tier] = null;
      const remaining = new Set(row.files);
      let receipts = 0, summaries = 0;
      for (let index = this.#jobs.length - 1; index >= 0 && remaining.size; index--) {
        if (summaries >= LIGHT_BATCH_POLICY.baselineSummaryLimit || receipts >= LIGHT_BATCH_POLICY.baselineReceiptLimit) break;
        summaries++;
        const summary = this.#jobs[index]!;
        if (!(summary.occasion === 'stage' && summary.integrated && summary.branch === 'dev' || summary.occasion === 'batch' && summary.batch && !summary.batch.diagnostic)
          || summary.selection?.mode !== 'full' || summary.cached || summary.cancelled || summary.requesterDied
          || !summary.reported || !summary.outcome || summary.outcome.notRun) continue;
        if (row.tier !== 'Web' && summary.selection.tiers && !summary.selection.tiers.includes(row.tier)) continue;
        const full = this.#full(summary);
        const priorFiles = (full.tierPlan ?? []).filter(prior => prior.tier === row.tier).flatMap(prior => prior.files);
        if (!priorFiles.length) continue;
        receipts++;
        if (full.timedOut || verificationInterrupted(summary.outcome.code)) continue;
        if (full.tierReceipts && terminalTierPlanReason(full) !== null) continue;
        const observed = await this.#receiptIdentities(summary);
        const prior = new Set(priorFiles);
        if (!observed.tests.some(identity => prior.has(identity.split('::')[0]!))) continue;
        const mask = tierTestMask(full.selection, row.tier);
        const files = new Set(priorFiles.filter(file => remaining.has(file) && (!mask || mask.includes(file))));
        if (!files.size) continue;
        runs[row.tier] ??= summary.id;
        // Resolve every selected file here, including failed/incomplete files:
        // their older green proof must never be resurrected.
        for (const file of files) { remaining.delete(file); fileRuns[file] = summary.id; }
        const receipt = summary.outcome!.code === 0 ? await this.#receiptIdentities(summary) : await this.#redBatchIdentities(summary);
        for (const identity of receipt.tests) if (files.has(identity.split('::')[0]!)) tests.add(identity);
        if (!remaining.size) break;
      }
      this.#options.log?.({ event: 'batch-baseline-scan', tier: row.tier, summaries, receipts, unresolvedFiles: remaining.size });
    }
    return { selection: { run: null, tests: [...tests].sort() }, runs, fileRuns };
  }
  async #redBatchIdentities(summary: SuiteJob): Promise<NonNullable<SuiteSelection['loadGateBaseline']>> {
    const job = this.#full(summary);
    if (job.batchPassingIdentities) return { run: job.id, tests: job.batchPassingIdentities };
    let pending = this.#stageReads.get(job.id);
    if (!pending) {
      pending = (async () => {
        const finished = new Set<string>(), blocked = new Set<string>(), identities = new Set<string>();
        const started = new Map<string, string>();
        for await (const line of suiteLogLines(this.#evidencePath(job))) {
          if (line.startsWith('suite timing ')) for (const test of timingReceipts(line)) {
            if (test.outcome === 'pass') identities.add(`${test.file}::${test.name}`);
            else blocked.add(test.file);
          }
          if (!line.startsWith('suite progress ')) continue;
          const progress = suiteProgress(line, 0, { fileEnvelopes: true });
          for (const test of progress?.unfinished ?? []) started.set(`${test.file}::${test.id}`, test.file);
          for (const test of progress?.completed ?? []) {
            started.delete(`${test.file}::${test.id}`);
            if (test.outcome !== 'pass') blocked.add(test.file);
            else if (test.type === 'file') finished.add(test.file);
          }
        }
        for (const file of started.values()) blocked.add(file);
        job.batchPassingIdentities = [...identities].filter(identity => {
          const file = identity.split('::')[0]!;
          return finished.has(file) && !blocked.has(file);
        }).sort();
        this.#save(job);
        return job.batchPassingIdentities;
      })().finally(() => { this.#stageReads.delete(job.id); });
      this.#stageReads.set(job.id, pending);
    }
    return { run: job.id, tests: await pending.catch(() => []) };
  }
  async #stageIdentities(occasion: VerifyOccasion = 'stage'): Promise<NonNullable<SuiteSelection['loadGateBaseline']>> {
    const summary = this.#jobs.findLast(job => job.occasion === occasion && job.integrated && job.branch === 'dev'
      && wholeSuiteSelection(job.selection) && !job.cached && !job.cancelled && !job.requesterDied
      && job.reported && job.outcome?.code === 0);
    if (!summary) return { run: null, tests: [] };
    return this.#receiptIdentities(summary);
  }
  async #receiptIdentities(summary: SuiteJob): Promise<NonNullable<SuiteSelection['loadGateBaseline']>> {
    const stage = this.#full(summary);
    if (!stage.timingIdentities) {
      let pending = this.#stageReads.get(stage.id);
      if (!pending) {
        pending = (async () => {
          const known = new Set<string>();
          for await (const line of suiteLogLines(this.#evidencePath(stage))) {
            if (line.startsWith('suite timing ')) for (const test of timingReceipts(line)) known.add(`${test.file}::${test.name}`);
          }
          stage.timingIdentities = [...known].sort();
          this.#save(stage);
          return stage.timingIdentities;
        })().finally(() => { this.#stageReads.delete(stage.id); });
        this.#stageReads.set(stage.id, pending);
      }
      return { run: stage.id, tests: await pending.catch(() => []) };
    }
    return { run: stage.id, tests: stage.timingIdentities };
  }
  #cached(tree: string, selection: SuiteSelection, workers: number, commands: import('../verification-commands.ts').VerificationCommands, size?: string, requiredExecutor?: ExecutorKind, occasion?: VerifyOccasion): SuiteJob | undefined {
    // Cancellations say nothing about the tree; failed or pending attempts still supersede green evidence.
    // Pre-admission head changes carry their cancellation in the outcome rather than a flag.
    const job = this.#jobs.findLast(j => this.#cacheInputsMatch(j, tree, selection, workers, commands, size, requiredExecutor, occasion));
    return job && this.#cacheReceiptAvailable(job, requiredExecutor, occasion) ? job : undefined;
  }
  #cacheInputsMatch(j: SuiteJob, tree: string, selection: SuiteSelection, workers: number, commands: import('../verification-commands.ts').VerificationCommands, size?: string, requiredExecutor?: ExecutorKind, occasion?: VerifyOccasion): boolean {
    return j.tree === tree && JSON.stringify(j.commands) === JSON.stringify(commands) && !j.batch?.diagnostic && !j.devT3Probe && (!requiredExecutor || j.executor === requiredExecutor) && !j.cached && !j.cancelled && !j.requesterDied && !j.outcome?.cause.startsWith('cancelled: queued head changed') && sameSuiteSelection(this.#full(j).selection, selection) && (j.workers ?? 4) === workers && j.size === size
      && (occasion !== 'stage' || requiredExecutor === 'local' || j.occasion === 'stage');
  }
  #cacheReceiptAvailable(job: SuiteJob, requiredExecutor?: ExecutorKind, occasion?: VerifyOccasion): boolean {
    if (job.webPhase?.status === 'not-run' || job.outcome?.code !== 0 || !job.reported || !job.finished || !job.artifact) return false;
    if (!receiptExecutionMatches(job, { occasion, executor: requiredExecutor })) return false;
    // Choose the newest compatible attempt before checking platform/success;
    // otherwise a failed or unreported fresh stage run resurrects an older green.
    if (occasion === 'stage' && !this.stageCovers().some(cover => cover.id === job.id && cover.platform === (requiredExecutor === 'local' ? 'macOS' : 'Linux droplet'))) return false;
    const age = this.#clock.now().getTime() - Date.parse(job.finished);
    const artifact = this.#store.resolveArtifact(job.artifact);
    return Boolean(age >= 0 && age < (this.#options.cacheMaxAgeMs ?? 86400000) && artifact && artifact.status !== 'archived' && !artifact.fileDeleted);
  }
  #queue(): SuiteJob[] {
    return this.#jobs.filter(j => j.state === 'queued' && !j.outcome).sort((a, b) => Number(b.integrated === true) - Number(a.integrated === true) || (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || (a.queued ?? '').localeCompare(b.queued ?? ''));
  }
  /** Called by the serving owner, never during startup recovery. */
  startRetention(): void {
    this.#retentionAdmitted = true;
    if (this.#closed || this.#retentionWork) return;
    this.#clock.clearTimeout(this.#retentionTimer);
    this.#retentionTimer = undefined;
    const started=performance.now();
    let removedCount=0, errorCount=0;
    let firstError: string | undefined;
    this.#options.log?.({event:'suite-retention-start'});
    this.#retentionWork = this.#retention.drain(id => {
      const parent = this.#retentionParents.get(id) ?? id;
      const run = this.#stageJobs.get(parent);
      return this.#closed || !!(run?.cover || run?.integrated || run?.batch || run?.devT3Probe) || this.#retentionReferences.has(parent)
        || this.#options.runReferenced?.(parent) === true || this.#options.runReferenced?.(id) === true
        || this.#latestItemRuns.has(parent);
    },
    id => {
      const parent = this.#stageJobs.get(this.#retentionParents.get(id) ?? id);
      const run = parent?.id === id ? parent : parent?.shards?.find(shard => shard.id === id);
      if (parent && run && parent.id !== id) {
        const log = this.#store.artifactByTitle(parent.topic, `Suite ${parent.id} · ${run.shardName} at ${parent.head.slice(0, 7)}`);
        const coverage = this.#store.artifactByTitle(parent.topic, `Coverage map ${parent.id} at ${parent.head}`);
        return log && !log.fileDeleted && log.status !== 'archived' ? [{ id: log.id, path: log.path }, ...(coverage && !coverage.fileDeleted && coverage.status !== 'archived' ? [{ id: coverage.id, path: coverage.path }] : [])] : [];
      }
      if (!run?.artifact) return [];
      const log = this.#store.resolveArtifact(run.artifact);
      if (!log || log.fileDeleted || log.status === 'archived') return [];
      const coverage = this.#store.artifactByTitle(run.topic, `Coverage map ${id} at ${run.head}`);
      return [{ id: log.id, path: log.path }, ...(coverage && !coverage.fileDeleted && coverage.status !== 'archived' ? [{ id: coverage.id, path: coverage.path }] : [])];
    }, (id, removed, error) => {
      if (removed) this.#store.setMeta(`suite-retired:${id}`, '1');
      if (removed) removedCount++;
      if (error) { errorCount++; firstError ??= String(error).slice(0,1024); }
    }, () => this.#closed).then(() => {
      const snapshot=this.#retention.snapshot();
      const progress={passes:++this.#retentionPasses,at:this.#clock.now().toISOString(),backlog:snapshot.backlog,removed:snapshot.removed,unindexed:snapshot.unindexed};
      this.#store.setMeta('suite-retention-progress',JSON.stringify(progress));
      this.#options.log?.({event:'suite-retention-report',durationMs:performance.now()-started,...snapshot,removedThisPass:removedCount,errors:errorCount,...(firstError?{firstError}:{})});
    }).catch(error => this.#options.log?.({ event: 'suite-retention-incomplete',durationMs:performance.now()-started,...this.#retention.snapshot(),error: String(error) })).finally(() => {
      this.#retentionWork = undefined;
      if (!this.#closed) {
        const snapshot=this.#retention.snapshot();
        this.#retentionTimer=this.#clock.setTimeout(()=>this.startRetention(),snapshot.backlog||snapshot.unindexed.continuing?120000:600000);
        this.#retentionTimer.unref();
      }
    });
  }
  async #launch(job: SuiteJob): Promise<void> {
    job.state = 'launching'; job.admittedAt ??= this.#clock.now().toISOString(); this.#launching.add(job.id); this.#save(job);
    let remotePreExecution = false;
    try {
      if(job.hostSource){if(!job.hostSnapshot)throw new Error('host snapshot ownership receipt unavailable');await validateHostVerifyWorktree(this.#root,job.cwd,job.hostSnapshot,this.#env);}
      // Hydrate the durable remote prefix before any local launch diagnostics.
      // The job can predate delivery's lease checkpoint, including no offset.
      if (job.executor === 'droplet' && !job.shards) {
        if (job.lease) job.lease = await readLease(leaseDir(this.#root, job.lease as DropletLease));
        else {
          const restored = (await readLeases(this.#root)).find(lease => lease.run === job.id && lease.state !== 'released');
          if (restored) job.lease = restored;
        }
        const execution = (job.lease as DropletLease | undefined)?.execution;
        if (execution?.delivered) job.remoteLogStart = execution.deliveryLogEnd ?? job.remoteLogStart ?? (await stat(job.log)).size;
      }
      // Share admission cleanup across concurrent shard launches; never scan on startup.
      await this.#rawCoverage.sweep(async line => {
        if (job.executor === 'droplet' && job.remoteLogStart !== undefined) this.#options.log?.({ event: 'verification-admission-cleanup', id: job.id, message: line });
        else await appendFile(job.log, line);
      });
      if (this.#retentionAdmitted) this.startRetention();
      if (job.shardWait?.message && job.remoteLogStart === undefined) await appendFile(job.log, `sharding decision: ${job.shardWait.message}\n`);
      if (job.shards) { await this.#launchShards(job); return; }
      // Once remote collection starts, local bytes would count as remote output.
      // Pending delivery/start receipts can re-enter launch with that boundary set.
      if (job.remoteLogStart === undefined) await appendFile(job.log, `Workers ${job.workers} · source ${job.workersOverride !== undefined ? 'explicit --workers' : 'hub config'} · admitted\n`);
      const run = runRef(job);
      // Integrated dev owns the admitted commit's objects, independent of later
      // root commits. Its check runs remotely against that detached commit.
      const committedOnly = job.occasion === 'dev-t3' || job.integrated === true;
      if (job.executor === 'droplet') {
        if (job.remoteReplacement && job.remoteReplacement.state !== 'acquired') {
          job.outcome ??= { code: 1, cause: job.remoteReplacement.cause, notRun: 'infrastructure' };
          throw new Error('droplet replacement interrupted before readiness receipt');
        }
        // Undelivered leases cannot have submitted a worker. A restored delivered
        // lease may have lost its start acknowledgement, so remains uncertain.
        remotePreExecution = !job.lease || !(job.lease as DropletLease).execution?.delivered;
        if (job.lease && Date.parse(job.lease.deadline) <= this.#clock.now().getTime()) throw new Error('remote machine lifetime expired');
        if (!(job.lease as DropletLease | undefined)?.execution?.delivered) {
          if (!job.lease && !committedOnly && await this.#candidate.head(job.cwd) !== job.head) throw new Error('head moved after admission; cannot bundle submitted item for droplet');
          if (!job.lease) {
            if (!job.parentRun && !committedOnly) await this.#hostGate(job);
            if (job.hostGate) run.hostGate = job.hostGate;
            if (job.tierReceipts) run.tierReceipts = job.tierReceipts;
            if (job.cancelled) throw new Error('cancelled');
            if (!committedOnly && await this.#candidate.head(job.cwd) !== job.head) throw new Error('head moved after admission; cannot bundle submitted item for droplet');
            if (job.remoteAcquireAttempted) { this.#fallback(job, 'previous droplet acquisition was interrupted'); return; }
            job.remoteAcquireAttempted = true; this.#save(job);
            try { job.lease = await this.#droplet.acquire(run, new Date(this.#clock.now().getTime() + (job.config?.verification.lifetimeMs ?? this.#options.lifetimeMs ?? 6600000)).toISOString(), undefined, job.config, lease => {
              if (lease.run !== job.id) throw new Error('acquired lease run identity mismatch');
              job.lease = lease; this.#save(job);
            }); }
            catch (error) {
              if (this.#closed) return; // The durable creating lease belongs to restart reconciliation.
              if (await this.#replaceRemote(job, run, error)) {
                // A confirmed release and a new lease permit delivery below.
              } else {
                if (job.cancelled) throw error;
                if (error instanceof ProviderCapacityUnavailable) {
                  job.outcome = { code: 1, cause: error.message, notRun: 'provider-capacity' };
                  throw error;
                }
                // Acquisition never submits a worker start. Later start errors can
                // be ambiguous and must retain their executed-or-unknown outcome.
                if (job.parentRun) {
                  job.outcome = { code: 1, cause: error instanceof Error ? error.message : String(error), notRun: 'infrastructure' };
                  throw error;
                }
                if (job.requireRemote && !job.parentRun && error instanceof RemoteBudgetFull) {
                  job.state = 'queued';
                  delete job.admittedAt; delete job.remoteAcquireAttempted; delete job.config;
                  this.#save(job);
                  return;
                }
                this.#fallback(job, error instanceof Error ? error.message : 'provider unavailable'); return;
              }
            }
          }
          try {
            await this.#droplet.deliver(job.lease as DropletLease, run, committedOnly);
            // Replace an older hub's pre-delivery checkpoint on a retried lease.
            job.remoteLogStart = (await stat(job.log)).size;
          }
          catch (error) {
            try {
              if (!await this.#replaceRemote(job, run, error)) throw error;
              await this.#droplet.deliver(job.lease as DropletLease, run, committedOnly);
              job.remoteLogStart = (await stat(job.log)).size;
            } catch (failure) {
              if (committedOnly || job.parentRun) {
                const cause = failure instanceof Error ? failure.message : String(failure);
                if (job.outcome) await appendFile(job.log, `secondary delivery failure: ${cause}\n`);
                else job.outcome = { code: 1, cause, notRun: 'infrastructure' };
              }
              throw failure;
            }
          }
        }
        const lease = job.lease as DropletLease;
        // Delivery can append local attempt diagnostics. Remote byte zero starts
        // only after those writes have settled, including after restored delivery.
        if (lease.execution?.deliveryLogEnd !== undefined) job.remoteLogStart = lease.execution.deliveryLogEnd;
        else job.remoteLogStart ??= (await stat(job.log)).size;
        this.#save(job);
        if (job.cancelled) throw new Error('cancelled');
        remotePreExecution = false; // From this call onward a failed reply cannot prove non-execution.
        if (!lease.execution?.started) await this.#droplet.start(lease, run);
        if (!lease.execution?.started) { job.nextPoll = this.#clock.now().getTime() + testTiming('CLAND_TEST_DROPLET_RUN_POLL_MS', 10000, this.#options.env); this.#save(job); return; }
      } else {
        const head = await this.#candidate.head(job.cwd);
        if (head !== job.head && !(job.integrated && job.tree && await this.#candidate.tree(job.cwd) === job.tree)) throw new Error(`cancelled: queued head changed from ${job.head} to ${head}; submit verification again`);
        job.lease = await this.#local.acquire(run, new Date(Date.now() + 15000).toISOString());
        this.#save(job);
        await this.#local.prepare();
        await this.#local.deliver(job.lease, run);
        await this.#local.start(job.lease, run);
      }
      job.state = 'running'; this.#save(job);
    } catch (error) {
      if (this.#closed) return;
      // Failed acquisition can leave an unconfirmed provider resource. Retain its
      // durable lease so group completion waits for confirmed release as well.
      if ((job.parentRun || job.requireRemote) && !job.lease) {
        const lease = (await readLeases(this.#root)).find(lease => lease.run === job.id);
        if (lease) job.lease = lease;
      }
      // Keep the failure receipt: the inspector only terminates identity-verified processes.
      job.outcome ??= { code: 1, cause: error instanceof Error ? error.message : String(error),
        ...(job.parentRun && remotePreExecution && !job.cancelled ? { notRun: 'infrastructure' as const } : {}) }; this.#save(job);
    } finally { this.#launching.delete(job.id); if (job.cancelled) void this.#inspectJob(job); }
  }
  async #replaceRemote(job: SuiteJob, run: RunRef, error: unknown): Promise<boolean> {
    const phase = error instanceof DeliveryTransportError ? 'delivery'
      : error instanceof ReadinessDeadlineError && error.phase === 'boot-readiness' ? 'readiness' : null;
    if (!phase || job.remoteReplacement || job.cancelled || this.#closed || job.lease?.kind !== 'droplet' || !job.config) return false;
    const lease = job.lease as DropletLease;
    // Acquisition already owns unconfirmed cleanup. Leave its durable lease
    // with reconciliation and preserve the caller's existing fallback policy.
    if (lease.execution?.delivered || lease.state === 'releasing') return false;
    const config = structuredClone(job.config);
    config.verification.droplet.regions = config.verification.droplet.regions.filter(region => region !== lease.region);
    if (!config.verification.droplet.regions.length) return false;
    job.remoteReplacement = { lease: lease.lease, region: lease.region, phase, state: 'releasing', cause: error instanceof Error ? error.message : String(error) };
    this.#save(job);
    try {
      const released = await this.#droplet.release(lease);
      if (lease.state !== 'released' || released.lifetimeMs === null || released.costUsd === null) throw error;
      job.remoteReplacement.accounting = { lifetimeMs: released.lifetimeMs, costUsd: released.costUsd };
      this.#save(job);
      if (job.cancelled || this.#closed) throw error;
      job.remoteReplacement.state = 'acquiring'; this.#save(job);
      job.lease = await this.#droplet.acquire({ ...run, leaseDeadline: lease.deadline }, lease.deadline, undefined, config, replacement => {
        if (replacement.run !== job.id) throw new Error('replacement lease run identity mismatch');
        job.lease = replacement; this.#save(job);
      });
      job.remoteReplacement.state = 'acquired';
      job.remoteReplacement.replacement = (job.lease as DropletLease).lease;
      this.#save(job);
      await appendFile(job.log, `droplet replacement ${JSON.stringify(job.remoteReplacement)}\n`);
      return true;
    } catch (secondary) {
      job.outcome ??= { code: 1, cause: job.remoteReplacement.cause, notRun: 'infrastructure' };
      this.#save(job);
      await appendFile(job.log, `secondary replacement failure: ${secondary instanceof Error ? secondary.message : String(secondary)}\n`);
      throw error;
    }
  }
  #shouldPlanShards(job: SuiteJob): boolean {
    if (job.shards) return false;
    // Integrated is assigned by dispatch only to Coordinator root runs (or QA
    // epic occasions). Soaks retain their single-slot policy.
    return !job.batch?.diagnostic && (job.occasion !== 'batch' || Boolean(job.tierPlan?.length && job.commands?.tiers)) && job.occasion !== 'soak' && !job.shardingSkipped && Boolean(job.occasion || job.integrated && job.cwd === this.#root
      && job.branch === 'dev' && job.mode === 'all' && job.tree
      && job.selection?.mode === 'full' && job.selection.fetchedDev === job.head) || !job.parentRun && !job.batch?.diagnostic && !job.shardingSkipped && job.occasion !== 'soak' && job.selection?.mode === 'full'
      && projectedTierWall(job.tierPlan ?? [], job.workers ?? 4) * 1000 > (job.config?.verification.runTimeoutMs ?? this.#options.runTimeoutMs ?? 4500000);
  }
  async #planShards(job: SuiteJob, free: number): Promise<void> {
    // Cancellation may mark an outcome now, but cannot collect/report before reservation settles.
    this.#planning.add(job.id);
    try {
      const durable = (await readLeases(this.#root)).filter(lease => lease.state !== 'released').length;
      const count = Math.min(free, this.#remoteBudget - durable, job.config?.verification.shards ?? this.#options.shards ?? 2);
      let cause: string | undefined;
      if (!await clandRunner(job.cwd)) cause = 'project commands are not sharded';
      else if (count < 2) {
        cause = free < 2 || this.#remoteBudget - durable < 2 ? 'fewer than 2 remote slots free' : `configured shard limit ${job.config?.verification.shards ?? this.#options.shards ?? 2}`;
        const projectedSeconds = projectedTierWall(job.tierPlan ?? [], job.workers ?? 4);
        const timeoutSeconds = (job.config?.verification.runTimeoutMs ?? 4500000) / 1000;
        if (cause === 'fewer than 2 remote slots free' && projectedSeconds > timeoutSeconds) {
          job.requireRemote = true;
          job.shardWait ??= { started: this.#clock.now().getTime(), projectedSeconds, timeoutSeconds };
          const waited = this.#clock.now().getTime() - job.shardWait.started;
          if (waited < (job.config?.verification.shardWaitMs ?? 1200000)) { this.#save(job); return; }
          this.#applyWholeFallback(job);
          this.#recordShardWait(job, 'fallback');
        }
      }
      else {
        const history = durationHistory(this.#options.durationContext);
        const tiers = job.selection?.soak ? null : await readTierAssignments(job.cwd);
        const batchFiles = job.occasion === 'batch' ? new Set(job.tierPlan?.flatMap(row => row.files) ?? []) : undefined;
        const included = (file: string) => batchFiles ? batchFiles.has(file) : tiers?.get(file) !== 'T4';
        const files = (await hubShards(job.cwd, false, undefined, history)).flatMap(shard => shard.targets).filter(included);
        const durations = Object.fromEntries(Object.entries((await readDurationManifest(job.cwd))?.files ?? {}).filter(([file]) => included(file)));
        const plans = balanceCloseShards(files, durations, count);
        job.plannedShards = count;
        job.shards ??= plans.map((plan, i) => {
          const id = `${job.id}-shard-${i + 1}`, dir = join(this.#root, '.cland/run/suites', id);
          const { shards: _shards, ...parent } = job;
          return { ...parent, id, parentRun: job.id, shardName: `shard-${i + 1}`, state: 'launching',
            selection: { ...job.selection!, mode: 'full', files: plan.files, reason: `${job.occasion === 'batch' ? 'batch' : 'close'} run shard ${i + 1}/${count}`, shard: { files: plan.files, nvim: plan.nvim } },
            log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready') };
        });
        for (const shard of job.shards) {
          if (job.occasion === 'batch' && shard.commands) shard.commands = pinVerificationPlan(shard.commands, { branch: shard.branch, mode: shard.mode, occasion: job.occasion, selection: shard.selection! });
          shard.tierPlan = await planTierReport(job.cwd, shard.selection!, job.workers ?? 4, undefined, history);
        }
        this.#save(job);
        try { await this.#droplet.reserveShards(job.shards!.map(shard => shard.id), job.size, job.config); if (job.shardWait) this.#recordShardWait(job, 'sharded'); }
        catch (error) { cause = error instanceof Error ? error.message : String(error); }
      }
      if (cause) {
        if (job.shardWait && !job.shardWait.path) {
          this.#applyWholeFallback(job);
          this.#recordShardWait(job, 'fallback');
          job.shardWait.message += `; sharding unavailable: ${cause}`;
        }
        if (job.shards) await this.#droplet.releaseShardReservations(job.shards.map(shard => shard.id));
        delete job.shards;
        job.shardingSkipped = cause; this.#save(job);
        this.#announceShardingSkip(job);
      }
    } finally { this.#planning.delete(job.id); }
  }
  #applyWholeFallback(job: SuiteJob): void {
    const config = job.config!;
    normalizeRetainedShardPolicy(config);
    const selected = job.shardWait!.fallback ??= {
      size: job.size ?? config.verification.droplet.fallback_size,
      workers: job.workersOverride ?? config.verification.droplet.fallback_workers,
    };
    config.verification.droplet.size = selected.size;
    job.workers = selected.workers;
    if (job.limits) job.limits.workers = selected.workers;
  }
  #recordShardWait(job: SuiteJob, path: 'sharded' | 'fallback'): void {
    const wait = job.shardWait!;
    wait.path = path;
    wait.waitedSeconds = (this.#clock.now().getTime() - wait.started) / 1000;
    wait.message = `${path === 'fallback' ? `fallback ${job.size ?? job.config!.verification.droplet.size}` : 'sharded'} after a wait of ${wait.waitedSeconds}s; projection ${wait.projectedSeconds}s exceeds run timeout ${wait.timeoutSeconds}s; fewer than 2 remote slots free`;
    this.#save(job);
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
    if (!job.integrated && !shards.some(shard => shard.remoteAcquireAttempted)) await this.#hostGate(job);
    if (!job.integrated && await this.#candidate.head(job.cwd) !== job.head) {
      const cause = 'head moved after admission; cannot bundle submitted item for droplet';
      // A restored group may already have submitted workers. Only untouched
      // shards prove this parent fence refused every child before execution.
      if (!job.cancelled && !job.outcome && shards.every(shard => !shard.remoteAcquireAttempted && !shard.lease)) {
        for (const shard of shards) shard.outcome = { code: 1, cause, notRun: 'infrastructure' };
        job.outcome = { code: 1, cause: shards.map(shard => `${shard.shardName}: ${cause}`).join('; '), notRun: 'infrastructure' };
      }
      throw new Error(cause);
    }
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
    await this.#droplet.releaseShardReservations(shards.map(shard => shard.id)).catch(error => {
      // Child leases and durable group-release requests retain sweep ownership.
      // A broken ledger must not suppress the group's terminal receipt.
      this.#options.log?.({ event: 'verification-shard-release-deferred', id: job.id, error: String(error) });
    });
    const failures = shards.filter(shard => shard.outcome?.code !== 0);
    job.accountingPending = shards.some(shard => shard.accountingPending);
    // Different machines' repeated log receipts cannot share the single-machine
    // last-valid-line reducer. Retain their original identities through caching.
    job.shardHealth = shards.map(shard => ({ run: shard.id, shard: shard.shardName!, machine: shard.machine ? {
      ...(shard.machine.name ? { name: shard.machine.name } : {}), ...(shard.machine.size ? { size: shard.machine.size } : {}), ...(shard.machine.region ? { region: shard.machine.region } : {}),
    } : null, health: shard.health ?? null }));
    delete job.health;
    const incomplete = failures.filter(shard => shard.outcome?.notRun);
    // Passed siblings cannot turn incomplete infrastructure into failed tests.
    // A genuine test failure still owns the aggregate's failed disposition.
    const notRun = failures.length > 0 && incomplete.length === failures.length
      && incomplete.some(shard => shard.outcome?.notRun === 'infrastructure')
      ? 'infrastructure'
      : shards.every(shard => shard.outcome?.notRun) ? 'provider-capacity' : undefined;
    job.outcome ??= { code: failures.length ? 1 : 0, cause: failures.map(shard => `${shard.shardName}: ${shard.outcome?.cause || `exit ${shard.outcome?.code}`}`).join('; '), ...(notRun ? { notRun } : {}) };
    const platform = shards.find(shard => shard.platform)?.platform;
    if (platform) job.platform = platform;
    job.finished = this.#clock.now().toISOString();
    if (!failures.length && job.selection?.recordCoverage) {
      const merged = await mergeCoverageFiles(shards.map(shard => join(this.#root, '.cland/run/suites', shard.id, 'coverage-map.json')),
        { version: 1, head: job.head, tree: job.tree!, created: this.#clock.now().toISOString(), testFiles: [], files: {} });
      await writeFile(join(this.#root, '.cland/run/suites', job.id, 'coverage-map.json'), JSON.stringify(merged), { mode: 0o600 });
    }
    const seconds = (ms: number | null) => ms === null ? 'unavailable' : `${(ms / 1000).toFixed(2)}s`;
    const lines = shards.flatMap(shard => [
      `shard duration ${shard.shardName} · ${shard.machine?.name ?? 'unavailable'} · ${shard.machine?.size ?? 'unknown'} ${shard.machine?.region ?? ''} · ${seconds(shard.finished ? elapsed(shard.admittedAt, Date.parse(shard.finished)) : null)} · ${shard.machine ? machineAccounting(shard.machine) : 'cost $0.0000'}; admission through remote finish`,
      `shard collection ${shard.shardName} ${seconds(shard.collectedAt ? elapsed(shard.finished, Date.parse(shard.collectedAt)) : null)}; remote finish through collection complete`,
    ]);
    await aggregateSuiteLogs(job.log, shards, `${job.shardWait?.message ? `sharding decision: ${job.shardWait.message}\n` : ''}${job.occasion ? `occasion ${job.occasion}\n` : ''}${failures.map(shard => shard.outcome?.notRun
      ? `shard not run ${shard.shardName}: ${shard.outcome.notRun}; ${shard.outcome.cause}`
      : `shard failure ${shard.shardName}: ${shard.outcome?.cause || `exit ${shard.outcome?.code}`}`).join('\n')}\n${lines.join('\n')}\ntotal cost ${job.accountingPending ? 'pending confirmation' : '$' + shards.reduce((sum, shard) => sum + (shard.machine?.costUsd ?? 0), 0).toFixed(4)}\nsuite duration ${((this.#clock.now().getTime() - Date.parse(job.admittedAt!)) / 1000).toFixed(2)}s; overall wall from admission through collection\n`);
    await rename(job.log + '.shards.tmp', job.log);
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
  #announceRemoteReclaim(job: SuiteJob): void {
    if (!job.remoteReclaimPending) return;
    // The topic notice has a stable run id. A failed callback or a restart
    // before this checkpoint retries delivery without losing the transition.
    this.#options.onRemoteReclaimed?.(job);
    this.#options.log?.({ event: 'verification-executor-reclaimed', id: job.id, item: job.item ?? null, requested: 'droplet', previous: 'local', effective: 'droplet', cause: 'remote capacity available' });
    job.remoteReclaimPending = false; this.#save(job);
  }
  #stopHostGate(id: string): void {
    const child = this.#hostGates.get(id);
    if (child?.pid && child.exitCode === null && child.signalCode === null) try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  }
  async #hostCheckFailure(job: SuiteJob, code: number): Promise<Error> {
    const output = await readFile(job.log, 'utf8');
    const hint = await missingDependencyHint(job.cwd, output.slice(output.lastIndexOf('\nHost gate:')), this.#root);
    if (hint) await appendFile(job.log, `\n${hint}\n`);
    return new Error(`host check failed (exit ${code}); no droplet created${hint ? `; ${hint}` : ''}`);
  }
  async #hostGate(job: SuiteJob): Promise<void> {
    const previous = job.hostGate;
    const command = verificationSteps(recordedCommands(job)).find(step => step.name === 'check')?.command;
    await appendFile(job.log, `\nHost gate: ${command ?? 'check not set'}\n`);
    if (!command) return;
    const started = performance.now();
    const record = async () => {
      // A passing native exit does not bind a command to inputs that changed
      // while it ran. Keep the exit, but let detached delivery check again.
      const observedTree = await this.#candidate.tree(job.cwd, job.integrated ? undefined : job.head).catch(() => null);
      if (job.hostGate!.tree !== observedTree || observedTree !== job.tree) job.hostGate!.tree = null;
      if (job.hostGate!.tree) (job.tierReceipts ??= []).push(tierReceipt({ id: job.id, tree: job.hostGate!.tree }, { name: 'check', command: job.hostGate!.command }, job.hostGate!.code));
      this.#save(job);
      const binding = { run: job.id, tree: job.hostGate!.tree, command: job.hostGate!.command };
      await appendFile(job.log, `\nverification step binding ${JSON.stringify(binding)}\ntier T0: exit ${job.hostGate!.code}; duration ${(performance.now() - started) / 1000} s; output tail: host check\n`);
      if (job.hostGate!.code === 0 && binding.tree && binding.tree === job.tree && previous && verificationInterrupted(previous.code)
        && previous.tree === binding.tree && previous.command === binding.command) {
        await appendFile(job.log, `Host gate retry superseded aborted attempt: run ${job.id}; tree ${binding.tree}; command ${JSON.stringify(binding.command)}; exit ${previous.code}; duration retained in preceding T0 receipt\n`);
      }
      if (job.hostGate!.code !== 0) {
        if (job.hostGate!.tree || job.cancelled || verificationInterrupted(job.hostGate!.code)) throw await this.#hostCheckFailure(job, job.hostGate!.code);
        await appendFile(job.log, 'Host gate source identity unknown; native failure retained as diagnostic; detached T0 required\n');
      }
    };
    if (this.#options.dropletServices?.hostGate) {
      job.hostGate = await this.#options.dropletServices.hostGate(runRef(job));
      await record();
      return;
    }
    const tree = await this.#candidate.tree(job.cwd, job.integrated ? undefined : job.head);
    const env = machineEnv(this.#options.env); delete env.NODE_TEST_CONTEXT; delete env.CLAND_SUITE_LEASE;
    const fd = await open(job.log, 'a');
    try {
      const child = spawn('/bin/sh', ['-c', command], { cwd: job.cwd, env, detached: true, stdio: ['ignore', fd.fd, fd.fd] });
      this.#hostGates.set(job.id, child);
      const code = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve(code ?? (signal === 'SIGKILL' ? 137 : signal === 'SIGINT' ? 130 : 143))); });
      job.hostGate = { tree, command, code };
      await record();
    } finally { this.#hostGates.delete(job.id); await fd.close(); }
  }
  #launchRemote(job: SuiteJob): void {
    const work = this.#launch(job).finally(() => this.#launchWork.delete(work));
    this.#launchWork.add(work);
  }
  #checkDevT3(): void {
    if (this.#closed || this.#periodic) return;
    const config = this.#options.projectConfig?.();
    const interval = config?.verification.devT3EveryMs;
    if (!interval) { this.#nextDevT3Check = 0; return; }
    const now = this.#clock.now().getTime();
    const last = this.#jobs.findLast(job => job.occasion === 'dev-t3');
    if (last && (!last.outcome || !last.reported)) return;
    const lastStarted = this.#jobs.findLast(job => job.occasion === 'dev-t3' && (job.shards ?? [job]).some(source => (source.lease as DropletLease | undefined)?.execution?.started));
    const startedAt = ((lastStarted?.shards ?? (lastStarted ? [lastStarted] : [])).find(source => (source.lease as DropletLease | undefined)?.execution?.started)?.lease as DropletLease | undefined)?.execution?.startedAt ?? lastStarted?.admittedAt ?? lastStarted?.queued;
    const anchor = this.#store.meta('dev-t3-attempt');
    if (!anchor) { this.#store.setMeta('dev-t3-attempt', String(now)); return; }
    const lastGreen = this.#jobs.findLast(job => fullPeriodicDevT3Cover(job, 'checkpoint') && this.#store.resolveArtifact(job.artifact!)
      && Date.parse(job.completedAt ?? job.finished ?? '') <= now);
    const greenAt = Date.parse(lastGreen?.completedAt ?? lastGreen?.finished ?? '') || 0;
    const storedSuppression = Number(this.#store.meta('dev-t3-batch-suppressed-since')) || 0;
    const suppressedSince = Math.max(greenAt, storedSuppression) || now;
    const deadline = suppressedSince + DEV_T3_BACKSTOP_MS;
    const lastAttempt = Math.max(Number(anchor), Date.parse(startedAt ?? '') || 0);
    // A skip near the daily deadline must not defer it by another interval.
    // Once an actual deadline attempt is persisted, failures retain ordinary
    // admission throttling instead of retrying on every scheduler tick.
    const backstopDue = storedSuppression > 0 && now >= deadline && lastAttempt < deadline;
    if (now - lastAttempt < interval && !backstopDue) return;
    if (now < this.#nextDevT3Check && !backstopDue) return;
    this.#nextDevT3Check = now + Math.min(interval, 60_000);
    this.#periodic = (async () => {
      if (lastStarted?.tree && await this.#candidate.tree(this.#root) === lastStarted.tree) return;
      const candidate = await this.#candidate.inspect(this.#root, 'all', config.verification.droplet.workers ?? config.verification.workers);
      if (this.#closed || this.#options.projectConfig?.().verification.devT3EveryMs !== interval) return;
      if (candidate.branch !== 'dev' || !candidate.tree || candidate.selection.fetchedDev !== candidate.head) return;
      if (lastStarted?.tree === candidate.tree) return;
      if (now - suppressedSince < DEV_T3_BACKSTOP_MS) {
        for (let index = this.#jobs.length - 1; index >= 0; index--) {
          const cover = this.#jobs[index]!;
          if (cover.tree !== candidate.tree || cover.occasion !== 'batch') continue;
          const proof = batchDevT3Cover(cover, candidate.tree, 'checkpoint');
          if (!proof || !this.#store.resolveArtifact(cover.artifact!)) continue;
          this.#store.setMeta('dev-t3-batch-suppressed-since', String(suppressedSince));
          this.#store.setMeta('dev-t3-attempt', String(now));
          const text = `periodic dev T3 skipped: green batch ${proof.batch} run ${proof.run} covers dev tree ${candidate.tree}; full periodic backstop within 24h`;
          this.#options.log?.({ event: 'verification-dev-t3-skipped', text, batch: proof.batch, run: proof.run, tree: candidate.tree });
          this.#options.onSoakNotice?.(`dev-t3-skip:${now}`, text);
          return;
        }
      }
      // Only complete, positively reported execution can suppress a scheduled run.
      // #jobs is the scheduler's loaded/checkpointed index; do not rescan logs here.
      for (let index = this.#jobs.length - 1; index >= 0; index--) {
        const cover = this.#jobs[index]!;
        const age = now - Date.parse(cover.completedAt ?? cover.finished ?? '');
        if (!Number.isFinite(age) || age < 0 || age > 3_600_000
          || !cover.integrated || cover.branch !== 'dev' || cover.mode !== 'all'
          || cover.occasion === 'dev-t3' || cover.occasion === 'soak' || cover.occasion === 'batch'
          || cover.parentRun || cover.batch?.diagnostic || cover.devT3Probe
          || cover.state !== 'finished' || !cover.reported || !cover.artifact
          || !this.#store.resolveArtifact(cover.artifact) || cover.outcome?.code !== 0 || cover.outcome.notRun
          || cover.cached || cover.cancelled || cover.requesterDied || cover.webPhase
          || cover.shards?.some(shard => shard.outcome?.code !== 0 || shard.outcome.notRun || shard.webPhase)
          || !wholeSuiteSelection(cover.selection)
          || !(cover.selection.tiers?.includes('T3') ?? true)) continue;
        if (cover.head !== candidate.head && !await this.#candidate.isAncestor?.(this.#root, candidate.head, cover.head)) continue;
        this.#store.setMeta('dev-t3-attempt', String(now));
        const text = `periodic dev T3 skipped: fresh green cover ${cover.id} at ${cover.head} passed within the last hour`;
        this.#options.log?.({ event: 'verification-dev-t3-skipped', text });
        this.#options.onSoakNotice?.(`dev-t3-skip:${now}`, text);
        return;
      }
      // Persist before async admission, including spend refusal, to avoid retry storms.
      this.#store.setMeta('dev-t3-attempt', String(now));
      await this.start({ mode: 'all', cwd: this.#root, topic: 'agents', to: ['coordinator'], actor: null,
        occasion: 'dev-t3', integrated: true, executor: 'droplet', fresh: true, priority: Number.MAX_SAFE_INTEGER }, () => {});
    })().catch(error => {
      const text = `periodic dev T3 skipped: ${error instanceof Error ? error.message : String(error)}`;
      this.#options.log?.({ event: 'verification-dev-t3-skipped', text });
      this.#options.onSoakNotice?.(`dev-t3-skip:${now}`, text);
    }).catch(error => {
      try { this.#options.log?.({ event: 'verification-dev-t3-notice-failed', error: String(error) }); }
      catch { /* a failed logger must not reject a background tick */ }
    }).finally(() => { this.#periodic = null; });
  }
  #checkSoak(): void {
    if (this.#closed || this.#soaking) return;
    const config = this.#options.projectConfig?.();
    const time = config?.verification.soak;
    const now = this.#clock.now().toISOString();
    const day = now.slice(0, 10);
    if (!time || now.slice(11, 16) < time || this.#store.meta('soak-attempt') === day) return;
    // Persist the attempt before I/O: a restart cannot duplicate submissions or notices.
    this.#store.setMeta('soak-attempt', day);
    this.#soaking = (async () => {
      const candidate = await this.#candidate.inspect(this.#root, 'all', config.verification.droplet.workers ?? config.verification.workers);
      if (this.#closed || this.#options.projectConfig?.().verification.soak !== time) return;
      if (candidate.branch !== 'dev' || !candidate.tree || candidate.selection.fetchedDev !== candidate.head) throw new Error('clean dev at freshly fetched origin/dev is required');
      const last = this.#jobs.findLast(job => job.occasion === 'soak' && !job.cached
        && (!job.outcome || (job.lease as DropletLease | undefined)?.execution?.started));
      if (last?.tree === candidate.tree && !last.selection?.shard) return;
      // No session identity is borrowed; this job and its reports belong to the hub.
      await this.start({ mode: 'all', cwd: this.#root, topic: 'agents', to: ['coordinator'], actor: null,
        occasion: 'soak', integrated: true, executor: 'droplet', fresh: true, priority: Number.MAX_SAFE_INTEGER }, () => {});
    })().catch(error => {
      const text = `nightly soak ${day} skipped; unexecuted coverage: all selected tiers; ${error instanceof Error ? error.message : String(error)}`;
      this.#store.setMeta('soak-coverage', text);
      this.#options.log?.({ event: 'verification-soak-skipped', day, text });
      this.#options.onSoakNotice?.(`soak-skip:${day}`, text);
    }).catch(error => {
      try { this.#options.log?.({ event: 'verification-soak-notice-failed', day, error: String(error) }); }
      catch { /* a failed logger must not reject a background tick */ }
    }).finally(() => { this.#soaking = null; });
  }
  #check(): Promise<void> {
    if (this.#checking) return this.#checking;
    if (this.#closed) return Promise.resolve();
    this.#checking = this.#tick().catch(error => { this.#options.log?.({ event: 'verification-admission-blocked', error: String(error) }); }).then(async () => {
      await this.#notifyTestSlot();
      if (this.#closed || !this.#options.onQueue) return;
      const queue = await this.#schedulerSnapshot();
      if (this.#closed) return;
      const holder = (value: import('../protocol.ts').VerificationHolder) => {
        const { runMs: _run, etaMs: _eta, ...facts } = value;
        return facts;
      };
      const signature = JSON.stringify({ ...queue, at: undefined,
        holder: queue.holder && holder(queue.holder), remote: queue.remote?.map(holder),
        waiters: queue.waiters.map(({ waitMs: _wait, etaMs: _eta, ...facts }) => facts),
      });
      if (signature !== this.#lastQueue) { this.#lastQueue = signature; this.#options.onQueue(queue); }
    }).catch(error => { this.#options.log?.({ event: 'verification-queue-failed', error: String(error) }); }).finally(() => { this.#checking = null; });
    return this.#checking;
  }
  async #tick(): Promise<void> {
    this.#expireStageEvidence();
    for (const id of this.#expiredStageJobs) {
      const job = this.#stageJobs.get(id);
      if (job) this.#options.onJob?.(job);
      this.#expiredStageJobs.delete(id);
    }
    // Durable slots feed the next published ETA; the sweep must not extend a tick.
    this.#refreshLeases();
    await this.#reaping;
    await Promise.all(this.#jobs.filter(job => job.reported && job.accountingPending).map(job => this.#confirmAccounting(job).catch(error => {
      job.error = `accounting confirmation: ${String(error)}`; this.#save(job);
    })));
    for (const job of this.#jobs) if (job.executor === 'droplet' && job.state === 'launching' && !job.outcome && !this.#launching.has(job.id) && !await this.#restoreRemoteResult(job) && this.#clock.now().getTime() >= (job.nextPoll ?? 0)) this.#launchRemote(job);
    await Promise.all(this.#jobs.map(job => this.#inspectJob(job)));
    if (this.#closed) return;
    // Reserve launching jobs, including their asynchronous acquires, until release
    // is confirmed. A receipt alone does not free a billable remote resource.
    const active = this.#jobs.filter(this.#occupying);
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
      // A budget fallback is provisional until local admission. Preparation or
      // cleanup leases can fill capacity outside this scheduler's active jobs.
      if (job?.executor === 'local' && job.requestedExecutor === 'droplet' && job.fallback === 'remote budget full'
        && remoteActive < this.#remoteBudget && (await this.#liveLeases()).length < this.#remoteBudget) {
        if (this.#closed || job.state !== 'queued' || job.outcome) continue;
        job.executor = 'droplet';
        job.workers = job.workersOverride ?? job.workerPolicy?.droplet ?? job.workers ?? 4;
        if (job.limits) job.limits.workers = job.workers;
        // Budget refusal created no machine; it is safe to acquire again.
        delete job.remoteAcquireAttempted; delete job.fallback; delete job.fallbackLogged;
        job.remoteReclaimPending = true;
        this.#save(job);
        this.#announceRemoteReclaim(job);
      }
      const chosenExecutor = job?.executor;
      if (job?.executor === 'droplet' && this.#shouldPlanShards(job)
        && projectedTierWall(job.tierPlan ?? [], job.workers ?? 4) * 1000 > (job.config?.verification.runTimeoutMs ?? this.#options.runTimeoutMs ?? 4500000)) {
        this.#captureConfig(job);
        await this.#planShards(job, Math.max(0, this.#remoteBudget - remoteActive));
      }
      if (job?.shardWait && !job.shardWait.path) continue;
      // Preparation and unconfirmed cleanup can occupy durable slots without a
      // running suite. Remote-only requests wait for those releases too.
      if (job?.requireRemote && (await this.#liveLeases()).length >= this.#remoteBudget) continue;
      if (job && (job.state !== 'queued' || job.outcome)) continue;
      if (job?.executor === 'droplet' && remoteActive < this.#remoteBudget) {
        this.#captureConfig(job);
        if (this.#shouldPlanShards(job)) await this.#planShards(job, this.#remoteBudget - remoteActive);
        if (job.state !== 'queued' || job.outcome || job.shardWait && !job.shardWait.path) continue;
        remoteActive += job.shards?.length ?? 1;
        this.#options.log?.({ event: 'verification-admitted', id: job.id, item: job.item ?? null, session: suiteAuthor(job), executor: 'droplet', remoteActive, remoteBudget: this.#remoteBudget });
        this.#launchRemote(job);
        continue;
      }
      if (job?.requireRemote) continue;
      if (localActive >= this.#budget) continue;
      if (localOccupied === undefined) {
        try { localOccupied = await this.#local.occupied(); this.#localBlocked = undefined; }
        catch (error) {
          this.#localBlocked = { reason: error instanceof Error ? error.message : String(error) };
          throw error;
        }
      }
      if (localOccupied) continue;
      if (this.#closed || job && (job.state !== 'queued' || job.outcome || job.executor !== chosenExecutor)) continue;
      if (!job && ('actor' in next || next.left || next.admittedAt || ![...this.#humans.values()].includes(next))) continue;
      localActive++;
      if (job) {
        this.#captureConfig(job);
        if (job.executor === 'droplet') {
          if (this.#shouldPlanShards(job)) await this.#planShards(job, 0);
          this.#fallback(job, 'remote budget full');
        }
        await this.#launch(job);
      } else if (!('actor' in next) && !next.left && !next.admittedAt && [...this.#humans.values()].includes(next)) {
        next.admittedAt = this.#clock.now().toISOString();
        this.#options.log?.({ event: 'verification-human-admitted', id: next.id, session: 'human', cwd: next.cwd, head: next.head, mode: next.mode, waitMs: elapsed(next.queued, this.#clock.now().getTime()), graceMs: HUMAN_GRACE_MS });
      }
    }
  }

  async #inspectJob(job: SuiteJob): Promise<void> {
    const admission = this.#isolatedAdmissions.get(job.id);
    if (admission) await admission;
    const pending = this.#inspecting.get(job.id);
    if (pending) return pending;
    if (this.#closed || job.reported || job.reportFailedPermanently || (job.reportRetryAt ?? 0) > this.#clock.now().getTime() || this.#launching.has(job.id) || this.#planning.has(job.id)) return Promise.resolve();
    if (job.executor === 'droplet' && (job.lease || job.shards)) this.#pendingCollections.add(job);
    const work = this.#inspect(job).catch(() => { /* saved errors are retried on the next tick */ }).finally(() => {
      this.#inspecting.delete(job.id);
      if (job.reported || job.reportFailedPermanently) this.#pendingCollections.delete(job);
    });
    this.#inspecting.set(job.id, work);
    return work;
  }
  #recordRunDeadline(job: SuiteJob): void {
    if (!job.outcome || job.outcome.code === 0 || job.timedOut) return;
    job.timedOut = true;
    if (job.outcome.notRun || job.cancelled || job.requesterDied) return;
    const secondary = job.outcome.cause;
    job.outcome = { ...job.outcome, cause: `run timeout ${job.config?.verification.runTimeout ?? this.#options.runTimeout ?? '75m'}${secondary ? `; secondary diagnostic: ${secondary}` : ''}` };
  }
  async #restoreRemoteResult(job: SuiteJob): Promise<boolean> {
    if (job.executor !== 'droplet') return false;
    if (job.state === 'finished' && job.finished && job.outcome) return true;
    const text = await readFile(job.result, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (text === null) return false;
    const result = JSON.parse(text) as { deadlineExpired?: true; timingReceipts?: unknown; packageClosure?: SuiteJob['packageClosure']; tierReceipts?: unknown; code: number; cause?: string; notRun?: 'infrastructure' | 'provider-capacity'; finished: string; platform?: Platform; health?: MachineHealth; shardHealth?: ShardMachineHealth[] };
    if (!Number.isInteger(result.code) || typeof result.finished !== 'string' || !Number.isFinite(Date.parse(result.finished)) || result.cause !== undefined && typeof result.cause !== 'string') throw new Error('invalid remote result receipt');
    // The receipt survives deletion of the machine and can predate the last job
    // checkpoint. Reconcile it before polling or relaunching a persisted holder.
    if (job.outcome?.notRun && (result.notRun !== job.outcome.notRun || result.code !== job.outcome.code || result.cause !== job.outcome.cause)) {
      // An older collector could persist bare terminal transport status between
      // the delivery failure checkpoint and its full-outcome rewrite.
      await writeFile(`${job.result}.restore.tmp`, JSON.stringify({ ...result, ...terminalDeadlineMetadata(job, result), ...job.outcome, ...(job.packageClosure ? { packageClosure: job.packageClosure } : {}) }), { mode: 0o600 });
      await rename(`${job.result}.restore.tmp`, job.result);
    }
    if (!job.outcome?.notRun && (!job.outcome || !job.cancelled && !job.requesterDied && !job.timedOut)) job.outcome = { ...suiteCommandOutcome(result.code, result.cause ?? ''), ...(result.notRun ? { notRun: result.notRun } : {}) };
    job.finished = result.finished;
    if (result.deadlineExpired === true) this.#recordRunDeadline(job);
    if (result.packageClosure) job.packageClosure = result.packageClosure;
    const tierReceipts = parseTierReceipts(result.tierReceipts);
    if (tierReceipts) job.tierReceipts = tierReceipts;
    const timing = parseTimingReceipts(result.timingReceipts);
    if (timing) job.timingReceipts = timing;
    if (result.platform) job.platform = result.platform;
    if (result.health) job.health = result.health;
    if (result.shardHealth) { job.shardHealth = result.shardHealth; delete job.health; }
    job.state = 'finished'; this.#save(job);
    return true;
  }
  async #recoverMissingRemoteEvidence(job: SuiteJob): Promise<void> {
    // A cache hit has no new native receipt. Legacy report-only inputs and fresh
    // refusals still own their first materialization; an outcome alone does not
    // prove that remote execution finished and subsequently lost its evidence.
    if (job.executor !== 'droplet' || job.lease || job.shards || job.cached || job.reported
      || job.state !== 'finished' || !job.finished) return;
    const missing: string[] = [];
    for (const [name, path] of [['result receipt', job.result], ['collection log receipt', job.log]] as const) {
      try { await stat(path); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        missing.push(name);
      }
    }
    if (!missing.length) return;
    // Lost evidence proves collection failure, not non-execution. A terminal
    // refusal already has positive non-execution facts: preserve its exact cause.
    const diagnostic = `missing ${missing.join(' and ')}`;
    if (!job.outcome?.notRun) job.outcome = { code: job.outcome?.code || 1, cause: `${job.outcome?.cause ? job.outcome.cause + '; ' : ''}${diagnostic}; remote collection unavailable` };
    job.finished ??= this.#clock.now().toISOString();
    job.state = 'finished'; this.#save(job);
    await mkdir(dirname(job.log), { recursive: true });
    await mkdir(dirname(job.result), { recursive: true });
    await appendFile(job.log, `${job.outcome!.notRun ? `${diagnostic}; report inputs reconstructed from terminal refusal\n` : ''}${job.outcome!.cause}\n`, { mode: 0o600 });
    if (!job.outcome!.notRun || missing.includes('result receipt')) await writeFile(job.result, JSON.stringify({ ...terminalDeadlineMetadata(job), ...job.outcome, ...(job.packageClosure ? { packageClosure: job.packageClosure } : {}), finished: job.finished }), { mode: 0o600 });
  }
  async #confirmAccounting(job: SuiteJob): Promise<void> {
    const sources = job.shards ?? [job];
    for (const source of sources) {
      if (!source.lease || source.machine?.lifetimeMs !== null && source.machine?.costUsd !== null) continue;
      const lease = await readLease(leaseDir(this.#root, source.lease as DropletLease));
      if (lease.lease !== (source.lease as DropletLease).lease || lease.name !== (source.lease as DropletLease).name) throw new Error('accounting lease identity changed');
      if (lease.state !== 'released' || lease.lifetimeMs === undefined || lease.costUsd === undefined) return;
      source.lease = lease;
      source.machine = { name: lease.name, size: lease.size, region: lease.region, ...resourceAccounting(source, lease, { lifetimeMs: lease.lifetimeMs, costUsd: lease.costUsd }) };
    }
    // Publication is idempotent by run id. Save the confirmed numbers only after
    // the notice succeeds so a crash or unavailable topic retries the correction.
    await this.#options.onAccountingConfirmed?.(job);
    for (const source of sources) source.accountingPending = false;
    job.accountingPending = false; job.error = null; this.#save(job);
  }
  async #inspect(job: SuiteJob): Promise<void> {
    this.#announceRemoteReclaim(job);
    this.#announceFallback(job);
    this.#announceShardingSkip(job);
    if (job.state === 'queued' && !job.outcome) {
      if (!job.actor || !this.#options.requesterDead?.(job.actor)) return;
      job.requesterDied = true;
      job.outcome = { code: 130, cause: 'cancelled: requester died before admission' };
    }
    try {
      if (this.#normalizedReports.has(job.id) && this.#finalizedPath(job)) {
        await withSuiteLogPublication(job.finalizedLog!.source, () => this.#publishFinalized(job));
        return;
      }
      await this.#recoverMissingRemoteEvidence(job);
      const restored = await this.#restoreRemoteResult(job);
      if (restored && job.executor === 'droplet' && job.lease) {
        const missingLog = await stat(job.log).then(() => false, error => {
          if (error.code === 'ENOENT') return true;
          throw error;
        });
        if (missingLog) {
          // A native result suppresses status polling. Confirm absence at the
          // provider before rebuilding its missing local collection mirror.
          if (!await this.#droplet.confirmMachineMissing(job.lease as DropletLease)) return;
          await mkdir(dirname(job.log), { recursive: true });
          await appendFile(job.log, `machine ${(job.lease as DropletLease).name} gone; collection log missing\n`, { mode: 0o600 });
        }
      }
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
      if (receipt?.packageClosure) { job.packageClosure = receipt.packageClosure; this.#save(job); }
      if (receipt && (receipt.state === 'done' || receipt.state === 'lost')) {
        const tierReceipts = parseTierReceipts(receipt.tierReceipts);
        if (tierReceipts) job.tierReceipts = tierReceipts;
        const timing = parseTimingReceipts(receipt.timingReceipts);
        if (timing) job.timingReceipts = timing;
      }
      let logError: unknown;
      if (!restored && remote && job.lease && job.remoteLogStart !== undefined) {
        try { await this.#collectLog(job); }
        catch (error) { logError = error; }
        if (!logError && (receipt?.state === 'done' || receipt?.state === 'lost')) await writeFile(job.result, JSON.stringify({ ...terminalDeadlineMetadata(job, receipt ?? undefined), ...(job.outcome?.notRun ? job.outcome : suiteCommandOutcome(receipt.code ?? 1, receipt.cause ?? '')), ...(job.packageClosure ? { packageClosure: job.packageClosure } : {}), finished: receipt.finished ?? this.#clock.now().toISOString(), ...(job.timingReceipts ? { timingReceipts: job.timingReceipts } : {}), ...(receipt.tierReceipts ? { tierReceipts: receipt.tierReceipts } : {}), ...(receipt.platform ? { platform: receipt.platform } : {}) }));
      }
      if (receipt?.platform) job.platform = receipt.platform;
      if (receipt?.finished) job.finished = receipt.finished;
      // A lost machine cannot supply collection bytes. Keep any surviving log,
      // but reconstruct a missing mirror before the evidence readers below:
      // otherwise ENOENT strands the running checkpoint and its capacity forever.
      if (remote && receipt?.state === 'lost' && job.lease) {
        await mkdir(dirname(job.log), { recursive: true });
        await appendFile(job.log, `remote machine ${(job.lease as DropletLease).name}: ${receipt.cause ?? 'lost'}; collection unavailable\n`, { mode: 0o600 });
      }
      if (receipt && (receipt.finished || !job.outcome) && (receipt.state === 'done' || receipt.state === 'lost') && !job.outcome?.notRun && !job.cancelled && !job.requesterDied && !job.timedOut) {
        job.outcome = suiteCommandOutcome(receipt.code ?? 1, receipt.cause ?? '');
      }
      if (receipt?.deadlineExpired === true && (receipt.state === 'done' || receipt.state === 'lost')) this.#recordRunDeadline(job);
      // Status replies prove transport liveness, not test progress. Only new
      // stdout/stderr bytes reset the silence bound, including across restart.
      const executionStartedAt = (job.lease as DropletLease | undefined)?.execution?.startedAt;
      const outputAt = job.remoteOutputAt ?? (executionStartedAt ? Date.parse(executionStartedAt) : undefined);
      const stallTimeoutMs = job.limits?.stallTimeoutMs ?? job.config?.verification.stallTimeoutMs;
      if (remote && !job.outcome && outputAt !== undefined && stallTimeoutMs !== undefined && this.#clock.now().getTime() - outputAt >= stallTimeoutMs) {
        job.timedOut = true;
        job.outcome = { code: 124, cause: `stalled: no output for ${Number((stallTimeoutMs / 60000).toFixed(3))} min` };
        this.#save(job);
      }
      if (remote && !job.outcome && outputAt !== undefined && stallTimeoutMs !== undefined) {
        // A non-multiple of the transport interval still expires at its silence
        // deadline, rather than paying for a second full polling interval.
        job.nextPoll = Math.min(job.nextPoll!, outputAt + stallTimeoutMs);
      }
      // Collection may retry, but cannot hide an expired silence deadline. A
      // valid completion outcome above also prevents a later stall classification.
      if (logError && receipt?.state !== 'lost' && !job.cancelled && !job.timedOut) throw logError;
      if (job.outcome && job.outcome.code !== 0) job.interruptedAt ??= job.finished ?? this.#clock.now().toISOString();
      if (job.cached && !this.#store.message(`suite:${job.id}`) && await this.#candidate.tree(job.cwd, job.integrated ? undefined : job.head) !== job.tree) {
        delete job.cached; job.outcome = { code: 1, cause: 'cached candidate changed; submit verification again' };
      }
      if (!job.outcome) {
        if (receipt && ['pending', 'running', 'paused', 'unknown'].includes(receipt.state)) return;
        job.outcome = { code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' };
      }
      if (remote) {
        if (!job.shards && !job.shardHealth && !job.health) {
          for await (const line of suiteLogLines(job.log)) {
            if (!line.startsWith('suite machine health ')) continue;
            const health = machineHealthFromLog(line);
            if (health) job.health = health;
          }
        }
        // A recovered receipt can already contain the finalized partial results.
        // Do not replace it with a header-only receipt on a reporting retry.
        if (!restored) await writeFile(job.result, JSON.stringify({ ...terminalDeadlineMetadata(job, receipt ?? undefined), ...job.outcome, ...(job.packageClosure ? { packageClosure: job.packageClosure } : {}), ...(job.tierReceipts ? { tierReceipts: job.tierReceipts } : {}), finished: job.finished ?? this.#clock.now().toISOString(), ...(job.platform ? { platform: job.platform } : {}), ...(job.health ? { health: job.health } : {}), ...(job.shardHealth ? { shardHealth: job.shardHealth } : {}) }));
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
              try {
                if (!await stat(path).then(() => true, () => false)) await this.#droplet.collectCoverage(lease, path);
                const map = parseCoverageMap(await readFile(path, 'utf8'));
                if (map.head !== job.head || map.tree !== job.tree) throw new Error('coverage map provenance mismatch');
              } catch (error) {
                if (!await this.#droplet.confirmMachineMissing(lease)) throw error;
                // Execution finished, but its required coverage receipt cannot
                // be recovered. Persist incompleteness before releasing the lease, so
                // retries never parse or fetch an interrupted map again.
                job.outcome = { code: 1, cause: `incomplete: machine ${lease.name} gone; coverage map missing; tests exited 0 (original result.json retained)` };
                this.#save(job);
                await appendFile(job.log, `${job.outcome.cause}\n`);
              }
            }
            // Retain the durable outcome/log while release retries. A bounded
            // window catches normal provider lag without holding a verdict
            // indefinitely; late confirmation gets its own correction notice.
            const released = await this.#droplet.release(lease, job.packageClosure ? Infinity : Date.parse(job.accountingWaitStarted) + ACCOUNTING_WAIT_MS).catch(error => {
              this.#options.log?.({ event: 'verification-release-deferred', id: job.id, lease: lease.lease, error: String(error) });
              return { lifetimeMs: lease.lifetimeMs ?? null, costUsd: lease.costUsd ?? null };
            });
            job.machine = { name: lease.name, size: lease.size, region: lease.region, ...resourceAccounting(job, lease, released) };
            this.#save(job);
            if (packageClosurePending(job)) {
              job.error = 'package closure incomplete; awaiting confirmed machine deletion';
              this.#save(job);
              return;
            }
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
        // Local release has observed the delegated detached-writer cleanup.
        if (job.executor === 'local') {
          try { await removeRawCoverage(this.#root, job.id); }
          catch (error) { await appendFile(job.log, `suite raw coverage cleanup retained: ${String(error)}\n`); }
        }
        job.cleaned = true; this.#save(job);
      }
      job.collectedAt ??= this.#clock.now().toISOString();
      this.#save(job);
      // Final collection is over before appending derived lines: remote offsets
      // remain raw byte offsets until the machine has been released.
      let evidence: string | undefined;
      const logEvidence = async () => evidence ??= await (job.cached ? this.evidence(job) : readSuiteEvidence(this.#finalizedPath(job) ?? job.log));
      if (remote && !job.cached && !this.#finalizedPath(job)) {
        const diagnostic = coverageDownloadDiagnostic(join(dirname(job.log), 'coverage-map.json'));
        const present = await stat(diagnostic).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
        if (present) {
          const pointer = `coverage download diagnostics: ${diagnostic}\n`;
          const log = await logEvidence();
          if (!log.includes(pointer)) { await appendFile(job.log, pointer); evidence = log + pointer; }
        }
      }
      // A native success can coexist with an incomplete scheduler collection.
      // Keep that original receipt byte-for-byte, including across report retries.
      const preserveNativeResult = remote && incompleteCollection(job);
      if (!job.cached && !preserveNativeResult) {
        const webPhase = unavailableWebPhase(await logEvidence());
        if (webPhase) {
          job.webPhase = webPhase;
          const result = JSON.parse(await readFile(job.result, 'utf8'));
          await writeFile(`${job.result}.web.tmp`, JSON.stringify({ ...result, ...terminalDeadlineMetadata(job, result), webPhase }), { mode: 0o600 });
          await rename(`${job.result}.web.tmp`, job.result);
          this.#save(job);
        }
      }
      if (!job.cached && !preserveNativeResult && !job.progressReported && (remote || job.outcome.code === 124)) {
        const log = await logEvidence();
        if (job.outcome.code === 124 && job.tierPlan?.length) {
          const execution = tierExecution(job.tierPlan, log);
          const result = JSON.parse(await readFile(job.result, 'utf8'));
          await writeFile(`${job.result}.execution.tmp`, JSON.stringify({ ...result, ...terminalDeadlineMetadata(job, result), execution }), { mode: 0o600 });
          await rename(`${job.result}.execution.tmp`, job.result);
          const lines = '\n' + [...executionLines(execution),
            ...executionLines(execution, 256).map(line => `suite execution summary ${line}`)].join('\n') + '\n';
          await appendFile(job.log, lines); evidence = log + lines;
        }
        const progress = remote ? suiteProgress(log, Date.parse(job.interruptedAt ?? job.finished ?? this.#clock.now().toISOString())) : null;
        if (progress) {
          const result = JSON.parse(await readFile(job.result, 'utf8'));
          await writeFile(`${job.result}.progress.tmp`, JSON.stringify({ ...result, ...terminalDeadlineMetadata(job, result), progress }), { mode: 0o600 });
          await rename(`${job.result}.progress.tmp`, job.result);
          if (job.outcome.code !== 0 && !log.includes('\nsuite interruption ')) {
            const lines = `\nsuite interruption ${JSON.stringify({ at: job.interruptedAt })}\n${progressLines(progress, { timeout: job.occasion === 'dev-t3' ? job.timedOut === true : job.outcome.code === 124 }).join('\n')}\n`;
            await appendFile(job.log, lines); evidence = (evidence ?? log) + lines;
          }
        }
        job.progressReported = true; this.#save(job);
      }
      if (job.tierPlan?.length && !job.tierReported && !job.cached) {
        const log = await logEvidence();
        const lines = tierReport(tierPlanWorkers(job.tierPlan, job.workers ?? 4), timingReceipts(log));
        if (!log.includes('\n' + lines.join('\n') + '\n')) {
          const text = lines.join('\n') + '\n';
          await appendFile(job.log, text); evidence = log + text;
        }
        job.tierReported = true; this.#save(job);
      }
      if (!job.budgetReported && !job.cached && !job.parentRun) {
        try {
          const context = this.#options.durationContext !== undefined ? this.#options.durationContext : await durationBudgetContext(job.cwd, { head: job.head, ...(job.durationBase ? { base: job.durationBase } : {}), env: this.#env });
          if (context) {
            const log = await logEvidence();
            const text = '\n' + durationBudgetReport(context.manifest, context.tiers, timingReceipts(log), context.base).join('\n') + '\n';
            await appendFile(job.log, text); evidence = log + text;
          }
        } catch {
          const text = 'budget (report only): unavailable (report read failed)\n';
          await appendFile(job.log, text); if (evidence !== undefined) evidence += text;
        }
        job.budgetReported = true; this.#save(job);
      }
      if (!job.loadProofs && job.item && !job.integrated && !job.occasion && !job.cached && !job.cancelled && !job.requesterDied && job.selection?.loadGate && job.outcome.code === 0) {
        job.loadProofs = loadProofIdentities(await logEvidence());
      }
      this.#recordTiming(job, job.completedAt ?? (!job.cached && job.finished ? job.finished : job.collectedAt));
      if (job.integrated && !job.parentRun && !job.cover) {
        const cover = deriveCover(job, await logEvidence());
        if (cover) job.cover = cover;
      }
      if (!await this.#flakyReceipt(job, await logEvidence())) return;
      if (job.cover?.receipt || job.flaky?.rejected) evidence = undefined;
      if (job.integrated && !job.cached && job.outcome.code === 0 && job.selection?.loadGateRerun && !job.selection.loadGateRerun.passed) {
        job.selection.loadGateRerun.passed = [...new Set(timingReceipts(await logEvidence()).filter(test => test.outcome === 'pass').map(test => `${test.file}::${test.name}`))].sort();
      }
      if (job.integrated && job.occasion && !job.cached && job.outcome.code === 0 && !job.timingIdentities) {
        job.timingIdentities = [...new Set(timingReceipts(await logEvidence()).map(test => `${test.file}::${test.name}`))].sort();
      }
      if (job.occasion === 'soak' && !job.cached && !job.outcome.notRun && job.outcome.code === 0 && !job.cancelled && !job.webPhase && job.tierPlan?.length) {
        const execution = tierExecution(job.tierPlan, await logEvidence());
        const weights = new Map(job.tierPlan.flatMap(row => row.files.map((file, i) => [file, row.phases?.flatMap(phase => phase.weights)[i] ?? row.seconds / row.files.length] as const)));
        const projected = job.tierPlan.reduce((sum, row) => sum + row.projectedWall, 0)
          + (job.selection?.loadGateTests ?? []).reduce((sum, identity) => sum + 5 * ((weights.get(identity.split('::')[0]!) ?? 0) + 1), 0);
        const observed = job.executor === 'droplet' ? soakExecutionSeconds(await logEvidence(), job.finished) : null;
        if (projected > 0 && observed !== null && execution.every(row => !row.unexecuted.length && !row.incomplete.length)) {
          this.#store.setMeta('soak-calibration', JSON.stringify({ run: job.id, projected, observed, interval: 'remote runner start through /done; includes remote setup, check if executed, tests, repetitions and final health; excludes host T0, acquisition, delivery and collection' }));
        }
      }
      this.#save(job);
      this.#normalizedReports.add(job.id);
      if (this.#finalizedPath(job)) {
        await withSuiteLogPublication(job.finalizedLog!.source, () => this.#publishFinalized(job));
        return;
      }
      await appendSuiteProvenance(job.log, job, await logEvidence(), async () => {
        const path = join(this.#root, '.cland/run/suites', job.id, 'finalized.log');
        await mkdir(dirname(path), { recursive: true });
        await copyFile(job.log, path + '.tmp');
        await rename(path + '.tmp', path);
        job.finalizedLog = { run: job.id, head: job.head, tree: job.tree ?? null, path, source: job.log };
        job.provenanceFinalized = true; this.#save(job);
        await this.#publishFinalized(job);
      });
    } catch (error) {
      job.error = error instanceof Error ? error.message : String(error);
      if (job.reportFailure && job.error !== job.reportFailure.error) job.reportFailure.secondary = job.error;
      if (job.cleaned && /^forbidden:/.test(job.error)) job.reportFailedPermanently = true;
      this.#save(job);
    }
  }

  async #publishFinalized(job: SuiteJob): Promise<void> {
    if (job.parentRun) { job.reported = true; job.error = null; this.#normalizedReports.delete(job.id); this.#save(job); return; }
    const log = this.#finalizedPath(job);
    if (!log) throw new Error('finalized log receipt does not match run');
    // The run-owned immutable copy, never a mutable legacy/shared pathname.
    if (!job.cached) this.#cacheEvidence(job.id, await readSuiteEvidence(log));
    const attemptedAt = this.#clock.now().toISOString();
    const reporting = { ...job, log };
    try {
      await this.#report(reporting, id => {
        if (job.artifact !== null && job.artifact !== id) throw new Error('suite artifact checkpoint already settled');
        job.artifact = id; reporting.artifact = id; this.#save(job);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.reportFailure = { error: message, attemptedAt };
      job.reportAttempts = (job.reportAttempts ?? 0) + 1;
      job.reportRetryAt = this.#clock.now().getTime() + Math.min(300_000, 5000 * 2 ** Math.min(job.reportAttempts - 1, 6));
      this.#options.log?.({ event: 'suite-report-failed', id: job.id, error: message });
      throw error;
    }
    delete job.reportFailure; this.#save(job);
    if(job.hostSource&&job.cwd.startsWith(hostVerifyDirectory(this.#root)+'/')) await removeHostVerifyWorktree(this.#root,job.cwd,this.#env,job.hostSnapshot);
    job.reported = true; job.error = null; this.#normalizedReports.delete(job.id); this.#save(job);
  }
  /** Reuse batch failing-file jobs through normal admission, leases and spend caps.
   * Each round is checkpointed before the next one; report retries never add rounds. */
  async #flakyReceipt(job: SuiteJob, log: string): Promise<boolean> {
    if ((!job.integrated && !job.batch) || job.parentRun || job.batch?.diagnostic || job.cached
      || job.cancelled || job.requesterDied || job.timedOut || job.outcome?.code !== 1 || !job.tree
      || job.cover?.receipt || job.flaky?.rejected) return true;
    const failures = suiteTestFailures(log) === null ? null : failingTests(log);
    if (!failures?.length || job.webPhase || job.outcome.notRun) return true;
    if (suiteAdmissionTimeouts(log).length || suiteInfrastructureCauses(job).length
      || /^duration budget:/m.test(log)
      || verificationStepResults(log, job).some(step => !step.superseded && step.code !== 0 && (step.name === 'check' || step.code !== 1))
      || job.tierPlan?.length && tierExecution(job.tierPlan, log).some(row => row.unexecuted.length || row.incomplete.length)) return true;
    if (!job.flaky) {
      const owners = this.#options.flakyOwners?.(failures) ?? {};
      if (failures.some(identity => !owners[identity])) return true;
      const commands = flakyRerunCommands(job);
      job.flaky = { owners, runs: [], ...(commands ? { commands } : { rejected: 'original command/step receipts unavailable' }) }; this.#save(job);
      if (!commands) return true;
    }
    const reject = (reason: string) => { job.flaky!.rejected = reason; this.#save(job); return true; };
    if (!job.flaky.commands || JSON.stringify(flakyRerunCommands(job)) !== JSON.stringify(job.flaky.commands)) return reject('original command/step binding unavailable or changed');
    if (await this.#candidate.tree(job.cwd, job.head) !== job.tree) return reject('candidate tree changed');
    const round = job.flaky.runs.length;
    if (round < 5) {
      const key = `flaky-${job.id}-${round}`;
      let repeat = this.findRun(run => run.batch?.diagnostic?.key === key);
      if (!repeat) {
        const admitted = await this.#start({ mode: 'all', cwd: job.cwd, topic: job.topic, to: job.to,
          actor: { name: 'hub', sessionId: key, shell: true },
          executor: job.executor, ...(job.workers !== undefined ? { workers: job.workers } : {}), ...(job.size ? { size: job.size } : {}), fresh: true, ...(job.priority !== undefined ? { priority: job.priority } : {}),
          batch: { id: job.batch?.id ?? job.id, members: job.batch?.members ?? [], diagnostic: { key, files: [...new Set(failures.map(identity => identity.split('::')[0]!))] } } }, () => {}, undefined, false, job.flaky.commands, Boolean(job.selection?.soak));
        if (!('id' in admitted)) return reject('rerun not admitted');
        repeat = this.findRun(run => run.id === admitted.id);
      }
      if (!repeat?.reported) return false;
      const evidence = await this.receipt(repeat.id);
      if (repeat.head !== job.head || !passingFlakyRepeat(failures, { job }, evidence, job.flaky.commands)) return reject(`rerun ${repeat.id} did not prove every identity passing at the original command/step`);
      job.flaky.runs.push(repeat.id); this.#save(job);
      if (job.flaky.runs.length < 5) return this.#flakyReceipt(job, log);
    }
    const owners = this.#options.flakyOwners?.(failures) ?? {};
    if (failures.some(identity => owners[identity] !== job.flaky!.owners[identity])) return reject('filed flaky owner changed');
    const outsideScope = failures.map(quarantineIdentityReason).find(reason => reason !== null);
    if (outsideScope) {
      reject(outsideScope);
      await appendFile(job.log, `\nsuite flaky receipt refusal ${JSON.stringify({ run: job.id, tree: job.tree, reason: outsideScope })}\n`);
      return true;
    }
    const manifest = flakyQuarantineManifest(owners, job.id, this.#clock.now().getTime());
    const receipt = { run: job.id, tree: job.tree, runs: [...job.flaky.runs], manifest };
    // Publish evidence before allowing stage admission. Native result.json is untouched.
    await writeFile(join(dirname(job.log), 'quarantine.json.tmp'), JSON.stringify(manifest), { mode: 0o600 });
    await rename(join(dirname(job.log), 'quarantine.json.tmp'), join(dirname(job.log), 'quarantine.json'));
    await appendFile(job.log, `\nsuite green-with-receipt ${JSON.stringify(receipt)}\n`);
    job.cover = { status: 'green', cause: null, tests: failures, receipt };
    this.#save(job);
    return true;
  }
  async #collectLog(job: SuiteJob): Promise<void> {
    if (job.remoteLogStart === undefined) return;
    for (;;) {
      // Local byte size is authoritative after a crash between append and checkpoint.
      const offset = (await stat(job.log)).size - job.remoteLogStart;
      const chunk = await this.#droplet.log(job.lease as DropletLease, offset);
      if (chunk.next === offset) return;
      if (chunk.next > (job.remoteOutputOffset ?? 0)) {
        job.remoteOutputAt = this.#clock.now().getTime();
        job.remoteOutputOffset = chunk.next;
      }
      // Checkpoint observed progress before committing mirror bytes. After a
      // crash, the local size still owns replay, while this high-water mark
      // keeps replayed bytes from renewing the original silence boundary.
      this.#save(job);
      await appendFile(job.log, chunk.bytes);
      if (chunk.next - offset < 262144) return;
    }
  }
  /** A changed role is new authorization evidence; do not poll a forbidden report. */
  reportPermissionsChanged(sessionId: string): void {
    let changed = false;
    for (const job of this.#jobs) {
      if (job.actor?.sessionId !== sessionId || !job.reportFailedPermanently) continue;
      delete job.reportFailedPermanently;
      delete job.reportRetryAt;
      delete job.reportAttempts;
      job.error = null; changed = true;
      this.#save(job);
    }
    if (changed) void this.#check();
  }
  requesterExited(sessionId: string): void {
    let changed = false;
    for (const job of this.#jobs) {
      if (job.actor?.sessionId !== sessionId || job.state !== 'queued' || job.outcome) continue;
      job.requesterDied = true;
      job.outcome = { code: 130, cause: 'cancelled: requester died before admission' };
      this.#save(job);
      changed = true;
    }
    // Restored stopped processes usually own no queued work. Rewriting every
    // historical receipt for each one makes startup scale as sessions × history.
    if (changed) void this.#check();
  }
  covers(): import('../protocol.ts').CoverStatus[] { return recentCovers(this.#jobs); }
  /** Collected immutable evidence for hub-owned batch diagnosis. */
  async receipt(id: string): Promise<{ job: SuiteJob; log: string }> {
    const job = this.#collectedJob(id);
    return { job: structuredClone(job), log: await this.evidence(job) };
  }
  #collectedJob(id: string): SuiteJob {
    const job = this.#jobs.find(job => job.id === id);
    if (!job?.reported || !job.outcome || !job.artifact) throw new Error(`suite ${id} has no collected receipt`);
    const artifact = this.#store.resolveArtifact(job.artifact);
    if (!artifact) throw new Error(`suite ${id} log artifact unavailable`);
    return this.#full(job);
  }
  async #batchT1(members: NonNullable<SuiteJob['batch']>['members']): Promise<BatchT1> {
    const decision: BatchT1 = { skipped: false, members: [] };
    if (!members.length) return { ...decision, reason: 'no pinned members' };
    for (const member of members) {
      const latest = this.latest(member.item, member.branch);
      if (!latest) return { ...decision, reason: `${member.item}: missing member verify receipt` };
      try {
        const job = this.#collectedJob(latest.id);
        let source: SuiteJob | undefined;
        let sourceRun: string | undefined;
        if (job.cached) {
          source = this.#collectedJob(job.cached.run);
          sourceRun = source.id;
          const executor = job.requestedExecutor === 'droplet' ? 'droplet' : undefined;
          if (!job.tree || !job.selection || !this.#cacheInputsMatch(source, job.tree, job.selection, job.workers ?? 4, recordedCommands(job), job.size, executor)
            || !this.#cacheReceiptAvailable(source, executor)) return { ...decision, reason: `${member.item}: cache source no longer satisfies cache policy` };
        }
        const reason = memberVerificationReason(member, job, source);
        if (reason) return { ...decision, reason: `${member.item}: ${reason}` };
        decision.members.push({ item: member.item, head: member.head, run: latest.id, ...(sourceRun ? { sourceRun } : {}) });
      } catch { return { ...decision, reason: `${member.item}: member verify receipt unavailable` }; }
    }
    return { ...decision, skipped: true };
  }
  #cacheEvidence(id: string, text: string): string {
    this.#evidence.delete(id); this.#evidence.set(id, text);
    while (this.#evidence.size > METRICS_WINDOW) this.#evidence.delete(this.#evidence.keys().next().value!);
    return text;
  }
  /** Immutable reporting evidence; concurrent cache hits and receipt queries share it.
   * Bound retained reports independently of the durable receipt history. In-flight
   * scans stay shared even when the completed-report cache rotates.
   */
  #evidencePath(job: Readonly<SuiteJob>): string {
    const artifact = job.artifact ? this.#store.resolveArtifact(job.artifact) : null;
    const path = artifact?.path ?? this.#finalizedPath(job) ?? job.log;
    return this.#env.CLAND_TEST_ORPHAN_ROOT === this.#root ? isolatedSuiteEvidencePath(this.#root, job.id, path, this.#env) : path;
  }
  #finalizedPath(job: Readonly<SuiteJob>): string | undefined {
    const receipt = job.finalizedLog;
    return receipt?.run === job.id && receipt.head === job.head && receipt.tree === (job.tree ?? null)
      && receipt.source === job.log && receipt.path === join(this.#root, '.cland/run/suites', job.id, 'finalized.log') ? receipt.path : undefined;
  }
  evidence(job: Readonly<SuiteJob>): Promise<string> {
    const source = job.cached ? this.#jobs.find(source => source.id === job.cached!.run) ?? job : job;
    const cached = this.#evidence.get(source.id);
    if (cached !== undefined) return Promise.resolve(this.#cacheEvidence(source.id, cached));
    let pending = this.#evidenceReads.get(source.id);
    if (!pending) {
      pending = Promise.resolve().then(() => readSuiteEvidence(this.#evidencePath(source))).catch(error => {
        // A cache copy is durable evidence even after its original log expires.
        if (source.id === job.id) throw error;
        return readSuiteEvidence(this.#evidencePath(job));
      }).then(text => this.#cacheEvidence(source.id, text)).finally(() => { this.#evidenceReads.delete(source.id); });
      this.#evidenceReads.set(source.id, pending);
    }
    return pending;
  }
  /** Automatic controllers search facts; full receipts require an explicit id. */
  findRun(predicate: (job: Readonly<SuiteRunFacts>) => boolean): Readonly<SuiteRunFacts> | undefined {
    return this.#jobs.find(predicate);
  }
  status(includeFinished = true): SuiteStatus[] {
    return this.#jobs.filter(job => includeFinished || job.state !== 'finished').map(job => this.#full(job, false)).map(job => ({
      ...(job.devT3Probe ? { devT3Probe: job.devT3Probe } : {}),
      ...(job.timingSummary ? { timingSummary: job.timingSummary } : {}),
      ...(job.timingShards ? { timingShards: job.timingShards } : {}),
      ...(job.batch ? { batch: job.batch } : {}),
      ...(job.cover ? { cover: job.cover } : {}),
      ...(job.occasion ? { occasion: job.occasion } : {}),
      ...(job.workers === undefined ? {} : { workers: job.workers }), ...(job.size ? { size: job.size } : {}),
      executor: job.executor, ...(job.webPhase ? { webPhase: job.webPhase } : {}), ...(job.platform ? { platform: job.platform } : {}),
      id: job.id, pid: job.pid, topic: job.topic, reported: job.reported, outcome: job.outcome, error: job.error,
      state: job.state ?? 'running', queued: job.queued ?? null, priority: job.priority ?? null,
      item: job.item ?? null, head: job.head, branch: job.branch, integrated: job.integrated ?? false,
      ...(job.selection ? { selection: job.selection } : {}),
      tree: job.tree ?? null, finished: job.finished ?? null, ...(job.cached ? { cached: job.cached } : {}),
      admittedAt: job.admittedAt ?? null, completedAt: job.completedAt ?? null, waitMs: job.waitMs ?? null, runMs: job.runMs ?? null,
      timingEstimated: job.timingEstimated ?? false,
    }));
  }
  recentStatus(): import('../protocol.ts').SuiteSummary[] {
    const seen = new Set<string>();
    return this.#jobs.filter(job => job.state === 'finished')
      .sort((a, b) => (b.completedAt ?? b.finished ?? '').localeCompare(a.completedAt ?? a.finished ?? ''))
      .flatMap(job => {
        const kind = job.integrated ? 'integrated' as const : 'task' as const;
        const occasion = job.occasion ?? null, key = `${kind}/${occasion}`;
        if (seen.has(key) || seen.size >= 20) return [];
        seen.add(key);
        return [{ id: job.id, kind, occasion, head: job.head, exit: job.outcome?.code ?? null,
          finishedAt: job.completedAt ?? job.finished ?? null, artifact: job.artifact }];
      });
  }
  async queue(): Promise<VerificationQueue> {
    this.#compatibility = await this.#local.holder();
    // An explicit read costs one lease sweep so its ETA never reports a slot
    // that preparation or an unconfirmed cleanup still holds.
    await this.#liveLeases();
    return this.snapshot();
  }
  /** The scheduler publishes from the sweep it already refreshed; only an explicit
   * queue read pays for a fresh lease scan. */
  async #schedulerSnapshot(): Promise<VerificationQueue> {
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
    const occupying = this.#jobs.filter(this.#occupying);
    const active = occupying.find(j => j.executor === 'local');
    // A failed release still owns the local budget, so admission never reaches
    // occupied(). Surface that cleanup failure until this job is actually clean.
    const localBlocked = active?.outcome && active.error ? { reason: active.error } : this.#localBlocked;
    const human = [...this.#humans.values()].find(s => !s.left && s.admittedAt && (!shim || shim.holder?.token === s.token));
    const describe = (job: SuiteJob): VerificationHolder => {
      const lease = job.executor === 'droplet' ? job.lease as DropletLease | undefined : undefined;
      const runMs = elapsed(job.admittedAt, now), expected = estimate(job.selection?.mode ?? job.mode, job.executor);
      return { ...(job.occasion ? { occasion: job.occasion } : {}), ...(job.shardName ? { shard: job.shardName } : {}), kind: 'run', executor: job.executor, id: job.id, session: suiteAuthor(job), item: job.item ?? null, mode: job.selection?.mode ?? job.mode, pid: job.pid, worktree: job.cwd, since: job.admittedAt ?? null, runMs, etaMs: expected === null || runMs === null ? null : Math.max(0, expected - runMs), ...(lease ? { machine: { name: lease.name, size: lease.size, region: lease.region } } : {}) };
    };
    const remote = occupying.filter(j => j.executor === 'droplet').flatMap(job => job.shards ? job.shards.filter(shard => !shard.cleaned).map(describe) : [describe(job)]);
    // A durable lease for an active remote row is already in `remote`. Every other
    // readable lease (preparation, unconfirmed cleanup) still holds one slot but
    // carries no observed duration, so it contributes an unknown remaining time.
    const remoteIds = new Set(remote.map(row => row.id));
    const durableOnly = this.#remoteLeases.filter(lease => !remoteIds.has(lease.run));
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
    let localEta = localBlocked ? null : holder ? holder.etaMs : 0;
    const leaseSlots: Array<number | null> = [...remote.map(row => row.etaMs), ...durableOnly.map(() => null)];
    const remoteEtas: Array<number | null> = [...leaseSlots, ...Array.from({ length: Math.max(0, this.#remoteBudget - leaseSlots.length) }, () => 0)];
    const queued = this.#ordered();
    // A racing hand run can own the shim while the admitted worker waits for it.
    if (active && holder?.kind === 'hand run') queued.unshift(active);
    return { version: 1, at: new Date(now).toISOString(), holder, ...(localBlocked ? { localBlocked } : {}), remote, remoteBudget: this.#remoteBudget, localFallback: this.#options.projectConfig?.().verification.localFallback ?? this.#options.localFallback ?? true,
      waiters: queued.map((j, i) => {
        const job = 'actor' in j ? j : null;
        const mode = job?.selection?.mode ?? j.mode;
        const executor = job?.requestedExecutor ?? job?.executor ?? 'local';
        const effective = job?.executor ?? 'local';
        // A waiter is admitted once enough leases release to leave one free slot.
        // Unknown durations sort after known ones: a waiter that must outlast a
        // durable-only lease gets an unknown ETA rather than a false free slot.
        const releasing = Math.max(1, leaseSlots.length - this.#remoteBudget + 1);
        const chosen = remoteEtas.flatMap((eta, index) => eta === null ? [] : [{ eta, index }]).sort((a, b) => a.eta - b.eta)[releasing - 1];
        const remoteEta = chosen?.eta ?? null;
        const useRemote = effective === 'droplet' && (job?.requireRemote || localEta === null || remoteEta !== null && remoteEta <= localEta);
        const etaMs = useRemote ? remoteEta : localEta;
        const expectedRunMs = estimate(mode, useRemote ? 'droplet' : 'local');
        const waiter = { ...(job?.requireRemote ? { waitingFor: 'remote' as const } : {}), ...(job?.occasion ? { occasion: job.occasion } : {}), kind: job ? 'run' as const : 'hand run' as const, executor, id: j.id, session: job ? suiteAuthor(job) : 'human', item: job?.item ?? null, mode, worktree: j.cwd, position: i + 1, queuedAt: j.queued ?? null, waitMs: elapsed(j.queued, now) ?? 0, etaMs, expectedRunMs };
        const nextEta = etaMs === null || expectedRunMs === null ? null : etaMs + expectedRunMs;
        if (useRemote) { if (chosen) remoteEtas[chosen.index] = nextEta; }
        else localEta = nextEta;
        return waiter;
      }), metrics };
  }

  /** Recovery has finished its native writes. Reinspect active collections now,
   * including parent groups, rather than waiting for another scheduler tick. */
  async executorRecovered(): Promise<void> {
    if (this.#closed) return;
    const pending = [...this.#pendingCollections].filter(job => job.accountingWaitStarted || job.shards?.some(shard => shard.accountingWaitStarted));
    await Promise.allSettled(pending.map(job => this.#inspecting.get(job.id)));
    if (!this.#closed) await Promise.all(pending.map(job => this.#inspectJob(job)));
  }

  /** Observe completion of already admitted I/O; does not tick or advance time. */
  async settled(): Promise<void> {
    await this.#reaping;
    await this.#soaking; await this.#periodic;
    await this.#checking;
    await Promise.allSettled(this.#launchWork);
    await Promise.allSettled(this.#inspecting.values());
    await this.#leaseRefreshing;
  }

  stopWaitMetrics(): void {
    const timer = this.#waitTimer;
    this.#waitTimer = null;
    if (timer) (this.#options.waitClock ?? this.#clock).clearInterval(timer);
  }
  async close(): Promise<void> {
    this.#closed = true;
    this.#clock.clearTimeout(this.#retentionTimer);
    this.#retentionTimer = undefined;
    await withCleanupAsync(async () => {
      const closingDroplet = this.#droplet.close(); for (const owner of this.#humans.keys()) this.leave(owner, 'hub closing'); this.#clock.clearInterval(this.#timer); this.stopWaitMetrics(); for (const id of this.#hostGates.keys()) this.#stopHostGate(id); await this.#soaking; await this.#periodic; await Promise.allSettled(this.#starting); await this.#checking; await Promise.allSettled(this.#launchWork); await this.#reaping; await this.#hostSnapshotRecovery; await this.#leaseRefreshing; await Promise.allSettled(this.#inspecting.values()); await closingDroplet;
    }, async () => { await this.#retentionWork; await this.#retention.close(); });
  }
}
