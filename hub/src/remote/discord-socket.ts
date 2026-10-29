import type { RemoteStore } from './state.ts';
import { remoteStopError } from './notices.ts';
import { WebSocket } from 'ws';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import { within } from '../executor/droplet/deadline.ts';
type IdentifyAdmission = { before: () => Promise<void>; delay: () => number; reserve: () => void; ready: () => void; failed: () => void; scheduled?: (connection: number, delay: number) => void };
export type DiscordDispatch = { op: number; t?: string; s?: number; d: Record<string, unknown>; replayed?: boolean; returnedAt?: string };

/** Validate before constructing a socket: no redirects, credentials or foreign hosts. */
export function discordGatewayUrl(value: string, fake: boolean): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Discord gateway URL refused: expected a known Discord host'); }
  const allowed = fake
    ? url.protocol === 'ws:' && ['127.0.0.1', '[::1]'].includes(url.hostname) && !!url.port
    : url.protocol === 'wss:' && (url.hostname === 'discord.gg' || url.hostname.endsWith('.discord.gg')) && (!url.port || url.port === '443');
  if (!allowed || url.username || url.password || url.hash || url.search)
    throw new Error('Discord gateway URL refused: expected a known Discord host or explicit loopback fake');
  url.search = '?v=10&encoding=json';
  return url.href;
}

