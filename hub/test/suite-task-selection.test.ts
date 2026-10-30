// T1: task cadence through public selection/package planners and an immutable in-memory repository.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, matchesGlob } from 'node:path';
import { taskSuiteSelection, taskDurationSelection, describeSelection, tierSuiteSelection, chooseSuiteMode, WEB_SMOKE, type SuiteSelection } from '../src/suite-selection.ts';
import { packageShards, serializeTierManifest, type TierManifest } from '../src/suite-shards.ts';
import { occasionSelection } from '../src/verification-occasion.ts';
import { packageSuitePlan } from './run-suite.ts';
import { verificationCommands } from '../src/verification-commands.ts';

// T1 planners need the complete repository inventory, not hundreds of native
// empty-file writes and reads. Model those immutable files at the filesystem edge.
const source = await fs.readFile(new URL('./tiers.json', import.meta.url), 'utf8');
const fixture = (t: TestContext) => plannerFixture(t, source);
function plannerFixture(t: TestContext, source: string) {
  const root = join(tmpdir(), 'task-tier-plan-memory');
  const manifest = JSON.parse(source) as TierManifest;
  const files = new Map(Object.keys(manifest.tests).map(file => [file, '']));
  files.set('hub/test/tiers.json', source);
  files.set('.cland/config.toml', '[verification]\ncheck = "npm run check"\ntest = "npm test"\n');
  const read = fs.readFile;
  t.mock.method(fs, 'readFile', (async (...args: Parameters<typeof fs.readFile>) => {
    const path = String(args[0]);
    if (!path.startsWith(root + '/')) return read(...args);
    const text = files.get(path.slice(root.length + 1));
    if (text === undefined) throw Object.assign(new Error(`missing fixture file: ${path}`), { code: 'ENOENT' });
    return text;
  }) as typeof fs.readFile);
  t.mock.method(fs, 'glob', (async function* (pattern, options) {
    assert.equal(options?.cwd, root, 'planner reads only its fixture repository');
    const patterns = typeof pattern === 'string' ? [pattern] : pattern;
    const exact = new Set(patterns.filter(pattern => !['*', '?', '{', '['].some(token => pattern.includes(token))));
    const wildcard = patterns.filter(pattern => !exact.has(pattern));
    for (const file of files.keys()) if (exact.has(file) || wildcard.some(pattern => matchesGlob(file, pattern))) yield file;
  }) as typeof fs.glob);
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const tier = (file: string) => { const value = manifest.tests[file]!; return typeof value === 'string' ? value : value.tier; };
  const phases = (selection: SuiteSelection) => packageShards(root, selection.mode, undefined, selection, { workers: 2 });
  const plan = async (selection: SuiteSelection) => (await phases(selection)).flatMap(phase => phase.targets).sort();
  const taskPlan = async (selection: SuiteSelection) => {
    const scheduled = await phases(selection);
    const web = scheduled.filter(phase => phase.name === 'Web' || phase.name === 'Web smoke');
    const rest = scheduled.filter(phase => !web.includes(phase));
    assert.ok(rest.every(phase => phase.targets.every(file => tier(file) !== 'Web')), 'Web never leaks into a hub/Neovim tier phase');
    assert.ok(web.every(phase => phase.targets.every(file => tier(file) === 'Web') && phase.resource === 'machine' && phase.workers === 2));
    return { files: rest.flatMap(phase => phase.targets).sort(), web };
  };
  return { root, manifest, tier, plan, taskPlan };
}

test('task cadence plans all T1 plus selected T2 from the repository manifest', async t => {
  const f = fixture(t);
  const selection = taskSuiteSelection({ mode: 'hub-selected', files: ['hub/src/parser.ts'], reason: 'coverage', tests: ['hub/test/merge-queue.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts'], nvimTests: ['nvim/test/client-component.test.ts', 'nvim/test/scenarios/workbench.test.ts'] }, 't/T-713', 'auto', true);
  const planned = await f.taskPlan(selection);
  assert.deepEqual(planned.web, [{ name: 'Web smoke', targets: WEB_SMOKE, resource: 'machine', workers: 2 }]);
  assert.deepEqual(planned.files, [...Object.keys(f.manifest.tests).filter(file => f.tier(file) === 'T1'), 'hub/test/merge-queue.test.ts', 'nvim/test/client-component.test.ts'].sort());
  assert.deepEqual(selection.tiers, ['T1', 'T2']);
  assert.equal(selection.loadGate, true);
  assert.deepEqual(await verificationCommands(f.root, f.root), { prepare: '', check: 'npm run check', test: 'npm test' });
});

