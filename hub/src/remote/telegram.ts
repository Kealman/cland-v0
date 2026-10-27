import type { Remote, RemoteSend, RemoteReceipt } from './gateway.ts';
import type { Pairing } from './state.ts';
import type { RemoteConnection, HubFrame, HubStatus, Inbox } from '../protocol.ts';
import { realClock, type Clock } from '../hub/clock.ts';
import { TelegramApi, TelegramError, type TgUpdate } from './telegram-api.ts';
import { TELEGRAM_COMMANDS, telegramHelp, telegramCommand, telegramStatus, telegramInbox, commandParts, plainCommandReply } from './telegram-commands.ts';
import { pollTelegram, type TelegramPollingOptions } from './telegram-polling.ts';
import { TelegramInbound } from './telegram-inbound.ts';
import { plainParts } from './telegram-render.ts';

export type TelegramRemoteOptions = TelegramPollingOptions & { projectName?: () => string };

/** The gateway owns this client's lifetime, including explicit tests and old-chat notices. */
export class TelegramRemote implements Remote {
  readonly id = 'telegram';
  readonly via = 'telegram';
  readonly #api: TelegramApi;
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
  #inbound: TelegramInbound | undefined;

  constructor(api: TelegramApi, clock: Clock = realClock, polling?: TelegramRemoteOptions, rendering: { format?: 'rich' | 'entities' } = {}) {
    this.#api = api; this.#clock = clock; this.#polling = polling;
    this.#format = rendering.format ?? 'rich';
  }

