// T1: batch policy at the durable controller/Suites seam, FakeClock and in-process executor receipts.
import { join } from 'node:path';
import { Tracker } from '../src/tracker/tracker.ts';
import { TaskMerges } from '../src/hub/merge.ts';
import { MergeQueue } from '../src/hub/merge-queue.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MergeBatches, BatchRefusal, diagnosticResult, type BatchBoundary } from '../src/hub/merge-batches.ts';
import type { MergeQueueEntry } from '../src/protocol.ts';
import type { TopicNotice } from '../src/hub/core.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { prepareMergeBatch } from '../src/hub/merge-batch-territory.ts';
import { recordBatchFlakes } from '../src/hub/batch-flakes.ts';
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
    checkout: async candidate => { f.candidate.head = candidate.head; f.candidate.tree = candidate.tree; },
    isLanded: entry => landed.includes(entry.item),
    build: async (_id, members) => {
      const head = `${base}-${members.map(e => e.item).join('-')}`;
      f.candidate.head = head; f.candidate.tree = `${code}-complete`; f.candidate.branch = 'batch';
      return { base, head, tree: f.candidate.tree, cwd: f.root, budgetLines: ['T3 wall 900 s not yet enforced: base 2640 s'] };
    },
    land: async entry => { landed.push(entry.item); entries.splice(entries.findIndex(current => current.item === entry.item), 1); base += entry.item; },
    drop: (entry, reason) => { const index = entries.findIndex(current => current.item === entry.item); if (index >= 0) entries.splice(index, 1); dropped.push(`${entry.item}: ${reason}`); },
    report: (_batch, text) => { reports.push(text); },
    notice: () => {},
  };
  let runner = new MergeBatches(f.store, f.suites, f.clock, boundary, () => ({ queue: true, batch: 3, batchWaitMs: 600_000 }));
  t.after(() => runner.close());
  return { f, entries, landed, reports, dropped, boundary, get runner() { return runner; }, move(trackerOnly: boolean) { base += '-moved'; if (!trackerOnly) code += '-changed'; }, async reopen() { await runner.close(); await f.reopen(); runner = new MergeBatches(f.store, f.suites, f.clock, boundary, () => ({ queue: true, batch: 3, batchWaitMs: 600_000 })); } };
}

const failureLog = 'suite test failures [{"file":"hub/test/example.test.ts","name":"rejects stale input"}]\n# tests 1\n# fail 1\n';
const passLog = 'suite progress {"event":"finish","id":"one","file":"hub/test/example.test.ts","name":"rejects stale input","at":1,"nesting":0,"outcome":"pass","seconds":0.01}\nsuite test failures []\n# tests 1\n# pass 1\n';

test('a red single-member batch refuses the member with its failing identity', async t => {
  const { f, runner, entries, dropped, landed } = await fixture(t);
  entries.splice(1);
  await f.clock.advance(600_000);
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog);
  await runner.tick();
  assert.match(dropped[0]!, /T-1: merge-bisected.*hub\/test\/example.test.ts::rejects stale input/);
  assert.deepEqual(landed, []);
  assert.equal(runner.snapshot(), null);
  assert.equal(f.suites.status().length, 1, 'singleton needs no diagnostic rerun');
});

test('a red triple lands the unique green leave-one-out tree', async t => {
  const { f, runner, boundary, dropped, landed, reports } = await fixture(t);
  const build = boundary.build;
  boundary.build = async (id, members) => {
    const candidate = await build(id, members);
    candidate.tree = members.some(e => e.item === 'T-2') ? 'with-culprit' : 'without-culprit';
    f.candidate.tree = candidate.tree;
    return candidate;
  };
  const land = boundary.land;
  boundary.land = async (entry, candidate) => {
    assert.equal(candidate.tree, 'without-culprit');
    return land(entry, candidate);
  };
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog);
  await runner.tick();
  for (let index = 0; index < 3; index++) {
    const diagnostic = f.suites.status().at(-1)!;
    assert.deepEqual(diagnostic.selection?.shard, { files: ['hub/test/example.test.ts'], nvim: false });
    assert.equal(diagnostic.selection?.loadGate, false);
    assert.equal(diagnostic.cached, undefined);
    await f.finish(diagnostic.id, diagnostic.tree === 'without-culprit' ? 0 : 1, diagnostic.tree === 'without-culprit' ? undefined : failureLog);
    await runner.tick();
  }
  assert.match(dropped[0]!, /T-2: merge-bisected.*rejects stale input/);
  assert.deepEqual(landed, ['T-1', 'T-3']);
  assert.equal(f.suites.status().length, 4, 'one batch plus at most three file jobs');
  assert.match(reports.at(-1)!, /file job.*tree without-culprit.*seconds.*cost/s);
});

