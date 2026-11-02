// T2: public human frames and a fake spoke/adapter; no native harness or real clock waits.
import { sessionUi as connectUi } from './session-credential-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, type HarnessProcessView, type TopicMessage } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { connectSocket, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';

test('withdraw removes a busy session message and leaves the next turn intact', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const peer = await inProcessSpoke(t, { clock, cwd: root, discover: true, name: 'impl', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['impl']);
  fake.busy('impl');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'put this back in my composer' });
  const message = (sent.value as { message: TopicMessage }).message;
  assert.equal(message.withdrawable, true);
  await ui.waitFor(f => f.type === 'message' && (f.message as TopicMessage).id === message.id && (f.message as TopicMessage).withdrawable === true);
  const withdrawn = await ui.request({ type: 'topic.withdraw', topic: 'general', message: message.id });
  assert.equal(withdrawn.ok, true, withdrawn.error);
  assert.equal((withdrawn.value as { text: string }).text, message.text);
  await ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'withdrawn');
  fake.idle('impl');
  const next = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'the message to keep' });
  const nextId = (next.value as { message: TopicMessage }).message.id;
  await ui.waitFor(f => f.type === 'delivery' && f.message === nextId && f.stage === 'injected');
  assert.equal(fake.injections.filter(i => i.message.id === message.id).length, 0);
  assert.equal(fake.injections.filter(i => i.message.id === nextId).length, 1);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal((history.value as { messages: TopicMessage[] }).messages.find(m => m.id === message.id)?.stage, 'withdrawn');
});

for (const accepted of [false, true]) test(`withdraw ${accepted ? 'after' : 'before'} spoke acceptance fences late acks and preserves held progress`, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
  const process = (launched.value as { process: HarnessProcessView }).process;
  const peer = await connectSocket(discovery.socket);
  t.after(() => peer.close());
  peer.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, sessionId: process.sessionId, cwd: root, name: 'impl', launchToken: fake.spawns[0]!.launchToken });
  assert.equal((await peer.next()).type, 'welcome');
  const clause = await peer.next();
  assert.equal(clause.type, 'role');
  peer.send({ type: 'ack', id: clause.id });
  fake.idle('impl');
  peer.send({ type: 'send', id: 'progress-request', to: ['impl'], topic: 'general', text: 'held progress', kind: 'progress' });
  let progress = await peer.next();
  while (progress.id !== 'progress-request') progress = await peer.next();
  assert.equal(progress.ok, true, JSON.stringify(progress));
  const progressDelta = await ui.waitFor(f => f.type === 'message' && (f.message as TopicMessage).text === 'held progress');
  const progressId = (progressDelta.message as TopicMessage).id;
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'accepted but never injected' });
  const id = (sent.value as { message: TopicMessage }).message.id;
  const delivery = await peer.next();
  assert.equal(delivery.id, id);
  fake.busy('impl'); // Its earlier socket delivery arrives while the turn starts.
  if (accepted) {
    peer.send({ type: 'ack', id });
    await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'delivered');
  }
  const withdrawn = await ui.request({ type: 'topic.withdraw', topic: 'general', message: id });
  assert.equal(withdrawn.ok, true, withdrawn.error);
  peer.send({ type: 'ack', id }); // A stale acknowledgement cannot resurrect the message.
  fake.idle('impl');
  const next = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'next turn' });
  const nextId = (next.value as { message: TopicMessage }).message.id;
  const nextDelivery = await peer.next();
  assert.equal(nextDelivery.id, nextId);
  assert.ok((nextDelivery.message as TopicMessage).digest?.some(m => m.id === progressId));
  peer.send({ type: 'ack', id: nextId });
  await ui.waitFor(f => f.type === 'delivery' && f.message === nextId && f.stage === 'injected');
  assert.equal(fake.injections.filter(i => i.message.id === id).length, 0);
  assert.equal(fake.injections.filter(i => i.message.id === nextId).length, 1);
  assert.equal(fake.injections.filter(i => i.message.digest?.some(m => m.id === progressId)).length, 1);
});

test('withdraw refuses an injected message, an agent caller and an agent message', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
  const process = (launched.value as { process: HarnessProcessView }).process;
  const peer = await inProcessSpoke(t, { clock, cwd: root, discover: true, name: 'impl', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['impl']);
  fake.idle('impl');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'already injected' });
  const id = (sent.value as { message: TopicMessage }).message.id;
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  const refused = await ui.request({ type: 'topic.withdraw', topic: 'general', message: id });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /injected/);
  const agentUi = await connectUi(t, discovery);
  const agent = await agentUi.request({ type: 'topic.withdraw', topic: 'general', message: id, as: { name: 'impl' } });
  assert.equal(agent.ok, false);
  const other = await peer.call<{ ok: boolean }>('send', { to: ['impl'], text: 'agent words', topic: 'general' });
  assert.equal(other.ok, true);
  const otherDelta = await ui.waitFor(f => f.type === 'message' && (f.message as TopicMessage).text === 'agent words');
  const notOwn = await ui.request({ type: 'topic.withdraw', topic: 'general', message: (otherDelta.message as TopicMessage).id });
  assert.equal(notOwn.ok, false);
  assert.match(notOwn.error ?? '', /human.*own/);
});

