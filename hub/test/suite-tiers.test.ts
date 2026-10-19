// T1: in-process manifest/planner tests; no hub or process is started.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hubShards, lintHubShards, packageShards, serializeTierManifest, type TierManifest } from '../src/suite-shards.ts';
import { occasionSelection, suiteTestEnv } from '../src/verification-occasion.ts';
import { planTierReport } from '../src/suite-tier-report.ts';
import { selectionTransport, selectionFromEnv, chooseSuiteMode } from '../src/suite-selection.ts';
import { skipT4LoadRepetitions, loadGateRepetitions } from '../src/suite-load-gate-plan.ts';

test('large stage identity baselines reach the runner through a file instead of an environment value', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-selection-file-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const selection = { mode: 'full' as const, files: [], reason: 'stage', soak: true,
    loadGateBaseline: { run: 'previous-stage', tests: Array.from({ length: 6000 }, (_, n) => `hub/test/example.test.ts::known stage identity ${n}`) } };
  const transport = selectionTransport(selection, join(root, 'selection.json'));
  assert.ok(transport.file);
  assert.ok(JSON.stringify(transport.env).length < 1024, 'the environment contains only a short file path');
  await writeFile(transport.env.CLAND_SUITE_SELECTION_FILE!, transport.file);
  assert.deepEqual(selectionFromEnv(transport.env), selection);
});

test('occasions preserve their tier and load policies', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-occasion-plan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tests: TierManifest['tests'] = {
    'hub/test/component.test.ts': 'T2', 'hub/test/integration.test.ts': 'T3',
    'hub/test/soak.test.ts': 'T4', 'hub/test/unit.test.ts': 'T1',
    'nvim/test/component.test.ts': 'T2', 'nvim/test/editor.test.ts': 'T3', 'nvim/test/soak.test.ts': 'T4',
  };
  for (const file of Object.keys(tests)) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), '');
  }
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests }));
  const full = { mode: 'full' as const, files: [], reason: 'all' };
  for (const [executor, occasion] of [['local', undefined], ['droplet', undefined], ['local', 'batch'], ['droplet', 'batch'], ['droplet', 'dev-t3'], ['local', 'stage'], ['droplet', 'stage'], ['droplet', 'epic'], ['local', 'release'], ['droplet', 'soak']] as const) {
    const selection = occasionSelection(full, occasion);
    const phases = await packageShards(root, selection.mode, undefined, selection, { executor, workers: 4 });
    const plan = await planTierReport(root, selection, 4, phases);
    const tiers = occasion === 'dev-t3' ? ['T2', 'T3'] : occasion === 'batch' ? ['T1', 'T3'] : occasion ? ['T1', 'T2', 'T3', 'T4'] : ['T1', 'T2', 'T3'];
    assert.deepEqual(plan.flatMap(row => row.files).sort(), Object.keys(tests).filter(file => tiers.includes(tests[file] as string)).sort());
    assert.deepEqual(plan.map(row => row.tier), tiers);
    assert.equal(suiteTestEnv(selection, { CLAND_TEST_SOAK: '1' }).CLAND_TEST_SOAK, occasion && occasion !== 'batch' && occasion !== 'dev-t3' ? '1' : undefined);
    assert.equal(selection.loadGate, occasion === 'dev-t3' ? false : occasion ? true : undefined);
    const gated = skipT4LoadRepetitions(selection, plan);
    for (const file of occasion === 'dev-t3' ? [] : Object.keys(tests)) {
      assert.equal(loadGateRepetitions(`${file}::new`, gated, {}), occasion && occasion !== 'batch' && tests[file] === 'T4' ? 0 : 5, `${occasion}: ${file}`);
    }
    if (occasion && occasion !== 'batch' && occasion !== 'dev-t3') assert.match(gated.reason, /T4 repetitions skipped; 2 files run in base phase only/);
  }
});

test('verification admission infrastructure selects the full suite', () => {
  for (const path of ['hub/src/test-lint-policy.ts', 'hub/src/hub/suite-candidate.ts']) assert.equal(chooseSuiteMode([path]), 'full', path);
});

