// T2: Agents filtering rules over real socket edges and in-process peers; client screens in nvim/test/agents-filters.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TopicMessage } from '../src/protocol.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject, type FrameClient } from './harness.ts';
async function ok<T>(ui: FrameClient, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const r = await ui.request(frame);
  assert.equal(r.ok, true, r.error);
  return r.value as T;
}

test('Agents item and session histories retain claims, releases and bound-topic notices', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { size: 'M', type: 'task.create', title: 'First', assignee: 'alpha' });
  await ok(ui, { size: 'M', type: 'task.create', title: 'Second', assignee: 'other' });
  const topic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'First topic', item: 'T-1' })).topic;
  const alpha = await inProcessSpoke(t, { discover: true, cwd: root, name: 'alpha', sessionId: 'sess-alpha', role: 'implementer' });
  t.after(() => alpha.close());
  const other = await inProcessSpoke(t, { discover: true, cwd: root, name: 'other', sessionId: 'sess-other', role: 'implementer' });
  t.after(() => other.close());
  const beta = await inProcessSpoke(t, { discover: true, cwd: root, name: 'beta', sessionId: 'sess-beta', role: 'reviewer' });
  t.after(() => beta.close());
  await alpha.waitForPresence(['alpha', 'other', 'beta']);
  await alpha.call('task.claim', { id: 'T-1' });
  await other.call('task.claim', { id: 'T-2' });
  await beta.call('send', { to: ['alpha'], text: 'message to alpha' });
  await alpha.call('send', { topic: topic.id, to: ['beta'], text: 'in first topic' });
  await other.call('task.claim', { id: 'T-2', release: true });
  await alpha.call('task.claim', { id: 'T-1', release: true });
  await other.call('send', { to: ['beta'], text: 'only other' });
  await alpha.call('send', { to: ['beta'], text: 'live from alpha' });
  const item = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', item: 'T-1' });
  assert.ok(item.messages.some(m => m.kind === 'claim'));
  assert.ok(item.messages.some(m => m.kind === 'release'));
  assert.ok(item.messages.some(m => m.kind === 'agent-message' && m.detail?.topic === topic.id));
  assert.ok(item.messages.every(m => !m.text.includes('T-2') && m.text !== 'message to alpha'));
  const session = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', session: 'alpha' });
  assert.ok(session.messages.some(m => m.text === 'message to alpha'));
  assert.ok(session.messages.some(m => m.text === 'live from alpha'));
  assert.ok(session.messages.every(m => m.text !== 'only other' && !m.text.includes('T-2')));

});

test('a session named loop excludes another pair’s loop metadata in live entries, frames and spoke history', async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nloop_breaker_max = 1\n');
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const loop = await inProcessSpoke(t, { discover: true, cwd: root, name: 'loop', sessionId: 'sess-loop', role: 'implementer' });
  t.after(() => loop.close());
  const alpha = await inProcessSpoke(t, { discover: true, cwd: root, name: 'alpha', sessionId: 'sess-alpha', role: 'implementer' });
  t.after(() => alpha.close());
  const beta = await inProcessSpoke(t, { discover: true, cwd: root, name: 'beta', sessionId: 'sess-beta', role: 'reviewer' });
  t.after(() => beta.close());
  await loop.waitForPresence(['loop', 'alpha', 'beta']);
  await alpha.call('send', { to: ['beta'], text: 'first' });
  await alpha.call('send', { to: ['beta'], text: 'trip loop breaker' });
  await loop.call('send', { to: ['beta'], text: 'loop sentinel' });
  const history = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', session: 'loop' });
  assert.deepEqual(history.messages.map((m) => m.kind), ['role-assign', 'report']);
  assert.deepEqual(history.messages.filter(m => m.kind === 'report').map(m => m.text), ['loop sentinel']);
  const spoke = await beta.call<{ messages: Array<{ msg_id: string }> }>('history', { topic: 'agents', session: 'loop' });
  assert.deepEqual(spoke.messages.map((m) => m.msg_id), history.messages.map((m) => m.id));
});
