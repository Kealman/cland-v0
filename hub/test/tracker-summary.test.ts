// T1: list/view projections through the in-process tracker with a fake clock and injected Git.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeItem } from '../src/tracker/item.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { FakeClock } from './fake-clock.ts';

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
