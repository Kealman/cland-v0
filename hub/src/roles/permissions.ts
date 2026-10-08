// The hub's permission table (spec 4.4, decision #10 and its addendum, #30): which spoke tools each role may use,
// and how far. Seeded here from the spec; `[<role>.permissions] tools` in `.cland/roles.toml` replaces a role's
// list. The dispatcher asks `decide` on every spoke tool call, by the calling session's role at call time.
//
// A grant is `tool` (the tool, all of it) or `tool:scope` (only that part of it). Scopes:
//   send:agents          to sessions (names, globs, roles, `all`), never to the human
//   send:human           to the human (a `send` with no `to`). A session without it may still reply to the human
//                        in a topic while the human's latest message there addressed it or its role (spec 4.5:
//                        `@role` and `@name` pull it in), as long as the role has some `send` grant
//   task.claim:own       claim or release only the session's own item
//   task.comment:own     plain comments (not verdicts) only on the session's own item
//   task.comment:verdict verdict comments (the verdict header: verdict, result, run) on any item
//   topic.create:own     a topic only bound to the session's own item
// The session's own item is one it claims (the tracker's live claim, by session id) or whose `assignee` is its name.
// Tools that have no frame yet (`merge`, `artifact.create`) are in the table already: they are checked the
// day their frame arrives, through the same `decide`; `ask` (#33) has its frame. `resolve` and `topic.create` (#32) have theirs; `role.handover`
// (#31) is the Coordinator's; `role.state` is no table tool: a session reads the state of the role it holds (the
// dispatcher checks).
import { ROLE_LABELS } from '../names.ts';

/** Every tool the table knows: today's spoke frames and the ones still to come. */
export const KNOWN_TOOLS: readonly string[] = [
  'send',
  'who',
  'history',
  'status',
  'rename',
  'ask',
  'resolve',
  'topic.create',
  'task.create',
  'task.view',
  'task.list',
  'task.comment',
  'task.edit',
  'task.close',
  'task.link',
  'task.claim',
  'task.import',
  'session.launch',
  'role.handover',
  'merge',
  'artifact.create',
];

/** The scopes a tool can be granted in, beside the whole of it. */
export const SCOPES: Readonly<Record<string, readonly string[]>> = {
  send: ['agents', 'human'],
  'task.claim': ['own'],
  'task.comment': ['own', 'verdict'],
  'topic.create': ['own'],
};

const READS = ['who', 'history', 'status', 'task.view', 'task.list'];

/** The table as the spec seeds it; `roles.toml` writes the same lists. */
export const DEFAULT_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  coordinator: [
    'send',
    'ask',
    'resolve',
    'topic.create',
    'task.create',
    'task.edit',
    'task.close',
    'task.claim',
    'task.link',
    'task.comment',
    'session.launch',
    'role.handover',
    'merge',
    'artifact.create',
    'rename',
    ...READS,
  ],
  // names never change (spec 4.4): only the Coordinator renames (a rename never moves ownership: claims and
  // assignments are held by session id)
  implementer: ['send:agents', 'topic.create:own', 'task.claim:own', 'task.comment:own', 'artifact.create', ...READS],
  reviewer: ['send:agents', 'task.comment:verdict', 'artifact.create', ...READS],
  qa: ['send:agents', 'task.comment:verdict', 'artifact.create', ...READS],
};

/** Why a grant list is wrong, or null. `where` names it for the message (`reviewer.permissions.tools`). */
export function grantRefusal(grant: string, where: string): string | null {
  const [tool, scope, ...more] = grant.split(':');
  if (!tool || !KNOWN_TOOLS.includes(tool)) return `${where}: unknown tool "${grant}" (tools: ${KNOWN_TOOLS.join(', ')})`;
  if (more.length || scope === '') return `${where}: "${grant}" must be tool or tool:scope`;
  if (scope !== undefined && !(SCOPES[tool] ?? []).includes(scope)) {
    const known = SCOPES[tool];
    return `${where}: "${tool}" has no scope "${scope}"${known ? ` (scopes: ${known.join(', ')})` : ' (it takes no scope)'}`;
  }
  return null;
}

/**
 * One tool call as the table sees it: the tool, and the facts its scopes turn on. The dispatcher fills it from
 * the frame; `own` is asked only when a scope needs it (it reads the tracker).
 */
