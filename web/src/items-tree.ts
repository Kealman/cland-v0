import type { ExplorerSummary } from '../../shared/wire/index.ts';
import type { ConnectionState, PlanStages } from './connection.ts';

export type TreePreferences = { open: Record<string, boolean>; hideDone: boolean; archive: boolean };
export type TreeRow = {
  key: string; title: string; depth: number; parent?: string | undefined; item?: ExplorerSummary | undefined;
  ordinal?: number | undefined; expandable: boolean; open: boolean; fixed?: boolean; note?: boolean;
  count?: number; facts?: string[];
  next?: boolean;
};
export const numberOf = (id: string) => Number(id.split('-').at(-1)) || 0;
export const done = (item: ExplorerSummary) => item.state === 'closed' || item.status === 'done';
const rank = (item: ExplorerSummary) => item.rank ?? numberOf(item.id) * 10;
const byRank = (a: ExplorerSummary, b: ExplorerSummary) => rank(a) - rank(b) || numberOf(a.id) - numberOf(b.id);
const closedOrder = (a: ExplorerSummary, b: ExplorerSummary) => Number(!!a.closed) - Number(!!b.closed)
  || (a.closed ?? a.updated).localeCompare(b.closed ?? b.updated) || byRank(a, b);
export function currentRelease(items: ExplorerSummary[], top = 'release', selected?: string): ExplorerSummary | undefined {
  const releases = items.filter(item => item.kind === top && !done(item));
  return releases.find(item => item.id === selected) ?? releases.sort((a, b) =>
    (a.version ?? '').localeCompare(b.version ?? '', undefined, { numeric: true }) || byRank(a, b))[0];
}

