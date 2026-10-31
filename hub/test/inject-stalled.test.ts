// T2: failed-inject notice policy through real hub frames, fake harnesses and fake time.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { afterCleanup, onCleanup } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { replayAgentsRecord } from '../src/hub/agents-topic.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';
import { sessionLine } from '../src/cli/session.ts';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { sqliteProbe } from './sqlite-probe.ts';
import { Store } from '../src/hub/store.ts';
import { FakeClock } from './fake-clock.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import { fakeHarness, type FakeHarness } from './fakes/harness.ts';
import { realClock } from '../src/hub/clock.ts';
import { HubCore } from '../src/hub/core.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';

test('an hour of failed idle retries backs off with one log per pending message', async t => {
  // T1 policy seam: memory stores and fake harness signals; transport and native
  // recovery have separate component/contract proofs below and in the T3 files.
  const root = '/virtual/project';
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const log = (entry: Record<string, unknown>) => { logs.push(entry); };
  const core = new HubCore({ clock, log });
  const table = new ProcessTable(':memory:', clock);
  const sessions = new Sessions({ core, table, root, log });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  const fake = fakeHarness('claude-code', { clock, host: sessions.host({ discoveryFile: '', node: '', cli: '', spoke: '' }) });
  sessions.register(fake);
  const process = await fake.spawn({ name: 'impl', role: 'implementer', model: null, cwd: root });
  table.put(process);
  const joined = core.hello({ type: 'hello', protocol: 2, name: 'impl', role: 'implementer', sessionId: process.sessionId, cwd: root }, () => true);
  assert.ok(joined.ok);
  fake.idle('impl');
  fake.scriptInject('impl', ...Array<'reject'>(200).fill('reject'));
  const ids: string[] = [];
  for (const text of ['pending first', 'pending second']) {
    const { message } = core.sendFromHuman('general', text, ['impl']);
    const id = message.id;
    ids.push(id);
    core.ack(joined.connection, id);
    await clock.advance(0);
    assert.ok(logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id), 'initial failed inject completed');
  }
  for (let minute = 0; minute < 60; minute++) {
    await clock.advance(60_000);
    fake.busy('impl');
    fake.idle('impl');
  }
  await clock.advance(0); // Settle the final minute's rejected injection.
  for (const id of ids) {
    assert.equal(logs.filter(entry => entry.event === 'inject-unconfirmed' && entry.id === id).length, 1, 'one failure log per message during the outage');
    const attempts = fake.injections.filter(input => input.message.id === id).length;
    assert.ok(attempts > 1 && attempts <= 9, `bounded backoff attempts during one hour: ${attempts}`);
    assert.equal(core.topicHistory('general').messages.find(message => message.id === id)?.stage, 'delivered', 'failed delivery stays pending');
  }
});

test('reconnect bypasses backoff even during an in-flight failure', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  let fake!: FakeHarness;
  let reconnect!: NonNullable<AdapterHost['reconnected']>;
  const { discovery } = await projectHub(t, root, {}, {
    clock, log: entry => logs.push(entry),
    adapters: [(host, clock) => {
      reconnect = host.reconnected!;
      return fake = fakeHarness('claude-code', { host, clock });
    }],
  });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const sessionId = (launched.value as { process: HarnessProcessView }).process.sessionId;
  const peer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['impl']);
  fake.idle('impl');
  fake.scriptInject('impl', 'reject', 'reject', 'hold', 'accept');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'recover this pending delivery' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: Message }).message.id;
  await eventually('first failure', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
  fake.busy('impl');
  fake.idle('impl');
  await ui.request({ type: 'session.list' });
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 2);
  reconnect(sessionId);
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 3, 'recovery bypasses the one-minute backoff');
  reconnect(sessionId);
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 3, 'reconnect never duplicates an in-flight inject');
  fake.settle('impl', id, 'reject');
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 4, 'the in-flight reconnect still triggers immediate recovery');
  assert.equal(logs.filter(entry => entry.event === 'inject-unconfirmed' && entry.id === id).length, 2, 'one failure log for each connection episode');
});

test('a reconnect starts a fresh retry episode after an earlier missing-bridge failure', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  let fake!: FakeHarness;
  let reconnect!: NonNullable<AdapterHost['reconnected']>;
  const { discovery } = await projectHub(t, root, {}, {
    clock, log: entry => logs.push(entry),
    adapters: [(host, clock) => {
      reconnect = host.reconnected!;
      return fake = fakeHarness('claude-code', { host, clock });
    }],
  });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const sessionId = (launched.value as { process: HarnessProcessView }).process.sessionId;
  const peer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['impl']);
  fake.idle('impl');
  fake.scriptInject('impl', 'reject', { outcome: 'reject', afterMs: 1000 }, 'accept');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'recover after the bridge connects' });
  const id = (sent.value as { message: Message }).message.id;
  await eventually('disconnected failure receipt', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
  reconnect(sessionId);
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 2, 'connected inject is in flight');
  const at = realClock.now().getTime() + 1;
  for (const [event, offset] of [['turn-start', 0], ['turn-end', 1]] as const) {
    const signal = await ui.request({ type: 'session.signal', session: 'impl', event, at: at + offset });
    assert.equal(signal.ok, true, signal.error);
  }
  await clock.advance(1000);
  await ui.request({ type: 'session.list' });
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 3, 'the remembered idle retries the connected timeout immediately');
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  assert.equal(logs.filter(entry => entry.event === 'inject-unconfirmed' && entry.id === id).length, 2, 'one completion log in each connection episode');
});

