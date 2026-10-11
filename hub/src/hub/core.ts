// The hub's core: presence, names, routing and store-and-forward. Transport-free, so the network
// edge (`./server.ts`) is one thin layer over it.
import { crewSummary, type CrewConfig, type CrewSource } from '../crew.ts';
import type { Resumed } from './budget.ts';
import { randomUUID } from 'node:crypto';
import {
  PROTOCOL_VERSION,
  UPDATE_HINT,
  isSendKind,
  isHeldDelivery,
  type SubscriptionSubject,
  type SubscriptionEvent,
  type OwnedSubscription,
  type Artifact,
  type AgentsHistoryFilter,
  type HandoverNote,
  type Hello,
  type HubEvent,
  type HarnessProcessView,
  type SessionUsage,
  type HygieneRefusal,
  type Message,
  type Presence,
  type RefusalCode,
  type RoleClause,
  type RoleHolder,
  type RoleList,
  type SendOutcome,
  type SessionState,
  type SessionHold,
  type Topic,
  type TopicMessage,
  type TopicRef,
  type TopicStatus,
} from '../protocol.ts';
import { generatedName, nameRefusal, ROLE_LABELS, ROLE_NAMES, withRole, isNodeLeadRole } from '../names.ts';
import type { RolesSource } from '../roles/config.ts';
import { clauseText, revokedText } from '../roles/clause.ts';
import { isRoleRecord, noteText, renderNote, type PendingClaims, type RoleRecord } from '../roles/note.ts';
import { resolveTag } from '../address.ts';
import { decide, DEFAULT_PERMISSIONS } from '../roles/permissions.ts';
import { Store } from './store.ts';
import { Hygiene, HygieneError, type LoopBreaker, type RateLimit } from './hygiene.ts';
import { mentions, nextStatus, TopicRefusal, type TopicItems, type TopicMove } from './topics.ts';
import type { ItemChange, ItemSummary, TopicBinding } from '../tracker/tracker.ts';
import { sessionActor } from '../tracker/requests.ts';
import type { LogFn } from '../log.ts';
import { Asks } from './asks.ts';
import { Visibility, type VisibilityOverrides } from './visibility.ts';
import { IDLE_NOTIFY_MS, InboxBoard } from './inbox.ts';

/** Attachments describe the committed message: sent prompts never publish stale draft metadata. */
function messageArtifacts(artifacts?: Artifact[], mayChange: (a: Artifact) => boolean = () => true): Pick<Message, 'artifacts' | 'artifact'> {
  if (!artifacts?.length) return {};
  const sent = artifacts.map(a => a.kind === 'prompt' && !a.movedTo && mayChange(a) ? { ...a, status: 'sent' as const } : a);
  return { artifacts: sent, artifact: sent[0]! };
}

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

type DefaultItem = Pick<ItemSummary, 'id' | 'state' | 'parent' | 'claim'>;

type EventContext = { role?: string | null; item?: string | null; ancestry?: string[]; final?: boolean; taskChange?: 'status' | 'verdict'; ready?: boolean; lifecycle?: 'died' | 'stopped' | 'waiting for approval' | 'long idle' };

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
  /** Close the session's sockets: a kick (4001 — the spokes reconnect). */
  close: (reason: string, code?: number) => void;
  /**
   * The session's spokes, oldest first. A session has one, until its harness starts another with the same identity
   * while the first still stands (Codex starts one per thread of an app-server; an MCP reconnect leaves a socket
   * half-open): every one of them is the session and is answered, and `deliver` and `deliverRole` are the newest's.
   */
  spokes: SpokeSocket[];
};

/** One spoke's socket, as the hub writes to it. */
export type SpokeSocket = Pick<Connection, 'deliver' | 'deliverRole' | 'close'>;

/** Point the connection's own `deliver`, `deliverRole` and `close` at its spokes as they are now. */
function wire(connection: Connection): void {
  const newest = connection.spokes[connection.spokes.length - 1];
  if (!newest) return;
  connection.deliver = newest.deliver;
  connection.deliverRole = newest.deliverRole;
  connection.close = (reason, code) => {
    for (const spoke of [...connection.spokes]) spoke.close(reason, code);
  };
}

/** What the adapters' side says of a hello's launch (`HubCore.launchedRole`). */
export type LaunchedRole = { role: string | null; first: boolean; carried: boolean };
type LaunchIdentityBinding = { name: string; sessionId: string; prove: () => void } | { refusal: string };

export type HelloResult = { ok: true; name: string; connection: Connection; spoke: SpokeSocket } | { ok: false; code: RefusalCode; message: string };

export type CoreOptions = {
  /** Extra reserved names beyond the built-ins. */
  reservedNames?: Iterable<string>;
  /** The hub's memory; `:memory:` when absent. */
  store?: Store;
  queueTtlMs?: number;
  retentionMs?: number;
  rateLimit?: RateLimit;
  eventLimit?: RateLimit;
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
  crew?: CrewSource;
  /** The tracker as a topic's binding sees it (`topic.create` with an item); absent, a binding is refused. */
  items?: TopicItems;
  /** Indexed session work, without file I/O; absent on a hub without a tracker. */
  sessionHolds?: (sessionId: string) => SessionHold[];
  /** How long a session stays idle before subscriptions report it, ms (default 30 min; 0: never). */
  idleNotifyMs?: number;
  visibility?: VisibilityOverrides;
  topLevel?: () => string;
};

/** A hub notice recorded in a topic (Agents: the lifecycle record, spec 4.5): its kind, its text, who it is
 *  delivered to (nobody by default: the record is for reading), and its typed facts. */
/** The `meta` key holding the id of the last journalled lifecycle notice recorded in Agents. */
export const AGENTS_JOURNAL_CHECKPOINT = 'agents-journal-checkpoint';

export type TopicNotice = { kind: string; text: string; to?: string[]; detail?: Record<string, unknown>; criteria?: Message['criteria']; id?: string };

/** The one exclusive role (spec 4.4): a vacancy is announced. */
export const COORDINATOR = 'coordinator';
/** The `notice` kind of a stored role clause or revocation. */
const ROLE_NOTICE = 'role';

export class HubCore {
  readonly crew: CrewSource | undefined;
  publishCrew(config: CrewConfig): void { this.#emit({ type: 'crew', config, summary: crewSummary(config) }); }
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
  readonly #approvalCommands = new Map<string, string>();
  /** Told when a session's spoke accepted a message: the adapters inject it into the harness. */
  #onDelivered: ((messageId: string, session: string, sessionId: string) => void) | null = null;
  readonly #roles: RolesSource | null;
  /** Ordered admissions for every named role, including roles whose fresh definition may become exclusive. */
  readonly #roleAdmissions = new Map<string, Array<{ name: string }>>();
  /** The role a session was launched for, by the adapters' side (`Sessions`): `first` once, at the first hello of a
   *  launch (with `carried` when its first turn already carried the clause, Codex), else the role its process-table
   *  row keeps (a relaunch takes it back). A hello's role is honoured for it. */
  #launchedRole: ((name: string, sessionId: string, launchToken?: string) => LaunchedRole | null) | null = null;
  #pendingLaunch: ((sessionId: string) => string | null) | null = null;
  #launchIdentity: ((credential: string, sessionId: string) => LaunchIdentityBinding | null) | null = null;
  /** Clause and brief already carried by the launch's first turn, recorded as injected: notified once at flush. */
  readonly #carriedNotice = new Map<string, string[]>();
  /** The role notices sent this run, by message id: they go out as `role` frames, not `deliver`s. */
  readonly #roleNotices = new Map<string, RoleClause>();
  /** Told of every accepted hello (a pending claim move waits for its receiver's session id). */
  readonly #hellos = new Set<(name: string, sessionId: string, launchToken?: string) => void>();
  /** Told when a session takes a new name (the process table renames its row). */
  readonly #renamed = new Set<(from: string, to: string, sessionId: string) => void>();
  /** The live Coordinator last announced to subscribers. */
  #coordinator: string | null = null;
  #canSteerEvents: (sessionId: string) => boolean = () => false;
  readonly #processItems = new Map<string, string | null>();
  readonly #artifactStates = new Map<string, Artifact['status']>();
  readonly #processFacts = new Map<string, Pick<HarnessProcessView, 'status' | 'role'>>();
  #publishedPresence = '[]';
  #items: TopicItems | null;
  readonly #sessionHolds: (sessionId: string) => SessionHold[];
  /** The last indexed ownership survives a watcher removal until its final fan-out. */
  readonly #defaultItems = new Map<string, DefaultItem>();
  /** What subscribers last heard of each topic (status, warning, binding, title): a change is a `topic` event. */
  readonly #publishedTopics = new Map<string, string>();
  readonly #topicStatuses = new Map<string, TopicStatus>();
  /** The Coordinator's asks to the human (#33). */
  readonly asks: Asks;
  /** The human's inbox (#33): open asks, approvals, waiting topics, notifications. */
  readonly inbox: InboxBoard;
  readonly visibility: Visibility;

  constructor(options: CoreOptions = {}) {
    this.#reserved = new Set([HUMAN, ...(options.reservedNames ?? [])]);
    this.#now = options.now ?? (() => new Date());
    this.#log = options.log ?? (() => {});
    this.#store = options.store ?? new Store();
    this.#roles = options.roles ?? null;
    this.crew = options.crew;
    this.#items = options.items ?? null;
    this.#sessionHolds = options.sessionHolds ?? (() => []);
    this.visibility = new Visibility({ overrides: options.visibility ?? {}, now: this.#now, role: name => this.#store.roleOf(name), process: id => this.#processFacts.get(id), items: () => this.#items?.list?.() ?? [], topLevel: options.topLevel ?? (() => 'release') });
    for (const item of this.#items?.list?.() ?? []) if (item.state !== 'closed') this.#defaultItems.set(item.id, item);
    this.#queueTtlMs = options.queueTtlMs ?? QUEUE_TTL_MS;
    this.#retentionMs = options.retentionMs ?? RETENTION_MS;
    this.#hygiene = new Hygiene({
      ...(options.rateLimit ? { rateLimit: options.rateLimit } : {}),
      ...(options.loopBreaker ? { loopBreaker: options.loopBreaker } : {}),
      ...(options.maxTextBytes !== undefined ? { maxTextBytes: options.maxTextBytes } : {}),
      ...(options.eventLimit ? { eventLimit: options.eventLimit } : {}),
      memory: this.#store,
    });
    for (const a of this.#store.artifacts()) this.#artifactStates.set(a.id, a.status);
    const now = this.#now().toISOString();
    for (const t of STANDING_TOPICS) this.#store.ensureTopic(t.id, t.title, true, now);
    for (const t of this.#store.topics()) { this.#publishedTopics.set(t.id, HubCore.#topicSignature(t)); this.#topicStatuses.set(t.id, t.status); }
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
      identity: id => this.sessionIdentity(id),
      nextLead: (from, topic, forwarding) => this.#questionLead(from, topic, forwarding),
      sendFromSession: (from, topic, to, text, replyTo, kind, answerTo) => this.sendFromSession(from, [to], text, replyTo, topic, undefined, undefined, undefined, kind, undefined, false, answerTo),
      sendFromHuman: (topic, text, to, answerTo) => this.sendFromHuman(topic, text, to, undefined, answerTo),
      // an ask withdrawn or cancelled: a notice in its topic to the asker, through the one notice path
      noteTo: (topic, session, text) => {
        if (this.noticeInTopic(topic, { kind: 'ask-closed', text, to: [session] }) === null) throw new Error(`no topic "${topic}"`);
      },
    });
    this.inbox = new InboxBoard({
      visibility: this.visibility,
      store: this.#store,
      now: this.#now,
      log: this.#log,
      emit: (e) => this.#emit(e),
      topics: () => this.#store.topics(),
      presence: () => this.presence(),
      stateOf: (id) => this.sessionState(id),
      idleNotifyMs: options.idleNotifyMs ?? IDLE_NOTIFY_MS,
      idle: (session, minutes) => this.publishEvent({ session }, 'session.state', `${session} idle ${minutes} min`, { lifecycle: 'long idle' }),
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
        // Subscribers and their error logger observe a committed event; neither can undo it
        // or prevent the other subscribers from hearing the committed state.
        try { this.#log({ event: 'listener-failed', error: err instanceof Error ? err.message : String(err) }); }
        catch { /* the failed observer/logger must not turn publication into a domain failure */ }
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

  /** Observers and transport see committed rows; their failures cannot enter a caller's rollback path. */
  #afterCommit(publish: () => void): void {
    this.#store.afterCommit(publish, error => this.#log({ event: 'publication-failed', error: error instanceof Error ? error.message : String(error) }));
  }

  /** Seed ownership facts without publishing or advancing terminal checkpoints. */
  seedProcess(process: HarnessProcessView): void {
    this.#processFacts.set(process.sessionId, { status: process.status, role: process.role });
    this.#processItems.set(process.sessionId, process.item);
  }

  /** Seed active rows; recover a committed stop whose publication was interrupted by a hub crash. */
  rememberProcess(process: HarnessProcessView): void {
    if (process.status !== 'running') { this.publishProcess(process); return; }
    this.seedProcess(process);
    this.#store.setMeta(`subscription-terminal:${process.sessionId}`, '');
  }

  /** Every terminal fact records its fan-out and exact-subject cleanup together, before observers. */
  #terminalEvent(subject: SubscriptionSubject, event: SubscriptionEvent, text: string, context: EventContext = {}, options: { subscriberId?: string; selected?: OwnedSubscription[]; memberOnly?: boolean } = {}): void {
    this.#store.transaction(() => {
      this.publishEvent(subject, event, text, { ...context, final: true }, options.selected);
      if (options.subscriberId) this.#store.endSubscriptions(options.subscriberId);
      if (!options.memberOnly) {
        this.#store.endSubject(subject);
        if ('item' in subject) this.#store.endSubject({ subtree: subject.item });
      }
    });
  }

  /** Adapter-owned process facts go through the same subscription as the core's events. */
  publishProcess(process: HarnessProcessView): void {
    const previous = this.#processFacts.get(process.sessionId)?.status;
    this.seedProcess(process);
    const context = { role: process.role, item: process.item };
    const items = process.item ? [process.item] : this.#sessionItems(process.sessionId);
    const suffix = items.map(item => ` · ${item}`).join('');
    const checkpoint = `subscription-terminal:${process.sessionId}`;
    if (process.status === 'running') {
      this.#store.setMeta(checkpoint, '');
      if (previous !== process.status) this.publishEvent({ session: process.name }, 'session.state', `${process.name} launched${suffix}`, context);
    } else {
      // Status is committed before ProcessTable listeners run. The checkpoint and closure share the event commit.
      const signature = JSON.stringify([process.startedAt, process.status]);
      this.#store.transaction(() => {
        // The checkpoint covers cleanup as well as fan-out. A role/model/rename update
        // on an already-terminal row must preserve subscriptions created for its next launch.
        if (this.#store.meta(checkpoint) === signature) return;
        this.#terminalEvent({ session: process.name }, 'session.state', `${process.name} ${process.status === 'stopped' ? 'stopped' : 'died'}${suffix}`, { ...context, lifecycle: process.status === 'stopped' ? 'stopped' : 'died' },
          { subscriberId: process.sessionId });
        this.#store.setMeta(checkpoint, signature);
      });
    }
    this.#emit({ type: 'session.process', process });
  }

