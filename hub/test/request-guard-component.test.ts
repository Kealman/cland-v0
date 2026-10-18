// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import { onCleanup } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectSocket, connectUi, connectWsUi, projectHub, startHub, tempProject } from './harness.ts';
import { BUDGET_MS } from '../src/hub/budget.ts';
import type { HubStatus } from '../src/protocol.ts';

const hubLog = async (root: string) => (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as Record<string, unknown>);

/** Twenty items, each on its own branch, each with a review verdict on a commit that is not its tip. */
async function project(root: string, n: number): Promise<void> {
  const tasks = join(root, '.cland', 'tasks');
  await mkdir(tasks, { recursive: true });
  for (let k = 1; k <= n; k++) {
    const reviewed = k.toString(16).padStart(40, '0');
    await writeFile(
      join(tasks, `T-${k}-item-${k}.md`),
      `---\nid: T-${k}\ntitle: Item ${k}\nbranch: t/${k}\n---\n\nBody.\n\n## Comments\n\n### rev-1 · 2026-10-09T08:00:00.000Z\n\nverdict: review\nresult: clear\nby: rev-1 [reviewer]\nrun: r-${k}\ncommit: ${reviewed}\n\nChecked.\n`,
    );
  }
}

test('a client flooding task.list does not hold up another client; its repeats are answered again and logged once', async (t) => {
  const root = await tempProject(t);
  await project(root, 20);
  const { discovery } = await projectHub(t, root);
  const flood = await connectUi(t, discovery, 'flood');
  const other = await connectUi(t, discovery, 'other');
  assert.equal(((await flood.request({ type: 'task.list' })).value as { items: unknown[] }).items.length, 20);

  // Calibrate the cost of this same burst with no competing client. This includes scheduling,
  // transport and serializing 500 twenty-item answers, which the handler's CPU budget does not.
  const baseline = async (item: string) => {
    const started = performance.now();
    const burst = Array.from({ length: 500 }, () => flood.request({ type: 'task.list' }, 30_000));
    const view = await flood.request({ type: 'task.view', item }, 30_000);
    assert.equal(view.ok, true);
    assert.ok((await Promise.all(burst)).every(a => a.ok));
    return performance.now() - started;
  };
  // Distinct, equally sized fixtures make both calibrations actual reads, even
  // when faster projections put the whole experiment inside the replay window.
  const before = await baseline('T-6');
  // the incident's burst: hundreds of identical reads in flight at once, while the other client asks its own
  const burst = Array.from({ length: 500 }, () => flood.request({ type: 'task.list' }, 30_000));
  const started = performance.now();
  const view = await other.request({ type: 'task.view', item: 'T-7' }, 30_000);
  const waited = performance.now() - started;
  assert.equal(view.ok, true);
  const answers = await Promise.all(burst);
  assert.ok(answers.every((a) => a.ok && (a.value as { items: unknown[] }).items.length === 20), 'every flooded read is answered');
  const after = await baseline('T-8');
  const calibrated = Math.max(before, after);
  t.diagnostic(`other client ${Math.round(waited)} ms; same-client burst baseline ${Math.round(before)}/${Math.round(after)} ms`);
  assert.ok(waited < Math.max(BUDGET_MS * 2, calibrated * 2), `the other client waited ${Math.round(waited)} ms behind the flood; baseline ${Math.round(calibrated)} ms`); // lint-allow-wall-clock: calibrated socket fairness is the behavior under test
  assert.equal((await other.request({ type: 'hub.status', flushLogs: true })).ok, true);

  const log = await hubLog(root);
  const tooFast = log.filter((r) => r.event === 'too-fast');
  assert.deepEqual(tooFast.map((r) => [r.tool, r.client]), [['task.list', 'flood']], 'logged once per connection and tool');
  assert.deepEqual(log.filter((r) => r.event === 'slow-request' && r.tool === 'task.list'), [], 'no task.list over the budget');
  const status = (await other.request({ type: 'hub.status' })).value as HubStatus;
  assert.ok((status.requests?.replayed ?? 0) > 0, 'hub status counts the reads answered again');

  // a write ends the replay: the flooding client's next read sees it
  const created = await flood.request({ size: 'M', type: 'task.create', title: 'After the flood' });
  assert.equal(created.ok, true, created.error);
  assert.equal(((await flood.request({ type: 'task.list' })).value as { items: unknown[] }).items.length, 21);
});

