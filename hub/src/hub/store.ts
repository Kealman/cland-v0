// The hub's memory: every message, every delivery's state, every session the hub has seen — one
// SQLite file through node:sqlite (WAL), or `:memory:` for tests.
import { DatabaseSync } from 'node:sqlite';
import type { DeliveryStage, Message, Topic, TopicMessage, TopicStatus } from '../protocol.ts';
import type { HygieneMemory, HygieneRow } from './hygiene.ts';

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
];

/** Indexes over added columns: created after the migration, when the column surely exists. */
const LATE_INDEXES = `
create index if not exists messages_topic on messages (topic, created_at);
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
});

const toTopic = (row: Row): Topic => ({
  id: row.id as string,
  title: row.title as string,
  status: row.status as TopicStatus,
  standing: row.standing === 1,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

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
        .prepare('insert into messages (id, from_name, from_kind, from_role, via, to_json, text, reply_to, ts, created_at, topic, notice) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(message.id, message.from, message.fromKind, message.fromRole ?? null, message.via, JSON.stringify(message.to), message.text, message.replyTo ?? null, message.ts, now, message.topic ?? null, notice);
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
    const row = this.#db.prepare('select * from topics where id = ?').get(id) as Row | undefined;
    return row ? toTopic(row) : null;
  }

  /** Standing topics first (in creation order), then the rest by latest activity. */
  topics(): Topic[] {
    return (this.#db.prepare('select * from topics order by standing desc, case when standing = 1 then rowid end, updated_at desc, rowid').all() as Row[]).map(toTopic);
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
    this.#db.prepare('delete from topics where id = ?').run(id);
  }

  /** A topic's latest messages, oldest first, each with its stage. */
  topicMessages(topic: string, limit: number): TopicMessage[] {
    const rows = this.#db.prepare('select * from messages where topic = ? order by created_at desc, rowid desc limit ?').all(topic, limit) as Row[];
    return rows.reverse().map((row) => {
      const stage = this.stage(row.id as string);
      return { ...toMessage(row), topic, ...(stage ? { stage } : {}) };
    });
  }

  /** A rename: what still waits for the old name (in flight to the live session) waits for the new one; a
   *  message that had both names keeps its delivery to the new one. Returns the ids of those merged. */
  moveQueued(from: string, to: string): string[] {
    return this.#moveQueuedTo(from, to).merged;
  }

  /** Delete messages older than the retention window (their deliveries go by the foreign key); returns how many went. */
  prune(now: number, retentionMs: number): number {
    return Number(this.#db.prepare('delete from messages where created_at < ?').run(now - retentionMs).changes);
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
