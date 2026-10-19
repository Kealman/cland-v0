// T2: failed-inject notice policy through real hub frames, fake harnesses and fake time.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { HarnessProcessView, Message } from '../src/protocol.ts';
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
  t.after(() => { sessions.close(); table.close(); core.close(); core.store.close(); });
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
  fake.busy('impl');
  const oldIdle = realClock.now().getTime() - 1;
  fake.scriptInject('impl', 'hold', 'accept');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'already accounts for the old idle' });
  const id = (sent.value as { message: Message }).message.id;
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'delivered');
  assert.equal(fake.injections.filter(input => input.message.id === id).length, 1, 'inject is in flight before the delayed signal');
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
  const notices = () => ui.frames.filter(f => f.type === 'message' && (f.message as Message).kind === 'inject-stalled').map(f => f.message as Message);
  const fail = async (name: string) => {
    fake.scriptInject(name, 'reject');
    const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [name], text: `must reach ${name}` });
    assert.equal(sent.ok, true, sent.error);
    const id = (sent.value as { message: Message }).message.id;
    await eventually('failed inject completed', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
    return id;
  };
  for (const name of ['coord', 'impl']) {
    const first = await fail(name);
    await clock.advance(59_999);
    await ui.request({ type: 'session.list' });
    assert.equal(notices().filter(note => note.detail?.session === name).length, 0);
    await clock.advance(1);
    const frame = await ui.waitFor(f => f.type === 'message' && (f.message as Message).kind === 'inject-stalled' && (f.message as Message).detail?.session === name);
    const note = frame.message as Message;
    assert.match(note.text, new RegExp(name));
    assert.match(note.text, /60000 ms/);
    assert.deepEqual(note.to, name === 'coord' ? [] : ['coord']);
    const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string; session?: string }> };
    assert.equal(events.rows.filter(row => row.text === note.text && row.session === name).length, name === 'coord' ? 1 : 0);
    await fail(name);
    await clock.advance(120_000);
    await ui.request({ type: 'session.list' });
    assert.equal(notices().filter(note => note.detail?.session === name).length, 1, 'repeated failures do not flood notices');
    fake.busy(name);
    fake.idle(name);
    await ui.waitFor(f => f.type === 'delivery' && f.message === first && f.stage === 'injected');
    await fail(name);
    await clock.advance(60_000);
    await eventually('new episode notices once', async () => {
      await ui.request({ type: 'session.list' });
      return notices().filter(note => note.detail?.session === name).length === 2 || undefined;
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
  await clock.advance(120_000);
  await ui.request({ type: 'session.list' });
  assert.ok(!ui.frames.some(f => f.type === 'message' && (f.message as Message).kind === 'inject-stalled'));
});