test('explicit retry of an uncertain delivery clears its earlier failure backoff', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  let fake!: FakeHarness;
  let reconnect!: NonNullable<AdapterHost['reconnected']>;
  const { discovery } = await projectHub(t, root, {}, {
    clock, log: entry => logs.push(entry),
    adapters: [(host, clock) => {
      reconnect = host.reconnected!;
      return fake = fakeHarness('codex', { host, clock });
    }],
  });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'codex', name: 'impl', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const sessionId = (launched.value as { process: HarnessProcessView }).process.sessionId;
  const peer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['impl']);
  fake.idle('impl');
  fake.scriptInject('impl', 'reject', 'reject', 'uncertain', 'accept');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'uncertain after an outage' });
  const id = (sent.value as { message: Message }).message.id;
  await eventually('initial failure', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
  fake.busy('impl');
  fake.idle('impl');
  await ui.request({ type: 'session.list' });
  reconnect(sessionId);
  await eventually('uncertain receipt', () => logs.some(entry => entry.event === 'inject-uncertain' && entry.id === id) || undefined);
  const retried = await ui.request({ type: 'session.retry', session: 'impl', message: id });
  assert.equal(retried.ok, true, retried.error);
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 4, 'explicit human retry injects before the backoff deadline');
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
});

test('an idle predating an in-flight inject cannot queue a retry across clock domains', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(0); // Policy time deliberately differs from transport timestamps.
  const logs: Array<Record<string, unknown>> = [];
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const peer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId: (launched.value as { process: HarnessProcessView }).process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['impl']);
  fake.idle('impl');
  const oldIdle = realClock.now().getTime() - 1;
  fake.scriptInject('impl', 'hold', 'accept');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'already accounts for the old idle' });
  const id = (sent.value as { message: Message }).message.id;
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'delivered');
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 1, 'inject is in flight before the delayed signal');
  fake.busy('impl'); // Human input now waits when already busy; this inject entered while idle.
  const signal = await ui.request({ type: 'session.signal', session: 'impl', event: 'turn-end', at: oldIdle });
  assert.equal(signal.ok, true, signal.error);
  assert.equal((signal.value as { applied: boolean }).applied, true, 'the delayed idle changes state while injection is held');
  fake.settle('impl', id, 'reject');
  await eventually('held inject failure completed', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
  await ui.request({ type: 'session.list' });
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 1, 'the delayed old idle does not replay the failed inject');
});

test('sustained unconfirmed injection raises one routed notice per session episode', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer']] as const) {
    const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name, role });
    assert.equal(launched.ok, true, launched.error);
    const process = (launched.value as { process: HarnessProcessView }).process;
    const peer = await inProcessSpoke(t, { cwd: root, discover: true, name, role, sessionId: process.sessionId, launchToken: fake.spawns.at(-1)!.launchToken! });
    await peer.waitForPresence([name]);
    fake.idle(name);
  }
  const notices = () => ui.frames.filter(f => f.type === 'message' && (f.message as Message).kind === 'deaf').map(f => f.message as Message);
  const fail = async (name: string) => {
    fake.scriptInject(name, 'reject');
    const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [name], text: `must reach ${name}` });
    assert.equal(sent.ok, true, sent.error);
    const id = (sent.value as { message: Message }).message.id;
    await eventually('failed inject completed', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
    return id;
  };
  for (const name of ['coord', 'impl']) {
    const threshold = 300_001;
    const first = await fail(name);
    await clock.advance(threshold - 1);
    await ui.request({ type: 'session.list' });
    assert.equal(notices().filter(note => note.detail?.session === name && note.topic === 'agents').length, 0);
    await clock.advance(1);
    const frame = await ui.waitFor(f => f.type === 'message' && (f.message as Message).kind === 'deaf' && (f.message as Message).detail?.session === name);
    const note = frame.message as Message;
    const listed = await ui.request({ type: 'session.list' });
    const row = (listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === name)!;
    assert.equal(row.stateReason, 'deaf');
    assert.match(sessionLine(row), /\[deaf\]/);
    const status = await ui.request({ type: 'hub.status' });
    assert.equal((status.value as { sessions: Array<{ name: string; stateReason?: string }> }).sessions.find(p => p.name === name)?.stateReason, 'deaf');
    const inbox = await ui.request({ type: 'inbox.list' });
    assert.equal((inbox.value as { messages: Array<{ text: string }> }).messages.filter(m => m.text === note.text).length, 1);
    assert.match(note.text, new RegExp(name));
    assert.match(note.text, /oldest held message/);
    assert.ok(note.topic === 'agents' || note.topic === 'general');
    assert.deepEqual(note.to, []);
    const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string; session?: string }> };
    assert.equal(events.rows.filter(row => row.text === note.text && row.session === name).length, 1);
    await fail(name);
    await clock.advance(120_000);
    await ui.request({ type: 'session.list' });
    assert.equal(notices().filter(note => note.detail?.session === name && note.topic === 'agents').length, 1, 'repeated failures do not flood notices');
    fake.busy(name);
    fake.idle(name);
    await ui.waitFor(f => f.type === 'delivery' && f.message === first && f.stage === 'injected');
    await fail(name);
    await clock.advance(threshold);
    await eventually('new episode notices once', async () => {
      await ui.request({ type: 'session.list' });
      return notices().filter(note => note.detail?.session === name && note.topic === 'agents').length === 2 || undefined;
    });
    fake.busy(name);
    fake.idle(name);
  }
});

