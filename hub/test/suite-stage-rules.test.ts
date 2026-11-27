// T1: stage-cache supersession at Suites; semantic worker/report receipts use a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeVerifyOccasion } from '../src/verification-occasion.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { flakyReceiptCase as suiteCase, ownedSuiteUnit, filedWebIdentity, finishFiledWebRepeats } from './flaky-receipt-fixture.ts';
import { stageCase } from './stage-case-fixture.ts';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { LocalExecutor } from '../src/executor/local.ts';
import { stat, mkdir } from 'node:fs/promises';
import { loadGateRepetitions } from '../src/suite-load-gate-plan.ts';
import { StageCandidates } from '../src/tracker/stage-candidates.ts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { suiteStartIssues } from '../src/protocol.ts';
import { suiteSummary } from '../src/hub/suites.ts';

for (const path of ['fallback', 'sharded', 'override', 'fits', 'restart', 'legacy', 'custom', 'task', 'busy', 'race', 'race-size', 'race-workers', 'race-both', 'race-custom'] as const) test(`full run admission chooses ${path} from capacity and projection`, t => suiteCase(t, async ({ setup, step }) => {
  const race = path.startsWith('race');
  const custom = path === 'custom' || path === 'race-custom';
  let refuseAcquisition = race;
  const sizeOverride = path === 'override' || path === 'race-size' || path === 'race-both';
  const workersOverride = path === 'override' || path === 'race-workers' || path === 'race-both';
  const attempts: Array<string | undefined> = [];
  const f = await setup(async fixtures => {
    const f = await ownedSuiteUnit(t, fixtures, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true }, custom ? 'shard_wait="3m"\n[verification.droplet]\nfallback_size="c-8"\nfallback_workers=3' : path === 'busy' ? 'stall_timeout="60m"' : race ? '[verification.droplet]\nworkers=2' : '');
    if (race) {
      const acquire = DropletExecutor.prototype.acquire;
      fixtures.mock.method(DropletExecutor.prototype, 'acquire', async function (this: DropletExecutor, ...args: Parameters<typeof acquire>) {
        attempts.push(args[0].size ?? args[3]?.verification.droplet.size);
        if (refuseAcquisition) throw new RemoteBudgetFull();
        return acquire.apply(this, args);
      });
    }
    return f;
  });
  const blocker = path === 'busy' ? await step('occupy remote slot', () => f.launch({ fresh: true })) : undefined;
  if (blocker) await step('observe occupying worker', () => f.machine.waits.run(f.machine.started(blocker.id)));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await step('write projected test', () => writeFile(join(f.root, 'hub/test/slow.test.ts'), ''));
  await step('write projected tiers', () => writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { 'hub/test/slow.test.ts': 'T3' } })));
  await step('write duration baseline', () => writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { mode: 'report', testSeconds: 5, fileSeconds: 60 }, tests: {}, allow: {}, files: { 'hub/test/slow.test.ts': { tests: 1, seconds: path === 'fits' ? 4500 : 5000 } } })));
  f.candidate.tierPlan = [{ tier: 'T3', files: ['hub/test/slow.test.ts'], tests: 1, seconds: 5000, projectedWall: 5000, workers: 4, missing: 0 }];
  const run = await step('queue full close', () => f.launch({ mode: 'all', ...(path === 'task' ? {} : { integrated: true, occasion: 'stage' as const }), fresh: true, ...(sizeOverride ? { size: 'c-8' } : {}), ...(workersOverride ? { workers: 3 } : {}) }));
  await step('settle admission decision', () => f.suites.settled());
  if (path === 'fits') {
    await step('observe fitting worker', () => f.machine.waits.run(f.machine.started(run.id)));
    assert.equal(f.acquisitions.length, 1);
    await step('complete fitting run', () => f.finish(run.id));
    assert.doesNotMatch(await step('read fitting log', () => f.log(run.id)), /sharding decision:/);
    return;
  }
  assert.equal(f.status(run.id).state, 'queued');
  assert.equal(f.acquisitions.length, blocker ? 1 : 0);
  if (path === 'restart') await step('restore waiting run', () => f.reopen());
  if (path === 'legacy') {
    const saved = await step('read retained admission', () => f.jobs());
    const retained = saved.find(row => row.id === run.id)!;
    Reflect.deleteProperty(retained.config!.verification, 'shardWaitMs');
    Reflect.deleteProperty(retained.config!.verification.droplet, 'fallback_size');
    Reflect.deleteProperty(retained.config!.verification.droplet, 'fallback_workers');
    retained.config!.verification.dailySpendUsd = 7.25;
    await step('restore pre-policy admission snapshot', () => f.reopen(saved));
  }
  await step('advance below shard deadline', () => f.tick((custom ? 2 : 19) * 60 * 1000));
  await step('settle waiting admission', () => f.suites.settled());
  assert.equal(f.acquisitions.length, blocker ? 1 : 0);
  if (path === 'sharded') {
    await step('release second remote slot', async () => { f.configure('[verification]\nexecutor="droplet"\nremote_budget=2'); await f.tick(1000); await f.suites.settled(); });
    const parent = (await step('read shard plan', () => f.jobs())).find(row => row.id === run.id)!;
    assert.equal(parent.shards!.length, 2);
    for (const shard of parent.shards!) {
      await step('observe shard worker', () => f.machine.waits.run(f.machine.started(shard.id)));
      f.machine.finish(shard.id, 0, '# tests 1\n# pass 1\n');
    }
    await step('collect shard receipts', async () => { await f.tick(5000); await f.suites.settled(); });
    assert.match(await step('read sharded policy log', () => f.log(run.id)), /sharded after a wait of 1141s; projection 5000/);
    return;
  }
  await step('advance to shard deadline', () => f.tick(60 * 1000));
  await step('settle fallback admission', () => f.suites.settled());
  if (race) {
    assert.ok(attempts.length > 0, 'observe acquire-time capacity refusal');
    assert.equal(f.status(run.id).state, 'queued');
    await step('restore refused acquisition', () => f.reopen());
    if (path === 'race-custom') f.configure('[verification]\nexecutor="droplet"\nremote_budget=1\n[verification.droplet]\nworkers=2\nfallback_size="c-16"\nfallback_workers=4');
    refuseAcquisition = false;
    await step('retry selected fallback', async () => { await f.tick(1000); await f.suites.settled(); });
  }
  if (blocker) {
    assert.equal(f.status(run.id).state, 'queued');
    assert.equal(f.status(run.id).executor, 'droplet');
    await step('release occupied remote slot', () => f.finish(blocker.id));
    await step('admit queued fallback remotely', async () => { await f.tick(1000); await f.suites.settled(); });
  }
  await step('observe fallback worker', () => f.machine.waits.run(f.machine.started(run.id)));
  const job = f.status(run.id);
  assert.equal(job.executor, 'droplet');
  assert.equal(job.workers, workersOverride || custom ? 3 : 4);
  assert.equal(f.config.verification.droplet.size, 'c-8', 'fallback never mutates the loaded defaults');
  assert.equal((await step('read pinned fallback config', () => f.jobs())).find(row => row.id === run.id)!.config!.verification.droplet.size, sizeOverride || custom ? 'c-8' : 'c-16');
  if (race) assert.deepEqual(attempts, attempts.map(() => sizeOverride || custom ? 'c-8' : 'c-16'));
  if (path === 'legacy') assert.equal((await step('read retained spend cap', () => f.jobs())).find(row => row.id === run.id)!.config!.verification.dailySpendUsd, 7.25);
  await step('complete fallback', () => f.finish(run.id));
  const result = await step('read terminal decision', () => import('node:fs/promises').then(fs => fs.readFile(join(f.root, '.cland/run/suites', run.id, 'result.json'), 'utf8')));
  assert.equal(JSON.parse(result).shardWait.path, 'fallback');
  assert.equal(JSON.parse(result).code, 0);
  assert.match(await step('read policy log', () => f.log(run.id)), /fallback c-(8|16).*wait of (1200|180)s; projection 5000/);
  assert.match(suiteSummary(await step('read result summary input', () => f.log(run.id))), /sharding decision: fallback/);
}));