test('mapped read paths add only their T4 guards once, with an explanation under selected coverage and fallback', async t => {
  const f = plannerFixture(t, serializeTierManifest({ version: 1, tests: {
    'hub/test/unit.test.ts': 'T1', 'hub/test/component.test.ts': 'T2',
    'hub/test/changed.test.ts': 'T3', 'hub/test/read-load.test.ts': 'T4',
    'hub/test/unrelated-load.test.ts': 'T4',
  } }));
  const tiers = new Map(Object.entries(f.manifest.tests).map(([file, tier]) => [file, typeof tier === 'string' ? tier : tier.tier]));
  const guards = { 'hub/src/reads/**/*.ts': ['hub/test/read-load.test.ts'], 'hub/src/reads/list.ts': ['hub/test/read-load.test.ts'] };
  for (const mode of ['hub-selected', 'full'] as const) {
    const base = taskSuiteSelection({ mode, files: ['hub/src/reads/list.ts', 'hub/test/changed.test.ts'], reason: 'coverage fixture', tests: ['hub/test/component.test.ts'] }, 't/T-1203', 'auto', true);
    const selection = taskDurationSelection(base, tiers, guards);
    assert.deepEqual(selection.durationCheck?.files, ['hub/test/changed.test.ts', 'hub/test/read-load.test.ts']);
    assert.deepEqual(selection.tiers, ['T1', 'T2', 'T3', 'T4']);
    assert.match(describeSelection(selection), /T4 hub\/test\/read-load.test.ts guards hub\/src\/reads\/list.ts/);
    assert.deepEqual(await f.plan(selection), ['hub/test/changed.test.ts', 'hub/test/component.test.ts', 'hub/test/read-load.test.ts', 'hub/test/unit.test.ts']);
    const narrowed = tierSuiteSelection(selection, 'T4');
    assert.deepEqual(await f.plan(narrowed), ['hub/test/read-load.test.ts']);
    assert.deepEqual(taskDurationSelection({ ...base, files: [...base.files, 'hub/test/read-load.test.ts'] }, tiers, guards).durationCheck, selection.durationCheck, 'a changed guard is not scheduled twice');
  }
  const unrelated = taskDurationSelection(taskSuiteSelection({ mode: 'full', files: ['hub/src/unrelated.ts'], reason: 'fallback' }, 't/T-1203', 'auto', true), tiers, guards);
  assert.equal(unrelated.durationCheck, undefined);
  assert.deepEqual(unrelated.tiers, ['T1', 'T2']);
});

test('per-tier commands preserve the repository task file plan', async t => {
  // T0 inventories the repository manifest. Selection permutations need only
  // enough files to distinguish whole T1, selected T2, smoke and soak exclusions.
  const small = plannerFixture(t, serializeTierManifest({ version: 1, tests: {
    'hub/test/unit.test.ts': 'T1', 'nvim/test/unit.test.ts': 'T1',
    'hub/test/merge-queue.test.ts': 'T2', 'hub/test/other-component.test.ts': 'T2',
    'nvim/test/client-component.test.ts': 'T2', 'nvim/test/other-component.test.ts': 'T2',
    'hub/test/scenarios/hub-lifecycle.test.ts': 'T3', 'nvim/test/scenarios/workbench.test.ts': 'T3',
    'hub/test/soak.test.ts': 'T4', 'web/test/feature.test.ts': 'Web', 'web/test/smoke.test.ts': 'Web',
  } }));
  for (const source of [
    { mode: 'full', files: [], reason: 'fallback' },
    { mode: 'hub-selected', files: [], reason: 'coverage', tests: ['hub/test/merge-queue.test.ts'], nvimTests: ['nvim/test/client-component.test.ts'] },
    { mode: 'nvim-only', files: [], reason: 'Neovim' },
    { mode: 'hub-selected', files: ['hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/soak.test.ts'], reason: 'changed process files', tests: ['hub/test/merge-queue.test.ts'], durationCheck: { files: ['hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/soak.test.ts'] } },
  ] satisfies SuiteSelection[]) {
    const f = small;
    const admitted = taskSuiteSelection(source, 't/T-717', 'auto', true);
    if (admitted.durationCheck) admitted.tiers = ['T1', 'T2', 'T3', 'T4'];
    const before = await f.plan(admitted);
    const split: string[] = [];
    for (const tier of ['T1', 'T2', ...(admitted.durationCheck ? ['T3', 'T4'] : []), 'Web']) {
      const plan = await packageSuitePlan(f.root, 'auto', ['--tier', tier], { hub: 'hub.lock', nvim: 'nvim.lock' }, { CLAND_SUITE_SELECTION: JSON.stringify(admitted), CLAND_SUITE_WORKERS: '2' });
      assert.deepEqual(plan.lockDirs, ['hub.lock', 'nvim.lock']);
      assert.equal(plan.targeted, false);
      const files = plan.phases.flatMap(phase => phase.targets);
      assert.ok(files.every(file => tier === 'Web' ? f.tier(file) === 'Web' : f.tier(file) !== 'Web'), `${tier} command keeps its phase boundary`);
      split.push(...files);
    }
    split.sort();
    assert.deepEqual(split, before, source.mode);
    assert.ok(before.every(file => ['T1', 'T2', 'Web'].includes(f.tier(file)) || admitted.durationCheck?.files.includes(file)));
    if (admitted.durationCheck) {
      const { pinVerificationPlan } = await import('../src/verification-plan.ts');
      const pinned = pinVerificationPlan({ prepare: '', check: 'check', test: '', tiers: { T1: 'unit', T2: 'component', T3: 'integration', T4: 'soak' } }, { branch: 't/T-717', mode: 'auto', selection: admitted, queueEnabled: true });
      assert.deepEqual(pinned.plan?.map(step => step.name), ['check', 'T1', 'T2', 'T3', 'T4']);
      assert.equal(occasionSelection(admitted, 'stage').durationCheck, undefined, 'integrated occasions retain their full tier set');
    }
  }
});

