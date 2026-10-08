// The hub's memory: every message, every delivery's state, every session the hub has seen — one
// SQLite file through node:sqlite (WAL), or `:memory:` for tests.
import { DatabaseSync } from 'node:sqlite';
import type { Message } from '../protocol.ts';
import type { HygieneMemory, HygieneRow } from './hygiene.ts';

/** A delivery to one addressee: delivered at once, queued for an offline session, or dropped past the TTL. */
export type DeliveryState = 'delivered' | 'queued' | 'dropped';
export type KnownSession = { name: string; lastSeen: string; status: string | null; role: string | null };

const SCHEMA = `
create table if not exists sessions (
  name text primary key,
  last_seen integer not null,
  status text,
  role text
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
  { table: 'messages', column: 'from_role', type: 'text' },
  { table: 'messages', column: 'reply_to', type: 'text' },
];

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
});

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

  /** The remembered status of a session seen since `since` (ms epoch), else null — a name older than the window is history. */
  statusOf(name: string, since = 0): string | null {
    const row = this.#db.prepare('select status from sessions where name = ? and last_seen >= ?').get(name, since) as Row | undefined;
    return (row?.status as string | null | undefined) ?? null;
  }

  rememberRole(name: string, role: string | null): void {
    this.#db.prepare('update sessions set role = ? where name = ?').run(role, name);
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

  /** Record a message and the state of each addressee's delivery. */
  record(message: Message, deliveries: Array<{ session: string; state: DeliveryState }>, now: number): void {
    this.#db
      .prepare('insert into messages (id, from_name, from_kind, from_role, via, to_json, text, reply_to, ts, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(message.id, message.from, message.fromKind, message.fromRole ?? null, message.via, JSON.stringify(message.to), message.text, message.replyTo ?? null, message.ts, now);
    const insert = this.#db.prepare('insert into deliveries (message_id, session, state, queued_at, delivered_at) values (?, ?, ?, ?, ?)');
    for (const d of deliveries) insert.run(message.id, d.session, d.state, now, d.state === 'delivered' ? now : null);
  }

  /** One stored message by its hub id, or null. */
  message(id: string): Message | null {
    const row = this.#db.prepare('select * from messages where id = ?').get(id) as Row | undefined;
    return row ? toMessage(row) : null;
  }

  /** The messages waiting for a session, oldest first; those past the TTL are marked dropped and returned separately. */
  takeQueued(session: string, now: number, ttlMs: number): { deliver: Message[]; dropped: Message[] } {
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
      } else {
        mark.run('delivered', now, message.id, session);
        deliver.push(message);
      }
    }
    return { deliver, dropped };
  }

  /** Delete messages older than the retention window (their deliveries go by the foreign key); returns how many went. */
  prune(now: number, retentionMs: number): number {
    return Number(this.#db.prepare('delete from messages where created_at < ?').run(now - retentionMs).changes);
  }

  /** A session's traffic — sent by it or addressed to it — newest last, optionally with one counterpart only. */
  history(session: string, limit: number, counterpart?: string): Message[] {
    const rows = this.#db
      .prepare(
        `select distinct m.* from messages m left join deliveries d on d.message_id = m.id
         where (m.from_name = ? or d.session = ?)
         order by m.created_at desc, m.rowid desc limit ?`,
      )
      .all(session, session, Math.max(limit * 4, limit)) as Row[];
    const all = rows.map(toMessage).reverse();
    const filtered = counterpart === undefined ? all : all.filter((m) => m.from === counterpart || m.to.includes(counterpart));
    return filtered.slice(-limit);
  }
}
