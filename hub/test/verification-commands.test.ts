// T1: config resolution and durable admission facts use files and semantic executor receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { writeSuiteFixture } from './suite-fixture.ts';
import { parseConfig } from '../src/init/config.ts';
import { occasionSelection } from '../src/verification-occasion.ts';
import { clandRunner, verificationCommands, recordedCommands } from '../src/verification-commands.ts';

test('cland runner presence and capabilities are resolved from the candidate', async t => {
  const root = await tempProject(t);
  assert.equal(await clandRunner(root), null);
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await writeFile(join(root, 'hub/test/run-suite.ts'), '');
  assert.deepEqual(await clandRunner(root), { inheritedLease: false, reduceCoverage: false }, 'even an empty legacy runner identifies cland');
  await writeFile(join(root, 'hub/test/run-suite.ts'), '// inheritedLease reduceCoverage');
  assert.deepEqual(await clandRunner(root), { inheritedLease: true, reduceCoverage: true });
});

test('regular-file ancestors mean this candidate has no cland runner', async t => {
  for (const ancestor of ['hub', 'hub/test']) {
    const root = await tempProject(t);
    if (ancestor.includes('/')) await mkdir(join(root, 'hub'));
    await writeFile(join(root, ancestor), 'another stack owns this file');
    assert.equal(await clandRunner(root), null, ancestor);
  }
});

test('verification resolves each command from the candidate before the hub root', async t => {
  const root = await tempProject(t), candidate = join(root, 'candidate');
  for (const dir of [root, candidate]) await mkdir(join(dir, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nprepare="root prepare"\ncheck="root check"\ntest="root test"\n');
  await writeFile(join(candidate, '.cland/config.toml'), '[verification]\ncheck=""\ntest="branch test"\n');
  assert.deepEqual(await verificationCommands(candidate, root), { prepare: 'root prepare', check: 'root check', test: 'branch test' });
  await writeFile(join(candidate, '.cland/config.toml'), '[project]\nname="old branch"\n');
  assert.deepEqual(await verificationCommands(candidate, root), { prepare: 'root prepare', check: 'root check', test: 'root test' });
});

test('verification refuses a project with no configured test', async t => {
  const root = await tempProject(t);
  await assert.rejects(verificationCommands(root, root), /no \[verification\] test for this project; set it: cland config set verification.test '<command>'/);
});


test('submission retains recorded commands through store reopen after config changes', async t => {
  const f = await suiteUnit(t, {}, 'prepare="false"\ncheck="echo check"\ntest="echo test"\n');
  f.hold(true);
  const job = await f.launch();
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ncheck="false"\ntest="false"\n');
  await f.reopen();
  f.hold(false);
  await f.tick();
  await f.suites.settled();
  assert.deepEqual(f.delivered.get(job.id)?.commands, { prepare: 'false', check: 'echo check', test: 'echo test' });
  assert.match(await f.log(job.id), /Commands: check echo check · test echo test/);
  await f.finish(job.id);
});


test('this repository names its tier commands for every mode', async t => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const commands = await verificationCommands(root, root);
  assert.deepEqual(commands, { prepare: 'node hub/bin/verify-prepare.ts', check: 'npm run check', test: 'npm test', tiers: { T1: 'node hub/test/run-suite.ts --tier T1', T2: 'node hub/test/run-suite.ts --tier T2', T3: 'node hub/test/run-suite.ts --tier T3', T4: 'node hub/test/run-suite.ts --tier T4', Web: 'node hub/test/run-suite.ts --tier Web' } });
  const f = await suiteUnit(t);
  await writeFile(join(f.root, 'hub/test/run-suite.ts'), '// inheritedLease; supportsWebPhase = true');
  await mkdir(join(f.root, 'web/test'), { recursive: true });
  await writeFile(join(f.root, 'web/test/smoke.test.ts'), '');
  await writeFile(join(f.root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: { 'web/test/smoke.test.ts': 'Web' } }));
  await writeFile(join(f.root, '.cland/config.toml'), await readFile(join(root, '.cland/config.toml'), 'utf8'));
  for (const mode of ['auto', 'all', 'hub', 'nvim']) {
    const job = await f.launch({ mode, fresh: true });
    const pinned = recordedCommands(f.delivered.get(job.id)!);
    const { plan, ...resolved } = pinned;
    assert.deepEqual(resolved, commands, mode);
    assert.deepEqual(plan?.map(step => step.name), ['check', 'T1', 'T2', 'T3', 'Web']);
    await f.finish(job.id);
  }
});

