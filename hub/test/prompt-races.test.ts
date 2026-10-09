import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, startHub, tempProject, TEST_SECRET } from './harness.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import type { Artifact, TopicMessage } from '../src/protocol.ts';

for (const order of ['archive-first', 'send-first', 'delete-topic-first', 'delete-file-first', 'status-failure'] as const) {
  test(`prompt send ${order}: preparation rechecks current state and the post/status commit together`, async t => {
    const root = await tempProject(t);
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const reading = new Promise<void>(r => { entered = r; });
    const hub = await startHub({
      readArtifact: async path => { const content = await readFile(path); entered(); await gate; return content; },
      control: { status: () => ({ pid: process.pid, port: 0, socket: '', version: 'test', root, startedAt: new Date().toISOString(), uptimeMs: 0 }), stop: () => {} },
    });
    t.after(() => hub.close());
    const socket = join(root, 'hub.sock');
    const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
    t.after(() => edge.close());
    const ui = await connectUi(t, { socket, secret: TEST_SECRET });
    const topic = (await ui.request({ type: 'topic.create', title: 'Draft work' })).value as { topic: { id: string } };
    const a = ((await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Brief', topic: topic.topic.id, content: 'Work to do', status: 'draft' })).value as { artifact: Artifact }).artifact;
    const published: TopicMessage[] = [];
    hub.core.subscribe(e => { if (e.type === 'message') published.push(e.message); });
    const sending = ui.request({ type: 'prompt.send', artifact: a.id });
    await reading;
    if (order === 'archive-first') hub.core.store.updateArtifact({ ...a, status: 'archived' });
    if (order === 'delete-file-first') await rm(a.path);
    if (order === 'delete-topic-first') await ui.request({ type: 'topic.delete', topic: a.topic });
    if (order === 'status-failure') t.mock.method(hub.core.store, 'updateArtifact', () => { throw new Error('status write failed'); });
    release();
    const result = await sending;
    if (order === 'send-first') {
      assert.equal(result.ok, true, result.error);
      assert.equal(hub.core.store.artifact(a.id)?.status, 'sent');
      hub.core.store.updateArtifact({ ...a, status: 'archived' });
      assert.equal(published.filter(m => m.artifacts?.[0]?.id === a.id).length, 1);
      const history = (await ui.request({ type: 'topic.history', topic: a.topic })).value as { messages: TopicMessage[] };
      assert.equal(history.messages[0]?.artifacts?.[0]?.status, 'sent');
    } else {
      assert.equal(result.ok, false);
      assert.equal(published.filter(m => m.artifacts?.[0]?.id === a.id).length, 0, 'nothing delivered before the transaction succeeds');
      assert.equal(hub.core.store.artifact(a.id)?.status, order === 'archive-first' ? 'archived' : 'draft');
      if (order === 'status-failure') {
        const history = (await ui.request({ type: 'topic.history', topic: a.topic })).value as { messages: TopicMessage[] };
        assert.deepEqual(history.messages, [], 'the stored post rolled back too');
      }
    }
  });
}

test('artifact creation rechecks its topic after deferred file preparation and frees its id on refusal', async t => {
  const root = await tempProject(t);
  const { writeFile, readdir } = await import('node:fs/promises');
  const source = join(root, 'brief.md');
  await writeFile(source, 'Brief source');
  let entered!: () => void;
  let release!: () => void;
  const reading = new Promise<void>(r => { entered = r; });
  const gate = new Promise<void>(r => { release = r; });
  const hub = await startHub({
    readArtifact: async path => { const content = await readFile(path); entered(); await gate; return content; },
    control: { status: () => ({ pid: process.pid, port: 0, socket: '', version: 'test', root, startedAt: new Date().toISOString(), uptimeMs: 0 }), stop: () => {} },
  });
  t.after(() => hub.close());
  const socket = join(root, 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const ui = await connectUi(t, { socket, secret: TEST_SECRET });
  const topic = ((await ui.request({ type: 'topic.create', title: 'Temporary' })).value as { topic: { id: string } }).topic.id;
  const creating = ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Brief', topic, path: source, status: 'draft' });
  await reading;
  await ui.request({ type: 'topic.delete', topic });
  release();
  const refused = await creating;
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /no such artifact topic/);
  assert.deepEqual(hub.core.store.artifacts(), []);
  const next = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Next', topic: 'general', content: 'Next brief', status: 'draft' });
  assert.equal(next.ok, true, next.error);
  const artifact = (next.value as { artifact: Artifact }).artifact;
  assert.equal(artifact.id, 'A-1');
  assert.deepEqual(await readdir(join(root, '.cland/artifacts')), ['A-1-next.md']);
});