test('stage selectors are additive to legacy verification frames and require unique epic ids', () => {
  const legacy = { id: 'request', cwd: '/scratch', mode: 'all', occasion: 'stage', executor: 'local' };
  assert.deepEqual(suiteStartIssues(legacy), []);
  assert.deepEqual(suiteStartIssues({ ...legacy, stages: ['E-1', 'E-2'] }), []);
  for (const stages of [[], ['E-1', 'E-1'], ['bad'], 'E-1']) assert.ok(suiteStartIssues({ ...legacy, stages }).length);
  assert.ok(suiteStartIssues({ ...legacy, occasion: 'epic', stages: ['E-1'] }).length);
});

test('targeted Mac stages pin their union and publish separate exact-path receipts', t => suiteCase(t, async ({ setup, step }) => {
  const f = await setup(fixtures => ownedSuiteUnit(t, fixtures, { machineReceiptsOnly: true }, 'test_unit="unit"\ntest_soak="soak"'));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const files = ['hub/test/example.test.ts', 'hub/test/second.test.ts', 'web/test/browser.test.ts'];
  await step('prepare targeted Web directory', () => mkdir(join(f.root, 'web/test'), { recursive: true }));
  await step('declare Web-capable runner', () => writeFile(join(f.root, 'hub/test/run-suite.ts'), '// inheritedLease; supportsWebPhase = true'));
  for (const file of files) await step('write targeted fixture', () => writeFile(join(f.root, file), ''));
  await step('write unrelated Web fixture', () => writeFile(join(f.root, 'web/test/unrelated.test.ts'), ''));
  await step('declare targeted fixture tier', () => writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [files[0]!]: 'T1', [files[1]!]: 'T4', [files[2]!]: 'Web', 'web/test/unrelated.test.ts': 'Web' } })));
  const targets = [{ epic: 'E-1', stage: 'first', files: [files[0]!] }, { epic: 'E-2', stage: 'second', files }];
  const run = await step('admit targeted Mac stage union', () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', executor: 'local', stageTargets: targets, fresh: true }));
  const admitted = (await step('read pinned targets', () => f.jobs())).find(job => job.id === run.id)!;
  assert.deepEqual(admitted.selection!.files, files);
  assert.deepEqual(admitted.selection!.stageTargets, targets);
  assert.equal(admitted.selection!.soak, true, 'explicit Mac targets include their T4 files');
  await step('record targeted worker completion', () => f.finish(run.id, 0, '', true, verificationSteps(admitted.commands!).map(row => tierReceipt(admitted, row, 0))));
  const receipts = f.suites.stageCovers().filter(cover => cover.id === run.id);
  assert.deepEqual(receipts.map(cover => cover.target), targets.map(({ epic, stage }) => ({ epic, stage })));
  assert.deepEqual(receipts.map(cover => cover.files), [[files[0]!], files]);
  assert.ok(receipts.every(cover => cover.tree === f.candidate.tree));
  const stored = await step('read completed target ownership', () => f.jobs());
  const producer = stored.find(job => job.id === run.id)!;
  producer.tierReceipts = [];
  await step('reopen missing producer receipts', () => f.reopen(stored));
  assert.ok(!f.suites.stageCovers().some(cover => cover.id === run.id));
}));
import { tierReceipt } from '../src/verification-tier-receipts.ts';
import { verificationSteps } from '../src/verification-plan.ts';
import { packageShards, serializeTierManifest } from '../src/suite-shards.ts';
import { DropletExecutor, RemoteBudgetFull } from '../src/executor/droplet/droplet.ts';

