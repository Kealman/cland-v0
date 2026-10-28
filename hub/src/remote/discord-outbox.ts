import { Outbox, type DeliveryResult } from './outbox.ts';
import type { RemoteStore, OutboxJob, RemoteMessage } from './state.ts';
import type { DiscordApi, DiscordMessage } from './discord-api.ts';
import type { Clock } from '../hub/clock.ts';

type Intent = { discord: true; channel: string; user: string; content: string; mapping: Omit<RemoteMessage, 'messageId'> };
const intent = (job: OutboxJob) => job.payload as Intent;
const nonce = (job: OutboxJob) => job.id.replaceAll('-', '').slice(0, 25);
/** Per-channel owners over the neutral durable queue. Native receipts contain ids only. */
export class DiscordOutbox {
  readonly #lanes = new Map<string, Outbox>();
  readonly #store: RemoteStore; readonly #api: DiscordApi; readonly #clock: Clock; readonly #signal: AbortSignal;
  constructor(api: DiscordApi, store: RemoteStore, clock: Clock, signal: AbortSignal) {
    this.#api = api; this.#store = store; this.#clock = clock; this.#signal = signal;
  }
  async send(channel: string, content: string, source: string): Promise<void> {
    this.#signal.throwIfAborted();
    const lane = this.#lane(channel);
    if (!this.#store.outbox().some(j => j.source === source)) lane.enqueue({ kind: 'general', source,
      payload: { discord: true, channel, user: this.#store.pairing()?.userId, content,
        mapping: { chatId: channel, topic: 'general', message: source, ask: null, approval: null } } });
    await lane.drain();
  }
  observe(message: DiscordMessage): void {
    if (!message.nonce || !/^\d+$/.test(message.id)) return;
    const job = this.#store.outbox().find(j => intent(j)?.discord && intent(j).channel === message.channel_id && nonce(j) === message.nonce);
    if (job) this.#store.set(`discord.outbox.receipt:${job.id}`, message.id);
  }
  #lane(channel: string): Outbox {
    let lane = this.#lanes.get(channel);
    if (!lane) {
      lane = new Outbox(this.#store, {
        send: job => this.#deliver(job),
        prove: async job => {
          const id = this.#store.get(`discord.outbox.receipt:${job.id}`);
          if (id) return this.#receipt(job, id);
          // Discord promises only "the past few minutes"; use a conservative two-minute window.
          if (!this.#withinNonceWindow(job)) return { status: 'unknown' };
          // Let the neutral queue persist a distinct attempt before the recovery POST.
          return { status: 'never-left' };
        },
      }, { clock: this.#clock, accepts: job => intent(job)?.discord === true && intent(job).channel === channel,
        admit: job => { const pair = this.#store.pairing(); return pair?.chatId === channel && pair.userId === intent(job).user; } });
      this.#lanes.set(channel, lane);
    }
    return lane;
  }
  #receipt(job: OutboxJob, id: string): DeliveryResult { return { status: 'sent', message: { ...intent(job).mapping, messageId: id } }; }
  #withinNonceWindow(job: OutboxJob): boolean {
    const original = this.#store.attempts(job.id)[0];
    const age = original ? this.#clock.now().getTime() - Date.parse(original.at) : NaN;
    return Number.isFinite(age) && age >= 0 && age < 120_000;
  }
  async #deliver(job: OutboxJob): Promise<DeliveryResult> {
    this.#signal.throwIfAborted();
    // Recheck at I/O: a restart after prove or queue work must not renew the window.
    if (!this.#withinNonceWindow(job)) return { status: 'unknown' };
    const input = intent(job);
    const message = await this.#api.createMessage(input.channel, { content: input.content, nonce: nonce(job), flags: 4 }, { signal: this.#signal });
    this.#signal.throwIfAborted();
    if (!/^\d+$/.test(message.id)) return { status: 'unknown' };
    this.#store.set(`discord.outbox.receipt:${job.id}`, message.id);
    return this.#receipt(job, message.id);
  }
  async resume(): Promise<void> {
    this.#signal.throwIfAborted();
    for (const job of this.#store.outbox()) if (intent(job)?.discord) this.#lane(intent(job).channel);
    await Promise.all([...this.#lanes.values()].map(lane => lane.drain()));
  }
  async stop(): Promise<void> { await Promise.all([...this.#lanes.values()].map(lane => lane.stop())); }
}
