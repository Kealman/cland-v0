// T2: digest routing with fake time, in-process peers and one raw-frame acknowledgement proof.
// Native restart persistence: session-native-lifecycle.test.ts; steer/next-turn: adapter contracts.
import { FakeClock } from './fake-clock.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inProcessSpoke, assignRole, connectSocket, connectUi, connectWsUi, eventually, projectHub, startHub, tempProject, TEST_SECRET } from './harness.ts';
import { FAKE_FLAVOURS, type FakeHarness } from './fakes/harness.ts';
import { PROTOCOL_VERSION, type Message, type HarnessProcessView } from '../src/protocol.ts';
import { WebSocket } from 'ws';

function roleInputAccepted(fake: FakeHarness, sessionId: string) {
  // The fake records its accepted native input as it resolves inject(); role
  // notices are topicless, so Agents topic history cannot supply this receipt.
  return eventually('initial role input accepted before digest measurement', () => fake.injections.some(input =>
    input.process.sessionId === sessionId && input.message.kind === 'role' && input.outcome === 'accept') || undefined);
}

test('progress stays queued and reaches the spoke in one ordered digest with the next report', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const sender = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  const receiver = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'receiver' });
  t.after(async () => { await sender.close(); await receiver.close(); });
  await sender.waitForPresence(['impl', 'coord']);
  await receiver.waitForPresence(['impl', 'coord']);
  const mark = receiver.events.length;
  for (const text of ['first note', 'second note', 'third note']) {
    const sent = await sender.call<{ ok: boolean; outcomes: Array<{ outcome: string }> }>('send', { to: ['coord'], text, kind: 'progress' });
    assert.equal(sent.ok, true);
    assert.equal(sent.outcomes[0]?.outcome, 'queued');
  }
  await receiver.call('who'); // ordered round trip after all progress sends
  assert.equal(receiver.events.slice(mark).length, 0, 'held progress emits no channel notification');
  assert.equal((await sender.call<{ ok: boolean }>('send', { to: ['coord'], text: 'bad kind', kind: 'typo' })).ok, false);
  await sender.call('send', { to: ['coord'], text: 'finished' });
  const digest = await receiver.waitForEvent(e => e.params.content.includes('finished'));
  assert.match(digest.params.content, /first note[\s\S]*second note[\s\S]*third note[\s\S]*finished/);
  assert.equal(receiver.events.slice(mark).length, 1);
  const messages = await eventually('progress digest acknowledged by the spoke', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const messages = (history.value as { messages: Array<{ text: string; kind?: string; stage?: string }> }).messages;
    return ['first note', 'second note', 'third note', 'finished'].every(text => messages.some(m => m.text === text && m.stage === 'delivered')) ? messages : undefined;
  });
  assert.equal(messages.find(m => m.text === 'finished')?.kind, 'report');
  for (const text of ['first note', 'second note', 'third note']) assert.equal(messages.find(m => m.text === text)?.stage, 'delivered');
  for (const kind of ['question', 'decision']) {
    await sender.call('send', { to: ['coord'], text: kind, kind });
    await receiver.waitForEvent(e => e.params.content === kind);
  }
});

test('progress holds until one ordered digest is injected across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake', probes: 'fake' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const sender = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  for (const harness of FAKE_FLAVOURS) {
    const name = `target-${harness}`;
    const launched = await ui.request({ type: 'session.launch', name, harness });
    assert.equal(launched.ok, true, launched.error);
    const p = (launched.value as { process: HarnessProcessView }).process;
    const receiver = await inProcessSpoke(t, { cwd: root, discover: true, name, sessionId: p.sessionId });
    await sender.waitForPresence(['impl', name]);
    await receiver.call('who'); // Own credential-ready welcome, rather than another spoke's presence.
    const initialized = roleInputAccepted(fakes[harness]!, p.sessionId);
    fakes[harness]!.idle(name);
    await initialized;
    const mark = fakes[harness]!.injections.length;
    const notes = ['first note', 'second note', 'third note'].map(text => `${harness} ${text}`);
    for (const text of notes) await sender.call('send', { to: [name], text, kind: 'progress' });
    await sender.call('who');
    assert.equal(fakes[harness]!.injections.length, mark, 'held progress starts no native input');
    const text = `${harness} report finished`;
    await sender.call('send', { to: [name], text });
    await eventually('digest injection receipt', () => fakes[harness]!.injections.length === mark + 1 || undefined);
    const batch = fakes[harness]!.injections[mark]!.message;
    assert.equal(batch.text, text);
    assert.deepEqual(batch.digest?.map(m => m.text), notes);
    const history = await eventually('whole batch injected', async () => {
      const r = await ui.request({ type: 'topic.history', topic: 'agents' });
      const messages = (r.value as { messages: Array<Message & { stage: string }> }).messages;
      return [...notes, text].every(text => messages.some(m => m.text === text && m.stage === 'injected')) ? messages : undefined;
    });
    assert.equal(history.filter(m => m.text === text).length, 1);
    for (const kind of ['question', 'decision']) {
      await sender.call('send', { to: [name], text: `${harness} ${kind}`, kind });
      await eventually('immediate input receipt', () => fakes[harness]!.injections.some(i => i.message.text === `${harness} ${kind}`) || undefined);
    }
    await receiver.close();
    assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
  }
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  assert.match(journal, /"event":"send"[^\n]*"kind":"progress"/);
  assert.match(journal, /"event":"send"[^\n]*"kind":"report"/);
});

