// T1: concurrent public artifact creation with an in-memory Store and scripted filesystem.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { createArtifact } from '../src/hub/artifacts.ts';
import { Store } from '../src/hub/store.ts';
import { HubCore } from '../src/hub/core.ts';
import { FakeClock } from './fake-clock.ts';

test('reopening a topic preserves a hundred shared artifacts without announcing them again', async t => {
  const store = new Store(':memory:');
  const clock = new FakeClock();
  const events: Record<string, unknown>[] = [];
  let itemReads = 0;
  const check = () => { itemReads++; return {id: 'T-1', topic: 'topic-history', state: 'closed'}; };
  store.createTopic('topic-history', 'Retained history', 'T-1', clock.now().toISOString());
  const core = new HubCore({ store, clock, log: event => events.push(event), items: {
    lead: () => ({state: 'closed', claim: null}), provisionalSession: () => false,
    check, checkAsync: async () => check(), bind: async () => assert.fail('no new binding'),
  } });
  t.after(() => { core.close(); store.close(); });
  const topic = core.topics().find(row => row.id === 'topic-history')!;
  for (let n = 0; n < 120; n++) store.registerArtifact(id => ({
    id, kind: 'note', title: `History ${n}`, topic: topic.id, creator: 'implementer',
    time: clock.now().toISOString(), path: `/fixture/${n}.md`, status: 'shared',
  }), artifact => core.artifactChanged(artifact));
  const original = core.sendFromHuman(topic.id, 'Original artifact history', [], undefined, undefined, store.artifact('A-1')!).message;
  const artifacts = store.artifacts(topic.id);
  core.closeTopic(topic.id);
  events.length = 0;
  let subscriptionScans = 0;
  const allSubscriptions = store.allSubscriptions.bind(store);
  t.mock.method(store, 'allSubscriptions', () => { subscriptionScans++; return allSubscriptions(); });
  core.sendFromHuman(topic.id, 'Continue with the retained history');
  assert.equal(core.topics().find(row => row.id === topic.id)?.status, 'open');
  assert.equal(store.artifacts(topic.id).length, 120);
  assert.ok(store.artifacts(topic.id).every(artifact => artifact.status === 'shared'));
  assert.deepEqual(store.artifacts(topic.id), artifacts);
  assert.ok(core.topicHistory(topic.id).messages.some(message => message.id === original.id && message.artifact?.id === 'A-1'));
  assert.equal(events.filter(event => event.event === 'event-announced').length, 0);
  assert.equal(itemReads, 0, 'reopening a closed item topic performs no tracker stage reads');
  assert.ok(subscriptionScans <= 3, `chip-only retention does not scan subscriptions per artifact: ${subscriptionScans}`);
});

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
  const create = (title: string, content: string, publish = (id: string) => { published.push(id); }, retryKey?: string, identity = 'human') =>
    createArtifact(store, '/fixture', { type: 'artifact.create', id: title, kind: 'note', title, content, topic: 'general', ...(retryKey ? { retryKey } : {}) },
      { name: 'human', identity, cwd: '/fixture', kind: 'human', role: () => null },
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

test('inline content above 65536 UTF-8 bytes refuses before preparation; exact limit persists', async t => {
  const f = fixture(t);
  await assert.rejects(f.create('Too large', 'é'.repeat(32769)), /65536.*path/);
  assert.equal(f.files.size, 0);
  const artifact = await f.create('At limit', 'é'.repeat(32768));
  assert.equal(f.files.get(artifact.path)?.length, 65536);
});


test('retry receipts serialize concurrent calls, isolate identities and roll back with refused publication', async t => {
  const f = fixture(t);
  const create = () => f.create('Receipt', 'bytes', undefined, 'same-key');
  const [a, b] = await Promise.all([create(), create()]);
  assert.equal(a.id, b.id);
  assert.deepEqual(f.published, ['A-1']);
  const other = await f.create('Receipt', 'bytes', undefined, 'same-key', 'other');
  assert.equal(other.id, 'A-2');
  await assert.rejects(f.create('Rollback', 'bytes', () => { throw new Error('refused'); }, 'rollback'), /refused/);
  const accepted = await f.create('Rollback', 'bytes', undefined, 'rollback');
  assert.equal(accepted.id, 'A-3');
  assert.equal(f.files.size, 3);
});
