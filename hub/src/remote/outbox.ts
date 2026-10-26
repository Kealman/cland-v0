import { randomUUID } from 'node:crypto';
import { realClock, type Clock } from '../hub/clock.ts';
import type { OutboxJob, OutboxAttempt, RemoteMessage, RemoteStore } from './state.ts';

/** Only the platform client can attest delivery; a thrown error is never proof. */
export type DeliveryResult = { status: 'sent'; message: RemoteMessage }
  | { status: 'never-left' } | { status: 'unknown' };
export type OutboxClient = {
  send: (job: OutboxJob, attempt: OutboxAttempt) => Promise<DeliveryResult>;
  prove: (job: OutboxJob, attempt: OutboxAttempt) => Promise<DeliveryResult>;
};
export type OutboxInput = { kind: 'general' | 'card' | 'edit'; source: string | null; target?: string; payload: unknown };

/** One owner per remote, under the gateway's poller lease; no independent timer. */
export class Outbox {
  readonly #store: RemoteStore;
  readonly #client: OutboxClient;
  readonly #clock: Clock;
  #draining: Promise<void> | undefined;
  #stopped = false;
  readonly #sourceOpen: (job: OutboxJob) => boolean | Promise<boolean>;
  constructor(store: RemoteStore, client: OutboxClient, options: { clock?: Clock; sourceOpen?: (job: OutboxJob) => boolean | Promise<boolean> } = {}) {
    this.#store = store; this.#client = client; this.#clock = options.clock ?? realClock;
    this.#sourceOpen = options.sourceOpen ?? (() => true);
  }
  enqueue(input: OutboxInput): string {
    if (this.#stopped) throw new Error('outbox stopped');
    const at = this.#clock.now().toISOString();
    if (input.kind === 'edit' && !input.target) throw new Error('an outbox edit requires a target');
    const previous = this.#store.outbox().at(-1);
    if (input.kind === 'edit' && previous?.kind === 'edit' && previous.target === input.target
      && previous.source === input.source && previous.state === 'queued' && !this.#store.attempts(previous.id).length) {
      this.#store.putOutbox({ ...previous, payload: input.payload, updated: at });
      return previous.id;
    }
    const job = { ...input, id: randomUUID(), state: input.kind === 'general' && !this.#available() ? 'missed' : 'queued', created: at, updated: at };
    this.#store.putOutbox(job);
    return job.id;
  }
  #available(): boolean { return this.#store.get('outbox.unavailable') !== '1'; }
  setAvailable(available: boolean): void { this.#store.set('outbox.unavailable', available ? null : '1'); }
  missed(): { count: number; since: string | null } {
    const jobs = this.#store.outbox().filter(job => job.state === 'missed');
    return { count: jobs.length, since: jobs[0]?.created ?? null };
  }
  drain(): Promise<void> {
    if (this.#stopped) return Promise.reject(new Error('outbox stopped'));
    return this.#draining ??= Promise.resolve().then(() => this.#drain()).finally(() => { this.#draining = undefined; });
  }
  async stop(): Promise<void> {
    this.#stopped = true;
    await this.#draining;
  }
  async #delivery(run: () => Promise<DeliveryResult>): Promise<DeliveryResult> {
    try { return await run(); }
    catch { return { status: 'unknown' }; } // Never persist native errors or infer non-delivery.
  }
  async #drain(): Promise<void> {
    for (let job of this.#store.outbox().filter(job => ['queued', 'sending', 'uncertain'].includes(job.state))) {
      if (this.#stopped) break;
      if (job.kind !== 'general' && !await this.#sourceOpen(job)) {
        job.state = 'dropped'; job.updated = this.#clock.now().toISOString(); this.#store.putOutbox(job); continue;
      }
      if (this.#stopped) break;
      // A source check may yield while a queued edit is replaced; bind its latest intent.
      job = this.#store.outbox().find(row => row.id === job.id)!;
      if (!this.#available()) {
        if (job.kind === 'general') { job.state = 'missed'; job.updated = this.#clock.now().toISOString(); this.#store.putOutbox(job); }
        continue;
      }
      const previous = this.#store.attempts(job.id).at(-1);
      if (previous && previous.outcome !== 'never-left') {
        const proof = await this.#delivery(() => this.#client.prove(job, previous));
        this.#settle(job, previous, proof);
        if (proof.status !== 'never-left' || this.#stopped) continue;
        if (job.kind !== 'general' && !await this.#sourceOpen(job)) {
          job.state = 'dropped'; job.updated = this.#clock.now().toISOString(); this.#store.putOutbox(job); continue;
        }
        if (this.#stopped) break;
      }
      const attempt: OutboxAttempt = { id: randomUUID(), job: job.id, at: this.#clock.now().toISOString(), outcome: null };
      job.state = 'sending';
      this.#store.writeOutbox(job, attempt);
      const result = await this.#delivery(() => this.#client.send(job, attempt));
      if (result.status !== 'sent') this.setAvailable(false);
      this.#settle(job, attempt, result);
    }
  }
  #settle(job: OutboxJob, attempt: OutboxAttempt, result: DeliveryResult): void {
    job.state = result.status === 'sent' ? 'sent' : job.kind === 'general' ? 'missed' : result.status === 'never-left' ? 'queued' : 'uncertain';
    job.updated = this.#clock.now().toISOString();
    attempt.outcome = result.status;
    this.#store.writeOutbox(job, attempt, result.status === 'sent' ? result.message : undefined);
  }
}
