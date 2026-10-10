// The tracker's index and claims: tables of their own in the hub's SQLite file, through a connection of
// their own. The index is derived from the files and rebuilt from them at every start; claims are hub
// state (a session's live hold on an item) and are never written to a file.
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { idNumber, type Comment, type Verdict, type Item, type Kind, type State, type Status, type VerdictKind, type VerdictResult } from './item.ts';

const SCHEMA = `
create table if not exists tracker_items (
  id text primary key,
  n integer not null,
  file text not null,
  kind text not null,
  title text not null,
  state text not null,
  assignee text,
  parent text,
  topic text,
  branch text,
  created text not null,
  updated text not null,
  hash text not null,
  source text not null,
  indexed_at integer not null
);
create table if not exists tracker_labels (
  item_id text not null references tracker_items (id) on delete cascade,
  label text not null,
  primary key (item_id, label)
);
create index if not exists tracker_labels_label on tracker_labels (label);
create table if not exists tracker_blocked_by (
  item_id text not null references tracker_items (id) on delete cascade,
  blocker text not null,
  primary key (item_id, blocker)
);
create table if not exists tracker_verdicts (
  item_id text not null references tracker_items (id) on delete cascade,
  seq integer not null,
  verdict text not null,
  result text not null,
  by text not null,
  run text not null,
  author text not null,
  at text not null,
  primary key (item_id, seq)
);
-- Durable hub evidence: no foreign key into the rebuildable file index.
create table if not exists tracker_written_verdicts (
  item_id text not null,
  comment_key text not null,
  verdict text not null,
  result text not null,
  run text not null,
  commit_sha text,
  session_id text not null,
  role text,
  at text not null,
  primary key (item_id, comment_key)
);
create table if not exists tracker_claims (
  item_id text primary key,
  session text not null,
  role text,
  claimed_at text not null,
  session_id text
);
create table if not exists tracker_meta (
  key text primary key,
  value text not null
);
-- A prepared landing survives a crash or a failed lifecycle write. Git decides whether it actually landed.
create table if not exists tracker_merges (
  item_id text primary key,
  branch text not null,
  tip text not null,
  base text not null,
  commit_sha text not null,
  override_reason text,
  checkout_recovery text
);
`;

/** Where an indexed version came from: the hub's own write, or a file changed outside the hub. */
export type Source = 'hub' | 'hand';

export type IndexedItem = {
  id: string;
  kind: Kind;
  version?: string;
  title: string;
  state: State;
  status?: Status;
  labels: string[];
  assignee: string | null;
  parent: string | null;
  blocked_by: string[];
  topic: string | null;
  branch: string | null;
  created: string;
  updated: string;
  file: string;
};

/** A verdict as the index holds it: the verdict comment's header, its author and time. */
export type IndexedVerdict = Verdict & { author: string; at: string; source: 'hub' | 'file'; writer?: { sessionId: string; role: string | null }; current?: boolean };
type VerdictRecord = Verdict & { author: string; at: string };
type KeyedVerdict = { verdict: VerdictRecord; key: string };
export type CheckoutRecovery = { before: string; after: string };
export type MergeReceipt = { branch: string; tip: string; base: string; commit: string; override?: string; checkout?: CheckoutRecovery };

export type IndexMeta = { file: string; hash: string; source: Source; indexedAt: number };

/** A claim: who holds it by identity (`sessionId`, stable across renames) and by the name it had then (`session`). */
export type Claim = { session: string; sessionId: string; role: string | null; claimedAt: string };

export type ListFilter = {
  /** Descendants only, excluding the named root; combined with all other filters. */
  under?: string;
  state?: State;
  /** Every label listed must be on the item. */
  labels?: string[];
  kind?: Kind;
  assignee?: string;
  /** The item's latest verdict of this kind has this result. */
  verdict?: { verdict: VerdictKind; result: VerdictResult };
};

type Row = Record<string, string | number | null>;

