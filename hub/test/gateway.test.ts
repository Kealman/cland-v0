// T2: a real project hub and frame clients, with only the messenger platform faked.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectUi, inProcessSpoke, projectHub, tempProject, until } from './harness.ts';
import { testMessenger } from './fakes/messenger.ts';
import { WEB_AUTHORITY } from '../src/hub/web-authority.ts';
import type { Inbox, TopicMessage } from '../src/protocol.ts';
import { Gateway } from '../src/remote/gateway.ts';
import { onCleanup } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';

test('gateway mirrors General and delivers a reply as the human, then stops with the hub', async t => {
  const root = await tempProject(t);
  const messenger = testMessenger();
  const log: Array<Record<string, unknown>> = [];
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [messenger], log: entry => { log.push(entry); } });
  assert.equal(messenger.started, true, 'the hub starts its gateway remote');
  const welcome = await messenger.client.waitFor(f => f.type === 'welcome');
  assert.equal(welcome.name, 'human');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const received = messenger.client.waitFor(f => f.type === 'message' && (f.message as { text: string }).text === 'gateway question');
  const posted = await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'gateway question' });
  assert.equal(posted.ok, true);
  const message = (await received).message as { id: string };
  assert.ok(message.id);
  const delivered = coord.waitForEvent(e => e.params.content.includes('gateway reply'));
  const reply = await messenger.client.request({ type: 'topic.send', topic: 'general', replyTo: message.id, text: 'gateway reply' });
  assert.equal(reply.ok, true, reply.error);
  assert.equal((reply.value as { message: { from: string; fromKind: string } }).message.from, 'human');
  assert.equal((reply.value as { message: { fromKind: string } }).message.fromKind, 'human');
  assert.equal((await delivered).params.meta!.from, 'human');
  const local = await connectUi(t, hub.discovery);
  assert.equal((await local.request({ type: 'hub.status' })).ok, true);
  assert.equal(log.filter(entry => entry.event === 'client' && entry.edge === 'gateway').length, 1);
  assert.equal(log.filter(entry => entry.event === 'listening').length, 2, 'only the existing spoke and Unix socket listeners are bound');
  assert.ok(messenger.client.frames.every(frame => !JSON.stringify(frame).includes(hub.discovery.secret)), 'the remote receives no hub secret');
  await hub.stop();
  assert.equal(messenger.stopped, true, 'shutdown drains the gateway before closing storage');
  assert.throws(() => messenger.client.send({ type: 'topic.send', topic: 'general', text: 'after stop' }), /not running/);
});

