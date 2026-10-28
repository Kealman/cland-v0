import { DiscordInbound } from './discord-inbound.ts';
import type { DiscordMessage } from './discord-api.ts';
import { mirrorOut } from './mirror.ts';
import { DiscordOutbox } from './discord-outbox.ts';
import { randomUUID } from 'node:crypto';
import type { Remote, RemoteSend } from './gateway.ts';
import type { Pairing, RemoteStore } from './state.ts';
import type { HubFrame, RemoteConnection } from '../protocol.ts';
import type { Clock } from '../hub/clock.ts';
import type { LogFn } from '../log.ts';
import { registerCommands, DiscordCommands } from './discord-commands.ts';
import { DiscordApi } from './discord-api.ts';
import { DiscordSocket, discordGatewayUrl, type DiscordDispatch } from './discord-socket.ts';
export type DiscordRemoteOptions = { store?: RemoteStore; projectName?: () => string; log?: LogFn; notice?: (cause: string, fix: string) => void; fake?: boolean; random?: () => number; handlers?: Array<(frame: DiscordDispatch) => void> };

/** Native credentials and dispatch data stay behind the gateway's frame port. */
export class DiscordRemote implements Remote {
  readonly id = 'discord'; readonly via = 'discord';
  readonly #api: DiscordApi; readonly #token: string; readonly #options: DiscordRemoteOptions;
  readonly #commands: DiscordCommands;
  readonly #outbox: DiscordOutbox | undefined;
  #inbound: DiscordInbound | undefined; #bot: string | undefined;
  #detachStartup: (() => void) | undefined;
  readonly #socket: DiscordSocket; readonly #abort = new AbortController();
  readonly #listeners = new Set<() => void>();
  #application: string | undefined; #running: Promise<void> | undefined; #failure: string | undefined;
  constructor(api: DiscordApi, token: string, clock: Clock, options: DiscordRemoteOptions = {}) {
    this.#commands = new DiscordCommands(api, clock, options.store, options.projectName ?? (() => 'cland'), this.#abort.signal);
    this.#outbox = options.store ? new DiscordOutbox(api, options.store, clock, this.#abort.signal) : undefined;
    this.#api = api; this.#token = token; this.#options = options;
    this.#socket = new DiscordSocket(clock, () => { for (const listener of this.#listeners) listener(); }, options.random);
  }
  subscribe(changed: () => void): () => void { this.#listeners.add(changed); return () => { this.#listeners.delete(changed); }; }
  async start(_send: RemoteSend, _pair?: (identity: Pairing) => string | null, signal?: AbortSignal): Promise<void> {
    const cancel = () => {
      this.#abort.abort();
      void this.#outbox?.stop().catch(() => {});
    };
    signal?.addEventListener('abort', cancel, { once: true });
    this.#detachStartup = () => signal?.removeEventListener('abort', cancel);
    if (signal?.aborted) cancel();
    this.#abort.signal.throwIfAborted();
    this.#commands.start(_pair);
    if (this.#options.store) this.#inbound = new DiscordInbound(this.#options.store, _send, this.#abort.signal);
    try {
      const application = await this.#api.getCurrentApplication({ signal: signal ? AbortSignal.any([signal, this.#abort.signal]) : this.#abort.signal });
      if (!/^\d+$/.test(application.id)) throw new Error('invalid application id');
      this.#application = application.id;
      await registerCommands(this.#api, application.id, signal ? AbortSignal.any([signal, this.#abort.signal]) : this.#abort.signal);
      await this.#outbox?.resume();
    } catch { if (!this.#abort.signal.aborted && !signal?.aborted) await this.stopWith('application check failed', 'check the token and run cland hub reload'); throw new Error('Discord application check failed'); }
  }
  receive(frame: HubFrame): void | Promise<void> {
    this.#inbound?.receive(frame);
    if (this.#abort.signal.aborted || frame.type !== 'message' || frame.topic.id !== 'general') return;
    const pairing = this.#options.store?.pairing();
    const mirrored = mirrorOut(frame.message, 'discord');
    if (pairing && mirrored) return this.#outbox?.send(pairing.chatId, `${mirrored.header}\n${mirrored.text}`, frame.message.id);
  }
  run(): Promise<void> {
    return this.#running ??= (async () => {
      try {
        const gateway = await this.#api.getGatewayBot({ signal: this.#abort.signal });
        if (this.#abort.signal.aborted) return;
        const url = discordGatewayUrl(gateway.url, this.#options.fake ?? false);
        await this.#socket.run(url, this.#token, frame => {
          // Never log payloads or arbitrary provider strings, only allowlisted types and snowflakes.
          const type = frame.t && /^[A-Z_]{1,64}$/.test(frame.t) ? frame.t : 'UNKNOWN';
          const ids = Object.fromEntries(Object.entries(frame.d ?? {}).filter(([key, value]) => ['id', 'channel_id', 'guild_id'].includes(key) && typeof value === 'string' && /^\d+$/.test(value)));
          this.#options.log?.({ event: 'discord-dispatch', type, ...ids });
          this.#commands.dispatch(frame);
          for (const handler of this.#options.handlers ?? []) handler(frame);
          if (frame.t === 'READY') this.#bot = (frame.d.user as { id?: string } | undefined)?.id;
          if (frame.t === 'MESSAGE_CREATE' && this.#bot && (frame.d.author as { id?: string } | undefined)?.id === this.#bot) this.#outbox?.observe(frame.d as DiscordMessage);
          else this.#inbound?.dispatch(frame);
        });
      } catch (error) {
        if (this.#abort.signal.aborted) return;
        const reason = error instanceof Error && error.message.startsWith('Discord gateway URL refused:') ? error.message : 'Discord gateway connection failed';
        await this.stopWith(reason, 'check Discord configuration and run cland hub reload');
        throw new Error(this.#failure);
      }
    })();
  }
  async stopWith(cause: string, detail: string): Promise<void> {
    if (this.#failure) return;
    this.#failure = `${cause}; ${detail}`;
    this.#options.store?.setStatus({ disabled: true, reason: this.#failure });
    this.#options.notice?.(cause, detail);
    this.#abort.abort(); await this.#socket.stop();
  }
  status(): RemoteConnection {
    return { connected: !this.#abort.signal.aborted && this.#socket.connected(), lastInbound: this.#socket.lastInbound,
      lastOutbound: this.#socket.lastOutbound, botLink: this.#application ? `https://discord.com/oauth2/authorize?client_id=${this.#application}&scope=bot&permissions=117824` : null,
      lastError: this.#failure ?? null };
  }
  async pairingApproved(pairing: Pairing): Promise<void> { if (this.#application) await this.#commands.approved(pairing, this.#application); }
  async pairingReplaced(previous: Pairing, text: string): Promise<void> {
    await this.#api.createMessage(previous.chatId, { content: text, nonce: randomUUID().replaceAll('-', '').slice(0, 25) }, { signal: this.#abort.signal });
  }
  async stop(): Promise<void> { this.#abort.abort(); await this.#socket.stop(); await this.#running?.catch(() => {}); await this.#commands.stop(); await this.#outbox?.stop(); await this.#inbound?.stop(); this.#detachStartup?.(); }
}
