// T1: batch policy at the durable controller/Suites seam, FakeClock and in-process executor receipts.
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ownedTracker } from './owned-tracker.ts';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { Tracker } from '../src/tracker/tracker.ts';
import { TaskMerges, joinMergeCleanup } from '../src/hub/merge.ts';
import { MergeError } from '../src/merge.ts';
import { TerritoryGitError } from '../src/territory.ts';
import { MergeQueue } from '../src/hub/merge-queue.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { MergeBatches, BatchRefusal, BatchRebuild, diagnosticResult, batchInteractionSummary, batchNoticeId, type BatchBoundary, type BatchCandidate } from '../src/hub/merge-batches.ts';
import type { MergeQueueEntry } from '../src/protocol.ts';
import type { TopicNotice } from '../src/hub/core.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { prepareBatchDependencies, prepareMergeBatch, batchRebuildReason, type BatchRepository } from '../src/hub/merge-batch-territory.ts';
import { recordBatchFlakes } from '../src/hub/batch-flakes.ts';
import { loadGateRepetitions } from '../src/suite-load-gate-plan.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { authorizeVerifyOccasion } from '../src/verification-occasion.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { flakyReceiptCase as suiteCase, ownedSuiteUnit, filedWebIdentity, finishFiledWebRepeats } from './flaky-receipt-fixture.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { selectionFromEnv, selectionTransport } from '../src/suite-selection.ts';
import { packageShards, serializeTierManifest } from '../src/suite-shards.ts';
import { fixtureWork, type FixtureStep } from '../../test-support/fixture-work.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { tierReceipt } from '../src/verification-tier-receipts.ts';
import { verificationSteps } from '../src/verification-plan.ts';
import { requireMergeClosedItemWording } from '../src/merge-closed-item-wording.ts';
import { removeWorktreeWithFixtures, type FixtureProcesses } from '../src/fixture-processes.ts';
import { CandidateOwnershipUnavailable, captureCandidateOwnership, requireCandidateOwnership, removeOwnedBatchCandidate, type CandidateOwnershipHost } from '../src/batch-candidate-ownership.ts';
import { fixtureOwnership } from '../../shared/fixture-ownership.ts';
import { tempProject } from './harness.ts';
import { dependencyInstall } from '../src/dependency-install.ts';
import { fullBatchReason } from '../src/batch-selection.ts';

/** Enroll before acquisition; even late fixture hooks must join the whole body. */
function joinedCase(t: TestContext, body: (fixtures: TestContext, step: FixtureStep) => Promise<void>) {
  const owner = fixtureWork();
  t.after(() => owner.close());
  const fixtures = new Proxy(t, { get(target, key) {
    if (key === 'after') return (close: () => unknown) => t.after(async () => { await owner.close(); await close(); });
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  return owner.run(step => body(fixtures, step));
}

function boundedJoinedCase(t: TestContext, body: (fixtures: TestContext, step: FixtureStep) => Promise<void>) {
  const scope = caseDeadlines(t);
  return scope.wait('fixture setup and receipt assertions', () => joinedCase(scope.fixtures, body));
}

function guardedMemberCase(t: TestContext, body: (fixtures: TestContext, step: FixtureStep, setup: <T>(name: string, run: () => Promise<T>) => Promise<T>) => Promise<void>) {
  const owner = fixtureWork();
  let ownerClosing: Promise<void> | undefined, ownerJoined = false;
  const closeOwner = () => {
    if (!ownerClosing) {
      ownerClosing = owner.close(); // Fences admission synchronously, then joins.
      void ownerClosing.then(() => { ownerJoined = true; }, () => {});
    }
    return ownerClosing;
  };
  const scope = caseDeadlines(t, { releaseOnClose: () => { void closeOwner(); } });
  const onAbort = () => { void closeOwner(); };
  t.signal.addEventListener('abort', onAbort, { once: true });
  if (t.signal.aborted) onAbort();
  scope.fixtures.after(() => closeOwner());
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restore: (() => void) | undefined;
  let registered = 0, completed = 0, settled = false;
  const captured = new Proxy(scope.fixtures, { get(target, key) {
    if (key === 'after') return (close: () => unknown) => {
      registered++;
      scope.fixtures.after(async () => { await closeOwner(); await close(); completed++; });
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  // The abort/release bridge fences the actual callback before scope joins its
  // pending waits; captured resources drain only after that owner has joined.
  t.after(() => {
    assert.ok(ownerJoined && settled && completed === registered, 'callback or cleanup incomplete; retain native guard');
    t.signal.removeEventListener('abort', onAbort);
    try { guard?.verify(); } finally { t.mock.restoreAll(); restore?.(); }
  });
  const work = owner.run(async step => {
    guard = await step(() => scope.wait('native guard setup', () => fakeNativeGuard(fn => { restore = fn; })));
    await body(captured, step, scope.wait);
  });
  void work.then(() => { settled = true; }, () => { settled = true; });
  return scope.wait('member callback', () => work);
}

test('batch and periodic failing-file selections round-trip to exactly the requested package files', async t => {
  // T1: real Suites admission, transport decoder and package planner; no worker needed.
  const f = await suiteUnit(t);
  const hub = 'hub/test/example.test.ts', nvim = 'nvim/test/example.test.ts';
  const tests = { [hub]: 'T1', 'hub/test/unrelated.test.ts': 'T1', [nvim]: 'T2', 'nvim/test/unrelated.test.ts': 'T2' } as const;
  for (const file of Object.keys(tests)) {
    await mkdir(join(f.root, file, '..'), { recursive: true });
    await writeFile(join(f.root, file), '');
  }
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests }));
  for (const kind of ['batch', 'periodic']) for (const files of [[hub], [nvim], [hub, nvim]]) {
    const result = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true,
      ...(kind === 'batch' ? { batch: { id: 'batch', members: [], diagnostic: { key: 'omit-0', files } } } : { devT3Probe: { key: 'periodic', files } }) }, () => {});
    assert.ok('dryRun' in result);
    const transport = selectionTransport(result.selection, join(f.root, 'selection.json'));
    assert.equal(transport.file, undefined);
    const selection = selectionFromEnv(transport.env)!;
    assert.deepEqual(selection, result.selection);
    assert.deepEqual(selection.shard, { files: files.includes(hub) ? [hub] : [], nvim: files.includes(nvim) });
    const phases = await packageShards(f.root, selection.mode, selection.shard, selection, { workers: 1 });
    assert.deepEqual(phases.flatMap(phase => phase.targets).sort(), files.toSorted());
  }
});

async function fixture(t: Parameters<typeof suiteUnit>[0], options: Parameters<typeof suiteUnit>[1] = {}, outer?: TestContext) {
  const f = await (outer ? ownedSuiteUnit(outer, t, { executor: 'droplet', ...options }) : suiteUnit(t, { executor: 'droplet', ...options }));
  const finish = f.finish;
  f.finish = async (...args) => { await f.machine.waits.run(f.machine.started(args[0])); return finish(...args); };
  const entries: MergeQueueEntry[] = [1, 2, 3].map(n => ({ item: `T-${n}`, branch: `t/${n}`, head: `${n}`.repeat(40), verdictBase: 'dev', enqueued: f.clock.now().toISOString(), by: { id: 'coord', name: 'coord', role: 'coordinator' } }));
  const landed: string[] = [], reports: string[] = [], dropped: string[] = [];
  let base = 'base', code = 'code';
  const boundary: BatchBoundary = {
    entries: () => entries,
    rebuildReason: async (_tested, current) => `commit ${current.base} changed batch test inputs`,
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
  return { root: f.root, f, entries, landed, reports, dropped, boundary, get runner() { return runner; }, move(trackerOnly: boolean) { base += '-moved'; if (!trackerOnly) code += '-changed'; }, async reopen() { await runner.close(); await f.reopen(); runner = new MergeBatches(f.store, f.suites, f.clock, boundary, () => ({ queue: true, batch: 3, batchWaitMs: 600_000 })); } };
}

const failureLog = 'suite test failures [{"file":"hub/test/example.test.ts","name":"rejects stale input"}]\n# tests 1\n# fail 1\n';
const passLog = 'suite progress {"event":"finish","id":"one","file":"hub/test/example.test.ts","name":"rejects stale input","at":1,"nesting":0,"outcome":"pass","seconds":0.01}\nsuite test failures []\n# tests 1\n# pass 1\n';

test('light batch plans only affected T3 importers across both packages', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const { f, unit, affected, other, nvim } = await step(() => setup('complete light setup', async () => {
    const f = await suiteUnit(fixtures);
    const unit = 'hub/test/unit.test.ts', affected = 'hub/test/affected.test.ts', other = 'hub/test/other.test.ts', nvim = 'nvim/test/affected.test.ts';
    const sources = { [unit]: '', [affected]: 'import "../../web/src/model.ts";', [other]: '', [nvim]: 'import "../../web/src/model.ts";', 'web/src/model.ts': 'export const value = 1;' };
    for (const [file, source] of Object.entries(sources)) { await mkdir(join(f.root, file, '..'), { recursive: true }); await writeFile(join(f.root, file), source); }
    await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [unit]: 'T1', [affected]: 'T3', [other]: 'T3', [nvim]: 'T3' } }));
    f.candidate.selection = { mode: 'full', files: ['web/src/model.ts'], reason: 'candidate delta' };
    return { f, unit, affected, other, nvim };
  }));
  await step(() => setup('light behavior', async () => {
    const result = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true, occasion: 'batch', batch: { id: 'light', members: [] } }, () => {});
    assert.ok('dryRun' in result);
    const selection = selectionFromEnv(selectionTransport(result.selection, join(f.root, 'selection.json')).env)!;
    const phases = await packageShards(f.root, selection.mode, undefined, selection, { workers: 1 });
    assert.deepEqual(phases.flatMap(phase => phase.targets).sort(), [unit, affected, nvim].sort());
    const { batchTests: _newMask, ...legacy } = selection;
    const oldPlan = await packageShards(f.root, legacy.mode, undefined, legacy, { workers: 1 });
    assert.deepEqual(oldPlan.flatMap(phase => phase.targets).sort(), [unit, affected, other, nvim].sort(), 'previous wire shape retains full T3');
    for (const trigger of ['waiting', 'production'] as const) {
      if (trigger === 'production') f.candidate.selection.files = ['hub/src/deleted.ts'];
      const full = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true, occasion: 'batch', batch: { id: trigger, waiting: trigger === 'waiting' ? 3 : 1, members: [] } }, () => {});
      assert.ok('dryRun' in full);
      const planned = await packageShards(f.root, full.selection.mode, undefined, full.selection, { workers: 1 });
      assert.deepEqual(planned.flatMap(phase => phase.targets).sort(), [unit, affected, other, nvim].sort());
    }
    f.candidate.selection.files = ['web/src/model.ts'];
    await writeFile(join(f.root, other), 'eval("loadUnknown()");');
    const unknown = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true, occasion: 'batch', batch: { id: 'unknown', members: [] } }, () => {});
    assert.ok('dryRun' in unknown);
    assert.ok(unknown.selection.batchTests?.T3?.includes(other), 'unknown graph retains its file');
    f.git(async () => 'hub/src/cancelled-member-change.ts\0');
    const cancelledDelta = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true, occasion: 'batch', batch: { id: 'cancelled-delta', members: [{ item: 'T-1', branch: 't/1', head: '1'.repeat(40), verdictBase: 'dev', enqueued: f.clock.now().toISOString(), by: { id: 'coord', name: 'coord', role: 'coordinator' } }] } }, () => {});
    assert.ok('dryRun' in cancelledDelta);
    assert.equal(cancelledDelta.selection.batchTests?.T3, undefined, 'a member production delta forces full T3 even when absent from aggregate paths');
  }));
}));

test('full T3 triggers include waiting members, deleted production paths and verifier configuration', () => {
  assert.equal(fullBatchReason(['web/src/model.ts'], 2), null);
  assert.match(fullBatchReason(['docs/change.md'], 3)!, /three waiting/);
  for (const path of ['hub/src/deleted.ts', 'hub/bin/cland.ts', 'shared/wire/index.ts', 'hub/test/run-suite.ts', '.cland/config.toml']) assert.ok(fullBatchReason([path], 1), path);
  assert.equal(fullBatchReason(['hub/src/hub/worktrees.test.ts'], 1), null);
});

for (const red of [false, true]) test(`partial T3 baseline preserves unrelated proof and ${red ? 'fences red' : 'uses green'} file receipts`, t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const { f, a, b } = await step(() => setup('complete baseline setup', async () => {
    const f = await suiteUnit(fixtures);
    const a = 'hub/test/a.test.ts', b = 'hub/test/b.test.ts';
    for (const file of [a, b]) await writeFile(join(f.root, file), '');
    await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [a]: 'T3', [b]: 'T3' } }));
    const seed = await f.launch(); await f.finish(seed.id);
    const original = (await f.suites.receipt(seed.id)).job;
    const row = (files: string[]) => ({ tier: 'T3' as const, files, tests: files.length, seconds: 0.01, projectedWall: 0.01, workers: 1, missing: 0 });
    const older = { ...original, id: 'older-full', sequence: 1, occasion: 'stage' as const, branch: 'dev', integrated: true, selection: { mode: 'full' as const, files: [], reason: 'stage' }, tierPlan: [row([a, b])], timingIdentities: [`${a}::known`, `${b}::known`] };
    const newer = { ...older, id: 'newer-partial', sequence: 2, occasion: 'batch' as const, batch: { id: 'prior', members: [] }, selection: { ...older.selection, batchTests: { T3: [a] } }, tierPlan: [row([a, b])], timingIdentities: [`${a}::known`, `${b}::phantom`], outcome: { ...original.outcome!, code: red ? 1 : 0 } };
    const { batch: _batch, ...stageRecord } = newer;
    const partialStage = { ...stageRecord, id: 'partial-stage', sequence: 3, occasion: 'stage' as const };
    await f.reopen([older, newer, partialStage]);
    return { f, a, b };
  }));
  await step(() => setup('baseline behavior', async () => {
    const result = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true, occasion: 'batch', batch: { id: 'next', members: [] } }, () => {});
    assert.ok('dryRun' in result);
    assert.equal(loadGateRepetitions(`${b}::known`, result.selection, {}), 0);
    assert.equal(loadGateRepetitions(`${a}::known`, result.selection, {}), red ? 5 : 0);
    assert.equal(loadGateRepetitions(`${b}::phantom`, result.selection, {}), 5, 'partial files never lend whole-plan identities');
    f.candidate.branch = 'dev';
    f.candidate.selection = { mode: 'full', files: [], reason: 'stage', fetchedDev: f.candidate.head };
    const stage = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true, integrated: true, occasion: 'stage' }, () => {});
    assert.ok('dryRun' in stage);
    assert.equal(stage.selection.loadGateBaseline?.run, 'older-full', 'only the whole stage receipt supplies the full-stage baseline');
  }));
}));

for (const history of ['same-tier', 'other-tier', 'other-tier-legacy', 'skipped'] as const) test(`partial baseline history bounds ${history} visits independently of tier receipts`, t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const { f, a, b } = await step(() => setup('complete history setup', async () => {
    const f = await suiteUnit(fixtures);
    const a = 'hub/test/a.test.ts', b = 'hub/test/b.test.ts';
    for (const file of [a, b]) await writeFile(join(f.root, file), '');
    await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [a]: 'T3', [b]: 'T3' } }));
    const seed = await f.launch(); await f.finish(seed.id);
    const original = (await f.suites.receipt(seed.id)).job;
    const prior = { ...original, occasion: 'batch' as const, batch: { id: 'prior', members: [] }, selection: { mode: 'full' as const, files: [], reason: 'prior' }, tierPlan: [{ tier: 'T3' as const, files: [a], tests: 1, seconds: 0.01, projectedWall: 0.01, workers: 1, missing: 0 }], timingIdentities: [`${a}::known`] };
    const oldest = { ...prior, id: 'oldest', sequence: 0, tierPlan: [{ ...prior.tierPlan[0]!, files: [a, b] }], timingIdentities: [`${a}::known`, `${b}::known`] };
    const { occasion: _occasion, batch: _batch, ...ordinary } = prior;
    await f.reopen([oldest, ...Array.from({ length: history === 'skipped' ? 400 : 40 }, (_, index) => ({ ...(history === 'skipped' ? ordinary : prior), id: `prior-${index}`, sequence: index + 1,
      ...(history.startsWith('other-tier') ? { selection: { ...prior.selection, ...(history === 'other-tier' ? { tiers: ['T1' as const] } : {}) }, tierPlan: [{ ...prior.tierPlan[0]!, tier: 'T1' as const }] } : {}),
      ...(history === 'skipped' ? { integrated: false } : {}),
    }))]);
    return { f, a, b };
  }));
  await step(() => setup('history behavior', async () => {
    const nativeRead = f.store.suiteJob.bind(f.store);
    let reads = 0;
    t.mock.method(f.store, 'suiteJob', (...args: Parameters<typeof nativeRead>) => { reads++; return nativeRead(...args); });
    const result = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true, occasion: 'batch', batch: { id: 'next', members: [] } }, () => {});
    assert.ok('dryRun' in result);
    assert.ok(reads <= (history === 'other-tier-legacy' ? 44 : 34), `receipt reads ${reads} exceed the bounded history scan plus selected receipt`);
    assert.equal(loadGateRepetitions(`${a}::known`, result.selection, {}), history === 'skipped' ? 5 : 0);
    assert.equal(loadGateRepetitions(`${b}::known`, result.selection, {}), history.startsWith('other-tier') ? 0 : 5);
    const scan = f.logs.findLast(event => event.event === 'batch-baseline-scan' && event.tier === 'T3');
    assert.ok(scan, 'the producer records actual summary and same-tier receipt visits');
    assert.ok(Number(scan.summaries) <= 256 && Number(scan.receipts) <= 32);
    if (history.startsWith('other-tier')) assert.equal(scan.receipts, 1);
    if (history === 'skipped') { assert.equal(scan.summaries, 256); assert.equal(scan.receipts, 0); }
  }));
}));

