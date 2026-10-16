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
//   task.criterion:done   done (claimant Implementer, Coordinator or Aide)
//   task.criterion:verify verify or fail (Reviewer or QA)
//   task.criterion:manage add, edit or remove (Coordinator or Aide)
//   task.edit:review     set only review on the Implementer's claimed item, with no other edits
//   task.comment:own     plain comments (not verdicts) only on the session's own item
//   task.comment:verdict verdict comments (the verdict header: verdict, result, run) on any item
//   topic.create:own     a topic only bound to the session's own item
// The session's own item is one it claims (the tracker's live claim, by session id) or is assigned (the hub binds an
// assignee to its session id: `assignees` in hub.db; an assignee the hub never bound goes to the first session of that
// name to act on it).
// Tools that have no frame yet (`merge`) are in the table already: they are checked the
// day their frame arrives, through the same `decide`; `ask` (#33) has its frame. `resolve` and `topic.create` (#32) have theirs; `role.handover`
// (#31) is the Coordinator's; `role.state` is no table tool: a session reads the state of the role it holds (the
// dispatcher checks).
import { NAME_RE, BUILTIN_RESERVED, ROLE_LABELS } from '../names.ts';
import { criterionRefusal } from '../tracker/criteria.ts';

/** Every tool the table knows: today's spoke frames and the ones still to come. */
export const KNOWN_TOOLS: readonly string[] = [
  'rule.add', 'rule.edit', 'rule.retire', 'rule.list',
  'subscribe',
  'unsubscribe',
  'subscriptions',
  'send',
  'who',
  'history',
  'status',
  'rename',
  'ask',
  'ask.forward',
  'ask.answer',
  'resolve',
  'topic.create',
  'task.create',
  'task.plan',
  'task.view',
  'task.list',
  'task.comment',
  'task.edit',
  'task.close',
  'task.link',
  'task.rank',
  'task.criterion',
  'task.claim',
  'task.hold',
  'task.import',
  'session.launch',
  'session.archive',
  'session.prune',
  // from the session's shell only (the `cland` CLI, T-49): the spoke has no such tools
  'session.stop',
  'session.resume',
  'hub.stop',
  'hub.reload',
  'role.handover',
  'merge',
  'release',
  'sync',
  'push',
  'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive',
  'artifact.promote',
  'inbox.decline', 'inbox.read',
];

/** The scopes a tool can be granted in, beside the whole of it. */
export const SCOPES: Readonly<Record<string, readonly string[]>> = {
  send: ['agents', 'human'],
  'task.plan': ['show', 'set', 'approve'],
  'task.claim': ['own'],
  'task.edit': ['review'],
  'task.criterion': ['done', 'verify', 'manage'],
  'task.comment': ['own', 'verdict'],
  'topic.create': ['own'],
};

const READS = ['subscribe', 'unsubscribe', 'subscriptions', 'who', 'history', 'status', 'task.view', 'task.list', 'rule.list'];