test('tier manifest covers hub and Neovim without changing package resource phases', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-tiers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tests: TierManifest['tests'] = {
    'hub/src/one.test.ts': 'T1',
    'hub/test/two.test.ts': 'T2',
    'hub/test/three.test.ts': { tier: 'T3', contract: 'codex' },
    'hub/test/four.test.ts': 'T4',
    'nvim/test/editor.test.ts': 'T3',
  };
  for (const file of Object.keys(tests)) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), '');
  }
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests }));
  await lintHubShards(root);
  assert.deepEqual(await hubShards(root, false, 6), [
    { name: 'hub free', resource: 'free', workers: 1, targets: ['hub/src/one.test.ts'] },
    { name: 'hub machine', resource: 'machine', workers: 6, targets: ['hub/test/four.test.ts', 'hub/test/three.test.ts', 'hub/test/two.test.ts'] },
  ]);
});

async function fixture(t: import('node:test').TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-tier-lint-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  for (const path of ['hub/test/a.test.ts', 'nvim/test/z.test.ts']) await writeFile(join(root, path), '');
  const write = (tests: Record<string, unknown>) => writeFile(join(root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests }));
  return { root, write };
}

test('tier lint refuses unclassified, missing, invalid and unsorted paths', async t => {
  const { root, write } = await fixture(t);
  const valid = { 'hub/test/a.test.ts': 'T1', 'nvim/test/z.test.ts': 'T3' };
  const cases: Array<[Record<string, unknown>, RegExp, string]> = [
    [{ 'hub/test/a.test.ts': 'T1' }, /unclassified tests/, 'nvim/test/z.test.ts'],
    [{ ...valid, 'nvim/test/zz.test.ts': 'T3' }, /missing test/, 'nvim/test/zz.test.ts'],
    [{ ...valid, 'hub/test/a.test.ts': 'T5' }, /invalid tier/, 'hub/test/a.test.ts'],
    [{ 'nvim/test/z.test.ts': 'T3', 'hub/test/a.test.ts': 'T1' }, /not sorted by path: hub\/test\/a.test.ts/, 'hub/test/a.test.ts'],
  ];
  for (const invalid of [null, [], {}, { tier: 'T3' }, { tier: 'T3', contract: '' }, { tier: 'T3', scenario: ' ' }, { tier: 'T3', contract: 1 }, { tier: 'T3', scenario: 'x', extra: true }, { tier: 'T3', contract: 'x', scenario: 'x' }, { tier: 'T2', contract: 'x' }]) {
    cases.push([{ ...valid, 'hub/test/a.test.ts': invalid }, /invalid tier/, 'hub/test/a.test.ts']);
  }
  for (const [tests, message, file] of cases) {
    await write(tests);
    await assert.rejects(lintHubShards(root), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, message);
      assert.deepEqual((error as { files?: string[] }).files, [file]);
      return true;
    });
  }
  await writeFile(join(root, 'hub/test/tiers.json'), '{');
  await assert.rejects(lintHubShards(root), /invalid test manifest JSON/);
  for (const manifest of [null, [], {}, { version: 2, tests: valid }, { version: 1, tests: [] }]) {
    await writeFile(join(root, 'hub/test/tiers.json'), JSON.stringify(manifest));
    await assert.rejects(lintHubShards(root), /invalid test manifest/);
  }
  await write({ 'hub/test/a.test.ts': { tier: 'T3', scenario: 'manifest' }, 'nvim/test/z.test.ts': 'T4' });
  await lintHubShards(root);
});