test('a filed batch failure lands only after five hub reruns retain same-tree receipts', t => suiteCase(t, async ({ setup, step }) => {
  const { f, runner, landed } = await setup(fixtures => fixture(fixtures, { flakyOwners: () => ({ 'hub/test/example.test.ts::rejects stale input': 'T-4' }) }, t));
  await step("runner.tick()", () => runner.tick());
  const original = f.suites.status()[0]!;
  f.machine.script(...Array.from({ length: 5 }, () => ({ outcome: 'slow' as const, log: '' })));
  const admitted = (await step('read original commands', () => f.jobs())).find(job => job.id === original.id)!;
  await step('record original native failure', () => f.finish(original.id, 1, failureLog, false,
    verificationSteps(admitted.commands!).map(row => tierReceipt(admitted, row, row.name === 'check' ? 0 : 1))));
  for (let round = 0; round < 5; round++) {
    await step("f.tick(5000)", () => f.tick(5000)); await step("f.suites.settled()", () => f.suites.settled());
    const child = f.suites.status().find(job => job.batch?.diagnostic?.key === `flaky-${original.id}-${round}`);
    assert.ok(child, JSON.stringify((await step("f.jobs()", () => f.jobs())).map(job => ({ id: job.id, reported: job.reported, flaky: job.flaky, error: job.error, outcome: job.outcome, batch: job.batch?.diagnostic }))));
    assert.equal(child.tree, original.tree);
    const admittedChild = (await step('read rerun commands', () => f.jobs())).find(job => job.id === child.id)!;
    await step('record matching native pass', () => f.finish(child.id, 0, passLog, true, verificationSteps(admittedChild.commands!).map(row => tierReceipt(admittedChild, row, 0))));
    assert.ok((await step("f.suites.receipt(child.id)", () => f.suites.receipt(child.id))).log.includes('suite progress'), (await step("f.suites.receipt(child.id)", () => f.suites.receipt(child.id))).log);
    assert.deepEqual(landed, []);
  }
  await step("f.tick(5000)", () => f.tick(5000)); await step("f.suites.settled()", () => f.suites.settled()); await step("runner.tick()", () => runner.tick());
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(f.status(original.id).outcome?.code, 1);
  assert.equal(f.status(original.id).cover?.receipt?.runs.length, 5);
}));
const t0Green = 'tier T0: exit 0; duration 1 s; output tail: static checks passed\n';
const t0Red = 'tier T0: exit 2; duration 1 s; output tail: error TS2344\n';

// Member verifies and the batch consume explicit producer receipts, never log text.
async function memberVerifies(state: Awaited<ReturnType<typeof fixture>>, step: FixtureStep, options: { older?: boolean; omitFirst?: boolean; metadata?: boolean; crossSource?: boolean; tiers?: string[]; interactionRun?: boolean } = {}) {
  const { f, entries } = state;
  f.configure('[verification]\nexecutor="droplet"\ncheck="true"\ntest_unit="true"\ntest_component="true"\ntest_integration="true"\n[merge]\nqueue=true\nbatch_tiers=' + JSON.stringify(options.tiers ?? ['T1', 'T3']) + (options.interactionRun ? '\nbatch_interaction="run"' : ''));
  await step(() => writeFile(join(f.root, '.cland/config.toml'), '[verification]\ncheck="true"\ntest_unit="true"\ntest_component="true"\ntest_integration="true"\ntest="true"\n'));
  const runs: string[] = [];
  for (const [index, entry] of entries.entries()) {
    if (options.omitFirst && index === 0) continue;
    const cross = options.crossSource && index === 2;
    f.candidate.branch = cross ? 't/99' : entry.branch;
    f.candidate.head = cross ? 'e'.repeat(40) : options.older && index === 0 ? '0'.repeat(40) : entry.head;
    f.candidate.tree = 'member-tree-' + index;
    const run = await step(() => f.launch({ item: cross ? 'T-99' : entry.item, fresh: true }));
    runs.push(run.id);
    const metadata = options.metadata === false ? undefined : (['check', 'T1', 'T2'] as const).map(name => tierReceipt({ id: run.id, tree: f.candidate.tree }, { name, command: 'true' }, 0));
    await step(() => f.finish(run.id, 0, t0Green
      + 'tier T1: exit 0; duration 1 s; output tail: passed\n'
      + 'tier T2: exit 0; duration 1 s; output tail: passed\n' + passLog, true, metadata));
  }
  return runs;
}

test('light batches retain exact-head member T1 coverage and report its source', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const { state, processFile } = await step(() => setup('complete light member setup', async () => {
    const state = await fixture(fixtures);
    state.entries.splice(1);
    const processFile = 'hub/test/affected.test.ts';
    await mkdir(join(state.f.root, 'nvim/src'), { recursive: true });
    await writeFile(join(state.f.root, 'nvim/src/model.ts'), 'export const value = 1;');
    await writeFile(join(state.f.root, processFile), 'import "../../nvim/src/model.ts";');
    await writeFile(join(state.f.root, 'hub/test/unit.test.ts'), '');
    await writeFile(join(state.f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [processFile]: 'T3', 'hub/test/unit.test.ts': 'T1' } }));
    state.f.candidate.selection = { mode: 'full', files: ['nvim/src/model.ts'], reason: 'light member' };
    await memberVerifies(state, step);
    await state.reopen();
    await state.f.clock.advance(600_000);
    return { state, processFile };
  }));
  await step(() => setup('light member behavior', async () => {
    await state.runner.tick();
    const run = state.runner.snapshot()!.run!;
    await state.f.finish(run, 0, t0Green + 'tier T3: exit 0; duration 1 s; output tail: passed\n' + passLog);
    const job = (await state.f.suites.receipt(run)).job;
    assert.equal(job.batchT1?.skipped, true);
    assert.deepEqual(job.selection?.tiers, ['T3']);
    assert.deepEqual(job.selection?.batchTests?.T3, [processFile]);
    await state.runner.tick();
    assert.ok(state.reports.some(text => text.includes('T1 coverage: exact-head member verifies')));
  }));
}));

test('batch skips T1 with complete exact-head member verifies and names every receipt', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const state = await step(() => setup('fixture setup', () => fixture(fixtures)));
  const runs = await step(() => setup('member receipt setup', () => memberVerifies(state, step)));
  await step(() => state.reopen());
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  assert.deepEqual(state.f.status(batch.run!).selection?.tiers, ['T3']);
  await step(() => state.f.finish(batch.run!, 0, t0Green + 'tier T3: exit 0; duration 1 s; output tail: passed\n' + passLog));
  assert.deepEqual((await step(() => state.f.suites.receipt(batch.run!))).job.commands?.plan?.map(item => item.name), ['check', 'T3']);
  await step(() => state.runner.tick());
  const summary = state.reports.find(text => text.includes('T1 skipped'));
  assert.ok(summary, 'batch summary records the skip');
  for (const [index, run] of runs.entries()) {
    assert.ok(summary.includes(run), run);
    assert.ok(summary.includes(String(index + 1).repeat(40)));
  }
}));

test('batch restores T1 when a green member verify predates its pinned head and explains why', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const state = await step(() => setup('fixture setup', () => fixture(fixtures)));
  await step(() => setup('member receipt setup', () => memberVerifies(state, step, { older: true })));
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  assert.deepEqual(state.f.status(batch.run!).selection?.tiers, ['T1', 'T3']);
  await step(() => state.f.finish(batch.run!, 0, t0Green
    + 'tier T1: exit 0; duration 1 s; output tail: passed\n'
    + 'tier T3: exit 0; duration 1 s; output tail: passed\n' + passLog));
  await step(() => state.runner.tick());
  assert.ok(state.reports.some(text => text.includes('T1 retained') && text.includes('T-1') && /head|receipt/.test(text)));
}));

test('missing member verification restores T1 for the whole batch', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const state = await step(() => setup('fixture setup', () => fixture(fixtures)));
  await step(() => setup('member receipt setup', () => memberVerifies(state, step, { omitFirst: true })));
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  assert.deepEqual(state.f.status(batch.run!).selection?.tiers, ['T1', 'T3']);
  await step(() => state.f.finish(batch.run!, 0, t0Green + passLog));
  assert.match((await step(() => state.f.suites.receipt(batch.run!))).job.batchT1?.reason ?? '', /T-1: missing/);
}));

for (const sourceAvailable of [true, false]) test('cache hits with ' + (sourceAvailable ? 'available' : 'missing') + ' cross-member source receipts ' + (sourceAvailable ? 'skip' : 'retain') + ' batch T1', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const state = await step(() => setup('fixture setup', () => fixture(fixtures)));
  const runs = await step(() => setup('member receipt setup', () => memberVerifies(state, step, { crossSource: true })));
  const entry = state.entries[2]!;
  state.f.candidate.head = entry.head; state.f.candidate.branch = entry.branch;
  const cached = await step(() => state.f.launch({ item: entry.item }));
  await step(() => state.f.machine.waits.run(state.f.result(cached.id)));
  assert.equal(state.f.status(cached.id).cached?.run, runs[2]);
  if (!sourceAvailable) {
    const source = await step(() => state.f.suites.receipt(runs[2]!));
    const resolve = state.f.store.resolveArtifact.bind(state.f.store);
    fixtures.mock.method(state.f.store, 'resolveArtifact', (id: string) => id === source.job.artifact ? null : resolve(id));
  }
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  assert.deepEqual(state.f.status(batch.run!).selection?.tiers, sourceAvailable ? ['T3'] : ['T1', 'T3']);
  await step(() => state.f.finish(batch.run!, 0, t0Green + passLog));
  const receipt = await step(() => state.f.suites.receipt(batch.run!));
  if (sourceAvailable) assert.deepEqual(receipt.job.batchT1?.members[2], { item: entry.item, head: entry.head, run: cached.id, sourceRun: runs[2] });
  else assert.match(receipt.job.batchT1?.reason ?? '', /T-3: member verify receipt unavailable/);
}));

for (const tiers of [['T1'], ['T3']]) for (const metadata of [true, false]) test('batch preserves configured ' + tiers.join(',') + ' with ' + (metadata ? 'present' : 'missing') + ' producer receipts', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const state = await step(() => setup('fixture setup', () => fixture(fixtures)));
  await step(() => setup('member receipt setup', () => memberVerifies(state, step, { tiers, metadata })));
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  assert.deepEqual(state.f.status(batch.run!).selection?.tiers, tiers);
  await step(() => state.f.finish(batch.run!, 0, t0Green + passLog));
  const receipt = await step(() => state.f.suites.receipt(batch.run!));
  assert.deepEqual(receipt.job.commands?.plan?.map(item => item.name), ['check', ...tiers]);
}));

test('legacy member verifies with only printed tier lines retain batch T1', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const state = await step(() => setup('fixture setup', () => fixture(fixtures)));
  await step(() => setup('member receipt setup', () => memberVerifies(state, step, { metadata: false })));
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  assert.deepEqual(state.f.status(batch.run!).selection?.tiers, ['T1', 'T3']);
  await step(() => state.f.finish(batch.run!, 0, t0Green + passLog));
  assert.match((await step(() => state.f.suites.receipt(batch.run!))).job.batchT1?.reason ?? '', /producer tier receipts|passing step/);
}));

test('sole configured T1 remains when interaction fallback adds a T2 phase', t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const state = await step(() => setup('fixture setup', () => fixture(fixtures)));
  await step(() => setup('member receipt setup', () => memberVerifies(state, step, { tiers: ['T1'], interactionRun: true })));
  state.f.git(async () => { throw new Error('sibling delta unavailable'); });
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  assert.deepEqual(state.f.status(batch.run!).selection?.tiers, ['T1', 'T2']);
  await step(() => state.f.finish(batch.run!, 0, t0Green + passLog));
  assert.deepEqual((await step(() => state.f.suites.receipt(batch.run!))).job.commands?.plan?.map(item => item.name), ['check', 'T1', 'T2']);
}));

for (const mode of ['teardown', 'abort']) test(`member owner fences a held continuation on ${mode} before joining`, t => guardedMemberCase(t, async (fixtures, step, setup) => {
  const entered = Promise.withResolvers<void>(), held = Promise.withResolvers<void>();
  const cancellation = new AbortController();
  const hooks: Array<() => unknown> = [];
  let work: Promise<void> | undefined, closing: Promise<unknown> | undefined;
  let admitted = false;
  // Adopt a late inner guard/callback before either is acquired. This hook also
  // releases the controlled setup on an assertion failure before draining it.
  fixtures.after(async () => {
    held.resolve();
    await work?.catch(() => {});
    closing ??= Promise.resolve(hooks[0]?.());
    await closing;
    for (const hook of hooks.slice(1)) await hook();
  });
  const context = new Proxy(fixtures, { get(target, key) {
    if (key === 'after') return (hook: () => unknown) => { hooks.push(hook); };
    if (key === 'signal') return cancellation.signal;
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  work = guardedMemberCase(context, async (_fixtures, innerStep, innerSetup) => {
    await innerStep(() => innerSetup('held setup', async () => { entered.resolve(); await held.promise; }));
    await innerStep(async () => { admitted = true; });
  });
  const observed = work.then(() => ({ state: 'resolved' as const }), error => ({ state: 'rejected' as const, error }));
  await step(() => setup('inner setup entered', () => entered.promise));
  if (mode === 'teardown') closing = Promise.resolve(hooks[0]!());
  else cancellation.abort();
  held.resolve();
  const receipt = await step(() => setup('inner callback completion receipt', () => observed));
  assert.equal(receipt.state, 'rejected', 'the original callback observes the admission fence');
  if (receipt.state === 'rejected') assert.match(String(receipt.error), /fixture work admission closed/);
  assert.equal(admitted, false, 'no continuation was admitted after the fence');
}));

test('a bound passing retry supersedes an aborted host attempt and keeps its history', t => boundedJoinedCase(t, async (fixtures, step) => {
  const state = await step(() => fixture(fixtures));
  const { f, landed, reports } = state;
  await step(() => state.runner.tick());
  const run = f.suites.status()[0]!;
  await step(() => state.reopen());
  const binding = `verification step binding ${JSON.stringify({ run: run.id, tree: f.candidate.tree, command: 'npm run typecheck' })}\n`;
  await step(() => f.finish(run.id, 0, binding + 'tier T0: exit 143; duration 35.33 s; output tail: host check\n' + binding + t0Green + passLog));
  await step(() => state.runner.tick());
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3'], reports.join('\n') + await step(() => f.log(run.id)));
  assert.match(reports.join('\n'), /T0: exit 143; duration 35.33 s.*superseded/);
  assert.match(await step(() => f.log(run.id)), /tier T0: exit 143; duration 35.33 s/);
}));

test('stopping during a host gate resumes the same batch run and lands after its green retry', t => boundedJoinedCase(t, async (fixtures, step) => {
  const state = await step(() => fixture(fixtures));
  const { f, landed, reports } = state;
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let attempts = 0;
  f.ownIO(() => release.resolve());
  f.hostGate(async run => {
    if (++attempts === 1) { entered.resolve(); await release.promise; }
    return { tree: run.tree ?? null, command: 'true', code: attempts === 1 ? 143 : 0 };
  });
  const admission = state.runner.tick();
  await step(() => f.machine.waits.run(entered.promise));
  const run = f.suites.status()[0]!;
  const stopping = f.suites.close();
  release.resolve();
  await step(() => stopping);
  await step(() => admission);
  await step(() => state.reopen());
  await step(() => f.tick());
  await step(() => state.runner.tick());
  await step(() => f.finish(run.id, 0, passLog));
  await step(() => state.runner.tick());
  assert.equal(attempts, 2);
  assert.equal(f.suites.status().length, 1);
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3'], reports.join('\n'));
  assert.match(reports.join('\n'), /T0: exit 143; duration .*superseded aborted attempt/);
  assert.match(await step(() => f.log(run.id)), /Host gate retry superseded aborted attempt:.*exit 143/);
}));

test('aborted receipts stay inconclusive without a later pass bound to their run tree and command', () => {
  const job = { id: 'run', tree: 'tree', state: 'finished' as const, outcome: { code: 0, cause: 'complete' } };
  const bound = (run: string, tree: string, command: string, receipt: string) => `verification step binding ${JSON.stringify({ run, tree, command })}\n${receipt}`;
  const aborted = bound('run', 'tree', 'check', 'tier T0: exit 143; duration 35 s; output tail: stop\n');
  for (const later of ['', t0Green, bound('other', 'tree', 'check', t0Green), bound('run', 'other', 'check', t0Green), bound('run', 'tree', 'other', t0Green)]) {
    assert.equal(diagnosticResult(job, aborted + later, ['check']).result, 'inconclusive');
  }
  assert.equal(diagnosticResult(job, bound('run', 'tree', 'check', t0Green) + aborted, ['check']).result, 'inconclusive');
  assert.equal(diagnosticResult(job, aborted.replace('T0:', 'T1:') + t0Green, ['check']).result, 'inconclusive');
});

test('an omitted member owning the absent failing file is dropped and survivors run before landing', t => joinedCase(t, async (fixtures, step) => {
  const { f, runner, boundary, dropped, landed, reports } = await step(() => fixture(fixtures));
  const file = 'hub/test/introduced.test.ts';
  const checkout = boundary.checkout;
  boundary.checkout = async candidate => {
    await checkout(candidate);
    const present = candidate.head.includes('T-1');
    await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: present ? { [file]: 'T1' } : {} }));
    if (present) await writeFile(join(f.root, file), '');
    else await rename(join(f.root, file), join(f.root, 'removed-test.ts')).catch(error => { if (error.code !== 'ENOENT') throw error; });
  };
  await step(() => runner.tick());
  await step(() => f.finish(f.suites.status()[0]!.id, 1, `suite test failures [{"file":"${file}","name":"fails"}]\n`));
  await step(() => runner.tick());
  assert.equal(runner.snapshot()?.failed, undefined);
  assert.match(dropped[0] ?? '', /T-1: merge-bisected.*hub\/test\/introduced.test.ts/);
  assert.deepEqual(landed, []);
  const surviving = f.suites.status().at(-1)!;
  assert.equal(surviving.batch?.diagnostic, undefined);
  assert.deepEqual(surviving.batch?.members.map(entry => entry.item), ['T-2', 'T-3']);
  await step(() => f.finish(surviving.id)); await step(() => runner.tick());
  assert.deepEqual(landed, ['T-2', 'T-3']);
  assert.ok(reports.every(text => !text.includes('blocked')));
}));

