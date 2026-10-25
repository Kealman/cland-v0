// T1: concurrent public artifact creation with an in-memory Store and scripted filesystem.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { createArtifact } from '../src/hub/artifacts.ts';
import { Store } from '../src/hub/store.ts';

function fixture(t: TestContext) {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const files = new Map<string, Buffer>();
  t.mock.method(fs, 'mkdir', async () => undefined);
  t.mock.method(fs, 'open', async (path: string) => {
    assert.equal(files.has(path), false, `exclusive artifact path: ${path}`);
    files.set(path, Buffer.alloc(0));
    return {
      writeFile: async (bytes: Buffer) => { files.set(path, Buffer.from(bytes)); },
      close: async () => {},
    };
  });
  t.mock.method(fs, 'rm', async (path: string) => { files.delete(path); });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const published: string[] = [];
  const create = (title: string, content: string, publish = (id: string) => { published.push(id); }) =>
    createArtifact(store, '/fixture', { type: 'artifact.create', id: title, kind: 'note', title, content, topic: 'general' },
      { name: 'human', cwd: '/fixture', kind: 'human', role: () => null },
      artifact => publish(artifact.id), work => work(), () => {}, async () => { throw new Error('no source read expected'); });
  return { store, files, published, create };
}

test('concurrent artifact creates register distinct ids with intact bytes and no orphan files', async t => {
  const f = fixture(t);
  // Both calls enter before either asynchronous open/write can finish. On the
  // broken implementation both prepare A-1, then one registration fails.
  const results = await Promise.allSettled([f.create('First', 'first bytes'), f.create('Second', 'second bytes')]);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'fulfilled'],
    results.map(result => result.status === 'rejected' ? String(result.reason) : result.value.id).join('\n'));
  const artifacts = f.store.artifacts();
  assert.deepEqual(artifacts.map(artifact => artifact.id), ['A-1', 'A-2']);
  assert.deepEqual(artifacts.map(artifact => f.files.get(artifact.path)?.toString()), ['first bytes', 'second bytes']);
  assert.deepEqual([...f.files.keys()], artifacts.map(artifact => artifact.path), 'every prepared file is registered');
  assert.deepEqual(f.published, ['A-1', 'A-2']);
});

test('a refused publication cleans its bytes before the next queued create reuses the id', async t => {
  const f = fixture(t);
  const results = await Promise.allSettled([
    f.create('Same title', 'refused bytes', () => { throw new Error('publication refused'); }),
    f.create('Same title', 'accepted bytes'),
  ]);
  assert.equal(results[0]!.status, 'rejected');
  assert.match(String((results[0] as PromiseRejectedResult).reason), /publication refused/);
  assert.equal(results[1]!.status, 'fulfilled');
  const artifacts = f.store.artifacts();
  assert.deepEqual(artifacts.map(artifact => artifact.id), ['A-1']);
  assert.deepEqual([...f.files.keys()], artifacts.map(artifact => artifact.path));
  assert.equal(f.files.get(artifacts[0]!.path)?.toString(), 'accepted bytes');
  assert.deepEqual(f.published, ['A-1']);
});
