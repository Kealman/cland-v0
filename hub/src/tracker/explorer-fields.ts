// Cached explorer projection. Lua explorer.lua/explorer_card.lua define the rules.
import type { ItemSummary } from './tracker.ts';
import type { ChildCounts } from './child-counts.ts';
import type { Ladder } from './kinds.ts';
import type { Layer } from '../hub/visibility.ts';
import { compareRank } from './rank.ts';

export type SummaryText = { text?: string; from: string | null; provenance: string | null };
export type ExplorerVerdict = Pick<ItemSummary['verdicts'][number], 'verdict' | 'result' | 'by' | 'run' | 'at' | 'scope' | 'current'> & { item: string; title: string; round: number };
export type Activity = { at: string; item: string; title: string; source: 'item updated' | 'a message in its topic' };
export type ExplorerFields = {
  summary: SummaryText;
  blocked: boolean;
  derived_status: string;
  glyph: string;
  layer?: Layer;
  rollup?: {
    layer: Layer | null;
    stage: { number: number; total: number; name: string } | null;
    claims: Array<{ item: string; claim: NonNullable<ItemSummary['claim']> }>;
    holds: Array<{ item: string; hold: ItemSummary['holds'][number] }>;
    latest_verdict: ExplorerVerdict | null;
    last_activity: Activity;
  };
  next?: string | null;
};
type Aggregate = {
  fields: Omit<ExplorerFields, 'summary'> & { child_counts?: ChildCounts };
  claims: NonNullable<ExplorerFields['rollup']>['claims'];
  holds: NonNullable<ExplorerFields['rollup']>['holds'];
  layer: Layer | null;
  latest: ExplorerVerdict | null;
  activity: Activity;
  work: ChildCounts['work'];
  candidate: string | null;
};
const active = new Set(['in progress', 'review', 'qa', 'ready']);
const layerRank = { archive: 1, background: 2, watch: 3, now: 4 };
const done = (row: ItemSummary) => row.state === 'closed' || row.status === 'done';
const leafStatus = (row: ItemSummary) => row.kind === 'task' && row.status ? row.status : done(row) ? 'done' : 'backlog';
const title = (row: ItemSummary) => row.version && row.title !== row.version && row.title !== `v${row.version}` ? `${row.version} ${row.title}` : row.title;

/** Source rows and derived aggregates stay separate: updating an ancestor never dirties its children. */
export class ExplorerFieldsIndex {
  readonly rows = new Map<string, ItemSummary>();
  readonly #kids = new Map<string, Set<string>>();
  readonly #cache = new Map<string, Aggregate>();
  readonly #dirty = new Set<string>();
  readonly #layers = new Map<string, Layer>();
  readonly #messages = new Map<string, string>();
  readonly #stages = new Map<string, { number: number; total: number; name: string } | null>();
  readonly ladder: Ladder;
  readonly observed: (ids: string[], durationMs: number) => void;
  constructor(ladder: Ladder, observed: (ids: string[], durationMs: number) => void) { this.ladder=ladder; this.observed=observed; }

