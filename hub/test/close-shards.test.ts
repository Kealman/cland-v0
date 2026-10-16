import { serializeTierManifest } from '../src/suite-shards.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceCloseShards } from '../src/suite-shards.ts';

test('close shards balance largest hub files first, use median for unknowns and place Neovim on the lightest hub shard', () => {
  const result = balanceCloseShards(['a', 'b', 'c', 'd', 'unknown'], {
    a: { seconds: 10, tests: 1 }, b: { seconds: 8, tests: 1 }, c: { seconds: 6, tests: 1 }, d: { seconds: 4, tests: 1 },
    'nvim/test/editor.test.ts': { seconds: 3, tests: 1 },
  }, 2);
  assert.deepEqual(result, [
    { files: ['a', 'unknown'], hubSeconds: 16, nvim: true, seconds: 19 },
    { files: ['b', 'c', 'd'], hubSeconds: 18, nvim: false, seconds: 18 },
  ]);
});

test('close shards balance the combined hub and indivisible Neovim workload', () => {
  const files = ['a', 'b', 'c', 'd'];
  const durations = {
    a: { seconds: 10, tests: 1 }, b: { seconds: 10, tests: 1 }, c: { seconds: 10, tests: 1 }, d: { seconds: 10, tests: 1 },
    'nvim/test/editor.test.ts': { seconds: 12, tests: 1 },
    'nvim/test/thread.test.ts': { seconds: 8, tests: 1 },
  };
  for (const count of [1, 2, 3, 6]) {
    const result = balanceCloseShards(files, durations, count);
    assert.equal(result.length, count);
    assert.deepEqual(result.flatMap(shard => shard.files).sort(), files);
    assert.equal(result.filter(shard => shard.nvim).length, 1);
    assert.equal(result.reduce((sum, shard) => sum + shard.seconds, 0), 60);
    assert.equal(result.reduce((sum, shard) => sum + shard.hubSeconds, 0), 40);
    if (count === 2) assert.deepEqual(result.map(shard => shard.seconds), [30, 30]);
    if (count === 3) assert.deepEqual(result.map(shard => shard.seconds), [20, 20, 20]);
    assert.deepEqual(balanceCloseShards([...files].reverse(), durations, count), result);
  }
});

test('explicit shard files retain resource classes and include Neovim only on its assigned droplet', async t => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { packageShards } = await import('../src/suite-shards.ts');
  const root = await mkdtemp(join(tmpdir(), 'close-shard-selection-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'hub/test'), { recursive: true });
  for (const file of ['free', 'machine', 'other']) await writeFile(join(root, `hub/test/${file}.test.ts`), '');
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { 'hub/test/free.test.ts': 'T1', 'hub/test/machine.test.ts': 'T3', 'hub/test/other.test.ts': 'T3' } }));
  const files = ['hub/test/free.test.ts', 'hub/test/machine.test.ts'];
  assert.deepEqual(await packageShards(root, 'full', { files, nvim: false }), [
    { name: 'hub free', targets: ['hub/test/free.test.ts'], resource: 'free', workers: 1 },
    { name: 'hub machine', targets: ['hub/test/machine.test.ts'], resource: 'machine', workers: 4 },
  ]);
  assert.deepEqual((await packageShards(root, 'full', { files: [], nvim: true })).map(shard => shard.name), ['Neovim']);
  await assert.rejects(packageShards(root, 'full', { files: ['hub/test/missing.test.ts'], nvim: false }), /unknown explicit hub shard file/);
});
