// The tracker's index and claims: tables of their own in the hub's SQLite file, through a connection of
// their own. The index is derived from the files and rebuilt from them at every start; claims are hub
// state (a session's live hold on an item) and are never written to a file.
import { parseCriteria, summarizeCriteria, countCriteria, type CriterionSummary, type CriteriaCounts } from './criteria.ts';
import type { EpicPlan } from './plan.ts';
import { compareRank, effectiveRank } from './rank.ts';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../database.ts';
import { parseItemReference, prefixOf } from './prefixes.ts';
import { parseFindings, countFindings } from './findings.ts';
import { idNumber, type Comment, type Verdict, type Item, type Kind, type State, type Status, type Size, type FoundBy, type VerdictKind, type VerdictResult, type ReviewScope } from './item.ts';

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
create table if not exists tracker_follows (
  item_id text not null references tracker_items (id) on delete cascade,
  predecessor text not null,
  primary key (item_id, predecessor)
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
-- Last accepted plans survive an invalid hand save and a hub restart. Valid files replace them.
create table if not exists tracker_plans (
  item_id text primary key,
  plan_json text not null
);
create table if not exists tracker_plan_items (
  epic_id text not null,
  n integer not null,
  primary key (n, epic_id)
);
create table if not exists tracker_claims (
  item_id text primary key,
  session text not null,
  role text,
  claimed_at text not null,
  session_id text
);
create table if not exists tracker_holds (
  item_id text not null,
  session_id text not null,
  session text not null,
  role text not null,
  held_at text not null,
  primary key (item_id, session_id)
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
  size?: Size;
  regression_of?: string;
  found_by?: FoundBy;
  rank: number;
  rank_set?: true;
  labels: string[];
  assignee: string | null;
  parent: string | null;
  blocked_by: string[];
  follows?: string[];
  topic: string | null;
  branch: string | null;
  created: string;
  updated: string;
  closed?: string;
  file: string;
};

/** A verdict as the index holds it: the verdict comment's header, its author and time. */
export type IndexedVerdict = Verdict & { author: string; at: string; source: 'hub' | 'file'; writer?: { sessionId: string; role: string | null }; current?: boolean };
type VerdictRecord = Verdict & { author: string; at: string };
type KeyedVerdict = { verdict: VerdictRecord; key: string };
export type CheckoutRecovery = { before: string; after: string };
export type MergeReceipt = { branch: string; tip: string; base: string; commit: string; override?: string; checkout?: CheckoutRecovery };
/** Durable completed stage evidence, independent of the suite cache and rebuildable item index. */
export type StageClosure = { hash: string; head: string; tree: string; linux: string; macos: string };

export type IndexMeta = { file: string; hash: string; source: Source; indexedAt: number };

/** A claim: who holds it by identity (`sessionId`, stable across renames) and by the name it had then (`session`). */
export type Claim = { session: string; sessionId: string; role: string | null; claimedAt: string };

export type VerifierHold = { session: string; sessionId: string; role: 'reviewer' | 'qa'; heldAt: string };

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

// Load ordered edges with the item row: hydration must not add label/blocker queries per item.
const ITEM_COLUMNS = `i.*,
  (select json_group_array(label) from
    (select label from tracker_labels where item_id = i.id order by rowid)) as labels_json,
  (select json_group_array(blocker) from
    (select blocker from tracker_blocked_by where item_id = i.id order by rowid)) as blockers_json,
  (select json_group_array(predecessor) from
    (select predecessor from tracker_follows where item_id = i.id order by rowid)) as follows_json`;

export class TrackerIndex {
  readonly #db: DatabaseSync;
  readonly #kinds: readonly string[] | undefined;
  /** Marks already selected with each index row, retained only for that returned object. */
  readonly #criteria = new WeakMap<IndexedItem, CriterionSummary[]>();

  constructor(path: string, kinds?: readonly string[], open = (path: string) => new DatabaseSync(path)) {
    this.#kinds = kinds;
    this.#db = openDatabase(path, open);
    this.#db.exec('pragma journal_mode = wal; pragma foreign_keys = on;');
    this.#db.exec(SCHEMA);
    this.#db.exec('create index if not exists tracker_items_number on tracker_items (n); create index if not exists tracker_items_parent on tracker_items (parent); create index if not exists tracker_items_file on tracker_items (file); create index if not exists tracker_items_branch on tracker_items (branch)');
    // Additive columns for databases created by earlier hub versions.
    const itemColumns = new Set((this.#db.prepare('pragma table_info(tracker_items)').all() as Row[]).map(r => r.name));
    if (!itemColumns.has('version')) this.#db.exec('alter table tracker_items add column version text');
    if (!itemColumns.has('rank')) this.#db.exec('alter table tracker_items add column rank integer');
    if (!itemColumns.has('criteria_ids')) {
      this.#db.exec("alter table tracker_items add column criteria_ids text not null default '[]'; update tracker_items set hash = ''");
    }
    if (!itemColumns.has('criteria_summary')) this.#db.exec("alter table tracker_items add column criteria_summary text not null default '[]'; update tracker_items set hash = ''");
    if (!itemColumns.has('closed')) this.#db.exec("alter table tracker_items add column closed text; update tracker_items set hash = ''");
    for (const column of ['size', 'regression_of', 'found_by']) if (!itemColumns.has(column)) this.#db.exec(`alter table tracker_items add column ${column} text; update tracker_items set hash = ''`);
    if (!itemColumns.has('status')) this.#db.exec('alter table tracker_items add column status text');
    const claimColumns = new Set((this.#db.prepare('pragma table_info(tracker_claims)').all() as Row[]).map((r) => r.name as string));
    if (!claimColumns.has('session_id')) this.#db.exec('alter table tracker_claims add column session_id text');
    const verdictColumns = new Set((this.#db.prepare('pragma table_info(tracker_verdicts)').all() as Row[]).map((r) => r.name));
    for (const column of ['commit_sha', 'comment_key', 'stage', 'stage_hash', 'scope', 'findings_json']) if (!verdictColumns.has(column)) this.#db.exec(`alter table tracker_verdicts add column ${column} text`);
    const writtenColumns = new Set((this.#db.prepare('pragma table_info(tracker_written_verdicts)').all() as Row[]).map(r => r.name));
    if (!writtenColumns.has('scope')) this.#db.exec('alter table tracker_written_verdicts add column scope text');
    const mergeColumns = new Set((this.#db.prepare('pragma table_info(tracker_merges)').all() as Row[]).map(r => r.name));
    if (!mergeColumns.has('checkout_recovery')) this.#db.exec('alter table tracker_merges add column checkout_recovery text');
    if (!mergeColumns.has('merged_at')) this.#db.exec('alter table tracker_merges add column merged_at text');
    // Rebuild the reverse membership index once, including retained plans from older hubs.
    this.#db.exec('delete from tracker_plan_items');
    for (const row of this.#db.prepare('select item_id, plan_json from tracker_plans').all() as Row[]) {
      this.#rememberPlanItems(row.item_id as string, JSON.parse(row.plan_json as string) as EpicPlan);
    }
  }

  #key(id: string): string { const n = idNumber(id); return Number.isSafeInteger(n) && n > 0 ? `T-${n}` : id; }

  #referenceKey(id: string): string { return parseItemReference(id, this.#kinds) ? this.#key(id) : id; }

  /** Numeric lookup uses tracker_items.n, indexed independently of the source file prefix. */
  resolve(id: string): string | null {
    const n = parseItemReference(id, this.#kinds)?.n;
    if (n === undefined) return null;
    const row = this.#db.prepare('select kind from tracker_items where n = ?').get(n) as Row | undefined;
    return row ? `${prefixOf(row.kind as string)}-${n}` : null;
  }

  #canonical(id: string): string { return this.resolve(id) ?? id; }

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
    const fm = { ...item.fm, id: `T-${idNumber(item.fm.id)}`,
      parent: item.fm.parent ? this.#referenceKey(item.fm.parent) : null,
      blocked_by: item.fm.blocked_by.map(id => this.#referenceKey(id)) };
    this.#tx(() => {
      const key = `closed-at:${fm.id}`;
      if (fm.state === 'open') this.#db.prepare('delete from tracker_meta where key = ?').run(key);
      else this.#db.prepare('insert or ignore into tracker_meta (key, value) values (?, ?)').run(key, fm.updated);
      this.#db.prepare('delete from tracker_items where id = ?').run(fm.id);
      this.#db
        .prepare(
          `insert into tracker_items (id, n, file, kind, version, title, state, status, size, regression_of, found_by, rank, assignee, parent, topic, branch, created, updated, closed, hash, source, indexed_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(fm.id, idNumber(fm.id), meta.file, fm.kind, fm.version ?? null, fm.title, fm.state, fm.status ?? null, fm.size ?? null, fm.regression_of ? this.#referenceKey(fm.regression_of) : null, fm.found_by ?? null, fm.rank ?? null, fm.assignee, fm.parent, fm.topic, fm.branch, fm.created, fm.updated, fm.closed ?? null, meta.hash, meta.source, meta.indexedAt);
      const criteria = parseCriteria(item.body, !['task', 'question', 'spec', 'map'].includes(fm.kind)).criteria;
      this.#db.prepare('update tracker_items set criteria_ids = ?, criteria_summary = ? where id = ?').run(JSON.stringify(criteria.flatMap(c => c.id ? [c.id] : [])), JSON.stringify(summarizeCriteria(criteria)), fm.id);
      const label = this.#db.prepare('insert or ignore into tracker_labels (item_id, label) values (?, ?)');
      for (const l of fm.labels) label.run(fm.id, l);
      const blocker = this.#db.prepare('insert or ignore into tracker_blocked_by (item_id, blocker) values (?, ?)');
      for (const b of fm.blocked_by) blocker.run(fm.id, b);
      const follow = this.#db.prepare('insert or ignore into tracker_follows (item_id, predecessor) values (?, ?)');
      for (const predecessor of fm.follows ?? []) follow.run(fm.id, this.#referenceKey(predecessor));
      const last = item.comments.at(-1);
      if (writer && last?.verdict) {
        const v = last.verdict;
        this.#db.prepare('insert or ignore into tracker_written_verdicts (item_id, comment_key, verdict, result, run, commit_sha, session_id, role, at, scope) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(fm.id, commentKey(last), v.verdict, v.result, v.run, v.commit ?? null, writer.id, writer.role, last.at, v.scope ?? null);
      }
      const verdict = this.#db.prepare('insert into tracker_verdicts (item_id, seq, verdict, result, by, run, author, at, commit_sha, comment_key, stage, stage_hash, scope, findings_json) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      item.comments.forEach((c, seq) => {
        if (c.verdict) verdict.run(fm.id, seq, c.verdict.verdict, c.verdict.result, c.verdict.by, c.verdict.run, c.author, c.at, c.verdict.commit ?? null, commentKey(c), c.verdict.stage ?? null, c.verdict.stage_hash ?? null, c.verdict.scope ?? null, c.verdict.findings !== undefined ? JSON.stringify(c.verdict.findings) : null);
      });
      this.#raiseHighWater(idNumber(fm.id));
    });
  }

  verifyItems(item: string | null, branch: string): string[] {
    return this.#db.prepare("select id from tracker_items where kind = 'task' and (n = ? or branch = ?)").all(item ? idNumber(item) : null, branch).map(row => this.#canonical(String(row.id)));
  }

  criteriaCounts(item: IndexedItem, tip: string | null, isCurrent?: (commit: string | null) => boolean | undefined): CriteriaCounts {
    return countCriteria(this.#criteria.get(item) ?? [], tip, isCurrent);
  }

  criterionIds(id: string): string[] {
    id = this.#key(id);
    const row = this.#db.prepare('select criteria_ids from tracker_items where id = ?').get(id) as Row | undefined;
    return row ? JSON.parse(row.criteria_ids as string) as string[] : [];
  }

  plan(id: string): EpicPlan | null {
    id = this.#key(id);
    const row = this.#db.prepare('select plan_json from tracker_plans where item_id = ?').get(id) as Row | undefined;
    return row ? JSON.parse(row.plan_json as string) as EpicPlan : null;
  }

  rememberPlan(id: string, plan: EpicPlan | null): void {
    id = this.#key(id);
    this.#tx(() => {
      if (plan === null) this.#db.prepare('delete from tracker_plans where item_id = ?').run(id);
      else this.#db.prepare('insert into tracker_plans (item_id, plan_json) values (?, ?) on conflict(item_id) do update set plan_json = excluded.plan_json').run(id, JSON.stringify(plan));
      this.#rememberPlanItems(id, plan);
    });
  }

  #rememberPlanItems(id: string, plan: EpicPlan | null, candidate?: EpicPlan | null): void {
    this.#db.prepare('delete from tracker_plan_items where epic_id = ?').run(id);
    const insert = this.#db.prepare('insert or ignore into tracker_plan_items (epic_id, n) values (?, ?)');
    for (const source of [plan, candidate]) for (const stage of source?.stages ?? []) for (const child of stage.lanes.flat()) insert.run(id, idNumber(child));
  }

  /** A refused semantic candidate still depends on its missing child, criteria or parenting. */
  rememberPlanCandidate(id: string, candidate: EpicPlan | null): void {
    id = this.#key(id);
    this.#tx(() => this.#rememberPlanItems(id, this.plan(id), candidate));
  }

  /** Accepted plans and parseable candidates affected by one item, without unrelated hydration. */
  plansContaining(id: string): string[] {
    return (this.#db.prepare('select epic_id from tracker_plan_items where n = ?').all(idNumber(id)) as Row[])
      .map(row => this.#canonical(row.epic_id as string));
  }

  plannedEntry(id: string): { stage: string | null; items: number[] } | null {
    const row = this.#db.prepare('select value from tracker_meta where key = ?').get(`planned-entry:${idNumber(id)}`) as Row | undefined;
    return row ? JSON.parse(row.value as string) as { stage: string | null; items: number[] } : null;
  }

  rememberPlannedEntry(id: string, entry: { stage: string | null; items: number[] }): void {
    this.#db.prepare('insert into tracker_meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value')
      .run(`planned-entry:${idNumber(id)}`, JSON.stringify(entry));
  }

  stageClosure(id: string, stage: string): StageClosure | null {
    const row = this.#db.prepare('select value from tracker_meta where key = ?').get(`stage-closure:${idNumber(id)}:${stage}`) as Row | undefined;
    return row ? JSON.parse(row.value as string) as StageClosure : null;
  }

  recordStageClosure(id: string, stage: string, closure: StageClosure): void {
    this.#db.prepare('insert into tracker_meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value')
      .run(`stage-closure:${idNumber(id)}:${stage}`, JSON.stringify(closure));
  }

  remove(id: string): void {
    id = this.#key(id);
    this.rememberPlan(id, null);
    this.#db.prepare('delete from tracker_items where id = ?').run(id);
  }

  /** The index's view of which file holds which id, and what it last saw there. */
  metaOf(id: string): IndexMeta | null {
    id = this.#key(id);
    const r = this.#db.prepare('select file, hash, source, indexed_at from tracker_items where id = ?').get(id) as Row | undefined;
    return r ? { file: r.file as string, hash: r.hash as string, source: r.source as Source, indexedAt: r.indexed_at as number } : null;
  }

  idOfFile(file: string): string | null {
    const r = this.#db.prepare('select id from tracker_items where file = ?').get(file) as Row | undefined;
    return r ? this.#canonical(r.id as string) : null;
  }

  ids(): string[] {
    return (this.#db.prepare('select id from tracker_items order by n').all() as Row[]).map((r) => this.#canonical(r.id as string));
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
  allocate(fileMax: number): number {
    const n = Math.max(this.highWater(), fileMax) + 1;
    this.#raiseHighWater(n);
    return n;
  }

  list(filter: ListFilter = {}): IndexedItem[] {
    const where: string[] = [];
    const args: Array<string | number> = [];
    if (filter.under) {
      where.push(`i.id in (with recursive subtree(id) as (
        select id from tracker_items where parent = ?
        union select child.id from tracker_items child join subtree on child.parent = subtree.id
      ) select id from subtree where id != ?)`);
      args.push(this.#key(filter.under), this.#key(filter.under));
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
    const rows = this.#db.prepare(`select ${ITEM_COLUMNS} from tracker_items i ${where.length ? `where ${where.join(' and ')}` : ''}`).all(...args) as Row[];
    return rows.map((r) => this.#hydrate(r)).sort(compareRank);
  }

  /** Resolve blockers in the index so an open-only client does not need the closed archive. */
  openBlockers(id: string): string[] {
    return this.#db.prepare(`select b.blocker from tracker_blocked_by b left join tracker_items i on i.id = b.blocker
      where b.item_id = ? and (i.state is null or i.state != 'closed') order by b.rowid`)
      .all(this.#key(id)).map(row => this.#canonical(String(row.blocker)));
  }

  blockedDependents(id: string): string[] {
    return this.#db.prepare('select item_id from tracker_blocked_by where blocker = ?').all(this.#key(id))
      .map(row => this.#canonical(String(row.item_id)));
  }

  /** Direct children only; hand-edit warnings need no unrelated labels or blockers. */
  children(id: string): IndexedItem[] {
    id = this.#key(id);
    const rows = this.#db.prepare(`select ${ITEM_COLUMNS} from tracker_items i where parent = ?`).all(id) as Row[];
    return rows.map(row => this.#hydrate(row)).sort(compareRank);
  }

  get(id: string): IndexedItem | null {
    id = this.#key(id);
    const r = this.#db.prepare(`select ${ITEM_COLUMNS} from tracker_items i where i.id = ?`).get(id) as Row | undefined;
    return r ? this.#hydrate(r) : null;
  }

  #hydrate(r: Row): IndexedItem {
    const id = r.id as string;
    const item: IndexedItem = {
      id: this.#canonical(id),
      kind: r.kind as Kind,
      rank: effectiveRank({ id, rank: r.rank as number | null }),
      ...(r.rank !== null ? { rank_set: true as const } : {}),
      ...(r.version !== null ? { version: r.version as string } : {}),
      title: r.title as string,
      state: r.state as State,
      ...(r.status !== null ? { status: r.status as Status } : {}),
      ...(r.size !== null ? { size: r.size as Size } : {}),
      ...(typeof r.found_by === 'string' ? { found_by: r.found_by as FoundBy } : {}),
      ...(r.regression_of !== null ? { regression_of: this.#canonical(r.regression_of as string) } : {}),
      labels: JSON.parse(r.labels_json as string) as string[],
      assignee: (r.assignee as string | null) ?? null,
      parent: r.parent ? this.#canonical(r.parent as string) : null,
      blocked_by: (JSON.parse(r.blockers_json as string) as string[]).map(blocker => this.#canonical(blocker)),
      topic: (r.topic as string | null) ?? null,
      branch: (r.branch as string | null) ?? null,
      created: r.created as string,
      updated: r.updated as string,
      ...(r.closed !== null ? { closed: r.closed as string } : {}),
      file: r.file as string,
    };
    const follows = (JSON.parse(r.follows_json as string) as string[]).map(key => this.#canonical(key));
    if (follows.length) item.follows = follows;
    this.#criteria.set(item, JSON.parse(r.criteria_summary as string) as CriterionSummary[]);
    return item;
  }

  /** Every item's verdicts, in file order: what `task.list` shows beside each summary. */
  verdicts(item?: string): Map<string, IndexedVerdict[]> {
    const rows = this.#db.prepare(`select item_id, verdict, result, by, run, author, at, commit_sha, comment_key, stage, stage_hash, scope, findings_json from tracker_verdicts ${item ? 'where item_id = ?' : ''} order by item_id, seq`).all(...(item ? [this.#key(item)] : [])) as Row[];
    const out = new Map<string, KeyedVerdict[]>();
    for (const r of rows) {
      const id = this.#canonical(r.item_id as string);
      const list = out.get(id) ?? [];
      const findings = r.findings_json === null ? undefined : parseFindings(JSON.parse(r.findings_json as string));
      list.push({ verdict: { verdict: r.verdict as VerdictKind, result: r.result as VerdictResult, by: r.by as string, run: r.run as string, author: r.author as string, at: r.at as string, ...(r.commit_sha ? { commit: r.commit_sha as string } : {}), ...(r.scope !== null ? { scope: r.scope as ReviewScope } : {}), ...(r.stage ? { stage: r.stage as string } : {}), ...(r.stage_hash ? { stage_hash: r.stage_hash as string } : {}), ...(findings !== undefined ? { findings, findingCounts: countFindings(findings) } : {}) }, key: r.comment_key as string });
      out.set(id, list);
    }
    return new Map([...out].map(([id, list]) => [id, this.markVerdicts(id, list)]));
  }

  /** Each durable record can match only once, in write order, across the item's file-ordered comments.
   *  A copied comment cannot replay earlier evidence after a later verdict, even if its original is removed. */
  markVerdicts(id: string, verdicts: KeyedVerdict[]): IndexedVerdict[] {
    id = this.#key(id);
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
    id = this.#key(id);
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

  /** Routing affinity follows authenticated verifier writes, independent of edited comment headers. */
  lastVerifier(item: string, role: 'reviewer' | 'qa'): { sessionId: string; at: string } | null {
    item = this.#key(item);
    const row = this.#db.prepare(`select session_id, at from tracker_written_verdicts
      where item_id = ? and role = ? and verdict = ? order by rowid desc limit 1`)
      .get(item, role, role === 'reviewer' ? 'review' : 'qa') as Row | undefined;
    return row ? { sessionId: row.session_id as string, at: row.at as string } : null;
  }

  recordMerge(id: string, receipt: MergeReceipt): void {
    id = this.#key(id);
    this.#db.prepare(`insert into tracker_merges (item_id, branch, tip, base, commit_sha, override_reason, checkout_recovery, merged_at) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (item_id) do update set branch = excluded.branch, tip = excluded.tip, base = excluded.base,
      merged_at = case when tracker_merges.commit_sha = excluded.commit_sha then coalesce(tracker_merges.merged_at, excluded.merged_at) else excluded.merged_at end,
      commit_sha = excluded.commit_sha, override_reason = excluded.override_reason, checkout_recovery = excluded.checkout_recovery`)
      .run(id, receipt.branch, receipt.tip, receipt.base, receipt.commit, receipt.override ?? null, receipt.checkout ? JSON.stringify(receipt.checkout) : null, new Date().toISOString());
  }

  /** Indexed lifecycle time, without materialising bodies, verdicts or journal history. */
  closedAt(id: string): string | null {
    id = this.#key(id);
    const row = this.#db.prepare(`select coalesce(i.closed, m.merged_at, t.value, i.updated) as at from tracker_items i
      left join tracker_merges m on m.item_id = i.id
      left join tracker_meta t on t.key = 'closed-at:' || i.id
      where i.id = ? and i.state = 'closed'`).get(id) as Row | undefined;
    return row?.at as string | null ?? null;
  }

  mergeReceipt(id: string): MergeReceipt | null {
    id = this.#key(id);
    const row = this.#db.prepare('select * from tracker_merges where item_id = ?').get(id) as Row | undefined;
    return row ? { branch: row.branch as string, tip: row.tip as string, base: row.base as string, commit: row.commit_sha as string, ...(row.override_reason === null ? {} : { override: row.override_reason as string }), ...(row.checkout_recovery === null ? {} : { checkout: JSON.parse(row.checkout_recovery as string) as CheckoutRecovery }) } : null;
  }

  holdsOf(id: string): VerifierHold[] {
    id = this.#key(id);
    const rows = this.#db.prepare('select * from tracker_holds where item_id = ? order by held_at, session_id').all(id) as Row[];
    return rows.map(r => ({ session: r.session as string, sessionId: r.session_id as string,
      role: r.role as VerifierHold['role'], heldAt: r.held_at as string }));
  }

  /** Verifier work on indexed items; orphan ownership rows stay durable for recovery. */
  indexedHolds(): Map<string, VerifierHold[]> {
    const rows = this.#db.prepare('select h.* from tracker_holds h join tracker_items i on i.id = h.item_id order by h.item_id, h.held_at, h.session_id').all() as Row[];
    const holds = new Map<string, VerifierHold[]>();
    for (const row of rows) {
      const item = this.#canonical(row.item_id as string);
      const list = holds.get(item) ?? [];
      list.push({ session: row.session as string, sessionId: row.session_id as string,
        role: row.role as VerifierHold['role'], heldAt: row.held_at as string });
      holds.set(item, list);
    }
    return holds;
  }

  setHold(id: string, sessionId: string, hold: VerifierHold | null): void {
    id = this.#key(id);
    if (!hold) this.#db.prepare('delete from tracker_holds where item_id = ? and session_id = ?').run(id, sessionId);
    else this.#db.prepare('insert into tracker_holds (item_id, session_id, session, role, held_at) values (?, ?, ?, ?, ?) on conflict (item_id, session_id) do update set session = excluded.session, role = excluded.role')
      .run(id, sessionId, hold.session, hold.role, hold.heldAt);
  }

  releaseHolds(sessionId: string): string[] {
    const rows = this.#db.prepare('select item_id from tracker_holds where session_id = ?').all(sessionId) as Row[];
    this.#db.prepare('delete from tracker_holds where session_id = ?').run(sessionId);
    return rows.map(r => this.#canonical(r.item_id as string));
  }

  pruneSession(sessionId: string): string[] {
    return this.#tx(() => {
      const rows = this.#db.prepare('select item_id from tracker_holds where session_id = ? union select item_id from tracker_claims where session_id = ?').all(sessionId, sessionId) as Row[];
      this.#db.prepare('delete from tracker_holds where session_id = ?').run(sessionId);
      for (const [item, claim] of this.claims()) if (claim.sessionId === sessionId) this.setClaim(item, null);
      return rows.map(row => this.#canonical(row.item_id as string));
    });
  }

  /** Durable provisional identities are the startup reconciliation source, including failed adoptions. */
  provisionalSessions(): string[] {
    const rows = this.#db.prepare(`select coalesce(session_id, 'name:' || session) as session_id from tracker_claims where coalesce(session_id, 'name:' || session) like 'name:%'
      union select session_id from tracker_holds where session_id like 'name:%'
      union select session_id from tracker_written_verdicts where session_id like 'name:%'`).all() as Row[];
    return rows.map(row => row.session_id as string);
  }

  /** A name known before hello and its session id identify the same holder, for claims, holds and verdict provenance. */
  adoptSession(name: string, sessionId: string): string[] {
    return this.#tx(() => {
      const alias = `name:${name}`;
      const changed = new Set<string>();
      for (const [id, claim] of this.claims()) if (claim.sessionId === alias) {
        this.setClaim(id, { ...claim, sessionId });
        changed.add(id);
      }
      const rows = this.#db.prepare('select item_id from tracker_holds where session_id = ?').all(alias) as Row[];
      for (const row of rows) {
        const id = row.item_id as string;
        const hold = this.holdsOf(id).find(h => h.sessionId === alias)!;
        this.setHold(id, sessionId, { ...hold, sessionId });
        this.setHold(id, alias, null);
        changed.add(id);
      }
      // Provenance is another durable use of the same writer identity. Preserve the role at write time.
      const verdicts = this.#db.prepare('select distinct item_id from tracker_written_verdicts where session_id = ?').all(alias) as Row[];
      this.#db.prepare('update tracker_written_verdicts set session_id = ? where session_id = ?').run(sessionId, alias);
      for (const row of verdicts) changed.add(row.item_id as string);
      return [...changed];
    });
  }

  // ---------------------------------------------------------------- claims

  claimOf(id: string): Claim | null {
    id = this.#key(id);
    const r = this.#db.prepare('select session, session_id, role, claimed_at from tracker_claims where item_id = ?').get(id) as Row | undefined;
    return r ? claimOfRow(r) : null;
  }

  claims(): Map<string, Claim> {
    const rows = this.#db.prepare('select item_id, session, session_id, role, claimed_at from tracker_claims').all() as Row[];
    return new Map(rows.map((r) => [this.#canonical(r.item_id as string), claimOfRow(r)]));
  }

  /** Current session work excludes claims whose item has left the rebuildable index. */
  indexedClaims(): Map<string, Claim> {
    const rows = this.#db.prepare('select c.* from tracker_claims c join tracker_items i on i.id = c.item_id').all() as Row[];
    return new Map(rows.map(r => [this.#canonical(r.item_id as string), claimOfRow(r)]));
  }

  /** Every claim held by one session (by id) is held by another, in one statement (a role's handover, #31).
   *  Returns the items moved with their claims as they were. */
  moveClaims(fromSessionId: string, to: { session: string; sessionId: string; role: string | null }, item?: string): Array<{ item: string; was: Claim }> {
    if (item !== undefined) item = this.#canonical(item);
    const was = [...this.claims()].filter(([id, c]) => c.sessionId === fromSessionId && (item === undefined || id === item));
    if (!was.length) return [];
    this.#db.prepare('update tracker_claims set session = ?, session_id = ?, role = ? where session_id = ? and (? is null or item_id = ?)').run(to.session, to.sessionId, to.role, fromSessionId, item ? this.#key(item) : null, item ? this.#key(item) : null);
    return was.map(([item, c]) => ({ item, was: c }));
  }

  lastClaim(id: string): Claim | null {
    const current = this.claimOf(id);
    if (current) return current;
    const row = this.#db.prepare('select value from tracker_meta where key = ?').get('last-claim:' + this.#key(id)) as Row | undefined;
    return JSON.parse(row?.value as string ?? 'null') as Claim | null;
  }

  setClaim(id: string, claim: Claim | null): void {
    id = this.#key(id);
    if (claim === null) {
      const previous = this.claimOf(id);
      if (previous) this.#db.prepare('insert into tracker_meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value').run('last-claim:' + id, JSON.stringify(previous));
      this.#db.prepare('delete from tracker_claims where item_id = ?').run(id);
    }
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
  return createHash('sha256').update(JSON.stringify([c.author, c.at, v?.verdict, v?.result, v?.by, v?.run, v?.commit ?? null, c.text, ...(v?.stage !== undefined || v?.stage_hash !== undefined ? [v?.stage ?? null, v?.stage_hash ?? null] : []), ...(v?.scope !== undefined ? [v.scope] : []), ...(v?.findings !== undefined ? [v.findings] : [])])).digest('hex');
}
