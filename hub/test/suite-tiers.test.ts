// T2: in-process manifest/planner tests; no hub or process is started.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, glob } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hubShards, lintHubShards, packageShards, serializeTierManifest, type TierManifest } from '../src/suite-shards.ts';

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
    for (const source of Object.values(sources)) {
      await writeFile(join(root, path), source);
      await assert.rejects(lintHubShards(root), /T1 test touches machine resources/);
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

test('repository full plan preserves the legacy manifest phases, targets and worker counts', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  // Captured from shards.json at the task merge base; this fixed input outlives its deletion.
  const legacy = JSON.parse(await readFile(new URL('./fixtures/legacy-shards.json', import.meta.url), 'utf8')) as { tests: Record<string, string> };
  const expected = [
    { name: 'hub free', resource: 'free', workers: 1, targets: Object.keys(legacy.tests).filter(path => legacy.tests[path] === 'free').sort() },
    { name: 'hub machine', resource: 'machine', workers: 4, targets: Object.keys(legacy.tests).filter(path => legacy.tests[path] === 'machine').sort() },
    { name: 'Neovim', resource: 'machine', workers: 4, targets: ['nvim/test/**/*.test.ts'] },
  ];
  const actual = await packageShards(root, 'full', undefined, undefined, { workers: 4 });
  // Later tasks add files: compare the frozen baseline file set, and lint the whole live tree.
  const baseline = new Set(Object.keys(legacy.tests));
  assert.deepEqual(actual.map(phase => ({ ...phase, targets: phase.targets.filter(path => !path.startsWith('hub/') || baseline.has(path)) })), expected);
  const tiers = JSON.parse(await readFile(join(root, 'hub/test/tiers.json'), 'utf8'));
  const paths = [];
  for await (const path of glob(['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts', 'nvim/test/**/*.test.ts'], { cwd: root })) paths.push(path);
  assert.deepEqual(Object.keys(tiers.tests), paths.sort());
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
