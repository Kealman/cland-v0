// T2: held delivery and native bridge ownership through memory core/Sessions; retained-log filesystem cleanup.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { join } from 'node:path';
import { Journal, readJournal } from '../src/hub/journal.ts';
import { mkdtemp, open, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { guardDirectoryRemoval, onCleanup, ownDirectory } from './process-cleanup.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import type { Clock } from '../src/hub/clock.ts';
import { defaultCrew } from '../src/crew.ts';
import { HubCore } from '../src/hub/core.ts';
import { answerSession, isSessionRequest } from '../src/adapters/requests.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeHarness } from './fakes/harness.ts';

async function fixture(t: TestContext, role = 'implementer') {
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const config = defaultCrew();
  const core = new HubCore({ clock, log: entry => logs.push(entry), crew: { get: () => config, set: async () => config } });
  const table = new ProcessTable(':memory:', clock);
  const sessions = new Sessions({ core, table, root: '/virtual/project', transportClock: clock, log: entry => logs.push(entry) });
  const owners = [sessions];
  let storageClosed = false;
  const closeStorage = () => {
    if (storageClosed) return;
    storageClosed = true;
    table.close(); core.close(); core.store.close();
  };
  t.after(async () => { for (const owner of owners.reverse()) await owner.close(); closeStorage(); });
  const host = sessions.host({ discoveryFile: '', node: '', cli: '', spoke: '' });
  const fake = fakeHarness('claude-code', { clock, host });
  sessions.register(fake);
  const p = await fake.spawn({ name: 'impl', role, model: null, cwd: '/virtual/project' });
  table.put(p);
  const received: string[] = [];
  const joined = core.hello({ type: 'hello', protocol: 2, name: p.name, role: p.role!, sessionId: p.sessionId, cwd: p.cwd }, message => {
    received.push(message.id);
    return true;
  });
  assert.ok(joined.ok);
  const signal = (state: 'busy' | 'idle', source = 'poll') => host.signal(p.sessionId, { state, source, at: clock.now().getTime() });
  const send = () => core.sendFromHuman('general', 'human input', ['impl']).message.id;
  return { clock, logs, core, sessions, fake, p, received, joined, signal, send, owners, table, host, closeStorage };
}

test('C1: repeated idle observations drain queued and acknowledged human deliveries', async t => {
  const f = await fixture(t);
  f.signal('idle');
  const delivered = f.send();
  assert.ok(f.received.includes(delivered));
  f.signal('busy');
  const queued = f.send();
  f.core.ack(f.joined.connection, delivered);
  assert.equal(f.fake.injections.some(i => i.message.id === delivered), false);
  // Another source has already recorded idle without draining adapter work.
  f.core.setSessionState(f.p.sessionId, 'impl', 'idle', 'other observer');
  f.signal('idle');
  await f.clock.advance(0);
  assert.ok(f.received.includes(queued));
  assert.equal(f.core.store.deliveriesOf(delivered).find(d => d.session === 'impl')?.state, 'injected');
});

test('C2: held human input is rechecked every minute with source and age', async t => {
  const f = await fixture(t);
  f.signal('busy');
  const id = f.send();
  await f.clock.advance(180_000);
  const checks = f.logs.filter(e => e.event === 'human-hold-recheck');
  assert.deepEqual(checks.map(e => [e.source, e.ageMs]), [['poll', 60_000], ['poll', 120_000], ['poll', 180_000]]);
  assert.equal(f.received.includes(id), false);
  f.core.setSessionState(f.p.sessionId, 'impl', 'idle', 'other observer');
  await f.clock.advance(60_000);
  assert.ok(f.received.includes(id));
});

test('C3: poll-only busy expires after five minutes, repeated polls do not renew it', async t => {
  const f = await fixture(t);
  f.signal('busy');
  const id = f.send();
  for (let minute = 0; minute < 5; minute++) {
    await f.clock.advance(60_000);
    f.signal('busy');
    assert.equal(f.received.includes(id), false);
  }
  await f.clock.advance(60_000);
  assert.ok(f.received.includes(id));
});

test('push busy remains authoritative past five minutes and close cancels rechecks', async t => {
  const f = await fixture(t);
  f.sessions.signal({ session: 'impl', event: 'turn-start', at: f.clock.now().getTime() });
  const id = f.send();
  await f.clock.advance(6 * 60_000);
  assert.equal(f.received.includes(id), false);
  assert.ok(f.logs.some(e => e.event === 'human-hold-recheck' && e.source === 'hook' && e.ageMs === 360_000));
  await f.sessions.close();
  const checks = f.logs.length;
  await f.clock.advance(120_000);
  assert.equal(f.logs.length, checks);
});

test('repeated idle and minute rechecks drain only never-attempted work', async t => {
  const f = await fixture(t);
  f.signal('idle');
  f.core.hello({ type: 'hello', protocol: 2, name: 'sender', sessionId: 'sender-id', cwd: '/virtual/project' }, () => true);
  f.fake.scriptInject('impl', 'reject');
  const attempted = f.core.sendFromSession('sender', ['impl'], 'agent report', undefined, 'general').message.id;
  f.core.ack(f.joined.connection, attempted);
  await f.clock.advance(0);
  assert.ok(f.logs.some(e => e.event === 'inject-unconfirmed' && e.id === attempted));
  const held = f.send();
  f.signal('busy');
  f.core.ack(f.joined.connection, held);
  assert.equal(f.core.store.deliveriesOf(held)[0]?.injectionStarted, false);
  assert.equal(f.core.store.deliveriesOf(attempted)[0]?.injectionStarted, true);
  f.core.setSessionState(f.p.sessionId, 'impl', 'idle', 'other observer');
  f.signal('idle');
  await f.clock.advance(60_000);
  assert.equal(f.core.store.deliveriesOf(held)[0]?.state, 'injected');
  assert.equal(f.fake.injections.filter(i => i.message.id === attempted).length, 1, 'bare idle and timer cannot retry an attempted input');
  assert.equal(f.core.store.deliveriesOf(attempted)[0]?.state, 'delivered');
  f.signal('busy');
  f.signal('idle');
  await f.clock.advance(0);
  assert.equal(f.core.store.deliveriesOf(attempted)[0]?.state, 'injected');
  assert.equal(f.fake.injections.filter(i => i.message.id === attempted).length, 2);
});

test('the recheck timer never retries an uncertain injection', async t => {
  const f = await fixture(t);
  f.signal('idle');
  f.fake.scriptInject('impl', 'uncertain');
  const id = f.send();
  f.core.ack(f.joined.connection, id);
  await f.clock.advance(0);
  assert.equal(f.core.store.deliveriesOf(id).find(d => d.session === 'impl')?.state, 'uncertain');
  await f.clock.advance(10 * 60_000);
  assert.equal(f.fake.injections.filter(i => i.message.id === id).length, 1);
  assert.equal(f.core.store.deliveriesOf(id).find(d => d.session === 'impl')?.state, 'uncertain');
  assert.deepEqual(f.sessions.retry('impl', id), { retried: true }, 'legacy explicit uncertain retry remains available');
  await f.clock.advance(0);
  assert.equal(f.core.store.deliveriesOf(id)[0]?.state, 'injected');
  assert.equal(f.fake.injections.filter(i => i.message.id === id).length, 2);
});


test('retained pool reuse does not inherit old poll-idle provenance', async t => {
  const f = await fixture(t, 'reviewer');
  f.signal('idle');
  await f.clock.advance(6 * 60_000);
  const reused = await f.sessions.launch({ name: 'replacement', role: 'reviewer', harness: 'claude-code', item: 'T-2' });
  assert.equal(reused.sessionId, f.p.sessionId);
  assert.equal(reused.state, 'busy');
  const id = f.send();
  assert.equal(f.received.includes(id), false, 'new crew reservation holds input despite old poll idle');
  f.signal('busy');
  await f.clock.advance(60_000);
  assert.equal(f.received.includes(id), false, 'first busy poll starts a fresh episode');
  assert.ok(f.logs.some(e => e.event === 'human-hold-recheck' && e.source === 'poll' && e.ageMs === 60_000));
  f.signal('idle');
  assert.ok(f.received.includes(id));
});


test('restart seeds delivered agent supervision when native discovery is unavailable', async t => {
  const f = await fixture(t);
  f.signal('idle');
  f.core.hello({ type: 'hello', protocol: 2, name: 'sender', sessionId: 'sender-id', cwd: '/virtual/project' }, () => true);
  f.fake.scriptInject('impl', 'reject', 'uncertain', 'accept');
  const retained = f.core.sendFromSession('sender', ['impl'], 'retained agent report', undefined, 'general').message.id;
  // Simulate restart after durable ack, before the delivery callback attempts injection.
  assert.ok(f.core.store.markDelivered(retained, 'impl', f.clock.now().getTime()));
  const attempted = f.core.sendFromSession('sender', ['impl'], 'previously attempted report', undefined, 'general').message.id;
  f.core.ack(f.joined.connection, attempted);
  const uncertain = f.send();
  f.core.ack(f.joined.connection, uncertain);
  const terminal = f.send();
  f.core.ack(f.joined.connection, terminal);
  await f.clock.advance(0);
  assert.equal(f.core.store.deliveriesOf(retained).find(d => d.session === 'impl')?.state, 'delivered');
  assert.equal(f.core.store.deliveriesOf(retained)[0]?.injectionStarted, false);
  assert.equal(f.core.store.deliveriesOf(attempted)[0]?.injectionStarted, true);
  assert.equal(f.core.store.deliveriesOf(uncertain).find(d => d.session === 'impl')?.state, 'uncertain');
  assert.equal(f.core.store.deliveriesOf(terminal).find(d => d.session === 'impl')?.state, 'injected');
  await f.sessions.close();
  const recovered = new Sessions({ core: f.core, table: f.table, root: '/virtual/project', transportClock: f.clock, log: entry => f.logs.push(entry) });
  f.owners.push(recovered);
  const adapter = fakeHarness('claude-code', { clock: f.clock, host: recovered.host({ discoveryFile: '', node: '', cli: '', spoke: '' }) });
  t.mock.method(adapter, 'resume', async () => ({ found: false as const, alive: true, reason: 'native listing unavailable' }));
  recovered.register(adapter);
  const result = await recovered.resume('impl');
  assert.equal(result.found, false);
  assert.equal(result.process.status, 'running');
  const before = f.logs.filter(e => e.event === 'human-hold-recheck').length;
  await f.clock.advance(60_000);
  assert.ok(f.logs.filter(e => e.event === 'human-hold-recheck').length > before);
  assert.equal(f.core.store.deliveriesOf(retained).find(d => d.session === 'impl')?.state, 'injected');
  assert.deepEqual(adapter.injections.map(i => i.message.id), [retained]);
  assert.equal(f.core.store.deliveriesOf(attempted)[0]?.state, 'delivered');
  assert.equal(f.core.store.deliveriesOf(uncertain).find(d => d.session === 'impl')?.state, 'uncertain');
  assert.equal(f.core.store.deliveriesOf(terminal).find(d => d.session === 'impl')?.state, 'injected');
});


test('T-1473 C1: explicit retry forces an old queued human delivery through busy to injection', async t => {
  const f = await fixture(t);
  f.signal('busy', 'hook');
  const id = f.send();
  await f.clock.advance(60_001);
  assert.equal(f.received.includes(id), false);
  assert.deepEqual(f.sessions.retry('impl', id), { retried: true });
  assert.ok(f.received.includes(id), 'operator retry reaches the session transport while busy');
  f.core.ack(f.joined.connection, id);
  await f.clock.advance(0);
  assert.equal(f.core.store.deliveriesOf(id)[0]?.state, 'injected');
  assert.equal(f.fake.injections.filter(i => i.message.id === id).length, 1);
  assert.ok(f.logs.some(e => e.event === 'inject-retry' && e.id === id && e.stage === 'queued'));
  f.signal('idle');
  await f.clock.advance(60_000);
  assert.equal(f.fake.injections.filter(i => i.message.id === id).length, 1);
});


test('T-1473 C2: refusals report recipient stage and age without replaying attempted input', async t => {
  const f = await fixture(t);
  f.signal('busy', 'hook');
  const queued = f.send();
  await f.clock.advance(60_000);
  assert.throws(() => f.sessions.retry('impl', queued), /stage queued, age 60000 ms/);
  f.signal('idle');
  f.fake.scriptInject('impl', 'reject');
  f.core.ack(f.joined.connection, queued);
  await f.clock.advance(0);
  assert.equal(f.core.store.deliveriesOf(queued)[0]?.injectionStarted, true);
  assert.throws(() => f.sessions.retry('impl', queued), /stage delivered, age 60000 ms/);
  assert.equal(f.fake.injections.filter(i => i.message.id === queued).length, 1);
  f.signal('busy');
  f.signal('idle');
  await f.clock.advance(0);
  assert.equal(f.core.store.deliveriesOf(queued)[0]?.state, 'injected');
  assert.throws(() => f.sessions.retry('impl', queued), /stage injected, age 60000 ms/);
});


test('T-1473: message-less wire request chooses one old queued input and retains the legacy reply', async t => {
  const f = await fixture(t);
  f.signal('busy', 'hook');
  const first = f.send();
  await f.clock.advance(1);
  const second = f.send();
  await f.clock.advance(60_001);
  const frame = { type: 'session.retry', id: 'retry-request', session: 'impl' };
  assert.ok(isSessionRequest(frame));
  const result = await answerSession(f.sessions, frame, { send: () => {}, isOpen: () => true, onClose: () => {} });
  assert.deepEqual(result, { type: 'result', id: 'retry-request', ok: true, value: { retried: true } });
  assert.ok(f.received.includes(first));
  assert.equal(f.received.includes(second), false);
  f.core.ack(f.joined.connection, first);
  await f.clock.advance(0);
  assert.equal(f.core.store.deliveriesOf(first)[0]?.state, 'injected');
  assert.equal(f.core.store.deliveriesOf(second)[0]?.state, 'queued');
});

function nativeBridge(t: TestContext, f: Awaited<ReturnType<typeof fixture>>) {
  const adapter = new ClaudeCodeAdapter(f.host, { clock: f.clock, env: fixtureEnvironment('/virtual/project', {}) });
  t.after(() => adapter.close());
  Object.assign(f.fake, { bridge: adapter.bridge.bind(adapter), unwatch: adapter.unwatch.bind(adapter) });
  return adapter;
}

test('T-1475: late bridge disconnect after adapter and storage close uses no generation read', async t => {
  const f = await fixture(t);
  const adapter = nativeBridge(t, f);
  const close = f.sessions.bridge('impl', () => true);
  await f.sessions.close();
  await adapter.close();
  f.closeStorage();
  assert.doesNotThrow(close);
  assert.equal(f.logs.filter(e => e.event === 'bridge-stale-closed').length, 1);
});

test('T-1475: a live bridge disconnect uses captured ownership without consulting storage', async t => {
  const f = await fixture(t);
  nativeBridge(t, f);
  const close = f.sessions.bridge('impl', () => true);
  const read = t.mock.method(f.host.adapterState!, 'read', () => { throw new Error('close path must not read generation'); });
  assert.doesNotThrow(close);
  assert.equal(read.mock.callCount(), 0);
  assert.equal(f.logs.filter(e => e.event === 'bridge-closed').length, 1);
});

for (const invalidation of ['generation', 'unwatch'] as const) test(`T-1475: ${invalidation} invalidation reports a stale bridge closure`, async t => {
  const f = await fixture(t);
  const adapter = nativeBridge(t, f);
  const close = f.sessions.bridge('impl', () => true);
  assert.equal(adapter.hasBridge(f.p), true);
  if (invalidation === 'generation') f.host.launchGeneration!(f.p.sessionId, 'replacement');
  else adapter.unwatch(f.p.sessionId);
  close();
  assert.equal(f.logs.filter(e => e.event === 'bridge-closed').length, 0);
  assert.equal(f.logs.filter(e => e.event === 'bridge-stale-closed').length, 1);
  assert.equal(adapter.hasBridge(f.p), false);
});

test('T-1475 C1: closing a replaced bridge reports stale closure only', async t => {
  const f = await fixture(t);
  const adapter = nativeBridge(t, f);
  const old = f.sessions.bridge('impl', () => true);
  const current = f.sessions.bridge('impl', () => true);
  old();
  assert.equal(f.logs.filter(e => e.event === 'bridge-closed').length, 0);
  assert.equal(f.logs.filter(e => e.event === 'bridge-stale-closed').length, 1);
  assert.equal(adapter.hasBridge(f.p), true, 'stale close preserves current native bridge');
  current();
  assert.equal(adapter.hasBridge(f.p), false);
  assert.equal(f.logs.filter(e => e.event === 'bridge-closed').length, 1);
});

test('T-1475 C2: bridge logs retain the connecting job identity across replacement', async t => {
  const f = await fixture(t);
  nativeBridge(t, f);
  f.table.update('impl', { harnessId: 'job-old', pid: 123 });
  const old = f.sessions.bridge('impl', () => true);
  f.table.update('impl', { harnessId: 'job-new', pid: 456 });
  const current = f.sessions.bridge('impl', () => true);
  old();
  current();
  assert.deepEqual(f.logs.filter(e => String(e.event).startsWith('bridge-')).map(e => [e.event, e.harnessId, e.pid]), [
    ['bridge-connected', 'job-old', 123], ['bridge-connected', 'job-new', 456],
    ['bridge-stale-closed', 'job-old', 123], ['bridge-closed', 'job-new', 456],
  ]);
});

test('T-1475 C3: flush counts transport sends and busy holds separately', async t => {
  const f = await fixture(t);
  f.signal('busy');
  const id = f.send();
  f.core.flushQueued('impl');
  assert.deepEqual(f.logs.filter(e => e.event === 'flushed').at(-1), {
    event: 'flushed', session: 'impl', count: 1, sent: 0, held: 1, heldReasons: { 'human-busy': 1 },
  });
  assert.equal(f.received.includes(id), false);
  f.signal('idle');
  assert.deepEqual(f.logs.filter(e => e.event === 'flushed').at(-1), {
    event: 'flushed', session: 'impl', count: 1, sent: 1, held: 0, heldReasons: {},
  });
  assert.ok(f.received.includes(id));
  assert.equal(f.core.store.deliveriesOf(id)[0]?.state, 'queued', 'transport send is not an ack or native injection');
});


function retainedLog(t: TestContext, holdAt?: 'root' | 'open') {
  const owner = pacingOwner(t);
  const cancel = new AbortController();
  const gate = Promise.withResolvers<void>();
  const reached = Promise.withResolvers<void>();
  let journal: Journal | undefined;
  let root: string | undefined;
  let remove: (() => Promise<void>) | undefined;
  let acquisition: Promise<void> | undefined;
  let closed = false;
  let settled = false;
  // Register release, late-acquisition join, native close and root removal before
  // invoking any filesystem operation. A failed join retains the directory.
  owner.close(() => { cancel.abort(new Error('log acquisition cancelled')); gate.resolve(); });
  owner.close(async () => {
    await within(acquisition?.catch(() => {}) ?? Promise.resolve(), 5000);
    if (journal) await within(journal.close(), 5000);
  });
  onCleanup(t, async () => { await owner.dispose(); await remove?.(); });
  const observed = <T>(work: () => Promise<T>) => owner.observe(signal => {
    signal.throwIfAborted();
    return within(abortable(work(), signal), 1000);
  });
  const setup = (options: { signal?: AbortSignal; clock?: Clock } = {}) => {
    assert.equal(acquisition, undefined, 'one acquisition per log owner');
    const signal = AbortSignal.any([cancel.signal, t.signal, ...(options.signal ? [options.signal] : [])]);
    acquisition = owner.observe(async () => {
      signal.throwIfAborted();
      root = await mkdtemp(join(tmpdir(), 'cland-bridge-log-'));
      remove = ownDirectory(undefined, root);
      guardDirectoryRemoval(root, owner.dispose);
      if (holdAt === 'root') { reached.resolve(); await gate.promise; }
      signal.throwIfAborted(); // Late root acquisition cannot start a writer.
      journal = new Journal(join(root, 'journal.jsonl'), undefined, { open: async path => {
        const file = await open(path, 'a+');
        const close = file.close.bind(file);
        file.close = async () => { await close(); closed = true; };
        if (holdAt === 'open') { reached.resolve(); await gate.promise; }
        return file;
      } });
      await journal.flush();
      signal.throwIfAborted();
    }).finally(() => { settled = true; });
    return within(abortable(acquisition, signal), 1000, options.clock,
      () => new Error('log acquisition receipt missing')).catch(async error => {
      await owner.dispose();
      throw error;
    });
  };
  return { owner, setup, reached: reached.promise, closed: () => closed, settled: () => settled,
    constructed: () => journal !== undefined,
    get root() { assert.ok(root); return root; },
    get journal() { assert.ok(journal); return journal; },
    remove: async () => { await owner.dispose(); await remove?.(); },
    flush: () => observed(() => journal!.flush()),
    read: () => observed(async () => readJournal(join(root!, 'journal.jsonl'))),
  };
}

for (const stage of ['root', 'open'] as const) for (const failure of ['omitted', 'aborted'] as const) {
  test(`T-1475: retained log ${failure} ${stage} acquisition drains before root removal`, async t => {
    const f = retainedLog(t, stage);
    const clock = new FakeClock();
    const abort = new AbortController();
    const setup = f.setup({ clock, signal: abort.signal });
    const rejected = assert.rejects(setup, failure === 'omitted' ? /log acquisition receipt missing/ : /cancelled log setup/);
    await within(f.reached, 1000); // Exact native root/open boundary, before abandonment.
    assert.equal(f.settled(), false);
    if (failure === 'omitted') await clock.advance(1000);
    else abort.abort(new Error('cancelled log setup'));
    await rejected;
    await f.owner.dispose();
    assert.equal(f.settled(), true, 'late native acquisition joined');
    assert.equal(f.constructed(), stage === 'open', 'root cancellation fences writer construction');
    assert.equal(f.closed(), stage === 'open', 'an acquired native file handle closed before root removal');
    assert.equal(f.owner.observations(), 0);
    assert.equal(clock.pending, 0);
    await f.remove();
    await assert.rejects(stat(f.root), { code: 'ENOENT' });
  });
}

test('T-1475: rejected transport stays held and persisted log fields retain old row compatibility', async t => {
  const retained = retainedLog(t);
  await retained.setup();
  const { journal } = retained;
  const f = await fixture(t);
  nativeBridge(t, f);
  f.table.update('impl', { harnessId: 'persisted-job', pid: 789 });
  const disconnect = f.sessions.bridge('impl', () => true);
  disconnect();
  f.core.hello({ type: 'hello', protocol: 2, name: 'impl', sessionId: f.p.sessionId, cwd: '/virtual/project' }, () => false);
  const id = f.send();
  f.core.flushQueued('impl');
  const flushed = f.logs.filter(e => e.event === 'flushed').at(-1)!;
  assert.deepEqual(flushed, { event: 'flushed', session: 'impl', count: 1, sent: 0, held: 1, heldReasons: { 'transport-rejected': 1 } });
  assert.equal(f.core.store.deliveriesOf(id)[0]?.state, 'queued');
  // These are process-log events. Explicit writes exercise the generic retained-row reader
  // without widening production JOURNALLED or pretending tap persists them.
  journal.write({ event: 'bridge-connected', session: 'legacy' });
  journal.write({ event: 'flushed', session: 'legacy', count: 2 });
  for (const row of f.logs.filter(e => String(e.event).startsWith('bridge-') || e === flushed)) {
    journal.write({ ...row, event: String(row.event) });
  }
  await retained.flush();
  const rows = await retained.read();
  assert.deepEqual(rows.map(({ ts: _ts, ...row }) => row), [
    { event: 'bridge-connected', session: 'legacy' }, { event: 'flushed', session: 'legacy', count: 2 },
    { event: 'bridge-connected', session: 'impl', harnessId: 'persisted-job', pid: 789 },
    { event: 'bridge-closed', session: 'impl', harnessId: 'persisted-job', pid: 789 }, flushed,
  ]);
});
