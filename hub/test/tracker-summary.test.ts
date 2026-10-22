// T1: list/view projections and watcher filtering through the in-process tracker with fake time and Git.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import files, { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { Tracker, DEBOUNCE_MS, type ItemChange } from '../src/tracker/tracker.ts';
import { FakeClock } from './fake-clock.ts';
import { handleTaskRequest, type TaskRequest } from '../src/tracker/requests.ts';
import { tempProject } from './harness.ts';

for (const source of ['clean', 'changed', 'unvalidated', 'legacy'] as const) test(`startup recovery preserves the live item and handles a ${source} source`, async t => {
  const root = await tempProject(t);
  const options = { root, db: join(root, '.cland/hub.db'), clock: new FakeClock(), git: async () => null, readBase: async () => null };
  const tracker = new Tracker(options);
  t.after(() => tracker.stop());
  const item = await tracker.create({ id: 'human', name: 'human', role: null }, { size: 'S', title: 'Original' });
  const path = join(root, item.path), original = await files.readFile(path, 'utf8');
  await tracker.stop();
  const saved = source === 'changed' ? original.replace('title: Original', 'title: Editor save') : original;
  const captured = `${item.file}.00000000-0000-4000-8000-000000000000.${source === 'legacy' ? 'conflict' : 'tmp'}`;
  await files.writeFile(join(root, '.cland/tasks', captured), saved);
  const live = original.replace('title: Original', 'title: Generated');
  await files.writeFile(path, live);
  await files.writeFile(join(root, '.cland/tasks/.criterion-capture-00000000-0000-4000-8000-000000000000.json'), JSON.stringify({ file: item.file, captured,
    ...(['clean', 'changed'].includes(source) ? { expected: createHash('sha256').update(original).digest('hex') } : {}),
  }));
  const recovered = new Tracker(options);
  t.after(() => recovered.stop());
  recovered.start();
  assert.equal(await files.readFile(path, 'utf8'), live);
  assert.equal(recovered.view(item.id).title, 'Generated');
  const sources = (await files.readdir(join(root, '.cland/tasks'))).filter(name => name.startsWith(`${item.file}.`));
  if (source === 'clean') assert.deepEqual(sources, []);
  else {
    assert.equal(sources.length, 1);
    assert.equal(sources[0]!.endsWith(source === 'unvalidated' ? '.tmp' : '.conflict'), true);
    assert.equal(await files.readFile(join(root, '.cland/tasks', sources[0]!), 'utf8'), saved);
  }
});

for (const readable of [true, false]) test(`a post-publication I/O error preserves the ${readable ? 'changed' : 'unvalidated'} editor source`, async t => {
  const root = await tempProject(t);
  let captured = '', published = false, failed = false;
  const tracker = new Tracker({ root, db: ':memory:', clock: new FakeClock(), git: async () => null, readBase: async () => null,
    files: { ...files,
      rename: async (from, to) => {
        await files.rename(from, to);
        if (String(from).endsWith('.md') && String(to).endsWith('.tmp')) captured = String(to);
      },
      link: async (from, to) => {
        await files.link(from, to);
        if (captured && !published) {
          published = true;
          await files.writeFile(captured, (await files.readFile(captured, 'utf8')).replace('title: Original', 'title: Editor save'));
        }
      },
      readFile: async (path, encoding) => {
        if (path === captured && published && (!readable || !failed)) {
          failed = true;
          throw new Error('injected captured read failure');
        }
        return files.readFile(path, encoding);
      },
    },
  });
  t.after(() => tracker.stop());
  const actor = { id: 'human', name: 'human', role: null };
  const item = await tracker.create(actor, { size: 'S', title: 'Original', body: '## Acceptance criteria\n- [ ] C1. First' });
  const original = await files.readFile(join(root, item.path), 'utf8');
  await assert.rejects(tracker.criterion(actor, item.id, { op: 'done', criterion: 'C1' }), /injected captured read failure/);
  const sources = (await files.readdir(join(root, '.cland/tasks'))).filter(name => name.startsWith(`${item.file}.`));
  assert.equal(sources.length, 1);
  assert.equal(sources[0]!.endsWith(readable ? '.conflict' : '.tmp'), true);
  assert.equal(await files.readFile(join(root, '.cland/tasks', sources[0]!), 'utf8'), original.replace('title: Original', 'title: Editor save'));
  assert.match(await files.readFile(join(root, item.path), 'utf8'), /title: Original/);
});

