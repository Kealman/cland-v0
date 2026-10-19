// Durable merge-batch policy; Git preparation and landing are owned by the territory boundary.
import { randomUUID } from 'node:crypto';
import type { MergeQueueEntry } from '../protocol.ts';
import type { Store } from './store.ts';
import type { Clock, ClockTimer } from './clock.ts';
import type { Suites } from './suites.ts';

export type BatchCandidate = { base: string; head: string; tree: string; cwd: string; budgetLines: string[] };
export type MergeBatch = { id: string; members: MergeQueueEntry[]; candidate?: BatchCandidate; run?: string; failed?: string; completed?: string[]; reportedRun?: string };
export type BatchBoundary = {
  changed?(): void;
  entries(): MergeQueueEntry[];
  build(id: string, members: MergeQueueEntry[]): Promise<BatchCandidate>;
  land(entry: MergeQueueEntry, candidate: BatchCandidate): Promise<void>;
  drop(entry: MergeQueueEntry, reason: string): void;
  cleanup(candidate: BatchCandidate): Promise<void>;
  checkout(candidate: BatchCandidate): Promise<void>;
  isLanded(entry: MergeQueueEntry): boolean;
  report(batch: MergeBatch, text: string): void;
};
export class BatchRebuild extends Error {}

export class BatchRefusal extends Error {
  readonly entry: MergeQueueEntry;
  readonly reason: string;
  constructor(entry: MergeQueueEntry, reason: string) { super(reason); this.entry = entry; this.reason = reason; }
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
        this.#save(batch); this.boundary.report(batch, `batch ${batch.id} blocked: ${batch.failed}`);
      }
    }).finally(() => { this.#work = null; });
  }
  async #advance(): Promise<void> {
    for (;;) {
      try { await this.#tick(); return; }
      catch (error) {
        const batch = this.snapshot();
        if (!(error instanceof BatchRefusal || error instanceof BatchRebuild) || !batch) throw error;
        if (error instanceof BatchRefusal) this.boundary.drop(error.entry, error.reason);
        if (batch.candidate) await this.boundary.cleanup(batch.candidate);
        const members = batch.members.filter(entry => (!(error instanceof BatchRefusal) || entry.item !== error.entry.item) && !batch.completed?.includes(entry.item) && !this.boundary.isLanded(entry));
        this.#save(members.length ? { id: randomUUID(), members } : null);
        if (!members.length) return;
      }
    }
  }
  async #tick(): Promise<void> {
    const settings = this.settings();
    if (!settings.queue || this.#closed) return;
    let batch = this.snapshot();
    if (!batch) {
      const entries = this.boundary.entries().slice(0, settings.batch);
      if (!entries.length || entries.length < settings.batch && this.clock.now().getTime() - Date.parse(entries[0]!.enqueued) < settings.batchWaitMs) return;
      batch = { id: randomUUID(), members: entries };
      this.#save(batch);
    }
    const admitted = this.suites.status().find(job => job.id === batch!.run || job.batch?.id === batch!.id);
    if (admitted && !batch.run) { batch.run = admitted.id; this.#save(batch); }
    // A cancellation cannot replace the candidate checkout under a live worker.
    if (admitted && !admitted.reported) return;
    for (const entry of batch.members) {
      if (batch.completed?.includes(entry.item) || this.boundary.isLanded(entry)) continue;
      if (!this.boundary.entries().some(current => current.item === entry.item && current.head === entry.head && current.enqueued === entry.enqueued)) throw new BatchRefusal(entry, 'queued request changed or cancelled');
    }
    if (batch.failed) return;
    if (!batch.candidate) {
      batch.candidate = await this.boundary.build(batch.id, batch.members);
      this.#save(batch);
    }
    if (this.#closed) return;
    if (!batch.run) {
      // The durable batch id binds a crash between Suites admission and this checkpoint.
      const prior = this.suites.status().find(job => job.batch?.id === batch!.id);
      if (!prior) await this.boundary.checkout(batch.candidate);
      const run = prior ?? await this.suites.start({ mode: 'all', cwd: batch.candidate.cwd, topic: 'agents', to: [],
        actor: null, occasion: 'batch', batch: { id: batch.id, members: batch.members }, priority: 0, fresh: true }, () => {});
      if (!('id' in run)) throw new Error('batch needs an admitted suite');
      batch.run = run.id; this.#save(batch);
    }
    const job = this.suites.status().find(job => job.id === batch!.run);
    if (!job?.reported || !job.outcome || this.#closed) return;
    if (job.tree !== batch.candidate.tree || job.head !== batch.candidate.head) throw new Error('batch suite does not match its prepared candidate');
    if (batch.reportedRun !== job.id) {
      this.boundary.report(batch, `batch ${batch.id}: ${batch.members.map(e => e.item).join(', ')}; tree ${batch.candidate.tree}; tiers T1, T3; wall ${job.runMs ?? 0} ms; exit ${job.outcome.code}\n${batch.candidate.budgetLines.join('\n')}`);
      batch.reportedRun = job.id; this.#save(batch);
    }
    if (job.outcome.code !== 0) { batch.failed = `suite ${job.id} failed`; this.#save(batch); return; }
    for (let index = 0; index < batch.members.length; index++) {
      const entry = batch.members[index]!;
      if (batch.completed?.includes(entry.item) || this.boundary.isLanded(entry)) continue;
      const remaining = batch.members.slice(index).filter(e => !this.boundary.isLanded(e));
      const current = await this.boundary.build(batch.id, remaining);
      if (this.#closed) return;
      if (current.tree !== batch.candidate.tree) {
        await this.boundary.cleanup(batch.candidate);
        batch = { id: randomUUID(), members: remaining, candidate: current };
        this.#save(batch); return;
      }
      await this.boundary.land(entry, current);
      (batch.completed ??= []).push(entry.item); this.#save(batch);
    }
    await this.boundary.cleanup(batch.candidate);
    this.#save(null);
  }
  async close(): Promise<void> {
    this.#closed = true;
    this.clock.clearInterval(this.#timer); this.#timer = null;
    await this.#work;
  }
}