for (const constructionFailure of [false, true]) test(`flaky receipt cleanup retains its root and controls until ${constructionFailure ? 'failed construction' : 'resource'} database close is confirmed`, t => {
  const supervisor = stageCase(t);
  return supervisor.run(async () => {
    const hooks: Array<() => unknown> = [];
    const nested = new Proxy(t, { get(target, key) {
      if (key === 'after') return (hook: () => unknown) => hooks.push(hook);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const dispose = () => supervisor.wait('nested registered cleanup', async () => { for (const hook of hooks) await hook(); });
    let connection: DatabaseSync | undefined, root = '', refuse = true, closed = false;
    const failure = new Error('controlled suite store construction failure');
    const outerBoundary = supervisor.nativeBoundary(), originalAcquire = LocalExecutor.prototype.acquire;
    supervisor.requireClose(async () => {
      refuse = false;
      await dispose();
    });
    const starting = suiteCase(nested, async ({ setup }) => {
      await setup(fixtures => ownedSuiteUnit(nested, fixtures, { onRoot: value => { root = value; }, openDatabase: path => {
        const db = connection = new DatabaseSync(path), close = db.close.bind(db), executeSql = db.exec.bind(db);
        db.exec = sql => { if (constructionFailure && sql.includes('journal_mode')) throw failure; executeSql(sql); };
        db.close = () => {
          if (refuse) throw new Error('controlled suite database close refusal');
          assert.equal(fs.statSync(root).isDirectory(), true, 'native close precedes guarded root disposal');
          close(); closed = true;
        };
        return db;
      } }));
    });
    if (constructionFailure) await assert.rejects(starting, error => {
      let cause: unknown = error;
      while (cause instanceof Error && cause !== failure) cause = cause.cause;
      return cause === failure;
    });
    else await starting;
    assert.ok(connection);
    const heldBoundary = supervisor.nativeBoundary(), heldAcquire = LocalExecutor.prototype.acquire;
    assert.notEqual(heldBoundary, outerBoundary);
    assert.notEqual(heldAcquire, originalAcquire);
    await assert.rejects(dispose(), /controlled suite database close refusal/);
    assert.equal(connection.isOpen, true);
    assert.equal((await stat(root)).isDirectory(), true);
    assert.equal(supervisor.nativeBoundary(), heldBoundary);
    assert.equal(LocalExecutor.prototype.acquire, heldAcquire);
    refuse = false;
    await dispose();
    assert.equal(connection.isOpen, false, 'captured native handle positively closed');
    assert.equal(closed, true);
    await assert.rejects(stat(root), { code: 'ENOENT' });
    assert.equal(supervisor.nativeBoundary(), outerBoundary);
    assert.equal(LocalExecutor.prototype.acquire, originalAcquire);
  });
});

test('a filed Web cover stays red with a named refusal after five passing repeats', t => suiteCase(t, async ({ setup, step }) => {
  const f = await setup(fixtures => ownedSuiteUnit(t, fixtures, { machineReceiptsOnly: true, flakyOwners: () => ({ [filedWebIdentity]: 'T-4' }) }, 'test_unit="unit"'));
  await step('write Web runner marker', () => writeFile(join(f.root, 'hub/test/run-suite.ts'), '// inheritedLease; supportsWebPhase = true'));
  await step('create Web fixture directory', () => mkdir(join(f.root, 'web/test'), { recursive: true }));
  for (const file of ['hub/test/example.test.ts', 'web/test/smoke.test.ts']) await step('write selected Web fixture', () => writeFile(join(f.root, file), ''));
  await step('declare Web fixture tiers', () => writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { 'hub/test/example.test.ts': 'T1', 'web/test/smoke.test.ts': 'Web' } })));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const run = await step('admit Web cover', () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', workers: 1, fresh: true }));
  await finishFiledWebRepeats(f, step, run.id);
  const result = (await step('read durable Web disposition', () => f.jobs())).find(job => job.id === run.id)!;
  assert.equal(result.reported, true, JSON.stringify({ flaky: result.flaky, error: result.error, cover: result.cover }));
  assert.equal(result.outcome?.code, 1);
  assert.equal(result.flaky?.runs.length, 5);
  assert.equal(result.flaky?.rejected, 'Web identity outside quarantine scope');
  assert.equal(result.cover?.status, 'red');
  assert.equal(result.cover?.receipt, undefined);
  assert.ok(!f.suites.stageCovers().some(cover => cover.id === run.id));
  const receipt = await step('read retained Web refusal evidence', () => f.suites.receipt(run.id));
  assert.match(receipt.log, /suite flaky receipt refusal .*"reason":"Web identity outside quarantine scope"/);
  await step('observe missing Web manifest', () => assert.rejects(stat(join(f.root, '.cland/run/suites', run.id, 'quarantine.json')), { code: 'ENOENT' }));
}));

test('a sharded T4 cover binds its failed producer before five same-command reruns', t => suiteCase(t, async ({ setup, step }) => {
  const file = 'hub/test/one.test.ts', name = 'known flake';
  const f = await setup(async fixtures => {
    const fixture = await ownedSuiteUnit(t, fixtures, { executor: 'droplet', machineReceiptsOnly: true, flakyOwners: () => ({ [`${file}::${name}`]: 'T-4' }) },
      'check="original-check"\ntest="whole-test"\ntest_soak="original-soak"');
    fixtures.mock.method(DropletExecutor.prototype, 'reserveShards', async () => {});
    fixtures.mock.method(DropletExecutor.prototype, 'releaseShardReservations', async () => {});
    return fixture;
  });
  for (const path of [file, 'hub/test/two.test.ts']) await step('write shard fixture', () => writeFile(join(f.root, path), ''));
  await step('declare sharded T4 files', () => writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [file]: 'T4', 'hub/test/two.test.ts': 'T4' } })));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  f.machine.script(...Array.from({ length: 7 }, () => ({ outcome: 'slow' as const, log: '' })));
  const run = await step('admit sharded cover', () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true }));
  await step('join shard launch', () => f.suites.settled());
  const original = (await step('read original shard owners', () => f.jobs())).find(job => job.id === run.id)!;
  assert.equal(original.shards?.length, 2);
  const plan = verificationSteps(original.commands!);
  const progress = (path: string, outcome: 'pass' | 'fail', id: string) => ['test', 'file'].map(type => 'suite progress ' + JSON.stringify({ event: 'finish', id: `${id}-${type}`, file: path, name: type === 'file' ? path : name, type, at: 1, nesting: 0, outcome, seconds: 0.01 })).join('\n') + '\n';
  for (const shard of original.shards!) {
    await step('observe native shard admission', () => f.machine.waits.run(f.machine.started(shard.id)));
    const path = shard.selection!.shard!.files[0]!;
    const code = path === file ? 1 : 0;
    const log = `tier T0: exit 0; duration 1 s; output tail: check\ntier T4: exit ${code}; duration 1 s; output tail: shard\n`
      + progress(path, code ? 'fail' : 'pass', shard.id) + `suite test failures ${JSON.stringify(code ? [{ file, name }] : [])}\n`;
    f.machine.finish(shard.id, code, log, plan.map(row => tierReceipt(shard, row, row.name === 'check' ? 0 : code)));
  }
  await step('collect sharded failure', () => f.tick(5000));
  await step('join sharded collection', () => f.suites.settled());
  assert.equal(f.status(run.id).reported, false, 'a filed shard failure awaits its repeat receipts');
  for (let round = 0; round < 5; round++) {
    await step('advance repeat scheduler', () => f.tick(5000));
    await step('join repeat scheduler', () => f.suites.settled());
    const child = (await step('read admitted repeat', () => f.jobs())).find(job => job.batch?.diagnostic?.key === `flaky-${run.id}-${round}`);
    assert.ok(child);
    assert.deepEqual(verificationSteps(child.commands!), plan);
    await step('observe repeat admission', () => f.machine.waits.run(f.machine.started(child.id)));
    await step('record bound T4 pass', () => f.finish(child.id, 0, progress(file, 'pass', child.id) + 'suite test failures []\n', true, plan.map(row => tierReceipt(child, row, 0))));
  }
  await step('settle sharded receipt', () => f.tick(5000));
  await step('join sharded receipt', () => f.suites.settled());
  assert.equal(f.status(run.id).outcome?.code, 1);
  assert.equal(f.status(run.id).cover?.receipt?.runs.length, 5);
  assert.ok(f.suites.stageCovers().some(cover => cover.id === run.id && cover.platform === 'Linux droplet'));
  const jobs = await step('read retained producer ownership', () => f.jobs());
  const group = jobs.find(job => job.id === run.id)!;
  group.shards![0]!.parentRun = 'another-parent';
  await step('reopen foreign producer ownership', () => f.reopen(jobs));
  assert.ok(!f.suites.stageCovers().some(cover => cover.id === run.id), 'another parent cannot lend producer authority');
}));

