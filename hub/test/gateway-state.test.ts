// T2: gateway frame receipts with real hub.db and fake messenger/process boundaries.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { Gateway } from '../src/remote/gateway.ts';
import { PollerLease } from '../src/remote/poller-lease.ts';
import { Store } from '../src/hub/store.ts';
import { connectUi, frameClient, projectHub, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import { realClock } from '../src/hub/clock.ts';
import { testMessenger } from './fakes/messenger.ts';
import { fakePollerProcesses } from './fakes/poller-processes.ts';
import { FakeClock } from './fake-clock.ts';
import { heldRemoteBoundary } from './fakes/held-remote-boundary.ts';

test('a second gateway waits on hub.db without stopping the serving owner and starts after release', { timeout: 5000 }, async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const first = new Store(join(root, '.cland', 'hub.db'));
  const second = new Store(join(root, '.cland', 'hub.db'));
  const clock = new FakeClock();
  const fake = fakePollerProcesses();
  fake.rows.set(101, { alive: true, started: 'fixture', identity: 'first-birth' });
  fake.rows.set(102, { alive: true, started: 'fixture', identity: 'second-birth' });
  const serving = testMessenger('discord');
  const waiting = testMessenger('telegram');
  const owner = new Gateway(hub.dispatcher, [serving], { lease: new PollerLease(first.remotes, { clock, pid: 101, processes: fake.processes }) });
  const contender = new Gateway(hub.dispatcher, [waiting], { lease: new PollerLease(second.remotes, { clock, pid: 102, processes: fake.processes }) });
  let starting: Promise<unknown> | undefined;
  try {
    await owner.start();
    starting = contender.start().then(() => 'started', error => error);
    await clock.advance(59_000);
    assert.equal(waiting.started, false, 'no second platform consumer before ownership');
    const status = await serving.client.request({ type: 'hub.status' });
    assert.equal(status.ok, true, status.error);
    assert.equal(serving.stopped, false, 'the original gateway remains serving while its lease is held');
    assert.equal(first.remotes.pollerLease()?.pid, 101);
    await owner.stop();
    await clock.advance(1000);
    assert.equal(await starting, 'started');
    const successor = await waiting.client.request({ type: 'hub.status' });
    assert.equal(successor.ok, true, successor.error);
    assert.equal(second.remotes.pollerLease()?.pid, 102);
  } finally {
    await contender.stop(); await starting;
    await owner.stop();
    second.close(); first.close();
  }
});

test('the daemon keeps remote state only in hub.db across a hub restart, including TEXT ids above 2^53', { timeout: 5000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland', 'hub.db');
  const opened: string[] = [];
  const openDatabase = (path: string) => { opened.push(path); return new DatabaseSync(path); };
  const firstRemote = testMessenger('discord');
  const first = await projectHub(t, root, {}, { gatewayRemotes: [firstRemote], openDatabase });
  const database = new Store(path);
  const pairing = { userId: '9007199254740993', chatId: '1234567890123456789', guildId: '987654321098765432', name: 'Fixture human' };
  let messageId = '';
  try {
    assert.equal(database.remotes.pollerLease()?.pid, process.pid, 'the daemon acquires ownership before starting its remote');
    const sent = await firstRemote.client.request({ type: 'topic.send', topic: 'general', text: 'persisted remote message' });
    assert.equal(sent.ok, true, sent.error);
    messageId = (sent.value as { message: { id: string } }).message.id;
    const before = (await readdir(join(root, '.cland'), { recursive: true })).sort();
    const remote = database.remotes.forMessenger('discord');
    remote.setPairing(pairing);
    remote.set('lastMessageId', '1234567890123456791');
    remote.set('resume', '{"session":"fixture-resume","sequence":42}');
    remote.set('identifyCount', '3');
    remote.putMessage({ chatId: pairing.chatId, messageId: '1234567890123456791', topic: 'general', message: messageId, ask: null, approval: null });
    remote.putRequest({ ...pairing, code: 'fixture-code', created: '2026-10-26T10:00:00Z', expires: '2026-10-26T10:05:00Z' });
    remote.countReply(pairing.userId);
    remote.putOutbox({ id: 'fixture-job', kind: 'general', source: messageId, state: 'queued', payload: { text: 'outbound fixture' }, created: '2026-10-26T10:00:00Z', updated: '2026-10-26T10:00:00Z' });
    remote.putAttempt({ id: 'fixture-attempt', job: 'fixture-job', at: '2026-10-26T10:00:01Z', outcome: null });
    assert.deepEqual((await readdir(join(root, '.cland'), { recursive: true })).sort(), before, 'remote writes create no separate state file');
    await first.stop();
    assert.equal(firstRemote.stopped, true);
    assert.equal(database.remotes.pollerLease(), null, 'shutdown releases only after remote stop');
  } finally { await first.stop(); database.close(); }
  const secondRemote = testMessenger('discord');
  const second = await projectHub(t, root, {}, { gatewayRemotes: [secondRemote], openDatabase });
  const reopened = new Store(path);
  try {
    const status = await secondRemote.client.request({ type: 'hub.status' });
    assert.equal(status.ok, true, status.error);
    const remote = reopened.remotes.forMessenger('discord');
    assert.deepEqual(remote.pairing(), pairing);
    assert.equal(remote.get('lastMessageId'), '1234567890123456791');
    assert.equal(remote.get('resume'), '{"session":"fixture-resume","sequence":42}');
    assert.equal(remote.get('identifyCount'), '3');
    assert.deepEqual(remote.message(pairing.chatId, '1234567890123456791'), { chatId: pairing.chatId, messageId: '1234567890123456791', topic: 'general', message: messageId, ask: null, approval: null });
    assert.equal(remote.requests()[0]?.userId, '9007199254740993');
    assert.equal(remote.replies(pairing.userId), 1);
    assert.equal(remote.outbox()[0]?.source, messageId);
    assert.deepEqual(remote.attempts('fixture-job'), [{ id: 'fixture-attempt', job: 'fixture-job', at: '2026-10-26T10:00:01Z', outcome: null }]);
    assert.ok(opened.length > 0);
    assert.deepEqual([...new Set(opened)], [path], 'every daemon storage handle opens the existing hub.db');
  } finally { await second.stop(); reopened.close(); }
});

