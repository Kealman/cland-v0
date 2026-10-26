// T2: a real project hub and frame clients, with only the messenger platform faked.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectUi, inProcessSpoke, projectHub, tempProject, until } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { testMessenger, testRemoteStates } from './fakes/messenger.ts';
import { WEB_AUTHORITY } from '../src/hub/web-authority.ts';
import type { Inbox, InboxApproval, TopicMessage } from '../src/protocol.ts';
import { Gateway } from '../src/remote/gateway.ts';
import { onCleanup } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { once } from 'node:events';
import { get } from 'node:http';
import { WebSocket } from 'ws';
import { frameClient, type FrameClient } from './harness.ts';
import { remoteRedactor } from '../src/remote/redact.ts';

async function webClient(t: import('node:test').TestContext, local: FrameClient) {
  const link = await local.request({ type: 'web.link' });
  assert.equal(link.ok, true, link.error);
  const { url } = link.value as { url: string };
  const cookie = await new Promise<string>((resolve, reject) => {
    const request = get(url, { agent: false }, response => {
      response.resume();
      response.on('end', () => resolve(response.headers['set-cookie']![0]!.split(';')[0]!));
      response.on('error', reject);
    });
    request.setTimeout(2000, () => request.destroy(new Error('fixture sign-in timed out')));
    request.on('error', reject);
  });
  const origin = new URL(url).origin;
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  onCleanup(t, () => ws.terminate());
  const client = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data.toString()}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'human' });
  assert.equal((await welcome).name, 'human');
  return client;
}

test('a remote throwing at start disables only itself while another remote and the web edge serve', async t => {
  const root = await tempProject(t);
  const broken = testMessenger('broken', { startError: new Error('invalid command definition') });
  const healthy = testMessenger('healthy');
  const log: Array<Record<string, unknown>> = [];
  const state = testRemoteStates();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [broken, healthy], gatewayState: state, log: entry => { log.push(entry); } });
  assert.deepEqual(state.forMessenger('broken').status(), { disabled: true, reason: 'invalid command definition' });
  assert.deepEqual(state.forMessenger('healthy').status(), { disabled: false, reason: null });
  assert.equal(broken.stopped, true, 'partially acquired resources are drained');
  assert.equal(healthy.started, true);
  assert.equal(healthy.stopped, false);
  assert.ok(log.some(entry => entry.event === 'remote-disabled' && entry.remote === 'broken' && entry.reason === 'invalid command definition'));
  const local = await connectUi(t, hub.discovery);
  const web = await webClient(t, local);
  for (const client of [healthy.client, local, web]) {
    const status = await client.request({ type: 'hub.status' });
    assert.equal(status.ok, true, status.error);
    assert.equal((status.value as { root: string }).root, root);
  }
  await hub.stop();
  assert.equal(healthy.stopped, true);
});

test('a remote run loop failing after serving stores its reason while the hub, web and another remote serve on', async t => {
  const root = await tempProject(t);
  const broken = testMessenger('broken');
  const healthy = testMessenger('healthy');
  const state = testRemoteStates();
  const log: Array<Record<string, unknown>> = [];
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [broken, healthy], gatewayState: state, log: entry => { log.push(entry); } });
  const local = await connectUi(t, hub.discovery);
  const web = await webClient(t, local);
  assert.equal((await broken.client.request({ type: 'hub.status' })).ok, true);
  assert.equal(broken.running, true);
  broken.fail(new Error('poll loop failed'));
  await until(() => state.forMessenger('broken').status().disabled && broken.stopped, { what: 'disabled state and remote cleanup receipt', timeoutMs: 2000 });
  assert.deepEqual(state.forMessenger('broken').status(), { disabled: true, reason: 'poll loop failed' });
  assert.ok(log.some(entry => entry.event === 'remote-disabled' && entry.remote === 'broken' && entry.reason === 'poll loop failed'));
  assert.deepEqual(state.forMessenger('healthy').status(), { disabled: false, reason: null });
  assert.equal(healthy.stopped, false);
  const frames = broken.client.frames.length;
  const mirrored = healthy.client.waitFor(f => f.type === 'message' && (f.message as TopicMessage).text === 'after failure');
  const posted = await web.request({ type: 'topic.send', topic: 'general', text: 'after failure' });
  assert.equal(posted.ok, true, posted.error);
  assert.equal(((await mirrored).message as TopicMessage).id, (posted.value as { message: TopicMessage }).message.id);
  for (const client of [healthy.client, local, web]) assert.equal((await client.request({ type: 'hub.status' })).ok, true);
  assert.equal(broken.client.frames.length, frames, 'a disabled remote receives no later broadcasts or results');
  assert.throws(() => broken.client.send({ type: 'hub.status' }), /not running/);
  await hub.stop();
  assert.equal(healthy.stopped, true);
});