for (const tiered of [true, false]) test(`filed T4 repeats keep the original ${tiered ? 'tier' : 'whole-test'} command and producer step across config changes`, t => suiteCase(t, async ({ setup, step }) => {
  const file = 'hub/test/example.test.ts', name = 'known flake';
  const f = await setup(fixtures => ownedSuiteUnit(t, fixtures, { machineReceiptsOnly: true, flakyOwners: () => ({ [`${file}::${name}`]: 'T-4' }) },
    'check="original-check"\ntest="whole-test"\n' + (tiered ? 'test_soak="original-soak"' : '')));
  await step('write T4 fixture', () => writeFile(join(f.root, file), ''));
  await step('declare T4 fixture', () => writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [file]: 'T4' } })));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const run = await step('admit original T4 cover', () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true }));
  const original = (await step('read admitted plan', () => f.jobs())).find(job => job.id === run.id)!;
  const plan = verificationSteps(original.commands!);
  assert.deepEqual(plan.map(row => [row.name, row.command]), [['check', 'original-check'], tiered ? ['T4', 'original-soak'] : ['test', 'whole-test']]);
  await step('change config at unchanged candidate', () => writeFile(join(f.root, '.cland/config.toml'), '[verification]\ncheck="changed-check"\ntest="whole-test"\ntest_soak="changed-soak"\n'));
  const progress = (outcome: 'pass' | 'fail') => ['test', 'file'].map(type => 'suite progress ' + JSON.stringify({ event: 'finish', id: type, file, name: type === 'file' ? file : name, type, at: 1, nesting: 0, outcome, seconds: 0.01 })).join('\n') + '\n';
  const failed = 'tier T0: exit 0; duration 1 s; output tail: check\ntier T4: exit 1; duration 1 s; output tail: failure\n'
    + `suite test failures ${JSON.stringify([{ file, name }])}\n` + progress('fail');
  await step('record original T4 failure', () => f.finish(run.id, 1, failed, false, plan.map(row => tierReceipt(original, row, row.name === 'check' ? 0 : 1))));
  for (let round = 0; round < 5; round++) {
    await step('advance scheduler', () => f.tick());
    await step('join scheduler', () => f.suites.settled());
    const child = (await step('read admitted rerun', () => f.jobs())).find(job => job.batch?.diagnostic?.key === `flaky-${run.id}-${round}`);
    assert.ok(child);
    assert.deepEqual(verificationSteps(child.commands!), plan, 'changed config cannot replace the failed command');
    assert.equal(child.selection?.soak, true);
    const phases = await step('inspect T4 package selection', () => packageShards(f.root, 'full', child.selection?.shard, child.selection));
    assert.ok(phases.flatMap(phase => phase.targets).includes(file), 'the original T4 file really belongs to the rerun plan');
    await step('record same-command T4 pass', () => f.finish(child.id, 0, progress('pass') + 'suite test failures []\n', true, plan.map(row => tierReceipt(child, row, 0))));
  }
  await step('settle receipt', () => f.tick());
  await step('join receipt', () => f.suites.settled());
  assert.equal(f.status(run.id).outcome?.code, 1);
  assert.equal(f.status(run.id).cover?.receipt?.runs.length, 5);
  assert.ok(f.suites.stageCovers().some(cover => cover.id === run.id));
}));

