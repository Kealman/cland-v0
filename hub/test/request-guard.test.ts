// The hub's request path under a flood (T-67), from the incident's shape: a UI client sending `task.list` over and
// over on a project of twenty items with verdicts. Another client is not held up beyond the budget, the repeats are
// answered from the previous answer and logged once, and a handler over the budget is logged as `slow-request`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, connectWsUi, startDaemon, startHub, tempProject } from './harness.ts';
import { BUDGET_MS } from '../src/hub/budget.ts';
import type { HubStatus } from '../src/protocol.ts';

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hubLog = async (root: string) => (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as Record<string, unknown>);

/** Twenty items, each on its own branch, each with a review verdict on a commit that is not its tip. */
async function project(root: string, n: number): Promise<void> {
  git(root, 'init', '-b', 'dev');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  await writeFile(join(root, 'base'), 'base\n');
  git(root, 'add', 'base');
  git(root, 'commit', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');
  const tasks = join(root, '.cland', 'tasks');
  await mkdir(tasks, { recursive: true });
  for (let k = 1; k <= n; k++) {
    const reviewed = git(root, 'commit-tree', `${base}^{tree}`, '-p', base, '-m', `reviewed ${k}`);
    git(root, 'update-ref', `refs/heads/t/${k}`, git(root, 'commit-tree', `${base}^{tree}`, '-p', reviewed, '-m', `tip ${k}`));
    await writeFile(
      join(tasks, `T-${k}-item-${k}.md`),
      `---\nid: T-${k}\ntitle: Item ${k}\nbranch: t/${k}\n---\n\nBody.\n\n## Comments\n\n### rev-1 · 2026-10-09T08:00:00.000Z\n\nverdict: review\nresult: clear\nby: rev-1 [reviewer]\nrun: r-${k}\ncommit: ${reviewed}\n\nChecked.\n`,
    );
  }
}

test('a client flooding task.list does not hold up another client; its repeats are answered again and logged once', async (t) => {
  const root = await tempProject(t);
  await project(root, 20);
  const { discovery } = await startDaemon(t, root);
  const flood = await connectUi(t, discovery, 'flood');
  const other = await connectUi(t, discovery, 'other');
  assert.equal(((await flood.request({ type: 'task.list' })).value as { items: unknown[] }).items.length, 20);

  // the incident's burst: hundreds of identical reads in flight at once, while the other client asks its own
  const burst = Array.from({ length: 500 }, () => flood.request({ type: 'task.list' }, 30_000));
  const started = performance.now();
  const view = await other.request({ type: 'task.view', item: 'T-7' });
  const waited = performance.now() - started;
  assert.equal(view.ok, true);
  const answers = await Promise.all(burst);
  assert.ok(answers.every((a) => a.ok && (a.value as { items: unknown[] }).items.length === 20), 'every flooded read is answered');
  assert.ok(waited < BUDGET_MS * 2, `the other client waited ${Math.round(waited)} ms behind the flood`);

  const log = await hubLog(root);
  const tooFast = log.filter((r) => r.event === 'too-fast');
  assert.deepEqual(tooFast.map((r) => [r.tool, r.client]), [['task.list', 'flood']], 'logged once per connection and tool');
  assert.deepEqual(log.filter((r) => r.event === 'slow-request' && r.tool === 'task.list'), [], 'no task.list over the budget');
  const status = (await other.request({ type: 'hub.status' })).value as HubStatus;
  assert.ok((status.requests?.replayed ?? 0) > 0, 'hub status counts the reads answered again');

  // a write ends the replay: the flooding client's next read sees it
  const created = await flood.request({ type: 'task.create', title: 'After the flood' });
  assert.equal(created.ok, true, created.error);
  assert.equal(((await flood.request({ type: 'task.list' })).value as { items: unknown[] }).items.length, 21);
});

test('a handler over the budget is logged as slow-request with its tool, client and duration, and counted', async (t) => {
  const records: Array<Record<string, unknown>> = [];
  // every reading of the clock is a second later: each handler takes 1000 ms by the guard's watch
  let clock = 0;
  const hub = await startHub({ log: (r) => records.push(r), guard: { now: () => (clock += 1000) } });
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub, 'slow-ui');
  assert.equal((await ui.request({ type: 'topic.list' })).ok, true);
  const slow = records.filter((r) => r.event === 'slow-request');
  assert.ok(slow.some((r) => r.tool === 'topic.list' && r.client === 'slow-ui' && (r.ms as number) >= 1000), JSON.stringify(slow));
});
