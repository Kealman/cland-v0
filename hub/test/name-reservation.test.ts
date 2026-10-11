import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { processStartedAsync } from '../src/hub/lock.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Store } from '../src/hub/store.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { agentsRecord } from '../src/hub/agents-topic.ts';
import { fixedRoles } from '../src/roles/config.ts';
import type { Subscription } from '../src/protocol.ts';
import type { LogFn } from '../src/log.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { connectSocket, connectUi, eventually, spawnSpoke, startHub, tempProject, TEST_SECRET } from './harness.ts';

const nativePrepare = DatabaseSync.prototype.prepare;

async function pendingAlias(t: TestContext, log?: LogFn, faultAdoption = true) {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  tracker.start();
  t.after(() => tracker.stop());
  let now = Date.now();
  const hub = await startHub({ tracker, store: new Store(join(root, '.cland', 'hub.db')), roles: fixedRoles(), now: () => new Date(now), retentionMs: 1, ...(log ? { log } : {}) });
  let hubClosed = false;
  const closeHub = async () => { if (hubClosed) return; hubClosed = true; await hub.close(); };
  t.after(closeHub);
  const socket = join(root, 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const ui = await connectUi(t, { socket, secret: TEST_SECRET });
  await ui.request({ type: 'role.set', session: 'session-1', role: 'implementer' });
  const made = await ui.request({ type: 'task.create', title: 'Pending claimant', assignee: 'session-1' });
  const item = (made.value as { item: { id: string } }).item.id;
  assert.equal((await ui.request({ type: 'task.claim', item, as: { name: 'session-1' } })).ok, true);
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if (faultAdoption && sql.startsWith('update tracker_written_verdicts set session_id')) throw new Error('adoption deliberately failed');
    return nativePrepare.call(this, sql);
  });
  const owner = await spawnSpoke({ hub, name: 'session-1', sessionId: 'owner-id' });
  t.after(() => owner.close());
  await owner.waitForPresence(['session-1']);
  assert.equal((await ui.request({ type: 'role.set', session: 'session-1', role: 'coordinator' })).ok, true);
  assert.equal((await owner.call<{ ok: boolean }>('rename', { name: 'renamed' })).ok, true);
  now += 10_000;
  hub.core.prune(); // The existing daily retention job: the alias outlives the old name's traffic.
  assert.equal(hub.core.store.sessionNames().includes('session-1'), false);

  const table = new ProcessTable(join(root, '.cland', 'hub.db'));
  const sessions = new Sessions({ root, core: hub.core, table, ...(log ? { log } : {}) });
  let sessionsClosed = false;
  const closeSessions = () => { if (sessionsClosed) return; sessionsClosed = true; sessions.close(); table.close(); };
  t.after(closeSessions);
  const starts: string[] = [];
  const watched: string[] = [];
  sessions.register({
    harness: 'test',
    capabilities: { history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
    spawn: async r => {
      starts.push(r.name);
      return { name: r.name, harness: 'test', role: r.role, model: r.model, cwd: r.cwd, pid: null, harnessId: null, sessionId: `launched:${r.name}`, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running' };
    },
    attachCommand: () => 'test', watch: process => { watched.push(process.sessionId); }, inject: async () => {}, confirm: () => {}, interpret: () => ({}), stop: async () => {}, resume: async p => ({ found: true, process: p, state: 'idle' }), close: () => {},
  });
  hub.dispatcher.useSessions(sessions);
  const openHello = async (sessionId: string, name?: string, launchToken?: string) => {
    const client = await connectSocket(socket);
    t.after(() => client.close());
    client.send({ type: 'hello', protocol: 2, secret: TEST_SECRET, cwd: root, sessionId, ...(name === undefined ? {} : { name }), ...(launchToken ? { launchToken } : {}) });
    return { client, welcome: await client.next() };
  };
  const hello = async (sessionId: string, name?: string, launchToken?: string) => (await openHello(sessionId, name, launchToken)).welcome;
  const launch = (name: string, role: string | null = 'implementer') => ui.request({ type: 'session.launch', name, ...(role === null ? {} : { role }), harness: 'test' });
  const remainsOwner = async () => {
    const viewed = await ui.request({ type: 'task.view', item });
    assert.equal((viewed.value as { item: { claim: { sessionId: string } } }).item.claim.sessionId, 'name:session-1');
    assert.equal((await owner.call<{ ok: boolean }>('task.comment', { id: item, text: 'Still fenced.' })).ok, false);
    const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [`lead ${item}`], text: 'Still for the original claimant' });
    assert.equal(sent.ok, true, sent.error);
    assert.deepEqual((sent.value as { message: { to: string[] } }).message.to, ['renamed']);
    await owner.waitForEvent(e => e.params.content.includes('Still for the original claimant'));
  };
  return { closeHub, closeSessions, root, edge, tracker, table, watched, ui, owner, item, hub, sessions, hello, openHello, launch, remainsOwner, starts };
}

test('unnamed hellos keep a published launch identity and skip a pruned pending alias when allocating a name', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.launch('fresh')).ok, true);
  const welcome = await f.hello('launched:fresh');
  assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
  assert.equal(welcome.name, 'fresh', 'publication already bound the launch to its stable identity');
  const generated = await f.hello('unrecorded-id');
  assert.equal(generated.type, 'error');
  assert.equal(generated.code, 'no-role');
  assert.match(String(generated.message), /"session-2" holds none/, 'generated allocation skips the durable alias');
  await f.remainsOwner();
});

test('explicit hello refuses another identity’s pending alias and permits the owner’s reconnect', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.launch('fresh')).ok, true);
  const refused = await f.hello('launched:fresh', 'session-1');
  assert.equal(refused.type, 'error');
  assert.equal(refused.code, 'name-in-use');
  assert.match(String(refused.message), /pending session identity adoption/);
  await f.owner.close();
  const reconnected = await f.hello('owner-id');
  assert.equal(reconnected.type, 'welcome', JSON.stringify(reconnected));
  assert.equal(reconnected.name, 'renamed');
});

test('rename refuses another identity’s pending alias', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'renamed', role: 'implementer' })).ok, true);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'coordinator' })).ok, true);
  const other = await spawnSpoke({ hub: f.hub, name: 'other', sessionId: 'other-id' });
  t.after(() => other.close());
  await other.waitForPresence(['renamed', 'other']);
  const refused = await other.call<{ ok: boolean; error: string }>('rename', { name: 'session-1' });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /pending session identity adoption/);
  await f.remainsOwner();
});

for (const role of ['implementer', null]) {
  test(`${role ?? 'roleless'} launch refuses a pending alias before spawning a harness`, async t => {
    const f = await pendingAlias(t);
    const refused = await f.launch('session-1', role);
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /pending session identity adoption/);
    assert.deepEqual(f.starts, []);
    await f.remainsOwner();
  });
}

test('rename still refuses a live destination when two connections present the same session id', async t => {
  const hub = await startHub();
  t.after(() => hub.close());
  const first = await spawnSpoke({ hub, name: 'first', role: 'coordinator', sessionId: 'shared-id' });
  const second = await spawnSpoke({ hub, name: 'second', role: 'coordinator', sessionId: 'shared-id' });
  t.after(async () => { await first.close(); await second.close(); });
  await first.waitForPresence(['first', 'second']);
  const renamed = await first.call<{ ok: boolean; error: string }>('rename', { name: 'second' });
  assert.equal(renamed.ok, false);
  assert.match(renamed.error, /in use by a live session/);
  const presence = await first.call<{ sessions: Array<{ name: string }> }>('who');
  assert.deepEqual(presence.sessions.map(s => s.name).sort(), ['first', 'second']);
});

function deferSpawn(t: TestContext, sessions: Sessions, options: { refuseStop?: boolean; holdStop?: boolean; identity?: { pid: number; pidStarted: string } } = {}) {
  let token: string | undefined;
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>(done => { entered = done; });
  const gate = new Promise<void>(done => { release = done; });
  t.after(() => release());
  let stopEntered!: () => void;
  let finishStop!: () => void;
  const stopping = new Promise<void>(done => { stopEntered = done; });
  const stopGate = new Promise<void>(done => { finishStop = done; });
  t.after(() => finishStop());
  const adapter = sessions.adapter('test');
  const stopped: string[] = [];
  sessions.register({ ...adapter,
    spawn: async (request, resumed) => { token = request.launchToken; entered(); await gate; return { ...await adapter.spawn(request, resumed), ...options.identity }; },
    stop: async process => {
      stopped.push(process.sessionId);
      stopEntered();
      if (options.holdStop) await stopGate;
      if (options.refuseStop) throw new Error('process identity cannot be verified');
    },
  });
  return { started, release, stopped, stopping, finishStop, credential: () => { assert.ok(token, 'the hub gave the adapter a launch credential'); return token; } };
}