test('confirmation before the threshold cancels the unconfirmed-inject notice', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'coord', role: 'coordinator' });
  const peer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: (launched.value as { process: HarnessProcessView }).process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['coord']);
  fake.scriptInject('coord', 'reject');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'briefly disconnected' });
  const id = (sent.value as { message: Message }).message.id;
  await eventually('failure receipt', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
  await clock.advance(59_999);
  fake.busy('coord');
  fake.idle('coord');
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  await clock.advance(600_000);
  await ui.request({ type: 'session.list' });
  assert.ok(!ui.frames.some(f => f.type === 'message' && (f.message as Message).kind === 'deaf'));
});

test('five minutes of unconfirmed Coordinator delivery alerts General and the named Aide despite reconnect', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  let reconnect!: NonNullable<AdapterHost['reconnected']>;
  let fake!: FakeHarness;
  const { discovery } = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry), adapters: [(host, clock) => {
    reconnect = host.reconnected!;
    return fake = fakeHarness('claude-code', { host, clock });
  }] });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const peers = [];
  for (const [name, role] of [['coord', 'coordinator'], ['helper', 'aide']] as const) {
    const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name, role });
    assert.equal(launched.ok, true, launched.error);
    const sessionId = (launched.value as { process: HarnessProcessView }).process.sessionId;
    const peer = await inProcessSpoke(t, { cwd: root, discover: true, name, role, sessionId, launchToken: fake.spawns.at(-1)!.launchToken! });
    await peer.waitForPresence([name]);
    fake.idle(name);
    peers.push({ peer, sessionId });
  }
  fake.scriptInject('coord', 'reject', 'reject', 'reject', 'accept');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'Coordinator cannot run this' });
  const id = (sent.value as { message: Message }).message.id;
  await eventually('failed delivery receipt', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
  const notices = () => ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).kind === 'deaf' && (frame.message as Message).topic === 'general').map(frame => frame.message as Message);
  await clock.advance(240_000);
  reconnect(peers[0]!.sessionId);
  await eventually('reconnected failure receipt', () => logs.filter(entry => entry.event === 'inject-unconfirmed' && entry.id === id).length === 2 || undefined);
  await clock.advance(60_000);
  await ui.request({ type: 'session.list' });
  assert.equal(notices().length, 0, 'no General escalation before five minutes');
  const humanNotice = ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).kind === 'deaf' && (frame.message as Message).topic === 'general');
  const aideNotice = peers[1]!.peer.waitForEvent(event => event.params.content.includes('cland session resume coord --relaunch'));
  await clock.advance(1);
  const note = (await humanNotice).message as Message;
  await aideNotice;
  assert.deepEqual(note.to, ['helper']);
  assert.match(note.text, /coord.*oldest held message/);
  assert.match(note.text, /cland session resume coord --relaunch/);
  const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string; session?: string }> };
  assert.equal(events.rows.filter(row => row.text === note.text && row.session === 'coord').length, 1);
  reconnect(peers[0]!.sessionId);
  await eventually('third failed delivery receipt', () => logs.filter(entry => entry.event === 'inject-unconfirmed' && entry.id === id).length === 3 || undefined);
  await clock.advance(600_000);
  await ui.request({ type: 'session.list' });
  assert.equal(notices().length, 1, 'reconnects and retries cannot flood the human');
  fake.busy('coord');
  fake.idle('coord');
  await ui.waitFor(frame => frame.type === 'delivery' && frame.message === id && frame.stage === 'injected');
});

test('held human input becomes deaf after five minutes and next injection clears it', async t => {
  const root = '/virtual/project';
  const clock = new FakeClock();
  const core = new HubCore({ clock });
  const table = new ProcessTable(':memory:', clock);
  const sessions = new Sessions({ core, table, root });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  const fake = fakeHarness('claude-code', { clock, host: sessions.host({ discoveryFile: '', node: '', cli: '', spoke: '' }) });
  sessions.register(fake);
  core.inbox.useProcesses(() => sessions.list());
  const process = await fake.spawn({ name: 'coord', role: 'coordinator', model: null, cwd: root });
  table.put(process);
  const joined = core.hello({ type: 'hello', protocol: 2, name: 'coord', role: 'coordinator', sessionId: process.sessionId, cwd: root }, () => true);
  assert.ok(joined.ok);
  fake.busy('coord');
  const { message } = core.sendFromHuman('general', 'held input', ['coord']);
  await clock.advance(300_000);
  assert.notEqual(sessions.view(process).stateReason, 'deaf');
  await clock.advance(1);
  assert.equal(sessions.view(process).stateReason, 'deaf');
  const notices = () => core.topicHistory('agents').messages.filter(m => m.kind === 'deaf');
  assert.equal(notices().length, 1);
  assert.equal(core.inbox.list().messages.filter(m => m.text.includes(message.id)).length, 1);
  assert.match(notices()[0]!.text, new RegExp(message.id));
  assert.match(notices()[0]!.text, /cland session retry coord/);
  assert.equal(core.topicHistory('general').messages.filter(m => m.kind === 'deaf').length, 1);
  await clock.advance(600_000);
  assert.equal(notices().length, 1);
  fake.idle('coord');
  core.ack(joined.connection, message.id);
  await clock.advance(0);
  assert.equal(core.store.deliveriesOf(message.id)[0]?.state, 'injected');
  assert.notEqual(sessions.view(process).stateReason, 'deaf');
  assert.equal(core.inbox.list().messages.filter(m => m.text.includes('is deaf:')).length, 0);
});