test('watcher notifications and rescans ignore conflict captures without emitting an item change', async t => {
  const root = await tempProject(t);
  let changed!: (name: string | null) => void;
  const reads: string[] = [];
  const tracker = new Tracker({ root, db: ':memory:', clock: new FakeClock(), git: async () => null, readBase: async () => null,
    watch: (_dir, handlers) => { changed = handlers.changed; return { close() {} }; },
    files: { ...files, readFile: async (path, encoding) => { reads.push(path); return files.readFile(path, encoding); } },
  });
  t.after(() => tracker.stop());
  const item = await tracker.create({ id: 'human', name: 'human', role: null }, { size: 'S', title: 'Live item' });
  tracker.start();
  const events: unknown[] = [];
  tracker.onChange(event => events.push(event));
  const name = `${item.file}.00000000-0000-4000-8000-000000000000.conflict`;
  await writeFile(join(root, '.cland/tasks', name), (await files.readFile(join(root, item.path), 'utf8')).replace('title: Live item', 'title: Recovery source'));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    changed(name);
    t.mock.timers.tick(DEBOUNCE_MS + 1);
    // Queue behind any watcher read, then finish a full directory rescan as a durable boundary.
    await tracker.rescanAsync();
    assert.equal(reads.some(path => path.endsWith('.conflict')), false);
    assert.deepEqual(events, []);
    assert.deepEqual(tracker.list().map(item => [item.id, item.title]), [[item.id, 'Live item']]);
  } finally { t.mock.timers.reset(); }
});

test('list summaries omit import metadata and bookkeeping frontmatter available in view', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-tracker-summary-'));
  const tracker = new Tracker({ root, db: ':memory:', clock: new FakeClock(), git: async () => null, readBase: async () => null });
  t.after(async () => { await tracker.stop(); await rm(root, { recursive: true, force: true }); });
  const github = { repo: 'acme/widgets', number: 42, url: 'https://github.com/acme/widgets/issues/42' };
  const approval = { hash: 'accepted-plan', by: 'human', at: '2026-01-01T00:00:00.000Z' };
  await writeFile(join(root, '.cland/tasks/E-1-imported.md'), serializeItem({
    fm: {
      id: 'E-1', kind: 'epic', title: 'Imported', state: 'open', labels: [], assignee: null,
      parent: null, blocked_by: [], topic: null, branch: null,
      created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
      github, criterion_seq: 4, plan_approval: approval,
    },
    body: '## Acceptance criteria\n\n- [ ] C4. Imported criterion',
    comments: [{ author: 'human', at: '2026-01-01T00:00:00.000Z', text: 'Imported comment' }],
  }));
  tracker.rescan();

  const view = tracker.view('E-1');
  assert.deepEqual(view.github, github);
  assert.equal(Reflect.get(view, 'criterion_seq'), 4);
  assert.deepEqual(Reflect.get(view, 'plan_approval'), approval);
  assert.match(view.body, /Imported criterion/);
  assert.equal(view.comments[0]?.text, 'Imported comment');

  const [summary] = tracker.list();
  assert.equal(summary?.id, 'E-1');
  assert.equal(summary.title, 'Imported');
  for (const field of ['github', 'criterion_seq', 'plan_approval', 'body', 'comments']) {
    assert.equal(Object.hasOwn(summary, field), false, `list omits ${field}`);
  }
});

