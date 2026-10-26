import { randomUUID } from 'node:crypto';
import { realClock, type Clock } from '../hub/clock.ts';
import type { OutboxJob, OutboxAttempt, RemoteMessage, RemoteStore } from './state.ts';

/** Only the platform client can attest delivery; a thrown error is never proof. */
export type DeliveryResult = { status: 'sent'; message: RemoteMessage }
  | { status: 'never-left'; retryAfterMs?: number } | { status: 'unknown' };
export type OutboxClient = {
  send: (job: OutboxJob, attempt: OutboxAttempt) => Promise<DeliveryResult>;
  prove: (job: OutboxJob, attempt: OutboxAttempt) => Promise<DeliveryResult>;
  /** A successful exchange, never evidence about an earlier delivery. */
  reconnect?: (signal: AbortSignal) => Promise<boolean>;
};
export type OutboxInput = { kind: 'general' | 'card' | 'edit'; source: string | null; target?: string; payload: unknown };

/** One owner per remote, under the gateway's poller lease; no independent timer. */
export class Outbox {
  readonly #store: RemoteStore;
  readonly #client: OutboxClient;
  readonly #clock: Clock;
  readonly #random: () => number;
  readonly #stop = new AbortController();
  #draining: Promise<void> | undefined;
  #queueRevision = 0;
  #stopped = false;
  #wakeWait: (() => void) | undefined;
  readonly #sourceOpen: (job: OutboxJob) => boolean | Promise<boolean>;
  constructor(store: RemoteStore, client: OutboxClient, options: { clock?: Clock; random?: () => number; sourceOpen?: (job: OutboxJob) => boolean | Promise<boolean> } = {}) {
    this.#store = store; this.#client = client; this.#clock = options.clock ?? realClock;
    this.#random = options.random ?? Math.random;
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
      this.#queueRevision++;
      return previous.id;
    }
    const job = { ...input, id: randomUUID(), state: input.kind === 'general' && !this.#available() ? 'missed' : 'queued', created: at, updated: at };
    this.#store.putOutbox(job);
    this.#queueRevision++;
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
    if (this.#draining) return this.#draining;
    const owner = Promise.withResolvers<void>();
    this.#draining = owner.promise;
    void Promise.resolve().then(async () => {
      try {
        const visited = new Set<string>();
        for (;;) {
          const revision = this.#queueRevision;
          await this.#drain(visited);
          if (this.#stopped || revision === this.#queueRevision) break;
        }
        // Recheck arrivals and settle ownership in the same synchronous turn.
        this.#draining = undefined;
        owner.resolve();
      } catch (error) { this.#draining = undefined; owner.reject(error); }
    });
    return owner.promise;
  }
  async stop(): Promise<void> {
    this.#stopped = true;
    this.#stop.abort();
    this.#wakeWait?.();
    await this.#draining;
  }
  #wait(ms: number): Promise<void> {
    return new Promise(resolve => {
      const finish = () => { this.#clock.clearTimeout(timer); this.#wakeWait = undefined; resolve(); };
      const timer = this.#clock.setTimeout(finish, ms);
      timer.unref();
      this.#wakeWait = finish;
    });
  }
  async #delivery(run: () => Promise<DeliveryResult>): Promise<DeliveryResult> {
    try { return await run(); }
    catch { return { status: 'unknown' }; } // Never persist native errors or infer non-delivery.
  }
  #retryAfter(result: DeliveryResult): number | undefined {
    if (result.status !== 'never-left' || result.retryAfterMs === undefined
      || !Number.isFinite(result.retryAfterMs) || result.retryAfterMs < 0) return;
    return Math.max(1, Math.min(300_000, result.retryAfterMs));
  }
  async #drain(visited: Set<string>): Promise<void> {
    let backoff = 1000;
    while (!this.#stopped) {
      const next = this.#store.outbox().find(job => !visited.has(job.id) && ['queued', 'sending', 'uncertain'].includes(job.state));
      if (!next) {
        if (this.#available() || !this.#client.reconnect) break;
        // Equal jitter: half to all of an exponential window, capped at 30 s.
        await this.#wait(Math.round(backoff * (0.5 + this.#random() * 0.5)));
        if (this.#stopped) break;
        let connected = false;
        try { connected = await this.#client.reconnect(this.#stop.signal); }
        catch { /* Native reconnect errors may contain credentials. */ }
        if (this.#stopped) break;
        if (connected) { this.setAvailable(true); backoff = 1000; visited.clear(); }
        else backoff = Math.min(30_000, backoff * 2);
        continue;
      }
      let job = next;
      visited.add(job.id);
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
        const retryAfter = this.#retryAfter(proof);
        if (retryAfter !== undefined) {
          await this.#wait(retryAfter); visited.delete(job.id); continue;
        }
        if (job.kind !== 'general' && !await this.#sourceOpen(job)) {
          job.state = 'dropped'; job.updated = this.#clock.now().toISOString(); this.#store.putOutbox(job); continue;
        }
        if (this.#stopped) break;
      }
      const attempt: OutboxAttempt = { id: randomUUID(), job: job.id, at: this.#clock.now().toISOString(), outcome: null };
      job.state = 'sending';
      this.#store.writeOutbox(job, attempt);
      const result = await this.#delivery(() => this.#client.send(job, attempt));
      this.#settle(job, attempt, result);
      const retryAfter = this.#retryAfter(result);
      if (retryAfter !== undefined) {
        if (this.#stopped) break;
        await this.#wait(retryAfter);
        visited.delete(job.id);
        continue;
      }
      if (result.status !== 'sent') this.setAvailable(false);
    }
  }
  #settle(job: OutboxJob, attempt: OutboxAttempt, result: DeliveryResult): void {
    // A rate-limit refusal is positive non-delivery, not an offline General gap.
    job.state = result.status === 'sent' ? 'sent' : this.#retryAfter(result) !== undefined ? 'queued'
      : job.kind === 'general' ? 'missed' : result.status === 'never-left' ? 'queued' : 'uncertain';
    job.updated = this.#clock.now().toISOString();
    attempt.outcome = result.status;
    this.#store.writeOutbox(job, attempt, result.status === 'sent' ? result.message : undefined);
  }
}