for (const cleanup of ['stopped', 'refused'] as const) {
  test(`a pending alias created during spawn refuses publication when cleanup is ${cleanup}`, async t => {
    const f = await pendingAlias(t);
    assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
    const { started, release, stopped } = deferSpawn(t, f.sessions, { refuseStop: cleanup === 'refused' });
    const launching = f.launch('target', null);
    await started;
    const made = await f.ui.request({ type: 'task.create', title: 'Claim during spawn', assignee: 'target' });
    const item = (made.value as { item: { id: string } }).item.id;
    // No status transition at claim: this name-conflict scenario starts with work already in progress.
    assert.equal((await f.ui.request({ type: 'task.edit', item, status: 'in progress' })).ok, true);
    assert.equal((await f.ui.request({ type: 'task.claim', item, as: { name: 'target' } })).ok, true);
    assert.equal((await f.owner.call<{ ok: boolean }>('rename', { name: 'target' })).ok, true);
    assert.equal((await f.owner.call<{ ok: boolean }>('rename', { name: 'renamed' })).ok, true);
    release();
    const refused = await launching;
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /name "target".*pending session identity adoption/);
    if (cleanup === 'refused') assert.match(refused.error!, /spawned process cleanup failed: process identity cannot be verified/);
    assert.deepEqual(stopped, ['launched:target']);
    const listed = await f.ui.request({ type: 'session.list' });
    assert.equal(listed.ok, true, listed.error);
    assert.equal((listed.value as { processes: Array<{ name: string }> }).processes.some(p => p.name === 'target'), false);
    const pending = (listed.value as { pendingStops: Array<{ state: string; process: { sessionId: string; status: string } }> }).pendingStops;
    assert.equal(pending.length, cleanup === 'refused' ? 1 : 0);
    if (cleanup === 'refused') {
      assert.equal(pending[0]?.state, 'pending stop');
      assert.equal(pending[0]?.process.sessionId, 'launched:target');
      assert.equal(pending[0]?.process.status, 'stopped');
      assert.ok(f.watched.includes('launched:target'));
    }
    const report = await f.ui.request({ type: 'topic.send', topic: 'general', to: [`lead ${item}`], text: 'The claim created during spawn still leads to its owner' });
    assert.equal(report.ok, true, report.error);
    assert.deepEqual((report.value as { message: { to: string[] } }).message.to, ['renamed']);
    await f.owner.waitForEvent(e => e.params.content.includes('The claim created during spawn still leads to its owner'));
    await f.remainsOwner();
  });
}

test('the spawned identity’s own early hello remains valid at final launch acceptance', async t => {
  const f = await pendingAlias(t);
  const { started, release, stopped, credential } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  const offlineRole = await f.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' });
  const welcome = await f.hello('launched:target', 'target', credential());
  assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
  const earlyRole = await f.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' });
  assert.equal(earlyRole.ok, false);
  assert.match(earlyRole.error!, /pending launch.*target/);
  release();
  const launched = await launching;
  assert.equal(offlineRole.ok, true, 'a name with no bound session identity is not an owned launch session');
  assert.equal(launched.ok, true, launched.error);
  assert.equal((launched.value as { process: { status: string } }).process.status, 'running');
  assert.deepEqual(stopped, []);
});

test('a reconnectable offline identity is fenced while its next launch awaits the first hello', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  const { client, welcome } = await f.openHello('old-id', 'target');
  assert.equal(welcome.type, 'welcome');
  client.close();
  await client.closed;
  await eventually('historic target disconnected', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  const bin = join(f.root, 'pid-probe-bin');
  await mkdir(bin);
  await writeFile(join(bin, 'ps'), '#!/bin/sh\n: > "$CLAND_TEST_PRIOR_PID_GATE/entered"\nwhile [ ! -f "$CLAND_TEST_PRIOR_PID_GATE/release" ]; do /bin/sleep 0.02; done\nexec /bin/ps "$@"\n');
  await chmod(join(bin, 'ps'), 0o755);
  const previousPath = process.env.PATH;
  const previousGate = process.env.CLAND_TEST_PRIOR_PID_GATE;
  process.env.PATH = `${bin}:${previousPath}`;
  process.env.CLAND_TEST_PRIOR_PID_GATE = bin;
  t.after(() => {
    process.env.PATH = previousPath;
    if (previousGate === undefined) delete process.env.CLAND_TEST_PRIOR_PID_GATE;
    else process.env.CLAND_TEST_PRIOR_PID_GATE = previousGate;
  });
  const adapter = f.sessions.adapter('test');
  f.sessions.register({ ...adapter, spawn: async (request, resumed) => ({ ...await adapter.spawn(request, resumed), pid: process.pid, pidStarted: null }) });
  const { started, release } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await Promise.race([started, launching.then(result => { assert.fail(JSON.stringify(result)); })]);
  const changing = await f.ui.request({ type: 'role.clear', session: 'target' });
  release();
  await eventually('native pid probe entered', () => readFile(join(bin, 'entered')).then(() => true, () => undefined));
  const probing = await f.ui.request({ type: 'role.clear', session: 'target' });
  await writeFile(join(bin, 'release'), '');
  assert.equal((await launching).ok, true);
  for (const result of [changing, probing]) {
    assert.equal(result.ok, false);
    assert.match(result.error!, /pending launch.*target/);
  }
});

test('the prior offline identity stays fenced after a failed launch returns pending cleanup', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  const { client, welcome } = await f.openHello('old-id', 'target');
  assert.equal(welcome.type, 'welcome');
  client.close();
  await client.closed;
  await eventually('prior target disconnected', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  const { release } = deferSpawn(t, f.sessions, { refuseStop: true, identity: { pid: process.pid, pidStarted: 'previous start identity' } });
  f.sessions.register({ ...f.sessions.adapter('test'), watch: () => { throw new Error('watch failed after publication'); } });
  const launching = f.launch('target');
  release();
  assert.equal((await launching).ok, false);
  const changing = await f.ui.request({ type: 'role.clear', session: 'target' });
  const r = await restartPending(t, f, true);
  const restarted = await r.ui.request({ type: 'role.clear', session: 'target' });
  await r.sessions.resumeAll();
  for (const result of [changing, restarted]) {
    assert.equal(result.ok, false);
    assert.match(result.error!, /pending launch.*target/);
  }
  assert.deepEqual(r.table.pendingStops(), []);
  assert.equal((await r.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' })).ok, true);
  await r.sessions.resumeAll();
  assert.equal(r.hub.core.store.roleOf('target'), 'reviewer');
});

test('a named launch conflict stops only the spawned identity and preserves the live owner’s role', async t => {
  const f = await pendingAlias(t);
  const { started, release, stopped } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  assert.equal((await f.owner.call<{ ok: boolean }>('rename', { name: 'target' })).ok, true);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  assert.equal((await f.owner.call<{ ok: boolean }>('subscribe', { subject: { session: 'target' }, events: ['session.state'] })).ok, true);
  release();
  const refused = await launching;
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /name "target".*in use by a live session/);
  assert.deepEqual(stopped, ['launched:target']);
  const presence = await f.owner.call<{ sessions: Array<{ name: string; role: string; sessionId: string }> }>('who');
  assert.deepEqual(presence.sessions.map(({ name, role, sessionId }) => ({ name, role, sessionId })), [{ name: 'target', role: 'implementer', sessionId: 'owner-id' }]);
  assert.equal((await f.owner.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter(s => !s.default).length, 1, 'an unpublished conflict cannot close the name owner’s subscriptions');
  assert.equal((await f.owner.call<{ ok: boolean }>('task.comment', { id: f.item, text: 'Original owner remains fenced.' })).ok, false);
  const listed = await f.ui.request({ type: 'session.list' });
  assert.equal((listed.value as { processes: Array<{ name: string }> }).processes.some(p => p.name === 'target'), false);
});

test('conflict cleanup preserves an owner who disconnects while the spawned process is being stopped', async t => {
  const f = await pendingAlias(t);
  const { started, release, stopping, finishStop, stopped } = deferSpawn(t, f.sessions, { holdStop: true });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.owner.call<{ ok: boolean }>('rename', { name: 'target' })).ok, true);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  release();
  await stopping;
  await f.owner.close();
  assert.equal(f.hub.core.presence().some(p => p.name === 'target'), false);
  finishStop();
  const refused = await launching;
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /name "target".*in use by a live session/);
  assert.deepEqual(stopped, ['launched:target']);
  const reconnect = await f.hello('owner-id', 'target');
  assert.equal(reconnect.type, 'welcome', JSON.stringify(reconnect));
  assert.equal(reconnect.role, 'implementer');
  const listed = await f.ui.request({ type: 'session.list' });
  assert.equal((listed.value as { processes: Array<{ name: string }> }).processes.some(p => p.name === 'target'), false);
});