test('gateway allows General, same-topic replies, asks, approvals and status/inbox reads through the frame protocol', async t => {
  const root = await tempProject(t);
  const messenger = testMessenger();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [messenger] });
  const local = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const general = await messenger.client.request({ type: 'topic.send', topic: 'general', text: 'new remote message' });
  assert.equal(general.ok, true, general.error);
  assert.equal((general.value as { message: TopicMessage }).message.fromKind, 'human');
  const sent = (general.value as { message: TopicMessage }).message;
  const delivery = await messenger.client.waitFor(f => f.type === 'delivery' && f.message === sent.id && f.stage === 'delivered');
  assert.equal(delivery.message, sent.id);
  const created = await local.request({ type: 'topic.create', title: 'Remote reply' });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const posted = messenger.client.waitFor(f => f.type === 'message' && (f.message as TopicMessage).text === 'topic question');
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic, text: 'topic question' })).ok, true);
  const original = (await posted).message as TopicMessage;
  const reply = await messenger.client.request({ type: 'topic.send', topic, replyTo: original.id, text: 'topic reply' });
  assert.equal(reply.ok, true, reply.error);
  assert.equal((reply.value as { message: TopicMessage }).message.topic, topic);
  assert.equal((reply.value as { message: TopicMessage }).message.replyTo, original.id);
  const askFrame = messenger.client.waitFor(f => f.type === 'message' && (f.message as TopicMessage).ask?.question === 'Remote choice?');
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic, question: 'Remote choice?', options: ['yes', 'no'] });
  assert.equal(asked.ok, true);
  assert.equal(((await askFrame).message as TopicMessage).id, asked.ask);
  const answered = await messenger.client.request({ type: 'topic.answer', ask: asked.ask, option: 2 });
  assert.equal(answered.ok, true, answered.error);
  assert.equal((answered.value as { message: TopicMessage }).message.from, 'human');
  assert.equal((answered.value as { message: TopicMessage }).message.answerTo, asked.ask);
  const launched = await local.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const approvalId = `${(launched.value as { process: { sessionId: string } }).process.sessionId}:remote-command`;
  const approvalFrame = messenger.client.waitFor(f => f.type === 'inbox' && (f.inbox as Inbox).approvals.some(a => a.id === approvalId));
  hub.fakes.codex!.raiseApproval('worker', { id: 'remote-command', kind: 'command', subject: { command: 'echo remote' }, choices: ['once', 'deny'] });
  const approval = ((await approvalFrame).inbox as Inbox).approvals.find(a => a.id === approvalId)!;
  const approved = await messenger.client.request({ type: 'approval.answer', approval: approval.id, choice: 'deny', note: 'remote denial' });
  assert.equal(approved.ok, true, approved.error);
  assert.equal((approved.value as { approval: { state: string; outcome: { by: string; choice: string } } }).approval.state, 'closed');
  assert.equal((approved.value as { approval: { outcome: { by: string } } }).approval.outcome.by, 'human');
  assert.deepEqual(hub.fakes.codex!.approvalAnswers.map(a => [a.requestId, a.choice, a.note]), [['remote-command', 'deny', 'remote denial']]);
  for (const type of ['hub.status', 'task.list', 'inbox.list']) {
    const result = await messenger.client.request({ type });
    assert.equal(result.ok, true, `${type}: ${result.error}`);
    assert.ok(result.value);
  }
});

test('gateway rejects new non-General messages, forged replies and attached artifact sends without writing a message', async t => {
  const root = await tempProject(t);
  const messenger = testMessenger();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [messenger] });
  const local = await connectUi(t, hub.discovery);
  const created = await local.request({ type: 'topic.create', title: 'Restricted topic' });
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const sent = await messenger.client.request({ type: 'topic.send', topic: 'general', text: 'valid original' });
  const original = (sent.value as { message: TopicMessage }).message;
  for (const frame of [
    { topic }, { topic, replyTo: original.id }, { topic, replyTo: 'missing' },
    { topic: 'general', replyTo: 'missing' }, { topic: 'general', replyTo: null },
    { topic: 'general', artifacts: [] },
  ]) {
    const result = await messenger.client.request({ type: 'topic.send', ...frame, text: 'forbidden message' });
    assert.equal(result.ok, false, JSON.stringify(frame));
    assert.equal((result as { code?: string }).code, 'forbidden');
    assert.match(result.error!, /topic.send/);
  }
  const history = await local.request({ type: 'topic.history', topic });
  assert.deepEqual((history.value as { messages: TopicMessage[] }).messages, []);
  const general = await local.request({ type: 'topic.history', topic: 'general' });
  assert.deepEqual((general.value as { messages: TopicMessage[] }).messages.filter(m => m.fromKind === 'human').map(m => m.text), ['valid original']);
});

test('two messenger remotes share one conversation and receive only their own request results', async t => {
  const root = await tempProject(t);
  const first = testMessenger('first');
  const second = testMessenger('second');
  const log: Array<Record<string, unknown>> = [];
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [first, second], log: entry => { log.push(entry); } });
  const [status, tasks] = await Promise.all([
    first.client.request({ type: 'hub.status' }), second.client.request({ type: 'task.list' }),
  ]);
  assert.equal(status.ok, true, status.error);
  assert.equal((status.value as { root: string }).root, root);
  assert.equal(tasks.ok, true, tasks.error);
  assert.ok(Array.isArray((tasks.value as { items: unknown[] }).items));
  assert.equal(log.filter(entry => entry.event === 'client' && entry.edge === 'gateway').length, 1);
  assert.ok([...first.client.frames, ...second.client.frames].every(f => f.type !== 'result'));
  const sent = await first.client.request({ type: 'topic.send', topic: 'general', text: 'both remotes' });
  const id = (sent.value as { message: TopicMessage }).message.id;
  for (const remote of [first, second]) assert.equal(((await remote.client.waitFor(f => f.type === 'message' && (f.message as TopicMessage).id === id)).message as TopicMessage).id, id);
  await hub.stop();
  assert.equal(first.stopped, true);
  assert.equal(second.stopped, true);
});

