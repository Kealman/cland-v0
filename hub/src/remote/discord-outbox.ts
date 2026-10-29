import { artifactBody, artifactFile, artifactPlan } from './artifact-plan.ts';
import { renderDiscord } from './discord-render.ts';
import type { Artifact, Message } from '../protocol.ts';
import type { ApprovalOutcome, AskCard, InboxAsk } from '../protocol.ts';
import { approvalOutcomeLine, closedCardLine } from './cards.ts';
import { Outbox, type DeliveryResult } from './outbox.ts';
import type { RemoteStore, OutboxJob, RemoteMessage } from './state.ts';
import { DiscordError, type DiscordApi, type DiscordMessage, type DiscordActionRow } from './discord-api.ts';
import type { Clock } from '../hub/clock.ts';

type Intent = { batch?: string; files?: string[]; reply?: string; discord: true; channel: string; user: string; silent?: boolean; content: string; edit?: string; components?: DiscordActionRow[]; reaction?: { message: string; emoji: string }; mapping: Omit<RemoteMessage, 'messageId'> };
const intent = (job: OutboxJob) => job.payload as Intent;
const cardKey = (job: OutboxJob) => intent(job).mapping?.approval ? `approval:${intent(job).mapping.approval}` : intent(job).mapping?.ask;
const nonce = (job: OutboxJob) => job.id.replaceAll('-', '').slice(0, 25);
/** Per-channel owners over the neutral durable queue. Native receipts contain ids only. */
export class DiscordOutbox {
  #recovering = false;
  authenticated(): void { this.#store.set('outbox.unavailable', null); }
  holdRecovery(hold: boolean): void { this.#recovering = hold; }
  readonly #lanes = new Map<string, Outbox>();
  readonly #files: { root: string; artifact: (id: string) => Artifact | null } | undefined;
  readonly #store: RemoteStore; readonly #api: DiscordApi; readonly #clock: Clock; readonly #signal: AbortSignal;
  constructor(api: DiscordApi, store: RemoteStore, clock: Clock, signal: AbortSignal, files?: { root: string; artifact: (id: string) => Artifact | null }) {
    this.#files = files;
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
    if (ask.startsWith('approval:')) {
      const outcome = this.#store.get(`discord.card-closure:${ask}`);
      return outcome ? [...approvalOutcomeLine(JSON.parse(outcome))].slice(0, 2000).join('') : undefined;
    }
    const closure = this.#store.get(`discord.card-closure:${ask}`), model = this.#store.get(`discord.card-model:${ask}`);
    if (!closure || !model) return;
    const line = closedCardLine(JSON.parse(closure) as AskCard, (JSON.parse(model) as InboxAsk).from);
    return line === undefined ? undefined : [...line].slice(0, 2000).join('');
  }
  #fold(ask: string): void {
    const line = this.#closedLine(ask);
    if (line === undefined) return;
    for (const copy of (ask.startsWith('approval:') ? this.#store.messagesForApproval(ask.slice(9)) : this.#store.messagesForAsk(ask))) {
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
  async closeApproval(id: string, outcome: ApprovalOutcome): Promise<void> {
    this.#store.set(`discord.card-closure:approval:${id}`, JSON.stringify(outcome));
    this.#fold(`approval:${id}`);
    await Promise.all([...this.#lanes.values()].map(lane => lane.drain()));
  }
  async card(channel: string, content: string, components: DiscordActionRow[], ask: string, topic: string, resend?: string, approval = false): Promise<void> {
    this.#signal.throwIfAborted();
    const lane = this.#lane(channel), source = `${resend ? `${resend}:` : ''}discord.card:${channel}:${approval ? 'approval:' : ''}${ask}`;
    // An explicit inbox invocation probes restored delivery like a new send.
    // Durable attempt proof and the original nonce deadline still fence retries.
    if (resend) lane.setAvailable(true);
    if (!this.#store.outbox().some(job => job.source === source)) lane.enqueue({ kind: 'card', source,
      payload: { discord: true, channel, user: this.#store.pairing()?.userId, content, components,
        mapping: { chatId: channel, topic, message: ask, ask: approval ? null : ask, approval: approval ? ask : null } } });
    await lane.drain();
  }
  async notice(channel: string, content: string, source: string, topic: string, message: string, resend?: string): Promise<void> {
    const lane = this.#lane(channel);
    const key = `${resend ? `${resend}:` : ''}${source}`;
    if (resend) lane.setAvailable(true);
    if (!this.#store.outbox().some(job => job.source === key)) lane.enqueue({ kind: 'card', source: key,
      payload: { discord: true, channel, user: this.#store.pairing()?.userId, content, components: [],
        mapping: { chatId: channel, topic, message, ask: null, approval: null } } });
    await lane.drain();
  }
  async send(channel: string, content: string, source: string, silent = false, message = source, reply?: string): Promise<void> {
    this.#signal.throwIfAborted();
    const lane = this.#lane(channel);
    // A new send probes recovery; earlier missed jobs stay fenced.
    lane.setAvailable(true);
    this.#enqueue(lane, channel, content, source, silent, message, reply);
    await lane.drain();
  }
  async recoveryWarning(channel: string, content: string, source: string): Promise<void> {
    await this.send(channel, content, source, true);
    const job = this.#store.outbox().find(row => row.source === source && intent(row).channel === channel);
    if (job?.state !== 'sent') throw new Error('Discord recovery warning delivery incomplete');
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
  #enqueue(lane: Outbox, channel: string, content: string, source: string, silent: boolean, message: string, reply?: string, files?: string[], batch?: string): void {
    if (this.#store.outbox().some(j => j.source === source)) return;
    const id = lane.enqueue({ kind: 'general', source,
      payload: { discord: true, channel, user: this.#store.pairing()?.userId, content, silent, ...(batch ? { batch } : {}), ...(reply ? { reply } : {}), ...(files?.length ? { files } : {}),
        mapping: { chatId: channel, topic: 'general', message, ask: null, approval: null } } });
    for (const artifact of files ?? []) this.#store.set(`discord.artifact:${artifact}`, id);
  }
  /** Reserve each artifact in the messenger ledger before any native I/O. */
  async publication(channel: string, message: Message, header: string, silent: boolean): Promise<void> {
    if (!this.#files || !message.artifact && !message.artifacts?.length) return this.sendGroup(channel, renderDiscord(header, message.text), message.id, silent);
    const lane = this.#lane(channel);
    if (this.#store.get(`discord.publication:${message.id}`)) { await lane.drain(); return; }
    const plan = artifactPlan(this.#files.root, message, header, { photo: 0, document: 20 * 1024 * 1024, caption: 2000, images: [] });
    this.#store.transaction(() => {
      lane.setAvailable(true);
      let index = 0;
      let group: string[] = [], bytes = 0, caption = header;
      const enqueue = (content: string, files?: string[], reply?: string) => this.#enqueue(lane, channel, content, `${message.id}:artifact-part:${++index}`, silent, message.id, reply, files, message.id);
      const flush = () => { if (group.length) enqueue(caption, group); group = []; bytes = 0; };
      for (const part of plan) {
        if (part.type === 'text') {
          flush();
          if (part.text) for (const text of renderDiscord(header, part.text)) enqueue(text);
          continue;
        }
        const reserved = this.#store.get(`discord.artifact:${part.artifact}`);
        const previous = reserved ? this.#store.outbox(undefined, reserved)[0] : undefined;
        if (previous) {
          flush();
          const prior = intent(previous);
          const id = this.#store.get(`discord.outbox.receipt:${previous.id}`);
          const sameChannel = prior.channel === channel;
          const delivered = (JSON.parse(this.#store.get(`discord.outbox.delivered:${previous.id}`) ?? '[]') as string[]).includes(part.artifact);
          const sent = previous.state === 'sent' && delivered;
          enqueue(`${header}\n▣ ${part.artifact} ${this.#files!.artifact(part.artifact)?.title ?? ''} (${sent ? sameChannel ? 'sent above' : 'sent above in the previous channel' : previous.state === 'sent' ? 'not uploaded' : 'delivery unconfirmed'})`, undefined, sent && sameChannel ? id ?? undefined : undefined);
          continue;
        }
        const artifact = this.#files!.artifact(part.artifact);
        const file = artifact && artifactFile(this.#files!.root, artifact);
        if (!file) { flush(); enqueue(`${header}\n▣ ${part.artifact} · file unavailable`); continue; }
        // Leave room for payload_json, filenames and multipart boundaries.
        if (group.length === 10 || bytes + file.size > 25 * 1024 * 1024 - 65536) flush();
        caption = part.caption; group.push(part.artifact); bytes += file.size;
      }
      flush();
      this.#store.set(`discord.publication:${message.id}`, '1');
    });
    await lane.drain();
  }
  observe(message: DiscordMessage): void {
    if (!message.nonce || !/^\d+$/.test(message.id)) return;
    const job = this.#store.outbox().find(j => intent(j)?.discord && intent(j).channel === message.channel_id && nonce(j) === message.nonce);
    if (job) this.#recordMessage(job, message);
  }
  #lane(channel: string): Outbox {
    let lane = this.#lanes.get(channel);
    if (!lane) {
      lane = new Outbox(this.#store, {
        send: job => this.#deliver(job),
        settled: (job, result) => { if (result.status === 'sent' && job.kind === 'card' && cardKey(job)) this.#fold(cardKey(job)!); },
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
      }, { clock: this.#clock, compare: (a, b) => Number(!!intent(b).batch && intent(b).batch === this.#store.get(`discord.outbox.batch:${channel}`)) - Number(!!intent(a).batch && intent(a).batch === this.#store.get(`discord.outbox.batch:${channel}`)) || Number(a.kind === 'general') - Number(b.kind === 'general'), accepts: job => intent(job)?.discord === true && intent(job).channel === channel && (!this.#recovering || (job.kind !== 'card' && job.kind !== 'edit')),
        sourceOpen: job => job.kind !== 'card' || !cardKey(job) || (!this.#store.get(`discord.card-closure:${cardKey(job)}`)
          || this.#store.get(`discord.card-reconcile:${job.id}`) === '1'
          || this.#store.attempts(job.id).some(attempt => attempt.outcome !== 'never-left')),
        admit: job => { const pair = this.#store.pairing(); return pair?.chatId === channel && pair.userId === intent(job).user; } });
      this.#lanes.set(channel, lane);
    }
    return lane;
  }
  #recordMessage(job: OutboxJob, message: DiscordMessage): void {
    const planned = JSON.parse(this.#store.get(`discord.outbox.prepared:${job.id}`) ?? '[]') as Array<{ artifact: string; name: string }>;
    const attachments = (message as DiscordMessage & { attachments?: Array<{ filename: string }> }).attachments ?? [];
    this.#store.transaction(() => {
      this.#store.set(`discord.outbox.delivered:${job.id}`, JSON.stringify(planned.filter(file => attachments.some(a => a.filename === file.name)).map(file => file.artifact)));
      this.#store.set(`discord.outbox.receipt:${job.id}`, message.id);
    });
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
    if (input.batch) this.#store.set(`discord.outbox.batch:${input.channel}`, input.batch);
    const closed = job.kind === 'card' && cardKey(job) ? this.#closedLine(cardKey(job)!) : undefined;
    const files = [];
    const prepared: Array<{ artifact: string; name: string }> = [];
    let content = closed ?? input.content;
    let total = 0;
    for (const id of input.files ?? []) {
      const artifact = this.#files?.artifact(id);
      const file = artifact && this.#files ? artifactFile(this.#files.root, artifact) : null;
      if (!file || !this.#files) { content += `\n▣ ${id} · file unavailable`; continue; }
      try {
        const body = await artifactBody(this.#files.root, file.path, file.mime, 20 * 1024 * 1024, this.#signal);
        if (total + body.size > 25 * 1024 * 1024 - 65536) throw new Error('file group exceeds request budget');
        total += body.size;
        files.push({ name: file.filename, body });
        prepared.push({ artifact: id, name: file.filename });
      } catch { this.#signal.throwIfAborted(); content += `\n▣ ${id} · file unavailable`; }
    }
    this.#signal.throwIfAborted();
    const pair = this.#store.pairing();
    if (pair?.chatId !== input.channel || pair.userId !== input.user) return { status: 'superseded' };
    // A nonce can return an earlier accepted attempt even when today's file read fails.
    // Keep every attempted artifact/name pair so its native receipt remains attributable.
    const earlier = JSON.parse(this.#store.get(`discord.outbox.prepared:${job.id}`) ?? '[]') as Array<{ artifact: string; name: string }>;
    const attempted = [...new Map([...earlier, ...prepared].map(file => [JSON.stringify([file.artifact, file.name]), file])).values()];
    this.#store.set(`discord.outbox.prepared:${job.id}`, JSON.stringify(attempted));
    let message: DiscordMessage;
    try { message = await this.#api.createMessage(input.channel, { content: [...content].slice(0, 2000).join(''), ...(files.length ? { files } : {}), ...(input.reply ? { message_reference: { message_id: input.reply, fail_if_not_exists: false as const } } : {}), ...(closed !== undefined ? { components: [] } : input.components ? { components: input.components } : {}), nonce: nonce(job), flags: 4 | (input.silent ? 4096 : 0) }, { signal: this.#signal, nonceDeadline: Date.parse(this.#store.attempts(job.id)[0]!.at) + 120_000 }); }
    catch (error) {
      if (error instanceof DiscordError && [401, 403, 404].includes(error.status)) return { status: 'superseded' };
      throw error;
    }
    this.#signal.throwIfAborted();
    if (!/^\d+$/.test(message.id)) return { status: 'unknown' };
    this.#recordMessage(job, message);
    return this.#receipt(job, message.id);
  }
  async resume(): Promise<void> {
    this.#signal.throwIfAborted();
    for (const job of this.#store.outbox()) if (intent(job)?.discord) this.#lane(intent(job).channel);
    // A crash can commit the native mapping before settled queues its owed edit.
    // Reconstruct that obligation before any lane can drain General.
    for (const job of this.#store.outbox()) if (intent(job)?.discord && job.kind === 'card' && cardKey(job)) this.#fold(cardKey(job)!);
    // Startup has completed its authenticated application check; retry persisted work.
    for (const lane of this.#lanes.values()) lane.setAvailable(true);
    await Promise.all([...this.#lanes.values()].map(lane => lane.drain()));
  }
  async stop(): Promise<void> { await Promise.all([...this.#lanes.values()].map(lane => lane.stop())); }
}
