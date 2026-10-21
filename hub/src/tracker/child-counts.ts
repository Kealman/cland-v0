import type { IndexedItem } from './index-db.ts';
import type { Status } from './item.ts';
import type { Ladder } from './kinds.ts';

/** Progress members match the explorer: a release's containers, otherwise direct tasks.
 * Work columns count descendant tasks for releases, direct tasks elsewhere. */
export type ChildCounts = {
  total: number;
  done: number;
  statuses: Partial<Record<Status, number>>;
  work: Record<'in progress' | 'review' | 'qa', number>;
};

type Row = Pick<IndexedItem, 'id' | 'kind' | 'parent' | 'state' | 'status'>;
const active = new Set(['in progress', 'review', 'qa', 'ready']);

/** Operates on the complete index, before any list filter is applied. */
export function containerChildCounts(rows: readonly Row[], ladder: Ladder): Map<string, ChildCounts> {
  const kids = new Map<string, Row[]>();
  for (const row of rows) if (row.parent) {
    const children = kids.get(row.parent) ?? [];
    children.push(row);
    kids.set(row.parent, children);
  }
  const container = (row: Row) => ladder.containers.includes(row.kind) || row.kind === 'map' || kids.has(row.id);
  const release = (row: Row) => ladder.levels.length > 1 && row.kind === ladder.top;
  const states = new Map<string, Status>();
  const visiting = new Set<string>();
  const status = (row: Row): Status => {
    if (row.state === 'closed' || row.status === 'done') return 'done';
    if (!container(row)) return row.kind === 'task' ? row.status ?? 'backlog' : 'backlog';
    const cached = states.get(row.id);
    if (cached) return cached;
    if (visiting.has(row.id)) return 'backlog';
    visiting.add(row.id);
    const children = kids.get(row.id) ?? [];
    const subs = children.filter(container);
    const from = release(row) && subs.length ? subs : children;
    const statuses = from.map(status);
    const derived = statuses.some(s => active.has(s)) ? 'in progress' : statuses.includes('planned') ? 'planned' : 'backlog';
    visiting.delete(row.id);
    states.set(row.id, derived);
    return derived;
  };
  const result = new Map<string, ChildCounts>();
  for (const row of rows) if (container(row)) {
    const children = kids.get(row.id) ?? [];
    const members = children.filter(release(row) ? container : child => child.kind === 'task');
    const counts: ChildCounts = { total: members.length, done: 0, statuses: {}, work: { 'in progress': 0, review: 0, qa: 0 } };
    for (const member of members) {
      const st = status(member);
      counts.statuses[st] = (counts.statuses[st] ?? 0) + 1;
      if (st === 'done') counts.done++;
    }
    const seen = new Set<string>();
    const work = (child: Row): void => {
      if (seen.has(child.id)) return;
      seen.add(child.id);
      if (release(row) && container(child)) for (const next of kids.get(child.id) ?? []) work(next);
      else if (child.kind === 'task') {
        const st = status(child);
        if (st === 'in progress' || st === 'review' || st === 'qa') counts.work[st]++;
      }
    };
    for (const child of children) work(child);
    result.set(row.id, counts);
  }
  return result;
}
