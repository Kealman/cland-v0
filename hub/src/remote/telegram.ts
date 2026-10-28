import { MediaQueue, type MediaInput } from './media.ts';
import { mirrorOut } from './mirror.ts';
import type { Remote, RemoteSend, RemoteReceipt, RemoteIngress } from './gateway.ts';
import type { Pairing } from './state.ts';
import type { RemoteConnection, HubFrame, HubStatus, Inbox } from '../protocol.ts';
import { realClock, type Clock, type ClockTimer } from '../hub/clock.ts';
import { TelegramApi, TelegramError, type TgUpdate } from './telegram-api.ts';
import { TELEGRAM_COMMANDS, telegramHelp, telegramCommand, telegramStatus, commandParts, plainCommandReply } from './telegram-commands.ts';
import { logUnhandledTelegramUpdate, pollTelegram, type TelegramPollingOptions } from './telegram-polling.ts';
import { flushTelegramGap } from './telegram-gap.ts';
import { TelegramOutbox } from './telegram-outbox.ts';
import { TelegramInbound } from './telegram-inbound.ts';
import { TelegramCards } from './telegram-cards.ts';
import { TelegramPrompts } from './telegram-prompts.ts';
import { plainParts } from './telegram-render.ts';
import { remoteStopCause, remoteStopDetails, remoteStopError } from './notices.ts';

export type TelegramRemoteOptions = TelegramPollingOptions & { maxUploadMb?: (() => number) | undefined; projectName?: () => string; webOrigin?: () => string };