function retainedDeliveryFixture(t: TestContext, root: string, clock: FakeClock, logs: Array<Record<string, unknown>>) {
  let store: Store | undefined;
  let table: ProcessTable | undefined;
  let core: HubCore | undefined;
  let sessions: Sessions | undefined;
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    await sessions?.close(); table?.close(); core?.close(); store?.close();
  })();
  onCleanup(t, close); // Own every partially acquired generation before opening storage.
  store = new Store(join(root, 'delivery.db'));
  core = new HubCore({ clock, store, log: entry => logs.push(entry) });
  core.inbox.list(); // Startup may project the inbox before adapter configuration.
  table = new ProcessTable(join(root, 'process.db'), clock);
  sessions = new Sessions({ core, table, root, log: entry => logs.push(entry) });
  const fake = fakeHarness('claude-code', { clock, host: sessions.host({ discoveryFile: '', node: '', cli: '', spoke: '' }) });
  sessions.register(fake);
  core.inbox.useProcesses(() => sessions!.list());
  return { core, table, sessions, fake, close };
}

for (const legacy of [false, true]) test(`restart replay of superseded and confirmed ids stays quiet while fresh input injects (${legacy ? 'legacy equal-time receipts' : 'current watermark'})`, async t => {
  const scope = caseDeadlines(t);
  const root = await scope.wait('scratch root setup', () => tempProject(scope.fixtures));
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const open = () => retainedDeliveryFixture(scope.fixtures, root, clock, logs);
  const first = open();
  const process = await scope.wait('first fake spawn', () => first.fake.spawn({ name: 'impl', role: 'implementer', model: null, cwd: root }));
  first.table.put(process);
  const joined = first.core.hello({ type: 'hello', protocol: 2, name: 'impl', role: 'implementer', sessionId: process.sessionId, cwd: root }, () => true);
  assert.ok(joined.ok);
  first.fake.idle('impl');
  let earlierId: string | undefined;
  if (legacy) {
    const earlier = first.core.sendFromHuman('general', 'earlier confirmed input at equal time', ['impl']).message;
    earlierId = earlier.id;
    first.core.ack(joined.connection, earlier.id);
    await scope.wait('earlier injection receipt', () => clock.advance(0));
    assert.equal(first.core.store.deliveriesOf(earlier.id)[0]?.state, 'injected');
  }
  first.fake.scriptInject('impl', 'reject', 'accept');
  const old = first.core.sendFromHuman('general', 'old unconfirmed input', ['impl']).message;
  first.core.ack(joined.connection, old.id);
  await scope.wait('injection completion', () => clock.advance(0));
  assert.ok(logs.some(row => row.event === 'inject-unconfirmed' && row.id === old.id));
  const confirmed = first.core.sendFromHuman('general', 'later confirmed input', ['impl']).message;
  first.core.ack(joined.connection, confirmed.id);
  await scope.wait('injection completion', () => clock.advance(0));
  assert.equal(first.core.store.deliveriesOf(confirmed.id)[0]?.state, 'injected');
  if (legacy) first.core.store.clearMeta(`deaf-confirmed:${process.sessionId}`);
  await scope.wait('first generation disposal', first.close);
  if (legacy) {
    // A retained database restored from a logical dump need not keep insertion
    // rowids aligned with message sequence. Keep every persisted column, but put
    // the earlier equal-time receipt last in the timestamp index's rowid tie.
    const db = new DatabaseSync(join(root, 'delivery.db'));
    try {
      db.exec('create temporary table retained_deliveries as select * from deliveries; delete from deliveries');
      db.prepare('insert into deliveries select * from retained_deliveries order by case when message_id = ? then 1 else 0 end, message_id').run(earlierId!);
    } finally { db.close(); }
  }
  const second = open();

  second.fake.watch(process);
  second.fake.scriptInject('impl', 'reject', 'accept');
  const rejoined = second.core.hello({ type: 'hello', protocol: 2, name: 'impl', role: 'implementer', sessionId: process.sessionId, cwd: root }, () => true);
  assert.ok(rejoined.ok);
  second.fake.busy('impl');
  second.fake.idle('impl');
  // A repeat acknowledgement for an already confirmed identity cannot reopen it.
  second.core.ack(rejoined.connection, confirmed.id);
  await scope.wait('injection completion', () => clock.advance(0));
  assert.equal(logs.filter(row => row.event === 'inject-unconfirmed' && row.id === old.id).length, 2, 'old id was actually replayed after restart');
  await scope.wait('stale replay observation window', () => clock.advance(600_001));
  assert.ok(!second.core.topicHistory('agents').messages.some(m => m.kind === 'deaf' || m.kind === 'inject-stalled'));
  assert.equal(second.core.inbox.list().messages.filter(m => m.text.includes('is deaf:')).length, 0);
  const fresh = second.core.sendFromHuman('general', 'fresh input after restart', ['impl']).message;
  second.core.ack(rejoined.connection, fresh.id);
  await scope.wait('injection completion', () => clock.advance(0));
  assert.equal(second.core.store.deliveriesOf(fresh.id)[0]?.state, 'injected');
  assert.notEqual(second.sessions.view(process).stateReason, 'deaf');
});

