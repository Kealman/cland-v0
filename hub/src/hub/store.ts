import { parseItemReference } from '../tracker/prefixes.ts';
import { idNumber } from '../tracker/item.ts';
const itemKey = (id: string): string => Number.isSafeInteger(idNumber(id)) ? `T-${idNumber(id)}` : id;
// The hub's memory: every message, every delivery's state, every session the hub has seen — one
// SQLite file through node:sqlite (WAL), or `:memory:` for tests.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { isHeldDelivery } from '../protocol.ts';
import type { Subscription, OwnedSubscription, SubscriptionSubject, Artifact, AgentsHistoryFilter, AskCard, AskState, DeliveryStage, Message, Topic, TopicMessage, TopicStatus } from '../protocol.ts';
import type { HygieneMemory, HygieneRow } from './hygiene.ts';
import type { InboxDeparture, InboxRowKind } from '../protocol.ts';
export type InboxWait = { kind: InboxRowKind; id: string; subject: string; since: string; text?: string };
import { vacancyWarning } from './topics.ts';

/** A delivery to one addressee: queued until its spoke acks it (delivered), injected once its adapter confirmed
 *  the turn, or dropped past the TTL. */
export type DeliveryState = 'delivered' | 'queued' | 'dropped' | 'injected' | 'uncertain';
export type KnownSession = { name: string; lastSeen: string; status: string | null; role: string | null };
export type ReleasedDigest = { trigger: string; session: string; notes: string[]; reheld: string[] };

export type HeartbeatSchedule = { sessionId: string; role: string; interval: number; last: number; next: number };
const SCHEMA = `
create table if not exists heartbeats (
  session_id text primary key, role text not null, interval_ms integer not null,
  last_at integer not null, next_at integer not null
);
create table if not exists heartbeat_item_states (
  item text primary key, status text not null, since integer not null
);

create table if not exists inbox_waits (
  kind text not null, id text not null, subject text not null, since text not null,
  primary key (kind, id)
);
create table if not exists inbox_departures (
  number integer primary key autoincrement, kind text not null, id text not null,
  subject text not null, since text not null, ts text not null, reason text not null
);
create index if not exists inbox_departures_row on inbox_departures (kind, id);
create index if not exists inbox_departures_time on inbox_departures (ts);
create table if not exists message_reads (id text primary key);
create table if not exists subscriptions (
  id text primary key,
  subscriber_id text not null,
  subject_json text not null,
  events_json text not null
);
create index if not exists subscriptions_owner on subscriptions (subscriber_id);
create index if not exists subscriptions_subject on subscriptions (subject_json);
create table if not exists subscription_usage (
  subscription_id text not null references subscriptions (id) on delete cascade,
  session_id text not null,
  above integer not null,
  primary key (subscription_id, session_id)
);
create table if not exists artifacts (
  number integer primary key autoincrement,
  value text not null
);
create table if not exists sessions (
  name text primary key,
  last_seen integer not null,
  status text,
  role text,
  session_id text
);
create table if not exists messages (
  id text primary key,
  from_name text not null,
  from_kind text not null,
  from_role text,
  via text not null,
  to_json text not null,
  text text not null,
  reply_to text,
  ts text not null,
  created_at integer not null
);
create index if not exists messages_created on messages (created_at);
create index if not exists messages_from on messages (from_name, created_at);
create table if not exists deliveries (
  message_id text not null references messages (id) on delete cascade,
  session text not null,
  state text not null,
  queued_at integer not null,
  delivered_at integer,
  primary key (message_id, session)
);
create index if not exists deliveries_session on deliveries (session, state, queued_at);
create table if not exists topics (
  id text primary key,
  title text not null,
  status text not null,
  standing integer not null default 0,
  created_at text not null,
  updated_at text not null
);
create table if not exists role_state (
  role text primary key,
  value text not null
);
create table if not exists asks (
  id text primary key,
  topic text not null,
  from_name text not null,
  question text not null,
  options_json text not null,
  free integer not null,
  state text not null,
  answer_id text,
  option integer,
  ts text not null,
  closed_at text
);
create index if not exists asks_open on asks (state, topic);
create table if not exists counters (
  name text primary key,
  value integer not null
);
create table if not exists assignees (
  item text primary key,
  name text not null,
  session_id text
);
create table if not exists meta (
  key text primary key,
  value text not null
);
create table if not exists launch_reservations (
  name text primary key,
  role text not null,
  previous text,
  at integer not null
);
create table if not exists hygiene (
  kind text not null,
  key text not null,
  value text not null,
  primary key (kind, key)
);
`;

/**
 * Columns added after a table's first shape. Each is added when the file lacks it, guarded by the
 * table's own `pragma table_info`, so a file written by an older hub grows in place and keeps every row.
 * Additive only: a column is never dropped or retyped here.
 */
const ADDED_COLUMNS: ReadonlyArray<{ table: string; column: string; type: string }> = [
  { table: 'inbox_waits', column: 'text', type: "text not null default ''" },
  { table: 'inbox_departures', column: 'text', type: "text not null default ''" },
  { table: 'messages', column: 'request_kind', type: 'text' },
  { table: 'messages', column: 'request_subject', type: 'text' },
  { table: 'asks', column: 'to_name', type: 'text' },
  { table: 'asks', column: 'to_session_id', type: 'text' },
  /** The actionable asker follows role handover; the original message sender remains historical. */
  { table: 'asks', column: 'from_session_id', type: 'text' },
  { table: 'asks', column: 'forwarded_id', type: 'text' },
  { table: 'sessions', column: 'status', type: 'text' },
  { table: 'sessions', column: 'role', type: 'text' },
  { table: 'sessions', column: 'session_id', type: 'text' },
  { table: 'messages', column: 'artifact', type: 'text' },
  { table: 'messages', column: 'artifacts', type: 'text' },
  { table: 'messages', column: 'criteria', type: 'text' },
  { table: 'messages', column: 'from_role', type: 'text' },
  { table: 'messages', column: 'reply_to', type: 'text' },
  { table: 'messages', column: 'topic', type: 'text' },
  /** The agent's send kind, or the hub notice's kind (`role`: a clause or revocation). */
  { table: 'messages', column: 'notice', type: 'text' },
  /** A notice's facts as JSON (`Message.detail`): a mute's refusal and pair; null for every other message. */
  { table: 'messages', column: 'notice_detail', type: 'text' },
  /** The item a topic is bound to (spec 4.5), null when unbound. */
  { table: 'topics', column: 'item', type: 'text' },
  /** The rowid of the last message the human read in the topic; superseded by `read_seq` (a rowid restarts once
   *  retention empties the table), and read once, by the migration to `read_seq`. */
  { table: 'topics', column: 'read_rowid', type: 'integer not null default 0' },
  /** A message's place in the hub's one monotonic sequence (`counters.message_seq`): never reused, whatever is pruned. */
  { table: 'messages', column: 'seq', type: 'integer' },
  /** The `seq` of the last message the human read in the topic (`topic.read`); 0: none. */
  { table: 'topics', column: 'read_seq', type: 'integer not null default 0' },
  /** The ask a human message answers (#33). */
  { table: 'messages', column: 'answer_to', type: 'text' },
  /** The session id behind a delivery's addressee name when it was recorded (or when a role's queue was claimed):
   *  what a grant tied to a delivery (the mention rule) is checked against, never the name. */
  { table: 'deliveries', column: 'session_id', type: 'text' },
  /** Addressing provenance: an explicit session name or claimed-item lead, rather than broadcast resolution.
   *  Old rows have no provenance and cannot establish a direct address. */
  { table: 'deliveries', column: 'direct', type: 'integer not null default 0' },
  /** A progress note's turn-starting delivery, fixed before transport and reused on every retry. */
  { table: 'deliveries', column: 'digest_id', type: 'text' },
  { table: 'deliveries', column: 'launch_brief', type: 'text' },
  { table: 'deliveries', column: 'launch_brief_ready', type: 'integer not null default 0' },
  { table: 'deliveries', column: 'event_count', type: 'integer not null default 1' },
  /** A lead's request waiting for selection, separate from ordinary vacant-role broadcasts. */
  { table: 'deliveries', column: 'verifier_item', type: 'text' },
  { table: 'deliveries', column: 'verifier_role', type: 'text' },
  { table: 'subscriptions', column: 'digest', type: "text not null default 'turn'" },
  { table: 'subscriptions', column: 'threshold_json', type: 'text' },
  /** The sender's session id, for an agent's message: a reply finds the sender after a rename. */
  { table: 'messages', column: 'from_session_id', type: 'text' },
];

/** Indexes over added columns: created after the migration, when the column surely exists. */
const LATE_INDEXES = `
create index if not exists messages_topic on messages (topic, created_at);
create unique index if not exists topics_item on topics (item) where item is not null;
create index if not exists messages_seq on messages (topic, seq);
create index if not exists messages_reply_to on messages (reply_to, seq);
create index if not exists deliveries_digest on deliveries (session, digest_id);
create index if not exists deliveries_verifier_queue on deliveries (verifier_item) where verifier_item is not null and state = 'queued';
`;

/**
 * The unread watermark's sequence, set up once the columns exist: rows written before it got their rowid (which was
 * the watermark then), the watermark moves to it, and the counter starts above every seq stored and every watermark,
 * never below: a pruned file keeps an old watermark with no message left to show it, and a new message numbered
 * under it would never be unread.
 */
const SEQ_SETUP = `
update messages set seq = rowid where seq is null;
update topics set read_seq = max(read_seq, coalesce(read_rowid, 0)) where read_rowid > read_seq;
insert into counters (name, value) values ('message_seq', 0) on conflict (name) do nothing;
update counters set value = max(value, (select coalesce(max(seq), 0) from messages), (select coalesce(max(read_seq), 0) from topics)) where name = 'message_seq';
`;

type Row = Record<string, string | number | null>;

