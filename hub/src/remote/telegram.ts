import type { Remote } from './gateway.ts';
import type { Pairing } from './state.ts';
import type { RemoteConnection } from '../protocol.ts';
import { realClock, type Clock } from '../hub/clock.ts';
import { TelegramApi, TelegramError, type TgUpdate } from './telegram-api.ts';
import { pollTelegram, type TelegramPollingOptions } from './telegram-polling.ts';

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
  #pair: ((identity: Pairing) => string | null) | undefined;
  #botId = 0;
  #running: Promise<void> | undefined;
  #stopped = false;
  #fatal = false;
  #lastInbound: string | null = null;
  #lastOutbound: string | null = null;
  #botLink: string | null = null;
  #stopping: Promise<void> | undefined;

  constructor(api: TelegramApi, clock: Clock = realClock, polling?: TelegramRemoteOptions) {
    this.#api = api; this.#clock = clock; this.#polling = polling;
  }

  #track<T>(operation: () => Promise<T>): Promise<T> {
    const work = Promise.resolve().then(() => {
      if (this.#stopped || this.#fatal) throw new Error('Telegram remote is stopped');
      return operation();
    }).catch(error => {
      if (!this.#abort.signal.aborted && error instanceof TelegramError && [401, 403, 409].includes(error.code)) {
        const cause = error.code === 401 ? 'wrong or revoked token (401)' : error.code === 403 ? 'bot blocked (403)' : 'another consumer of the token (409)';
        const fix = error.code === 401 ? 'set a new token with cland secret set telegram.token, then run cland hub reload'
          : error.code === 403 ? 'unblock the bot in Telegram, then run cland hub reload' : 'stop the other token consumer, then run cland hub reload';
        if (!this.#fatal) {
          this.#fatal = true;
          this.#stopped = true;
          this.#abort.abort();
          this.#polling?.notice?.(cause, fix);
        }
        throw new Error(`${error.message}; ${cause}; ${fix}`);
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

  start(_send: (frame: Record<string, unknown>) => void, pair?: (identity: Pairing) => string | null, signal?: AbortSignal): Promise<void> {
    this.#pair = pair;
    return this.#track(() => this.#check(signal));
  }
  receive(): void {}

  run(): Promise<void> {
    return this.#running ??= this.#track(async () => {
      if (!this.#polling) return; // Previous injected clients keep their check/send-only lifetime.
      const handlers = [...this.#polling.handlers ?? [], ...(this.#pair ? [{
        kind: 'pairing' as const,
        accepts: () => true, // The poller admits only a private, numeric-identity /start here.
        handle: async (update: TgUpdate) => {
          const message = update.message!;
          const identity = { userId: String(message.from!.id), chatId: String(message.chat.id),
            guildId: null, name: message.from!.first_name };
          const paired = this.#polling!.store.pairing();
          const reply = paired?.userId === identity.userId && paired.chatId === identity.chatId
            ? `Paired with ${this.#polling!.projectName?.() ?? 'this project'}.`
            : this.#pair!(identity);
          if (reply !== null) await this.#send(identity.chatId, reply);
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
      }];
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

  async #send(chat: string, text: string): Promise<void> {
    await this.#api.sendMessage({ chat_id: chat, text }, { signal: this.#abort.signal });
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
