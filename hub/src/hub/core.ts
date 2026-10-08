// The hub's core: presence, names, routing and store-and-forward. Transport-free, so the network
// edge (`./server.ts`) is one thin layer over it.
import { randomUUID } from 'node:crypto';
import {
  PROTOCOL_VERSION,
  REPLACED_CLOSE_CODE,
  UPDATE_HINT,
  type HandoverNote,
  type Hello,
  type HubEvent,
  type HygieneRefusal,
  type Message,
  type Presence,
  type RefusalCode,
  type RoleClause,
  type RoleHolder,
  type RoleList,
  type SendOutcome,
  type SessionState,
  type Topic,
  type TopicMessage,
  type TopicRef,
  type TopicStatus,
} from '../protocol.ts';
import { generatedName, nameRefusal, ROLE_LABELS, ROLE_NAMES, withRole } from '../names.ts';
import type { RolesSource } from '../roles/config.ts';
import { clauseText, revokedText } from '../roles/clause.ts';
import { isRoleRecord, noteText, renderNote, type RoleRecord } from '../roles/note.ts';
import { resolveTag } from '../address.ts';
import { decide, DEFAULT_PERMISSIONS } from '../roles/permissions.ts';
import { Store } from './store.ts';
import { Hygiene, HygieneError, type LoopBreaker, type RateLimit } from './hygiene.ts';
import { mentions, nextStatus, TopicRefusal, type TopicItems, type TopicMove } from './topics.ts';
import type { TopicBinding } from '../tracker/tracker.ts';
import type { LogFn } from '../log.ts';
import { Asks } from './asks.ts';
import { IDLE_NOTIFY_MS, InboxBoard } from './inbox.ts';

/** How long a message waits for an offline session; also how long a name stays known after its last sign of life. */
export const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
/** How long the store keeps a message. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const HISTORY_LIMIT = 50;
/** The session id of a hello that could not name its session: it identifies nobody. */
export const UNKNOWN_SESSION = 'unknown';

/** The standing topics every project has (spec 4.5): created at the first start, never renamed or deleted. */
export const GENERAL: TopicRef = { id: 'general', title: 'General' };
export const AGENTS: TopicRef = { id: 'agents', title: 'Agents' };
const STANDING_TOPICS: readonly TopicRef[] = [GENERAL, AGENTS];
/** The sender name of the human's messages. Reserved: no session can take it. */
export const HUMAN = 'human';
/** Who a human message addresses unless it names others (spec 4.5). */
export const DEFAULT_HUMAN_ADDRESSEE = 'coordinator';
export const TOPIC_HISTORY_LIMIT = 200;

export type Connection = {
  name: string;
  cwd: string;
  sessionId: string;
  connectedAt: string;
  status: string | null;
  role: string | null;
  /** Send the message to the spoke; false when the socket is no longer open (it stays queued). */
  deliver: (message: Message) => boolean;
  /** Send a role clause (or revocation) carried by `message`; the spoke acks it like a delivery. */
  deliverRole: (message: Message, clause: RoleClause) => boolean;
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
  /**
   * The project's role definitions (`.cland/roles.toml`). With them roles are hub-held (spec 4.4, ADR 0001): a
   * session holds the role the human assigned or the one it was launched for, a session with none is refused,
   * and the holder gets its clause on assignment and on every hello. Without them (a hub with no project and no
   * human side) a hello's role is taken as declared.
   */
  roles?: RolesSource;
  /** The tracker as a topic's binding sees it (`topic.create` with an item); absent, a binding is refused. */
  items?: TopicItems;
  /** How long a session stays idle before the inbox notes it, ms (default 30 min; 0: never). */
  idleNotifyMs?: number;
};

/** A hub notice recorded in a topic (Agents: the lifecycle record, spec 4.5): its kind, its text, who it is
 *  delivered to (nobody by default: the record is for reading), and its typed facts. */
export type TopicNotice = { kind: string; text: string; to?: string[]; detail?: Record<string, unknown>; id?: string };

/** The one exclusive role (spec 4.4): a vacancy is announced. */
export const COORDINATOR = 'coordinator';
/** The `notice` kind of a stored role clause or revocation. */
const ROLE_NOTICE = 'role';

export class HubCore {
  readonly #live = new Map<string, Connection>();
  readonly #reserved: ReadonlySet<string>;
  readonly #now: () => Date;
  readonly #log: LogFn;
  readonly #store: Store;
  readonly #queueTtlMs: number;
  readonly #retentionMs: number;
  readonly #hygiene: Hygiene;
  readonly #listeners = new Set<(event: HubEvent) => void>();
  /** Each session's state by its session id (a rename moves nothing), set only by adapters (spec 4.2). */
  readonly #states = new Map<string, SessionState>();
  /** Told when a session's spoke accepted a message: the adapters inject it into the harness. */
  #onDelivered: ((messageId: string, session: string, sessionId: string) => void) | null = null;
  readonly #roles: RolesSource | null;
  /** The role a session was launched for, by the adapters' side (`Sessions`); a hello's role is honoured for it. */
  #launchedRole: ((name: string, sessionId: string) => string | null) | null = null;
  /** Whether the launch already handed the session its clause as its first turn (Codex): taken once, at the first hello. */
  #clauseCarried: ((name: string, sessionId: string) => boolean) | null = null;
  /** A clause the session already has (its launch's first turn), recorded as injected: sent once with the next flush. */
  readonly #carriedNotice = new Map<string, string>();
  /** The role notices sent this run, by message id: they go out as `role` frames, not `deliver`s. */
  readonly #roleNotices = new Map<string, RoleClause>();
  /** The live Coordinator last announced to subscribers. */
  #coordinator: string | null = null;
  #items: TopicItems | null;
  /** What subscribers last heard of each topic (status, warning, binding, title): a change is a `topic` event. */
  readonly #publishedTopics = new Map<string, string>();
  /** The Coordinator's asks to the human (#33). */
  readonly asks: Asks;
  /** The human's inbox (#33): open asks, approvals, waiting topics, notifications. */
  readonly inbox: InboxBoard;

