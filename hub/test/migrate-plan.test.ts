import test from 'node:test';
import assert from 'node:assert/strict';
import { planMigration, type MigrationFile, type MigrationPlan } from '../src/tracker/migrate.ts';
import { prefixOf, parseItemReference } from '../src/tracker/prefixes.ts';
import type { Frontmatter } from '../src/tracker/item.ts';

const file = (n: number, kind = 'task', fields: Partial<Frontmatter> = {}): MigrationFile => ({
  file: `T-${n}-original-slug.md`,
  item: { fm: { id: `T-${n}`, kind, title: 'Title', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: 'topic-old', branch: `t/T-${n}`, created: 'created', updated: 'updated', ...fields }, body: 'Body T-1', comments: [{ author: 'human', at: 'time', text: 'Comment T-1' }] },
});

// Simulate an applier using only the public delta; unrelated item fields must survive.
const apply = (files: MigrationFile[], plan: MigrationPlan): MigrationFile[] => {
  const out = structuredClone(files);
  for (const entry of out) {
    const source = entry.file;
    const fm = entry.item.fm;
    for (const c of plan.ids.filter(c => c.file === source)) fm.id = c.to;
    for (const c of plan.references.filter(c => c.file === source)) {
      if (c.field === 'parent') fm.parent = c.to;
      else fm.blocked_by[c.index!] = c.to;
    }
    for (const c of plan.titles.filter(c => c.file === source)) fm.title = c.to;
    for (const c of plan.categories) if (c.action === 'convert' && c.file === source) fm.kind = c.kind;
    if (plan.labels.some(c => c.file === source)) fm.labels = fm.labels.filter(l => l !== 'tech-debt');
    for (const c of plan.moves.filter(c => c.file === source)) fm.parent = c.to;
    entry.file = plan.renames.find(c => c.from === source)?.to ?? source;
  }
  for (const c of plan.categories) if (c.action === 'create') {
    const entry = file(Number(c.id.slice(2)), c.kind, { id: c.id, title: c.title, state: c.state, topic: null, branch: null });
    entry.file = c.file;
    entry.item.body = c.body;
    entry.item.comments = [];
    out.push(entry);
  }
  return out;
};

const empty = (plan: MigrationPlan) => assert.ok(Object.values(plan).every(part => part.length === 0), JSON.stringify(plan));

test('prefixes cover built-in and configured kinds and refuse unrelated or unsafe references', () => {
  for (const [kind, prefix] of [['release', 'R'], ['epic', 'E'], ['task', 'T'], ['question', 'Q'], ['map', 'M'], ['spec', 'S'], ['category', 'C'], ['initiative', 'I']]) {
    assert.equal(prefixOf(kind!), prefix);
    for (const raw of [`${prefix}-12`, `${prefix!.toLowerCase()}-12`]) assert.deepEqual(parseItemReference(raw, [kind!]), { prefix, n: 12 });
  }
  assert.deepEqual(parseItemReference('12'), { prefix: null, n: 12 });
  for (const raw of ['A-12', 'no', 'T-0', '-1', 'T-1.2', '9007199254740992']) assert.equal(parseItemReference(raw), null);
});

test('plans every prefix, exact title stripping, references and labels without touching inputs', () => {
  const files = [
    file(1, 'release', { title: 'rElEaSe: v0.1.1', version: '0.1.1' }),
    file(2, 'epic', { title: 'EpIc: Feature', parent: 'T-1' }),
    file(3, 'question', { title: 'qUeStIoN: Why', parent: 'T-2' }),
    file(4, 'map', { title: 'mAP: Route' }),
    file(5, 'spec', { title: 'sPeC: Design', parent: 'T-2' }),
    file(6, 'task', { title: 'tAsK: Build', parent: 'T-2', blocked_by: ['t-3', 'T-999', '4'], labels: ['keep', 'tech-debt'] }),
    file(7, 'task', { title: 'Research: Keep', labels: ['tech-debt'], state: 'closed' }),
    file(8, 'epic', { title: 'Tech debt' }),
    file(9, 'task', { parent: 'T-8', labels: ['tech-debt'] }),
    file(10, 'category', { title: 'Other category' }),
    file(11, 'initiative'),
  ];
  const original = structuredClone(files);
  const plan = planMigration(files, 30, ['release', 'epic', 'initiative']);
  assert.deepEqual(files, original);
  assert.deepEqual(plan.ids.map(c => c.to), ['R-1', 'E-2', 'Q-3', 'M-4', 'S-5', 'C-8', 'C-10', 'I-11']);
  assert.deepEqual(plan.renames.map(c => c.to), plan.ids.map(c => `${c.to}-original-slug.md`));
  assert.deepEqual(plan.titles.map(c => c.to), ['v0.1.1', 'Feature', 'Why', 'Route', 'Design', 'Build']);
  assert.ok(plan.references.some(c => c.item === 'T-6' && c.field === 'parent' && c.to === 'E-2'));
  assert.deepEqual(plan.references.filter(c => c.field === 'blocked_by').map(c => [c.index, c.to]), [[0, 'Q-3'], [2, 'M-4']]);
  assert.deepEqual(plan.unresolved.map(c => c.reference), ['T-999']);
  assert.ok(plan.references.some(c => c.item === 'T-9' && c.to === 'C-8'));
  assert.deepEqual(plan.categories.map(c => [c.action, c.id, c.title]), [['convert', 'C-8', 'Tech debt'], ['create', 'C-30', 'Bugs'], ['create', 'C-31', 'Follow-ups'], ['create', 'C-32', 'Ideas']]);
  assert.ok(plan.categories.filter(c => c.action === 'create').every(c => c.kind === 'category' && c.state === 'open' && c.body === ''));
  assert.deepEqual(plan.labels.map(c => c.item), ['T-6', 'T-7', 'T-9']);
  assert.deepEqual(plan.moves.map(c => [c.item, c.to]), [['T-7', 'C-8']]);
  const migrated = apply(files, plan);
  for (let i = 0; i < files.length; i++) {
    assert.deepEqual(migrated[i]!.item.body, files[i]!.item.body);
    assert.deepEqual(migrated[i]!.item.comments, files[i]!.item.comments);
    for (const key of ['topic', 'branch', 'created', 'updated'] as const) assert.equal(migrated[i]!.item.fm[key], files[i]!.item.fm[key]);
  }
});

