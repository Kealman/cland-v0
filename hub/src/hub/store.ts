// The hub's memory: every message, every delivery's state, every session the hub has seen — one
// SQLite file through node:sqlite (WAL), or `:memory:` for tests.
import { DatabaseSync } from 'node:sqlite';
import type { AskCard, AskState, DeliveryStage, InboxNotification, Message, NotificationKind, Topic, TopicMessage, TopicStatus } from '../protocol.ts';
import type { HygieneMemory, HygieneRow } from './hygiene.ts';
import { vacancyWarning } from './topics.ts';

/** A delivery to one addressee: queued until its spoke acks it (delivered), injected once its adapter confirmed
 *  the turn, or dropped past the TTL. */
export type DeliveryState = 'delivered' | 'queued' | 'dropped' | 'injected';
export type KnownSession = { name: string; lastSeen: string; status: string | null; role: string | null };

const SCHEMA = `
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
create table if not exists notifications (
  id text primary key,
  kind text not null,
  text text not null,
  ts text not null,
  item text,
  session text,
  result text,
  dismissed integer not null default 0
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
  { table: 'sessions', column: 'status', type: 'text' },
  { table: 'sessions', column: 'role', type: 'text' },
  { table: 'sessions', column: 'session_id', type: 'text' },
  { table: 'messages', column: 'from_role', type: 'text' },
  { table: 'messages', column: 'reply_to', type: 'text' },
  { table: 'messages', column: 'topic', type: 'text' },
  /** What kind of hub notice a message is (`role`: a role clause or revocation), null for every other message. */
  { table: 'messages', column: 'notice', type: 'text' },
  /** The item a topic is bound to (spec 4.5), null when unbound. */
  { table: 'topics', column: 'item', type: 'text' },
  /** The rowid of the last message the human read in the topic (`topic.read`); 0: none. */
  { table: 'topics', column: 'read_rowid', type: 'integer not null default 0' },
  /** The ask a human message answers (#33). */
  { table: 'messages', column: 'answer_to', type: 'text' },
];

/** Indexes over added columns: created after the migration, when the column surely exists. */
const LATE_INDEXES = `
create index if not exists messages_topic on messages (topic, created_at);
create unique index if not exists topics_item on topics (item) where item is not null;
`;

type Row = Record<string, string | number | null>;

const toMessage = (row: Row): Message => ({
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
  ...(row.answer_to !== null && row.answer_to !== undefined ? { answerTo: row.answer_to as string } : {}),
});

/** An ask's row in the `asks` table (#33). */
export type AskRow = AskCard & { id: string; topic: string; from: string; ts: string };

const toAsk = (row: Row): AskRow => ({
  id: row.id as string,
  topic: row.topic as string,
  from: row.from_name as string,
  ts: row.ts as string,
  question: row.question as string,
  options: JSON.parse(row.options_json as string) as string[],
  free: row.free === 1,
  state: row.state as AskState,
  ...(row.answer_id !== null && row.answer_id !== undefined ? { answer: row.answer_id as string } : {}),
  ...(row.option !== null && row.option !== undefined ? { option: Number(row.option) } : {}),
});

/** The card an ask's message carries. */
export const cardOf = (a: AskRow): AskCard => ({
  question: a.question,
  options: a.options,
  free: a.free,
  state: a.state,
  ...(a.answer !== undefined ? { answer: a.answer } : {}),
  ...(a.option !== undefined ? { option: a.option } : {}),
});

const toNotification = (row: Row): InboxNotification => ({
  id: row.id as string,
  kind: row.kind as NotificationKind,
  text: row.text as string,
  ts: row.ts as string,
  ...(row.item !== null && row.item !== undefined ? { item: row.item as string } : {}),
  ...(row.session !== null && row.session !== undefined ? { session: row.session as string } : {}),
  ...(row.result !== null && row.result !== undefined ? { result: row.result as string } : {}),
  dismissed: row.dismissed === 1,
});

const toTopic = (row: Row): Topic => {
  const warning = vacancyWarning(typeof row.vacant_roles === 'string' && row.vacant_roles ? row.vacant_roles.split(',') : []);
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
  (select count(*) from messages m where m.topic = t.id and m.rowid > coalesce(t.read_rowid, 0) and m.from_kind != 'human') as unread,
  (select max(m.ts) from messages m where m.topic = t.id) as last_message_at,
  (select group_concat(distinct substr(d.session, 2)) from deliveries d join messages m on m.id = d.message_id
     where m.topic = t.id and d.session like '@%' and d.state = 'queued') as vacant_roles
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

export class Store implements HygieneMemory {
  readonly #db: DatabaseSync;

  constructor(path: string = ':memory:') {
    this.#db = new DatabaseSync(path);
    this.#db.exec('pragma journal_mode = wal; pragma foreign_keys = on;');
    this.#db.exec(SCHEMA);
    this.#migrate();
    this.#db.exec(LATE_INDEXES);
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

  /** Sessions seen since `since` (ms epoch) — the ones `@all` or a glob still reaches; older ones are history. */
  knownSessions(since = 0): KnownSession[] {
    return (this.#db.prepare('select name, last_seen, status, role from sessions where last_seen >= ? order by name').all(since) as Row[]).map(toKnown);
  }

  /** A heartbeat: the session is still here, so `last_seen` means what it says. */
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
    this.#db.prepare('update sessions set session_id = ? where name = ?').run(sessionId, name);
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
   *  marked dropped. Returns their ids. */
  dropNotices(session: string, notice: string): string[] {
    return (
      this.#db
        .prepare(
          `update deliveries set state = 'dropped' where session = ? and state in ('queued', 'delivered')
           and message_id in (select id from messages where notice = ?) returning message_id`,
        )
        .all(session, notice) as Row[]
    ).map((r) => r.message_id as string);
  }

  /** The names holding a role, seen since `since` — a role as a tag resolves to these. */
  sessionsWithRole(role: string, since = 0): string[] {
    return (this.#db.prepare('select name from sessions where role = ? and last_seen >= ? order by name').all(role, since) as Row[]).map((r) => r.name as string);
  }

  /** Hygiene's state, as it last wrote it: rate windows, pair counts, mutes. */
  hygieneRows(): HygieneRow[] {
    return (this.#db.prepare('select kind, key, value from hygiene').all() as Row[]).map((r) => ({ kind: r.kind as HygieneRow['kind'], key: r.key as string, value: r.value as string }));
  }

  /** One piece of hygiene's state; null forgets it. */
  saveHygiene(kind: HygieneRow['kind'], key: string, value: string | null): void {
    if (value === null) this.#db.prepare('delete from hygiene where kind = ? and key = ?').run(kind, key);
    else this.#db.prepare('insert into hygiene (kind, key, value) values (?, ?, ?) on conflict (kind, key) do update set value = excluded.value').run(kind, key, value);
  }

  /** Run `fn` in one transaction: all of its writes land, or none does. */
  #transaction<T>(fn: () => T): T {
    this.#db.exec('begin immediate');
    try {
      const result = fn();
      this.#db.exec('commit');
      return result;
    } catch (err) {
      this.#db.exec('rollback');
      throw err;
    }
  }

  /** Record a message and the state of each addressee's delivery, together: a message is never stored with
   *  only some of its deliveries. */
  record(message: Message, deliveries: Array<{ session: string; state: DeliveryState }>, now: number, notice: string | null = null): void {
    this.#transaction(() => {
      this.#db
        .prepare('insert into messages (id, from_name, from_kind, from_role, via, to_json, text, reply_to, ts, created_at, topic, notice, answer_to) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(message.id, message.from, message.fromKind, message.fromRole ?? null, message.via, JSON.stringify(message.to), message.text, message.replyTo ?? null, message.ts, now, message.topic ?? null, notice, message.answerTo ?? null);
      const insert = this.#db.prepare('insert into deliveries (message_id, session, state, queued_at, delivered_at) values (?, ?, ?, ?, ?)');
      for (const d of deliveries) insert.run(message.id, d.session, d.state, now, d.state === 'delivered' ? now : null);
    });
  }

  /** One stored message by its hub id, or null. */
  message(id: string): Message | null {
    const row = this.#db.prepare('select * from messages where id = ?').get(id) as Row | undefined;
    return row ? toMessage(row) : null;
  }

  /** The messages waiting for a session, oldest first; those past the TTL are marked dropped and returned
   *  separately. The rest stay queued: only the spoke's ack marks one delivered (`markDelivered`). */
  pendingFor(session: string, now: number, ttlMs: number): { deliver: Message[]; dropped: Message[] } {
    const rows = this.#db
      .prepare('select m.*, d.queued_at as queued_at from deliveries d join messages m on m.id = d.message_id where d.session = ? and d.state = ? order by d.queued_at, m.created_at')
      .all(session, 'queued') as Row[];
    const deliver: Message[] = [];
    const dropped: Message[] = [];
    const mark = this.#db.prepare('update deliveries set state = ?, delivered_at = ? where message_id = ? and session = ?');
    for (const row of rows) {
      const message = toMessage(row);
      if (now - (row.queued_at as number) > ttlMs) {
        mark.run('dropped', null, message.id, session);
        dropped.push(message);
      } else deliver.push(message);
    }
    return { deliver, dropped };
  }

  /** The session's spoke accepted the message; false when there was no queued delivery of it (a repeat ack). */
  markDelivered(messageId: string, session: string, now: number): boolean {
    return this.#db.prepare("update deliveries set state = 'delivered', delivered_at = ? where message_id = ? and session = ? and state = 'queued'").run(now, messageId, session).changes > 0;
  }

  /** The session's adapter confirmed the turn; false when the delivery was not `delivered` (a repeat, or never acked). */
  markInjected(messageId: string, session: string): boolean {
    return this.#db.prepare("update deliveries set state = 'injected' where message_id = ? and session = ? and state = 'delivered'").run(messageId, session).changes > 0;
  }

  /** What the session's spoke accepted but its adapter has not confirmed yet, oldest first: the next idle retries these. */
  uninjected(session: string): Message[] {
    const rows = this.#db
      .prepare("select m.* from deliveries d join messages m on m.id = d.message_id where d.session = ? and d.state = 'delivered' order by d.delivered_at, m.created_at")
      .all(session) as Row[];
    return rows.map(toMessage);
  }

  /**
   * A session took a role: what waited for the role while nobody held it (deliveries addressed to the
   * placeholder `@<role>`) now waits for that session. Returns how many moved.
   */
  claimRoleQueue(role: string, session: string): { moved: number; merged: string[] } {
    return this.#moveQueuedTo(`@${role}`, session);
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

  // ---------------------------------------------------------------- topics

  /** Create the topic unless it exists; an existing one is left exactly as it is. */
  ensureTopic(id: string, title: string, standing: boolean, now: string): void {
    this.#db.prepare("insert into topics (id, title, status, standing, created_at, updated_at) values (?, ?, 'open', ?, ?, ?) on conflict (id) do nothing").run(id, title, standing ? 1 : 0, now, now);
  }

  topic(id: string): Topic | null {
    const row = this.#db.prepare(`${TOPIC_SELECT} where t.id = ?`).get(id) as Row | undefined;
    return row ? toTopic(row) : null;
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
    ).map(toTopic);
  }

  /** A new topic, open; `item` binds it (the unique index refuses a second topic for one item). */
  createTopic(id: string, title: string, item: string | null, now: string): void {
    this.#db.prepare("insert into topics (id, title, status, standing, created_at, updated_at, item) values (?, ?, 'open', 0, ?, ?, ?)").run(id, title, now, now, item);
  }

  /** The next free id of a created topic: `topic-<n>`, above every one the store has. */
  nextTopicId(): string {
    const row = this.#db.prepare("select max(cast(substr(id, 7) as integer)) as n from topics where id like 'topic-%'").get() as Row | undefined;
    return `topic-${Number(row?.n ?? 0) + 1}`;
  }

  /** The topic bound to an item, or null. */
  topicOfItem(item: string): Topic | null {
    const row = this.#db.prepare(`${TOPIC_SELECT} where t.item = ?`).get(item) as Row | undefined;
    return row ? toTopic(row) : null;
  }

  setTopicStatus(id: string, status: TopicStatus): void {
    this.#db.prepare('update topics set status = ? where id = ?').run(status, id);
  }

  /** The human read the topic up to a message (its id), else up to its latest message. It never moves back. */
  markTopicRead(id: string, upTo?: string): void {
    const row = (
      upTo !== undefined
        ? this.#db.prepare('select rowid as r from messages where id = ? and topic = ?').get(upTo, id)
        : this.#db.prepare('select max(rowid) as r from messages where topic = ?').get(id)
    ) as Row | undefined;
    if (upTo !== undefined && !row) throw new Error(`no message "${upTo}" in this topic`);
    const r = Number(row?.r ?? 0);
    this.#db.prepare('update topics set read_rowid = max(coalesce(read_rowid, 0), ?) where id = ?').run(r, id);
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

  /** The topic and its messages go; their deliveries go by the foreign key. */
  deleteTopic(id: string): void {
    this.#db.prepare('delete from messages where topic = ?').run(id);
    this.#db.prepare('delete from asks where topic = ?').run(id);
    this.#db.prepare('delete from topics where id = ?').run(id);
  }

  /** A topic's latest messages, oldest first, each with its stage. */
  topicMessages(topic: string, limit: number): TopicMessage[] {
    const rows = this.#db.prepare('select * from messages where topic = ? order by created_at desc, rowid desc limit ?').all(topic, limit) as Row[];
    return rows.reverse().map((row) => {
      const stage = this.stage(row.id as string);
      const ask = this.ask(row.id as string);
      return { ...toMessage(row), topic, ...(stage ? { stage } : {}), ...(ask ? { ask: cardOf(ask) } : {}) };
    });
  }

  // ---------------------------------------------------------------- asks (#33)

  createAsk(a: { id: string; topic: string; from: string; question: string; options: string[]; free: boolean; ts: string }): void {
    this.#db
      .prepare("insert into asks (id, topic, from_name, question, options_json, free, state, ts) values (?, ?, ?, ?, ?, ?, 'open', ?)")
      .run(a.id, a.topic, a.from, a.question, JSON.stringify(a.options), a.free ? 1 : 0, a.ts);
  }

  ask(id: string): AskRow | null {
    const row = this.#db.prepare('select * from asks where id = ?').get(id) as Row | undefined;
    return row ? toAsk(row) : null;
  }

  /** The open asks, oldest first; of one topic when given. */
  openAsks(topic?: string): AskRow[] {
    const rows = (topic === undefined ? this.#db.prepare("select * from asks where state = 'open' order by ts, rowid").all() : this.#db.prepare("select * from asks where state = 'open' and topic = ? order by ts, rowid").all(topic)) as Row[];
    return rows.map(toAsk);
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

  // ---------------------------------------------------------------- notifications (#33)

  addNotification(n: { id: string; kind: NotificationKind; text: string; ts: string; item?: string; session?: string; result?: string }): void {
    this.#db
      .prepare('insert into notifications (id, kind, text, ts, item, session, result) values (?, ?, ?, ?, ?, ?, ?)')
      .run(n.id, n.kind, n.text, n.ts, n.item ?? null, n.session ?? null, n.result ?? null);
  }

  /** The notifications not dismissed, oldest first. */
  notifications(): InboxNotification[] {
    return (this.#db.prepare('select * from notifications where dismissed = 0 order by ts, rowid').all() as Row[]).map(toNotification);
  }

  /** Dismiss one notification (all of them without an id); returns how many were dismissed. */
  dismissNotifications(id?: string): number {
    const r = id === undefined ? this.#db.prepare('update notifications set dismissed = 1 where dismissed = 0').run() : this.#db.prepare('update notifications set dismissed = 1 where id = ? and dismissed = 0').run(id);
    return Number(r.changes);
  }

  notificationExists(id: string): boolean {
    return this.#db.prepare('select 1 from notifications where id = ?').get(id) !== undefined;
  }

  /** A rename: what still waits for the old name (in flight to the live session) waits for the new one; a
   *  message that had both names keeps its delivery to the new one. Returns the ids of those merged. */
  moveQueued(from: string, to: string): string[] {
    return this.#moveQueuedTo(from, to).merged;
  }

  /** Delete messages older than the retention window (their deliveries go by the foreign key); returns how many went. */
  prune(now: number, retentionMs: number): number {
    const gone = Number(this.#db.prepare('delete from messages where created_at < ?').run(now - retentionMs).changes);
    // an ask goes with its message
    if (gone) this.#db.prepare('delete from asks where id not in (select id from messages)').run();
    return gone;
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
