// T2: durable merge queue admission through projectHub and its public merge/task frames.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, inProcessSpoke, projectHub, tempProject, until, type ProjectHubOptions } from './harness.ts';
import { manualTips } from './freshness-harness.ts';
import { FakeClock } from './fake-clock.ts';
import { dispatcherSpoke, value } from './validation-support.ts';
import { onCleanup } from './process-cleanup.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef, RunStatus } from '../src/executor/executor.ts';
import type { VerificationQueue, MergeBatchStatus } from '../src/protocol.ts';
import { parseConfig } from '../src/init/config.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { batchRebuildReason } from '../src/hub/merge-batch-territory.ts';
import { verificationFixture } from './verification-fixture.ts';

async function checkoutClandFixture(cwd: string) {
  // Fake batch checkouts carry the runner that real cland candidates contain.
  await mkdir(cwd, { recursive: true });
  await verificationFixture(cwd);
}

async function fixture(t: TestContext, options: ProjectHubOptions = {}) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const repository = parseConfig(await readFile(new URL('../../.cland/config.toml', import.meta.url), 'utf8'), 'repository', {});
  await writeFile(join(root, '.cland/config.toml'), `[merge]\nqueue = ${repository.merge.queue}\n[verification]\ntest="true"\n`);
  const clock = new FakeClock();
  const tips = manualTips();
  const heads = new Map([['dev', 'a'.repeat(40)], ['t/parser', 'b'.repeat(40)]]);
  const { discovery, dispatcher, stop } = await projectHub(t, root, {}, { clock, scheduleTips: tips.scheduleTips, readBase: async () => 'dev', git: async (args, input) => {
    if (args[0] === 'for-each-ref') return [...heads].map(([branch, head]) => `${head} refs/heads/${branch}`).join('\n');
    if (args[0] === 'show-ref' && args.includes('--exclude-existing=refs/heads/')) return input!.trim().split('\n').filter(ref => !heads.has(ref.slice('refs/heads/'.length))).join('\n');
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
  return { root, ui, dispatcher, item, clock, heads, rev, tips, stop, enqueuedAt: clock.now().toISOString() };
}

test('startup preserves the durable queue when branch enumeration omits a live ref', async t => {
  const { root, ui, item, clock, heads, stop } = await fixture(t);
  await value(ui, { type: 'merge', item: item.id });
  const expected = (await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries;
  await stop();
  const tips = manualTips();
  const reopened = await projectHub(t, root, {}, { clock, scheduleTips: tips.scheduleTips, readBase: async () => 'dev', git: async (args, input) => {
    // A successful but partial listing is indistinguishable from deletion on its own.
    if (args[0] === 'for-each-ref') return `${heads.get('dev')} refs/heads/dev`;
    if (args[0] === 'show-ref' && args.includes('--exclude-existing=refs/heads/')) {
      return input!.trim().split('\n').filter(ref => !heads.has(ref.replace(/^refs\/heads\//, ''))).join('\n');
    }
    if (args[0] === 'rev-parse') return heads.get(args.at(-1)!.replace(/^refs\/heads\//, '').replace(/\^\{commit\}$/, '')) ?? null;
    return null;
  } });
  const reconnected = await connectUi(t, reopened.discovery);
  assert.deepEqual((await value<{ mergeQueue: unknown[] }>(reconnected, { type: 'hub.status' })).mergeQueue, expected);
  assert.deepEqual((await value<{ entries: unknown[] }>(reconnected, { type: 'merge.queue' })).entries, expected);
});

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

test('a confirmed deleted branch drops its request with the original reason', async t => {
  const { ui, item, heads, tips } = await fixture(t);
  await value(ui, { type: 'merge', item: item.id });
  heads.delete('t/parser');
  await tips.refresh();
  assert.deepEqual((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries, []);
  const history = await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
  assert.ok(history.messages.some(message => message.text === `merge-queue-dropped ${item.id}: branch head changed or deleted`));
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

test('queued merged-tree budget refusal moves no ref or checkout', async t => {
  const reads: string[][] = [];
  const manifest = { version: 1 as const, source: { artifacts: [], commit: 'base' }, budget: { mode: 'enforce' as const, testSeconds: 5, fileSeconds: 60 }, files: { component: { seconds: 600, tests: 1 } }, tests: { 'component::rule': 600 }, allow: {} };
  const { ui, item, clock } = await fixture(t, { batchRepository: {
    git: async args => {
      reads.push(args);
      if (args[0] === 'rev-parse') return args.at(-1) === 'refs/heads/dev' ? 'a'.repeat(40) : 'b'.repeat(40);
      if (args[0] === 'merge-tree') return 'c'.repeat(40) + '\0';
      throw new Error(`unexpected mutation: ${args[0]}`);
    },
    facts: async (tree, head, base) => {
      assert.deepEqual([tree, head, base], ['c'.repeat(40), 'b'.repeat(40), 'a'.repeat(40)], 'admit the merged tree against the captured base');
      return { context: { manifest, tiers: { component: 'T2' } }, workers: 1 };
    },
    identity: async () => { throw new Error('a refused tree cannot reach checkout preparation'); },
    checkout: async () => { throw new Error('a refused tree cannot be checked out'); },
    remove: async () => {},
  } });
  await value(ui, { type: 'merge', item: item.id });
  await clock.advance(601_000);
  await until(async () => (await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length === 0, { what: 'budget refusal drops queued candidate' });
  const history = await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
  assert.ok(history.messages.some(message => /merge-queue-dropped.*merge-budget.*T2 projected wall 600 s > 480 s/s.test(message.text)));
  assert.equal((await value<{ suites: unknown[] }>(ui, { type: 'hub.status' })).suites.length, 0);
  assert.ok(reads.every(args => ['rev-parse', 'merge-tree'].includes(args[0]!)), 'no checkout, commit or ref mutation');
});


test('a red singleton posts its bisection refusal to the member lead after appearing in both queues', async t => {
  const started = Promise.withResolvers<RunRef>();
  let receipt: RunStatus = { state: 'running' };
  const lease = (run: RunRef, deadline: string): Lease => ({ kind: 'local', run: run.id, created: '2026-10-16T12:00:00Z', deadline, resource: null });
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string) => lease(run, deadline));
  t.mock.method(LocalExecutor.prototype, 'prepare', async () => {});
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => { await writeFile(run.log, 'suite test failures [{"file":"hub/test/parser.test.ts","name":"rejects stale input"}]\n# tests 1\n# fail 1\n'); started.resolve(run); });
  t.mock.method(LocalExecutor.prototype, 'status', async () => receipt);
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  const candidateHead = 'f'.repeat(40), tree = 'e'.repeat(40);
  const { root, ui, item, clock } = await fixture(t, { durationContext: null, candidate: {
    head: async () => candidateHead, tree: async () => tree,
    inspect: async () => ({ head: candidateHead, tree, branch: '', selection: { mode: 'full', files: [], reason: 'batch' }, tierPlan: [], budgetBase: undefined }),
  }, batchRepository: {
    git: async args => args[0] === 'rev-parse' ? args.at(-1) === 'refs/heads/dev' ? 'a'.repeat(40) : 'b'.repeat(40) : args[0] === 'merge-tree' ? tree + '\0' : candidateHead,
    facts: async () => ({ context: null, workers: 1 }), identity: async () => tree,
    checkout: async candidate => checkoutClandFixture(candidate.cwd), remove: async () => {},
  } });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'batch-requester', role: 'coordinator' });
  const topic = (await value<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Batch report', item: item.id })).topic.id;
  assert.equal((await coord.call<{ queued: number }>('merge', { item: item.id })).queued, 1);
  await clock.advance(601_000);
  const run = await started.promise;
  const merging = await value<{ batch: MergeBatchStatus }>(ui, { type: 'merge.queue' });
  const verifying = await value<VerificationQueue>(ui, { type: 'suite.queue' });
  assert.deepEqual(merging.batch.members.map(member => member.item), [item.id]);
  assert.equal(verifying.batch?.id, merging.batch.id);
  assert.equal(verifying.holder?.occasion, 'batch');
  receipt = { state: 'done', code: 1, finished: clock.now().toISOString() };
  await clock.advance(1000);
  await until(async () => { await clock.advance(1000); const status = await value<{ suites: Array<{ error: string | null }> }>(ui, { type: 'hub.status' }); if (status.suites[0]?.error) throw new Error(status.suites[0].error); return (await value<{ batch: MergeBatchStatus | null }>(ui, { type: 'merge.queue' })).batch === null; }, { what: 'red singleton refused', timeoutMs: 1500 });
  const history = await value<{ messages: Array<{ text: string; to: string[] }> }>(ui, { type: 'topic.history', topic, limit: 100 });
  assert.ok(history.messages.some(message => message.text.startsWith(`suite result ${run.id}`) && message.to.includes('coord')));
  assert.ok(history.messages.some(message => message.text.includes(`tree ${tree}`) && message.text.includes(item.id) && /tiers T1, T3; wall \d+ ms; exit 1/.test(message.text)));
  assert.ok(history.messages.some(message => /merge-queue-dropped.*merge-bisected.*hub\/test\/parser.test.ts::rejects stale input/s.test(message.text) && message.to.includes('coord')));
});

test('refusing a cancelled live batch member preserves its re-enqueued request', async t => {
  // T2: public merge frames through projectHub; only the executor and Git edges are fake.
  const started = Promise.withResolvers<RunRef>();
  let receipt: RunStatus = { state: 'running' };
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string): Promise<Lease> => ({ kind: 'local', run: run.id, created: '2026-10-16T12:00:00Z', deadline, resource: null }));
  t.mock.method(LocalExecutor.prototype, 'prepare', async () => {});
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => {
    await writeFile(run.log, '# tests 1\n# pass 1\n'); started.resolve(run);
  });
  t.mock.method(LocalExecutor.prototype, 'status', async () => receipt);
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  const head = 'f'.repeat(40), tree = 'e'.repeat(40);
  const { ui, item, clock } = await fixture(t, { durationContext: null, candidate: {
    head: async () => head, tree: async () => tree,
    inspect: async () => ({ head, tree, branch: '', selection: { mode: 'full', files: [], reason: 'batch' }, tierPlan: [], budgetBase: undefined }),
  }, batchRepository: {
    git: async args => args[0] === 'rev-parse' ? args.at(-1) === 'refs/heads/dev' ? 'a'.repeat(40) : 'b'.repeat(40) : args[0] === 'merge-tree' ? tree + '\0' : head,
    facts: async () => ({ context: null, workers: 1 }), identity: async () => tree,
    checkout: async candidate => checkoutClandFixture(candidate.cwd), remove: async () => {},
  } });
  await value(ui, { type: 'merge', item: item.id });
  await clock.advance(601_000);
  const run = await started.promise;
  const original = await value<{ entries: unknown[]; batch: MergeBatchStatus }>(ui, { type: 'merge.queue' });
  assert.equal((await value<{ cancelled: boolean }>(ui, { type: 'merge', item: item.id, cancel: true })).cancelled, true);
  assert.equal((await value<{ queued: number }>(ui, { type: 'merge', item: item.id })).queued, 1);
  const replacement = await value<{ entries: unknown[]; batch: MergeBatchStatus }>(ui, { type: 'merge.queue' });
  assert.notDeepEqual(replacement.entries, original.entries, 'the new request has a fresh enqueue time at the same head');
  assert.equal(replacement.batch.id, original.batch.id, 'the live worker keeps its pinned batch');
  assert.equal((await value<{ suites: unknown[] }>(ui, { type: 'hub.status' })).suites.length, 1);
  receipt = { state: 'done', code: 0, finished: clock.now().toISOString() };
  await until(async () => {
    await clock.advance(1000);
    const suites = (await value<{ suites: Array<{ id: string; reported: boolean }> }>(ui, { type: 'hub.status' })).suites;
    return suites.some(job => job.id === run.id && job.reported);
  }, { what: 'live batch worker completion receipt', timeoutMs: 1500 });
  await until(async () => {
    await clock.advance(1000);
    return (await value<{ batch: MergeBatchStatus | null }>(ui, { type: 'merge.queue' })).batch === null;
  }, { what: 'cancelled batch resolves', timeoutMs: 1500 });
  assert.deepEqual((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries, replacement.entries);
  assert.equal((await value<{ item: ItemView }>(ui, { type: 'task.view', item: item.id })).item.state, 'open');
});

test('a code movement rebuild notice survives the original green result notice', async t => {
  const started = Promise.withResolvers<RunRef>();
  let receipt: RunStatus = { state: 'running' };
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string): Promise<Lease> => ({ kind: 'local', run: run.id, created: '2026-10-16T12:00:00Z', deadline, resource: null }));
  t.mock.method(LocalExecutor.prototype, 'prepare', async () => {});
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => {
    await writeFile(run.log, '# tests 1\n# pass 1\n'); started.resolve(run);
  });
  t.mock.method(LocalExecutor.prototype, 'status', async () => receipt);
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  let moved = false;
  let checkedHead = '', checkedTree = '';
  const { ui, item, clock } = await fixture(t, { durationContext: null, candidate: {
    head: async () => checkedHead, tree: async () => checkedTree,
    inspect: async () => ({ head: checkedHead, tree: checkedTree, branch: '', selection: { mode: 'full', files: [], reason: 'batch' }, tierPlan: [], budgetBase: undefined }),
  }, batchRepository: {
    git: async args => {
      if (args[0] === 'rev-parse') return args.at(-1) === 'refs/heads/dev' ? moved ? 'new-dev' : 'a'.repeat(40) : 'b'.repeat(40);
      if (args[0] === 'merge-tree') return (moved ? 'new-tree' : 'old-tree') + '\0';
      if (args[0] === 'commit-tree') return moved ? 'new-head' : 'old-head';
      if (args[0] === 'diff') return 'hub/src/parser.ts\0';
      if (args[0] === '--literal-pathspecs') return 'forcing-code-commit';
      throw new Error(`unexpected Git operation ${args}`);
    },
    facts: async () => ({ context: null, workers: 1 }), identity: async () => moved ? 'new-tree' : 'old-tree',
    checkout: async candidate => { await checkoutClandFixture(candidate.cwd); checkedHead = candidate.head; checkedTree = candidate.tree; }, remove: async () => {},
  } });
  await value(ui, { type: 'merge', item: item.id });
  await clock.advance(601_000);
  await started.promise;
  moved = true;
  receipt = { state: 'done', code: 0, finished: clock.now().toISOString() };
  await until(async () => {
    await clock.advance(1000);
    return (await value<{ suites: unknown[] }>(ui, { type: 'hub.status' })).suites.length === 2;
  }, { what: 'changed code candidate admitted for a new batch' });
  const history = await value<{ messages: Array<{ id: string; text: string }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
  const green = history.messages.find(message => /batch .*tiers T1, T3;.*exit 0/.test(message.text));
  const rebuild = history.messages.find(message => /rebuild: commit forcing-code-commit changed batch test inputs: hub\/src\/parser.ts/.test(message.text));
  assert.ok(green, 'original green result is retained');
  assert.ok(rebuild, 'forcing commit is visible in the queue notice');
  assert.notEqual(green.id, rebuild.id, 'the suite notice cannot deduplicate the rebuild notice');
});

test('the production batch Git adapter preserves whitespace in unknown paths', async t => {
  let path = '';
  t.mock.method(cp, 'execFile', (bin: string, args: string[], _options: cp.ExecFileOptions, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    assert.equal(bin, 'git');
    if (args[0] === 'diff') callback(null, path + '\0', '');
    else {
      assert.deepEqual(args, ['--literal-pathspecs', 'log', '-1', '--format=%H', 'current', '^tested', '--', path]);
      callback(null, 'forcing-commit\n', '');
    }
    return { stdin: null };
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const candidate = (base: string) => ({ base, head: `${base}-head`, tree: `${base}-tree`, cwd: '/isolated', budgetLines: [] });
  for (const unknown of [' docs/input.ts', ' README.md', '\tdocs/input.ts', '\nREADME.md', 'README.md ']) {
    path = unknown;
    assert.equal(await batchRebuildReason('/isolated', candidate('tested'), candidate('current')), `commit forcing-commit changed batch test inputs: ${unknown}`);
  }
  path = 'docs/input.md';
  assert.equal(await batchRebuildReason('/isolated', candidate('tested'), candidate('current')), null);
});
