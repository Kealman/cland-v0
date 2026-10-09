// The hub's frame dispatcher: one conversation per connection, transport-agnostic. A transport hands it
// raw frames and a peer to answer through (send a frame, close); the WebSocket edge, the Unix socket edge
// and the stdio edge share it, so the protocol lives in one place.
//
// A conversation is a spoke (its hello carries a session id) or a client — the UI, the CLI — (its hello
// names the client). A transport that authenticated the peer already (the WebSocket's bearer header) says
// so; otherwise the hello must carry the project's secret.
//
// Every spoke tool call passes the permission table here (spec 4.4, `roles/permissions.ts`), by the role the hub
// holds for the session at call time: a refused call is answered with a typed `forbidden` result and a hub notice
// in the Agents topic. Every call, a spoke's or a client's (the human, unrestricted), is audited (`audit.ts`).
import { readFile, stat } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { AGENTS, COORDINATOR, GENERAL, UNKNOWN_SESSION, type Connection, type HubCore, type SpokeSocket } from './core.ts';
import { summarize, type AuditOutcome, type AuditRecord } from './audit.ts';
import { decide, KNOWN_TOOLS, ToolForbidden, type ToolCall } from '../roles/permissions.ts';
import { withRole } from '../names.ts';
import {
  PROTOCOL_VERSION,
  UPDATE_HINT,
  isAck,
  isClientHello,
  isClientRequest,
  isHello,
  isSpokeRequest,
  parseFrame,
  type HubFrame,
  type HubStatus,
  type Message,
  type RefusalCode,
  type RoleClause,
} from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { HygieneError } from './hygiene.ts';
import { answerTask, isTaskRequest, sessionActor, type TaskRequest } from '../tracker/requests.ts';
import { normalizeId, readsAsVerdict, verdictOfText } from '../tracker/item.ts';
import type { Actor, Tracker } from '../tracker/tracker.ts';
import { answerSession, isSessionRequest, SPOKE_SESSION_REQUESTS } from '../adapters/requests.ts';
import type { Sessions } from '../adapters/sessions.ts';
import { handOver, roleState, settleAllClaims, type HandoverContext } from '../roles/handover.ts';
import { NoteIncomplete } from '../roles/note.ts';
import { ArtifactLifecycle, type ArtifactFiles } from './artifact-lifecycle.ts';
import { ArtifactError, createArtifact } from './artifacts.ts';
import type { ArtifactCreate, ArtifactList, ArtifactPromote } from '../protocol.ts';
import { TaskMerges } from './merge.ts';
import { Releases } from './releases.ts';
import { PushError } from '../territory-push.ts';
import { ReleaseError } from '../release.ts';
import { MergeError } from '../merge.ts';
import { TaskWorktrees, type SessionCwd } from './worktrees.ts';
import { RequestGuard, type GuardOptions } from './budget.ts';

/** How a conversation answers: a frame to the peer, or the end of the connection. */
export type Peer = {
  send: (frame: HubFrame) => void;
  /** End the connection. `code` is a WebSocket close code; a transport without codes ignores it. */
  close: (code: number, reason: string) => void;
  /** Whether frames from the peer still count: false once the connection is closing. */
  isOpen: () => boolean;
};

/** What only the process running the hub can answer: its facts, and stopping it. */
export type Control = {
  status: () => Omit<HubStatus, 'sessions'>;
  stop: () => void;
};

export type Conversation = {
  /** One frame as it arrived on the wire. */
  receive: (raw: string) => void;
  /** The transport closed. */
  closed: () => void;
};

export type DispatcherOptions = {
  core: HubCore;
  secret: string;
  control?: Control;
  /** How long a fresh connection may stay silent before its hello, ms. */
  helloTimeoutMs?: number;
  log?: LogFn;
  /** The project's tracker, answering the `task.*` requests; absent on a hub with no project. */
  tracker?: Tracker;
  /** The request budget and the repeat guard's timings (tests). */
  guard?: Omit<GuardOptions, 'log'>;
  /** Artifact file read port; defaults to async filesystem I/O. */
  readArtifact?: (path: string) => Promise<Buffer>;
  artifactFiles?: ArtifactFiles;
};

/** Who the UI's and the CLI's calls are audited as. */
const HUMAN_SESSION = 'human';

/**
 * What a CLI call made as a session may send beside the permission table's tools: reading the hub's state. Any
 * other frame is the human's alone.
 */
const SESSION_CLI_FRAMES: ReadonlySet<string> = new Set(['artifact.list', 'hub.status', 'inbox.list', 'role.list', 'worktree.list']);

/** Who a call is checked and audited as: a spoke's session, or the session a CLI call acts as. */
type Caller = Pick<Connection, 'name' | 'sessionId' | 'role'>;