test('a retained deaf episode survives restart once and preserves the lifecycle journal suffix', async t => {
  const scope = caseDeadlines(t);
  const root = await scope.wait('scratch root setup', () => tempProject(scope.fixtures));
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const first = retainedDeliveryFixture(scope.fixtures, root, clock, logs);
  const process = await scope.wait('fake spawn', () => first.fake.spawn({ name: 'coord', role: 'coordinator', model: null, cwd: root }));
  first.table.put(process);
  const joined = first.core.hello({ type: 'hello', protocol: 2, name: 'coord', role: 'coordinator', sessionId: process.sessionId, cwd: root }, () => true);
  assert.ok(joined.ok);
  const records = [{ event: 'role-assigned', session: 'journal-before', role: 'implementer', agentsNotice: 'lifecycle-before' }];
  assert.equal(replayAgentsRecord(first.core, records), 1);
  first.fake.busy('coord');
  const message = first.core.sendFromHuman('general', 'held across restart', ['coord']).message;
  await scope.wait('deaf deadline', () => clock.advance(300_001));
  const before = first.core.inbox.list().messages.find(m => m.text.includes(message.id))!;
  assert.ok(before);
  const notifications = logs.filter(row => row.event === 'notification' && row.kind === 'delivery-stalled').length;
  await scope.wait('first generation drainage', first.close);
  const second = retainedDeliveryFixture(scope.fixtures, root, clock, logs);
  second.fake.watch(process);
  const rejoined = second.core.hello({ type: 'hello', protocol: 2, name: 'coord', role: 'coordinator', sessionId: process.sessionId, cwd: root }, () => true);
  assert.ok(rejoined.ok);
  second.fake.busy('coord');
  await scope.wait('retained episode timer', () => clock.advance(600_001));
  assert.equal(second.sessions.view(process).stateReason, 'deaf');
  const after = second.core.inbox.list().messages.find(m => m.text.includes(message.id))!;
  assert.equal(after.id, before.id);
  assert.equal(after.since, before.since);
  assert.equal(second.core.store.leftInbox('message', before.id), false, 'startup did not depart the retained wait');
  assert.equal(logs.filter(row => row.event === 'notification' && row.kind === 'delivery-stalled').length, notifications);
  assert.equal(second.core.topicHistory('agents').messages.filter(m => m.kind === 'deaf').length, 1);
  assert.equal(second.core.topicHistory('general').messages.filter(m => m.kind === 'deaf').length, 1);
  assert.equal(replayAgentsRecord(second.core, [...records, { event: 'role-assigned', session: 'journal-after', role: 'implementer', agentsNotice: 'lifecycle-after' }]), 1);
  second.fake.idle('coord');
  second.core.ack(rejoined.connection, message.id);
  await scope.wait('confirmed recovery', () => clock.advance(0));
  assert.equal(second.core.store.deliveriesOf(message.id)[0]?.state, 'injected');
  assert.notEqual(second.sessions.view(process).stateReason, 'deaf');
});