test('an unacked digest keeps its membership across reconnect while newer progress waits for another report', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  await assignRole(root, 'coord', 'coordinator');
  const connect = async () => {
    const socket = await connectSocket(discovery.socket);
    t.after(() => socket.close());
    socket.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, sessionId: 'receiver', cwd: root, name: 'coord' });
    assert.equal((await socket.next()).type, 'welcome');
    const role = await socket.next();
    assert.equal(role.type, 'role');
    socket.send({ type: 'ack', id: (role.message as Message).id });
    return socket;
  };
  const first = await connect();
  const sender = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  t.after(() => sender.close());
  await sender.waitForPresence(['coord', 'impl']);
  await sender.call('send', { to: ['coord'], text: 'earlier note', kind: 'progress' });
  await sender.call('send', { to: ['coord'], text: 'first report' });
  const original = (await first.next()).message as Message;
  assert.deepEqual(original.digest?.map(m => m.text), ['earlier note']);
  await sender.call('send', { to: ['coord'], text: 'later note', kind: 'progress' });
  first.close();
  await first.closed;
  const second = await connect();
  const repeated = (await second.next()).message as Message;
  assert.deepEqual(repeated, original, 'lost acknowledgement replays the exact input, never a growing digest');
  second.send({ type: 'ack', id: repeated.id });
  // Unknown kinds are refused by the hub itself, in addition to MCP validation.
  second.send({ type: 'send', id: 'bad-kind', to: ['impl'], text: 'bad', kind: 'typo' });
  assert.equal((await second.next()).ok, false);
  await sender.call('send', { to: ['coord'], text: 'second report' });
  const next = (await second.next()).message as Message;
  assert.equal(next.text, 'second report');
  assert.deepEqual(next.digest?.map(m => m.text), ['later note']);
});

test('uncertain digest membership survives later reports until an explicit retry across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake', probes: 'fake' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const sender = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  for (const harness of FAKE_FLAVOURS) {
    const name = `target-${harness}`;
    const launch = await ui.request({ type: 'session.launch', name, harness });
    const p = (launch.value as { process: HarnessProcessView }).process;
    const receiver = await inProcessSpoke(t, { cwd: root, discover: true, name, sessionId: p.sessionId });
    await sender.waitForPresence(['impl', name]);
    await receiver.call('who');
    const fake = fakes[harness]!;
    const initialized = roleInputAccepted(fake, p.sessionId);
    fake.idle(name);
    await initialized;
    fake.scriptInject(name, 'uncertain');
    const mark = fake.injections.length;
    await sender.call('send', { to: [name], text: 'old progress', kind: 'progress' });
    await sender.call('send', { to: [name], text: 'uncertain report' });
    await ui.waitFor(f => f.type === 'event' && String((f.row as { text: string }).text).includes(`retry ${name}`));
    const original = fake.injections[mark]!.message;
    assert.deepEqual(original.digest?.map(m => m.text), ['old progress']);
    fake.busy(name); fake.idle(name);
    await sender.call('send', { to: [name], text: 'new progress', kind: 'progress' });
    await sender.call('send', { to: [name], text: 'new report' });
    await eventually('second digest receipt', () => fake.injections.length === mark + 2 || undefined);
    assert.deepEqual(fake.injections[mark + 1]!.message.digest?.map(m => m.text), ['new progress']);
    assert.equal(fake.injections.length - mark, 2, 'uncertain batch never replays on idle or joins the new report');
    const retried = await ui.request({ type: 'session.retry', session: name, message: original.digest![0]!.id });
    assert.equal(retried.ok, true, retried.error);
    for (const id of [original.id, original.digest![0]!.id]) await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
    assert.equal(fake.injections.length - mark, 3);
    assert.deepEqual(fake.injections.at(-1)!.message, original);
    await receiver.close();
    assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
  }
});