test('conflict cleanup preserves an offline owner whose hello has an unknown session identity', async t => {
  const f = await pendingAlias(t);
  const { started, release, stopping, finishStop, stopped } = deferSpawn(t, f.sessions, { holdStop: true });
  const launching = f.launch('target');
  await started;
  const { client, welcome } = await f.openHello('unknown', 'target');
  assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
  assert.equal(welcome.role, 'implementer');
  release();
  await stopping;
  client.close();
  await client.closed;
  await eventually('unknown owner disconnected', () => !f.hub.core.presence().some(p => p.name === 'target') || undefined);
  finishStop();
  const refused = await launching;
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /name "target".*in use by a live session/);
  assert.deepEqual(stopped, ['launched:target']);
  const reconnect = await f.hello('unknown', 'target');
  assert.equal(reconnect.type, 'welcome', JSON.stringify(reconnect));
  assert.equal(reconnect.role, 'implementer');
});


test('spawn rejection releases its reservation without revoking a foreign owner’s role', async t => {
  const f = await pendingAlias(t);
  let entered!: () => void;
  let reject!: (error: Error) => void;
  const started = new Promise<void>(done => { entered = done; });
  const spawning = new Promise<never>((_, fail) => { reject = fail; });
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async () => { entered(); return spawning; } });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.owner.call<{ ok: boolean }>('rename', { name: 'target' })).ok, true);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  reject(new Error('spawn failed'));
  const refused = await launching;
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /spawn failed/);
  const presence = await f.owner.call<{ sessions: Array<{ role: string }> }>('who');
  assert.equal(presence.sessions[0]?.role, 'implementer');
  assert.deepEqual(f.watched, []);
});

test('spawn rejection preserves a foreign owner who renames and reconnects at the launch name', async t => {
  const f = await pendingAlias(t);
  let entered!: () => void;
  let reject!: (error: Error) => void;
  const started = new Promise<void>(done => { entered = done; });
  const spawning = new Promise<never>((_, fail) => { reject = fail; });
  t.after(() => reject(new Error('test finished')));
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async () => { entered(); return spawning; } });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.owner.call<{ ok: boolean }>('rename', { name: 'target' })).ok, true);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  await f.owner.close();
  const reconnect = await f.hello('owner-id', 'target');
  assert.equal(reconnect.type, 'welcome', JSON.stringify(reconnect));
  const changing = await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' });
  reject(new Error('spawn rejected'));
  assert.equal((await launching).ok, false);
  assert.equal(changing.ok, true, changing.error);
  assert.equal(f.hub.core.store.roleOf('target'), 'implementer');
  assert.equal(f.hub.core.presence().find(s => s.sessionId === 'owner-id')?.role, 'implementer');
});

test('an uncredentialed unknown holder keeps mutation rights at a pending launch name', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'coordinator', move: true })).ok, true);
  const { client, welcome } = await f.openHello('unknown', 'other');
  assert.equal(welcome.type, 'welcome');
  const { started, release } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  client.send({ type: 'rename', id: 'foreign-rename', name: 'target' });
  let rename = await client.next();
  while (rename.type !== 'result' || rename.id !== 'foreign-rename') rename = await client.next();
  assert.equal(rename.ok, true, JSON.stringify(rename));
  const changing = await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' });
  client.close();
  await client.closed;
  await eventually('foreign unknown disconnected', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  const reconnect = await f.hello('unknown', 'target');
  assert.equal(reconnect.type, 'welcome', JSON.stringify(reconnect));
  const reconnectedChange = await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' });
  release();
  assert.equal((await launching).ok, false);
  for (const result of [changing, reconnectedChange]) assert.equal(result.ok, true, result.error);
  assert.equal(f.hub.core.store.roleOf('target'), 'implementer');
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.role, 'implementer');
});

test('cleanup retains a credentialed unknown early grant when spawn returns a real identity', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  assert.equal((await f.hello('unknown', 'other')).type, 'welcome');
  const { started, release, credential } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  assert.equal((await f.hello('unknown', 'target', credential())).type, 'welcome');
  release();
  assert.equal((await launching).ok, false);
  assert.equal(f.hub.core.store.roleOf('target'), null);
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.role, null);
  assert.equal(f.hub.core.presence().find(s => s.name === 'other')?.role, 'implementer');
  assert.deepEqual(f.table.pendingStops(), []);
  assert.equal(f.table.get('target'), null);
});

test('credentialed anonymous provenance survives pending cleanup and a hub restart', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  assert.equal((await f.hello('unknown', 'other')).type, 'welcome');
  const { started, release, credential } = deferSpawn(t, f.sessions, { refuseStop: true, identity: { pid: process.pid, pidStarted: 'previous process start' } });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.hello('unknown', 'target', credential())).type, 'welcome');
  const proven = f.hub.core.presence().find(s => s.name === 'target')?.sessionId;
  assert.ok(proven && proven !== 'unknown', 'credentialed anonymous hello has its own stable identity');
  release();
  assert.equal((await launching).ok, false);
  assert.ok(f.table.pendingStops()[0]?.ownership?.sessionIds.includes(proven));
  assert.ok(f.table.pendingStops()[0]?.ownership?.sessionIds.includes('launched:target'));
  const r = await restartPending(t, f, true);
  const client = await connectSocket(join(f.root, 'hub.sock'));
  t.after(() => client.close());
  client.send({ type: 'hello', protocol: 2, secret: TEST_SECRET, cwd: f.root, sessionId: 'unknown', name: 'target', launchToken: credential() });
  assert.equal((await client.next()).type, 'welcome');
  assert.equal(r.hub.core.presence().find(s => s.name === 'target')?.sessionId, proven);
  assert.equal((await r.ui.request({ type: 'role.clear', session: 'target' })).ok, false);
  await r.sessions.resumeAll();
  assert.deepEqual(r.stopped, [], 'the reused process identity is never signalled');
  assert.deepEqual(r.table.pendingStops(), []);
  assert.equal(r.hub.core.store.roleOf('target'), null);
  assert.equal(r.hub.core.presence().find(s => s.name === 'target')?.role, null);
  assert.equal(r.hub.core.store.roleOf('other'), 'implementer');
});

test('credentialed reconnect during a deferred cleanup stop reuses receipt-committed provenance', async t => {
  const f = await pendingAlias(t);
  const { started, release, stopping, finishStop, credential } = deferSpawn(t, f.sessions, { holdStop: true });
  const launching = f.launch('target');
  await started;
  const early = await f.openHello('early-id', 'target', credential());
  assert.equal(early.welcome.type, 'welcome');
  release();
  await stopping;
  assert.ok(f.table.pendingStops()[0]?.ownership?.sessionIds.includes('early-id'));
  early.client.close();
  await early.client.closed;
  await eventually('early owned identity disconnected', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  assert.equal((await f.hello('new-id', 'target', credential())).type, 'welcome');
  const reconnected = f.hub.core.presence().find(s => s.name === 'target')?.sessionId;
  assert.ok(reconnected && f.table.pendingStops()[0]?.ownership?.sessionIds.includes(reconnected), 'cleanup cannot grant an identity absent from the receipt');
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'target' })).ok, false);
  finishStop();
  assert.equal((await launching).ok, false);
  assert.equal(f.hub.core.store.roleOf('target'), null);
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.role, null);
  assert.deepEqual(f.table.pendingStops(), []);
});

test('a credentialed anonymous first hello after acceptance binds to the published stable identity', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  assert.equal((await f.hello('unknown', 'other')).type, 'welcome');
  const { started, release, credential } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  release();
  assert.equal((await launching).ok, true);
  assert.equal((await f.hello('unknown', 'target', credential())).type, 'welcome');
  assert.equal(f.hub.core.store.sessionIdOf('target'), 'launched:target');
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.sessionId, 'launched:target');
  assert.equal(f.hub.core.presence().find(s => s.name === 'other')?.sessionId, 'unknown');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' })).ok, true, 'accepted ownership binding is outside the pending fence');
});