test('a task coverage fallback widens T2 without admitting T3 or T4', async t => {
  const f = fixture(t);
  for (const mode of ['full', 'hub-only'] as const) {
    const selection = taskSuiteSelection({ mode, files: ['hub/src/protocol.ts'], reason: 'coverage fallback', nvimTests: ['nvim/test/client-component.test.ts'] }, 't/T-713', 'auto', true);
    const planned = await f.taskPlan(selection);
    assert.deepEqual(planned.web, [{ name: 'Web', targets: Object.keys(f.manifest.tests).filter(file => f.tier(file) === 'Web').sort(), resource: 'machine', workers: 2 }]);
    assert.deepEqual(planned.files, Object.keys(f.manifest.tests).filter(file => ['T1', 'T2'].includes(f.tier(file))).sort());
  }
});

test('a Neovim task still proves all T1 while running only Neovim T2', async t => {
  const f = fixture(t);
  const selection = taskSuiteSelection({ mode: 'nvim-only', files: ['nvim/lua/cland/thread.lua'], reason: 'Neovim diff' }, 't/T-713', 'auto', true);
  const planned = await f.taskPlan(selection);
  assert.deepEqual(planned.web, [{ name: 'Web smoke', targets: WEB_SMOKE, resource: 'machine', workers: 2 }]);
  assert.deepEqual(planned.files, Object.keys(f.manifest.tests).filter(file => f.tier(file) === 'T1' || file.startsWith('nvim/') && f.tier(file) === 'T2').sort());
});

test('integrated dev, explicit all and occasions retain process coverage', async t => {
  const f = fixture(t);
  for (const [branch, requested, occasion] of [['dev', 'auto', undefined], ['t/T-713', 'all', undefined], ['dev', 'all', 'stage'], ['detached', 'all', 'batch']] as const) {
    const selection = occasionSelection(taskSuiteSelection({ mode: 'full', files: [], reason: 'full' }, branch, requested, true), occasion);
    const planned = await f.plan(selection);
    assert.ok(planned.includes('hub/test/scenarios/hub-lifecycle.test.ts'));
    assert.ok(planned.every(file => occasion ? occasion !== 'batch' || ['T1', 'T3'].includes(f.tier(file)) : f.tier(file) !== 'T4'));
  }
});


test('queue-disabled projects retain process coverage on task branches', async t => {
  const f = fixture(t);
  const selection = taskSuiteSelection({ mode: 'full', files: [], reason: 'coverage fallback' }, 't/T-713', 'auto', false);
  assert.equal(selection.tiers, undefined);
  assert.ok((await f.plan(selection)).includes('hub/test/scenarios/hub-lifecycle.test.ts'));
});