test('stopping a gateway during lease wait cancels startup without starting or stopping either messenger', { timeout: 5000 }, async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const database = new Store(join(root, '.cland', 'hub.db'));
  const clock = new FakeClock();
  const fake = fakePollerProcesses();
  fake.rows.set(101, { alive: true, started: 'fixture', identity: 'first-birth' });
  fake.rows.set(102, { alive: true, started: 'fixture', identity: 'second-birth' });
  const first = testMessenger('discord');
  const second = testMessenger('telegram');
  const owner = new Gateway(hub.dispatcher, [first], { lease: new PollerLease(database.remotes, { clock, pid: 101, processes: fake.processes }) });
  const contender = new Gateway(hub.dispatcher, [second], { lease: new PollerLease(database.remotes, { clock, pid: 102, processes: fake.processes }) });
  let starting: Promise<unknown> | undefined;
  try {
    await owner.start();
    const held = database.remotes.pollerLease();
    starting = contender.start().then(() => 'started', error => error);
    await clock.advance(1000);
    await contender.stop();
    assert.match(String(await starting), /gateway stopped while waiting/);
    assert.equal(second.started, false);
    assert.equal(second.stopped, false, 'the waiting gateway owns no platform resource to stop');
    assert.equal(first.stopped, false);
    assert.deepEqual(database.remotes.pollerLease(), held);
    const status = await first.client.request({ type: 'hub.status' });
    assert.equal(status.ok, true, status.error);
  } finally { await contender.stop(); await starting; await owner.stop(); database.close(); }
});

async function heldStop(t: import('node:test').TestContext, receipt = true) {
  const hold = heldRemoteBoundary(t, receipt);
  let database: Store | undefined;
  let gateway: Gateway | undefined;
  hold.close(async () => {
    try { await gateway?.stop().catch(() => {}); }
    finally { database?.close(); }
  });
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  database = new Store(join(root, '.cland', 'hub.db'));
  const fake = fakePollerProcesses();
  fake.rows.set(101, { alive: true, started: 'fixture', identity: 'first-birth' });
  const messenger = testMessenger();
  gateway = new Gateway(hub.dispatcher, [{ ...messenger, stop: async () => {
    await hold.hold(); messenger.stop(); throw new Error('fixture stop incomplete');
  } }], { lease: new PollerLease(database.remotes, { pid: 101, processes: fake.processes }) });
  return { hold, database, messenger,
    start: () => hold.own(gateway!.start()),
    stop: () => hold.own(gateway!.stop().then(() => 'stopped', error => error)),
  };
}

test('a gateway keeps its lease until the remote stop receipt and retains it on incomplete shutdown', { timeout: 5000 }, async t => {
  const f = await heldStop(t);
  try {
    await f.start();
    const held = f.database.remotes.pollerLease();
    const setup = f.hold.setup();
    const stopping = f.stop();
    await setup;
    assert.deepEqual(f.database.remotes.pollerLease(), held, 'the still-running stop retains the token owner');
    f.hold.resume();
    assert.match(String(await stopping), /gateway shutdown failed/);
    assert.equal(f.messenger.stopped, true);
    assert.deepEqual(f.database.remotes.pollerLease(), held, 'an incomplete stop never grants a second consumer');
  } finally { await f.hold.dispose(); }
});

