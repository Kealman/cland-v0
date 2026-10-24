// Handing a role over (spec 4.4, ADR 0001, decision #10, #31): the role moves, the transcript never does. The next
// holder gets the clause, the handover note (four sections: goals now, work in flight, open decisions, waiting on;
// mandatory when the holder hands over, optional when the human reassigns) and, on demand, the role's state: the
// topics waiting for it, its open asks, its claims.
//
// The move itself is the core's (`HubCore.moveRole`: one store transaction, the notices, the events); this module
// reads and renders the note, moves the tracker claims with the role, and answers `role.state`.
import { UNKNOWN_SESSION, type HubCore } from '../hub/core.ts';
import { ROLE_LABELS } from '../names.ts';
import type { RoleHolder, RoleState } from '../protocol.ts';
import { isRoleRecord, parseNote, renderNote, type PendingClaims, type RoleRecord } from './note.ts';
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
  args: { role: string; from: string | null; to: string; by: string; note: unknown; noteRequired: boolean; then?: string | null; requireKnown: boolean; item?: string },
): RoleHolder {
  if (args.item !== undefined && args.role !== 'lead') throw new Error('a node item is only valid for Lead handover');
  const note = args.note === undefined && !args.noteRequired ? null : parseNote(args.note);
  if (!ctx.core.roleNames().includes(args.role)) throw new Error(`unknown role "${args.role}" (roles: ${ctx.core.roleNames().join(', ')})`);
  const toId = args.role === 'lead' ? ctx.core.sessionIdentity(`name:${args.to}`) : sessionIdOf(ctx, args.to);
  if (args.requireKnown && !ctx.core.presence().some((p) => p.name === args.to) && !ctx.launched?.(args.to)) {
    throw new Error(`"${args.to}" is not a session the hub knows: hand the ${label(args.role)} role to a live session, or to one launched with \`session.launch\``);
  }
  const fromId = args.from !== null ? args.role === 'lead' ? ctx.core.sessionIdentity(`name:${args.from}`) : sessionIdOf(ctx, args.from) : null;
  // the claims to move are part of the move's record (one store transaction); the tracker moves them right after the
  // commit, from that record, and again at the next start if the hub died in between (the move is idempotent)
  // a transfer still pending from an earlier move (its receiver never connected) is carried along, never dropped
  const item = args.role === 'lead' && args.from !== null ? ctx.core.leadNode(args.from) : args.item;
  if (args.item && (!ctx.tracker?.resolveId(args.item) || ctx.tracker.resolveId(args.item) !== ctx.tracker.resolveId(item ?? ''))) throw new Error('Lead handover must name the current holder’s node');
  const recordKey = args.role === 'lead' ? `lead:${item}` : args.role;
  const stored = ctx.core.store.roleRecord(recordKey);
  const prior = isRoleRecord(stored) ? stored.claims : null;
  const sources = [...new Set([...(prior ? [prior.from, ...(prior.also ?? [])] : []), ...(fromId !== null ? [fromId] : [])])].filter((id) => id !== toId);
  const [first, ...also] = sources;
  const claims: PendingClaims | null = ctx.tracker && first !== undefined ? { from: first, ...(also.length ? { also } : {}), to: { name: args.to, id: toId, role: args.role }, ...(item ? { item } : {}) } : null;
  const holder = ctx.core.moveRole({ role: args.role, from: args.from, to: args.to, by: args.by, note, then: args.then ?? null, claims, ...(item ? { item } : {}) });
  // a test's crash between the commit and the claims' move (the replay at the next start finishes it)
  if (process.env.CLAND_TEST_CRASH_AT === 'handover-committed') process.kill(process.pid, 'SIGKILL');
  settleClaims(ctx, recordKey);
  return holder;
}

/**
 * Move the tracker claims a role's last move took along, if they are still pending: right after the move, at the
 * hub's start (a hub that died between the commit and the claims), and at the hello of a receiver that had no
 * session id when the role moved to its name. Idempotent: the tracker moves only what the previous holder still
 * holds, and the record is cleared once done.
 */
export function settleClaims(ctx: HandoverContext, role: string, hello?: { name: string; sessionId: string }): void {
  const { core, tracker } = ctx;
  if (!tracker) return;
  const stored = core.store.roleRecord(role);
  if (!isRoleRecord(stored) || !stored.claims) return;
  const pending = stored.claims;
  let toId = pending.to.id;
  if (toId === null) {
    // the receiver had no session yet: its first hello under that name gives the id
    if (!hello || hello.name !== pending.to.name) return;
    toId = hello.sessionId === UNKNOWN_SESSION ? `name:${hello.name}` : hello.sessionId;
  }
  const destination = core.sessionIdentity(toId);
  for (const from of new Set([pending.from, ...(pending.also ?? [])].flatMap(id => [id, core.sessionIdentity(id)]))) {
    if (destination !== from) tracker.moveClaims(from, { name: core.store.nameOfSession(destination) ?? pending.to.name, id: destination, role: pending.to.role }, pending.item);
  }
  core.store.saveRoleRecord(role, { ...stored, claims: null } satisfies RoleRecord);
}

/** Every role's pending claims: at the hub's start, and at each hello. */
export function settleAllClaims(ctx: HandoverContext, hello?: { name: string; sessionId: string }): void {
  // a failure leaves the record pending: the next start or hello tries again
  for (const { key } of ctx.core.store.roleRecords()) settleClaims(ctx, key, hello);
}

/** How far back `role.state` reads a topic for messages waiting for the role. */
const WAITING_WINDOW = 200;

/**
 * The role's state for its holder (#31): its latest note and move, the topics waiting for it, its open asks (#33), the claims its holders hold. A topic waits for the role when its status says so (`waiting for agent`,
 * #32) and the human's latest message in it was delivered to the role's holders, or when a message addressed to the role or to one of its holders, the current ones and the one it moved from,
 * is newer than their last word in the topic.
 */
export function roleState(ctx: HandoverContext, role: string, session?: string): RoleState {
  if (!ctx.core.roleNames().includes(role)) throw new Error(`unknown role "${role}" (roles: ${ctx.core.roleNames().join(', ')})`);
  const { core } = ctx;
  const allHolders = core.roleList().roles.find((r) => r.role === role)?.holders ?? [];
  if (role === 'lead' && !session) {
    if (allHolders.length !== 1) throw new Error('Lead role state needs a session when more than one Lead exists');
    session = allHolders[0]!.name;
  }
  const holders = role === 'lead' ? allHolders.filter(h => h.name === session) : allHolders;
  if (role === 'lead' && !holders.length) throw new Error(`${session} does not hold the Lead role`);
  const stored = core.roleRecord(role, session);
  const record: RoleRecord = isRoleRecord(stored) ? stored : { note: null, handover: null };
  const names = new Set([...(role === 'lead' ? [] : [role]), ...holders.map((h) => h.name)]);
  // every holder the role passed through, not only the latest one it moved from
  for (const n of record.chain ?? []) names.add(n);
  if (record.handover?.from) names.add(record.handover.from);
  if (record.handover?.to) names.add(record.handover.to);
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
    if (topic.status === 'waiting for agent' && (topic.waitingFor?.some(n => names.has(n)) || core.store.lastHumanAddressees(topic.id).some((n) => names.has(n)))) {
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

  const rawItem = record.item ?? (role === 'lead' ? claims[0]?.item : undefined);
  const item = rawItem ? ctx.tracker?.resolveId(rawItem) ?? rawItem : undefined;
  return {
    role,
    ...(item ? { item } : {}),
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