test('filed cover failures need five same-tree hub greens before stage admission', t => suiteCase(t, async ({ setup, step }) => {
  const identity = 'hub/test/example.test.ts::known flake';
  const published: string[] = [];
  const f = await setup(fixtures => ownedSuiteUnit(t, fixtures, { machineReceiptsOnly: true, flakyOwners: () => ({ [identity]: 'T-4' }), onJob: job => { published.push(job.id); } }));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const run = await step("f.launch({ mode: 'all', integrated: true, occasion: 'stage', fres", () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true }));
  const admitted = (await step('read original commands', () => f.jobs())).find(job => job.id === run.id)!;
  await step('record original native failure', () => f.finish(run.id, 1, 'tier T0: exit 0; duration 1 s; output tail: check passed\nsuite test failures [{"file":"hub/test/example.test.ts","name":"known flake"}]\n', false,
    verificationSteps(admitted.commands!).map(row => tierReceipt(admitted, row, row.name === 'check' ? 0 : 1))));
  assert.equal(f.status(run.id).reported, false);
  for (let round = 0; round < 5; round++) {
    await step("f.tick()", () => f.tick()); await step("f.suites.settled()", () => f.suites.settled());
    const child = f.suites.status().find(job => job.batch?.diagnostic?.key === `flaky-${run.id}-${round}`);
    assert.ok(child, `hub admitted round ${round + 1}`);
    const log = 'suite progress {"event":"finish","id":"one","file":"hub/test/example.test.ts","name":"known flake","at":1,"nesting":0,"outcome":"pass","seconds":0.01}\nsuite test failures []\n';
    const admittedChild = (await step('read rerun commands', () => f.jobs())).find(job => job.id === child.id)!;
    await step('record matching native pass', () => f.finish(child.id, 0, log, true, verificationSteps(admittedChild.commands!).map(row => tierReceipt(admittedChild, row, 0))));
  }
  await step("f.tick()", () => f.tick()); await step("f.suites.settled()", () => f.suites.settled());
  assert.equal(f.status(run.id).outcome?.code, 1, 'native failure is retained');
  assert.equal(f.status(run.id).cover?.receipt?.runs.length, 5);
  assert.equal(f.status(run.id).cover?.status, 'green');
  assert.ok(f.suites.stageCovers().some(cover => cover.id === run.id));
  const jobs = await step("f.jobs()", () => f.jobs());
  const original = jobs.find(job => job.id === run.id)!;
  await step("f.reopen(jobs)", () => f.reopen(jobs));
  assert.ok(f.suites.stageCovers().some(cover => cover.id === run.id), 'the receipt survives reopening');
  const legacy = structuredClone(jobs);
  delete legacy.find(job => job.id === run.id)!.flaky!.commands;
  await step('reopen unbound legacy evidence', () => f.reopen(legacy));
  assert.ok(!f.suites.stageCovers().some(cover => cover.id === run.id), 'legacy evidence cannot invent a producer command binding');
  original.tree = 'e'.repeat(40);
  await step("f.reopen(jobs)", () => f.reopen(jobs));
  assert.ok(!f.suites.stageCovers().some(cover => cover.id === run.id), 'another tree cannot borrow the receipt');
  original.tree = f.candidate.tree;
  await step('restore original tree projection', () => f.reopen(jobs));
  assert.ok(f.suites.stageCovers().some(cover => cover.id === run.id));
  const expires = Date.parse(original.cover!.receipt!.manifest.tests[identity]!.expires);
  published.length = 0;
  f.clock.block(expires - f.clock.now().getTime());
  assert.ok(!f.suites.stageCovers().some(cover => cover.id === run.id), 'memoized stage admission must lint expired evidence');
  assert.ok(f.suites.stageMissing(original.tree).includes('Linux droplet'));
  await step('publish expiry to stage dependents', () => f.tick());
  await step('join expiry publication', () => f.suites.settled());
  assert.ok(published.includes(run.id), 'expiry must publish after a projection read invalidated the cache');
  await step('reopen expired evidence', () => f.reopen(jobs));
  assert.ok(!f.suites.stageCovers().some(cover => cover.id === run.id), 'reopening cannot restore expired authority');
}));