test('summary projection bounds the first open payload in a thousand-item tracker and preserves default lists', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-tracker-summary-'));
  const tracker = new Tracker({ root, db: ':memory:', clock: new FakeClock(), git: async () => null, readBase: async () => null });
  t.after(async () => { await tracker.stop(); await rm(root, { recursive: true, force: true }); });
  const at = '2026-01-01T00:00:00.000Z';
  for (let n = 1; n <= 1000; n++) await writeFile(join(root, `.cland/tasks/${n === 99 || n === 100 ? 'E' : 'T'}-${n}-fixture.md`), serializeItem({
    fm: { id: `${n === 99 || n === 100 ? 'E' : 'T'}-${n}`, kind: n === 99 || n === 100 ? 'epic' : 'task', title: `Fixture item ${n}`, state: n <= 100 ? 'open' : 'closed',
      ...(n === 99 || n === 100 ? {} : { status: n <= 100 ? 'planned' : 'done', size: 'M' }), labels: [], assignee: null, parent: n === 99 || n === 100 ? null : n <= 500 ? 'E-99' : 'E-100',
      blocked_by: n === 1 ? ['T-1000'] : [], topic: null, branch: null, created: at, updated: at },
    body: '## Summary\n' + 'Long agents text. '.repeat(100) + '\n\n## Acceptance criteria\n- [ ] C1. Works.',
    comments: [1, 2, 3].map(round => ({ author: 'reviewer', at, text: 'A long verdict reason. '.repeat(10),
      verdict: { verdict: 'review' as const, result: round === 3 ? 'clear' as const : 'not clear' as const, by: 'reviewer', run: `r${round}` } })),
  }));
  tracker.rescan();
  const list = async (fields: Record<string, unknown>) => (await handleTaskRequest(tracker,
    { type: 'task.list', id: 'list', ...fields } as TaskRequest, { id: 'human', name: 'human', role: null })) as { items: Array<Record<string, unknown>> };
  const full = await list({});
  assert.deepEqual(full.items, tracker.list(), 'no projection keeps the existing list contract');
  const open = await list({ projection: 'summary', state: 'open' });
  assert.equal(open.items.length, 100);
  assert.equal((open.items.find(i => i.id === 'E-99')?.child_counts as { total: number }).total, 498);
  assert.equal((open.items.find(i => i.id === 'E-100')?.child_counts as { done: number }).done, 500);
  assert.deepEqual(open.items[0]?.blocked_by, ['T-1000']);
  assert.deepEqual(open.items[0]?.open_blockers, [], 'closed blocker stays resolved without loading its row');
  assert.ok(Buffer.byteLength(JSON.stringify(open)) < 256 * 1024, 'open summaries with full text fit the 256 KiB startup reply budget');
  const all = await list({ projection: 'summary' });
  assert.equal(all.items.length, 1000);
  t.diagnostic(`summary bytes: open=${Buffer.byteLength(JSON.stringify(open))}, all=${Buffer.byteLength(JSON.stringify(all))}`);
  for (const row of all.items) {
    for (const field of ['body', 'comments', 'plan', 'file', 'verdictBase']) assert.equal(Object.hasOwn(row, field), false, field);
    assert.equal(Object.hasOwn(row, 'verify'), false);
    assert.equal((row.verdicts as Array<{ run: string }>).length, 1);
    assert.equal((row.verdicts as Array<{ run: string }>)[0]?.run, 'r3');
    const verdict=(row.verdicts as Array<{ round?: number; scope?: string; reason?: string }>)[0]!;
    assert.equal(verdict.round,row.state==='closed'?undefined:3);
    if (row.state==='closed') {
      assert.equal(verdict.scope,undefined);assert.equal(verdict.reason,undefined);
      assert.equal(Object.hasOwn(row,'agents_text'),false);assert.equal(Object.hasOwn(row,'decision'),false);
    }
    assert.deepEqual(row.criteria, { total: 1, done: 0, verified: 0, stale: 0, failed: 0 });
  }
  const closed=(await list({ projection: 'summary', state: 'closed' })).items;
  assert.equal(closed.length,900);
  const restored=new Set<string>();
  for (let n=0;n<closed.length;n+=100) {
    let ids=closed.slice(n,n+100).map(row=>String(row.id));
    while (ids.length) {
      const page=await handleTaskRequest(tracker,{type:'task.list',id:'closed-cards',projection:'summary',ids},
        {id:'human',name:'human',role:null}) as {items:Array<Record<string,unknown>>;remaining:string[]};
      assert.ok(page.items.length>0);assert.ok(Buffer.byteLength(JSON.stringify(page))<256*1024);
      for (const row of page.items) {
        assert.equal(restored.has(String(row.id)),false);restored.add(String(row.id));
        assert.deepEqual(row.agents_text,{sections:['Summary','Acceptance criteria'],words:310});
        assert.equal(Object.hasOwn(row,'body'),false);assert.equal(Object.hasOwn(row,'comments'),false);
        const verdicts=row.verdicts as Array<{run:string;round:number;reason:string}>;
        assert.equal(verdicts.length,1);assert.equal(verdicts[0]!.run,'r3');assert.equal(verdicts[0]!.round,3);
        assert.equal(verdicts[0]!.reason,'A long verdict reason.');
      }
      ids=page.remaining;
    }
  }
  assert.equal(restored.size,900);
  await assert.rejects(list({ projection: 'unknown' }), /projection/);
  const changes: ItemChange[] = [];
  tracker.onChange(change => changes.push(change));
  const human = { id: 'human', name: 'human', role: null, human: true };
  await tracker.edit(human, 'T-1000', { state: 'open' });
  assert.ok(changes.some(c => c.id === 'T-1' && c.item?.open_blockers?.includes('T-1000')), 'reopening refreshes the dependent event');
  changes.length = 0;
  await tracker.edit(human, 'T-1000', { state: 'closed' });
  assert.ok(changes.some(c => c.id === 'T-1' && c.item?.open_blockers?.length === 0), 'closing refreshes the dependent event');
});