test('a cold task.list burst in one socket write shares its pending answer', async (t) => {
  const root = await tempProject(t);
  await project(root, 0);
  // No verdict refreshes: every read in this experiment has the same generation.
  for (let i = 1; i <= 20; i++) {
    await writeFile(join(root, '.cland', 'tasks', `T-${i}-item.md`), `---\nid: T-${i}\ntitle: Item ${i}\n---\n\nBody.\n`);
  }
  const { discovery } = await projectHub(t, root);
  const flood = await connectSocket(discovery.socket);
  t.after(() => flood.close());
  flood.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'cold-flood' });
  assert.equal((await flood.next()).type, 'welcome');

  // No answer has been cached. A single write reproduces Linux's batching of the
  // flood before the promise delivering the first task.list answer can resume.
  flood.write(Array.from({ length: 500 }, (_, i) => JSON.stringify({ type: 'task.list', id: `cold-${i}` }) + '\n').join(''));
  const ids = new Set<unknown>();
  for (let i = 0; i < 500; i++) {
    const answer = await flood.next(30_000);
    assert.equal(answer.ok, true);
    assert.equal((answer.value as { items: unknown[] }).items.length, 20);
    ids.add(answer.id);
  }
  assert.deepEqual(ids, new Set(Array.from({ length: 500 }, (_, i) => `cold-${i}`)), 'every request receives its own correlated answer');
  flood.send({ type: 'hub.status', id: 'status' });
  const status = (await flood.next()).value as HubStatus;
  assert.equal(status.requests?.replayed, 499, 'only the first cold read needs handling');

  // A write between two pending pairs starts a new read generation. The tracker
  // serializes task.view and task.edit, so the pairs must see different titles.
  flood.write([
    { type: 'task.view', item: 'T-1', id: 'before-1' },
    { type: 'task.view', item: 'T-1', id: 'before-2' },
    { type: 'task.edit', item: 'T-1', title: 'Renamed', id: 'write' },
    { type: 'task.view', item: 'T-1', id: 'after-1' },
    { type: 'task.view', item: 'T-1', id: 'after-2' },
  ].map(frame => JSON.stringify(frame) + '\n').join(''));
  const titles = new Map<unknown, string>();
  for (let i = 0; i < 5; i++) {
    const answer = await flood.next(30_000);
    assert.equal(answer.ok, true);
    titles.set(answer.id, (answer.value as { item: { title: string } }).item.title);
  }
  assert.deepEqual([...titles].sort(), [
    ['after-1', 'Renamed'], ['after-2', 'Renamed'],
    ['before-1', 'Item 1'], ['before-2', 'Item 1'],
    ['write', 'Renamed'],
  ]);
});

test('a handler over the budget is logged as slow-request with its tool, client and duration, and counted', async (t) => {
  const records: Array<Record<string, unknown>> = [];
  // every reading of the clock is a second later: each handler takes 1000 ms by the guard's watch
  let clock = 0;
  const hub = await startHub({ log: (r) => records.push(r), guard: { now: () => (clock += 1000) } });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub, 'slow-ui');
  assert.equal((await ui.request({ type: 'topic.list' })).ok, true);
  const slow = records.filter((r) => r.event === 'slow-request');
  assert.ok(slow.some((r) => r.tool === 'topic.list' && r.client === 'slow-ui' && (r.ms as number) >= 1000), JSON.stringify(slow));
});