test('hub shutdown closes gateway admission and awaits the remote stop receipt before closing its edges', async t => {
  const root = await tempProject(t);
  const messenger = testMessenger();
  const release = Promise.withResolvers<void>();
  let entered = false;
  let finished = false;
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [{
    ...messenger,
    stop: async () => { entered = true; await release.promise; messenger.stop(); finished = true; },
  }] });
  const local = await connectUi(t, hub.discovery);
  const stopping = hub.stop();
  try {
    await until(() => entered, { what: 'remote stop entered', timeoutMs: 2000 });
    assert.throws(() => messenger.client.send({ type: 'topic.send', topic: 'general', text: 'shutdown race' }), /gateway is not running/);
    const status = await local.request({ type: 'hub.status' });
    assert.equal(status.ok, true, status.error);
    assert.equal(finished, false);
  } finally {
    release.resolve();
    await stopping;
  }
  assert.equal(finished, true, 'the completed hub shutdown includes the remote stop receipt');
  assert.equal(messenger.stopped, true);
});

test('gateway stop drains a held start without starting later remotes or reopening admission', async t => {
  const { wait, fixtures } = caseDeadlines(t, { timeoutMs: 2000 });
  const root = await tempProject(fixtures);
  const hub = await projectHub(fixtures, root);
  const first = testMessenger('held');
  const second = testMessenger('later');
  const release = Promise.withResolvers<void>();
  const receipts: string[] = [];
  let request!: (frame: Record<string, unknown>) => void;
  const gateway = new Gateway(hub.dispatcher, [{
    ...first,
    start: async send => { request = send; first.start(send); await release.promise; receipts.push('start settled'); },
    stop: () => { first.stop(); receipts.push('remote stopped'); },
  }, second]);
  let starting: Promise<unknown> | undefined;
  onCleanup(fixtures, async () => {
    release.resolve();
    await Promise.allSettled([starting, gateway.stop()]);
  });
  starting = gateway.start().then(() => 'started', error => error);
  await until(() => first.started, { what: 'held messenger start entered', timeoutMs: 2000 });
  const stopping = gateway.stop();
  release.resolve();
  await wait('held startup and gateway shutdown settle', () => Promise.all([starting, stopping]));
  assert.equal(first.stopped, true);
  assert.equal(second.started, false, 'shutdown fences later remote acquisition');
  assert.deepEqual(receipts, ['start settled', 'remote stopped']);
  assert.throws(() => request({ type: 'hub.status', id: 'after-stop' }), /gateway is not running/);
});

test('gateway refuses every other request before dispatch, including pairing and actor overrides', async t => {
  const root = await tempProject(t);
  const messenger = testMessenger();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [messenger] });
  const allowed = new Set(['topic.send', 'topic.answer', 'approval.answer', 'hub.status', 'task.list', 'inbox.list']);
  for (const type of [...Object.keys(WEB_AUTHORITY).filter(type => !allowed.has(type)), 'pairing.approve', 'remote.pair.approve', 'send', 'ask', 'hello', 'future.frame', 'constructor', '__proto__', 'toString']) {
    const result = await messenger.client.request({ type });
    assert.equal(result.ok, false, type);
    assert.equal((result as { code?: string }).code, 'forbidden', `${type}: ${result.error}`);
    assert.ok(result.error?.includes(type), `${type}: ${result.error}`);
  }
  for (const type of allowed) for (const as of [null, false, '', {}, { name: 'human' }, { name: 'coord', shell: true }]) {
    const result = await messenger.client.request({ type, as });
    assert.equal(result.ok, false, type);
    assert.equal((result as { code?: string }).code, 'forbidden');
    assert.match(result.error!, /identity/);
  }
  const status = await messenger.client.request({ type: 'hub.status' });
  assert.equal(status.ok, true, status.error);
  await hub.stop();
});