// T1: the public summary projection counts children absent from an open-only list.
test('open summaries count closed children in mixed and completed epics', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: ':memory:', clock: new FakeClock(), git: async () => null, readBase: async () => null });
  t.after(() => tracker.stop());
  const at = '2026-01-01T00:00:00.000Z';
  const rows = [
    { id: 'R-1', kind: 'release', parent: null },
    { id: 'E-2', kind: 'epic', parent: 'R-1' },
    { id: 'E-3', kind: 'epic', parent: 'R-1' },
    { id: 'C-4', kind: 'category', parent: null },
    { id: 'E-5', kind: 'epic', parent: 'R-1', state: 'closed' as const },
    { id: 'T-6', kind: 'task', parent: 'C-4', status: 'qa' as const },
    { id: 'T-7', kind: 'task', parent: 'C-4', status: 'in progress' as const },
    { id: 'Q-8', kind: 'question', parent: 'C-4' },
    ...Array.from({ length: 18 }, (_, n) => ({ id: `T-${n + 10}`, kind: 'task', parent: n < 13 ? 'E-2' : 'E-3',
      state: n < 9 || n >= 13 ? 'closed' as const : 'open' as const, status: n < 9 || n >= 13 ? 'done' as const : n === 9 ? 'review' as const : 'planned' as const })),
  ];
  for (const row of rows) await writeFile(join(root, `.cland/tasks/${row.id}-fixture.md`), serializeItem({
    fm: { title: row.id, state: 'open', labels: [], assignee: null, blocked_by: [], topic: null, branch: null, created: at, updated: at, ...row },
    body: '', comments: [],
  }));
  tracker.rescan();
  const result = await handleTaskRequest(tracker, { type: 'task.list', id: 'list', projection: 'summary', state: 'open' },
    { id: 'human', name: 'human', role: null }) as { items: Array<Record<string, unknown>> };
  const counts = (id: string) => result.items.find(row => row.id === id)?.child_counts;
  assert.deepEqual(counts('E-2'), { total: 13, done: 9, statuses: { done: 9, review: 1, planned: 3 }, work: { 'in progress': 0, review: 1, qa: 0 } });
  assert.deepEqual(counts('E-3'), { total: 5, done: 5, statuses: { done: 5 }, work: { 'in progress': 0, review: 0, qa: 0 } });
  assert.deepEqual(counts('R-1'), { total: 3, done: 1, statuses: { 'in progress': 1, backlog: 1, done: 1 }, work: { 'in progress': 0, review: 1, qa: 0 } });
  assert.deepEqual(counts('C-4'), { total: 2, done: 0, statuses: { qa: 1, 'in progress': 1 }, work: { 'in progress': 1, review: 0, qa: 1 } });
  assert.deepEqual(tracker.listSummaries({ state: 'closed', kind: 'epic' })[0]?.child_counts,
    { total: 0, done: 0, statuses: {}, work: { 'in progress': 0, review: 0, qa: 0 } });
  assert.equal(result.items.some(row => row.state === 'closed'), false);
  assert.equal(result.items.some(row => row.kind === 'task' && Object.hasOwn(row, 'child_counts')), false);
});

