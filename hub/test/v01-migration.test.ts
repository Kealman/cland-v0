// T2: the migration executable is the CLI subject; projectHub serves in-process.
// Its nested task commands use the real parser/socket client through a preload.
// This keeps the migration contract without paying one Node startup per link.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clandCliLaunch } from './tier-cli.ts';
import { writeFixture } from '../src/cli/qa-fixture.ts';
import { connectUi, readDiscovery, projectHub, tempProject } from './harness.ts';

type Item = { id: string; kind: string; version?: string; state: string; parent: string | null };
const entry = fileURLToPath(new URL('../bin/migrate-v01-release.ts', import.meta.url));
const preload = fileURLToPath(new URL('./v01-migration-cli-preload.ts', import.meta.url));
const migrate = (cwd: string): Promise<{ code: number; stdout: string; stderr: string }> => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_')));
  return new Promise((resolve, reject) => clandCliLaunch(() => execFile(process.execPath, ['--import', preload, entry], { cwd, env, timeout: 30_000 }, (error, stdout, stderr) => {
    if (error && typeof error.code !== 'number') reject(error);
    else resolve({ code: error ? error.code as number : 0, stdout, stderr });
  })));
};

async function fixture(t: import('node:test').TestContext, migrated = false) {
  // Only E-19 and E-107..117 affect migration. Keeping their exact ids also
  // preserves allocation of R-118/R-119 without creating 105 unrelated tasks.
  const dir = await tempProject(t);
  const ids = [19, ...Array.from({ length: 11 }, (_, index) => 107 + index)];
  const items: Array<Record<string, unknown>> = ids.map(n => ({
    id: `E-${n}`, kind: 'epic', title: `Item ${n}`, labels: n >= 107 ? ['v0.1'] : [],
    parent: migrated && n >= 107 ? 'R-118' : null,
  }));
  if (migrated) items.push({ id: 'R-118', kind: 'release', title: 'Release: v0.1', version: '0.1.0', labels: ['v0.1'], body: 'Existing release notes must stay unchanged.' });
  const root = writeFixture({ dir, project: 'migration', items });
  await projectHub(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  const list = async (): Promise<Item[]> => {
    const result = await ui.request({ type: 'task.list' });
    assert.equal(result.ok, true, result.error);
    return (result.value as { items: Item[] }).items;
  };
  assert.equal((await list()).length, migrated ? 13 : 12, 'validated fixture keeps every migration-relevant identity');
  return { root, ui, list };
}

test('migration CLI creates the exact release and parents only the eleven v0.1 epics', async t => {
  const { root, list } = await fixture(t);
  const first = await migrate(root);
  assert.equal(first.code, 0, first.stderr);
  const initial = await list();
  const releases = initial.filter(item => item.kind === 'release');
  assert.equal(releases.length, 1);
  assert.equal(releases[0]?.version, '0.1.0');
  assert.deepEqual(initial.filter(item => Number(item.id.slice(2)) >= 107 && item.kind === 'epic').map(item => item.parent), Array(11).fill('R-118'));
  const v0 = initial.find(item => item.id === 'E-19');
  assert.equal(v0?.state, 'open');
  assert.equal(v0?.parent, null);
});

test('migration CLI reuses the open release without rewriting migrated items', async t => {
  const { root, list } = await fixture(t, true);
  const initial = await list();
  const second = await migrate(root);
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /reuse R-118/);
  assert.deepEqual(await list(), initial, 'rerun does not create or rewrite items');
});

test('migration CLI refuses duplicate releases before changing any items', async t => {
  const { root, ui, list } = await fixture(t, true);
  assert.equal((await ui.request({ type: 'task.create', title: 'Duplicate', kind: 'release', version: '0.1.0' })).ok, true);
  const before = await list();
  const duplicate = await migrate(root);
  assert.equal(duplicate.code, 1);
  assert.match(duplicate.stderr, /multiple open releases.*R-118.*R-119/);
  assert.deepEqual(await list(), before, 'duplicate refusal changes nothing');
});