test('another recipient confirming an old fanout cannot clear a deaf session', async t => {
  const scope = caseDeadlines(t);
  const root = await scope.wait('scratch root setup', () => tempProject(scope.fixtures));
  const clock = new FakeClock();
  const f = retainedDeliveryFixture(scope.fixtures, root, clock, []);
  const connections = new Map<string, Parameters<HubCore['ack']>[0]>();
  const processes = new Map<string, Parameters<Sessions['view']>[0]>();
  for (const name of ['alpha', 'beta']) {
    const process = await scope.wait('fake spawn', () => f.fake.spawn({ name, role: 'implementer', model: null, cwd: root }));
    f.table.put(process); processes.set(name, process);
    const hello = f.core.hello({ type: 'hello', protocol: 2, name, role: 'implementer', sessionId: process.sessionId, cwd: root }, () => true);
    assert.ok(hello.ok); connections.set(name, hello.connection); f.fake.idle(name);
  }
  const fanout = f.core.sendFromHuman('general', 'fanout', ['alpha', 'beta']).message;
  f.core.ack(connections.get('alpha')!, fanout.id);
  await scope.wait('alpha fanout injection', () => clock.advance(0));
  assert.equal(f.core.store.deliveriesOf(fanout.id).find(d => d.session === 'alpha')?.state, 'injected');
  f.fake.busy('alpha');
  const held = f.core.sendFromHuman('general', 'alpha held input', ['alpha']).message;
  await scope.wait('alpha deaf boundary', () => clock.advance(300_001));
  assert.equal(f.sessions.view(processes.get('alpha')!).stateReason, 'deaf');
  const before = f.core.inbox.list().messages.find(m => m.text.includes(held.id))!;
  f.fake.scriptInject('beta', 'hold');
  f.core.ack(connections.get('beta')!, fanout.id);
  assert.equal(f.sessions.view(processes.get('alpha')!).stateReason, 'deaf', 'other acknowledgement cannot clear alpha');
  f.fake.settle('beta', fanout.id, 'accept');
  await scope.wait('beta fanout injection', () => clock.advance(0));
  assert.equal(f.core.store.deliveriesOf(fanout.id).find(d => d.session === 'beta')?.state, 'injected');
  assert.equal(f.sessions.view(processes.get('alpha')!).stateReason, 'deaf', 'other positive injection cannot clear alpha');
  assert.equal(f.core.inbox.list().messages.find(m => m.id === before.id)?.since, before.since);
  f.fake.idle('alpha'); f.core.ack(connections.get('alpha')!, held.id);
  await scope.wait('alpha own injection', () => clock.advance(0));
  assert.equal(f.core.store.deliveriesOf(held.id)[0]?.state, 'injected');
  assert.notEqual(f.sessions.view(processes.get('alpha')!).stateReason, 'deaf');
});

