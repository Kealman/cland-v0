import { TerritoryBusy } from '../territory-lock-context.ts';
import { batchShardReceiptReason } from '../batch-shard-receipts.ts';
import { CandidateOwnershipUnavailable } from '../batch-candidate-ownership.ts';
import { batchT1Summary } from '../batch-member-verification.ts';
// Durable merge-batch policy; Git preparation and landing are owned by the territory boundary.
import { randomUUID, createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ShardManifestError } from '../suite-shards.ts';
import { suiteProgress } from '../suite-progress.ts';
import { loadGateCompletionSummary } from '../suite-load-gate-plan.ts';
import type { MergeQueueEntry } from '../protocol.ts';
import type { Store } from './store.ts';
import type { Clock, ClockTimer } from './clock.ts';
import type { Suites, SuiteJob } from './suites.ts';
import { failingTests } from './shared-defects.ts';
import type { TopicNotice } from './core.ts';
import { greenWithReceipt } from './suite-cover.ts';
import { verificationStepLabel, verificationStepResults, verificationInterrupted, type VerificationStep } from '../verification-plan.ts';
import { MergeError, MergeLintReadError } from '../merge.ts';
import type { LogFn } from '../log.ts';

/** Human-facing projection; persisted selection and log retain the full assessment. */
export function batchInteractionSummary(report: import('../suite-selection.ts').SuiteSelection['batchInteraction']) {
  const fallbackCounts: Record<string, number> = {};
  for (const match of report?.reason.matchAll(/(?:^|; )[^;]*? fallback: (?:Error: )?([^;]+)/g) ?? []) {
    const cause = match[1]!.replace(/ \[[^\]]*\](?::.*)?$/, '').replace(/: (?:hub|web|nvim)\/test\/.*$/, '');
    fallbackCounts[cause] = (fallbackCounts[cause] ?? 0) + 1;
  }
  return { mode: report?.mode ?? 'unavailable', phases: report?.phases ?? [], selectedFileCount: report?.files?.length ?? null,
    fallbackCounts, examples: report?.files?.slice(0, 10) ?? [],
    ...(report?.t3 ? { t3: { mode: 'report' as const, selectedFileCount: report.t3.files?.length ?? null, examples: report.t3.files?.slice(0, 10) ?? [] } } : {}) };
}

export type BatchCandidate = { base: string; head: string; tree: string; cwd: string; budgetLines: string[]; owner?: import('../batch-candidate-ownership.ts').CandidateOwnership };
type DiagnosticResult = { result: 'green' | 'red' | 'inconclusive'; reason?: string };
export type FileJob = { key: string; omitted?: string; candidate: BatchCandidate; run?: string; result?: DiagnosticResult['result']; reason?: string; seconds?: number | null; costUsd?: number | null; log?: { artifact: string; path: string } };
export type BatchDiagnosis = { failure: { run: string; tree: string; log: { artifact: string; path: string } }; failures: string[]; budgetLines?: string[]; files: string[]; steps?: VerificationStep['name'][]; jobs: FileJob[]; selected?: number; excluded?: string[]; reported?: boolean; unresolved?: boolean };
export type MergeBatch = { id: string; members: MergeQueueEntry[]; candidate?: BatchCandidate; run?: string; planFrom?: string; confirmation?: { original: string; skipped: string[] | null }; failed?: string; reportError?: string; retryLanding?: boolean; retryRequested?: boolean; completed?: string[]; reportedRun?: string; diagnosis?: BatchDiagnosis };
type FollowUpReport = { batch: MergeBatch; item: string; error: string; reportError?: string };
export type BatchCleanup = { batch: MergeBatch; candidate: BatchCandidate; error: string; attempts: number; retryAt: string; reported?: boolean; cleaned?: boolean };
const CLEANUP_LIMIT = 32, CLEANUP_RECORD_BYTES = 8192;
type CleanupNotice = { batch: MergeBatch; text: string; phase: `cleanup:${string}` };
/** Bound JSON-encoded UTF-8, including escaped controls and surrogate pairs. */
export function cleanupError(error: unknown): string {
  const source = error instanceof Error ? error.message : String(error);
  const raw = source.slice(0, 2048);
  let result = '', bytes = 2, truncated = source.length > raw.length;
  for (const point of raw) {
    const encoded = Buffer.byteLength(JSON.stringify(point)) - 2;
    if (bytes + encoded > 2034) { truncated = true; break; }
    bytes += encoded; result += point;
  }
  return result + (truncated ? ' [truncated]' : '');
}
export function batchNoticeId(batch: MergeBatch, phase?: string, item?: string): string {
  return `merge-batch:${batch.id}:${batch.run ?? 'blocked'}:${phase ?? (batch.failed ? 'blocked' : batch.diagnosis ? 'diagnosis' : 'suite')}${item ? ':' + item : ''}`;
}
function skippedFilesText(files: string[] | null): string { return files === null ? 'unknown; full selection rerun' : files.join(', ') || 'none'; }
function recoveryText(batch: MergeBatch): string {
  const retained = batch.members.filter(entry => !batch.completed?.includes(entry.item) && !batch.diagnosis?.excluded?.includes(entry.item));
  return `Members: ${retained.map(entry => `${entry.item} (${entry.head})`).join(', ')}\nCoordinator: diagnose and resolve the cause, then cancel and re-enqueue each retained head:\n${retained.map(entry => `cland merge ${entry.item} --cancel\ncland merge ${entry.item}`).join('\n')}`;
}
export type BatchBoundary = {
  log?: LogFn;
  changed?(): void;
  entries(): MergeQueueEntry[];
  build(id: string, members: MergeQueueEntry[], base?: string): Promise<BatchCandidate>;
  rebuildReason(tested: BatchCandidate, current: BatchCandidate, proof?: import('../batch-inputs.ts').BatchInputProof): Promise<string | null>;
  land(entry: MergeQueueEntry, candidate: BatchCandidate): Promise<void>;
  drop(entry: MergeQueueEntry, reason: string): void;
  cleanup(candidate: BatchCandidate): Promise<void>;
  /** Inspect retained admission authority before resuming an idle legacy batch. */
  validateOwnership?(candidate: BatchCandidate): Promise<void>;
  checkout(candidate: BatchCandidate): Promise<void>;
  isLanded(entry: MergeQueueEntry): boolean;
  /** Return only after durable publication to every required target; throw keeps its obligation. */
  report(batch: MergeBatch, text: string, phase?: 'rebuild' | 'confirmation' | `follow-up:${string}` | `cleanup:${string}`): void;
  notice(notice: TopicNotice): void;
};
export class BatchRebuild extends Error {}
class RetryLanding extends Error {}

