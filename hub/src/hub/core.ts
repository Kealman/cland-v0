// The hub's core: presence, names, routing and store-and-forward. Transport-free, so the network
// edge (`./server.ts`) is one thin layer over it.
import { randomUUID } from 'node:crypto';
import { PROTOCOL_VERSION, REPLACED_CLOSE_CODE, UPDATE_HINT, type Hello, type Message, type Presence, type RefusalCode, type SendOutcome } from '../protocol.ts';
import { generatedName, nameRefusal, ROLE_NAMES } from '../names.ts';
import { resolveTag } from '../address.ts';
import { Store, type DeliveryState } from './store.ts';
import { Hygiene, type LoopBreaker, type RateLimit } from './hygiene.ts';
import type { LogFn } from '../log.ts';

/** How long a message waits for an offline session; also how long a name stays known after its last sign of life. */
export const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
/** How long the store keeps a message. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const HISTORY_LIMIT = 50;
/** The session id of a hello that could not name its session: it identifies nobody. */
export const UNKNOWN_SESSION = 'unknown';

export type Connection = {
  name: string;
  cwd: string;
  sessionId: string;
  connectedAt: string;
  status: string | null;
  role: string | null;
  deliver: (message: Message) => void;
  /** Close this session's socket: a kick (4001 — the spoke reconnects) or a replacement (4002 — it does not). */
  close: (reason: string, code?: number) => void;
};

export type HelloResult = { ok: true; name: string; connection: Connection } | { ok: false; code: RefusalCode; message: string };

export type CoreOptions = {
  /** Extra reserved names beyond the built-ins. */
  reservedNames?: Iterable<string>;
  /** The hub's memory; `:memory:` when absent. */
  store?: Store;
  queueTtlMs?: number;
  retentionMs?: number;
  rateLimit?: RateLimit;
  loopBreaker?: LoopBreaker;
  maxTextBytes?: number;
  now?: () => Date;
  log?: LogFn;
};

export class HubCore {
  readonly #live = new Map<string, Connection>();
  readonly #reserved: ReadonlySet<string>;
  readonly #now: () => Date;
  readonly #log: LogFn;
  readonly #store: Store;
  readonly #queueTtlMs: number;
  readonly #retentionMs: number;
  readonly #hygiene: Hygiene;