  publishCleanup(sessionId: string, pending: boolean): void {
    this.#emit({ type: 'session.cleanup', sessionId, state: pending ? 'pending stop' : 'settled' });
  }

  publishTask(change: ItemChange): void {
    if (change.item === null) {
      this.#terminalEvent({ item: change.id }, 'task', `${change.id} removed`, change.previousAncestry ? { ancestry: change.previousAncestry } : {});
      this.#defaultItems.delete(change.id);
      return;
    }
    if (change.item.state !== 'closed') this.#defaultItems.set(change.id, change.item);
    // Reparenting ends membership in departed ancestor subtrees, not those ancestor subscriptions.
    const current = this.#items?.ancestry?.(change.id) ?? [change.id];
    const departed = change.previousAncestry?.filter(id => !current.includes(id)) ?? [];
    if (departed.length) {
      const selected = this.#store.allSubscriptions().filter(s => 'subtree' in s.subject && departed.includes(s.subject.subtree) && s.events.includes('task'));
      this.#terminalEvent({ item: change.id }, 'task', `${change.id} left subtree`, {}, { selected, memberOnly: true });
    }
    for (const text of change.events ?? []) {
      if (text === 'closed') this.#terminalEvent({ item: change.id }, 'task', `${change.id} closed`);
      else this.publishEvent({ item: change.id }, 'task', `${change.id} ${text}`, text.startsWith('status changed ') ? { taskChange: 'status', ready: change.item.status === 'ready' } : text.startsWith('verdict posted ') ? { taskChange: 'verdict' } : {});
    }
    if (change.item.state === 'closed') this.#defaultItems.delete(change.id);
  }

  /** Immediate events still use the ordinary delivery queue and the adapter's ordinary injection. */
  eventSteering(canSteer: (sessionId: string) => boolean): void { this.#canSteerEvents = canSteer; }

  #sessionItems(sessionId: string): string[] {
    return (this.#items?.list?.() ?? []).filter(i => i.state !== 'closed' && [i.claim, ...i.holds].some(h => h && this.sessionIdentity(h.sessionId) === sessionId)).map(i => i.id);
  }

  /** A default can belong to a role-known lead whose first hello has not arrived yet. */
  subscriptionOwner(subscription: OwnedSubscription): string | null {
    return subscription.default ? this.#leadName(subscription.subscriberId) : this.#store.nameOfSession(subscription.subscriberId);
  }

  #leadName(sessionId: string): string | null {
    const id = this.sessionIdentity(sessionId);
    return id.startsWith('name:') ? id.slice(5) : this.connectionOf(id)?.name ?? this.#store.nameOfSession(id);
  }