export class BatchRefusal extends Error {
  readonly entry: MergeQueueEntry;
  readonly reason: string;
  constructor(entry: MergeQueueEntry, reason: string) { super(reason); this.entry = entry; this.reason = reason; }
}
/** Completed gate steps and measured, file-addressable failures drive diagnosis. */
function batchFailures(log: string, owner?: { id?: string; tree?: string | null }): { failures: string[]; budgetLines: string[]; steps: VerificationStep['name'][] } {
  const failures = new Set(failingTests(log));
  const steps = [...new Set(verificationStepResults(log, owner).filter(step => !step.superseded && (step.name === 'check' || step.name === 'Web') && step.code !== 0).map(step => step.name))];
  for (const step of steps) failures.add(verificationStepLabel(step));
  const budgetLines = new Set<string>();
  for (const line of log.replace(/\x1b\[[0-9;]*m/g, '').split('\n')) {
    const budget = /^duration budget: ((?:hub\/(?:test|src)|nvim\/test)\/.+?\.test\.ts(?:::.+)?) \d+(?:\.\d+)? s > \d+(?:\.\d+)? s(?: .*)?$/.exec(line);
    if (budget) { failures.add(budget[1]!); budgetLines.add(line); }
  }
  return { failures: [...failures], budgetLines: [...budgetLines], steps };
}
function failureText(evidence: { failures: string[]; budgetLines?: string[] }): string {
  return [evidence.failures.join(', '), ...evidence.budgetLines ?? []].join('\n');
}
/** Executor interruption and absence of an observed test failure cannot prove a red alternative. */
export function diagnosticResult(job: Pick<SuiteJob, 'state' | 'outcome' | 'cancelled' | 'requesterDied' | 'timedOut' | 'cached'> & Partial<SuiteJob>, log: string, steps: VerificationStep['name'][] = []): DiagnosticResult {
  const results = verificationStepResults(log, job).filter(step => !step.superseded);
  if (job.shards) {
    const reason = batchShardReceiptReason(job as SuiteJob, job.outcome?.code !== 0);
    if (reason) return { result: 'inconclusive', reason };
  }
  if (job.cancelled || job.requesterDied || job.timedOut || job.cached || job.state !== 'finished' || !job.outcome
    || !Number.isInteger(job.outcome.code) || verificationInterrupted(job.outcome.code)
    || results.some(step => verificationInterrupted(step.code))
    || /cancelled|abandon|unknown|remote machine lost|worker disappeared|without an exit receipt|lifetime expired/i.test(job.outcome?.cause ?? '')) {
    return { result: 'inconclusive', reason: job.outcome?.cause || 'aborted or unavailable worker result' };
  }
  if (job.outcome.code === 0 && job.shards) {
    return { result: 'green' };
  }
  if (job.outcome.code === 0) return steps.every(name => results.some(step => step.name === name && step.code === 0) && !results.some(step => step.name === name && step.code !== 0))
    ? { result: 'green' } : { result: 'inconclusive', reason: 'missing passing step receipt' };
  try { if (batchFailures(log, job).failures.length) return { result: 'red' }; } catch { /* malformed evidence is inconclusive */ }
  return { result: 'inconclusive', reason: 'no failing-test receipt' };
}
export class MergeBatches {
  readonly store: Store;
  readonly suites: Suites;
  readonly clock: Clock;
  readonly boundary: BatchBoundary;
  readonly settings: () => { queue: boolean; batch: number; batchWaitMs: number };
  constructor(store: Store, suites: Suites, clock: Clock, boundary: BatchBoundary,
    settings: () => { queue: boolean; batch: number; batchWaitMs: number }) {
    this.store = store; this.suites = suites; this.clock = clock; this.boundary = boundary; this.settings = settings;
  }
  #closed = false;
  #timer: ClockTimer | null = null;
  #work: Promise<void> | null = null;
  #cleanupBudget = 0;
  #noticeBudget = 0;
  start(): void {
    if (this.#timer || this.#closed) return;
    this.#timer = this.clock.setInterval(() => { void this.tick(); }, 1000);
    this.#timer.unref(); void this.tick();
  }
  snapshot(): MergeBatch | null { return JSON.parse(this.store.meta('merge-batch') ?? 'null') as MergeBatch | null; }
  cleanups(): BatchCleanup[] { return JSON.parse(this.store.meta('merge-batch-cleanups') ?? '[]') as BatchCleanup[]; }
  cleanupOverflow(): { count: number; oldestPath?: string } { return JSON.parse(this.store.meta('merge-batch-cleanup-overflow') ?? '{"count":0}'); }
  cleanupStatus(): NonNullable<import('../protocol.ts').VerificationQueue['cleanups']> {
    return this.cleanups().filter(job => !job.cleaned).map(job => ({ candidate: { cwd: job.candidate.cwd }, error: job.error, retryAt: job.retryAt }));
  }
  #saveCleanups(pending: BatchCleanup[]): void {
    const encoded = JSON.stringify(pending);
    if (pending.length > CLEANUP_LIMIT || Buffer.byteLength(encoded) > CLEANUP_LIMIT * CLEANUP_RECORD_BYTES) throw new Error('cleanup record budget exceeded');
    this.store.setMeta('merge-batch-cleanups', encoded); this.#changed();
  }
  #changed(): void {
    try { this.boundary.changed?.(); }
    catch (error) {
      const diagnostic = String(error).slice(0, 2048);
      this.store.setMeta('merge-batch-publication-error', diagnostic);
      try { this.boundary.log?.({ event: 'merge-batch-publication-failed', error: diagnostic }); } catch { /* ancillary observer */ }
    }
  }
  #save(batch: MergeBatch | null): void { this.store.setMeta('merge-batch', JSON.stringify(batch)); this.#changed(); }
  tick(): Promise<void> {
    if (this.#closed) return Promise.resolve();
    if (this.#work) return this.#work;
    this.#cleanupBudget = 1; this.#noticeBudget = 1;
    return this.#work ??= this.#advance().catch(error => {
      const batch = this.snapshot();
      if (batch) {
        if (batch.members.every(entry => batch.completed?.includes(entry.item) || batch.diagnosis?.excluded?.includes(entry.item) || this.boundary.isLanded(entry))) {
          delete batch.failed; delete batch.retryLanding;
          batch.reportError = cleanupError(error); this.#save(batch);
          this.#secondary(error); return;
        }
        batch.failed = error instanceof Error ? error.message : String(error);
        batch.retryLanding = error instanceof RetryLanding || error instanceof TerritoryBusy || error instanceof MergeLintReadError;
        this.#save(batch);
        try { this.boundary.report(batch, `batch ${batch.id} blocked: ${batch.failed}\n${batch.retryLanding ? 'The queue retries automatically on a later tick once the cause is resolved.' : 'Waiting for human or Coordinator action before retrying.\n' + recoveryText(batch)}`); }
        catch (error) {
          batch.reportError = error instanceof Error ? error.message : String(error);
          this.#save(batch);
          this.boundary.log?.({ event: 'merge-batch-report-failed', batch: batch.id, reason: batch.failed, error: batch.reportError });
        }
      }
    }).catch(error => {
      // Error handling runs on the same fire-and-forget timer as advancement.
      try { this.boundary.log?.({ event: 'merge-batch-tick-failed', error: String(error) }); }
      catch { /* a failed logger must not reject a background tick */ }
    }).finally(() => { this.#work = null; });
  }
  async #advance(): Promise<void> {
    for (;;) {
      try { await this.#tick(); return; }
      catch (error) {
        const batch = this.snapshot();
        if (!(error instanceof BatchRefusal || error instanceof BatchRebuild || error instanceof CandidateOwnershipUnavailable) || !batch) throw error;
        // Recheck the new base against the retained evidence on the next tick.
        // A base race alone does not invalidate a completed suite.
        if (error instanceof BatchRebuild) return;
        if (error instanceof BatchRefusal) this.boundary.drop(error.entry, error.reason);
        await this.#cleanup(batch, true);
        const members = batch.members.filter(entry => (!(error instanceof BatchRefusal) || entry.item !== error.entry.item)
          && this.boundary.entries().some(current => current.item === entry.item && current.head === entry.head && current.enqueued === entry.enqueued)
          && !batch.diagnosis?.excluded?.includes(entry.item) && !batch.completed?.includes(entry.item) && !this.boundary.isLanded(entry));
        this.#save(members.length ? { id: randomUUID(), members } : null);
        if (error instanceof CandidateOwnershipUnavailable) return;
        if (!members.length) return;
      }
    }
  }
  async #tick(): Promise<void> {
    const settings = this.settings();
    if (this.#closed) return;
    this.#reportFollowUps();
    try { await this.#retryCleanups(); this.#reportOverflowNotices(); }
    catch (error) { this.#secondary(error); }
    if (!settings.queue) return;
    let batch = this.snapshot();
    if (!batch) {
      const entries = this.boundary.entries().slice(0, settings.batch);
      if (!entries.length || entries.length < settings.batch && this.clock.now().getTime() - Date.parse(entries[0]!.enqueued) < settings.batchWaitMs) return;
      batch = { id: randomUUID(), members: entries };
      this.#save(batch);
    }
    const admitted = this.suites.findRun(job => job.id === batch!.run || job.batch?.id === batch!.id && !job.batch.diagnostic);
    if (admitted && !batch.run) { batch.run = admitted.id; this.#save(batch); }
    // A cancellation cannot replace the candidate checkout under a live worker.
    if (admitted && !admitted.reported || this.suites.findRun(job => job.batch?.id === batch!.id && !job.reported)) return;
    if (batch.candidate && !batch.candidate.owner) await this.boundary.validateOwnership?.(batch.candidate);
    if (batch.retryRequested) {
      await this.#cleanup(batch, true);
      const members = batch.members.filter(entry => this.boundary.entries().some(current => current.item === entry.item && current.head === entry.head && current.enqueued === entry.enqueued)
        && !batch!.completed?.includes(entry.item) && !batch!.diagnosis?.excluded?.includes(entry.item) && !this.boundary.isLanded(entry));
      this.#save(members.length ? { id: randomUUID(), members } : null);
      return;
    }
    // Retained failures cannot hold a batch after every member has finished.
    // Keep this after the worker barrier: cleanup must not remove a live checkout.
    if (batch.members.every(entry => batch!.completed?.includes(entry.item) || batch!.diagnosis?.excluded?.includes(entry.item) || this.boundary.isLanded(entry))) {
      await this.#cleanup(batch); this.#save(null); return;
    }
    if (batch.diagnosis?.unresolved) { await this.#unresolved(batch); return; }
    for (const entry of batch.members) {
      if (batch.completed?.includes(entry.item) || batch.diagnosis?.excluded?.includes(entry.item) || this.boundary.isLanded(entry)) continue;
      if (!this.boundary.entries().some(current => current.item === entry.item && current.head === entry.head && current.enqueued === entry.enqueued)) throw new BatchRefusal(entry, 'queued request changed or cancelled');
    }
    if (batch.failed && !batch.retryLanding) return;
    if (!batch.candidate) {
      batch.candidate = await this.boundary.build(batch.id, batch.members);
      this.#save(batch);
    }
    if (this.#closed) return;
    if (!batch.run) {
      // The durable batch id binds a crash between Suites admission and this checkpoint.
      const prior = this.suites.findRun(job => job.batch?.id === batch!.id && !job.batch.diagnostic);
      if (!prior) await this.boundary.checkout(batch.candidate);
      const run = prior ?? await this.suites.start({ mode: 'all', cwd: batch.candidate.cwd, topic: 'agents', to: [],
        actor: null, occasion: 'batch', batch: { id: batch.id, members: batch.members, waiting: this.boundary.entries().length }, ...(batch.planFrom ? { batchPlanFrom: batch.planFrom } : {}), priority: 0, fresh: true }, () => {});
      if (!('id' in run)) throw new Error('batch needs an admitted suite');
      batch.run = run.id; this.#save(batch);
    }
    const job = this.suites.findRun(job => job.id === batch!.run);
    if (!job?.reported || !job.outcome || this.#closed) return;
    if (job.tree !== batch.candidate.tree || job.head !== batch.candidate.head) throw new Error('batch suite does not match its prepared candidate');
    const evidence = await this.suites.receipt(job.id);
    const requiredSteps: VerificationStep['name'][] = evidence.job.commands?.check === '' ? [] : ['check'];
    if (evidence.job.commands?.plan?.some(step => step.name === 'Web')) requiredSteps.push('Web');
    const original = diagnosticResult(evidence.job, evidence.log, requiredSteps);
    if (batch.reportedRun !== job.id) {
      const tiers = job.selection?.tiers?.join(', ') || 'unavailable';
      const steps = verificationStepResults(evidence.log, evidence.job).map(step => `${verificationStepLabel(step.name)}: exit ${step.code}; duration ${step.seconds} s${step.superseded ? ' (superseded aborted attempt)' : ''}`);
      const log = this.store.resolveArtifact(evidence.job.artifact ?? '');
      const baseline = evidence.job.selection?.loadGateBaseline;
      const runs = evidence.job.batchBaselineRuns;
      const baselines = runs ? Object.entries(runs).map(([tier, run]) => `${tier}=${run ?? 'none'}`).join(', ') : `legacy=${baseline?.run ?? 'unavailable'}`;
      const repeated = loadGateCompletionSummary(evidence.log);
      steps.unshift(batchT1Summary(evidence.job.batchT1));
      const t1Coverage = evidence.job.batchT1?.skipped ? 'exact-head member verifies' : evidence.job.selection?.tiers?.includes('T1') ? 'batch runtime' : 'not configured';
      if (evidence.job.selection?.tiers?.includes('T3')) steps.unshift(evidence.job.selection.batchTests?.T3
        ? `T3 affected importers: ${evidence.job.selection.batchTests.T3.length} files; T1 coverage: ${t1Coverage}; remaining T3 deferred to integrated occasions`
        : 'T3 full selection');
      this.boundary.report(batch, `batch ${batch.id}: ${batch.members.map(e => e.item).join(', ')}; tree ${batch.candidate.tree}; tiers ${tiers}; wall ${job.runMs == null ? 'unavailable' : job.runMs + ' ms'}; exit ${job.outcome.code}; batch interaction ${JSON.stringify(batchInteractionSummary(evidence.job.selection?.batchInteraction))}; load gate baselines ${baselines}; repeated identities ${repeated.unknown ? 'unknown' : repeated.complete} (confirmed complete ${repeated.complete}; completion unknown ${repeated.unknown}); log ${log?.id ?? 'unavailable'}: ${log?.path ?? 'unavailable'}\n${steps.join('\n')}\n${batch.candidate.budgetLines.join('\n')}`);
      if (batch.confirmation) this.boundary.report(batch,
        `Diagnosis confirmation of ${batch.confirmation.original}: skipped files (no execution receipt): ${skippedFilesText(batch.confirmation.skipped)}; covering run ${job.id}; tree ${job.tree}; exit ${job.outcome.code}; ${original.result === 'green' ? 'full plan green' : original.result}\n${failureText(batchFailures(evidence.log, evidence.job))}`, 'confirmation');
      batch.reportedRun = job.id; this.#save(batch);
    }
    if (original.result === 'inconclusive') {
      const artifact = this.store.resolveArtifact(evidence.job.artifact!);
      if (!artifact) throw new Error('original batch log artifact unavailable');
      const receipt = { run: job.id, tree: job.tree, log: { artifact: artifact.id, path: artifact.path },
        seconds: job.runMs == null ? null : job.runMs / 1000, costUsd: evidence.job.machine?.costUsd ?? null, ...original };
      this.#hold(batch, `original ${job.id} inconclusive: ${original.reason}`,
        `Original run ${job.id}; tree ${job.tree}; seconds ${receipt.seconds ?? 'unavailable'}; cost ${receipt.costUsd == null ? 'pending confirmation' : '$' + receipt.costUsd.toFixed(4)}; log ${artifact.id}: ${artifact.path}`,
        { event: 'merge-batch-inconclusive', receipt });
      return;
    }
    let candidate: BatchCandidate | undefined = batch.candidate;
    if (!greenWithReceipt(job, this.clock.now().getTime())) {
      if (batch.members.length === 1) {
        this.boundary.drop(batch.members[0]!, `merge-bisected: ${failureText(batchFailures(evidence.log, evidence.job))}`);
        await this.#cleanup(batch); this.#save(null); return;
      }
      candidate = await this.#diagnose(batch);
      if (!candidate) return;
      // Diagnostics select a tree, never prove its complete selection. This
      // also covers legacy logs without interruption/completion receipts.
      {
        const progress = suiteProgress(evidence.log, 0, { fileEnvelopes: true });
        const observed = new Set([...(progress?.completed ?? []), ...(progress?.unfinished ?? [])].map(row => row.file));
        for (const identity of batchFailures(evidence.log, evidence.job).failures) observed.add(identity.split('::')[0]!);
        // Only the admitted package planner's retained file list establishes
        // inventory. Empty/absent plans cannot enumerate custom test commands.
        const selected = evidence.job.tierPlan?.flatMap(row => row.files);
        const skipped = selected?.length ? [...new Set(selected)].filter(file => !observed.has(file)).sort() : null;
        this.boundary.report(batch, `Diagnosis selected tree ${candidate.tree}; skipped files (no execution receipt): ${skippedFilesText(skipped)}; original ${job.id}; pinned full-plan confirmation pending`, 'confirmation');
        await this.#cleanup(batch);
        const members = batch.members.filter(entry => !batch!.diagnosis!.excluded?.includes(entry.item));
        this.#save({ id: randomUUID(), members, candidate, planFrom: batch.run,
          confirmation: { original: job.id, skipped } });
        return;
      }
    }
    for (let index = 0; index < batch.members.length; index++) {
      const entry = batch.members[index]!;
      if (batch.completed?.includes(entry.item) || batch.diagnosis?.excluded?.includes(entry.item) || this.boundary.isLanded(entry)) continue;
      const remaining = batch.members.slice(index).filter(e => !batch!.diagnosis?.excluded?.includes(e.item) && !this.boundary.isLanded(e));
      const current = await this.boundary.build(batch.id, remaining);
      if (this.#closed) return;
      const rebuild = current.tree !== candidate.tree ? await this.boundary.rebuildReason(candidate, current, evidence.job) : null;
      if (this.#closed) return;
      if (rebuild) {
        this.boundary.report(batch, `batch ${batch.id} rebuild: ${rebuild}`, 'rebuild');
        await this.#cleanup(batch);
        batch = { id: randomUUID(), members: remaining, candidate: current,
          ...(batch.planFrom ? { planFrom: batch.planFrom } : {}),
          ...(batch.confirmation ? { confirmation: batch.confirmation } : {}) };
        this.#save(batch); return;
      }
      let followUp: string | undefined;
      try { await this.boundary.land(entry, current); }
      catch (error) {
        // The durable close + merge receipt is authoritative even when a
        // later follow-up (for example stopping sessions) failed.
        if (this.boundary.isLanded(entry)) {
          followUp = error instanceof Error ? error.message : String(error);
        } else {
          if (error instanceof MergeError && ['merge-recovery', 'merge-git', 'merge-unpublished', 'merge-checkout', 'merge-dirty'].includes(error.code)) throw new RetryLanding(error.message);
          throw error;
        }
      }
      delete batch.failed; delete batch.retryLanding;
      this.store.transaction(() => {
        (batch!.completed ??= []).push(entry.item); this.#save(batch);
        if (followUp !== undefined) {
          const pending = this.#pendingFollowUps();
          pending.push({ batch: structuredClone(batch!), item: entry.item, error: followUp });
          this.store.setMeta('merge-follow-up-reports', JSON.stringify(pending));
        }
      });
    }
    this.#reportFollowUps();
    await this.#cleanup(batch);
    this.#save(null);
  }
  #pendingFollowUps(): FollowUpReport[] {
    return JSON.parse(this.store.meta('merge-follow-up-reports') ?? '[]') as FollowUpReport[];
  }
  #reportFollowUps(): void {
    const pending = this.#pendingFollowUps();
    for (const report of [...pending]) {
      try {
        this.boundary.report(report.batch, `${report.item}: ${report.error}\nLanding is complete; repair the named follow-up with cland merge ${report.item}. The queue continues.`, `follow-up:${report.item}`);
        pending.splice(pending.indexOf(report), 1);
      } catch (error) {
        report.reportError = error instanceof Error ? error.message : String(error);
      }
      // The obligation survives candidate cleanup, batch replacement and reopen.
      // Dispatch notice ids make a replay after a crash idempotent.
      this.store.setMeta('merge-follow-up-reports', JSON.stringify(pending));
      if (pending.includes(report)) {
        try { this.boundary.log?.({ event: 'merge-follow-up-report-failed', batch: report.batch.id, item: report.item, reason: report.error, error: report.reportError }); }
        catch { /* a failed logger cannot hold landing or delivery retries */ }
      }
    }
  }
  async #cleanup(batch: MergeBatch, retiring = false): Promise<void> {
    const candidates = [batch.candidate, ...batch.diagnosis?.jobs.map(job => job.candidate) ?? []].filter((candidate): candidate is BatchCandidate => !!candidate);
    for (const candidate of new Map(candidates.map(c => [c.cwd, c])).values()) {
      if (this.cleanups().some(job => job.candidate.cwd === candidate.cwd)) continue;
      try { await this.boundary.cleanup(candidate); }
      catch (error) {
        if (error instanceof CandidateOwnershipUnavailable) {
          // Missing admission authority never grants deletion authority. Persist
          // the preservation receipt before retiring this batch, including on upgrade.
          this.store.setMeta(`merge-batch-preserved-candidate:${candidate.cwd}`, JSON.stringify({
            batch: batch.id, cwd: candidate.cwd, head: candidate.head, tree: candidate.tree,
            cause: error.code, reason: error.message,
          }));
          continue;
        }
        // Only durable terminal receipts let cleanup become ancillary work.
        // An idle cancelled/replaced request retires its batch independently of
        // cleanup. The guarded obligation retains the root and original authority.
        if (!retiring && !batch.members.every(entry => batch.completed?.includes(entry.item) || batch.diagnosis?.excluded?.includes(entry.item) || this.boundary.isLanded(entry))) throw error;
        const compact = { ...candidate, budgetLines: [] };
        const job: BatchCleanup = { batch: { id: batch.id, members: batch.members, ...(batch.run ? { run: batch.run } : {}) }, candidate: compact, error: cleanupError(error), attempts: 1,
          retryAt: new Date(this.clock.now().getTime() + 1000).toISOString() };
        const worstCase = { ...job, error: 'x'.repeat(2048), attempts: Number.MAX_SAFE_INTEGER, reported: true, cleaned: true };
        if (this.cleanups().length >= CLEANUP_LIMIT || Buffer.byteLength(JSON.stringify(worstCase)) > CLEANUP_RECORD_BYTES - 2) {
          // The checkout's durable ownership marker remains at the root; no
          // unowned deletion or successful cleanup receipt is inferred here.
          this.#retainOverflowNotices(batch, candidate, job.error);
          this.#changed();
          continue;
        }
        this.#saveCleanups([...this.cleanups(), job]);
        this.#reportCleanup(job);
      }
    }
  }
  #reportCleanup(job: BatchCleanup): void {
    if (job.reported) return;
    try {
      this.boundary.report(job.batch, `batch ${job.batch.id} cleanup follow-up: ${job.candidate.cwd}: ${job.error}\nLanding outcomes are retained. Repair: automatic retry of guarded candidate cleanup on later ticks (backoff capped at 60 s); resolve the process inspection failure. The queue continues.`, `cleanup:${job.candidate.owner?.id ?? job.candidate.cwd}`);
      job.reported = true;
    } catch (error) { this.#secondary(error); /* durable obligation retries notice delivery as well */ }
    this.#saveCleanups(this.cleanups().map(current => current.candidate.cwd === job.candidate.cwd ? job : current));
  }
  #secondary(error: unknown): void {
    const diagnostic = cleanupError(error);
    try { this.store.setMeta('merge-batch-publication-error', diagnostic); } catch { /* storage outcome remains incomplete */ }
    try { this.boundary.log?.({ event: 'merge-cleanup-secondary-failure', error: diagnostic }); } catch { /* ancillary observer */ }
  }
  #retainOverflowNotices(batch: MergeBatch, candidate: BatchCandidate, error: string): void {
    const identity = createHash('sha256').update(`${batch.id}\0${candidate.cwd}\0${candidate.head}\0${candidate.tree}`).digest('hex');
    const text = `UNRESOLVED cleanup overflow: ${candidate.cwd}: ${error}\n${candidate.owner ? 'Ownership marker retained' : 'Ownership receipt unavailable; root preserved'}; automatic retry capacity is full. This root is not cleaned and is not auto-retried. Resolve the inspection failure; inspect the named candidate. The queue continues.`;
    // One item per record keeps recipients and rendering bounded independently
    // of batch size; stable keys/notice ids make replay after a crash idempotent.
    this.store.transaction(() => {
    const counted = `merge-cleanup-overflow-counted:${identity}`;
    if (!this.store.meta(counted)) {
      const overflow = this.cleanupOverflow();
      overflow.count++; overflow.oldestPath ??= candidate.cwd;
      this.store.setMeta('merge-batch-cleanup-overflow', JSON.stringify(overflow));
      this.store.setMeta(counted, '1');
    }
    for (const entry of batch.members) {
      const key = `merge-cleanup-notice:${identity}:${entry.item}`;
      if (this.store.meta(key)) continue;
      const member: MergeQueueEntry = { item: entry.item, head: entry.head, branch: '', verdictBase: '', enqueued: '', by: { id: entry.by.id, name: '', role: null } };
      const notice: CleanupNotice = { batch: { id: batch.id, members: [member], ...(batch.run ? { run: batch.run } : {}) }, text, phase: `cleanup:overflow:${identity}:${entry.item}` };
      const encoded = JSON.stringify(notice);
      if (Buffer.byteLength(encoded) > 65536) throw new Error('overflow notice exceeds 64 KiB; terminal batch retained for diagnosis');
      this.store.setMeta(key, encoded);
    }
    });
  }
  #reportOverflowNotices(): void {
    if (!this.#noticeBudget) return;
    this.#noticeBudget--;
    const prefix = 'merge-cleanup-notice:';
    const after = this.store.meta('merge-cleanup-notice-cursor') ?? '';
    const page = this.store.metaPage(prefix, after, 1, 65536);
    const row = page[0] ?? this.store.metaPage(prefix, '', 1, 65536)[0];
    if (!row) return;
    this.store.setMeta('merge-cleanup-notice-cursor', row.key);
    if (row.oversized) { this.#secondary('oversized overflow notice retained without decoding'); return; }
    try {
      const notice = JSON.parse(row.value) as CleanupNotice;
      this.boundary.report(notice.batch, notice.text, notice.phase);
      this.store.clearMeta(row.key); // Successful report means durable publication at the boundary.
    } catch (error) { this.#secondary(error); }
  }
  async #retryCleanups(): Promise<void> {
    if (!this.#cleanupBudget) return;
    this.#cleanupBudget--;
    // At most one native cleanup and one diagnostic delivery per tick. A
    // failed backlog cannot serially delay the next batch by 32 probes.
    const pending = this.cleanups();
    const selected = pending.find(job => job.cleaned || Date.parse(job.retryAt) <= this.clock.now().getTime()) ?? pending.find(job => !job.reported);
    for (const job of selected ? [selected] : []) {
      if (this.#closed) return;
      this.#reportCleanup(job);
      if (job.cleaned) {
        if (job.reported) this.#saveCleanups(this.cleanups().filter(current => current.candidate.cwd !== job.candidate.cwd));
        continue;
      }
      if (Date.parse(job.retryAt) > this.clock.now().getTime()) continue;
      try {
        await this.boundary.cleanup(job.candidate);
        job.cleaned = true;
        this.#saveCleanups(this.cleanups().flatMap(current => current.candidate.cwd !== job.candidate.cwd ? [current] : job.reported ? [] : [job]));
      } catch (error) {
        job.error = cleanupError(error);
        job.attempts++;
        job.retryAt = new Date(this.clock.now().getTime() + Math.min(60_000, 1000 * 2 ** Math.min(job.attempts - 1, 6))).toISOString();
        this.#saveCleanups(this.cleanups().map(current => current.candidate.cwd === job.candidate.cwd ? job : current));
      }
    }
  }
  async #diagnose(batch: MergeBatch): Promise<BatchCandidate | undefined> {
    if (!batch.diagnosis) {
      const { job, log } = await this.suites.receipt(batch.run!);
      const { failures, budgetLines, steps } = batchFailures(log, job);
      if (!failures.length) { batch.failed = `suite ${batch.run} failed without identifiable test files`; this.#save(batch); return; }
      const artifact = this.store.resolveArtifact(job.artifact!);
      if (!artifact) throw new Error('batch failure log artifact unavailable');
      batch.diagnosis = { failure: { run: job.id, tree: batch.candidate!.tree, log: { artifact: artifact.id, path: artifact.path } },
        failures, budgetLines, files: [...new Set(failures.filter(identity => !steps.some(step => verificationStepLabel(step) === identity)
          && !(steps.includes('Web') && identity.startsWith('web/'))).map(identity => identity.split('::')[0]!))], ...(steps.length ? { steps } : {}), jobs: [] };
      this.#save(batch);
    }
    const diagnosis = batch.diagnosis;
    for (let index = 0; index < batch.members.length; index++) {
      let job = diagnosis.jobs[index];
      if (!job) {
        const omitted = batch.members[index]!.item;
        const key = `omit-${index}`;
        try {
          job = { key, omitted, candidate: await this.boundary.build(`${batch.id}-${key}`, batch.members.filter(e => e.item !== omitted), batch.candidate!.base) };
        } catch (error) {
          if (error instanceof BatchRefusal) throw error;
          this.#hold(batch, `diagnostic candidate omitting ${omitted}: ${error instanceof Error ? error.message : String(error)}`,
            `Original run ${batch.run}; tree ${batch.candidate!.tree}; failure log ${diagnosis.failure.log.artifact}: ${diagnosis.failure.log.path}`,
            { event: 'merge-diagnostic-preparation-failed', omitted });
          return;
        }
        diagnosis.jobs.push(job); this.#save(batch);
      }
      if (!await this.#fileJob(batch, job)) return;
    }
    const greens = diagnosis.jobs.filter(job => job.omitted && job.result === 'green');
    if (greens.length !== 1) {
      let repeat = diagnosis.jobs[batch.members.length];
      if (!repeat) { repeat = { key: 'repeat', candidate: batch.candidate! }; diagnosis.jobs.push(repeat); this.#save(batch); }
      if (!await this.#fileJob(batch, repeat)) return;
      const testFailures = diagnosis.failures.filter(identity => !diagnosis.steps?.some(step => verificationStepLabel(step) === identity));
      if (repeat.result === 'green' && !testFailures.length) {
        diagnosis.selected = diagnosis.jobs.indexOf(repeat);
        if (!diagnosis.reported) {
          this.boundary.report(batch, `batch ${batch.id}: flaky failing files; selected tree ${repeat.candidate.tree}; full-plan confirmation required\n${this.#fileReport(diagnosis)}`);
          diagnosis.reported = true; this.#save(batch);
        }
        return repeat.candidate;
      }
      diagnosis.unresolved = true; this.#save(batch); await this.#unresolved(batch); return;
    }
    const green = greens[0]!;
    diagnosis.selected = diagnosis.jobs.indexOf(green); diagnosis.excluded = [green.omitted!]; this.#save(batch);
    const culprit = batch.members.find(entry => entry.item === green.omitted)!;
    if (this.boundary.entries().some(entry => entry.item === culprit.item)) this.boundary.drop(culprit, `merge-bisected: ${failureText(diagnosis)}`);
    if (!diagnosis.reported) {
      this.boundary.report(batch, `batch ${batch.id}: merge-bisected ${culprit.item}\n${this.#fileReport(diagnosis)}`);
      diagnosis.reported = true; this.#save(batch);
    }
    return green.candidate;
  }
  async #unresolved(batch: MergeBatch): Promise<void> {
    const diagnosis = batch.diagnosis!;
    const text = `batch ${batch.id}: merge-bisect-unresolved: ${failureText(diagnosis)}\nBatch run ${batch.run}; tree ${batch.candidate!.tree}\n${this.#fileReport(diagnosis)}`;
    this.store.transaction(() => {
      for (const entry of batch.members) if (this.boundary.entries().some(current => current.item === entry.item)) this.boundary.drop(entry, `merge-bisect-unresolved: ${failureText(diagnosis)}`);
      if (!diagnosis.reported) {
        this.boundary.report(batch, text);
        this.boundary.notice({ id: `merge-bisect-unresolved:${batch.id}`, kind: 'report', to: ['coordinator'], text,
          detail: { event: 'merge-bisect-unresolved', batch: batch.id, run: batch.run, diagnosis } });
        diagnosis.reported = true;
      }
      this.#save(batch);
    });
    await this.#cleanup(batch, true); this.#save(null);
  }
  #fileReport(diagnosis: BatchDiagnosis): string {
    return (diagnosis.budgetLines?.length ? diagnosis.budgetLines.join('\n') + '\n' : '')
      + `Failure log ${diagnosis.failure.log.artifact}: ${diagnosis.failure.log.path}\n`
      + diagnosis.jobs.map(job => `file job ${job.run}: ${diagnosis.files.join(', ')}; tree ${job.candidate.tree}; seconds ${job.seconds ?? 'unavailable'}; cost ${job.costUsd == null ? 'pending confirmation' : '$' + job.costUsd.toFixed(4)}; log ${job.log?.artifact ?? 'unavailable'}: ${job.log?.path ?? 'unavailable'}; ${job.result ?? 'pending'}${job.reason ? ': ' + job.reason : ''}`).join('\n');
  }
  #holdDiagnostic(batch: MergeBatch, job: FileJob): void {
    this.#hold(batch, `diagnostic ${job.run} inconclusive: ${job.reason}`, this.#fileReport(batch.diagnosis!),
      { event: 'merge-diagnostic-inconclusive', diagnosis: batch.diagnosis });
  }
  #hold(batch: MergeBatch, reason: string, evidence: string, detail: Record<string, unknown>): void {
    this.store.transaction(() => {
      batch.failed = reason;
      const text = `batch ${batch.id} held: ${reason}\nCoordinator: diagnose the held batch before recovering it; no member has been blamed or refused.\n${recoveryText(batch)}\n${evidence}`;
      this.boundary.notice({ id: `merge-inconclusive:${batch.id}`, kind: 'report', to: ['coordinator'], text, detail: { ...detail, batch: batch.id } });
      this.boundary.report(batch, text); this.#save(batch);
    });
  }
  async #fileJob(batch: MergeBatch, job: FileJob): Promise<boolean> {
    if (job.result === 'inconclusive') { this.#holdDiagnostic(batch, job); return false; }
    if (job.result) return true;
    if (!job.run) {
      const prior = this.suites.findRun(run => run.batch?.id === batch.id && run.batch.diagnostic?.key === job.key);
      if (!prior) await this.boundary.checkout(job.candidate);
      if (this.#closed) return false;
      const run = prior ?? await this.suites.start({ mode: 'all', cwd: job.candidate.cwd, topic: 'agents', to: [], actor: null,
        batch: { id: batch.id, members: batch.members, diagnostic: { key: job.key, files: batch.diagnosis!.files, ...(batch.diagnosis!.steps ? { steps: batch.diagnosis!.steps } : {}) } }, priority: 0, fresh: true }, () => {}).catch(async error => {
          if (error instanceof ShardManifestError && job.omitted) {
            for (const file of error.files.filter(file => batch.diagnosis!.files.includes(file))) {
              try { await stat(join(job.candidate.cwd, file)); }
              catch (missing) {
                if ((missing as NodeJS.ErrnoException).code !== 'ENOENT') throw missing;
                const member = batch.members.find(entry => entry.item === job.omitted)!;
                throw new BatchRefusal(member, `merge-bisected: failing file ${file} is absent when omitting ${member.item}`);
              }
            }
          }
          throw error;
        });
      if (!('id' in run)) throw new Error('file job needs an admitted suite');
      job.run = run.id; this.#save(batch);
    }
    const status = this.suites.findRun(run => run.id === job.run);
    if (!status?.reported || this.#closed) return false;
    const { job: receipt, log } = await this.suites.receipt(job.run);
    if (receipt.tree !== job.candidate.tree || receipt.head !== job.candidate.head) throw new Error('file job does not match its prepared candidate');
    Object.assign(job, diagnosticResult(receipt, log, batch.diagnosis!.steps));
    job.seconds = receipt.runMs == null ? null : receipt.runMs / 1000; job.costUsd = receipt.machine?.costUsd ?? null;
    const artifact = this.store.resolveArtifact(receipt.artifact!);
    if (!artifact) throw new Error('file job log artifact unavailable');
    job.log = { artifact: artifact.id, path: artifact.path };
    this.#save(batch);
    if (job.result === 'inconclusive') { this.#holdDiagnostic(batch, job); return false; }
    return true;
  }
  async close(): Promise<void> {
    this.#closed = true;
    this.clock.clearInterval(this.#timer); this.#timer = null;
    await this.#work;
  }
}
