// Agents history through real hub frames and the spoke's MCP surface (T-56).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TopicMessage } from '../src/protocol.ts';
import { connectUi, spawnSpoke, startDaemon, tempProject, type FrameClient } from './harness.ts';

async function ok<T>(ui: FrameClient, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const r = await ui.request(frame);
  assert.equal(r.ok, true, `${frame.type}: ${r.error}`);
  return r.value as T;
}

test('Agents item history searches before the latest window and includes claims, releases and bound-topic traffic', async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nrate_limit_max = 1000\nloop_breaker_max = 1000\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { size: 'M', type: 'task.create', title: 'First', assignee: 'alpha' });
  await ok(ui, { size: 'M', type: 'task.create', title: 'Second' });
  const topic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'First topic', item: 'T-1' })).topic;
  const alpha = await spawnSpoke({ discover: true, cwd: root, name: 'alpha', sessionId: 'sess-alpha', role: 'implementer' });
  t.after(() => alpha.close());
  const beta = await spawnSpoke({ discover: true, cwd: root, name: 'beta', sessionId: 'sess-beta', role: 'reviewer' });
  t.after(() => beta.close());
  await beta.waitForPresence(['beta']);
  await alpha.waitForPresence(['alpha', 'beta']);
  const claimed = await alpha.call<{ ok: boolean }>('task.claim', { id: 'T-1' });
  assert.equal(claimed.ok, true, JSON.stringify(claimed));
  assert.equal((await alpha.call<{ ok: boolean }>('task.claim', { id: 'T-1', release: true })).ok, true);
  assert.equal((await alpha.call<{ ok: boolean }>('send', { topic: topic.id, to: ['beta'], text: 'please review' })).ok, true);
  for (let i = 0; i < 205; i++) {
    assert.equal((await alpha.call<{ ok: boolean }>('send', { to: ['beta'], text: `unrelated ${i}` })).ok, true);
  }
  const latest = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', limit: 200 });
  assert.equal(latest.messages.length, 200);
  assert.ok(latest.messages.every((m) => m.text.startsWith('unrelated')));
  const filtered = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', item: 'T-1', limit: 200 });
  assert.deepEqual(filtered.messages.map((m) => m.kind), ['event', 'claim', 'release', 'agent-message']);
  assert.equal(filtered.messages[0]?.text, 'event · task · T-1 status changed backlog → in progress');
  assert.deepEqual(filtered.messages[0]?.to, ['alpha']);
  assert.equal(filtered.messages[3]?.detail?.topic, topic.id);
  const spokeItem = await beta.call<{ messages: Array<{ msg_id: string }> }>('history', { topic: 'agents', item: 'T-1' });
  assert.deepEqual(spokeItem.messages.map((m) => m.msg_id), filtered.messages.map((m) => m.id));
  const limited = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', item: 'T-1', limit: 1 });
  assert.deepEqual(limited.messages.map((m) => m.id), [filtered.messages[3]?.id]);
  const none = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', item: 'T-2' });
  assert.deepEqual(none.messages, []);
});

test('session filters match sender, addressees and notice facts exactly; spoke item/session filters intersect', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { size: 'M', type: 'task.create', title: 'First', assignee: 'alpha' });
  await ok(ui, { size: 'M', type: 'task.create', title: 'Second', assignee: 'alpha-2' });
  const topic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'First topic', item: 'T-1' })).topic;
  const alpha = await spawnSpoke({ discover: true, cwd: root, name: 'alpha', sessionId: 'sess-alpha', role: 'implementer' });
  t.after(() => alpha.close());
  const other = await spawnSpoke({ discover: true, cwd: root, name: 'alpha-2', sessionId: 'sess-other', role: 'implementer' });
  t.after(() => other.close());
  await other.waitForPresence(['alpha-2']);
  const beta = await spawnSpoke({ discover: true, cwd: root, name: 'beta', sessionId: 'sess-beta', role: 'reviewer' });
  t.after(() => beta.close());
  await beta.waitForPresence(['beta']);
  await alpha.waitForPresence(['alpha', 'alpha-2', 'beta']);
  await alpha.call('task.claim', { id: 'T-1' });
  await other.call('task.claim', { id: 'T-2' });
  await alpha.call('send', { to: ['beta'], text: 'sent by alpha' });
  await beta.call('send', { to: ['alpha'], text: 'addressed to alpha' });
  await other.call('send', { to: ['beta'], text: 'only alpha-2' });
  await alpha.call('send', { topic: topic.id, to: ['beta'], text: 'in bound topic' });

  const session = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', session: 'alpha', limit: 200 });
  assert.deepEqual(session.messages.map((m) => m.kind), ['role-assign', 'event', 'claim', 'report', 'report', 'agent-message']);
  assert.deepEqual(session.messages.filter(m => m.kind === 'report').map(m => m.text), ['sent by alpha', 'addressed to alpha']);
  const both = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', item: 'T-1', session: 'alpha' });
  assert.deepEqual(both.messages.map((m) => m.kind), ['event', 'claim', 'agent-message']);
  assert.equal(both.messages[0]?.text, 'event · task · T-1 status changed backlog → in progress');
  assert.deepEqual(both.messages[0]?.to, ['alpha']);
  const recipient = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', item: 'T-1', session: 'beta' });
  assert.deepEqual(recipient.messages.map((m) => m.kind), ['agent-message']);
  const none = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'agents', item: 'T-1', session: 'alpha-2' });
  assert.deepEqual(none.messages, []);

  const spokeBoth = await beta.call<{ ok: boolean; messages: Array<{ msg_id: string }> }>('history', { topic: 'agents', item: 'T-1', session: 'alpha' });
  assert.equal(spokeBoth.ok, true);
  assert.deepEqual(spokeBoth.messages.map((m) => m.msg_id), both.messages.map((m) => m.id));
  const spokeSession = await beta.call<{ messages: Array<{ msg_id: string }> }>('history', { topic: 'agents', session: 'alpha' });
  assert.deepEqual(spokeSession.messages.map((m) => m.msg_id), session.messages.map((m) => m.id));
});