for (const carried of [false, true]) for (const first of ['hello', 'acceptance'] as const) test(`a launch records exactly one role notice when ${first} comes first${carried ? ' with the clause carried at spawn' : ''}`, async t => {
  const events: Array<Record<string, unknown>> = [];
  const record = agentsRecord();
  const f = await pendingAlias(t, record.tap(event => { events.push(event); }));
  record.attach(f.hub.core);
  f.sessions.register({ ...f.sessions.adapter('test'), clauseAtSpawn: carried });
  const { started, release, credential } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  const notices = async () => {
    const history = await f.ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
    assert.equal(history.ok, true, history.error);
    return (history.value as { messages: Array<{ kind?: string; text: string }> }).messages
      .filter(m => m.kind === 'role-assign' && m.text.startsWith('target took Implementer at launch'));
  };
  let connection: Awaited<ReturnType<typeof f.openHello>>;
  if (first === 'hello') {
    connection = await f.openHello('launched:target', 'target', credential());
    assert.equal(connection.welcome.type, 'welcome');
    const earlyNotices = await notices();
    release();
    assert.equal((await launching).ok, true);
    assert.equal(earlyNotices.length, 1, 'the first grant publishes its notice before acceptance');
  } else {
    release();
    assert.equal((await launching).ok, true);
    assert.equal((await notices()).length, 1, 'acceptance publishes its grant without waiting for hello');
    connection = await f.openHello('launched:target', 'target', credential());
    assert.equal(connection.welcome.type, 'welcome');
  }
  // A live join and an offline reconnect cannot repeat the first-role grant or notice.
  const joined = await f.openHello('launched:target', 'target', credential());
  assert.equal(joined.welcome.type, 'welcome');
  connection.client.close();
  joined.client.close();
  await Promise.all([connection.client.closed, joined.client.closed]);
  await eventually('launched target disconnected', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  assert.equal((await f.hello('launched:target', 'target', credential())).type, 'welcome');
  assert.equal((await notices()).length, 1);
  assert.equal(events.filter(e => e.event === 'role-taken-at-launch' && e.session === 'target').length, 1);
});

for (const joined of [false, true]) test(`an accepted first-role credential cannot overwrite a later human grant${joined ? ' after a credentialed join' : ''}`, async t => {
  const f = await pendingAlias(t);
  const { started, release, credential } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  release();
  assert.equal((await launching).ok, true);
  if (joined) {
    const first = await f.openHello('launched:target', 'target');
    const additional = await f.openHello('launched:target', 'target', credential());
    assert.equal(first.welcome.type, 'welcome');
    assert.equal(additional.welcome.type, 'welcome');
    first.client.close();
    additional.client.close();
    await Promise.all([first.client.closed, additional.client.closed]);
    await eventually('accepted joined session disconnected', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  }
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' })).ok, true);
  assert.equal((await f.hello('launched:target', 'target', credential())).type, 'welcome');
  assert.equal(f.hub.core.store.roleOf('target'), 'reviewer');
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.role, 'reviewer');
  assert.equal(f.table.get('target')?.role, 'reviewer');
});

for (const changed of ['reviewer', null]) test(`a first launch hello preserves a human ${changed ?? 'clear'} while spawn is pending`, async t => {
  const f = await pendingAlias(t);
  const { started, release, credential } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  const update = changed === null ? { type: 'role.clear' as const, session: 'target' } : { type: 'role.set' as const, session: 'target', role: changed };
  assert.equal((await f.ui.request(update)).ok, true);
  const hello = await f.hello('launched:target', 'target', credential());
  release();
  assert.equal((await launching).ok, true);
  assert.equal(hello.type, changed === null ? 'error' : 'welcome');
  if (changed === null) assert.equal(hello.code, 'no-role');
  assert.equal(f.hub.core.store.roleOf('target'), changed);
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.role ?? null, changed);
  assert.equal(f.table.get('target')?.role, changed, 'acceptance retains the human role for later reconnects');
});

test('a credentialed foreign live join adds no launch proof and keeps its role after spawn rejection', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  const first = await f.openHello('foreign-id', 'other');
  assert.equal(first.welcome.type, 'welcome');
  let entered!: () => void;
  let reject!: (error: Error) => void;
  let credential: string | undefined;
  const started = new Promise<void>(done => { entered = done; });
  const spawning = new Promise<never>((_, fail) => { reject = fail; });
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async request => { credential = request.launchToken; entered(); return spawning; } });
  const launching = f.launch('target');
  await started;
  assert.ok(credential);
  const joined = await f.openHello('foreign-id', 'other', credential);
  assert.equal(joined.welcome.type, 'welcome');
  const change = await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' });
  reject(new Error('spawn rejected after foreign join'));
  assert.equal((await launching).ok, false);
  assert.equal(change.ok, true, change.error);
  assert.equal(f.hub.core.store.roleOf('other'), 'implementer');
  assert.equal(f.hub.core.presence().find(s => s.name === 'other')?.role, 'implementer');
  first.client.close();
  joined.client.close();
  await Promise.all([first.client.closed, joined.client.closed]);
  await eventually('foreign joined session disconnected', () => !f.hub.core.presence().some(s => s.name === 'other') || undefined);
});

for (const live of [true, false]) test(`a launch credential cannot claim a foreign ${live ? 'live' : 'offline'} identity under another requested name`, async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  const other = await f.openHello('foreign-id', 'other');
  assert.equal(other.welcome.type, 'welcome');
  if (!live) {
    other.client.close();
    await other.client.closed;
    await eventually('foreign identity offline', () => !f.hub.core.presence().some(s => s.name === 'other') || undefined);
  }
  let entered!: () => void;
  let reject!: (error: Error) => void;
  let credential: string | undefined;
  const started = new Promise<void>(done => { entered = done; });
  const spawning = new Promise<never>((_, fail) => { reject = fail; });
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async request => { credential = request.launchToken; entered(); return spawning; } });
  const launching = f.launch('target');
  await started;
  assert.ok(credential);
  const hello = await f.hello('foreign-id', 'target', credential);
  reject(new Error('spawn rejected after conflicting binding'));
  assert.equal((await launching).ok, false);
  assert.equal(f.hub.core.store.roleOf('other'), 'implementer');
  if (live) assert.equal(f.hub.core.presence().find(s => s.name === 'other')?.role, 'implementer');
  assert.equal(hello.type, 'error');
  assert.match(String(hello.message), /foreign-id|other/);
});

test('a refused anonymous hello cannot leave uncommitted rollback provenance for a cleanup reconnect', async t => {
  const f = await pendingAlias(t);
  const { started, release, credential } = deferSpawn(t, f.sessions, { refuseStop: true, identity: { pid: process.pid, pidStarted: 'previous process start' } });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.hello('unknown', 'wrong-name', credential())).type, 'error');
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if (sql.startsWith('insert into harness_processes')) throw new Error('publication refused');
    return prepare.call(this, sql);
  });
  release();
  assert.equal((await launching).ok, false);
  assert.equal((await f.hello('unknown', 'target', credential())).type, 'welcome');
  const reconnected = f.hub.core.presence().find(s => s.name === 'target')?.sessionId;
  assert.ok(reconnected && f.table.pendingStops()[0]?.ownership?.sessionIds.includes(reconnected), 'a cleanup grant must be covered by its rollback receipt');
  f.sessions.register({ ...f.sessions.adapter('test'), stop: async () => {} });
  await f.sessions.resumeAll();
  assert.equal(f.hub.core.store.roleOf('target'), null);
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.role, null);
});

test('a pending credential cannot adopt a pre-existing identity renamed into its name while offline', async t => {
  const f = await pendingAlias(t);
  t.mock.restoreAll(); // Only the original claimant needs the fixture's failed-adoption alias.
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'coordinator', move: true })).ok, true);
  const foreign = await f.openHello('foreign-id', 'other');
  assert.equal(foreign.welcome.type, 'welcome');
  let entered!: () => void;
  let reject!: (error: Error) => void;
  let credential: string | undefined;
  const started = new Promise<void>(done => { entered = done; });
  const spawning = new Promise<never>((_, fail) => { reject = fail; });
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async request => { credential = request.launchToken; entered(); return spawning; } });
  const launching = f.launch('target');
  await started;
  foreign.client.send({ type: 'rename', id: 'foreign-rename', name: 'target' });
  let renamed = await foreign.client.next();
  while (renamed.type !== 'result' || renamed.id !== 'foreign-rename') renamed = await foreign.client.next();
  assert.equal(renamed.ok, true, JSON.stringify(renamed));
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  foreign.client.close();
  await foreign.client.closed;
  await eventually('renamed foreign identity offline', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  assert.ok(credential);
  const credentialed = await f.hello('foreign-id', 'target', credential);
  const changing = await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' });
  reject(new Error('spawn rejected after foreign offline retry'));
  assert.equal((await launching).ok, false);
  assert.equal(f.hub.core.store.roleOf('target'), 'implementer');
  assert.equal(changing.ok, true, changing.error);
  assert.equal(credentialed.type, 'error');
  assert.match(String(credentialed.message), /pre-existing.*foreign-id/);
  assert.equal((await f.hello('foreign-id', 'target')).type, 'welcome');
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.role, 'implementer');
});

