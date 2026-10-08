// The spoke's side of the hub protocol: one WebSocket, reconnecting for ever with capped backoff,
// requests correlated by id, deliveries emitted as events. It never throws out of its loop and never
// exits the process — a harness does not restart a stdio MCP server that died.
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { isHubFrame, parseFrame, PROTOCOL_VERSION, REPLACED_CLOSE_CODE, type Hello, type HubFrame, type Message, type Presence, type RefusalCode, type SpokeRequest } from '../protocol.ts';

export type HubClientOptions = {
  url: string;
  secret: string;
  hello: Omit<Hello, 'type' | 'protocol'>;
  /** Base reconnect delay, ms (doubles up to 30 s). */
  reconnectMs?: number;
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

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

/** `Omit` over a union, member by member (a plain `Omit` keeps only the common keys). */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export class HubClient extends EventEmitter<{ deliver: [Message]; state: [ConnectionState] }> {
  #ws: WebSocket | null = null;
  #state: ConnectionState = { kind: 'connecting' };
  #pending = new Map<string, Pending>();
  #attempt = 0;
  #stopped = false;
  #requestedName: string | undefined;
  #nameRefusals = 0;
  /** The next reconnect is a retry of the requested name: a short fixed delay, not the transport backoff. */
  #retryingName = false;
  #timer: NodeJS.Timeout | null = null;
  #lastRefusal: string | null = null;
  #fatal = false;
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
    this.#ws?.close();
  }

  /** Send a request and await its result; rejects at once when there is no connection. */
  request(frame: DistributiveOmit<SpokeRequest, 'id'>): Promise<unknown> {
    if (this.#state.kind !== 'connected' || !this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(this.describeOutage()));
    }
    const id = randomUUID();
    const ws = this.#ws;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ ...frame, id }), (err) => {
        if (err) {
          this.#pending.delete(id);
          reject(err);
        }
      });
    });
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
    const ws = new WebSocket(this.#options.url, {
      headers: { authorization: `Bearer ${this.#options.secret}` },
      handshakeTimeout: 10_000,
    });
    this.#ws = ws;

    ws.on('open', () => {
      const hello: Hello = {
        type: 'hello',
        protocol: PROTOCOL_VERSION,
        ...this.#hello,
        ...(this.#requestedName !== undefined ? { name: this.#requestedName } : {}),
      };
      ws.send(JSON.stringify(hello));
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
      const why = reason.toString() || `code ${code}`;
      for (const [id, p] of this.#pending) {
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

  #onFrame(frame: HubFrame): void {
    switch (frame.type) {
      case 'welcome':
        this.#attempt = 0;
        this.#nameRefusals = 0;
        // welcomed under the name we asked for: a refusal on the way here is history, not a note for `who`
        if (this.#requestedName !== undefined) this.#lastRefusal = null;
        if (this.#state.kind === 'refused' && this.#state.code === 'unauthorized') this.#lastRefusal = null;
        this.#setState({ kind: 'connected', name: frame.name, ...(frame.role ? { role: frame.role } : {}) });
        this.#log(`connected to the hub as ${frame.name}${frame.role ? ` (${frame.role})` : ''} (${frame.presence.length} online)`);
        break;
      case 'deliver':
        this.emit('deliver', frame.message);
        break;
      case 'result': {
        const p = this.#pending.get(frame.id);
        if (!p) return;
        this.#pending.delete(frame.id);
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
