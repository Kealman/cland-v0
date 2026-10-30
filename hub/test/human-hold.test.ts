// T1: held human delivery policy through memory core, Sessions and fake harness receipts.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { defaultCrew } from '../src/crew.ts';
import { HubCore } from '../src/hub/core.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeHarness } from './fakes/harness.ts';

async function fixture(t: TestContext, role = 'implementer') {
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const config = defaultCrew();
  const core = new HubCore({ clock, crew: { get: () => config, set: async () => config } });
  const table = new ProcessTable(':memory:', clock);
  const sessions = new Sessions({ core, table, root: '/virtual/project', transportClock: clock, log: entry => logs.push(entry) });
  const owners = [sessions];
  t.after(async () => { for (const owner of owners.reverse()) await owner.close(); table.close(); core.close(); core.store.close(); });
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
  return { clock, logs, core, sessions, fake, p, received, joined, signal, send, owners, table };
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
