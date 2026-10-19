// T1: batch policy at the durable controller/Suites seam, FakeClock and in-process executor receipts.
import { join } from 'node:path';
import { Tracker } from '../src/tracker/tracker.ts';
import { TaskMerges } from '../src/hub/merge.ts';
import { MergeQueue } from '../src/hub/merge-queue.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MergeBatches, BatchRefusal, type BatchBoundary } from '../src/hub/merge-batches.ts';
import type { MergeQueueEntry } from '../src/protocol.ts';
import { loadGateRepetitions } from '../src/suite-load-gate-plan.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { authorizeVerifyOccasion } from '../src/verification-occasion.ts';
import { suiteUnit } from './suite-unit-fixture.ts';

async function fixture(t: Parameters<typeof suiteUnit>[0]) {
  const f = await suiteUnit(t, { executor: 'droplet' });
  const finish = f.finish;
  f.finish = async (...args) => { await f.machine.waits.run(f.machine.started(args[0])); return finish(...args); };
  const entries: MergeQueueEntry[] = [1, 2, 3].map(n => ({ item: `T-${n}`, branch: `t/${n}`, head: `${n}`.repeat(40), verdictBase: 'dev', enqueued: f.clock.now().toISOString(), by: { id: 'coord', name: 'coord', role: 'coordinator' } }));
  const landed: string[] = [], reports: string[] = [], dropped: string[] = [];
  let base = 'base', code = 'code';
  const boundary: BatchBoundary = {
    entries: () => entries,
    cleanup: async () => {},
    checkout: async () => {},
    isLanded: entry => landed.includes(entry.item),
    build: async (_id, members) => {
      const head = `${base}-${members.map(e => e.item).join('-')}`;
      f.candidate.head = head; f.candidate.tree = `${code}-complete`; f.candidate.branch = 'batch';
      return { base, head, tree: f.candidate.tree, cwd: f.root, budgetLines: ['T3 wall 900 s not yet enforced: base 2640 s'] };
    },
    land: async entry => { landed.push(entry.item); entries.splice(entries.findIndex(current => current.item === entry.item), 1); base += entry.item; },
    drop: (entry, reason) => { const index = entries.findIndex(current => current.item === entry.item); if (index >= 0) entries.splice(index, 1); dropped.push(`${entry.item}: ${reason}`); },
    report: (_batch, text) => { reports.push(text); },
  };
  let runner = new MergeBatches(f.store, f.suites, f.clock, boundary, () => ({ queue: true, batch: 3, batchWaitMs: 600_000 }));
  t.after(() => runner.close());
  return { f, entries, landed, reports, dropped, boundary, get runner() { return runner; }, move(trackerOnly: boolean) { base += '-moved'; if (!trackerOnly) code += '-changed'; }, async reopen() { await runner.close(); await f.reopen(); runner = new MergeBatches(f.store, f.suites, f.clock, boundary, () => ({ queue: true, batch: 3, batchWaitMs: 600_000 })); } };
}

