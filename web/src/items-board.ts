import type { ExplorerSummary } from '../../shared/wire/index.ts';
import { itemRows, type ConnectionState } from './connection.ts';
import { currentRelease, done, numberOf, type TreeRow } from './items-tree.ts';
import type { ItemsPreferences } from './items-state.ts';

export const boardStatuses = ['in progress', 'review', 'qa', 'ready', 'planned', 'backlog', 'done'] as const;
/** Only presentation grouping lives here: counts, next and blocked remain hub facts. */
export function buildItemsBoard(connection: ConnectionState, preferences: ItemsPreferences, release: string | undefined, parent: string | undefined) {
  const items = itemRows(connection);
  const byId = new Map(items.map(item => [item.id, item]));
  const levels = connection.tracker?.levels ?? ['release', 'epic'];
  const scope = byId.get(preferences.scope ?? '') ?? currentRelease(items, levels[0], release);
  const under = (item: ExplorerSummary, id: string): boolean => {
    const seen = new Set<string>();
    let at: ExplorerSummary | undefined = item;
    while (at && !seen.has(at.id)) {
      if (at.id === id) return true;
      seen.add(at.id);
      at = byId.get(at.parent ?? '');
    }
    return false;
  };
  const compare = (a: ExplorerSummary, b: ExplorerSummary) => {
    const siblings = a.parent === b.parent ? connection.siblingOrders?.[a.parent ?? ''] : undefined;
    if (siblings) {
      const ai = siblings.indexOf(a.id), bi = siblings.indexOf(b.id);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
    }
    return (a.rank ?? numberOf(a.id) * 10) - (b.rank ?? numberOf(b.id) * 10) || numberOf(a.id) - numberOf(b.id);
  };
  // Preorder the hub hierarchy, retaining each parent's authoritative sibling order.
  const children = new Map<string, ExplorerSummary[]>();
  for (const item of items) {
    const key = item.parent && byId.has(item.parent) ? item.parent : '';
    const list = children.get(key) ?? [];
    list.push(item); children.set(key, list);
  }
  for (const list of children.values()) list.sort(compare);
  const ordered: ExplorerSummary[] = [], visited = new Set<string>();
  const walk = (item: ExplorerSummary) => {
    if (visited.has(item.id)) return;
    visited.add(item.id); ordered.push(item);
    children.get(item.id)?.forEach(walk);
  };
  children.get('')?.forEach(walk);
  [...items].sort(compare).forEach(walk); // Preserve legacy cycles once.
  const tabs = ordered.filter(item => scope && item.id !== scope.id && levels.includes(item.kind) && !done(item) && under(item, scope.id));
  const tab = tabs.find(item => item.id === parent);
  const rows: TreeRow[] = [];
  const loads = new Set<string>();
  const add = (item: ExplorerSummary, depth: number, group?: string) => rows.push({
    key: item.id, title: item.title, depth, parent: group, item, expandable: false, open: false, next: scope?.next === item.id,
  });
  const sections = (list: ExplorerSummary[], depth: number, group?: string) => {
    for (const status of boardStatuses) {
      if (status === 'done' && preferences.hideDone) continue;
      const members = list.filter(item => item.kind === 'task' && item.status === status);
      if (!members.length) continue;
      rows.push({ key: `${group ?? ':board'}:${status}`, title: `${status.toUpperCase()} · ${members.length}`, depth, parent: group, note: true, expandable: false, open: false });
      members.forEach(item => add(item, depth, group));
    }
    list.filter(item => item.kind !== 'task' && !connection.tracker?.ladder.flat().includes(item.kind) && (!preferences.hideDone || !done(item)))
      .forEach(item => add(item, depth, group));
  };
  const loadDescendants = (owner: ExplorerSummary) => {
    if (preferences.hideDone) return;
    loads.add(owner.id);
    for (const item of items) if (item.id !== owner.id && under(item, owner.id) && connection.tracker?.ladder.flat().includes(item.kind)) loads.add(item.id);
  };
  if (scope) {
    // Closed epics arrive on release pages, even while their own children stay unloaded.
    if (!preferences.hideDone) loads.add(scope.id);
    if (scope.kind === levels[0] && levels.length > 1 && !tab) {
      const epics = ordered.filter(item => item.parent === scope.id && item.kind === levels[1] && (!preferences.hideDone || !done(item)))
        .sort((a, b) => Number(done(a)) - Number(done(b)) || (done(a) && done(b) ? (a.closed ?? a.updated).localeCompare(b.closed ?? b.updated) : 0) || compare(a, b));
      for (const epic of epics) {
        const key = `board:${epic.id}`;
        const open = preferences.open[key] === true;
        const counts = epic.child_counts;
        rows.push({ key, title: epic.title, item: epic, depth: 0, expandable: true, open,
          facts: counts ? [`${counts.done}/${counts.total}`, ...boardStatuses.filter(status => status !== 'done' && counts.statuses[status])
            .map(status => `${counts.statuses[status]} ${status}`)] : [] });
        if (open) {
          loadDescendants(epic);
          sections(ordered.filter(item => item.id !== epic.id && under(item, epic.id)), 1, key);
        }
      }
      const direct = ordered.filter(item => item.parent === scope.id && item.kind === 'task' && (!preferences.hideDone || !done(item)));
      if (direct.length) {
        const key = `board:direct:${scope.id}`, open = preferences.open[key] === true;
        rows.push({ key, title: `Direct tasks (${direct.length})`, depth: 0, expandable: true, open });
        if (open) sections(direct, 1, key);
      }
    } else {
      const owner = tab ?? scope;
      loadDescendants(owner);
      sections(ordered.filter(item => item.id !== owner.id && under(item, owner.id)), 0);
    }
  } else sections(ordered.filter(item => !item.parent), 0);
  const categories = ordered.filter(item => connection.tracker?.ladder[0]?.includes(item.kind) && item.kind !== levels[0] && !done(item));
  const unscheduled = items.filter(item => !item.parent && !connection.tracker?.ladder.flat().includes(item.kind) && !done(item)).length;
  return { rows, scope, tabs, tab, categories, unscheduled, loads: [...loads] };
}