const toMessage = (row: Row): Message => ({
  ...(typeof row.request_kind === 'string' ? { request: row.request_kind as NonNullable<Message['request']>, subject: row.request_subject as string } : {}),
  ...(typeof row.artifact === 'string' ? { artifact: JSON.parse(row.artifact) as Artifact } : {}),
  ...(typeof row.artifacts === 'string' ? { artifacts: JSON.parse(row.artifacts) as Artifact[] } : {}),
  ...(typeof row.criteria === 'string' ? { criteria: JSON.parse(row.criteria) as NonNullable<Message['criteria']> } : {}),
  id: row.id as string,
  from: row.from_name as string,
  fromKind: row.from_kind as Message['fromKind'],
  via: row.via as Message['via'],
  to: JSON.parse(row.to_json as string) as string[],
  text: row.text as string,
  ts: row.ts as string,
  ...(row.from_role !== null && row.from_role !== undefined ? { fromRole: row.from_role as string } : {}),
  ...(row.reply_to !== null && row.reply_to !== undefined ? { replyTo: row.reply_to as string } : {}),
  ...(row.topic !== null && row.topic !== undefined ? { topic: row.topic as string } : {}),
  ...(typeof row.notice === 'string' ? { kind: row.notice } : {}),
  ...(typeof row.notice_detail === 'string' ? { detail: JSON.parse(row.notice_detail) as Record<string, unknown> } : {}),
  ...(row.answer_to !== null && row.answer_to !== undefined ? { answerTo: row.answer_to as string } : {}),
});

/** An ask's row in the `asks` table (#33). */
export type AskRow = AskCard & { id: string; topic: string; from: string; ts: string; toSessionId?: string; fromSessionId?: string };

const toAsk = (row: Row): AskRow => ({
  id: row.id as string,
  topic: row.topic as string,
  from: row.from_name as string,
  ts: row.ts as string,
  question: row.question as string,
  options: JSON.parse(row.options_json as string) as string[],
  free: row.free === 1,
  state: row.state as AskState,
  ...(typeof row.to_name === 'string' ? { to: row.to_name as string } : {}),
  ...(typeof row.to_session_id === 'string' ? { toSessionId: row.to_session_id as string } : {}),
  ...(typeof row.from_session_id === 'string' ? { fromSessionId: row.from_session_id as string } : {}),
  ...(typeof row.forwarded_id === 'string' ? { forwarded: row.forwarded_id as string } : {}),
  ...(row.answer_id !== null && row.answer_id !== undefined ? { answer: row.answer_id as string } : {}),
  ...(row.option !== null && row.option !== undefined ? { option: Number(row.option) } : {}),
});

/** The card an ask's message carries. */
export const cardOf = (a: AskRow): AskCard => ({
  question: a.question,
  options: a.options,
  free: a.free,
  state: a.state,
  ...(a.to !== undefined ? { to: a.to } : {}),
  ...(a.forwarded !== undefined ? { forwarded: a.forwarded } : {}),
  ...(a.answer !== undefined ? { answer: a.answer } : {}),
  ...(a.option !== undefined ? { option: a.option } : {}),
});

const toTopic = (row: Row): Topic => {
  const vacant = vacancyWarning(typeof row.vacant_roles === 'string' && row.vacant_roles ? row.vacant_roles.split(',') : []);
  const waiting = typeof row.verifier_roles === 'string' && row.verifier_roles
    ? row.verifier_roles.split(',').map(role => `waiting for free ${role}`).join(', ') : undefined;
  const warning = [vacant, waiting].filter(Boolean).join(', ');
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as TopicStatus,
    standing: row.standing === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    item: (row.item as string | null) ?? null,
    unread: Number(row.unread ?? 0),
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    ...(warning ? { warning } : {}),
  };
};

/** A topic with what is derived from its messages: the human's unread count (messages from others past the
 *  last read), the latest message's time, and the roles a message in it still waits for (`@role` deliveries). */
const TOPIC_SELECT = `
select t.*, t.rowid as rid,
  (select count(*) from messages m where m.topic = t.id and m.seq > t.read_seq and m.from_kind != 'human'
    and not exists (select 1 from message_reads r where r.id = m.id)) as unread,
  (select max(m.ts) from messages m where m.topic = t.id) as last_message_at,
  (select group_concat(distinct substr(d.session, 2)) from deliveries d join messages m on m.id = d.message_id
     where m.topic = t.id and d.session like '@%' and d.verifier_item is null and d.state = 'queued') as vacant_roles,
  (select group_concat(distinct d.verifier_role) from deliveries d join messages m on m.id = d.message_id
     where m.topic = t.id and d.verifier_item is not null and d.state = 'queued') as verifier_roles
from topics t`;

/** A message's stage from its deliveries' states: queued while any waits; dropped only when all were; injected
 *  once every delivery that was not dropped was injected. */
const stageOf = (states: string[]): DeliveryStage | undefined => {
  if (states.length === 0) return undefined;
  if (states.includes('queued')) return 'queued';
  if (states.every((s) => s === 'dropped')) return 'dropped';
  if (states.every((s) => s === 'injected' || s === 'dropped')) return 'injected';
  return 'delivered';
};

const toKnown = (r: Row): KnownSession => ({
  name: r.name as string,
  lastSeen: new Date(r.last_seen as number).toISOString(),
  status: (r.status as string | null) ?? null,
  role: (r.role as string | null) ?? null,
});

/** Read a project's existing role mapping without opening a hub connection or changing its store. */
export function hasRoleMappedSession(path: string, sessionId: string): boolean {
  if (sessionId === 'unknown' || !existsSync(path)) return false;
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const row = db.prepare('select role from sessions where session_id = ? order by last_seen desc limit 1').get(sessionId);
    return typeof row?.role === 'string';
  } finally { db.close(); }
}

export class Store implements HygieneMemory {
  readonly #db: DatabaseSync;
  #itemResolver: (id: string) => string | null = () => null;

  setItemResolver(resolve: (id: string) => string | null): void { this.#itemResolver = resolve; }

  #canonicalItem(id: string): string { return this.#itemResolver(id) ?? id; }
  #canonicalTopic(topic: Topic): Topic { return topic.item ? { ...topic, item: this.#canonicalItem(topic.item) } : topic; }
  #subject(subject: SubscriptionSubject, display = false): SubscriptionSubject {
    const resolve = (id: string) => display ? this.#canonicalItem(id) : itemKey(id);
    return 'item' in subject ? { item: resolve(subject.item) } : 'subtree' in subject ? { subtree: resolve(subject.subtree) } : subject;
  }


