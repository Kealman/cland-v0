// T1: batch policy at the durable controller/Suites seam, FakeClock and in-process executor receipts.
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Tracker } from '../src/tracker/tracker.ts';
import { TaskMerges } from '../src/hub/merge.ts';
import { MergeError } from '../src/merge.ts';
import { MergeQueue } from '../src/hub/merge-queue.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MergeBatches, BatchRefusal, BatchRebuild, diagnosticResult, type BatchBoundary, type BatchCandidate } from '../src/hub/merge-batches.ts';
import type { MergeQueueEntry } from '../src/protocol.ts';
import type { TopicNotice } from '../src/hub/core.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { prepareMergeBatch, batchRebuildReason, type BatchRepository } from '../src/hub/merge-batch-territory.ts';
import { recordBatchFlakes } from '../src/hub/batch-flakes.ts';
import { loadGateRepetitions } from '../src/suite-load-gate-plan.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { authorizeVerifyOccasion } from '../src/verification-occasion.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { selectionFromEnv, selectionTransport } from '../src/suite-selection.ts';
import { packageShards, serializeTierManifest } from '../src/suite-shards.ts';

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

async function fixture(t: Parameters<typeof suiteUnit>[0]) {
  const f = await suiteUnit(t, { executor: 'droplet' });
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
  return { f, entries, landed, reports, dropped, boundary, get runner() { return runner; }, move(trackerOnly: boolean) { base += '-moved'; if (!trackerOnly) code += '-changed'; }, async reopen() { await runner.close(); await f.reopen(); runner = new MergeBatches(f.store, f.suites, f.clock, boundary, () => ({ queue: true, batch: 3, batchWaitMs: 600_000 })); } };
}

const failureLog = 'suite test failures [{"file":"hub/test/example.test.ts","name":"rejects stale input"}]\n# tests 1\n# fail 1\n';
const passLog = 'suite progress {"event":"finish","id":"one","file":"hub/test/example.test.ts","name":"rejects stale input","at":1,"nesting":0,"outcome":"pass","seconds":0.01}\nsuite test failures []\n# tests 1\n# pass 1\n';
const t0Green = 'tier T0: exit 0; duration 1 s; output tail: static checks passed\n';
const t0Red = 'tier T0: exit 2; duration 1 s; output tail: error TS2344\n';

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

for (const path of ['unique omission', 'passing repeat']) test(`T1 ${path} confirms the original Web plan before landing`, async t => {
  const state = await fixture(t);
  const { f, entries, boundary, landed } = state;
  entries.splice(2);
  await webBatch(f);
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
  await f.finish(original.id, 1, t0Green + 'tier T1: exit 1; duration 1 s; output tail: unit failed\n' + failureLog);
  await state.runner.tick();
  for (let index = 0; index < (path === 'unique omission' ? 2 : 3); index++) {
    const job = f.suites.status().at(-1)!;
    assert.deepEqual(job.batch?.diagnostic?.files, ['hub/test/example.test.ts'], state.runner.snapshot()?.failed);
    assert.equal(job.batch?.diagnostic?.steps, undefined, 'T1 stopped execution before Web');
    const red = path === 'unique omission' && index === 1;
    await f.finish(job.id, red ? 1 : 0, red ? failureLog : passLog);
    await state.runner.tick();
  }
  assert.deepEqual(landed, [], 'green file diagnostics supply no Web proof');
  const selected = state.runner.snapshot()!.candidate!;
  await state.runner.tick();
  const confirmation = f.suites.status().at(-1)!;
  assert.equal(confirmation.batch?.diagnostic, undefined);
  assert.equal(confirmation.head, selected.head); assert.equal(confirmation.tree, selected.tree);
  await f.finish(confirmation.id, 0, t0Green + passLog + 'tier T1: exit 0; duration 1 s; output tail: unit passed\ntier Web: exit 0; duration 2 s; output tail: web passed\n');
  assert.deepEqual((await f.suites.receipt(confirmation.id)).job.commands?.plan?.map(step => step.name), ['check', 'T1', 'Web']);
  await state.runner.tick();
  assert.deepEqual(landed, path === 'unique omission' ? ['T-2'] : ['T-1', 'T-2']);
});

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
  assert.deepEqual(landed, ['T-1']);
  assert.equal(runner.snapshot(), null);
  assert.equal(f.suites.status().length, 3);
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
  assert.deepEqual(landed, ['T-1', 'T-3']);
  assert.equal(runner.snapshot(), null, 'diagnosis completes instead of holding an inconclusive batch');
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

async function queuedLanding(t: Parameters<typeof suiteUnit>[0], movement: 'none' | 'dev' | 'task' | 'dirty') {
  const { f, runner, landed, reports, boundary, entries, dropped } = await fixture(t);
  let moved = false;
  if (movement === 'dirty') await writeFile(join(f.root, 'root-note.txt'), 'clean');
  // Exercise the real receipt and finishMerge path with Git represented by
  // immutable object/ref facts. Worktree removal returns an OS-edge receipt.
  const heads = new Map(entries.map(entry => [entry.branch, entry.head])); heads.set('dev', 'a'.repeat(40));
  const git = async (args: string[]) => {
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
  const merges = new TaskMerges(tracker, worktrees, () => {}, undefined, {}, async (_root, operation) => operation(), queue,
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
  t.after(() => merges.stop());
  const land = boundary.land;
  boundary.land = async (entry, candidate) => {
    try {
      const result = await merges.merge(entry.item, entry.by, work => work(), undefined, () => {}, { head: entry.head, base: heads.get('dev')! });
      assert.ok('commit' in result && !result.followUp, JSON.stringify(result));
    } catch (error) {
      // Match the hub boundary: base races rebuild; ordinary gate refusals drop.
      if (error instanceof MergeError && error.code === 'merge-changed' && /(?:batch|integration) base moved/.test(error.message)) throw new BatchRebuild(error.message);
      if (error instanceof MergeError && !['merge-recovery', 'merge-git', 'merge-unpublished', 'merge-checkout', 'merge-dirty'].includes(error.code)) throw new BatchRefusal(entry, error.message);
      throw error;
    }
    await land(entry, candidate);
  };
  await runner.tick();
  assert.equal(f.suites.status().length, 1, 'one batch suite submitted');
  const run = f.suites.status()[0]!;
  assert.equal(run.occasion, 'batch');
  assert.deepEqual(run.selection?.tiers, ['T1', 'T3']);
  assert.deepEqual(landed, [], 'no entry lands before green');
  assert.equal(runner.snapshot()?.members.length, 3);
  await f.finish(run.id);
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
  queue.stop(); merges.stop(); await tracker.stop();
}

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
  assert.deepEqual(parseConfig('', 'batch').merge, { queue: false, batch: 3, batchWaitMs: 600_000, batchTiers: ['T1', 'T3'] });
  const config = parseConfig('[merge]\nqueue=true\nbatch=2\nbatch_wait="30s"', 'batch');
  assert.deepEqual(parseConfig(renderConfig(config), 'batch').merge, { queue: true, batch: 2, batchWaitMs: 30_000, batchTiers: ['T1', 'T3'] });
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