test('hosting project queue policy protects admission from a candidate-local opt-in', async t => {
  const { suiteUnit } = await import('./suite-unit-fixture.ts');
  const f = await suiteUnit(t, { machineReceiptsOnly: true });
  for (const [name, tier] of [['unit', 'T1'], ['component', 'T2'], ['process', 'T3']] as const) {
    await mkdir(join(f.root, 'hub/test'), { recursive: true });
    await writeFile(join(f.root, `hub/test/${name}.test.ts`), '');
  }
  await writeFile(join(f.root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: {
    'hub/test/component.test.ts': 'T2', 'hub/test/process.test.ts': 'T3', 'hub/test/unit.test.ts': 'T1',
  } }));
  f.candidate.branch = 't/T-713';
  f.candidate.selection = taskSuiteSelection({ mode: 'full', files: [], reason: 'candidate queue enabled' }, 't/T-713', 'auto', true);
  for (const config of ['', '[merge]\nqueue = false\n', '[merge]\nqueue = true\n']) {
    f.configure(config);
    const preview = await f.suites.start({ mode: 'auto', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true }, () => {});
    assert.ok('dryRun' in preview);
    const enabled = config.includes('true');
    assert.deepEqual(preview.selection.tiers, enabled ? ['T1', 'T2'] : undefined);
    const files = (await packageShards(f.root, preview.selection.mode, undefined, preview.selection, { workers: 2 })).flatMap(phase => phase.targets);
    assert.equal(files.includes('hub/test/process.test.ts'), !enabled);
  }
});


// T1: entry-point equivalence is a plan comparison, with no runners or machine locks.
test('npm test preserves the legacy entry point plan for every supplied selection', async t => {
  const root = await mkdtemp(join(tmpdir(), 'entry-plan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of ['hub/test/free.test.ts', 'hub/test/suite-queue.test.ts', 'nvim/test/component.test.ts']) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), '');
  }
  await writeFile(join(root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: {
    'hub/test/free.test.ts': 'T1', 'hub/test/suite-queue.test.ts': 'T2', 'nvim/test/component.test.ts': 'T2',
  } }));
  const f = { root };
  const locks = { hub: join(f.root, 'machine.lock'), nvim: join(f.root, 'nvim.lock') };
  const hubTest = 'hub/test/suite-queue.test.ts';
  const cases: Array<[string, SuiteSelection]> = [
    ['auto', { mode: 'full', files: [], reason: 'full' }],
    ['hub', { mode: 'hub-only', files: [], reason: 'hub' }],
    ['hub', { mode: 'hub-selected', files: ['hub/src/hub/suites.ts'], tests: [hubTest], reason: 'coverage' }],
    ['nvim', { mode: 'nvim-only', files: [], reason: 'nvim' }],
    ['auto', { mode: 'full', files: [hubTest], reason: 'shard', shard: { files: [hubTest], nvim: false } }],
  ];
  for (const [legacy, selection] of cases) {
    const env = { CLAND_SUITE_SELECTION: JSON.stringify(selection), CLAND_SUITE_WORKERS: '3' };
    const oldPlan = await packageSuitePlan(f.root, legacy, [], locks, env);
    const newPlan = await packageSuitePlan(f.root, 'auto', [], locks, env);
    assert.deepEqual(newPlan, oldPlan, selection.mode + (selection.shard ? ' shard' : ''));
    assert.deepEqual(newPlan.selection, selection);
    assert.deepEqual(newPlan.lockDirs, [locks.hub, locks.nvim]);
    assert.ok(newPlan.phases.length);
    assert.ok(newPlan.phases.every(phase => phase.resource === 'free' ? phase.workers === 1 : phase.workers === 3));
  }
});


test('mode-free docs and site selections include every site prebuild guard', async t => {
  const f = fixture(t);
  const wrapper = await fs.readFile(new URL('./remote-docs.test.ts', import.meta.url), 'utf8');
  const guards = await fs.readdir(new URL('../../site/test/', import.meta.url));
  for (const path of ['docs/agents/session-permissions.md', 'site/src/content/docs/docs/quickstart.md']) {
    const selection = taskSuiteSelection({ mode: chooseSuiteMode([path]), files: [path], reason: 'diff' }, 't/T-1480', 'auto', true);
    assert.ok((await f.plan(selection)).includes('hub/test/remote-docs.test.ts'), path);
    for (const guard of guards.filter(file => file.endsWith('.test.ts'))) {
      assert.ok(wrapper.includes(`'../../site/test/${guard}'`), `${guard} runs through the T1 wrapper`);
    }
  }
});