  update(id: string, row: ItemSummary | null): string[] {
    const old = this.rows.get(id);
    if (JSON.stringify(old ?? null) === JSON.stringify(row)) return [];
    this.#invalidate(id);
    if (old?.parent) this.#kids.get(old.parent)?.delete(id);
    if (row) {
      this.rows.set(id, row);
      if (row.parent) {
        const kids = this.#kids.get(row.parent) ?? new Set();
        kids.add(id); this.#kids.set(row.parent, kids);
      }
    } else {
      this.rows.delete(id); this.#cache.delete(id);
      this.#layers.delete(id); this.#messages.delete(id); this.#stages.delete(id);
    }
    this.#invalidate(id);
    // Only ancestor openness/reparenting affects next below the changed row.
    // Ordinary leaf edits retain the changed-row/ancestor recomputation boundary.
    return old?.state !== row?.state || old?.parent !== row?.parent ? this.#invalidateNextBelow(id) : [];
  }
  #parentsOpen(row: ItemSummary): boolean {
    const seen = new Set<string>();
    for (let parent = row.parent ? this.rows.get(row.parent) : undefined; parent && !seen.has(parent.id); parent = parent.parent ? this.rows.get(parent.parent) : undefined) {
      seen.add(parent.id);
      if (parent.state !== 'open') return false;
    }
    return true;
  }
  #invalidateNextBelow(id: string): string[] {
    const changed: string[] = [], seen = new Set([id]), pending = [...this.#kids.get(id) ?? []];
    for (let child; (child = pending.pop()) !== undefined;) {
      if (seen.has(child)) continue;
      seen.add(child);
      pending.push(...this.#kids.get(child) ?? []);
      const row = this.rows.get(child), value = this.#cache.get(child);
      if (!row || !value || !Object.hasOwn(value.fields, 'next')) continue;
      const next = this.#parentsOpen(row) ? value.candidate : null;
      if (value.fields.next !== next) { this.#dirty.add(child); changed.push(child); }
    }
    return changed;
  }
  stage(id: string, stage: { number: number; total: number; name: string } | null): void {
    if (JSON.stringify(stage) !== JSON.stringify(this.#stages.get(id))) { this.#stages.set(id, stage); this.#invalidate(id); }
  }
  context(layers: Record<string, Layer>, messages: Record<string, string>): void {
    for (const [id, row] of this.rows) {
      const layer = layers[id];
      const message = row.topic ? messages[row.topic] : undefined;
      if (this.#layers.get(id) !== layer || this.#messages.get(id) !== message) {
        if (layer) this.#layers.set(id, layer); else this.#layers.delete(id);
        if (message) this.#messages.set(id, message); else this.#messages.delete(id);
        this.#invalidate(id);
      }
    }
  }
  #invalidate(id: string): void {
    const seen = new Set<string>();
    for (let at: string | null | undefined = id; at && !seen.has(at); at = this.rows.get(at)?.parent) {
      seen.add(at); this.#dirty.add(at);
    }
  }
  #container(row: ItemSummary): boolean { return this.ladder.containers.includes(row.kind) || row.kind === 'map' || !!this.#kids.get(row.id)?.size; }
  flush(): string[] {
    const started = performance.now();
    const touched: string[] = [];
    const walk = (id: string, visiting = new Set<string>()): Aggregate | undefined => {
      if (!this.#dirty.has(id)) return this.#cache.get(id);
      const row = this.rows.get(id);
      if (!row || visiting.has(id)) return undefined;
      visiting.add(id);
      const kids = [...this.#kids.get(id) ?? []].flatMap(key => this.rows.get(key) ?? []).sort(compareRank);
      const subs = kids.map(child => ({ row: child, value: walk(child.id, visiting) })).filter(child => child.value !== undefined) as Array<{row: ItemSummary; value: Aggregate}>;
      const container = this.#container(row), release = this.ladder.levels.length > 1 && row.kind === this.ladder.top;
      const from = release && subs.some(child => this.#container(child.row)) ? subs.filter(child => this.#container(child.row)) : subs;
      const statuses = from.map(child => child.value.fields.derived_status);
      const status = !container ? leafStatus(row) : done(row) ? 'done' : statuses.some(st => st === 'in work' || active.has(st)) ? 'in work' : statuses.includes('planned') ? 'planned' : 'backlog';
      const blocked = !done(row) && (row.open_blockers?.length ?? 0) > 0;
      const glyph = container ? (status === 'done' ? '●' : status === 'in work' ? '◐' : '○')
        : blocked && !active.has(leafStatus(row)) ? '◌' : row.kind !== 'task' ? (done(row) ? '●' : '○')
        : (new Map([['done','●'],['in progress','◐'],['review','◉'],['qa','◉'],['ready','◉']]).get(row.status ?? '') ?? '○');
      const task = !container && row.kind === 'task';
      const claims = container ? subs.flatMap(child => child.value.claims) : task && row.claim ? [{item:id,claim:row.claim}] : [];
      const holds = container ? subs.flatMap(child => child.value.holds) : task ? row.holds.map(hold => ({item:id,hold})) : [];
      let layer: Layer | null = task ? this.#layers.get(id) ?? null : null;
      if (container) for (const child of subs) {
        const value = child.value.layer;
        if (value && (!layer || layerRank[value] > layerRank[layer])) layer = value;
      }
      const work: ChildCounts['work'] = { 'in progress': 0, review: 0, qa: 0 };
      for (const child of subs) for (const st of ['in progress','review','qa'] as const) work[st] += child.value.work[st];
      if (!container && row.kind === 'task' && (row.status === 'in progress' || row.status === 'review' || row.status === 'qa')) work[row.status]++;
      let latest: ExplorerVerdict | null = null;
      const rounds = {review:0,qa:0};
      for (const v of row.verdicts) {
        const candidate: ExplorerVerdict = {verdict:v.verdict,result:v.result,by:v.by,run:v.run,at:v.at,
          ...(v.scope ? {scope:v.scope} : {}),...(v.current !== undefined ? {current:v.current} : {}),item:id,title:title(row),round:++rounds[v.verdict]};
        if (!latest || candidate.at >= latest.at) latest = candidate;
      }
      let subtree: ExplorerVerdict | null = null;
      for (const child of subs) if (child.value.latest && (!subtree || child.value.latest.at >= subtree.at)) subtree = child.value.latest;
      if (subtree && (!latest || subtree.at >= latest.at)) latest = subtree;
      let activity: Activity = {at:row.updated,item:id,title:title(row),source:'item updated'};
      const message = this.#messages.get(id);
      if (message && message > activity.at) activity = {...activity,at:message,source:'a message in its topic'};
      for (const child of subs) if (child.value.activity.at > activity.at) activity = child.value.activity;
      const candidate = row.state !== 'open' ? null : !container ? row.kind === 'task' && row.status === 'planned' && !blocked ? id : null
        : subs.find(child => child.value.candidate)?.value.candidate ?? null;
      const fields: Aggregate['fields'] = {blocked,derived_status:status,glyph};
      const ownLayer = this.#layers.get(id);
      if (ownLayer) fields.layer = ownLayer;
      if (container) {
        const members = subs.filter(child => release ? this.#container(child.row) : child.row.kind === 'task');
        const counts: ChildCounts = {total:members.length,done:0,statuses:{},work:release ? {...work} : {'in progress':0,review:0,qa:0}};
        for (const child of members) {
          const st = (child.value.fields.derived_status === 'in work' ? 'in progress' : child.value.fields.derived_status) as keyof ChildCounts['statuses'];
          counts.statuses[st] = (counts.statuses[st] ?? 0)+1;
          if (st === 'done') counts.done++;
        }
        if (!release) for (const child of kids) {
          const st = leafStatus(child);
          if (st === 'in progress' || st === 'review' || st === 'qa') counts.work[st]++;
        }
        fields.child_counts = counts;
        fields.next = this.#parentsOpen(row) ? candidate : null;
        fields.rollup = {layer,stage:this.#stages.get(id) ?? null,
          claims,holds,latest_verdict:subtree,last_activity:activity};
      }
      const value = {fields,claims,holds,layer,latest,activity,work,candidate};
      this.#cache.set(id,value); this.#dirty.delete(id); visiting.delete(id); touched.push(id);
      return value;
    };
    for (const id of this.#dirty) walk(id);
    this.#dirty.clear();
    if (touched.length) this.observed(touched, performance.now()-started);
    return touched;
  }
  fields(id: string): Aggregate['fields'] | undefined { this.flush(); return this.#cache.get(id)?.fields; }
}
