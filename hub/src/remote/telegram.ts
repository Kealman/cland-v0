import type { Remote } from './gateway.ts';
import type { Pairing } from './state.ts';
import type { RemoteConnection } from '../protocol.ts';
import { realClock, type Clock } from '../hub/clock.ts';
import { TelegramApi } from './telegram-api.ts';
import { pollTelegram, type TelegramPollingOptions } from './telegram-polling.ts';

/** The gateway owns this client's lifetime, including explicit tests and old-chat notices. */
export class TelegramRemote implements Remote {
  readonly id = 'telegram';
  readonly via = 'telegram';
  readonly #api: TelegramApi;
  readonly #clock: Clock;
  readonly #abort = new AbortController();
  readonly #work = new Set<Promise<unknown>>();
  readonly #polling: TelegramPollingOptions | undefined;
  #botId = 0;
  #running: Promise<void> | undefined;
  #stopped = false;
  #lastInbound: string | null = null;
  #lastOutbound: string | null = null;
  #botLink: string | null = null;
  #stopping: Promise<void> | undefined;

  constructor(api: TelegramApi, clock: Clock = realClock, polling?: TelegramPollingOptions) {
    this.#api = api; this.#clock = clock; this.#polling = polling;
  }

  #track<T>(operation: () => Promise<T>): Promise<T> {
    const work = Promise.resolve().then(() => {
      if (this.#stopped) throw new Error('Telegram remote is stopped');
      return operation();
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

  start(_send: (frame: Record<string, unknown>) => void, _pair?: (identity: Pairing) => string | null, signal?: AbortSignal): Promise<void> {
    return this.#track(() => this.#check(signal));
  }
  receive(): void {}

  run(): Promise<void> {
    return this.#running ??= this.#track(async () => {
      if (!this.#polling) return; // Previous injected clients keep their check/send-only lifetime.
      await pollTelegram(this.#api, this.#clock, this.#botId, this.#polling, this.#abort.signal,
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