for (const failure of ['missing receipt', 'aborted setup'] as const) {
  test(`held remote stop disposal drains the consumer after ${failure}`, { timeout: 5000 }, async t => {
    const f = await heldStop(t, false);
    await f.start();
    const setup = f.hold.setup();
    const failed = assert.rejects(setup, failure === 'missing receipt' ? /setup receipt deadline reached/ : /setup cancelled/);
    const actual = f.hold.actual();
    const stopping = f.stop();
    await actual;
    if (failure === 'missing receipt') await f.hold.clock.advance(1000);
    else f.hold.setupAbort.abort(new Error('remote fixture setup cancelled'));
    await failed;
    await f.hold.dispose();
    assert.match(String(await stopping), /gateway shutdown failed/);
    assert.equal(f.messenger.stopped, true, 'disposal joined the actual stop receipt');
    assert.equal(f.hold.clock.pending, 0);
    assert.throws(() => f.database.remotes.pollerLease(), /not open|closed/i, 'SQLite closes after the consumer drains');
  });
}

for (const receipt of [true, false]) {
  const name = receipt ? 'a 60 second daemon poller conflict disables remotes without tearing down the hub or web edge'
    : 'daemon conflict disposal settles an omitted inspection receipt before hub and SQLite teardown';
  test(name, { timeout: 5000 }, async t => {
    const clock = new FakeClock();
    const setupClock = new FakeClock();
    const setupAbort = new AbortController();
    const inspected = Promise.withResolvers<void>();
    const actualInspected = Promise.withResolvers<void>();
    let database: Store | undefined;
    let owner: PollerLease | undefined;
    let starting: ReturnType<typeof projectHub> | undefined;
    let socket: WebSocket | undefined;
    let socketClosed: Promise<void> | undefined;
    let closeObserved = false;
    let disposing: Promise<void> | undefined;
    const dispose = () => disposing ??= (async () => {
      setupAbort.abort(new Error('daemon conflict setup cancelled'));
      inspected.resolve(); actualInspected.resolve();
      // Own the nullable socket before acquisition and observe its actual close
      // before stopping the hub, closing SQLite or permitting root removal.
      if (socket) {
        socket.terminate();
        await within(socketClosed!, 1000, realClock, () => new Error('web client close receipt deadline reached'));
      }
      owner?.release();
      await clock.advance(60_000);
      await starting?.then(hub => hub.stop(), () => {});
      database?.close();
    })();
    // Register before caseDeadlines' pending-work drain, so lost setup and
    // externally cancelled waits settle before that drain and directory hooks.
    onCleanup(t, dispose);
    const { wait, fixtures } = caseDeadlines(t, { timeoutMs: 1000 });
    const signal = AbortSignal.any([t.signal, setupAbort.signal]);
    const root = await tempProject(fixtures);
    await mkdir(join(root, '.cland'), { recursive: true });
    const db = database = new Store(join(root, '.cland', 'hub.db'));
    const fake = fakePollerProcesses();
    fake.rows.set(101, { alive: true, started: 'fixture', identity: 'other-hub-birth' });
    fake.rows.set(process.pid, { alive: true, started: 'fixture', identity: 'this-hub-birth' });
    owner = new PollerLease(db.remotes, { clock, pid: 101, processes: fake.processes });
    const messenger = testMessenger('discord');
    try {
      await owner.acquire(new AbortController().signal);
      const held = db.remotes.pollerLease();
      // Both observers are armed before startup. The intended receipt can be
      // suppressed without hiding the actual native-probe entry from the control.
      const setup = within(abortable(inspected.promise, signal), 1000, setupClock,
        () => new Error('daemon inspection setup receipt deadline reached'));
      void setup.catch(() => {}); // cancellation may settle this before actual setup
      const failed = receipt ? undefined : assert.rejects(setup, /inspection setup receipt deadline reached/);
      const actual = wait('actual held poller inspection', () => abortable(actualInspected.promise, signal));
      starting = projectHub(fixtures, root, {}, { clock, gatewayRemotes: [messenger], gatewayProcesses: { inspect: async pid => {
        if (pid === 101) { actualInspected.resolve(); if (receipt) inspected.resolve(); }
        return fake.processes.inspect(pid);
      } } });
      const outcome = starting.then(hub => ({ hub, error: null }), error => ({ hub: null, error }));
      await actual;
      if (!receipt) {
        await setupClock.advance(1000);
        await failed;
        await dispose(); // same pre-start unconditional owner
        const result = await outcome;
        assert.ok(result.hub, String(result.error));
        assert.equal(messenger.stopped, true, 'late startup is joined and its consumer stopped');
        assert.equal(clock.pending, 0, 'hub shutdown drained its scheduling');
        assert.throws(() => db.remotes.pollerLease(), /not open|closed/i);
        return;
      }
      await setup;
      await clock.advance(60_000);
      const result = await wait('daemon finishes startup after lease timeout', () => outcome);
      assert.ok(result.hub, String(result.error));
      const local = await wait('local frame client setup', () => connectUi(fixtures, result.hub.discovery));
      const status = await wait('local status reply', () => local.request({ type: 'hub.status' }, 500));
      assert.equal(status.ok, true, status.error);
      assert.equal((status.value as { web: { available: boolean } }).web.available, true);
      const link = await wait('scratch sign-in reply', () => local.request({ type: 'web.link' }, 500));
      assert.equal(link.ok, true, link.error);
      const { url } = link.value as { url: string };
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]) });
      await response.arrayBuffer();
      assert.equal(response.status, 302, 'the web listener redeems a sign-in');
      const origin = new URL(url).origin;
      const ws = socket = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: response.headers.get('set-cookie')!.split(';')[0]! } });
      socketClosed = new Promise(resolve => ws.once('close', () => { closeObserved = true; resolve(); }));
      ws.on('error', () => {});
      const web = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data.toString()}\n`)), () => ws.terminate());
      await wait('web socket open receipt', () => once(ws, 'open', { signal: AbortSignal.any([signal, AbortSignal.timeout(500)]) }));
      const welcomeReceipt = web.waitFor(frame => frame.type === 'welcome', 500);
      const welcomed = wait('web welcome receipt', () => welcomeReceipt);
      web.send({ type: 'hello', protocol: 2, client: 'human' });
      assert.equal((await welcomed).name, 'human');
      const webStatus = await wait('authenticated web status reply', () => web.request({ type: 'hub.status' }, 500));
      assert.equal(webStatus.ok, true, webStatus.error);
      assert.equal((webStatus.value as { root: string }).root, root);
      assert.equal(messenger.started, false);
      assert.equal(messenger.stopped, false);
      assert.deepEqual(db.remotes.pollerLease(), held);
      assert.deepEqual(db.remotes.forMessenger('discord').status(), { disabled: true, reason: 'gateway poller lease held for 60 seconds; another consumer of the token' });
      await dispose();
      assert.equal(closeObserved, true, 'the web client close receipt precedes completed disposal');
      assert.equal(ws.readyState, WebSocket.CLOSED);
    } finally { await dispose(); }
  });
}

test('a lease acquisition error is redacted into persisted remote status and logs while the hub serves', { timeout: 5000 }, async t => {
  const root = await tempProject(t);
  const first = testMessenger('discord');
  const second = testMessenger('telegram');
  const log: Array<Record<string, unknown>> = [];
  const marker = 'fixture-private-probe-value';
  const hub = await projectHub(t, root, {}, {
    gatewayRemotes: [first, second],
    gatewayProcesses: { inspect: async () => { throw new Error(`probe failed secret=${marker}`); } },
    log: entry => { log.push(entry); },
  });
  const database = new Store(join(root, '.cland', 'hub.db'));
  try {
    const local = await connectUi(t, hub.discovery);
    assert.equal((await local.request({ type: 'hub.status' })).ok, true);
    for (const messenger of [first, second]) {
      assert.equal(messenger.started, false);
      assert.equal(messenger.stopped, false);
      assert.deepEqual(database.remotes.forMessenger(messenger.id).status(), { disabled: true, reason: 'probe failed [redacted]' });
      assert.ok(log.some(entry => entry.event === 'remote-disabled' && entry.remote === messenger.id && entry.reason === 'probe failed [redacted]'));
    }
    assert.equal(JSON.stringify(log).includes(marker), false);
    assert.equal(database.remotes.pollerLease(), null);
  } finally { await hub.stop(); database.close(); }
  const reopened = new Store(join(root, '.cland', 'hub.db'));
  try {
    assert.deepEqual(reopened.remotes.forMessenger('discord').status(), { disabled: true, reason: 'probe failed [redacted]' });
    assert.deepEqual(reopened.remotes.forMessenger('telegram').status(), { disabled: true, reason: 'probe failed [redacted]' });
  } finally { reopened.close(); }
});