  constructor(path: string = ':memory:') {
    this.#db = new DatabaseSync(path);
    // Init/update can open the live hub's store while it is committing a write.
    this.#db.exec('pragma busy_timeout = 5000;');
    this.#db.function('item_number', { deterministic: true }, raw => {
      if (typeof raw !== 'string') return null;
      const parsed = parseItemReference(raw);
      return parsed?.n ?? (this.#itemResolver(raw) ? idNumber(raw) : null);
    });
    this.#db.exec('pragma journal_mode = wal; pragma foreign_keys = on;');
    this.#db.exec(SCHEMA);
    this.#migrate();
    this.#db.exec(LATE_INDEXES);
    this.#db.exec(SEQ_SETUP);
  }

  #migrate(): void {
    const columns = new Map<string, Set<string>>();
    const columnsOf = (table: string): Set<string> => {
      let set = columns.get(table);
      if (!set) {
        set = new Set((this.#db.prepare(`pragma table_info(${table})`).all() as Row[]).map((r) => r.name as string));
        columns.set(table, set);
      }
      return set;
    };
    for (const { table, column, type } of ADDED_COLUMNS) {
      const have = columnsOf(table);
      if (have.size > 0 && !have.has(column)) {
        this.#db.exec(`alter table ${table} add column ${column} ${type}`);
        have.add(column);
      }
    }
  }

  close(): void {
    this.#db.close();
  }

  rememberSession(name: string, now: number): void {
    this.#db.prepare('insert into sessions (name, last_seen) values (?, ?) on conflict (name) do update set last_seen = excluded.last_seen').run(name, now);
  }

  /** Drop a session's record and whatever waited for it; returns how many queued deliveries went. */
  forgetSession(name: string): { queued: number } {
    const queued = Number(this.#db.prepare("delete from deliveries where session = ? and state = 'queued'").run(name).changes);
    this.#db.prepare('delete from sessions where name = ?').run(name);
    return { queued };
  }

  /** Only session bookkeeping. Historical messages, deliveries and subscriptions stay readable. */
  pruneSession(name: string, sessionId: string): void {
    this.transaction(() => {
      this.#db.prepare('delete from sessions where name = ? and (session_id = ? or session_id is null)').run(name, sessionId);
      this.#db.prepare('delete from launch_reservations where name = ?').run(name);
      this.#db.prepare('delete from subscription_usage where session_id = ?').run(sessionId);
      for (const prefix of ['pending-verification:', 'subscription-terminal:', 'pool-handoff:']) this.clearMeta(prefix + sessionId);
      this.#db.prepare("delete from meta where key like 'session-alias:%' and value = ?").run(sessionId);
      this.#db.prepare("delete from meta where key like 'verifier-request:%' and json_extract(value, '$.sessionId') = ?").run(sessionId);
    });
  }

  heartbeatSchedule(sessionId: string, role: string, interval: number, start: number): HeartbeatSchedule {
    const row = this.#db.prepare('select * from heartbeats where session_id = ?').get(sessionId) as Row | undefined;
    const last = row ? row.last_at as number : start;
    const next = row && row.role === role && row.interval_ms === interval ? row.next_at as number : last + interval;
    this.#db.prepare(`insert into heartbeats values (?, ?, ?, ?, ?) on conflict(session_id) do update
      set role=excluded.role, interval_ms=excluded.interval_ms, next_at=excluded.next_at`).run(sessionId, role, interval, last, next);
    return { sessionId, role, interval, last, next };
  }

  firedHeartbeat(schedule: HeartbeatSchedule, now: number): void {
    this.#db.prepare('update heartbeats set last_at = ?, next_at = ? where session_id = ?').run(now, now + schedule.interval, schedule.sessionId);
  }

  stopHeartbeat(sessionId: string): void { this.#db.prepare('delete from heartbeats where session_id = ?').run(sessionId); }

  heartbeatItemSince(item: string, status: string, initial: number, now: number): number {
    const row = this.#db.prepare('select * from heartbeat_item_states where item = ?').get(item) as Row | undefined;
    if (row?.status === status) return row.since as number;
    // Known transitions use observation time: a hand edit can retain an old frontmatter date.
    const since = row || !Number.isFinite(initial) ? now : Math.min(initial, now);
    this.#db.prepare('insert into heartbeat_item_states values (?, ?, ?) on conflict(item) do update set status=excluded.status, since=excluded.since').run(item, status, since);
    return since;
  }

  /** Each firing stays in history; only unbound, undelivered heartbeats are replaced. */
  replaceHeartbeat(session: string): void {
    this.#db.prepare(`update deliveries set state = 'dropped' where session = ? and state = 'queued'
      and digest_id is null and message_id in (select id from messages where notice = 'event'
      and json_extract(notice_detail, '$.event') = 'heartbeat')`).run(session);
  }

  pendingReview(item: string, since: number): boolean {
    return this.#db.prepare(`select 1 from messages m join deliveries d on d.message_id = m.id
      where m.created_at >= ? and d.state in ('queued', 'delivered', 'injected', 'uncertain')
      and (d.verifier_role = 'reviewer' or d.session in ('@reviewer', '@verifier:reviewer')
        or d.session in (select name from sessions where role = 'reviewer'))
      and lower(trim(replace(substr(m.text, 1, instr(m.text || char(10), char(10)) - 1), char(13), ''))) = ? limit 1`)
      .get(since, `review request ${item}`.toLowerCase()) !== undefined;
  }

  /** Sessions seen since `since` (ms epoch) — the ones `@all` or a glob still reaches; older ones are history. */
  knownSessions(since = 0): KnownSession[] {
    return (this.#db.prepare('select name, last_seen, status, role from sessions where last_seen >= ? order by name').all(since) as Row[]).map(toKnown);
  }

  /** A keepalive: the session is still here, so `last_seen` means what it says. */
  touchSession(name: string, now: number): void {
    this.#db.prepare('update sessions set last_seen = ? where name = ?').run(now, name);
  }

  /** The session's status line beside its row — what a reconnect of the same name gets back. */
  rememberStatus(name: string, status: string | null): void {
    this.#db.prepare('update sessions set status = ? where name = ?').run(status, name);
  }

  /** The remembered status of a name seen since `since` (ms epoch) by this same session, else null: a name older
   *  than the window is history, and another session's line is not this one's. */
  statusOf(name: string, since: number, sessionId: string): string | null {
    const row = this.#db.prepare('select status from sessions where name = ? and last_seen >= ? and session_id = ?').get(name, since, sessionId) as Row | undefined;
    return (row?.status as string | null | undefined) ?? null;
  }

  /** Every name the store knows, however old: a session row, a sender, an addressee or a delivery. A name a
   *  session renamed away from has no row, but its traffic still names it, so it is never generated again. */
  sessionNames(): string[] {
    return (
      this.#db
        .prepare(
          `select name from sessions
           union select from_name from messages
           union select session from deliveries
           union select t.value from messages m, json_each(m.to_json) t`,
        )
        .all() as Row[]
    ).map((r) => r.name as string);
  }

  /** The name a session last held, by its session id, or null. */
  nameOfSession(sessionId: string): string | null {
    const row = this.#db.prepare('select name from sessions where session_id = ? order by last_seen desc limit 1').get(sessionId) as Row | undefined;
    return (row?.name as string | undefined) ?? null;
  }

  /** The harness session behind a name: hygiene is keyed by it, so a rename changes nothing there. */
  rememberSessionId(name: string, sessionId: string): void {
    this.transaction(() => {
      this.#db.prepare('update sessions set session_id = ? where name = ?').run(sessionId, name);
      // A never-connected handover target has only name:<target>. Binding adopts both ask endpoints,
      // including retained aliases during tracker adoption, before a rename can remove that name's row.
      if (sessionId === 'unknown') return;
      const names = new Set([name, ...this.sessionAliases().filter(a => a.id === sessionId).map(a => a.name)]);
      const adopt = this.#db.prepare("update asks set to_session_id = case when to_session_id = ? then ? else to_session_id end, from_session_id = case when from_session_id = ? then ? else from_session_id end where state = 'open' and (to_session_id = ? or from_session_id = ?)");
      for (const n of names) {
        adopt.run(`name:${n}`, sessionId, `name:${n}`, sessionId, `name:${n}`, `name:${n}`);
        // Node notes and ownership also start provisional for human moves to unseen Leads.
        this.#db.prepare("update role_state set value = json_set(value, '$.holderId', ?) where json_extract(value, '$.holderId') = ?").run(sessionId, `name:${n}`);
        this.#db.prepare("update role_state set value = json_set(value, '$.noteToId', ?) where json_extract(value, '$.noteToId') = ?").run(sessionId, `name:${n}`);
      }
    });
  }

  sessionIdOf(name: string): string | null {
    const row = this.#db.prepare('select session_id from sessions where name = ?').get(name) as Row | undefined;
    return (row?.session_id as string | null | undefined) ?? null;
  }

  rememberRole(name: string, role: string | null): void {
    this.#db.prepare('update sessions set role = ? where name = ?').run(role, name);
  }

  /** The role a name holds, as the hub last recorded it, or null. */
  roleOf(name: string): string | null {
    const row = this.#db.prepare('select role from sessions where name = ?').get(name) as Row | undefined;
    return (row?.role as string | null | undefined) ?? null;
  }

  /** The notices of one kind still waiting for a session (queued, or accepted and not injected) are superseded:
   *  marked dropped and detached from any initial launch batch, so a retry cannot carry stale authority.
   *  Returns their ids. */
  dropNotices(session: string, notice: string): string[] {
    return (
      this.#db
        .prepare(
          `update deliveries set state = 'dropped', digest_id = null where session = ? and state in ('queued', 'delivered', 'uncertain')
           and message_id in (select id from messages where notice = ?) returning message_id`,
        )
        .all(session, notice) as Row[]
    ).map((r) => r.message_id as string);
  }

  /** An Aide keeps direct addresses and its role clause, including direct notes bound to a discarded broadcast. */
  dropCrewDeliveries(session: string): { dropped: string[]; reheld: string[] } {
    return this.#transaction(() => {
      const dropped = (this.#db.prepare(`update deliveries set state = 'dropped', digest_id = null where session = ?
        and state in ('queued', 'delivered', 'uncertain') and direct = 0
        and message_id in (select id from messages where coalesce(notice, '') <> 'role')
        returning message_id`).all(session) as Row[]).map(row => row.message_id as string);
      // A named progress note can outlive the broadcast that was going to carry it. Hold it for the next direct turn.
      const reheld = (this.#db.prepare(`update deliveries set digest_id = null, state = 'queued', delivered_at = null
        where session = ? and state in ('queued', 'delivered', 'uncertain') and direct = 1
        and digest_id in (select message_id from deliveries where session = ? and state = 'dropped')
        returning message_id`).all(session, session) as Row[]).map(row => row.message_id as string);
      return { dropped, reheld };
    });
  }

  /** One value the hub keeps beside its rows (the Agents journal's checkpoint), or null. */
  meta(key: string): string | null {
    const row = this.#db.prepare('select value from meta where key = ?').get(key) as Row | undefined;
    return (row?.value as string | undefined) ?? null;
  }

  setMeta(key: string, value: string): void {
    this.#db.prepare('insert into meta (key, value) values (?, ?) on conflict (key) do update set value = excluded.value').run(key, value);
  }

  clearMeta(key: string): void { this.#db.prepare('delete from meta where key = ?').run(key); }

  /** A provisional tracker identity kept while its real session renames during failed adoption. */
  sessionAlias(name: string): string | null { return this.meta(`session-alias:${name}`); }

  sessionAliases(): Array<{ name: string; id: string }> {
    const rows = this.#db.prepare("select key, value from meta where key like 'session-alias:%'").all() as Row[];
    return rows.map(row => ({ name: (row.key as string).slice('session-alias:'.length), id: row.value as string }));
  }

  preserveSessionAlias(name: string, id: string): void { this.setMeta(`session-alias:${name}`, id); }

  settleSessionAlias(name: string, id: string): void {
    this.#db.prepare('delete from meta where key = ? and value = ?').run(`session-alias:${name}`, id);
  }

  /** A launch reserved `role` for `name` (what the name held before: `previous`); cleared once its process row is
   *  written or the launch gave the role back. One left at a start belongs to a launch the hub died in. */
  saveReservation(name: string, role: string, previous: string | null, at: number): void {
    this.#db.prepare('insert into launch_reservations (name, role, previous, at) values (?, ?, ?, ?) on conflict (name) do update set role = excluded.role, previous = excluded.previous, at = excluded.at').run(name, role, previous, at);
  }

  dropReservation(name: string): void {
    this.#db.prepare('delete from launch_reservations where name = ?').run(name);
  }

  reservations(): Array<{ name: string; role: string; previous: string | null }> {
    return (this.#db.prepare('select name, role, previous from launch_reservations order by name').all() as Row[]).map((r) => ({ name: r.name as string, role: r.role as string, previous: (r.previous as string | null) ?? null }));
  }

  /** The names holding a role, seen since `since` — a role as a tag resolves to these. */
  sessionsWithRole(role: string, since = 0): string[] {
    return (this.#db.prepare('select name from sessions where role = ? and last_seen >= ? order by name').all(role, since) as Row[]).map((r) => r.name as string);
  }

  /** Hygiene's state, as it last wrote it: rate windows, pair counts, mutes. */
  hygieneRows(): HygieneRow[] {
    return (this.#db.prepare('select kind, key, value from hygiene').all() as Row[]).map((r) => ({ kind: r.kind as HygieneRow['kind'], key: r.key as string, value: r.value as string }));
  }

  /** One window as visible in the current transaction, including any rollback. */
  hygieneValue(kind: HygieneRow['kind'], key: string): string | null {
    const row = this.#db.prepare('select value from hygiene where kind = ? and key = ?').get(kind, key) as Row | undefined;
    return row ? row.value as string : null;
  }

  /** One piece of hygiene's state; null forgets it. */
  saveHygiene(kind: HygieneRow['kind'], key: string, value: string | null): void {
    if (value === null) this.#db.prepare('delete from hygiene where kind = ? and key = ?').run(kind, key);
    else this.#db.prepare('insert into hygiene (kind, key, value) values (?, ?, ?) on conflict (kind, key) do update set value = excluded.value').run(kind, key, value);
  }

  /** A role's state as the hub keeps it (#31: its handover note and its latest move), as JSON, or null. */
  roleRecord(role: string): unknown {
    if (role.startsWith('lead:')) role = `lead:${itemKey(role.slice(5))}`;
    const row = this.#db.prepare('select value from role_state where role = ?').get(role) as Row | undefined;
    return row ? (JSON.parse(row.value as string) as unknown) : null;
  }

  /** Node-scoped Lead records also need replay after a crash. */
  roleRecords(): Array<{ key: string; value: unknown }> {
    return (this.#db.prepare('select role, value from role_state').all() as Row[]).map(row => ({ key: row.role as string, value: JSON.parse(row.value as string) as unknown }));
  }

  saveRoleRecord(role: string, value: unknown): void {
    if (role.startsWith('lead:')) role = `lead:${itemKey(role.slice(5))}`;
    this.#db.prepare('insert into role_state (role, value) values (?, ?) on conflict (role) do update set value = excluded.value').run(role, JSON.stringify(value));
  }

  /** Run `fn` in one transaction (a role's move, #31): all of its writes land, or none does, the messages it records
   *  included. */
  transaction<T>(fn: () => T): T {
    return this.#transaction(fn);
  }

  /** How deep the running transaction is nested: an inner one joins the outer (a role's move records its notices). */
  #depth = 0;
  #afterCommit: Array<() => void> = [];

  /** Publication inside a nested artifact/post write waits for the outer commit; rollback discards it. */
  afterCommit(publish: () => void, failed: (error: unknown) => void): void {
    const observe = () => {
      try { publish(); }
      catch (error) {
        try { failed(error); }
        catch { /* an error observer cannot turn a committed write into a failed write */ }
      }
    };
    if (this.#depth) this.#afterCommit.push(observe);
    else observe();
  }

  /** Run `fn` in one transaction: all of its writes land, or none does. Nested, it is part of the outer one. */
  #transaction<T>(fn: () => T): T {
    if (this.#depth > 0) {
      this.#depth++;
      try {
        return fn();
      } finally {
        this.#depth--;
      }
    }
    this.#db.exec('begin immediate');
    this.#depth = 1;
    let result: T;
    try {
      result = fn();
      this.#db.exec('commit');
    } catch (err) {
      this.#db.exec('rollback');
      this.#afterCommit = [];
      throw err;
    } finally {
      this.#depth = 0;
    }
    const publications = this.#afterCommit;
    this.#afterCommit = [];
    for (const publish of publications) publish();
    return result;
  }

  /** Record a message and the state of each addressee's delivery, together: a message is never stored with
   *  only some of its deliveries. */
  record(message: Message, deliveries: Array<{ session: string; state: DeliveryState; direct?: boolean }>, now: number, notice: string | null = null, bindHeld = true): void {
    this.#transaction(() => {
      const seq = Number((this.#db.prepare("update counters set value = value + 1 where name = 'message_seq' returning value").get() as Row).value);
      this.#db
        .prepare('insert into messages (id, from_name, from_kind, from_role, via, to_json, text, reply_to, ts, created_at, topic, notice, notice_detail, answer_to, seq) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(
          message.id,
          message.from,
          message.fromKind,
          message.fromRole ?? null,
          message.via,
          JSON.stringify(message.to),
          message.text,
          message.replyTo ?? null,
          message.ts,
          now,
          message.topic ?? null,
          notice ?? message.kind ?? null,
          message.detail ? JSON.stringify(message.detail) : null,
          message.answerTo ?? null,
          seq,
        );
      if (message.criteria !== undefined) this.#db.prepare('update messages set criteria = ? where id = ?').run(JSON.stringify(message.criteria), message.id);
      if (message.request !== undefined) this.#db.prepare('update messages set request_kind = ?, request_subject = ? where id = ?').run(message.request, message.subject ?? null, message.id);
      if (message.artifact) this.#db.prepare('update messages set artifact = ? where id = ?').run(JSON.stringify(message.artifact), message.id);
      if (message.artifacts?.length) {
        this.#db.prepare('update messages set artifacts = ? where id = ?').run(JSON.stringify(message.artifacts), message.id);
        // Status and post commit together, before the core publishes either. A failed status write rolls back the post.
        for (const a of message.artifacts) if (a.kind === 'prompt' && a.status === 'sent' && !a.movedTo) {
          const current = this.artifact(a.id);
          if (current && !current.movedTo) this.updateArtifact({ ...current, status: 'sent' });
        }
      }
      if (message.fromKind === 'agent') this.#db.prepare('update messages set from_session_id = (select session_id from sessions where name = ?) where id = ?').run(message.from, message.id);
      // each addressee's session id as the hub knows it now: a later holder of the name is not this addressee
      const insert = this.#db.prepare('insert into deliveries (message_id, session, state, queued_at, delivered_at, session_id, direct) values (?, ?, ?, ?, ?, (select session_id from sessions where name = ?), ?)');
      for (const d of deliveries) insert.run(message.id, d.session, d.state, now, d.state === 'delivered' ? now : null, d.session, d.direct ? 1 : 0);
      // Binding and recording are one synchronous transaction: no awaited transport can claim these notes twice.
      // Role clauses on reconnect establish authority, but leave held progress for the next ordinary delivery.
      const kind = notice ?? message.kind;
      if (bindHeld && !isHeldDelivery({ kind, ...(message.detail ? { detail: message.detail } : {}) }) && kind !== 'role') {
        for (const d of deliveries) if (d.state === 'queued') this.#bindProgress(message.id, d.session, seq);
      }
    });
  }

  allSubscriptions(): OwnedSubscription[] {
    return (this.#db.prepare('select * from subscriptions order by rowid').all() as Row[]).map(row => ({
      id: row.id as string, subscriberId: row.subscriber_id as string,
      subject: this.#subject(JSON.parse(row.subject_json as string), true), events: JSON.parse(row.events_json as string),
      digest: row.digest as Subscription['digest'],
      ...(row.threshold_json ? { threshold: JSON.parse(row.threshold_json as string) } : {}),
    }));
  }

  subscriptions(subscriberId: string): Subscription[] {
    return this.allSubscriptions().filter(s => s.subscriberId === subscriberId).map(({ subscriberId: _, ...s }) => s);
  }

  addSubscription(subscriberId: string, subscription: Subscription): Subscription {
    return this.#transaction(() => {
      const existing = this.subscriptions(subscriberId).find(s => JSON.stringify([this.#subject(s.subject), s.events, s.digest, s.threshold]) === JSON.stringify([this.#subject(subscription.subject), subscription.events, subscription.digest, subscription.threshold]));
      if (existing) return existing;
      this.#db.prepare('insert into subscriptions (id, subscriber_id, subject_json, events_json, digest, threshold_json) values (?, ?, ?, ?, ?, ?)')
        .run(subscription.id, subscriberId, JSON.stringify(this.#subject(subscription.subject)), JSON.stringify(subscription.events), subscription.digest, subscription.threshold ? JSON.stringify(subscription.threshold) : null);
      return { ...subscription, subject: this.#subject(subscription.subject, true) };
    });
  }

  removeSubscription(subscriberId: string, id: string): boolean {
    return this.#db.prepare('delete from subscriptions where id = ? and subscriber_id = ?').run(id, subscriberId).changes > 0;
  }

  endSubscriptions(subscriberId: string): void {
    this.#db.prepare('delete from subscriptions where subscriber_id = ?').run(subscriberId);
  }

  endSubject(subject: SubscriptionSubject): void {
    this.#db.prepare('delete from subscriptions where subject_json = ?').run(JSON.stringify(this.#subject(subject)));
  }

  usageCrossed(subscription: string, sessionId: string, above: boolean): boolean {
    const before = this.#db.prepare('select above from subscription_usage where subscription_id = ? and session_id = ?').get(subscription, sessionId) as Row | undefined;
    this.#db.prepare('insert into subscription_usage values (?, ?, ?) on conflict(subscription_id, session_id) do update set above = excluded.above').run(subscription, sessionId, above ? 1 : 0);
    return above && !before?.above;
  }

  /** Only the latest event for this subject can extend a run. Direct provenance is a union; bound batches and other recipients are immutable. */
  coalesceEvent(session: string, subject: SubscriptionSubject, key: string, now: number, direct = false, windowMs = 60_000): { id: string; count: number } | null {
    const row = this.#db.prepare(`select * from (
      select m.id, m.created_at, m.notice_detail, d.event_count, d.state, d.digest_id
      from messages m join deliveries d on d.message_id = m.id
      where d.session = ? and m.notice = 'event' and json_extract(m.notice_detail, '$.subject') = ?
      order by m.seq desc limit 1
    ) where state = 'queued' and digest_id is null and created_at > ?
      and json_extract(notice_detail, '$.digest') = 'turn' and json_extract(notice_detail, '$.key') = ?`)
      .get(session, JSON.stringify(subject), now - windowMs, key) as Row | undefined;
    if (!row) return null;
    const count = (row.event_count as number) + 1;
    this.#db.prepare('update deliveries set event_count = ?, direct = max(direct, ?) where message_id = ? and session = ?').run(count, direct ? 1 : 0, row.id as string, session);
    return { id: row.id as string, count };
  }

  renameSubscriptionSubject(from: string, to: string): void {
    // Converging subjects keep both subscription ids, so each remains removable by its owner.
    this.#db.prepare('update subscriptions set subject_json = ? where subject_json = ?')
      .run(JSON.stringify({ session: to }), JSON.stringify({ session: from }));
  }

  /** One stored message by its hub id, or null. */
  message(id: string): Message | null {
    const row = this.#db.prepare('select * from messages where id = ?').get(id) as Row | undefined;
    if (!row) return null;
    const ask = this.ask(id);
    return { ...toMessage(row), ...(ask ? { ask: cardOf(ask) } : {}) };
  }

  /** The messages waiting for a session, oldest first; those past the TTL are marked dropped and returned
   *  separately. The rest stay queued: only the spoke's ack marks one delivered (`markDelivered`). */
  pendingFor(session: string, now: number, ttlMs: number): { deliver: Message[]; dropped: Message[] } {
    const dropped = this.expireQueued(session, now, ttlMs);
    const rows = this.#db
      .prepare(`select m.*, d.queued_at as queued_at from deliveries d join messages m on m.id = d.message_id
        where d.session = ? and d.state = ? and d.digest_id is null
        and (d.launch_brief is null or d.launch_brief_ready = 1) order by m.seq`)
      .all(session, 'queued') as Row[];
    const deliver: Message[] = [];
    for (const row of rows) {
      const message = toMessage(row);
      if (!isHeldDelivery(message)) deliver.push(this.deliveryMessage(message.id, session)!);
    }
    return { deliver, dropped };
  }

  /** Unbound notes keep their own TTL; a bound batch expires together at its trigger's TTL. */
  expireQueued(session: string, now: number, ttlMs: number): Message[] {
    return this.#transaction(() => {
      const roots = this.#db.prepare(`select distinct coalesce(digest_id, message_id) as root from deliveries
        where session = ? and state = 'queued' and digest_id is null and queued_at < ?`).all(session, now - ttlMs) as Row[];
      const dropped: Message[] = [];
      const expire = this.#db.prepare("update deliveries set state = 'dropped', delivered_at = null where session = ? and (message_id = ? or digest_id = ?) and state = 'queued'");
      for (const row of roots) {
        const root = row.root as string;
        dropped.push(...this.deliveryIds(root, session).map(id => this.message(id)!));
        expire.run(session, root, root);
      }
      return dropped;
    });
  }

  queuedSessions(): string[] {
    return (this.#db.prepare("select distinct session from deliveries where state = 'queued'").all() as Row[]).map(row => row.session as string);
  }

  unacknowledgedCount(session: string): number {
    return Number((this.#db.prepare("select count(*) as count from deliveries where session = ? and state in ('queued', 'delivered', 'uncertain', 'injected')").get(session) as Row).count);
  }

  deliveryCollisionCount(from: string, to: string): number {
    return Number((this.#db.prepare(`select count(*) as count from deliveries source join deliveries target
      on source.message_id = target.message_id where source.session = ? and target.session = ?`).get(from, to) as Row).count);
  }

  /** The session's spoke accepted the message; false when there was no queued delivery of it (a repeat ack). */
  markDelivered(messageId: string, session: string, now: number): boolean {
    const root = this.deliveryRoot(messageId, session);
    return this.#db.prepare("update deliveries set state = 'delivered', delivered_at = ? where (message_id = ? or digest_id = ?) and session = ? and state = 'queued'").run(now, root, root, session).changes > 0;
  }

  /** The session's adapter confirmed the turn; false when the delivery was not `delivered` (a repeat, or never acked). */
  markInjected(messageId: string, session: string): boolean {
    const root = this.deliveryRoot(messageId, session);
    return this.#db.prepare("update deliveries set state = 'injected' where (message_id = ? or digest_id = ?) and session = ? and state in ('delivered', 'uncertain')").run(root, root, session).changes > 0;
  }

  /** The adapter's inject reached the harness and got no answer: the turn may have started. `uncertain` is never
   *  retried on its own (`uninjected` leaves it out). False when the delivery was not `delivered`. */
  markUncertain(messageId: string, session: string): boolean {
    const root = this.deliveryRoot(messageId, session);
    return this.#db.prepare("update deliveries set state = 'uncertain' where (message_id = ? or digest_id = ?) and session = ? and state = 'delivered'").run(root, root, session).changes > 0;
  }

  /** The human asked for an uncertain delivery to be sent again: it is `delivered` (waiting for its inject) once more. */
  retryUncertain(messageId: string, session: string): boolean {
    const root = this.deliveryRoot(messageId, session);
    return this.#db.prepare("update deliveries set state = 'delivered' where (message_id = ? or digest_id = ?) and session = ? and state = 'uncertain'").run(root, root, session).changes > 0;
  }

  /** What the session's spoke accepted but its adapter has not confirmed yet, oldest first: the next idle retries these. */
  uninjected(session: string): Message[] {
    const rows = this.#db
      .prepare("select m.* from deliveries d join messages m on m.id = d.message_id where d.session = ? and d.state = 'delivered' and d.digest_id is null and coalesce(m.notice, '') != 'progress' and (coalesce(m.notice, '') != 'event' or json_extract(m.notice_detail, '$.digest') = 'now') order by m.seq")
      .all(session) as Row[];
    return rows.map(row => this.deliveryMessage(row.id as string, session)!);
  }

  /** Bare spokes have no adapter to confirm injection: their accepted deliveries have finished staffing work. */
  hasPendingWork(session: string, awaitsInjection = true): boolean {
    return this.#db.prepare(`select 1 from deliveries d join messages m on m.id = d.message_id
      where d.session = ? and d.state in ('queued', 'delivered', 'uncertain')
      and (? or d.state != 'delivered')
      and coalesce(m.notice, '') != 'progress'
      and (coalesce(m.notice, '') != 'event' or json_extract(m.notice_detail, '$.digest') = 'now') limit 1`).get(session, Number(awaitsInjection)) !== undefined;
  }

  queueVerifierRequest(messageId: string, item: string, role: 'reviewer' | 'qa'): void {
    item = item ? itemKey(item) : item;
    this.#db.prepare('update deliveries set verifier_item = ?, verifier_role = ? where message_id = ? and session = ?')
      .run(item, role, messageId, `@verifier:${role}`);
  }

  queuedVerifierRequests(): Array<{ message: Message; item: string; role: 'reviewer' | 'qa'; senderId: string | null; queuedAt: number }> {
    return (this.#db.prepare(`select m.*, d.verifier_item, d.verifier_role, d.queued_at from deliveries d join messages m on m.id = d.message_id
      where d.verifier_item is not null and d.state = 'queued' order by m.seq`).all() as Row[]).map(row => ({
      message: toMessage(row), item: this.#canonicalItem(row.verifier_item as string), role: row.verifier_role as 'reviewer' | 'qa',
      senderId: row.from_session_id as string | null, queuedAt: row.queued_at as number,
    }));
  }

  /** Selection and the recipient's held digest bind before any transport can acknowledge the request. */
  assignVerifierRequest(messageId: string, role: 'reviewer' | 'qa', session: string): Message {
    return this.#transaction(() => {
      const message = this.message(messageId)!;
      message.to = [...new Set(message.to.map(name => name === role ? session : name))];
      this.#db.prepare('update messages set to_json = ? where id = ?').run(JSON.stringify(message.to), messageId);
      const existing = this.#db.prepare('select 1 from deliveries where message_id = ? and session = ?').get(messageId, session);
      if (existing) this.dropVerifierRequest(messageId, role);
      else this.#db.prepare(`update deliveries set session = ?, session_id = (select session_id from sessions where name = ?),
        direct = 1, verifier_item = null, verifier_role = null where message_id = ? and session = ? and state = 'queued'`)
        .run(session, session, messageId, `@verifier:${role}`);
      if (!isHeldDelivery(message)) {
        const { seq } = this.#db.prepare('select seq from messages where id = ?').get(messageId) as Row;
        this.#bindProgress(messageId, session, seq as number);
      }
      return message;
    });
  }

  dropVerifierRequest(messageId: string, role: 'reviewer' | 'qa'): void {
    this.#db.prepare("update deliveries set state = 'dropped' where message_id = ? and session = ? and state = 'queued'")
      .run(messageId, `@verifier:${role}`);
  }

  deliveryRoot(messageId: string, session: string): string {
    const row = this.#db.prepare('select digest_id from deliveries where message_id = ? and session = ?').get(messageId, session) as Row | undefined;
    return typeof row?.digest_id === 'string' ? row.digest_id : messageId;
  }

  deliveryIds(messageId: string, session: string): string[] {
    const root = this.deliveryRoot(messageId, session);
    return (this.#db.prepare(`select m.id from deliveries d join messages m on m.id = d.message_id
      where d.session = ? and (d.message_id = ? or d.digest_id = ?) order by m.seq`).all(session, root, root) as Row[]).map(row => row.id as string);
  }

  /** Reconstruct the exact addressee-specific batch; history keeps the original messages individually. */
  deliveryMessage(messageId: string, session: string): Message | null {
    const root = this.deliveryRoot(messageId, session);
    const message = this.message(root);
    if (!message) return null;
    const members = this.deliveryIds(root, session).filter(id => id !== root).map(id => {
      const note = this.message(id)!;
      if (note.kind !== 'event') return note;
      const row = this.#db.prepare('select event_count from deliveries where message_id = ? and session = ?').get(id, session) as Row;
      const count = row.event_count as number;
      return count > 1 ? { ...note, text: `${note.text} (×${count})`, detail: { ...note.detail, count } } : note;
    });
    // Keep terminal subject facts visible, then fill remaining event slots in recorded order.
    // Progress is never capped. Every underlying row is still acknowledged with the same fixed root.
    const cap = message.kind === 'event' ? 9 : 10;
    const eventNotes = members.filter(note => note.kind === 'event');
    const visible = new Set(eventNotes.filter(note => note.detail?.event === 'heartbeat').slice(0, cap).map(note => note.id));
    for (const note of eventNotes.filter(note => note.detail?.final === true)) if (visible.size < cap) visible.add(note.id);
    for (const note of eventNotes) if (visible.size < cap) visible.add(note.id);
    // A first launch input carries its authority before the brief and any held notes.
    const digest = members.filter(note => note.kind !== 'event' || visible.has(note.id)).sort((a, b) => Number(b.kind === 'role') - Number(a.kind === 'role'));
    const hidden = eventNotes.length - visible.size;
    if (hidden) digest.push({ id: `${root}:event-summary`, from: 'hub', fromKind: 'hub', via: 'hub', to: [session], ts: message.ts, kind: 'event', text: `event · and ${hidden} more`, detail: { count: hidden, summary: true } });
    return digest.length ? { ...message, digest } : message;
  }

  /** Bundle the initial queued clause into its launch brief. The records and stages stay separate;
   * a single acknowledgement/injection settles both, just like an ordinary delivery digest. */
  bindLaunchClause(briefId: string, session: string): void {
    this.#db.prepare(`update deliveries set digest_id = ? where session = ? and state = 'queued'
      and digest_id is null and message_id in (select id from messages where notice = 'role')`).run(briefId, session);
  }

  /** A pending first input survives restart and follows any rename with its ordinary delivery row. */
  rememberLaunchBrief(id: string, session: string, launchId: string): void {
    this.#db.prepare('update deliveries set launch_brief = ? where message_id = ? and session = ?').run(launchId, id, session);
  }

  /** Only this launch's accepted hello can make its brief an ordinary first input. Carried input waits for
   * native acceptance; an already injected carried brief becomes a spoke notice without another injection. */
  activateLaunchBriefs(session: string, launchId: string, allowQueued: boolean): Message[] {
    return this.#transaction(() => {
      const rows = this.#db.prepare(`select m.* from messages m join deliveries d on d.message_id = m.id
        where d.session = ? and d.launch_brief = ? and d.launch_brief_ready = 0
        and (d.state = 'injected' or (? and d.state = 'queued')) order by m.seq`).all(session, launchId, Number(allowQueued)) as Row[];
      for (const row of rows) this.#db.prepare('update deliveries set launch_brief_ready = 1 where message_id = ? and session = ?').run(row.id as string, session);
      return rows.map(toMessage);
    });
  }

  /** Delivery ownership remains attached to the launch through acceptance, cancellation and recovery. */
  launchBriefs(launchId: string): Message[] {
    return (this.#db.prepare(`select m.* from messages m join deliveries d on d.message_id = m.id
      where d.launch_brief = ? order by m.seq`).all(launchId) as Row[]).map(toMessage);
  }

  /** A failed launch cannot leave an undelivered first input for a later launch under its name. */
  cancelLaunchBriefs(launchId: string): Array<{ message: Message; dropped: boolean; released: ReleasedDigest }> {
    return this.#transaction(() => this.launchBriefs(launchId).map(message => {
      const id = message.id, session = message.to[0]!;
      const members = this.#db.prepare('select message_id, state from deliveries where digest_id = ? and session = ?').all(id, session) as Row[];
      const released: ReleasedDigest = { trigger: id, session, notes: members.map(row => row.message_id as string), reheld: members.filter(row => ['queued', 'delivered', 'uncertain'].includes(row.state as string)).map(row => row.message_id as string) };
      // Like deleting an ordinary trigger: pending notes return at their original TTL; settled notes stay settled.
      this.#db.prepare(`update deliveries set digest_id = null,
        state = case when state in ('queued', 'delivered', 'uncertain') then 'queued' else state end,
        delivered_at = case when state in ('queued', 'delivered', 'uncertain') then null else delivered_at end
        where digest_id = ? and session = ?`).run(id, session);
      const dropped = this.#db.prepare(`update deliveries set state = 'dropped' where message_id = ? and session = ?
        and state in ('queued', 'delivered', 'uncertain')`).run(id, session).changes > 0;
      return { message, dropped, released };
    }));
  }

  #heartbeatIdle(session: string): boolean {
    const id = this.sessionIdOf(session);
    const state = id ? this.meta(`heartbeat-state:${id}`) : null;
    return state !== null && JSON.parse(state).state === 'idle';
  }

  /** A queued root may have been recorded during a turn; bind its idle-only events at the next idle send. */
  bindTurnEvents(messageId: string, session: string): void {
    const row = this.#db.prepare(`select m.seq from messages m join deliveries d on d.message_id = m.id
      where m.id = ? and d.session = ? and d.state = 'queued' and d.digest_id is null
      and coalesce(m.notice, '') != 'role'`).get(messageId, session) as Row | undefined;
    if (!row || !this.#heartbeatIdle(session)) return;
    this.#db.prepare(`update deliveries set digest_id = ? where session = ? and state = 'queued'
      and digest_id is null and message_id in (select id from messages where notice = 'event'
      and json_extract(notice_detail, '$.event') in ('heartbeat', 'rule')
      and json_extract(notice_detail, '$.digest') = 'turn' and seq < ?)`).run(messageId, session, row.seq as number);
  }

  #bindProgress(messageId: string, session: string, seq: number): void {
    this.#db.prepare(`update deliveries set digest_id = ?
      where session = ? and state = 'queued' and digest_id is null and message_id in
      (select id from messages where (notice = 'progress' or (notice = 'event' and coalesce(json_extract(notice_detail, '$.digest'), 'turn') = 'turn')) and seq < ?
      and (json_extract(notice_detail, '$.event') not in ('heartbeat', 'rule') or json_extract(notice_detail, '$.event') is null or ?))`).run(messageId, session, seq, this.#heartbeatIdle(session) ? 1 : 0);
  }

  /**
   * A session took a role: what waited for the role while nobody held it (deliveries addressed to the
   * placeholder `@<role>`) now waits for that session. Returns how many moved.
   */
  claimRoleQueue(role: string, session: string): { moved: number; merged: string[] } {
    return this.#transaction(() => {
      // Only newly acquired ordinary deliveries: a duplicate already held by this recipient keeps its fixed batch.
      const acquired = this.#db.prepare(`select m.id, m.seq from deliveries d join messages m on m.id = d.message_id
        where d.session = ? and d.state = 'queued' and d.digest_id is null and coalesce(m.notice, '') not in ('progress', 'event', 'role')
        and not exists (select 1 from deliveries existing where existing.session = ? and existing.message_id = d.message_id)
        order by m.seq`).all(`@${role}`, session) as Row[];
      const r = this.#moveQueuedTo(`@${role}`, session);
      // The placeholder has acquired its real recipient: bind that recipient's held notes before transport can start.
      for (const message of acquired) this.#bindProgress(message.id as string, session, message.seq as number);
      // the deliveries it took are this session's: by its id, as every other delivery
      if (r.moved) this.#db.prepare("update deliveries set session_id = (select session_id from sessions where name = ?) where session = ? and session_id is null and state = 'queued'").run(session, session);
      return r;
    });
  }

  /**
   * What still waits for `from` waits for `to`. A message that already has a delivery for `to` keeps that
   * one row: the queued row of `from` is consumed into it, so one ack clears the message for both. Returns
   * how many rows moved and the ids of the messages merged (their stage may have changed).
   */
  #moveQueuedTo(from: string, to: string): { moved: number; merged: string[] } {
    return this.#transaction(() => {
      const moved = Number(this.#db.prepare("update or ignore deliveries set session = ? where session = ? and state = 'queued'").run(to, from).changes);
      const merged = (this.#db.prepare("delete from deliveries where session = ? and state = 'queued' returning message_id").all(from) as Row[]).map((r) => r.message_id as string);
      return { moved, merged };
    });
  }

  /** The stage of a message over all its deliveries; undefined when it had no addressee. */
  stage(messageId: string): DeliveryStage | undefined {
    return stageOf((this.#db.prepare('select state from deliveries where message_id = ?').all(messageId) as Row[]).map((r) => r.state as string));
  }

  /** The index and its publication are one database transaction; the file is cleaned up by the caller on failure. */
  registerArtifact(make: (id: string) => Artifact, publish: (a: Artifact) => void): Artifact {
    return this.#transaction(() => {
      const n = this.#db.prepare("insert into artifacts (value) values ('{}')").run().lastInsertRowid;
      const a = make(`A-${n}`);
      this.#db.prepare('update artifacts set value = ? where number = ?').run(JSON.stringify(a), n);
      publish(a);
      return a;
    });
  }

  nextArtifactId(): string {
    const row = this.#db.prepare("select coalesce((select seq from sqlite_sequence where name = 'artifacts'), 0) + 1 as n").get() as Row;
    return `A-${row.n}`;
  }

  artifact(id: string): Artifact | null {
    if (!/^A-[1-9][0-9]*$/.test(id)) return null;
    const row = this.#db.prepare('select value from artifacts where number = ?').get(Number(id.slice(2))) as Row | undefined;
    return row ? JSON.parse(row.value as string) as Artifact : null;
  }

  /** Author provenance is immutable; legacy records fall back to their recorded name/role. */
  humanArtifact(a: Artifact): boolean {
    if (a.creatorKind !== undefined) return a.creatorKind === 'human' || a.creatorRole === 'aide';
    if (Object.hasOwn(a, 'creatorRole')) return a.creator === 'human' || a.creatorRole === 'aide';
    // Older chips retain their sender's role even when the live role changed or was cleared.
    const author = this.#db.prepare("select from_kind, from_role from messages where json_extract(artifact, '$.id') = ? order by created_at limit 1").get(a.id) as Row | undefined;
    return a.creator === 'human' || author?.from_kind === 'human' || author?.from_role === 'aide' ||
      (!author && this.roleOf(a.creator) === 'aide');
  }

  resolveArtifact(id: string): Artifact | null {
    const a = this.artifact(id);
    if (!a?.movedTo || a.fileDeleted) return a;
    const folder = this.artifact(a.movedTo.folder);
    if (!folder || folder.fileDeleted) return { ...a, fileDeleted: true };
    return { ...a, path: folder.path + '/' + a.movedTo.path, status: folder.status, topic: folder.topic, ...(folder.fileDeleted !== undefined ? { fileDeleted: folder.fileDeleted } : {}) };
  }

  updateArtifact(a: Artifact): void {
    const result = this.#db.prepare('update artifacts set value = ? where number = ?').run(JSON.stringify(a), Number(a.id.slice(2)));
    if (!result.changes) throw new Error(`no artifact ${a.id}`);
  }

  /** Topic transitions and their artifact marks commit together. Promoted/deleted files never return. */
  moveArtifacts(topic: string, closed: boolean, now: string): Artifact[] {
    return this.#transaction(() => {
      const changed: Artifact[] = [];
      for (const a of this.artifacts(topic)) {
        if (a.promoted || a.fileDeleted || a.kept || this.humanArtifact(a) || a.explicitArchive) continue;
        if (closed && a.status !== 'archived') {
          const next: Artifact = { ...a, status: 'archived', archivedAt: now };
          this.updateArtifact(next);
          changed.push(next);
        } else if (!closed && a.status === 'archived') {
          const next: Artifact = { ...a, status: 'shared' };
          delete next.archivedAt;
          this.updateArtifact(next);
          changed.push(next);
        }
      }
      return changed;
    });
  }

  addressedInTopic(sessionId: string, topic: string): boolean {
    return this.#db.prepare("select 1 from deliveries d join messages m on m.id = d.message_id where d.session_id = ? and m.topic = ? and d.state in ('delivered', 'injected', 'uncertain') limit 1").get(sessionId, topic) !== undefined;
  }

  movedArtifacts(): Artifact[] { return this.#artifactIndex().filter(a => a.movedTo); }

  artifacts(topic?: string): Artifact[] {
    return this.#artifactIndex().filter(a => !a.movedTo && (topic === undefined || a.topic === topic));
  }

  #artifactIndex(): Artifact[] {
    const rows = this.#db.prepare('select value from artifacts order by number').all() as Row[];
    return rows.map(r => JSON.parse(r.value as string) as Artifact);
  }

  // ---------------------------------------------------------------- topics

  /** Create the topic unless it exists; an existing one is left exactly as it is. */
  ensureTopic(id: string, title: string, standing: boolean, now: string): void {
    this.#db.prepare("insert into topics (id, title, status, standing, created_at, updated_at) values (?, ?, 'open', ?, ?, ?) on conflict (id) do nothing").run(id, title, standing ? 1 : 0, now, now);
  }

  topic(id: string): Topic | null {
    const row = this.#db.prepare(`${TOPIC_SELECT} where t.id = ?`).get(id) as Row | undefined;
    return row ? this.#canonicalTopic(toTopic(row)) : null;
  }

  /** Standing topics first (in creation order), then those waiting for the human, then the rest by latest
   *  activity; a topic with no message yet comes last (spec 4.5: a task's topic appears with its first message). */
  topics(): Topic[] {
    return (
      this.#db
        .prepare(
          `select * from (${TOPIC_SELECT}) order by standing desc, case when standing = 1 then rid end,
             case when status = 'waiting for human' then 0 when last_message_at is null then 2 else 1 end, updated_at desc, rid`,
        )
        .all() as Row[]
    ).map(row => this.#canonicalTopic(toTopic(row)));
  }

  /** A new topic, open; `item` binds it (the unique index refuses a second topic for one item). */
  createTopic(id: string, title: string, item: string | null, now: string): void {
    item = item ? itemKey(item) : item;
    this.#db.prepare("insert into topics (id, title, status, standing, created_at, updated_at, item) values (?, ?, 'open', 0, ?, ?, ?)").run(id, title, now, now, item);
  }

  /** The next free id of a created topic: `topic-<n>`, above every one the store has. */
  nextTopicId(): string {
    const row = this.#db.prepare("select max(cast(substr(id, 7) as integer)) as n from topics where id like 'topic-%'").get() as Row | undefined;
    return `topic-${Number(row?.n ?? 0) + 1}`;
  }

  /** The topic bound to an item, or null. */
  topicOfItem(item: string): Topic | null {
    item = item ? itemKey(item) : item;
    const row = this.#db.prepare(`${TOPIC_SELECT} where t.item = ?`).get(item) as Row | undefined;
    return row ? this.#canonicalTopic(toTopic(row)) : null;
  }

  /** Bind `item` to `topic` (null: to none): whatever topic held the item lets it go first. One binding a side. */
  setItemTopic(item: string, topic: string | null): void {
    item = item ? itemKey(item) : item;
    this.#transaction(() => {
      this.#db.prepare('update topics set item = null where item = ?').run(item);
      if (topic !== null) this.#db.prepare('update topics set item = ? where id = ?').run(item, topic);
    });
  }

  setTopicStatus(id: string, status: TopicStatus, now = new Date().toISOString()): Artifact[] {
    return this.#transaction(() => {
      this.#db.prepare('update topics set status = ? where id = ?').run(status, id);
      return this.moveArtifacts(id, status === 'closed', now);
    });
  }

  /** The human read the topic up to a message (its id), else up to its latest message. It never moves back. */
  markTopicRead(id: string, upTo?: string): void {
    const row = (
      upTo !== undefined
        ? this.#db.prepare('select seq as r from messages where id = ? and topic = ?').get(upTo, id)
        : this.#db.prepare('select max(seq) as r from messages where topic = ?').get(id)
    ) as Row | undefined;
    if (upTo !== undefined && !row) throw new Error(`no message "${upTo}" in this topic`);
    const r = Number(row?.r ?? 0);
    this.#db.prepare('update topics set read_seq = max(read_seq, ?) where id = ?').run(r, id);
  }

  /** The deliveries of the topic's latest human message: each addressee's name and the session id it was recorded
   *  for (null for a role's unclaimed placeholder, or a row older than the column). */
  lastHumanDeliveries(topic: string): Array<{ session: string; sessionId: string | null }> {
    return (
      this.#db
        .prepare(
          `select d.session, d.session_id from deliveries d where d.message_id = (
             select id from messages where topic = ? and from_kind = 'human' order by created_at desc, rowid desc limit 1)`,
        )
        .all(topic) as Row[]
    ).map((r) => ({ session: r.session as string, sessionId: (r.session_id as string | null) ?? null }));
  }

  /** The session id an agent's message was sent from, or null (a hub notice, the human, a row older than the column). */
  senderSessionId(messageId: string): string | null {
    const row = this.#db.prepare('select from_session_id from messages where id = ?').get(messageId) as Row | undefined;
    return (row?.from_session_id as string | null | undefined) ?? null;
  }

  /** The session an item was assigned to by the hub (its name then, and its session id when the hub knew it). */
  assigneeOf(item: string): { name: string; sessionId: string | null } | null {
    item = item ? itemKey(item) : item;
    const row = this.#db.prepare('select name, session_id from assignees where item = ?').get(item) as Row | undefined;
    return row ? { name: row.name as string, sessionId: (row.session_id as string | null) ?? null } : null;
  }

  /** Bind an item's assignee to a session (null name: the item has none). */
  bindAssignee(item: string, name: string | null, sessionId: string | null): void {
    item = item ? itemKey(item) : item;
    if (name === null) this.#db.prepare('delete from assignees where item = ?').run(item);
    else this.#db.prepare('insert into assignees (item, name, session_id) values (?, ?, ?) on conflict (item) do update set name = excluded.name, session_id = excluded.session_id').run(item, name, sessionId);
  }

  /** Who the topic's latest human message was delivered to (a role's placeholder once claimed is its holder). */
  lastHumanAddressees(topic: string): string[] {
    return (
      this.#db
        .prepare(
          `select d.session from deliveries d where d.message_id = (
             select id from messages where topic = ? and from_kind = 'human' order by created_at desc, rowid desc limit 1)`,
        )
        .all(topic) as Row[]
    ).map((r) => r.session as string);
  }

  touchTopic(id: string, now: string): void {
    this.#db.prepare('update topics set updated_at = ? where id = ?').run(now, id);
  }

  renameTopic(id: string, title: string, now: string): void {
    this.#db.prepare('update topics set title = ?, updated_at = ? where id = ?').run(title, now, id);
  }

  /** The topic and its messages go; surviving notes are released before trigger deliveries cascade. */
  deleteTopic(id: string): ReleasedDigest[] {
    return this.#transaction(() => {
      const { released } = this.#deleteMessages('select id from messages where topic = ?', [id]);
      this.#db.prepare('delete from asks where topic = ?').run(id);
      this.#db.prepare('delete from topics where id = ?').run(id);
      return released;
    });
  }

  /** All physical message deletion goes here, so a surviving note cannot retain a missing trigger.
   * Pending notes return to the same queue at their original queued_at; settled notes never replay. */
  #deleteMessages(selectIds: string, args: Array<string | number>): { gone: number; released: ReleasedDigest[] } {
    return this.#transaction(() => {
      const rows = this.#db.prepare(`select d.message_id, d.digest_id, d.session, d.state from deliveries d
        join messages m on m.id = d.message_id where d.digest_id in (${selectIds})
        and d.message_id not in (${selectIds}) order by m.seq`).all(...args, ...args) as Row[];
      const released: ReleasedDigest[] = [];
      const clear = this.#db.prepare(`update deliveries set digest_id = null,
        state = case when state in ('queued', 'delivered', 'uncertain') then 'queued' else state end,
        delivered_at = case when state in ('queued', 'delivered', 'uncertain') then null else delivered_at end
        where message_id = ? and session = ?`);
      for (const row of rows) {
        const trigger = row.digest_id as string, session = row.session as string, note = row.message_id as string;
        let batch = released.find(r => r.trigger === trigger && r.session === session);
        if (!batch) { batch = { trigger, session, notes: [], reheld: [] }; released.push(batch); }
        batch.notes.push(note);
        if (['queued', 'delivered', 'uncertain'].includes(row.state as string)) batch.reheld.push(note);
        clear.run(note, session);
      }
      this.#db.prepare(`delete from message_reads where id in (${selectIds})`).run(...args);
      const gone = Number(this.#db.prepare(`delete from messages where id in (${selectIds})`).run(...args).changes);
      return { gone, released };
    });
  }

  /** A topic's latest messages, oldest first, each with its stage. */
  topicMessages(topic: string, limit: number, filter: AgentsHistoryFilter & { before?: string } = {}): TopicMessage[] {
    const clauses = ['topic = ?'];
    const args: Array<string | number | null> = [topic];
    // Exact JSON values, including arrays/nested facts, avoid matching T-1 to T-12 or alpha to alpha-2.
    // Filter before LIMIT: old matches remain reachable past the unfiltered window.
    if (filter.item !== undefined) {
      clauses.push("exists (select 1 from json_tree(coalesce(notice_detail, '{}')) where type = 'text' and (value = ? or item_number(value) = ?))");
      args.push(this.topicOfItem(filter.item)?.id ?? null, Number(filter.item.split('-').at(-1)));
    }
    if (filter.session !== undefined) {
      // Only session-bearing facts: harness/role/rule metadata can equal a valid session name.
      clauses.push(`(from_name = ? or exists (select 1 from json_each(to_json) where value = ?)
        or exists (select 1 from json_tree(coalesce(notice_detail, '{}')) where type = 'text'
          and (fullkey in ('$.session', '$.from', '$.to', '$.by') or path in ('$.to', '$.pair')) and value = ?))`);
      args.push(filter.session, filter.session, filter.session);
    }
    if (filter.before !== undefined) {
      clauses.push('(created_at, rowid) < (select created_at, rowid from messages where id = ? and topic = ?)');
      args.push(filter.before, topic);
    }
    args.push(limit);
    const rows = this.#db.prepare(`select * from messages where ${clauses.join(' and ')} order by created_at desc, rowid desc limit ?`).all(...args) as Row[];
    return rows.reverse().map((row) => {
      const stage = this.stage(row.id as string);
      const ask = this.ask(row.id as string);
      return { ...toMessage(row), topic, ...(stage ? { stage } : {}), ...(ask ? { ask: cardOf(ask) } : {}) };
    });
  }

  // ---------------------------------------------------------------- asks (#33)

  /** Candidate messages and their durable read/reply facts. Sequence order handles equal timestamps. */
  inboxMessages(): Array<{ message: TopicMessage; read: boolean; replied: boolean; toHuman: boolean; latest: boolean }> {
    const rows = this.#db.prepare(`with latest_messages as (
      select m.topic, max(m.seq) as seq from messages m
      where m.from_kind = 'agent' and coalesce(m.notice, '') not in ('progress', 'event', 'request')
        and not exists (select 1 from asks a where a.id = m.id)
      group by m.topic
    ) select m.*, (m.seq <= t.read_seq or exists (select 1 from message_reads r where r.id = m.id)) as was_read,
      json_array_length(m.to_json) = 0 as to_human,
      m.seq = latest.seq as latest,
      (exists (select 1 from messages h where h.topic = m.topic and h.seq > m.seq and h.from_kind = 'human')
        or (m.notice = 'request' and exists (select 1 from messages h where h.reply_to = m.id and h.seq > m.seq and h.from_kind = 'human'))) as replied
      from messages m join topics t on t.id = m.topic
      left join latest_messages latest on latest.topic = m.topic
      where (m.from_kind = 'agent' or (m.from_kind = 'hub' and json_extract(m.notice_detail, '$.event') = 'verification-cleanup-incomplete')) and coalesce(m.notice, '') not in ('progress', 'event')
        and not exists (select 1 from asks a where a.id = m.id)
        and (json_array_length(m.to_json) = 0 or m.seq = latest.seq
          or exists (select 1 from inbox_waits w where w.id = m.id and w.kind in ('message', 'request')))
      order by m.seq desc`).all() as Row[];
    return rows.map(r => ({ message: { ...toMessage(r), topic: r.topic as string }, read: r.was_read === 1, replied: r.replied === 1, toHuman: r.to_human === 1, latest: r.latest === 1 }));
  }

  inboxWaits(): InboxWait[] {
    return this.#db.prepare('select kind, id, subject, since, text from inbox_waits').all() as InboxWait[];
  }

  /** The first human reply's time, using topic/sequence and reply indexes separately. */
  inboxReplyAt(id: string, topic: string): string | undefined {
    const sameTopic = this.#db.prepare(`select seq, ts from messages where topic = ?
      and seq > (select seq from messages where id = ?) and from_kind = 'human' order by seq limit 1`).get(topic, id) as Row | undefined;
    const explicit = this.#db.prepare(`select seq, ts from messages where reply_to = ?
      and seq > (select seq from messages where id = ?) and from_kind = 'human' order by seq limit 1`).get(id, id) as Row | undefined;
    const reply = !sameTopic ? explicit : !explicit || Number(sameTopic.seq) < Number(explicit.seq) ? sameTopic : explicit;
    return reply?.ts as string | undefined;
  }

  waitInInbox(row: InboxWait): string {
    this.#db.prepare('insert into inbox_waits (kind, id, subject, since, text) values (?, ?, ?, ?, ?) on conflict (kind, id) do nothing').run(row.kind, row.id, row.subject, row.since, row.text?.split(/\r?\n/, 1)[0] ?? '');
    return (this.#db.prepare('select since from inbox_waits where kind = ? and id = ?').get(row.kind, row.id) as Row).since as string;
  }

  leftInbox(kind: InboxRowKind, id: string): boolean {
    return this.#db.prepare('select 1 from inbox_departures where kind = ? and id = ? limit 1').get(kind, id) !== undefined;
  }

  departInbox(row: InboxWait, reason: InboxDeparture['reason'], ts: string, text = ''): InboxDeparture | null {
    return this.#transaction(() => {
      const waiting = this.#db.prepare('delete from inbox_waits where kind = ? and id = ?').run(row.kind, row.id).changes;
      // A request replied to before the coalesced tick still belongs in the archive, once.
      if (!waiting && (row.kind !== 'request' || this.leftInbox(row.kind, row.id))) return null;
      this.#db.prepare('insert into inbox_departures (kind, id, subject, since, ts, reason, text) values (?, ?, ?, ?, ?, ?, ?)').run(row.kind, row.id, row.subject, row.since, ts, reason, text);
      return { ...row, ts, reason, text };
    });
  }

  /** The later archive frame can read seven days directly, without scanning the journal. */
  inboxDepartures(after: string): InboxDeparture[] {
    const rows = this.#db.prepare(`select d.kind, d.id, d.subject, d.since, d.ts, d.reason,
      coalesce(nullif(d.text, ''), (select m.text from messages m where m.id = d.id), '') as text
      from inbox_departures d where d.ts >= ? order by d.ts desc, d.number desc`).all(after) as InboxDeparture[];
    return rows.map(row => ({ ...row, text: row.text?.split(/\r?\n/, 1)[0] ?? '' }));
  }

  inboxDeparturesToday(after: string): number {
    return (this.#db.prepare('select count(*) as n from inbox_departures where ts >= ?').get(after) as Row).n as number;
  }

  markMessageRead(id: string): void {
    this.#db.prepare('insert into message_reads (id) values (?) on conflict do nothing').run(id);
  }

  createAsk(a: { id: string; topic: string; from: string; question: string; options: string[]; free: boolean; ts: string; to?: string }): void {
    this.#db
      .prepare("insert into asks (id, topic, from_name, question, options_json, free, state, ts, to_name, to_session_id, from_session_id) values (?, ?, ?, ?, ?, ?, 'open', ?, ?, (select session_id from sessions where name = ?), (select from_session_id from messages where id = ?))")
      .run(a.id, a.topic, a.from, a.question, JSON.stringify(a.options), a.free ? 1 : 0, a.ts, a.to ?? null, a.to ?? null, a.id);
  }

  /** Actionable ends of an open agent chain move with their role, atomically with its handover record. */
  moveAgentAsks(fromId: string, to: string, toId: string): void {
    this.#db.prepare("update asks set to_name = ?, to_session_id = ? where state = 'open' and to_session_id = ?").run(to, toId, fromId);
    this.#db.prepare("update asks set from_session_id = ? where state = 'open' and to_name is not null and coalesce(from_session_id, (select from_session_id from messages where messages.id = asks.id)) = ?").run(toId, fromId);
  }

  forwardAsk(id: string, forwarded: string): void {
    this.#db.prepare('update asks set forwarded_id = ? where id = ?').run(forwarded, id);
  }

  ask(id: string): AskRow | null {
    const row = this.#db.prepare('select * from asks where id = ?').get(id) as Row | undefined;
    return row ? this.#askRow(row) : null;
  }

  #askRow(row: Row): AskRow {
    const ask = toAsk(row);
    if (ask.toSessionId && ask.to !== undefined) ask.to = this.nameOfSession(ask.toSessionId) ?? ask.to;
    return ask;
  }

  /** The open asks, oldest first; of one topic when given. */
  openAsks(topic?: string): AskRow[] {
    const rows = (topic === undefined ? this.#db.prepare("select * from asks where state = 'open' order by ts, rowid").all() : this.#db.prepare("select * from asks where state = 'open' and topic = ? order by ts, rowid").all(topic)) as Row[];
    return rows.map(row => this.#askRow(row));
  }

  /** An open ask leaves `open` (answered, withdrawn, cancelled); false when it was no longer open. */
  closeAsk(id: string, state: Exclude<AskState, 'open'>, at: string, answer?: { id: string; option?: number }): boolean {
    return this.#db.prepare("update asks set state = ?, closed_at = ?, answer_id = ?, option = ? where id = ? and state = 'open'").run(state, at, answer?.id ?? null, answer?.option ?? null, id).changes > 0;
  }

  /** An answer that could not be sent: the ask is open again. */
  reopenAsk(id: string): void {
    this.#db.prepare("update asks set state = 'open', closed_at = null, answer_id = null, option = null where id = ?").run(id);
  }

  /** The answer's message id, once it is recorded. */
  setAskAnswer(id: string, answer: string): void {
    this.#db.prepare('update asks set answer_id = ? where id = ?').run(answer, id);
  }

  /** A rename: what still waits for the old name (in flight to the live session) waits for the new one; a
   *  message that had both names keeps its delivery to the new one. Returns the ids of those merged. */
  moveQueued(from: string, to: string): string[] {
    return this.#moveQueuedTo(from, to).merged;
  }

  /** What `from`'s spoke accepted and its adapter has not confirmed (`delivered`) is `to`'s now: the same session
   *  renamed. A message that already has a delivery for `to` keeps that one. Returns how many rows moved. */
  moveUninjected(from: string, to: string): number {
    return Number(this.#db.prepare("update or ignore deliveries set session = ? where session = ? and state in ('delivered', 'uncertain')").run(to, from).changes);
  }

  /**
   * Delete messages older than the retention window, reporting removals and any surviving notes released.
   * An ask still open is kept, and its message with it: the human has not answered yet, whatever its age.
   */
  prune(now: number, retentionMs: number): { gone: number; released: ReleasedDigest[] } {
    return this.#transaction(() => {
      const result = this.#deleteMessages(`with pending_digests as (
      select distinct d.session, coalesce(d.digest_id, d.message_id) as root from deliveries d
      where d.state in ('queued', 'delivered', 'uncertain') and (d.digest_id is not null or exists
        (select 1 from deliveries member where member.session = d.session and member.digest_id = d.message_id))
    ) select id from messages where created_at < ? and id not in (select id from asks where state = 'open')
      and id not in (select id from inbox_waits where kind in ('request', 'message'))
      and id not in (select d.message_id from deliveries d join pending_digests pending
        on pending.session = d.session and (d.message_id = pending.root or d.digest_id = pending.root))`, [now - retentionMs]);
      // an answered, withdrawn or cancelled ask goes with its message
      if (result.gone) this.#db.prepare('delete from asks where id not in (select id from messages)').run();
      return result;
    });
  }

  /** A session's traffic — sent by it or addressed to it — newest last, optionally with one counterpart only.
   *  The counterpart is filtered in SQL before the limit, so a burst of other traffic never hides an older exchange. */
  history(session: string, limit: number, counterpart?: string): Message[] {
    const rows = this.#db
      .prepare(
        `select m.* from messages m
         where (m.from_name = :session or exists (select 1 from deliveries d where d.message_id = m.id and d.session = :session))
           and (:counterpart is null or m.from_name = :counterpart or exists (select 1 from json_each(m.to_json) t where t.value = :counterpart))
         order by m.created_at desc, m.rowid desc limit :limit`,
      )
      .all({ session, counterpart: counterpart ?? null, limit }) as Row[];
    return rows.map(toMessage).reverse();
  }
}