test('an adapter returning a pre-existing identity cannot acquire rollback authority over it', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  assert.equal((await f.hello('foreign-id', 'other')).type, 'welcome');
  const adapter = f.sessions.adapter('test');
  f.sessions.register({ ...adapter, spawn: async request => ({ ...await adapter.spawn(request), sessionId: 'foreign-id' }) });
  const refused = await f.launch('target');
  assert.equal(refused.ok, false);
  assert.equal(f.hub.core.store.roleOf('other'), 'implementer');
  assert.equal(f.hub.core.presence().find(s => s.name === 'other')?.role, 'implementer');
  assert.match(refused.error!, /pre-existing.*foreign-id/);
});

for (const returnedId of ['foreign-id', 'unknown']) test(`an anonymous credentialed hello cannot select returned ${returnedId} during its PID probe`, async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  const foreign = await f.openHello('foreign-id', 'target');
  foreign.client.close();
  await foreign.client.closed;
  await eventually('foreign target offline', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  const bin = join(f.root, 'pid-probe-bin');
  await mkdir(bin);
  await writeFile(join(bin, 'ps'), '#!/bin/sh\n: > "$CLAND_TEST_PRIOR_PID_GATE/entered"\nwhile [ ! -f "$CLAND_TEST_PRIOR_PID_GATE/release" ]; do /bin/sleep 0.02; done\nexec /bin/ps "$@"\n');
  await chmod(join(bin, 'ps'), 0o755);
  const previousPath = process.env.PATH;
  const previousGate = process.env.CLAND_TEST_PRIOR_PID_GATE;
  process.env.PATH = `${bin}:${previousPath}`;
  process.env.CLAND_TEST_PRIOR_PID_GATE = bin;
  t.after(() => {
    process.env.PATH = previousPath;
    if (previousGate === undefined) delete process.env.CLAND_TEST_PRIOR_PID_GATE;
    else process.env.CLAND_TEST_PRIOR_PID_GATE = previousGate;
  });
  const adapter = f.sessions.adapter('test');
  let credential: string | undefined;
  f.sessions.register({ ...adapter, spawn: async request => {
    credential = request.launchToken;
    return { ...await adapter.spawn(request), sessionId: returnedId, pid: process.pid, pidStarted: null };
  } });
  const launching = f.launch('target');
  await eventually('returned identity PID probe entered', () => readFile(join(bin, 'entered')).then(() => true, () => undefined));
  assert.ok(credential);
  const hello = await f.hello('unknown', 'target', credential);
  await writeFile(join(bin, 'release'), '');
  assert.equal((await launching).ok, false);
  assert.equal(f.hub.core.store.roleOf('target'), 'implementer');
  assert.equal(hello.type, 'error');
  assert.match(String(hello.message), returnedId === 'unknown' ? /stable session identity.*unknown/ : /pre-existing.*foreign-id/);
});

for (const priorId of ['prior-id', 'unknown']) for (const returnedId of ['prior-id', 'unknown']) test(`invalid returned ${returnedId} restores Reviewer to prior ${priorId}`, async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' })).ok, true);
  const prior = await f.openHello(priorId, 'target');
  assert.equal(prior.welcome.type, 'welcome');
  prior.client.close();
  await prior.client.closed;
  await eventually('prior Reviewer offline', () => !f.hub.core.presence().some(s => s.name === 'target') || undefined);
  // A non-UNKNOWN returned id is invalid only when it already exists at admission.
  if (priorId === 'unknown' && returnedId === 'prior-id') {
    assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
    assert.equal((await f.hello('prior-id', 'other')).type, 'welcome');
  }
  const adapter = f.sessions.adapter('test');
  f.sessions.register({ ...adapter, spawn: async request => ({ ...await adapter.spawn(request), sessionId: returnedId }) });
  const refused = await f.launch('target');
  assert.equal(refused.ok, false);
  assert.equal(f.hub.core.store.roleOf('target'), 'reviewer');
  assert.deepEqual(f.table.pendingStops(), []);
  assert.equal(f.table.get('target'), null);
  assert.equal((await f.hello(priorId, 'target')).type, 'welcome');
  assert.equal(f.hub.core.presence().find(s => s.name === 'target')?.role, 'reviewer');
});

test('spawn rejection revokes its early hello grant by stable identity and releases the mutation fence', async t => {
  const f = await pendingAlias(t);
  let entered!: () => void;
  let reject!: (error: Error) => void;
  const started = new Promise<void>(done => { entered = done; });
  const spawning = new Promise<never>((_, fail) => { reject = fail; });
  let launchToken: string | undefined;
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async request => { launchToken = request.launchToken; entered(); return spawning; } });
  const launching = f.launch('target');
  await started;
  assert.ok(launchToken, 'the hub gave the adapter a launch credential');
  const target = await spawnSpoke({ hub: f.hub, name: 'target', sessionId: 'launched:target', launchToken });
  t.after(() => target.close());
  await target.waitForPresence(['renamed', 'target']);
  const changing = await f.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' });
  reject(new Error('spawn failed after early hello'));
  assert.equal((await launching).ok, false);
  assert.equal(changing.ok, false);
  assert.match(changing.error!, /pending launch.*target/);
  await target.waitForEvent(e => e.params.meta?.kind === 'role' && e.params.content.includes('no longer holds the role'));
  const presence = await f.owner.call<{ sessions: Array<{ sessionId: string; role: string | null }> }>('who');
  assert.equal(presence.sessions.find(s => s.sessionId === 'launched:target')?.role, null);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' })).ok, true);
});

test('spawn rejection of an unknown early hello cannot roll back another unknown identity', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  assert.equal((await f.hello('unknown', 'other')).type, 'welcome');
  let entered!: () => void;
  let reject!: (error: Error) => void;
  const started = new Promise<void>(done => { entered = done; });
  const spawning = new Promise<never>((_, fail) => { reject = fail; });
  let launchToken: string | undefined;
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async request => { launchToken = request.launchToken; entered(); return spawning; } });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.hello('unknown', 'target', launchToken)).type, 'welcome');
  reject(new Error('spawn failed after unknown early hello'));
  assert.equal((await launching).ok, false);
  const presence = await f.owner.call<{ sessions: Array<{ name: string; role: string | null }> }>('who');
  assert.equal(presence.sessions.find(s => s.name === 'other')?.role, 'implementer');
  assert.equal(presence.sessions.find(s => s.name === 'target')?.role, null);
});

test('process publication failure still stops and supervises the returned process', async t => {
  const f = await pendingAlias(t);
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if (sql.startsWith('insert into harness_processes')) throw new Error('process publication deliberately failed');
    return prepare.call(this, sql);
  });
  const stopped: string[] = [];
  f.sessions.register({ ...f.sessions.adapter('test'), stop: async process => { stopped.push(process.sessionId); } });
  const refused = await f.launch('target');
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /process publication deliberately failed/);
  assert.deepEqual(stopped, ['launched:target']);
  assert.ok(f.watched.includes('launched:target'));
  const listed = await f.ui.request({ type: 'session.list' });
  assert.deepEqual((listed.value as { pendingStops: unknown[] }).pendingStops, []);
  assert.deepEqual((listed.value as { processes: unknown[] }).processes, []);
});

test('a published launch with failed watching sends its terminal fact and ends exact and owned subscriptions', async t => {
  const f = await pendingAlias(t);
  for (const subject of [{ session: 'target' }, { role: 'implementer' }]) {
    assert.equal((await f.owner.call<{ ok: boolean }>('subscribe', { subject, events: ['session.state'] })).ok, true);
  }
  const { started, release, credential } = deferSpawn(t, f.sessions);
  const adapter = f.sessions.adapter('test');
  f.sessions.register({ ...adapter, watch: () => { throw new Error('watch failed after publication'); } });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.hello('launched:target', 'target', credential())).type, 'welcome');
  assert.equal((await f.ui.request({ type: 'event.subscribe', as: { name: 'target' }, subject: { role: 'reviewer' }, events: ['session.state'] })).ok, true);
  release();
  const refused = await launching;
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /watch failed after publication/);
  assert.equal((await f.ui.request({ type: 'topic.send', topic: 'general', to: ['renamed'], text: 'Failed launch lifecycle' })).ok, true);
  const digest = await f.owner.waitForEvent(e => e.params.content.includes('Failed launch lifecycle'));
  assert.deepEqual(digest.params.content.match(/event · session.state · target (launched|stopped)/g), [
    'event · session.state · target launched', 'event · session.state · target stopped',
  ]);
  const listing = await f.ui.request({ type: 'event.subscriptions', as: { name: 'renamed' } });
  assert.equal(listing.ok, true, listing.error);
  assert.deepEqual((listing.value as { subscriptions: Subscription[] }).subscriptions.filter(s => !s.default).map(s => s.subject), [{ role: 'implementer' }]);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  const owned = await f.ui.request({ type: 'event.subscriptions', as: { name: 'target' } });
  assert.equal(owned.ok, true, owned.error);
  assert.deepEqual((owned.value as { subscriptions: Subscription[] }).subscriptions.filter(s => !s.default), []);
  const listed = await f.ui.request({ type: 'session.list' });
  assert.deepEqual((listed.value as { processes: unknown[]; pendingStops: unknown[] }).processes, []);
  assert.deepEqual((listed.value as { pendingStops: unknown[] }).pendingStops, []);
});