/** The table as the spec seeds it; `roles.toml` writes the same lists. */
export const DEFAULT_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  aide: [ 'rule.add', 'rule.edit', 'rule.retire', 'rule.list', 'task.plan', 'task.create', 'task.edit', 'task.close', 'task.link', 'task.comment', 'task.claim', 'task.criterion', 'task.view', 'task.list', 'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive', 'artifact.promote', 'send', 'topic.create', 'history', 'who', 'status'],
  coordinator: [
    'rule.add', 'rule.edit', 'rule.retire',
    'send',
    'ask',
    'ask.forward',
    'ask.answer',
    'resolve',
    'topic.create',
    'task.plan',
    'task.create',
    'task.edit',
    'task.close',
    'task.claim',
    'task.link',
    'task.rank',
    'task.criterion',
    'task.comment',
    'session.launch',
    'session.stop',
    'session.resume',
    'session.archive',
    'session.prune',
    'hub.stop',
    'hub.reload',
    'role.handover',
    'merge',
  'release',
  'sync',
  'push',
    'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive',
    'artifact.promote',
    'rename',
    ...READS,
  ],
  // names never change (spec 4.4): only the Coordinator renames (a rename never moves ownership: claims and
  // assignments are held by session id)
  lead: ['role.handover', 'task.plan:show', 'task.plan:set', 'ask.forward', 'ask.answer', 'send:agents', 'session.launch', 'session.stop', 'merge', 'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive', ...READS],
  implementer: ['ask.forward', 'ask.answer', 'send:agents', 'topic.create:own', 'task.claim:own', 'task.comment:own', 'task.edit:review', 'task.criterion:done', 'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive', ...READS, 'task.plan:show'],
  reviewer: ['send:agents', 'task.hold', 'task.comment:verdict', 'task.criterion:verify', 'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive', ...READS, 'task.plan:show'],
  qa: ['send:agents', 'task.hold', 'task.comment:verdict', 'task.criterion:verify', 'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive', ...READS, 'task.plan:show'],
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
  /** Live hierarchy admission, computed from indexed claims and session work. */
  levelRefusal?: string | null;
  /** Explicit launch role, or the role already assigned to the requested name. */
  launchRole?: string | null;
  /** Manual status edit: Coordinator or Aide, or the claiming Implementer handing over. */
  status?: unknown;
  criterionOp?: unknown;
  planOp?: unknown;
  statusOnly?: boolean;
  claimed?: () => boolean;
  /** `send`: no addressee, so the message is for the human. */
  toHuman?: boolean;
  request?: boolean;
  /** Explicit session addresses on a send; Aides address sessions by name only. */
  to?: string[];
  /** `send` to the human: whether the human's latest message in the target topic addressed the caller (by name or
   *  by its role), which lets it reply there without `send:human`. */
  mentioned?: () => boolean;
  /** `task.comment`: the comment carries a verdict. */
  verdict?: boolean;
  /** `task.comment` with a verdict: its kind (`review`, `qa`). */
  verdictKind?: string;
  /** A verdict also marks criteria, requiring the same grant as task.criterion verify/fail. */
  verdictCriteria?: boolean;
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
export function decide(role: string | null, grants: readonly string[] | undefined, input: ToolCall): Decision {
  // normalised before anything is decided: a blank item is no item (review of #32)
  const call: ToolCall = { ...input, item: typeof input.item === 'string' ? input.item.trim() || null : (input.item ?? null) };
  const { tool } = call;
  if (tool === 'inbox.decline' || tool === 'inbox.read') return { ok: false, permission: tool, reason: 'only the human acts on inbox rows' };
  // §3.7: every session may ask the human for review, QA or a handover.
  // The hub validates the request fields before recording anything.
  if (tool === 'send' && call.request) return { ok: true };
  if (role === null) return { ok: false, permission: tool, reason: 'a session with no role has no tools' };
  if (tool === 'session.launch' && call.launchRole === 'lead' && role !== 'coordinator') {
    return { ok: false, permission: tool, reason: 'root level: only the Coordinator launches Leads' };
  }
  if (tool === 'task.plan' && role === 'lead' && call.planOp !== 'show' && call.claimed?.() !== true) return { ok: false, permission: 'task.plan:set', reason: 'a Lead sets only its claimed epic plan' };
  if (tool === 'task.plan' && call.planOp === 'approve' && role !== 'aide') return { ok: false, permission: 'task.plan:approve', reason: 'only the human or an Aide approves a plan' };
  if (role === 'lead' && call.levelRefusal) return { ok: false, permission: tool, reason: call.levelRefusal };
  // v0.1 §3.3: an Aide's tool boundary and named addressing are fixed, even if its file grants more.
  if (role === 'aide') {
    if (!DEFAULT_PERMISSIONS.aide!.includes(tool)) return { ok: false, permission: tool, reason: `Aide rule (v0.1 §3.3): an Aide may not use ${tool}; its tools are limited to the tracker, artifacts, named sends, topics, history, who and status` };
    if (tool === 'send' && call.to?.some(tag => { const name = tag.trim().replace(/^@/, ''); return !NAME_RE.test(name) || BUILTIN_RESERVED.has(name); })) {
      return { ok: false, permission: 'send', reason: 'Aide rule (v0.1 §3.3): an Aide sends to sessions by name only, or to topics without addressees' };
    }
  }
  if (tool === 'ask' && role !== 'coordinator') return { ok: false, permission: tool, reason: 'only the Coordinator asks the human; forward an incoming question with ask.forward instead' };
  // a Reviewer records review verdicts and QA records QA verdicts, whatever else its list grants
  const own = role === 'reviewer' ? 'review' : role === 'qa' ? 'qa' : null;
  if (tool === 'task.comment' && call.verdict && own !== null && call.verdictKind !== undefined && call.verdictKind !== own) {
    return { ok: false, permission: 'task.comment:verdict', reason: `${label(role)} may write only ${own === 'qa' ? 'QA' : 'review'} verdicts` };
  }
  if (tool === 'task.edit' && call.status !== undefined && role !== 'coordinator' && role !== 'aide') {
    if (role !== 'implementer' || call.status !== 'review' || !call.statusOnly || call.claimed?.() !== true) {
      return { ok: false, permission: 'task.edit:review', reason: 'only the Coordinator or an Aide sets any status; an Implementer may set only review on its claimed item, without other edits' };
    }
  }
  if (tool === 'task.criterion') {
    const reason = criterionRefusal(call.criterionOp, { role, human: false, claimed: call.claimed?.() === true });
    if (reason) return { ok: false, permission: tool, reason };
  }
  if (tool === 'task.hold' && role !== 'reviewer' && role !== 'qa') return { ok: false, permission: tool, reason: 'only Reviewer and QA take verifier holds' };
  if (tool === 'task.comment' && call.verdictCriteria) {
    const decision = decide(role, grants, { tool: 'task.criterion', criterionOp: 'verify' });
    if (!decision.ok) return decision;
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
    case 'task.plan': {
      const scope = call.planOp === 'show' ? 'show' : call.planOp === 'approve' ? 'approve' : 'set';
      return has(`task.plan:${scope}`) ? { ok: true } : { ok: false, permission: `task.plan:${scope}`, reason: `${who} is not granted plan ${scope}` };
    }
    case 'task.criterion': {
      const scope = call.criterionOp === 'done' ? 'done' : call.criterionOp === 'verify' || call.criterionOp === 'fail' ? 'verify' : 'manage';
      return has(`task.criterion:${scope}`) ? { ok: true } : { ok: false, permission: `task.criterion:${scope}`, reason: `${who} is not granted criterion ${scope}` };
    }
    case 'task.edit':
      if (has('task.edit:review') && call.status === 'review' && call.statusOnly && call.claimed?.() === true) return { ok: true };
      return { ok: false, permission: 'task.edit:review', reason: `${who} may set only review on its claimed item, without other edits` };
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
      // positive ownership only: an item that cannot be looked up (gone, unreadable, blank) is not the caller's
      if (has(`${tool}:own`) && call.item && call.own?.() === true) return { ok: true };
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