// T1: existing task change notifications carry refreshed aggregates, without a list request.
test('task events refresh both container paths when a child changes state or parent', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: ':memory:', clock: new FakeClock(), git: async () => null, readBase: async () => null });
  t.after(() => tracker.stop());
  const human = { id: 'human', name: 'human', role: null, human: true };
  const release = await tracker.create(human, { kind: 'release', title: 'Release' });
  const epic = await tracker.create(human, { kind: 'epic', title: 'Epic', parent: release.id });
  const other = await tracker.create(human, { kind: 'epic', title: 'Other', parent: release.id });
  const child = await tracker.create(human, { title: 'Task', size: 'S', parent: epic.id });
  const changes: ItemChange[] = [];
  tracker.onChange(change => changes.push(change));
  await tracker.edit(human, child.id, { title: 'Renamed child' });
  assert.deepEqual(changes.map(c => c.id), [child.id], 'unchanged parent aggregates do not emit task frames');
  changes.length = 0;
  await tracker.edit(human, child.id, { state: 'closed' });
  assert.equal(changes.find(c => c.id === epic.id)?.item?.child_counts?.done, 1);
  assert.equal(changes.find(c => c.id === release.id), undefined, 'an unchanged release projection sends no redundant row');
  changes.length = 0;
  await tracker.edit(human, child.id, { state: 'open', status: 'review' });
  assert.equal(changes.find(c => c.id === epic.id)?.item?.child_counts?.done, 0);
  assert.equal(changes.find(c => c.id === epic.id)?.item?.child_counts?.work.review, 1);
  assert.equal(changes.find(c => c.id === release.id)?.item?.child_counts?.work.review, 1);
  changes.length = 0;
  await tracker.link(human, child.id, { parent: other.id });
  assert.equal(changes.find(c => c.id === epic.id)?.item?.child_counts?.total, 0);
  assert.equal(changes.find(c => c.id === other.id)?.item?.child_counts?.total, 1);
  assert.equal(changes.find(c => c.id === other.id)?.item?.child_counts?.work.review, 1);
  assert.equal(changes.find(c => c.id === release.id), undefined, 'moving a task within the same release leaves its roll-up unchanged');
  assert.equal(tracker.summary(release.id)?.child_counts?.work.review, 1);
  changes.length = 0;
  const extra = await tracker.create(human, { title: 'New child', size: 'S', parent: other.id });
  assert.equal(changes.find(c => c.id === other.id)?.item?.child_counts?.total, 2);
  changes.length = 0;
  await rm(join(root, extra.path));
  tracker.rescan();
  assert.equal(changes.find(c => c.id === other.id)?.item?.child_counts?.total, 1);
});

test('card transport facts stay compact and defer closed facts to by-id pages', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: ':memory:', clock: new FakeClock(), git: async () => null, readBase: async () => null });
  t.after(() => tracker.stop());
  const actor = { id: 'human', name: 'human', role: null };
  const item = await tracker.create(actor, { title: 'Card transport', size: 'S', branch: 't/card', body: '## Summary\n\nCompact card.' });
  const source = parseItem(await files.readFile(join(root, item.path), 'utf8'), item.file);
  source.fm.regression_of = 'T-999'; source.fm.follows = ['T-998'];
  await writeFile(join(root, item.path), serializeItem(source));
  tracker.rescan();
  tracker.useVerify(() => ({ id: 'verify-card', executor: 'local', state: 'finished', result: 'failed', head: 'a'.repeat(40), finished: null, artifact: 'private-log', cached: { run: 'prior', head: 'b'.repeat(40), tree: 'c'.repeat(40) } }));
  const lean = tracker.listSummaries()[0]!;
  for (const field of ['created', 'branch', 'verify', 'regression_of', 'follows']) assert.equal(Object.hasOwn(lean, field), false, `ordinary summary omits ${field}`);
  const open = tracker.listSummaries({}, { card: true })[0]!;
  assert.equal(open.branch, 't/card');
  assert.equal(open.created, item.created);
  assert.equal(open.regression_of, 'T-999');
  assert.deepEqual(open.follows, ['T-998']);
  assert.deepEqual(open.verify, { id: 'verify-card', executor: 'local', state: 'finished', result: 'failed', head: 'a'.repeat(40), finished: null, cached: true });
  await tracker.edit(actor, item.id, { state: 'closed' });
  const closed = tracker.listSummaries()[0]!;
  for (const field of ['created', 'branch', 'verify', 'regression_of', 'follows']) assert.equal(Object.hasOwn(closed, field), false, field);
  const page = tracker.summaryPage([item.id]).items[0]!;
  assert.equal(page.branch, 't/card');
  assert.equal(page.created, item.created);
  assert.equal(page.regression_of, 'T-999');
  assert.deepEqual(page.follows, ['T-998']);
  assert.equal(page.verify?.head, 'a'.repeat(40));
  assert.equal(Object.hasOwn(page.verify!, 'artifact'), false);
});