test('a rollback logger failure cannot suppress committed revocation and role publication', async t => {
  const f = await pendingAlias(t, entry => {
    if (entry.event === 'role-reservation-released') throw new Error('rollback logger failed');
  });
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const { started, release, credential } = deferSpawn(t, f.sessions);
  f.sessions.register({ ...f.sessions.adapter('test'), watch: () => { throw new Error('watch failed after publication'); } });
  const launching = f.launch('target');
  await started;
  const target = await spawnSpoke({ hub: f.hub, name: 'target', sessionId: 'launched:target', launchToken: credential() });
  t.after(() => target.close());
  await target.waitForPresence(['renamed', 'target']);
  release();
  assert.equal((await launching).ok, false);
  await f.ui.waitFor(frame => frame.type === 'session.role' && frame.session === 'target' && frame.role === null);
  await target.waitForEvent(e => e.params.meta?.kind === 'role' && e.params.content.includes('no longer holds the role'));
  const presence = await f.owner.call<{ sessions: Array<{ name: string; role: string | null }> }>('who');
  assert.equal(presence.sessions.find(s => s.name === 'target')?.role, null);
});

test('role changes on a quarantined launch are refused until verified cleanup completes', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.owner.call<{ ok: boolean }>('subscribe', { subject: { session: 'target' }, events: ['session.state'] })).ok, true);
  const { started, release, stopping, finishStop, credential } = deferSpawn(t, f.sessions, { holdStop: true });
  f.sessions.register({ ...f.sessions.adapter('test'), watch: () => { throw new Error('watch failed after publication'); } });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.hello('launched:target', 'target', credential())).type, 'welcome');
  release();
  await stopping;
  const refused: Array<{ ok: boolean; error?: string }> = [];
  for (const frame of [
    { type: 'role.set', session: 'target', role: 'reviewer' },
    { type: 'role.clear', session: 'target' },
    { type: 'role.set', session: 'target', role: 'reviewer', move: true },
  ]) refused.push(await f.ui.request(frame));
  const waiting = (await f.owner.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter(s => !s.default).length;
  finishStop();
  assert.equal((await launching).ok, false);
  for (const result of refused) {
    assert.equal(result.ok, false, JSON.stringify(refused));
    assert.match(result.error!, /pending launch.*target/);
  }
  assert.equal(waiting, 1, 'quarantine must not publish a terminal fact while stop is unverified');
  assert.deepEqual((await f.owner.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter(s => !s.default), []);
  const presence = await f.owner.call<{ sessions: Array<{ name: string; role: string | null }> }>('who');
  assert.equal(presence.sessions.find(s => s.name === 'target')?.role, null);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'reviewer' })).ok, true);
  await f.sessions.resumeAll();
  const later = await f.owner.call<{ sessions: Array<{ name: string; role: string | null }> }>('who');
  assert.equal(later.sessions.find(s => s.name === 'target')?.role, 'reviewer');
});

test('an early-connected failed launch cannot rename while its stop is pending', async t => {
  const f = await pendingAlias(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'renamed', role: 'implementer' })).ok, true);
  const { started, release, stopping, finishStop, credential } = deferSpawn(t, f.sessions, { holdStop: true });
  f.sessions.register({ ...f.sessions.adapter('test'), watch: () => { throw new Error('watch failed after publication'); } });
  const launching = f.launch('target', 'coordinator');
  await started;
  const target = await spawnSpoke({ hub: f.hub, name: 'target', sessionId: 'launched:target', launchToken: credential() });
  t.after(() => target.close());
  await target.waitForPresence(['renamed', 'target']);
  const early = await target.call<{ ok: boolean; error: string }>('rename', { name: 'early-renamed' });
  release();
  await stopping;
  const stoppingRename = await target.call<{ ok: boolean; error: string }>('rename', { name: 'stop-renamed' });
  const handover = await f.ui.request({ type: 'role.set', session: 'other', role: 'coordinator', move: true });
  finishStop();
  assert.equal((await launching).ok, false);
  for (const result of [early, stoppingRename]) {
    assert.equal(result.ok, false);
    assert.match(result.error, /pending launch.*target/);
  }
  assert.equal(handover.ok, false);
  assert.match(handover.error!, /pending launch.*target/);
  const presence = await f.owner.call<{ sessions: Array<{ name: string; sessionId: string; role: string | null }> }>('who');
  assert.equal(presence.sessions.find(s => s.sessionId === 'launched:target')?.name, 'target');
  assert.equal(presence.sessions.find(s => s.sessionId === 'launched:target')?.role, null);
});

test('an unpublished row failure preserves the prior identity and its claimant lead', async t => {
  const f = await pendingAlias(t, undefined, false);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  const { client, welcome } = await f.openHello('prior-target', 'target');
  assert.equal(welcome.type, 'welcome');
  client.close(); await client.closed;
  await eventually('prior target offline', () => !f.hub.core.connectionOf('prior-target') || undefined);
  const made = await f.ui.request({ type: 'task.create', title: 'Prior target claim', assignee: 'target' });
  const item = (made.value as { item: { id: string } }).item.id;
  const claim = await f.ui.request({ type: 'task.claim', item, as: { name: 'target' } });
  assert.equal(claim.ok, true, claim.error);
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if (sql.startsWith('insert into harness_processes')) throw new Error('unpublished row failed');
    return prepare.call(this, sql);
  });
  const refused = await f.launch('target');
  assert.equal(refused.ok, false); assert.match(refused.error!, /unpublished row failed/);
  const report = await f.ui.request({ type: 'topic.send', topic: 'general', to: [`lead ${item}`], text: 'The prior claimant still leads' });
  assert.equal(report.ok, true, report.error);
  assert.deepEqual((report.value as { message: { to: string[] } }).message.to, ['target']);
  const reconnect = await f.hello('prior-target');
  assert.equal(reconnect.type, 'welcome'); assert.equal(reconnect.name, 'target');
});

test('an unpublished row failure ends proven early subscriber ownership', async t => {
  const f = await pendingAlias(t, undefined, false);
  const { started, release, credential } = deferSpawn(t, f.sessions);
  const launching = f.launch('target');
  await started;
  const welcome = await f.hello('launched:target', 'target', credential());
  assert.equal(welcome.type, 'welcome');
  assert.equal((await f.ui.request({ type: 'event.subscribe', as: { name: 'target' }, subject: { role: 'reviewer' }, events: ['session.state'] })).ok, true);
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if (sql.startsWith('insert into harness_processes')) throw new Error('unpublished row failed');
    return prepare.call(this, sql);
  });
  release();
  assert.equal((await launching).ok, false);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  const subscriptions = await f.ui.request({ type: 'event.subscriptions', as: { name: 'target' } });
  assert.equal(subscriptions.ok, true, subscriptions.error);
  assert.deepEqual((subscriptions.value as { subscriptions: Subscription[] }).subscriptions.filter(s => !s.default), []);
});

test('a credential cannot adopt an identity first connected after launch admission', async t => {
  const f = await pendingAlias(t);
  const { started, release, credential } = deferSpawn(t, f.sessions);
  const spawn = f.sessions.adapter('test').spawn;
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async (...args) => { await spawn(...args); throw new Error('spawn rejected'); } });
  const launching = f.launch('target');
  await started;
  const { client, welcome } = await f.openHello('foreign-after-admission', 'target');
  assert.equal(welcome.type, 'welcome');
  client.close(); await client.closed;
  await eventually('foreign target offline', () => !f.hub.core.connectionOf('foreign-after-admission') || undefined);
  const adopted = await f.hello('foreign-after-admission', 'target', credential());
  assert.equal(adopted.type, 'error'); assert.match(String(adopted.message), /cannot prove pre-existing/);
  release(); assert.equal((await launching).ok, false);
  const reconnect = await f.hello('foreign-after-admission', 'target');
  assert.equal(reconnect.type, 'welcome'); assert.equal(reconnect.role, 'implementer');
});