test('three queued heads run once on a single candidate before landing FIFO', async t => {
  const { f, runner, landed, reports, boundary, entries } = await fixture(t);
  // Exercise the real receipt and finishMerge path with Git represented by
  // immutable object/ref facts. Worktree removal returns an OS-edge receipt.
  const heads = new Map(entries.map(entry => [entry.branch, entry.head])); heads.set('dev', 'a'.repeat(40));
  const git = async (args: string[]) => {
    if (args[0] === 'for-each-ref') return [...heads].map(([branch, head]) => `${head} refs/heads/${branch}`).join('\n');
    if (args[0] === 'rev-parse') return heads.get(args.at(-1)!.replace(/^refs\/heads\//, '').replace(/\^\{commit\}$/, '')) ?? null;
    if (args[0] === 'merge-base') return 'a'.repeat(40);
    if (args[0] === 'diff') return args.includes('--name-only') ? 'hub/src/parser.ts\0' : 'patch';
    if (args[0] === 'patch-id') return 'stable';
    return null;
  };
  const tracker = new Tracker({ root: f.root, db: join(f.root, 'tracker.db'), git, readBase: async () => 'dev', clock: f.clock, scheduleTips: () => ({ poke() {}, stop() {} }) });
  t.after(() => tracker.stop());
  await tracker.refreshFreshness(work => work());
  for (const entry of entries) {
    const item = await tracker.create(entry.by, { title: entry.item, branch: entry.branch, size: 'M' });
    assert.equal(item.id, entry.item);
    await tracker.comment({ id: 'reviewer', name: 'reviewer', role: 'reviewer' }, item.id, '', { verdict: 'review', scope: 'full', result: 'clear', run: 'batch-review' });
  }
  const queue = new MergeQueue(f.store, tracker, f.clock, () => true, git);
  t.after(() => queue.stop());
  for (const entry of entries) f.store.enqueueMerge(entry);
  const worktrees = { serial: async <T>(work: () => Promise<T>) => work(), prune: async () => ({ removed: [], failed: [] }), pruneMerged: async () => ({ removed: [], failed: [] }) };
  const merges = new TaskMerges(tracker, worktrees, () => {}, undefined, {}, async (_root, operation) => operation(), queue,
    async (_root, branch, message, _resumed, prepared) => {
      const tip = heads.get(branch)!, base = heads.get('dev')!;
      const text = await message(tip, 'dev', base, ['hub/src/parser.ts']);
      assert.match(text, /Reviewed-by: reviewer \(batch-review\)/);
      const commit = String(landed.length + 4).repeat(40);
      prepared!({ commit, base: 'dev', tip }); heads.set('dev', commit);
      return { commit, base: 'dev' };
    });
  t.after(() => merges.stop());
  const land = boundary.land;
  boundary.land = async (entry, candidate) => {
    const result = await merges.merge(entry.item, entry.by, work => work(), undefined, () => {}, { head: entry.head, base: heads.get('dev')! });
    assert.ok('commit' in result && !result.followUp);
    await land(entry, candidate);
  };
  await runner.tick();
  assert.equal(f.suites.status().length, 1, 'one batch suite submitted');
  const run = f.suites.status()[0]!;
  assert.equal(run.occasion, 'batch');
  assert.deepEqual(run.selection?.tiers, ['T1', 'T3']);
  assert.deepEqual(landed, [], 'no entry lands before green');
  assert.equal(runner.snapshot()?.members.length, 3);
  await f.finish(run.id); await runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(f.suites.status().length, 1);
  assert.deepEqual(landed.map(id => tracker.mergeReceipt(id)?.commit), ['4'.repeat(40), '5'.repeat(40), '6'.repeat(40)]);
  assert.ok(landed.every(id => tracker.summary(id)?.state === 'closed'));
  assert.match(reports.join('\n'), /T-1, T-2, T-3.*tree code-complete.*T1, T3.*wall/s);
  assert.equal(runner.snapshot(), null);
  queue.stop(); merges.stop(); await tracker.stop();
});

for (const trackerOnly of [true, false]) test(`${trackerOnly ? 'tracker-only' : 'code'} dev movement ${trackerOnly ? 'keeps' : 'rebuilds'} the green candidate`, async t => {
  const { f, runner, landed, move } = await fixture(t);
  await runner.tick();
  const first = f.suites.status()[0]!;
  move(trackerOnly);
  await f.finish(first.id); await runner.tick();
  if (!trackerOnly) {
    assert.deepEqual(landed, [], 'code movement cannot land under old evidence');
    await runner.tick();
    const second = f.suites.status().at(-1)!;
    assert.notEqual(first.id, second.id);
    await f.finish(second.id); await runner.tick();
  }
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(f.suites.status().length, trackerOnly ? 1 : 2);
});

test('a conflict drops only its member before the single batch run', async t => {
  const { f, runner, boundary, landed, dropped } = await fixture(t);
  const build = boundary.build;
  boundary.build = async (id, members) => {
    const conflicting = members.find(e => e.item === 'T-2');
    if (conflicting) throw new BatchRefusal(conflicting, 'merge-conflict');
    return build(id, members);
  };
  await runner.tick();
  assert.deepEqual(dropped, ['T-2: merge-conflict']);
  assert.deepEqual(runner.snapshot()?.members.map(e => e.item), ['T-1', 'T-3']);
  const run = f.suites.status()[0]!;
  await f.finish(run.id); await runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-3']);
  assert.equal(f.suites.status().length, 1);
});

test('reopening during a batch run resumes it without duplicate landings', async t => {
  const fixtureState = await fixture(t);
  const { f, landed } = fixtureState;
  await fixtureState.runner.tick();
  const run = f.suites.status()[0]!;
  await fixtureState.reopen();
  await fixtureState.runner.tick();
  assert.equal(f.suites.status().length, 1, 'persisted batch run is reused');
  await f.finish(run.id); await fixtureState.runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  await fixtureState.reopen(); await fixtureState.runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
});

test('landing refusal drops its member and rebuilds the remainder for new evidence', async t => {
  const { f, runner, boundary, landed, dropped } = await fixture(t);
  const land = boundary.land;
  boundary.land = async (entry, candidate) => {
    if (entry.item === 'T-2') throw new BatchRefusal(entry, 'merge-hold');
    return land(entry, candidate);
  };
  await runner.tick(); await f.finish(f.suites.status()[0]!.id); await runner.tick();
  assert.deepEqual(landed, ['T-1']);
  assert.deepEqual(dropped, ['T-2: merge-hold']);
  await runner.tick();
  const next = f.suites.status().at(-1)!;
  await f.finish(next.id); await runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-3']);
  assert.equal(f.suites.status().length, 2);
});


test('a partial batch starts at the oldest entry wait deadline', async t => {
  const { f, runner, entries } = await fixture(t);
  entries.splice(1);
  await runner.tick(); assert.equal(f.suites.status().length, 0);
  await f.clock.advance(599_999); await runner.tick(); assert.equal(f.suites.status().length, 0);
  await f.clock.advance(1); await runner.tick(); assert.equal(f.suites.status().length, 1);
  await f.finish(f.suites.status()[0]!.id); await runner.tick();
});

test('a cancelled member waits for its running worker before rebuilding the remainder', async t => {
  const { f, runner, entries, landed } = await fixture(t);
  await runner.tick(); const first = f.suites.status()[0]!;
  entries.splice(1, 1);
  await runner.tick();
  assert.equal(f.suites.status().length, 1); assert.deepEqual(landed, []);
  await f.finish(first.id); await runner.tick();
  const second = f.suites.status().at(-1)!;
  assert.notEqual(second.id, first.id);
  await f.finish(second.id); await runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-3']);
});


test('merge batch configuration preserves defaults and explicit wait policy', () => {
  assert.deepEqual(parseConfig('', 'batch').merge, { queue: false, batch: 3, batchWaitMs: 600_000 });
  const config = parseConfig('[merge]\nqueue=true\nbatch=2\nbatch_wait="30s"', 'batch');
  assert.deepEqual(parseConfig(renderConfig(config), 'batch').merge, { queue: true, batch: 2, batchWaitMs: 30_000 });
  for (const batch of ['0', '-1', '1.5', '"3"']) assert.throws(() => parseConfig(`[merge]\nbatch=${batch}`, 'batch', {}, { strict: true }), /positive integer/);
  for (const role of [null, 'coordinator', 'qa', 'implementer']) assert.throws(() => authorizeVerifyOccasion(role, 'batch'), /hub-owned/);
});


test('batch load gate repeats only new T3 identities', () => {
  const selection = { mode: 'full' as const, files: [], reason: 'batch', loadGateFiles: ['hub/test/integration.test.ts'], loadGateBaseline: { run: 'previous', tests: ['hub/test/integration.test.ts::known'] } };
  assert.equal(loadGateRepetitions('hub/test/unit.test.ts::new', selection, {}), 0);
  assert.equal(loadGateRepetitions('hub/test/integration.test.ts::known', selection, {}), 0);
  assert.equal(loadGateRepetitions('hub/test/integration.test.ts::new', selection, {}), 5);
});
