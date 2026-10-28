import { WebSocket } from 'ws';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import { within } from '../executor/droplet/deadline.ts';
export type DiscordDispatch = { op: number; t?: string; s?: number; d: Record<string, unknown> };

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
  #socket: WebSocket | undefined;
  #timer: ClockTimer | undefined;
  #interval = 0;
  #ack: number | undefined;
  #ready = false;
  #stopping = false;
  #sequence: number | null = null;
  #closed = Promise.withResolvers<void>();
  #completion = Promise.withResolvers<void>();
  session: { id: string; resumeUrl: string; botId: string } | undefined;
  lastInbound: string | null = null;
  lastOutbound: string | null = null;
  constructor(clock: Clock, changed: () => void, random = Math.random) {
    this.#clock = clock; this.#changed = changed; this.#random = random;
  }
  connected(): boolean { return !this.#stopping && this.#ready && this.#ack !== undefined && this.#clock.now().getTime() - this.#ack <= this.#interval; }
  run(url: string, token: string, dispatch: (frame: DiscordDispatch) => void): Promise<void> {
    const socket = this.#socket = new WebSocket(url, { perMessageDeflate: false, followRedirects: false, handshakeTimeout: 10_000, maxPayload: 4 * 1024 * 1024 });
    const fail = () => { if (!this.#stopping) this.#completion.reject(new Error('Discord gateway connection closed or failed')); };
    const send = (frame: unknown) => {
      if (socket.readyState !== WebSocket.OPEN || this.#stopping) return;
      socket.send(JSON.stringify(frame)); this.lastOutbound = this.#clock.now().toISOString();
    };
    const heartbeat = () => { send({ op: 1, d: this.#sequence }); };
    const schedule = (delay: number) => {
      this.#timer = this.#clock.setTimeout(() => {
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
        send({ op: 2, d: { token, intents: 33281, properties: { os: process.platform, browser: 'cland', device: 'cland' } } });
      } else if (frame.op === 1) heartbeat();
      else if (frame.op === 11) this.#ack = this.#clock.now().getTime();
      else if (frame.op === 0) {
        if (Number.isSafeInteger(frame.s)) this.#sequence = frame.s!;
        if (frame.t === 'READY') {
          const user = frame.d?.user as { id?: unknown } | undefined;
          if (typeof frame.d?.session_id !== 'string' || typeof frame.d.resume_gateway_url !== 'string' || typeof user?.id !== 'string' || !/^\d+$/.test(user.id)) {
            this.#completion.reject(new Error('Discord gateway sent invalid READY')); return;
          }
          this.session = { id: frame.d.session_id, resumeUrl: frame.d.resume_gateway_url, botId: user.id }; this.#ready = true;
        }
        try { dispatch(frame); } catch { this.#completion.reject(new Error('Discord gateway dispatch failed')); }
      }
      this.#changed();
    });
    socket.on('error', fail);
    socket.once('close', () => { this.#ready = false; this.#closed.resolve(); fail(); this.#changed(); });
    return this.#completion.promise;
  }
  async stop(): Promise<void> {
    this.#stopping = true; this.#clock.clearTimeout(this.#timer);
    if (this.#socket && this.#socket.readyState !== WebSocket.CLOSED) this.#socket.terminate();
    if (this.#socket) await within(this.#closed.promise, 2000);
    this.#completion.resolve(); this.#changed();
  }
}
