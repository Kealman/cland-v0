// The tracker's requests: the same frames from a spoke (WebSocket, the `task.*` tools) and from the CLI
// (Unix socket). Field names follow the item's frontmatter (`blocked_by`), so a frame reads like the file.
import { parseVerdictFilter, STATES, type Kind, type State, type Status, type Size } from './item.ts';
import type { HubFrame } from '../protocol.ts';
import { nameRefusal, ROLE_NAMES } from '../names.ts';
import type { Connection } from '../hub/core.ts';
import { TrackerError, type Actor, type Tracker, type VerdictInput } from './tracker.ts';
import { importIssues, type ImportRequest } from './import-github.ts';
import { isPlanningContainer } from './kinds.ts';
import { ToolForbidden } from '../roles/permissions.ts';

export type TaskRequest =
  | {
      type: 'task.create';
      id: string;
      title: string;
      kind?: Kind;
      size?: Size;
      version?: string;
      body?: string;
      labels?: string[];
      assignee?: string | null;
      parent?: string | null;
      blocked_by?: string[];
      regression_of?: string;
      topic?: string | null;
      branch?: string | null;
      as?: ActorField;
    }
  | { type: 'task.plan'; id: string; item?: string; op: 'set' | 'show' | 'migrate' | 'approve'; yaml?: string; reason?: string; as?: ActorField }
  | { type: 'task.view'; id: string; item: string; as?: ActorField }
  | { type: 'task.list'; id: string; under?: string; state?: State; labels?: string[]; kind?: Kind; assignee?: string; verdict?: string; as?: ActorField }
  | { type: 'task.criterion'; id: string; item: string; op: string; criterion?: string; text?: string; note?: string; run?: string; as?: ActorField }
  | { type: 'task.comment'; id: string; item: string; text: string; verdict?: VerdictInput; as?: ActorField }
  | {
      type: 'task.edit';
      status?: Status;
      version?: string | null;
      id: string;
      item: string;
      title?: string;
      body?: string;
      kind?: Kind;
      size?: Size;
      state?: State;
      labels?: string[];
      add_labels?: string[];
      remove_labels?: string[];
      assignee?: string | null;
      as?: ActorField;
    }
  | { type: 'task.close'; id: string; item: string; comment?: string; override?: string; as?: ActorField }
  | { type: 'task.link'; id: string; item: string; parent?: string | null; regression_of?: string | null; blocked_by?: string[]; unblock?: string[]; topic?: string | null; branch?: string | null; as?: ActorField }
  | { type: 'task.hold'; id: string; item: string; release?: boolean; as?: ActorField }
  | { type: 'task.rank'; id: string; item: string; top?: boolean; before?: string; after?: string; as?: ActorField }
  | { type: 'task.claim'; id: string; item: string; release?: boolean; force?: boolean; as?: ActorField }
  | (ImportRequest & { as?: ActorField });

/** Who a CLI request acts as; a spoke's requests always act as the spoke's own session. `sessionId` is the launched
 *  session's own (`CLAND_SESSION_ID`): with it, or with a name the hub knows as a session, the call is that
 *  session's, checked against its role and audited as it. `shell` says the identity is the calling shell's own
 *  (`$CLAND_SESSION_*`), not a name the human gave with `--as`: one the hub does not know is then a roleless session. */
export type ActorField = { name: string; role?: string | null; sessionId?: string; shell?: boolean };

export const TASK_REQUEST_TYPES = ['task.create', 'task.plan', 'task.view', 'task.list', 'task.comment', 'task.edit', 'task.close', 'task.link', 'task.rank', 'task.criterion', 'task.claim', 'task.hold', 'task.import'] as const;