  constructor(options: CoreOptions = {}) {
    this.#reserved = new Set(options.reservedNames ?? []);
    this.#now = options.now ?? (() => new Date());
    this.#log = options.log ?? (() => {});
    this.#store = options.store ?? new Store();
    this.#queueTtlMs = options.queueTtlMs ?? QUEUE_TTL_MS;
    this.#retentionMs = options.retentionMs ?? RETENTION_MS;
    this.#hygiene = new Hygiene({
      ...(options.rateLimit ? { rateLimit: options.rateLimit } : {}),
      ...(options.loopBreaker ? { loopBreaker: options.loopBreaker } : {}),
      ...(options.maxTextBytes !== undefined ? { maxTextBytes: options.maxTextBytes } : {}),
      memory: this.#store,
    });
  }

  get store(): Store {
    return this.#store;
  }

  // ---------------------------------------------------------------- presence

  hello(hello: Hello, deliver: (message: Message) => void, close: (reason: string, code?: number) => void = () => {}): HelloResult {
    if (hello.protocol !== PROTOCOL_VERSION) {
      return { ok: false, code: 'version', message: `protocol ${hello.protocol} is not the hub's ${PROTOCOL_VERSION} — ${UPDATE_HINT}` };
    }
    // The session id is the stable identity; a hello with the unknown id identifies nobody.
    const identified = hello.sessionId !== UNKNOWN_SESSION;
    let requested = hello.name;
    if (requested === undefined && identified) {
      // No name asked for: a session the hub already knows gets its own name back (unless another session
      // claimed it by name since), with whatever waited for it.
      const previous = this.#store.nameOfSession(hello.sessionId);
      const holder = previous === null ? undefined : this.#live.get(previous);
      if (previous !== null && nameRefusal(previous, this.#reserved) === null && (!holder || holder.sessionId === hello.sessionId)) requested = previous;
    }
    let name: string;
    let evict: Connection | null = null;
    if (requested !== undefined) {
      const refusal = nameRefusal(requested, this.#reserved);
      if (refusal) return { ok: false, code: 'bad-name', message: refusal };
      const holder = this.#live.get(requested);
      // The same session's spoke restarted (an MCP reconnect, a resume) while its old socket still stood:
      // the new one IS the session and takes the name; anyone else is refused. An unknown session id
      // identifies nobody, so it never evicts.
      const sameSession = holder !== undefined && holder.sessionId === hello.sessionId && identified;
      if (holder && !sameSession) return { ok: false, code: 'name-in-use', message: `name "${requested}" is in use by a live session` };
      if (holder) evict = holder;
      name = requested;
    } else {
      // Never a name any session has held: a generated name carries no other session's queue or history.
      name = generatedName(new Set([...this.#live.keys(), ...this.#reserved, ...this.#store.sessionNames()]));
    }
    // TODO(#29): roles become hub-held state; until then a session declares its role and an unknown one is ignored.
    let role: string | null = null;
    if (hello.role !== undefined) {
      if (ROLE_NAMES.includes(hello.role)) role = hello.role;
      else this.#log({ event: 'role-ignored', name, role: hello.role, roles: ROLE_NAMES });
    }
    const connection: Connection = {
      name,
      cwd: hello.cwd,
      sessionId: hello.sessionId,
      connectedAt: this.#now().toISOString(),
      // The status line belongs to the session under its name: a reconnect of the same session is the same
      // work. Another session claiming the name, or a name unseen for longer than the queue's TTL, inherits
      // no line.
      status: identified ? this.#store.statusOf(name, this.#now().getTime() - this.#queueTtlMs, hello.sessionId) : null,
      role,
      deliver,
      close,
    };
    if (evict) {
      // Nothing fallible between here and the set: the name is never left with no holder. The old socket
      // is closed with a code its spoke does not reconnect on; its later close event is a no-op here.
      this.#log({ event: 'replaced', name, sessionId: hello.sessionId });
      this.#live.delete(name);
      evict.close('replaced: a newer spoke of this session took the name', REPLACED_CLOSE_CODE);
    }
    this.#live.set(name, connection);
    this.#store.rememberSession(name, this.#now().getTime());
    this.#store.rememberSessionId(name, hello.sessionId);
    // The row equals the connection from here on: a line the hello did not inherit is gone for good.
    this.#store.rememberStatus(name, connection.status);
    this.#store.rememberRole(name, connection.role);
    this.#log({ event: 'hello', name, sessionId: hello.sessionId, role });
    return { ok: true, name, connection };
  }

  /** After the welcome: hand a session what waited for it, oldest first; drop what waited too long. */
  flushQueued(name: string): void {
    const connection = this.#live.get(name);
    if (!connection) return;
    const { deliver, dropped } = this.#store.takeQueued(name, this.#now().getTime(), this.#queueTtlMs);
    for (const message of dropped) this.#log({ event: 'dropped', reason: 'queue ttl', id: message.id, session: name });
    for (const message of deliver) connection.deliver(message);
    if (deliver.length) this.#log({ event: 'flushed', session: name, count: deliver.length });
  }

  /** A socket closed. Only the connection that owns the name is removed: a stale close must never
   *  evict the reconnect that already took the name over. */
  disconnect(connection: Connection): void {
    if (this.#live.get(connection.name) !== connection) return;
    this.#live.delete(connection.name);
    this.#log({ event: 'bye', name: connection.name });
  }

  /** Whether this connection still holds its session's name (a takeover or a close ends that). */
  isCurrent(connection: Connection): boolean {
    return this.#live.get(connection.name) === connection;
  }

  presence(): Presence[] {
    return [...this.#live.values()].map((c) => ({ name: c.name, sessionId: c.sessionId, cwd: c.cwd, role: c.role, status: c.status, connectedAt: c.connectedAt }));
  }

  /** A hub-kind message to one session: delivered now or queued, and recorded. */
  notify(name: string, text: string): void {
    const notice: Message = { id: randomUUID(), from: 'hub', fromKind: 'hub', via: 'hub', to: [name], text, ts: this.#now().toISOString() };
    const state = this.#deliverOrQueue(notice, name);
    this.#store.record(notice, [{ session: name, state }], this.#now().getTime());
  }

  setStatus(name: string, text: string): void {
    const c = this.#live.get(name);
    if (!c) throw new Error(`unknown session ${name}`);
    c.status = text.trim().slice(0, 200) || null;
    this.#store.rememberStatus(name, c.status);
    this.#log({ event: 'status', name, status: c.status });
  }

  /** The heartbeat: the session is still here. */
  ping(name: string): void {
    if (!this.#live.has(name)) return;
    this.#store.touchSession(name, this.#now().getTime());
  }

  /** Claim a new name under the name rules. Synchronous: the socket's name must move with it before
   *  any next frame is read (a `send` in between would otherwise name a sender that no longer exists). */
  rename(from: string, to: string): { ok: true; name: string } | { ok: false; error: string } {
    const c = this.#live.get(from);
    if (!c) return { ok: false, error: `unknown session ${from}` };
    if (to === from) return { ok: true, name: to };
    const refusal = nameRefusal(to, this.#reserved);
    if (refusal) return { ok: false, error: refusal };
    if (this.#live.has(to)) return { ok: false, error: `name "${to}" is in use by a live session` };
    this.#live.delete(from);
    c.name = to;
    this.#live.set(to, c);
    this.#store.forgetSession(from);
    this.#store.rememberSession(to, this.#now().getTime());
    this.#store.rememberSessionId(to, c.sessionId);
    this.#store.rememberStatus(to, c.status);
    this.#store.rememberRole(to, c.role);
    this.#log({ event: 'rename', from, to });
    return { ok: true, name: to };
  }

  /** Close a session's socket; its spoke reconnects with a fresh hello. */
  kick(name: string): boolean {
    const c = this.#live.get(name);
    if (!c) return false;
    this.#log({ event: 'kick', name });
    c.close('kicked');
    return true;
  }

  /** Delete what is older than the retention window. */
  prune(): number {
    const gone = this.#store.prune(this.#now().getTime(), this.#retentionMs);
    if (gone) this.#log({ event: 'pruned', messages: gone });
    return gone;
  }

  history(session: string, limit?: number, counterpart?: string): Message[] {
    const n = Math.min(Math.max(1, Math.floor(limit ?? HISTORY_LIMIT)), HISTORY_LIMIT);
    return this.#store.history(session, n, counterpart?.replace(/^@/, ''));
  }

  // ---------------------------------------------------------------- routing

  /**
   * The identity hygiene counts a session under: its harness session id, which survives a rename (a name
   * does not). A session that gave no usable id (`unknown`) is counted under its name, as nothing better exists.
   */
  #identity(name: string): string {
    const id = this.#live.get(name)?.sessionId ?? this.#store.sessionIdOf(name);
    return id && id !== UNKNOWN_SESSION ? `id:${id}` : `name:${name}`;
  }

  /** Deliver to a session now, or queue it: the delivery state for the record. */
  #deliverOrQueue(message: Message, name: string): DeliveryState {
    const live = this.#live.get(name);
    if (live) {
      live.deliver(message);
      return 'delivered';
    }
    return 'queued';
  }

  /** A session the hub has seen within the queue's own TTL — beyond it a name is history, not an addressee. */
  #known(): string[] {
    return this.#store.knownSessions(this.#now().getTime() - this.#queueTtlMs).map((d) => d.name);
  }

  /** The sessions holding each role: the live ones by their hello, the offline ones by their row. Arrays, never iterators. */
  #roleHolders(known: ReadonlySet<string>): Map<string, string[]> {
    const since = this.#now().getTime() - this.#queueTtlMs;
    const roles = new Map<string, string[]>();
    for (const role of ROLE_NAMES) {
      const fromRows = this.#store.sessionsWithRole(role, since).filter((n) => known.has(n) && !this.#live.has(n));
      const live = [...this.#live.values()].filter((c) => c.role === role).map((c) => c.name);
      roles.set(role, [...new Set([...fromRows, ...live])].sort());
    }
    return roles;
  }

  /** Tags → addressees. `all`, globs and roles reach the connected and the known-offline; `except` is the sender. */
  #resolveAddressees(tags: string[], except: string) {
    const connected = [...this.#live.keys()];
    const known = this.#known();
    const knownSet = new Set([...connected, ...known]);
    const ctx = { connected, known, roles: this.#roleHolders(knownSet) };
    const sessions = new Set<string>();
    const unknown: string[] = [];
    const empty: Array<{ tag: string; reason: string }> = []; // tags that reach nobody but the sender — a fact, never a refusal
    const tagOf = new Map<string, string[]>(); // tag → the session names it resolved to
    for (const raw of tags) {
      const tag = raw.replace(/^@/, '');
      const r = resolveTag(tag, ctx);
      switch (r.kind) {
        case 'all': {
          const names = [...knownSet].filter((n) => n !== except);
          if (names.length) tagOf.set(tag, names);
          else unknown.push(tag); // nobody else is connected or known — `all` names no one
          for (const n of names) sessions.add(n);
          break;
        }
        case 'glob': {
          const names = r.names.filter((n) => n !== except);
          if (names.length) tagOf.set(tag, names);
          else unknown.push(tag);
          for (const n of names) sessions.add(n);
          break;
        }
        case 'role': {
          const names = r.names.filter((n) => n !== except);
          if (names.length) tagOf.set(tag, names);
          else empty.push({ tag, reason: r.names.length ? `the sender is the only session holding role "${tag}"` : `role "${tag}" has no holder` });
          for (const n of names) sessions.add(n);
          break;
        }
        case 'session':
          sessions.add(r.name);
          tagOf.set(tag, [r.name]);
          break;
        case 'unknown':
          unknown.push(tag);
      }
    }
    return { sessions, unknown, empty, tagOf };
  }

  /** A session's `send`: addressees are session names, globs, `all`, or roles. */
  sendFromSession(from: string, to: string[], text: string, replyTo?: string): { message: Message; outcomes: SendOutcome[] } {
    const sender = this.#live.get(from);
    if (!sender) throw new Error(`unknown sender ${from}`);
    const nowMs = this.#now().getTime();
    const size = this.#hygiene.sizeRefusal(text);
    if (size) throw new Error(size);
    const self = this.#identity(from);
    const rate = this.#hygiene.rateRefusal(self, nowMs);
    if (rate) throw new Error(rate);
    const { sessions, unknown, empty, tagOf } = this.#resolveAddressees(to, from);
    const outcomes: SendOutcome[] = unknown.map((tag) => ({ to: tag, outcome: 'unknown', reason: `no session named "${tag}" is connected or known, and no role has that name` }));
    for (const { tag, reason } of empty) outcomes.push({ to: tag, outcome: 'empty', reason });
    // the loop breaker: a muted pair refuses; a pair crossing the threshold gets muted and refuses
    const refused = new Map<string, string>();
    for (const n of sessions) {
      const other = this.#identity(n);
      const muted = this.#hygiene.muteRefusal(self, other, nowMs, [from, n]);
      if (muted) {
        refused.set(n, muted);
        continue;
      }
      const until = this.#hygiene.countPair(self, other, nowMs);
      if (until !== null) {
        refused.set(n, this.#hygiene.muteRefusal(self, other, nowMs, [from, n]) as string);
        // TODO(#23): tell the human in the UI; until then the mute is only journalled.
        this.#log({ event: 'loop-breaker', pair: [from, n].sort().join('|'), until: new Date(until).toISOString() });
      }
    }
    for (const n of refused.keys()) sessions.delete(n);
    const message: Message = {
      id: randomUUID(),
      from,
      fromKind: 'agent',
      via: 'session',
      to: [...sessions],
      text,
      ts: this.#now().toISOString(),
      ...(sender.role !== null ? { fromRole: sender.role } : {}),
      ...(replyTo !== undefined ? { replyTo } : {}),
    };
    const states = new Map<string, DeliveryState>();
    for (const n of sessions) states.set(n, this.#deliverOrQueue(message, n));
    for (const [tag, names] of tagOf) {
      const blocked = names.filter((n) => refused.has(n));
      if (blocked.length === names.length) {
        outcomes.push({ to: tag, outcome: 'refused', reason: refused.get(blocked[0] as string) as string });
        continue;
      }
      const queued = names.filter((n) => states.get(n) === 'queued');
      if (queued.length === names.length - blocked.length) outcomes.push({ to: tag, outcome: 'queued', reason: `${queued.join(', ')} offline — queued for up to ${Math.round(this.#queueTtlMs / 3_600_000)} h` });
      else if (queued.length) outcomes.push({ to: tag, outcome: 'delivered', reason: `queued for ${queued.join(', ')} (offline)` });
      else outcomes.push({ to: tag, outcome: 'delivered' });
    }
    if (sessions.size === 0) {
      this.#log({ event: 'send-refused', from, to, outcomes: outcomes.map((o) => `${o.to}:${o.outcome}`) });
      return { message, outcomes };
    }
    this.#store.record(message, [...states].map(([session, state]) => ({ session, state })), nowMs);
    this.#log({ event: 'send', id: message.id, from, to: message.to, outcomes: outcomes.map((o) => `${o.to}:${o.outcome}`) });
    return { message, outcomes };
  }
}