for (const async of [false, true]) for (const type of ['message', 'result']) {
  test(`a remote ${async ? 'rejecting' : 'throwing'} on a ${type} frame cannot break fanout or the web edge`, async t => {
    const root = await tempProject(t);
    const broken = testMessenger('broken');
    const healthy = testMessenger('healthy');
    const state = testRemoteStates();
    const log: Array<Record<string, unknown>> = [];
    const hub = await projectHub(t, root, {}, { gatewayRemotes: [broken, healthy], gatewayState: state, log: entry => { log.push(entry); } });
    const local = await connectUi(t, hub.discovery);
    const web = await webClient(t, local);
    broken.failReceive(new Error('send failed'), type, async);
    if (type === 'result') broken.client.send({ type: 'hub.status', id: 'failed-result' });
    else {
      const received = healthy.client.waitFor(f => f.type === 'message' && (f.message as TopicMessage).text === 'fanout survives');
      const posted = await web.request({ type: 'topic.send', topic: 'general', text: 'fanout survives' });
      assert.equal(posted.ok, true, posted.error);
      assert.equal(((await received).message as TopicMessage).id, (posted.value as { message: TopicMessage }).message.id);
    }
    await until(() => state.forMessenger('broken').status().disabled && broken.stopped, { what: 'frame failure disabled state and stop receipt', timeoutMs: 2000 });
    assert.deepEqual(state.forMessenger('broken').status(), { disabled: true, reason: 'send failed' });
    assert.ok(log.some(entry => entry.event === 'remote-disabled' && entry.remote === 'broken' && entry.reason === 'send failed'));
    for (const client of [healthy.client, local, web]) assert.equal((await client.request({ type: 'hub.status' })).ok, true);
    assert.equal(healthy.stopped, false);
    await hub.stop();
    assert.equal(healthy.stopped, true);
  });
}

test('remote failure reasons are redacted before reaching the state sink or hub log', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const registered = 'fixture[private]-credential';
  const broken = testMessenger('broken', { startError: new Error(`invalid token=fixture-private-value at https://messenger.invalid/bot/private; credential ${registered}`) });
  const healthy = testMessenger('healthy');
  const state = testRemoteStates();
  const log: Array<Record<string, unknown>> = [];
  const gateway = new Gateway(hub.dispatcher, [broken, healthy], { state, redact: remoteRedactor([registered]), log: entry => { log.push(entry); } });
  onCleanup(t, () => gateway.stop());
  await gateway.start();
  assert.equal(state.forMessenger('broken').status().disabled, true);
  const reason = state.forMessenger('broken').status().reason!;
  assert.match(reason, /invalid/);
  assert.ok(!reason.includes('fixture-private-value') && !reason.includes('https://'));
  assert.ok(!JSON.stringify(state.forMessenger('broken').status()).includes(registered));
  assert.ok(!JSON.stringify(log).includes(registered));
  assert.equal(log.find(entry => entry.event === 'remote-disabled')?.reason, reason);
  assert.equal((await healthy.client.request({ type: 'hub.status' })).ok, true);
});

test('a failed remote cleanup is logged and retained as a redacted shutdown failure without stopping its peer', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const broken = testMessenger('broken', { startError: new Error('setup failed') });
  const healthy = testMessenger('healthy');
  const registered = 'fixture-stop-credential';
  const log: Array<Record<string, unknown>> = [];
  let stops = 0;
  const gateway = new Gateway(hub.dispatcher, [{ ...broken, stop: () => {
    stops++;
    broken.stop();
    throw new Error(registered);
  } }, healthy], { redact: remoteRedactor([registered, 'redact']), log: entry => { log.push(entry); } });
  onCleanup(t, () => gateway.stop().catch(() => {}));
  await gateway.start();
  assert.equal((await healthy.client.request({ type: 'hub.status' })).ok, true);
  assert.ok(log.some(entry => entry.event === 'remote-stop-failed' && entry.reason === '[redacted]'));
  await assert.rejects(gateway.stop(), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 1);
    assert.equal((error.errors[0] as Error).message, '[redacted]');
    return true;
  });
  assert.equal(stops, 1, 'failure and final shutdown share one cleanup receipt');
  assert.equal(healthy.stopped, true, 'the peer is drained despite the failed cleanup');
  assert.ok(!JSON.stringify(log).includes(registered));
});