test('an unregistered but present failing file holds the batch with members and recovery commands', t => joinedCase(t, async (fixtures, step) => {
  const { f, runner, dropped, reports } = await step(() => fixture(fixtures));
  await step(() => runner.tick());
  await step(() => f.finish(f.suites.status()[0]!.id, 1, failureLog));
  await step(() => writeFile(join(f.root, 'hub/test/example.test.ts'), ''));
  await step(() => writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {} })));
  await step(() => runner.tick());
  assert.match(runner.snapshot()?.failed ?? '', /unclassified tests/);
  assert.deepEqual(dropped, []);
  assert.match(reports.at(-1)!, /T-1.*T-2.*T-3/);
  assert.match(reports.at(-1)!, /cland merge T-1 --cancel/);
  assert.match(reports.at(-1)!, /cland merge T-1(?:\s|$)/);
}));

for (const blocked of [false, true]) test(`same-head re-enqueue ${blocked ? 'restarts a held batch with fresh evidence' : 'joins its running batch without invalidating its run'}`, t => joinedCase(t, async (fixtures, step) => {
  const { f, runner, entries, boundary, landed } = await step(() => fixture(fixtures));
  const tracker = new Tracker({ root: f.root, db: join(f.root, 'tracker.db'), git: async () => null,
    readBase: async () => 'dev', clock: f.clock, scheduleTips: () => ({ poke() {}, stop() {} }) });
  fixtures.after(() => tracker.stop());
  for (const entry of entries) await step(() => tracker.create(entry.by, { title: entry.item, branch: entry.branch, size: 'S' }));
  const queue = new MergeQueue(f.store, tracker, f.clock, () => true, async () => null);
  fixtures.after(() => queue.stop());
  for (const entry of entries) f.store.enqueueMerge(entry);
  boundary.entries = () => queue.entries();
  const land = boundary.land;
  boundary.land = async (entry, candidate) => { await land(entry, candidate); f.store.dropMerge(entry.item); };
  await step(() => runner.tick());
  const run = f.suites.status()[0]!;
  if (blocked) {
    await step(() => f.finish(run.id, 2, 'worker failed before test receipts\n'));
    await step(() => runner.tick());
    assert.match(runner.snapshot()?.failed ?? '', /inconclusive/);
  }
  const original = queue.entries()[0]!;
  queue.cancel(original.item);
  await step(() => f.clock.advance(1));
  const view = await step(() => tracker.viewAsync(original.item, work => work()));
  queue.enqueue(view, original.head, 'dev', original.by);
  assert.deepEqual(queue.entries().find(entry => entry.item === original.item), original, 'same pinned head rejoins its admitted request');
  assert.equal(queue.entries().filter(entry => entry.head === original.head).length, 1);
  if (!blocked) await step(() => f.finish(run.id));
  await step(() => runner.tick());
  if (blocked) {
    await step(() => runner.tick());
    assert.deepEqual(landed, [], 'held recovery requires its own fresh run');
    await step(() => f.finish(f.suites.status().at(-1)!.id)); await step(() => runner.tick());
  }
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(runner.snapshot(), null);
  assert.deepEqual(queue.entries(), []);
  assert.equal(f.suites.status().length, blocked ? 2 : 1);
}));

test('a custom command without package inventory retains unknown skipped files', t => suiteCase(t, async ({ setup, step }) => {
  const state = await setup(fixtures => fixture(fixtures, {}, t));
  const { f, entries, landed, reports } = state;
  entries.splice(2); await step("f.clock.advance(600_000)", () => f.clock.advance(600_000));
  await step("rename(join(f.root, 'hub/test/run-suite.ts'), join(f.root, 'custo", () => rename(join(f.root, 'hub/test/run-suite.ts'), join(f.root, 'custom-test-script.ts')));
  await step("state.runner.tick()", () => state.runner.tick());
  const original = f.suites.status()[0]!;
  await step("f.finish(original.id, 1, failureLog)", () => f.finish(original.id, 1, failureLog)); await step("state.runner.tick()", () => state.runner.tick());
  for (let index = 0; index < 2; index++) {
    await step("f.finish(f.suites.status().at(-1)!.id, index === 1 ? 1 : 0, index", () => f.finish(f.suites.status().at(-1)!.id, index === 1 ? 1 : 0, index === 1 ? failureLog : passLog)); await step("state.runner.tick()", () => state.runner.tick());
  }
  assert.deepEqual(landed, []);
  assert.equal(state.runner.snapshot()?.confirmation?.skipped, null);
  assert.ok(reports.some(text => text.includes('unknown; full selection rerun') && text.includes('confirmation pending')));
  await step("state.runner.tick()", () => state.runner.tick());
  const confirmation = f.suites.status().at(-1)!;
  assert.equal(confirmation.batch?.diagnostic, undefined);
  await step("f.finish(confirmation.id)", () => f.finish(confirmation.id)); await step("state.runner.tick()", () => state.runner.tick());
  assert.ok(reports.some(text => text.includes(`covering run ${confirmation.id}`) && text.includes('unknown; full selection rerun')));
  assert.deepEqual(landed, ['T-2']);
}));

test('completed empty files stay observed and confirmation preserves a later rebuild notice', t => suiteCase(t, async ({ setup, step }) => {
  const state = await setup(fixtures => fixture(fixtures, {}, t));
  const { f, entries, landed, reports, boundary } = state;
  entries.splice(2); await step("f.clock.advance(600_000)", () => f.clock.advance(600_000));
  const empty = 'hub/test/empty.test.ts';
  for (const file of [empty, 'hub/test/example.test.ts']) await step("writeFile(join(f.root, file), '')", () => writeFile(join(f.root, file), ''));
  await step("writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManif", () => writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1,
    tests: { [empty]: 'T1', 'hub/test/example.test.ts': 'T1' } })));
  f.configure('[verification]\nexecutor="droplet"\n[merge]\nqueue=true\nbatch_tiers=["T1"]');
  const delivered = new Map<string, string>();
  const report = boundary.report;
  boundary.report = (batch, text, phase) => {
    const key = batchNoticeId(batch, phase);
    if (!delivered.has(key)) { delivered.set(key, text); report(batch, text, phase); }
  };
  await step("state.runner.tick()", () => state.runner.tick());
  await step("f.finish(f.suites.status()[0]!.id, 1, failureLog + `suite progres", () => f.finish(f.suites.status()[0]!.id, 1, failureLog + `suite progress ${JSON.stringify({
    event: 'finish', id: 'empty', file: empty, name: empty, type: 'file', at: 1, nesting: 0, outcome: 'pass', seconds: 0,
  })}\n`));
  await step("state.runner.tick()", () => state.runner.tick());
  for (let index = 0; index < 2; index++) {
    await step("f.finish(f.suites.status().at(-1)!.id, index === 1 ? 1 : 0, index", () => f.finish(f.suites.status().at(-1)!.id, index === 1 ? 1 : 0, index === 1 ? failureLog : passLog)); await step("state.runner.tick()", () => state.runner.tick());
  }
  assert.deepEqual(state.runner.snapshot()?.confirmation?.skipped, []);
  assert.ok(reports.some(text => /skipped files .*: none;.*confirmation pending/.test(text)));
  await step("state.runner.tick()", () => state.runner.tick());
  const confirmation = f.suites.status().at(-1)!;
  await step("f.finish(confirmation.id)", () => f.finish(confirmation.id));
  state.move(false);
  await step("state.runner.tick()", () => state.runner.tick());
  assert.deepEqual(landed, []);
  assert.ok(reports.some(text => text.includes(`covering run ${confirmation.id}`)));
  assert.ok(reports.some(text => /rebuild: commit .*changed batch test inputs/.test(text)));
}));

for (const laterCode of [0, 1]) test(`interrupted file diagnosis requires the skipped selection: later file exit ${laterCode}`, t => suiteCase(t, async ({ setup, step }) => {
  const state = await setup(fixtures => fixture(fixtures, {}, t));
  const { f, entries, landed, reports, dropped } = state;
  entries.splice(2);
  await step("f.clock.advance(600_000)", () => f.clock.advance(600_000));
  const later = 'nvim/test/later.test.ts';
  await step("mkdir(join(f.root, 'nvim/test'), { recursive: true })", () => mkdir(join(f.root, 'nvim/test'), { recursive: true }));
  await step("writeFile(join(f.root, later), '')", () => writeFile(join(f.root, later), ''));
  await step("writeFile(join(f.root, 'hub/test/example.test.ts'), '')", () => writeFile(join(f.root, 'hub/test/example.test.ts'), ''));
  await step("writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManif", () => writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1,
    tests: { 'hub/test/example.test.ts': 'T1', [later]: 'T1' } })));
  f.configure('[verification]\nexecutor="droplet"\n[merge]\nqueue=true\nbatch_tiers=["T1"]');
  await step("state.runner.tick()", () => state.runner.tick());
  const original = f.suites.status()[0]!;
  await step("f.finish(original.id, 1, failureLog + 'suite interruption {\"at\":\"", () => f.finish(original.id, 1, failureLog + 'suite interruption {"at":"2026-01-01T00:00:00Z"}\n'));
  await step("state.runner.tick()", () => state.runner.tick());
  for (let index = 0; index < 2; index++) {
    const diagnostic = f.suites.status().at(-1)!;
    assert.deepEqual(diagnostic.batch?.diagnostic?.files, ['hub/test/example.test.ts']);
    await step("f.finish(diagnostic.id, index === 1 ? 1 : 0, index === 1 ? failur", () => f.finish(diagnostic.id, index === 1 ? 1 : 0, index === 1 ? failureLog : passLog)); await step("state.runner.tick()", () => state.runner.tick());
  }
  assert.deepEqual(landed, [], 'failing-file greens cannot cover the skipped file');
  await step("state.reopen()", () => state.reopen()); await step("state.runner.tick()", () => state.runner.tick());
  const confirmation = f.suites.status().at(-1)!;
  assert.equal(confirmation.batch?.diagnostic, undefined);
  assert.equal(confirmation.tree, original.tree);
  assert.deepEqual(confirmation.selection?.tiers, ['T1']);
  const selection = selectionFromEnv(selectionTransport(confirmation.selection, join(f.root, 'selection.json')).env)!;
  assert.ok((await step("packageShards(f.root, selection.mode, selection.shard, selection)", () => packageShards(f.root, selection.mode, selection.shard, selection))).flatMap(phase => phase.targets).includes(later));
  await step("f.finish(confirmation.id, laterCode, laterCode ? `suite test fail", () => f.finish(confirmation.id, laterCode, laterCode ? `suite test failures [{"file":"${later}","name":"later failure"}]\n` : passLog));
  await step("state.runner.tick()", () => state.runner.tick());
  assert.ok(reports.some(text => text.includes(later) && text.includes(confirmation.id)), reports.join('\n'));
  if (laterCode) {
    // Drive all red alternatives to their durable unresolved receipt.
    for (let index = 0; index < 2; index++) {
      await step("f.finish(f.suites.status().at(-1)!.id, 1, `suite test failures [{", () => f.finish(f.suites.status().at(-1)!.id, 1, `suite test failures [{"file":"${later}","name":"later failure"}]\n`));
      await step("state.runner.tick()", () => state.runner.tick());
    }
    assert.deepEqual(landed, []);
    assert.ok(dropped.some(text => text.includes(later)));
    assert.equal(dropped.length, 2);
  } else {
    assert.deepEqual(landed, ['T-2']);
    assert.ok(reports.some(text => text.includes(confirmation.id) && text.includes('full plan green')));
  }
}));