  constructor(options: CoreOptions = {}) {
    this.#reserved = new Set([HUMAN, ...(options.reservedNames ?? [])]);
    this.#now = options.now ?? (() => new Date());
    this.#log = options.log ?? (() => {});
    this.#store = options.store ?? new Store();
    this.#roles = options.roles ?? null;
    this.#items = options.items ?? null;
    this.#queueTtlMs = options.queueTtlMs ?? QUEUE_TTL_MS;
    this.#retentionMs = options.retentionMs ?? RETENTION_MS;
    this.#hygiene = new Hygiene({
      ...(options.rateLimit ? { rateLimit: options.rateLimit } : {}),
      ...(options.loopBreaker ? { loopBreaker: options.loopBreaker } : {}),
      ...(options.maxTextBytes !== undefined ? { maxTextBytes: options.maxTextBytes } : {}),
      memory: this.#store,
    });
    const now = this.#now().toISOString();
    for (const t of STANDING_TOPICS) this.#store.ensureTopic(t.id, t.title, true, now);
    for (const t of this.#store.topics()) this.#publishedTopics.set(t.id, HubCore.#topicSignature(t));
    this.asks = new Asks({
      store: this.#store,
      now: this.#now,
      log: this.#log,
      emit: (e) => this.#emit(e),
      emitMessage: (m) => this.#emitMessage(m),
      publishTopics: () => this.#publishTopics(),
      move: (t, m, why) => void this.#move(t, m, why),
      topic: (id) => this.#topicOrThrow(id),
      sizeRefusal: (text) => this.#hygiene.sizeRefusal(text),
      role: (name) => this.#live.get(name)?.role ?? null,
      // the permission table's word on `ask` (#30): the role's grants, or the default table on a hub with no roles
      mayAsk: (role) => decide(role, role === null ? undefined : (this.#roles?.get().get(role)?.permissions.tools ?? DEFAULT_PERMISSIONS[role]), { tool: 'ask' }),
      sendFromHuman: (topic, text, to, answerTo) => this.sendFromHuman(topic, text, to, undefined, answerTo),
      // an ask withdrawn or cancelled: a notice in its topic to the asker, through the one notice path
      noteTo: (topic, session, text) => {
        if (this.noticeInTopic(topic, { kind: 'ask-closed', text, to: [session] }) === null) throw new Error(`no topic "${topic}"`);
      },
    });
    this.inbox = new InboxBoard({
      store: this.#store,
      now: this.#now,
      log: this.#log,
      emit: (e) => this.#emit(e),
      topics: () => this.#store.topics(),
      presence: () => this.presence(),
      stateOf: (id) => this.sessionState(id),
      idleNotifyMs: options.idleNotifyMs ?? IDLE_NOTIFY_MS,
    });
    // the inbox hears every event first: what changes a section, what is a notification
    this.#listeners.add((e) => this.inbox.observe(e));
  }

  // ---------------------------------------------------------------- events

  /** Listen to every `message` and `delivery` event (a subscribed client); returns the unsubscribe. */
  subscribe(listener: (event: HubEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(event: HubEvent): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener(event);
      } catch (err) {
        this.#log({ event: 'listener-failed', error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  /** A recorded topic message reaches the subscribers, with its stage as stored. */
  #emitMessage(message: Message): void {
    if (message.topic === undefined) return;
    const topic = this.topicRef(message.topic);
    if (!topic) return;
    const stage = this.#store.stage(message.id);
    const ask = this.asks.card(message.id);
    this.#emit({ type: 'message', topic, message: { ...message, topic: topic.id, ...(stage ? { stage } : {}), ...(ask ? { ask } : {}) } });
  }

  get store(): Store {
    return this.#store;
  }

  // ---------------------------------------------------------------- presence

  hello(
    hello: Hello,
    deliver: (message: Message) => boolean,
    close: (reason: string, code?: number) => void = () => {},
    deliverRole: (message: Message, clause: RoleClause) => boolean = (message) => deliver(message),
  ): HelloResult {
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
    let role: string | null = null;
    let fresh = false;
    if (this.#roles) {
      const r = this.#helloRole(name, hello);
      if (!r.ok) {
        this.#log({ event: 'refused-role', name, sessionId: hello.sessionId, requested: hello.role ?? null, reason: r.message });
        return { ok: false, code: 'no-role', message: r.message };
      }
      ({ role, fresh } = r);
    } else if (hello.role !== undefined) {
      // no project: the role is a declared label; an unknown one is ignored
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
      deliverRole,
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
    // what waited for the role while nobody held it now waits for this session (flushed after the welcome)
    if (role !== null) {
      const { moved, merged } = this.#store.claimRoleQueue(role, name);
      if (moved || merged.length) this.#log({ event: 'role-queue-claimed', name, role, count: moved + merged.length });
      // a message that already waited for this session by name keeps one delivery: its stage may move now
      for (const id of merged) this.#emitStage(id);
      // a topic's "no coordinator" warning clears once a holder took what waited
      if (moved || merged.length) this.#publishTopics();
    }
    this.#log({ event: 'hello', name, sessionId: hello.sessionId, role });
    // the clause goes out with what waited (flushQueued, after the welcome), ahead of it
    if (this.#roles && role !== null) {
      // a launch whose first turn already carried the clause: recorded (the journal), not injected again
      const carried = fresh && (this.#clauseCarried?.(name, hello.sessionId) ?? false);
      const id = this.#recordClause(connection, carried ? 'assigned at launch (first turn)' : fresh ? 'assigned at launch' : 'hello', undefined, carried);
      if (carried && id) this.#carriedNotice.set(name, id);
    }
    if (fresh) this.#emitRole(name, role, null, 'launch');
    this.#announceCoordinator();
    return { ok: true, name, connection };
  }

  /**
   * The role a hello gets on a project's hub: the one its name holds (assigned by the human, or kept from an
   * earlier hello: a role follows the name), else the one the adapters launched it for. A requested role
   * (`CLAND_ROLE`) is never enough on its own. No role: refused, the session stays off the hub (spec 4.4).
   */
  #helloRole(name: string, hello: Hello): { ok: true; role: string; fresh: boolean } | { ok: false; message: string } {
    const held = this.#store.roleOf(name);
    if (held !== null && ROLE_NAMES.includes(held)) {
      if (hello.role !== undefined && hello.role !== held) this.#log({ event: 'role-request-ignored', name, requested: hello.role, holds: held });
      return { ok: true, role: held, fresh: false };
    }
    const launched = this.#launchedRole?.(name, hello.sessionId) ?? null;
    if (launched !== null && ROLE_NAMES.includes(launched)) {
      const taken = this.#exclusiveHolder(launched, name);
      if (taken) return { ok: false, message: `role "${launched}" is held by ${taken}: one session holds it at a time — clear it first with \`cland role clear ${taken.split(' ')[0]}\`` };
      return { ok: true, role: launched, fresh: true };
    }
    const asked = hello.role !== undefined ? ` (it asked for "${hello.role}", which the hub grants only to a session it launched for that role)` : '';
    return { ok: false, message: `no role: "${name}" holds none${asked} — assign one with \`cland role set ${name} <${ROLE_NAMES.join('|')}>\`; the session connects on its next retry` };
  }

  /** After the welcome: hand a session what waited for it, oldest first; drop what waited too long. A message
   *  stays queued until the spoke acks it, so what a previous socket never acked is sent again here. */
  flushQueued(name: string): void {
    const connection = this.#live.get(name);
    if (!connection) return;
    const { deliver, dropped } = this.#store.pendingFor(name, this.#now().getTime(), this.#queueTtlMs);
    for (const message of dropped) {
      this.#log({ event: 'dropped', reason: 'queue ttl', id: message.id, session: name });
      this.#emitStage(message.id);
    }
    // a clause the launch already handed over: the spoke learns it (it acks; nothing is injected again)
    const carried = this.#carriedNotice.get(name);
    if (carried !== undefined) {
      this.#carriedNotice.delete(name);
      const message = this.#store.message(carried);
      if (message) this.#sendTo(connection, message);
    }
    // a role clause first: what else waited is read under the role
    const ordered = [...deliver.filter((m) => this.#roleNotices.has(m.id)), ...deliver.filter((m) => !this.#roleNotices.has(m.id))];
    for (const message of ordered) this.#sendTo(connection, message);
    if (deliver.length) this.#log({ event: 'flushed', session: name, count: deliver.length });
  }

  /** The spoke accepted a message: its delivery moves from queued to delivered. A stale connection acks nothing. */
  ack(connection: Connection, messageId: string): void {
    if (!this.isCurrent(connection)) return;
    if (!this.#store.markDelivered(messageId, connection.name, this.#now().getTime())) return;
    this.#log({ event: 'acked', id: messageId, session: connection.name });
    this.#emitStage(messageId);
    this.#onDelivered?.(messageId, connection.name, connection.sessionId);
  }

  /** The message's stage as stored, to the subscribers; it moves only once every addressee got as far. */
  #emitStage(messageId: string): void {
    const topic = this.#store.message(messageId)?.topic;
    const stage = this.#store.stage(messageId);
    if (topic !== undefined && stage !== undefined && stage !== 'queued') this.#emit({ type: 'delivery', topic, message: messageId, stage });
  }

  /** Who injects what a spoke accepted (the adapters' supervisor); one at a time. */
  onDelivered(listener: ((messageId: string, session: string, sessionId: string) => void) | null): void {
    this.#onDelivered = listener;
  }

  /** A session's adapter confirmed the turn (spec 4.2, `injected`); false when the delivery was not `delivered`. */
  markInjected(messageId: string, session: string): boolean {
    if (!this.#store.markInjected(messageId, session)) return false;
    this.#log({ event: 'injected', id: messageId, session });
    this.#emitStage(messageId);
    return true;
  }

  /** A session's state, from its adapter (never from the model's `status`); subscribers hear a change. */
  setSessionState(sessionId: string, name: string, state: SessionState, source: string): boolean {
    if (this.#states.get(sessionId) === state) return false;
    this.#states.set(sessionId, state);
    this.#log({ event: 'session-state', session: name, state, source });
    this.#emit({ type: 'session.state', session: name, sessionId, state, source, ts: this.#now().toISOString() });
    return true;
  }

  sessionState(sessionId: string): SessionState {
    return this.#states.get(sessionId) ?? 'unknown';
  }

  /** The live connection of a session id, if its spoke is connected. */
  connectionOf(sessionId: string): Connection | undefined {
    return [...this.#live.values()].find((c) => c.sessionId === sessionId);
  }

  /** A socket closed. Only the connection that owns the name is removed: a stale close must never
   *  evict the reconnect that already took the name over. */
  disconnect(connection: Connection): void {
    if (this.#live.get(connection.name) !== connection) return;
    this.#live.delete(connection.name);
    this.#log({ event: 'bye', name: connection.name });
    this.#announceCoordinator();
  }

  /** Whether this connection still holds its session's name (a takeover or a close ends that). */
  isCurrent(connection: Connection): boolean {
    return this.#live.get(connection.name) === connection;
  }

  presence(): Presence[] {
    return [...this.#live.values()].map((c) => ({
      name: c.name,
      sessionId: c.sessionId,
      cwd: c.cwd,
      role: c.role,
      label: withRole(c.name, c.role),
      status: c.status,
      connectedAt: c.connectedAt,
      state: this.sessionState(c.sessionId),
    }));
  }

  /** A hub-kind message to one session: delivered now or queued, and recorded. */
  notify(name: string, text: string): void {
    const notice: Message = { id: randomUUID(), from: 'hub', fromKind: 'hub', via: 'hub', to: [name], text, ts: this.#now().toISOString() };
    this.#store.record(notice, [{ session: name, state: 'queued' }], this.#now().getTime());
    this.#send(notice, name);
  }

  /**
   * Record a hub notice in a topic (Agents by default): the one path every lifecycle record takes (`agents-topic.ts`
   * maps the hub's domain events to it; the loop breaker's mute and #30's permission refusals call it directly).
   * Subscribers see it as a `message` event with its `kind`; `to` also delivers it to those sessions. Returns its id.
   */
  noticeInTopic(topicId: string, notice: TopicNotice): string | null {
    const topic = this.#store.topic(topicId);
    if (!topic) return null;
    // a notice with an id of its own (a journalled lifecycle event's) is recorded once, however often it is replayed
    if (notice.id !== undefined && this.#store.message(notice.id) !== null) return notice.id;
    const to = [...new Set(notice.to ?? [])];
    const message: Message = {
      id: notice.id ?? randomUUID(),
      from: 'hub',
      fromKind: 'hub',
      via: 'hub',
      to,
      text: notice.text,
      ts: this.#now().toISOString(),
      topic: topic.id,
      kind: notice.kind,
      ...(notice.detail ? { detail: notice.detail } : {}),
    };
    this.#store.record(
      message,
      to.map((session) => ({ session, state: 'queued' as const })),
      this.#now().getTime(),
    );
    this.#store.touchTopic(topic.id, message.ts);
    this.#emitMessage(message);
    for (const n of to) this.#send(message, n);
    return message.id;
  }

  /** A session as it is shown everywhere: `name [Role]` with the role it holds (live, else as remembered). */
  label(name: string): string {
    const c = this.#live.get(name);
    return withRole(name, c ? c.role : this.#store.roleOf(name));
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
    // deliveries still in flight to this session follow it, so its acks find them — and so do the ones its
    // spoke accepted and its adapter has not injected yet, so the confirmation and the retry find them
    const merged = this.#store.moveQueued(from, to);
    this.#store.moveUninjected(from, to);
    this.#store.forgetSession(from);
    for (const id of merged) this.#emitStage(id);
    this.#store.rememberSession(to, this.#now().getTime());
    this.#store.rememberSessionId(to, c.sessionId);
    this.#store.rememberStatus(to, c.status);
    this.#store.rememberRole(to, c.role);
    this.#log({ event: 'rename', from, to });
    this.#announceCoordinator();
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
    if (gone) {
      this.#log({ event: 'pruned', messages: gone });
      this.inbox.refresh();
    }
    return gone;
  }

  history(session: string, limit?: number, counterpart?: string): Message[] {
    const n = Math.min(Math.max(1, Math.floor(limit ?? HISTORY_LIMIT)), HISTORY_LIMIT);
    return this.#store.history(session, n, counterpart?.replace(/^@/, ''));
  }

  // ---------------------------------------------------------------- roles (spec 4.4, ADR 0001)

  /** The project's role definitions, or null on a hub with no project (roles are then declared labels). */
  get roles(): RolesSource | null {
    return this.#roles;
  }

  /** Who tells a hello which role its session was launched for (the adapters' side); one at a time. */
  launchedRole(lookup: ((name: string, sessionId: string) => string | null) | null, carried: ((name: string, sessionId: string) => boolean) | null = null): void {
    this.#launchedRole = lookup;
    this.#clauseCarried = carried;
  }

  /** The live session holding the Coordinator, or null: "no coordinator". */
  coordinator(): string | null {
    return [...this.#live.values()].find((c) => c.role === COORDINATOR)?.name ?? null;
  }

  /** Another session (live, or remembered within the queue's TTL) holding an exclusive role, as `name [Role]`
   *  with where it is; null when the role is not exclusive or free. */
  #exclusiveHolder(role: string, except: string | readonly string[]): string | null {
    if (!this.#roles?.get().get(role)?.exclusive) return null;
    const skip = new Set(typeof except === 'string' ? [except] : except);
    const live = [...this.#live.values()].find((c) => c.role === role && !skip.has(c.name));
    if (live) return `${withRole(live.name, role)} (live)`;
    const since = this.#now().getTime() - this.#queueTtlMs;
    const offline = this.#store.sessionsWithRole(role, since).find((n) => !skip.has(n) && !this.#live.has(n));
    return offline ? `${withRole(offline, role)} (offline)` : null;
  }

  /**
   * The human assigns a role to a session: a live one gets the clause now, a name not connected gets the role
   * when a session takes the name. An exclusive role another session holds is refused with the reason.
   */
  assignRole(name: string, role: string): RoleHolder {
    if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const refusal = nameRefusal(name, this.#reserved);
    if (refusal) throw new Error(refusal);
    const taken = this.#exclusiveHolder(role, name);
    if (taken) throw new Error(`role "${role}" is held by ${taken}: one session holds it at a time — clear it first with \`cland role clear ${taken.split(' ')[0]}\``);
    const c = this.#live.get(name);
    const previous = c ? c.role : this.#store.roleOf(name);
    if (c) c.role = role;
    else this.#store.rememberSession(name, this.#now().getTime());
    this.#store.rememberRole(name, role);
    this.#log({ event: 'role-assigned', session: name, role, previous, live: c !== undefined });
    if (c) {
      const { moved, merged } = this.#store.claimRoleQueue(role, name);
      if (moved || merged.length) this.#log({ event: 'role-queue-claimed', name, role, count: moved + merged.length });
      for (const id of merged) this.#emitStage(id);
      if (moved || merged.length) this.#publishTopics();
      this.#recordClause(c, 'assigned');
      // the clause first, then what waited for the role (a spoke acks a re-sent message and hands it over once)
      this.flushQueued(name);
    }
    this.#emitRole(name, role, previous, 'assigned');
    this.#announceCoordinator();
    return this.#holder(name);
  }

  /** The human revokes a session's role. A live holder is told to stop acting in it (decision #10). */
  clearRole(name: string, reason = 'revoked by the human'): RoleHolder {
    const c = this.#live.get(name);
    const previous = c ? c.role : this.#store.roleOf(name);
    if (previous === null) throw new Error(`"${name}" holds no role`);
    this.#vacate(name, reason);
    return this.#holder(name);
  }

  /** A holder's harness died or was stopped: its role is vacant (spec 4.4), until the human assigns it again or
   *  a relaunch of the session takes it back. Nothing when it held none. */
  vacateRole(name: string, reason: string): void {
    const c = this.#live.get(name);
    if ((c ? c.role : this.#store.roleOf(name)) === null) return;
    this.#vacate(name, reason);
  }

  #vacate(name: string, reason: string): void {
    const c = this.#live.get(name);
    const previous = c ? c.role : this.#store.roleOf(name);
    if (c) c.role = null;
    this.#store.rememberRole(name, null);
    this.#log({ event: 'role-cleared', session: name, previous, reason, live: c !== undefined });
    if (c) {
      const id = this.#recordClause(c, reason, previous);
      if (id) this.#send(this.#store.message(id) as Message, name);
    } else if (this.#store.dropNotices(name, ROLE_NOTICE).length) {
      // a clause still waiting for a session that is gone would reach whatever takes the name next
      this.#log({ event: 'role-notices-dropped', session: name, reason });
    }
    this.#emitRole(name, null, previous, reason);
    this.#announceCoordinator();
  }

  /** The session holding an exclusive role, live or remembered within the queue's TTL (other than `except`), or null. */
  holderOf(role: string, except?: string): string | null {
    if (!this.#roles?.get().get(role)?.exclusive) return null;
    const live = [...this.#live.values()].find((c) => c.role === role && c.name !== except);
    if (live) return live.name;
    const since = this.#now().getTime() - this.#queueTtlMs;
    return this.#store.sessionsWithRole(role, since).find((n) => n !== except && !this.#live.has(n)) ?? null;
  }

  /**
   * A role moves to `to` (#31): from its holder `from` (a handover by the holder, or the human's reassignment), or
   * from nobody. In one store transaction `from` loses it (or keeps `then`, an Implementer) and `to` takes it, with
   * the role's record (the note, the move). `beforeCommit` runs first (the tracker's claims, another connection) and
   * returns its undo, run when the transaction fails. Then: `to` gets its clause with the note, `from` its
   * revocation (`reason: "handover"`), the Agents topic both notices, subscribers the `session.role` events and the
   * Coordinator's `role.filled`. All synchronous: no frame is read between the checks and the last event.
   */
  moveRole(move: { role: string; from: string | null; to: string; by: string; note: HandoverNote | null; then: string | null; beforeCommit?: () => () => void }): RoleHolder {
    const { role, from, to, by, note, then } = move;
    if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const refusal = nameRefusal(to, this.#reserved);
    if (refusal) throw new Error(refusal);
    if (from === to) throw new Error(`${withRole(to, role)} already holds the role`);
    if (then !== null && (!ROLE_NAMES.includes(then) || then === role || this.#roles?.get().get(then)?.exclusive)) throw new Error(`a handover may leave the previous holder an Implementer (then: "implementer"), not "${then}"`);
    const taken = this.#exclusiveHolder(role, from === null ? [to] : [to, from]);
    if (taken) throw new Error(`role "${role}" is held by ${taken}: one session holds it at a time — clear it first with \`cland role clear ${taken.split(' ')[0]}\``);
    const cFrom = from !== null ? this.#live.get(from) : undefined;
    const cTo = this.#live.get(to);
    const fromRole = from === null ? null : cFrom ? cFrom.role : this.#store.roleOf(from);
    if (from !== null && fromRole !== role) throw new Error(`${withRole(from, fromRole)} does not hold the role ${ROLE_LABELS[role] ?? role}`);
    const previous = cTo ? cTo.role : this.#store.roleOf(to);
    const at = this.#now().toISOString();
    const stored = this.#store.roleRecord(role);
    const before: RoleRecord = isRoleRecord(stored) ? stored : { note: null, handover: null };
    const record: RoleRecord = {
      note: note ? { sections: note, from: by, to, at } : before.note,
      handover: { from, to, by, at },
    };
    const undo = move.beforeCommit?.() ?? (() => {});
    try {
      this.#store.transaction(() => {
        if (from !== null) this.#store.rememberRole(from, then);
        if (!cTo) this.#store.rememberSession(to, this.#now().getTime());
        this.#store.rememberRole(to, role);
        this.#store.saveRoleRecord(role, record);
      });
    } catch (err) {
      undo();
      throw err;
    }
    if (cFrom) cFrom.role = then;
    if (cTo) cTo.role = role;
    this.#log({ event: 'role-handover', role, from, to, by, note: note !== null, then, live: cTo !== undefined });
    if (cTo) {
      const { moved, merged } = this.#store.claimRoleQueue(role, to);
      if (moved || merged.length) this.#log({ event: 'role-queue-claimed', name: to, role, count: moved + merged.length });
      for (const id of merged) this.#emitStage(id);
      this.#recordClause(cTo, 'handover', previous);
      this.flushQueued(to);
    }
    if (from !== null) {
      if (cFrom) {
        const id = this.#recordClause(cFrom, `handed over to ${to}`, role, false, { reason: 'handover', to });
        if (id) this.#send(this.#store.message(id) as Message, from);
      } else if (this.#store.dropNotices(from, ROLE_NOTICE).length) this.#log({ event: 'role-notices-dropped', session: from, reason: 'handover' });
    }
    const roleLabel = ROLE_LABELS[role] ?? role;
    const fromLabel = from !== null ? withRole(from, role) : null;
    const handed = by === HUMAN ? `the human moved the ${roleLabel} role${fromLabel ? ` from ${fromLabel}` : ''} to ${to}` : `${fromLabel ?? by} handed the ${roleLabel} role over to ${to}`;
    this.noticeInTopic(AGENTS.id, { kind: 'handover', text: note ? `${handed}, with a handover note:\n\n${renderNote(note)}` : `${handed}, with no note.`, detail: { role, from, to, by, note: note !== null } });
    this.noticeInTopic(AGENTS.id, { kind: 'role-assign', text: `${withRole(to, role)} took over the ${roleLabel} role${from !== null ? ` from ${from}` : ''}.`, detail: { session: to, role, previous, handover: true } });
    if (from !== null) this.#emitRole(from, then, role, 'handover');
    this.#emitRole(to, role, previous, 'handover');
    this.#announceCoordinator();
    return this.#holder(to);
  }

  #holder(name: string): RoleHolder {
    const c = this.#live.get(name);
    const role = c ? c.role : this.#store.roleOf(name);
    return { name, role, label: withRole(name, role), live: c !== undefined };
  }

  /** The roles, their definitions and their holders (live, or remembered within the queue's TTL). */
  roleList(): RoleList {
    const config = this.#roles?.get();
    const since = this.#now().getTime() - this.#queueTtlMs;
    return {
      roles: ROLE_NAMES.map((role) => {
        const d = config?.get(role);
        const names = new Set([...[...this.#live.values()].filter((c) => c.role === role).map((c) => c.name), ...this.#store.sessionsWithRole(role, since).filter((n) => !this.#live.has(n))]);
        return {
          role,
          label: ROLE_LABELS[role] ?? role,
          exclusive: d?.exclusive ?? false,
          skills: d?.skills ?? [],
          launch: d?.launch ?? { harness: '', model: null, effort: null },
          holders: [...names].sort().map((n) => this.#holder(n)),
        };
      }),
      coordinator: this.coordinator(),
    };
  }

  /**
   * Record the session's role clause (or, with `previous`, its revocation) as a hub notice to it: it rides the
   * delivery pipeline (queued → delivered on the spoke's ack → injected by the session's adapter). A newer notice
   * supersedes what an older one still waits for. Journalled with its deliveries.
   */
  #recordClause(c: Connection, reason: string, previous?: string | null, injected = false, extra: Pick<RoleClause, 'reason' | 'to'> = {}): string | null {
    if (!this.#roles) return null;
    const definition = c.role !== null ? this.#roles.get().get(c.role) : undefined;
    const clause: RoleClause = c.role !== null ? { role: c.role, clause: definition?.clause ?? '', skills: definition?.skills ?? [] } : { role: null, clause: '', skills: [] };
    Object.assign(clause, extra);
    let text = c.role !== null ? clauseText(c.name, c.role, definition) : revokedText(c.name, previous ?? null, reason);
    // the role came with a note for this holder (#31): it rides with the clause, at the handover and on every reconnect
    const stored = c.role !== null ? this.#store.roleRecord(c.role) : null;
    const note = isRoleRecord(stored) && stored.note?.to === c.name ? stored.note : null;
    if (note) {
      clause.note = note.sections;
      clause.from = note.from;
      text = `${text}\n\n${noteText(note.from, note.sections)}`;
    }
    // kept on a new role after a handover (then: implementer): which role went where
    if (c.role !== null && extra.reason === 'handover' && previous) text = `cland hub: you handed the role ${ROLE_LABELS[previous] ?? previous} over to ${extra.to ?? 'another session'}: stop acting as ${ROLE_LABELS[previous] ?? previous}.\n\n${text}`;
    const superseded = this.#store.dropNotices(c.name, ROLE_NOTICE);
    const message: Message = { id: randomUUID(), from: 'hub', fromKind: 'hub', via: 'hub', to: [c.name], text, ts: this.#now().toISOString() };
    this.#store.record(message, [{ session: c.name, state: injected ? 'injected' : 'queued' }], this.#now().getTime(), ROLE_NOTICE);
    this.#roleNotices.set(message.id, clause);
    // journalled with every delivery (`journal.ts`)
    this.#log({ event: c.role !== null ? 'role-clause' : 'role-revoked', session: c.name, sessionId: c.sessionId, role: c.role, previous: previous ?? null, reason, id: message.id, superseded: superseded.length });
    return message.id;
  }

  #emitRole(session: string, role: string | null, previous: string | null, reason: string): void {
    this.#emit({ type: 'session.role', session, role, previous, reason, ts: this.#now().toISOString() });
  }

  /** Tell subscribers when the live Coordinator changes: `role.vacant` when none is left, `role.filled` when one is back. */
  #announceCoordinator(): void {
    const now = this.coordinator();
    if (now === this.#coordinator) return;
    const was = this.#coordinator;
    this.#coordinator = now;
    const ts = this.#now().toISOString();
    if (now === null) {
      this.#log({ event: 'coordinator-vacant', was });
      this.#emit({ type: 'role.vacant', role: COORDINATOR, ts });
    } else {
      this.#log({ event: 'coordinator-filled', session: now });
      this.#emit({ type: 'role.filled', role: COORDINATOR, session: now, ts });
    }
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

  /** Send to a session now if it is connected: whether the frame went out on an open socket. The record says
   *  `queued` either way until the spoke's ack; an unsent or unacked message goes out again on its next hello. */
  #send(message: Message, name: string): boolean {
    const c = this.#live.get(name);
    return c ? this.#sendTo(c, message) : false;
  }

  /** A role notice goes out as a `role` frame, everything else as a `deliver`. */
  #sendTo(c: Connection, message: Message): boolean {
    const clause = this.#roleNotices.get(message.id);
    return clause ? c.deliverRole(message, clause) : c.deliver(message);
  }

  /** A session the hub has seen within the queue's own TTL — beyond it a name is history, not an addressee. */
  #known(): string[] {
    return this.#store.knownSessions(this.#now().getTime() - this.#queueTtlMs).map((d) => d.name);
  }

  /**
   * The sessions a role address reaches: its live holders whenever any is connected (a holder that went
   * offline was replaced, it is not an addressee). With none live, the offline holders by their row when
   * `vacant` is `offline-holders`; nobody when it is `placeholder` (the caller queues under the role).
   * Several holders of one role are all reached. Arrays, never iterators.
   */
  #roleHolders(known: ReadonlySet<string>, vacant: 'offline-holders' | 'placeholder'): Map<string, string[]> {
    const since = this.#now().getTime() - this.#queueTtlMs;
    const roles = new Map<string, string[]>();
    for (const role of ROLE_NAMES) {
      const live = [...this.#live.values()].filter((c) => c.role === role).map((c) => c.name);
      const holders = live.length || vacant === 'placeholder' ? live : this.#store.sessionsWithRole(role, since).filter((n) => known.has(n) && !this.#live.has(n));
      roles.set(role, [...new Set(holders)].sort());
    }
    return roles;
  }

  /** Addresses as tags: the `@` dropped, each tag once, in order of first appearance. */
  static #normalized(tags: string[]): string[] {
    return [...new Set(tags.map((t) => t.trim().replace(/^@/, '')).filter((t) => t.length > 0))];
  }

  /** Tags → addressees. `all`, globs and roles reach the connected and the known-offline; `except` is the sender. */
  #resolveAddressees(tags: string[], except: string, vacant: 'offline-holders' | 'placeholder') {
    const connected = [...this.#live.keys()];
    const known = this.#known();
    const knownSet = new Set([...connected, ...known]);
    const ctx = { connected, known, roles: this.#roleHolders(knownSet, vacant) };
    const sessions = new Set<string>();
    const unknown: string[] = [];
    const empty: Array<{ tag: string; reason: string }> = []; // tags that reach nobody but the sender — a fact, never a refusal
    const tagOf = new Map<string, string[]>(); // tag → the session names it resolved to
    for (const tag of HubCore.#normalized(tags)) {
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

  // ---------------------------------------------------------------- topics

  topics(): Topic[] {
    return this.#store.topics();
  }

  topicRef(id: string): TopicRef | null {
    const t = this.#store.topic(id);
    return t ? { id: t.id, title: t.title, ...(t.item !== null ? { item: t.item } : {}) } : null;
  }

  /** What a `topic` event is about: a change of any of these is published; the unread count alone is not. */
  static #topicSignature(t: Topic): string {
    return JSON.stringify([t.status, t.warning ?? null, t.item, t.title]);
  }

  /** Tell subscribers about every topic whose status, warning, binding or title changed since they last heard,
   *  and about the ones in `force` whatever changed (the human's unread count). */
  #publishTopics(force: ReadonlySet<string> = new Set()): void {
    for (const topic of this.#store.topics()) {
      const signature = HubCore.#topicSignature(topic);
      if (this.#publishedTopics.get(topic.id) === signature && !force.has(topic.id)) continue;
      this.#publishedTopics.set(topic.id, signature);
      this.#emit({ type: 'topic', topic });
    }
  }

  /** Move a topic's status (spec 4.5); Agents has none to move. */
  #move(topic: Topic, move: TopicMove, why: string): TopicStatus {
    if (topic.id === AGENTS.id) return topic.status;
    let next = nextStatus(topic.status, move);
    // an open ask keeps its topic waiting for the human (spec 4.5): only answering, resolve or close end that
    if (next !== 'closed' && next !== 'waiting for human' && this.asks.openIn(topic.id)) next = 'waiting for human';
    if (next !== topic.status) {
      this.#store.setTopicStatus(topic.id, next);
      this.#log({ event: 'topic-status', topic: topic.id, from: topic.status, to: next, why });
    }
    return next;
  }

  /**
   * Open a topic (spec 4.5): the human from the UI or an agent with `topic.create`; the system opens only General
   * and Agents. A title is required. `item` binds it to a unit of work, which has one topic at most: a second is
   * refused, and the item's `topic` field is written through the tracker.
   */
  createTopic(title: string, item?: string, by = HUMAN): Topic {
    const clean = typeof title === 'string' ? title.trim() : '';
    if (!clean) throw new TopicRefusal('a topic needs a title');
    if (clean.length > 200) throw new TopicRefusal('a topic title is at most 200 characters');
    let bound: string | null = null;
    if (item !== undefined && item !== null && (typeof item !== 'string' || item.trim() === '')) throw new TopicRefusal('`item` is blank: name the item to bind (T-<n>), or leave it out');
    if (item !== undefined && item !== null) {
      if (!this.#items) throw new TopicRefusal("this hub has no tracker: a topic is bound to an item only on a project's hub");
      const found = this.#items.check(item.trim());
      bound = found.id;
      const existing = this.#store.topicOfItem(bound) ?? (found.topic !== null ? this.#store.topic(found.topic) : null);
      if (existing) throw new TopicRefusal(`${bound} already has a topic: "${existing.title}" (${existing.id}); one topic per unit of work: write there`);
      if (found.state === 'closed') throw new TopicRefusal(`${bound} is closed: a closed unit of work gets no new topic`);
    }
    const id = this.#store.nextTopicId();
    const now = this.#now().toISOString();
    this.#store.createTopic(id, clean, bound, now);
    if (bound !== null) {
      try {
        this.#items?.bind(bound, id);
      } catch (err) {
        this.#store.deleteTopic(id);
        throw err;
      }
    }
    this.#log({ event: 'topic-created', topic: id, title: clean, item: bound, by });
    this.#publishTopics();
    return this.#topicOrThrow(id);
  }

  /** The human closes a topic (spec 4.5); a new message reopens it. Standing topics are never closed. */
  closeTopic(id: string, why = 'closed by the human'): Topic {
    const topic = this.#topicOrThrow(id);
    if (topic.standing) throw new TopicRefusal(`${topic.title} is a standing topic: it cannot be closed`);
    // its open asks are cancelled, and each asker is told (#33)
    this.asks.cancel(topic.id, `the topic "${topic.title}" was ${why}`);
    this.#move(topic, 'close', why);
    this.#publishTopics();
    return this.#topicOrThrow(id);
  }

  /** Clear a topic's wait back to `open`: the Coordinator's `resolve`, the human's `topic.resolve`. */
  resolveTopic(id: string, by = HUMAN): Topic {
    const topic = this.#topicOrThrow(id);
    if (topic.id === AGENTS.id) throw new TopicRefusal(`${topic.title} has no status to resolve: it is a record of what agents send each other`);
    nextStatus(topic.status, 'resolve'); // a closed topic is refused before anything moves
    // resolve withdraws the topic's open asks (#33)
    this.asks.withdraw(topic.id, by);
    this.#move(topic, 'resolve', `resolved by ${by}`);
    this.#publishTopics();
    return this.#topicOrThrow(id);
  }

  /** The human read a topic up to a message (else its latest): its unread count drops, subscribers hear it. */
  readTopic(id: string, upTo?: string): Topic {
    this.#topicOrThrow(id);
    this.#store.markTopicRead(id, upTo);
    this.#publishTopics(new Set([id]));
    return this.#topicOrThrow(id);
  }

  /**
   * The binding as the tracker's `task.link` and `task.create` with a topic see it (spec 4.5): one topic per item and
   * one item per topic; the store's binding follows the item's file.
   */
  topicBinding(): TopicBinding {
    return {
      check: (item, topicId) => {
        const topic = this.#store.topic(topicId);
        if (!topic) throw new TopicRefusal(`no topic "${topicId}"`);
        if (topic.standing) throw new TopicRefusal(`${topic.title} is a standing topic: it is bound to no item`);
        if (topic.item !== null && topic.item !== item) throw new TopicRefusal(`${topic.id} is already bound to ${topic.item}; one item per topic`);
        const existing = item === null ? null : this.#store.topicOfItem(item);
        if (existing && existing.id !== topic.id) throw new TopicRefusal(`${item} already has a topic: "${existing.title}" (${existing.id}); one topic per unit of work: write there`);
      },
      bound: (item, topicId) => {
        this.#store.setItemTopic(item, topicId);
        this.#log({ event: 'topic-bound', item, topic: topicId });
        this.#publishTopics();
      },
    };
  }

  /**
   * At start, what happened to the bound items while no hub watched (a hand edit, a `git pull`): a bound item that is
   * closed closes its topic and cancels its asks, as its closing would have.
   */
  reconcileBindings(): void {
    if (!this.#items) return;
    for (const topic of this.#store.topics()) {
      if (topic.item === null || topic.status === 'closed') continue;
      let state: string;
      try {
        state = this.#items.check(topic.item).state;
      } catch {
        continue; // the item is gone or unreadable: nothing to say about it
      }
      if (state === 'closed') this.itemClosed(topic.item);
    }
  }

  /** A unit of work closed (the tracker's close): its topic closes too. Never the other way round. */
  itemClosed(item: string): void {
    const topic = this.#store.topicOfItem(item);
    if (!topic || topic.status === 'closed') return;
    // its open asks are cancelled, and each asker is told (#33)
    this.asks.cancel(topic.id, `${item} was closed`);
    this.#move(topic, 'close', `${item} closed`);
    this.#publishTopics();
  }

  #topicOrThrow(id: string): Topic {
    const t = this.#store.topic(id);
    if (!t) throw new Error(`no topic "${id}"`);
    return t;
  }

  topicHistory(id: string, limit?: number): { topic: Topic; messages: TopicMessage[] } {
    const topic = this.#topicOrThrow(id);
    const n = Math.min(Math.max(1, Math.floor(limit ?? HISTORY_LIMIT)), TOPIC_HISTORY_LIMIT);
    return { topic, messages: this.#store.topicMessages(id, n) };
  }

  renameTopic(id: string, title: string): Topic {
    const topic = this.#topicOrThrow(id);
    if (topic.standing) throw new Error(`${topic.title} is a standing topic: it cannot be renamed`);
    const clean = title.trim();
    if (!clean) throw new Error('a topic needs a title');
    this.#store.renameTopic(id, clean, this.#now().toISOString());
    return this.#topicOrThrow(id);
  }

  deleteTopic(id: string): void {
    const topic = this.#topicOrThrow(id);
    if (topic.standing) throw new Error(`${topic.title} is a standing topic: it cannot be deleted`);
    this.#store.deleteTopic(id);
    this.#publishedTopics.delete(id);
    // its asks went with it: the inbox lists them no more
    this.inbox.refresh();
  }

  /**
   * The human writes into a topic, never into Agents. It addresses `to` when given, else the `@role` and
   * `@session-name` mentions in the text, else the Coordinator (spec 4.5). A role reaches its live holders; with
   * none connected the message is queued under the role (`@<role>`) until a session takes the role, and the topic
   * shows the warning (`no coordinator`) meanwhile. Always recorded: the human's words show in the topic whoever
   * they reach. The topic then waits for an agent, and the human has read it.
   */
  sendFromHuman(topicId: string, text: string, to?: string[], replyTo?: string, answerTo?: string): { message: TopicMessage; outcomes: SendOutcome[] } {
    const topic = this.#topicOrThrow(topicId);
    if (topic.id === AGENTS.id) {
      // Agents is the record of what agents send each other (spec 4.5): the human reads it, and writes there only
      // as a reply to an agent's message, which addresses that message's sender
      if (replyTo === undefined) throw new Error(`${topic.title} is read-only: it records what agents send each other; reply to a message there, or write in General or another topic`);
      const original = this.#store.message(replyTo);
      if (!original || original.topic !== AGENTS.id) throw new Error(`no message "${replyTo}" in ${topic.title} to reply to`);
      if (original.fromKind !== 'agent') throw new Error(`a hub notice has no sender to answer: reply to an agent's message in ${topic.title}`);
      to = [original.from];
    }
    const size = this.#hygiene.sizeRefusal(text);
    if (size) throw new HygieneError(size, { code: 'hygiene', rule: 'size' });
    if (!text.trim()) throw new Error('an empty message is not sent');
    const nowMs = this.#now().getTime();
    let tags: string[];
    let unmentioned: string[] = [];
    if (to !== undefined && HubCore.#normalized(to).length) tags = to;
    else {
      const known = new Set([...this.#live.keys(), ...this.#known()]);
      const found = mentions(text, (name) => known.has(name));
      tags = found.to.length ? found.to : [DEFAULT_HUMAN_ADDRESSEE];
      unmentioned = found.unknown;
    }
    // a role with no live holder waits for the next session to take it, not for a holder that went away
    const { sessions, unknown, empty, tagOf } = this.#resolveAddressees(tags, HUMAN, 'placeholder');
    const outcomes: SendOutcome[] = unknown.map((tag) => ({ to: tag, outcome: 'unknown', reason: `no session named "${tag}" is connected or known, and no role has that name` }));
    for (const tag of unmentioned) outcomes.push({ to: tag, outcome: 'unknown', reason: `@${tag} names no session the hub knows and no role: not addressed` });
    // a role with no holder: held for the role, not refused
    const placeholders = empty.map(({ tag }) => tag);
    const message: Message = {
      id: randomUUID(),
      from: HUMAN,
      fromKind: 'human',
      via: 'hub',
      to: [...sessions, ...placeholders],
      text,
      ts: this.#now().toISOString(),
      ...(replyTo !== undefined ? { replyTo } : {}),
      topic: topic.id,
      ...(answerTo !== undefined ? { answerTo } : {}),
    };
    this.#store.record(
      message,
      [...[...sessions].map((session) => ({ session, state: 'queued' as const })), ...placeholders.map((role) => ({ session: `@${role}`, state: 'queued' as const }))],
      nowMs,
    );
    this.#store.touchTopic(topic.id, message.ts);
    this.#store.markTopicRead(topic.id, message.id);
    // a person wrote to these sessions: their pairs count afresh (the loop breaker mutes a pair with no human between)
    for (const n of sessions) this.#hygiene.humanTouched(this.#identity(n));
    this.#emitMessage(message);
    this.#move(topic, 'human', 'a human message');
    this.#publishTopics();
    const states = new Map<string, boolean>();
    for (const n of sessions) states.set(n, this.#send(message, n));
    for (const [tag, names] of tagOf) {
      const offline = names.filter((n) => !states.get(n));
      outcomes.push(offline.length ? { to: tag, outcome: 'queued', reason: `${offline.join(', ')} offline — queued` } : { to: tag, outcome: 'delivered' });
    }
    for (const role of placeholders) outcomes.push({ to: role, outcome: 'queued', reason: `no session holding the role "${role}" is connected — queued until one takes it` });
    this.#log({ event: 'human-send', id: message.id, topic: topic.id, to: message.to, bytes: Buffer.byteLength(text, 'utf8'), ...(replyTo !== undefined ? { replyTo } : {}), ...(answerTo !== undefined ? { answerTo } : {}), outcomes: outcomes.map((o) => `${o.to}:${o.outcome}`) });
    const stage = this.#store.stage(message.id);
    return { message: { ...message, topic: topic.id, ...(stage ? { stage } : {}) }, outcomes };
  }

  /**
   * A session's `send`: addressees are session names, globs, `all`, or roles. With no addressee the
   * message goes into the topic for the human. The topic defaults to General for a message to the human
   * and to Agents for one between sessions (spec 4.5).
   */
  sendFromSession(from: string, to: string[], text: string, replyTo?: string, topicId?: string): { message: Message; outcomes: SendOutcome[]; topic: TopicRef } {
    const sender = this.#live.get(from);
    if (!sender) throw new Error(`unknown sender ${from}`);
    const toHuman = to.length === 0;
    const topic = this.#topicOrThrow(topicId ?? (toHuman ? GENERAL.id : AGENTS.id));
    const topicRef: TopicRef = { id: topic.id, title: topic.title };
    const nowMs = this.#now().getTime();
    const size = this.#hygiene.sizeRefusal(text);
    if (size) throw new HygieneError(size, { code: 'hygiene', rule: 'size' });
    const self = this.#identity(from);
    const rate = this.#hygiene.rateRefusal(self, nowMs);
    if (rate) {
      this.#log({ event: 'rate-limited', session: from });
      throw new HygieneError(rate, { code: 'hygiene', rule: 'rate' });
    }
    const { sessions, unknown, empty, tagOf } = this.#resolveAddressees(to, from, 'offline-holders');
    const outcomes: SendOutcome[] = unknown.map((tag) => ({ to: tag, outcome: 'unknown', reason: `no session named "${tag}" is connected or known, and no role has that name` }));
    for (const { tag, reason } of empty) outcomes.push({ to: tag, outcome: 'empty', reason });
    // the loop breaker: a muted pair refuses; a pair crossing the threshold gets muted and refuses
    const refused = new Map<string, { reason: string; refusal: HygieneRefusal }>();
    const loopRefusal = (other: string): HygieneRefusal => {
      const until = this.#hygiene.mutedUntil(self, other, nowMs);
      return { code: 'hygiene', rule: 'loop', ...(until !== null ? { until: new Date(until).toISOString() } : {}) };
    };
    for (const n of sessions) {
      const other = this.#identity(n);
      const muted = this.#hygiene.muteRefusal(self, other, nowMs, [from, n]);
      if (muted) {
        refused.set(n, { reason: muted, refusal: loopRefusal(other) });
        continue;
      }
      const until = this.#hygiene.countPair(self, other, nowMs);
      if (until !== null) {
        const reason = this.#hygiene.muteRefusal(self, other, nowMs, [from, n]) as string;
        const refusal = loopRefusal(other);
        refused.set(n, { reason, refusal });
        const pair = [from, n].sort();
        this.#log({ event: 'loop-breaker', pair: pair.join('|'), until: new Date(until).toISOString() });
        // both parties get the typed refusal, and Agents records the mute: lifted by the cool-down or `cland hub unmute`
        this.noticeInTopic(AGENTS.id, {
          kind: 'mute',
          to: pair,
          text: `${this.label(pair[0] as string)} ↔ ${this.label(pair[1] as string)} muted: ${reason.replace(/^loop breaker: \S+ ↔ \S+ /, '')}; lift it early with \`cland hub unmute ${pair.join(' ')}\``,
          detail: { ...refusal, pair },
        });
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
      topic: topic.id,
    };
    // recorded before it is sent: an ack can never arrive for a delivery the store does not know
    if (sessions.size > 0 || toHuman) {
      // who the human's latest message here waited for, read before this one is recorded
      const awaited = toHuman ? [] : this.#store.lastHumanAddressees(topic.id);
      this.#store.record(message, [...sessions].map((session) => ({ session, state: 'queued' as const })), nowMs);
      this.#store.touchTopic(topic.id, message.ts);
      this.#emitMessage(message);
      this.#move(topic, toHuman ? 'to-human' : awaited.includes(from) ? 'reply' : 'between-agents', `a message from ${from}`);
      this.#publishTopics();
      // every agent-to-agent message is in the Agents record (spec 4.5, #34): one sent into another topic is
      // referenced there (who to whom, where, which message), its text left where it was written
      if (!toHuman && topic.id !== AGENTS.id) {
        const addressees = [...sessions];
        this.noticeInTopic(AGENTS.id, {
          kind: 'agent-message',
          text: `${this.label(from)} → ${addressees.join(', ')} in "${topic.title}" (${topic.id}): message ${message.id}`,
          detail: { from, to: addressees, topic: topic.id, message: message.id },
        });
      }
    }
    const states = new Map<string, 'sent' | 'queued'>();
    for (const n of sessions) states.set(n, this.#send(message, n) ? 'sent' : 'queued');
    for (const [tag, names] of tagOf) {
      const blocked = names.filter((n) => refused.has(n));
      if (blocked.length === names.length) {
        const r = refused.get(blocked[0] as string) as { reason: string; refusal: HygieneRefusal };
        outcomes.push({ to: tag, outcome: 'refused', reason: r.reason, refusal: r.refusal });
        continue;
      }
      const queued = names.filter((n) => states.get(n) === 'queued');
      if (queued.length === names.length - blocked.length) outcomes.push({ to: tag, outcome: 'queued', reason: `${queued.join(', ')} offline — queued for up to ${Math.round(this.#queueTtlMs / 3_600_000)} h` });
      else if (queued.length) outcomes.push({ to: tag, outcome: 'delivered', reason: `queued for ${queued.join(', ')} (offline)` });
      else outcomes.push({ to: tag, outcome: 'delivered' });
    }
    if (sessions.size === 0 && !toHuman) {
      this.#log({ event: 'send-refused', from, to, outcomes: outcomes.map((o) => `${o.to}:${o.outcome}`) });
      return { message, outcomes, topic: topicRef };
    }
    this.#log({ event: 'send', id: message.id, from, to: message.to, topic: topic.id, bytes: Buffer.byteLength(text, 'utf8'), ...(replyTo !== undefined ? { replyTo } : {}), outcomes: outcomes.map((o) => `${o.to}:${o.outcome}`) });
    return { message, outcomes, topic: topicRef };
  }

  /**
   * A person lifts the loop breaker's mute of two sessions (by name; `cland hub unmute`, the UI's `hygiene.unmute`):
   * the pair's mute and count go, and Agents records it. Whether a mute was running.
   */
  unmute(a: string, b: string, by = HUMAN): { lifted: boolean; pair: [string, string] } {
    const [x, y] = [HubCore.#normalized([a])[0], HubCore.#normalized([b])[0]];
    if (!x || !y) throw new Error('unmute needs two session names');
    if (x === y) throw new Error('unmute needs two different sessions');
    const known = new Set([...this.#live.keys(), ...this.#store.sessionNames()]);
    for (const n of [x, y]) if (!known.has(n)) throw new Error(`no session named "${n}" is known to this hub`);
    const pair = [x, y].sort() as [string, string];
    const lifted = this.#hygiene.unmute(this.#identity(x), this.#identity(y));
    this.#log({ event: 'unmuted', pair: pair.join('|'), lifted, by });
    if (lifted) this.noticeInTopic(AGENTS.id, { kind: 'unmute', to: pair, text: `${this.label(pair[0])} ↔ ${this.label(pair[1])} unmuted by ${by}: they may write to each other again`, detail: { pair } });
    return { lifted, pair };
  }
}