test('a foreign returned identity introduced after admission keeps its process row and verifier hold', async t => {
  const f = await pendingAlias(t, undefined, false);
  const { started, release } = deferSpawn(t, f.sessions);
  const spawn = f.sessions.adapter('test').spawn;
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async (...args) => ({ ...await spawn(...args), sessionId: 'foreign-after-admission' }) });
  const launching = f.launch('target');
  await started;
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'reviewer' })).ok, true);
  const welcome = await f.hello('foreign-after-admission', 'other');
  assert.equal(welcome.type, 'welcome');
  const foreign = { name: 'other', harness: 'test', role: 'reviewer', model: null, cwd: f.root, pid: null, harnessId: null, sessionId: 'foreign-after-admission', harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running' as const };
  f.table.put(foreign);
  const hold = await f.ui.request({ type: 'task.hold', item: f.item, as: { name: 'other' } });
  release();
  assert.equal(hold.ok, true, hold.error);
  const refused = await launching;
  assert.equal(refused.ok, false); assert.match(refused.error!, /cannot prove pre-existing/);
  const listed = await f.ui.request({ type: 'session.list' });
  assert.equal((listed.value as { processes: Array<{ name: string; status: string }> }).processes.find(p => p.name === 'other')?.status, 'running');
  const view = await f.ui.request({ type: 'task.view', item: f.item });
  assert.equal((view.value as { item: { holds: Array<{ session: string }> } }).item.holds.some(hold => hold.session === 'other'), true);
});

test('failed publication retains recovery when accepted-row removal fails after verified stop', async t => {
  const f = await pendingAlias(t);
  const unsubscribe = f.table.subscribe(process => {
    if (process.status === 'running') throw new Error('committed publication observer failed');
  });
  t.after(unsubscribe);
  const prepare = DatabaseSync.prototype.prepare;
  let refuseRemoval = true;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if (refuseRemoval && sql === 'delete from harness_processes where session_id = ?') throw new Error('row removal deliberately failed');
    return prepare.call(this, sql);
  });
  const stopped: string[] = [];
  f.sessions.register({ ...f.sessions.adapter('test'), stop: async process => { stopped.push(process.sessionId); } });
  const refused = await f.launch('target');
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /committed publication observer failed.*row removal deliberately failed.*cleanup is pending/);
  assert.deepEqual(stopped, ['launched:target']);
  const listed = await f.ui.request({ type: 'session.list' });
  assert.deepEqual((listed.value as { processes: unknown[] }).processes, []);
  assert.equal((listed.value as { pendingStops: unknown[] }).pendingStops.length, 1);
  assert.equal(f.hub.core.store.roleOf('target'), 'implementer', 'rollback waits for its durable settlement stage');
  const recovered = new ProcessTable(join(f.root, '.cland', 'hub.db'));
  try {
    assert.deepEqual(recovered.running(), []);
    assert.equal(recovered.get('target')?.status, 'stopped');
    assert.equal(recovered.pendingStops()[0]?.process.sessionId, 'launched:target');
    assert.deepEqual(recovered.pendingStops()[0]?.stages, { stopped: true, rowRemoved: false, roleRolledBack: false });
  } finally { recovered.close(); }
  refuseRemoval = false;
  await f.sessions.resumeAll();
  assert.deepEqual(f.table.pendingStops(), []);
  assert.equal(f.table.get('target'), null);
  assert.equal(f.hub.core.store.roleOf('target'), null);
  assert.deepEqual(stopped, ['launched:target'], 'verified stop is not repeated during settlement retry');
  const settled = await f.ui.request({ type: 'session.list' });
  assert.deepEqual((settled.value as { pendingStops: unknown[] }).pendingStops, []);
});

test('completed cleanup stages survive receipt-clear failure and do not roll back a later role assignment', async t => {
  const f = await pendingAlias(t);
  const unsubscribe = f.table.subscribe(process => {
    if (process.status === 'running') throw new Error('committed publication observer failed');
  });
  t.after(unsubscribe);
  const prepare = DatabaseSync.prototype.prepare;
  let refuseClear = true;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if (refuseClear && sql === 'delete from harness_pending_stops where session_id = ?') throw new Error('receipt clear deliberately failed');
    return prepare.call(this, sql);
  });
  const stopped: string[] = [];
  f.sessions.register({ ...f.sessions.adapter('test'), stop: async process => { stopped.push(process.sessionId); } });
  const refused = await f.launch('target');
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /receipt clear deliberately failed/);
  assert.deepEqual(f.table.pendingStops()[0]?.stages, { stopped: true, rowRemoved: true, roleRolledBack: true });
  assert.equal(f.table.get('target'), null);
  const reassignment = await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' });
  assert.equal(reassignment.ok, false);
  assert.match(reassignment.error!, /pending launch.*target/);
  refuseClear = false;
  await f.sessions.resumeAll();
  assert.deepEqual(stopped, ['launched:target']);
  assert.deepEqual(f.table.pendingStops(), []);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  await f.sessions.resumeAll();
  assert.equal(f.hub.core.store.roleOf('target'), 'implementer');
});

test('pending-stop ownership and accepted-row quarantine are durable before awaiting stop', async t => {
  const f = await pendingAlias(t);
  const unsubscribe = f.table.subscribe(process => {
    if (process.status === 'running') throw new Error('committed publication observer failed');
  });
  t.after(unsubscribe);
  const { release, stopping, finishStop } = deferSpawn(t, f.sessions, { holdStop: true });
  release();
  // A native second connection observes the committed transition while stop awaits.
  const launching = f.launch('target');
  await stopping;
  const recovered = new ProcessTable(join(f.root, '.cland', 'hub.db'));
  try {
    assert.deepEqual(recovered.running(), []);
    assert.equal(recovered.get('target')?.status, 'stopped');
    assert.equal(recovered.pendingStops()[0]?.process.sessionId, 'launched:target');
  } finally { recovered.close(); }
  finishStop();
  assert.equal((await launching).ok, false);
  assert.deepEqual(f.table.pendingStops(), []);
  assert.equal(f.table.get('target'), null);
});