test('a different resolved command cannot reuse the same candidate tree green', async t => {
  const f = await suiteUnit(t);
  const original = await f.launch();
  await f.finish(original.id);
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ntest="different suite"\n');
  const next = await f.launch();
  assert.equal(next.cached, undefined);
  await f.finish(next.id);
  for (const command of ['first tier', 'changed tier']) {
    await writeFile(join(f.root, '.cland/config.toml'), `[verification]\ntest_unit=${JSON.stringify(command)}\n`);
    const tiered = await f.launch();
    assert.equal(tiered.cached, undefined);
    await f.finish(tiered.id);
  }
});

test('other-stack fixture keeps caller shell commands without a package or runner', async t => {
  const root = await tempProject(t, 'cland-other-stack-');
  await writeSuiteFixture(root, '', undefined, { stack: 'other', check: 'sh -n test.sh', test: 'sh test.sh', verification: '' });
  const config = parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'fixture');
  assert.equal(config.verification.check, 'sh -n test.sh');
  assert.equal(config.verification.test, 'sh test.sh');
  await assert.rejects(stat(join(root, 'package.json')), { code: 'ENOENT' });
  await assert.rejects(stat(join(root, 'hub/test/run-suite.ts')), { code: 'ENOENT' });
});

// T1: command cadence is a pure admission contract, independent of runner file lists.
test('tier command plans pin task, batch, integrated and occasion cadence', async () => {
  const { pinVerificationPlan, verificationSteps } = await import('../src/verification-plan.ts');
  const commands = { prepare: '', check: 'python3 -m compileall .', test: 'legacy suite', tiers: {
    T1: 'python3 -m pytest unit', T2: 'python3 -m pytest component', T3: 'python3 -m pytest integration', T4: 'python3 -m pytest soak',
  } };
  for (const [run, expected] of [
    [{ branch: 't/T-717', mode: 'auto' }, ['check', 'T1', 'T2']],
    [{ branch: 'detached', mode: 'all', occasion: 'batch' }, ['T1', 'T3']],
    [{ branch: 'dev', mode: 'auto' }, ['check', 'T1', 'T2', 'T3']],
    [{ branch: 't/T-717', mode: 'all' }, ['check', 'T1', 'T2', 'T3']],
    [{ branch: 'dev', mode: 'all', occasion: 'stage' }, ['check', 'T1', 'T2', 'T3', 'T4']],
    [{ branch: 'dev', mode: 'all', occasion: 'soak' }, ['check', 'T1', 'T2', 'T3', 'T4']],
  ] as const) {
    const pinned = pinVerificationPlan(commands, run);
    assert.deepEqual(verificationSteps(pinned).map(step => step.name), expected);
    assert.equal(verificationSteps(pinned).find(step => step.name === 'T1')?.command, 'python3 -m pytest unit');
  }
  assert.deepEqual(verificationSteps(pinVerificationPlan({ prepare: '', check: '', test: 'python3 -m unittest' }, { branch: 't/T-717', mode: 'auto' })), [{ name: 'test', command: 'python3 -m unittest' }]);
  assert.throws(() => verificationSteps(commands), /no recorded plan/);
});

// T1: admission dispatches named Python commands without cland-specific runner files.
test('other-stack admission records task and batch tier plans through a reopen', async t => {
  const f = await suiteUnit(t, {}, 'check="python3 -m compileall ."\ntest_unit="python3 -m pytest unit"\ntest_integration="python3 -m pytest integration"\n');
  await rm(join(f.root, 'hub/test/run-suite.ts'));
  f.configure('[merge]\nqueue=true\n');
  f.candidate.branch = 't/T-717';
  const task = await f.launch();
  assert.equal(f.delivered.get(task.id)?.selection?.loadGate, undefined);
  assert.equal(f.delivered.get(task.id)?.selection?.reason, 'project test runs in full');
  assert.deepEqual(recordedCommands(f.delivered.get(task.id)!).plan, [
    { name: 'check', command: 'python3 -m compileall .' }, { name: 'T1', command: 'python3 -m pytest unit' },
  ]);
  await f.finish(task.id);
  f.hold(true);
  const batch = await f.launch({ mode: 'all', occasion: 'batch', fresh: true });
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ntest_unit="false"\n');
  await f.reopen();
  f.hold(false);
  await f.tick();
  await f.suites.settled();
  assert.deepEqual(recordedCommands(f.delivered.get(batch.id)!).plan, [
    { name: 'T1', command: 'python3 -m pytest unit' }, { name: 'T3', command: 'python3 -m pytest integration' },
  ]);
  await f.finish(batch.id);
});