/** The gateway owns this client's lifetime, including explicit tests and old-chat notices. */
export class TelegramRemote implements Remote {
  readonly id = 'telegram';
  readonly via = 'telegram';
  readonly #api: TelegramApi;
  readonly #outbox: TelegramOutbox;
  readonly #clock: Clock;
  readonly #abort = new AbortController();
  readonly #work = new Set<Promise<unknown>>();
  readonly #polling: TelegramRemoteOptions | undefined;
  #sendFrame: RemoteSend | undefined;
  #nextRequest = 0;
  readonly #pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  readonly #format: 'rich' | 'entities';
  #pair: ((identity: Pairing) => string | null) | undefined;
  #botId = 0;
  #running: Promise<void> | undefined;
  #stopped = false;
  #fatal = false;
  #lastInbound: string | null = null;
  #lastOutbound: string | null = null;
  #botLink: string | null = null;
  #stopping: Promise<void> | undefined;
  #fatalError: Error | undefined;
  #media: MediaQueue | undefined;
  #inbound: TelegramInbound | undefined;
  #cards: TelegramCards | undefined;
  #prompts: TelegramPrompts | undefined;
  #offline: { since: string; reason: string; announced: boolean } | undefined;
  readonly #listeners = new Set<() => void>();
  subscribe(changed: () => void): () => void { this.#listeners.add(changed); return () => { this.#listeners.delete(changed); }; }
  #changed(): void { for (const listener of this.#listeners) listener(); }
  #offlineTimer: ClockTimer | undefined;
  #recoveredAt: string | undefined;

  constructor(api: TelegramApi, clock: Clock = realClock, polling?: TelegramRemoteOptions, rendering: { format?: 'rich' | 'entities' } = {}) {
    this.#api = api; this.#clock = clock; this.#polling = polling;
    const outage = polling?.store.get('telegram.outage');
    if (outage) this.#offline = JSON.parse(outage);
    this.#format = rendering.format ?? 'rich';
    this.#outbox = new TelegramOutbox(api, clock, { ...(polling ? { store: polling.store } : {}), signal: this.#abort.signal,
      askOpen: async id => (await this.#request<Inbox>('inbox.list')).asks.some(ask => ask.id === id),
      approvalOpen: async id => (await this.#request<Inbox>('inbox.list')).approvals.some(approval => approval.id === id),
      onSent: () => { this.#lastOutbound = this.#clock.now().toISOString(); },
      onError: error => {
        if (fatal(error)) void this.#track(async () => { throw error; }).catch(() => {});
        else if (!this.#abort.signal.aborted) this.#failed(error instanceof TelegramError ? error.description : 'send failed');
      },
    });
    this.#outbox.holdCards(!!this.#offline);
  }

  #failed(reason: string): void {
    this.#outbox.setAvailable(false);
    this.#outbox.holdCards(true);
    this.#recoveredAt = undefined;
    this.#clock.clearTimeout(this.#offlineTimer);
    if (this.#offline) { this.#armOffline(); return; }
    this.#offline = { since: this.#clock.now().toISOString(), reason, announced: false };
    this.#saveOutage();
    this.#changed();
    this.#armOffline();
  }

  #saveOutage(): void {
    this.#polling?.store.set('telegram.outage', this.#offline ? JSON.stringify(this.#offline) : null);
  }

  #armOffline(): void {
    if (!this.#offline || this.#offline.announced) return;
    this.#offlineTimer = this.#clock.setTimeout(() => {
      if (this.#stopped || !this.#offline) return;
      this.#offline.announced = true;
      this.#saveOutage();
      this.#polling?.notice?.(`offline since ${time(this.#offline.since)}: ${this.#offline.reason}`, '', true);
    }, Math.max(1, Date.parse(this.#offline.since) + 180_000 - this.#clock.now().getTime()));
    this.#offlineTimer.unref();
  }

  async #caughtUp(): Promise<boolean> {
    // Ordinary commands confirm their own settled job; later queue arrivals
    // must not turn each successful poll into a remote-wide drain barrier.
    if (this.#offline) {
      await this.#outbox.resume();
      await this.#inbound?.recover();
    }
    if (this.#polling && !await flushTelegramGap(this.#polling.store, this.#clock, (chat, text, key) =>
      this.#outbox.send({ chat_id: chat, text, disable_notification: true, link_preview_options: { is_disabled: true } }, { key }))) return false;
    const outage = this.#offline;
    if (outage) {
      this.#outbox.holdCards(false);
      await this.#outbox.resume();
      if (!this.#recoveredAt || this.#abort.signal.aborted) return false; // Recovery was interrupted.
      if (Date.parse(this.#recoveredAt) - Date.parse(outage.since) > 150_000)
        await this.#cards?.catchUp(await this.#request<Inbox>('inbox.list'), outage.since);
      if (!this.#recoveredAt || this.#abort.signal.aborted) return false;
      this.#clock.clearTimeout(this.#offlineTimer);
      this.#offline = undefined;
      this.#saveOutage();
      this.#changed();
      if (outage.announced) this.#polling?.notice?.(`recovered; offline since ${time(outage.since)}`, '', true);
    }
    return true;
  }

  async #transient(operation: () => void | Promise<void>): Promise<void> {
    try { await operation(); }
    catch (error) {
      if (fatal(error)) throw error;
      if (this.#abort.signal.aborted) return;
      if (!(error instanceof TelegramError) && !this.#offline) throw error;
      this.#failed(error instanceof TelegramError ? error.description : 'send failed');
    }
  }

  #late(written: number): string | undefined {
    if (!this.#offline || !this.#recoveredAt || !Number.isFinite(written) || written <= 0
      || written * 1_000 > Date.parse(this.#recoveredAt)) return;
    return `written on Telegram at ${time(new Date(written * 1_000).toISOString())}; the hub was down until ${time(this.#recoveredAt)}`;
  }

  #track<T>(operation: () => Promise<T>): Promise<T> {
    const work = Promise.resolve().then(() => {
      if (this.#stopped || this.#fatal) throw new Error('Telegram remote is stopped');
      return operation();
    }).catch(error => {
      if ((!this.#abort.signal.aborted || this.#fatal) && error instanceof TelegramError && [401, 403, 409].includes(error.code)) {
        const stopCause = error.code === 401 ? 'token' : error.code === 403 ? 'blocked' : 'other-consumer';
        const { cause, fix } = remoteStopDetails('telegram', stopCause)!;
        const terminal = remoteStopError('telegram', stopCause, error.message);
        if (!this.#fatal) {
          this.#fatalError = terminal;
          this.#fatal = true;
          this.#stopped = true;
          this.#abort.abort();
          this.#polling?.notice?.(cause, fix);
          this.#clock.clearTimeout(this.#offlineTimer);
        }
        throw terminal;
      }
      throw error;
    });
    this.#work.add(work);
    void work.then(() => this.#work.delete(work), () => this.#work.delete(work));
    return work;
  }

  async #check(signal?: AbortSignal): Promise<void> {
    const bot = await this.#api.getMe({ signal: signal ? AbortSignal.any([this.#abort.signal, signal]) : this.#abort.signal });
    if (!bot || bot.is_bot !== true || !Number.isSafeInteger(bot.id)) throw new Error('Telegram getMe returned an invalid bot');
    this.#botId = bot.id;
    this.#outbox.setAvailable(true);
    this.#lastInbound = this.#clock.now().toISOString();
    this.#botLink = typeof bot.username === 'string' && /^[A-Za-z0-9_]{5,32}$/.test(bot.username) ? `https://t.me/${bot.username}` : null;
  }

  start(send: RemoteSend, pair?: (identity: Pairing) => string | null, signal?: AbortSignal, receipt?: RemoteReceipt): Promise<void> {
    this.#sendFrame = send;
    this.#armOffline();
    if (this.#polling) this.#inbound = new TelegramInbound(this.#polling.store, send, { setMessageReaction: async params => { await this.#outbox.react(params); return true; } }, this.#abort.signal,
      () => {}, receipt, written => this.#late(written));
    if (this.#polling) {
      this.#media = new MediaQueue(this.#polling.store, this.#clock, this.#abort.signal, input => this.#track(() => this.#mediaInput(input)));
      this.#prompts = new TelegramPrompts(this.#polling.store, this.#outbox, (type, fields, ingress) => this.#request(type, fields, ingress),
        (fields, ingress, stored) => this.#inbound!.answer(fields, ingress, stored), written => this.#late(written));
      this.#cards = new TelegramCards(this.#polling.store, this.#outbox, this.#api, (type, fields, ingress) => this.#request(type, fields, ingress), this.#abort.signal, this.#prompts, this.#polling.webOrigin);
    }
    this.#pair = pair;
    return this.#track(async () => {
      await this.#check(signal);
      if (!this.#polling) return;
      const options = { signal: signal ? AbortSignal.any([this.#abort.signal, signal]) : this.#abort.signal };
      const scope = { type: 'all_private_chats' as const };
      const current = await this.#api.getMyCommands({ scope }, options);
      if (!Array.isArray(current) || current.length !== TELEGRAM_COMMANDS.length
        || current.some((entry, index) => entry.command !== TELEGRAM_COMMANDS[index]!.command || entry.description !== TELEGRAM_COMMANDS[index]!.description))
        await this.#api.setMyCommands({ scope, commands: TELEGRAM_COMMANDS }, options);
    });
  }
  async #request<T>(type: string, fields: Record<string, unknown> = {}, ingress?: RemoteIngress): Promise<T> {
    const id = `telegram-command-${++this.#nextRequest}`;
    const reply = Promise.withResolvers<unknown>();
    this.#pending.set(id, reply);
    const abort = () => reply.reject(new Error('Telegram command cancelled'));
    this.#abort.signal.addEventListener('abort', abort, { once: true });
    try {
      this.#abort.signal.throwIfAborted();
      this.#sendFrame!({ ...fields, type, id }, ingress);
      return await reply.promise as T;
    } finally {
      this.#pending.delete(id);
      this.#abort.signal.removeEventListener('abort', abort);
    }
  }
  receive(frame: HubFrame): void | Promise<void> {
    // Fatal reporting itself publishes a General notice. A stopped adapter
    // must not turn that notice into another send and replace the saved cause.
    if (this.#stopped || this.#fatal) return;
    if (frame.type === 'result' && this.#pending.has(frame.id)) {
      const pending = this.#pending.get(frame.id)!;
      if (frame.ok) pending.resolve(frame.value); else pending.reject(new Error(frame.error));
      return;
    }
    if ((frame.type === 'inbox' || frame.type === 'ask' || frame.type === 'approval') && this.#cards) return this.#track(() => this.#transient(() => this.#cards!.receive(frame)));
    if (frame.type !== 'message' || frame.topic.id !== 'general') {
      if (this.#inbound) return this.#track(async () => { await this.#transient(() => this.#inbound!.receive(frame)); });
      return;
    }
    const pairing = this.#polling?.store.pairing();
    if (!pairing) return;
    const message = frame.message;
    const mirrored = mirrorOut(message, 'telegram');
    if (!mirrored) return;
    if (message.fromKind !== 'hub' && this.#polling!.store.suppressMutedMessage(message.id)) return;
    return this.#track(async () => {
      const { header } = mirrored;
      const options = { link_preview_options: { is_disabled: true }, disable_notification: mirrored.silent };
      const facts = { kind: 'general' as const, source: message.id, topic: 'general', missed: !!this.#offline };
      const parts = plainParts(header, message.text).map(part => ({ chat_id: pairing.chatId, ...part, ...options }));
      await this.#transient(async () => {
        if (this.#format === 'rich') await this.#outbox.rich({ chat_id: pairing.chatId,
          rich_message: { markdown: `${header}\n${message.text}`, skip_entity_detection: true }, ...options }, parts, facts);
        else {
          // Enqueue every part synchronously, so later General messages cannot interleave.
          await Promise.all(parts.map(part => this.#outbox.send(part, facts)));
        }
      });
    });
  }

  run(): Promise<void> {
    return this.#running ??= this.#track(async () => {
      await this.#outbox.resume();
      if (!this.#polling) return; // Previous injected clients keep their check/send-only lifetime.
      await this.#transient(async () => { await this.#inbound?.recover(); });
      this.#media?.recover();
      const handlers = [...this.#polling.handlers ?? [], ...(this.#cards ? [this.#cards.handler] : []), {
        accepts: (update: TgUpdate) => /^\/(?:mute|unmute)(?:@[A-Za-z0-9_]+)?\s*$/.test(update.message?.text ?? ''),
        handle: async (update: TgUpdate) => {
          const message = update.message!;
          const muted = /^\/mute(?:@|\s|$)/.test(message.text!);
          const reply = this.#polling!.store.applyTelegramMute(String(message.chat.id), message.message_id, muted);
          // An interrupted or uncertain reply never re-applies an old command.
          if (reply !== null) await this.#send(String(message.chat.id), reply);
        },
      }, {
        accepts: (update: TgUpdate) => telegramCommand(update.message?.text) !== null,
        handle: async (update: TgUpdate) => {
          const project = this.#polling!.projectName?.() ?? 'this project';
          const command = telegramCommand(update.message?.text);
          if (command === 'inbox') {
            const inbox = await this.#request<Inbox>('inbox.list');
            await this.#commandReply(update, [], async key => {
              if (!await this.#cards!.publishInbox(inbox, key))
                await this.#send(String(update.message!.chat.id), 'Nothing needs you');
            });
            return;
          }
          let reply;
          if (telegramCommand(update.message?.text) === 'status') {
            const status = await this.#request<HubStatus>('hub.status');
            const releases = await this.#request<{ items: Array<{ id: string; title: string }> }>('task.list', { kind: 'release', state: 'open', projection: 'summary' });
            reply = telegramStatus(project, status, releases.items, { connected: this.status().connected,
              muted: this.#polling!.store.get('mute') === 'true', outbox: this.#polling!.store.outbox().filter(job => ['queued', 'sending', 'uncertain'].includes(job.state)).length });
          } else if (command === 'cancel') {
            this.#prompts?.cancel(String(update.message!.chat.id));
            reply = plainCommandReply(`${project} — Cancel`, 'Cancelled. The ask stays open.');
          } else reply = telegramHelp(project);
          await this.#commandReply(update, [reply]);
        },
      }, ...(this.#pair ? [{
        kind: 'pairing' as const,
        accepts: () => true, // The poller admits only a private, numeric-identity /start here.
        handle: async (update: TgUpdate) => {
          const message = update.message!;
          const identity = { userId: String(message.from!.id), chatId: String(message.chat.id),
            guildId: null, name: message.from!.first_name };
          const paired = this.#polling!.store.pairing();
          const isPaired = paired?.userId === identity.userId && paired.chatId === identity.chatId;
          const reply = isPaired
            ? `Paired with ${this.#polling!.projectName?.() ?? 'this project'}.`
            : this.#pair!(identity);
          if (reply !== null) {
            if (isPaired) await this.#commandReply(update, [plainCommandReply(reply)]);
            else await this.#send(identity.chatId, reply, [], 'pairing');
          }
        },
      }] : []), {
        accepts: (update: TgUpdate) => !!update.my_chat_member,
        handle: async (update: TgUpdate) => {
          if (update.my_chat_member!.new_chat_member.status !== 'kicked') return;
          // Report through the same fatal boundary as API failures before consuming
          // this terminal event. Otherwise a reload replays the kick forever.
          await this.#track(async () => { throw new TelegramError('getUpdates', 403, 'bot blocked'); }).catch(error => {
            if (this.#fatal) {
              const stopCause = remoteStopCause(error);
              this.#polling!.store.setStatus({ disabled: true, reason: (error as Error).message, ...(stopCause ? { stopCause } : {}) });
              this.#polling!.store.confirmTelegramUpdate(update.update_id);
            }
            throw error;
          });
        },
      }, ...(this.#prompts ? [this.#prompts.handler] : []), {
        accepts: (update: TgUpdate) => !!update.message && !!mediaFile(update.message),
        handle: async (update: TgUpdate) => {
          const message = update.message!;
          this.#media!.enqueue({ chat: String(message.chat.id), message: String(message.message_id), date: message.date, ...(this.#late(message.date) ? { late: this.#late(message.date)! } : {}),
            ...(message.media_group_id ? { group: message.media_group_id } : {}), caption: message.caption ?? '', ...(message.reply_to_message ? { reply: String(message.reply_to_message.message_id) } : {}), file: mediaFile(message)! });
        },
      }, ...(this.#inbound ? [{
        accepts: this.#inbound.handler.accepts,
        handle: async (update: TgUpdate, signal: AbortSignal) => {
          const message = update.message!;
          if (!message.text!.startsWith('/') && this.#media!.has(String(message.chat.id))) {
            this.#media!.enqueue({ chat: String(message.chat.id), message: String(message.message_id), date: message.date, ...(this.#late(message.date) ? { late: this.#late(message.date)! } : {}),
              caption: '', text: message.text!, ...(message.reply_to_message ? { reply: String(message.reply_to_message.message_id) } : {}) });
          } else await this.#inbound!.handler.handle(update, signal);
        },
      }] : []), {
        // Dedicated media handlers go before this terminal fallback.
        accepts: () => true,
        handle: (update: TgUpdate) => this.#unsupported(update),
      }];
      await pollTelegram(this.#api, this.#clock, this.#botId, { ...this.#polling, handlers: handlers.map(handler => ({ ...handler, handle: async (update, signal) => {
        const message = update.message ?? update.edited_message ?? update.callback_query?.message;
        if (message) this.#media!.closeOutside(String(message.chat.id), update.message?.media_group_id);
        await handler.handle(update, signal);
      } })), ...(this.#cards ? { foreignCard: this.#cards.foreign } : {}),
        initialOffline: !!this.#offline, offline: reason => this.#failed(reason), caughtUp: () => this.#caughtUp() }, this.#abort.signal,
        () => {
          this.#lastInbound = this.#clock.now().toISOString();
          this.#outbox.setAvailable(true);
          if (this.#offline) {
            this.#recoveredAt ??= this.#lastInbound;
            this.#clock.clearTimeout(this.#offlineTimer);
          }
        });
      // A media failure aborts polling too. Join that native poll before
      // propagating the fatal cause through the gateway-observed lifetime.
      if (this.#fatalError) throw this.#fatalError;
    });
  }

  test(pairing: Pairing | null, text: string): Promise<void> {
    return this.#track(async () => {
      await this.#check();
      if (pairing) await this.#send(pairing.chatId, text);
    });
  }