test('T1 retains the hermetic source check in each package', async t => {
  const { root, write } = await fixture(t);
  const sources = JSON.parse(await readFile(new URL('./fixtures/tier-sources.json', import.meta.url), 'utf8')) as Record<string, string>;
  for (const path of ['hub/test/a.test.ts', 'nvim/test/z.test.ts']) {
    await write({ 'hub/test/a.test.ts': 'T1', 'nvim/test/z.test.ts': 'T1' });
    for (const [name, source] of Object.entries(sources)) {
      await writeFile(join(root, path), source);
      // Legacy word-only cases are inert data; actual imports/calls still refuse.
      if (name === 'lock' || name === 'editor') await lintHubShards(root);
      else await assert.rejects(lintHubShards(root), /T1 test touches machine resources/);
    }
    await writeFile(join(root, path), path.startsWith('hub/') ? "import { FakeClock } from './fake-clock.ts'; import { fakeHarness } from './fakes/harness.ts'; const clock = new FakeClock(); clock.setTimeout(() => {}, 5);" : "import { FakeClock } from '../../hub/test/fake-clock.ts'; const clock = new FakeClock(); clock.setInterval(() => {}, 5);");
    await lintHubShards(root);
    await writeFile(join(root, path), '');
  }
});

test('manifest serialization sorts a newly added path before existing paths', async t => {
  const { root } = await fixture(t);
  const tests: TierManifest['tests'] = { 'nvim/test/z.test.ts': 'T3' };
  tests['hub/test/a.test.ts'] = 'T1';
  const text = serializeTierManifest({ version: 1, tests });
  assert.deepEqual(Object.keys(JSON.parse(text).tests), ['hub/test/a.test.ts', 'nvim/test/z.test.ts']);
  await writeFile(join(root, 'hub/test/tiers.json'), text);
  await lintHubShards(root);
});

test('legacy manifest preserves its recorded phases, targets and worker counts', async t => {
  // This fixed input proves legacy runner compatibility after live tier migrations.
  const legacy = JSON.parse(await readFile(new URL('./fixtures/legacy-shards.json', import.meta.url), 'utf8')) as { tests: Record<string, string> };
  const root = await mkdtemp(join(tmpdir(), 'cland-legacy-plan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(Object.keys(legacy.tests).map(async path => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), '');
  }));
  await writeFile(join(root, 'hub/test/shards.json'), JSON.stringify(legacy));
  assert.deepEqual(await packageShards(root, 'full', undefined, undefined, { workers: 4 }), [
    { name: 'hub free', resource: 'free', workers: 1, targets: Object.keys(legacy.tests).filter(path => legacy.tests[path] === 'free').sort() },
    { name: 'hub machine', resource: 'machine', workers: 4, targets: Object.keys(legacy.tests).filter(path => legacy.tests[path] === 'machine').sort() },
    { name: 'Neovim', resource: 'machine', workers: 4, targets: ['nvim/test/**/*.test.ts'] },
  ]);
});

test('tiers take priority over a leftover legacy manifest without masking tier faults', async t => {
  const { root, write } = await fixture(t);
  await writeFile(join(root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: {} }));
  await write({ 'hub/test/a.test.ts': 'T2', 'nvim/test/z.test.ts': 'T3' });
  await lintHubShards(root);
  assert.deepEqual((await hubShards(root)).map(phase => phase.resource), ['machine']);
  await write({ 'hub/test/a.test.ts': 'T5', 'nvim/test/z.test.ts': 'T3' });
  await assert.rejects(lintHubShards(root), /invalid tier/);
  await writeFile(join(root, 'hub/test/tiers.json'), '{');
  await assert.rejects(lintHubShards(root), /invalid test manifest JSON/);
});

test('a package without either manifest keeps its existing Neovim-only plan', async t => {
  const { root } = await fixture(t);
  await rm(join(root, 'hub/test/a.test.ts'));
  await lintHubShards(root);
  assert.deepEqual(await packageShards(root, 'full', undefined, undefined, { workers: 4 }), [
    { name: 'Neovim', resource: 'machine', workers: 4, targets: ['nvim/test/**/*.test.ts'] },
  ]);
});