for (const missing of ['node_modules', '@modelcontextprotocol/sdk']) test(`missing ${missing} holds dependency preparation inconclusive with members queued`, async t => {
  const state = await fixture(t);
  const { f, boundary, entries, dropped } = state;
  await writeFile(join(f.root, 'package.json'), '{}');
  await writeFile(join(f.root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/@modelcontextprotocol/sdk': { version: '1.0.0' } } }));
  if (missing !== 'node_modules') await mkdir(join(f.root, 'node_modules'), { recursive: true });
  boundary.checkout = () => prepareBatchDependencies(f.root, f.root);
  await state.runner.tick();
  const held = state.runner.snapshot()!;
  assert.match(held.failed!, /dependency preparation inconclusive/);
  assert.ok(held.failed!.includes(missing), held.failed);
  assert.equal(held.run, undefined);
  assert.equal(entries.length, 3);
  assert.deepEqual(dropped, []);
  await state.reopen(); await state.runner.tick();
  assert.equal(state.runner.snapshot()!.failed, held.failed);
  assert.equal(entries.length, 3);
  assert.deepEqual(dropped, []);
});

for (const restart of [false, true]) test(`all-terminal blocked batch clears ${restart ? 'at startup' : 'after manual merge'} and batches the next entry`, async t => {
  const state = await fixture(t);
  const { f, entries, boundary, landed } = state;
  const cleaned: string[] = [];
  boundary.cleanup = async candidate => { cleaned.push(candidate.cwd); };
  await state.runner.tick();
  const batch = state.runner.snapshot()!;
  await f.finish(batch.run!);
  // A pre-upgrade failed follow-up, reconciled through ordinary merge later.
  batch.failed = 'merged, follow-up failed: stop sessions: cannot inspect the OS process table: ps failed or timed out';
  f.store.setMeta('merge-batch', JSON.stringify(batch));
  const members = [...entries];
  for (const entry of members) await boundary.land(entry, batch.candidate!);
  entries.push(...members.map((entry, index) => ({ ...entry, item: `T-${index + 4}` })));
  if (restart) await state.reopen();
  await state.runner.tick();
  assert.deepEqual(cleaned, [f.root]);
  await state.runner.tick();
  assert.deepEqual(state.runner.snapshot()?.members.map(entry => entry.item), ['T-4', 'T-5', 'T-6']);
  assert.notEqual(state.runner.snapshot()?.run, batch.run);
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
});

for (const noticeFailure of [false, true]) test(`post-landing ps failure retains cleanup and prepares the next batch${noticeFailure ? ' despite notice failure' : ''} without blocking`, t => guardedMemberCase(t, async (t, step) => {
  const state = await step(() => fixture(t));
  const { f, boundary, reports, landed, entries } = state;
  let unavailable = true, removed = 0, probes = 0;
  let sinkUnavailable = noticeFailure;
  const report = boundary.report;
  boundary.report = (batch, text, phase) => {
    if (phase?.startsWith('cleanup:') && sinkUnavailable) throw new Error('notice unavailable');
    report(batch, text, phase);
  };
  const readers: FixtureProcesses = {
    rows: async () => { probes++; if (unavailable) throw new Error('cannot inspect the OS process table: ps failed or timed out'); return []; },
    paths: async () => { throw new Error('unexpected paths'); }, sameUser: async () => { throw new Error('unexpected user'); },
    missing: () => false, end: async () => { throw new Error('unexpected signal'); },
  };
  boundary.cleanup = candidate => removeWorktreeWithFixtures(candidate.cwd, async () => { removed++; }, readers);
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  await step(() => f.finish(batch.run!));
  await step(() => state.runner.tick());
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(state.runner.snapshot(), null);
  assert.equal(removed, 0, 'guard retains root until ps succeeds');
  assert.equal(state.runner.cleanups()[0]?.candidate.cwd, f.root);
  assert.match(state.runner.cleanups()[0]!.error, /ps failed or timed out/);
  assert.deepEqual(state.runner.cleanupStatus(), [{ candidate: { cwd: f.root }, error: 'cannot inspect the OS process table: ps failed or timed out', retryAt: state.runner.cleanups()[0]!.retryAt }]);
  if (!noticeFailure) assert.ok(reports.some(text => /cleanup[\s\S]*automatic retry/i.test(text)));
  else {
    assert.match(f.store.meta('merge-batch-publication-error') ?? '', /notice unavailable/);
    assert.match(state.runner.cleanups()[0]!.error, /ps failed or timed out/, 'secondary publication error preserves the original cleanup cause');
  }
  assert.ok(reports.every(text => !/blocked|--cancel|re-enqueue/.test(text)));
  const firstProbes = probes;
  entries.push(...batch.members.map((entry, index) => ({ ...entry, item: `T-${index + 4}` })));
  await step(() => state.runner.tick());
  assert.deepEqual(state.runner.snapshot()?.members.map(entry => entry.item), ['T-4', 'T-5', 'T-6']);
  assert.notEqual(state.runner.snapshot()?.id, batch.id, 'new candidate identity avoids the retained path');
  assert.equal(probes, firstProbes, 'backoff avoids tight cleanup retries');
  await step(() => state.reopen());
  await step(() => f.clock.advance(1000));
  await step(() => state.runner.tick());
  assert.equal(state.runner.cleanups()[0]!.attempts, 2);
  assert.equal(removed, 0);
  unavailable = false;
  await step(() => f.clock.advance(60_000));
  await step(() => state.runner.tick());
  assert.equal(removed, 1);
  assert.deepEqual(state.runner.cleanupStatus(), []);
  sinkUnavailable = false;
  await step(() => state.runner.tick());
  assert.deepEqual(state.runner.cleanups(), []);
  assert.ok(reports.some(text => /cleanup[\s\S]*automatic retry/i.test(text)));
  assert.equal(removed, 1, 'notice recovery cannot repeat positively completed cleanup');
}));

for (const rejectedClose of [false, true]) test(`shared tracker owner preserves constructor failure with ${rejectedClose ? 'rejected then confirmed' : 'confirmed'} closure`, t => guardedMemberCase(t, async (t, step) => {
  let close = async () => {}, refuse = rejectedClose;
  t.after(async () => { refuse = false; await close(); });
  const { f } = await step(() => fixture(t));
  let captured: DatabaseSync | undefined;
  const failure = new Error('injected constructor rejection');
  assert.throws(() => ownedTracker({ requireClose: fn => { close = fn; } }, {
    root: f.root, db: ':memory:', clock: f.clock, openDatabase: path => {
      const db = captured = new DatabaseSync(path), nativeClose = db.close.bind(db), executeSql = db.exec.bind(db);
      db.exec = sql => { if (sql.includes('tracker_items')) throw failure; executeSql(sql); };
      db.close = () => { if (refuse) throw new Error('injected close refusal'); nativeClose(); };
      return db;
    },
  }), error => error === failure);
  assert.ok(captured);
  if (rejectedClose) {
    await step(() => assert.rejects(close(), /injected close refusal/));
    assert.equal(captured.isOpen, true);
  }
  refuse = false;
  await step(close);
  assert.equal(captured.isOpen, false);
}));

for (const unresolved of [false, true]) for (const refusal of ['legacy', 'marked', 'inspection']) for (const settle of [false, true]) test(`cancelling every blocked member clears the ${unresolved ? 'unresolved ' : ''}${refusal} batch with ${settle ? 'settled' : 'immediate'} same-head re-enqueue`, t => guardedMemberCase(t, async (t, step) => {
  let closeTracker = async () => {};
  // Every fixture disposer gates root/storage release on the pre-owned tracker.
  const fixtures = new Proxy(t, { get(target, key) {
    if (key === 'after') return (close: () => unknown) => t.after(async () => { await closeTracker(); await close(); });
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const state = await step(() => fixture(fixtures));
  const { f, boundary, entries } = state;
  const tracker = ownedTracker({ requireClose: close => { closeTracker = close; } }, { root: f.root, db: join(f.root, 'tracker.db'), git: async () => null,
    readBase: async () => 'dev', clock: f.clock, scheduleTips: () => ({ poke() {}, stop() {} }) });
  for (const entry of entries) await step(() => tracker.create(entry.by, { title: entry.item, branch: entry.branch, size: 'S' }));
  const queue = new MergeQueue(f.store, tracker, f.clock, () => true, async () => null);
  t.after(() => queue.stop());
  for (const entry of entries) f.store.enqueueMerge(entry);
  boundary.entries = () => queue.entries();
  const legacy: BatchCandidate = { base: 'old', head: 'old-head', tree: 'old-tree', cwd: join(f.root, 'legacy'), budgetLines: [] };
  let birth = 'admitted';
  const markers = new Map<string, string>();
  const host: CandidateOwnershipHost = {
    inspect: async () => ({ root: f.root, cwd: legacy.cwd, gitdir: join(f.root, 'fake-gitdir'), rootBirth: 'root', birth, gitBirth: 'git', head: legacy.head, tree: legacy.tree }),
    read: async path => markers.get(path) ?? '', write: async (path, text) => { markers.set(path, text); },
  };
  if (refusal === 'marked') {
    await step(() => captureCandidateOwnership(f.root, legacy, {}, host));
    birth = 'replacement';
  }
  boundary.drop = entry => { f.store.dropMerge(entry.item); };
  f.store.setMeta('merge-batch', JSON.stringify({ id: 'blocked', members: entries, candidate: legacy, failed: 'cleanup failure',
    ...(unresolved ? { diagnosis: { unresolved: true, reported: true, failure: { run: 'old', tree: 'old-tree', log: { artifact: 'old', path: 'old' } }, failures: [], files: [], jobs: [] } } : {}) }));
  boundary.cleanup = async candidate => {
    if (candidate.cwd === legacy.cwd) {
      if (refusal === 'legacy') throw new CandidateOwnershipUnavailable();
      if (refusal === 'marked') return removeOwnedBatchCandidate(f.root, candidate, {}, async () => { assert.fail('changed marked candidate must not be removed'); }, host);
      throw new Error('ps unavailable');
    }
  };
  for (const entry of entries) assert.equal(queue.cancel(entry.item).cancelled, true);
  if (settle) {
    await step(() => state.runner.tick());
    assert.equal(state.runner.snapshot(), null);
  }
  assert.deepEqual(queue.entries(), []);
  for (const entry of entries) {
    const view = await step(() => tracker.viewAsync(entry.item, work => work()));
    queue.enqueue(view, entry.head, 'dev', entry.by);
  }
  await step(() => state.runner.tick());
  const fresh = state.runner.snapshot()!;
  assert.notEqual(fresh.id, 'blocked');
  if (refusal !== 'legacy') {
    assert.equal(state.runner.cleanups()[0]!.candidate.cwd, legacy.cwd);
    assert.match(state.runner.cleanups()[0]!.error, refusal === 'marked' ? /ownership changed/ : /ps unavailable/);
  }
  await step(() => state.runner.tick());
  assert.ok(state.runner.snapshot()!.run);
  await step(() => f.finish(state.runner.snapshot()!.run!));
}));

test('upgrade restart preserves an unmarked blocked candidate and runs a fresh batch', t => guardedMemberCase(t, async (t, step) => {
  const state = await step(() => fixture(t));
  const { f, boundary, landed } = state;
  const legacy = { base: 'old', head: 'legacy-head', tree: 'legacy-tree', cwd: join(f.root, 'legacy'), budgetLines: [] };
  await step(() => mkdir(legacy.cwd));
  await step(() => writeFile(join(legacy.cwd, 'sentinel'), 'preserved'));
  f.store.setMeta('merge-batch', JSON.stringify({ id: 'legacy', members: state.entries, candidate: legacy, failed: 'old cleanup failure' }));
  boundary.validateOwnership = candidate => requireCandidateOwnership(f.root, candidate, {});
  boundary.cleanup = async candidate => {
    if (candidate.cwd === legacy.cwd) await removeOwnedBatchCandidate(f.root, candidate, {}, () => writeFile(join(legacy.cwd, 'sentinel'), 'removed'));
  };
  const build = boundary.build;
  boundary.build = async (id, members, base) => ({ ...await build(id, members, base), cwd: join(f.root, id) });
  // The fake checkout models the creation receipt; the legacy root is never adopted.
  const checkout = boundary.checkout;
  boundary.checkout = async candidate => {
    await checkout(candidate);
    candidate.owner = { id: 'fresh', root: f.root, cwd: candidate.cwd, gitdir: 'fake', rootBirth: 'root', birth: 'fresh', gitBirth: 'fresh', head: candidate.head, tree: candidate.tree };
  };
  await step(() => state.reopen());
  await step(() => state.runner.tick());
  await step(() => state.runner.tick());
  const fresh = state.runner.snapshot()!;
  assert.notEqual(fresh.id, 'legacy');
  assert.notEqual(fresh.candidate!.cwd, legacy.cwd);
  assert.ok(fresh.run);
  await step(() => f.finish(fresh.run!));
  await step(() => state.runner.tick());
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(state.runner.snapshot(), null);
  assert.equal(await step(() => readFile(join(legacy.cwd, 'sentinel'), 'utf8')), 'preserved');
  const diagnostic = JSON.parse(f.store.meta(`merge-batch-preserved-candidate:${legacy.cwd}`)!);
  assert.equal(diagnostic.cwd, legacy.cwd);
  assert.equal(diagnostic.cause, 'ownership-unavailable');
  await step(() => state.reopen());
  assert.ok(f.store.meta(`merge-batch-preserved-candidate:${legacy.cwd}`));
}));

test('candidate cleanup accepts the var to private-var alias and preserves replaced or unowned roots after reopen', t => guardedMemberCase(t, async (t, step) => {
  const candidate: BatchCandidate = { base: 'base', head: 'head', tree: 'tree', cwd: '/var/scratch/candidate', budgetLines: [] };
  let observation = { root: '/private/var/scratch', cwd: '/private/var/scratch/candidate', gitdir: '/private/var/scratch/.git/worktrees/candidate', rootBirth: 'root-native-birth', birth: 'candidate-native-birth', gitBirth: 'gitdir-native-birth', head: candidate.head, tree: candidate.tree };
  const markers = new Map<string, string>();
  const host: CandidateOwnershipHost = { inspect: async () => ({ ...observation }), read: async path => markers.get(path) ?? '', write: async (path, text) => { markers.set(path, text); } };
  await step(() => captureCandidateOwnership('/scratch', candidate, {}, host));
  await step(() => requireCandidateOwnership('/scratch', candidate, {}, host));
  let removed = 0, inspected = 0;
  const processes: FixtureProcesses = { rows: async () => { inspected++; return []; }, paths: async () => { throw new Error('unexpected paths'); }, sameUser: async () => false, missing: () => false, end: async () => { throw new Error('unexpected signal'); } };
  const remove = (owned: BatchCandidate) => removeOwnedBatchCandidate('/scratch', owned, {}, async () => { removed++; }, host, processes);
  await step(() => remove(candidate));
  assert.equal(removed, 1, 'fresh matching owner reaches guarded removal');
  // Candidate paths above are synthetic host facts, never allocated directories.
  // Keep disposal authority in real scratch and association metadata separate.
  const receiptRoot = await step(() => tempProject(t, 'batch-writer-'));
  const receipt = fixtureOwnership([receiptRoot], observation.cwd);
  t.after(() => { receipt.close(); receipt.remove(); });
  receipt.bind(101, 100_000, 100_000);
  const writer: FixtureProcesses = {
    rows: async () => [{ pid: 101, parent: 1, group: 101, state: 'S', command: '/fake/nvim --headless', started: new Date(100_000).toUTCString(), identity: 'writer-birth' }],
    paths: async () => ({ cwd: observation.cwd, files: [receipt.path] }), sameUser: async () => true, missing: () => false, end: async () => false,
  };
  await step(() => assert.rejects(removeOwnedBatchCandidate('/var/scratch', candidate, {}, async () => { removed++; }, host, writer), /could not be stopped; worktree kept/));
  assert.equal(removed, 1, 'canonical owned writer prevents removal through the var alias');
  const inspectedFresh = inspected;
  const reopened = JSON.parse(JSON.stringify(candidate)) as BatchCandidate;
  await step(() => requireCandidateOwnership('/scratch', reopened, {}, host));
  observation = { ...observation, birth: 'replacement-native-birth' };
  await step(() => assert.rejects(remove(reopened), /ownership changed/));
  assert.equal(inspected, inspectedFresh, 'replacement rejected before process discovery or signals');
  assert.equal(removed, 1);
  observation = { ...observation, birth: 'candidate-native-birth' };
  markers.clear();
  await step(() => assert.rejects(requireCandidateOwnership('/scratch', reopened, {}, host), /ownership changed/));
  delete reopened.owner;
  await step(() => assert.rejects(remove(reopened), /ownership unavailable/));
  assert.equal(removed, 1, 'recovered state grants no new removal authority');
}));

test('cleanup publication failure cannot block landed or unrelated active batches', t => guardedMemberCase(t, async (t, step) => {
  const state = await step(() => fixture(t));
  const { f, boundary, reports, entries } = state;
  boundary.cleanup = async () => { throw new Error('ps unavailable'); };
  boundary.changed = () => {
    if (JSON.parse(f.store.meta('merge-batch-cleanups') ?? '[]').length) throw new Error('publication unavailable');
  };
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  await step(() => f.finish(batch.run!));
  await step(() => state.runner.tick());
  assert.equal(state.runner.snapshot(), null);
  entries.push(...batch.members.map((entry, index) => ({ ...entry, item: `T-${index + 4}` })));
  await step(() => state.runner.tick());
  assert.ok(state.runner.snapshot()?.run);
  await step(() => f.clock.advance(1000));
  await step(() => state.runner.tick());
  assert.equal(state.runner.snapshot()?.failed, undefined);
  assert.ok(reports.every(text => !text.includes('blocked:')));
  assert.match(f.store.meta('merge-batch-publication-error')!, /publication unavailable/);
  let removed = 0;
  boundary.cleanup = async () => { removed++; };
  boundary.changed = () => { throw new Error('publication unavailable after positive cleanup'); };
  await step(() => f.clock.advance(4000));
  await step(() => state.runner.tick());
  await step(() => state.runner.tick());
  assert.equal(removed, 1, 'a later notification failure cannot repeat successful removal');
  assert.deepEqual(state.runner.cleanups(), []);
  assert.equal(state.runner.snapshot()?.failed, undefined);
}));

test('the thirty-third cleanup failure keeps capped retries and unresolved overflow ownership', t => guardedMemberCase(t, async (t, step) => {
  const state = await step(() => fixture(t));
  const { f, boundary, reports } = state;
  let attempts = 0;
  boundary.cleanup = async () => { attempts++; throw new Error('ps unavailable'); };
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  const pending = Array.from({ length: 32 }, (_, i) => ({ batch: { id: `old-${i}`, members: [] }, candidate: { ...batch.candidate, cwd: `/scratch/old-${i}` }, error: 'old error', attempts: 1, reported: true, retryAt: '2099-01-01T00:00:00Z' }));
  f.store.setMeta('merge-batch-cleanups', JSON.stringify(pending));
  await step(() => f.finish(batch.run!));
  await step(() => state.runner.tick());
  assert.equal(state.runner.snapshot(), null);
  assert.equal(state.runner.cleanups().length, 32);
  assert.equal(state.runner.cleanupOverflow().count, 1);
  assert.equal(state.runner.cleanupOverflow().oldestPath, batch.candidate!.cwd);
  assert.equal(attempts, 1);
  assert.ok(Buffer.byteLength(f.store.meta('merge-batch-cleanups')!) <= 262144);
  await step(() => state.runner.tick());
  assert.ok(reports.some(text => text.includes('UNRESOLVED cleanup overflow:') && text.includes(batch.candidate!.cwd) && text.includes('not auto-retried')));
  f.store.setMeta('merge-batch-cleanups', JSON.stringify(pending.map(job => ({ ...job, retryAt: f.clock.now().toISOString() }))));
  await step(() => state.runner.tick());
  assert.equal(attempts, 2, 'only one of 32 due roots is inspected in a tick');
}));

test('an overflow notice survives a failed delivery and batch clearance until later publication', t => guardedMemberCase(t, async (t, step) => {
  const state = await step(() => fixture(t));
  const { f, boundary, reports, entries } = state;
  const dependencies = dependencyInstall('/scratch', Array.from({ length: 5000 }, (_, i) => `packages/workspace-${i}/package-lock.json`))!;
  assert.ok(Buffer.byteLength(JSON.stringify(dependencies)) > 65536, 'positive dependency metadata larger than the notice budget');
  entries[0]!.dependencies = dependencies;
  let unavailable = true;
  const report = boundary.report;
  boundary.report = (batch, text, phase) => {
    if (text.startsWith('UNRESOLVED cleanup overflow:') && unavailable) throw new Error('overflow publication unavailable');
    report(batch, text, phase);
  };
  boundary.cleanup = async () => { throw new Error('ps unavailable'); };
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  f.store.setMeta('merge-batch-cleanups', JSON.stringify(Array.from({ length: 32 }, (_, i) => ({ batch: { id: `old-${i}`, members: [] }, candidate: { ...batch.candidate, cwd: `/scratch/old-${i}` }, error: 'old', attempts: 1, reported: true, retryAt: '2099-01-01T00:00:00Z' }))));
  await step(() => f.finish(batch.run!));
  await step(() => state.runner.tick());
  assert.ok(state.runner.snapshot() === null, 'terminal batch must clear despite dependency metadata exceeding the notice budget');
  assert.deepEqual(state.landed, ['T-1', 'T-2', 'T-3']);
  const retained = f.store.metaPage('merge-cleanup-notice:', '', 32);
  assert.equal(retained.length, 3);
  for (const row of retained) {
    assert.equal(row.oversized, false);
    const notice = JSON.parse(row.value);
    assert.equal(Object.hasOwn(notice.batch.members[0], 'dependencies'), false);
    assert.equal(notice.batch.members[0].by.id, batch.members[0]!.by.id);
    assert.equal(notice.batch.members[0].by.name, '');
    assert.equal(notice.batch.members[0].by.role, null);
  }
  await step(() => state.reopen());
  unavailable = false;
  await step(() => state.runner.tick());
  assert.ok(reports.some(text => text.startsWith('UNRESOLVED cleanup overflow:') && text.includes(batch.candidate!.cwd)));
  assert.equal(f.store.metaPage('merge-cleanup-notice:', '', 32).length, 2, 'one of three captured item obligations settles per tick');
  await step(() => state.runner.tick());
  await step(() => state.runner.tick());
  assert.deepEqual(f.store.metaPage('merge-cleanup-notice:', '', 32), []);
}));

test('encoded multibyte and escaped retry errors stay within near-capacity cleanup reservations', t => guardedMemberCase(t, async (t, step) => {
  const state = await step(() => fixture(t));
  const { f, boundary, entries } = state;
  let error = 'ps unavailable';
  boundary.cleanup = async () => { throw new Error(error); };
  await step(() => state.runner.tick());
  const batch = state.runner.snapshot()!;
  await step(() => f.finish(batch.run!));
  await step(() => state.runner.tick());
  const current = state.runner.cleanups()[0]!;
  const older = Array.from({ length: 31 }, (_, i) => {
    const job = structuredClone(current);
    job.candidate.cwd = `/scratch/old-${i}`;
    job.retryAt = '2099-01-01T00:00:00Z'; job.error = 'x'.repeat(2048);
    const bytes = Buffer.byteLength(JSON.stringify(job));
    job.batch.members[0]!.branch += 'p'.repeat(8100 - bytes);
    assert.equal(Buffer.byteLength(JSON.stringify(job)), 8100);
    return job;
  });
  f.store.setMeta('merge-batch-cleanups', JSON.stringify([...older, current]));
  entries.push(...batch.members.map((entry, i) => ({ ...entry, item: `T-${i + 4}` })));
  await step(() => state.runner.tick());
  error = '\0'.repeat(2048) + '界'.repeat(2048);
  await step(() => f.clock.advance(1000));
  await step(() => state.runner.tick());
  assert.equal(state.runner.snapshot()?.failed, undefined);
  assert.ok(Buffer.byteLength(f.store.meta('merge-batch-cleanups')!) <= 262144);
  error = '界'.repeat(2048);
  await step(() => f.clock.advance(4000));
  await step(() => state.runner.tick());
  assert.equal(state.runner.snapshot()?.failed, undefined);
  assert.ok(Buffer.byteLength(f.store.meta('merge-batch-cleanups')!) <= 262144);
}));

test('notice keyset pages bound encoded bytes and visit the next retained key', t => guardedMemberCase(t, async (t, step) => {
  const { f } = await step(() => fixture(t));
  for (let i = 0; i < 64; i++) f.store.setMeta(`page-control:${String(i).padStart(3, '0')}`, '界'.repeat(10_000));
  const first = f.store.metaPage('page-control:', '', 1, 4096);
  assert.equal(first.length, 1);
  assert.equal(first[0]!.key, 'page-control:000');
  assert.equal(first[0]!.oversized, true);
  assert.equal(first[0]!.readBytes, 4096, 'only the bounded SQLite substring crosses into V8');
  assert.equal(first[0]!.value, '', 'oversized payload is retained without decoding a truncated UTF-8 sequence');
  assert.equal(f.store.metaPage('page-control:', first[0]!.key, 1, 4096)[0]!.key, 'page-control:001');
}));

test('batch refusal transitions share one cleanup and notice budget in an admitted tick', t => guardedMemberCase(t, async (t, step) => {
  const { f, runner, boundary, dropped } = await step(() => fixture(t));
  let attempts = 0, notices = 0;
  const report = boundary.report;
  boundary.report = (batch, text, phase) => { if (text === 'budget notice') notices++; report(batch, text, phase); };
  for (let i = 0; i < 3; i++) f.store.setMeta(`merge-cleanup-notice:budget-${i}`, JSON.stringify({ batch: { id: `notice-${i}`, members: [] }, text: 'budget notice', phase: `cleanup:overflow:budget-${i}` }));
  boundary.cleanup = async () => { attempts++; throw new Error('ps unavailable'); };
  const candidate = { base: 'base', head: 'head', tree: 'tree', cwd: '/scratch/backlog', budgetLines: [] };
  f.store.setMeta('merge-batch-cleanups', JSON.stringify(Array.from({ length: 3 }, (_, i) => ({ batch: { id: `old-${i}`, members: [] }, candidate: { ...candidate, cwd: `/scratch/backlog-${i}` }, error: 'old', attempts: 1, reported: true, retryAt: f.clock.now().toISOString() }))));
  const build = boundary.build;
  boundary.build = async (id, members, base) => {
    if (members[0]!.item !== 'T-3') throw new BatchRefusal(members[0]!, 'preparation refusal');
    return build(id, members, base);
  };
  await step(() => runner.tick());
  assert.equal(dropped.length, 2);
  assert.equal(attempts, 1, 'internal refusal transitions cannot multiply due native cleanup work');
  assert.equal(notices, 1, 'internal refusal transitions share the same notice page allowance');
  assert.equal(f.store.metaPage('merge-cleanup-notice:', '', 32).length, 2);
  assert.deepEqual(runner.snapshot()?.members.map(entry => entry.item), ['T-3']);
}));

test('a ps failure before landing blocks and retains the pinned heads', t => guardedMemberCase(t, async (t, step) => {
  const { runner, boundary, entries, landed, reports } = await step(() => fixture(t));
  const heads = structuredClone(entries);
  boundary.build = async () => { throw new Error('cannot inspect the OS process table: ps failed or timed out'); };
  await step(() => runner.tick());
  assert.match(runner.snapshot()!.failed!, /ps failed or timed out/);
  assert.deepEqual(entries, heads);
  assert.deepEqual(landed, []);
  assert.match(reports.join('\n'), /blocked:.*ps failed or timed out/);
  assert.match(reports.join('\n'), /cancel and re-enqueue each retained head/);
}));

test('all-completed recovery waits for the admitted worker before cleanup', async t => {
  const { f, runner, boundary } = await fixture(t);
  const cleaned: string[] = [];
  boundary.cleanup = async candidate => { cleaned.push(candidate.cwd); };
  await runner.tick();
  const batch = runner.snapshot()!;
  batch.completed = batch.members.map(entry => entry.item);
  batch.failed = 'old follow-up failure';
  f.store.setMeta('merge-batch', JSON.stringify(batch));
  await runner.tick();
  assert.deepEqual(cleaned, []);
  assert.equal(runner.snapshot()?.id, batch.id);
  await f.finish(batch.run!);
  await runner.tick();
  assert.deepEqual(cleaned, [f.root]);
  assert.equal(runner.snapshot(), null);
});

for (const restart of [false, true]) test(`a failed follow-up notice survives ${restart ? 'reopen' : 'a later tick'} without holding remaining landings`, async t => {
  const state = await fixture(t);
  const { f, boundary, landed, entries, reports } = state;
  const land = boundary.land, report = boundary.report;
  const logs: Record<string, unknown>[] = [];
  boundary.log = log => { logs.push(log); };
  let unavailable = true;
  boundary.land = async (entry, candidate) => {
    await land(entry, candidate);
    if (entry.item === 'T-1') throw new Error('merged, follow-up failed: stop sessions: ps failed or timed out');
  };
  boundary.report = (batch, text, phase) => {
    if (phase?.startsWith('follow-up:') && unavailable) throw new Error('notice sink unavailable');
    report(batch, text, phase);
  };
  await state.runner.tick();
  await f.finish(f.suites.status()[0]!.id);
  await state.runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(state.runner.snapshot(), null);
  assert.ok(logs.some(log => log.event === 'merge-follow-up-report-failed' && log.item === 'T-1'
    && log.reason === 'merged, follow-up failed: stop sessions: ps failed or timed out' && log.error === 'notice sink unavailable'));
  if (restart) await state.reopen();
  await state.runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  unavailable = false;
  await state.runner.tick();
  assert.equal(reports.filter(text => text.startsWith('T-1: merged, follow-up failed: stop sessions: ps failed or timed out')).length, 1);
  await state.runner.tick();
  assert.equal(reports.filter(text => text.startsWith('T-1: merged, follow-up failed:')).length, 1, 'successful delivery settles the obligation');
  assert.deepEqual(entries, []);
  assert.equal(f.suites.status().length, 1, 'report retries cannot rerun the green suite');
});

test('a throwing blocked report resolves the background tick and retains both failures across reopen', async t => {
  const state = await fixture(t);
  const { boundary, landed, dropped } = state;
  const logs: Record<string, unknown>[] = [];
  boundary.log = entry => { logs.push(entry); };
  boundary.build = async () => { throw new Error('candidate preparation failed'); };
  boundary.report = () => { throw new Error('report boundary failed'); };
  state.runner.start();
  await assert.doesNotReject(state.runner.tick());
  assert.equal(state.runner.snapshot()?.failed, 'candidate preparation failed');
  assert.equal(state.runner.snapshot()?.reportError, 'report boundary failed');
  assert.ok(logs.some(entry => entry.event === 'merge-batch-report-failed' && entry.error === 'report boundary failed'));
  await state.reopen();
  await assert.doesNotReject(state.runner.tick());
  assert.equal(state.runner.snapshot()?.failed, 'candidate preparation failed');
  assert.equal(state.runner.snapshot()?.reportError, 'report boundary failed');
  assert.deepEqual(landed, []);
  assert.deepEqual(dropped, []);
});

async function webBatch(f: Awaited<ReturnType<typeof suiteUnit>>) {
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ncheck="npm run check"\ntest_unit="unit"\n');
  await writeFile(join(f.root, 'hub/test/run-suite.ts'), '// inheritedLease; supportsWebPhase = true');
  await mkdir(join(f.root, 'web/test'), { recursive: true });
  await writeFile(join(f.root, 'web/test/smoke.test.ts'), '');
  await writeFile(join(f.root, 'hub/test/example.test.ts'), '');
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { 'hub/test/example.test.ts': 'T1', 'web/test/smoke.test.ts': 'Web' } }));
  f.configure('[verification]\nexecutor="droplet"\n[merge]\nqueue=true\nbatch_tiers=["T1"]');
  f.candidate.selection.files = ['web/src/Shell.tsx'];
}

test('a filed Web batch cannot land after five passing repeats outside quarantine scope', t => suiteCase(t, async ({ setup, step }) => {
  const state = await setup(fixtures => fixture(fixtures, { machineReceiptsOnly: true, flakyOwners: () => ({ [filedWebIdentity]: 'T-4' }) }, t));
  const { f, runner, landed } = state;
  await step('prepare Web batch fixtures', () => webBatch(f));
  await step('admit Web batch', () => runner.tick());
  const original = f.suites.status()[0]!;
  await finishFiledWebRepeats(f, step, original.id);
  const result = (await step('read durable Web batch disposition', () => f.jobs())).find(job => job.id === original.id)!;
  assert.equal(result.reported, true, JSON.stringify({ flaky: result.flaky, error: result.error, cover: result.cover }));
  assert.equal(result.outcome?.code, 1);
  assert.equal(result.flaky?.runs.length, 5);
  assert.equal(result.flaky?.rejected, 'Web identity outside quarantine scope');
  assert.equal(result.cover?.receipt, undefined);
  const receipt = await step('read retained batch refusal evidence', () => f.suites.receipt(original.id));
  assert.match(receipt.log, /suite flaky receipt refusal .*"reason":"Web identity outside quarantine scope"/);
  await step('apply red batch disposition', () => runner.tick());
  assert.deepEqual(landed, []);
  assert.ok(!(await step('read Web batch evidence', () => f.log(original.id))).includes('suite green-with-receipt'));
}));

for (const webReceipt of ['', 'tier Web: exit 1; duration 3 s; output tail: conflicting Web\n']) test(`an exit-zero Web batch holds with ${webReceipt ? 'conflicting' : 'missing'} Web proof across reopen`, async t => {
  const state = await fixture(t);
  const { f, landed, dropped } = state;
  await webBatch(f);
  await state.runner.tick();
  const original = f.suites.status()[0]!;
  await f.finish(original.id, 0, t0Green + webReceipt + passLog);
  await state.reopen(); await state.runner.tick();
  assert.deepEqual(landed, []);
  assert.deepEqual(dropped, []);
  assert.match(state.runner.snapshot()?.failed ?? '', /original.*inconclusive.*passing step receipt/);
  assert.equal(f.suites.status().length, 1);
});

test('two members green on Web alone are bisected and refused when their combined Web step stays red', async t => {
  const { f, runner, entries, boundary, dropped, landed, reports } = await fixture(t);
  entries.splice(2);
  await webBatch(f);
  const build = boundary.build;
  boundary.build = async (id, members, base) => {
    const candidate = await build(id, members, base);
    candidate.tree = members.length === 2 ? 'combined-web-error' : `green-${members[0]!.item}`;
    f.candidate.tree = candidate.tree;
    return candidate;
  };
  const red = 'suite test failures [{"file":"web/test/smoke.test.ts","name":"renders combined members"}]\n'
    + 'tier Web: exit 1; duration 7 s; output tail: combined members fail\n';
  await f.clock.advance(600_000);
  await runner.tick();
  const original = f.suites.status()[0]!;
  await f.finish(original.id, 1, t0Green + 'tier T1: exit 0; duration 2 s; output tail: unit passed\n' + red);
  assert.deepEqual((await f.suites.receipt(original.id)).job.commands?.plan?.map(step => step.name), ['check', 'T1', 'Web']);
  await runner.tick();
  for (let index = 0; index < 3; index++) {
    const job = f.suites.status().at(-1)!;
    assert.deepEqual(job.batch?.diagnostic, { key: index === 2 ? 'repeat' : `omit-${index}`, files: [], steps: ['Web'] });
    assert.equal(job.tree, index === 2 ? 'combined-web-error' : `green-T-${2 - index}`);
    const selection = selectionFromEnv(selectionTransport(job.selection, join(f.root, 'selection.json')).env)!;
    assert.deepEqual((await packageShards(f.root, selection.mode, selection.shard, selection)).flatMap(phase => phase.targets), ['web/test/smoke.test.ts']);
    await f.finish(job.id, index === 2 ? 1 : 0, index === 2 ? red : 'tier Web: exit 0; duration 3 s; output tail: member passes alone\n');
    assert.deepEqual((await f.suites.receipt(job.id)).job.commands?.plan, [{ name: 'Web', command: 'node hub/test/run-suite.ts --tier Web' }]);
    await runner.tick();
  }
  assert.equal(f.suites.status().length, 4, 'original, two green individual trees, red combined repeat');
  assert.deepEqual(landed, []);
  assert.equal(dropped.length, 2);
  assert.ok(dropped.every(reason => /merge-bisect-unresolved:.*Web/s.test(reason)));
  assert.match(reports[0]!, /Web: exit 1; duration 7 s/);
  assert.equal(runner.snapshot(), null);
});

for (const log of [passLog, t0Red + passLog]) test(`recovered exit-zero batch holds with ${log === passLog ? 'missing' : 'conflicting'} T0 proof`, async t => {
  const state = await fixture(t);
  const { f, landed, dropped, boundary } = state;
  const notices: TopicNotice[] = [];
  boundary.notice = notice => { notices.push(notice); };
  await state.runner.tick();
  const original = f.suites.status()[0]!;
  await f.finish(original.id, 0, passLog);
  const receipt = await f.suites.receipt(original.id);
  // Plant the retained pre-upgrade/incomplete receipt after its writer has
  // finished, before reopening the controller that must validate it.
  await writeFile(receipt.job.log, log);
  await state.reopen(); await state.runner.tick();
  assert.deepEqual(landed, []);
  assert.deepEqual(dropped, []);
  assert.match(state.runner.snapshot()?.failed ?? '', /original.*inconclusive.*passing step receipt/);
  assert.equal(f.suites.status().length, 1);
  assert.equal(notices.length, 1);
  await state.reopen(); await state.runner.tick();
  assert.equal(notices.length, 1, 'the durable hold is not republished after restart');
});

for (const step of ['T0', 'Web']) for (const path of ['unique omission', 'passing repeat']) for (const tierCode of [0, 1]) test(`${step} ${path} requires its full pinned plan before landing: later tier exit ${tierCode}`, async t => {
  const state = await fixture(t);
  const { f, entries, boundary, landed } = state;
  entries.splice(2);
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ncheck="npm run check"\ntest_unit="unit"\n');
  f.configure('[verification]\nexecutor="droplet"\n[merge]\nqueue=true\nbatch_tiers=["T1"]');
  if (step === 'Web') await webBatch(f);
  const stepRed = step === 'T0' ? t0Red : 'tier Web: exit 1; duration 3 s; output tail: web failure\n';
  const stepGreen = step === 'T0' ? t0Green : 'tier Web: exit 0; duration 2 s; output tail: web passed\n';
  const build = boundary.build;
  boundary.build = async (id, members, base) => {
    const candidate = await build(id, members, base);
    candidate.tree = [...landed, ...members.map(member => member.item)].sort().join('+');
    f.candidate.tree = candidate.tree;
    return candidate;
  };
  await f.clock.advance(600_000);
  await state.runner.tick();
  const original = f.suites.status()[0]!;
  await f.finish(original.id, 2, stepRed); await state.runner.tick();
  for (let index = 0; index < (path === 'unique omission' ? 2 : 3); index++) {
    const red = path === 'unique omission' && index === 1;
    await f.finish(f.suites.status().at(-1)!.id, red ? 2 : 0, red ? stepRed : stepGreen);
    await state.runner.tick();
  }
  assert.deepEqual(landed, [], 'passing only step bisection cannot authorize landing');
  const selected = state.runner.snapshot()!.candidate!;
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ncheck="wrong check"\ntest_integration="wrong integration"\n');
  f.configure('[verification]\nexecutor="droplet"\n[merge]\nqueue=true\nbatch_tiers=["T3"]');
  await state.reopen(); await state.runner.tick();
  const confirmation = f.suites.status().at(-1)!;
  assert.equal(confirmation.occasion, 'batch');
  assert.equal(confirmation.batch?.diagnostic, undefined);
  assert.equal(confirmation.head, selected.head); assert.equal(confirmation.tree, selected.tree);
  await f.finish(confirmation.id, tierCode, t0Green + `tier T1: exit ${tierCode}; duration 1 s; output tail: unit\n` + (tierCode ? failureLog : passLog + (step === 'Web' ? stepGreen : '')));
  const receipt = await f.suites.receipt(confirmation.id);
  assert.deepEqual(receipt.job.commands?.plan, [{ name: 'check', command: 'npm run check' }, { name: 'T1', command: 'unit' },
    ...(step === 'Web' ? [{ name: 'Web', command: 'node hub/test/run-suite.ts --tier Web' }] : [])], 'the original batch commands survive config reload and reopen');
  assert.deepEqual(receipt.job.selection?.tiers, ['T1']);
  await state.runner.tick();
  assert.deepEqual(landed, tierCode ? [] : path === 'unique omission' ? ['T-2'] : ['T-1', 'T-2']);
});

for (const path of ['unique omission', 'passing repeat']) test(`T1 ${path} confirms the original Web plan before landing`, t => suiteCase(t, async ({ setup, step }) => {
  const state = await setup(fixtures => fixture(fixtures, {}, t));
  const { f, entries, boundary, landed } = state;
  entries.splice(2);
  await step("webBatch(f)", () => webBatch(f));
  const build = boundary.build;
  boundary.build = async (id, members, base) => {
    const candidate = await step("build(id, members, base)", () => build(id, members, base));
    candidate.tree = [...landed, ...members.map(member => member.item)].sort().join('+');
    f.candidate.tree = candidate.tree;
    return candidate;
  };
  await step("f.clock.advance(600_000)", () => f.clock.advance(600_000));
  await step("state.runner.tick()", () => state.runner.tick());
  const original = f.suites.status()[0]!;
  await step("f.finish(original.id, 1, t0Green + 'tier T1: exit 1; duration 1 s", () => f.finish(original.id, 1, t0Green + 'tier T1: exit 1; duration 1 s; output tail: unit failed\n' + failureLog));
  await step("state.runner.tick()", () => state.runner.tick());
  for (let index = 0; index < (path === 'unique omission' ? 2 : 3); index++) {
    const job = f.suites.status().at(-1)!;
    assert.deepEqual(job.batch?.diagnostic?.files, ['hub/test/example.test.ts'], state.runner.snapshot()?.failed);
    assert.equal(job.batch?.diagnostic?.steps, undefined, 'T1 stopped execution before Web');
    const red = path === 'unique omission' && index === 1;
    await step("f.finish(job.id, red ? 1 : 0, red ? failureLog : passLog)", () => f.finish(job.id, red ? 1 : 0, red ? failureLog : passLog));
    await step("state.runner.tick()", () => state.runner.tick());
  }
  assert.deepEqual(landed, [], 'green file diagnostics supply no Web proof');
  if (path === 'passing repeat') {
    assert.equal(state.runner.snapshot(), null, 'unfiled test failures cannot select the repeated tree');
    return;
  }
  const selected = state.runner.snapshot()!.candidate!;
  await step("state.runner.tick()", () => state.runner.tick());
  const confirmation = f.suites.status().at(-1)!;
  assert.equal(confirmation.batch?.diagnostic, undefined);
  assert.equal(confirmation.head, selected.head); assert.equal(confirmation.tree, selected.tree);
  await step("f.finish(confirmation.id, 0, t0Green + passLog + 'tier T1: exit 0", () => f.finish(confirmation.id, 0, t0Green + passLog + 'tier T1: exit 0; duration 1 s; output tail: unit passed\ntier Web: exit 0; duration 2 s; output tail: web passed\n'));
  assert.deepEqual((await step("f.suites.receipt(confirmation.id)", () => f.suites.receipt(confirmation.id))).job.commands?.plan?.map(step => step.name), ['check', 'T1', 'Web']);
  await step("state.runner.tick()", () => state.runner.tick());
  assert.deepEqual(landed, path === 'unique omission' ? ['T-2'] : ['T-1', 'T-2']);
}));

test('two individually typechecking members with a red combined T0 are bisected and refused after a red repeat', async t => {
  const { f, runner, entries, boundary, dropped, landed, reports } = await fixture(t);
  entries.splice(2);
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ncheck="npm run check"\ntest_unit="true"\n');
  f.configure('[verification]\nexecutor="droplet"\n[merge]\nqueue=true\nbatch_tiers=["T1"]');
  const build = boundary.build;
  boundary.build = async (id, members, base) => {
    const candidate = await build(id, members, base);
    candidate.tree = members.length === 2 ? 'combined-type-error' : `green-${members[0]!.item}`;
    f.candidate.tree = candidate.tree;
    return candidate;
  };
  const red = 'wire-conformance.ts(10,1): error TS2344: Type false does not satisfy constraint true.\ntier T0: exit 2; duration 3 s; output tail: error TS2344\n';
  await f.clock.advance(600_000);
  await runner.tick();
  const original = f.suites.status()[0]!;
  await f.finish(original.id, 2, red);
  assert.deepEqual((await f.suites.receipt(original.id)).job.commands?.plan, [{ name: 'check', command: 'npm run check' }, { name: 'T1', command: 'true' }]);
  await runner.tick();
  assert.equal(runner.snapshot()?.failed, undefined, 'a completed T0 failure starts diagnosis rather than an inconclusive hold');
  for (let index = 0; index < 3; index++) {
    const job = f.suites.status().at(-1)!;
    assert.deepEqual(job.batch?.diagnostic?.files, []);
    await f.finish(job.id, index === 2 ? 2 : 0, index === 2 ? red : 'tier T0: exit 0; duration 1 s; output tail: typecheck and static lints passed\n');
    assert.deepEqual((await f.suites.receipt(job.id)).job.commands?.plan, [{ name: 'check', command: 'npm run check' }], 'T0 diagnostics run the complete check, without runtime tiers');
    await runner.tick();
  }
  assert.equal(f.suites.status().length, 4, 'original, two green individual trees, red combined repeat');
  assert.deepEqual(landed, []);
  assert.equal(dropped.length, 2);
  assert.ok(dropped.every(reason => /merge-bisect-unresolved: T0/.test(reason)));
  assert.match(reports[0]!, /T0: exit 2; duration 3 s/);
  assert.equal(runner.snapshot(), null);
});

test('diagnostic identity failure holds the batch with omission and Git evidence', async t => {
  const state = await fixture(t);
  const { f, boundary, runner, dropped, landed, reports } = state;
  const notices: TopicNotice[] = [];
  boundary.notice = notice => { notices.push(notice); };
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, failureLog);
  boundary.build = (id, members, base) => prepareMergeBatch(f.root, id, members, {}, {
    git: async args => args[1] === '--is-bare-repository' ? 'false' : args[0] === 'rev-parse' ? members.find(entry => `refs/heads/${entry.branch}` === args[1])!.head
      : args[0] === 'commit-tree' ? 'fresh-commit' : 'merged-tree\0',
    facts: async () => ({ context: null, workers: 1 }),
    identity: async () => { throw new Error('git write-tree: stdout: partial output; stderr: unable to write tree'); },
    checkout: boundary.checkout, remove: boundary.cleanup,
  }, base);
  await runner.tick();
  assert.match(runner.snapshot()?.failed ?? '', /omitting T-1.*fresh-commit.*git write-tree.*partial output.*unable to write tree/s);
  assert.deepEqual(runner.snapshot()?.diagnosis?.jobs, []);
  assert.deepEqual(dropped, []); assert.deepEqual(landed, []);
  assert.equal(f.suites.status().length, 1, 'no diagnostic job admitted without an identity');
  assert.equal(notices.length, 1);
  assert.deepEqual(notices[0]!.to, ['coordinator']);
  assert.match(notices[0]!.text, /omitting T-1.*git write-tree.*unable to write tree/s);
  assert.match(reports.at(-1)!, /omitting T-1/);
  await state.reopen(); await state.runner.tick();
  assert.equal(notices.length, 1, 'durable hold does not repeat the notice');
});

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

for (const scope of ['test', 'file'] as const) test(`a ${scope}-budget-only red pair refuses the member isolated by failing-file reruns`, async t => {
  // T1 component regression: real controller/Suites composition, planted executor receipts.
  const { f, runner, entries, boundary, dropped, landed, reports } = await fixture(t);
  entries.splice(2);
  const identity = `hub/test/example.test.ts${scope === 'test' ? '::new lifecycle' : ''}`;
  const budget = `duration budget: ${identity} ${scope === 'test' ? '5.036 s > 5 s' : '60.036 s > 60 s'} (add to hub/test/durations.json with a reason)`;
  const budgetLog = `suite test failures []\n# tests 1\n# pass 1\n${budget}\n`;
  const build = boundary.build;
  boundary.build = async (id, members, base) => {
    const candidate = await build(id, members, base);
    candidate.tree = members.some(entry => entry.item === 'T-2') ? 'over-budget' : 'within-budget';
    f.candidate.tree = candidate.tree;
    return candidate;
  };
  const land = boundary.land;
  boundary.land = async (entry, candidate) => {
    assert.equal(candidate.tree, 'within-budget');
    await land(entry, candidate);
  };
  await f.clock.advance(600_000);
  await runner.tick();
  await f.finish(f.suites.status()[0]!.id, 1, budgetLog);
  await runner.tick();
  assert.equal(runner.snapshot()?.failed, undefined, 'budget failure is actionable red evidence');
  for (let index = 0; index < 2; index++) {
    const diagnostic = f.suites.status().at(-1)!;
    assert.deepEqual(diagnostic.batch?.diagnostic?.files, ['hub/test/example.test.ts']);
    assert.equal(diagnostic.selection?.loadGate, false);
    await f.finish(diagnostic.id, diagnostic.tree === 'within-budget' ? 0 : 1,
      diagnostic.tree === 'within-budget' ? 'suite test failures []\n# tests 0\n' : budgetLog);
    await runner.tick();
  }
  assert.deepEqual(dropped, [`T-2: merge-bisected: ${identity}\n${budget}`]);
  assert.deepEqual(landed, []);
  await runner.tick();
  await f.finish(f.suites.status().at(-1)!.id); await runner.tick();
  assert.deepEqual(landed, ['T-1']);
  assert.equal(runner.snapshot(), null);
  assert.equal(f.suites.status().length, 4);
  assert.ok(reports.join('\n').includes(budget), 'report retains the measured seconds and threshold');
});

test('a red hub-only triple reaches a unique green leave-one-out verdict through runner selection decoding', async t => {
  // T1: compose real MergeBatches, Suites and the runner decoder with executor receipts.
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
    const transport = selectionTransport(diagnostic.selection, join(f.root, 'selection.json'));
    assert.deepEqual(selectionFromEnv(transport.env), diagnostic.selection, 'the runner must accept each diagnostic before producing its test receipt');
    assert.deepEqual(diagnostic.selection?.shard, { files: ['hub/test/example.test.ts'], nvim: false });
    assert.equal(diagnostic.selection?.loadGate, false);
    assert.equal(diagnostic.cached, undefined);
    await f.finish(diagnostic.id, diagnostic.tree === 'without-culprit' ? 0 : 1, diagnostic.tree === 'without-culprit' ? undefined : failureLog);
    await runner.tick();
  }
  assert.match(dropped[0]!, /T-2: merge-bisected.*rejects stale input/);
  assert.deepEqual(landed, []);
  assert.match(reports.at(-2)!, /file job.*tree without-culprit.*seconds.*cost/s);
  await runner.tick();
  await f.finish(f.suites.status().at(-1)!.id); await runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-3']);
  assert.equal(runner.snapshot(), null, 'diagnosis completes instead of holding an inconclusive batch');
  assert.equal(f.suites.status().length, 5, 'original, three file jobs and full confirmation');
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

test('unfiled flaky batches stay red despite passing file repeats', t => suiteCase(t, async ({ setup, step }) => {
  const { f, runner, landed, dropped } = await setup(fixtures => fixture(fixtures, {}, t));
  await step("runner.tick()", () => runner.tick());
  await step("f.finish(f.suites.status().at(-1)!.id, 1, failureLog)", () => f.finish(f.suites.status().at(-1)!.id, 1, failureLog)); await step("runner.tick()", () => runner.tick());
  for (let index = 0; index < 4; index++) {
    await step("f.finish(f.suites.status().at(-1)!.id, 0, passLog)", () => f.finish(f.suites.status().at(-1)!.id, 0, passLog)); await step("runner.tick()", () => runner.tick());
  }
  assert.deepEqual(landed, []);
  assert.equal(dropped.length, 3);
  assert.equal(runner.snapshot(), null);
}));

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
  const budgetLog = 'suite test failures []\nduration budget: hub/test/example.test.ts::new lifecycle 5.036 s > 5 s (add to hub/test/durations.json with a reason)\n';
  const t0 = 'tier T0: exit 2; duration 0.2 s; output tail: typecheck failed\n';
  for (const receipt of [
    { ...complete, cancelled: true },
    { ...complete, requesterDied: true },
    { ...complete, timedOut: true },
    { ...complete, outcome: null },
    { ...complete, state: 'running' as const },
    { ...complete, outcome: { code: 1, cause: 'remote machine lost' } },
    { ...complete, outcome: { code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' } },
    { ...complete, outcome: { code: 1, cause: 'unknown result' } },
  ]) for (const log of [failureLog, budgetLog, t0]) assert.equal(diagnosticResult(receipt, log).result, 'inconclusive');
  assert.equal(diagnosticResult(complete, '').result, 'inconclusive', 'an exit code without test failures supplies no red proof');
  assert.equal(diagnosticResult(complete, failureLog).result, 'red');
  assert.equal(diagnosticResult(complete, budgetLog).result, 'red');
  assert.equal(diagnosticResult(complete, 'duration budget: missing tier for hub/test/example.test.ts\n').result, 'inconclusive');
  assert.equal(diagnosticResult({ ...complete, outcome: { code: 0, cause: '' } }, passLog).result, 'green');
  assert.equal(diagnosticResult(complete, t0).result, 'red');
  assert.equal(diagnosticResult(complete, t0.replace('exit 2;', 'exit 143;')).result, 'inconclusive');
  const green = { ...complete, outcome: { code: 0, cause: '' } };
  assert.equal(diagnosticResult(green, passLog, ['check']).result, 'inconclusive', 'passing tests cannot stand for an unobserved T0 check');
  assert.equal(diagnosticResult(green, t0, ['check']).result, 'inconclusive');
  assert.equal(diagnosticResult(green, t0.replace('exit 2;', 'exit 0;'), ['check']).result, 'green');
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

test('batch preparation reports the pinned and current heads when a task ref moves', async () => {
  const entry: MergeQueueEntry = { item: 'T-1', branch: 't/1', head: '1'.repeat(40), verdictBase: 'dev', enqueued: '2026-10-16T12:00:00Z', by: { id: 'coord', name: 'coord', role: 'coordinator' } };
  await assert.rejects(prepareMergeBatch('/isolated', 'moved-head', [entry], {}, {
    git: async args => {
      if (args[1] === '--is-bare-repository') return 'false';
      if (args[0] === 'rev-parse') return args.at(-1) === 'refs/heads/dev' ? 'a'.repeat(40) : 'f'.repeat(40);
      assert.fail(`moved head reached Git preparation: ${args}`);
    },
    facts: async () => { assert.fail('moved head cannot be merged'); },
    identity: async () => null, checkout: async () => {}, remove: async () => {},
  }), error => {
    assert.ok(error instanceof BatchRefusal);
    assert.equal(error.entry, entry);
    assert.equal(error.reason, `merge-changed: queued task branch changed during preparation; prepared head ${entry.head}, current head ${'f'.repeat(40)}`);
    return true;
  });
});

for (const referenced of ['T-1', 'T-2']) test(`batch projected closure ${referenced === 'T-1' ? 'refuses its member with a file and line' : 'preserves references to another open item'}`, t => guardedMemberCase(t, async (_fixtures, step, wait) => {
  const member: MergeQueueEntry = { item: 'T-1', branch: 't/1', head: '1'.repeat(40), verdictBase: 'dev', enqueued: '2026-10-16T12:00:00Z', by: { id: 'coord', name: 'coord', role: 'coordinator' } };
  const blobs: Record<string, string> = {
    '.cland/tasks/member.md': '---\nid: T-1\nstate: open\n---\n',
    '.cland/tasks/other.md': '---\nid: T-2\nstate: open\n---\n',
    'docs/guide.md': `# Guide\nWait until ${referenced} lands.\n`,
  };
  const prepare = () => step(() => prepareMergeBatch('/isolated', 'wording', [member], {}, {
    git: async args => {
      if (args[0] === 'rev-parse') return args[1] === '--is-bare-repository' ? 'false' : args[1] === 'refs/heads/dev' ? 'base' : member.head;
      if (args[0] === 'merge-tree') return 'tree\0';
      if (args[0] === 'commit-tree') return 'candidate';
      throw new Error(`unexpected Git operation ${args[0]}`);
    },
    facts: async (tree, _head, _base, closing) => {
      await requireMergeClosedItemWording(tree, closing, async args => {
        if (args[0] === 'ls-tree') return Object.keys(blobs).join('\0') + '\0';
        if (args[0] === 'show' && args[1]?.startsWith('tree:')) return blobs[args[1].slice(5)]!;
        throw new Error(`unexpected blob read ${args}`);
      });
      return { context: null, workers: 1 };
    },
    identity: async () => 'tree', checkout: async () => {}, remove: async () => {},
  }));
  if (referenced === 'T-1') await wait('immutable batch preparation', () => assert.rejects(prepare(), error => error instanceof BatchRefusal && error.entry === member && /docs\/guide.md:2: closed item T-1 with until wording/.test(error.reason)));
  else assert.equal((await wait('immutable batch preparation', prepare)).tree, 'tree');
  assert.match(blobs['.cland/tasks/member.md']!, /state: open/);
}));

async function queuedLanding(t: Parameters<typeof suiteUnit>[0], movement: 'none' | 'dev' | 'task' | 'dirty' | 'follow-up' | 'manual-follow-up') {
  const { f, runner, landed, reports, boundary, entries, dropped } = await fixture(t);
  let moved = false;
  let followUpPending = true;
  if (movement === 'manual-follow-up') entries.splice(1);
  if (movement === 'dirty') await writeFile(join(f.root, 'root-note.txt'), 'clean');
  // Exercise the real receipt and finishMerge path with Git represented by
  // immutable object/ref facts. Worktree removal returns an OS-edge receipt.
  const heads = new Map(entries.map(entry => [entry.branch, entry.head])); heads.set('dev', 'a'.repeat(40));
  const git = async (args: string[]) => {
    if (movement === 'manual-follow-up' && args[0] === 'show') return 'Item: T-1';
    if (movement === 'manual-follow-up' && args[0] === 'symbolic-ref') return 'dev';
    if (movement === 'manual-follow-up' && args[0] === 'rev-parse' && args.at(-1)!.endsWith('^')) return 'a'.repeat(40);
    if (args[0] === 'for-each-ref') return [...heads].map(([branch, head]) => `${head} refs/heads/${branch}`).join('\n');
    if (args[0] === 'rev-parse') return heads.get(args.at(-1)!.replace(/^refs\/heads\//, '').replace(/\^\{commit\}$/, '')) ?? null;
    if (args[0] === 'merge-base') return 'a'.repeat(40);
    if (args[0] === 'diff-tree') return 'hub/src/parser.ts\0';
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
  const headDrops: string[] = [];
  const queue = new MergeQueue(f.store, tracker, f.clock, () => true, git, undefined, (entry, reason) => headDrops.push(`${entry.item}: ${reason}`));
  t.after(() => queue.stop());
  for (const entry of entries) f.store.enqueueMerge(entry);
  const worktrees = { serial: async <T>(work: () => Promise<T>) => work(), prune: async () => ({ removed: [], failed: [] }), pruneMerged: async () => ({ removed: [], failed: [] }) };
  const mergeLogs: Record<string, unknown>[] = [];
  const merges = new TaskMerges(tracker, worktrees, log => { mergeLogs.push(log); }, async item => {
    if ((movement === 'follow-up' || movement === 'manual-follow-up') && followUpPending && item === 'T-1') throw new Error('cannot inspect the OS process table: ps failed or timed out');
  }, f.env, async (_root, operation) => operation(), queue,
    async (_root, branch, message, _resumed, prepared) => {
      if (movement === 'dirty' && await readFile(join(f.root, 'root-note.txt'), 'utf8') !== 'clean') {
        throw new MergeError('merge-dirty', 'uncommitted changes in root-note.txt', ['root-note.txt']);
      }
      const tip = heads.get(branch)!, base = heads.get('dev')!;
      if ((movement === 'dev' || movement === 'task') && !moved) { moved = true; heads.set(movement === 'dev' ? 'dev' : branch, 'f'.repeat(40)); }
      const text = await message(tip, 'dev', base, ['hub/src/parser.ts']);
      assert.match(text, /Reviewed-by: reviewer \(batch-review\)/);
      const commit = String(landed.length + 4).repeat(40);
      prepared!({ commit, base: 'dev', tip }); heads.set('dev', commit);
      return { commit, base: 'dev' };
    }, async (_cwd, args) => {
      if (args[1] === '--is-bare-repository') return 'false';
      const value = await git(args);
      assert.notEqual(value, null, `missing Git fact: ${args.join(' ')}`);
      return value!;
    });
  t.after(() => joinMergeCleanup(merges));
  const land = boundary.land;
  boundary.isLanded = entry => tracker.summary(entry.item)?.state === 'closed' && !!tracker.mergeReceipt(entry.item);
  boundary.land = async (entry, candidate) => {
    try {
      const result = await merges.merge(entry.item, entry.by, work => work(), undefined, () => {}, { head: entry.head, base: heads.get('dev')! });
      assert.ok('commit' in result, JSON.stringify(result));
      if (result.followUp) {
        await land(entry, candidate);
        throw new Error(result.followUp.error);
      }
    } catch (error) {
      // Match the hub boundary: base races rebuild; ordinary gate refusals drop.
      if (error instanceof MergeError && error.code === 'merge-changed' && /(?:batch|integration) base moved/.test(error.message)) throw new BatchRebuild(error.message);
      if (error instanceof MergeError && !['merge-recovery', 'merge-git', 'merge-unpublished', 'merge-checkout', 'merge-dirty'].includes(error.code)) throw new BatchRefusal(entry, error.message);
      throw error;
    }
    await land(entry, candidate);
  };
  if (movement === 'manual-follow-up') await f.clock.advance(600_000);
  await runner.tick();
  assert.equal(f.suites.status().length, 1, 'one batch suite submitted');
  const run = f.suites.status()[0]!;
  assert.equal(run.occasion, 'batch');
  assert.deepEqual(run.selection?.tiers, ['T1', 'T3']);
  assert.deepEqual(landed, [], 'no entry lands before green');
  assert.equal(runner.snapshot()?.members.length, movement === 'manual-follow-up' ? 1 : 3);
  await f.finish(run.id);
  if (movement === 'manual-follow-up') {
    const batch = runner.snapshot()!;
    const entry = entries[0]!;
    await assert.rejects(boundary.land(entry, batch.candidate!), /merged, follow-up failed: stop sessions:.*ps failed or timed out/);
    // Retain the state written by the pre-upgrade controller after that error.
    batch.failed = 'merged, follow-up failed: stop sessions: ps failed or timed out';
    f.store.setMeta('merge-batch', JSON.stringify(batch));
    followUpPending = false;
    const repaired = await merges.merge(entry.item, entry.by, work => work());
    assert.ok('commit' in repaired && !repaired.followUp, JSON.stringify(repaired));
    assert.equal(repaired.commit, tracker.mergeReceipt(entry.item)?.commit);
    entries.push(...[4, 5, 6].map(n => ({ ...entry, item: `T-${n}`, branch: `t/${n}` })));
    await runner.tick();
    assert.equal(runner.snapshot(), null);
    await runner.tick();
    assert.deepEqual(runner.snapshot()?.members.map(member => member.item), ['T-4', 'T-5', 'T-6']);
    assert.notEqual(runner.snapshot()?.run, run.id);
    assert.deepEqual(landed, ['T-1'], 'manual retry finishes follow-up without another landing');
    return;
  }
  if (movement === 'dirty') await writeFile(join(f.root, 'root-note.txt'), 'dirty');
  await runner.tick();
  if (movement === 'dirty') {
    assert.deepEqual(landed, []);
    assert.match(runner.snapshot()?.failed ?? '', /merge-dirty: uncommitted changes in root-note.txt/);
    assert.equal(runner.snapshot()?.run, run.id);
    await runner.tick();
    assert.deepEqual(landed, [], 'the root remains dirty');
    await writeFile(join(f.root, 'root-note.txt'), 'clean');
    await runner.tick();
  }
  if (movement === 'dev') await runner.tick();
  if (movement === 'task') {
    assert.deepEqual(headDrops, [`T-1: branch head changed or deleted; prepared head ${'1'.repeat(40)}, current head ${'f'.repeat(40)}`]);
    assert.equal(tracker.mergeReceipt('T-1'), null, 'the moved head never lands');
    const remainingRun = f.suites.status().at(-1)!;
    assert.notEqual(remainingRun.id, run.id);
    await f.finish(remainingRun.id); await runner.tick();
    assert.deepEqual(landed, ['T-2', 'T-3'], 'only the moved member is dropped');
    assert.equal(runner.snapshot(), null);
    return;
  }
  assert.deepEqual(dropped, [], 'integration movement must not drop an unchanged task head');
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3'], JSON.stringify(runner.snapshot()));
  assert.equal(f.suites.status().length, 1);
  assert.deepEqual(landed.map(id => tracker.mergeReceipt(id)?.commit), ['4'.repeat(40), '5'.repeat(40), '6'.repeat(40)]);
  assert.ok(landed.every(id => tracker.summary(id)?.state === 'closed'));
  assert.match(reports.join('\n'), /T-1, T-2, T-3.*tree code-complete.*T1, T3.*wall/s);
  assert.equal(runner.snapshot(), null);
  if (movement === 'follow-up') {
    assert.ok(mergeLogs.some(log => log.event === 'merge-follow-up-failed' && log.id === 'T-1' && log.step === 'stop sessions'));
    assert.match(reports.join('\n'), /T-1: merged, follow-up failed: stop sessions: cannot inspect the OS process table: ps failed or timed out/);
  }
  queue.stop(); await joinMergeCleanup(merges); await tracker.stop();
}

test('manual merge finishes a failed landed follow-up and the retained batch admits the next heads', t => queuedLanding(t, 'manual-follow-up'));

test('a ps-timeout follow-up is recorded and reported while the remaining heads land', t => queuedLanding(t, 'follow-up'));

test('three queued heads run once on a single candidate before landing FIFO', t => queuedLanding(t, 'none'));
test('a dirty root blocks then automatically lands the same green batch once clean', t => queuedLanding(t, 'dirty'));
for (const movement of ['dev', 'task'] as const) test(`queued heads handle ${movement} movement during preparation after green`, t => queuedLanding(t, movement));

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

for (const documentationOnly of [true, false]) test(`a green batch ${documentationOnly ? 'reuses its provider receipt for documentation' : 'reruns for a named code commit'}`, async t => {
  const state = await fixture(t);
  const { f, boundary, landed, entries, reports } = state;
  entries.splice(1);
  let dev = 'original-dev';
  const provider: BatchRepository = {
    git: async args => {
      if (args[0] === 'rev-parse') return args.at(-1) === 'refs/heads/dev' ? dev : entries[0]!.head;
      if (args[0] === 'merge-tree') return `${dev}-tree\0`;
      if (args[0] === 'commit-tree') return `${dev}-head`;
      if (args[0] === 'diff') {
        assert.deepEqual(args, ['diff', '--name-only', '-z', '--no-renames', 'original-dev-head', 'docs-commit-head', '--']);
        return documentationOnly ? '.cland/tasks/T-2.md\0qa/briefs/E-615.md\0docs/agents/tests.md\0' : 'hub/src/parser.ts\0';
      }
      if (args[0] === '--literal-pathspecs') return 'forcing-code-commit';
      throw new Error(`unexpected Git operation ${args}`);
    },
    facts: async () => ({ context: null, workers: 1 }),
    identity: async head => head.replace('-head', '-tree'),
    checkout: boundary.checkout, remove: boundary.cleanup,
  };
  boundary.build = (id, members, base) => prepareMergeBatch(f.root, id, members, {}, provider, base);
  boundary.rebuildReason = (tested, current) => batchRebuildReason(f.root, tested, current, {}, provider);
  const land = boundary.land;
  boundary.land = async (entry, candidate) => {
    assert.equal(candidate.base, 'docs-commit', 'land rebased onto the current dev');
    assert.equal(candidate.tree, 'docs-commit-tree');
    await land(entry, candidate);
  };
  await f.clock.advance(600_000);
  await state.runner.tick();
  const first = f.suites.status()[0]!;
  await f.machine.waits.run(f.machine.started(first.id));
  dev = 'docs-commit';
  await state.reopen();
  await f.finish(first.id); await state.runner.tick();
  if (!documentationOnly) {
    assert.deepEqual(landed, [], 'changed code cannot land under the old receipt');
    assert.match(reports.at(-1)!, /rebuild: commit forcing-code-commit changed batch test inputs: hub\/src\/parser.ts/);
    await state.runner.tick();
    const second = f.suites.status().at(-1)!;
    assert.notEqual(second.id, first.id);
    await f.finish(second.id); await state.runner.tick();
  }
  assert.deepEqual(landed, ['T-1']);
  assert.equal(f.suites.status().length, documentationOnly ? 1 : 2);
  assert.equal(f.suites.status()[0]!.tree, 'original-dev-tree', 'retained receipt is never relabeled');
  assert.equal(state.runner.snapshot(), null);
});

test('batch comparison uses the immediate merge allowlist and names the forcing commit', async () => {
  const candidate = (base: string): BatchCandidate => ({ base, head: `${base}-head`, tree: `${base}-tree`, cwd: '/isolated', budgetLines: [] });
  let paths: string[] = [];
  const provider: BatchRepository = {
    git: async args => {
      if (args[0] === 'diff') return paths.join('\0') + '\0';
      assert.deepEqual(args, ['--literal-pathspecs', 'log', '-1', '--format=%H', 'docs-tip', '^old', '--', paths[1]]);
      return 'forcing-code-commit';
    },
    facts: async () => ({ context: null, workers: 1 }), identity: async () => null, checkout: async () => {}, remove: async () => {},
  };
  const reason = () => batchRebuildReason('/isolated', candidate('old'), candidate('docs-tip'), {}, provider);
  for (const path of ['.cland/tasks/T-1.md', '.cland/RULES.md', 'qa/briefs/T-1.md', 'docs/agents/tests.md', 'GLOSSARY.md', 'hub/README.md']) {
    paths = [path];
    assert.equal(await reason(), null, path);
  }
  // --no-renames supplies both paths: moving docs into code must invalidate.
  for (const path of ['.cland/config.toml', '.cland/roles.toml', '.cland/unknown', '.agents/skills/test/SKILL.md', 'hub/src/parser.ts', 'hub/test/parser.test.ts', 'hub/test/tiers.json', 'package.json', 'unknown']) {
    paths = ['docs/old.md', path];
    assert.equal(await reason(), `commit forcing-code-commit changed batch test inputs: ${path}`, path);
  }
  provider.git = async () => { throw new Error('Git unavailable'); };
  await assert.rejects(reason, /Git unavailable/);
});

test('a landing base race retains the green run for the next comparison', async t => {
  const { f, runner, boundary, landed, move } = await fixture(t);
  const land = boundary.land;
  let raced = false;
  boundary.land = async (...args) => {
    if (!raced) { raced = true; move(true); throw new BatchRebuild('batch base moved before landing'); }
    await land(...args);
  };
  await runner.tick();
  const first = f.suites.status()[0]!;
  await f.finish(first.id); await runner.tick();
  assert.deepEqual(landed, []);
  assert.equal(runner.snapshot()?.run, first.id);
  await runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(f.suites.status().length, 1);
});

for (const code of ['merge-dirty', 'merge-checkout', 'merge-git', 'merge-unpublished', 'merge-recovery'] as const) test(`${code} retries after reopen without repeating completed members or the green suite`, async t => {
  const state = await fixture(t);
  const { f, boundary, landed, dropped, reports } = state;
  const land = boundary.land;
  let blocked = true;
  boundary.land = async (entry, candidate) => {
    if (entry.item === 'T-2' && blocked) throw new MergeError(code, 'fixture landing obstruction');
    return land(entry, candidate);
  };
  await state.runner.tick();
  const original = f.suites.status()[0]!;
  await f.finish(original.id); await state.runner.tick();
  assert.deepEqual(landed, ['T-1']);
  assert.match(reports.at(-1)!, new RegExp(`${code}: fixture landing obstruction`));
  assert.match(reports.at(-1)!, /queue retries automatically/i);
  await state.reopen(); await state.runner.tick();
  assert.deepEqual(landed, ['T-1'], 'the cause still blocks landing after reopen');
  assert.equal(state.runner.snapshot()?.run, original.id);
  assert.deepEqual(dropped, []);
  blocked = false;
  await state.runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.deepEqual(dropped, []);
  assert.equal(f.suites.status().length, 1, 'retry reuses the original green receipt');
  assert.equal(state.runner.snapshot(), null);
});

test('an untyped landing failure stays blocked across reopen and requests human or Coordinator action', async t => {
  const state = await fixture(t);
  const { f, boundary, landed, reports } = state;
  const land = boundary.land;
  // Text resembling a recoverable code is not a typed recoverable landing.
  boundary.land = async () => { throw new Error('merge-dirty: unexpected landing invariant'); };
  await state.runner.tick();
  const original = f.suites.status()[0]!;
  await f.finish(original.id); await state.runner.tick();
  assert.match(reports.at(-1)!, /merge-dirty: unexpected landing invariant/);
  assert.match(reports.at(-1)!, /Waiting for human or Coordinator action/);
  assert.doesNotMatch(reports.at(-1)!, /retries automatically/);
  boundary.land = land;
  await state.reopen(); await state.runner.tick(); await state.runner.tick();
  assert.deepEqual(landed, []);
  assert.match(state.runner.snapshot()?.failed ?? '', /unexpected landing invariant/);
  assert.equal(f.suites.status().length, 1);
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
  assert.deepEqual(parseConfig('', 'batch').merge, { batchInteraction: 'report', queue: false, batch: 3, batchWaitMs: 600_000, batchTiers: ['T1', 'T3'] });
  const config = parseConfig('[merge]\nqueue=true\nbatch=2\nbatch_wait="30s"', 'batch');
  assert.deepEqual(parseConfig(renderConfig(config), 'batch').merge, { batchInteraction: 'report', queue: true, batch: 2, batchWaitMs: 30_000, batchTiers: ['T1', 'T3'] });
  for (const batch of ['0', '-1', '1.5', '"3"']) assert.throws(() => parseConfig(`[merge]\nbatch=${batch}`, 'batch', {}, { strict: true }), /positive integer/);
  for (const invalid of ['[]', '["T5"]', '["T1","T1"]', '"T1"']) assert.throws(() => parseConfig(`[merge]\nbatch_tiers=${invalid}`, 'batch'), /batch_tiers/);
  for (const role of [null, 'coordinator', 'qa', 'implementer']) assert.throws(() => authorizeVerifyOccasion(role, 'batch'), /hub-owned/);
});


test('batch load gate repeats only new T3 identities', () => {
  const selection = { mode: 'full' as const, files: [], reason: 'batch', loadGateFiles: ['hub/test/integration.test.ts'], loadGateBaseline: { run: 'previous', tests: ['hub/test/integration.test.ts::known'] } };
  assert.equal(loadGateRepetitions('hub/test/unit.test.ts::new', selection, {}), 0);
  assert.equal(loadGateRepetitions('hub/test/integration.test.ts::known', selection, {}), 0);
  assert.equal(loadGateRepetitions('hub/test/integration.test.ts::new', selection, {}), 5);
});

for (const source of ['stage', 'batch'] as const) test(`batch retains the latest green ${source} T3 baseline after a T1-only batch`, async t => {
  const scope = caseDeadlines(t);
  await scope.wait('baseline setup and body', async () => {
    const state = await fixture(scope.fixtures);
    const { f, reports } = state;
    const unit = 'hub/test/unit.test.ts', process = 'hub/test/process.test.ts', moved = 'hub/test/moved.test.ts';
    for (const file of [unit, process, moved]) await writeFile(join(f.root, file), '');
    await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [unit]: 'T1', [process]: 'T3', [moved]: 'T3' } }));
    const seed = await f.launch(); await f.finish(seed.id);
    const original = (await f.suites.receipt(seed.id)).job;
    const row = (tier: 'T1' | 'T3', file: string) => ({ tier, files: [file], tests: 1, seconds: 0.01, projectedWall: 0.01, workers: 1, missing: 0 });
    const stage = { ...original, id: 'older-stage', sequence: 1, occasion: 'stage' as const, branch: 'dev', integrated: true,
      selection: { mode: 'full' as const, files: [], reason: 'recorded stage' }, tierPlan: [row('T1', unit), row('T3', process)], timingIdentities: [`${unit}::old`, `${process}::old`] };
    const batch = { ...stage, id: 'green-T3-batch', sequence: 2, occasion: 'batch' as const, batch: { id: 'prior', members: [] }, timingIdentities: [`${process}::old`, `${process}::batch addition`] };
    const narrow = { ...batch, id: 'newer-T1-only', sequence: 3, tierPlan: [{ ...row('T1', unit), files: [unit, moved] }], timingIdentities: [`${unit}::new`, `${moved}::moved from T1`] };
    // Red per-file fencing is covered separately; this case isolates tier migration.
    await f.reopen([stage, ...(source === 'batch' ? [batch] : []), narrow]);
    await state.reopen();
    await state.runner.tick();
    const job = (await f.jobs()).at(-1)!;
    const selection = job.selection!;
    assert.equal(loadGateRepetitions(`${process}::old`, selection, {}), 0);
    assert.equal(loadGateRepetitions(`${process}::added`, selection, {}), 5);
    assert.equal(loadGateRepetitions(`${process}::batch addition`, selection, {}), source === 'batch' ? 0 : 5);
    assert.equal(loadGateRepetitions(`${moved}::moved from T1`, selection, {}), 5, 'the current T3 baseline cannot borrow an identity from prior T1');
    assert.deepEqual(job.batchBaselineRuns, { T1: narrow.id, T3: source === 'batch' ? batch.id : stage.id });
    await f.finish(job.id, 0, `suite timing ${JSON.stringify({ file: process, name: 'old', seconds: 0.01 })}\nload gate: ${process}::added 5/5 passed\n# tests 1\n# pass 1\n`);
    await state.runner.tick();
    assert.match(reports[0]!, new RegExp(`load gate baselines T1=${narrow.id}, T3=${source === 'batch' ? batch.id : stage.id}`));
    assert.match(reports[0]!, /repeated identities 1/);
  });
});

for (const tiers of [undefined, ['T1']] as const) test(`batch runs configured tiers ${tiers ?? 'default' } and lands on green`, async t => {
  const { f, runner, landed, reports } = await fixture(t);
  if (tiers) f.configure('[verification]\ntest="true"\nexecutor="droplet"\n[merge]\nbatch_tiers=["T1"]');
  const tests = { 'hub/test/unit.test.ts': 'T1', 'hub/test/component.test.ts': 'T2', 'hub/test/process.test.ts': 'T3' } as const;
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  for (const file of Object.keys(tests)) await writeFile(join(f.root, file), '');
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests }));
  await runner.tick();
  const job = (await f.jobs())[0]!;
  assert.deepEqual(job.selection?.tiers, tiers ?? ['T1', 'T3']);
  assert.deepEqual(job.tierPlan?.map(row => row.tier), tiers ?? ['T1', 'T3']);
  const phases = await packageShards(f.root, 'full', undefined, job.selection, { workers: 1 });
  assert.deepEqual(phases.flatMap(phase => phase.targets).sort(), tiers ? ['hub/test/unit.test.ts'] : ['hub/test/process.test.ts', 'hub/test/unit.test.ts']);
  assert.deepEqual(landed, []);
  await f.finish(job.id); await runner.tick();
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(reports[0]!.split('; ').find(field => field.startsWith('tiers ')), tiers ? 'tiers T1' : 'tiers T1, T3');
  assert.match(reports[0]!, /log A-\d+: /);
  assert.match(reports[0]!, /batch interaction.*\"mode\":\"report\"/);
  assert.match(reports[0]!, /\"selectedFileCount\":0/);
});

test('merge batches form and land while periodic culprit search awaits its runner', async t => {
  const { DevT3Search } = await import('../src/hub/dev-t3-search.ts');
  const { f, runner, entries, landed } = await fixture(t);
  const started = Promise.withResolvers<void>(), release = Promise.withResolvers<null>();
  let completed = false;
  const search = new DevT3Search(f.store, { currentDev: async () => 'landed', probe: async () => { started.resolve(); return release.promise; }, report: async () => { completed = true; } });
  search.accept({ event: 'verification-dev-t3-result', run: 'periodic', head: 'landed', tree: 'tree', previousGreenHead: 'green', previousGreenRun: 'green-run', merges: [{ head: 'landed', subject: 'Merge' }], result: 'red', failingFiles: ['hub/test/example.test.ts'], artifact: 'A-1', path: '/log' });
  const pending = search.tick();
  t.after(async () => { release.resolve(null); await pending; await search.close(f.clock); });
  await started.promise;
  for (let batch = 0; batch < 2; batch++) {
    if (batch) entries.push(...[4, 5, 6].map(n => ({ item: `T-${n}`, branch: `t/${n}`, head: `${n}`.repeat(40), verdictBase: 'dev', enqueued: f.clock.now().toISOString(), by: { id: 'coord', name: 'coord', role: 'coordinator' } })));
    await runner.tick();
    const run = f.suites.status().at(-1)!;
    assert.equal(run.occasion, 'batch');
    await f.finish(run.id); await runner.tick();
    assert.equal(landed.length, (batch + 1) * 3);
    assert.equal(runner.snapshot(), null);
    assert.equal(completed, false, 'both batches land before the search runner is released');
  }
  release.resolve(null); await pending;
});

test('batch refuses a bare project before reading refs or writing candidate objects', async () => {
  const calls: string[][] = [];
  const unexpected = async (): Promise<never> => { throw new Error('bare root reached candidate preparation'); };
  const repository: BatchRepository = {
    git: async args => { calls.push(args); return 'true'; },
    facts: unexpected, identity: unexpected, checkout: unexpected, remove: unexpected,
  };
  await assert.rejects(prepareMergeBatch('/scratch/project', 'bare-root', [], {}, repository), {
    code: 'merge-bare', message: "merge-bare: core.bare=true in project root /scratch/project; inspect the shared Git config, then restore the worktree with git -C '/scratch/project' config --local core.bare false before retrying",
  });
  assert.deepEqual(calls, [['rev-parse', '--is-bare-repository']]);
});

for (const devConflict of [false, true]) test(`persisted batch conflict drop names ${devConflict ? 'dev recovery' : 'the pinned queued member and paths'}`, async t => {
  const { f, entries, boundary, runner, dropped } = await fixture(t);
  const first = entries[0]!, second = entries[1]!;
  const conflict = () => new TerritoryGitError('native merge conflict', 'conflicted-tree\0parser.txt\0\0', 1);
  const git: BatchRepository['git'] = async args => {
    if (args[0] === 'rev-parse') return args[1] === '--is-bare-repository' ? 'false'
      : args[1] === 'refs/heads/dev' ? 'dev-base' : entries.find(e => `refs/heads/${e.branch}` === args[1])!.head;
    if (args[0] === 'merge-tree') {
      const left = args.at(-2), right = args.at(-1);
      if (right === second.head && (devConflict || left !== 'dev-base')) throw conflict();
      return `tree-${right}\0`;
    }
    if (args[0] === 'commit-tree') return `commit-${args[1]}`;
    throw new Error(`unexpected Git mutation: ${args[0]}`);
  };
  boundary.build = (id, members, base) => prepareMergeBatch(f.root, id, members, {}, {
    git, facts: async () => ({ context: null, workers: 1 }), identity: async () => 'candidate-tree',
    checkout: boundary.checkout, remove: boundary.cleanup,
  }, base);
  await runner.tick();
  assert.equal(dropped.length, 1);
  assert.ok(dropped[0]!.startsWith(`${second.item}: merge-conflict:`));
  assert.match(dropped[0]!, /parser.txt/);
  if (devConflict) assert.ok(dropped[0]!.includes(`rebase ${second.branch} on dev`));
  else {
    assert.ok(dropped[0]!.includes(first.item), dropped[0]);
    assert.ok(dropped[0]!.includes(first.head), dropped[0]);
    assert.doesNotMatch(dropped[0]!, /rebase .* on dev/);
  }
  assert.deepEqual(entries.map(e => e.item), [first.item, 'T-3']);
});


test('batch interaction notice bounds paths and groups fallback causes without changing full evidence', () => {
  const files = Array.from({ length: 300 }, (_, i) => `web/test/example-${i}.test.ts`);
  const report = { mode: 'report' as const, files, phases: ['Web' as const], reason: files.map(file => `${file} fallback: Error: incomplete import graph: unsupported createRequire base [hub/src/web-readiness.ts]`).join('; ') + '; T2 phase fallback: Error: TypeScript parser unavailable: hub/test/other.test.ts' };
  const summary = batchInteractionSummary(report);
  assert.deepEqual(summary, { mode: 'report', phases: ['Web'], selectedFileCount: 300, fallbackCounts: { 'incomplete import graph: unsupported createRequire base': 300, 'TypeScript parser unavailable': 1 }, examples: files.slice(0, 10) });
  assert.equal(report.files.length, 300);
  assert.ok(report.reason.includes(files[299]!));
  assert.equal(batchInteractionSummary({ ...report, files: null }).selectedFileCount, null);
  assert.equal(batchInteractionSummary(undefined).selectedFileCount, null);
});

import { TerritoryBusy } from '../src/territory-lock-context.ts';
for (const phase of ['build', 'land'] as const) test(`territory contention during ${phase} retries automatically using the same green receipt`, async t => {
  const state = await fixture(t);
  const { f, boundary, landed } = state;
  let blocked = true;
  if (phase === 'build') {
    const build = boundary.build;
    boundary.build = async (...args) => { if (blocked) throw new TerritoryBusy('host push in flight'); return build(...args); };
  } else {
    const land = boundary.land;
    boundary.land = async (...args) => { if (blocked) throw new TerritoryBusy('host push in flight'); return land(...args); };
  }
  await state.runner.tick();
  if (phase === 'land') { await f.finish(f.suites.status()[0]!.id); await state.runner.tick(); }
  assert.equal(state.runner.snapshot()?.retryLanding, true);
  assert.deepEqual(landed, []);
  blocked = false;
  await state.reopen(); await state.runner.tick();
  if (phase === 'build') { await f.finish(f.suites.status()[0]!.id); await state.runner.tick(); }
  assert.deepEqual(landed, ['T-1', 'T-2', 'T-3']);
  assert.equal(f.suites.status().length, 1);
});