export class DiscordSocket {
  readonly #clock: Clock;
  readonly #random: () => number;
  readonly #changed: () => void;
  readonly #identify: IdentifyAdmission | undefined;
  readonly #store: RemoteStore | undefined;
  readonly #resumeStarted: (() => void) | undefined;
  #replaying = false;
  #connection = 0;
  #identifyTimer: ClockTimer | undefined;
  #socket: WebSocket | undefined;
  #timer: ClockTimer | undefined;
  #interval = 0;
  #awaitingAck = false;
  #reconnect: ClockTimer | undefined;
  #retryDelay: number | undefined;
  readonly #seenInteractions = new Set<string>();
  #ack: number | undefined;
  #ready = false;
  #stopping = false;
  #stopped: Promise<void> | undefined;
  #freshIdentifyUsed = false;
  #sequence: number | null = null;
  #committedSequence: number | null = null;
  #dispatchTail: Promise<void> = Promise.resolve();
  #closed = Promise.withResolvers<void>();
  #completion = Promise.withResolvers<void>();
  session: { id: string; resumeUrl: string; botId: string } | undefined;
  lastInbound: string | null = null;
  lastOutbound: string | null = null;
  constructor(clock: Clock, changed: () => void, random = Math.random, identify?: IdentifyAdmission, store?: RemoteStore, resumeStarted?: () => void) {
    this.#store = store; this.#resumeStarted = resumeStarted;
    const saved = store?.get('discord.session');
    if (saved) {
      const record = JSON.parse(saved);
      this.session = record.session; this.#sequence = record.sequence; this.#committedSequence = record.sequence;
    }
    this.#clock = clock; this.#changed = changed; this.#random = random; this.#identify = identify;
  }
  connected(): boolean { return !this.#stopping && this.#ready && this.#ack !== undefined && this.#clock.now().getTime() - this.#ack <= this.#interval; }
  run(url: string, token: string, dispatch: (frame: DiscordDispatch) => void | Promise<void>): Promise<void> {
    if (this.session) url = discordGatewayUrl(this.session.resumeUrl, url.startsWith('ws:'));
    const socket = this.#socket = new WebSocket(url, { perMessageDeflate: false, followRedirects: false, handshakeTimeout: 10_000, maxPayload: 4 * 1024 * 1024 });
    const connection = ++this.#connection;
    let identified = false, reachedReady = false;
    let returnedAt: string | undefined;
    const fail = () => { if (!this.#stopping) socket.terminate(); };
    const send = (frame: unknown) => {
      if (socket.readyState !== WebSocket.OPEN || this.#stopping) return;
      socket.send(JSON.stringify(frame)); this.lastOutbound = this.#clock.now().toISOString();
    };
    const heartbeat = () => { this.#awaitingAck = true; send({ op: 1, d: this.#sequence }); };
    const schedule = (delay: number) => {
      this.#timer = this.#clock.setTimeout(() => {
        if (this.#awaitingAck) { this.#ready = false; socket.terminate(); this.#changed(); return; }
        heartbeat(); this.#changed(); schedule(this.#interval);
      }, delay); this.#timer.unref();
    };
    socket.on('message', bytes => {
      if (this.#stopping) return;
      let frame: DiscordDispatch;
      try { frame = JSON.parse(String(bytes)); } catch { this.#completion.reject(new Error('Discord gateway sent invalid JSON')); return; }
      if (!frame || typeof frame !== 'object' || !Number.isInteger(frame.op)) { this.#completion.reject(new Error('Discord gateway sent invalid frame')); return; }
      this.lastInbound = this.#clock.now().toISOString();
      if (frame.op === 10) {
        const interval = frame.d?.heartbeat_interval;
        if (this.#interval || typeof interval !== 'number' || !Number.isFinite(interval) || interval < 1 || interval > 2 ** 31 - 1) {
          this.#completion.reject(new Error('Discord gateway sent invalid Hello')); return;
        }
        this.#interval = interval;
        schedule(interval * this.#random());
        if (this.session) { this.#resumeStarted?.(); this.#replaying = true; returnedAt = this.#clock.now().toISOString(); send({ op: 6, d: { token, session_id: this.session.id, seq: this.#sequence } }); }
        else {
          const identify = async () => {
            if (socket !== this.#socket || socket.readyState !== WebSocket.OPEN || this.#stopping) return;
            await this.#identify?.before();
            if (socket !== this.#socket || socket.readyState !== WebSocket.OPEN || this.#stopping) return;
            this.#identify?.reserve(); identified = true;
            send({ op: 2, d: { token, intents: 33281, properties: { os: process.platform, browser: 'cland', device: 'cland' } } });
          };
          const delay = this.#identify?.delay() ?? 0;
          const attempt = () => { void identify().catch(error => {
            if (socket === this.#socket && !this.#stopping) this.#completion.reject(error);
          }); };
          if (delay > 0) {
            this.#identifyTimer = this.#clock.setTimeout(attempt, Math.ceil(delay));
            this.#identifyTimer.unref();
          } else attempt();
          this.#identify?.scheduled?.(connection, Math.ceil(delay));
        }
      } else if (frame.op === 1) heartbeat();
      else if (frame.op === 11) { this.#ack = this.#clock.now().getTime(); this.#awaitingAck = false; }
      else if (frame.op === 7 || frame.op === 9) {
        if (frame.op === 9 && (frame.d as unknown) !== true) {
          this.session = undefined; this.#sequence = null; this.#store?.set('discord.session', null); this.#replaying = false;
          this.#retryDelay = 1000 + this.#random() * 4000;
        }
        this.#ready = false; socket.terminate();
      }
      else if (frame.op === 0) {
        if (Number.isSafeInteger(frame.s)) this.#sequence = frame.s!;
        if (frame.t === 'READY') {
          const user = frame.d?.user as { id?: unknown } | undefined;
          if (typeof frame.d?.session_id !== 'string' || typeof frame.d.resume_gateway_url !== 'string' || typeof user?.id !== 'string' || !/^\d+$/.test(user.id)) {
            this.#completion.reject(new Error('Discord gateway sent invalid READY')); return;
          }
          try { discordGatewayUrl(frame.d.resume_gateway_url, url.startsWith('ws:')); } catch { this.#completion.reject(new Error('Discord gateway sent invalid resume URL')); return; }
          this.#identify?.ready(); reachedReady = true;
          this.session = { id: frame.d.session_id, resumeUrl: frame.d.resume_gateway_url, botId: user.id }; this.#ready = true;
        }
        if (frame.t === 'RESUMED') { this.#ready = true; this.#replaying = false; }
        if (this.#replaying) { frame.replayed = true; if (returnedAt !== undefined) frame.returnedAt = returnedAt; }
        if (frame.t === 'INTERACTION_CREATE' && typeof frame.d.id === 'string' && /^\d+$/.test(frame.d.id)) {
          if (this.#seenInteractions.has(frame.d.id) || this.#store?.get(`discord.interaction:${frame.d.id}`)) return;
          this.#seenInteractions.add(frame.d.id);
        }
        let work: Promise<void>;
        try { work = Promise.resolve(dispatch(frame)); }
        catch { work = Promise.reject(new Error('Discord gateway dispatch failed')); }
        void work.catch(() => {});
        // Native deadlines remain independent; only confirmation waits in order.
        this.#dispatchTail = this.#dispatchTail.then(() => work).then(() => {
          if (Number.isSafeInteger(frame.s)) this.#committedSequence = frame.s!;
          if (frame.t === 'INTERACTION_CREATE' && typeof frame.d.id === 'string' && /^\d+$/.test(frame.d.id)) this.#store?.set(`discord.interaction:${frame.d.id}`, '1');
        });
        void this.#dispatchTail.catch(() => { if (!this.#stopping) this.#completion.reject(new Error('Discord gateway dispatch failed')); });
      }
      this.#changed();
    });
    socket.on('error', fail);
    socket.once('close', code => {
      this.#ready = false; this.#closed.resolve(); this.#clock.clearTimeout(this.#timer); this.#clock.clearTimeout(this.#identifyTimer);
      if (this.#stopping) { this.#changed(); return; }
      if (identified && !reachedReady) this.#identify?.failed();
      if (code === 4004 || (code >= 4010 && code <= 4014) || (code === 4003 && this.#freshIdentifyUsed)) {
        this.#completion.reject(remoteStopError('discord', code === 4004 ? 'token' : code === 4014 ? 'message-content' : 'gateway-refused', `close code ${code}`));
      } else {
        if (code === 1000 || code === 1001 || code === 4003 || code === 4007 || code === 4009) {
          if (code === 4003) this.#freshIdentifyUsed = true;
          this.session = undefined; this.#sequence = null; this.#store?.set('discord.session', null); this.#replaying = false;
        }
        const delay = this.#retryDelay ?? 0;
        this.#retryDelay = undefined;
        const reconnect = () => {
          if (this.#stopping) return;
          this.#interval = 0; this.#ack = undefined; this.#awaitingAck = false;
          this.#closed = Promise.withResolvers<void>();
          void this.run(this.session ? discordGatewayUrl(this.session.resumeUrl, url.startsWith('ws:')) : url, token, dispatch);
        };
        if (code === 4003) reconnect();
        else { this.#reconnect = this.#clock.setTimeout(reconnect, delay); this.#reconnect.unref(); }
      }
      this.#changed();
    });
    return this.#completion.promise;
  }
  async stop(code: 1000 | 4000 = 4000): Promise<void> {
    if (code === 1000) { this.session = undefined; this.#sequence = null; this.#committedSequence = null; this.#store?.set('discord.session', null); }
    return this.#stopped ??= this.#stop(code);
  }
  async #stop(code: 1000 | 4000): Promise<void> {
    this.#stopping = true; this.#clock.clearTimeout(this.#timer); this.#clock.clearTimeout(this.#reconnect); this.#clock.clearTimeout(this.#identifyTimer);
    if (this.#socket && this.#socket.readyState !== WebSocket.CLOSED) {
      this.#socket.close(code);
    }
    if (this.#socket) {
      try { await within(this.#closed.promise, 2000); }
      catch { this.#socket.terminate(); await within(this.#closed.promise, 2000); }
    }
    await this.#dispatchTail.catch(() => {});
    this.#store?.set('discord.session', code === 4000 && this.session ? JSON.stringify({ session: this.session, sequence: this.#committedSequence, stoppedAt: this.#clock.now().toISOString() }) : null);
    this.#completion.resolve(); this.#changed();
  }
}
