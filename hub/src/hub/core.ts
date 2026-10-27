import { resolveClock, type Clock, type ClockOptions, type ClockTimer } from './clock.ts';
import { mergeHumanMarks } from './human-marks.ts';
import type { AnswerAttribution, HumanMessageKind, RemoteVia } from '../protocol.ts';
import { ModelRing } from './model-ring.ts';
import { heartbeatDigest } from './heartbeat.ts';
import { defaultCrew } from '../crew.ts';
import { durationMs } from '../duration.ts';
import { sendRecipients } from '../send-input.ts';
import type { AccountPoller } from '../accounts/poller.ts';
import { AccountLimits, AccountLimited, fullWindowReset, limitUntil, type AccountReading } from '../accounts/limits.ts';
import { readAccounts } from '../accounts/registry.ts';
import type { Ladder } from '../tracker/kinds.ts';
import { parseItemReference } from '../tracker/prefixes.ts';
import { normalizeId, idNumber } from '../tracker/item.ts';
// The hub's core: presence, names, routing and store-and-forward. Transport-free, so the network
// edge (`./server.ts`) is one thin layer over it.
import type { Rule } from '../rules/rulebook.ts';
import type { RulebookFile } from '../rules/file.ts';
import { crewSummary, type CrewConfig, type CrewSource } from '../crew.ts';
import type { Resumed } from './budget.ts';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  PROTOCOL_VERSION,
  MAX_FRAME_BYTES,
  UPDATE_HINT,
  isSendKind,
  isHeldDelivery,
  type SubscriptionSubject,
  type SubscriptionEvent,
  type OwnedSubscription,
  type Artifact,
  type HandoverNote,
  type Hello,
  type HubEvent,
  type HubFrame,
  type ClientFeature,
  type HarnessProcessView,
  type SessionUsage,
  type SessionRow,
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
  type PendingVerification,
  type Topic,
  type TopicMessage,
  type ThreadRun,
  type TopicHistoryFilter,
  type TopicRef,
  type TopicStatus,
  type VerificationQueue,
} from '../protocol.ts';
import { generatedName, nameRefusal, ROLE_LABELS, ROLE_NAMES, withRole, isNodeLeadRole, isCustomRole } from '../names.ts';
import type { RolesSource } from '../roles/config.ts';
import { clauseText, projectRulesText, PROJECT_RULES_HEADING, roleClauseSections, revokedText, staffingClause } from '../roles/clause.ts';
import { isRoleRecord, noteText, renderNote, type PendingClaims, type RoleRecord } from '../roles/note.ts';
import { resolveTag } from '../address.ts';
import { decide, DEFAULT_PERMISSIONS } from '../roles/permissions.ts';
import { Store } from './store.ts';
import { Hygiene, HygieneError, type LoopBreaker, type RateLimit } from './hygiene.ts';
import { mentions, nextStatus, TopicRefusal, type TopicItems, type TopicMove } from './topics.ts';
import type { ItemChange, ItemSummary, TopicBinding } from '../tracker/tracker.ts';
import type { Verdict } from '../tracker/item.ts';
import { sessionActor } from '../tracker/requests.ts';
import type { LogFn } from '../log.ts';
import { Asks } from './asks.ts';
import { Visibility, messageVerdict, type VisibilityOverrides, type Layer } from './visibility.ts';
import { eventKey, type JournalRecord } from './journal.ts';
import type { EventRow, EventsFilter } from '../protocol.ts';
import { IDLE_NOTIFY_MS, InboxBoard } from './inbox.ts';
import { verifierRequest } from './verifier-request.ts';

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

type EventContext = { role?: string | null; item?: string | null; ancestry?: string[]; final?: boolean; taskChange?: 'status' | 'verdict'; verdict?: Pick<Verdict, 'verdict' | 'result' | 'run'>; ready?: boolean; severity?: 'warn'; lifecycle?: 'died' | 'stopped' | 'waiting for approval' | 'long idle' | 'moved' };

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

export type CoreOptions = ClockOptions & {
  env?: NodeJS.ProcessEnv;
  heartbeatMs?: number;
  heartbeatRunTimeoutMs?: number;
  /** Read project allowance warnings only when a Coordinator heartbeat is due. */
  durationWarnings?: (now: () => number) => Promise<string[]>;
  /** Extra reserved names beyond the built-ins. */
  reservedNames?: Iterable<string>;
  /** The hub's memory; `:memory:` when absent. */
  store?: Store;
  queueTtlMs?: number;
  /** Equal queued events coalesce inside this window (default 60 seconds); short in tests. */
  eventWindowMs?: number;
  retentionMs?: number;
  rateLimit?: RateLimit;
  eventLimit?: RateLimit;
  loopBreaker?: LoopBreaker;
  maxTextBytes?: number;
  log?: LogFn;
  /**
   * The project's role definitions (`.cland/roles.toml`). With them roles are hub-held (spec 4.4, ADR 0001): a
   * session holds the role the human assigned or the one it was launched for, a session with none is refused,
   * and the holder gets its clause on assignment and on every hello. Without them (a hub with no project and no
   * human side) a hello's role is taken as declared.
   */
  roles?: RolesSource;
  crew?: CrewSource;
  rules?: RulebookFile;
  /** The tracker as a topic's binding sees it (`topic.create` with an item); absent, a binding is refused. */
  items?: TopicItems;
  /** Indexed session work, without file I/O; absent on a hub without a tracker. */
  sessionHolds?: (sessionId: string) => SessionHold[];
  /** How long a session stays idle before subscriptions report it, ms (default 30 min; 0: never). */
  idleNotifyMs?: number;
  visibility?: VisibilityOverrides;
  visibilityPreferences?: import('./visibility-preferences.ts').VisibilityPreferenceFile;
  ladder?: Ladder;
};

/** A hub notice recorded in a topic (Agents: the lifecycle record, spec 4.5): its kind, its text, who it is
 *  delivered to (nobody by default: the record is for reading), and its typed facts. */
/** The `meta` key holding the id of the last journalled lifecycle notice recorded in Agents. */
export const AGENTS_JOURNAL_CHECKPOINT = 'agents-journal-checkpoint';

export type TopicNotice = { kind: string; text: string; to?: string[]; detail?: Record<string, unknown>; criteria?: Message['criteria']; id?: string };

/** The one exclusive role (spec 4.4): a vacancy is announced. */
export const COORDINATOR = 'coordinator';
type CoordinatorVacancy = { last: string; since: number; noticeId: string; notified: boolean };
/** The `notice` kind of a stored role clause or revocation. */
const ROLE_NOTICE = 'role';

