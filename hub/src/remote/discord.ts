import { flushGap } from './gap.ts';
import { catchDiscordHistory, discordLateText } from './discord-catchup.ts';
import { DiscordCards } from './discord-cards.ts';
import { DiscordIdentifyBudget } from './discord-identify.ts';
import { DiscordInbound } from './discord-inbound.ts';
import type { DiscordMessage } from './discord-api.ts';
import { renderDiscord } from './discord-render.ts';
import { mirrorOut } from './mirror.ts';
import { DiscordOutbox } from './discord-outbox.ts';
import { randomUUID } from 'node:crypto';
import type { Remote, RemoteSend, RemoteReceipt } from './gateway.ts';
import type { Pairing, RemoteStore } from './state.ts';
import type { HubFrame, RemoteConnection } from '../protocol.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import type { LogFn } from '../log.ts';
import { registerCommands, DiscordCommands } from './discord-commands.ts';
import { remoteStopCause, remoteStopDetails, remoteStopError } from './notices.ts';
import { DiscordApi, DiscordError } from './discord-api.ts';
import { DiscordSocket, discordGatewayUrl, type DiscordDispatch } from './discord-socket.ts';
export type DiscordRemoteOptions = { store?: RemoteStore; projectName?: () => string; webOrigin?: () => string; log?: LogFn; notice?: (cause: string, fix: string, transition?: boolean) => void; fake?: boolean; random?: () => number; historyLimit?: number; handlers?: Array<(frame: DiscordDispatch) => void> };

