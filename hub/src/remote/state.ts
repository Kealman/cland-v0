import type { DatabaseSync } from 'node:sqlite';
import type { RemoteStopCause } from '../protocol.ts';

// Additive tables on Store's existing hub.db handle. All platform ids are TEXT,
// including Telegram ids, so no adapter can accidentally round a snowflake.
const SCHEMA = `
create table if not exists remote_state (
  messenger text not null, key text not null, value text not null,
  primary key (messenger, key)
);
create table if not exists remote_status (
  messenger text primary key, disabled integer not null, reason text, stop_cause text
);
create table if not exists remote_pairings (
  messenger text primary key, user_id text not null, chat_id text not null,
  guild_id text, name text not null
);
create table if not exists remote_requests (
  messenger text not null, code text not null, user_id text not null, chat_id text not null,
  guild_id text, name text not null, created text not null, expires text not null,
  primary key (messenger, code)
);
create table if not exists remote_senders (
  messenger text not null, user_id text not null, replies integer not null,
  primary key (messenger, user_id)
);
create table if not exists remote_messages (
  messenger text not null, chat_id text not null, message_id text not null,
  topic text not null, message text, ask text, approval text,
  primary key (messenger, chat_id, message_id)
);
create index if not exists remote_messages_source on remote_messages (messenger, message);
create table if not exists remote_outbox (
  messenger text not null, id text not null, kind text not null, source text,
  state text not null, payload text not null, created text not null, updated text not null,
  primary key (messenger, id)
);
create index if not exists remote_outbox_state on remote_outbox (messenger, state, created);
create table if not exists remote_outbox_attempts (
  messenger text not null, id text not null, job text not null, at text not null, outcome text,
  primary key (messenger, id),
  foreign key (messenger, job) references remote_outbox (messenger, id) on delete cascade
);
create index if not exists remote_outbox_attempt_job on remote_outbox_attempts (messenger, job, at);
create table if not exists remote_poller_lease (
  singleton integer primary key check (singleton = 1), owner text not null,
  pid integer not null, started text not null, identity text not null
);
`;

export type RemoteStatus = { disabled: boolean; reason: string | null; stopCause?: RemoteStopCause };
export type Pairing = { userId: string; chatId: string; guildId: string | null; name: string };
export type PairingRequest = Pairing & { code: string; created: string; expires: string };
export type RemoteMessage = { chatId: string; messageId: string; topic: string; message: string | null; ask: string | null; approval: string | null };
/** Queue behaviour belongs to the outbox, not its persistence layer. */
export type OutboxJob = { id: string; kind: string; source: string | null; state: string; payload: unknown; created: string; updated: string; target?: string };
export type OutboxAttempt = { id: string; job: string; at: string; outcome: string | null };
export type PollerOwner = { owner: string; pid: number; started: string; identity: string };
const nullable = (value: unknown): string | null => value === null ? null : String(value);