export function isTaskRequest(f: Record<string, unknown>): f is TaskRequest {
  return typeof f.id === 'string' && (TASK_REQUEST_TYPES as readonly unknown[]).includes(f.type);
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const optStr = (f: Record<string, unknown>, k: string): void => {
  if (f[k] !== undefined && !isStr(f[k])) throw new TrackerError(`${k} must be a string`);
};
const optNullableStr = (f: Record<string, unknown>, k: string): void => {
  if (f[k] !== undefined && f[k] !== null && !isStr(f[k])) throw new TrackerError(`${k} must be a string or null`);
};
const optList = (f: Record<string, unknown>, k: string): void => {
  if (f[k] !== undefined && !(Array.isArray(f[k]) && (f[k] as unknown[]).every(isStr))) throw new TrackerError(`${k} must be a list of strings`);
};
const needItem = (f: Record<string, unknown>): string => {
  if (!isStr(f.item)) throw new TrackerError('`item` (the item id, T-<n>) is required');
  return f.item;
};

/** Answer one task request; rejects with a TrackerError with a message meant for the asker. */
export async function handleTaskRequest(tracker: Tracker, frame: TaskRequest, actor: Actor, resumed?: <T>(write: () => T) => T, currentActor?: () => Actor): Promise<unknown> {
  const authorize = () => { currentActor?.(); };
  const f = frame as unknown as Record<string, unknown>;
  for (const k of ['title', 'body', 'text', 'comment', 'under', 'override']) optStr(f, k);
  for (const k of ['assignee', 'parent', 'topic', 'branch', 'version']) optNullableStr(f, k);
  for (const k of ['labels', 'add_labels', 'remove_labels', 'blocked_by', 'unblock']) optList(f, k);
  if (f.kind !== undefined && !tracker.kinds.includes(f.kind as Kind)) throw new TrackerError(`unknown kind "${String(f.kind)}" (one of ${tracker.kinds.join(', ')})`);
  if (f.state !== undefined && !STATES.includes(f.state as State)) throw new TrackerError(`unknown state "${String(f.state)}" (open or closed)`);
  switch (frame.type) {
    case 'task.create': {
      if (!isStr(f.title)) throw new TrackerError('`title` is required');
      if ((frame.kind ?? 'task') === 'task' && frame.size === undefined) throw new TrackerError('a task needs a size: XS, S, M, L or XL');
      const { type: _t, id: _i, as: _a, ...input } = frame;
      return { item: await tracker.create(actor, input, resumed, authorize) };
    }
    case 'task.plan': {
      if (frame.op === 'migrate') return tracker.migrateQa(actor, resumed, authorize);
      optStr(f, 'yaml');
      optStr(f, 'reason');
      if (frame.op !== 'show' && frame.op !== 'set' && frame.op !== 'approve') throw new TrackerError('task.plan op must be set, show or approve');
      if (frame.op === 'set' && typeof frame.yaml !== 'string') throw new TrackerError('task.plan set needs yaml');
      const item = frame.op === 'approve' ? await tracker.approvePlan(actor, needItem(f), resumed, authorize) : frame.op === 'set' ? await tracker.setPlan(actor, needItem(f), frame.yaml!, resumed, authorize, frame.reason) : await tracker.viewAsync(needItem(f), resumed);
      if (!tracker.isPlanContainer(item.kind)) throw new TrackerError('a plan belongs only to an epic');
      return { id: item.id, plan: item.plan, approval: item.approval, stages: item.stages, history: item.planHistory, ...(item.planError ? { planError: item.planError } : {}) };
    }
    case 'task.view':
      return { item: await tracker.viewAsync(needItem(f), resumed) };
    case 'task.list': {
      let verdict;
      if (frame.verdict !== undefined) {
        verdict = isStr(frame.verdict) ? parseVerdictFilter(frame.verdict) : null;
        if (!verdict) throw new TrackerError(`verdict filter "${String(frame.verdict)}" must be review|qa=clear|not clear`);
      }
      return {
        items: tracker.list({
          ...(frame.under !== undefined ? { under: frame.under } : {}),
          ...(frame.state ? { state: frame.state } : {}),
          ...(frame.labels?.length ? { labels: frame.labels } : {}),
          ...(frame.kind ? { kind: frame.kind } : {}),
          ...(frame.assignee ? { assignee: frame.assignee } : {}),
          ...(verdict ? { verdict } : {}),
        }),
      };
    }
    case 'task.comment': {
      if (frame.text !== undefined && !isStr(frame.text)) throw new TrackerError('`text` must be a string');
      const v = frame.verdict as unknown;
      if (v !== undefined && (typeof v !== 'object' || v === null)) throw new TrackerError('`verdict` must be { verdict, result, run }');
      const item = await tracker.comment(actor, needItem(f), frame.text ?? '', frame.verdict, resumed, currentActor);
      const recorded = item.comments.at(-1)?.verdict;
      if (!recorded) return { item };
      const sha = recorded.commit ?? null;
      const source = frame.verdict?.commit !== undefined ? 'explicit' : sha ? 'branch' : 'none';
      const note = source === 'explicit' ? `verdict commit: ${sha}` : source === 'branch' ? `verdict records branch tip ${isPlanningContainer(item.kind, tracker.ladder) ? 'dev' : item.branch}: ${sha}` : 'verdict has no commit: the item has no resolving branch';
      return { item, commit: { sha, source, note } };
    }
    case 'task.criterion':
      for (const key of ['op', 'criterion', 'text', 'note', 'run']) optStr(f, key);
      return { item: await tracker.criterion(actor, needItem(f), frame, resumed, () => {
        const now = currentActor?.();
        if (now && (now.id !== actor.id || now.name !== actor.name || now.role !== actor.role || now.human !== actor.human)) throw new TrackerError('criterion writer changed; nothing was marked, retry');
      }) };
    case 'task.edit': {
      const { type: _t, id: _i, as: _a, item: _item, ...input } = frame;
      return { item: await tracker.edit(actor, needItem(f), input, resumed, authorize) };
    }
    case 'task.close':
      return { item: await tracker.close(actor, needItem(f), frame.comment, resumed, authorize, frame.override) };
    case 'task.link': {
      const { type: _t, id: _i, as: _a, item: _item, ...input } = frame;
      return { item: await tracker.link(actor, needItem(f), input, resumed, authorize) };
    }
    case 'task.hold':
      return tracker.hold(actor, needItem(f), frame.release === true, resumed, () => {
        const now = currentActor?.();
        if (now && (now.id !== actor.id || now.name !== actor.name || now.role !== actor.role)) throw new TrackerError('verifier changed while taking its hold; retry');
      });
    case 'task.rank': {
      const { type: _t, id: _i, as: _a, item: _item, ...input } = frame;
      return tracker.rank(actor, needItem(f), input, resumed, authorize);
    }
    case 'task.claim':
      return tracker.claim(actor, needItem(f), { release: frame.release === true, force: frame.force === true }, resumed, () => {
        const now = currentActor?.();
        if (now && (now.id !== actor.id || now.name !== actor.name || now.role !== actor.role)) throw new TrackerError('claiming session changed while the item was being written; nothing was written, retry');
      });
    case 'task.import':
      return importIssues(tracker, actor, frame, resumed, authorize);
  }
}

/** The person at the CLI when a frame names nobody. */
export const HUMAN = 'human';

/**
 * The actor a CLI frame names (`as`), or the human. The name and the role land in the item file (a comment's
 * header, a verdict's `by:`), so they are held to the session-name grammar and the role names: anything else
 * is refused, never written. A CLI actor is not a session: its identity is `cli:<name>` (`human` for the human).
 */
export function actorOf(frame: TaskRequest): Actor {
  const a = frame.as as unknown;
  if (a === undefined || a === null) return { id: HUMAN, name: HUMAN, role: null, human: true };
  if (typeof a !== 'object' || !isStr((a as ActorField).name)) throw new TrackerError('`as` must be { name, role? }');
  const name = (a as ActorField).name;
  const role = (a as ActorField).role ?? null;
  if (name !== HUMAN) {
    const refusal = nameRefusal(name);
    // quoted as JSON: the refused text itself is never echoed raw
    if (refusal) throw new TrackerError(`cannot act as ${JSON.stringify(name)}: ${refusal.replace(`name "${name}"`, 'the name')}`);
  }
  if (role !== null && !(isStr(role) && ROLE_NAMES.includes(role))) throw new TrackerError(`role ${JSON.stringify(role)} is not one of ${ROLE_NAMES.join(', ')}`);
  return { id: name === HUMAN ? HUMAN : `cli:${name}`, name, role, human: true };
}

/** The actor a spoke's frame acts as: always its own session, held by its session id (by its name when it gave none). */
export const sessionActor = (c: Pick<Connection, 'name' | 'sessionId' | 'role'>, unknownId: string): Actor => ({
  id: c.sessionId === unknownId ? `name:${c.name}` : c.sessionId,
  name: c.name,
  role: c.role,
  human: false,
});

/** A request's error for the wire: a TrackerError's own message, anything else prefixed. */
export const taskErrorMessage = (err: unknown): string => (err instanceof TrackerError ? err.message : `tracker failure: ${err instanceof Error ? err.message : String(err)}`);

/**
 * The result frame for one task request: the edges call this and send what it returns. `tracker` is
 * absent on a hub started without a project (the in-process test hub). `actor` is a spoke's session, or
 * `client` for a frame from the UI or the CLI, which acts as its `as` field.
 */
export async function answerTask(tracker: Tracker | undefined, frame: TaskRequest, actor: Actor | 'client', resumed?: <T>(write: () => T) => T, currentActor?: () => Actor): Promise<HubFrame> {
  if (!tracker) return { type: 'result', id: frame.id, ok: false, error: 'this hub has no tracker: it was started without a project (`cland hub start` serves one)' };
  try {
    // a client's frame names who it acts as, checked here so a bad one is a failed result like any other
    return { type: 'result', id: frame.id, ok: true, value: await handleTaskRequest(tracker, frame, actor === 'client' ? actorOf(frame) : actor, resumed, currentActor) };
  } catch (err) {
    if (err instanceof ToolForbidden) throw err;
    return { type: 'result', id: frame.id, ok: false, error: taskErrorMessage(err), ...(err instanceof TrackerError && err.code ? { code: err.code } : {}) };
  }
}