export class TrackerIndex {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec('pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000;');
    this.#db.exec(SCHEMA);
    // Additive columns for databases created by earlier hub versions.
    const itemColumns = new Set((this.#db.prepare('pragma table_info(tracker_items)').all() as Row[]).map(r => r.name));
    if (!itemColumns.has('version')) this.#db.exec('alter table tracker_items add column version text');
    if (!itemColumns.has('status')) this.#db.exec('alter table tracker_items add column status text');
    const claimColumns = new Set((this.#db.prepare('pragma table_info(tracker_claims)').all() as Row[]).map((r) => r.name as string));
    if (!claimColumns.has('session_id')) this.#db.exec('alter table tracker_claims add column session_id text');
    const verdictColumns = new Set((this.#db.prepare('pragma table_info(tracker_verdicts)').all() as Row[]).map((r) => r.name));
    for (const column of ['commit_sha', 'comment_key']) if (!verdictColumns.has(column)) this.#db.exec(`alter table tracker_verdicts add column ${column} text`);
    const mergeColumns = new Set((this.#db.prepare('pragma table_info(tracker_merges)').all() as Row[]).map(r => r.name));
    if (!mergeColumns.has('checkout_recovery')) this.#db.exec('alter table tracker_merges add column checkout_recovery text');
  }

  close(): void {
    this.#db.close();
  }

  #tx<T>(fn: () => T): T {
    this.#db.exec('begin immediate');
    try {
      const v = fn();
      this.#db.exec('commit');
      return v;
    } catch (err) {
      this.#db.exec('rollback');
      throw err;
    }
  }

  /** Index one item's current version, replacing whatever the index held for its id. */
  put(item: Item, meta: IndexMeta, writer?: { id: string; role: string | null }): void {
    const fm = item.fm;
    this.#tx(() => {
      this.#db.prepare('delete from tracker_items where id = ?').run(fm.id);
      this.#db
        .prepare(
          `insert into tracker_items (id, n, file, kind, version, title, state, status, assignee, parent, topic, branch, created, updated, hash, source, indexed_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(fm.id, idNumber(fm.id), meta.file, fm.kind, fm.version ?? null, fm.title, fm.state, fm.status ?? null, fm.assignee, fm.parent, fm.topic, fm.branch, fm.created, fm.updated, meta.hash, meta.source, meta.indexedAt);
      const label = this.#db.prepare('insert or ignore into tracker_labels (item_id, label) values (?, ?)');
      for (const l of fm.labels) label.run(fm.id, l);
      const blocker = this.#db.prepare('insert or ignore into tracker_blocked_by (item_id, blocker) values (?, ?)');
      for (const b of fm.blocked_by) blocker.run(fm.id, b);
      const last = item.comments.at(-1);
      if (writer && last?.verdict) {
        const v = last.verdict;
        this.#db.prepare('insert or ignore into tracker_written_verdicts (item_id, comment_key, verdict, result, run, commit_sha, session_id, role, at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(fm.id, commentKey(last), v.verdict, v.result, v.run, v.commit ?? null, writer.id, writer.role, last.at);
      }
      const verdict = this.#db.prepare('insert into tracker_verdicts (item_id, seq, verdict, result, by, run, author, at, commit_sha, comment_key) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      item.comments.forEach((c, seq) => {
        if (c.verdict) verdict.run(fm.id, seq, c.verdict.verdict, c.verdict.result, c.verdict.by, c.verdict.run, c.author, c.at, c.verdict.commit ?? null, commentKey(c));
      });
      this.#raiseHighWater(idNumber(fm.id));
    });
  }

  remove(id: string): void {
    this.#db.prepare('delete from tracker_items where id = ?').run(id);
  }

  /** The index's view of which file holds which id, and what it last saw there. */
  metaOf(id: string): IndexMeta | null {
    const r = this.#db.prepare('select file, hash, source, indexed_at from tracker_items where id = ?').get(id) as Row | undefined;
    return r ? { file: r.file as string, hash: r.hash as string, source: r.source as Source, indexedAt: r.indexed_at as number } : null;
  }

  idOfFile(file: string): string | null {
    const r = this.#db.prepare('select id from tracker_items where file = ?').get(file) as Row | undefined;
    return (r?.id as string | undefined) ?? null;
  }

  ids(): string[] {
    return (this.#db.prepare('select id from tracker_items order by n').all() as Row[]).map((r) => r.id as string);
  }

  /** The highest item number ever indexed: an id is never handed out twice, even after its file is gone. */
  highWater(): number {
    const r = this.#db.prepare("select value from tracker_meta where key = 'high_water'").get() as Row | undefined;
    const m = this.#db.prepare('select max(n) as n from tracker_items').get() as Row | undefined;
    return Math.max(Number(r?.value ?? 0), Number(m?.n ?? 0));
  }

  #raiseHighWater(n: number): void {
    this.#db.prepare("insert into tracker_meta (key, value) values ('high_water', ?) on conflict (key) do update set value = max(cast(value as integer), cast(excluded.value as integer))").run(String(n));
  }

  /** Reserve the next id: one above everything the index and `fileMax` (the folder's highest) know of. */
  allocate(fileMax: number): string {
    const n = Math.max(this.highWater(), fileMax) + 1;
    this.#raiseHighWater(n);
    return `T-${n}`;
  }

  list(filter: ListFilter = {}): IndexedItem[] {
    const where: string[] = [];
    const args: Array<string | number> = [];
    if (filter.under) {
      where.push(`i.id in (with recursive subtree(id) as (
        select id from tracker_items where parent = ?
        union select child.id from tracker_items child join subtree on child.parent = subtree.id
      ) select id from subtree where id != ?)`);
      args.push(filter.under, filter.under);
    }
    if (filter.state) {
      where.push('i.state = ?');
      args.push(filter.state);
    }
    if (filter.kind) {
      where.push('i.kind = ?');
      args.push(filter.kind);
    }
    if (filter.assignee) {
      where.push('i.assignee = ?');
      args.push(filter.assignee);
    }
    for (const l of filter.labels ?? []) {
      where.push('exists (select 1 from tracker_labels l where l.item_id = i.id and l.label = ?)');
      args.push(l);
    }
    if (filter.verdict) {
      where.push('(select v.result from tracker_verdicts v where v.item_id = i.id and v.verdict = ? order by v.seq desc limit 1) = ?');
      args.push(filter.verdict.verdict, filter.verdict.result);
    }
    const rows = this.#db.prepare(`select i.* from tracker_items i ${where.length ? `where ${where.join(' and ')}` : ''} order by i.n`).all(...args) as Row[];
    return rows.map((r) => this.#hydrate(r));
  }

  /** Direct children only; hand-edit warnings need no unrelated labels or blockers. */
  children(id: string): IndexedItem[] {
    const rows = this.#db.prepare('select i.* from tracker_items i where parent = ? order by i.n').all(id) as Row[];
    return rows.map(row => this.#hydrate(row));
  }

  get(id: string): IndexedItem | null {
    const r = this.#db.prepare('select * from tracker_items where id = ?').get(id) as Row | undefined;
    return r ? this.#hydrate(r) : null;
  }

  #hydrate(r: Row): IndexedItem {
    const id = r.id as string;
    return {
      id,
      kind: r.kind as Kind,
      ...(r.version !== null ? { version: r.version as string } : {}),
      title: r.title as string,
      state: r.state as State,
      ...(r.status !== null ? { status: r.status as Status } : {}),
      labels: (this.#db.prepare('select label from tracker_labels where item_id = ? order by rowid').all(id) as Row[]).map((x) => x.label as string),
      assignee: (r.assignee as string | null) ?? null,
      parent: (r.parent as string | null) ?? null,
      blocked_by: (this.#db.prepare('select blocker from tracker_blocked_by where item_id = ? order by rowid').all(id) as Row[]).map((x) => x.blocker as string),
      topic: (r.topic as string | null) ?? null,
      branch: (r.branch as string | null) ?? null,
      created: r.created as string,
      updated: r.updated as string,
      file: r.file as string,
    };
  }

  /** Every item's verdicts, in file order: what `task.list` shows beside each summary. */
  verdicts(): Map<string, IndexedVerdict[]> {
    const rows = this.#db.prepare('select item_id, verdict, result, by, run, author, at, commit_sha, comment_key from tracker_verdicts order by item_id, seq').all() as Row[];
    const out = new Map<string, KeyedVerdict[]>();
    for (const r of rows) {
      const id = r.item_id as string;
      const list = out.get(id) ?? [];
      list.push({ verdict: { verdict: r.verdict as VerdictKind, result: r.result as VerdictResult, by: r.by as string, run: r.run as string, author: r.author as string, at: r.at as string, ...(r.commit_sha ? { commit: r.commit_sha as string } : {}) }, key: r.comment_key as string });
      out.set(id, list);
    }
    return new Map([...out].map(([id, list]) => [id, this.markVerdicts(id, list)]));
  }

  /** Each durable record can match only once, in write order, across the item's file-ordered comments.
   *  A copied comment cannot replay earlier evidence after a later verdict, even if its original is removed. */
  markVerdicts(id: string, verdicts: KeyedVerdict[]): IndexedVerdict[] {
    // rowid is the durable table's insertion order, independent of file sequence numbers and edited times.
    const rows = this.#db.prepare('select rowid as written_order, comment_key, session_id, role from tracker_written_verdicts where item_id = ? order by rowid').all(id) as Row[];
    const records = new Map(rows.map(r => [r.comment_key as string, r]));
    let lastMatched = 0;
    return verdicts.map(({ verdict, key }) => {
      const r = records.get(key);
      if (!r || (r.written_order as number) <= lastMatched) return { ...verdict, source: 'file' };
      lastMatched = r.written_order as number;
      return { ...verdict, source: 'hub', writer: { sessionId: r.session_id as string, role: r.role as string | null } };
    });
  }

  /** The gate's evidence follows durable write order, and every recorded comment must still be present. */
  mergeVerdicts(id: string, verdicts: KeyedVerdict[]): { verdicts: IndexedVerdict[]; missing?: { run: string; commit: string | null } } {
    const present = new Map(verdicts.map(v => [v.key, v.verdict]));
    const rows = this.#db.prepare('select comment_key, run, commit_sha, session_id, role from tracker_written_verdicts where item_id = ? order by rowid').all(id) as Row[];
    const selected: IndexedVerdict[] = [];
    for (const row of rows) {
      const v = present.get(row.comment_key as string);
      if (!v) return { verdicts: [], missing: { run: row.run as string, commit: row.commit_sha as string | null } };
      selected.push({ ...v, source: 'hub', writer: { sessionId: row.session_id as string, role: row.role as string | null } });
    }
    return { verdicts: selected };
  }

  recordMerge(id: string, receipt: MergeReceipt): void {
    this.#db.prepare('insert into tracker_merges (item_id, branch, tip, base, commit_sha, override_reason, checkout_recovery) values (?, ?, ?, ?, ?, ?, ?) on conflict (item_id) do update set branch = excluded.branch, tip = excluded.tip, base = excluded.base, commit_sha = excluded.commit_sha, override_reason = excluded.override_reason, checkout_recovery = excluded.checkout_recovery')
      .run(id, receipt.branch, receipt.tip, receipt.base, receipt.commit, receipt.override ?? null, receipt.checkout ? JSON.stringify(receipt.checkout) : null);
  }

  mergeReceipt(id: string): MergeReceipt | null {
    const row = this.#db.prepare('select * from tracker_merges where item_id = ?').get(id) as Row | undefined;
    return row ? { branch: row.branch as string, tip: row.tip as string, base: row.base as string, commit: row.commit_sha as string, ...(row.override_reason === null ? {} : { override: row.override_reason as string }), ...(row.checkout_recovery === null ? {} : { checkout: JSON.parse(row.checkout_recovery as string) as CheckoutRecovery }) } : null;
  }

  // ---------------------------------------------------------------- claims

  claimOf(id: string): Claim | null {
    const r = this.#db.prepare('select session, session_id, role, claimed_at from tracker_claims where item_id = ?').get(id) as Row | undefined;
    return r ? claimOfRow(r) : null;
  }

  claims(): Map<string, Claim> {
    const rows = this.#db.prepare('select item_id, session, session_id, role, claimed_at from tracker_claims').all() as Row[];
    return new Map(rows.map((r) => [r.item_id as string, claimOfRow(r)]));
  }

  /** Every claim held by one session (by id) is held by another, in one statement (a role's handover, #31).
   *  Returns the items moved with their claims as they were. */
  moveClaims(fromSessionId: string, to: { session: string; sessionId: string; role: string | null }): Array<{ item: string; was: Claim }> {
    const was = [...this.claims()].filter(([, c]) => c.sessionId === fromSessionId);
    if (!was.length) return [];
    this.#db.prepare('update tracker_claims set session = ?, session_id = ?, role = ? where session_id = ?').run(to.session, to.sessionId, to.role, fromSessionId);
    return was.map(([item, c]) => ({ item, was: c }));
  }

  setClaim(id: string, claim: Claim | null): void {
    if (claim === null) this.#db.prepare('delete from tracker_claims where item_id = ?').run(id);
    else
      this.#db
        .prepare(
          'insert into tracker_claims (item_id, session, session_id, role, claimed_at) values (?, ?, ?, ?, ?) on conflict (item_id) do update set session = excluded.session, session_id = excluded.session_id, role = excluded.role, claimed_at = excluded.claimed_at',
        )
        .run(id, claim.session, claim.sessionId, claim.role, claim.claimedAt);
  }
}

/** A claim row; one from before claims carried the session id is held by the name it was taken under. */
const claimOfRow = (r: Row): Claim => ({
  session: r.session as string,
  sessionId: (r.session_id as string | null) ?? `name:${r.session as string}`,
  role: (r.role as string | null) ?? null,
  claimedAt: r.claimed_at as string,
});

/** A comment's identity survives unrelated edits and index rebuilds, but not changes to the verdict. */
export function commentKey(c: Comment): string {
  const v = c.verdict;
  return createHash('sha256').update(JSON.stringify([c.author, c.at, v?.verdict, v?.result, v?.by, v?.run, v?.commit ?? null, c.text])).digest('hex');
}