/** Owned by Store: no connection, file, timer or independent shutdown to drain. */
export class RemoteState {
  readonly #db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.#db = db; db.exec(SCHEMA);
    // Existing hub.db files predate edit targets; keep their rows and wire fields intact.
    const columns = db.prepare('pragma table_info(remote_outbox)').all();
    if (!columns.some(column => column.name === 'target')) db.exec('alter table remote_outbox add column target text');
    if (!db.prepare('pragma table_info(remote_status)').all().some(column => column.name === 'stop_cause'))
      db.exec('alter table remote_status add column stop_cause text');
  }
  readonly #listeners = new Set<() => void>();
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener); return () => { this.#listeners.delete(listener); };
  }
  forMessenger(id: string): RemoteStore { return new RemoteStore(this.#db, id, () => { for (const listener of this.#listeners) listener(); }); }
  pollerLease(): PollerOwner | null {
    const row = this.#db.prepare('select * from remote_poller_lease where singleton = 1').get();
    return row ? { owner: String(row.owner), pid: Number(row.pid), started: String(row.started), identity: String(row.identity) } : null;
  }
  /** Compare-and-swap after asynchronous native inspection; never evict a successor. */
  takePollerLease(holder: PollerOwner, previous: string | null): boolean {
    if (previous === null) return this.#db.prepare('insert or ignore into remote_poller_lease (singleton, owner, pid, started, identity) values (1, ?, ?, ?, ?)')
      .run(holder.owner, holder.pid, holder.started, holder.identity).changes === 1;
    return this.#db.prepare('update remote_poller_lease set owner = ?, pid = ?, started = ?, identity = ? where singleton = 1 and owner = ?')
      .run(holder.owner, holder.pid, holder.started, holder.identity, previous).changes === 1;
  }
  releasePollerLease(owner: string): void {
    this.#db.prepare('delete from remote_poller_lease where singleton = 1 and owner = ?').run(owner);
  }
}

/** Messenger-scoped records; tokens and keys belong in the secrets file. */
export class RemoteStore {
  readonly #db: DatabaseSync;
  readonly #id: string;
  readonly #changed: () => void;
  constructor(db: DatabaseSync, id: string, changed: () => void = () => {}) { this.#db = db; this.#id = id; this.#changed = changed; }

  get(key: string): string | null {
    const row = this.#db.prepare('select value from remote_state where messenger = ? and key = ?').get(this.#id, key);
    return row ? String(row.value) : null;
  }
  /** Literal prefix, scoped to this messenger; '%' and '_' are ordinary bytes. */
  entries(prefix: string): Array<{ key: string; value: string }> {
    return this.#db.prepare('select key, value from remote_state where messenger = ? and substr(key, 1, length(?)) = ? order by key')
      .all(this.#id, prefix, prefix).map(row => ({ key: String(row.key), value: String(row.value) }));
  }
  set(key: string, value: string | null): void {
    if (value === null) this.#db.prepare('delete from remote_state where messenger = ? and key = ?').run(this.#id, key);
    else this.#db.prepare(`insert into remote_state (messenger, key, value) values (?, ?, ?)
      on conflict (messenger, key) do update set value = excluded.value`).run(this.#id, key, value);
    if (key === 'mute') this.#changed();
  }
  /** Commit the command effect before any external reply or polling receipt. */
  applyTelegramMute(chatId: string, messageId: number, muted: boolean): string | null {
    const receipt = `telegram.mute:${chatId}:${messageId}`;
    if (this.get(receipt) !== null) return null;
    this.#db.exec('savepoint remote_mute');
    try {
      const reply = muted ? 'General stream muted' : `${Number(this.get('mute.missed') ?? 0)} messages arrived while muted`;
      this.set('mute', String(muted));
      if (!muted) this.set('mute.missed', '0');
      this.set(receipt, '1');
      this.#db.exec('release remote_mute');
      return reply;
    } catch (error) {
      this.#db.exec('rollback to remote_mute; release remote_mute');
      throw error;
    }
  }
  /** Count General sources, not rendered parts; duplicate frames stay suppressed. */
  suppressMutedMessage(messageId: string): boolean {
    const receipt = `mute.message:${messageId}`;
    if (this.get(receipt) !== null) return true;
    if (this.get('mute') !== 'true') return false;
    this.#db.exec('savepoint remote_missed');
    try {
      this.set('mute.missed', String(Number(this.get('mute.missed') ?? 0) + 1));
      this.set(receipt, '1');
      this.#db.exec('release remote_missed');
      return true;
    } catch (error) {
      this.#db.exec('rollback to remote_missed; release remote_missed');
      throw error;
    }
  }
  /** Synchronous replacement planning and its receipt commit as one unit. */
  transaction<T>(write: () => T): T {
    this.#db.exec('savepoint remote_state_write');
    try {
      const result = write();
      this.#db.exec('release remote_state_write');
      return result;
    } catch (error) {
      this.#db.exec('rollback to remote_state_write; release remote_state_write');
      throw error;
    }
  }
  /** Dedupe receipts and the next Telegram offset become durable together. */
  confirmTelegramUpdate(updateId: number, dedupe?: string): void {
    this.#db.exec('savepoint telegram_confirm');
    try {
      this.set(`telegram.update:${updateId}`, '1');
      if (dedupe) this.set(`telegram.${dedupe}`, '1');
      const offset = Math.max(Number(this.get('telegram.offset') ?? 0), updateId + 1);
      this.set('telegram.offset', String(offset));
      this.#db.exec('release telegram_confirm');
    } catch (error) {
      this.#db.exec('rollback to telegram_confirm; release telegram_confirm');
      throw error;
    }
  }
  status(): RemoteStatus {
    const row = this.#db.prepare('select disabled, reason, stop_cause from remote_status where messenger = ?').get(this.#id);
    return { disabled: row?.disabled === 1, reason: row?.reason === null || !row ? null : String(row.reason),
      ...(row?.stop_cause ? { stopCause: String(row.stop_cause) as RemoteStopCause } : {}) };
  }
  /** The gateway supplies an already-redacted reason; never persist a native error. */
  setStatus(status: RemoteStatus): void {
    this.#db.prepare(`insert into remote_status (messenger, disabled, reason, stop_cause) values (?, ?, ?, ?)
      on conflict (messenger) do update set disabled = excluded.disabled, reason = excluded.reason, stop_cause = excluded.stop_cause`)
      .run(this.#id, status.disabled ? 1 : 0, status.reason, status.stopCause ?? null);
    this.#changed();
  }
  pairing(): Pairing | null {
    const row = this.#db.prepare('select user_id, chat_id, guild_id, name from remote_pairings where messenger = ?').get(this.#id);
    return row ? { userId: String(row.user_id), chatId: String(row.chat_id), guildId: row.guild_id === null ? null : String(row.guild_id), name: String(row.name) } : null;
  }
  setPairing(pairing: Pairing | null): void {
    if (!pairing) { this.#db.prepare('delete from remote_pairings where messenger = ?').run(this.#id); this.#changed(); return; }
    this.#db.prepare(`insert into remote_pairings (messenger, user_id, chat_id, guild_id, name) values (?, ?, ?, ?, ?)
      on conflict (messenger) do update set user_id = excluded.user_id, chat_id = excluded.chat_id, guild_id = excluded.guild_id, name = excluded.name`)
      .run(this.#id, pairing.userId, pairing.chatId, pairing.guildId, pairing.name);
    this.#changed();
  }
  putRequest(request: PairingRequest): void {
    this.#db.prepare(`insert into remote_requests (messenger, code, user_id, chat_id, guild_id, name, created, expires) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (messenger, code) do update set user_id = excluded.user_id, chat_id = excluded.chat_id,
      guild_id = excluded.guild_id, name = excluded.name, created = excluded.created, expires = excluded.expires`)
      .run(this.#id, request.code, request.userId, request.chatId, request.guildId, request.name, request.created, request.expires);
  }
  requests(): PairingRequest[] {
    return this.#db.prepare('select * from remote_requests where messenger = ? order by created, code').all(this.#id).map(row => ({
      code: String(row.code), userId: String(row.user_id), chatId: String(row.chat_id), guildId: nullable(row.guild_id), name: String(row.name), created: String(row.created), expires: String(row.expires),
    }));
  }
  removeRequest(code: string): void {
    this.#db.prepare('delete from remote_requests where messenger = ? and code = ?').run(this.#id, code);
  }
  countReply(userId: string): number {
    this.#db.prepare(`insert into remote_senders (messenger, user_id, replies) values (?, ?, 1)
      on conflict (messenger, user_id) do update set replies = replies + 1`).run(this.#id, userId);
    return this.replies(userId);
  }
  replies(userId: string): number {
    return Number(this.#db.prepare('select replies from remote_senders where messenger = ? and user_id = ?').get(this.#id, userId)?.replies ?? 0);
  }
  putMessage(message: RemoteMessage): void {
    this.#db.prepare(`insert into remote_messages (messenger, chat_id, message_id, topic, message, ask, approval) values (?, ?, ?, ?, ?, ?, ?)
      on conflict (messenger, chat_id, message_id) do update set topic = excluded.topic,
      message = excluded.message, ask = excluded.ask, approval = excluded.approval`)
      .run(this.#id, message.chatId, message.messageId, message.topic, message.message, message.ask, message.approval);
  }
  message(chatId: string, messageId: string): RemoteMessage | null {
    const row = this.#db.prepare('select * from remote_messages where messenger = ? and chat_id = ? and message_id = ?').get(this.#id, chatId, messageId);
    return row ? { chatId: String(row.chat_id), messageId: String(row.message_id), topic: String(row.topic), message: nullable(row.message), ask: nullable(row.ask), approval: nullable(row.approval) } : null;
  }
  messagesForAsk(ask: string): RemoteMessage[] {
    return this.#db.prepare('select chat_id, message_id from remote_messages where messenger = ? and ask = ?')
      .all(this.#id, ask).map(row => this.message(String(row.chat_id), String(row.message_id))!);
  }
  messagesForApproval(approval: string): RemoteMessage[] {
    return this.#db.prepare('select chat_id, message_id from remote_messages where messenger = ? and approval = ?')
      .all(this.#id, approval).map(row => this.message(String(row.chat_id), String(row.message_id))!);
  }
  putOutbox(job: OutboxJob): void {
    this.#db.prepare(`insert into remote_outbox (messenger, id, kind, source, state, payload, created, updated, target) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (messenger, id) do update set kind = excluded.kind, source = excluded.source,
      state = excluded.state, payload = excluded.payload, created = excluded.created, updated = excluded.updated, target = excluded.target`)
      .run(this.#id, job.id, job.kind, job.source, job.state, JSON.stringify(job.payload), job.created, job.updated, job.target ?? null);
    this.#changed();
  }
  /** Persist the attempt fence or completion and message map as one SQLite unit. */
  writeOutbox(job: OutboxJob, attempt?: OutboxAttempt, message?: RemoteMessage): void {
    this.#db.exec('savepoint remote_outbox_write');
    try {
      this.putOutbox(job);
      if (attempt) this.putAttempt(attempt);
      if (message) this.putMessage(message);
      this.#db.exec('release remote_outbox_write');
    } catch (error) {
      this.#db.exec('rollback to remote_outbox_write; release remote_outbox_write');
      throw error;
    }
  }
  outbox(): OutboxJob[] {
    return this.#db.prepare('select * from remote_outbox where messenger = ? order by rowid').all(this.#id).map(row => ({
      ...(row.target === null ? {} : { target: String(row.target) }),
      id: String(row.id), kind: String(row.kind), source: nullable(row.source), state: String(row.state), payload: JSON.parse(String(row.payload)), created: String(row.created), updated: String(row.updated),
    }));
  }
  putAttempt(attempt: OutboxAttempt): void {
    this.#db.prepare(`insert into remote_outbox_attempts (messenger, id, job, at, outcome) values (?, ?, ?, ?, ?)
      on conflict (messenger, id) do update set outcome = excluded.outcome`)
      .run(this.#id, attempt.id, attempt.job, attempt.at, attempt.outcome);
  }
  attempts(job: string): OutboxAttempt[] {
    return this.#db.prepare('select * from remote_outbox_attempts where messenger = ? and job = ? order by rowid').all(this.#id, job).map(row => ({
      id: String(row.id), job: String(row.job), at: String(row.at), outcome: nullable(row.outcome),
    }));
  }
}
