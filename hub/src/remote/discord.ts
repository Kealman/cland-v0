import { DiscordInbound } from './discord-inbound.ts';
import type { DiscordMessage } from './discord-api.ts';
import { mirrorOut } from './mirror.ts';
import { DiscordOutbox } from './discord-outbox.ts';
import { randomUUID } from 'node:crypto';
import type { Remote, RemoteSend } from './gateway.ts';
import type { Pairing, RemoteStore } from './state.ts';
import type { HubFrame, RemoteConnection } from '../protocol.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import type { LogFn } from '../log.ts';
import { registerCommands, DiscordCommands } from './discord-commands.ts';
import { remoteStopCause, remoteStopDetails, remoteStopError } from './notices.ts';
import { DiscordApi, DiscordError } from './discord-api.ts';
import { DiscordSocket, discordGatewayUrl, type DiscordDispatch } from './discord-socket.ts';
export type DiscordRemoteOptions = { store?: RemoteStore; projectName?: () => string; log?: LogFn; notice?: (cause: string, fix: string, transition?: boolean) => void; fake?: boolean; random?: () => number; handlers?: Array<(frame: DiscordDispatch) => void> };

/** Native credentials and dispatch data stay behind the gateway's frame port. */
export class DiscordRemote implements Remote {
  readonly id = 'discord'; readonly via = 'discord';
  readonly #clock: Clock;
  #offline: { since: string; announced: boolean } | undefined;
  #offlineTimer: ClockTimer | undefined;
  readonly #api: DiscordApi; readonly #token: string; readonly #options: DiscordRemoteOptions;
  readonly #commands: DiscordCommands;
  readonly #outbox: DiscordOutbox | undefined;
  #inbound: DiscordInbound | undefined; #bot: string | undefined;
  #restFailedChannel: string | undefined;
  #detachExchange: (() => void) | undefined;
  #detachApi: (() => void) | undefined;
  #fatal: Error | undefined;
  #terminal: Promise<void> | undefined;
  #detachStartup: (() => void) | undefined;
  readonly #socket: DiscordSocket; readonly #abort = new AbortController();
  readonly #listeners = new Set<() => void>();
  #application: string | undefined; #running: Promise<void> | undefined; #failure: string | undefined;
  constructor(api: DiscordApi, token: string, clock: Clock, options: DiscordRemoteOptions = {}) {
    this.#clock = clock;
    this.#commands = new DiscordCommands(api, clock, options.store, options.projectName ?? (() => 'cland'), this.#abort.signal);
    this.#outbox = options.store ? new DiscordOutbox(api, options.store, clock, this.#abort.signal) : undefined;
    this.#api = api; this.#token = token; this.#options = options;
    this.#detachApi = api.onError((error, channel) => {
      if (['POST /channels/:channel/messages', 'PATCH /channels/:channel/messages/:message'].includes(error.route))
        options.log?.({ event: 'discord-rest-refused', route: error.route, status: error.status,
          ...(error.code !== undefined ? { code: error.code } : {}) });
      if (error.status === 401 || error.code === 40001 || error.code === 50014) {
        this.#fatal ??= remoteStopError('discord', 'token');
        void this.#failed(this.#fatal, '').catch(() => {});
      } else if (channel && options.store?.pairing()?.chatId === channel && [403, 404].includes(error.status)
        && !(error.status === 404 && (error.route.startsWith('PATCH ') || error.route.includes('/reactions/')))) {
        this.#fatal ??= remoteStopError('discord', 'blocked', `REST ${error.status}`);
        void this.#failed(this.#fatal, '').catch(() => {});
      }
    });
    this.#detachExchange = api.onExchange((channel, ok) => {
      if (this.#abort.signal.aborted || options.store?.pairing()?.chatId !== channel) return;
      this.#restFailedChannel = ok ? undefined : channel;
      this.#connectionChanged();
      for (const listener of this.#listeners) listener();
    });
    this.#socket = new DiscordSocket(clock, () => { this.#connectionChanged(); for (const listener of this.#listeners) listener(); }, options.random);
  }
  #connectionChanged(): void {
    if (this.#abort.signal.aborted) return;
    if (this.#socket.connected() && !this.#restFailed()) {
      const outage = this.#offline;
      this.#clock.clearTimeout(this.#offlineTimer); this.#offline = undefined;
      if (outage?.announced) this.#options.notice?.(`recovered; offline since ${outage.since.slice(11, 16)}`, '', true);
    } else if (!this.#offline) {
      const outage: { since: string; announced: boolean } = this.#offline = { since: this.#clock.now().toISOString(), announced: false };
      this.#offlineTimer = this.#clock.setTimeout(() => {
        if (this.#abort.signal.aborted || this.#offline !== outage) return;
        outage.announced = true;
        this.#options.notice?.(`offline since ${outage.since.slice(11, 16)}: ${this.#restFailed() ? 'REST sends unavailable' : 'gateway connection unavailable'}`, '', true);
      }, 180000);
      this.#offlineTimer.unref();
    }
  }
  #restFailed(): boolean { return this.#restFailedChannel !== undefined && this.#restFailedChannel === this.#options.store?.pairing()?.chatId; }
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
      if (!(application.flags & ((1 << 18) | (1 << 19)))) throw remoteStopError('discord', 'message-content');
      if (application.interactions_endpoint_url) throw remoteStopError('discord', 'interactions-endpoint');
      this.#application = application.id;
      await registerCommands(this.#api, application.id, signal ? AbortSignal.any([signal, this.#abort.signal]) : this.#abort.signal);
      await this.#outbox?.resume();
    } catch (error) {
      if (!this.#abort.signal.aborted && !signal?.aborted) await this.#failed(error, 'application check failed');
      await this.#outwardError(error);
    }
  }
  receive(frame: HubFrame): void | Promise<void> {
    this.#inbound?.receive(frame);
    if (this.#abort.signal.aborted || frame.type !== 'message' || frame.topic.id !== 'general') return;
    const pairing = this.#options.store?.pairing();
    const mirrored = mirrorOut(frame.message, 'discord');
    if (pairing && mirrored) return this.#outbox?.send(pairing.chatId, `${mirrored.header}\n${mirrored.text}`, frame.message.id).catch(error => this.#outwardError(error));
  }
  run(): Promise<void> {
    return this.#running ??= (async () => {
      try {
        this.#connectionChanged();
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
        if (this.#fatal) await this.#outwardError(this.#fatal);
      } catch (error) {
        if (this.#fatal) await this.#outwardError(this.#fatal);
        if (this.#abort.signal.aborted) return;
        const reason = error instanceof Error && error.message.startsWith('Discord gateway URL refused:') ? error.message : 'Discord gateway connection failed';
        await this.#failed(error, reason);
        throw new Error(this.#failure);
      }
    })();
  }
  async #failed(error: unknown, fallback: string): Promise<void> {
    const cause = remoteStopCause(error) ?? (error instanceof DiscordError && (error.status === 401 || error.code === 40001 || error.code === 50014) ? 'token' : undefined);
    if (cause) {
      const details = remoteStopDetails('discord', cause)!;
      const stopped = remoteStopCause(error) ? error as Error : remoteStopError('discord', cause);
      const code = stopped.message.match(/; close code \d+$/)?.[0] ?? '';
      await this.stopWith(details.cause + code, details.fix, stopped);
      throw stopped;
    }
    await this.stopWith(fallback, 'check Discord configuration and run cland hub reload');
  }
  async #outwardError(error: unknown): Promise<never> {
    if (this.#fatal) { await this.#terminal; throw this.#fatal; }
    throw error;
  }
  stopWith(cause: string, detail: string, error?: Error): Promise<void> {
    return this.#terminal ??= (async () => {
      this.#failure = error?.message ?? `${cause}; ${detail}`;
      const stopCause = remoteStopCause(error);
      this.#options.store?.setStatus({ disabled: true, reason: this.#failure, ...(stopCause ? { stopCause } : {}) });
      this.#options.notice?.(cause, detail);
      this.#abort.abort(); this.#clock.clearTimeout(this.#offlineTimer); await this.#socket.stop(1000);
    })();
  }
  status(): RemoteConnection {
    return { connected: !this.#abort.signal.aborted && !this.#restFailed() && this.#socket.connected(), lastInbound: this.#socket.lastInbound,
      lastOutbound: this.#socket.lastOutbound, botLink: this.#application ? `https://discord.com/oauth2/authorize?client_id=${this.#application}&scope=bot&permissions=117824` : null,
      lastError: this.#failure ?? null };
  }
  async test(pairing: Pairing | null, text: string): Promise<void> {
    try {
      const app = await this.#api.getCurrentApplication({ signal: this.#abort.signal });
      if (!(app.flags & ((1 << 18) | (1 << 19)))) throw remoteStopError('discord', 'message-content');
      if (app.interactions_endpoint_url) throw remoteStopError('discord', 'interactions-endpoint');
      if (pairing) await this.#api.createMessage(pairing.chatId, { content: text, nonce: randomUUID().replaceAll('-', '').slice(0, 25) }, { signal: this.#abort.signal });
    } catch (error) { await this.#failed(this.#fatal ?? error, 'application check failed'); throw error; }
  }
  async pairingApproved(pairing: Pairing): Promise<void> { if (this.#application) await this.#commands.approved(pairing, this.#application).catch(error => this.#outwardError(error)); }
  async pairingReplaced(previous: Pairing, text: string): Promise<void> {
    await this.#api.createMessage(previous.chatId, { content: text, nonce: randomUUID().replaceAll('-', '').slice(0, 25) }, { signal: this.#abort.signal }).catch(error => this.#outwardError(error));
  }
  async stop(): Promise<void> { this.#abort.abort(); this.#clock.clearTimeout(this.#offlineTimer); await this.#terminal; await this.#socket.stop(); await this.#running?.catch(() => {}); await this.#commands.stop(); await this.#outbox?.stop(); await this.#inbound?.stop(); this.#detachStartup?.(); this.#detachApi?.(); this.#detachExchange?.(); }
}
