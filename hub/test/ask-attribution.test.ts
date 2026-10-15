import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TopicMessage } from '../src/protocol.ts';
import { cland, clandWithEnv, connectUi, flushProjectLogs, projectHub, spawnSpoke, tempProject } from './harness.ts';

test('human shell answers retain their attribution in history, task view and the journal', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const created = await coord.call<{ item: { id: string } }>('task.create', { title: 'Decision', size: 'S' });
  const { topic } = await coord.call<{ topic: { id: string } }>('topic.create', { item: created.item.id, title: 'Decision' });
  const asked = await coord.call<{ ask: string }>('ask', { topic: topic.id, question: 'Which option?', options: ['Keep it', 'Change it'] });
  const answered = await cland(root, 'topic', 'answer', asked.ask, '1');
  assert.equal(answered.code, 0, answered.stderr);
  const history = (await ui.request({ type: 'topic.history', topic: topic.id })).value as { messages: TopicMessage[] };
  const question = history.messages.find(m => m.id === asked.ask)!;
  const answer = history.messages.find(m => m.answerTo === asked.ask)!;
  assert.equal(question.ask!.answered_as, 'human');
  assert.equal(answer.answered_as, 'human');
  assert.equal(answer.answered_by, undefined);
  const view = await cland(root, 'task', 'view', created.item.id, '--json');
  assert.equal(view.code, 0, view.stderr);
  assert.deepEqual(JSON.parse(view.stdout).item.answers, [{ ask: asked.ask, answer: answer.id, answered_as: 'human' }]);
  assert.match((await cland(root, 'task', 'view', created.item.id)).stdout, /answered_as human/);
  await flushProjectLogs(t, root);
  const journal = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(journal.some(e => e.event === 'ask-answered' && e.id === asked.ask && e.answered_as === 'human'));
});


test('named human-shell stand-ins keep their origin through relays and hub restart; hub sessions cannot answer', async t => {
  const root = await tempProject(t);
  const first = await projectHub(t, root);
  const ui = await connectUi(t, first.discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'helper', role: 'aide', sessionId: 'aide-id' });
  for (const s of [coord, impl, aide]) t.after(() => s.close());
  await coord.waitForPresence(['coord', 'impl', 'helper']);
  const history = async () => (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  await impl.call('send', { topic: 'general', to: ['coordinator'], kind: 'question', text: 'Retain compatibility?' });
  const original = (await history()).messages.find(m => m.text === 'Retain compatibility?')!;
  const forwarded = await coord.call<{ ask: string }>('ask.forward', { ask: original.id });
  for (const [name, sessionId] of [['coord', 'coord-id'], ['impl', 'impl-id'], ['helper', 'aide-id']]) {
    const refused = await clandWithEnv(root, { CLAND_SESSION_NAME: name!, CLAND_SESSION_ID: sessionId! }, 'topic', 'answer', forwarded.ask, '--as', 'cland-impl', '--text', 'Bypass');
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /forbidden: topic.answer/);
  }
  const bad = await cland(root, 'topic', 'answer', forwarded.ask, '--text', 'Keep it', '--as', 'Bad Name');
  assert.equal(bad.code, 1);
  assert.equal((await history()).messages.find(m => m.id === forwarded.ask)!.ask!.state, 'open');
  const answered = await cland(root, 'topic', 'answer', forwarded.ask, '--as', 'cland-impl', '--text', 'Keep it');
  assert.equal(answered.code, 0, answered.stderr);
  const received = await coord.waitForEvent(e => e.params.meta?.answer_to === forwarded.ask);
  assert.equal(received.params.meta?.answered_as, 'stand-in');
  assert.equal(received.params.meta?.answered_by, 'cland-impl');
  const relay = await coord.call<{ message: TopicMessage }>('ask.answer', { ask: original.id, text: 'Keep it' });
  assert.equal(relay.message.answered_as, 'stand-in');
  assert.equal(relay.message.answered_by, 'cland-impl');
  assert.equal(relay.message.relayed_by, 'coord');
  const delivered = await impl.waitForEvent(e => e.params.meta?.answer_to === original.id);
  assert.equal(delivered.params.meta?.answered_by, 'cland-impl');
  assert.equal(delivered.params.meta?.relayed_by, 'coord');
  const rows = (await history()).messages;
  for (const id of [original.id, forwarded.ask]) {
    assert.equal(rows.find(m => m.id === id)!.ask!.answered_as, 'stand-in');
    assert.equal(rows.find(m => m.id === id)!.ask!.answered_by, 'cland-impl');
  }
  await flushProjectLogs(t, root);
  const journal = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(journal.some(e => e.event === 'ask-answered' && e.id === original.id && e.answered_as === 'stand-in' && e.answered_by === 'cland-impl' && e.relayed_by === 'coord'));
  for (const s of [coord, impl, aide]) await s.close();
  ui.close();
  await first.stop();
  const second = await projectHub(t, root);
  const freshUi = await connectUi(t, second.discovery);
  const restored = (await freshUi.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.equal(restored.messages.find(m => m.id === original.id)!.ask!.answered_by, 'cland-impl');
  assert.equal(restored.messages.find(m => m.id === relay.message.id)!.relayed_by, 'coord');
});


test('answer provenance is derived from the human client and survives a human answer relay', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => coord.close()); t.after(() => impl.close());
  await coord.waitForPresence(['coord', 'impl']);
  await impl.call('send', { topic: 'general', to: ['coordinator'], kind: 'question', text: 'Human choice?' });
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  const original = history.messages.find(m => m.text === 'Human choice?')!;
  const forwarded = await coord.call<{ ask: string }>('ask.forward', { ask: original.id });
  const answer = await ui.request({ type: 'topic.answer', ask: forwarded.ask, text: 'Use defaults', answered_as: 'stand-in', answered_by: 'forged' });
  assert.equal(answer.ok, true, answer.error);
  assert.equal((answer.value as { message: TopicMessage }).message.answered_as, 'human');
  const relay = await coord.call<{ message: TopicMessage }>('ask.answer', { ask: original.id, text: 'Use defaults' });
  assert.equal(relay.message.answered_as, 'human');
  assert.equal(relay.message.answered_by, undefined);
  assert.equal(relay.message.relayed_by, 'coord');
});
