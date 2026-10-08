// The spoke's side of the hub protocol: one WebSocket, reconnecting for ever with capped backoff,
// requests correlated by id, deliveries emitted as events. It never throws out of its loop and never
// exits the process — a harness does not restart a stdio MCP server that died.
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { isHubFrame, parseFrame, PROTOCOL_VERSION, REPLACED_CLOSE_CODE, type Hello, type Ack, type HubFrame, type Message, type Presence, type RefusalCode, type SpokeRequest } from '../protocol.ts';
import type { TaskRequest } from '../tracker/requests.ts';

export type HubClientOptions = {
  url: string;
  secret: string;
  /** Asked before every connect, when present: a hub found through `.cland/hub.json` may come back on a new
   *  port after a restart. Null keeps the last endpoint. */
  endpoint?: () => { url: string; secret: string } | null;
  hello: Omit<Hello, 'type' | 'protocol'>;
  /** Base reconnect delay, ms (doubles up to 30 s). */
  reconnectMs?: number;
  /** How long a request waits for its reply before it fails, ms. */
  requestTimeoutMs?: number;
  /** The heartbeat interval while connected, ms; absent means no heartbeat. Each ping must be answered
   *  within one interval; MISSED_HEARTBEATS unanswered in a row close the socket, and the spoke reconnects. */
  heartbeatMs?: number;
  log?: (line: string) => void;
};

export type ConnectionState =
  | { kind: 'connecting' }
  | { kind: 'connected'; name: string; role?: string }
  | { kind: 'disconnected'; reason: string; retryInMs: number }
  | { kind: 'refused'; code: RefusalCode; message: string }
  /** The hub closed this socket because a newer spoke of the same session took the name (4002): no reconnect. */
  | { kind: 'replaced'; message: string };

/** How many `name-in-use` refusals a requested name survives before a generated one is taken: a holder
 *  that is really gone frees the name within a few reconnect delays; a live one elsewhere does not. */
export const NAME_RETRIES = 5;

/** How many delivered message ids a spoke remembers to recognise a re-send. */
const SEEN_LIMIT = 1000;

/** The default request deadline: the hub is on loopback, so a reply this late means it is stuck. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Unanswered heartbeats in a row after which the hub counts as gone and the spoke reconnects. */
export const MISSED_HEARTBEATS = 2;

/** A request whose reply did not come within its deadline. */
export class ReplyTimeout extends Error {}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