for (const cause of ['unfiled', 'planted unfiled', 'failed T0', 'missing producer metadata', 'rerun failure', 'skipped rerun', 'changed command receipt', 'missing step receipt', 'wrong run receipt', 'wrong tree receipt'] as const) test(`cover stays red after ${cause}`, t => suiteCase(t, async ({ setup, step }) => {
  const identity = 'hub/test/example.test.ts::known flake';
  const f = await setup(fixtures => ownedSuiteUnit(t, fixtures, { machineReceiptsOnly: true, flakyOwners: () => cause === 'unfiled' ? {} : { [identity]: 'T-4' } }));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const run = await step("f.launch({ mode: 'all', integrated: true, occasion: 'stage', fres", () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true }));
  const failures = [{ file: 'hub/test/example.test.ts', name: 'known flake' }];
  if (cause === 'planted unfiled') failures.push({ file: 'hub/test/example.test.ts', name: 'planted failure' });
  const admitted = (await step('read original commands', () => f.jobs())).find(job => job.id === run.id)!;
  await step('record original native failure', () => f.finish(run.id, 1, `tier T0: exit ${cause === 'failed T0' ? 1 : 0}; duration 1 s; output tail: check\nsuite test failures ${JSON.stringify(failures)}\n`, false,
    cause === 'missing producer metadata' ? undefined : verificationSteps(admitted.commands!).map(row => tierReceipt(admitted, row, row.name === 'check' && cause !== 'failed T0' ? 0 : 1))));
  if (cause.endsWith('rerun') || cause === 'rerun failure' || cause.endsWith('receipt')) {
    await step("f.tick()", () => f.tick()); await step("f.suites.settled()", () => f.suites.settled());
    const child = f.suites.status().find(job => job.batch?.diagnostic);
    assert.ok(child);
    const log = `suite progress ${JSON.stringify({ event: 'finish', id: 'one', file: 'hub/test/example.test.ts', name: 'known flake', at: 1, nesting: 0, outcome: cause === 'skipped rerun' ? 'skip' : cause === 'rerun failure' ? 'fail' : 'pass', seconds: 0.01 })}\nsuite test failures []\n`;
    const admittedChild = (await step('read rerun commands', () => f.jobs())).find(job => job.id === child.id)!;
    const rows = verificationSteps(admittedChild.commands!).map(row => tierReceipt(admittedChild, row, 0));
    if (cause === 'changed command receipt') rows.at(-1)!.command = 'different-command';
    if (cause === 'missing step receipt') rows.pop();
    if (cause === 'wrong run receipt') rows.at(-1)!.run = 'different-run';
    if (cause === 'wrong tree receipt') rows.at(-1)!.tree = 'e'.repeat(40);
    await step('record rerun producer receipt', () => f.finish(child.id, cause === 'rerun failure' ? 1 : 0, log, true, rows));
    await step("f.tick()", () => f.tick()); await step("f.suites.settled()", () => f.suites.settled());
  }
  assert.equal(f.status(run.id).cover?.status, 'red');
  assert.equal(f.status(run.id).reported, true);
  assert.deepEqual(f.suites.stageCovers(), []);
}));

test('rejected stage candidates leave traversal and retry restores their original newest-first order', () => {
  const covers = [0, 1, 2].map(n => ({ id: String(n), head: String(n), tree: 'tree', platform: 'Linux droplet' as const }));
  const candidates = new StageCandidates(covers);
  const ids = () => [...candidates].map(cover => cover.id);
  for (const n of [2, 0, 1]) candidates.set(covers[n]!, false);
  assert.deepEqual(ids(), []);
  candidates.set(covers[0]!, true); assert.deepEqual(ids(), ['0']);
  candidates.set(covers[2]!, true); assert.deepEqual(ids(), ['2', '0']);
  candidates.set(covers[1]!, true); assert.deepEqual(ids(), ['2', '1', '0']);
  const visited = [];
  for (const cover of candidates) { visited.push(cover.id); for (const row of covers) candidates.set(row, false); }
  assert.deepEqual(visited, ['2'], 'a settled rejection group is not traversed after its first candidate');
});

test('occasion load gate repeats only identities absent from the last green stage', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const old = 'hub/test/example.test.ts::old';
  const added = 'hub/test/example.test.ts::added after stage';
  const timing = (name: string) => `suite timing ${JSON.stringify({ file: 'hub/test/example.test.ts', name, seconds: 0.01 })}\n`;
  const stage = await f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true });
  assert.deepEqual(f.status(stage.id).selection?.loadGateBaseline, { run: null, tests: [] });
  await f.finish(stage.id, 0, '# tests 1\n# pass 1\n' + timing('old'));
  // Neither a later ordinary batch nor a failed stage advances the baseline.
  for (const occasion of [undefined, 'stage'] as const) {
    const run = await f.launch({ mode: 'all', integrated: true, ...(occasion ? { occasion } : {}), fresh: true });
    await f.finish(run.id, occasion ? 1 : 0, '# tests 2\n' + timing('old') + timing('added after stage'));
  }
  await f.reopen();
  for (const occasion of ['stage', 'epic', 'release'] as const) {
    const run = await f.launch({ mode: 'all', integrated: true, occasion, fresh: true });
    const selection = f.status(run.id).selection!;
    assert.deepEqual(selection.loadGateBaseline, { run: stage.id, tests: [old] });
    assert.equal(loadGateRepetitions(old, selection, { [old]: 0.01 }), 0);
    assert.equal(loadGateRepetitions(added, selection, { [added]: 0.01 }), 5, 'current timing manifest cannot hide a post-stage identity');
    // Keep the original green stage as the baseline for every occasion case.
    await f.finish(run.id, 1);
  }
});