test('a red repeat without a unique culprit refuses everyone with one Coordinator notice', async t => {
  const { f, runner, boundary, dropped, landed } = await fixture(t);
  const notices: unknown[] = [];
  Object.assign(boundary, { notice: (notice: unknown) => notices.push(notice) });
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog); await runner.tick();
  for (let index = 0; index < 4; index++) {
    await f.finish(f.suites.status().at(-1)!.id, 1, failureLog); await runner.tick();
  }
  assert.equal(dropped.length, 3);
  assert.ok(dropped.every(text => text.includes('merge-bisect-unresolved') && text.includes('rejects stale input')));
  assert.deepEqual(landed, []);
  assert.equal(notices.length, 1);
  await runner.tick(); assert.equal(notices.length, 1);
  assert.equal(runner.snapshot(), null);
});

test('independent flaky batches retain both receipts in a Coordinator quarantine question', async t => {
  const state = await fixture(t);
  const { f, boundary, entries, landed, dropped } = state;
  const notices: TopicNotice[] = [];
  boundary.notice = notice => { notices.push(notice); };
  for (let batch = 0; batch < 2; batch++) {
    if (batch) {
      entries.push(...[4, 5, 6].map(n => ({ item: `T-${n}`, branch: `t/${n}`, head: `${n}`.repeat(40), verdictBase: 'dev', enqueued: f.clock.now().toISOString(), by: { id: 'coord', name: 'coord', role: 'coordinator' } })));
      await state.reopen();
    }
    await state.runner.tick();
    await f.finish(f.suites.status().at(-1)!.id, 1, failureLog); await state.runner.tick();
    for (let index = 0; index < 4; index++) {
      await f.finish(f.suites.status().at(-1)!.id, 0, passLog); await state.runner.tick();
    }
    assert.equal(notices.length, batch);
    assert.equal(state.runner.snapshot(), null);
  }
  assert.deepEqual(dropped, []);
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6']);
  const proposal = notices[0]!;
  assert.equal(proposal.kind, 'question');
  assert.deepEqual(proposal.to, ['coordinator']);
  assert.equal(proposal.detail?.event, 'quarantine-proposal');
  const observations = proposal.detail?.observations as Array<{ batch: string; run: string; log: { artifact: string; path: string }; rerun: { run: string; log: { artifact: string } } }>;
  assert.equal(observations.length, 2);
  assert.notEqual(observations[0]!.batch, observations[1]!.batch);
  for (const observation of observations) {
    assert.match(observation.log.artifact, /^A-/);
    assert.match(observation.rerun.log.artifact, /^A-/);
    assert.notEqual(observation.run, observation.rerun.run);
  }
  assert.match(proposal.text, /five isolated green.*owner item.*reason.*expiry/s);
});

test('diagnostic result retains every file job tree with seconds and provider cost', async t => {
  const { f, runner, reports } = await fixture(t);
  const release = DropletExecutor.prototype.release;
  t.mock.method(DropletExecutor.prototype, 'release', async function(this: DropletExecutor, ...args: Parameters<typeof release>) {
    await release.apply(this, args);
    return { lifetimeMs: 12_500, costUsd: 0.03125 };
  });
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog); await runner.tick();
  for (let index = 0; index < 4; index++) {
    await f.finish(f.suites.status().at(-1)!.id, 1, failureLog); await runner.tick();
  }
  const final = reports.at(-1)!;
  const fileJobs = f.reports.filter(job => job.batch?.diagnostic);
  assert.equal(fileJobs.length, 4);
  for (const job of fileJobs) {
    assert.ok(final.includes(`file job ${job.id}: hub/test/example.test.ts; tree ${job.tree}; seconds ${job.runMs! / 1000}; cost $0.0313; log ${job.artifact}:`));
  }
});

test('reopening during diagnosis resumes the collected file sequence without duplicate jobs', async t => {
  const state = await fixture(t);
  const { f, landed, dropped } = state;
  await state.runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog); await state.runner.tick();
  const diagnostic = f.suites.status().at(-1)!;
  await f.machine.waits.run(f.machine.started(diagnostic.id));
  await state.reopen(); await state.runner.tick();
  assert.equal(f.suites.status().length, 2);
  await f.finish(diagnostic.id, 1, failureLog); await state.runner.tick();
  for (let index = 0; index < 3; index++) {
    await f.finish(f.suites.status().at(-1)!.id, 1, failureLog); await state.runner.tick();
  }
  assert.equal(f.suites.status().length, 5);
  assert.equal(dropped.length, 3);
  assert.deepEqual(landed, []);
  assert.equal(state.runner.snapshot(), null);
});