  #track<T>(operation: () => Promise<T>): Promise<T> {
    const work = Promise.resolve().then(() => {
      if (this.#stopped || this.#fatal) throw new Error('Telegram remote is stopped');
      return operation();
    }).catch(error => {
      if (!this.#abort.signal.aborted && error instanceof TelegramError && [401, 403, 409].includes(error.code)) {
        const cause = error.code === 401 ? 'wrong or revoked token (401)'
          : error.code === 403 ? 'bot blocked (403)' : 'another consumer of the token (409)';
        const fix = error.code === 401 ? 'set a new token with cland secret set telegram.token, then run cland hub reload'
          : error.code === 403 ? 'unblock the bot in Telegram, then run cland hub reload'
            : 'stop the other token consumer, then run cland hub reload';
        if (!this.#fatal) {
          this.#fatal = true;
          this.#stopped = true;
          this.#abort.abort();
          this.#polling?.notice?.(cause, fix);
        }
        throw new Error(`${cause}; ${fix}; ${error.message}`);
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
    this.#lastInbound = this.#clock.now().toISOString();
    this.#botLink = typeof bot.username === 'string' && /^[A-Za-z0-9_]{5,32}$/.test(bot.username) ? `https://t.me/${bot.username}` : null;
  }

  start(send: RemoteSend, pair?: (identity: Pairing) => string | null, signal?: AbortSignal, receipt?: RemoteReceipt): Promise<void> {
    this.#sendFrame = send;
    if (this.#polling) this.#inbound = new TelegramInbound(this.#polling.store, send, this.#api, this.#abort.signal,
      () => { this.#lastOutbound = this.#clock.now().toISOString(); }, receipt);
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
  async #request<T>(type: string, fields: Record<string, unknown> = {}): Promise<T> {
    const id = `telegram-command-${++this.#nextRequest}`;
    const reply = Promise.withResolvers<unknown>();
    this.#pending.set(id, reply);
    const abort = () => reply.reject(new Error('Telegram command cancelled'));
    this.#abort.signal.addEventListener('abort', abort, { once: true });
    try {
      this.#abort.signal.throwIfAborted();
      this.#sendFrame!({ ...fields, type, id });
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
    if (frame.type !== 'message' || frame.topic.id !== 'general') {
      if (this.#inbound) return this.#track(async () => { await this.#inbound!.receive(frame); });
      return;
    }
    const pairing = this.#polling?.store.pairing();
    if (!pairing) return;
    const message = frame.message;
    if (message.answerTo || message.ask && !message.ask.to || message.fromKind === 'human' && message.via === 'telegram') return;
    return this.#track(async () => {
      const author = message.fromKind === 'human' ? message.via === 'discord' ? 'you (Discord)' : 'you' : message.from;
      const header = `${author} · ${message.kind ?? 'message'}`;
      const options = { link_preview_options: { is_disabled: true }, disable_notification: message.kind === 'progress' || message.fromKind === 'hub' };
      const record = (sent: { message_id: number }) => {
        this.#lastOutbound = this.#clock.now().toISOString();
        this.#polling!.store.putMessage({ chatId: pairing.chatId, messageId: String(sent.message_id), topic: 'general',
          message: message.id, ask: null, approval: null });
      };
      if (this.#format === 'rich') {
        let sent;
        try {
          sent = await this.#api.sendRichMessage({ chat_id: pairing.chatId,
            rich_message: { markdown: `${header}\n${message.text}`, skip_entity_detection: true }, ...options }, { signal: this.#abort.signal });
        } catch (error) {
          if (this.#abort.signal.aborted) return;
          if (error instanceof TelegramError && [401, 403].includes(error.code)) throw error;
        }
        if (sent) { record(sent); return; }
      }
      for (const part of plainParts(header, message.text)) record(await this.#api.sendMessage({ chat_id: pairing.chatId, ...part, ...options }, { signal: this.#abort.signal }));
    });
  }

  run(): Promise<void> {
    return this.#running ??= this.#track(async () => {
      if (!this.#polling) return; // Previous injected clients keep their check/send-only lifetime.
      await this.#inbound?.recover();
      const handlers = [...this.#polling.handlers ?? [], {
        accepts: (update: TgUpdate) => telegramCommand(update.message?.text) !== null,
        handle: async (update: TgUpdate) => {
          const project = this.#polling!.projectName?.() ?? 'this project';
          const command = telegramCommand(update.message?.text);
          if (command === 'inbox') {
            const inbox = await this.#request<Inbox>('inbox.list');
            await this.#commandReply(update, telegramInbox(project, inbox));
            return;
          }
          let reply;
          if (telegramCommand(update.message?.text) === 'status') {
            const status = await this.#request<HubStatus>('hub.status');
            const releases = await this.#request<{ items: Array<{ id: string; title: string }> }>('task.list', { kind: 'release', state: 'open', projection: 'summary' });
            reply = telegramStatus(project, status, releases.items, { connected: this.status().connected,
              muted: this.#polling!.store.get('mute') === 'true', outbox: this.#polling!.store.outbox().filter(job => ['queued', 'sending', 'uncertain'].includes(job.state)).length });
          } else if (command === 'cancel') reply = plainCommandReply(`${project} — Cancel`, 'Cancelled. The ask stays open.');
          else reply = telegramHelp(project);
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
            else await this.#send(identity.chatId, reply);
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
              this.#polling!.store.setStatus({ disabled: true, reason: (error as Error).message });
              this.#polling!.store.confirmTelegramUpdate(update.update_id);
            }
            throw error;
          });
        },
      }, ...(this.#inbound ? [this.#inbound.handler] : [])];
      await pollTelegram(this.#api, this.#clock, this.#botId, { ...this.#polling, handlers }, this.#abort.signal,
        () => { this.#lastInbound = this.#clock.now().toISOString(); });
    });
  }

  test(pairing: Pairing | null, text: string): Promise<void> {
    return this.#track(async () => {
      await this.#check();
      if (pairing) await this.#send(pairing.chatId, text);
    });
  }

  async #commandReply(update: TgUpdate, replies: import('./telegram-commands.ts').CommandReply[]): Promise<void> {
    const key = `telegram.command:${update.message!.chat.id}:${update.message!.message_id}`;
    const store = this.#polling!.store;
    if (store.get(key) !== null) return;
    // Direct replies have no resend proof. Fence the native command before its
    // first platform effect; a lost reply is requested again with a new command.
    store.set(key, String(update.update_id));
    for (const reply of replies) for (const part of commandParts(reply))
      await this.#send(String(update.message!.chat.id), part.text, part.entities);
  }

  async #send(chat: string, text: string, entities: import('./telegram-api.ts').TgEntity[] = []): Promise<void> {
    await this.#api.sendMessage({ chat_id: chat, text, entities }, { signal: this.#abort.signal });
    this.#lastOutbound = this.#clock.now().toISOString();
  }

  pairingReplaced(previous: Pairing, text: string): Promise<void> {
    return this.#track(() => this.#send(previous.chatId, text));
  }

  status(): RemoteConnection {
    const last = Math.max(Date.parse(this.#lastInbound ?? ''), Date.parse(this.#lastOutbound ?? '') || 0);
    return { connected: !this.#stopped && Number.isFinite(last) && this.#clock.now().getTime() - last <= 65_000,
      lastInbound: this.#lastInbound, lastOutbound: this.#lastOutbound, botLink: this.#botLink };
  }

  stop(): Promise<void> {
    this.#stopped = true;
    this.#abort.abort();
    return this.#stopping ??= Promise.allSettled([...this.#work]).then(() => {});
  }
}