test('a report queued to a vacant role picks up its recipient\'s held progress when the recipient reconnects', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const ui = await connectUi(t, discovery);
  const sender = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  const receiver = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'receiver' });
  t.after(() => sender.close());
  await sender.waitForPresence(['impl', 'coord']);
  await sender.call('send', { to: ['coord'], text: 'held before disconnect', kind: 'progress' });
  await receiver.close();
  await eventually('Coordinator disconnected', async () => {
    const r = await sender.call<{ sessions: Array<{ name: string }> }>('who');
    return r.sessions.some(s => s.name === 'coord') ? undefined : true;
  });
  const queued = await ui.request({ type: 'topic.send', topic: 'general', text: 'human report for vacant role', to: ['coordinator'] });
  assert.equal(queued.ok, true, queued.error);
  const reconnected = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'receiver' });
  t.after(() => reconnected.close());
  const delivery = await reconnected.waitForEvent(e => e.params.content.includes('human report for vacant role'));
  assert.match(delivery.params.content, /held before disconnect[\s\S]*human report for vacant role/);
});

// T2: hub time is driven by FakeClock; protocol peers run in-process.
test('expired held progress is dropped and journalled before a fresh report can bind it', async t => {
  const clock = new FakeClock(2000);
  const log: Array<Record<string, unknown>> = [];
  const hub = await startHub({ clock, queueTtlMs: 1000, log: e => { log.push(e); } });
  t.after(() => hub.close());
  const sender = await inProcessSpoke(t, { hub, name: 'sender', sessionId: 'sender' });
  const receiver = await inProcessSpoke(t, { hub, name: 'receiver', sessionId: 'receiver' });
  t.after(async t => { await sender.close(); await receiver.close(); });
  await sender.waitForPresence(['sender', 'receiver']);
  await sender.call('send', { to: ['receiver'], text: 'expired note', kind: 'progress' });
  await clock.advance(2000);
  await sender.call('send', { to: ['receiver'], text: 'fresh report' });
  const report = await receiver.waitForEvent(e => e.params.content.includes('fresh report'));
  assert.equal(report.params.content, 'fresh report');
  const ui = await connectWsUi(t, hub);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const expired = (history.value as { messages: Array<Message & { stage?: string }> }).messages.find(m => m.text === 'expired note')!;
  assert.equal(expired.stage, 'dropped');
  assert.ok(log.some(e => e.event === 'dropped' && e.id === expired.id && e.reason === 'queue ttl'), 'the existing journalled dropped event records the expiry');
});

// T2: hub time is driven by FakeClock; protocol peers run in-process.
test('prune preserves every member of a pending digest, then expires the batch together at its trigger\'s TTL', async t => {
  const clock = new FakeClock(2000);
  const hub = await startHub({ clock, queueTtlMs: 1000, retentionMs: 100 });
  t.after(() => hub.close());
  const sender = await inProcessSpoke(t, { hub, name: 'sender', sessionId: 'sender' });
  const receiver = await inProcessSpoke(t, { hub, name: 'receiver', sessionId: 'receiver' });
  t.after(() => sender.close());
  await sender.waitForPresence(['sender', 'receiver']);
  await receiver.close();
  const ui = await connectWsUi(t, hub);
  await eventually('receiver offline', async () => {
    const r = await sender.call<{ sessions: Array<{ name: string }> }>('who');
    return r.sessions.some(s => s.name === 'receiver') ? undefined : true;
  });
  await sender.call('send', { to: ['receiver'], text: 'older batch note', kind: 'progress' });
  await clock.advance(200);
  await sender.call('send', { to: ['receiver'], text: 'newer trigger' });
  await clock.advance(200);
  assert.equal(hub.prune(), 0, 'retention cannot truncate a queued digest');
  let history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((history.value as { messages: Message[] }).messages.map(m => m.text), ['older batch note', 'newer trigger']);
  await clock.advance(601); // the note's original TTL passed, but its trigger is still within TTL
  assert.equal(hub.prune(), 0, 'a bound note follows the trigger lifetime');
  await clock.advance(200);
  assert.equal(hub.prune(), 2, 'the whole expired batch is now eligible for retention');
  history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((history.value as { messages: Message[] }).messages, []);
  const reconnected = await inProcessSpoke(t, { hub, name: 'receiver', sessionId: 'receiver' });
  t.after(() => reconnected.close());
  await reconnected.waitForPresence(['sender', 'receiver']);
  await reconnected.call('who'); // ordered round trip after hello's queued-delivery flush
  assert.equal(reconnected.events.length, 0, 'expiry never delivers a partial batch');
});