test('an exit-zero skipped rerun refuses the unresolved batch', async t => {
  const { f, runner, landed, dropped } = await fixture(t);
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog); await runner.tick();
  for (let index = 0; index < 4; index++) {
    await f.finish(f.suites.status().at(-1)!.id, 0, passLog.replace('"outcome":"pass"', '"outcome":"skip"'));
    await runner.tick();
  }
  assert.deepEqual(landed, []);
  assert.equal(dropped.length, 3);
  assert.ok(dropped.every(text => text.includes('merge-bisect-unresolved')));
  assert.equal(f.store.meta('batch-flakes'), null);
});

test('batch repeat proof rejects nonpassing or incomplete failure identities', async t => {
  // T1: receipt validation permutations at the evidence boundary, one provider fixture.
  const { f } = await fixture(t);
  const failedRun = await f.launch(); await f.finish(failedRun.id, 1, failureLog);
  const repeatRun = await f.launch(); await f.finish(repeatRun.id, 0, passLog);
  const failed = await f.suites.receipt(failedRun.id), repeat = await f.suites.receipt(repeatRun.id);
  const failure = 'hub/test/example.test.ts::rejects stale input';
  const variants = [
    ['skip', passLog.replace('"outcome":"pass"', '"outcome":"skip"')],
    ['TODO', passLog.replace('"outcome":"pass"', '"outcome":"todo"')],
    ['cancelled', passLog.replace('"outcome":"pass"', '"outcome":"cancelled"')],
    ['missing receipts', '# tests 1\n# pass 1\n'],
    ['unfinished', passLog.replace('"event":"finish"', '"event":"start"')],
    ['malformed', passLog + 'suite progress {\n'],
    ['partial identities', passLog.replace('rejects stale input', 'unrelated passing test')],
  ];
  for (const [name, log] of variants) {
    assert.equal(recordBatchFlakes(f.store, `invalid-${name}`, [failure], failed, { ...repeat, log: log! }, () => assert.fail('invalid proof cannot propose quarantine')), false, name);
    assert.equal(f.store.meta('batch-flakes'), null, name);
  }
  assert.equal(recordBatchFlakes(f.store, 'partial', [failure, 'hub/test/example.test.ts::missing second failure'], failed, repeat, () => assert.fail()), false);
  assert.equal(f.store.meta('batch-flakes'), null, 'every failing identity must pass before any observation is stored');
});

test('a cancelled alternative after a green omission holds diagnosis without blaming a member', async t => {
  const { f, runner, landed, dropped, boundary } = await fixture(t);
  const notices: TopicNotice[] = [];
  boundary.notice = notice => { notices.push(notice); };
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog); await runner.tick();
  await f.finish(f.suites.status().at(-1)!.id, 0, passLog); await runner.tick();
  const aborted = f.suites.status().at(-1)!;
  await f.machine.waits.run(f.machine.started(aborted.id));
  await f.suites.cancel(aborted.id, null, () => {});
  await f.machine.waits.run(f.result(aborted.id));
  await runner.tick();
  assert.deepEqual(landed, []);
  assert.deepEqual(dropped, []);
  assert.match(runner.snapshot()?.failed ?? '', /diagnostic.*inconclusive.*cancelled/);
  assert.equal(f.suites.status().length, 3, 'no further alternative is admitted under inconclusive evidence');
  assert.equal(notices.length, 1);
  await runner.tick(); assert.equal(notices.length, 1);
});