export class HubCore {
  readonly #epoch = randomUUID();
  #modelSeq = 0;
  readonly #modelRing: ModelRing;
  /** Snapshots describe the state after this delta, without consuming a number. */
  modelCursor(): { epoch: string; seq: number } { return { epoch: this.#epoch, seq: this.#modelSeq }; }
  resumeModel(epoch: string, seq: number, features: readonly ClientFeature[]): string[] | null {
    return epoch === this.#epoch ? this.#modelRing.after(seq, features.includes('slim-frames')) : null;
  }
  readonly #clients = new Set<{ features: readonly ClientFeature[]; key: string; send: (frame: HubFrame, serialized: () => string) => void }>();
  #taskLayers: Record<string, Layer> = {};
  readonly #publishedTasks = new Map<string,ItemSummary|null>();
  readonly #modelPublications: Array<() => void> = [];
  #publishingModel = false;
  /** Model clients share the core's ordering; request replies never enter it. */
  subscribeClient(features: readonly ClientFeature[], send: (frame: HubFrame, serialized: () => string) => void): () => void {
    const client = { features, key: [...new Set(features)].sort().join(','), send };
    this.#clients.add(client);
    return () => this.#clients.delete(client);
  }
  readonly #env: NodeJS.ProcessEnv;
  readonly crew: CrewSource | undefined;
  readonly rules: RulebookFile | undefined;
  readonly #unsubscribeRules: (() => void) | undefined;
  readonly #rulebookUiUnsubscribe: (() => void) | undefined;
  async refreshVisibility(choice: { surface: 'topics' | 'sessions' | 'artifacts'; target: string }, resumed: <T>(work: () => T) => T = work => work()): Promise<void> {
    this.#refreshExplorerContext();
    type Rows = import('../protocol.ts').VisibilityFrame['rows'];
    const empty = (): Rows => ({ topics: [], sessions: [], processes: [], artifacts: [], messages: [] });
    let rows = empty(), bytes = 512, count = 0, announced = false;
    const flush = () => {
      this.#emit({ type: 'visibility' }, { type: 'visibility', rows }, !announced);
      announced = true;
      rows = empty(); bytes = 512; count = 0;
    };
    const add = <K extends keyof Rows>(surface: K, row: Rows[K][number]) => {
      const size = Buffer.byteLength(JSON.stringify(row)) + 1;
      if (size + 512 > MAX_FRAME_BYTES) throw new Error('visibility row exceeds the model frame byte limit');
      if (count && (count === 100 || bytes + size > 256 * 1024)) flush();
      // A single large row may exceed the target chunk size, but never the wire cap.
      (rows[surface] as Array<Rows[K][number]>).push(row);
      bytes += size; count++;
    };
    const through = this.#store.messageWatermark();
    if (choice.surface === 'topics') {
      const topic = this.#store.topic(choice.target);
      if (topic) add('topics', this.visibility.place('topics', topic));
    }
    if (choice.surface === 'sessions') {
      for (const session of this.presence().filter(session => session.name === choice.target)) add('sessions', this.visibility.place('sessions', session));
      for (const process of this.#heartbeatProcesses.values()) if (process.name === choice.target) add('processes', this.visibility.place('sessions', process));
    }
    if (choice.surface === 'artifacts') {
      const artifact = this.#store.artifact(choice.target);
      if (artifact) add('artifacts', this.visibility.place('artifacts', artifact));
    } else if (choice.surface === 'topics') {
      let before: string | undefined;
      do {
        const page = resumed(() => this.#store.artifactPage(choice.target, before));
        resumed(() => { for (const artifact of page.artifacts) add('artifacts', this.visibility.place('artifacts', artifact)); });
        before = page.more ? page.before : undefined;
        if (before) {
          if (count) resumed(flush);
          await new Promise<void>(resolve => setImmediate(resolve));
        }
      } while (before && !this.#closed);
    }
    let after = 0;
    while (!this.#closed) {
      const page = resumed(() => this.#store.visibilityMessages(choice, after, through));
      resumed(() => {
        for (const message of page) {
          const projected = this.visibility.frame({ type: 'message', topic: this.#messageTopic(message.topic)!, message: this.#resolveAttachments({ ...message, withdrawable: this.#withdrawalReason(message) === null }) });
          add('messages', projected.message);
        }
      });
      if (page.length < 100) break;
      after = page.at(-1)!.seq;
      // Do not retain an old projection over a yield: another preference may
      // commit in between pages. Every following page uses the current policy.
      if (count) resumed(flush);
      await new Promise<void>(resolve => setImmediate(resolve));
    }
    if (!this.#closed && (count || !announced)) resumed(flush);
  }

  publishCrew(config: CrewConfig): void {
    this.#emit({ type: 'crew', config, summary: crewSummary(config) });
    for (const connection of this.#live.values()) {
      const id = this.#recordClause(connection, 'crew changed');
      if (id) this.#send(this.#store.message(id) as Message, connection.name);
    }
  }

  #rulesChanged(rules: readonly Rule[], previous: readonly Rule[]): void {
    const inScope = (rule: Rule | undefined, role: string | null) => !!rule && role !== null && (rule.scope === 'all' || rule.scope.includes(role));
    const sessions = new Map([...this.#live.values()].filter(c => {
      const process = this.#heartbeatProcesses.get(c.sessionId);
      return !process || process.status === 'running';
    }).map(c => [c.name, c.role]));
    for (const process of this.#heartbeatProcesses.values()) {
      if (process.status === 'running') sessions.set(process.name, this.#store.roleOf(process.name));
    }
    for (const number of new Set([...previous, ...rules].map(rule => rule.number))) {
      const old = previous.find(rule => rule.number === number);
      const current = rules.find(rule => rule.number === number);
      if (JSON.stringify(old) === JSON.stringify(current)) continue;
      const rule = current ?? old!;
      const scope = rule.scope === 'all' ? 'all' : rule.scope.join(', ');
      const retired = `rule ${number} retired (scope: ${scope}; reason: ${rule.reason}${current ? '' : '; removed from rulebook'})`;
      const active = `rule ${number}: ${rule.text} (scope: ${scope}; reason: ${rule.reason})${old && old.title !== rule.title ? `\nTitle: ${rule.title}` : ''}`;
      const text = current?.status === 'active' ? active : retired;
      this.#store.transaction(() => {
        const groups = new Map<string, string[]>();
        for (const [name, role] of sessions) {
          if (!inScope(current, role) && !inScope(old, role)) continue;
          const body = current?.status === 'active' && inScope(current, role) ? active : retired;
          groups.set(body, [...(groups.get(body) ?? []), name]);
        }
        for (const [body, to] of groups) {
          const message = this.#recordNotice(AGENTS.id, { kind: 'event', to, text: body, detail: { event: 'rule', subject: { rule: String(number) }, digest: 'turn', rule: number, scope: rule.scope, reason: rule.reason, retired: body === retired } }, new Set(to));
          if (message) this.#afterCommit(() => this.#publishNotice(message));
        }
        // One row per change, independent of how many sessions receive it.
        this.#afterCommit(() => this.#log({ event: 'event-announced', kind: 'rule', subject: { rule: String(number) }, text }));
      });
    }
  }

  /** Built-ins retain their order; configured custom roles append to the same public list. */
  roleNames(): string[] { return [...new Set([...ROLE_NAMES, ...(this.#roles?.get().keys() ?? [])])]; }

  roleDefinition(role: string) {
    const definition = this.#roles?.get().get(role);
    if (!definition || !this.crew) return definition;
    const { base, guidance } = roleClauseSections(definition.clause);
    const section = guidance ? `\n\n${PROJECT_RULES_HEADING}\n${guidance}` : '';
    return { ...definition, clause: `${base}\n\n${staffingClause(role, this.crew.get())}${section}` };
  }

  /** Instructions name only usable project skills, without changing the configured role policy. */
  roleInstructions(role: string) {
    const definition = this.roleDefinition(role);
    const available = this.#roles?.availableSkills?.();
    return definition && available ? { ...definition, skills: definition.skills.filter(skill => available.has(skill)) } : definition;
  }

  deliverReuseBrief(message: Message): void {
    const name = message.to[0]!;
    this.#record(message, [{ session: name, state: 'queued', direct: true }], this.#now().getTime());
    this.#store.touchTopic(AGENTS.id, message.ts);
    this.#emitMessage(message);
    this.#log({ event: 'send', id: message.id, from: message.from, kind: message.kind, to: message.to, topic: message.topic, bytes: Buffer.byteLength(message.text), outcomes: [`${name}:queued`] });
    this.#send(message, name);
  }
  readonly #heartbeatTimer: ClockTimer;
  readonly #heartbeatMs: number | undefined;
  readonly #heartbeatRunTimeoutMs: number;
  readonly #idleNotifyMs: number;
  readonly #heartbeatProcesses = new Map<string, HarnessProcessView>();
  readonly #heartbeatStarts = new Map<string, number>();
  readonly #durationWarnings: CoreOptions['durationWarnings'];
  #heartbeatWork: Promise<void> | null = null;

  #dueHeartbeat(id: string, now: number) {
    const process = this.#heartbeatProcesses.get(id);
    if (process && process.status !== 'running') return null;
    const name = this.#store.nameOfSession(id);
    const session = name ? { name, role: this.#store.roleOf(name) } : process;
    if (!session?.role) return null;
    const setting = (this.crew?.get() ?? defaultCrew()).crew[session.role]?.heartbeat;
    if (!setting || setting === 'off') return null;
    const interval = this.#heartbeatMs ?? durationMs(setting);
    const start = this.#heartbeatStarts.get(id) ?? now;
    this.#heartbeatStarts.set(id, start);
    const schedule = this.#store.heartbeatSchedule(id, session.role, interval, start);
    return schedule.next <= now ? { ...session, interval, schedule } : null;
  }

  async #heartbeatTick(): Promise<void> {
    const now = this.#now().getTime();
    const sessions = new Set(this.#store.knownSessions().flatMap(session => {
      const id = this.#store.sessionIdOf(session.name);
      return id ? [id] : [];
    }));
    for (const id of this.#heartbeatProcesses.keys()) sessions.add(id);
    for (const id of sessions) {
      const due = this.#dueHeartbeat(id, now);
      if (!due) continue;
      const warnings = due.role === COORDINATOR ? await this.#durationWarnings?.(() => this.#now().getTime()) ?? [] : [];
      if (this.#closed) return;
      // Reads can outlive rename, role/crew changes, process termination or
      // pruning. Resolve by stable identity again before touching the schedule.
      const firing = this.#now().getTime();
      const session = this.#dueHeartbeat(id, firing);
      if (!session || session.role !== due.role || session.interval !== due.interval) continue;
      const { interval, schedule } = session;
      this.#store.transaction(() => {
        const digest = heartbeatDigest(this.#store, [...this.#itemSnapshots.values()], interval, firing, this.#idleNotifyMs, this.#heartbeatRunTimeoutMs, this.#verificationQueue);
        this.#store.replaceHeartbeat(session.name);
        const text = `${digest.text}${warnings.length ? `\n\nDuration allowances (${warnings.length})\n${warnings.map(row => `- ${row}`).join('\n')}` : ''}`;
        const message = this.#recordNotice(AGENTS.id, { kind: 'event', to: [session.name], text: `heartbeat · ${session.name} · ${text}`, detail: { event: 'heartbeat', subject: { session: session.name }, digest: this.sessionState(id) === 'idle' ? 'now' : 'turn', inFlight: digest.inFlight, stale: digest.stale } }, new Set([session.name]));
        this.#store.firedHeartbeat(schedule, firing);
        if (message) this.#afterCommit(() => this.#publishNotice(message));
        this.#afterCommit(() => this.#log({ event: 'event-announced', kind: 'heartbeat', subject: { session: session.name }, session: session.name, text: `${session.name} · in flight ${digest.inFlight} · stale ${digest.stale}`, firing }));
      });
    }
  }

  readonly #live = new Map<string, Connection>();
  readonly #reserved: ReadonlySet<string>;
  readonly clock: Clock;
  readonly #now: () => Date;
  readonly #log: LogFn;
  readonly #store: Store;
  readonly #queueTtlMs: number;
  readonly #eventWindowMs: number;
  readonly #retentionMs: number;
  readonly #hygiene: Hygiene;
  readonly #listeners = new Set<(event: HubEvent) => void>();
  /** Each session's state by its session id (a rename moves nothing), set only by adapters (spec 4.2). */
  readonly #states = new Map<string, SessionState>();
  readonly #approvalCommands = new Map<string, string>();
  #drainingVerifierRequests = false;
  /** Sessions rejects recipients without an adapter-owned injection boundary. */
  #withdrawalRefusal: ((messageId: string, sessions: string[]) => string | null) | null = null;
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
  #shellCredential: ((sessionId: string, credential?: string) => Promise<void>) | null = null;
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
  #coordinatorVacancyTimer: ClockTimer | undefined;
  #canSteerEvents: (sessionId: string) => boolean = () => false;
  readonly #processItems = new Map<string, string | null>();
  readonly #artifactStates = new Map<string, Artifact['status']>();
  readonly #processFacts = new Map<string, Pick<HarnessProcessView, 'status' | 'role' | 'harness' | 'model' | 'account'>>();
  readonly accountLimits: AccountLimits;
  #accountPoller: AccountPoller | undefined;
  #limitTimer: ClockTimer | undefined;
  useAccountPoller(poller: AccountPoller): void { this.#accountPoller = poller; this.#scheduleLimits(); }
  readonly #usageRecords = new Map<string, { usage: Pick<SessionUsage, 'total' | 'rateLimits' | 'rateLimitsByLimitId'>; final: boolean }>();
  #publishedPresence = '[]';
  #presenceImmediate: NodeJS.Immediate | null = null;
  #items: TopicItems | null;
  readonly #sessionHolds: (sessionId: string) => SessionHold[];
  /** The last indexed ownership survives a watcher removal until its final fan-out. */
  readonly #defaultItems = new Map<string, DefaultItem>();
  /** Current committed summaries for live projections; refreshed before task fan-out. */
  readonly #itemSnapshots = new Map<string, ItemSummary>();
  /** What subscribers last heard of each topic (status, warning, binding, title): a change is a `topic` event. */
  readonly #publishedTopics = new Map<string, string>();
  readonly #topicStatuses = new Map<string, TopicStatus>();
  /** The Coordinator's asks to the human (#33). */
  readonly asks: Asks;
  /** The human's inbox (§3.7): asks/command approvals, plans, requests and messages. */
  readonly inbox: InboxBoard;
  readonly visibility: Visibility;

  constructor(options: CoreOptions = {}) {
    this.#env = options.env ?? process.env;
    this.#reserved = new Set([HUMAN, ...(options.reservedNames ?? [])]);
    this.clock = resolveClock(options);
    this.#modelRing = new ModelRing(this.clock);
    this.#now = () => this.clock.now();
    this.#log = options.log ?? (() => {});
    this.#store = options.store ?? new Store();
    this.accountLimits = new AccountLimits({ read: key => this.#store.meta(key), write: (key, value) => this.#store.setMeta(key, value) });
    this.#eventWindowMs = options.eventWindowMs ?? 60_000;
    this.#roles = options.roles ?? null;
    this.crew = options.crew;
    this.rules = options.rules;
    this.#unsubscribeRules = this.rules?.subscribe((rules, previous) => this.#rulesChanged(rules, previous));
    this.#rulebookUiUnsubscribe = this.rules?.subscribe(rules => this.#emit({ type: 'rules.changed', rules }));
    this.#heartbeatMs = options.heartbeatMs;
    this.#heartbeatRunTimeoutMs = options.heartbeatRunTimeoutMs ?? 4500000;
    this.#durationWarnings = options.durationWarnings;
    this.#idleNotifyMs = options.idleNotifyMs ?? IDLE_NOTIFY_MS;
    this.#heartbeatTimer = this.clock.setInterval(() => {
      if (this.#heartbeatWork || this.#closed) return;
      this.#heartbeatWork = this.#heartbeatTick().catch(error => this.#log({ event: 'heartbeat-failed', error: String(error) })).finally(() => { this.#heartbeatWork = null; });
    }, Math.min(1000, Math.max(10, (options.heartbeatMs ?? 4000) / 4)));
    this.#heartbeatTimer.unref();
    this.#items = options.items ?? null;
    this.#store.setItemResolver(id => this.#items?.resolveId?.(id) ?? null);
    this.#sessionHolds = options.sessionHolds ?? (() => []);
    this.visibility = new Visibility({ preferences: options.visibilityPreferences, overrides: options.visibility ?? {}, now: this.#now, role: name => this.#store.roleOf(name), process: id => this.#processFacts.get(id), items: () => [...this.#itemSnapshots.values()], ...(options.ladder ? { ladder: options.ladder } : {}) });
    for (const item of this.#items?.list?.() ?? []) {
      this.#itemSnapshots.set(`T-${idNumber(item.id)}`, item);
      if (item.state !== 'closed') this.#defaultItems.set(`T-${idNumber(item.id)}`, item);
    }
    this.#taskLayers = this.visibility.frame({ type: 'task', id: '', item: null } as Extract<HubEvent, { type: 'task' }>).layers ?? {};
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
    this.#refreshExplorerContext(false);
    for (const [key,item] of this.#itemSnapshots) this.#publishedTasks.set(key,item);
    for (const t of this.#store.topics()) { this.#publishedTopics.set(t.id, HubCore.#topicSignature(t)); this.#topicStatuses.set(t.id, t.status); }
    this.asks = new Asks({
      store: this.#store,
      now: this.#now,
      log: entry => this.#afterCommit(() => this.#log(entry)),
      emit: (e) => this.#afterCommit(() => this.#emit(e)),
      emitMessage: (m) => this.#afterCommit(() => this.#emitMessage(m)),
      publishTopics: () => this.#afterCommit(() => this.#publishTopics()),
      move: (t, m, why) => void this.#move(t, m, why),
      topic: (id) => this.#topicOrThrow(id),
      sizeRefusal: (text) => this.#hygiene.sizeRefusal(text),
      role: (name) => this.#live.get(name)?.role ?? null,
      // the permission table's word on `ask` (#30): the role's grants, or the default table on a hub with no roles
      mayAsk: (role) => decide(role, role === null ? undefined : (this.#roles?.get().get(role)?.permissions.tools ?? DEFAULT_PERMISSIONS[role]), { tool: 'ask' }),
      identity: id => this.sessionIdentity(id),
      nextLead: (from, topic, forwarding) => this.#questionLead(from, topic, forwarding),
      sendFromSession: (from, topic, to, text, replyTo, kind, answerTo, attribution) => this.sendFromSession(from, [to], text, replyTo, topic, undefined, undefined, undefined, kind, undefined, false, answerTo, undefined, undefined, attribution),
      sendFromHuman: (topic, text, to, answerTo, attribution, via) => this.sendFromHuman(topic, text, to, undefined, answerTo, undefined, undefined, undefined, attribution, undefined, via),
      // an ask withdrawn or cancelled: a notice in its topic to the asker, through the one notice path
      noteTo: (topic, session, text) => {
        if (this.noticeInTopic(topic, { kind: 'ask-closed', text, to: [session] }) === null) throw new Error(`no topic "${topic}"`);
      },
    });
    this.inbox = new InboxBoard({
      clock: this.clock,
      visibility: this.visibility,
      store: this.#store,
      now: this.#now,
      log: this.#log,
      emit: (e) => this.#emit(e),
      topics: () => this.#store.topics(),
      items: () => [...this.#itemSnapshots.values()],
      presence: () => this.presence(),
      stateOf: (id) => this.sessionState(id),
      sizeRefusal: text => this.#hygiene.sizeRefusal(text),
      approvalNote: (record, note) => {
        const process = this.#processRows?.().find(p => p.sessionId === record.sessionId);
        const item = process?.item ?? this.#sessionItems(record.sessionId)[0];
        const topic = item ? this.#store.topics().find(t => t.item === item) : undefined;
        const via = record.outcome?.via;
        this.sendFromHuman(topic?.id ?? 'general', note, [process?.name ?? record.session], undefined, undefined, undefined, undefined, undefined, undefined, undefined, via === 'telegram' || via === 'discord' ? via : undefined);
      },
      idleNotifyMs: options.idleNotifyMs ?? IDLE_NOTIFY_MS,
      idle: (session, minutes) => this.publishEvent({ session }, 'session.state', `${session} idle ${minutes} min`, { lifecycle: 'long idle' }),
    });
    // The inbox observes section changes and journals informational notifications.
    this.#listeners.add((e) => this.inbox.observe(e));
    this.#restoreCoordinatorVacancy();
  }

  // ---------------------------------------------------------------- events

  /** Listen to every `message` and `delivery` event (a subscribed client); returns the unsubscribe. */
  subscribe(listener: (event: HubEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  readonly #recentEvents = new Map<string, EventRow>();
  #journalRows: Array<{ row: EventRow; record: JournalRecord }> = [];
  #journalImmediate: NodeJS.Immediate | null = null;
  #closed = false;

  /** Stop deferred publications before the hub closes its store. */
  close(): void {
    this.#closed = true;
    this.#clients.clear();
    this.#modelRing.close();
    this.#rulebookUiUnsubscribe?.();
    this.clock.clearInterval(this.#heartbeatTimer);
    this.#unsubscribeRules?.();
    if (this.#presenceImmediate) clearImmediate(this.#presenceImmediate);
    this.#presenceImmediate = null;
    if (this.#rowsImmediate) clearImmediate(this.#rowsImmediate);
    this.#rowsImmediate = null;
    if (this.#journalImmediate) clearImmediate(this.#journalImmediate);
    this.#journalImmediate = null;
    this.#journalRows = [];
    this.clock.clearTimeout(this.#limitTimer);
    this.clock.clearTimeout(this.#coordinatorVacancyTimer);
    this.inbox.close();
  }

  /** Restore the tail's coalesced predecessors before any startup announcements. */
  restoreJournalRows(rows: EventRow[]): void {
    for (const row of rows) {
      const key = eventKey(row), previous = this.#recentEvents.get(key);
      if (!previous || Date.parse(row.ts) > Date.parse(previous.ts)) this.#recentEvents.set(key, row);
    }
  }

  /** Match already projected rows, also used for per-connection live and replay filters. */
  eventsMatch(filter: EventsFilter = {}): (row: EventRow) => boolean {
    const canonical = (id: string) => this.#items?.resolveId?.(id) ?? id;
    if (filter.subject?.kind === 'item') filter = { ...filter, subject: { ...filter.subject, id: canonical(filter.subject.id) } };
    if (filter.muted) filter = { ...filter, muted: filter.muted.map(subject => subject.kind === 'item' ? { ...subject, id: canonical(subject.id) } : subject) };
    const descendants = filter.subject?.kind === 'item' ? new Set([...this.#itemSnapshots.values()].filter(i => i.id === filter.subject!.id || this.#items?.ancestry?.(i.id)?.includes(filter.subject!.id)).map(i => i.id)) : null;
    descendants?.add(filter.subject!.id);
    return row => {
      if (row.item || row.subject.kind === 'item') row = { ...row, ...(row.item ? { item: canonical(row.item) } : {}), ...(row.subject.kind === 'item' ? { subject: { ...row.subject, id: canonical(row.subject.id) } } : {}) };
      if (filter.kinds?.length && !filter.kinds.includes(row.kind) || filter.warnings && !row.warning) return false;
      if (filter.muted?.some(s => s.kind === row.subject.kind && s.id === row.subject.id)) return false;
      const subject = filter.subject;
      if (subject && !(subject.kind === 'item' ? descendants?.has(row.item ?? (row.subject.kind === 'item' ? row.subject.id : '')) : row.subject.kind === subject.kind && row.subject.id === subject.id || row[subject.kind] === subject.id)) return false;
      return true;
    };
  }

  /** Same projection for the journal and live rows, independent of visibility preferences. */
  eventsProject(filter: EventsFilter = {}): (row: EventRow, record: JournalRecord) => EventRow | null {
    const matches = this.eventsMatch(filter);
    // Most journal rows cannot duplicate an inbox wait. Do not rebuild the inbox for usage/state/task traffic.
    // Capture it lazily once for a batch that actually needs wait suppression.
    let snapshot: ReturnType<InboxBoard['list']> | undefined;
    const inbox = () => snapshot ??= this.inbox.list();
    let waitingTopics: Set<string> | undefined;
    const items = new Map([...this.#itemSnapshots.values()].map(i => [i.id, i]));
    return (row, record) => {
      const canonical = (id: string) => this.#items?.resolveId?.(id) ?? id;
      if (row.item || row.subject.kind === 'item') row = { ...row, ...(row.item ? { item: canonical(row.item) } : {}), ...(row.subject.kind === 'item' ? { subject: { ...row.subject, id: canonical(row.subject.id) } } : {}) };
      if (row.kind === 'topic' && /waiting for human/.test(row.text)) {
        waitingTopics ??= new Set([...inbox().waiting.map(t => t.id), ...inbox().asks.map(a => a.topic.id), ...inbox().messages.map(m => m.topic.id), ...inbox().requests.map(r => r.topic.id)]);
        if (waitingTopics.has(row.subject.id)) return null;
      }
      if (record.event === 'notification' && record.kind === 'plan' && inbox().plans.some(p => p.id === row.subject.id)) return null;
      const cell = record.event === 'notification' ? String(record.kind === 'verdict' ? record.result === 'not clear' ? 'not_clear' : 'clear' : record.kind)
        : row.kind === 'verdict' ? row.warning ? 'not_clear' : 'clear' : row.kind === 'release' ? 'release' : row.kind === 'session' && row.warning ? 'death' : undefined;
      const promoted = cell && this.visibility.raisedToNow('inbox', record, cell)
        || row.kind === 'artifact' && this.visibility.raisedToNow('artifacts', this.#store.artifact(row.subject.id) ?? { id: row.subject.id, creatorRole: record.role, creator: record.session })
        || row.kind === 'task' && this.visibility.raisedToNow('items', items.get(row.subject.id) ?? {})
        || row.kind === 'session' && this.visibility.raisedToNow('sessions', { role: record.role, status: /stopped|died|harness-exited/.test(row.text) ? 'stopped' : 'running', state: /idle/.test(row.text) ? 'idle' : 'busy' })
        || row.kind === 'topic' && this.visibility.raisedToNow('topics', { status: /closed/.test(row.text) ? 'closed' : /waiting for human/.test(row.text) ? 'waiting for human' : 'open' });
      if (promoted) row = { ...row, warning: true, glyph: '⚠', bookkeeping: false };
      if (!matches(row)) return null;
      return row;
    };
  }

  publishJournalRow(row: EventRow, record: JournalRecord): void {
    if (this.#closed) return;
    this.#journalRows.push({ row, record });
    if (this.#journalImmediate) return;
    this.#journalImmediate = setImmediate(() => {
      this.#journalImmediate = null;
      if (this.#closed) return;
      const rows = this.#journalRows;
      this.#journalRows = [];
      // Startup and bursts share one inbox projection, rather than a full query per journal row.
      const project = this.eventsProject();
      for (const entry of rows) this.#publishJournalRow(entry.row, entry.record, project);
    });
  }

  #publishJournalRow(row: EventRow, record: JournalRecord, project: ReturnType<HubCore['eventsProject']>): void {
    const projected = project(row, record);
    if (!projected) return;
    row = projected;
    const key = eventKey(row), time = Date.parse(row.ts);
    for (const [k, r] of this.#recentEvents) if (time - Date.parse(r.ts) > 60000) this.#recentEvents.delete(k);
    const previous = this.#recentEvents.get(key);
    if (previous && time - Date.parse(previous.ts) <= 60000) {
      row = { ...row, replaces: previous.id, count: (previous.count ?? 1) + 1, firstTs: previous.firstTs ?? previous.ts };
    }
    this.#recentEvents.set(key, row);
    this.#emit({ type: 'event', row });
  }

  #verificationQueue: VerificationQueue | undefined;
  publishVerification(queue: VerificationQueue): void { this.#verificationQueue = queue; this.#emit({ type: 'verification.queue', queue }); }

  #processRows: () => HarnessProcessView[] = () => [...this.#heartbeatProcesses.values()].filter(p => !p.archived);
  #rowsImmediate: NodeJS.Immediate | null = null;
  readonly #publishedRows = new Map<string, string>();

  useSessionRows(read: () => HarnessProcessView[]): void { this.#processRows = read; }

  /** Explicit process views carry freshly loaded work; the default reader may return cached facts. */
  sessionRows(loadedProcesses?: HarnessProcessView[]): SessionRow[] {
    const processes = loadedProcesses ?? this.#processRows();
    const presence = this.presence(loadedProcesses);
    const key = (s: { sessionId: string; name: string }) => s.sessionId === UNKNOWN_SESSION ? `name:${s.name}` : s.sessionId;
    const connected = new Map(presence.map(s => [key(s), s]));
    const entries: Array<{ process?: HarnessProcessView; presence?: Presence }> = processes.map(process => {
      const live = connected.get(key(process));
      connected.delete(key(process));
      return { process, ...(live ? { presence: live } : {}) };
    });
    for (const live of connected.values()) entries.push({ presence: live });
    return entries.map(({ process: p, presence: live }) => {
      const identity = live ?? p!;
      const running = p ? p.status === 'running' : true;
      // Connected presence already loaded these work facts for this projection.
      const holds = live?.holds ?? this.sessionHolds(identity);
      const pending = running ? (live ? live.pending : this.sessionPending(identity)) : undefined;
      const held = holds[0];
      const state = p?.stateReason || !running ? 'unknown' : this.sessionState(identity.sessionId);
      const saved = this.#store.meta(`heartbeat-state:${identity.sessionId}`);
      const transition = saved ? JSON.parse(saved) as { state: SessionState; since: number } : null;
      const command = running ? this.sessionApprovalCommand(identity.sessionId) : undefined;
      const row: SessionRow = {
        ...p, key: key(identity), name: identity.name, sessionId: identity.sessionId,
        role: identity.role, label: withRole(identity.name, identity.role), cwd: identity.cwd,
        harness: p?.harness ?? null, status: p?.status ?? 'connected',
        launched: !!p, live: running, presence: live ?? null,
        state, stateSince: transition?.state === state ? new Date(transition.since).toISOString() : null,
        holds, item: held?.item ?? pending?.item ?? p?.item ?? null,
        itemKind: held?.role ?? pending?.kind ?? null, itemRequested: !held && !!pending,
        additionalHolds: Math.max(0, holds.length - 1),
      };
      delete row.pending;
      delete row.approvalCommand;
      if (pending) row.pending = pending;
      if (command !== undefined) row.approvalCommand = command;
      return this.visibility.place('sessions', row);
    });
  }

  #scheduleSessionRows(): void {
    if (this.#closed || this.#rowsImmediate) return;
    this.#rowsImmediate = setImmediate(() => {
      this.#rowsImmediate = null;
      const rows = this.sessionRows();
      const keys = new Set(rows.map(row => row.key));
      for (const key of this.#publishedRows.keys()) if (!keys.has(key)) {
        this.#publishedRows.delete(key);
        this.#emit({ type: 'session.row', key, row: null }, undefined, false);
      }
      for (const row of rows) {
        const signature = JSON.stringify(row);
        if (this.#publishedRows.get(row.key) === signature) continue;
        this.#publishedRows.set(row.key, signature);
        this.#emit({ type: 'session.row', key: row.key, row }, undefined, false);
      }
    });
  }

  #emit(event: HubEvent, featured?: import('../protocol.ts').ModelEvent, legacy = true): void {
    if (event.type === 'task') {
      const signature = event.item;
      const key = `T-${idNumber(event.id)}`;
      if (!event.siblings && this.#publishedTasks.has(key) && isDeepStrictEqual(this.#publishedTasks.get(key),signature)) return;
      this.#publishedTasks.set(key, signature);
    }
    if (['presence', 'session.process', 'session.state', 'session.role', 'session.usage', 'sessions.pruned', 'visibility'].includes(event.type)) this.#scheduleSessionRows();
    if (legacy) for (const listener of [...this.#listeners]) {
      try {
        listener(event);
      } catch (err) {
        // Subscribers and their error logger observe a committed event; neither can undo it
        // or prevent the other subscribers from hearing the committed state.
        try { this.#log({ event: 'listener-failed', error: err instanceof Error ? err.message : String(err) }); }
        catch { /* the failed observer/logger must not turn publication into a domain failure */ }
      }
    }
    const seq = ++this.#modelSeq;
    const projected = this.visibility.frame(event);
    let slim: import('../protocol.ts').ModelEvent = projected;
    if (projected.type === 'task') {
      const layers = projected.layers ?? {};
      const changed: Record<string, Layer | null> = {};
      for (const id of new Set([...Object.keys(this.#taskLayers), ...Object.keys(layers)])) {
        if (this.#taskLayers[id] !== layers[id]) changed[id] = layers[id] ?? null;
      }
      this.#taskLayers = layers;
      slim = { ...projected, layers: changed };
    }
    const full = { ...(featured ?? projected), epoch: this.#epoch, seq };
    const slimDelta = slim === projected || featured ? full : { ...slim, epoch: this.#epoch, seq };
    const retained = this.#modelRing.append(full, slimDelta);
    const clients = [...this.#clients];
    this.#modelPublications.push(() => {
      const variants = new Map<string, { frame: HubFrame; json?: string }>();
      for (const client of clients) {
        if (!legacy && !client.features.includes('numbered-deltas') && !client.features.includes('slim-frames') && !(event.type === 'session.row' && client.features.includes('snapshot'))) continue;
        try {
          let variant = variants.get(client.key);
          if (!variant) {
            const frame = featured && (client.features.includes('slim-frames') || client.features.includes('numbered-deltas')) ? featured
              : client.features.includes('slim-frames') ? slim : projected;
            variant = client.features.includes('numbered-deltas')
              ? { frame: client.features.includes('slim-frames') ? slimDelta : full, json: client.features.includes('slim-frames') ? retained.slim : retained.full }
              : { frame };
            variants.set(client.key, variant);
          }
          const shared = variant;
          client.send(shared.frame, () => shared.json ??= JSON.stringify(shared.frame));
        } catch { /* a disconnected client cannot undo a committed publication */ }
      }
    });
    if (this.#publishingModel) return;
    this.#publishingModel = true;
    try {
      for (let next; (next = this.#modelPublications.shift());) next();
    } finally { this.#publishingModel = false; }
  }

  /** A recorded topic message reaches the subscribers, with its stage as stored. */
  #emitMessage(message: Message): void {
    if (message.topic === undefined) return;
    const topic = this.#messageTopic(message.topic);
    if (!topic) return;
    const stage = this.#store.stage(message.id);
    const ask = this.asks.card(message.id);
    const { messages, runs } = this.#store.threadRuns(topic.id, [{ ...message, seq: this.#store.messageSeq(message.id), topic: topic.id, withdrawable: this.#withdrawalReason(message) === null, ...(stage ? { stage } : {}), ...(ask ? { ask } : {}) }], this.#now().getTime());
    this.#emit({ type: 'message', topic, message: messages[0]!, ...(runs[0] ? { run: runs[0] } : {}) });
  }

  /** Observers and transport see committed rows; their failures cannot enter a caller's rollback path. */
  #afterCommit(publish: () => void): void {
    this.#store.afterCommit(publish, error => this.#log({ event: 'publication-failed', error: error instanceof Error ? error.message : String(error) }));
  }

  /** Seed ownership facts without publishing or advancing terminal checkpoints. */
  seedProcess(process: HarnessProcessView): void {
    this.#heartbeatProcesses.set(process.sessionId, process);
    if (!this.#store.meta(`heartbeat-state:${process.sessionId}`)) this.#store.setMeta(`heartbeat-state:${process.sessionId}`, JSON.stringify({ state: process.state, since: this.#now().getTime() }));
    if (!this.#heartbeatStarts.has(process.sessionId)) this.#heartbeatStarts.set(process.sessionId, Date.parse(process.startedAt));
    this.#processFacts.set(process.sessionId, { status: process.status, role: process.role, harness: process.harness, model: process.model, account: process.account ?? null });
    this.#processItems.set(process.sessionId, process.item ? this.#items?.resolveId?.(process.item) ?? process.item : null);
  }

  /** Seed active rows; recover a committed stop whose publication was interrupted by a hub crash. */
  rememberProcess(process: HarnessProcessView): void {
    if (process.status !== 'running') { this.publishProcess(process); return; }
    this.seedProcess(process);
    this.#store.setMeta(`subscription-terminal:${process.sessionId}`, '');
  }

  /** Restore a complete process snapshot before publishing terminal recovery.
   * One commit owns the startup checkpoints; observers run after it, including
   * those that write through the separate process-table connection. */
  restoreProcesses(processes: HarnessProcessView[], stopped: HarnessProcessView[]): void {
    this.#store.transaction(() => {
      for (const process of [...processes, ...stopped]) this.seedProcess(process);
      for (const process of processes) this.rememberProcess(process);
    });
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
  publishProcess(process: HarnessProcessView, archived?: number): void {
    if (process.status !== 'running') {
      this.#store.clearMeta(`pending-verification:${this.sessionIdentity(process.sessionId)}`);
      process = { ...process };
      delete process.pending;
    }
    const previous = this.#processFacts.get(process.sessionId)?.status;
    this.seedProcess(process);
    const context = { role: process.role, item: process.item };
    const items = process.item ? [process.item] : this.#sessionItems(process.sessionId);
    const suffix = items.map(item => ` · ${item}`).join('');
    const checkpoint = `subscription-terminal:${process.sessionId}`;
    if (process.status === 'running') {
      if (previous !== process.status && this.#usageRecords.get(process.sessionId)?.final) this.#usageRecords.delete(process.sessionId);
      this.#store.setMeta(checkpoint, '');
      if (previous !== process.status) this.publishEvent({ session: process.name }, 'session.state', `${process.name} launched${suffix}`, context);
    } else {
      this.#recordUsage(process.name, process.sessionId, process.usage, true);
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
    this.#afterCommit(() => this.#emit({ type: 'session.process', process, ...(archived === undefined ? {} : { archived }) }));
  }

  pruneProcess(process: Pick<HarnessProcessView, 'name' | 'sessionId'>): void {
    this.#store.pruneSession(process.name, process.sessionId);
    this.#states.delete(process.sessionId);
    this.#approvalCommands.delete(process.sessionId);
    this.#heartbeatProcesses.delete(process.sessionId);
    this.#heartbeatStarts.delete(process.sessionId);
    this.#store.stopHeartbeat(process.sessionId);
    this.#store.clearMeta(`heartbeat-state:${process.sessionId}`);
    this.#processFacts.delete(process.sessionId);
    this.#processItems.delete(process.sessionId);
    this.#usageRecords.delete(process.sessionId);
  }

  publishPruned(sessionIds: string[], archived: number): void { this.#emit({ type: 'sessions.pruned', sessionIds, archived }); }

  publishCleanup(sessionId: string, pending: boolean): void {
    this.#emit({ type: 'session.cleanup', sessionId, state: pending ? 'pending stop' : 'settled' });
  }

  /** Commit the notice and its last missing set together, including across hub restarts. */
  publishMissingDone(notice: import('../tracker/tracker.ts').MissingDoneNotice): void {
    const key = `ready-missing-done:T-${idNumber(notice.item)}`;
    const signature = JSON.stringify([notice.claimantId, notice.criteria.map(c => c.id).sort()]);
    this.#store.transaction(() => {
      if (this.#store.meta(key) === signature) return;
      if (notice.criteria.length) {
        const message = this.#recordNotice(notice.topic, {
          kind: 'report', to: [notice.claimant],
          text: `${notice.item}: ready is waiting only on your done marks. Mark every criterion done before requesting the final review:\n${notice.criteria.map(c => `${c.id}: ${c.text} — cland task criterion ${notice.item} done ${c.id}`).join('\n')}`,
        });
        if (!message) return;
        this.#afterCommit(() => this.#publishNotice(message));
      }
      this.#store.setMeta(key, signature);
    });
  }

  #refreshExplorerContext(emit = true): ItemSummary[] {
    if (!this.#items?.explorerContext) return [];
    const layers = this.visibility.frame({type:'task',id:'',item:null} as Extract<HubEvent,{type:'task'}>).layers ?? {};
    const messages = Object.fromEntries(this.#store.topics().flatMap(topic => topic.lastMessageAt ? [[topic.id,topic.lastMessageAt]] : []));
    const changed = this.#items.explorerContext(layers,messages);
    for (const item of changed) {
      this.#itemSnapshots.set(`T-${idNumber(item.id)}`,item);
      if (emit) this.#emit({type:'task',id:item.id,item});
    }
    return changed;
  }

  publishTask(change: ItemChange): void {
    const done = this.#items?.doneItemCount?.();
    const inventory = done === undefined ? {} : {done_items:done};
    if (change.item) this.#store.heartbeatItemSince(change.item.id, change.item.status ?? change.item.state, Date.parse(change.item.updated), this.#now().getTime());
    if (change.item) this.#itemSnapshots.set(`T-${idNumber(change.id)}`, change.item);
    else this.#itemSnapshots.delete(`T-${idNumber(change.id)}`);
    const contextChanged = this.#refreshExplorerContext(false);
    if (change.item) change = {...change,item:this.#items?.get?.(change.id) ?? change.item};
    if (!change.item || change.item.state === 'closed') {
      // Include disconnected verifiers: reopening an item must not revive an old reservation.
      for (const pending of this.#store.pendingVerifications()) {
        if (this.#sameItem(pending.item, change.id)) this.#store.clearMeta(pending.key);
      }
      this.#schedulePresence();
    }
    this.#afterCommit(() => this.#drainVerifierRequests());
    if (change.item === null) {
      this.#terminalEvent({ item: change.id }, 'task', `${change.id} removed`, change.previousAncestry ? { ancestry: change.previousAncestry } : {});
      this.#defaultItems.delete(`T-${idNumber(change.id)}`);
      this.#emit({ type: 'task', id: change.id, item: null, ...inventory, ...(change.siblings ? { siblings: change.siblings } : {}) });
      for (const item of contextChanged) this.#emit({type:'task',id:item.id,item});
      return;
    }
    if (change.item.state !== 'closed') this.#defaultItems.set(`T-${idNumber(change.id)}`, change.item);
    // Reparenting ends membership in departed ancestor subtrees, not those ancestor subscriptions.
    const current = this.#items?.ancestry?.(change.id) ?? [change.id];
    const departed = change.previousAncestry?.filter(id => !current.includes(id)) ?? [];
    if (departed.length) {
      const selected = this.#store.allSubscriptions().filter(s => 'subtree' in s.subject && departed.includes(s.subject.subtree) && s.events.includes('task'));
      this.#terminalEvent({ item: change.id }, 'task', `${change.id} left subtree`, {}, { selected, memberOnly: true });
    }
    for (const hold of change.item.holds) this.clearPendingVerification(hold.session, change.id);
    const postedVerdicts = [...(change.postedVerdicts ?? [])];
    for (const text of change.events ?? []) {
      if (text === 'closed') this.#terminalEvent({ item: change.id }, 'task', `${change.id} closed`);
      else {
        const context: EventContext = {};
        if (text.startsWith('status changed ')) {
          context.taskChange = 'status';
          context.ready = change.item.status === 'ready';
        } else if (text.startsWith('verdict posted ')) {
          context.taskChange = 'verdict';
          const verdict = postedVerdicts.shift();
          if (verdict) context.verdict = verdict;
        }
        this.publishEvent({ item: change.id }, 'task', `${change.id} ${text}`, context);
      }
    }
    if (change.item.state === 'closed') this.#defaultItems.delete(`T-${idNumber(change.id)}`);
    this.#emit({ type: 'task', id: change.id, item: change.item, ...inventory, ...(change.siblings ? { siblings: change.siblings } : {}) });
    for (const item of contextChanged) if (item.id !== change.id) this.#emit({type:'task',id:item.id,item});
  }

  /** Immediate events still use the ordinary delivery queue and the adapter's ordinary injection. */
  eventSteering(canSteer: (sessionId: string) => boolean): void { this.#canSteerEvents = canSteer; }

  #sessionItems(sessionId: string): string[] {
    return [...new Set(this.#sessionHolds(sessionId).map(hold => hold.item))]
      .filter(item => this.#items?.lead(item)?.state !== 'closed');
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
    if (includeItem && this.#items?.get) {
      const path = this.#items.ancestry?.(includeItem) ?? [includeItem];
      const items = new Map<string, DefaultItem>(path.flatMap(id => { const item = this.#items?.get?.(id); return item && item.state !== 'closed' ? [[item.id, item] as const] : []; }));
      const previous = this.#defaultItems.get(`T-${idNumber(includeItem)}`);
      if (previous && !items.has(previous.id)) {
        items.set(previous.id, previous);
        const seen = new Set([previous.id]);
        for (let parent = previous.parent; parent && !seen.has(parent);) {
          seen.add(parent);
          const ancestor = this.#items.get(parent);
          if (!ancestor) break;
          if (ancestor.state !== 'closed') items.set(ancestor.id, ancestor);
          parent = ancestor.parent;
        }
      }
      return items;
    }
    // Startup seeds this projection and publishTask updates it synchronously on every
    // committed change. Session lifecycle fan-out must not hydrate all retained items
    // while other asynchronous OS probes are waiting to deliver their answers.
    const items = new Map<string, DefaultItem>([...this.#itemSnapshots.values()].filter(item => item.state !== 'closed').map(item => [item.id, item]));
    const removed = includeItem && this.#defaultItems.get(`T-${idNumber(includeItem)}`);
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

  #sameItem(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    if (!Number.isSafeInteger(idNumber(a)) || idNumber(a) !== idNumber(b)) return false;
    const resolved = this.#items?.resolveId?.(a);
    return resolved ? resolved === this.#items?.resolveId?.(b) : normalizeId(a) !== null && normalizeId(a) === normalizeId(b);
  }

  #eventMatches(s: OwnedSubscription, subject: SubscriptionSubject, context: EventContext): boolean {
    if (JSON.stringify(s.subject) === JSON.stringify(subject)) return true;
    if ('role' in s.subject) return s.subject.role === context.role;
    const item = 'item' in subject ? subject.item : context.item;
    if ('item' in s.subject) return this.#sameItem(item, s.subject.item);
    if ('subtree' in s.subject && item) {
      const subtree = s.subject.subtree;
      return this.#sameItem(item, subtree) || ((context.ancestry ?? this.#items?.ancestry?.(item))?.some(id => this.#sameItem(id, subtree)) ?? false);
    }
    return false;
  }

  /** Snapshot the matching owners before publication; no await, so a stop cannot split fan-out. */
  publishEvent(subject: SubscriptionSubject, event: SubscriptionEvent, text: string, context: EventContext = {}, selected?: OwnedSubscription[]): void {
    const session = 'session' in subject ? subject.session : null;
    const facts = { ...(session ? { role: this.#store.roleOf(session), item: this.#processItems.get(this.#store.sessionIdOf(session) ?? '') ?? null } : {}), ...context };
    this.#afterCommit(() => this.#log({ event: 'event-announced', kind: event, subject, text: text.replace(/[\r\n\u2028\u2029]+/g, ' '), ...facts }));
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
    if (session && (facts.lifecycle === 'long idle' || facts.lifecycle === 'died' || facts.lifecycle === 'stopped' || facts.lifecycle === 'moved')) {
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
        const coalesced = digest === 'turn' && this.#store.coalesceEvent(name, subject, key, now, defaultRecipients.has(name), this.#eventWindowMs);
        if (coalesced) {
          this.#afterCommit(() => this.#log({ event: 'event-delivery', id: coalesced.id, subject, kind: event, to: [name], count: coalesced.count, coalesced: true }));
          continue;
        }
        groups.set(digest, [...(groups.get(digest) ?? []), name]);
      }
      // All modes and recipient counts join the same commit before any observer can bind a digest.
      for (const [digest, to] of groups) {
        const message = this.#recordNotice(AGENTS.id, { kind: 'event', to, text: body, detail: { event, subject, key, digest, count: 1, ...(context.verdict ? { verdict: context.verdict.verdict, result: context.verdict.result, run: context.verdict.run } : {}), ...(context.lifecycle ? { lifecycle: context.lifecycle } : {}), ...(context.severity ? { severity: context.severity } : {}), ...(context.final ? { final: true } : {}) } }, defaultRecipients);
        if (!message) continue;
        this.#afterCommit(() => this.#emitMessage(message));
        for (const name of to) this.#afterCommit(() => { this.#send(message, name); });
        this.#afterCommit(() => this.#log({ event: 'event-delivery', id: message.id, subject, kind: event, to, count: 1, digest }));
      }
    });
  }

  async #publishAccount(name: string, harness: string): Promise<void> {
    const registry = await readAccounts(this.#env);
    const account = registry.accounts.find(a => a.name === name) ?? { name, harness, path: null, variable: harness === 'codex' ? 'CODEX_HOME' : harness === 'opencode' ? 'XDG_DATA_HOME' : 'CLAUDE_CONFIG_DIR' };
    if (!this.#closed) this.#emit({ type: 'account', account: this.accountLimits.view(account) });
  }

  #scheduleLimits(): void {
    this.clock.clearTimeout(this.#limitTimer);
    if (this.#closed) return;
    const resets = this.accountLimits.marks().flatMap(([, m]) => m.resetsAt ? [Date.parse(m.resetsAt)] : []);
    if (!resets.length) return;
    this.#limitTimer = this.clock.setTimeout(() => {
      for (const [name, mark] of this.accountLimits.marks()) if (mark.resetsAt && Date.parse(mark.resetsAt) <= this.#now().getTime()) this.clearAccountLimit(name, 'reset');
      this.#scheduleLimits();
    }, Math.min(2 ** 31 - 1, Math.max(0, Math.min(...resets) - this.#now().getTime())));
    this.#limitTimer.unref();
  }

  checkAccountLimit(name: string): void {
    const mark = this.accountLimits.limited(name);
    if (mark?.resetsAt && Date.parse(mark.resetsAt) <= this.#now().getTime()) this.clearAccountLimit(name, 'reset');
    else if (mark) throw new AccountLimited(name, mark.resetsAt);
  }

  clearAccountLimit(name: string, by: 'hand' | 'reset'): boolean {
    const mark = this.accountLimits.limited(name);
    if (!mark || !this.accountLimits.clear(name)) return false;
    this.#log({ event: 'account-limit-lifted', account: name, by });
    void this.#publishAccount(name, name.startsWith('default:') ? name.slice(8) : '').catch(() => {});
    this.#scheduleLimits();
    return true;
  }

  limitAccount(name: string, harness: string, session: string, hit: { reason: string; resetsAt?: string }): void {
    const held = this.accountLimits.limited(name);
    if (held?.resetsAt && Date.parse(held.resetsAt) <= this.#now().getTime()) this.clearAccountLimit(name, 'reset');
    if (this.accountLimits.limited(name)) return;
    const reset = hit.resetsAt && Date.parse(hit.resetsAt) > this.#now().getTime() ? new Date(hit.resetsAt).toISOString() : null;
    const windows = this.accountLimits.view({ name, harness, path: null, variable: '' }).windows;
    const mark = { since: this.#now().toISOString(), reason: hit.reason, session, resetsAt: harness === 'opencode' ? null : fullWindowReset(windows, this.clock) ?? reset };
    this.accountLimits.mark(name, mark);
    this.#log({ event: 'account-limited', account: name, ...mark });
    void this.#publishAccount(name, harness).catch(() => {});
    this.#scheduleLimits();
    void this.#accountPoller?.poll(name).catch(() => {});
  }

  async publishAccountLimits(reading: AccountReading): Promise<void> {
    const changed = this.accountLimits.update(reading);
    const mark = this.accountLimits.limited(reading.account);
    const reset = fullWindowReset(this.accountLimits.view({ name: reading.account, harness: reading.harness, path: null, variable: '' }).windows, this.clock);
    const resetChanged = !!mark && !!reset && reset !== mark.resetsAt;
    if (resetChanged) {
      this.accountLimits.mark(reading.account, { ...mark!, resetsAt: reset });
      this.#scheduleLimits();
    }
    if (changed) this.#log({ event: 'account-limits', ...reading });
    if (changed || resetChanged) await this.#publishAccount(reading.account, reading.harness);
  }

  publishUsage(session: string, sessionId: string, usage: SessionUsage): void {
    if (this.#processFacts.get(sessionId)?.status !== 'running') return;
    this.#recordUsage(session, sessionId, usage, false);
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

  /** Compare only published totals and limits; never read the tracker or journal. */
  #recordUsage(session: string, sessionId: string, reported: SessionUsage | undefined, final: boolean): void {
    const previous = this.#usageRecords.get(sessionId);
    if (previous?.final) return;
    const usage = reported ? { ...(reported.total ? { total: reported.total } : {}), ...(reported.rateLimits ? { rateLimits: reported.rateLimits } : {}), ...(reported.rateLimitsByLimitId ? { rateLimitsByLimitId: reported.rateLimitsByLimitId } : {}) } : previous?.usage;
    if (!usage || (!usage.total && !usage.rateLimits && !usage.rateLimitsByLimitId)) return;
    if (!final && isDeepStrictEqual(previous?.usage, usage)) return;
    const snapshot = structuredClone(usage);
    const facts = this.#processFacts.get(sessionId);
    this.#usageRecords.set(sessionId, { usage: snapshot, final });
    this.#log({ event: 'session-usage', session, sessionId, role: this.#store.roleOf(session), item: this.#processItems.get(sessionId) ?? null,
      harness: facts?.harness ?? null, account: facts?.account ?? null, model: reported?.model ?? facts?.model ?? null, ...snapshot, final });
  }

  /** Work changes rebuild presence once, after the current burst of deliveries/holds. */
  #schedulePresence(): void {
    if (this.#closed || this.#presenceImmediate) return;
    this.#presenceImmediate = setImmediate(() => {
      this.#presenceImmediate = null;
      this.#publishPresence();
    });
  }

  #publishPresence(): void {
    if (this.#closed) return;
    if (this.#presenceImmediate) clearImmediate(this.#presenceImmediate);
    this.#presenceImmediate = null;
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
    if (this.roleNames().includes(name)) return `name "${name}" is reserved for a role`;
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
    item = this.#items?.resolveId?.(item) ?? item;
    const found = this.#items?.lead(item);
    if (!found) throw new Error(`no item ${item}: address coordinator instead`);
    // A closed item has no lead left to address: `lead T-n` falls through to the Coordinator (null),
    // rather than refusing the whole send and stranding a report from the item's own topic.
    if (found.state === 'closed') return null;
    // Reports from a node's own lead climb to the next lead. Other senders address
    // the nearest owner, including inherited ownership for unclaimed descendants.
    const nodes = this.#items?.get ? new Map((this.#items.ancestry?.(item) ?? [item]).flatMap(id => { const node = this.#items?.get?.(id); return node ? [[node.id, node] as const] : []; })) : this.#defaultItemSet();
    const owner = this.#nodeOwner(item, nodes, this.sessionIdentity(`name:${except}`));
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
      if (this.roleNames().includes(hello.role)) role = hello.role;
      else this.#log({ event: 'role-ignored', name, role: hello.role, roles: this.roleNames() });
    }
    // Only a validated new hello proves launch ownership. A join returned above;
    // refused names and roles likewise cannot enter a launch's rollback targets.
    launchIdentity?.prove();
    if (launchIdentity && hello.launchToken) this.#store.rememberSessionCredential(hello.sessionId, hello.launchToken);
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
    if (launched?.first && launched.role !== null && launched.role === held && this.roleNames().includes(launched.role)) {
      const taken = this.#exclusiveHolder(launched.role, name);
      if (taken) return { ok: false, message: refusal(launched.role, taken) };
      return { ok: true, role: launched.role, fresh: true, carried: launched.carried };
    }
    if (held !== null && this.roleNames().includes(held)) {
      const taken = this.#exclusiveHolder(held, name);
      if (taken) {
        // a stale holder: another session took the role while this one was forgotten
        this.#store.rememberRole(name, null);
        this.#log({ event: 'role-superseded', session: name, sessionId: hello.sessionId, role: held, holder: taken });
        this.#emitRole(name, null, held, `superseded: ${taken} holds it`);
        return { ok: false, message: `no role: "${name}" no longer holds the role ${ROLE_LABELS[held] ?? held}: ${taken} holds it now, and one session holds it at a time — assign another with \`cland role set ${name} <${this.roleNames().join('|')}>\`; the session connects on its next retry` };
      }
      if (hello.role !== undefined && hello.role !== held) this.#log({ event: 'role-request-ignored', name, requested: hello.role, holds: held });
      return { ok: true, role: held, fresh: false, carried: launched?.role === held && launched.carried };
    }
    if (launched !== null && !launched.first && launched.role !== null && this.roleNames().includes(launched.role)) {
      const taken = this.#exclusiveHolder(launched.role, name);
      if (taken) return { ok: false, message: refusal(launched.role, taken) };
      return { ok: true, role: launched.role, fresh: true, carried: false };
    }
    const asked = hello.role !== undefined ? ` (it asked for "${hello.role}", which the hub grants only to a session it launched for that role)` : '';
    return { ok: false, message: `no role: "${name}" holds none${asked} — assign one with \`cland role set ${name} <${this.roleNames().join('|')}>\`; the session connects on its next retry` };
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
    this.#drainVerifierRequests();
  }

  /** The spoke accepted a message: its delivery moves from queued to delivered. A stale connection acks nothing. */
  ack(connection: Connection, messageId: string): void {
    if (!this.isCurrent(connection)) return;
    let pendingChanged = false;
    const ids = this.#store.transaction(() => {
      if (!this.#store.markDelivered(messageId, connection.name, this.#now().getTime())) return null;
      const ids = this.#store.deliveryIds(messageId, connection.name);
      for (const id of ids) {
        const message = this.#store.message(id);
        if (message && this.#rememberVerification(connection, message)) pendingChanged = true;
      }
      return ids;
    });
    if (!ids) return;
    if (pendingChanged) this.#schedulePresence();
    for (const id of ids) {
      this.#log({ event: 'acked', id, session: connection.name });
      this.#emitStage(id);
    }
    this.#onDelivered?.(messageId, connection.name, connection.sessionId);
    this.#drainVerifierRequests();
  }

  artifactChanged(artifact: Artifact): void {
    this.#afterCommit(() => this.#publishArtifact(artifact));
  }

  #publishArtifact(artifact: Artifact): void {
    const previous = this.#artifactStates.get(artifact.id);
    this.#artifactStates.set(artifact.id, artifact.status);
    const context = { artifact: artifact.id, topic: artifact.topic, session: artifact.creator, item: this.#store.topic(artifact.topic)?.item ?? null, role: this.#store.roleOf(artifact.creator) };
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
    const message = this.#store.message(messageId);
    const topic = message?.topic;
    const stage = this.#store.stage(messageId);
    if (message && topic !== undefined && stage !== undefined && (stage !== 'queued' || message.fromKind === 'human')) this.#emit({ type: 'delivery', topic, message: messageId, stage, withdrawable: this.#withdrawalReason(message) === null });
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

  /** Sessions fences withdrawal against an adapter submission already in flight. */
  onWithdrawalCheck(check: ((messageId: string, sessions: string[]) => string | null) | null): void {
    this.#withdrawalRefusal = check;
  }

  withdrawHumanMessage(topicId: string, messageId: string): { text: string; message: TopicMessage } {
    this.#topicOrThrow(topicId);
    const message = this.#store.message(messageId);
    if (!message || message.topic !== topicId) throw new Error(`no message "${messageId}" in this topic`);
    const refusal = this.#withdrawalReason(message);
    if (refusal) throw new Error(refusal);
    this.#store.withdraw(messageId);
    const topic = this.#store.topic(topicId)!;
    if (topic.status === 'waiting for agent' && !this.#store.lastHumanAddressees(topicId).length) this.#move(topic, 'reply', 'human question withdrawn');
    this.#emitStage(messageId);
    this.#publishTopics();
    return { text: message.text, message: { ...message, topic: topicId, seq: this.#store.messageSeq(messageId), stage: 'withdrawn', withdrawable: false } };
  }

  #withdrawalReason(message: Message): string | null {
    if (message.fromKind !== 'human' || message.from !== HUMAN || message.answerTo) return 'only the human’s own ordinary messages can be withdrawn';
    const deliveries = this.#store.deliveriesOf(message.id);
    const settled = deliveries.find(d => d.state !== 'queued' && d.state !== 'delivered');
    if (settled) return `cannot withdraw: delivery to ${settled.session} is ${settled.state}`;
    const submitted = deliveries.find(d => d.injectionStarted);
    if (submitted) return `cannot withdraw: delivery to ${submitted.session} is ${submitted.state} (adapter submission started)`;
    if (!deliveries.length) return 'cannot withdraw: no queued deliveries';
    const refusal = this.#withdrawalRefusal?.(message.id, deliveries.map(d => d.session));
    return refusal ? `cannot withdraw: ${refusal}` : null;
  }

  /** Publish eligibility at the same durable boundary that fences withdrawal. */
  startInjection(messageId: string, session: string): void {
    this.#store.startInjection(messageId, session);
    for (const id of this.#store.deliveryIds(messageId, session)) {
      const message = this.#store.message(id);
      // Only ordinary human input can lose eligibility at this boundary.
      if (message?.fromKind === 'human' && !message.answerTo) this.#emitStage(id);
    }
  }

  /** A session's adapter confirmed the turn (spec 4.2, `injected`); false when the delivery was not `delivered`. */
  markInjected(messageId: string, session: string): boolean {
    if (!this.#store.markInjected(messageId, session)) return false;
    for (const id of this.#store.deliveryIds(messageId, session)) {
      this.#log({ event: 'injected', id, session });
      this.#emitStage(id);
    }
    this.#drainVerifierRequests();
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
    this.#drainVerifierRequests();
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
    if (changed) {
      const saved = this.#store.meta(`heartbeat-state:${sessionId}`);
      if (!saved || JSON.parse(saved).state !== state) this.#store.setMeta(`heartbeat-state:${sessionId}`, JSON.stringify({ state, since: this.#now().getTime() }));
    }
    if (command !== undefined) this.#approvalCommands.set(sessionId, command);
    else this.#approvalCommands.delete(sessionId);
    this.#log({ event: 'session-state', session: name, state, source });
    if (changed && state !== 'unknown') this.publishEvent({ session: name }, 'session.state', `${name} ${state}`, state === 'waiting for approval' ? { lifecycle: state } : {});
    this.#emit({ type: 'session.state', session: name, sessionId, state, source, ts: this.#now().toISOString(), ...(command !== undefined ? { approvalCommand: command } : {}) });
    this.#drainVerifierRequests();
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

  presence(processes: HarnessProcessView[] = []): Presence[] {
    // A merged-row read has already loaded work facts for its running processes.
    const loaded = new Map(processes.filter(p => p.status === 'running').map(p => [p.sessionId, p]));
    return [...this.#live.values()].map((c) => {
      const process = loaded.get(c.sessionId);
      const work = process?.name === c.name && process.role === c.role ? process : undefined;
      const pending = work ? work.pending : this.sessionPending(c);
      return {
        name: c.name,
        sessionId: c.sessionId,
        cwd: c.cwd,
        role: c.role,
        label: withRole(c.name, c.role),
        status: c.status,
        connectedAt: c.connectedAt,
        state: this.sessionState(c.sessionId),
        holds: work?.holds ?? this.sessionHolds(c),
        ...(pending ? { pending } : {}),
      };
    });
  }

  sessionHolds(session: Pick<Connection, 'name' | 'sessionId' | 'role'>): SessionHold[] {
    return this.#sessionHolds(sessionActor(session, UNKNOWN_SESSION).id);
  }

  sessionPending(session: Pick<Connection, 'name' | 'sessionId' | 'role'>): PendingVerification | undefined {
    const key = `pending-verification:${this.sessionIdentity(sessionActor(session, UNKNOWN_SESSION).id)}`;
    const stored = this.#store.meta(key);
    if (!stored) return undefined;
    const pending = JSON.parse(stored) as PendingVerification;
    if (this.#items && this.#items.lead(pending.item)?.state !== 'open') {
      this.#store.clearMeta(key);
      return undefined;
    }
    return { ...pending, item: this.#items?.resolveId?.(pending.item) ?? pending.item };
  }

  clearPendingVerification(name: string, item: string): void {
    const id = this.sessionIdentity(`name:${name}`), key = `pending-verification:${id}`;
    const stored = this.#store.meta(key);
    if (!stored || !this.#sameItem((JSON.parse(stored) as PendingVerification).item, item)) return;
    this.#store.clearMeta(key);
    this.#schedulePresence();
    this.#drainVerifierRequests();
  }

  /** Delivery acceptance captures only the delivered first line, never the message history. */
  #rememberVerification(connection: Pick<Connection, 'name' | 'sessionId' | 'role'>, message: Message): boolean {
    if (connection.role !== 'reviewer' && connection.role !== 'qa') return false;
    const request = verifierRequest(message.text);
    if (!request) return false;
    const item = this.#items?.resolveId?.(request.item) ?? null;
    if (!item || this.#items?.lead(item)?.state !== 'open') return false;
    const key = `pending-verification:${this.sessionIdentity(sessionActor(connection, UNKNOWN_SESSION).id)}`;
    const pending = this.sessionHolds(connection).some(h => h.item === item)
      ? null : JSON.stringify({ item, kind: request.kind });
    if (this.#store.meta(key) === pending) return false;
    if (pending === null) this.#store.clearMeta(key);
    else this.#store.setMeta(key, pending);
    return true;
  }

  /** Tracker changes may alter work even when a session's role and state stay the same. */
  refreshPresence(): void { this.#schedulePresence(); this.#drainVerifierRequests(); }

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

  /** A service notice to the same named/role targets as a session report, including offline holders. */
  noticeTo(topicId: string, notice: TopicNotice): string | null {
    const { sessions, direct } = this.#resolveAddressees(notice.to ?? [], 'hub', 'offline-holders');
    const message = this.#recordNotice(topicId, { ...notice, to: [...sessions] }, direct);
    if (!message) return null;
    this.#afterCommit(() => this.#publishNotice(message));
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
      const delivered = this.#store.transaction(() => {
        if (!this.#store.markDelivered(message.id, name, this.#now().getTime())) return false;
        const pendingChanged = this.#rememberVerification({ name, sessionId, role: this.#store.roleOf(name) }, message);
        return { pendingChanged };
      });
      if (delivered) {
        if (delivered.pendingChanged) this.#schedulePresence();
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

  /** The keepalive: the session is still here. */
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
    this.#drainVerifierRequests();
    for (const session of this.#store.queuedSessions()) this.#dropExpired(session);
    const { gone, released } = this.#store.prune(this.#now().getTime(), this.#retentionMs);
    this.#logReleased(released);
    if (gone) {
      this.#log({ event: 'pruned', messages: gone });
      this.inbox.refresh();
    }
    return gone;
  }

  /** Count and byte bounded human pages; agent history keeps its existing contract. */
  sessionHistoryPage(session: string, limit = HISTORY_LIMIT, before?: number): import('../protocol.ts').SessionHistoryResult {
    const n = Math.min(limit, HISTORY_LIMIT);
    const all = this.#store.sessionMessages(session, n + 1, before);
    const messages: Array<Message & { seq: number }> = [];
    let bytes = 1024;
    for (const message of [...all].reverse()) {
      const size = Buffer.byteLength(JSON.stringify(message)) + 1;
      if (messages.length && (messages.length === n || bytes + size > 255 * 1024)) break;
      messages.unshift(message);
      bytes += size;
    }
    const more = all.length > messages.length;
    return { messages, more, ...(more ? { before: messages[0]!.seq } : {}) };
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

  /** Private shell migration runs on every accepted own spoke connection, including joins. */
  shellCredential(writer: ((sessionId: string, credential?: string) => Promise<void>) | null): void { this.#shellCredential = writer; }

  /** The dispatcher holds welcome until this owned asynchronous write is complete. */
  prepareShellCredential(sessionId: string, credential?: string): Promise<void> | null {
    return this.#shellCredential?.(sessionId, credential) ?? null;
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
      this.#store.rememberSessionCredential(sessionId, credential);
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
    if (!this.roleNames().includes(role)) throw new Error(`unknown role "${role}" (roles: ${this.roleNames().join(', ')})`);
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
    if (!this.roleNames().includes(role)) throw new Error(`unknown role "${role}" (roles: ${this.roleNames().join(', ')})`);
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
    if (!this.roleNames().includes(role)) throw new Error(`unknown role "${role}" (roles: ${this.roleNames().join(', ')})`);
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
    const previous = c ? c.role : this.#store.roleOf(name);
    if (previous === null) return;
    this.#vacate(name, reason);
    // A spoke can disconnect before its harness reports its exit. Announce the
    // actual role release here rather than treating every UI vacancy as a death.
    if (previous === COORDINATOR && reason === 'its harness exited') {
      this.noticeInTopic(GENERAL.id, {
        kind: 'coordinator-exited',
        text: `${name}'s harness exited at ${this.#now().toISOString()}; the Coordinator role was released. Resume it with \`cland session resume ${name} --relaunch\`, then use \`cland session attach ${name}\` for its re-attach command.`,
      });
    }
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
    if (!this.roleNames().includes(role)) throw new Error(`unknown role "${role}" (roles: ${this.roleNames().join(', ')})`);
    const refusal = nameRefusal(to, this.#reserved);
    if (refusal) throw new Error(refusal);
    const reserved = this.nameReservation(to, this.#live.get(to)?.sessionId);
    if (reserved) throw new Error(reserved);
    if (from === to) throw new Error(`${withRole(to, role)} already holds the role`);
    if (then !== null && (!this.roleNames().includes(then) || then === role || this.#roles?.get().get(then)?.exclusive)) throw new Error(`a handover may leave the previous holder an Implementer (then: "implementer"), not "${then}"`);
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
      roles: this.roleNames().map((role) => {
        const d = config?.get(role);
        const names = new Set([...[...this.#live.values()].filter((c) => c.role === role).map((c) => c.name), ...this.#store.sessionsWithRole(role, since).filter((n) => !this.#live.has(n))]);
        return {
          role,
          label: ROLE_LABELS[role] ?? role,
          exclusive: d?.exclusive ?? false,
          skills: d?.skills ?? [],
          launch: d?.launch ?? { harness: '', account: null, permissions: null, model: null, effort: null, approval: null, sandbox: null },
          ...(d?.warnings?.length ? { warnings: d.warnings } : {}),
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
    const definition = c.role !== null ? this.roleInstructions(c.role) : undefined;
    const clause: RoleClause = c.role !== null ? { role: c.role, clause: roleClauseSections(definition?.clause ?? '').base, skills: definition?.skills ?? [] } : { role: null, clause: '', skills: [] };
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
    if (c.role !== null) {
      const rules = projectRulesText(c.role, this.rules?.get() ?? [], definition);
      text += `\n\n${rules}`;
      clause.clause += `\n\n${rules}`;
    }
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
  #restoreCoordinatorVacancy(): void {
    const raw = this.#store.meta('coordinator-vacancy');
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<CoordinatorVacancy> | null;
        if (typeof saved?.last === 'string' && saved.last && typeof saved.since === 'number' && Number.isFinite(saved.since)
          && typeof saved.noticeId === 'string' && saved.noticeId && typeof saved.notified === 'boolean') {
          this.#watchCoordinatorVacancy(saved as CoordinatorVacancy);
          return;
        }
      } catch { /* Recover legacy or incomplete state from the remembered holder below. */ }
    }
    const last = this.#store.meta('coordinator-last-holder') ?? this.#store.sessionsWithRole(COORDINATOR)[0];
    if (last) this.#watchCoordinatorVacancy({ last, since: this.#now().getTime(), noticeId: randomUUID(), notified: false });
  }

  #watchCoordinatorVacancy(vacancy: CoordinatorVacancy): void {
    this.#store.setMeta('coordinator-vacancy', JSON.stringify(vacancy));
    if (vacancy.notified) return;
    this.#coordinatorVacancyTimer = this.clock.setTimeout(() => {
      this.#coordinatorVacancyTimer = undefined;
      if (this.#closed || this.coordinator() !== null) return;
      this.noticeInTopic(GENERAL.id, {
        id: vacancy.noticeId,
        kind: 'decision',
        text: `The Coordinator role has been vacant for ten minutes; its last holder was ${vacancy.last}. Resume with \`cland session resume ${vacancy.last} --relaunch\`, then restore the role with \`cland role set ${vacancy.last} coordinator\`.`,
      });
      // A stable notice id makes recovery between publication and this receipt idempotent.
      this.#store.setMeta('coordinator-vacancy', JSON.stringify({ ...vacancy, notified: true }));
    }, Math.max(1, vacancy.since + 10 * 60_000 - this.#now().getTime()));
    this.#coordinatorVacancyTimer.unref();
  }

  /** Announce live-holder transitions independently of restored vacancy monitoring. */
  #announceCoordinator(): void {
    if (this.#closed) return;
    const now = this.coordinator();
    if (now === this.#coordinator) return;
    const was = this.#coordinator;
    this.#coordinator = now;
    this.clock.clearTimeout(this.#coordinatorVacancyTimer);
    this.#coordinatorVacancyTimer = undefined;
    const ts = this.#now().toISOString();
    if (now === null) {
      this.#log({ event: 'coordinator-vacant', was });
      this.#emit({ type: 'role.vacant', role: COORDINATOR, ts });
      if (was) this.#watchCoordinatorVacancy({ last: was, since: this.#now().getTime(), noticeId: randomUUID(), notified: false });
    } else {
      this.#store.clearMeta('coordinator-vacancy');
      this.#store.setMeta('coordinator-last-holder', now);
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
    const resolve = (a: Artifact) => {
      const current = this.#store.resolveArtifact(a.id);
      if (!message.artifacts || current?.movedTo) return current ?? a;
      return current?.fileDeleted ? { ...a, fileDeleted: true } : a;
    };
    return { ...message, ...(message.artifact ? { artifact: resolve(message.artifact) } : {}),
      ...(message.artifacts ? { artifacts: message.artifacts.map(resolve) } : {}) };
  }

  #sendTo(c: Connection, message: Message): boolean {
    if (message.fromKind === 'human' && this.sessionState(c.sessionId) === 'busy') return false;
    if (message.detail?.event === 'heartbeat' && this.sessionState(c.sessionId) !== 'idle') return false;
    if (isHeldDelivery(message)) return false;
    if (message.kind !== 'role' && this.sessionState(c.sessionId) === 'idle') this.#store.bindTurnEvents(message.id, c.name);
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
    for (const role of this.roleNames()) {
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
  #resolveAddressees(tags: string[], except: string, vacant: 'offline-holders' | 'placeholder', verifier?: { item: ItemSummary; role: 'reviewer' | 'qa' }) {
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
      const lead = /^lead\s+((?:[A-Za-z]-)?[1-9]\d*)$/.exec(tag);
      if (/^lead\s/.test(tag) && (!lead || !(this.#items?.resolveId ? this.#items.resolveId(lead[1]!) : parseItemReference(lead[1]!)))) throw new Error(`invalid item lead address "${tag}": use @lead T-<n>, or address coordinator instead`);
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
          if (verifier && r.role === verifier.role) {
            const name = this.#requestVerifier(verifier.item, verifier.role, except);
            if (name) { tagOf.set(tag, [name]); sessions.add(name); direct.add(name); }
            else empty.push({ tag, reason: `role "${tag}" has no free live verifier for ${verifier.item.id}` });
            break;
          }
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

  /** Only a lead's item request narrows role addressing; ordinary role traffic still broadcasts. */
  #verifierRequest(from: string, role: string | null, text: string, topic: Topic): { item: ItemSummary; role: 'reviewer' | 'qa' } | undefined {
    const request = verifierRequest(text);
    if (!request || (topic.id !== AGENTS.id && !this.#sameItem(topic.item, request.item))) return;
    const items = this.#items?.get ? [] : this.#items?.list?.() ?? [];
    const item = this.#items?.get?.(request.item) ?? items.find(i => this.#sameItem(i.id, request.item) && i.state === 'open');
    if (!item || item.state !== 'open') return;
    const sender = this.sessionIdentity(`name:${from}`);
    const owns = (i: ItemSummary) => i.claim && this.sessionIdentity(i.claim.sessionId) === sender;
    const ancestor = role === 'lead' && (this.#items?.ancestry?.(item.id) ?? []).some(id => {
      const node = this.#items?.get?.(id) ?? items.find(i => i.id === id);
      return node && owns(node);
    });
    if (role !== COORDINATOR && !((role === 'implementer' || isCustomRole(role)) && owns(item)) && !ancestor) return;
    return { item, role: request.kind === 'review' ? 'reviewer' : 'qa' };
  }

  #requestVerifier(item: ItemSummary, role: 'reviewer' | 'qa', except: string): string | undefined {
    const live = [...this.#live.values()].filter(c => {
      if (c.role !== role || c.name === except) return false;
      // Affinity and pool handoffs cannot displace a received verification request either.
      const pending = this.sessionPending(c);
      return (!pending || this.#sameItem(pending.item, item.id))
        && this.sessionHolds(c).every(hold => this.#sameItem(hold.item, item.id));
    }).sort((a, b) => a.name.localeCompare(b.name));
    const held = item.holds.find(h => h.role === role);
    const verdict = this.#items?.lastVerifier?.(item.id, role);
    const prior = this.#store.meta(`verifier-request:T-${idNumber(item.id)}:${role}`);
    const request = prior ? JSON.parse(prior) as { sessionId: string; at: string } : undefined;
    const previous = held?.sessionId ?? (verdict && (!request || verdict.at > request.at)
      ? verdict.sessionId : request?.sessionId);
    const existing = previous && live.find(c => c.sessionId === this.sessionIdentity(previous));
    if (existing) return existing.name;
    // A launch can reserve an idle member before its brief is sent.
    const reserved = live.find(c => this.#sameItem(this.#store.meta(`pool-handoff:${c.sessionId}`), item.id));
    if (reserved) return reserved.name;
    return live.find(c => ['idle', 'unknown'].includes(this.sessionState(c.sessionId))
      && !this.sessionHolds(c).length && !this.sessionPending(c)
      && !this.#store.hasPendingWork(c.name, this.#processFacts.get(c.sessionId)?.status === 'running')
      && !this.#store.meta(`pool-handoff:${c.sessionId}`))?.name;
  }

  /** Durable role requests retry only at eligibility changes, never by asking the lead to resend. */
  #drainVerifierRequests(): void {
    if (this.#drainingVerifierRequests) return;
    this.#drainingVerifierRequests = true;
    try {
      for (const queued of this.#store.queuedVerifierRequests()) {
        const { message, role } = queued;
        const senderId = queued.senderId && this.sessionIdentity(queued.senderId);
        const from = senderId ? this.#store.nameOfSession(senderId) : null;
        const topic = this.#store.topic(message.topic!);
        const senderRole = from ? this.#store.roleOf(from) : null;
        const permission = decide(senderRole, senderRole === null ? undefined : this.roleDefinition(senderRole)?.permissions.tools ?? DEFAULT_PERMISSIONS[senderRole], { tool: 'send', to: [role], roleNames: this.roleNames() });
        const request = from && topic && this.#verifierRequest(from, senderRole, message.text, topic);
        const now = this.#now().getTime();
        let reason = now - queued.queuedAt > this.#queueTtlMs ? 'queue TTL expired; send a fresh request'
          : !permission.ok ? `${permission.reason}; restore send authority and send a fresh request`
          : !request ? `${queued.item} is closed, removed, or no longer led by the sender; send a fresh request from its current lead`
          : topic?.status === 'closed' ? 'request topic closed; send a fresh request in an open topic' : undefined;
        const name = !reason && request ? this.#requestVerifier(request.item, role, from!) : undefined;
        if (!reason && !name) continue;
        if (name) {
          const self = this.#identity(from!);
          const other = this.#identity(name);
          reason = this.#hygiene.muteRefusal(self, other, now, [from!, name]) ?? undefined;
          if (!reason && this.#hygiene.countPair(self, other, now) !== null) reason = this.#hygiene.muteRefusal(self, other, now, [from!, name]) ?? 'loop breaker refused delivery';
          if (reason) reason += '; send a fresh request after the mute is lifted';
        }
        this.#store.transaction(() => {
          if (reason) this.#store.dropVerifierRequest(message.id, role);
          else {
            const assigned = this.#store.assignVerifierRequest(message.id, role, name!);
            const selected = this.#live.get(name!)!;
            this.#store.setMeta(`verifier-request:T-${idNumber(queued.item)}:${role}`, JSON.stringify({ sessionId: selected.sessionId, at: this.#now().toISOString() }));
            this.#afterCommit(() => {
              this.#emitMessage(assigned);
              this.#send(assigned, name!);
            });
          }
          const notice = this.#recordNotice(message.topic!, {
            kind: 'verifier-request', to: from ? [from] : [],
            text: reason ? `Queued ${role} request for ${queued.item} refused: ${reason}` : `Queued ${role} request for ${queued.item} assigned to ${name}`,
            detail: { request: message.id, item: queued.item, role, outcome: reason ? 'refused' : 'delivered', ...(name && !reason ? { resolvedTo: name } : {}), ...(reason ? { reason } : {}) },
          }, new Set(from ? [from] : []));
          this.#afterCommit(() => {
            this.#emitStage(message.id);
            if (notice) this.#publishNotice(notice);
            this.#publishTopics();
            this.#log({ event: 'verifier-request-settled', id: message.id, item: queued.item, role, ...(reason ? { reason } : { session: name }) });
          });
        });
      }
    } finally { this.#drainingVerifierRequests = false; }
  }

  // ---------------------------------------------------------------- topics

  topics(): Topic[] {
    return this.#store.topics().map(topic => {
      const asks = this.asks.waitingFor(topic.id);
      const waitingFor = asks.length ? asks : topic.status === 'waiting for agent' ? this.#store.lastHumanAddressees(topic.id) : [];
      return waitingFor.length ? { ...topic, waitingFor } : topic;
    });
  }

  #messageTopic(id: string): (TopicRef & Pick<Topic, 'unread' | 'lastMessageAt'>) | null {
    const topic = this.#store.topic(id);
    return topic ? { id: topic.id, title: topic.title, ...(topic.item !== null ? { item: topic.item } : {}), unread: topic.unread, lastMessageAt: topic.lastMessageAt } : null;
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
    this.#refreshExplorerContext();
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

  /** One human identity owns the project; browser cookies and Unix clients share its marks. */
  humanMarks(): import('../protocol.ts').HumanMarks {
    const value = this.#store.meta('human-marks');
    return value ? JSON.parse(value) : { events: null, plans: {}, imported: false };
  }

  setHumanMarks(frame: Extract<import('../protocol.ts').ClientRequest, { type: 'marks.set' }>, history: (id: string) => readonly { id: string }[]): import('../protocol.ts').HumanMarks {
    const before = this.humanMarks();
    const marks = mergeHumanMarks(before, frame, history);
    if (!isDeepStrictEqual(before, marks)) {
      this.#store.setMeta('human-marks', JSON.stringify(marks));
      this.#emit({ type: 'marks', marks });
    }
    return marks;
  }

  /** The human read a topic up to a message (else its latest): its unread count drops, subscribers hear it. */
  readTopic(id: string, upTo?: string): Topic {
    this.#topicOrThrow(id);
    this.#store.markTopicRead(id, upTo);
    this.#publishTopics(new Set([id]));
    return this.#topicOrThrow(id);
  }

  /** The decline and its queued notice commit together, including an offline sender. */
  declineInboxRequest(id: string): ReturnType<InboxBoard['list']> {
    return this.#store.transaction(() => {
      const inbox = this.inbox.decline(id);
      const message = this.#store.message(id)!;
      const senderId = this.#store.senderSessionId(id);
      const sender = senderId !== null && senderId !== UNKNOWN_SESSION ? this.#store.nameOfSession(senderId) : null;
      this.noticeTo(message.topic!, { kind: 'request-declined', to: [sender ?? message.from],
        text: `The human declined request ${id} (${message.request} ${message.subject}): ${message.text.split(/\r?\n/, 1)[0]}`,
        detail: { request: id, subject: message.subject } });
      return inbox;
    });
  }

  readInboxMessage(id: string): ReturnType<InboxBoard['list']> {
    const inbox = this.inbox.read(id);
    this.#publishTopics(new Set([this.#store.message(id)!.topic!]));
    return inbox;
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
        if (topic.item !== null && !this.#sameItem(topic.item, item)) throw new TopicRefusal(`${topic.id} is already bound to ${topic.item}; one item per topic`);
        const existing = item === null ? null : this.#store.topicOfItem(item);
        if (existing && existing.id !== topic.id) throw new TopicRefusal(`${item} already has a topic: "${existing.title}" (${existing.id}); one topic per unit of work: write there`);
      },
      answers: topic => this.#store.askAnswers(topic),
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

  topicHistory(id: string, limit?: number, filter: TopicHistoryFilter = {}): { topic: Topic; messages: TopicMessage[] } {
    const topic = this.#topicOrThrow(id);
    if (filter.before !== undefined && filter.after !== undefined) throw new Error('history takes before or after, not both');
    for (const cursor of [filter.before, filter.after]) {
      if (cursor !== undefined && typeof cursor !== 'string' && (!Number.isSafeInteger(cursor) || cursor < 0)) throw new Error('history cursor must be a non-negative safe integer');
    }
    const n = Math.min(Math.max(1, Math.floor(limit ?? HISTORY_LIMIT)), TOPIC_HISTORY_LIMIT);
    if (id !== AGENTS.id && (filter.item !== undefined || filter.session !== undefined)) throw new Error('item and session history filters require the Agents topic');
    return { topic, messages: this.#store.topicMessages(id, n, filter).map(message => this.#resolveAttachments({ ...message, withdrawable: this.#withdrawalReason(message) === null })) };
  }

  /** Byte-bounded client pages; agent/internal history retains its existing count contract. */
  topicHistoryPage(id: string, limit?: number, filter: TopicHistoryFilter = {}): { topic: Topic; messages: TopicMessage[]; runs: ThreadRun[]; more?: boolean; before?: string; after?: number } {
    const { topic, messages: raw } = this.topicHistory(id, limit, filter);
    const { messages: all, runs } = this.#store.threadRuns(id, raw, this.#now().getTime());
    const n = Math.min(Math.max(1, Math.floor(limit ?? HISTORY_LIMIT)), TOPIC_HISTORY_LIMIT);
    // Leave envelope/cursor room below the 256 kB wire cap. Messages stay whole;
    // an individually oversized message is the explicit one-message exception.
    let bytes = Buffer.byteLength(JSON.stringify(topic)) + 1024;
    const runById = new Map(runs.map(run => [run.id, run]));
    const included = new Set<string>();
    let count = 0;
    const ordered = filter.after !== undefined ? all : [...all].reverse();
    for (const message of ordered) {
      const run = message.runId && !included.has(message.runId) ? runById.get(message.runId) : undefined;
      const size = Buffer.byteLength(JSON.stringify(message)) + 1 + (run ? Buffer.byteLength(JSON.stringify(run)) + 1 : 0);
      if (count && bytes + size > 255 * 1024) break;
      bytes += size;
      if (run) included.add(run.id);
      count++;
    }
    const messages = filter.after !== undefined ? all.slice(0, count) : all.slice(all.length - count);
    const more = count < all.length || all.length === n;
    const runIds = new Set(messages.map(message => message.runId));
    return { topic, messages, runs: runs.filter(run => runIds.has(run.id)), ...(more ? { more: true, before: messages[0]!.id, after: messages.at(-1)!.seq } : {}) };
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
   * they reach. Only a Question starts a wait for its addressee; every kind marks the topic read.
   */
  sendFromHuman(topicId: string, text: string, to?: string[], replyTo?: string, answerTo?: string, artifact?: Artifact, artifacts?: Artifact[], messageId?: string, attribution?: AnswerAttribution, kind: HumanMessageKind = 'message', via?: RemoteVia): { message: TopicMessage; outcomes: SendOutcome[] } {
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
    } else if (replyTo !== undefined && to === undefined) {
      const original = this.#store.message(replyTo);
      if (original?.fromKind === 'agent') {
        const senderId = this.#store.senderSessionId(original.id);
        const sender = senderId !== null && senderId !== UNKNOWN_SESSION ? this.#store.nameOfSession(senderId) : null;
        to = [sender ?? original.from];
      }
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
      const found = mentions(text, (name) => known.has(name), this.roleNames());
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
      kind,
      via: via ?? 'hub',
      to: [...sessions, ...placeholders],
      text,
      ts: this.#now().toISOString(),
      ...(replyTo !== undefined ? { replyTo } : {}),
      topic: topic.id,
      ...(answerTo !== undefined ? { answerTo, ...attribution } : {}),
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
    // An outer native-answer transaction owns both the effect and replay receipt.
    // Publish and deliver only after it commits; rollback must remain invisible.
    this.#afterCommit(() => {
      // a person wrote to these sessions: their pairs count afresh (the loop breaker mutes a pair with no human between)
      for (const n of sessions) this.#hygiene.humanTouched(this.#identity(n));
      for (const a of message.artifacts ?? []) this.artifactChanged(this.#store.artifact(a.id)!);
      this.#emitMessage(message);
      this.#move(topic, kind === 'question' ? 'human' : 'human-message', `a human ${kind}`);
      this.#publishTopics();
      const states = new Map<string, boolean>();
      for (const n of sessions) states.set(n, this.#send(message, n));
      for (const [tag, names] of tagOf) {
        const offline = names.filter((n) => !states.get(n));
        const waiting = offline.every(n => this.#live.has(n)) ? 'busy' : offline.some(n => this.#live.has(n)) ? 'offline or busy' : 'offline';
        outcomes.push(offline.length ? { to: tag, outcome: 'queued', reason: `${offline.join(', ')} ${waiting} — queued` } : { to: tag, outcome: 'delivered' });
      }
      for (const role of placeholders) outcomes.push({ to: role, outcome: 'queued', reason: `no session holding the role "${role}" is connected — queued until one takes it` });
      this.#log({ event: 'human-send', id: message.id, topic: topic.id, to: message.to, bytes: Buffer.byteLength(text, 'utf8'), ...(replyTo !== undefined ? { replyTo } : {}), ...(answerTo !== undefined ? { answerTo, ...attribution } : {}), outcomes: outcomes.map((o) => `${o.to}:${o.outcome}`) });
    });
    const stage = this.#store.stage(message.id);
    return { message: { ...message, seq: this.#store.messageSeq(message.id), topic: topic.id, withdrawable: this.#withdrawalReason(message) === null, ...(stage ? { stage } : {}) }, outcomes };
  }

  /**
   * A session's `send`: addressees are session names, globs, `all`, or roles. With no addressee the
   * message goes into the topic for the human. The topic defaults to General for a message to the human
   * and to Agents for one between sessions (spec 4.5).
   */
  sendFromSession(from: string, to: string | string[], text: string, replyTo?: string, topicId?: string, artifact?: Artifact, actor?: { role: string | null }, artifacts?: Artifact[], kind: unknown = 'report', messageId?: string, requireAllRecipients = false, answerTo?: string, request?: unknown, subject?: unknown, attribution?: AnswerAttribution): { message: Message; outcomes: SendOutcome[]; topic: TopicRef } {
    to = sendRecipients(to);
    if (!isSendKind(kind)) throw new Error('send kind must be progress, report, question, decision or request');
    if (kind !== 'request' && (request !== undefined || subject !== undefined)) throw new Error('request and subject require kind: request; remove them from this send');
    if (kind === 'request') {
      if (to.length) throw new Error('a request is for the human: omit to or use an empty to');
      if (typeof request !== 'string' || !['review', 'qa', 'handover'].includes(request)) throw new Error('set request to review, qa or handover');
      if (typeof subject !== 'string' || !subject.trim()) throw new Error('a request needs subject: name a known item (T-n), artifact (A-n) or session');
      const itemSubject = this.#items?.resolveId?.(subject);
      const known = itemSubject ? true : parseItemReference(subject) ? false
        : /^A-[1-9]\d*$/.test(subject) ? this.#store.artifact(subject) !== null
        : this.#store.knownSessions().some(s => s.name === subject);
      if (itemSubject) subject = itemSubject;
      if (!known) throw new Error(`unknown subject "${subject}": name a known item (T-n), artifact (A-n) or session`);
    }
    const sender = actor ?? this.#live.get(from);
    if (!sender) throw new Error(`unknown sender ${from}`);
    this.#drainVerifierRequests();
    const toHuman = to.length === 0;
    const topic = this.#topicOrThrow(topicId ?? (toHuman ? GENERAL.id : AGENTS.id));
    const topicRef: TopicRef = { id: topic.id, title: topic.title };
    const nowMs = this.#now().getTime();
    const size = this.#hygiene.sizeRefusal(text);
    if (size) throw new HygieneError(size, { code: 'hygiene', rule: 'size' });
    const self = this.#identity(from);
    const verifier = kind === 'request' ? undefined : this.#verifierRequest(from, sender.role, text, topic);
    if (requireAllRecipients) {
      const intended = this.#resolveAddressees(to, from, 'offline-holders', verifier);
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
    const { sessions, direct, unknown, empty, tagOf } = this.#resolveAddressees(to, from, 'offline-holders', verifier);
    const outcomes: SendOutcome[] = unknown.map((tag) => ({ to: tag, outcome: 'unknown', reason: `no session named "${tag}" is connected or known, and no role has that name` }));
    const waiting = empty.filter(({ tag }) => verifier && tag === verifier.role);
    for (const { tag, reason } of empty) outcomes.push(waiting.some(w => w.tag === tag)
      ? { to: tag, outcome: 'queued', reason: `waiting for the next free live verifier for ${verifier!.item.id}; the hub will deliver automatically (up to ${Math.round(this.#queueTtlMs / 3_600_000)} h)` }
      : { to: tag, outcome: 'empty', reason });
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
      ...(kind === 'request' ? { request: request as NonNullable<Message['request']>, subject: subject as string } : {}),
      via: 'session',
      to: [...sessions, ...waiting.map(w => w.tag)],
      text,
      ts: this.#now().toISOString(),
      ...(sender.role !== null ? { fromRole: sender.role } : {}),
      ...(replyTo !== undefined ? { replyTo } : {}),
      ...(answerTo !== undefined ? { answerTo, ...attribution } : {}),
      topic: topic.id,
      ...(artifact ? { artifact } : {}),
      ...messageArtifacts(artifacts, a => (actor?.role ?? this.#store.roleOf(from)) === 'aide' || !this.#store.humanArtifact(a)),
    };
    // recorded before it is sent: an ack can never arrive for a delivery the store does not know
    if (sessions.size > 0 || waiting.length || toHuman) {
      // who the human's latest message here waited for, read before this one is recorded
      const awaited = toHuman ? [] : this.#store.lastHumanAddressees(topic.id);
      this.#store.transaction(() => {
        this.#record(message, [...[...sessions].map((session) => ({ session, state: 'queued' as const, direct: direct.has(session) })),
          ...waiting.map(({ tag }) => ({ session: `@verifier:${tag}`, state: 'queued' as const }))], nowMs);
        for (const { tag } of waiting) this.#store.queueVerifierRequest(message.id, verifier!.item.id, tag as 'reviewer' | 'qa');
        if (verifier) {
          const selected = [...sessions].filter(name => this.#live.get(name)?.role === verifier.role);
          if (selected.length === 1) this.#store.setMeta(`verifier-request:T-${idNumber(verifier.item.id)}:${verifier.role}`, JSON.stringify({ sessionId: this.#live.get(selected[0]!)!.sessionId, at: message.ts }));
        }
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
        const addressees = message.to;
        const verdict = messageVerdict(message);
        this.noticeInTopic(AGENTS.id, {
          kind: 'agent-message',
          text: `${this.label(from)} → ${addressees.join(', ')} in "${topic.title}" (${topic.id}): message ${message.id}`,
          detail: { from, to: addressees, topic: topic.id, message: message.id, ...(verdict ? { result: verdict } : {}) },
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
    if (verifier) for (const outcome of outcomes) {
      const name = outcome.to === verifier.role ? tagOf.get(outcome.to)?.[0] : undefined;
      if (name) outcome.resolvedTo = name;
    }
    if (sessions.size === 0 && !waiting.length && !toHuman) {
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