/** Whole-model rebuild; the hub owns all status/roll-up derivation. */
export function buildItemsTree(connection: ConnectionState, preferences: TreePreferences, releaseId?: string): TreeRow[] {
  const items = connection.items ?? [];
  const by = new Map(items.map(item => [item.id, item]));
  const kids = new Map<string, ExplorerSummary[]>();
  const ordinal = new Map<string, number>();
  const levels = connection.tracker?.levels ?? ['release', 'epic'];
  const ladder = connection.tracker?.ladder ?? [['release', 'category'], ['epic']];
  const kinds = new Set(ladder.flat());
  const isRelease = (item: ExplorerSummary) => levels.length > 1 && item.kind === levels[0];
  const isCategory = (item: ExplorerSummary) => ladder[0]?.includes(item.kind) && item.kind !== levels[0];
  const container = (item: ExplorerSummary) => kinds.has(item.kind) || item.kind === 'map' || !!kids.get(item.id)?.length;
  const loaded = items.filter(item => !connection.closedTasks || item.kind !== 'task' || !done(item));
  if (connection.closedTasks) for (const parent of ['', ...by.keys()]) for (const item of connection.closedTasks(parent)) {
    by.set(item.id, item);
    loaded.push(item);
  }
  const next = new Set(items.flatMap(item => item.next ? [item.next] : []));
  for (const item of loaded) {
    const parent = item.parent && by.has(item.parent) ? item.parent : '';
    if (!kids.has(parent)) kids.set(parent, []);
    kids.get(parent)!.push(item);
  }
  for (const [parent, children] of kids) {
    const positions = new Map(connection.siblingOrders?.[parent]?.map((id, index) => [id, index]));
    children.sort((a, b) => positions.has(a.id) || positions.has(b.id)
      ? (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity) : byRank(a, b));
    children.forEach((item, index) => ordinal.set(item.id, index + 1));
  }
  const children = (id: string) => kids.get(id) ?? [];
  const live = (list: ExplorerSummary[]) => list.filter(item => !done(item));
  const ordered = (list: ExplorerSummary[]) => [...live(list), ...list.filter(done).sort(closedOrder)];
  const rows: TreeRow[] = [];
  const visited = new Set<string>();
  const note = (key: string, title: string, depth: number, parent: string, facts: string[] = []) =>
    rows.push({ key, title, depth, parent, facts, note: true, expandable: false, open: false });
  const addList = (list: ExplorerSummary[], depth: number, parent: string) => {
    for (const item of ordered(list)) add(item, depth, parent);
  };
  const group = (key: string, title: string, list: ExplorerSummary[], depth: number, parent?: string, facts: string[] = []) => {
    const open = preferences.open[key] ?? false;
    rows.push({ key, title, count: list.length, depth, parent, facts, expandable: true, open });
    if (open) {
      if (key === ':releases') list.forEach(item => add(item, depth + 1, key));
      else addList(list, depth + 1, key);
    }
  };
  const stages = (list: ExplorerSummary[], plan: PlanStages, depth: number, parent: string) => {
    const at = new Map<string, number>();
    plan.forEach((stage, index) => stage.items.forEach(id => { if (!at.has(id)) at.set(id, index); }));
    plan.forEach((stage, index) => {
      const members = live(list).filter(item => at.get(item.id) === index);
      const summary = by.get(parent)?.stages?.find(value => value.name === stage.name);
      const busy = summary && ['in progress','review','qa','ready'].some(status => (summary.statuses[status] ?? 0) > 0);
      const state = !summary ? stage.state : summary.state === 'closed' ? 'closed' : summary.merged || busy ? 'in work' : summary.statuses.planned ? 'planned' : 'backlog';
      const progress = summary ? `${summary.merged}/${summary.total} merged` : '— merged';
      const qa = summary?.qa ?? stage.qa;
      note(`${parent}:stage:${index}`, stage.name, depth, parent, [`S${index + 1}`, state, progress,
        qa.scope === 'none' ? 'review only' : `qa ${qa.scope}`, ...(qa.scope === 'none' ? [] : [qa.when === 'after-stage' ? 'after stage' : 'per item'])]);
      addList(members, depth, parent);
    });
    const outside = live(list).filter(item => !at.has(item.id));
    if (outside.length) { note(`${parent}:outside`, 'Not in the plan', depth, parent); addList(outside, depth, parent); }
    if (!preferences.hideDone && list.some(done)) {
      note(`${parent}:done`, 'Done', depth, parent);
      addList(list.filter(done), depth, parent);
    }
  };
  function add(item: ExplorerSummary, depth: number, parent?: string, fixed = false) {
    if (visited.has(item.id) || preferences.hideDone && done(item)) return;
    visited.add(item.id);
    const expandable = container(item);
    const open = fixed || (preferences.open[item.id] ?? !!isCategory(item));
    const list = children(item.id);
    const facts = isCategory(item) ? [`${item.child_counts ? item.child_counts.total - item.child_counts.done : live(list).length} open`, `${item.child_counts?.done ?? list.filter(done).length} done`,
      ...(connection.idleFrom?.includes(item.id) ? [`idle work${connection.idleFrom.length > 1 ? ` ${connection.idleFrom.indexOf(item.id) + 1}` : ''}`] : [])] : [];
    rows.push({ key: item.id, title: item.title, item, depth, parent, ordinal: ordinal.get(item.id), expandable, open: expandable && open, fixed, facts, next: next.has(item.id) });
    if (!expandable || !open) return;
    if (isRelease(item)) {
      addList(list.filter(container), depth + 1, item.id);
      const direct = list.filter(child => !container(child));
      if (direct.length) group(`:direct:${item.id}`, 'Direct tasks', direct, depth + 1, item.id);
    } else if (isCategory(item)) {
      const openItems = live(list);
      addList(openItems.slice(0, 3), depth + 1, item.id);
      if (openItems.length > 3) group(`:more:${item.id}`, `${openItems.length - 3} more`, openItems.slice(3), depth + 1, item.id);
      addList(list.filter(done), depth + 1, item.id);
      const hidden = item.child_counts?.done ?? list.filter(done).length;
      if (preferences.hideDone && hidden) note(`${item.id}:hidden`, `D hides ${hidden} done`, depth + 1, item.id);
    } else if (connection.plansById?.[item.id]?.length) stages(list, connection.plansById[item.id]!, depth + 1, item.id);
    else addList(list, depth + 1, item.id);
  }
  const release = levels.length > 1 ? currentRelease(items, levels[0], releaseId) : undefined;
  if (release) add(release, 0, undefined, true);
  const categories = items.filter(item => isCategory(item) && (!done(item) || preferences.archive)).sort((a, b) => numberOf(a.id) - numberOf(b.id));
  group(':categories', 'Categories', categories, 0, undefined, [`${categories.reduce((n, item) => n + (item.child_counts ? item.child_counts.total - item.child_counts.done : live(children(item.id)).length), 0)} open`]);
  const unscheduled = children('').filter(item => !isRelease(item) && !isCategory(item) && (!done(item) || preferences.archive));
  unscheduled.sort((a, b) => Number(b.kind === 'map') - Number(a.kind === 'map') || byRank(a, b));
  group(':unscheduled', 'Unscheduled', unscheduled, 0);
  const others = items.filter(item => isRelease(item) && item.id !== release?.id && (!done(item) || preferences.archive));
  others.sort((a, b) => Number(done(a)) - Number(done(b)) || (done(a) ? -closedOrder(a, b) : byRank(a, b)));
  group(':releases', 'Other releases', others, 0, undefined, preferences.archive ? ['Archive shown'] : ['A shows archive']);
  return rows;
}
