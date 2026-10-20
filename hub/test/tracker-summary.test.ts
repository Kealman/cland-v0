// T1: list/view projections and watcher filtering through the in-process tracker with fake time and Git.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import files, { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeItem } from '../src/tracker/item.ts';
import { Tracker, DEBOUNCE_MS } from '../src/tracker/tracker.ts';
import { FakeClock } from './fake-clock.ts';
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
