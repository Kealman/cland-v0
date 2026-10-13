import { validTimestamp } from './criteria.ts';
import { fileNameOf, type Item } from './item.ts';
import { DEFAULT_LEVELS, Ladder, kindsFor } from './kinds.ts';
import { parseItemReference, prefixOf } from './prefixes.ts';

export type ClosingTime = { time: string; source: 'receipt' | 'journal' | 'commit' };
export type ClosingTimes = ReadonlyMap<number, readonly ClosingTime[]>;
export type MigrationFile = { file: string; item: Item };
type Change = { file: string; item: string; from: string; to: string };
type Reference = Change & { field: 'parent' | 'blocked_by'; index?: number };
export type MigrationPlan = {
  renames: Array<{ from: string; to: string }>;
  ids: Change[];
  references: Reference[];
  unresolved: Array<{ file: string; item: string; field: 'parent' | 'blocked_by' | 'closed'; reference: string; index?: number }>;
  closed: Array<ClosingTime & { file: string; item: string }>;
  titles: Change[];
  categories: Array<
    { action: 'convert'; file: string; id: string; title: string; fromKind: string; kind: 'category' }
    | { action: 'create'; file: string; id: string; title: string; kind: 'category'; state: 'open'; body: '' }
  >;
  labels: Array<{ file: string; item: string; label: 'tech-debt' }>;
  moves: Array<{ file: string; item: string; from: null; to: string }>;
};

const stripTitle = (title: string): string => title.replace(/^(?:epic|release|spec|question|map|task):\s*/i, '');

/** Pure, deterministic delta. nextNumber is the next free shared number (highWater + 1).
 * Entries identify source files so an applier can patch only named frontmatter fields.
 * Bodies, comments and unrelated metadata are deliberately absent from the delta.
 */
export function planMigration(files: readonly MigrationFile[], nextNumber: number, containers: readonly string[] = new Ladder(DEFAULT_LEVELS).containers, closingTimes: ClosingTimes = new Map()): MigrationPlan {
  const plan: MigrationPlan = { renames: [], ids: [], references: [], unresolved: [], titles: [], categories: [], labels: [], moves: [], closed: [] };
  const kinds = [...kindsFor(DEFAULT_LEVELS), ...containers, 'category'];
  const numberOf = (entry: MigrationFile): number => {
    const match = /^([a-z]-\d+)(?:-[^/]*)?\.md$/i.exec(entry.file);
    const n = match && parseItemReference(match[1]!, kinds)?.n;
    if (!n) throw new Error(`not an item file: ${entry.file}`);
    return n;
  };
  const sorted = [...files].sort((a, b) => numberOf(a) - numberOf(b));
  const byNumber = new Map<number, MigrationFile>();
  for (const entry of sorted) {
    const n = numberOf(entry);
    if (byNumber.has(n)) throw new Error(`multiple item files carry number ${n}`);
    byNumber.set(n, entry);
  }
  if (!Number.isSafeInteger(nextNumber) || nextNumber <= Math.max(0, ...byNumber.keys())) throw new Error('nextNumber must be above every item number');
  const techDebt = sorted.find(({ item: { fm } }) => fm.parent === null && fm.state === 'open' &&
    (fm.kind === 'category' || containers.includes(fm.kind) || fm.kind === 'map') && stripTitle(fm.title) === 'Tech debt');
  const canonical = (entry: MigrationFile): string => `${prefixOf(entry === techDebt ? 'category' : entry.item.fm.kind)}-${numberOf(entry)}`;
  const seed = (title: string): string => {
    const existing = sorted.find(({ item: { fm } }) => fm.kind === 'category' && fm.parent === null && fm.state === 'open' && stripTitle(fm.title) === title);
    if (existing) return canonical(existing);
    const id = `C-${nextNumber++}`;
    plan.categories.push({ action: 'create', file: fileNameOf(id, title), id, title, kind: 'category', state: 'open', body: '' });
    return id;
  };
  let techDebtId: string;
  if (techDebt) {
    techDebtId = canonical(techDebt);
    if (techDebt.item.fm.kind !== 'category') plan.categories.push({ action: 'convert', file: techDebt.file, id: techDebtId, title: 'Tech debt', fromKind: techDebt.item.fm.kind, kind: 'category' });
  } else techDebtId = seed('Tech debt');
  for (const title of ['Bugs', 'Follow-ups', 'Ideas']) seed(title);

  for (const entry of sorted) {
    const { file, item: { fm } } = entry;
    const id = canonical(entry);
    if (fm.state === 'closed' && fm.closed === undefined) {
      const candidates = closingTimes.get(numberOf(entry)) ?? [];
      const candidate = ['receipt', 'journal', 'commit'].flatMap(source => candidates.filter(c => c.source === source && validTimestamp(c.time)).sort((a, b) => Date.parse(b.time) - Date.parse(a.time)))[0];
      if (candidate) plan.closed.push({ file, item: id, ...candidate });
      else plan.unresolved.push({ file, item: id, field: 'closed', reference: 'no closing-time source' });
    }
    const change = (from: string, to: string): Change => ({ file, item: fm.id, from, to });
    const name = file.replace(/^[a-z]-\d+/i, id);
    if (name !== file) plan.renames.push({ from: file, to: name });
    if (fm.id !== id) plan.ids.push(change(fm.id, id));
    const reference = (raw: string, field: 'parent' | 'blocked_by', index?: number) => {
      const parsed = parseItemReference(raw, kinds);
      const target = parsed && byNumber.get(parsed.n);
      const at = index === undefined ? {} : { index };
      if (!target) plan.unresolved.push({ file, item: fm.id, field, reference: raw, ...at });
      else if (raw !== canonical(target)) plan.references.push({ ...change(raw, canonical(target)), field, ...at });
    };
    if (fm.parent !== null) reference(fm.parent, 'parent');
    fm.blocked_by.forEach((raw, index) => reference(raw, 'blocked_by', index));
    const title = stripTitle(fm.title);
    if (title !== fm.title) plan.titles.push(change(fm.title, title));
    if (fm.labels.includes('tech-debt')) {
      plan.labels.push({ file, item: fm.id, label: 'tech-debt' });
      if (fm.parent === null && entry !== techDebt) plan.moves.push({ file, item: fm.id, from: null, to: techDebtId });
    }
  }
  return plan;
}