export type ToolCall = {
  tool: string;
  /** `send`: no addressee, so the message is for the human. */
  toHuman?: boolean;
  /** `send` to the human: whether the human's latest message in the target topic addressed the caller (by name or
   *  by its role), which lets it reply there without `send:human`. */
  mentioned?: () => boolean;
  /** `task.comment`: the comment carries a verdict. */
  verdict?: boolean;
  /** `task.comment` with a verdict: its kind (`review`, `qa`). */
  verdictKind?: string;
  /** The item the call is on (`task.*`), or the one a new topic binds to (`topic.create`). */
  item?: string | null;
  /** Whether `item` is the caller's own item; undefined when it does not exist (the tool's own error says so). */
  own?: () => boolean | undefined;
};

export type Decision = { ok: true } | { ok: false; permission: string; reason: string };

const label = (role: string) => ROLE_LABELS[role] ?? role;

/**
 * May a session holding `role` (null: none) make `call`, under `grants` (its role's list)? A refusal names the
 * permission that would have allowed it (`tool` or `tool:scope`) and says why, for the model and the human.
 */
export function decide(role: string | null, grants: readonly string[] | undefined, call: ToolCall): Decision {
  const { tool } = call;
  if (role === null) return { ok: false, permission: tool, reason: 'a session with no role has no tools' };
  // a Reviewer records review verdicts and QA records QA verdicts, whatever else its list grants
  const own = role === 'reviewer' ? 'review' : role === 'qa' ? 'qa' : null;
  if (tool === 'task.comment' && call.verdict && own !== null && call.verdictKind !== undefined && call.verdictKind !== own) {
    return { ok: false, permission: 'task.comment:verdict', reason: `${label(role)} may write only ${own === 'qa' ? 'QA' : 'review'} verdicts` };
  }
  const list = grants ?? [];
  const has = (g: string) => list.includes(g);
  if (has(tool)) return { ok: true };
  const scoped = list.filter((g) => g.startsWith(`${tool}:`));
  const who = label(role);
  if (!scoped.length) {
    // asking the human is the Coordinator's (spec 4.4): the one rule, here; the asks module checks nothing itself
    if (tool === 'ask') return { ok: false, permission: tool, reason: `only the Coordinator asks the human: ${who} may not ask; send the question to the coordinator instead` };
    return { ok: false, permission: tool, reason: `${who} may not use ${tool}` };
  }
  switch (tool) {
    case 'send':
      if (call.toHuman) {
        if (has('send:human') || call.mentioned?.()) return { ok: true };
        return { ok: false, permission: 'send:human', reason: `only the Coordinator writes to the human, and a session the human's latest message in the topic mentioned: ${who} sends to the coordinator instead` };
      }
      return has('send:agents') ? { ok: true } : { ok: false, permission: 'send:agents', reason: `${who} may write only to the human` };
    case 'task.comment': {
      if (call.verdict) {
        if (has('task.comment:verdict')) return { ok: true };
        return { ok: false, permission: 'task.comment:verdict', reason: `${who} may not write verdicts` };
      }
      if (has('task.comment:own')) {
        const own = call.own?.();
        if (own !== false) return { ok: true };
        return { ok: false, permission: 'task.comment', reason: `${who} may comment only on its own item (claimed by it or assigned to it)` };
      }
      return { ok: false, permission: 'task.comment', reason: `${who} may only comment verdicts` };
    }
    case 'task.claim':
    case 'topic.create': {
      const own = call.own?.();
      if (has(`${tool}:own`) && call.item && own !== false) return { ok: true };
      const what = tool === 'task.claim' ? 'claim only its own item (assigned to it or claimed by it)' : 'create a topic only bound to its own item';
      return { ok: false, permission: tool, reason: `${who} may ${what}` };
    }
    default:
      return { ok: false, permission: tool, reason: `${who} may not use ${tool}` };
  }
}

/**
 * A call the table refused, thrown by a handler that applies the table itself (`ask` on a hub with no role
 * definitions, #33): the dispatcher answers it with the same typed shape as its own refusals.
 */
export class ToolForbidden extends Error {
  readonly permission: string;
  readonly role: string | null;
  readonly reason: string;
  constructor(role: string | null, permission: string, reason: string) {
    super(`forbidden: ${permission} (${reason})`);
    this.permission = permission;
    this.role = role;
    this.reason = reason;
  }
}
