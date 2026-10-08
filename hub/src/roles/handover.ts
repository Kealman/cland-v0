// Handing a role over (spec 4.4, ADR 0001, decision #10, #31): the role moves, the transcript never does. The next
// holder gets the clause, the handover note (four sections: goals now, work in flight, open decisions, waiting on;
// mandatory when the holder hands over, optional when the human reassigns) and, on demand, the role's state: the
// topics waiting for it, its open asks, its claims.
//
// The move itself is the core's (`HubCore.moveRole`: one store transaction, the notices, the events); this module
// reads and renders the note, moves the tracker claims with the role, and answers `role.state`.
import { UNKNOWN_SESSION, type HubCore } from '../hub/core.ts';
import { ROLE_LABELS, ROLE_NAMES } from '../names.ts';
import type { RoleHolder, RoleState } from '../protocol.ts';
import { isRoleRecord, parseNote, renderNote, type RoleRecord } from './note.ts';
import type { Tracker } from '../tracker/tracker.ts';

const label = (role: string) => ROLE_LABELS[role] ?? role;

/** Where a handover gets what it needs beyond the core: the tracker (claims) and the launched sessions. */
export type HandoverContext = {
  core: HubCore;
  tracker?: Tracker | undefined;
  /** A session the hub launched and that runs, by name: its cland session id. */
  launched?: (name: string) => { sessionId: string } | null;
};

/** The cland session id behind a name: its live spoke's, its launch's, or the one the store remembers. */
function sessionIdOf(ctx: HandoverContext, name: string): string | null {
  const live = ctx.core.presence().find((p) => p.name === name)?.sessionId;
  const id = live ?? ctx.launched?.(name)?.sessionId ?? ctx.core.store.sessionIdOf(name);
  if (!id) return null;
  return id === UNKNOWN_SESSION ? `name:${name}` : id;
}

/**
 * Move `role` to `to`: from its holder (`role.handover`, `by` the holder, note mandatory) or by the human (`role.set`
 * with a note or `move`, note optional). The tracker claims of the previous holder move to the new one with it; the
 * core moves the role in one store transaction, delivers the clause with the note and the revocation, and records
 * both in Agents. Throws `NoteIncomplete` for a note without its four sections.
 */
export function handOver(
  ctx: HandoverContext,
  args: { role: string; from: string | null; to: string; by: string; note: unknown; noteRequired: boolean; then?: string | null; requireKnown: boolean },
): RoleHolder {
  const note = args.note === undefined && !args.noteRequired ? null : parseNote(args.note);
  if (!ROLE_NAMES.includes(args.role)) throw new Error(`unknown role "${args.role}" (roles: ${ROLE_NAMES.join(', ')})`);
  const toId = sessionIdOf(ctx, args.to);
  if (args.requireKnown && !ctx.core.presence().some((p) => p.name === args.to) && !ctx.launched?.(args.to)) {
    throw new Error(`"${args.to}" is not a session the hub knows: hand the ${label(args.role)} role to a live session, or to one launched with \`session.launch\``);
  }
  const fromId = args.from !== null ? sessionIdOf(ctx, args.from) : null;
  const tracker = ctx.tracker;
  return ctx.core.moveRole({
    role: args.role,
    from: args.from,
    to: args.to,
    by: args.by,
    note,
    then: args.then ?? null,
    // before the store's transaction (the tracker is another connection to the same file): undone if the move fails
    beforeCommit: () => {
      if (!tracker || fromId === null || toId === null || fromId === toId) return () => {};
      return tracker.moveClaims(fromId, { name: args.to, id: toId, role: args.role }).undo;
    },
  });
}

/** How far back `role.state` reads a topic for messages waiting for the role. */
const WAITING_WINDOW = 200;

/**
 * The role's state for its holder (#31): its latest note and move, the topics waiting for it, its open asks (#33), the claims its holders hold. A topic waits for the role when its status says so (`waiting for agent`,
 * #32) and the human's latest message in it was delivered to the role's holders, or when a message addressed to the role or to one of its holders, the current ones and the one it moved from,
 * is newer than their last word in the topic.
 */
export function roleState(ctx: HandoverContext, role: string): RoleState {
  if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
  const { core } = ctx;
  const holders = core.roleList().roles.find((r) => r.role === role)?.holders ?? [];
  const stored = core.store.roleRecord(role);
  const record: RoleRecord = isRoleRecord(stored) ? stored : { note: null, handover: null };
  const names = new Set([role, ...holders.map((h) => h.name)]);
  if (record.handover?.from) names.add(record.handover.from);
  if (record.note && record.note.from !== 'human') names.add(record.note.from);

  const waiting: RoleState['waiting'] = [];
  for (const topic of core.topics()) {
    if (topic.status === 'closed') continue;
    const ref = { id: topic.id, title: topic.title };
    const { messages } = core.topicHistory(topic.id, WAITING_WINDOW);
    let lastWord = -1;
    messages.forEach((m, i) => {
      if (names.has(m.from)) lastWord = i;
    });
    const pending = messages.slice(lastWord + 1).filter((m) => !names.has(m.from) && m.to.some((t) => names.has(t.replace(/^@/, ''))));
    const last = pending.length ? (pending.at(-1) as { ts: string }).ts : topic.updatedAt;
    // the topic's status first (#32): it waits for an agent, and the human's latest message in it addressed this role
    if (topic.status === 'waiting for agent' && core.store.lastHumanAddressees(topic.id).some((n) => names.has(n))) {
      waiting.push({ topic: ref, status: topic.status, reason: 'status', pending: pending.length, last });
      continue;
    }
    // else a message addressed to the role or a holder, newer than their last word in the topic
    if (pending.length) waiting.push({ topic: ref, status: topic.status, reason: 'addressed', pending: pending.length, last });
  }

  const ids = new Set(holders.map((h) => sessionIdOf(ctx, h.name)).filter((id): id is string => id !== null));
  const claims: RoleState['claims'] = [];
  for (const item of ctx.tracker?.list() ?? []) {
    if (item.claim && (ids.has(item.claim.sessionId) || holders.some((h) => h.name === item.claim?.session && item.claim.sessionId === `name:${h.name}`))) {
      claims.push({ item: item.id, title: item.title, session: item.claim.session, sessionId: item.claim.sessionId, claimedAt: item.claim.claimedAt });
    }
  }

  return {
    role,
    label: label(role),
    holders,
    note: record.note ? { ...record.note, markdown: renderNote(record.note.sections) } : null,
    handover: record.handover,
    waiting,
    // the open asks the role put to the human (#33), by its holders or the one it moved from: a new Coordinator
    // inherits its predecessor's questions
    asks: core.inbox.list().asks.filter((a) => names.has(a.from)),
    claims,
  };
}