test('diagnostic results preserve abandoned and unknown evidence as inconclusive', () => {
  const complete = { state: 'finished' as const, outcome: { code: 1, cause: '' } };
  for (const receipt of [
    { ...complete, cancelled: true },
    { ...complete, requesterDied: true },
    { ...complete, timedOut: true },
    { ...complete, outcome: null },
    { ...complete, state: 'running' as const },
    { ...complete, outcome: { code: 1, cause: 'remote machine lost' } },
    { ...complete, outcome: { code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' } },
    { ...complete, outcome: { code: 1, cause: 'unknown result' } },
  ]) assert.equal(diagnosticResult(receipt, failureLog).result, 'inconclusive');
  assert.equal(diagnosticResult(complete, '').result, 'inconclusive', 'an exit code without test failures supplies no red proof');
  assert.equal(diagnosticResult(complete, failureLog).result, 'red');
  assert.equal(diagnosticResult({ ...complete, outcome: { code: 0, cause: '' } }, passLog).result, 'green');
});

test('a cancelled repeat holds the batch without an unresolved refusal', async t => {
  const { f, runner, landed, dropped } = await fixture(t);
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog); await runner.tick();
  for (let index = 0; index < 3; index++) {
    await f.finish(f.suites.status().at(-1)!.id, 1, failureLog); await runner.tick();
  }
  const repeat = f.suites.status().at(-1)!;
  assert.equal(repeat.batch?.diagnostic?.key, 'repeat');
  await f.machine.waits.run(f.machine.started(repeat.id));
  await f.suites.cancel(repeat.id, null, () => {});
  await f.machine.waits.run(f.result(repeat.id));
  await runner.tick();
  assert.deepEqual(landed, []);
  assert.deepEqual(dropped, []);
  assert.match(runner.snapshot()?.failed ?? '', /diagnostic.*inconclusive.*cancelled/);
  assert.equal(runner.snapshot()?.diagnosis?.unresolved, undefined);
});

test('a cancelled original singleton stays queued without a culprit refusal', async t => {
  const { f, runner, entries, dropped, landed, boundary } = await fixture(t);
  const notices: TopicNotice[] = [];
  boundary.notice = notice => { notices.push(notice); };
  entries.splice(1); await f.clock.advance(600_000);
  await runner.tick();
  const original = f.suites.status()[0]!;
  await f.machine.waits.run(f.machine.started(original.id));
  await f.suites.cancel(original.id, null, () => {});
  await f.machine.waits.run(f.result(original.id));
  await runner.tick();
  assert.deepEqual(dropped, []); assert.deepEqual(landed, []);
  assert.equal(entries.length, 1);
  assert.match(runner.snapshot()?.failed ?? '', /original.*inconclusive.*cancelled/);
  assert.equal(f.suites.status().length, 1);
  assert.equal(notices.length, 1);
});

test('an aborted original with partial failures holds before diagnostic admission across reopen', async t => {
  const state = await fixture(t);
  const { f, entries, dropped, landed, boundary } = state;
  const notices: TopicNotice[] = [];
  boundary.notice = notice => { notices.push(notice); };
  f.machine.script({ outcome: 'slow', log: failureLog });
  await state.runner.tick();
  const original = f.suites.status()[0]!;
  await f.machine.waits.run(f.machine.started(original.id));
  await f.suites.cancel(original.id, null, () => {});
  const receipt = await f.machine.waits.run(f.result(original.id));
  assert.ok((await f.suites.receipt(receipt.id)).log.includes('rejects stale input'));
  await state.runner.tick();
  assert.deepEqual(dropped, []); assert.deepEqual(landed, []);
  assert.equal(entries.length, 3);
  assert.equal(f.suites.status().length, 1, 'partial failures in an aborted original cannot start leave-one-out work');
  assert.equal(state.runner.snapshot()?.diagnosis, undefined);
  assert.match(state.runner.snapshot()?.failed ?? '', /original.*inconclusive.*cancelled/);
  assert.equal(notices.length, 1);
  assert.match(notices[0]!.text, /log A-\d+:/);
  await state.reopen(); await state.runner.tick();
  assert.equal(notices.length, 1); assert.equal(f.suites.status().length, 1);
});

test('leave-one-out preparation uses the original integration base when dev has moved', async () => {
  const merges: string[][] = [];
  const member: MergeQueueEntry = { item: 'T-1', branch: 't/1', head: '1'.repeat(40), verdictBase: 'dev', enqueued: '2026-10-16T12:00:00Z', by: { id: 'coord', name: 'coord', role: 'coordinator' } };
  const candidate = await prepareMergeBatch('/isolated', 'diagnostic', [member], {}, {
    git: async args => {
      if (args[0] === 'rev-parse') return args.at(-1) === 'refs/heads/dev' ? 'new-dev' : member.head;
      if (args[0] === 'merge-tree') { merges.push(args); return 'tree\0'; }
      if (args[0] === 'commit-tree') return 'candidate';
      throw new Error(`unexpected Git operation ${args[0]}`);
    },
    facts: async () => ({ context: null, workers: 1 }), identity: async () => 'tree', checkout: async () => {}, remove: async () => {},
  }, 'original-dev');
  assert.equal(candidate.base, 'original-dev');
  assert.deepEqual(merges, [['merge-tree', '--write-tree', '--name-only', '-z', 'original-dev', member.head]]);
});

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
