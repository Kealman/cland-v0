// The tracker's index and claims: tables of their own in the hub's SQLite file, through a connection of
// their own. The index is derived from the files and rebuilt from them at every start; claims are hub
// state (a session's live hold on an item) and are never written to a file.
import { DatabaseSync } from 'node:sqlite';
import { idNumber, type Item, type Kind, type State, type VerdictKind, type VerdictResult } from './item.ts';

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
create table if not exists tracker_claims (
  item_id text primary key,
  session text not null,
  role text,
  claimed_at text not null
);
create table if not exists tracker_meta (
  key text primary key,
  value text not null
);
`;

/** Where an indexed version came from: the hub's own write, or a file changed outside the hub. */
export type Source = 'hub' | 'hand';

export type IndexedItem = {
  id: string;
  kind: Kind;
  title: string;
  state: State;
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

export type IndexMeta = { file: string; hash: string; source: Source; indexedAt: number };

export type Claim = { session: string; role: string | null; claimedAt: string };

export type ListFilter = {
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
  put(item: Item, meta: IndexMeta): void {
    const fm = item.fm;
    this.#tx(() => {
      this.#db.prepare('delete from tracker_items where id = ?').run(fm.id);
      this.#db
        .prepare(
          `insert into tracker_items (id, n, file, kind, title, state, assignee, parent, topic, branch, created, updated, hash, source, indexed_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(fm.id, idNumber(fm.id), meta.file, fm.kind, fm.title, fm.state, fm.assignee, fm.parent, fm.topic, fm.branch, fm.created, fm.updated, meta.hash, meta.source, meta.indexedAt);
      const label = this.#db.prepare('insert or ignore into tracker_labels (item_id, label) values (?, ?)');
      for (const l of fm.labels) label.run(fm.id, l);
      const blocker = this.#db.prepare('insert or ignore into tracker_blocked_by (item_id, blocker) values (?, ?)');
      for (const b of fm.blocked_by) blocker.run(fm.id, b);
      const verdict = this.#db.prepare('insert into tracker_verdicts (item_id, seq, verdict, result, by, run, author, at) values (?, ?, ?, ?, ?, ?, ?, ?)');
      item.comments.forEach((c, seq) => {
        if (c.verdict) verdict.run(fm.id, seq, c.verdict.verdict, c.verdict.result, c.verdict.by, c.verdict.run, c.author, c.at);
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

  get(id: string): IndexedItem | null {
    const r = this.#db.prepare('select * from tracker_items where id = ?').get(id) as Row | undefined;
    return r ? this.#hydrate(r) : null;
  }

  #hydrate(r: Row): IndexedItem {
    const id = r.id as string;
    return {
      id,
      kind: r.kind as Kind,
      title: r.title as string,
      state: r.state as State,
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

  // ---------------------------------------------------------------- claims

  claimOf(id: string): Claim | null {
    const r = this.#db.prepare('select session, role, claimed_at from tracker_claims where item_id = ?').get(id) as Row | undefined;
    return r ? { session: r.session as string, role: (r.role as string | null) ?? null, claimedAt: r.claimed_at as string } : null;
  }

  claims(): Map<string, Claim> {
    const rows = this.#db.prepare('select item_id, session, role, claimed_at from tracker_claims').all() as Row[];
    return new Map(rows.map((r) => [r.item_id as string, { session: r.session as string, role: (r.role as string | null) ?? null, claimedAt: r.claimed_at as string }]));
  }

  setClaim(id: string, claim: Claim | null): void {
    if (claim === null) this.#db.prepare('delete from tracker_claims where item_id = ?').run(id);
    else
      this.#db
        .prepare('insert into tracker_claims (item_id, session, role, claimed_at) values (?, ?, ?, ?) on conflict (item_id) do update set session = excluded.session, role = excluded.role, claimed_at = excluded.claimed_at')
        .run(id, claim.session, claim.role, claim.claimedAt);
  }
}