/** `Omit` over a union, member by member (a plain `Omit` keeps only the common keys). */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export class HubClient extends EventEmitter<{ deliver: [Message]; state: [ConnectionState] }> {
  #ws: WebSocket | null = null;
  #state: ConnectionState = { kind: 'connecting' };
  #pending = new Map<string, Pending>();
  #attempt = 0;
  #stopped = false;
  #requestedName: string | undefined;
  /** The name the hub last welcomed us under: a reconnect asks for it, so a generated name stays ours even
   *  when the hub lost its memory. Dropped when the hub refuses it (someone claimed it by name meanwhile). */
  #acceptedName: string | undefined;
  #nameRefusals = 0;
  /** The next reconnect is a retry of the requested name: a short fixed delay, not the transport backoff. */
  #retryingName = false;
  #timer: NodeJS.Timeout | null = null;
  #lastRefusal: string | null = null;
  #fatal = false;
  #heartbeat: NodeJS.Timeout | null = null;
  #missedHeartbeats = 0;
  /** Armed when the hello goes out, cleared by the hub's answer: the liveness check before heartbeats start. */
  #welcomeTimer: NodeJS.Timeout | null = null;
  /** The ids of the messages already handed to the session: a re-sent deliver is acked again, never emitted twice. */
  readonly #seen = new Set<string>();
  readonly #options: HubClientOptions;
  /** The hello's fixed fields — the requested name is kept apart, because a refusal changes it. */
  readonly #hello: Omit<HubClientOptions['hello'], 'name'>;
  readonly #log: (line: string) => void;

  constructor(options: HubClientOptions) {
    super();
    this.#options = options;
    const { name, ...fixed } = options.hello;
    this.#hello = fixed;
    this.#requestedName = name;
    this.#log = options.log ?? (() => {});
  }

  get state(): ConnectionState {
    return this.#state;
  }

  get name(): string | null {
    return this.#state.kind === 'connected' ? this.#state.name : null;
  }

  /** After a successful rename: the hub knows us by the new name from now on, and so does a reconnect. */
  renamed(name: string): void {
    this.#requestedName = name;
    this.#acceptedName = name;
    this.#nameRefusals = 0;
    if (this.#state.kind === 'connected') this.#setState({ kind: 'connected', name, ...(this.#state.role ? { role: this.#state.role } : {}) });
  }

  /** The last refusal the hub sent, kept after the fallback so `who` can still say what happened. */
  get lastRefusal(): string | null {
    return this.#lastRefusal;
  }

  start(): void {
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#stopHeartbeat();
    this.#clearWelcomeTimer();
    this.#ws?.close();
  }

  /** Send a request and await its result; rejects at once when there is no connection, and with a
   *  ReplyTimeout when no reply comes within the deadline. */
  request(frame: DistributiveOmit<SpokeRequest | TaskRequest, 'id'>, timeoutMs = this.#options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS): Promise<unknown> {
    if (this.#state.kind !== 'connected' || !this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(this.describeOutage()));
    }
    const id = randomUUID();
    const ws = this.#ws;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.#pending.delete(id)) return;
        reject(new ReplyTimeout(`the hub did not answer within ${timeoutMs / 1000} s`));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ ...frame, id }), (err) => {
        if (err && this.#pending.delete(id)) {
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  /** While connected: a ping each interval, answered within it; too many unanswered and the socket is cut. */
  #startHeartbeat(ws: WebSocket): void {
    this.#stopHeartbeat();
    const every = this.#options.heartbeatMs;
    if (every === undefined) return;
    this.#missedHeartbeats = 0;
    this.#heartbeat = setInterval(() => {
      if (this.#ws !== ws || ws.readyState !== WebSocket.OPEN) return;
      this.request({ type: 'ping' }, every).then(
        () => {
          this.#missedHeartbeats = 0;
        },
        (err: unknown) => {
          if (!(err instanceof ReplyTimeout) || this.#ws !== ws) return;
          this.#missedHeartbeats += 1;
          if (this.#missedHeartbeats < MISSED_HEARTBEATS) return;
          this.#log(`the hub missed ${this.#missedHeartbeats} heartbeat replies — closing the connection and reconnecting`);
          this.#stopHeartbeat();
          // no close handshake with a peer that stopped answering: the close event schedules the reconnect
          ws.terminate();
        },
      );
    }, every);
    this.#heartbeat.unref();
  }

  #stopHeartbeat(): void {
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
  }

  /** One sentence for a tool result when the hub cannot be reached. */
  describeOutage(): string {
    switch (this.#state.kind) {
      case 'connected':
        // asked while the socket is closing under us — the close event has not run yet
        return 'the hub connection closed under us; reconnecting';
      case 'replaced':
        return `this spoke was ${this.#state.message} — it will not reconnect`;
      case 'connecting':
        return 'the hub is not connected yet (connecting)';
      case 'disconnected':
        return `the hub is unreachable (${this.#state.reason}); reconnecting in ${Math.round(this.#state.retryInMs / 1000)} s`;
      case 'refused':
        return `the hub refused this session (${this.#state.code}): ${this.#state.message}`;
    }
  }

  #setState(state: ConnectionState): void {
    this.#state = state;
    this.emit('state', state);
  }

  #connect(): void {
    if (this.#stopped) return;
    this.#setState({ kind: 'connecting' });
    const { url, secret } = this.#options.endpoint?.() ?? this.#options;
    const ws = new WebSocket(url, {
      headers: { authorization: `Bearer ${secret}` },
      handshakeTimeout: 10_000,
    });
    this.#ws = ws;

    ws.on('open', () => {
      const hello: Hello = {
        type: 'hello',
        protocol: PROTOCOL_VERSION,
        ...this.#hello,
      };
      const name = this.#requestedName ?? this.#acceptedName;
      if (name !== undefined) hello.name = name;
      ws.send(JSON.stringify(hello));
      // The heartbeat starts only with the welcome: until then this deadline is the liveness check. A hub
      // that took the connection and stays silent is left, and the close schedules the reconnect.
      const within = this.#options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
      this.#welcomeTimer = setTimeout(() => {
        if (this.#ws !== ws || this.#state.kind === 'connected') return;
        this.#log(`the hub did not welcome this spoke within ${within / 1000} s — closing the connection and reconnecting`);
        ws.terminate();
      }, within);
      this.#welcomeTimer.unref();
    });

    ws.on('message', (data) => {
      const frame = parseFrame(data.toString());
      if (!frame || !isHubFrame(frame)) {
        this.#log(`hub sent an unreadable frame: ${data.toString().slice(0, 200)}`);
        return;
      }
      this.#onFrame(frame);
    });

    ws.on('close', (code, reason) => {
      this.#ws = null;
      this.#stopHeartbeat();
      this.#clearWelcomeTimer();
      const why = reason.toString() || `code ${code}`;
      for (const [id, p] of this.#pending) {
        clearTimeout(p.timer);
        p.reject(new Error(`the hub connection closed (${why}) before the reply`));
        this.#pending.delete(id);
      }
      if (this.#fatal) {
        // A version refusal cannot heal by retrying: the fix is an update and a restart.
        this.#log(`refused by the hub: ${this.#lastRefusal ?? why}`);
        return;
      }
      if (code === REPLACED_CLOSE_CODE) {
        // A newer spoke of this very session took the name: reconnecting would only take it back and loop.
        this.#stopped = true;
        this.#setState({ kind: 'replaced', message: why });
        this.#log(`${why} — not reconnecting`);
        return;
      }
      if (this.#stopped) return;
      this.#scheduleReconnect(this.#lastRefusal ?? why);
    });

    ws.on('unexpected-response', (_req, res) => {
      if (res.statusCode === 401) {
        this.#lastRefusal = "the hub refused the project's secret (401) — the spoke's secret does not match the hub's";
        this.#setState({ kind: 'refused', code: 'unauthorized', message: this.#lastRefusal });
      }
      res.resume();
      ws.terminate();
    });

    ws.on('error', (err) => {
      this.#log(`hub socket error: ${err.message}`);
      // 'close' follows and schedules the reconnect
    });
  }

  #clearWelcomeTimer(): void {
    if (this.#welcomeTimer) clearTimeout(this.#welcomeTimer);
    this.#welcomeTimer = null;
  }

  #onFrame(frame: HubFrame): void {
    // the hub answered the hello, one way or the other
    if (frame.type === 'welcome' || frame.type === 'error') this.#clearWelcomeTimer();
    switch (frame.type) {
      case 'welcome':
        this.#attempt = 0;
        this.#nameRefusals = 0;
        // welcomed under the name we asked for: a refusal on the way here is history, not a note for `who`
        if (this.#requestedName !== undefined) this.#lastRefusal = null;
        if (this.#state.kind === 'refused' && this.#state.code === 'unauthorized') this.#lastRefusal = null;
        this.#acceptedName = frame.name;
        this.#setState({ kind: 'connected', name: frame.name, ...(frame.role ? { role: frame.role } : {}) });
        if (this.#ws) this.#startHeartbeat(this.#ws);
        this.#log(`connected to the hub as ${frame.name}${frame.role ? ` (${frame.role})` : ''} (${frame.presence.length} online)`);
        break;
      case 'deliver':
        if (!this.#seen.has(frame.id)) {
          this.#seen.add(frame.id);
          if (this.#seen.size > SEEN_LIMIT) this.#seen.delete(this.#seen.values().next().value as string);
          this.emit('deliver', frame.message);
        } else this.#log(`message ${frame.id} was sent again; acked again, not handed to the session twice`);
        // accepted (spec 4.2, `delivered`): the hub stops re-sending it
        if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(JSON.stringify({ type: 'ack', id: frame.id } satisfies Ack));
        break;
      case 'result': {
        const p = this.#pending.get(frame.id);
        if (!p) return;
        this.#pending.delete(frame.id);
        clearTimeout(p.timer);
        if (frame.ok) p.resolve(frame.value);
        else p.reject(new Error(frame.error));
        break;
      }
      case 'error':
        this.#lastRefusal = frame.message;
        this.#setState({ kind: 'refused', code: frame.code, message: frame.message });
        if (frame.code === 'version') this.#fatal = true;
        if (frame.code === 'bad-name' && this.#requestedName !== undefined) {
          // Reserved or malformed: no retry can help — take a generated name instead.
          this.#log(`requested name "${this.#requestedName}" refused (${frame.message}) — asking the hub for a generated one`);
          this.#requestedName = undefined;
        } else if (frame.code === 'name-in-use' && this.#requestedName !== undefined) {
          // A live holder — often our own previous process still closing: keep asking for the name for a
          // few reconnects; only then take a generated one.
          this.#nameRefusals += 1;
          if (this.#nameRefusals >= NAME_RETRIES) {
            this.#log(`requested name "${this.#requestedName}" still in use after ${this.#nameRefusals} tries (${frame.message}) — asking the hub for a generated one`);
            this.#requestedName = undefined;
          } else {
            this.#retryingName = true;
            this.#log(`requested name "${this.#requestedName}" in use (${frame.message}) — retrying it (${this.#nameRefusals}/${NAME_RETRIES})`);
          }
        } else if ((frame.code === 'name-in-use' || frame.code === 'bad-name') && this.#acceptedName !== undefined) {
          // The name we were given earlier is gone (claimed by name while we were away): ask for a fresh one.
          this.#log(`the name "${this.#acceptedName}" this spoke held is no longer ours (${frame.message}) — asking the hub for a generated one`);
          this.#acceptedName = undefined;
        }
        break;
    }
  }

  #scheduleReconnect(reason: string): void {
    const base = this.#options.reconnectMs ?? 1000;
    let delay: number;
    if (this.#retryingName) {
      // A name retry is not a transport failure: a fixed short wait, and the backoff counter is left alone.
      this.#retryingName = false;
      delay = base * 2;
    } else {
      delay = Math.min(base * 2 ** Math.min(this.#attempt, 5), 30_000);
      this.#attempt += 1;
    }
    this.#setState({ kind: 'disconnected', reason, retryInMs: delay });
    this.#timer = setTimeout(() => this.#connect(), delay);
  }

  /** The presence table is not cached; `who` asks the hub. */
  async who(): Promise<{ me: string; sessions: Presence[] }> {
    return (await this.request({ type: 'who' })) as { me: string; sessions: Presence[] };
  }
}