for (const stage of ['queued', 'delivered'] as const) test(`deaf ${stage} notice recovery command executes through the fake harness`, async t => {
  const scope = caseDeadlines(t, { timeoutMs: 15_000 });
  const root = await scope.wait('root setup', () => tempProject(scope.fixtures));
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const hub = await scope.wait('hub setup', () => projectHub(scope.fixtures, root, {}, { clock, log: row => logs.push(row) }));
  const ui = await scope.wait('UI setup', () => connectUi(scope.fixtures, hub.discovery));
  await scope.wait('subscribe setup', () => ui.request({ type: 'subscribe' }));
  const launched = await scope.wait('launch setup', () => ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' }));
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const fake = hub.fakes['claude-code']!;
  const peer = await scope.wait('spoke setup', () => inProcessSpoke(scope.fixtures, { cwd: root, discover: true, name: 'impl', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! }));
  await scope.wait('presence setup', () => peer.waitForPresence(['impl']));
  if (stage === 'queued') fake.busy('impl');
  else { fake.idle('impl'); fake.scriptInject('impl', 'reject'); }
  const sent = await scope.wait('input send', () => ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'recover held input' }));
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: Message }).message.id;
  if (stage === 'delivered') await scope.wait('failed injection receipt', () => eventually('failed injection receipt', () => logs.some(row => row.event === 'inject-unconfirmed' && row.id === id) || undefined));
  const noticed = scope.wait('deaf notice', () => ui.waitFor(f => f.type === 'message' && (f.message as Message).kind === 'deaf' && (f.message as Message).detail?.message === id));
  await scope.wait('deaf boundary', () => clock.advance(300_001));
  const text = ((await noticed).message as Message).text;
  assert.match(text, new RegExp(`\\(${stage}\\)`));
  const command = text.match(/`cland session ([^`]+)`/)![1]!.split(' ');
  assert.deepEqual(command, stage === 'queued' ? ['retry', 'impl'] : ['resume', 'impl', '--relaunch']);
  const reply = await scope.wait('displayed recovery command', () => ui.request(command[0] === 'retry'
    ? { type: 'session.retry', session: command[1]! }
    : { type: 'session.resume', session: command[1]!, relaunch: command[2] === '--relaunch' }));
  assert.equal(reply.ok, true, reply.error);
  if (stage === 'queued') {
    await scope.wait('recovered injection', () => ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected'));
  } else {
    assert.ok(fake.stops.some(p => p.sessionId === process.sessionId), 'old fake harness stopped');
    const listed = await scope.wait('persisted replacement process', () => ui.request({ type: 'session.list' }));
    const replacement = (listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'impl')!;
    assert.equal(replacement.status, 'running');
    assert.notEqual(replacement.startedAt, process.startedAt);
    assert.equal(fake.resumes.filter(row => row.options?.relaunch).length, 1, 'one replacement fake relaunch');
  }
});

for (const mode of ['omitted', 'aborted', 'early-failure'] as const) test(`retained delivery fixture ${mode} setup receipt still disposes its first generation`, async t => {
  const receipt = Promise.withResolvers<void>();
  let native: Promise<ReturnType<typeof retainedDeliveryFixture>> | undefined;
  let assertion: Promise<void> | undefined;
  const emergencyReleaseAndJoin = async () => {
    receipt.resolve();
    await native?.catch(() => {});
    await assertion?.catch(() => {});
  };
  // Real test cleanup precedes deadline owners: a failed setup observation may
  // leave admitted acquisition held, so release must precede their pending joins.
  t.after(emergencyReleaseAndJoin);
  const nativeScope = caseDeadlines(t, { timeoutMs: 1_000 });
  const clock = new FakeClock();
  const scope = caseDeadlines(t, { clock, timeoutMs: 10 });
  const root = await scope.wait('scratch root setup', () => tempProject(scope.fixtures));
  const entered = Promise.withResolvers<void>();
  let captured: ReturnType<typeof retainedDeliveryFixture> | undefined;
  const observed = scope.wait('generation setup receipt', () => {
    native = (async () => {
      captured = retainedDeliveryFixture(scope.fixtures, root, clock, []);
      entered.resolve();
      await receipt.promise;
      return captured;
    })();
    return native;
  });
  assertion = mode === 'early-failure' ? observed.then(() => {})
    : assert.rejects(observed, mode === 'omitted' ? /generation setup receipt.*deadline exceeded/ : /setup aborted/);
  void assertion.catch(() => {}); // Owned immediately, including an earlier setup/assertion failure.
  afterCleanup(scope.fixtures, () => {
    assert.ok(captured);
    assert.throws(() => captured!.core.store.meta('closed-receipt'), /not open|closed/);
  });
  await nativeScope.wait('generation acquired before fault', () => entered.promise);
  if (mode === 'early-failure') {
    await assert.rejects(async () => { throw new Error('early assertion failure while acquisition is held'); }, /early assertion failure/);
    await nativeScope.wait('emergency cleanup releases held acquisition before owner joins', emergencyReleaseAndJoin);
  } else if (mode === 'omitted') await clock.advance(10);
  else receipt.reject(new Error('setup aborted'));
  await assertion;
  receipt.resolve();
  await nativeScope.wait('admitted acquisition drainage', () => native!.catch(() => {}));
});

test('legacy null recipient identity binds to its actual native injection and clears its retained deaf episode', async t => {
  const scope = caseDeadlines(t);
  const root = await scope.wait('root setup', () => tempProject(scope.fixtures));
  const clock = new FakeClock();
  const first = retainedDeliveryFixture(scope.fixtures, root, clock, []);
  const process = await scope.wait('fake spawn', () => first.fake.spawn({ name: 'impl', role: 'implementer', model: null, cwd: root }));
  first.table.put(process);
  const hello = first.core.hello({ type: 'hello', protocol: 2, name: 'impl', role: 'implementer', sessionId: process.sessionId, cwd: root }, () => true);
  assert.ok(hello.ok);
  first.fake.idle('impl'); first.fake.scriptInject('impl', 'reject');
  const message = first.core.sendFromHuman('general', 'legacy delivery', ['impl']).message;
  first.core.ack(hello.connection, message.id);
  await scope.wait('unconfirmed and deaf boundary', () => clock.advance(300_001));
  assert.equal(first.sessions.view(process).stateReason, 'deaf');
  await scope.wait('first generation drainage', first.close);
  const db = new DatabaseSync(join(root, 'delivery.db'));
  try { db.prepare('update deliveries set session_id = null where message_id = ?').run(message.id); }
  finally { db.close(); }
  const second = retainedDeliveryFixture(scope.fixtures, root, clock, []);
  assert.equal(second.core.store.deliverySessionId(message.id, 'impl'), null);
  second.fake.watch(process);
  const rejoined = second.core.hello({ type: 'hello', protocol: 2, name: 'impl', role: 'implementer', sessionId: process.sessionId, cwd: root }, () => true);
  assert.ok(rejoined.ok);
  second.fake.busy('impl'); second.fake.idle('impl');
  await scope.wait('actual native confirmation', () => clock.advance(0));
  assert.equal(second.core.store.deliveriesOf(message.id)[0]?.state, 'injected');
  assert.equal(second.core.store.deliverySessionId(message.id, 'impl'), process.sessionId);
  assert.notEqual(second.sessions.view(process).stateReason, 'deaf');
  assert.equal(second.core.inbox.list().messages.filter(m => m.text.includes(message.id)).length, 0);
});

test('a reused display name grants no injection authority over the new session', async t => {
  const scope = caseDeadlines(t);
  const root = await scope.wait('root setup', () => tempProject(scope.fixtures));
  const clock = new FakeClock();
  const f = retainedDeliveryFixture(scope.fixtures, root, clock, []);
  const old = await scope.wait('old fake spawn', () => f.fake.spawn({ name: 'impl', role: 'implementer', model: null, cwd: root }));
  f.table.put(old);
  const previous = f.core.hello({ type: 'hello', protocol: 2, name: 'impl', role: 'implementer', sessionId: old.sessionId, cwd: root }, () => true);
  assert.ok(previous.ok);
  f.core.disconnect(previous.connection);
  f.table.update('impl', { status: 'stopped' });
  const current = await scope.wait('replacement fake spawn', () => f.fake.spawn({ name: 'impl', role: 'implementer', model: null, cwd: root }));
  f.table.put(current);
  const joined = f.core.hello({ type: 'hello', protocol: 2, name: 'impl', role: 'implementer', sessionId: current.sessionId, cwd: root }, () => true);
  assert.ok(joined.ok);
  f.fake.idle('impl'); f.fake.scriptInject('impl', 'hold');
  const held = f.core.sendFromHuman('general', 'new holder input', ['impl']).message;
  f.core.ack(joined.connection, held.id);
  await scope.wait('new holder deaf boundary', () => clock.advance(300_001));
  assert.equal(f.sessions.view(current).stateReason, 'deaf');
  assert.equal(f.core.markInjected(held.id, 'impl', old.sessionId), false, 'old captured id cannot confirm the new holder input');
  assert.equal(f.core.store.deliveriesOf(held.id)[0]?.state, 'delivered');
  assert.equal(f.sessions.view(current).stateReason, 'deaf');
  f.fake.settle('impl', held.id, 'accept');
  await scope.wait('new holder own native confirmation', () => clock.advance(0));
  assert.equal(f.core.store.deliveriesOf(held.id)[0]?.state, 'injected');
  assert.notEqual(f.sessions.view(current).stateReason, 'deaf');
});

test('delivery and session views defer deaf candidate work to one session timer', async t => {
  const scope = caseDeadlines(t);
  const root = await scope.wait('scratch setup', () => tempProject(scope.fixtures));
  const database = sqliteProbe();
  const clock = new FakeClock();
  const hub = await scope.wait('hub setup', () => projectHub(scope.fixtures, root, {}, { clock, openDatabase: database.open }));
  const ui = await scope.wait('UI setup', () => connectUi(scope.fixtures, hub.discovery));
  const launched = await scope.wait('launch setup', () => ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' }));
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const fake = hub.fakes['claude-code']!;
  const peer = await scope.wait('spoke setup', () => inProcessSpoke(scope.fixtures, { cwd: root, discover: true, name: 'impl', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! }));
  await scope.wait('presence setup', () => peer.waitForPresence(['impl']));
  fake.busy('impl');
  let candidateReads = 0;
  database.trace(scope.fixtures, (sql, method) => {
    if (method === 'get' && sql.includes('and m.seq > max(')) candidateReads++;
  });
  const ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    const sent = await scope.wait('held input send', () => ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: `held input ${i}` }));
    assert.equal(sent.ok, true, sent.error); ids.push((sent.value as { message: Message }).message.id);
    assert.equal((await scope.wait('explicit session view', () => ui.request({ type: 'session.list' }))).ok, true);
  }
  assert.equal(candidateReads, 0, 'delivery and view paths do not query retained health candidates');
  await scope.wait('bounded session derivation', () => clock.advance(1));
  assert.equal(candidateReads, 1, 'positive control: one coalesced pass reads the affected session');
  await scope.wait('deaf boundary', () => clock.advance(300_000));
  const listed = await scope.wait('deaf view', () => ui.request({ type: 'session.list' }));
  const row = (listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'impl')!;
  assert.equal(candidateReads, 2, 'one recheck at the durable oldest deadline');
  assert.equal(row.stateReason, 'deaf');
  assert.equal(row.deaf?.message, ids[0], 'the timer retains the oldest held identity');
});

test('a carried launch brief stays launch-owned until its new native session confirms it', async t => {
  const scope = caseDeadlines(t);
  const root = await scope.wait('scratch setup', () => tempProject(scope.fixtures));
  const clock = new FakeClock();
  const f = retainedDeliveryFixture(scope.fixtures, root, clock, []);
  const previous = await scope.wait('previous fake spawn', () => f.fake.spawn({ name: 'impl', role: 'implementer', model: null, cwd: root }));
  f.table.put(previous);
  const joined = f.core.hello({ type: 'hello', protocol: 2, name: 'impl', role: 'implementer', sessionId: previous.sessionId, cwd: root }, () => true);
  assert.ok(joined.ok);
  f.core.disconnect(joined.connection);
  f.table.update('impl', { status: 'stopped' });
  assert.equal(f.core.store.sessionIdOf('impl'), previous.sessionId, 'name retains prior identity before native launch');
  const brief: Message = { id: 'next-launch-brief', from: 'human', fromKind: 'human', via: 'session', to: ['impl'], topic: 'agents', text: 'next task', ts: clock.now().toISOString() };
  f.core.recordLaunchBrief(brief, 'next-launch', true);
  assert.equal(f.core.store.deliverySessionId(brief.id, 'impl'), null, 'new launch input cannot inherit previous name holder');
  const next = await scope.wait('replacement fake spawn', () => f.fake.spawn({ name: 'impl', role: 'implementer', model: null, cwd: root }));
  f.core.completeCarriedBrief('other-launch', previous.sessionId);
  assert.equal(f.core.store.deliveriesOf(brief.id)[0]?.state, 'queued', 'unrelated launch cannot complete the brief');
  // Native completion precedes recording the replacement process/hello.
  f.core.completeCarriedBrief('next-launch', next.sessionId);
  assert.equal(f.core.store.deliveriesOf(brief.id)[0]?.state, 'injected');
  assert.equal(f.core.store.deliverySessionId(brief.id, 'impl'), next.sessionId);
  assert.equal(f.core.store.uninjected('impl').some(m => m.id === brief.id), false, 'carried input cannot be replayed');
  f.core.completeCarriedBrief('next-launch', next.sessionId);
  assert.equal(f.core.store.deliveriesOf(brief.id)[0]?.state, 'injected', 'repeat native completion stays settled');
});
