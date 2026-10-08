// The tracker's requests: the same frames from a spoke (WebSocket, the `task.*` tools) and from the CLI
// (Unix socket). Field names follow the item's frontmatter (`blocked_by`), so a frame reads like the file.
import { KINDS, parseVerdictFilter, STATES, type Kind, type State } from './item.ts';
import type { HubFrame } from '../protocol.ts';
import { nameRefusal, ROLE_NAMES } from '../names.ts';
import type { Connection } from '../hub/core.ts';
import { TrackerError, type Actor, type Tracker, type VerdictInput } from './tracker.ts';
import { importIssues, type ImportRequest } from './import-github.ts';

export type TaskRequest =
  | {
      type: 'task.create';
      id: string;
      title: string;
      kind?: Kind;
      body?: string;
      labels?: string[];
      assignee?: string | null;
      parent?: string | null;
      blocked_by?: string[];
      topic?: string | null;
      branch?: string | null;
      as?: ActorField;
    }
  | { type: 'task.view'; id: string; item: string; as?: ActorField }
  | { type: 'task.list'; id: string; state?: State; labels?: string[]; kind?: Kind; assignee?: string; verdict?: string; as?: ActorField }
  | { type: 'task.comment'; id: string; item: string; text: string; verdict?: VerdictInput; as?: ActorField }
  | {
      type: 'task.edit';
      id: string;
      item: string;
      title?: string;
      body?: string;
      kind?: Kind;
      state?: State;
      labels?: string[];
      add_labels?: string[];
      remove_labels?: string[];
      assignee?: string | null;
      as?: ActorField;
    }
  | { type: 'task.close'; id: string; item: string; comment?: string; as?: ActorField }
  | { type: 'task.link'; id: string; item: string; parent?: string | null; blocked_by?: string[]; unblock?: string[]; topic?: string | null; branch?: string | null; as?: ActorField }
  | { type: 'task.claim'; id: string; item: string; release?: boolean; force?: boolean; as?: ActorField }
  | (ImportRequest & { as?: ActorField });

/** Who a CLI request acts as; a spoke's requests always act as the spoke's own session. `sessionId` is the launched
 *  session's own (`CLAND_SESSION_ID`): with it, or with a name the hub knows as a session, the call is that
 *  session's, checked against its role and audited as it. */
export type ActorField = { name: string; role?: string | null; sessionId?: string };

export const TASK_REQUEST_TYPES = ['task.create', 'task.view', 'task.list', 'task.comment', 'task.edit', 'task.close', 'task.link', 'task.claim', 'task.import'] as const;

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

/** Answer one task request; throws a TrackerError with a message meant for the asker. */
export function handleTaskRequest(tracker: Tracker, frame: TaskRequest, actor: Actor): unknown {
  const f = frame as unknown as Record<string, unknown>;
  for (const k of ['title', 'body', 'text', 'comment']) optStr(f, k);
  for (const k of ['assignee', 'parent', 'topic', 'branch']) optNullableStr(f, k);
  for (const k of ['labels', 'add_labels', 'remove_labels', 'blocked_by', 'unblock']) optList(f, k);
  if (f.kind !== undefined && !KINDS.includes(f.kind as Kind)) throw new TrackerError(`unknown kind "${String(f.kind)}" (one of ${KINDS.join(', ')})`);
  if (f.state !== undefined && !STATES.includes(f.state as State)) throw new TrackerError(`unknown state "${String(f.state)}" (open or closed)`);
  switch (frame.type) {
    case 'task.create': {
      if (!isStr(f.title)) throw new TrackerError('`title` is required');
      const { type: _t, id: _i, as: _a, ...input } = frame;
      return { item: tracker.create(actor, input) };
    }
    case 'task.view':
      return { item: tracker.view(needItem(f)) };
    case 'task.list': {
      let verdict;
      if (frame.verdict !== undefined) {
        verdict = isStr(frame.verdict) ? parseVerdictFilter(frame.verdict) : null;
        if (!verdict) throw new TrackerError(`verdict filter "${String(frame.verdict)}" must be review|qa=clear|not clear`);
      }
      return {
        items: tracker.list({
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
      return { item: tracker.comment(actor, needItem(f), frame.text ?? '', frame.verdict) };
    }
    case 'task.edit': {
      const { type: _t, id: _i, as: _a, item: _item, ...input } = frame;
      return { item: tracker.edit(actor, needItem(f), input) };
    }
    case 'task.close':
      return { item: tracker.close(actor, needItem(f), frame.comment) };
    case 'task.link': {
      const { type: _t, id: _i, as: _a, item: _item, ...input } = frame;
      return { item: tracker.link(actor, needItem(f), input) };
    }
    case 'task.claim':
      return tracker.claim(actor, needItem(f), { release: frame.release === true, force: frame.force === true });
    case 'task.import':
      return importIssues(tracker, actor, frame);
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
  if (a === undefined || a === null) return { id: HUMAN, name: HUMAN, role: null };
  if (typeof a !== 'object' || !isStr((a as ActorField).name)) throw new TrackerError('`as` must be { name, role? }');
  const name = (a as ActorField).name;
  const role = (a as ActorField).role ?? null;
  if (name !== HUMAN) {
    const refusal = nameRefusal(name);
    // quoted as JSON: the refused text itself is never echoed raw
    if (refusal) throw new TrackerError(`cannot act as ${JSON.stringify(name)}: ${refusal.replace(`name "${name}"`, 'the name')}`);
  }
  if (role !== null && !(isStr(role) && ROLE_NAMES.includes(role))) throw new TrackerError(`role ${JSON.stringify(role)} is not one of ${ROLE_NAMES.join(', ')}`);
  return { id: name === HUMAN ? HUMAN : `cli:${name}`, name, role };
}

/** The actor a spoke's frame acts as: always its own session, held by its session id (by its name when it gave none). */
export const sessionActor = (c: Pick<Connection, 'name' | 'sessionId' | 'role'>, unknownId: string): Actor => ({
  id: c.sessionId === unknownId ? `name:${c.name}` : c.sessionId,
  name: c.name,
  role: c.role,
});

/** A request's error for the wire: a TrackerError's own message, anything else prefixed. */
export const taskErrorMessage = (err: unknown): string => (err instanceof TrackerError ? err.message : `tracker failure: ${err instanceof Error ? err.message : String(err)}`);

/**
 * The result frame for one task request: the edges call this and send what it returns. `tracker` is
 * absent on a hub started without a project (the in-process test hub). `actor` is a spoke's session, or
 * `client` for a frame from the UI or the CLI, which acts as its `as` field.
 */
export function answerTask(tracker: Tracker | undefined, frame: TaskRequest, actor: Actor | 'client'): HubFrame {
  if (!tracker) return { type: 'result', id: frame.id, ok: false, error: 'this hub has no tracker: it was started without a project (`cland hub start` serves one)' };
  try {
    // a client's frame names who it acts as, checked here so a bad one is a failed result like any other
    return { type: 'result', id: frame.id, ok: true, value: handleTaskRequest(tracker, frame, actor === 'client' ? actorOf(frame) : actor) };
  } catch (err) {
    return { type: 'result', id: frame.id, ok: false, error: taskErrorMessage(err) };
  }
}