test('withdraw cannot claim success after an unconfirmed adapter submission', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
  const process = (launched.value as { process: HarnessProcessView }).process;
  const peer = await inProcessSpoke(t, { clock, cwd: root, discover: true, name: 'impl', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['impl']);
  fake.idle('impl');
  fake.scriptInject('impl', 'reject');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'submission without confirmation' });
  const id = (sent.value as { message: TopicMessage }).message.id;
  await eventually('adapter rejection completed', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal((history.value as { messages: TopicMessage[] }).messages.find(row => row.id === id)?.withdrawable, false);
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'delivered' && f.withdrawable === false);
  const refused = await ui.request({ type: 'topic.withdraw', topic: 'general', message: id });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /delivered.*submission/);
});

test('a broadcast withdrawal is atomic when one addressee was injected', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const name of ['busy', 'idle']) {
    const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name, role: 'implementer' });
    const process = (launched.value as { process: HarnessProcessView }).process;
    const peer = await inProcessSpoke(t, { clock, cwd: root, discover: true, name, sessionId: process.sessionId, launchToken: fake.spawns.at(-1)!.launchToken! });
    await peer.waitForPresence([name]);
  }
  fake.busy('busy');
  fake.idle('idle');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['busy', 'idle'], text: 'one broadcast' });
  const id = (sent.value as { message: TopicMessage }).message.id;
  // Aggregate stage remains queued; observe the recipient's completed input separately.
  await eventually('idle recipient injection completed', () => logs.some(entry => entry.event === 'injected' && entry.id === id && entry.session === 'idle') || undefined);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  const row = (history.value as { messages: TopicMessage[] }).messages.find(row => row.id === id)!;
  assert.equal(row.stage, 'queued', 'aggregate still includes the busy recipient');
  assert.equal(row.withdrawable, false, 'one irreversible delivery excludes the whole broadcast');
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'queued' && f.withdrawable === false);
  const refused = await ui.request({ type: 'topic.withdraw', topic: 'general', message: id });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /injected/);
  fake.idle('busy');
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  assert.equal(fake.injections.filter(i => i.message.id === id && i.process.name === 'idle').length, 1);
  assert.equal(fake.injections.filter(i => i.message.id === id && i.process.name === 'busy').length, 1);
});

test('users withdraw only their persisted messages despite identical display names; admins can withdraw legacy input', async t => {
  const root = await tempProject(t);
  const { dispatcher } = await projectHub(t, root);
  const local = await (await import('./harness.ts')).dispatcherUi(t, dispatcher, root);
  const send = async (ui: typeof local, text: string) => {
    const result = await ui.request({ type: 'topic.send', topic: 'general', to: ['coordinator'], text });
    assert.equal(result.ok, true, result.error);
    return (result.value as { message: TopicMessage }).message;
  };
  const legacy = await send(local, 'legacy input');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(`${root}/.cland/hub.db`);
  t.after(() => db.close());
  db.prepare('insert into users values (?,?,?,?,?,?)').run('one', 'one', 'Same name', 'admin', 'active', 1);
  db.prepare('insert into users values (?,?,?,?,?,?)').run('two', 'two', 'Same name', 'admin', 'active', 2);
  db.prepare("insert into auth_state values (1,'users',?)").run(Date.now());
  const { dispatcherUi } = await import('./harness.ts');
  const other = await dispatcherUi(t, { open: (peer, transport) => dispatcher.open(peer, { ...transport, edge: 'web', user: () => ({ id: 'two', name: 'two', displayName: 'Same name', role: 'admin', state: 'active', created: 2 }) }) }, root);
  const own = await send(local, 'owned by one');
  const theirs = await send(other, 'owned by two');
  const refused = await other.request({ type: 'topic.withdraw', topic: 'general', message: own.id, userId: 'one' });
  assert.equal(refused.ok, false);
  assert.match(String(refused.error), /ownership/i);
  const history = await local.request({ type: 'topic.history', topic: 'general' });
  const rows = (history.value as { messages: TopicMessage[] }).messages;
  assert.equal(rows.find(m => m.id === own.id)?.stage, 'queued');
  assert.equal(rows.find(m => m.id === own.id)?.withdrawable, true);
  db.prepare("insert into roles values ('viewer')").run();
  db.prepare("update users set role='viewer' where id='two'").run();
  const legacyRefusal = await other.request({ type: 'topic.withdraw', topic: 'general', message: legacy.id });
  assert.equal(legacyRefusal.ok, false);
  assert.match(String(legacyRefusal.error), /role viewer/i);
  db.prepare("update users set role='admin' where id='two'").run();
  db.prepare("update users set role='viewer' where id='one'").run();
  const localRefusal = await local.request({ type: 'topic.withdraw', topic: 'general', message: legacy.id });
  assert.equal(localRefusal.ok, false);
  assert.match(String(localRefusal.error), /role viewer/i);
  db.prepare("update users set role='admin' where id='one'").run();
  for (const [ui, message] of [[local, own], [other, theirs], [other, legacy]] as const) {
    const receipt = await ui.request({ type: 'topic.withdraw', topic: 'general', message: message.id });
    assert.equal(receipt.ok, true, receipt.error);
    assert.equal((receipt.value as { message: TopicMessage }).message.stage, 'withdrawn');
  }
});