// T1: root fallback is per tier, while candidate overrides stay literal.
test('tier resolution combines candidate commands with root defaults', async t => {
  const root = await tempProject(t), candidate = join(root, 'candidate');
  for (const dir of [root, candidate]) await mkdir(join(dir, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest_unit="python3 -m pytest unit"\ntest_integration="python3 -m pytest integration"\n');
  await writeFile(join(candidate, '.cland/config.toml'), `[verification]\ntest_unit=${JSON.stringify('  python3 -m pytest unit -k "chosen test"  ')}\n`);
  const resolved = await verificationCommands(candidate, root);
  assert.deepEqual(resolved.tiers, { T1: '  python3 -m pytest unit -k "chosen test"  ', T3: 'python3 -m pytest integration' });
});

// T1: arbitrary stacks have command tiers, not cland's duration/file manifests.
test('other-stack occasions admit all tier commands without runner manifests', async t => {
  const f = await suiteUnit(t, {}, 'check=""\ntest_unit="unit"\ntest_component="component"\ntest_integration="integration"\ntest_soak="soak"\n');
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  for (const occasion of ['stage', 'soak'] as const) {
    const job = await f.launch({ occasion, integrated: true, mode: 'all', fresh: true });
    assert.deepEqual(recordedCommands(f.delivered.get(job.id)!).plan?.map(step => step.name), ['check', 'T1', 'T2', 'T3', 'T4']);
    await f.finish(job.id);
  }
});

// T1: an explicit whole-test candidate chooses legacy execution even under a tiered root.
test('candidate whole-test precedence keeps root tiers from replacing its test', async t => {
  const { pinVerificationPlan, verificationSteps } = await import('../src/verification-plan.ts');
  const root = await tempProject(t), candidate = join(root, 'candidate');
  for (const dir of [root, candidate]) await mkdir(join(dir, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ncheck="root check"\ntest="root test"\ntest_unit="root unit"\ntest_component="root component"\n');
  for (const [source, expected] of [
    ['test="sh legacy-test.sh"\ntest_unit=""\n', { prepare: '', check: 'root check', test: 'sh legacy-test.sh' }],
    ['', { prepare: '', check: 'root check', test: 'root test', tiers: { T1: 'root unit', T2: 'root component' } }],
    ['test=""\n', { prepare: '', check: 'root check', test: 'root test', tiers: { T1: 'root unit', T2: 'root component' } }],
    ['test="sh legacy-test.sh"\ntest_unit="candidate unit"\n', { prepare: '', check: 'root check', test: 'sh legacy-test.sh', tiers: { T1: 'candidate unit', T2: 'root component' } }],
  ] as const) {
    await writeFile(join(candidate, '.cland/config.toml'), `[verification]\n${source}`);
    const resolved = await verificationCommands(candidate, root);
    assert.deepEqual(resolved, expected);
    const plan = verificationSteps(pinVerificationPlan(resolved, { branch: 't/T-717', mode: 'auto' }));
    assert.deepEqual(plan, 'tiers' in expected ? [
      { name: 'check', command: 'root check' }, { name: 'T1', command: expected.tiers.T1 }, { name: 'T2', command: 'root component' },
    ] : [{ name: 'check', command: 'root check' }, { name: 'test', command: 'sh legacy-test.sh' }]);
  }
});

// T1: one admitted tier selection drives both file planning and recorded commands.
test('recorded commands compose configured batch tiers with periodic T3', async t => {
  const f = await suiteUnit(t, {}, 'check="check"\ntest_unit="unit"\ntest_component="component"\ntest_integration="integration"\ntest_soak="soak"\n');
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  for (const [tiers, occasion, expected] of [
    [['T1'], 'batch', ['T1']],
    [['T1', 'T3'], 'batch', ['T1', 'T3']],
    [['T2', 'T4'], 'batch', ['T2', 'T4']],
    [['T1'], 'dev-t3', undefined],
  ] as const) {
    f.configure(`[merge]\nqueue=true\nbatch_tiers=${JSON.stringify(tiers)}\n`);
    const job = await f.launch({ occasion, integrated: true, mode: 'all', fresh: true });
    const delivered = f.delivered.get(job.id)!;
    // The occasion planner owns periodic cadence; admission must record that same plan.
    const plannedTiers = occasion === 'batch' ? tiers : occasionSelection(f.candidate.selection, occasion).tiers!;
    assert.deepEqual(delivered.selection?.tiers, plannedTiers);
    assert.deepEqual(recordedCommands(delivered).plan?.map(step => step.name), expected ?? ['check', ...plannedTiers]);
    await f.finish(job.id);
  }
});
