// Durable merge-batch policy; Git preparation and landing are owned by the territory boundary.
import { randomUUID } from 'node:crypto';
import type { MergeQueueEntry } from '../protocol.ts';
import type { Store } from './store.ts';
import type { Clock, ClockTimer } from './clock.ts';
import type { Suites, SuiteJob } from './suites.ts';
import { failingTests } from './shared-defects.ts';
import type { TopicNotice } from './core.ts';
import { recordBatchFlakes } from './batch-flakes.ts';
import { verificationStepLabel, verificationStepResults, type VerificationStep } from '../verification-plan.ts';
import { MergeError } from '../merge.ts';
import type { LogFn } from '../log.ts';

export type BatchCandidate = { base: string; head: string; tree: string; cwd: string; budgetLines: string[] };
type DiagnosticResult = { result: 'green' | 'red' | 'inconclusive'; reason?: string };
export type FileJob = { key: string; omitted?: string; candidate: BatchCandidate; run?: string; result?: DiagnosticResult['result']; reason?: string; seconds?: number | null; costUsd?: number | null; log?: { artifact: string; path: string } };
export type BatchDiagnosis = { failure: { run: string; tree: string; log: { artifact: string; path: string } }; failures: string[]; budgetLines?: string[]; files: string[]; steps?: VerificationStep['name'][]; jobs: FileJob[]; selected?: number; excluded?: string[]; reported?: boolean; unresolved?: boolean };
export type MergeBatch = { id: string; members: MergeQueueEntry[]; candidate?: BatchCandidate; run?: string; planFrom?: string; failed?: string; reportError?: string; retryLanding?: boolean; completed?: string[]; reportedRun?: string; diagnosis?: BatchDiagnosis };
type FollowUpReport = { batch: MergeBatch; item: string; error: string; reportError?: string };
export type BatchBoundary = {
  log?: LogFn;
  changed?(): void;
  entries(): MergeQueueEntry[];
  build(id: string, members: MergeQueueEntry[], base?: string): Promise<BatchCandidate>;
  rebuildReason(tested: BatchCandidate, current: BatchCandidate): Promise<string | null>;
  land(entry: MergeQueueEntry, candidate: BatchCandidate): Promise<void>;
  drop(entry: MergeQueueEntry, reason: string): void;
  cleanup(candidate: BatchCandidate): Promise<void>;
  checkout(candidate: BatchCandidate): Promise<void>;
  isLanded(entry: MergeQueueEntry): boolean;
  report(batch: MergeBatch, text: string, phase?: 'rebuild' | `follow-up:${string}`): void;
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
function batchFailures(log: string): { failures: string[]; budgetLines: string[]; steps: VerificationStep['name'][] } {
  const failures = new Set(failingTests(log));
  const steps = [...new Set(verificationStepResults(log).filter(step => (step.name === 'check' || step.name === 'Web') && step.code !== 0).map(step => step.name))];
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
export function diagnosticResult(job: Pick<SuiteJob, 'state' | 'outcome' | 'cancelled' | 'requesterDied' | 'timedOut' | 'cached'>, log: string, steps: VerificationStep['name'][] = []): DiagnosticResult {
  const results = verificationStepResults(log);
  if (job.cancelled || job.requesterDied || job.timedOut || job.cached || job.state !== 'finished' || !job.outcome
    || !Number.isInteger(job.outcome.code) || [124, 130, 137, 143].includes(job.outcome.code)
    || results.some(step => [124, 130, 137, 143].includes(step.code))
    || /cancelled|abandon|unknown|remote machine lost|worker disappeared|without an exit receipt|lifetime expired/i.test(job.outcome?.cause ?? '')) {
    return { result: 'inconclusive', reason: job.outcome?.cause || 'aborted or unavailable worker result' };
  }
  if (job.outcome.code === 0) return steps.every(name => results.some(step => step.name === name && step.code === 0) && !results.some(step => step.name === name && step.code !== 0))
    ? { result: 'green' } : { result: 'inconclusive', reason: 'missing passing step receipt' };
  try { if (batchFailures(log).failures.length) return { result: 'red' }; } catch { /* malformed evidence is inconclusive */ }
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
  start(): void {
    if (this.#timer || this.#closed) return;
    this.#timer = this.clock.setInterval(() => { void this.tick(); }, 1000);
    this.#timer.unref(); void this.tick();
  }
  snapshot(): MergeBatch | null { return JSON.parse(this.store.meta('merge-batch') ?? 'null') as MergeBatch | null; }
  #save(batch: MergeBatch | null): void { this.store.setMeta('merge-batch', JSON.stringify(batch)); this.boundary.changed?.(); }
  tick(): Promise<void> {
    if (this.#closed) return Promise.resolve();
    return this.#work ??= this.#advance().catch(error => {
      const batch = this.snapshot();
      if (batch) {
        batch.failed = error instanceof Error ? error.message : String(error);
        batch.retryLanding = error instanceof RetryLanding;
        this.#save(batch);
        try { this.boundary.report(batch, `batch ${batch.id} blocked: ${batch.failed}\n${batch.retryLanding ? 'The queue retries automatically on a later tick once the cause is resolved.' : 'Waiting for human or Coordinator action before retrying.'}`); }
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
        if (!(error instanceof BatchRefusal || error instanceof BatchRebuild) || !batch) throw error;
        // Recheck the new base against the retained evidence on the next tick.
        // A base race alone does not invalidate a completed suite.
        if (error instanceof BatchRebuild) return;
        if (error instanceof BatchRefusal) this.boundary.drop(error.entry, error.reason);
        await this.#cleanup(batch);
        const members = batch.members.filter(entry => (!(error instanceof BatchRefusal) || entry.item !== error.entry.item) && !batch.diagnosis?.excluded?.includes(entry.item) && !batch.completed?.includes(entry.item) && !this.boundary.isLanded(entry));
        this.#save(members.length ? { id: randomUUID(), members } : null);
        if (!members.length) return;
      }
    }
  }
  async #tick(): Promise<void> {
    const settings = this.settings();
    if (this.#closed) return;
    this.#reportFollowUps();
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
        actor: null, occasion: 'batch', batch: { id: batch.id, members: batch.members }, ...(batch.planFrom ? { batchPlanFrom: batch.planFrom } : {}), priority: 0, fresh: true }, () => {});
      if (!('id' in run)) throw new Error('batch needs an admitted suite');
      batch.run = run.id; this.#save(batch);
    }
    const job = this.suites.findRun(job => job.id === batch!.run);
    if (!job?.reported || !job.outcome || this.#closed) return;
    if (job.tree !== batch.candidate.tree || job.head !== batch.candidate.head) throw new Error('batch suite does not match its prepared candidate');
    const evidence = await this.suites.receipt(job.id);
    if (batch.reportedRun !== job.id) {
      const tiers = job.selection?.tiers?.join(', ') || 'unavailable';
      const steps = verificationStepResults(evidence.log).map(step => `${verificationStepLabel(step.name)}: exit ${step.code}; duration ${step.seconds} s`);
      this.boundary.report(batch, `batch ${batch.id}: ${batch.members.map(e => e.item).join(', ')}; tree ${batch.candidate.tree}; tiers ${tiers}; wall ${job.runMs == null ? 'unavailable' : job.runMs + ' ms'}; exit ${job.outcome.code}\n${steps.join('\n')}\n${batch.candidate.budgetLines.join('\n')}`);
      batch.reportedRun = job.id; this.#save(batch);
    }
    const requiredSteps: VerificationStep['name'][] = evidence.job.commands?.check === '' ? [] : ['check'];
    if (evidence.job.commands?.plan?.some(step => step.name === 'Web')) requiredSteps.push('Web');
    const original = diagnosticResult(evidence.job, evidence.log, requiredSteps);
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
    if (job.outcome.code !== 0) {
      if (batch.members.length === 1) {
        this.boundary.drop(batch.members[0]!, `merge-bisected: ${failureText(batchFailures(evidence.log))}`);
        await this.#cleanup(batch); this.#save(null); return;
      }
      candidate = await this.#diagnose(batch);
      if (!candidate) return;
      // Step bisection and file-only recovery of a Web-containing plan select
      // a candidate; neither proves every command on that selected tree ran.
      if (batch.diagnosis?.steps?.length || requiredSteps.includes('Web')) {
        await this.#cleanup(batch);
        const members = batch.members.filter(entry => !batch!.diagnosis!.excluded?.includes(entry.item));
        this.#save({ id: randomUUID(), members, candidate, planFrom: batch.run });
        return;
      }
    }
    for (let index = 0; index < batch.members.length; index++) {
      const entry = batch.members[index]!;
      if (batch.completed?.includes(entry.item) || batch.diagnosis?.excluded?.includes(entry.item) || this.boundary.isLanded(entry)) continue;
      const remaining = batch.members.slice(index).filter(e => !batch!.diagnosis?.excluded?.includes(e.item) && !this.boundary.isLanded(e));
      const current = await this.boundary.build(batch.id, remaining);
      if (this.#closed) return;
      const rebuild = current.tree !== candidate.tree ? await this.boundary.rebuildReason(candidate, current) : null;
      if (this.#closed) return;
      if (rebuild) {
        this.boundary.report(batch, `batch ${batch.id} rebuild: ${rebuild}`, 'rebuild');
        await this.#cleanup(batch);
        batch = { id: randomUUID(), members: remaining, candidate: current };
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
  async #cleanup(batch: MergeBatch): Promise<void> {
    const candidates = [batch.candidate, ...batch.diagnosis?.jobs.map(job => job.candidate) ?? []].filter((candidate): candidate is BatchCandidate => !!candidate);
    for (const candidate of new Map(candidates.map(c => [c.cwd, c])).values()) await this.boundary.cleanup(candidate);
  }
  async #diagnose(batch: MergeBatch): Promise<BatchCandidate | undefined> {
    if (!batch.diagnosis) {
      const { job, log } = await this.suites.receipt(batch.run!);
      const { failures, budgetLines, steps } = batchFailures(log);
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
      if (repeat.result === 'green' && (!testFailures.length || recordBatchFlakes(this.store, batch.id, testFailures, await this.suites.receipt(batch.run!), await this.suites.receipt(repeat.run!), notice => this.boundary.notice(notice)))) {
        diagnosis.selected = diagnosis.jobs.indexOf(repeat);
        if (!diagnosis.reported) {
          this.boundary.report(batch, `batch ${batch.id}: flaky failing files; landing tree ${repeat.candidate.tree}\n${this.#fileReport(diagnosis)}`);
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
    await this.#cleanup(batch); this.#save(null);
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
      const text = `batch ${batch.id} held: ${reason}\nCoordinator: diagnose the held batch before recovering it; no member has been blamed or refused.\n${evidence}`;
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
        batch: { id: batch.id, members: batch.members, diagnostic: { key: job.key, files: batch.diagnosis!.files, ...(batch.diagnosis!.steps ? { steps: batch.diagnosis!.steps } : {}) } }, priority: 0, fresh: true }, () => {});
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