test('gateway shutdown joins run and receive writers after the remote stop receipt', async t => {
  const { wait, fixtures } = caseDeadlines(t, { timeoutMs: 2000 });
  const root = await tempProject(fixtures);
  const hub = await projectHub(fixtures, root);
  const messenger = testMessenger();
  const runRelease = Promise.withResolvers<void>();
  const receiveRelease = Promise.withResolvers<void>();
  const receiveEntered = Promise.withResolvers<void>();
  const receipts: string[] = [];
  const gateway = new Gateway(hub.dispatcher, [{
    ...messenger,
    run: async () => { await messenger.run(); await runRelease.promise; receipts.push('run drained'); },
    receive: async frame => {
      if (frame.type === 'message') {
        receiveEntered.resolve();
        await receiveRelease.promise;
        receipts.push('receive drained');
      }
      await messenger.receive(frame);
    },
    stop: () => { messenger.stop(); receipts.push('stop receipt'); },
  }]);
  onCleanup(fixtures, async () => {
    runRelease.resolve();
    receiveRelease.resolve();
    await gateway.stop();
  });
  await wait('gateway startup', () => gateway.start());
  const local = await connectUi(fixtures, hub.discovery);
  const posted = await local.request({ type: 'topic.send', topic: 'general', text: 'held platform write' });
  assert.equal(posted.ok, true, posted.error);
  await wait('platform receive entered', () => receiveEntered.promise);
  let finished = false;
  const stopping = gateway.stop().then(() => { finished = true; });
  await until(() => messenger.stopped, { what: 'remote stop receipt', timeoutMs: 2000 });
  assert.equal(finished, false);
  runRelease.resolve();
  await until(() => receipts.includes('run drained'), { what: 'run writer drained', timeoutMs: 2000 });
  assert.equal(finished, false, 'a receive writer still owns the fixture');
  receiveRelease.resolve();
  await wait('gateway shutdown drained', () => stopping);
  assert.deepEqual(receipts, ['stop receipt', 'run drained', 'receive drained']);
  assert.equal(finished, true);
});

test('failed startup cleanup can drain while the other remote and hub keep serving', async t => {
  const { wait, fixtures } = caseDeadlines(t, { timeoutMs: 2000 });
  const root = await tempProject(fixtures);
  const hub = await projectHub(fixtures, root);
  const broken = testMessenger('broken', { startError: new Error('setup failed') });
  const healthy = testMessenger('healthy');
  const release = Promise.withResolvers<void>();
  const state = testRemoteStates();
  let stopEntered = false;
  const gateway = new Gateway(hub.dispatcher, [{ ...broken, stop: async () => {
    stopEntered = true;
    await release.promise;
    broken.stop();
  } }, healthy], { state });
  onCleanup(fixtures, async () => { release.resolve(); await gateway.stop(); });
  try {
    await wait('gateway starts independently of failed cleanup', () => gateway.start());
    assert.equal(stopEntered, true);
    assert.equal(broken.stopped, false);
    assert.deepEqual(state.forMessenger('broken').status(), { disabled: true, reason: 'setup failed' });
    assert.equal((await healthy.client.request({ type: 'hub.status' })).ok, true);
    const local = await connectUi(fixtures, hub.discovery);
    const web = await webClient(fixtures, local);
    assert.equal((await web.request({ type: 'hub.status' })).ok, true);
  } finally {
    release.resolve();
    await wait('gateway drains failed startup', () => gateway.stop());
  }
  assert.equal(broken.stopped, true);
  assert.equal(healthy.stopped, true);
});

test('gateway mirrors General and delivers a reply as the human, then stops with the hub', async t => {
  const root = await tempProject(t);
  const messenger = testMessenger();
  const log: Array<Record<string, unknown>> = [];
  // Previous Remote shape: no run hook and synchronous start/receive/stop.
  const legacy = { id: messenger.id, via: messenger.via, start: messenger.start, receive: (frame: import('../src/protocol.ts').HubFrame) => { void messenger.receive(frame); }, stop: messenger.stop };
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [legacy], log: entry => { log.push(entry); } });
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