/** Native credentials and dispatch data stay behind the gateway's frame port. */
export class DiscordRemote implements Remote {
  readonly id = 'discord'; readonly via = 'discord';
  readonly #clock: Clock;
  #offline: { since: string; announced: boolean } | undefined;
  #offlineTimer: ClockTimer | undefined;
  readonly #api: DiscordApi; readonly #token: string; readonly #options: DiscordRemoteOptions;
  readonly #commands: DiscordCommands;
  readonly #outbox: DiscordOutbox | undefined;
  readonly #cards: DiscordCards | undefined;
  #catching = false;
  #freshRecovery = false;
  #recovery: Promise<void> | undefined;
  #history: Promise<void> = Promise.resolve();
  #inbound: DiscordInbound | undefined; #bot: string | undefined;
  #restFailedChannel: string | undefined;
  #detachExchange: (() => void) | undefined;
  #detachApi: (() => void) | undefined;
  #fatal: Error | undefined;
  #disabled = false;
  #terminal: Promise<void> | undefined;
  #detachStartup: (() => void) | undefined;
  readonly #socket: DiscordSocket; readonly #abort = new AbortController();
  readonly #listeners = new Set<() => void>();
  #application: string | undefined; #running: Promise<void> | undefined; #failure: string | undefined;
  constructor(api: DiscordApi, token: string, clock: Clock, options: DiscordRemoteOptions = {}) {
    this.#clock = clock;
    this.#commands = new DiscordCommands(api, clock, options.store, options.projectName ?? (() => 'cland'), this.#abort.signal, () => this.status().connected, (inbox, key) => this.#cards?.publishInbox(inbox, key) ?? Promise.resolve(0));
    this.#outbox = options.store ? new DiscordOutbox(api, options.store, clock, this.#abort.signal) : undefined;
    this.#outbox?.holdRecovery(true);
    this.#cards = options.store && this.#outbox ? new DiscordCards(options.store, this.#outbox, api, clock, this.#abort.signal, options.log, options.webOrigin) : undefined;
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
    const budget = new DiscordIdentifyBudget(clock, options.store);
    this.#socket = new DiscordSocket(clock, () => { this.#connectionChanged(); for (const listener of this.#listeners) listener(); }, options.random, { scheduled: (connection, delay) => options.log?.({ event: 'discord-identify-scheduled', connection, delay }), delay: () => budget.delay(options.random ?? Math.random), ready: () => budget.ready(), failed: () => budget.failed(options.random ?? Math.random), reserve: () => {
      if (budget.reserve()) options.notice?.('500 identifies in the last 24 hours', 'check for repeated failed connections before the session start budget runs out', true);
    }, before: async () => {
      const { session_start_limit: limit } = await api.getGatewayBot({ signal: this.#abort.signal });
      if (!Number.isSafeInteger(limit?.remaining) || !Number.isFinite(limit.reset_after) || limit.reset_after < 0)
        throw new Error('Discord gateway sent invalid session start limit');
      if (limit.remaining < 100) throw remoteStopError('discord', 'identify-budget',
        `session starts reset at ${new Date(clock.now().getTime() + limit.reset_after).toISOString()}`);
    } }, options.store, () => this.#cards?.beginReplay());
    this.#bot = this.#socket.session?.botId;
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
  async start(_send: RemoteSend, _pair?: (identity: Pairing) => string | null, signal?: AbortSignal, receipt?: RemoteReceipt): Promise<void> {
    const cancel = () => {
      this.#abort.abort();
      void this.#outbox?.stop().catch(() => {});
    };
    signal?.addEventListener('abort', cancel, { once: true });
    this.#detachStartup = () => signal?.removeEventListener('abort', cancel);
    if (signal?.aborted) cancel();
    this.#abort.signal.throwIfAborted();
    this.#commands.start(_pair, _send);
    this.#cards?.start(_send);
    if (this.#options.store) this.#inbound = new DiscordInbound(this.#options.store, _send, this.#abort.signal, this.#outbox, receipt);
    try {
      const application = await this.#api.getCurrentApplication({ signal: signal ? AbortSignal.any([signal, this.#abort.signal]) : this.#abort.signal });
      if (!/^\d+$/.test(application.id)) throw new Error('invalid application id');
      if (!(application.flags & ((1 << 18) | (1 << 19)))) throw remoteStopError('discord', 'message-content');
      if (application.interactions_endpoint_url) throw remoteStopError('discord', 'interactions-endpoint');
      this.#application = application.id;
      await registerCommands(this.#api, application.id, signal ? AbortSignal.any([signal, this.#abort.signal]) : this.#abort.signal);
      this.#outbox?.authenticated();
    } catch (error) {
      if (!this.#abort.signal.aborted && !signal?.aborted) await this.#failed(error, 'application check failed');
      await this.#outwardError(error);
    }
  }
  receive(frame: HubFrame): void | Promise<void> {
    this.#commands.receive(frame);
    const cards = this.#cards?.receive(frame);
    const feedback = this.#inbound?.receive(frame);
    if (this.#abort.signal.aborted || frame.type !== 'message' || frame.topic.id !== 'general') return Promise.all([cards, feedback]).then(() => {});
    const pairing = this.#options.store?.pairing();
    const mirrored = mirrorOut(frame.message, 'discord');
    if (mirrored && frame.message.fromKind !== 'hub' && this.#options.store?.suppressMutedMessage(frame.message.id)) return;
    if (pairing && mirrored) return this.#outbox?.sendGroup(pairing.chatId,
      renderDiscord(mirrored.header, mirrored.text), frame.message.id, mirrored.silent)
      .catch(error => this.#outwardError(error));
  }
  run(): Promise<void> {
    return this.#running ??= (async () => {
      try {
        this.#connectionChanged();
        await this.#inbound?.recover();
        if (this.#options.store?.get('discord.history')) this.#beginHistory();
        const gateway = await this.#api.getGatewayBot({ signal: this.#abort.signal });
        if (this.#abort.signal.aborted) return;
        const url = discordGatewayUrl(gateway.url, this.#options.fake ?? false);
        await this.#socket.run(url, this.#token, frame => {
          // Never log payloads or arbitrary provider strings, only allowlisted types and snowflakes.
          const type = frame.t && /^[A-Z_]{1,64}$/.test(frame.t) ? frame.t : 'UNKNOWN';
          const ids = Object.fromEntries(Object.entries(frame.d ?? {}).filter(([key, value]) => ['id', 'channel_id', 'guild_id'].includes(key) && typeof value === 'string' && /^\d+$/.test(value)));
          this.#options.log?.({ event: 'discord-dispatch', type, ...ids });
          this.#commands.dispatch(frame);
          this.#cards?.dispatch(frame);
          for (const handler of this.#options.handlers ?? []) handler(frame);
          if (frame.t === 'READY') {
            this.#bot = (frame.d.user as { id?: string } | undefined)?.id;
            if (!this.#catching) this.#beginHistory();
            return this.#finishRecovery();
          }
          if (frame.t === 'MESSAGE_CREATE' && this.#bot && (frame.d.author as { id?: string } | undefined)?.id === this.#bot) this.#outbox?.observe(frame.d as DiscordMessage);
          else if (frame.t === 'MESSAGE_CREATE') {
            const input = () => {
              this.#inbound?.dispatch(frame.replayed && typeof frame.d.content === 'string' && frame.d.content.trim()
                ? { ...frame, d: { ...frame.d, content: discordLateText(frame.d.content, frame.d.timestamp, frame.returnedAt ?? this.#clock.now().toISOString()) } } : frame);
              return this.#inbound?.idle();
            };
            return this.#catching ? this.#history.then(input) : input();
          }
          const inbound = this.#inbound?.idle();
          if (frame.t === 'RESUMED') {
            this.#options.log?.({ event: 'discord-replay-drain-waiting' });
            return this.#finishRecovery();
          }
          return Promise.all([inbound, this.#cards?.idle()]).then(() => {});
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
  #beginHistory(): void {
    this.#outbox?.holdRecovery(true); this.#cards?.beginHistory();
    this.#freshRecovery = true; this.#catching = true;
    const store = this.#options.store;
    this.#history = (store && this.#inbound && this.#outbox
      ? catchDiscordHistory(this.#api, store, this.#inbound, this.#clock.now().toISOString(), this.#abort.signal,
        key => this.#outbox!.recoveryWarning(store.pairing()!.chatId, 'Older Discord messages were not passed on.', key), this.#options.historyLimit)
      : Promise.resolve()).then(() => { this.#catching = false; });
    void this.#history.catch(() => {});
  }
  #finishRecovery(): Promise<void> {
    return this.#recovery ??= this.#finishRecoveryWork().finally(() => { this.#recovery = undefined; });
  }
  async #finishRecoveryWork(): Promise<void> {
    await this.#history;
    // Queued native input attaches to the same history owner. Let those
    // continuations install their FIFO work before taking its completion receipt.
    await Promise.resolve();
    await this.#inbound?.idle();
    const store = this.#options.store;
    if (!store || !this.#outbox) return;
    await flushGap(store, this.#clock, { stateKey: 'discord.gap', matches: (job, pair) => {
      const p = job.payload as { discord?: boolean; channel?: string; user?: string };
      return p?.discord === true && p.channel === pair.chatId && p.user === pair.userId;
    } }, (chat, text, key) => this.#outbox!.recoveryWarning(chat, text, key));
    this.#outbox.holdRecovery(false);
    if (this.#freshRecovery) {
      let key = store.get('discord.history-recovery');
      if (!key) { key = randomUUID(); store.set('discord.history-recovery', key); }
      await this.#cards?.finishHistory(key);
      store.set('discord.history-recovery', null);
      this.#freshRecovery = false;
    } else await this.#cards?.finishReplay();
    await this.#outbox.resume();
  }
  async #failed(error: unknown, fallback: string): Promise<void> {
    const cause = remoteStopCause(error) ?? (error instanceof DiscordError && (error.status === 401 || error.code === 40001 || error.code === 50014) ? 'token' : undefined);
    if (cause) {
      const details = remoteStopDetails('discord', cause)!;
      const stopped = remoteStopCause(error) ? error as Error : remoteStopError('discord', cause);
      const code = stopped.message.match(/; (?:close code \d+|session starts reset at [0-9TZ:.\-]+)$/)?.[0] ?? '';
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
  disable(): void { this.#disabled = true; this.#options.store?.set('discord.session', null); }
  async stop(): Promise<void> { this.#abort.abort(); this.#clock.clearTimeout(this.#offlineTimer); await this.#terminal; await this.#socket.stop(this.#disabled ? 1000 : 4000); await this.#running?.catch(() => {}); await this.#commands.stop(); await this.#cards?.stop(); await this.#outbox?.stop(); await this.#inbound?.stop(); this.#detachStartup?.(); this.#detachApi?.(); this.#detachExchange?.(); }
}
