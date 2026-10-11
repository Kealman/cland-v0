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
import { isSubscriptionRequest, subscriptionInput } from '../subscriptions.ts';
import { randomUUID } from 'node:crypto';
import type { SubscriptionRequest } from '../protocol.ts';
import { Suites, suiteSummary, type SuiteJob } from './suites.ts';
import { describeSelection } from '../suite-selection.ts';
import { isAbsolute } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { AGENTS, COORDINATOR, GENERAL, UNKNOWN_SESSION, type Connection, type HubCore, type SpokeSocket } from './core.ts';
import { summarize, type AuditOutcome, type AuditRecord } from './audit.ts';
import { decide, KNOWN_TOOLS, ToolForbidden, type ToolCall } from '../roles/permissions.ts';
import { crewSummary } from '../crew.ts';
import type { RolesConfig } from '../roles/config.ts';
import { ROLE_NAMES, withRole } from '../names.ts';
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
import { artifactEntry, folderFiles } from './artifact-folder.ts';
import { ArtifactError, createArtifact } from './artifacts.ts';
import type { ArtifactCreate, ArtifactList, ArtifactPromote, ArtifactKeep, ArtifactArchive, ArtifactMove } from '../protocol.ts';
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
  flushLogs?: () => Promise<void>;
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
  requestGuard?: RequestGuard;
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
const SESSION_CLI_FRAMES: ReadonlySet<string> = new Set(['crew.show', 'crew.set', 'artifact.list', 'hub.status', 'inbox.list', 'role.list', 'worktree.list', 'suite.start']);

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
  #rolesSnapshot: RolesConfig | undefined;
  readonly #processHolds = new Map<string, string>();
  #artifactQueue: Promise<unknown> = Promise.resolve();
  readonly artifacts: ArtifactLifecycle;
  readonly #suites: Suites | null;

  constructor(options: DispatcherOptions) {
    this.#options = options;
    this.#log = options.log ?? (() => {});
    this.#worktrees = options.tracker ? new TaskWorktrees({ tracker: options.tracker, log: this.#log, sessions: () => this.#sessionCwds() }) : null;
    this.#merges = options.tracker && this.#worktrees ? new TaskMerges(options.tracker, this.#worktrees, this.#log, async (item, resumed) => { await this.#sessions?.stopAfterMerge(item, resumed); }) : null;
    this.#releases = options.tracker && this.#worktrees ? new Releases(options.tracker, this.#worktrees, this.#log, options.core.store) : null;
    this.artifacts = new ArtifactLifecycle(options.core.store, options.control?.status().root, a => options.core.artifactChanged(a), options.artifactFiles);
    this.#guard = options.requestGuard ?? new RequestGuard({ ...options.guard, log: this.#log });
    this.#rolesSnapshot = options.core.roles?.get();
    const root = options.control?.status().root;
    this.#suites = root ? new Suites(options.core.store, root, (job, checkpointArtifact) => this.#reportSuite(job, checkpointArtifact)) : null;
    // what a read shows changed: no earlier answer is replayed
    options.core.subscribe(event => {
      this.#guard.changed();
      if (event.type === 'session.process' && event.process.status !== 'running') options.tracker?.releaseHolds(event.process.sessionId, event.process.name);
      if (event.type === 'session.cleanup' && event.state === 'settled') options.tracker?.releaseHolds(event.sessionId);
    });
    options.tracker?.onChange(() => {
      this.#guard.changed();
      options.core.refreshPresence();
      for (const process of this.#sessions?.list() ?? []) {
        const holds = JSON.stringify(process.holds ?? []);
        const previous = this.#processHolds.get(process.sessionId) ?? '[]';
        this.#processHolds.set(process.sessionId, holds);
        if (holds !== previous) options.core.publishProcess(process);
      }
    });
    // A crash after the tracker commit but before alias cleanup must not reserve the old name forever.
    if (options.tracker) for (const { name, id } of options.core.store.sessionAliases()) {
      if (!options.tracker.hasProvisionalSession(name)) options.core.store.settleSessionAlias(name, id);
    }
    options.tracker?.useSessionIdentity(id => options.core.sessionIdentity(id), (name, id) => options.core.store.settleSessionAlias(name, id));
    // a role moved to a name with no session yet: its claims follow at that session's hello; and what a hub that
    // died between a move's commit and its claims left pending is finished now
    options.core.onSessionHello((name, sessionId) => {
      options.tracker?.adoptSession(name, sessionId);
      this.#settleClaims({ name, sessionId });
    });
    this.#settleClaims();
  }

  #settleClaims(hello?: { name: string; sessionId: string }): void {
    try {
      settleAllClaims(this.#handover(), hello);
    } catch (err) {
      this.#log({ event: 'claims-settle-failed', error: err instanceof Error ? err.message : String(err) });
    }
  }

  async close(): Promise<void> { this.#merges?.stop(); await this.#suites?.close(); }

  useSessions(sessions: Sessions | undefined): void {
    this.#sessions = sessions;
    this.#processHolds.clear();
    for (const process of sessions?.list() ?? []) this.#processHolds.set(process.sessionId, JSON.stringify(process.holds ?? []));
    this.#options.tracker?.reconcileSessionIdentities();
    // A crash can follow the durable process-row update but precede queued hold cleanup.
    // Reconcile only known process identities; direct and unknown sessions retain their work.
    for (const process of sessions?.list() ?? []) if (process.status !== 'running') {
      this.#options.tracker?.releaseHolds(process.sessionId, process.name);
    }
    // the inbox's approvals are the launched sessions waiting for approval, with their attach commands (#33)
    this.#options.core.inbox.useProcesses(sessions ? () => sessions.list() : null);
  }

  /** Where the sessions stand: the connected spokes' cwds and the running launched harnesses'. */
  #sessionCwds(): SessionCwd[] {
    const out: SessionCwd[] = this.#options.core.presence().filter((p) => typeof p.cwd === 'string' && p.cwd !== '').map((p) => ({ name: p.name, cwd: p.cwd }));
    for (const p of this.#sessions?.list() ?? []) if (p.status === 'running') out.push({ name: p.name, cwd: p.cwd });
    for (const { process } of this.#sessions?.pendingStops() ?? []) out.push({ name: process.name, cwd: process.cwd });
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

  /** Async handlers retain the table's typed reason when their admission changes. */
  #requirePermission(connection: Caller, frame: Record<string, unknown>, peer: Peer): void {
    if (this.#permitted(connection, frame, peer, false)) return;
    const decision = decide(connection.role, this.core.roles?.get().get(connection.role ?? '')?.permissions.tools, this.#toolCall(connection, frame)!);
    if (!decision.ok) throw new ToolForbidden(connection.role, decision.permission, decision.reason);
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
    frame.verdict = { verdict: v.verdict, result: v.result, run: v.run, ...(v.commit ? { commit: v.commit } : {}), ...(v.stage ? { stage: v.stage } : {}) };
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

  /** Scope comes from current claims/ancestry, never the session that launched a harness. */
  #leadRefusal(connection: Caller, frame: Record<string, unknown>): string | null {
    if (connection.role !== 'lead') return null;
    const type = String(frame.type);
    if (['release', 'sync', 'push', 'hub.stop', 'rename', 'session.resume'].includes(type)) {
      return `root level: only the Coordinator may use ${type}`;
    }
    const request = type === 'send' && typeof frame.text === 'string'
      ? /^(?:review|qa) request (T-[1-9]\d*)\s*(?:\n|$)/.exec(frame.text)
        ?? /^qa request (T-[1-9]\d*)[ \t]+stage[ \t]+\S[^\r\n]*(?:\r?\n|$)/.exec(frame.text)
      : null;
    if (!['session.launch', 'session.stop', 'merge'].includes(type) && !request) return null;
    const tracker = this.#options.tracker;
    const items = tracker?.list() ?? [];
    const node = items.find(i => i.state === 'open' && tracker?.levels.includes(i.kind) && i.claim?.role === 'lead' && this.core.sessionIdentity(i.claim.sessionId) === connection.sessionId);
    if (!node) return 'Lead level: no live container claim; only a claimed subtree may be managed';
    const reason = (target: string) => `Lead level at ${node.kind} ${node.id}: ${target} is outside your subtree; send the request to lead ${node.id}`;
    const inside = (id: string | null | undefined): boolean => {
      const seen = new Set<string>();
      let item = items.find(i => i.id === normalizeId(id ?? ''));
      while (item && !seen.has(item.id)) {
        if (item.id === node.id) return true;
        seen.add(item.id);
        item = items.find(i => i.id === item!.parent);
      }
      return false;
    };
    if (type === 'session.stop') {
      const process = this.#sessions?.list().find(p => p.name === frame.session);
      const role = process ? this.core.store.roleOf(process.name) ?? process.role : null;
      if (!process || ['coordinator', 'lead', 'aide'].includes(role ?? '')) return reason(`session ${String(frame.session)} (root or node role)`);
      const held = items.filter(i => i.state === 'open' && [i.claim, ...i.holds].some(h => h && this.core.sessionIdentity(h.sessionId) === process.sessionId));
      const work = held.length ? held.map(i => i.id) : [process.item];
      return work.every(inside) ? null : reason(`session ${process.name}`);
    }
    const item = request?.[1] ?? (typeof frame.item === 'string' ? frame.item : null);
    if (!inside(item)) return reason(item ?? 'a request with no item');
    if (type === 'session.launch') {
      const role = typeof frame.role === 'string' ? frame.role : typeof frame.name === 'string' ? this.core.store.roleOf(frame.name) : null;
      if (!['implementer', 'reviewer', 'qa'].includes(role ?? '')) return reason(`launch of role ${role ?? '(none)'}`);
    }
    if (type === 'merge') {
      let target = items.find(i => i.id === normalizeId(item!));
      const seen = new Set<string>();
      while (target && !seen.has(target.id)) {
        if (target.kind === tracker?.levels[0]) return null;
        seen.add(target.id);
        target = items.find(i => i.id === target!.parent);
      }
      return 'root level: only the Coordinator merges unscheduled items';
    }
    return null;
  }

  /** The table's view of a spoke frame, or null when it is no tool the table knows. */
  #toolCall(connection: Caller, frame: Record<string, unknown>): ToolCall | null {
    const type = String(frame.type);
    // listing the launched sessions goes with launching them
    const tool = type.startsWith('event.') ? type.slice(6) : type === 'session.list' ? 'session.launch' : type === 'artifact.list' ? 'history' : type;
    if (!KNOWN_TOOLS.includes(tool) && !(connection.role === 'aide' && (tool === 'role.state' || tool.startsWith('session.')))) return null;
    const item = typeof frame.item === 'string' ? frame.item.trim() || null : null;
    const tracker = this.#options.tracker;
    const own = (): boolean | undefined => {
      if (!tracker || item === null) return false;
      // Ownership is an indexed permission fact; request authorization never reads an item file.
      const view = tracker.list().find(value => value.id === normalizeId(item));
      if (!view) return undefined; // no such item: the tool says so itself
      const actor = sessionActor(connection, UNKNOWN_SESSION);
      if (view.claim && tracker.sameSession(view.claim.sessionId, actor.id)) return true;
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
      levelRefusal: this.#leadRefusal(connection, frame),
      ...(tool === 'task.plan' ? { planOp: frame.op } : {}),
      item,
      own,
      ...(type === 'session.launch' ? { launchRole: typeof frame.role === 'string' ? frame.role : typeof frame.name === 'string' ? this.#options.core.store.roleOf(frame.name) : null } : {}),
      ...(tool === 'task.edit' || tool === 'task.criterion' || tool === 'task.plan' ? {
        criterionOp: frame.op,
        status: frame.status,
        statusOnly: Object.keys(frame).every(key => ['type', 'id', 'item', 'as', 'status'].includes(key)),
        claimed: () => {
          const claim = item !== null ? tracker?.list().find(value => value.id === normalizeId(item))?.claim : null;
          return !!claim && !!tracker?.sameSession(claim.sessionId, sessionActor(connection, UNKNOWN_SESSION).id);
        },
      } : {}),
      ...(tool === 'send' ? { to: Array.isArray(frame.to) ? frame.to as string[] : [], toHuman: !Array.isArray(frame.to) || frame.to.length === 0, mentioned: () => this.#mentioned(connection, frame) } : {}),
      // a plain comment whose text reads back as a verdict header is a verdict to every reader, so it is one here too
      ...(tool === 'task.comment'
        ? {
            verdictCriteria: typeof frame.verdict === 'object' && frame.verdict !== null && ((frame.verdict as { verified?: unknown }).verified !== undefined || (frame.verdict as { failed?: unknown }).failed !== undefined),
            verdict: (typeof frame.verdict === 'object' && frame.verdict !== null) || (typeof frame.text === 'string' && readsAsVerdict(frame.text)),
            ...(typeof frame.verdict === 'object' && frame.verdict !== null && typeof (frame.verdict as { verdict?: unknown }).verdict === 'string' ? { verdictKind: (frame.verdict as { verdict: string }).verdict } : {}),
          }
        : {}),
    };
  }

  #artifactTopic(caller: Caller | null, topicId: string) {
    const core = this.#options.core;
    const topic = typeof topicId === 'string' ? core.store.topic(topicId) : null;
    if (!topic) throw new ArtifactError('artifact-topic', 'no such artifact topic');
    if (caller !== null && caller.role !== 'coordinator' && caller.role !== 'aide') {
      const own = topic.item !== null && this.#toolCall(caller, { type: 'task.claim', item: topic.item })?.own?.() === true;
      if (topic.id === GENERAL.id || topic.id === AGENTS.id || !(own || core.store.addressedInTopic(caller.sessionId, topic.id))) {
        throw new ToolForbidden(caller.role, 'artifact.create', 'artifacts require your own item topic or a delivered request in this topic; General and Agents are the Coordinator’s');
      }
    }
    return topic;
  }

  #suitePermissions(actor: SuiteJob['actor'], topic: string, to: string[], quiet = false): Caller | null {
    const core = this.#options.core;
    const caller = actor ? this.#asSession({ as: actor }) : null;
    if (actor && !caller) throw new Error('suite caller identity is unavailable');
    if (caller) {
      const peer: Peer = { isOpen: () => true, close: () => {}, send: () => {} };
      for (const frame of [{ type: 'artifact.create', id: 'suite-permission', topic }, { type: 'send', id: 'suite-permission', topic, to }]) {
        const call = this.#toolCall(caller, frame)!;
        const decision = decide(caller.role, core.roles?.get().get(caller.role ?? '')?.permissions.tools, call);
        if (!decision.ok) {
          if (!quiet) this.#refuse(caller, frame, peer, decision.permission, decision.reason, '', false);
          throw new ToolForbidden(caller.role, decision.permission, decision.reason);
        }
      }
    }
    this.#artifactTopic(caller, topic);
    const names = new Set([...core.presence().map(p => p.name), ...core.store.knownSessions().map(p => p.name)]);
    for (const target of to) {
      if (!names.has(target) && !ROLE_NAMES.includes(target) && target !== 'all' && !target.includes('*') && !/^lead T-\d+$/.test(target)) throw new Error(`no suite recipient named ${target}`);
    }
    return caller;
  }

  async #reportSuite(job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void): Promise<void> {
    const core = this.#options.core;
    const messageId = `suite:${job.id}`;
    if (core.store.message(messageId)) return; // committed result wins over a crash before receipt update
    const callerNow = () => this.#suitePermissions(job.actor, job.topic, job.to, true);
    callerNow();
    const title = `Suite ${job.id} · ${job.mode} at ${job.head.slice(0, 7)}`;
    // Artifact registration may have committed just before the hub died.
    const prior = core.store.artifacts(job.topic).find(a => a.title === title);
    let artifactId = job.artifact ?? prior?.id ?? null;
    if (!job.artifact && prior) checkpointArtifact(prior.id);
    if (!artifactId) {
      const create = () => this.#artifact({ type: 'artifact.create', id: job.id, kind: 'file', title, topic: job.topic, path: job.log }, callerNow, work => work());
      const operation = this.#artifactQueue.then(create);
      this.#artifactQueue = operation.catch(() => {});
      const result = await operation as { id: string };
      artifactId = result.id; checkpointArtifact(artifactId);
    }
    const artifact = core.store.resolveArtifact(artifactId);
    if (!artifact || artifact.fileDeleted || artifact.status === 'archived') throw new Error('suite log artifact unavailable');
    const log = await readFile(artifact.path, 'utf8');
    const caller = callerNow(); // all checks after the final file read, then synchronous publication
    const outcome = job.outcome!;
    const report = (filesBytes: number) => `suite result ${job.id}\n${job.mode} exit ${outcome.code}${outcome.cause ? `; ${outcome.cause}` : ''}\n${job.selection ? describeSelection(job.selection, filesBytes) : 'mode full; legacy run (selection unavailable)'}\nBranch ${job.branch} · head ${job.head}\n${suiteSummary(log)}\nLog ${artifact.id}: ${artifact.path}`;
    let text = report(2048);
    // File counts and the artifact retain the complete decision when a broad diff
    // or a smaller configured cap cannot fit every path in the topic message.
    for (let bytes = 1024; !core.textFits(text) && bytes >= 0; bytes = bytes ? Math.floor(bytes / 2) : -1) text = report(bytes);
    if (!core.textFits(text)) {
      // Long branch names, failures or log paths can exhaust even the no-files
      // report. Keep the result/mode/log pointer first and respect any byte cap.
      text = core.boundedText(`suite result ${job.id}\n${job.mode} exit ${outcome.code}; mode ${job.selection?.mode ?? 'full'}\nDeciding files ${job.selection?.files.length ?? 'unknown'}; full list in log ${artifact.id}\n${job.selection?.reason ?? 'legacy run (selection unavailable)'}\nBranch ${job.branch} · head ${job.head}\n${suiteSummary(log)}\n${outcome.cause}\nLog ${artifact.id}: ${artifact.path}`);
    }
    const result = caller ? core.sendFromSession(caller.name, job.to, text, undefined, job.topic, undefined, caller, [artifact], 'report', messageId, true)
      : core.sendFromHuman(job.topic, text, job.to, undefined, undefined, undefined, [artifact], messageId);
    if (!core.store.message(result.message.id)) throw new Error('suite result had no deliverable recipient');
    this.#log({ event: 'audit', session: caller?.name ?? HUMAN_SESSION, sessionId: caller?.sessionId ?? null, role: caller?.role ?? HUMAN_SESSION, tool: 'send', args: { topic: job.topic, to: job.to, suite: job.id, artifacts: [artifact.id] }, outcome: 'ok', client: 'suite' });
  }
  async #artifact(frame: ArtifactCreate | ArtifactList, callerNow: () => Caller | null, resumed: <T>(work: () => T) => T): Promise<unknown> {
    const caller = callerNow();
    const core = this.#options.core;
    if (frame.type === 'artifact.list') {
      if (frame.artifact !== undefined) {
        const a = core.store.resolveArtifact(frame.artifact);
        if (!a || a.fileDeleted) throw new ArtifactError('artifact-unavailable', 'no artifact file is available');
        const files = a.folder ? await folderFiles(a.path, resumed) : undefined;
        return resumed(() => {
          const current = callerNow();
          const owner = a.movedTo ? core.store.artifact(a.movedTo.folder)! : a;
          const editable = !current || current.role === 'aide' || (!core.store.humanArtifact(a) && !core.store.humanArtifact(owner));
          return { artifact: a, ...(files ? { files } : {}), editable };
        });
      }
      if (frame.topic !== undefined && (typeof frame.topic !== 'string' || !core.store.topic(frame.topic))) throw new ArtifactError('artifact-topic', 'no such artifact topic');
      return { artifacts: core.store.artifacts(frame.topic) };
    }
    const authorize = () => this.#artifactTopic(callerNow(), frame.topic);
    const topic = authorize();
    const root = this.#options.control?.status().root;
    const name = caller?.name ?? 'human';
    const cwd = caller ? core.presence().find((p) => p.sessionId === caller.sessionId)?.cwd ?? root : root;
    const artifact = await createArtifact(core.store, root, frame, { name, cwd: cwd ?? '.', kind: caller ? 'agent' : 'human', role: () => callerNow()?.role ?? null }, (a) => {
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
        wire.send(core.visibility.frame(frame));
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
        if (caller) this.#requirePermission(caller, { ...frame, type: 'send' }, peer);
        if (!Array.isArray(ids) || !ids.length || !ids.every(id => typeof id === 'string')) throw new ArtifactError('artifact-source', 'artifacts must be a nonempty array of ids');
        const artifacts = ids.map(id => {
          const a = core.store.resolveArtifact(id);
          if (!a || a.status === 'archived' || a.topic !== topicId) throw new ArtifactError('artifact-unavailable', `artifact ${id} is unavailable in this topic`);
          if (prompt && (a.movedTo || a.kind !== 'prompt' || a.status !== 'draft' || a.creator !== 'human')) throw new ArtifactError('artifact-unavailable', 'only a human prompt draft can be sent here');
          return a;
        });
        return { caller, artifacts };
      };
      const operation = async (): Promise<HubFrame> => {
        try {
          const prepared = check();
          // Reserve the intended ids/topic/caller before I/O; no post or status is changed yet.
          const contents = await Promise.all(prepared.artifacts.map(a => this.#options.readArtifact ? this.#options.readArtifact(artifactEntry(a)) : readFile(artifactEntry(a))));
          const files = await resumed(() => {
            check();
            return Promise.all(prepared.artifacts.map(a => stat(artifactEntry(a))));
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
            const value = caller ? core.sendFromSession(caller.name, to ?? [], text, reply, topicId, undefined, caller, artifacts, frame.kind)
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
      const authorize = () => {
        if (!caller || !core.roles) return;
        const now = kind === 'spoke' ? (connection && core.isCurrent(connection) ? connection : null) : this.#asSession(frame);
        if (!now || now.sessionId !== caller.sessionId) throw new ToolForbidden(now?.role ?? null, 'merge', 'the calling session is no longer current');
        const call = this.#toolCall(now, frame)!;
        const decision = decide(now.role, core.roles?.get().get(now.role ?? '')?.permissions.tools, call);
        if (!decision.ok) {
          this.#refuse(now, frame, peer, decision.permission, decision.reason, '', false);
          throw new ToolForbidden(now.role, decision.permission, decision.reason);
        }
      };
      later('merge', this.#merges.merge(frame.item, actor, resumed, frame.override, authorize).then(
        (value): HubFrame => ({ type: 'result', id: frame.id, ok: true, value }),
        (err: unknown) => Dispatcher.#failure(frame.id, err),
      ));
    };
    const artifactChange = (frame: ArtifactKeep | ArtifactArchive | ArtifactMove, callerNow: () => Caller | null) => {
      const original = callerNow();
      const resumed = this.#guard.resumer(frame.type, kind === 'spoke' ? (name ?? '?') : client);
      const authorize = () => {
        const current = callerNow();
        if (original && (!current || current.sessionId !== original.sessionId)) throw new ToolForbidden(null, frame.type, 'the session is no longer current');
        if (current && !this.#permitted(current, frame as unknown as Record<string, unknown>, peer, false)) throw new ToolForbidden(current.role, frame.type, 'permission changed during artifact preparation');
        for (const id of [frame.artifact, ...(frame.type === 'artifact.move' ? [frame.folder] : [])]) {
          const a = core.store.artifact(id);
          if (!a) throw new ArtifactError('artifact-unavailable', 'no such artifact');
          if (current && current.role !== 'aide' && core.store.humanArtifact(a)) throw new ToolForbidden(current.role, frame.type, 'agents cannot change the human’s or an Aide’s artifacts');
        }
      };
      try {
        authorize();
        if (frame.type === 'artifact.move') {
          later(frame.type, this.artifacts.move(frame.artifact, frame.folder, frame.name, authorize, resumed).then(
            value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value }) as HubFrame),
            err => resumed(() => Dispatcher.#failure(frame.id, err)),
          )); return;
        }
        if (frame.type === 'artifact.keep' && frame.kept !== undefined && typeof frame.kept !== 'boolean') throw new ArtifactError('artifact-source', 'kept must be a boolean');
        peer.send({ type: 'result', id: frame.id, ok: true, value: { artifact: frame.type === 'artifact.keep' ? this.artifacts.keep(frame.artifact, frame.kept ?? true) : this.artifacts.archive(frame.artifact) } });
      } catch (err) { peer.send(Dispatcher.#failure(frame.id, err)); }
    };
    const promote = (frame: ArtifactPromote, caller: Caller | null) => {
      const resumed = <T,>(body: () => T): T => this.#guard.measure(frame.type, client, body, 'resumed');
      const authorize = () => {
        if (!caller) return;
        const now = kind === 'spoke' ? (connection && core.isCurrent(connection) ? connection : null) : this.#asSession(frame);
        const a = core.store.artifact(frame.artifact);
        if (a && core.store.humanArtifact(a) && now?.role !== 'aide') throw new ToolForbidden(now?.role ?? null, frame.type, 'agents cannot change the human’s or an Aide’s artifacts');
        const grants = core.roles?.get().get(now?.role ?? '')?.permissions.tools;
        const decision = decide(now?.role ?? null, grants, { tool: frame.type });
        if (!now || now.sessionId !== caller.sessionId || !decision.ok || !(now.role === 'aide' || (client === 'cli' && now.role === 'coordinator'))) throw new ToolForbidden(now?.role ?? null, frame.type, 'promotion belongs to the human, an Aide, or the Coordinator from its own shell');
      };
      later(frame.type, this.artifacts.promote(frame.artifact, frame.path, authorize, resumed).then(
        value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value }) as HubFrame),
        err => resumed(() => Dispatcher.#failure(frame.id, err)),
      ));
    };
    const session = (frame: Parameters<typeof answerSession>[1]) => {
      const original = kind === 'spoke' ? connection : this.#asSession(frame);
      // Item admission needs the effective role before preparing a worktree. Keep the original
      // frame for permission checks, and recheck an inferred assignment across launch awaits.
      const inferred = frame.type === 'session.launch' && frame.item !== undefined && frame.role === undefined;
      const inferredRole = inferred ? core.store.roleOf(frame.name) : null;
      const launchFrame = inferred && inferredRole !== null ? { ...frame, role: inferredRole } : frame;
      const authorize = () => {
        const current = kind === 'spoke' ? (connection && core.isCurrent(connection) ? connection : null) : this.#asSession(frame);
        if (original && (!current || current.sessionId !== original.sessionId)) throw new ToolForbidden(null, frame.type, 'the session is no longer current');
        if (current) this.#requirePermission(current, frame, peer);
        if (inferred && core.store.roleOf(frame.name) !== inferredRole) throw new Error(`session "${frame.name}" changed role while launching; retry the launch`);
      };
      void answerSession(
        this.#sessions,
        launchFrame,
        { send: (f) => peer.send(f), isOpen: () => peer.isOpen(), onClose: (fn) => onClose.push(fn) },
        this.#worktrees ?? undefined,
        (write) => this.#guard.measure(frame.type, kind === 'spoke' ? (name ?? '?') : client, write, 'resumed'),
        authorize,
      ).then((result) => {
        if (peer.isOpen()) peer.send(result);
        else settle(result);
      });
    };

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

    const subscriptionRequest = (frame: SubscriptionRequest, caller: Caller | null): void => {
      try {
        if (!caller || caller.sessionId === UNKNOWN_SESSION) throw new Error('subscriptions require a known session; use --as <session> from the human CLI');
        let value: unknown;
        switch (frame.type) {
          case 'event.subscribe': {
            const input = subscriptionInput(frame.subject, frame.events, frame.digest, frame.threshold);
            const subject = input.subject;
            const itemId = 'item' in subject ? subject.item : 'subtree' in subject ? subject.subtree : null;
            if (itemId && !this.#options.tracker?.list().some(item => item.id === itemId)) throw new Error(`no item ${itemId}`);
            if ('topic' in subject && !core.store.topic(subject.topic)) throw new Error(`no topic ${subject.topic}`);
            if ('role' in subject && !ROLE_NAMES.includes(subject.role)) throw new Error(`unknown role ${subject.role}`);
            value = { subscription: core.store.addSubscription(caller.sessionId, { id: randomUUID(), ...input }) };
            break;
          }
          case 'event.unsubscribe':
            if (typeof frame.subscription !== 'string' || !frame.subscription) throw new Error('unsubscribe needs a subscription id');
            value = { removed: core.store.removeSubscription(caller.sessionId, frame.subscription) };
            break;
          case 'event.subscriptions':
            value = { subscriptions: core.subscriptions().filter(s => s.subscriberId === caller.sessionId).map(({ subscriberId: _, ...s }) => s) };
        }
        if (frame.type !== 'event.subscriptions') this.#guard.changed();
        peer.send({ type: 'result', id: frame.id, ok: true, value });
      } catch (err) { peer.send(Dispatcher.#failure(frame.id, err)); }
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
            if (connection?.role === 'aide') return promote(frame, connection);
            throw new ToolForbidden(connection?.role ?? null, frame.type, 'promote from the Coordinator’s shell with cland artifact promote');
          case 'artifact.keep':
          case 'artifact.archive':
          case 'artifact.move':
            return artifactChange(frame, () => connection && core.isCurrent(connection) ? connection : null);
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
            peer.send({ type: 'result', id: frame.id, ok: true, value: roleState(this.#handover(), role, me) });
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
            const { outcomes, topic } = core.sendFromSession(me, frame.to ?? [], frame.text, frame.replyTo, frame.topic, undefined, undefined, undefined, frame.kind);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { outcomes, topic } });
            break;
          }
          case 'topic.create': {
            const resumed = this.#guard.resumer(frame.type, me);
            const authorize = () => {
              const current = connection && core.isCurrent(connection) ? connection : null;
              if (!current || !this.#permitted(current, frame, peer, false)) throw new ToolForbidden(current?.role ?? null, frame.type, 'permission changed during topic binding');
            };
            later(frame.type, core.createTopic(frame.title, frame.item, me, resumed, authorize).then(
              topic => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { topic } } as HubFrame)),
              err => resumed(() => Dispatcher.#failure(frame.id, err))));
            break;
          }
          case 'resolve':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { topic: core.resolveTopic(frame.topic, me) } });
            break;
          case 'ask.forward':
            peer.send({ type: 'result', id: frame.id, ok: true, value: core.asks.forward(me, frame.ask) });
            break;
          case 'ask.answer':
            peer.send({ type: 'result', id: frame.id, ok: true, value: core.asks.answerFromSession(me, frame.ask, frame.text) });
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
          case 'topic.create': {
            const resumed = this.#guard.resumer(frame.type, client);
            const original = this.#asSession(frame);
            const authorize = () => {
              if (!original) return;
              const current = this.#asSession(frame);
              if (!current || !this.#permitted(current, frame, peer, false)) throw new ToolForbidden(current?.role ?? null, frame.type, 'permission changed during topic binding');
            };
            later(frame.type, core.createTopic(frame.title, frame.item, HUMAN_SESSION, resumed, authorize).then(
              topic => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { topic } } as HubFrame)),
              err => resumed(() => Dispatcher.#failure(frame.id, err))));
            return;
          }
          case 'topic.close':
            return answer({ topic: core.closeTopic(frame.topic) });
          case 'topic.resolve':
            return answer({ topic: core.resolveTopic(frame.topic) });
          case 'topic.read':
            return answer({ topic: core.readTopic(frame.topic, frame.upTo) });
          case 'role.set': {
            // with a note, or `move`: the role moves to the session from its holder, as a handover (#31); the note is optional
            const assign = () => {
              if (frame.item !== undefined && (frame.role !== 'lead' || (frame.note === undefined && frame.move !== true))) throw new Error('item requires a Lead move or handover note');
              if (frame.note !== undefined || frame.move === true) {
                const from = frame.role === 'lead' ? (frame.item ? this.#options.tracker?.claimOf(frame.item)?.session ?? null : null) : core.holderOf(frame.role, frame.session);
                return { session: handOver(this.#handover(), { role: frame.role, from, to: frame.session, by: 'human', note: frame.note, noteRequired: false, requireKnown: false, ...(frame.item ? { item: frame.item } : {}) }) };
              }
              return { session: core.assignRole(frame.session, frame.role) };
            };
            if (core.roles?.fresh) {
              // Reserve before the first await; the fresh snapshot and current holder are re-read in assign().
              const admission = core.admitRole(frame.session, frame.role, frame.note !== undefined || frame.move === true);
              const resumed = this.#guard.resumer(frame.type, client);
              const value = (async (): Promise<HubFrame> => {
                try {
                  await core.roles!.fresh!(resumed);
                  return resumed(() => {
                    try {
                      admission.validate();
                      return { type: 'result', id: frame.id, ok: true, value: assign() } as HubFrame;
                    } catch (err) { return Dispatcher.#failure(frame.id, err); } finally { admission.release(); }
                  });
                } catch (err) {
                  return resumed(() => { admission.release(); return Dispatcher.#failure(frame.id, err); });
                }
              })();
              return later(frame.type, value);
            }
            return answer(assign());
          }
          case 'role.state':
            return answer(roleState(this.#handover(), frame.role, frame.session));
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
              const fromTracker = this.#options.tracker?.onChange(({ id, item, siblings }) => {
                if (peer.isOpen()) peer.send({ type: 'task', id, item, ...(siblings ? { siblings } : {}) });
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
        case 'hub.subscriptions':
          peer.send({ type: 'result', id: frame.id, ok: true, value: { subscriptions: core.subscriptions().map(s => ({ ...s, subscriber: core.subscriptionOwner(s) })) } });
          break;
        case 'hub.status': {
          const status = (): HubFrame => ({ type: 'result', id: frame.id, ok: true, value: { ...control.status(), sessions: core.presence(), suites: this.#suites?.status() ?? [], coordinator: core.coordinator(), needsYou: core.inbox.needsYou(), requests: { ...this.#guard.counters } } satisfies HubStatus });
          if (frame.flushLogs === true && control.flushLogs) {
            const resumed = this.#guard.resumer(frame.type, client);
            let timer: NodeJS.Timeout;
            const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('log drain exceeded 5000 ms')), 5000); timer.unref(); });
            const draining = Promise.race([control.flushLogs(), deadline]);
            return later(frame.type, draining.then(() => resumed(() => { clearTimeout(timer); return status(); }), err => resumed(() => { clearTimeout(timer); return Dispatcher.#failure(frame.id, err); })));
          }
          peer.send(status());
          break;
        }
        case 'hub.stop':
          log({ event: 'stop-requested', edge: transport.edge });
          peer.send({ type: 'result', id: frame.id, ok: true, value: { stopping: true } });
          control.stop();
          break;
      }
    };

    /** A read repeated too fast: its last answer goes out again (unaudited: `too-fast` is logged once); true when it did. */
    const replayed = (frame: Record<string, unknown>): boolean => {
      // A refresh can revoke a read grant without a core event. Never replay an answer from older roles.
      const snapshot = core.roles?.get();
      if (snapshot !== this.#rolesSnapshot) {
        this.#rolesSnapshot = snapshot;
        this.#guard.changed();
      }
      const again = guard.replay(frame, kind === 'spoke' ? (name ?? '?') : client);
      if (again) wire.send(core.visibility.frame(again));
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
          if (isSubscriptionRequest(frame)) return subscriptionRequest(frame, connection);
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
        if (isClientRequest(frame) && (frame.type === 'crew.show' || frame.type === 'crew.set')) {
          const crew = core.crew;
          if (!crew) return peer.send(Dispatcher.#failure(frame.id, new Error('this hub has no crew configuration')));
          const value = () => ({ config: crew.get(), summary: crewSummary(crew.get()) });
          if (frame.type === 'crew.show') return peer.send({ type: 'result', id: frame.id, ok: true, value: value() });
          const authorize = () => {
            const now = this.#asSession(frame);
            if (caller && (!now || now.sessionId !== caller.sessionId || !['coordinator', 'lead', 'aide'].includes(now.role ?? ''))) throw new ToolForbidden(now?.role ?? null, 'crew.set', 'crew editing belongs to the Coordinator, a Lead, an Aide or the human');
          };
          if (caller && !['coordinator', 'lead', 'aide'].includes(caller.role ?? '')) return this.#refuse(caller, frame, peer, 'crew.set', 'crew editing belongs to the Coordinator, a Lead, an Aide or the human');
          const resumed = this.#guard.resumer(frame.type, client);
          return later(frame.type, crew.set(frame.key, frame.value, resumed, authorize).then(
            () => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: value() })),
            err => resumed(() => Dispatcher.#failure(frame.id, err)),
          ));
        }
        if (frame.type === 'suite.start' && isClientRequest(frame)) {
          if (!this.#suites) return peer.send(Dispatcher.#failure(frame.id, new Error('this hub serves no project for suites')));
          const request = frame as import('../protocol.ts').SuiteStart;
          if (!isAbsolute(request.cwd)) return peer.send(Dispatcher.#failure(frame.id, new Error('suite cwd must be absolute')));
          const topic = core.store.topic(request.report)?.id ?? (caller ? this.#options.tracker?.list().find(i => i.claim?.sessionId === caller.sessionId)?.topic : GENERAL.id);
          if (!topic) return peer.send(Dispatcher.#failure(frame.id, new Error('a session report needs your claimed item topic; use --report <topic>')));
          const to = core.store.topic(request.report) ? request.to ?? [] : request.to ?? [request.report];
          const actor = caller ? { name: caller.name, sessionId: caller.sessionId, shell: true as const } : null;
          const authorize = () => { this.#suitePermissions(actor, topic, to); };
          try { authorize(); } catch (error) { return peer.send(Dispatcher.#failure(request.id, error)); }
          later('suite.start', this.#suites.start({ mode: request.mode, cwd: request.cwd, topic, to, actor }, authorize).then(value => ({ type: 'result', id: request.id, ok: true, value }), error => Dispatcher.#failure(request.id, error)));
          return;
        }
        if (isSubscriptionRequest(frame)) return subscriptionRequest(frame, caller);
        if (isSessionRequest(frame)) return session(frame);
        if (frame.type === 'artifact.keep' || frame.type === 'artifact.archive' || frame.type === 'artifact.move') return artifactChange(frame as ArtifactKeep | ArtifactArchive | ArtifactMove, () => this.#asSession(frame));
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
