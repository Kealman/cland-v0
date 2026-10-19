// T1: task cadence is proved through the public selection and package planners in isolated files.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { taskSuiteSelection, type SuiteSelection } from '../src/suite-selection.ts';
import { packageShards, type TierManifest } from '../src/suite-shards.ts';
import { occasionSelection } from '../src/verification-occasion.ts';
import { suiteCommands } from '../src/hub/suite-worker.ts';
import { suiteCheckCommand } from '../src/suite-check.ts';

// These five planner cases read identical immutable inputs. Build their isolated
// repository once per file instead of recreating hundreds of files per case.
let repositoryRoot: string | undefined;
let repository: Awaited<ReturnType<typeof fixture>>;
before(async () => { repository = await fixture(); });
after(async () => { if (repositoryRoot) await rm(repositoryRoot, { recursive: true, force: true }); });

async function fixture() {
  const root = repositoryRoot = await mkdtemp(join(tmpdir(), 'task-tier-plan-'));
  const source = await readFile(new URL('./tiers.json', import.meta.url), 'utf8');
  const manifest = JSON.parse(source) as TierManifest;
  const files = Object.keys(manifest.tests);
  // These bounded empty-file writes need no asynchronous workers or repeated
  // directory creation. Every write is complete before fixture cleanup can run.
  for (const path of new Set(files.map(file => join(root, file, '..')))) mkdirSync(path, { recursive: true });
  for (const file of files) writeFileSync(join(root, file), '');
  await writeFile(join(root, 'hub/test/tiers.json'), source);
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'npm run typecheck && npm run test:lint', 'test:lint': 'node lint.ts' } }));
  const tier = (file: string) => { const value = manifest.tests[file]!; return typeof value === 'string' ? value : value.tier; };
  const plan = async (selection: SuiteSelection) => (await packageShards(root, selection.mode, undefined, selection, { workers: 2 })).flatMap(phase => phase.targets).sort();
  return { root, manifest, tier, plan };
}

test('task cadence plans all T1 plus selected T2 from the repository manifest', async () => {
  const f = repository;
  const selection = taskSuiteSelection({ mode: 'hub-selected', files: ['hub/src/parser.ts'], reason: 'coverage', tests: ['hub/test/merge-queue.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts'], nvimTests: ['nvim/test/client-component.test.ts', 'nvim/test/scenarios/workbench.test.ts'] }, 't/T-713', 'auto', true);
  const planned = await f.plan(selection);
  assert.deepEqual(planned, [...Object.keys(f.manifest.tests).filter(file => f.tier(file) === 'T1'), 'hub/test/merge-queue.test.ts', 'nvim/test/client-component.test.ts'].sort());
  assert.deepEqual(selection.tiers, ['T1', 'T2']);
  assert.equal(selection.loadGate, true);
  assert.deepEqual(suiteCommands({ mode: 'auto', selection }, await suiteCheckCommand(f.root)), [['run', 'check'], ['test']]);
});

test('a task coverage fallback widens T2 without admitting T3 or T4', async () => {
  const f = repository;
  for (const mode of ['full', 'hub-only'] as const) {
    const selection = taskSuiteSelection({ mode, files: ['hub/src/protocol.ts'], reason: 'coverage fallback', nvimTests: ['nvim/test/client-component.test.ts'] }, 't/T-713', 'auto', true);
    assert.deepEqual(await f.plan(selection), Object.keys(f.manifest.tests).filter(file => ['T1', 'T2'].includes(f.tier(file))).sort());
  }
});

test('a Neovim task still proves all T1 while running only Neovim T2', async () => {
  const f = repository;
  const selection = taskSuiteSelection({ mode: 'nvim-only', files: ['nvim/lua/cland/thread.lua'], reason: 'Neovim diff' }, 't/T-713', 'auto', true);
  assert.deepEqual(await f.plan(selection), Object.keys(f.manifest.tests).filter(file => f.tier(file) === 'T1' || file.startsWith('nvim/') && f.tier(file) === 'T2').sort());
});

test('integrated dev, explicit all and occasions retain process coverage', async () => {
  const f = repository;
  for (const [branch, requested, occasion] of [['dev', 'auto', undefined], ['t/T-713', 'all', undefined], ['dev', 'all', 'stage'], ['detached', 'all', 'batch']] as const) {
    const selection = occasionSelection(taskSuiteSelection({ mode: 'full', files: [], reason: 'full' }, branch, requested, true), occasion);
    const planned = await f.plan(selection);
    assert.ok(planned.includes('hub/test/scenarios/hub-lifecycle.test.ts'));
    assert.ok(planned.every(file => occasion ? occasion !== 'batch' || ['T1', 'T3'].includes(f.tier(file)) : f.tier(file) !== 'T4'));
  }
});


test('queue-disabled projects retain process coverage on task branches', async () => {
  const f = repository;
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