  async #unsupported(update: TgUpdate): Promise<void> {
    const message = update.message;
    if (!message || this.#polling!.store.get(`telegram.command:${message.chat.id}:${message.message_id}`) === null)
      logUnhandledTelegramUpdate(update, this.#polling!.log);
    const target = message ?? update.edited_message;
    if (!target) return;
    await this.#commandReply({ ...update, message: target }, [plainCommandReply('This kind of message does not reach General')]);
  }

  async #mediaInput(input: MediaInput): Promise<void> {
    const store = this.#polling!.store;
    const ingress = { chatId: input.chat, messageId: input.message };
    const captured = input.pairing ?? store.pairing();
    const admitted = () => {
      const current = store.pairing();
      return !!captured && !!current && current.chatId === input.chat && current.chatId === captured.chatId
        && current.userId === captured.userId && current.guildId === captured.guildId;
    };
    if (!admitted()) return;
    if (input.text !== undefined) {
      await this.#inbound!.handler.handle({ update_id: 0, message: { message_id: Number(input.message), date: input.late ? 0 : input.date,
        chat: { id: Number(input.chat), type: 'private' }, text: input.text + (input.late ? `\n\n(${input.late})` : ''),
        ...(input.reply ? { reply_to_message: { message_id: Number(input.reply), date: 0, chat: { id: Number(input.chat), type: 'private' } } } : {}) } }, this.#abort.signal);
      return;
    }
    if (await this.#inbound!.recoverUpload(ingress, input.items?.map(item => item.message))) return;
    const limit = Math.min(20, this.#polling!.maxUploadMb?.() ?? 50);
    const files: Array<{ name: string; mime: string }> = [];
    const payload: Buffer[] = [];
    for (const item of input.items ?? [input]) {
      const file = item.file!;
      const refuse = (text: string) => this.#commandReply({ update_id: 0, message: { message_id: Number(item.message), date: item.date, chat: { id: Number(item.chat), type: 'private' } } }, [plainCommandReply(text)]);
      if (file.size !== undefined && file.size > limit * 1024 * 1024) {
        await refuse(`${file.name} is ${Math.ceil(file.size / (1024 * 1024))} MB: a bot can download at most ${limit} MB, so it was not stored`);
        continue;
      }
      try {
        const native = await this.#api.getFile({ file_id: file.fileId }, { signal: this.#abort.signal });
        if (!native.file_path) throw new TelegramError('getFile', 400, 'file unavailable');
        const bytes = await this.#api.download(native.file_path, Math.floor(limit * 1024 * 1024), this.#abort.signal);
        if (!admitted()) return;
        files.push({ name: file.name, mime: file.mime }); payload.push(bytes);
      } catch (error) {
        if (this.#abort.signal.aborted || fatal(error)) throw error;
        if (!admitted()) return;
        if (error instanceof TelegramError && (error.code === 429 || error.code >= 500 || error.code === 0 && !/cap|invalid/.test(error.description))) {
          await refuse(`${file.name} could not be stored; retrying`);
          throw error;
        }
        await refuse(`${file.name} could not be stored`);
      }
    }
    if (!files.length || !admitted()) return;
    const reply = input.reply ? store.message(input.chat, input.reply) : null;
    const reference = reply?.message ? store.get(`telegram.notice-reference:${reply.message}`) : null;
    try {
      await this.#inbound!.upload({ topic: reference ? 'general' : reply?.topic ?? 'general',
        ...(reply?.message && !reference ? { replyTo: reply.message } : {}),
        caption: `${reference ? reference + ' ' : ''}${input.caption}${input.late ? `\n\n(${input.late})` : ''}`, files }, ingress, payload, input.items?.map(item => item.message));
    } catch (error) {
      if (this.#abort.signal.aborted || fatal(error)) throw error;
      if (!admitted()) return;
      if (error instanceof TelegramError && (error.code === 429 || error.code >= 500 || error.code === 0 && !/cap|invalid/.test(error.description))) throw error;
      await this.#commandReply({ update_id: 0, message: { message_id: Number(input.message), date: input.date,
        chat: { id: Number(input.chat), type: 'private' } } }, [plainCommandReply(`${files.map(file => file.name).join(', ')} could not be stored`)]);
    }
  }

  async #commandReply(update: TgUpdate, replies: import('./telegram-commands.ts').CommandReply[], publish?: (key: string) => Promise<void>): Promise<void> {
    const key = `telegram.command:${update.message!.chat.id}:${update.message!.message_id}`;
    const store = this.#polling!.store;
    if (store.get(key) !== null) return;
    // Fence the command identity before queueing any platform effect. Unknown
    // deliveries stay fenced; the outbox retries only positive non-delivery.
    store.set(key, String(update.update_id));
    if (publish) return publish(key);
    // Queue all numbered parts before later ordinary messages can interleave.
    await Promise.all(replies.flatMap(commandParts).map(part =>
      this.#send(String(update.message!.chat.id), part.text, part.entities)));
  }

  async #send(chat: string, text: string, entities: import('./telegram-api.ts').TgEntity[] = [], admission: 'paired' | 'pairing' | 'old-chat' = 'paired'): Promise<void> {
    await this.#outbox.send({ chat_id: chat, text, entities }, { admission });
  }

  pairingReplaced(previous: Pairing, text: string): Promise<void> {
    return this.#track(() => this.#send(previous.chatId, text, [], 'old-chat'));
  }

  status(): RemoteConnection {
    const last = Math.max(Date.parse(this.#lastInbound ?? ''), Date.parse(this.#lastOutbound ?? '') || 0);
    return { connected: !this.#stopped && !this.#offline && Number.isFinite(last) && this.#clock.now().getTime() - last <= 65_000,
      lastInbound: this.#lastInbound, lastOutbound: this.#lastOutbound, botLink: this.#botLink,
      offlineSince: this.#offline?.since ?? null, lastError: this.#offline?.reason ?? null };
  }

  stop(): Promise<void> {
    this.#stopped = true;
    this.#clock.clearTimeout(this.#offlineTimer);
    this.#abort.abort();
    return this.#stopping ??= Promise.allSettled([this.#outbox.stop(), this.#media?.stop(), ...this.#work]).then(() => {});
  }
}

function time(at: string): string { return new Date(at).toTimeString().slice(0, 5); }

function fatal(error: unknown): boolean { return error instanceof TelegramError && [401, 403, 409].includes(error.code); }

function mediaFile(message: import('./telegram-api.ts').TgMessage): import('./media.ts').MediaFile | undefined {
  const photo = message.photo?.length ? message.photo.reduce((largest, size) => size.width * size.height > largest.width * largest.height ? size : largest) : undefined;
  const kind = photo ? 'photo' : message.document ? 'document' : message.audio ? 'audio' : message.video_note ? 'video_note' : message.video ? 'video' : undefined;
  const file = photo ?? message.document ?? message.audio ?? message.video_note ?? message.video;
  if (!kind || !file) return;
  const named = file as import('./telegram-api.ts').TgDocument;
  return { kind, fileId: file.file_id, name: photo ? `photo-${message.message_id}.jpg` : named.file_name ?? `${kind}-${message.message_id}.bin`,
    mime: photo ? 'image/jpeg' : named.mime_type ?? 'application/octet-stream', ...(file.file_size !== undefined ? { size: file.file_size } : {}),
    ...('duration' in file ? { duration: file.duration } : {}) };
}