// T2: hub time is driven by FakeClock; protocol peers run in-process.
test('an old note bound near its TTL still delivers with a fresh trigger after the note\'s original expiry', async t => {
  const clock = new FakeClock(2000);
  const hub = await startHub({ clock, queueTtlMs: 1000, retentionMs: 100 });
  t.after(() => hub.close());
  const sender = await inProcessSpoke(t, { hub, name: 'sender', sessionId: 'sender' });
  const receiver = await inProcessSpoke(t, { hub, name: 'receiver', sessionId: 'receiver' });
  t.after(() => sender.close());
  await sender.waitForPresence(['sender', 'receiver']);
  await receiver.close();
  await eventually('receiver offline', async () => {
    const r = await sender.call<{ sessions: Array<{ name: string }> }>('who');
    return r.sessions.some(s => s.name === 'receiver') ? undefined : true;
  });
  await sender.call('send', { to: ['receiver'], text: 'near TTL note', kind: 'progress' });
  await clock.advance(900);
  await sender.call('send', { to: ['receiver'], text: 'fresh trigger' });
  await clock.advance(200);
  assert.equal(hub.prune(), 0);
  const reconnected = await inProcessSpoke(t, { hub, name: 'receiver', sessionId: 'receiver' });
  t.after(() => reconnected.close());
  const batch = await reconnected.waitForEvent(e => e.params.content.includes('fresh trigger'));
  assert.match(batch.params.content, /near TTL note[\s\S]*fresh trigger/);
  assert.equal(reconnected.events.length, 1);
});

test('rename refuses a target with queued deliveries and preserves two differently bound copies of the same progress', async t => {
  const hub = await startHub({ clock: new FakeClock() });
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  const sender = await inProcessSpoke(t, { hub, name: 'sender', sessionId: 'sender' });
  const b = await inProcessSpoke(t, { hub, name: 'b', sessionId: 'b' });
  t.after(() => sender.close());
  await b.waitForPresence(['b']);
  await b.close();
  const a = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
  t.after(() => a.terminate());
  const frames: Array<Record<string, unknown>> = [];
  a.on('message', data => { frames.push(JSON.parse(data.toString())); });
  await new Promise<void>(resolve => a.once('open', resolve));
  a.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, name: 'a', role: 'coordinator', sessionId: 'a', cwd: '/' }));
  await eventually('A welcomed', () => frames.some(f => f.type === 'welcome') ? true : undefined);
  await sender.waitForPresence(['sender', 'a']);
  await sender.call('send', { to: ['a', 'b'], text: 'shared P', kind: 'progress' });
  await sender.call('send', { to: ['a'], text: 'R1' });
  await sender.call('send', { to: ['b'], text: 'R2' });
  const first = await eventually('R1 sent without ack', () => frames.find(f => f.type === 'deliver')?.message as Message | undefined);
  assert.equal(first.text, 'R1');
  assert.deepEqual(first.digest?.map(m => m.text), ['shared P']);
  a.send(JSON.stringify({ type: 'rename', id: 'rename', name: 'b' }));
  const refusal = await eventually('rename refused', () => frames.find(f => f.type === 'result' && f.id === 'rename'));
  assert.equal(refusal.ok, false);
  assert.match(String(refusal.error), /"b".*2 unacknowledged/);
  a.send(JSON.stringify({ type: 'ack', id: first.id }));
  const restoredB = await inProcessSpoke(t, { hub, name: 'b', sessionId: 'b' });
  t.after(() => restoredB.close());
  const second = await restoredB.waitForEvent(e => e.params.content.includes('R2'));
  assert.match(second.params.content, /shared P[\s\S]*R2/);
  assert.equal(second.params.content.includes('R1'), false);
  await eventually('both batches accepted', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const messages = (history.value as { messages: Array<Message & { stage?: string }> }).messages;
    return ['shared P', 'R1', 'R2'].every(text => messages.some(m => m.text === text && m.stage === 'delivered')) ? true : undefined;
  });
  assert.equal(frames.filter(f => f.type === 'deliver').length, 1);
  assert.equal(restoredB.events.filter(e => e.params.content.includes('R2')).length, 1);
});