test('a T1 to T3 batch green cannot supply an occasion cache or stage cover', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true, localPlatform: process.platform });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const actor = { name: 'coordinator', sessionId: 'coordinator', shell: true as const };
  const batch = await f.launch({ mode: 'all', integrated: true, fresh: true, actor });
  await assert.rejects(f.launch({ mode: 'all', integrated: true, occasion: 'stage', actor }), /already has a suite queued or running/);
  await f.finish(batch.id);
  assert.deepEqual(f.suites.stageMissing(f.candidate.tree), ['Linux droplet']);
  const close = await f.launch({ mode: 'all', integrated: true, occasion: 'release' });
  assert.equal(close.cached, undefined);
  await f.finish(close.id);
  const epic = await f.launch({ mode: 'all', integrated: true, occasion: 'epic' });
  assert.equal(epic.cached?.run, close.id, 'identical soak coverage can reuse an occasion green');
  await f.result(epic.id);
});

test('active stage submissions retain separate droplet and local runs for one caller', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated stage', fetchedDev: f.candidate.head };
  const base = { mode: 'all', integrated: true, occasion: 'stage' as const,
    actor: { name: 'coordinator', sessionId: 'stage-caller', shell: true as const } };
  const droplet = await f.launch({ ...base, executor: 'droplet' });
  const local = await f.launch({ ...base, executor: 'local' });
  assert.notEqual(local.id, droplet.id);
  assert.equal(f.status(droplet.id).executor, 'droplet');
  assert.equal(f.status(local.id).executor, 'local');
  for (const [executor, run] of [['droplet', droplet], ['local', local]] as const) {
    const retry = await f.launch({ ...base, executor });
    assert.equal(retry.id, run.id);
    assert.equal(retry.reused, true);
  }
  assert.equal(f.suites.status().length, 2);
});

test('active submission retries preserve requested overrides across scheduler recovery', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true }, 'workers=2');
  f.api.sizes.push({ slug: 'c-16', available: true, price_hourly: 0.5, disk: 100, regions: ['lon1'] });
  f.api.regions[0]!.sizes.push('c-16');
  const base = { actor: { name: 'coordinator', sessionId: 'override-caller', shell: true as const } };
  const overrides = [
    {},
    { executor: 'droplet' as const },
    { executor: 'droplet' as const, workers: 2 },
    { executor: 'droplet' as const, workers: 3 },
    { executor: 'droplet' as const, size: 'c-8' },
    { executor: 'droplet' as const, size: 'c-16' },
  ];
  const ids: string[] = [];
  for (const row of overrides) ids.push((await f.launch({ ...base, ...row })).id);
  assert.equal(new Set(ids).size, overrides.length, 'each requested override has its own run');
  for (const recover of [false, true]) {
    if (recover) await f.reopen();
    for (const [index, row] of overrides.entries()) {
      const retry = await f.launch({ ...base, ...row });
      assert.equal(retry.id, ids[index]);
      assert.equal(retry.reused, true);
    }
  }
  await assert.rejects(f.launch({ ...base, mode: 'hub' }), /already has a suite queued or running/);
  f.candidate.head = 'b'.repeat(40);
  await assert.rejects(f.launch(base), /already has a suite queued or running/);
  assert.equal(f.suites.status().length, overrides.length);
});

test('fresh failed or unreported stage attempts supersede the older green cache', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated stage', fetchedDev: f.candidate.head };
  const submit = (fresh: boolean) => f.launch({ mode: 'all', integrated: true, occasion: 'stage', executor: 'droplet', fresh });
  const running = async (id: string) => {
    await f.machine.waits.run(f.when(() => f.status(id).state === 'running' ? true : undefined));
    await f.machine.started(id);
  };
  let green = await submit(true); await running(green.id); await f.finish(green.id);
  assert.deepEqual(f.suites.stageMissing(f.candidate.tree), []);
  for (const state of ['failed', 'unreported'] as const) {
    const hit = await submit(false); assert.equal(hit.cached?.run, green.id); await f.result(hit.id);
    let withheld = false;
    f.beforeReport(async () => { if (withheld) throw new Error('loop breaker: controlled undeliverable report'); });
    withheld = state === 'unreported';
    const fresh = await submit(true); assert.equal(fresh.cached, undefined); await running(fresh.id);
    await f.finish(fresh.id, state === 'failed' ? 1 : 0, '# tests 1\n# pass 1\n', !withheld);
    if (withheld) {
      await f.when(() => f.status(fresh.id).error?.includes('loop breaker') ? true : undefined);
      assert.equal(f.status(fresh.id).outcome!.code, 0); assert.equal(f.status(fresh.id).reported, false);
    } else assert.equal(f.status(fresh.id).outcome!.code, 1);
    const next = await submit(false);
    assert.equal(next.cached, undefined, `newer ${state} evidence blocks the older green`);
    withheld = false; await running(next.id); await f.finish(next.id);
    await f.tick(5000); await f.result(fresh.id);
    assert.equal(f.status(next.id).outcome!.code, 0);
    assert.doesNotMatch(await f.log(next.id), /Original run/);
    assert.deepEqual(f.api.droplets, []);
    green = next;
  }
});

