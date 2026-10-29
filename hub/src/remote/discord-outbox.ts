import type { AskCard, InboxAsk } from '../protocol.ts';
import { closedCardLine } from './cards.ts';
import { Outbox, type DeliveryResult } from './outbox.ts';
import type { RemoteStore, OutboxJob, RemoteMessage } from './state.ts';
import { DiscordError, type DiscordApi, type DiscordMessage, type DiscordActionRow } from './discord-api.ts';
import type { Clock } from '../hub/clock.ts';

type Intent = { discord: true; channel: string; user: string; silent?: boolean; content: string; edit?: string; components?: DiscordActionRow[]; reaction?: { message: string; emoji: string }; mapping: Omit<RemoteMessage, 'messageId'> };
const intent = (job: OutboxJob) => job.payload as Intent;
const nonce = (job: OutboxJob) => job.id.replaceAll('-', '').slice(0, 25);
/** Per-channel owners over the neutral durable queue. Native receipts contain ids only. */
export class DiscordOutbox {
  readonly #lanes = new Map<string, Outbox>();
  readonly #store: RemoteStore; readonly #api: DiscordApi; readonly #clock: Clock; readonly #signal: AbortSignal;
  constructor(api: DiscordApi, store: RemoteStore, clock: Clock, signal: AbortSignal) {
    this.#api = api; this.#store = store; this.#clock = clock; this.#signal = signal;
  }
  async edit(channel: string, target: string, content: string, source: string): Promise<void> {
    this.#signal.throwIfAborted();
    const lane = this.#lane(channel);
    if (this.#store.outbox().some(job => job.kind === 'edit' && job.target === target && job.source === source && intent(job).content === content && ['queued', 'sent'].includes(job.state))) return;
    lane.enqueue({ kind: 'edit', target, source, payload: { discord: true, channel, user: this.#store.pairing()?.userId, content, edit: target } });
    await lane.drain();
  }
  #closedLine(ask: string): string | undefined {
    const closure = this.#store.get(`discord.card-closure:${ask}`), model = this.#store.get(`discord.card-model:${ask}`);
    if (!closure || !model) return;
    const line = closedCardLine(JSON.parse(closure) as AskCard, (JSON.parse(model) as InboxAsk).from);
    return line === undefined ? undefined : [...line].slice(0, 2000).join('');
  }
  #fold(ask: string): void {
    const line = this.#closedLine(ask);
    if (line === undefined) return;
    for (const copy of this.#store.messagesForAsk(ask)) {
      const source = `discord.outcome:${ask}`;
      if (this.#store.outbox().some(job => job.kind === 'edit' && job.target === copy.messageId && job.source === source
        && intent(job).content === line && ['queued', 'sent'].includes(job.state))) continue;
      this.#lane(copy.chatId).enqueue({ kind: 'edit', target: copy.messageId, source,
        payload: { discord: true, channel: copy.chatId, user: this.#store.pairing()?.userId, content: line, edit: copy.messageId } });
    }
  }
  async closeCard(ask: string, card: Pick<AskCard, 'state' | 'outcome'>): Promise<void> {
    this.#store.set(`discord.card-closure:${ask}`, JSON.stringify(card));
    this.#fold(ask);
    await Promise.all([...this.#lanes.values()].map(lane => lane.drain()));
  }
  async card(channel: string, content: string, components: DiscordActionRow[], ask: string, topic: string, resend?: string): Promise<void> {
    this.#signal.throwIfAborted();
    const lane = this.#lane(channel), source = `${resend ? `${resend}:` : ''}discord.card:${channel}:${ask}`;
    // An explicit inbox invocation probes restored delivery like a new send.
    // Durable attempt proof and the original nonce deadline still fence retries.
    if (resend) lane.setAvailable(true);
    if (!this.#store.outbox().some(job => job.source === source)) lane.enqueue({ kind: 'card', source,
      payload: { discord: true, channel, user: this.#store.pairing()?.userId, content, components,
        mapping: { chatId: channel, topic, message: ask, ask, approval: null } } });
    await lane.drain();
  }
  async send(channel: string, content: string, source: string, silent = false, message = source): Promise<void> {
    this.#signal.throwIfAborted();
    const lane = this.#lane(channel);
    // A new send probes recovery; earlier missed jobs stay fenced.
    lane.setAvailable(true);
    this.#enqueue(lane, channel, content, source, silent, message);
    await lane.drain();
  }
  async react(channel: string, message: string, emoji: '👌' | '👀', user: string): Promise<void> {
    this.#signal.throwIfAborted();
    const pair = this.#store.pairing();
    if (pair?.chatId !== channel || pair.userId !== user) return;
    const lane = this.#lane(channel), source = `discord.reaction:${channel}:${message}:${emoji}`;
    if (!this.#store.outbox().some(j => j.source === source)) lane.enqueue({ kind: 'message', source,
      payload: { discord: true, channel, user, reaction: { message, emoji } } });
    await lane.drain();
  }
  async sendGroup(channel: string, parts: string[], source: string, silent: boolean): Promise<void> {
    this.#signal.throwIfAborted();
    const lane = this.#lane(channel);
    // No native I/O or yielding until the entire rendered group is durable.
    this.#store.transaction(() => {
      lane.setAvailable(true);
      for (const [index, content] of parts.entries()) this.#enqueue(lane, channel, content,
        parts.length === 1 ? source : `${source}:part:${index + 1}`, silent, source);
    });
    await lane.drain();
  }
  #enqueue(lane: Outbox, channel: string, content: string, source: string, silent: boolean, message: string): void {
    if (!this.#store.outbox().some(j => j.source === source)) lane.enqueue({ kind: 'general', source,
      payload: { discord: true, channel, user: this.#store.pairing()?.userId, content, silent,
        mapping: { chatId: channel, topic: 'general', message, ask: null, approval: null } } });
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
        settled: (job, result) => { if (result.status === 'sent' && job.kind === 'card' && intent(job).mapping?.ask) this.#fold(intent(job).mapping.ask!); },
        prove: async job => {
          if (intent(job).reaction || intent(job).edit) return { status: 'never-left' }; // Reactions and replacement edits are idempotent.
          const id = this.#store.get(`discord.outbox.receipt:${job.id}`);
          if (id) return this.#receipt(job, id);
          // Discord promises only "the past few minutes"; use a conservative two-minute window.
          if (!this.#withinNonceWindow(job)) return { status: 'unknown' };
          // This is permission for bounded nonce reconciliation, not proof that the
          // original POST never left. Retain that distinction across the next source check.
          if (job.kind === 'card') this.#store.set(`discord.card-reconcile:${job.id}`, '1');
          // Let the neutral queue persist a distinct attempt before the recovery POST.
          return { status: 'never-left' };
        },
      }, { clock: this.#clock, compare: (a, b) => Number(a.kind === 'general') - Number(b.kind === 'general'), accepts: job => intent(job)?.discord === true && intent(job).channel === channel,
        sourceOpen: job => job.kind !== 'card' || !intent(job).mapping?.ask || (!this.#store.get(`discord.card-closure:${intent(job).mapping.ask}`)
          || this.#store.get(`discord.card-reconcile:${job.id}`) === '1'
          || this.#store.attempts(job.id).some(attempt => attempt.outcome !== 'never-left')),
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
    if (intent(job).edit) {
      try { await this.#api.editMessage(intent(job).channel, intent(job).edit!, { content: intent(job).content, components: [], flags: 4 }, { signal: this.#signal }); }
      catch (error) { if (error instanceof DiscordError && [401, 403, 404].includes(error.status)) return { status: 'superseded' }; throw error; }
      return { status: 'sent' };
    }
    const reaction = intent(job).reaction;
    if (reaction) {
      try { await this.#api.addReaction(intent(job).channel, reaction.message, reaction.emoji, { signal: this.#signal }); }
      catch (error) {
        if (error instanceof DiscordError && [401, 403, 404].includes(error.status)) return { status: 'superseded' };
        throw error;
      }
      this.#signal.throwIfAborted();
      return { status: 'sent' };
    }
    // Recheck at I/O: a restart after prove or queue work must not renew the window.
    if (!this.#withinNonceWindow(job)) return { status: 'unknown' };
    const input = intent(job);
    const closed = job.kind === 'card' && input.mapping?.ask ? this.#closedLine(input.mapping.ask) : undefined;
    let message: DiscordMessage;
    try { message = await this.#api.createMessage(input.channel, { content: closed ?? input.content, ...(closed !== undefined ? { components: [] } : input.components ? { components: input.components } : {}), nonce: nonce(job), flags: 4 | (input.silent ? 4096 : 0) }, { signal: this.#signal, nonceDeadline: Date.parse(this.#store.attempts(job.id)[0]!.at) + 120_000 }); }
    catch (error) {
      if (error instanceof DiscordError && [401, 403, 404].includes(error.status)) return { status: 'superseded' };
      throw error;
    }
    this.#signal.throwIfAborted();
    if (!/^\d+$/.test(message.id)) return { status: 'unknown' };
    this.#store.set(`discord.outbox.receipt:${job.id}`, message.id);
    return this.#receipt(job, message.id);
  }
  async resume(): Promise<void> {
    this.#signal.throwIfAborted();
    for (const job of this.#store.outbox()) if (intent(job)?.discord) this.#lane(intent(job).channel);
    // A crash can commit the native mapping before settled queues its owed edit.
    // Reconstruct that obligation before any lane can drain General.
    for (const job of this.#store.outbox()) if (intent(job)?.discord && job.kind === 'card' && intent(job).mapping?.ask) this.#fold(intent(job).mapping.ask!);
    // Startup has completed its authenticated application check; retry persisted work.
    for (const lane of this.#lanes.values()) lane.setAvailable(true);
    await Promise.all([...this.#lanes.values()].map(lane => lane.drain()));
  }
  async stop(): Promise<void> { await Promise.all([...this.#lanes.values()].map(lane => lane.stop())); }
}