test('duration lint uses supplied legacy keys for package planning and rejects unrecorded allowances', async t => {
  const { root, write } = await fixture(t);
  await write({ 'hub/test/a.test.ts': 'T1', 'nvim/test/z.test.ts': 'T3' });
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/E-677-fixture.md'), '---\nid: E-677\nkind: epic\ntitle: Allowance owner\nstate: open\n---\n');
  const key = 'hub/test/a.test.ts::recorded';
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({
    version: 1, source: { artifacts: [], commit: 'fixture' },
    budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {},
    allow: { [key]: { seconds: 6, owner: 'E-677', legacy: true, reason: 'Recorded before tier budgets.' } },
  }));
  const history = { legacyKeys: new Set([key]) };
  assert.deepEqual((await packageShards(root, 'full', undefined, undefined, { workers: 4, ...history })).map(phase => phase.name), ['hub free', 'Neovim']);
  await assert.doesNotReject(lintHubShards(root, history));
  await assert.rejects(lintHubShards(root, { legacyKeys: new Set() }), /new duration allowance cannot be legacy/);
});

test('test:tiers refuses an open task allowance with its line and open epic replacement', async t => {
  const { root, write } = await fixture(t);
  await write({ 'hub/test/a.test.ts': 'T1', 'nvim/test/z.test.ts': 'T3' });
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/T-761-fixture.md'), '---\nid: T-761\nkind: task\ntitle: Implementing task\nstate: open\nparent: E-482\n---\n');
  await writeFile(join(root, '.cland/tasks/E-482-fixture.md'), '---\nid: E-482\nkind: epic\ntitle: Allowance owner\nstate: open\n---\n');
  // Admission uses today's date; keep this allowance valid whenever the test runs.
  const today = new Date().toISOString().slice(0, 10);
  const expires = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);
  const key = 'hub/test/a.test.ts::temporary migration';
  const manifest = {
    version: 1, source: { artifacts: [], commit: 'fixture' },
    budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: { [key]: 6 },
    allow: {
      'hub/test/a.test.ts::existing': { seconds: 6, reason: key, owner: 'E-482', added: today, expires },
      [key]: { seconds: 6, owner: 'T-761', added: today, expires, reason: 'Temporary component migration.' },
    },
  };
  const source = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(join(root, 'hub/test/durations.json'), source);
  const line = source.split('\n').findIndex(line => line.includes('"owner": "T-761"')) + 1;
  await assert.rejects(lintHubShards(root, { legacyKeys: new Set() }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes(`hub/test/durations.json:${line}`), error.message);
    assert.match(error.message, /task owner T-761/);
    assert.match(error.message, /open epic owner.*E-482/);
    assert.ok(error.message.includes(key), error.message);
    return true;
  });
});

test('duration owners follow container state through the E-677 to E-482 transition', async t => {
  const { root, write } = await fixture(t);
  await write({ 'hub/test/a.test.ts': 'T1', 'nvim/test/z.test.ts': 'T3' });
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  const item = (id: string, kind: string, state = 'open') => writeFile(join(root, `.cland/tasks/${id}-fixture.md`), `---\nid: ${id}\nkind: ${kind}\ntitle: Allowance owner\nstate: ${state}\n---\n`);
  const today = new Date().toISOString().slice(0, 10);
  const expires = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);
  const allowance = { seconds: 6, owner: 'E-677', added: today, expires, reason: 'Temporary component migration.' };
  const manifest = { version: 1, source: { artifacts: [], commit: 'fixture' },
    budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {},
    allow: { 'hub/test/a.test.ts::temporary migration': allowance } };
  const save = () => writeFile(join(root, 'hub/test/durations.json'), JSON.stringify(manifest));
  for (const [id, kind] of [['E-677', 'epic'], ['R-577', 'release'], ['C-100', 'category'], ['T-761', 'epic']] as const) {
    await item(id, kind);
    allowance.owner = id;
    await save();
    await assert.doesNotReject(lintHubShards(root, { legacyKeys: new Set() }), `${kind} owners are accepted by kind, including old T-prefixed containers`);
  }
  allowance.owner = 'E-677';
  await save();
  await item('E-677', 'epic', 'closed');
  await assert.rejects(lintHubShards(root, { legacyKeys: new Set() }), /closed owner E-677/);
  await item('E-482', 'epic');
  allowance.owner = 'E-482';
  await save();
  await assert.doesNotReject(lintHubShards(root, { legacyKeys: new Set() }));
});