async function restartPending(t: TestContext, f: Awaited<ReturnType<typeof pendingAlias>>, refuseStop: boolean) {
  await f.owner.close();
  f.ui.close();
  f.closeSessions();
  await f.edge.close();
  await f.closeHub();
  await f.tracker.stop();
  const db = join(f.root, '.cland', 'hub.db');
  const tracker = new Tracker({ root: f.root, db });
  tracker.start();
  t.after(() => tracker.stop());
  const hub = await startHub({ tracker, store: new Store(db), roles: fixedRoles() });
  t.after(() => hub.close());
  const socket = join(f.root, 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const table = new ProcessTable(db);
  const sessions = new Sessions({ root: f.root, core: hub.core, table });
  t.after(() => { sessions.close(); table.close(); });
  const stopped: string[] = [];
  const watched: string[] = [];
  const disposed: string[] = [];
  sessions.register({ ...f.sessions.adapter('test'),
    watch: process => { watched.push(process.sessionId); },
    unwatch: sessionId => { disposed.push(sessionId); },
    stop: async process => {
      stopped.push(process.sessionId);
      if (refuseStop) throw new Error('pid reused: process identity cannot be verified');
    },
  });
  hub.dispatcher.useSessions(sessions);
  const ui = await connectUi(t, { socket, secret: TEST_SECRET });
  return { hub, table, sessions, stopped, watched, disposed, ui };
}

test('failed terminal publication retains its owned row and resumes fan-out and closure once after restart', async t => {
  const f = await pendingAlias(t);
  for (const subject of [{ session: 'target' }, { role: 'implementer' }]) {
    assert.equal((await f.owner.call<{ ok: boolean }>('subscribe', { subject, events: ['session.state'] })).ok, true);
  }
  const prepare = DatabaseSync.prototype.prepare;
  let fault = true;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    const statement = prepare.call(this, sql);
    if (sql.startsWith('insert into meta')) {
      const run = statement.run.bind(statement);
      t.mock.method(statement, 'run', (...values: SQLInputValue[]) => {
        if (fault && values[0] === 'subscription-terminal:launched:target' && String(values[1]).includes('stopped')) throw new Error('terminal checkpoint deliberately failed');
        return run(...values);
      });
    }
    return statement;
  });
  const { started, release, credential } = deferSpawn(t, f.sessions);
  f.sessions.register({ ...f.sessions.adapter('test'), watch: () => { throw new Error('watch failed after publication'); } });
  const launching = f.launch('target');
  await started;
  const { client, welcome } = await f.openHello('launched:target', 'target', credential());
  assert.equal(welcome.type, 'welcome');
  assert.equal((await f.ui.request({ type: 'event.subscribe', as: { name: 'target' }, subject: { role: 'reviewer' }, events: ['session.state'] })).ok, true);
  release();
  const refused = await launching;
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /terminal checkpoint deliberately failed.*cleanup is pending/);
  assert.equal(f.table.get('target')?.status, 'stopped');
  assert.equal(f.table.pendingStops()[0]?.published, true);
  const before = await f.ui.request({ type: 'event.subscriptions', as: { name: 'renamed' } });
  assert.equal((before.value as { subscriptions: Subscription[] }).subscriptions.filter(s => !s.default).length, 2, 'failed terminal checkpoint rolls back subscription closure');
  client.close();
  await client.closed;
  fault = false;
  const r = await restartPending(t, f, true);
  const stillPending = await r.ui.request({ type: 'role.set', session: 'target', role: 'implementer' });
  assert.equal(stillPending.ok, false);
  assert.match(stillPending.error!, /pending launch.*target/);
  await r.sessions.resumeAll();
  await r.sessions.resumeAll();
  assert.deepEqual(r.stopped, [], 'already verified stop is never replayed');
  const owner = await spawnSpoke({ hub: r.hub, name: 'renamed', sessionId: 'owner-id' });
  t.after(() => owner.close());
  await owner.waitForPresence(['renamed']);
  assert.equal((await r.ui.request({ type: 'topic.send', topic: 'general', to: ['renamed'], text: 'Recovered failed launch lifecycle' })).ok, true);
  const digest = await owner.waitForEvent(e => e.params.content.includes('Recovered failed launch lifecycle'));
  assert.deepEqual(digest.params.content.match(/event · session.state · target (launched|stopped)/g), [
    'event · session.state · target launched', 'event · session.state · target stopped',
  ]);
  assert.deepEqual((await owner.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter(s => !s.default).map(s => s.subject), [{ role: 'implementer' }]);
  assert.equal((await r.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
  const owned = await r.ui.request({ type: 'event.subscriptions', as: { name: 'target' } });
  assert.equal(owned.ok, true, owned.error);
  assert.deepEqual((owned.value as { subscriptions: Subscription[] }).subscriptions.filter(s => !s.default), []);
  const listed = await r.ui.request({ type: 'session.list' });
  assert.deepEqual((listed.value as { processes: unknown[] }).processes, []);
  assert.deepEqual((listed.value as { pendingStops: unknown[] }).pendingStops, []);
});

for (const failure of ['stop refusal', 'settlement failure', 'stop save with gone original', 'stop save with reused pid', 'stop save with unreadable identity'] as const) {
  test(`pending cleanup recovers after restart following ${failure}`, async t => {
    const f = await pendingAlias(t);
    const live = failure === 'stop refusal';
    const stopSave = failure.startsWith('stop save');
    const actualStarted = await processStartedAsync(process.pid);
    assert.ok(actualStarted);
    const identity = { pid: failure === 'stop save with gone original' ? 2147483000 : process.pid, pidStarted: live ? actualStarted : 'previous start identity' };
    const { started, release } = deferSpawn(t, f.sessions, { refuseStop: live, identity });
    const prepare = DatabaseSync.prototype.prepare;
    let fault = true;
    t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
      if (fault && failure === 'settlement failure' && sql === 'delete from harness_processes where session_id = ?') throw new Error('settlement deliberately failed');
      const statement = prepare.call(this, sql);
      if (stopSave && sql.startsWith('insert or replace into harness_pending_stops')) {
        const run = statement.run.bind(statement);
        t.mock.method(statement, 'run', (...values: SQLInputValue[]) => {
          if (fault && JSON.parse(String(values[1])).stages.stopped) throw new Error('stop completion save deliberately failed');
          return run(...values);
        });
      }
      return statement;
    });
    const launching = f.launch('target');
    await started;
    assert.equal((await f.owner.call<{ ok: boolean }>('rename', { name: 'target' })).ok, true);
    assert.equal((await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
    release();
    const refused = await launching;
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /cleanup is pending.*remains supervised/);
    const durable = f.table.pendingStops()[0];
    assert.equal(durable?.stages.stopped, failure === 'settlement failure');
    assert.equal(durable?.stopIntent, true);
    assert.equal(durable?.stages.rowRemoved, false);
    assert.equal(durable?.stages.roleRolledBack, false);
    fault = false;
    const r = await restartPending(t, f, !live);
    const before = await r.ui.request({ type: 'session.list' });
    assert.equal((before.value as { pendingStops: unknown[] }).pendingStops.length, 1);
    assert.deepEqual(r.watched, [], 'recovery waits for identity verification before watching');
    const previousPath = process.env.PATH;
    if (failure === 'stop save with unreadable identity') {
      const bin = join(f.root, 'probe-bin');
      await mkdir(bin);
      await writeFile(join(bin, 'ps'), '#!/bin/sh\nexit 1\n');
      await chmod(join(bin, 'ps'), 0o755);
      process.env.PATH = `${bin}:${previousPath}`;
      t.after(() => { process.env.PATH = previousPath; });
    }
    await r.sessions.resumeAll();
    assert.deepEqual(r.stopped, live ? ['launched:target'] : []);
    assert.deepEqual(r.watched, live ? ['launched:target'] : []);
    if (failure === 'stop save with unreadable identity') {
      assert.equal(r.table.pendingStops().length, 1, 'unreadable identity neither signals nor settles');
      assert.deepEqual(r.disposed, []);
      assert.equal(r.table.pendingStops()[0]?.stages.stopped, false);
      process.env.PATH = previousPath;
      await r.sessions.resumeAll();
      assert.deepEqual(r.stopped, []);
    }
    assert.ok(r.disposed.includes('launched:target'), 'supervision is disposed before settlement finishes');
    const after = await r.ui.request({ type: 'session.list' });
    assert.deepEqual((after.value as { pendingStops: unknown[] }).pendingStops, []);
    assert.deepEqual((after.value as { processes: unknown[] }).processes, []);
    const owner = await spawnSpoke({ hub: r.hub, name: 'target', sessionId: 'owner-id' });
    t.after(() => owner.close());
    await owner.waitForPresence(['target']);
    const presence = await owner.call<{ sessions: Array<{ role: string }> }>('who');
    assert.equal(presence.sessions[0]?.role, 'implementer');
  });
}

for (const failure of ['role transaction checkpoint', 'process receipt rollback checkpoint'] as const) {
  test(`${failure} failure cannot replay a completed rollback after restart`, async t => {
    const f = await pendingAlias(t);
    const unsubscribe = f.table.subscribe(process => {
      if (process.status === 'running') throw new Error('committed publication observer failed');
    });
    t.after(unsubscribe);
    const prepare = DatabaseSync.prototype.prepare;
    let fault = true;
    t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
      const statement = prepare.call(this, sql);
      const run = statement.run.bind(statement);
      if (sql.startsWith('insert into meta') || sql.startsWith('insert or replace into harness_pending_stops')) {
        t.mock.method(statement, 'run', (...values: SQLInputValue[]) => {
          if (fault && failure === 'role transaction checkpoint' && String(values[0]).startsWith('launch-role-rollback:')) throw new Error('role checkpoint deliberately failed');
          if (fault && failure === 'process receipt rollback checkpoint' && sql.startsWith('insert or replace') && JSON.parse(String(values[1])).stages.roleRolledBack) throw new Error('rollback completion save deliberately failed');
          return run(...values);
        });
      }
      return statement;
    });
    const refused = await f.launch('target');
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /checkpoint deliberately failed|rollback completion save deliberately failed/);
    assert.equal(f.table.pendingStops()[0]?.stages.roleRolledBack, false);
    assert.equal(f.hub.core.store.roleOf('target'), failure === 'role transaction checkpoint' ? 'implementer' : null);
    fault = false;
    if (failure === 'process receipt rollback checkpoint') {
      const reassignment = await f.ui.request({ type: 'role.set', session: 'target', role: 'implementer' });
      assert.equal(reassignment.ok, false);
      assert.match(reassignment.error!, /pending launch.*target/);
    }
    const r = await restartPending(t, f, true);
    await r.sessions.resumeAll();
    assert.deepEqual(r.stopped, []);
    assert.deepEqual(r.table.pendingStops(), []);
    assert.equal(r.hub.core.store.roleOf('target'), null);
    assert.equal((await r.ui.request({ type: 'role.set', session: 'target', role: 'implementer' })).ok, true);
    await r.sessions.resumeAll();
    assert.equal(r.hub.core.store.roleOf('target'), 'implementer');
  });
}