  #defaultCoordinator(): string | null {
    // Store-and-forward includes a disconnected root lead, especially before spokes reconnect on restart.
    return this.coordinator() ?? this.#store.sessionsWithRole(COORDINATOR, this.#now().getTime() - this.#queueTtlMs)
      .find(name => {
        const status = this.#processFacts.get(this.#store.sessionIdOf(name) ?? '')?.status;
        return status !== 'stopped' && status !== 'exited';
      }) ?? null;
  }

  #nodeOwner(item: string, items: Map<string, DefaultItem>, excluded?: string): string | null {
    const seen = new Set<string>();
    for (let node = items.get(item); node && !seen.has(node.id); node = node.parent ? items.get(node.parent) : undefined) {
      seen.add(node.id);
      const claim = isNodeLeadRole(node.claim?.role) ? node.claim : null;
      const id = claim ? this.sessionIdentity(claim.sessionId) : null;
      if (!id || id === excluded || id === UNKNOWN_SESSION || !this.#leadName(id)) continue;
      const status = this.#processFacts.get(id)?.status;
      if (status !== 'stopped' && status !== 'exited') return id;
    }
    return null;
  }

  #defaultOwner(item: string, items: Map<string, DefaultItem>, excluded?: string): string | null {
    const owner = this.#nodeOwner(item, items, excluded);
    if (owner) return owner;
    const coordinator = this.#defaultCoordinator();
    return coordinator ? this.sessionIdentity(`name:${coordinator}`) : null;
  }

  #defaultItemSet(includeItem?: string): Map<string, DefaultItem> {
    const items = new Map<string, DefaultItem>((this.#items?.list?.() ?? []).filter(item => item.state !== 'closed').map(item => [item.id, item]));
    const removed = includeItem && this.#defaultItems.get(includeItem);
    if (removed && !items.has(removed.id)) items.set(removed.id, removed);
    return items;
  }

  /** Defaults are current ownership, not stored requests: claims and role handovers take effect without an await. */
  subscriptions(includeItem?: string): OwnedSubscription[] {
    const defaults: OwnedSubscription[] = [];
    const items = this.#defaultItemSet(includeItem);
    for (const item of items.values()) {
      const subscriberId = this.#defaultOwner(item.id, items);
      if (!subscriberId) continue;
      defaults.push({ id: `default:${subscriberId}:${item.id}`, subscriberId, subject: { item: item.id }, events: ['task', 'session.state'], digest: 'turn', default: true });
    }
    return [...this.#store.allSubscriptions(), ...defaults];
  }

  #eventMatches(s: OwnedSubscription, subject: SubscriptionSubject, context: EventContext): boolean {
    if (JSON.stringify(s.subject) === JSON.stringify(subject)) return true;
    if ('role' in s.subject) return s.subject.role === context.role;
    const item = 'item' in subject ? subject.item : context.item;
    if ('item' in s.subject) return item === s.subject.item;
    if ('subtree' in s.subject && item) return item === s.subject.subtree || ((context.ancestry ?? this.#items?.ancestry?.(item))?.includes(s.subject.subtree) ?? false);
    return false;
  }

  /** Snapshot the matching owners before publication; no await, so a stop cannot split fan-out. */
  publishEvent(subject: SubscriptionSubject, event: SubscriptionEvent, text: string, context: EventContext = {}, selected?: OwnedSubscription[]): void {
    const session = 'session' in subject ? subject.session : null;
    const facts = { ...(session ? { role: this.#store.roleOf(session), item: this.#processItems.get(this.#store.sessionIdOf(session) ?? '') ?? null } : {}), ...context };
    const recipients = new Map<string, 'turn' | 'now'>();
    // Claim-derived defaults address the item's lead, including an Aide; explicit requests stay crew-only.
    const defaultRecipients = new Set<string>();
    const memberships = session ? this.#sessionItems(this.#store.sessionIdOf(session) ?? '') : [];
    for (const s of selected ?? this.subscriptions('item' in subject ? subject.item : undefined)) {
      if (s.default && event === 'task' && !facts.taskChange && !facts.final) continue;
      if (s.default && event === 'session.state') {
        if (!facts.lifecycle) continue;
        // A lead's own death or long idle belongs one level up; an approval still reaches its lead.
        if (session === this.subscriptionOwner(s) && facts.lifecycle !== 'waiting for approval') continue;
      }
      const finalSubject = context.final && (JSON.stringify(s.subject) === JSON.stringify(subject) || ('item' in subject && 'subtree' in s.subject && s.subject.subtree === subject.item));
      if (!s.events.includes(event) && !finalSubject) continue;
      if (!selected && !this.#eventMatches(s, subject, facts) && !memberships.some(item => this.#eventMatches(s, subject, { ...facts, item }))) continue;
      const name = this.subscriptionOwner(s);
      if (!name || (!s.default && this.#store.roleOf(name) === 'aide')) continue;
      if (s.default) defaultRecipients.add(name);
      const mode = s.digest === 'now' && this.#canSteerEvents(s.subscriberId) ? 'now' : 'turn';
      if (recipients.get(name) !== 'now') recipients.set(name, mode);
    }
    // Ready is the item's handover to its supervising lead. It starts a turn
    // even on adapters without steering; other defaults remain digested.
    if (event === 'task' && facts.ready && 'item' in subject) {
      const items = this.#defaultItemSet(subject.item);
      const claim = items.get(subject.item)?.claim;
      const excluded = claim && isNodeLeadRole(claim.role) ? this.sessionIdentity(claim.sessionId) : undefined;
      const owner = this.#defaultOwner(subject.item, items, excluded);
      const name = owner ? this.#leadName(owner) : null;
      if (name) {
        defaultRecipients.add(name);
        recipients.set(name, 'now');
      }
    }
    if (session && (facts.lifecycle === 'long idle' || facts.lifecycle === 'died' || facts.lifecycle === 'stopped')) {
      const sessionId = this.sessionIdentity(`name:${session}`);
      const items = this.#defaultItemSet();
      for (const item of items.values()) {
        if (!item.claim || !isNodeLeadRole(item.claim.role) || this.sessionIdentity(item.claim.sessionId) !== sessionId) continue;
        const owner = this.#defaultOwner(item.id, items, sessionId);
        const name = owner ? this.#leadName(owner) : null;
        if (name && name !== session) {
          defaultRecipients.add(name);
          if (!recipients.has(name)) recipients.set(name, 'turn');
        }
      }
    }
    const body = this.#hygiene.boundedText(`event · ${event} · ${text.replace(/[\r\n\u2028\u2029]+/g, ' ')}`);
    const key = JSON.stringify([subject, event, body, context.final ?? false]);
    this.#store.transaction(() => {
      const groups = new Map<'turn' | 'now', string[]>();
      for (const [name, digest] of recipients) {
        const now = this.#now().getTime();
        if (!context.final && !this.#hygiene.admitEvent(this.#identity(name), now)) {
          this.#afterCommit(() => this.#log({ event: 'event-limited', subject, kind: event, session: name }));
          continue;
        }
        this.#dropExpired(name);
        const coalesced = digest === 'turn' && this.#store.coalesceEvent(name, subject, key, now, defaultRecipients.has(name));
        if (coalesced) {
          this.#afterCommit(() => this.#log({ event: 'event-delivery', id: coalesced.id, subject, kind: event, to: [name], count: coalesced.count, coalesced: true }));
          continue;
        }
        groups.set(digest, [...(groups.get(digest) ?? []), name]);
      }
      // All modes and recipient counts join the same commit before any observer can bind a digest.
      for (const [digest, to] of groups) {
        const message = this.#recordNotice(AGENTS.id, { kind: 'event', to, text: body, detail: { event, subject, key, digest, count: 1, ...(context.final ? { final: true } : {}) } }, defaultRecipients);
        if (!message) continue;
        this.#afterCommit(() => this.#emitMessage(message));
        for (const name of to) this.#afterCommit(() => { this.#send(message, name); });
        this.#afterCommit(() => this.#log({ event: 'event-delivery', id: message.id, subject, kind: event, to, count: 1, digest }));
      }
    });
  }

  publishUsage(session: string, sessionId: string, usage: SessionUsage): void {
    const subject = { session };
    const context = { role: this.#store.roleOf(session), item: this.#processItems.get(sessionId) ?? null };
    const crossings = new Map<string, OwnedSubscription[]>();
    for (const s of this.#store.allSubscriptions()) {
      if (!s.events.includes('usage') || !s.threshold || !this.#eventMatches(s, subject, context)) continue;
      const total = usage.total;
      const value = 'cost' in s.threshold ? total?.cost : total?.totalTokens;
      if (value === undefined) continue; // absent cost is unknown, never zero
      const limit = 'cost' in s.threshold ? s.threshold.cost : s.threshold.tokens;
      if (this.#store.usageCrossed(s.id, sessionId, value >= limit)) {
        const text = `${session} ${'cost' in s.threshold ? 'cost' : 'tokens'} threshold ${limit} crossed · ${value}`;
        crossings.set(text, [...(crossings.get(text) ?? []), s]);
      }
    }
    for (const [text, subscriptions] of crossings) this.publishEvent(subject, 'usage', text, context, subscriptions);
    this.#emit({ type: 'session.usage', session, sessionId, usage });
  }

  #publishPresence(): void {
    const sessions = this.presence();
    const signature = JSON.stringify(sessions);
    if (signature === this.#publishedPresence) return;
    this.#publishedPresence = signature;
    this.#emit({ type: 'presence', sessions });
  }

  get store(): Store {
    return this.#store;
  }

  /** Authoritative identity before the tracker's queued durable adoption has completed. */
  sessionIdentity(id: string): string {
    if (!id.startsWith('name:')) return id;
    const alias = this.#store.sessionAlias(id.slice(5));
    if (alias) return alias;
    const actual = this.#store.sessionIdOf(id.slice(5));
    return actual && actual !== UNKNOWN_SESSION ? actual : id;
  }

  /** Shared name reservation invariant. Explicit paths may reuse settled history; generated names may not.
   * Pending aliases stay reserved until adoption settles, including for their owner. */
  nameReservation(name: string, sessionId?: string, retained?: ReadonlySet<string>): string | null {
    const holder = this.#live.get(name);
    if (holder && holder.sessionId !== sessionId) return `name "${name}" is in use by a live session`;
    if (this.#store.sessionAlias(name)) return `name "${name}" has a pending session identity adoption: retry after adoption succeeds`;
    if (retained?.has(name)) return `name "${name}" has retained traffic`;
    return null;
  }

  /** Continue above the caller's claimed ancestor, never return to a lower item's claimant. */
  #questionLead(from: string, topic: Topic, forwarding = false): string | null {
    if (this.#store.roleOf(from) === COORDINATOR) return null;
    if (!topic.item) return this.#defaultCoordinator();
    const items = this.#defaultItemSet();
    const id = this.sessionIdentity(`name:${from}`);
    for (const node of this.#items?.ancestry?.(topic.item) ?? [topic.item]) {
      const claim = items.get(node)?.claim;
      if (claim && this.sessionIdentity(claim.sessionId) === id) return this.#itemLead(node, from) ?? this.#defaultCoordinator();
    }
    if (forwarding) throw new TopicRefusal('this receiving lead no longer leads the topic item ancestry; upward forwarding is refused');
    return this.#itemLead(topic.item, from) ?? this.#defaultCoordinator();
  }

  #itemLead(item: string, except: string): string | null {
    const found = this.#items?.lead(item);
    if (!found) throw new Error(`no item ${item}: address coordinator instead`);
    if (found.state === 'closed') throw new Error(`${item} is closed: address coordinator instead`);
    // Reports from a node's own lead climb to the next lead. Other senders address
    // the nearest owner, including inherited ownership for unclaimed descendants.
    const owner = this.#nodeOwner(item, this.#defaultItemSet(), this.sessionIdentity(`name:${except}`));
    const name = owner ? this.#leadName(owner) : null;
    return name && name !== HUMAN ? name : null;
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
    // A credential-proven anonymous hello gets a unique stable identity before any grant.
    // Uncredentialed UNKNOWN_SESSION remains anonymous and cannot own a launch by name.
    const original = hello.sessionId !== UNKNOWN_SESSION ? this.connectionOf(hello.sessionId) : undefined;
    const joining = original && (hello.name === undefined || hello.name === original.name);
    const launchIdentity = hello.launchToken && !joining ? this.#launchIdentity?.(hello.launchToken, hello.sessionId) : null;
    if (launchIdentity && 'refusal' in launchIdentity) return { ok: false, code: 'name-in-use', message: launchIdentity.refusal };
    if (launchIdentity) {
      const known = this.connectionOf(launchIdentity.sessionId)?.name ?? this.#store.nameOfSession(launchIdentity.sessionId);
      if ((known !== null && known !== undefined && known !== launchIdentity.name) || (hello.name !== undefined && hello.name !== launchIdentity.name)) {
        return { ok: false, code: 'name-in-use', message: `launch "${launchIdentity.name}" cannot bind session "${known ?? hello.name}" (${launchIdentity.sessionId}) to another identity; use the launch's own session identity and name` };
      }
      hello = { ...hello, name: hello.name ?? launchIdentity.name, sessionId: launchIdentity.sessionId };
    }
    // The session id is the stable identity; a hello with the unknown id identifies nobody.
    const identified = hello.sessionId !== UNKNOWN_SESSION;
    const held = identified ? this.connectionOf(hello.sessionId) : undefined;
    const live = held !== undefined && (hello.name === undefined || hello.name === held.name) ? held : undefined;
    if (live) {
      // Another spoke of a session that is connected, under the session's name or asking for none: it joins it.
      // The session did not go away, so nothing of a hello happens again (no role is resolved, no clause
      // re-sent); deliveries go to this newest spoke from now on, and the older ones are answered for as long as
      // they stand. Closing them instead left a session whose harness still called its tools through the old
      // spoke with no tools at all (T-51). A spoke that asks for another name is taken for another session, as before.
      const spoke: SpokeSocket = { deliver, deliverRole, close };
      live.spokes.push(spoke);
      wire(live);
      this.#log({ event: 'replaced', name: live.name, sessionId: hello.sessionId, spokes: live.spokes.length });
      return { ok: true, name: live.name, connection: live, spoke };
    }
    let requested = hello.name;
    if (requested === undefined && identified) {
      // No name asked for: a session the hub already knows gets its own name back (unless another session
      // claimed it by name since), with whatever waited for it.
      const previous = this.#store.nameOfSession(hello.sessionId);
      if (previous !== null && nameRefusal(previous, this.#reserved) === null && this.nameReservation(previous, hello.sessionId) === null) requested = previous;
    }
    let name: string;
    if (requested !== undefined) {
      const refusal = nameRefusal(requested, this.#reserved);
      if (refusal) return { ok: false, code: 'bad-name', message: refusal };
      // This session's own existing connection joined above; every remaining live holder is a collision.
      const identityRefusal = this.nameReservation(requested);
      if (identityRefusal) return { ok: false, code: 'name-in-use', message: identityRefusal };
      name = requested;
    } else {
      // Never a name any session has held: a generated name carries no other session's queue or history.
      const retained = new Set(this.#store.sessionNames());
      name = generatedName(candidate => nameRefusal(candidate, this.#reserved) !== null || this.nameReservation(candidate, undefined, retained) !== null);
    }
    let role: string | null = null;
    let fresh = false;
    let carried = false;
    if (this.#roles) {
      const r = this.#helloRole(name, hello);
      if (!r.ok) {
        this.#log({ event: 'refused-role', name, sessionId: hello.sessionId, requested: hello.role ?? null, reason: r.message });
        return { ok: false, code: 'no-role', message: r.message };
      }
      ({ role, fresh, carried } = r);
    } else if (hello.role !== undefined) {
      // no project: the role is a declared label; an unknown one is ignored
      if (ROLE_NAMES.includes(hello.role)) role = hello.role;
      else this.#log({ event: 'role-ignored', name, role: hello.role, roles: ROLE_NAMES });
    }
    // Only a validated new hello proves launch ownership. A join returned above;
    // refused names and roles likewise cannot enter a launch's rollback targets.
    launchIdentity?.prove();
    const spoke: SpokeSocket = { deliver, deliverRole, close };
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
      spokes: [spoke],
    };
    wire(connection);
    this.#live.set(name, connection);
    this.#store.rememberSession(name, this.#now().getTime());
    this.#store.rememberSessionId(name, hello.sessionId);
    // The row equals the connection from here on: a line the hello did not inherit is gone for good.
    this.#store.rememberStatus(name, connection.status);
    this.#store.rememberRole(name, connection.role);
    // what waited for the role while nobody held it now waits for this session (flushed after the welcome)
    if (role !== null) {
      const { moved, merged } = this.#claimRoleQueue(role, name);
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
      const id = this.#recordClause(connection, carried ? 'assigned at launch (first turn)' : fresh ? 'assigned at launch' : 'hello', undefined, carried);
      if (carried && id) this.#carriedNotice.set(name, [id]);
    }
    // The launch queued its brief before spawn. Its first hello may arrive after a hub restart.
    for (const brief of hello.launchToken ? this.#store.activateLaunchBriefs(name, hello.launchToken, !carried) : []) {
      if (this.#store.stage(brief.id) === 'injected') {
        this.#carriedNotice.set(name, [...(this.#carriedNotice.get(name) ?? []), brief.id]);
      } else this.#store.bindLaunchClause(brief.id, name);
    }
    if (fresh) {
      this.#log({ event: 'role-taken-at-launch', session: name, sessionId: hello.sessionId, role });
      this.#emitRole(name, role, null, 'launch');
    }
    this.#announceCoordinator();
    for (const fn of [...this.#hellos]) {
      try {
        fn(name, hello.sessionId, hello.launchToken);
      } catch (err) {
        this.#log({ event: 'hello-listener-failed', name, error: err instanceof Error ? err.message : String(err) });
      }
    }
    this.#publishPresence();
    return { ok: true, name, connection, spoke };
  }

  /**
   * The role a hello gets on a project's hub: at the first hello of a launch, the role it was launched for (its
   * reservation); else the one its name holds (assigned by the human, or kept from an earlier hello: a role follows
   * the name), else the one its process-table row keeps (a relaunch). A requested role (`CLAND_ROLE`) is never
   * enough on its own. No role: refused, the session stays off the hub (spec 4.4). An exclusive role is checked on
   * every hello: a holder remembered past the queue's TTL that comes back after another session took the role is
   * refused it, and the role it remembered is cleared (`role-superseded` and a `session.role` event).
   */
  #helloRole(name: string, hello: Hello): { ok: true; role: string; fresh: boolean; carried: boolean } | { ok: false; message: string } {
    const refusal = (role: string, taken: string) => `role "${role}" is held by ${taken}: one session holds it at a time — clear it first with \`cland role clear ${taken.split(' ')[0]}\``;
    const launched = this.#launchedRole?.(name, hello.sessionId, hello.launchToken) ?? null;
    const held = this.#store.roleOf(name);
    if (launched?.first && launched.role !== null && launched.role === held && ROLE_NAMES.includes(launched.role)) {
      const taken = this.#exclusiveHolder(launched.role, name);
      if (taken) return { ok: false, message: refusal(launched.role, taken) };
      return { ok: true, role: launched.role, fresh: true, carried: launched.carried };
    }
    if (held !== null && ROLE_NAMES.includes(held)) {
      const taken = this.#exclusiveHolder(held, name);
      if (taken) {
        // a stale holder: another session took the role while this one was forgotten
        this.#store.rememberRole(name, null);
        this.#log({ event: 'role-superseded', session: name, sessionId: hello.sessionId, role: held, holder: taken });
        this.#emitRole(name, null, held, `superseded: ${taken} holds it`);
        return { ok: false, message: `no role: "${name}" no longer holds the role ${ROLE_LABELS[held] ?? held}: ${taken} holds it now, and one session holds it at a time — assign another with \`cland role set ${name} <${ROLE_NAMES.join('|')}>\`; the session connects on its next retry` };
      }
      if (hello.role !== undefined && hello.role !== held) this.#log({ event: 'role-request-ignored', name, requested: hello.role, holds: held });
      return { ok: true, role: held, fresh: false, carried: launched?.role === held && launched.carried };
    }
    if (launched !== null && !launched.first && launched.role !== null && ROLE_NAMES.includes(launched.role)) {
      const taken = this.#exclusiveHolder(launched.role, name);
      if (taken) return { ok: false, message: refusal(launched.role, taken) };
      return { ok: true, role: launched.role, fresh: true, carried: false };
    }
    const asked = hello.role !== undefined ? ` (it asked for "${hello.role}", which the hub grants only to a session it launched for that role)` : '';
    return { ok: false, message: `no role: "${name}" holds none${asked} — assign one with \`cland role set ${name} <${ROLE_NAMES.join('|')}>\`; the session connects on its next retry` };
  }

  /** After the welcome: hand a session what waited for it, oldest first; drop what waited too long. A message
   *  stays queued until the spoke acks it, so what a previous socket never acked is sent again here. */
  flushQueued(name: string): void {
    const connection = this.#live.get(name);
    if (!connection) return;
    this.#dropCrewDeliveries(name);
    const { deliver, dropped } = this.#store.pendingFor(name, this.#now().getTime(), this.#queueTtlMs);
    for (const message of dropped) {
      this.#afterCommit(() => this.#log({ event: 'dropped', reason: 'queue ttl', id: message.id, session: name }));
      this.#afterCommit(() => this.#emitStage(message.id));
    }
    // The current clause always precedes a carried brief's notice, including a first hello after restart.
    const carried = this.#carriedNotice.get(name);
    this.#carriedNotice.delete(name);
    const notices = (carried ?? []).flatMap(id => this.#store.message(id) ?? []);
    // a role clause first: what else waited is read under the role
    const hasClause = (m: Message) => this.#roleNotices.has(m.id) || m.digest?.some(note => this.#roleNotices.has(note.id));
    const ordered = [...notices.filter(hasClause), ...deliver.filter(hasClause), ...notices.filter(m => !hasClause(m)), ...deliver.filter(m => !hasClause(m))];
    for (const message of ordered) this.#sendTo(connection, message);
    if (deliver.length) this.#log({ event: 'flushed', session: name, count: deliver.length });
  }

  /** The spoke accepted a message: its delivery moves from queued to delivered. A stale connection acks nothing. */
  ack(connection: Connection, messageId: string): void {
    if (!this.isCurrent(connection)) return;
    if (!this.#store.markDelivered(messageId, connection.name, this.#now().getTime())) return;
    for (const id of this.#store.deliveryIds(messageId, connection.name)) {
      this.#log({ event: 'acked', id, session: connection.name });
      this.#emitStage(id);
    }
    this.#onDelivered?.(messageId, connection.name, connection.sessionId);
  }

  artifactChanged(artifact: Artifact): void {
    this.#afterCommit(() => this.#publishArtifact(artifact));
  }

  #publishArtifact(artifact: Artifact): void {
    const previous = this.#artifactStates.get(artifact.id);
    this.#artifactStates.set(artifact.id, artifact.status);
    const context = { item: this.#store.topic(artifact.topic)?.item ?? null, role: this.#store.roleOf(artifact.creator) };
    const subjects: SubscriptionSubject[] = [{ topic: artifact.topic }, { session: artifact.creator }];
    // One logical occurrence per recipient even when topic and creator subscriptions overlap.
    const selected = this.#store.allSubscriptions().filter(s => subjects.some(subject => this.#eventMatches(s, subject, context)));
    const publish = (action: string) => this.publishEvent({ topic: artifact.topic }, 'artifact', `${artifact.id} ${action} · ${artifact.title}`, context,
      selected);
    if (previous === undefined) publish('created');
    if ((artifact.status === 'shared' || artifact.status === 'sent') && artifact.status !== previous) publish('shared');
    this.#emit({ type: 'artifact', artifact });
  }
  textFits(text: string): boolean { return this.#hygiene.sizeRefusal(text) === null; }
  boundedText(text: string): string { return this.#hygiene.boundedText(text); }

  /** The message's stage as stored, to the subscribers; it moves only once every addressee got as far. */
  #emitStage(messageId: string): void {
    const topic = this.#store.message(messageId)?.topic;
    const stage = this.#store.stage(messageId);
    if (topic !== undefined && stage !== undefined && stage !== 'queued') this.#emit({ type: 'delivery', topic, message: messageId, stage });
  }

  #dropExpired(name: string): void {
    for (const message of this.#store.expireQueued(name, this.#now().getTime(), this.#queueTtlMs)) {
      this.#afterCommit(() => this.#log({ event: 'dropped', reason: 'queue ttl', id: message.id, session: name }));
      this.#afterCommit(() => this.#emitStage(message.id));
    }
  }

  #record(...args: Parameters<Store['record']>): void {
    // Expired progress is settled before a new delivery can bind it. No transport await separates these writes.
    for (const delivery of args[1]) {
      this.#dropCrewDeliveries(delivery.session);
      this.#dropExpired(delivery.session);
    }
    this.#store.record(...args);
  }

  #dropCrewDeliveries(name: string): void {
    if (this.#store.roleOf(name) !== 'aide') return;
    const { dropped, reheld } = this.#store.dropCrewDeliveries(name);
    for (const id of dropped) {
      this.#afterCommit(() => this.#log({ event: 'dropped', reason: 'Aide receives only direct addresses and its role clause (v0.1 §3.3)', id, session: name }));
    }
    for (const id of [...dropped, ...reheld]) this.#afterCommit(() => this.#emitStage(id));
  }

  #claimRoleQueue(role: string, name: string): { moved: number; merged: string[] } {
    this.#dropExpired(name);
    this.#dropExpired(`@${role}`);
    return this.#store.claimRoleQueue(role, name);
  }

  /** Listen to renames (`from`, `to`, the session id); returns the unsubscribe. */
  onRenamed(listener: (from: string, to: string, sessionId: string) => void): () => void {
    this.#renamed.add(listener);
    return () => this.#renamed.delete(listener);
  }

  /** Who injects what a spoke accepted (the adapters' supervisor); one at a time. */
  onDelivered(listener: ((messageId: string, session: string, sessionId: string) => void) | null): void {
    this.#onDelivered = listener;
  }

  /** A session's adapter confirmed the turn (spec 4.2, `injected`); false when the delivery was not `delivered`. */
  markInjected(messageId: string, session: string): boolean {
    if (!this.#store.markInjected(messageId, session)) return false;
    for (const id of this.#store.deliveryIds(messageId, session)) {
      this.#log({ event: 'injected', id, session });
      this.#emitStage(id);
    }
    return true;
  }

  /**
   * A session's adapter handed the message over and got no answer (whether the turn started cannot be told): the
   * delivery is `uncertain`, logged, and the human's inbox notes it. Never retried on its own; `retryUncertain`
   * sends it again.
   */
  markUncertain(messageId: string, session: string, why: string): boolean {
    if (!this.#store.markUncertain(messageId, session)) return false;
    for (const id of this.#store.deliveryIds(messageId, session)) this.#log({ event: 'inject-uncertain', id, session, why });
    this.inbox.uncertain(session, this.label(session), messageId, why);
    return true;
  }

  /** The human asks for an uncertain delivery to go again: back to `delivered`; false when it was not uncertain. */
  retryUncertain(messageId: string, session: string): boolean {
    if (!this.#store.retryUncertain(messageId, session)) return false;
    this.#log({ event: 'inject-retry', id: messageId, session });
    return true;
  }

  /** A session's state, from its adapter (never from the model's `status`); subscribers hear a change. */
  setSessionState(sessionId: string, name: string, state: SessionState, source: string, approvalCommand?: string): boolean {
    const previous = this.#approvalCommands.get(sessionId);
    // A poll that still reports waiting supplies no new command. Keep the pushed command until
    // the state changes; a second approval can update it without a state transition.
    const command = state === 'waiting for approval' ? approvalCommand ?? previous : undefined;
    if (this.#states.get(sessionId) === state && command === previous) return false;
    const changed = this.#states.get(sessionId) !== state;
    this.#states.set(sessionId, state);
    if (command !== undefined) this.#approvalCommands.set(sessionId, command);
    else this.#approvalCommands.delete(sessionId);
    this.#log({ event: 'session-state', session: name, state, source });
    if (changed && state !== 'unknown') this.publishEvent({ session: name }, 'session.state', `${name} ${state}`, state === 'waiting for approval' ? { lifecycle: state } : {});
    this.#emit({ type: 'session.state', session: name, sessionId, state, source, ts: this.#now().toISOString(), ...(command !== undefined ? { approvalCommand: command } : {}) });
    return true;
  }

  sessionApprovalCommand(sessionId: string): string | undefined {
    return this.#approvalCommands.get(sessionId);
  }

  sessionState(sessionId: string): SessionState {
    return this.#states.get(sessionId) ?? 'unknown';
  }

  /** The live connection of a session id, if its spoke is connected. */
  connectionOf(sessionId: string): Connection | undefined {
    return [...this.#live.values()].find((c) => c.sessionId === sessionId);
  }

  /** A socket closed. Only the connection that owns the name is removed: a stale close must never
   *  evict the reconnect that already took the name over. While another spoke of the session stands (`spoke` is
   *  the one that closed), the session stays: its deliveries go to the newest that is left. */
  disconnect(connection: Connection, spoke?: SpokeSocket): void {
    if (this.#live.get(connection.name) !== connection) return;
    if (spoke) {
      connection.spokes = connection.spokes.filter((s) => s !== spoke);
      if (connection.spokes.length > 0) {
        wire(connection);
        this.#log({ event: 'spoke-left', name: connection.name, sessionId: connection.sessionId, spokes: connection.spokes.length });
        // what the spoke that left had not acked goes to the one that is left
        this.flushQueued(connection.name);
        return;
      }
    }
    this.#live.delete(connection.name);
    this.#log({ event: 'bye', name: connection.name });
    this.#publishPresence();
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
      holds: this.sessionHolds(c),
    }));
  }

  sessionHolds(session: Pick<Connection, 'name' | 'sessionId' | 'role'>): SessionHold[] {
    return this.#sessionHolds(sessionActor(session, UNKNOWN_SESSION).id);
  }

  /** Tracker changes may alter work even when a session's role and state stay the same. */
  refreshPresence(): void { this.#publishPresence(); }

  /** A hub-kind message to one session: delivered now or queued, and recorded. */
  notify(name: string, text: string): void {
    const notice: Message = { id: randomUUID(), from: 'hub', fromKind: 'hub', via: 'hub', to: [name], text, ts: this.#now().toISOString() };
    this.#record(notice, [{ session: name, state: 'queued' }], this.#now().getTime());
    this.#send(notice, name);
  }

  /**
   * Record a hub notice in a topic (Agents by default): the one path every lifecycle record takes (`agents-topic.ts`
   * maps the hub's domain events to it; the loop breaker's mute and #30's permission refusals call it directly).
   * Subscribers see it as a `message` event with its `kind`; `to` also delivers it to those sessions. Returns its id.
   */
  noticeInTopic(topicId: string, notice: TopicNotice): string | null {
    // a notice with an id of its own (a journalled lifecycle event's) is recorded and published once, however often
    // it is replayed
    if (notice.id !== undefined && this.#store.topic(topicId) && this.#store.message(notice.id) !== null) return notice.id;
    const message = this.#recordNotice(topicId, notice);
    if (!message) return null;
    this.#publishNotice(message);
    return message.id;
  }

  /** A topic notice written to the store (inside a caller's transaction, when there is one), not yet published. */
  #recordNotice(topicId: string, notice: TopicNotice, direct: ReadonlySet<string> = new Set()): Message | null {
    const topic = this.#store.topic(topicId);
    if (!topic) return null;
    // a notice with an id of its own is recorded once: a replay finds the stored one
    if (notice.id !== undefined) {
      const stored = this.#store.message(notice.id);
      if (stored !== null) return stored;
    }
    const to = [...new Set(notice.to ?? [])].filter(name => direct.has(name) || this.#store.roleOf(name) !== 'aide');
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
      ...(notice.criteria !== undefined ? { criteria: notice.criteria } : {}),
    };
    this.#record(
      message,
      to.map((session) => ({ session, state: 'queued' as const, ...(direct.has(session) ? { direct: true } : {}) })),
      this.#now().getTime(),
    );
    this.#store.touchTopic(topic.id, message.ts);
    // a notice with an id of its own is a journalled lifecycle event's: the checkpoint the journal's replay starts
    // after, kept apart from the messages retention prunes
    if (notice.id !== undefined) this.#store.setMeta(AGENTS_JOURNAL_CHECKPOINT, notice.id);
    return message;
  }

  /** A recorded notice reaches the subscribers and its addressees. */
  #publishNotice(message: Message): void {
    for (const a of message.artifacts ?? []) this.artifactChanged(this.#store.artifact(a.id)!);
    this.#emitMessage(message);
    for (const n of message.to) this.#send(message, n);
  }

  /** Listen to every accepted hello (`name`, session id); returns the unsubscribe. */
  onSessionHello(listener: (name: string, sessionId: string, launchToken?: string) => void): () => void {
    this.#hellos.add(listener);
    return () => this.#hellos.delete(listener);
  }

  /** Persist the one-time first input before spawning; hello binds its clause before the post-welcome flush. */
  recordLaunchBrief(message: Message, launchId: string, carried: boolean): void {
    const name = message.to[0]!;
    this.#store.transaction(() => {
      // A carried input contains only clause and brief; leave held notes for the next ordinary delivery.
      this.#record(message, [{ session: name, state: 'queued', direct: true }], this.#now().getTime(), null, !carried);
      this.#store.rememberLaunchBrief(message.id, name, launchId);
    });
    this.#store.touchTopic(AGENTS.id, message.ts);
    this.#emitMessage(message);
    this.#emitStage(message.id);
    this.#log({ event: 'send', id: message.id, from: message.from, kind: message.kind, to: message.to, topic: message.topic, bytes: Buffer.byteLength(message.text), outcomes: [`${name}:queued`] });
  }

  /** A successful native first turn already carried this queued message; never inject it a second time. */
  completeCarriedBrief(launchId: string, sessionId: string): void {
    for (const message of this.#store.launchBriefs(launchId)) {
      const name = message.to[0]!;
      if (this.#store.markDelivered(message.id, name, this.#now().getTime())) {
        this.#log({ event: 'acked', id: message.id, session: name, source: 'launch first turn' });
        this.#emitStage(message.id);
      }
      this.markInjected(message.id, name);
    }
    // An early hello already got welcome and clause; now the spoke learns the accepted brief without injecting it.
    const connection = this.connectionOf(sessionId);
    if (connection) for (const message of this.#store.activateLaunchBriefs(connection.name, launchId, false)) this.#sendTo(connection, message);
  }

  cancelLaunchBrief(launchId: string): void {
    for (const { message, dropped, released } of this.#store.cancelLaunchBriefs(launchId)) {
      if (released.notes.length) this.#log({ event: 'digest-released', ...released });
      if (dropped) {
        this.#log({ event: 'dropped', reason: 'launch failed', id: message.id, session: message.to[0]! });
        this.#emitStage(message.id);
      }
    }
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
    this.#publishPresence();
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
    const launch = this.#launchMutationRefusal(from);
    if (launch) return { ok: false, error: launch };
    if (to === from) return { ok: true, name: to };
    const refusal = nameRefusal(to, this.#reserved);
    if (refusal) return { ok: false, error: refusal };
    const identityRefusal = this.nameReservation(to);
    if (identityRefusal) return { ok: false, error: identityRefusal };
    const pending = this.#store.unacknowledgedCount(to);
    if (pending) return { ok: false, error: `name "${to}" has ${pending} unacknowledged deliveries: rename refused` };
    const collisions = this.#store.deliveryCollisionCount(from, to);
    if (collisions) return { ok: false, error: `name "${to}" has ${collisions} colliding delivery rows: rename refused` };
    // Persist before deleting the name's session row; a restart can rebuild the same adoption fence.
    if (this.#items?.provisionalSession(from)) this.#store.preserveSessionAlias(from, c.sessionId);
    this.#live.delete(from);
    c.name = to;
    this.#live.set(to, c);
    // deliveries still in flight to this session follow it, so its acks find them — and so do the ones its
    // spoke accepted and its adapter has not injected yet, so the confirmation and the retry find them
    const merged = this.#store.moveQueued(from, to);
    this.#store.moveUninjected(from, to);
    this.#store.renameSubscriptionSubject(from, to);
    this.#store.forgetSession(from);
    for (const id of merged) this.#emitStage(id);
    this.#store.rememberSession(to, this.#now().getTime());
    this.#store.rememberSessionId(to, c.sessionId);
    this.#store.rememberStatus(to, c.status);
    this.#store.rememberRole(to, c.role);
    this.#log({ event: 'rename', from, to });
    for (const fn of [...this.#renamed]) fn(from, to, c.sessionId);
    this.#publishPresence();
    this.#announceCoordinator();
    this.asks.renamed(c.sessionId);
    this.#publishTopics();
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
    for (const session of this.#store.queuedSessions()) this.#dropExpired(session);
    const { gone, released } = this.#store.prune(this.#now().getTime(), this.#retentionMs);
    this.#logReleased(released);
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
  launchedRole(lookup: ((name: string, sessionId: string, launchToken?: string) => LaunchedRole | null) | null): void {
    this.#launchedRole = lookup;
  }

  /** Unfinalized launch identities cannot mutate their name or role until settlement. */
  pendingLaunch(lookup: ((sessionId: string) => string | null) | null): void {
    this.#pendingLaunch = lookup;
  }

  /** Resolve a launch credential to the stable identity its hello proves. */
  launchIdentity(lookup: ((credential: string, sessionId: string) => LaunchIdentityBinding | null) | null): void {
    this.#launchIdentity = lookup;
  }

  /** Stable identities already recorded by the hub, including durable aliases and live sessions. */
  sessionIds(): Set<string> {
    const ids = new Set(this.#store.sessionNames().map(name => this.#store.sessionIdOf(name)).filter((id): id is string => id !== null));
    for (const alias of this.#store.sessionAliases()) ids.add(alias.id);
    for (const connection of this.#live.values()) ids.add(connection.sessionId);
    ids.delete(UNKNOWN_SESSION);
    return ids;
  }

  /** A credential-proven adapter identity becomes authoritative when its launch is published. */
  rememberLaunchIdentity(name: string, sessionId: string, credential: string): void {
    const binding = this.#launchIdentity?.(credential, sessionId);
    if (binding && 'refusal' in binding) throw new Error(binding.refusal);
    if (sessionId === UNKNOWN_SESSION || binding?.sessionId !== sessionId) throw new Error('a launch must publish a credential-proven stable session identity');
    const refusal = this.nameReservation(name, sessionId);
    if (refusal) throw new Error(refusal);
    this.#store.transaction(() => {
      this.#store.rememberSession(name, this.#now().getTime());
      this.#store.rememberSessionId(name, sessionId);
    });
  }

  #launchMutationRefusal(name: string): string | null {
    const id = this.#live.get(name)?.sessionId ?? this.#store.sessionIdOf(name);
    const launch = id && id !== UNKNOWN_SESSION ? this.#pendingLaunch?.(id) : null;
    return launch ? `pending launch "${launch}" is not finalized; rename and role changes are refused until settlement` : null;
  }

  /**
   * A launch for `role` reserves it for `name` before the harness is spawned (the store remembers the name holding
   * it): a second launch, or the human's assignment, of an exclusive role is refused while the first is under way.
   * Returns what the name held before, for `releaseLaunchRole`. Throws the exclusivity refusal.
   */
  reserveLaunchRole(name: string, role: string): { previous: string | null; previousSessionId: string | null } {
    if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const identityRefusal = this.nameReservation(name, this.#live.get(name)?.sessionId);
    if (identityRefusal) throw new Error(identityRefusal);
    const taken = this.#exclusiveHolder(role, name);
    if (taken) throw new Error(`role "${role}" is held by ${taken}: one session holds it at a time — clear it first with \`cland role clear ${taken.split(' ')[0]}\``);
    const c = this.#live.get(name);
    const previous = c ? c.role : this.#store.roleOf(name);
    const previousSessionId = this.#store.sessionIdOf(name);
    const at = this.#now().getTime();
    // the reservation is recorded with the role: a hub that dies before the launch's process row exists gives it
    // back at its next start (`releaseInterruptedLaunches`)
    this.#store.transaction(() => {
      this.#store.rememberSession(name, at);
      this.#store.rememberRole(name, role);
      this.#store.saveReservation(name, role, previous, at);
    });
    this.#log({ event: 'role-reserved', session: name, role, previous });
    return { previous, previousSessionId };
  }

  /** Take a ticket before I/O, then validate against each fresh snapshot. A move may replace the current holder.
   * Tickets do not grant a role; release on success or refusal, including failures before fresh validation. */
  admitRole(name: string, role: string, move = false): { validate: () => void; release: () => void } {
    if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const identityRefusal = this.nameReservation(name, this.#live.get(name)?.sessionId);
    if (identityRefusal) throw new Error(identityRefusal);
    const refusal = nameRefusal(name, this.#reserved);
    if (refusal) throw new Error(refusal);
    const reservation = { name };
    const admissions = this.#roleAdmissions.get(role) ?? [];
    admissions.push(reservation);
    this.#roleAdmissions.set(role, admissions);
    const release = () => {
      const index = admissions.indexOf(reservation);
      if (index < 0) return;
      admissions.splice(index, 1);
      if (!admissions.length) this.#roleAdmissions.delete(role);
      this.#log({ event: 'role-admission-released', session: name, role });
    };
    const validate = () => {
      const identityRefusal = this.nameReservation(name, this.#live.get(name)?.sessionId);
      if (identityRefusal) throw new Error(identityRefusal);
      if (!this.#roles?.get().get(role)?.exclusive) return;
      const earlier = admissions[0] !== reservation ? admissions[0] : undefined;
      const from = move ? this.holderOf(role, name) : null;
      const taken = earlier ? `${withRole(earlier.name, role)} (admission pending)` : this.#exclusiveHolder(role, from === null ? name : [name, from]);
      if (taken) {
        if (earlier) throw new Error(`role "${role}" is held by ${taken}: the earlier request is still pending — retry after it finishes`);
        throw new Error(`role "${role}" is held by ${taken}: one session holds it at a time — clear it first with \`cland role clear ${taken.split(' ')[0]}\``);
      }
    };
    try { validate(); } catch (err) { release(); throw err; }
    return { validate, release };
  }

  /** A launch's process row is written: its reservation is the role itself now. */
  launchSettled(name: string): void {
    this.#store.dropReservation(name);
  }

  /** A launch failed: the role it reserved (or its early hello took) is rolled back, unless something changed it since. */
  releaseLaunchRole(name: string, role: string, previous: string | null, reason = 'launch-failed', sessionId?: string | null, previousSessionId: string | null = null, cleanupId?: string): void {
    const checkpoint = cleanupId ? `launch-role-rollback:${cleanupId}` : null;
    if (checkpoint && this.#store.meta(checkpoint) === 'done') return;
    const reservedName = name;
    const identified = sessionId && sessionId !== UNKNOWN_SESSION ? this.connectionOf(sessionId)?.name ?? this.#store.nameOfSession(sessionId) : null;
    if (identified) name = identified;
    const c = this.#live.get(name);
    const alias = this.#store.sessionAlias(name);
    const stored = this.#store.sessionIdOf(name);
    const foreign = sessionId !== undefined && ((c && c.sessionId !== sessionId) || (alias && alias !== sessionId) || (stored && stored !== sessionId && stored !== previousSessionId));
    const current = c ? c.role : this.#store.roleOf(name);
    const apply = !foreign && current === role && (sessionId === undefined || sessionId === null || identified !== null);
    this.#store.transaction(() => {
      this.#store.dropReservation(reservedName);
      let clause: string | null = null;
      if (apply) {
        this.#store.rememberRole(name, c ? null : previous);
        if (c) clause = this.#recordClause({ ...c, role: null }, 'its launch failed', current);
        else this.#store.dropNotices(name, ROLE_NOTICE);
      }
      // This checkpoint belongs to the same connection and commit as the role mutation.
      if (checkpoint) this.#store.setMeta(checkpoint, 'done');
      if (apply) {
        // Each observer is independent: a logging or transport fault cannot suppress
        // another publication of the committed rollback.
        this.#afterCommit(() => { if (c) c.role = null; });
        this.#afterCommit(() => this.#log({ event: 'role-reservation-released', session: name, role, previous, reason }));
        if (c) {
          this.#afterCommit(() => this.#log({ event: 'role-cleared', session: name, previous: current, reason: 'its launch failed', live: true }));
          if (clause) { const id = clause; this.#afterCommit(() => this.#send(this.#store.message(id) as Message, name)); }
          this.#afterCommit(() => this.#emitRole(name, null, current, 'its launch failed'));
        }
        this.#afterCommit(() => this.#announceCoordinator());
      }
    });
  }

  /**
   * At the hub's start: a reservation still recorded belongs to a launch the hub died in before its process row was
   * written. With no process row (`hasProcess`) and no live session under the name, the role goes back to what the
   * name held before; otherwise the reservation is simply cleared.
   */
  releaseInterruptedLaunches(hasProcess: (name: string) => boolean): void {
    for (const r of this.#store.reservations()) {
      if (hasProcess(r.name) || this.#live.has(r.name)) this.#store.dropReservation(r.name);
      else this.releaseLaunchRole(r.name, r.role, r.previous, 'interrupted');
    }
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
    const pending = this.#roleAdmissions.get(role)?.[0];
    if (pending && !skip.has(pending.name)) return `${withRole(pending.name, role)} (admission pending)`;
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
    const launch = this.#launchMutationRefusal(name);
    if (launch) throw new Error(launch);
    if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const refusal = nameRefusal(name, this.#reserved);
    if (refusal) throw new Error(refusal);
    const reserved = this.nameReservation(name, this.#live.get(name)?.sessionId);
    if (reserved) throw new Error(reserved);
    const taken = this.#exclusiveHolder(role, name);
    if (taken) throw new Error(`role "${role}" is held by ${taken}: one session holds it at a time — clear it first with \`cland role clear ${taken.split(' ')[0]}\``);
    const c = this.#live.get(name);
    const previous = c ? c.role : this.#store.roleOf(name);
    if (c) c.role = role;
    else this.#store.rememberSession(name, this.#now().getTime());
    this.#store.rememberRole(name, role);
    this.#log({ event: 'role-assigned', session: name, role, previous, live: c !== undefined });
    if (c) {
      const { moved, merged } = this.#claimRoleQueue(role, name);
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
    const launch = this.#launchMutationRefusal(name);
    if (launch) throw new Error(launch);
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

  /** A Lead has one live node; a missing or ambiguous claim cannot be handed over. */
  leadNode(session: string): string {
    const id = this.sessionIdentity(`name:${session}`);
    const nodes = (this.#items?.list?.() ?? []).filter(item => item.state !== 'closed' && item.claim?.role === 'lead' && this.sessionIdentity(item.claim.sessionId) === id);
    if (nodes.length !== 1) throw new Error(`${session} needs exactly one live Lead node to hand over`);
    return nodes[0]!.id;
  }

  /** Lead notes are scoped to nodes. Identity resolution preserves them across a rename. */
  roleRecord(role: string, session?: string): unknown {
    if (role !== 'lead') return this.#store.roleRecord(role);
    if (!session) throw new Error('Lead role state needs a session');
    const id = this.sessionIdentity(`name:${session}`);
    const node = (this.#items?.list?.() ?? []).find(item => item.claim?.role === 'lead' && this.sessionIdentity(item.claim.sessionId) === id);
    if (node) return this.#store.roleRecord(`lead:${node.id}`);
    // The clause is recorded before the tracker connection settles the committed transfer.
    return this.#store.roleRecords().map(r => r.value).find(record => isRoleRecord(record) && record.item && record.claims && record.handover && this.sessionIdentity(record.holderId ?? `name:${record.handover.to}`) === id) ?? null;
  }

  /**
   * A role moves to `to` (#31): from its holder `from` (a handover by the holder, or the human's reassignment), or
   * from nobody. In one store transaction `from` loses it (or keeps `then`, an Implementer) and `to` takes it, with
   * the role's record (the note, the move, the chain of holders, the tracker claims to move along) and both Agents
   * notices. The claims themselves live in the tracker's tables (another connection): the caller moves them after the
   * commit, idempotently, from the record (`roles/handover.ts`), and a hub that died in between does it at its next
   * start. Then: `to` gets its clause with the note, `from` its revocation (`reason: "handover"`), subscribers the
   * notices, the `session.role` events and the Coordinator's `role.filled`. All synchronous: no frame is read between
   * the checks and the last event.
   */
  moveRole(move: { role: string; from: string | null; to: string; by: string; note: HandoverNote | null; then: string | null; claims?: PendingClaims | null; item?: string }): RoleHolder {
    const { role, from, to, by, note, then } = move;
    for (const name of from === null ? [to] : [from, to]) {
      const launch = this.#launchMutationRefusal(name);
      if (launch) throw new Error(launch);
    }
    if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const refusal = nameRefusal(to, this.#reserved);
    if (refusal) throw new Error(refusal);
    const reserved = this.nameReservation(to, this.#live.get(to)?.sessionId);
    if (reserved) throw new Error(reserved);
    if (from === to) throw new Error(`${withRole(to, role)} already holds the role`);
    if (then !== null && (!ROLE_NAMES.includes(then) || then === role || this.#roles?.get().get(then)?.exclusive)) throw new Error(`a handover may leave the previous holder an Implementer (then: "implementer"), not "${then}"`);
    const taken = this.#exclusiveHolder(role, from === null ? [to] : [to, from]);
    if (taken) throw new Error(`role "${role}" is held by ${taken}: one session holds it at a time — clear it first with \`cland role clear ${taken.split(' ')[0]}\``);
    const cFrom = from !== null ? this.#live.get(from) : undefined;
    const cTo = this.#live.get(to);
    const fromRole = from === null ? null : cFrom ? cFrom.role : this.#store.roleOf(from);
    if (from !== null && fromRole !== role) throw new Error(`${withRole(from, fromRole)} does not hold the role ${ROLE_LABELS[role] ?? role}`);
    const previous = cTo ? cTo.role : this.#store.roleOf(to);
    const fromId = from !== null ? this.sessionIdentity(`name:${from}`) : null;
    const toId = this.sessionIdentity(`name:${to}`);
    const at = this.#now().toISOString();
    if (role === 'lead') {
      if (from === null || move.item !== this.leadNode(from)) throw new Error('Lead handover needs the current holder and its claimed node');
      const occupied = (this.#items?.list?.() ?? []).find(item => item.claim && this.sessionIdentity(item.claim.sessionId) === toId);
      if (occupied) throw new Error(`${to} already claims ${occupied.id}: a Lead holds one node; release the receiver's claim first`);
      if (previous === COORDINATOR) throw new Error('a Lead handover cannot replace the root Coordinator');
    }
    const recordKey = role === 'lead' ? `lead:${move.item}` : role;
    const stored = this.#store.roleRecord(recordKey);
    const before: RoleRecord = isRoleRecord(stored) ? stored : { note: null, handover: null };
    // every holder the role passed through: what waited for any of them waits for the role (role.state)
    const chain = [...(before.chain ?? (before.handover?.from ? [before.handover.from] : [])), ...(before.handover ? [before.handover.to] : []), ...(from !== null ? [from] : [])].filter((n, i, all) => n !== to && all.indexOf(n) === i).slice(-20);
    const record: RoleRecord = {
      ...(move.item ? { item: move.item, holderId: toId, ...(note ? { noteToId: toId } : before.noteToId ? { noteToId: before.noteToId } : {}) } : {}),
      note: note ? { sections: note, from: by, to, at } : before.note,
      handover: { from, to, by, at },
      chain,
      claims: move.claims ?? null,
    };
    const roleLabel = ROLE_LABELS[role] ?? role;
    const fromLabel = from !== null ? withRole(from, role) : null;
    const handed = by === HUMAN ? `the human moved the ${roleLabel} role${fromLabel ? ` from ${fromLabel}` : ''} to ${to}` : `${fromLabel ?? by} handed the ${roleLabel} role over to ${to}`;
    // one transaction: the role leaves one session and reaches the other, the record (with the claims to move) and
    // both notices in Agents land together or not at all
    const notices = this.#store.transaction(() => {
      if (from !== null) this.#store.rememberRole(from, then);
      if (!cTo) this.#store.rememberSession(to, this.#now().getTime());
      this.#store.rememberRole(to, role);
      this.#store.saveRoleRecord(recordKey, record);
      if (fromId !== null) this.#store.moveAgentAsks(fromId, to, toId);
      return [
        this.#recordNotice(AGENTS.id, { kind: 'handover', text: note ? `${handed}, with a handover note:\n\n${renderNote(note)}` : `${handed}, with no note.`, detail: { role, from, to, by, note: note !== null } }),
        this.#recordNotice(AGENTS.id, { kind: 'role-assign', text: `${withRole(to, role)} took over the ${roleLabel} role${from !== null ? ` from ${from}` : ''}.`, detail: { session: to, role, previous, handover: true } }),
      ];
    });
    if (cFrom) cFrom.role = then;
    if (cTo) cTo.role = role;
    this.#log({ event: 'role-handover', role, from, to, by, note: note !== null, then, live: cTo !== undefined });
    if (cTo) {
      const { moved, merged } = this.#claimRoleQueue(role, to);
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
    for (const m of notices) if (m) this.#publishNotice(m);
    if (from !== null) this.#emitRole(from, then, role, 'handover');
    this.#emitRole(to, role, previous, 'handover');
    this.#announceCoordinator();
    this.asks.renamed(toId);
    this.#publishTopics();
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
          launch: d?.launch ?? { harness: '', model: null, effort: null, approval: null, sandbox: null },
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
    const stored = c.role !== null ? this.roleRecord(c.role, c.name) : null;
    const note = isRoleRecord(stored) && stored.note && this.sessionIdentity(stored.noteToId ?? `name:${stored.note.to}`) === this.sessionIdentity(`name:${c.name}`) ? stored.note : null;
    if (note) {
      clause.note = note.sections;
      clause.from = note.from;
      text = `${text}\n\n${noteText(note.from, note.sections)}`;
    }
    // kept on a new role after a handover (then: implementer): which role went where
    if (c.role !== null && extra.reason === 'handover' && previous) text = `cland hub: you handed the role ${ROLE_LABELS[previous] ?? previous} over to ${extra.to ?? 'another session'}: stop acting as ${ROLE_LABELS[previous] ?? previous}.\n\n${text}`;
    const superseded = this.#store.dropNotices(c.name, ROLE_NOTICE);
    const message: Message = { id: randomUUID(), from: 'hub', fromKind: 'hub', via: 'hub', to: [c.name], text, ts: this.#now().toISOString() };
    this.#record(message, [{ session: c.name, state: injected ? 'injected' : 'queued' }], this.#now().getTime(), ROLE_NOTICE);
    this.#roleNotices.set(message.id, clause);
    // journalled with every delivery (`journal.ts`)
    // Launch assignment has its own lifecycle event: a carried clause may arrive after acceptance.
    this.#log({ event: c.role !== null ? 'role-clause' : 'role-revoked', session: c.name, sessionId: c.sessionId, role: c.role, previous: previous ?? null, reason, id: message.id, superseded: superseded.length, launchNotice: false });
    return message.id;
  }

  #emitRole(session: string, role: string | null, previous: string | null, reason: string): void {
    this.#emit({ type: 'session.role', session, role, previous, reason, ts: this.#now().toISOString() });
    this.#publishPresence();
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
  #resolveAttachments<T extends Message | TopicMessage>(message: T): T {
    // Creation chips follow current placement; sent attachments retain their publication facts.
    const resolve = (a: Artifact) => !message.artifacts || this.#store.artifact(a.id)?.movedTo ? this.#store.resolveArtifact(a.id) ?? a : a;
    return { ...message, ...(message.artifact ? { artifact: resolve(message.artifact) } : {}),
      ...(message.artifacts ? { artifacts: message.artifacts.map(resolve) } : {}) };
  }

  #sendTo(c: Connection, message: Message): boolean {
    if (isHeldDelivery(message)) return false;
    const clause = this.#roleNotices.get(message.id);
    return clause ? c.deliverRole(message, clause) : c.deliver(this.#resolveAttachments(this.#store.deliveryMessage(message.id, c.name) ?? message));
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
      if (role === 'aide') { roles.set(role, []); continue; }
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
    const broadcast = (name: string) => this.#store.roleOf(name) !== 'aide';
    const ctx = { connected, known, roles: this.#roleHolders(knownSet, vacant) };
    const sessions = new Set<string>();
    const direct = new Set<string>(); // explicit name or claimed-item lead; a broadcast cannot establish it
    const unknown: string[] = [];
    const empty: Array<{ tag: string; reason: string }> = []; // tags that reach nobody but the sender — a fact, never a refusal
    const tagOf = new Map<string, string[]>(); // tag → the session names it resolved to
    for (const tag of HubCore.#normalized(tags)) {
      const lead = /^lead\s+(T-[1-9]\d*)$/.exec(tag);
      if (/^lead\s/.test(tag) && !lead) throw new Error(`invalid item lead address "${tag}": use @lead T-<n>, or address coordinator instead`);
      const claimant = lead ? this.#itemLead(lead[1]!, except) : null;
      const target = lead ? this.coordinator() ?? COORDINATOR : tag;
      const r = claimant ? { kind: 'session' as const, name: claimant } : resolveTag(target, ctx);
      switch (r.kind) {
        case 'all': {
          const names = [...knownSet].filter((n) => n !== except && broadcast(n));
          if (names.length) tagOf.set(tag, names);
          else unknown.push(tag); // nobody else is connected or known — `all` names no one
          for (const n of names) sessions.add(n);
          break;
        }
        case 'glob': {
          const names = r.names.filter((n) => n !== except && broadcast(n));
          if (names.length) tagOf.set(tag, names);
          else unknown.push(tag);
          for (const n of names) sessions.add(n);
          break;
        }
        case 'role': {
          if (r.role === 'aide') { unknown.push(tag); break; }
          const names = r.names.filter((n) => n !== except && broadcast(n));
          if (names.length) tagOf.set(tag, names);
          else empty.push({ tag: lead ? target : tag, reason: r.names.length ? `the sender is the only session holding role "${target}"` : `role "${target}" has no holder` });
          for (const n of names) sessions.add(n);
          break;
        }
        case 'session':
          sessions.add(r.name);
          if (!lead || claimant) direct.add(r.name);
          tagOf.set(tag, [r.name]);
          break;
        case 'unknown':
          unknown.push(tag);
      }
    }
    return { sessions, direct, unknown, empty, tagOf };
  }

  // ---------------------------------------------------------------- topics

  topics(): Topic[] {
    return this.#store.topics().map(topic => {
      const waitingFor = this.asks.waitingFor(topic.id);
      return waitingFor.length ? { ...topic, waitingFor } : topic;
    });
  }

  topicRef(id: string): TopicRef | null {
    const t = this.#store.topic(id);
    return t ? { id: t.id, title: t.title, ...(t.item !== null ? { item: t.item } : {}) } : null;
  }

  /** What a `topic` event is about: a change of any of these is published; the unread count alone is not. */
  static #topicSignature(t: Topic): string {
    return JSON.stringify([t.status, t.warning ?? null, t.item, t.title, t.waitingFor ?? []]);
  }

  /** Tell subscribers about every topic whose status, warning, binding or title changed since they last heard,
   *  and about the ones in `force` whatever changed (the human's unread count). */
  #publishTopics(force: ReadonlySet<string> = new Set()): void {
    for (const topic of this.topics()) {
      const signature = HubCore.#topicSignature(topic);
      if (this.#publishedTopics.get(topic.id) === signature && !force.has(topic.id)) continue;
      this.#publishedTopics.set(topic.id, signature);
      const previous = this.#topicStatuses.get(topic.id);
      this.#topicStatuses.set(topic.id, topic.status);
      if (previous !== topic.status && (topic.status === 'waiting for human' || topic.status === 'closed')) {
        if (topic.status === 'closed') this.#terminalEvent({ topic: topic.id }, 'topic', `${topic.id} closed`, { item: topic.item });
        else this.publishEvent({ topic: topic.id }, 'topic', `${topic.id} ${topic.status}`, { item: topic.item });
      }
      this.#emit({ type: 'topic', topic });
    }
  }

  /** Move a topic's status (spec 4.5); Agents has none to move. */
  #move(topic: Topic, move: TopicMove, why: string): TopicStatus {
    if (topic.id === AGENTS.id) return topic.status;
    let next = nextStatus(topic.status, move);
    // Open asks keep their topic waiting for the current party; only answering, resolve or close ends that.
    if (next !== 'closed') next = this.asks.waitingIn(topic.id) ?? next;
    if (next !== topic.status) {
      for (const a of this.#store.setTopicStatus(topic.id, next, this.#now().toISOString())) this.artifactChanged(a);
      this.#log({ event: 'topic-status', topic: topic.id, from: topic.status, to: next, why });
    }
    return next;
  }

  /**
   * Open a topic (spec 4.5): the human from the UI or an agent with `topic.create`; the system opens only General
   * and Agents. A title is required. `item` binds it to a unit of work, which has one topic at most: a second is
   * refused, and the item's `topic` field is written through the tracker.
   */
  async createTopic(title: string, item?: string, by = HUMAN, resumed: Resumed = work => work(), authorize: () => void = () => {}): Promise<Topic> {
    const clean = typeof title === 'string' ? title.trim() : '';
    if (!clean) throw new TopicRefusal('a topic needs a title');
    if (clean.length > 200) throw new TopicRefusal('a topic title is at most 200 characters');
    if (item !== undefined && item !== null && (typeof item !== 'string' || item.trim() === '')) throw new TopicRefusal('`item` is blank: name the item to bind (T-<n>), or leave it out');
    if (item !== undefined && item !== null && !this.#items) throw new TopicRefusal("this hub has no tracker: a topic is bound to an item only on a project's hub");
    const found = item !== undefined && item !== null ? await this.#items!.checkAsync(item.trim(), resumed) : null;
    return resumed(async () => {
      authorize();
      const bound = found?.id ?? null;
      if (found) {
        const existing = this.#store.topicOfItem(found.id) ?? (found.topic !== null ? this.#store.topic(found.topic) : null);
        if (existing) throw new TopicRefusal(`${bound} already has a topic: "${existing.title}" (${existing.id}); one topic per unit of work: write there`);
        if (found.state === 'closed') throw new TopicRefusal(`${bound} is closed: a closed unit of work gets no new topic`);
      }
      const id = this.#store.nextTopicId();
      const now = this.#now().toISOString();
      this.#store.createTopic(id, clean, bound, now);
      if (bound !== null) {
        try { await this.#items!.bind(bound, id, resumed, authorize); }
        catch (err) { return resumed(() => { this.#logReleased(this.#store.deleteTopic(id)); throw err; }); }
      }
      return resumed(() => {
        this.#log({ event: 'topic-created', topic: id, title: clean, item: bound, by });
        this.#publishTopics();
        return this.#topicOrThrow(id);
      });
    });
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

  topicHistory(id: string, limit?: number, filter: AgentsHistoryFilter = {}): { topic: Topic; messages: TopicMessage[] } {
    const topic = this.#topicOrThrow(id);
    const n = Math.min(Math.max(1, Math.floor(limit ?? HISTORY_LIMIT)), TOPIC_HISTORY_LIMIT);
    if (id !== AGENTS.id && (filter.item !== undefined || filter.session !== undefined)) throw new Error('item and session history filters require the Agents topic');
    return { topic, messages: this.#store.topicMessages(id, n, filter).map(message => this.#resolveAttachments(message)) };
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
    this.#store.transaction(() => {
      this.#terminalEvent({ topic: id }, 'topic', `${id} deleted`, { item: topic.item });
      const released = this.#store.deleteTopic(id);
      this.#afterCommit(() => this.#logReleased(released));
    });
    this.#topicStatuses.delete(id);
    this.#publishedTopics.delete(id);
    // its asks went with it: the inbox lists them no more
    this.inbox.refresh();
  }

  #logReleased(released: ReturnType<Store['deleteTopic']>): void {
    for (const batch of released) this.#log({ event: 'digest-released', ...batch });
  }

  /**
   * The human writes into a topic, never into Agents. It addresses `to` when given, else the `@role` and
   * `@session-name` mentions in the text, else the Coordinator (spec 4.5). A role reaches its live holders; with
   * none connected the message is queued under the role (`@<role>`) until a session takes the role, and the topic
   * shows the warning (`no coordinator`) meanwhile. Always recorded: the human's words show in the topic whoever
   * they reach. The topic then waits for an agent, and the human has read it.
   */
  sendFromHuman(topicId: string, text: string, to?: string[], replyTo?: string, answerTo?: string, artifact?: Artifact, artifacts?: Artifact[], messageId?: string): { message: TopicMessage; outcomes: SendOutcome[] } {
    const topic = this.#topicOrThrow(topicId);
    if (topic.id === AGENTS.id) {
      // Agents is the record of what agents send each other (spec 4.5): the human reads it, and writes there only
      // as a reply to an agent's message, which addresses that message's sender
      if (replyTo === undefined) throw new Error(`${topic.title} is read-only: it records what agents send each other; reply to a message there, or write in General or another topic`);
      const original = this.#store.message(replyTo);
      if (!original || original.topic !== AGENTS.id) throw new Error(`no message "${replyTo}" in ${topic.title} to reply to`);
      if (original.fromKind !== 'agent') throw new Error(`a hub notice has no sender to answer: reply to an agent's message in ${topic.title}`);
      // the sender by its session id: a session renamed since is still the one that wrote it
      const senderId = this.#store.senderSessionId(original.id);
      const sender = senderId !== null && senderId !== UNKNOWN_SESSION ? (this.connectionOf(senderId)?.name ?? this.#store.nameOfSession(senderId)) : null;
      to = [sender ?? original.from];
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
    const { sessions, direct, unknown, empty, tagOf } = this.#resolveAddressees(tags, HUMAN, 'placeholder');
    const outcomes: SendOutcome[] = unknown.map((tag) => ({ to: tag, outcome: 'unknown', reason: `no session named "${tag}" is connected or known, and no role has that name` }));
    for (const tag of unmentioned) outcomes.push({ to: tag, outcome: 'unknown', reason: `@${tag} names no session the hub knows and no role: not addressed` });
    // a role with no holder: held for the role, not refused
    const placeholders = empty.map(({ tag }) => tag);
    const message: Message = {
      id: messageId ?? randomUUID(),
      from: HUMAN,
      fromKind: 'human',
      via: 'hub',
      to: [...sessions, ...placeholders],
      text,
      ts: this.#now().toISOString(),
      ...(replyTo !== undefined ? { replyTo } : {}),
      topic: topic.id,
      ...(answerTo !== undefined ? { answerTo } : {}),
      ...(artifact ? { artifact } : {}),
      ...messageArtifacts(artifacts),
    };
    this.#record(
      message,
      [...[...sessions].map((session) => ({ session, state: 'queued' as const, direct: direct.has(session) })), ...placeholders.map((role) => ({ session: `@${role}`, state: 'queued' as const }))],
      nowMs,
    );
    this.#store.touchTopic(topic.id, message.ts);
    this.#store.markTopicRead(topic.id, message.id);
    // a person wrote to these sessions: their pairs count afresh (the loop breaker mutes a pair with no human between)
    for (const n of sessions) this.#hygiene.humanTouched(this.#identity(n));
    for (const a of message.artifacts ?? []) this.artifactChanged(this.#store.artifact(a.id)!);
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
  sendFromSession(from: string, to: string[], text: string, replyTo?: string, topicId?: string, artifact?: Artifact, actor?: { role: string | null }, artifacts?: Artifact[], kind: unknown = 'report', messageId?: string, requireAllRecipients = false, answerTo?: string): { message: Message; outcomes: SendOutcome[]; topic: TopicRef } {
    if (!isSendKind(kind)) throw new Error('send kind must be progress, report, question or decision');
    const sender = actor ?? this.#live.get(from);
    if (!sender) throw new Error(`unknown sender ${from}`);
    const toHuman = to.length === 0;
    const topic = this.#topicOrThrow(topicId ?? (toHuman ? GENERAL.id : AGENTS.id));
    const topicRef: TopicRef = { id: topic.id, title: topic.title };
    const nowMs = this.#now().getTime();
    const size = this.#hygiene.sizeRefusal(text);
    if (size) throw new HygieneError(size, { code: 'hygiene', rule: 'size' });
    const self = this.#identity(from);
    if (requireAllRecipients) {
      const intended = this.#resolveAddressees(to, from, 'offline-holders');
      if (intended.unknown.length || intended.empty.length) throw new Error('result recipients unavailable; delivery remains pending');
      // A running mute is checked before consuming any outbound or pair allowance on retry.
      for (const name of intended.sessions) {
        const other = this.#identity(name);
        const reason = this.#hygiene.muteRefusal(self, other, nowMs, [from, name]);
        if (reason) throw new HygieneError(reason, { code: 'hygiene', rule: 'loop' });
      }
    }
    const rate = this.#hygiene.rateRefusal(self, nowMs);
    if (rate) {
      this.#log({ event: 'rate-limited', session: from });
      throw new HygieneError(rate, { code: 'hygiene', rule: 'rate' });
    }
    const { sessions, direct, unknown, empty, tagOf } = this.#resolveAddressees(to, from, 'offline-holders');
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
    // Suite results commit only when every intended recipient passed hygiene. A refusal
    // retains the job for retry; neither its topic post nor any accepted delivery is duplicated.
    if (requireAllRecipients && refused.size) throw new HygieneError([...refused.values()][0]!.reason, [...refused.values()][0]!.refusal);
    for (const n of refused.keys()) sessions.delete(n);
    const message: Message = {
      id: messageId ?? randomUUID(),
      from,
      fromKind: 'agent',
      kind,
      via: 'session',
      to: [...sessions],
      text,
      ts: this.#now().toISOString(),
      ...(sender.role !== null ? { fromRole: sender.role } : {}),
      ...(replyTo !== undefined ? { replyTo } : {}),
      ...(answerTo !== undefined ? { answerTo } : {}),
      topic: topic.id,
      ...(artifact ? { artifact } : {}),
      ...messageArtifacts(artifacts, a => (actor?.role ?? this.#store.roleOf(from)) === 'aide' || !this.#store.humanArtifact(a)),
    };
    // recorded before it is sent: an ack can never arrive for a delivery the store does not know
    if (sessions.size > 0 || toHuman) {
      // who the human's latest message here waited for, read before this one is recorded
      const awaited = toHuman ? [] : this.#store.lastHumanAddressees(topic.id);
      this.#store.transaction(() => {
        this.#record(message, [...sessions].map((session) => ({ session, state: 'queued' as const, direct: direct.has(session) })), nowMs);
        this.asks.recordQuestion(message);
        this.asks.recordAnswer(message);
      });
      this.#store.touchTopic(topic.id, message.ts);
      for (const a of message.artifacts ?? []) this.artifactChanged(this.#store.artifact(a.id)!);
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
      if (queued.length === names.length - blocked.length) outcomes.push({ to: tag, outcome: 'queued', reason: kind === 'progress' ? 'progress held for the next turn' : `${queued.join(', ')} offline — queued for up to ${Math.round(this.#queueTtlMs / 3_600_000)} h` });
      else if (queued.length) outcomes.push({ to: tag, outcome: 'delivered', reason: `queued for ${queued.join(', ')} (offline)` });
      else outcomes.push({ to: tag, outcome: 'delivered' });
    }
    if (sessions.size === 0 && !toHuman) {
      this.#log({ event: 'send-refused', from, to, outcomes: outcomes.map((o) => `${o.to}:${o.outcome}`) });
      return { message, outcomes, topic: topicRef };
    }
    this.#log({ event: 'send', id: message.id, from, kind, to: message.to, topic: topic.id, bytes: Buffer.byteLength(text, 'utf8'), ...(replyTo !== undefined ? { replyTo } : {}), outcomes: outcomes.map((o) => `${o.to}:${o.outcome}`) });
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