test('seeds absent Tech debt first and excludes closed or parented stand-ins', () => {
  const plan = planMigration([file(1, 'epic', { title: 'Tech debt', state: 'closed' }), file(2, 'epic', { title: 'Tech debt', parent: 'T-1' }), file(3, 'task', { labels: ['tech-debt'] })], 10);
  assert.deepEqual(plan.categories.map(c => [c.id, c.title]), [['C-10', 'Tech debt'], ['C-11', 'Bugs'], ['C-12', 'Follow-ups'], ['C-13', 'Ideas']]);
  assert.equal(plan.moves[0]!.to, 'C-10');
});

test('migrated trees give empty plans and partial trees give only remaining steps', () => {
  const files = [file(1, 'epic', { title: 'Tech debt' }), file(2, 'task', { title: 'Task: Build', parent: 'T-1', labels: ['tech-debt'] })];
  const plan = planMigration(files, 10);
  const migrated = apply(files, plan);
  empty(planMigration(migrated, 13));
  // All renames, some ids, the conversion and one seed already applied.
  const partial = structuredClone(files);
  partial[0]!.file = 'C-1-original-slug.md';
  partial[0]!.item.fm.kind = 'category';
  partial[1]!.item.fm.labels = [];
  partial.push(migrated.find(entry => entry.item.fm.title === 'Bugs')!);
  const remainder = planMigration(partial, 11);
  assert.deepEqual(remainder.renames, []);
  assert.deepEqual(remainder.ids.map(c => c.to), ['C-1']);
  assert.deepEqual(remainder.categories.map(c => c.title), ['Follow-ups', 'Ideas']);
  assert.deepEqual(remainder.labels, []);
  assert.equal(remainder.references[0]!.to, 'C-1');
  empty(planMigration(apply(partial, remainder), 13));
  // Id can be ahead of its filename; migration still knows the original number.
  const idFirst = file(20, 'epic', { id: 'E-20' });
  const pending = planMigration([idFirst, ...migrated], 21);
  assert.equal(pending.ids.length, 0);
  assert.deepEqual(pending.renames, [{ from: 'T-20-original-slug.md', to: 'E-20-original-slug.md' }]);
});

test('ambiguous file numbers and a stale allocator are refused', () => {
  assert.throws(() => planMigration([file(1), file(1, 'epic')], 2), /multiple item files/);
  assert.throws(() => planMigration([file(1)], 1), /nextNumber/);
});

test('seeds reuse open categories by their planned titles and replace closed roots', () => {
  const files = [
    file(1, 'category', { id: 'C-1', title: 'Tech debt', state: 'closed' }),
    file(2, 'category', { id: 'C-2', title: 'ePiC: Bugs' }),
    file(3, 'category', { id: 'C-3', title: 'Follow-ups', state: 'closed' }),
    file(4, 'category', { id: 'C-4', title: 'Ideas', parent: 'T-1' }),
    file(5, 'task', { labels: ['tech-debt'] }),
  ];
  for (const entry of files.filter(entry => entry.item.fm.kind === 'category')) entry.file = entry.file.replace(/^T-/, 'C-');
  const plan = planMigration(files, 10);
  assert.deepEqual(plan.categories.map(c => [c.id, c.title]), [['C-10', 'Tech debt'], ['C-11', 'Follow-ups'], ['C-12', 'Ideas']]);
  assert.deepEqual(plan.titles.map(c => [c.item, c.to]), [['C-2', 'Bugs']]);
  assert.equal(plan.moves[0]!.to, 'C-10');
  empty(planMigration(apply(files, plan), 13));
});