export const secretMatches = (given: string, secret: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

export class Dispatcher {
  readonly #options: DispatcherOptions;
  readonly #log: LogFn;
  /** The adapters' side of the hub (`session.*`); set by the daemon once the hub runs. */
  #sessions: Sessions | undefined;
  /** The task worktrees (T-58): made at a task's claim and by a launch with an item; a hub with a tracker only. */
  readonly #worktrees: TaskWorktrees | null;
  readonly #merges: TaskMerges | null;
  readonly #releases: Releases | null;
  /** Every frame's handling timed against the budget; reads repeated too fast answered from their last answer. */
  readonly #guard: RequestGuard;
  #artifactQueue: Promise<unknown> = Promise.resolve();
  readonly artifacts: ArtifactLifecycle;

  constructor(options: DispatcherOptions) {
    this.#options = options;
    this.#log = options.log ?? (() => {});
    this.#worktrees = options.tracker ? new TaskWorktrees({ tracker: options.tracker, log: this.#log, sessions: () => this.#sessionCwds() }) : null;
    this.#merges = options.tracker && this.#worktrees ? new TaskMerges(options.tracker, this.#worktrees, this.#log) : null;
    this.#releases = options.tracker && this.#worktrees ? new Releases(options.tracker, this.#worktrees, this.#log, options.core.store) : null;
    this.artifacts = new ArtifactLifecycle(options.core.store, options.control?.status().root, a => options.core.artifactChanged(a), options.artifactFiles);
    this.#guard = new RequestGuard({ ...options.guard, log: this.#log });
    // what a read shows changed: no earlier answer is replayed
    options.core.subscribe(() => this.#guard.changed());
    options.tracker?.onChange(() => this.#guard.changed());
    // a role moved to a name with no session yet: its claims follow at that session's hello; and what a hub that
    // died between a move's commit and its claims left pending is finished now
    options.core.onSessionHello((name, sessionId) => this.#settleClaims({ name, sessionId }));
    this.#settleClaims();
  }

  #settleClaims(hello?: { name: string; sessionId: string }): void {
    try {
      settleAllClaims(this.#handover(), hello);
    } catch (err) {
      this.#log({ event: 'claims-settle-failed', error: err instanceof Error ? err.message : String(err) });
    }
  }

  close(): void { this.#merges?.stop(); }

  useSessions(sessions: Sessions | undefined): void {
    this.#sessions = sessions;
    // the inbox's approvals are the launched sessions waiting for approval, with their attach commands (#33)
    this.#options.core.inbox.useProcesses(sessions ? () => sessions.list() : null);
  }

  /** Where the sessions stand: the connected spokes' cwds and the running launched harnesses'. */
  #sessionCwds(): SessionCwd[] {
    const out: SessionCwd[] = this.#options.core.presence().filter((p) => typeof p.cwd === 'string' && p.cwd !== '').map((p) => ({ name: p.name, cwd: p.cwd }));
    for (const p of this.#sessions?.list() ?? []) if (p.status === 'running') out.push({ name: p.name, cwd: p.cwd });
    return out;
  }

  /**
   * A task request's result, with what a claim of an open task made of its branch and worktree (decision D7): the
   * worktree, or the reason there is none; the claim stands either way. Its write after Git runs through `resumed`.
   */
  async #withWorktree(frame: TaskRequest, result: HubFrame, resumed: <T>(write: () => T) => T): Promise<HubFrame> {
    if (frame.type !== 'task.claim' || frame.release === true || result.type !== 'result' || !result.ok || !this.#worktrees) return result;
    const value = result.value as { id: string; claim: { session: string } | null };
    return { ...result, value: { ...value, ...(await this.#worktrees.afterClaim(value.id, value.claim?.session ?? null, resumed)) } };
  }

  /** What a handover and `role.state` read beyond the core (#31): the tracker's claims, the launched sessions. */
  #handover(): HandoverContext {
    return {
      core: this.#options.core,
      tracker: this.#options.tracker,
      launched: (name) => this.#sessions?.list().find((p) => p.name === name && p.status === 'running') ?? null,
    };
  }

  /** The task worktrees, or the error a hub without a tracker answers `worktree.*` with. */
  #needWorktrees(): TaskWorktrees {
    if (!this.#worktrees) throw new Error('this hub has no tracker: it was started without a project (`cland hub start` serves one)');
    return this.#worktrees;
  }

  /** A failed request's result: a handover note without its four sections is typed (`note-incomplete`, `missing`). */
  static #failure(id: string, err: unknown): HubFrame {
    if (err instanceof PushError) return { type: 'result', id, ok: false, error: err.message, code: err.code };
    if (err instanceof ReleaseError) return { type: 'result', id, ok: false, error: err.message, code: err.code, ...(err.files ? { files: err.files } : {}) };
    if (err instanceof MergeError) return { type: 'result', id, ok: false, error: err.message, code: err.code, ...(err.files ? { files: err.files } : {}), ...(err.recovery ? { recovery: err.recovery } : {}) };
    if (err instanceof ArtifactError) return { type: 'result', id, ok: false, error: err.message, code: err.code };
    if (err instanceof NoteIncomplete) return { type: 'result', id, ok: false, error: err.message, code: 'note-incomplete', missing: err.missing };
    if (err instanceof ToolForbidden) return { type: 'result', id, ok: false, error: err.message, code: 'forbidden', permission: err.permission, role: err.role, reason: err.reason };
    // hygiene's typed refusal rides along (#34)
    return { type: 'result', id, ok: false, error: err instanceof Error ? err.message : String(err), ...(err instanceof HygieneError ? { refusal: err.refusal } : {}) };
  }

  get core(): HubCore {
    return this.#options.core;
  }

  /**
   * The permission table on one spoke frame (spec 4.4): true when it may go on. A refusal is answered here, with
   * the typed error, and posted to the Agents topic. A hub with no role definitions (no project) checks nothing;
   * a frame that is no tool the table knows goes on to its own "unknown request" answer.
   */
  #permitted(connection: Caller, frame: Record<string, unknown>, peer: Peer, answer = true): boolean {
    const core = this.#options.core;
    const roles = core.roles;
    if (!roles) return true;
    const call = this.#toolCall(connection, frame);
    if (!call) return true;
    const grants = connection.role === null ? undefined : roles.get().get(connection.role)?.permissions.tools;
    const decision = decide(connection.role, grants, call);
    if (decision.ok) return true;
    const target = call.tool === 'send' ? (call.toHuman ? ' to the human' : '') : typeof call.item === 'string' ? ` ${call.item}` : '';
    this.#refuse(connection, frame, peer, decision.permission, decision.reason, target, answer);
    return false;
  }

  /** Answer a frame with the typed `forbidden` error and post the refusal to the Agents topic. */
  #refuse(connection: Caller, frame: Record<string, unknown>, peer: Peer, permission: string, reason: string, target = '', answer = true): void {
    const core = this.#options.core;
    if (answer) peer.send({ type: 'result', id: String(frame.id), ok: false, error: `forbidden: ${permission} (${reason})`, code: 'forbidden', permission, role: connection.role, reason });
    try {
      core.noticeInTopic(AGENTS.id, { kind: 'refusal', text: `${withRole(connection.name, connection.role)} tried ${String(frame.type)}${target}: forbidden (${reason})`, detail: { session: connection.name, role: connection.role, tool: String(frame.type), permission } });
    } catch (err) {
      this.#log({ event: 'notice-failed', error: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Whether the human's latest message in the `send`'s topic (General by default, as for any message to the human)
   * was delivered to the caller, by its name or as a holder of its role (spec 4.5: the mention pulled it in).
   */
  #mentioned(connection: Caller, frame: Record<string, unknown>): boolean {
    const topic = typeof frame.topic === 'string' && frame.topic !== '' ? frame.topic : GENERAL.id;
    // by the session id each delivery was recorded for: another session that took the name later inherits nothing
    return this.#options.core.store
      .lastHumanDeliveries(topic)
      .some((d) => (d.sessionId !== null ? d.sessionId === connection.sessionId : d.session === connection.name) || (connection.role !== null && d.session === connection.role));
  }

  /**
   * The session a client's task frame acts as (`as`, the CLI's `--as` or `$CLAND_SESSION_NAME`), when it is one the
   * hub knows: by its session id (`as.sessionId`, `$CLAND_SESSION_ID`), else by a name a session holds or held. Its
   * role is the hub's, never the frame's. Null for the human, and for a name no session ever had (a CLI actor).
   * A session id decides before any name: a frame carrying one is that session's (an id the hub does not know is a
   * roleless session, refused what needs a role), whatever name it gives, the human's included. So does `as.shell`:
   * a name the calling shell gives as its own session is a session's even when the hub never heard of it.
   */
  #asSession(frame: Record<string, unknown>): Caller | null {
    const core = this.#options.core;
    if (!core.roles) return null;
    const as = frame.as as { name?: unknown; sessionId?: unknown; shell?: unknown } | undefined;
    if (!as || typeof as !== 'object' || typeof as.name !== 'string') return null;
    const sessionId = typeof as.sessionId === 'string' && as.sessionId !== '' ? as.sessionId : null;
    // the calling shell's own identity (`$CLAND_SESSION_*`), as against a name the human gave with `--as`
    const own = as.shell === true;
    if (sessionId === null && as.name === HUMAN_SESSION && !own) return null;
    if (sessionId !== null) {
      const live = core.connectionOf(sessionId);
      if (live) return { name: live.name, sessionId, role: live.role };
      const known = core.store.nameOfSession(sessionId);
      return { name: known ?? (as.name === HUMAN_SESSION ? sessionId : as.name), sessionId, role: known !== null ? core.store.roleOf(known) : null };
    }
    const present = core.presence().find((p) => p.name === as.name);
    if (present) return { name: present.name, sessionId: present.sessionId, role: present.role };
    const id = core.store.sessionIdOf(as.name);
    const role = core.store.roleOf(as.name);
    // a name no session ever had: the human's CLI actor, unless the shell says it is its own session — a stale or
    // made-up identity is a roleless session, never promoted to the human
    if (id === null && role === null && !own) return null;
    return { name: as.name, sessionId: id ?? UNKNOWN_SESSION, role };
  }

  /**
   * A comment whose text carries a verdict header is a verdict: its fields are taken from the header and its `by` is
   * the caller's (the tracker writes it from the actor), never the one the text claims. A text that would still read
   * as a verdict after its header is refused. Returns an error, or null.
   */
  static #verdictFromText(frame: Record<string, unknown>): string | null {
    if (frame.type !== 'task.comment' || frame.verdict !== undefined || typeof frame.text !== 'string' || !readsAsVerdict(frame.text)) return null;
    const v = verdictOfText(frame.text);
    if (!v) return null;
    if (readsAsVerdict(v.text)) return 'a verdict comment carries one verdict header: its text may not start with another';
    frame.verdict = { verdict: v.verdict, result: v.result, run: v.run, ...(v.commit ? { commit: v.commit } : {}) };
    frame.text = v.text;
    return null;
  }

  /** After a task write that set an assignee: the item is bound to the assignee's session id, when the hub knows it
   *  (a rename never moves an assignment; another session taking the name later does not own the item). */
  #bindAssignee(frame: Record<string, unknown>, result: HubFrame): void {
    if (result.type !== 'result' || !result.ok || (frame.type !== 'task.create' && frame.type !== 'task.edit') || !('assignee' in frame)) return;
    const item = (result.value as { item?: { id?: string } } | undefined)?.item?.id;
    if (typeof item !== 'string') return;
    const core = this.#options.core;
    const name = typeof frame.assignee === 'string' && frame.assignee.trim() !== '' ? frame.assignee.trim() : null;
    if (name === null) return core.store.bindAssignee(item, null, null);
    const id = core.presence().find((p) => p.name === name)?.sessionId ?? core.store.sessionIdOf(name);
    core.store.bindAssignee(item, name, id !== null && id !== UNKNOWN_SESSION ? id : null);
  }

  /** The table's view of a spoke frame, or null when it is no tool the table knows. */
  #toolCall(connection: Caller, frame: Record<string, unknown>): ToolCall | null {
    const type = String(frame.type);
    // listing the launched sessions goes with launching them
    const tool = type === 'session.list' ? 'session.launch' : type === 'artifact.list' ? 'history' : type;
    if (!KNOWN_TOOLS.includes(tool)) return null;
    const item = typeof frame.item === 'string' ? frame.item.trim() || null : null;
    const tracker = this.#options.tracker;
    const own = (): boolean | undefined => {
      if (!tracker || item === null) return false;
      // Ownership is an indexed permission fact; request authorization never reads an item file.
      const view = tracker.list().find(value => value.id === normalizeId(item));
      if (!view) return undefined; // no such item: the tool says so itself
      const actor = sessionActor(connection, UNKNOWN_SESSION);
      if (view.claim?.sessionId === actor.id) return true;
      if (view.assignee === null) return false;
      // the assignee as the hub bound it, by session id: a rename, or another session taking the name, moves nothing
      const store = this.#options.core.store;
      const bound = store.assigneeOf(view.id);
      if (bound && bound.name === view.assignee && bound.sessionId !== null) return bound.sessionId === actor.id;
      // an assignee the hub never bound to a session (a hand edit, an import, a name no session held yet): the first
      // session under that name to act on it is bound to it
      if (view.assignee !== connection.name) return false;
      store.bindAssignee(view.id, view.assignee, actor.id);
      return true;
    };
    return {
      tool,
      item,
      own,
      ...(tool === 'send' ? { toHuman: !Array.isArray(frame.to) || frame.to.length === 0, mentioned: () => this.#mentioned(connection, frame) } : {}),
      // a plain comment whose text reads back as a verdict header is a verdict to every reader, so it is one here too
      ...(tool === 'task.comment'
        ? {
            verdict: (typeof frame.verdict === 'object' && frame.verdict !== null) || (typeof frame.text === 'string' && readsAsVerdict(frame.text)),
            ...(typeof frame.verdict === 'object' && frame.verdict !== null && typeof (frame.verdict as { verdict?: unknown }).verdict === 'string' ? { verdictKind: (frame.verdict as { verdict: string }).verdict } : {}),
          }
        : {}),
    };
  }

  async #artifact(frame: ArtifactCreate | ArtifactList, callerNow: () => Caller | null, resumed: <T>(work: () => T) => T): Promise<unknown> {
    const caller = callerNow();
    const core = this.#options.core;
    if (frame.type === 'artifact.list') {
      if (frame.topic !== undefined && (typeof frame.topic !== 'string' || !core.store.topic(frame.topic))) throw new ArtifactError('artifact-topic', 'no such artifact topic');
      return { artifacts: core.store.artifacts(frame.topic) };
    }
    const authorize = () => {
      const caller = callerNow();
      const topic = typeof frame.topic === 'string' ? core.store.topic(frame.topic) : null;
      if (!topic) throw new ArtifactError('artifact-topic', 'no such artifact topic');
      if (caller !== null && caller.role !== 'coordinator') {
        const own = topic.item !== null && this.#toolCall(caller, { type: 'task.claim', item: topic.item })?.own?.() === true;
        if (topic.id === GENERAL.id || topic.id === AGENTS.id || !(own || core.store.addressedInTopic(caller.sessionId, topic.id))) {
          throw new ToolForbidden(caller.role, 'artifact.create', 'artifacts require your own item topic or a delivered request in this topic; General and Agents are the Coordinator’s');
        }
      }
      return topic;
    };
    const topic = authorize();
    const root = this.#options.control?.status().root;
    const name = caller?.name ?? 'human';
    const cwd = caller ? core.presence().find((p) => p.sessionId === caller.sessionId)?.cwd ?? root : root;
    const artifact = await createArtifact(core.store, root, frame, { name, cwd: cwd ?? '.' }, (a) => {
      if (a.status === 'draft') return;
      const text = `▣ ${a.id} ${a.kind} · ${a.title}`;
      const current = callerNow();
      if (current) core.sendFromSession(current.name, [], text, undefined, topic.id, a, current);
      else core.sendFromHuman(topic.id, text, undefined, undefined, undefined, a);
    }, resumed, authorize, this.#options.readArtifact ?? readFile);
    return resumed(() => {
      core.artifactChanged(artifact);
      return { artifact, id: artifact.id, path: artifact.path };
    });
  }

  open(wire: Peer, transport: { authenticated: boolean; edge: string }): Conversation {
    const core = this.#options.core;
    const log = this.#log;
    /** The calls in flight, by request id, waiting for their result to be audited. */
    const audits = new Map<string, Array<Omit<AuditRecord, 'ts' | 'event' | 'outcome'>>>();
    const settle = (frame: HubFrame) => {
      if (frame.type !== 'result') return;
      const queue = audits.get(frame.id);
      const base = queue?.shift();
      if (!base) return;
      if (!queue?.length) audits.delete(frame.id);
      const outcome: AuditOutcome = frame.ok ? 'ok' : frame.code === 'forbidden' ? 'forbidden' : 'error';
      log({
        event: 'audit',
        ...base,
        outcome,
        ...(!frame.ok && frame.code === 'forbidden' ? { permission: frame.permission, reason: frame.reason } : {}),
        ...(!frame.ok && outcome === 'error' ? { error: frame.error.slice(0, 200) } : {}),
      });
    };
    const audit = (id: unknown, base: Omit<AuditRecord, 'ts' | 'event' | 'outcome'>) => {
      if (typeof id !== 'string') return;
      const queue = audits.get(id) ?? [];
      queue.push(base);
      audits.set(id, queue);
    };
    const guard = this.#guard.conversation();
    // every result passes the audit on its way out, and a read's answer is kept for a repeat
    const peer: Peer = {
      send: (frame) => {
        settle(frame);
        wire.send(frame);
        guard.answered(frame);
      },
      close: (code, reason) => wire.close(code, reason),
      isOpen: () => wire.isOpen(),
    };
    let client = '';
    let kind: 'spoke' | 'client' | null = null;
    let done = false;
    let name: string | null = null;
    let spoke: SpokeSocket | null = null;
    let connection: Connection | null = null;
    /** A client's event subscription, ended when the connection closes. */
    let unsubscribe: (() => void) | null = null;
    /** What else ends with the connection (an in-session bridge). */
    const onClose: Array<() => void> = [];
    /** A result that comes later (Git work): its answer going out is timed against the budget as `answer`. */
    const later = (tool: string, result: Promise<HubFrame>): void =>
      void result.then((frame) =>
        this.#guard.measure(tool, kind === 'spoke' ? (name ?? '?') : client, () => {
          if (peer.isOpen()) peer.send(frame);
          else settle(frame);
        }, 'answer'),
      );
    const artifact = (frame: ArtifactCreate | ArtifactList, callerNow: () => Caller | null) => {
      const tool = frame.type;
      const who = kind === 'spoke' ? (name ?? '?') : client;
      const resumed = <T,>(work: () => T): T => this.#guard.measure(tool, who, work, 'resumed');
      const original = callerNow();
      const authorizeCaller = () => {
        const current = callerNow();
        if (original && (!current || current.sessionId !== original.sessionId)) throw new ToolForbidden(null, tool, 'the session is no longer current');
        if (current && !this.#permitted(current, frame as unknown as Record<string, unknown>, peer, false)) throw new ToolForbidden(current.role, tool, 'permission changed during artifact preparation');
        return current;
      };
      const run = () => this.#artifact(frame, authorizeCaller, resumed);
      const operation = frame.type === 'artifact.create' ? this.#artifactQueue.then(() => resumed(run)) : run();
      if (frame.type === 'artifact.create') this.#artifactQueue = operation.catch(() => resumed(() => {}));
      later(tool, operation.then(value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value } as HubFrame)), err => resumed(() => Dispatcher.#failure(frame.id, err))));
    };
    const attachedSend = (frame: Record<string, unknown>, callerNow: () => Caller | null) => {
      const tool = String(frame.type);
      const resumed = <T,>(work: () => T): T => this.#guard.measure(tool, kind === 'spoke' ? (name ?? '?') : client, work, 'resumed');
      const original = callerNow();
      const prompt = tool === 'prompt.send';
      const topicId = prompt ? core.store.artifact(String(frame.artifact))?.topic : (typeof frame.topic === 'string' ? frame.topic : (Array.isArray(frame.to) && frame.to.length ? AGENTS.id : GENERAL.id));
      const ids = prompt ? [frame.artifact] : frame.artifacts;
      const check = () => {
        const caller = callerNow();
        if (original && (!caller || caller.sessionId !== original.sessionId)) throw new ToolForbidden(null, 'send', 'the session is no longer current');
        if (caller && !this.#permitted(caller, { ...frame, type: 'send' }, peer, false)) throw new ToolForbidden(caller.role, 'send', 'permission changed during attachment preparation');
        if (!Array.isArray(ids) || !ids.length || !ids.every(id => typeof id === 'string')) throw new ArtifactError('artifact-source', 'artifacts must be a nonempty array of ids');
        const artifacts = ids.map(id => {
          const a = core.store.artifact(id);
          if (!a || a.status === 'archived' || a.topic !== topicId) throw new ArtifactError('artifact-unavailable', `artifact ${id} is unavailable in this topic`);
          if (prompt && (a.kind !== 'prompt' || a.status !== 'draft' || a.creator !== 'human')) throw new ArtifactError('artifact-unavailable', 'only a human prompt draft can be sent here');
          return a;
        });
        return { caller, artifacts };
      };
      const operation = async (): Promise<HubFrame> => {
        try {
          const prepared = check();
          // Reserve the intended ids/topic/caller before I/O; no post or status is changed yet.
          const contents = await Promise.all(prepared.artifacts.map(a => this.#options.readArtifact ? this.#options.readArtifact(a.path) : readFile(a.path)));
          const files = await resumed(() => {
            check();
            return Promise.all(prepared.artifacts.map(a => stat(a.path)));
          });
          return resumed(() => {
            if (!files.every(info => info.isFile())) throw new ArtifactError('artifact-unavailable', 'an attachment file is unavailable');
            // Re-read availability, topic, draft status and caller permissions after final file I/O, then post without yielding.
            const { caller, artifacts } = check();
            if (artifacts.some((a, i) => a.path !== prepared.artifacts[i]?.path)) throw new ArtifactError('artifact-unavailable', 'an attachment path changed during preparation');
            const saved = contents[0]!.toString('utf8');
            const text = prompt ? (frame.attach === true || !core.textFits(saved) ? core.boundedText(`Prompt ${artifacts[0]!.id}: ${artifacts[0]!.title}`) : saved) : frame.text;
            if (typeof text !== 'string') throw new ArtifactError('artifact-source', 'send needs text');
            const reply = typeof frame.replyTo === 'string' ? frame.replyTo : undefined;
            const to = Array.isArray(frame.to) ? frame.to as string[] : undefined;
            const value = caller ? core.sendFromSession(caller.name, to ?? [], text, reply, topicId, undefined, caller, artifacts)
              : core.sendFromHuman(topicId!, text, to, reply, undefined, undefined, artifacts);
            return { type: 'result', id: String(frame.id), ok: true, value };
          });
        } catch (err) { return resumed(() => Dispatcher.#failure(String(frame.id), err)); }
      };
      later(tool, operation());
    };
    // a task request's answer may wait for Git (a verdict's commit, a claim's worktree), never on the event loop; every
    // stretch it runs on the loop is timed against the budget: the first in `receive`, the writes after Git answered,
    // the answer going out
    const task = (frame: TaskRequest, actor: Actor | 'client', callerNow?: () => Caller | null) => {
      const tool = String(frame.type);
      const who = kind === 'spoke' ? (name ?? '?') : client;
      const resumed = <T,>(write: () => T): T => this.#guard.measure(tool, who, write, 'resumed');
      const currentActor = callerNow ? () => {
        const caller = callerNow();
        if (!caller) throw new ToolForbidden(null, 'task.comment', 'the writing session is no longer current');
        const call = this.#toolCall(caller, frame as unknown as Record<string, unknown>);
        const roles = core.roles;
        if (roles && call) {
          const grants = caller.role === null ? undefined : roles.get().get(caller.role)?.permissions.tools;
          const decision = decide(caller.role, grants, call);
          if (!decision.ok) {
            this.#refuse(caller, frame as unknown as Record<string, unknown>, peer, decision.permission, decision.reason, ` ${frame.type === 'task.comment' ? frame.item : ''}`, false);
            throw new ToolForbidden(caller.role, decision.permission, decision.reason);
          }
        }
        return sessionActor(caller, UNKNOWN_SESSION);
      } : undefined;
      void answerTask(this.#options.tracker, frame, actor, resumed, currentActor)
        .then((result) => {
          this.#bindAssignee(frame as unknown as Record<string, unknown>, result);
          return this.#withWorktree(frame, result, resumed);
        })
        // what fails after the answer is known (the assignee's binding) is that request's failure, never the hub's
        .catch((err: unknown) => Dispatcher.#failure(frame.id, err))
        .then((result) =>
          this.#guard.measure(tool, who, () => {
            if (peer.isOpen()) peer.send(result);
            else settle(result);
          }, 'answer'),
        );
    };
    const merge = (frame: import('../protocol.ts').MergeRequest, caller: Caller | null) => {
      if (caller !== null && frame.override !== undefined) return this.#refuse(caller, frame, peer, 'merge', 'only the human may override verdicts');
      if (frame.override !== undefined && !frame.override.trim()) return peer.send(Dispatcher.#failure(frame.id, new MergeError('merge-item', 'an override needs a reason')));
      if (!this.#merges) return peer.send(Dispatcher.#failure(frame.id, new MergeError('merge-item', 'this hub has no tracker')));
      const actor = caller ? sessionActor(caller, UNKNOWN_SESSION) : { id: 'human', name: 'human', role: null };
      const resumed = <T,>(write: () => T): T => this.#guard.measure('merge', kind === 'spoke' ? (name ?? '?') : client, write, 'resumed');
      later('merge', this.#merges.merge(frame.item, actor, resumed, frame.override).then(
        (value): HubFrame => ({ type: 'result', id: frame.id, ok: true, value }),
        (err: unknown) => Dispatcher.#failure(frame.id, err),
      ));
    };
    const promote = (frame: ArtifactPromote, caller: Caller | null) => {
      const resumed = <T,>(body: () => T): T => this.#guard.measure(frame.type, client, body, 'resumed');
      const authorize = () => {
        if (!caller) return;
        const now = this.#asSession(frame);
        const grants = core.roles?.get().get(now?.role ?? '')?.permissions.tools;
        const decision = decide(now?.role ?? null, grants, { tool: frame.type });
        if (client !== 'cli' || !now || now.role !== 'coordinator' || !decision.ok) throw new ToolForbidden(now?.role ?? null, frame.type, 'promotion belongs to the human or the Coordinator from its own shell');
      };
      later(frame.type, this.artifacts.promote(frame.artifact, frame.path, authorize, resumed).then(
        value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value }) as HubFrame),
        err => resumed(() => Dispatcher.#failure(frame.id, err)),
      ));
    };
    const session = (frame: Parameters<typeof answerSession>[1]) =>
      void answerSession(
        this.#sessions,
        frame,
        { send: (f) => peer.send(f), isOpen: () => peer.isOpen(), onClose: (fn) => onClose.push(fn) },
        this.#worktrees ?? undefined,
        (write) => this.#guard.measure(frame.type, kind === 'spoke' ? (name ?? '?') : client, write, 'resumed'),
      ).then((result) => {
        if (peer.isOpen()) peer.send(result);
        else settle(result);
      });

    const refuse = (code: RefusalCode, message: string) => {
      if (done) return;
      done = true;
      clearTimeout(helloTimer);
      peer.send({ type: 'error', code, message });
      peer.close(4000, code);
    };
    const helloTimer = setTimeout(() => {
      if (kind === null) refuse('bad-hello', 'no hello received');
    }, this.#options.helloTimeoutMs ?? 5000);

    const hello = (frame: Record<string, unknown>) => {
      clearTimeout(helloTimer);
      if (!transport.authenticated && !(typeof frame.secret === 'string' && secretMatches(frame.secret, this.#options.secret))) {
        log({ event: 'refused', edge: transport.edge, code: 'unauthorized' });
        return refuse('unauthorized', "the secret does not match this project's hub");
      }
      if (isHello(frame)) {
        const deliver = (message: Message): boolean => {
          if (!peer.isOpen()) return false;
          const topic = message.topic !== undefined ? core.topicRef(message.topic) : null;
          peer.send({ type: 'deliver', id: message.id, message, ...(topic ? { topic } : {}) });
          return true;
        };
        const deliverRole = (message: Message, clause: RoleClause): boolean => {
          if (!peer.isOpen()) return false;
          peer.send({ type: 'role', id: message.id, message, ...clause });
          return true;
        };
        const result = core.hello(frame, deliver, (reason, code) => peer.close(code ?? 4001, reason), deliverRole);
        if (!result.ok) {
          log({ event: 'refused', edge: transport.edge, code: result.code, requested: frame.name ?? null });
          return refuse(result.code, result.message);
        }
        kind = 'spoke';
        // presence moved: `who` and `hub.status` answer anew
        this.#guard.changed();
        name = result.name;
        connection = result.connection;
        spoke = result.spoke;
        peer.send({ type: 'welcome', name, presence: core.presence(), ...(connection.role !== null ? { role: connection.role } : {}) });
        core.flushQueued(name);
        return;
      }
      if (isClientHello(frame)) {
        if (frame.protocol !== PROTOCOL_VERSION) return refuse('version', `protocol ${frame.protocol} is not the hub's ${PROTOCOL_VERSION} — ${UPDATE_HINT}`);
        // the human's side comes over the Unix socket or stdio: the spokes' WebSocket never makes a client (with
        // the spokes' bearer secret, a session would otherwise act as the human, unrestricted by its role). A hub with
        // no human side (`createHub`, no `control`: the in-process hub of the tests) has no other way in for a client.
        if (transport.edge === 'websocket' && this.#options.control !== undefined) {
          log({ event: 'refused', edge: transport.edge, code: 'unauthorized', client: frame.client });
          return refuse('unauthorized', "a client connects over the hub's Unix socket or stdio, not the spokes' WebSocket");
        }
        kind = 'client';
        client = frame.client;
        log({ event: 'client', edge: transport.edge, client: frame.client });
        peer.send({ type: 'welcome', name: frame.client, presence: core.presence() });
        return;
      }
      refuse('bad-hello', 'first frame must be a hello');
    };

    const spokeRequest = (frame: Record<string, unknown>, me: string) => {
      if (!isSpokeRequest(frame)) {
        const id = typeof frame.id === 'string' ? frame.id : '?';
        peer.send({ type: 'result', id, ok: false, error: `unknown request type "${String(frame.type)}"` });
        return;
      }
      try {
        switch (frame.type) {
          case 'merge':
            return merge(frame, connection);
          case 'artifact.promote':
            throw new ToolForbidden(connection?.role ?? null, frame.type, 'promote from the Coordinator’s shell with cland artifact promote');
          case 'artifact.create':
          case 'artifact.list':
            return artifact(frame, () => connection && core.isCurrent(connection) ? connection : null);
          case 'who':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { me, sessions: core.presence() } });
            break;
          case 'history':
            // with a topic: that topic's messages (a new role holder reads the topics waiting for it, #31)
            peer.send({ type: 'result', id: frame.id, ok: true, value: { messages: frame.topic !== undefined ? core.topicHistory(frame.topic, frame.limit, frame).messages : core.history(me, frame.limit, frame.with) } });
            break;
          case 'role.handover': {
            const role = connection?.role ?? null;
            if (role === null) throw new Error('this session holds no role to hand over');
            const holder = handOver(this.#handover(), { role, from: me, to: frame.to, by: me, note: frame.note, noteRequired: true, then: frame.then ?? null, requireKnown: true });
            peer.send({ type: 'result', id: frame.id, ok: true, value: { session: holder } });
            break;
          }
          case 'role.state': {
            // a session reads the state of the role it holds: what it continues from
            const role = frame.role ?? connection?.role ?? null;
            if (role === null || role !== connection?.role) {
              const reason = role === null ? 'a session with no role has no role state' : 'a session reads only the state of the role it holds';
              peer.send({ type: 'result', id: frame.id, ok: false, error: `forbidden: role.state (${reason})`, code: 'forbidden', permission: 'role.state', role: connection?.role ?? null, reason });
              break;
            }
            peer.send({ type: 'result', id: frame.id, ok: true, value: roleState(this.#handover(), role) });
            break;
          }
          case 'status':
            core.setStatus(me, frame.text);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { status: connection?.status ?? null } });
            break;
          case 'rename': {
            // names never change (spec 4.4): only the Coordinator renames, whatever a roles.toml grants
            if (core.roles && connection?.role !== COORDINATOR) {
              const reason = 'names never change: only the Coordinator renames';
              peer.send({ type: 'result', id: frame.id, ok: false, error: `forbidden: rename (${reason})`, code: 'forbidden', permission: 'rename', role: connection?.role ?? null, reason });
              break;
            }
            const r = core.rename(me, frame.name);
            if (r.ok) {
              name = r.name;
              peer.send({ type: 'result', id: frame.id, ok: true, value: { name: r.name } });
            } else peer.send({ type: 'result', id: frame.id, ok: false, error: r.error });
            break;
          }
          case 'ping':
            core.ping(me);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { pong: true } });
            break;
          case 'send': {
            const { outcomes, topic } = core.sendFromSession(me, frame.to ?? [], frame.text, frame.replyTo, frame.topic);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { outcomes, topic } });
            break;
          }
          case 'topic.create':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { topic: core.createTopic(frame.title, frame.item, me) } });
            break;
          case 'resolve':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { topic: core.resolveTopic(frame.topic, me) } });
            break;
          case 'ask':
            peer.send({ type: 'result', id: frame.id, ok: true, value: core.asks.ask(me, frame.topic, frame.question, frame.options, frame.free) });
            break;
        }
      } catch (err) {
        peer.send(Dispatcher.#failure(frame.id, err));
      }
    };

    const clientRequest = (frame: Record<string, unknown>) => {
      if (!isClientRequest(frame)) {
        const id = typeof frame.id === 'string' ? frame.id : '?';
        peer.send({ type: 'result', id, ok: false, error: `unknown request type "${String(frame.type)}"` });
        return;
      }
      const answer = (value: unknown) => peer.send({ type: 'result', id: frame.id, ok: true, value });
      try {
        switch (frame.type) {
          case 'topic.list':
            return answer({ topics: core.topics() });
          case 'topic.history':
            return answer(core.topicHistory(frame.topic, frame.limit, frame));
          case 'topic.send': {
            const { message, outcomes } = core.sendFromHuman(frame.topic, frame.text, frame.to, frame.replyTo);
            return answer({ message, outcomes });
          }
          case 'topic.rename':
            return answer({ topic: core.renameTopic(frame.topic, frame.title) });
          case 'topic.delete':
            core.deleteTopic(frame.topic);
            return answer({ deleted: frame.topic });
          case 'topic.create':
            return answer({ topic: core.createTopic(frame.title, frame.item) });
          case 'topic.close':
            return answer({ topic: core.closeTopic(frame.topic) });
          case 'topic.resolve':
            return answer({ topic: core.resolveTopic(frame.topic) });
          case 'topic.read':
            return answer({ topic: core.readTopic(frame.topic, frame.upTo) });
          case 'role.set':
            // with a note, or `move`: the role moves to the session from its holder, as a handover (#31); the note is optional
            if (frame.note !== undefined || frame.move === true) {
              const from = core.holderOf(frame.role, frame.session);
              return answer({ session: handOver(this.#handover(), { role: frame.role, from, to: frame.session, by: 'human', note: frame.note, noteRequired: false, requireKnown: false }) });
            }
            return answer({ session: core.assignRole(frame.session, frame.role) });
          case 'role.state':
            return answer(roleState(this.#handover(), frame.role));
          case 'role.clear':
            return answer({ session: core.clearRole(frame.session) });
          case 'role.list':
            return answer(core.roleList());
          case 'hygiene.unmute':
            return answer(core.unmute(frame.a, frame.b));
          case 'topic.answer':
            return answer(core.asks.answer(frame.ask, frame.option, frame.text));
          case 'inbox.list':
            return answer(core.inbox.list());
          case 'inbox.dismiss':
            return answer(core.inbox.dismiss(frame.notification));
          case 'inbox.dismiss_all':
            return answer(core.inbox.dismissAll());
          case 'worktree.list':
          case 'worktree.prune': {
            // Git work, awaited; prune is the human's (a session's shell is refused before this): without items the
            // closed items' worktrees, with items those removed
            const worktrees = this.#needWorktrees();
            const id = frame.id;
            const resumed = <T,>(write: () => T): T => this.#guard.measure(frame.type, client, write, 'resumed');
            const value: Promise<unknown> =
              frame.type === 'worktree.list'
                ? worktrees.list(resumed).then((w) => ({ worktrees: w }))
                : frame.dryRun === true || !frame.items?.length
                  ? worktrees.prunable(resumed).then((candidates) => ({ candidates }))
                  : worktrees.prune(frame.items, resumed);
            return later(frame.type, value.then((v): HubFrame => ({ type: 'result', id, ok: true, value: v }), (err: unknown) => Dispatcher.#failure(id, err)));
          }
          case 'subscribe':
            if (!unsubscribe) {
              const fromCore = core.subscribe((event) => {
                if (peer.isOpen()) peer.send(event);
              });
              // the tracker's index changes reach the UI as `task` events (the items panel, the board)
              const fromTracker = this.#options.tracker?.onChange(({ id, item }) => {
                if (peer.isOpen()) peer.send({ type: 'task', id, item });
              });
              unsubscribe = () => {
                fromCore();
                fromTracker?.();
              };
              log({ event: 'subscribed', edge: transport.edge });
            }
            return answer({ subscribed: true });
        }
      } catch (err) {
        peer.send(Dispatcher.#failure(frame.id, err));
        return;
      }
      const control = this.#options.control;
      if (!control) {
        peer.send({ type: 'result', id: frame.id, ok: false, error: 'this hub is not serving a project: no status or stop here' });
        return;
      }
      switch (frame.type) {
        case 'hub.status':
          peer.send({ type: 'result', id: frame.id, ok: true, value: { ...control.status(), sessions: core.presence(), coordinator: core.coordinator(), needsYou: core.inbox.needsYou(), requests: { ...this.#guard.counters } } satisfies HubStatus });
          break;
        case 'hub.stop':
          log({ event: 'stop-requested', edge: transport.edge });
          peer.send({ type: 'result', id: frame.id, ok: true, value: { stopping: true } });
          control.stop();
          break;
      }
    };

    /** A read repeated too fast: its last answer goes out again (unaudited: `too-fast` is logged once); true when it did. */
    const replayed = (frame: Record<string, unknown>): boolean => {
      const again = guard.replay(frame, kind === 'spoke' ? (name ?? '?') : client);
      if (again) wire.send(again);
      return again !== null;
    };

    const handle = (frame: Record<string, unknown>): void => {
        if (kind === 'spoke') {
          // A replaced or closing socket's buffered frames would act under a name it no longer holds.
          if (!peer.isOpen() || connection === null || !core.isCurrent(connection)) {
            log({ event: 'stale-frame', edge: transport.edge, name, type: frame.type });
            return;
          }
          if (isAck(frame)) return core.ack(connection, frame.id);
          // the heartbeat is not a tool call
          if (frame.type !== 'ping') {
            if (replayed(frame)) return;
            audit(frame.id, { session: connection.name, sessionId: connection.sessionId, role: connection.role, tool: String(frame.type), args: summarize(frame) });
            const bad = Dispatcher.#verdictFromText(frame);
            if (bad !== null) return peer.send({ type: 'result', id: String(frame.id), ok: false, error: bad });
            if (!this.#permitted(connection, frame, peer)) return;
          }
          // a spoke always acts as its own session
          if (isTaskRequest(frame)) {
            return task(frame, sessionActor(connection, UNKNOWN_SESSION), () => connection && core.isCurrent(connection) ? connection : null);
          }
          if (isSessionRequest(frame) && SPOKE_SESSION_REQUESTS.has(frame.type)) return session(frame);
          // the session's name as it is now: another of its spokes may have renamed it
          if (frame.type === 'send' && frame.artifacts !== undefined) return attachedSend(frame, () => connection && core.isCurrent(connection) ? connection : null);
          return spokeRequest(frame, connection.name);
        }
        if (replayed(frame)) return;
        // a CLI call acting as a session the hub knows (`as`): checked against that session's role and audited as it,
        // exactly as the session's own tool call would be
        const as = isTaskRequest(frame) ? this.#asSession(frame) : null;
        if (as !== null && isTaskRequest(frame)) {
          audit(frame.id, { session: as.name, sessionId: as.sessionId, role: as.role, tool: String(frame.type), args: summarize(frame), client });
          const bad = Dispatcher.#verdictFromText(frame);
          if (bad !== null) return peer.send({ type: 'result', id: String(frame.id), ok: false, error: bad });
          if (!this.#permitted(as, frame, peer)) return;
          return task(frame, sessionActor(as, UNKNOWN_SESSION), () => this.#asSession(frame));
        }
        const plumbing = frame.type === 'session.signal' || frame.type === 'session.bridge';
        // any other CLI call from a session's shell (`as` with the session's id, or a name the hub knows): the session's,
        // audited as it. What the permission table knows is decided by the table, as for the session's own tool call
        // (launching, listing, stopping and resuming sessions, stopping the hub: the Coordinator's); reading the hub's
        // state is anyone's; everything else is the human's alone.
        const caller = plumbing ? null : this.#asSession(frame);
        if (caller !== null) {
          audit(frame.id, { session: caller.name, sessionId: caller.sessionId, role: caller.role, tool: String(frame.type), args: summarize(frame), client });
          if (this.#toolCall(caller, frame) !== null) {
            if (!this.#permitted(caller, frame, peer)) return;
          } else if (!SESSION_CLI_FRAMES.has(String(frame.type))) {
            return this.#refuse(caller, frame, peer, String(frame.type), `only the human may do this; this call is ${withRole(caller.name, caller.role)}'s, by $CLAND_SESSION_ID`);
          }
        } else if (!plumbing) {
          // the human, through the UI or the CLI: not restricted by the table, audited all the same (hook plumbing aside)
          audit(frame.id, { session: HUMAN_SESSION, sessionId: null, role: HUMAN_SESSION, tool: String(frame.type), args: summarize(frame), client });
        }
        // a client's frame may name who it acts as (a name no session holds: written as it, unrestricted)
        if (isTaskRequest(frame)) {
          const bad = Dispatcher.#verdictFromText(frame);
          if (bad !== null) return peer.send({ type: 'result', id: String(frame.id), ok: false, error: bad });
          return task(frame, 'client');
        }
        if (isSessionRequest(frame)) return session(frame);
        if (frame.type === 'artifact.promote') return promote(frame as ArtifactPromote, caller);
        if (frame.type === 'artifact.create' || frame.type === 'artifact.list') {
          return artifact(frame as ArtifactCreate | ArtifactList, () => this.#asSession(frame));
        }
        if (frame.type === 'prompt.send' || (frame.type === 'topic.send' && frame.artifacts !== undefined)) return attachedSend(frame, () => this.#asSession(frame));
        if (isClientRequest(frame) && (frame.type === 'release' || frame.type === 'sync' || frame.type === 'push')) {
          const tool = frame.type;
          if (caller && (client !== 'cli' || caller.role !== 'coordinator')) return this.#refuse(caller, frame, peer, tool, `${tool} belongs to the human or the Coordinator from its own shell`);
          if (!this.#releases) return peer.send(Dispatcher.#failure(frame.id, new ReleaseError('release-state', 'this hub has no tracker')));
          const resumed = <T,>(write: () => T): T => this.#guard.measure(tool, client, write, 'resumed');
          const authorize = () => {
            if (!caller) return;
            const now = this.#asSession(frame);
            const grants = core.roles?.get().get(now?.role ?? '')?.permissions.tools;
            const decision = decide(now?.role ?? null, grants, { tool });
            if (!now || now.role !== 'coordinator' || !decision.ok) {
              const reason = decision.ok ? `the calling session no longer holds Coordinator` : decision.reason;
              if (now) this.#refuse(now, frame, peer, tool, reason, '', false);
              throw new ToolForbidden(now?.role ?? null, tool, reason);
            }
          };
          const operation = frame.type === 'release' ? this.#releases.release(frame.version, frame.dryRun === true, resumed, authorize) : frame.type === 'push' ? this.#releases.push(resumed, authorize) : this.#releases.sync(resumed, authorize);
          later(tool, operation.then(
            (value): HubFrame => resumed(() => ({ type: 'result', id: frame.id, ok: true, value })),
            (err: unknown) => resumed(() => Dispatcher.#failure(frame.id, err)),
          ));
          return;
        }
        if (frame.type === 'merge' && isClientRequest(frame)) return merge(frame as import('../protocol.ts').MergeRequest, caller);
        clientRequest(frame);
    };

    return {
      receive: (raw) => {
        if (done) return;
        const frame = parseFrame(raw);
        if (!frame) return refuse('bad-hello', 'not a frame');
        if (kind === null) return hello(frame);
        // the handler's time on the event loop, against the budget: over it is a `slow-request` in the log
        this.#guard.measure(String(frame.type), kind === 'spoke' ? (name ?? '?') : client, () => handle(frame));
      },
      closed: () => {
        done = true;
        if (kind === 'spoke') this.#guard.changed();
        for (const queue of audits.values()) for (const base of queue) log({ event: 'audit', ...base, outcome: 'error', error: 'the connection closed before the answer' });
        audits.clear();
        clearTimeout(helloTimer);
        unsubscribe?.();
        unsubscribe = null;
        for (const fn of onClose.splice(0)) fn();
        if (connection !== null) core.disconnect(connection, spoke ?? undefined);
      },
    };
  }
}