test('occasions require integrated dev, full selection and a fresh fetch at the admitted head', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated stage', fetchedDev: f.candidate.head };
  const base = { mode: 'all', integrated: true, occasion: 'stage' as const };
  for (const invalid of [
    { input: { integrated: false } },
    { input: {}, branch: 'task-candidate' },
    { input: { mode: 'hub' } },
    { input: {}, fetched: 'b'.repeat(40) },
    { input: {}, fetched: undefined },
  ]) {
    f.candidate.branch = invalid.branch ?? 'dev';
    const fetched = 'fetched' in invalid ? invalid.fetched : f.candidate.head;
    if (fetched === undefined) delete f.candidate.selection.fetchedDev;
    else f.candidate.selection.fetchedDev = fetched;
    await assert.rejects(f.launch({ ...base, ...invalid.input }), /integrated dev full request.*fresh origin\/dev fetch proof/);
  }
  assert.deepEqual(f.suites.snapshot().waiters, []); assert.deepEqual(f.suites.snapshot().remote, []);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});

// The representative occasion frame remains in suite-close; permutations are pure.
test('occasion roles allow Coordinator closes and only QA epic closes', () => {
  for (const occasion of ['stage', 'epic', 'release'] as const) {
    for (const role of ['implementer', 'reviewer', 'qa', 'coordinator', null] as const) {
      if (role === 'coordinator' || role === 'qa' && occasion === 'epic') assert.doesNotThrow(() => authorizeVerifyOccasion(role, occasion));
      else assert.throws(() => authorizeVerifyOccasion(role, occasion), /occasion requires the Coordinator, or QA with occasion epic/);
    }
  }
});

// Reservation arithmetic is covered at the spend boundary; here its refusal is an executor receipt.
test('batch and close runs fall back whole with one warning for cap or slots', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 2, machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated close', fetchedDev: f.candidate.head };
  // A cap rejection comes from the executor's public reservation seam.
  const { DropletExecutor } = await import('../src/executor/droplet/droplet.ts');
  t.mock.method(DropletExecutor.prototype, 'reserveShards', async () => { throw new Error('daily spend cap $0.1 would be exceeded'); });
  for (const [cause, occasion] of [['cap', undefined], ['cap', 'stage'], ['cap', 'dev-t3'], ['slots', undefined], ['slots', 'stage'], ['slots', 'dev-t3']] as const) {
    if (cause === 'slots') f.configure('[verification]\nexecutor="droplet"\nremote_budget=1');
    const before = f.acquisitions.length, notices = f.shardingNotices.length;
    const job = await f.launch({ mode: 'all', integrated: true, ...(occasion ? { occasion } : {}), fresh: true });
    await f.machine.waits.run(f.when(() => f.status(job.id).state === 'running' ? true : undefined));
    await f.machine.started(job.id); await f.finish(job.id);
    assert.equal(f.status(job.id).outcome!.code, 0);
    assert.equal(f.acquisitions.length - before, 1, 'one whole run, with no shard acquisitions');
    const expected = cause === 'cap' ? 'sharding skipped: daily spend cap $0.1 would be exceeded' : 'sharding skipped: fewer than 2 remote slots free';
    assert.deepEqual(f.shardingNotices.slice(notices), [expected]);
    assert.equal(f.logs.filter(row => row.event === 'verification-sharding-skipped' && row.id === job.id).length, 1);
    assert.deepEqual(f.api.droplets, []);
  }
});

test('cover rerun context checkpoints only explicit passes and survives restart', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const first = await f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true });
  const timings = ['pass', 'skip', 'fail'].map(outcome => `suite timing ${JSON.stringify({ file: 'hub/test/example.test.ts', name: outcome, seconds: 0.01, outcome })}\n`).join('');
  await f.finish(first.id, 0, '# tests 3\n# pass 1\n# skipped 1\n' + timings);
  await f.reopen();
  const next = await f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true });
  assert.equal(f.status(next.id).selection?.loadGateRerun?.head, f.candidate.head);
  assert.deepEqual(f.status(next.id).selection?.loadGateRerun?.recent, ['hub/test/example.test.ts::pass']);
});


test('recent-cover admission hydrates at most five full records from compact history', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const run = await f.launch({ mode: 'all', integrated: true, fresh: true });
  await f.finish(run.id);
  const template = (await f.jobs())[0]!;
  const jobs = Array.from({ length: 30 }, (_, i) => ({ ...template, id: `archive-${i}`,
    selection: { ...template.selection!, loadGateRerun: { head: template.head, recent: [], passed: [`identity-${i}`] } },
    completedAt: new Date(f.clock.now().getTime() - (30 - i) * 1000).toISOString() }));
  await f.reopen(jobs); await f.reopen();
  const reads = t.mock.method(f.store, 'suiteJob');
  const next = await f.launch({ mode: 'all', integrated: true, fresh: true });
  assert.ok(reads.mock.callCount() <= 5, `full hydrations: ${reads.mock.callCount()}`);
  assert.deepEqual(f.status(next.id).selection?.loadGateRerun?.recent, ['identity-25', 'identity-26', 'identity-27', 'identity-28', 'identity-29']);
});
