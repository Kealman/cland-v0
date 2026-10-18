// T2: durable merge queue admission through projectHub and its public merge/task frames.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, inProcessSpoke, projectHub, tempProject, until, type ProjectHubOptions } from './harness.ts';
import { manualTips } from './freshness-harness.ts';
import { FakeClock } from './fake-clock.ts';
import { dispatcherSpoke, value } from './validation-support.ts';
import { onCleanup } from './process-cleanup.ts';
import type { ItemView } from '../src/tracker/tracker.ts';

async function fixture(t: TestContext, options: ProjectHubOptions = {}) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[merge]\nqueue = true\n');
  const clock = new FakeClock();
  const tips = manualTips();
  const heads = new Map([['dev', 'a'.repeat(40)], ['t/parser', 'b'.repeat(40)]]);
  const { discovery, dispatcher } = await projectHub(t, root, {}, { clock, scheduleTips: tips.scheduleTips, readBase: async () => 'dev', git: async args => {
    if (args[0] === 'for-each-ref') return [...heads].map(([branch, head]) => `${head} refs/heads/${branch}`).join('\n');
    if (args[0] === 'rev-parse') return heads.get(args.at(-1)!.replace(/^refs\/heads\//, '').replace(/\^\{commit\}$/, '')) ?? null;
    if (args[0] === 'merge-base') return 'a'.repeat(40);
    if (args[0] === 'diff') return args.includes('--name-only') ? 'hub/src/parser.ts\0' : 'parser patch';
    if (args[0] === 'patch-id') return 'stable-patch';
    return null;
  }, ...options });
  await tips.refresh();
  const ui = await connectUi(t, discovery);
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'review-id', role: 'reviewer' });
  const { item } = await value<{ item: ItemView }>(ui, { type: 'task.create', title: 'Parser', size: 'M', branch: 't/parser' });
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'review-1' })).ok, true);
  await until(async () => { await clock.advance(100); return (await value<{ item: ItemView }>(ui, { type: 'task.view', item: item.id })).item.status === 'ready'; }, { what: 'reviewed task ready', timeoutMs: 1500 });
  return { root, ui, dispatcher, item, clock, heads, rev, tips, enqueuedAt: clock.now().toISOString() };
}

test('reviewed code is queued without landing and visible through task view and queue', async t => {
  const { ui, item, enqueuedAt } = await fixture(t);
  const result = await value<{ item: string; queued: number }>(ui, { type: 'merge', item: item.id });
  assert.deepEqual(result, { item: item.id, queued: 1 });
  const viewed = (await value<{ item: ItemView & { mergeQueue: { position: number; enqueued: string } } }>(ui, { type: 'task.view', item: item.id })).item;
  assert.equal(viewed.status, 'ready');
  assert.equal(viewed.state, 'open');
  assert.deepEqual(viewed.mergeQueue, { position: 1, enqueued: enqueuedAt });
  const queue = await value<{ entries: Array<{ item: string; head: string }> }>(ui, { type: 'merge.queue' });
  assert.equal(queue.entries[0]?.item, item.id);
  assert.equal(queue.entries[0]?.head, 'b'.repeat(40));
});

test('cancel drops the queued entry with a notice to requester and lead', async t => {
  const { root, ui, item } = await fixture(t);
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  const { topic } = await value<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Parser queue', item: item.id });
  await value(ui, { type: 'task.edit', item: item.id, assignee: 'impl' });
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  const queued = await coordinator.call<{ ok: boolean; queued: number }>('merge', { item: item.id });
  assert.equal(queued.queued, 1);
  assert.equal((await coordinator.call<{ entries: unknown[] }>('merge.queue')).entries.length, 1);
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1);
  const refused = await impl.call<{ ok: boolean; code: string }>('merge', { item: item.id, cancel: true });
  assert.equal(refused.code, 'forbidden');
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1);
  const cancelled = await coordinator.call<{ ok: boolean; cancelled: boolean }>('merge', { item: item.id, cancel: true });
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries, []);
  const history = await value<{ messages: Array<{ text: string; to: string[] }> }>(ui, { type: 'topic.history', topic: topic.id, limit: 100 });
  assert.ok(history.messages.some(message => /merge-queue-dropped.*cancelled/.test(message.text) && message.to.includes('coord') && message.to.includes('impl')));
});

test('changed heads, not-clear verdicts and closed items drop pinned requests', async t => {
  const { ui, item, rev, heads, clock, tips } = await fixture(t);
  for (const change of ['head', 'verdict', 'closed'] as const) {
    if (change !== 'head') {
      assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: `clear-${change}` })).ok, true);
      await until(async () => { await clock.advance(100); return (await value<{ item: ItemView }>(ui, { type: 'task.view', item: item.id })).item.status === 'ready'; }, { what: 'new reviewed head ready', timeoutMs: 1500 });
    }
    await value(ui, { type: 'merge', item: item.id });
    if (change === 'head') {
      heads.set('t/parser', 'c'.repeat(40));
      await tips.refresh();
    }
    if (change === 'verdict') assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'rejected' })).ok, true);
    if (change === 'closed') await value(ui, { type: 'task.close', item: item.id });
    const history = await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
    assert.ok(history.messages.some(message => message.text.includes('merge-queue-dropped') && message.text.includes(change === 'verdict' ? 'not clear' : change)), change);
    assert.deepEqual((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries, [], change);
  }
});

test('merge CLI renders queue replies, ordered entries and task positions', async t => {
  const { root, item, enqueuedAt } = await fixture(t);
  const merged = await cland(root, 'merge', item.id);
  assert.equal(merged.code, 0, merged.stderr);
  assert.equal(merged.stdout, `${item.id}: queued 1\n`);
  const queue = await cland(root, 'merge', 'queue', '--json');
  assert.equal(queue.code, 0, queue.stderr);
  assert.equal(JSON.parse(queue.stdout).entries[0].item, item.id);
  const viewed = await cland(root, 'task', 'view', item.id);
  assert.ok(viewed.stdout.includes(`merge queue 1 since ${enqueuedAt}`));
  const status = await cland(root, 'hub', 'status', '--json');
  assert.equal(status.code, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).mergeQueue[0].item, item.id);
  const cancelled = await cland(root, 'merge', item.id, '--cancel');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  assert.equal(cancelled.stdout, `${item.id}: cancelled\n`);
});

test('queued cancellation replies forbidden when its caller loses merge authority', async t => {
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  onCleanup(t, () => released.resolve());
  let hold = false;
  const { root, ui, dispatcher, item } = await fixture(t, { territoryLock: async (_root, operation) => {
    if (hold) { entered.resolve(); await released.promise; }
    return operation();
  } });
  await value(ui, { type: 'merge', item: item.id });
  await value(ui, { type: 'role.set', session: 'coord', role: 'coordinator' });
  const coordinator = await dispatcherSpoke(t, dispatcher, root, 'coord', 'queued-coord-id');
  hold = true;
  const merging = value<{ queued: number }>(ui, { type: 'merge', item: item.id });
  await entered.promise;
  // Direct frame dispatch admits cancellation synchronously behind the held merge.
  const cancelling = coordinator.call<{ ok: boolean; code: string; permission: string }>('merge', { item: item.id, cancel: true });
  await value(ui, { type: 'role.set', session: 'coord', role: 'implementer' });
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1, 'the queued cancellation has not changed the FIFO');
  released.resolve();
  assert.equal((await merging).queued, 1, 'the held merge completes before observing its queued successor');
  const result = await cancelling;
  assert.deepEqual([result.ok, result.code, result.permission], [false, 'forbidden', 'merge']);
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1, 'revoked authority cannot cancel');
});