for (const via of ['telegram', 'discord'] as const) test(`gateway ${via} records messages, ask outcomes and approvals through the old client frames`, async t => {
  const root = await tempProject(t);
  const messenger = testMessenger(via, { via });
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [messenger], clock: new FakeClock() });
  const local = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const general = await messenger.client.request({ type: 'topic.send', topic: 'general', text: 'new remote message', via: via === 'telegram' ? 'discord' : 'telegram' });
  assert.equal(general.ok, true, general.error);
  assert.equal((general.value as { message: TopicMessage }).message.fromKind, 'human');
  assert.equal((general.value as { message: TopicMessage }).message.via, via);
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
  assert.equal((answered.value as { message: TopicMessage }).message.via, via);
  const closedAsk = await local.request({ type: 'topic.history', topic });
  assert.equal((closedAsk.value as { messages: TopicMessage[] }).messages.find(m => m.id === asked.ask)!.ask!.outcome!.via, via);
  const launched = await local.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const approvalId = `${(launched.value as { process: { sessionId: string } }).process.sessionId}:remote-command`;
  const approvalFrame = messenger.client.waitFor(f => f.type === 'approval' && (f.approval as InboxApproval).id === approvalId);
  hub.fakes.codex!.raiseApproval('worker', { id: 'remote-command', kind: 'command', subject: { command: 'echo remote' }, choices: ['once', 'deny'] });
  const approval = (await approvalFrame).approval as InboxApproval;
  hub.fakes.codex!.approvalNotes = false;
  const approved = await messenger.client.request({ type: 'approval.answer', approval: approval.id, choice: 'deny', note: 'remote denial' });
  assert.equal(approved.ok, true, approved.error);
  assert.equal((approved.value as { approval: { state: string; outcome: { by: string; choice: string } } }).approval.state, 'closed');
  assert.equal((approved.value as { approval: { outcome: { by: string } } }).approval.outcome.by, 'human');
  assert.equal((approved.value as { approval: { outcome: { via: string } } }).approval.outcome.via, via);
  assert.deepEqual(hub.fakes.codex!.approvalAnswers.map(a => [a.requestId, a.choice, a.note]), [['remote-command', 'deny', 'remote denial']]);
  // No features were negotiated by connectUi: retain the previous hello/request shape.
  const archive = await local.request({ type: 'inbox.list', archive: true });
  const departures = (archive.value as Inbox).archive!;
  assert.equal(departures.find(row => row.id === asked.ask)!.outcome!.via, via);
  assert.equal(departures.find(row => row.id === approval.id)!.outcome!.via, via);
  const history = await local.request({ type: 'topic.history', topic: 'general' });
  assert.equal((history.value as { messages: TopicMessage[] }).messages.find(m => m.id === sent.id)!.via, via);
  const note = (history.value as { messages: TopicMessage[] }).messages.find(m => m.text === 'remote denial')!;
  assert.equal(note.via, via, 'a denial note the harness cannot carry keeps its messenger source');
  const declined = await coord.call<{ ok: boolean; ask: string }>('ask', { topic, question: 'Ship now?', options: ['Ship'] });
  const decline = await messenger.client.request({ type: 'topic.answer', ask: declined.ask, declined: true, reason: 'Wait for QA' });
  assert.equal(decline.ok, true, decline.error);
  const read = await local.request({ type: 'topic.history', topic });
  assert.deepEqual((read.value as { messages: TopicMessage[] }).messages.find(m => m.id === declined.ask)!.ask!.outcome, {
    status: 'declined', reason: 'Wait for QA', by: 'human', via,
    at: (decline.value as { message: TopicMessage }).message.ts,
  });
  const ordinary = await local.request({ type: 'topic.send', topic: 'general', text: 'Local source', via });
  assert.equal((ordinary.value as { message: TopicMessage }).message.via, 'hub', 'wire fields cannot spoof provenance');
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
  const second = testMessenger('second', 'discord');
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
  const sources = await Promise.all([first, second].map(remote => remote.client.request({ type: 'topic.send', topic: 'general', text: remote.id })));
  assert.deepEqual(sources.map(result => (result.value as { message: TopicMessage }).message.via), ['telegram', 'discord']);
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
