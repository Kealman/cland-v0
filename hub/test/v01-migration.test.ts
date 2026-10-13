// The one-off repository migration, executed against a real temporary hub through its CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connectUi, readDiscovery, startDaemon, tempProject } from './harness.ts';

type Item = { id: string; kind: string; version?: string; state: string; parent: string | null };
const entry = fileURLToPath(new URL('../bin/migrate-v01-release.ts', import.meta.url));
const migrate = (cwd: string): Promise<{ code: number; stdout: string; stderr: string }> => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_')));
  return new Promise((resolve, reject) => execFile(process.execPath, [entry], { cwd, env, timeout: 30_000 }, (error, stdout, stderr) => {
    if (error && typeof error.code !== 'number') reject(error);
    else resolve({ code: error ? error.code as number : 0, stdout, stderr });
  }));
};

test('the v0.1 migration creates once, reuses the open release on rerun and refuses duplicate matches before writing', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  const list = async (): Promise<Item[]> => {
    const result = await ui.request({ type: 'task.list' });
    assert.equal(result.ok, true, result.error);
    return (result.value as { items: Item[] }).items;
  };
  for (let n = 1; n <= 117; n++) {
    const kind = n === 19 || n >= 107 ? 'epic' : 'task';
    const result = await ui.request({ type: 'task.create', title: `Item ${n}`, kind, labels: n >= 107 ? ['v0.1'] : [] });
    assert.equal(result.ok, true, result.error);
  }
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
  const second = await migrate(root);
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /reuse R-118/);
  assert.deepEqual(await list(), initial, 'rerun does not create or rewrite items');
  assert.equal((await ui.request({ type: 'task.create', title: 'Duplicate', kind: 'release', version: '0.1.0' })).ok, true);
  const before = await list();
  const duplicate = await migrate(root);
  assert.equal(duplicate.code, 1);
  assert.match(duplicate.stderr, /multiple open releases.*R-118.*R-119/);
  assert.deepEqual(await list(), before, 'duplicate refusal changes nothing');
});
