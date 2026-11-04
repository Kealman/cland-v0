// T2: fake harness rows and disposable projectHub socket edges; no SSH or cloud.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { localHost } from '../src/host/local.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { once, on } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { projectHub, tempProject, connectUi, connectSocket, clandWithEnv } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { layout } from '../src/project.ts';
import { fakeHarness, type FakeHarness } from './fakes/harness.ts';
import { testHost } from '../src/host/test-host.ts';
import { UNKNOWN_SESSION } from '../src/hub/core.ts';
import type { HarnessProcess, SpawnRequest } from '../src/adapters/contract.ts';
import { onCleanup } from './process-cleanup.ts';

async function hostHello(t: TestContext, root: string, secret: string, fields: Record<string, unknown>) {
  const ws = new WebSocket(`ws+unix:${layout(root).spokeSocket}:/`, { headers: { Authorization: `Bearer ${secret}` }, handshakeTimeout: 2000 });
  onCleanup(t, async () => { if (ws.readyState === WebSocket.CLOSED) return; const closed = once(ws, 'close'); ws.terminate(); await closed; });
  await once(ws, 'open');
  const response = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'hello', protocol: 2, cwd: root, ...fields }));
  return { ws, frame: JSON.parse(String((await response)[0])) };
}

async function fixture(t: TestContext) {
  const root = await tempProject(t);
  let fake!: FakeHarness;
  const bridges: string[] = [];
  const hub = await projectHub(t, root, {}, { adapters: [(host, clock) => {
    fake = fakeHarness('claude-code', { host, clock });
    return Object.assign(fake, { bridge: (row: { sessionId: string }) => { bridges.push(row.sessionId); return () => true; } });
  }] });
  const ui = await connectUi(t, hub.discovery, 'cli');
  const store = new Store(join(root, '.cland/hub.db'));
  const table = new ProcessTable(join(root, '.cland/hub.db'));
  onCleanup(t, () => { table.close(); store.close(); });
  const secrets = new HostSecretStore(root, store.hosts);
  for (const id of ['f1', 'f2']) secrets.register({ id, address: id, user: 'fake', clientKeyPath: '/fake', knownHosts: 'fake' });
  const r = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  assert.equal(r.ok, true, r.error);
  const row = table.get('worker')!;
  table.put({ ...row, host: 'f1' });
  const token = fake.spawns.at(-1)!.launchToken!;
  const secret = secrets.readSecret('f1');
  const actor = { name: row.name, sessionId: row.sessionId, shell: true, credential: token };
  async function spoke(launchToken: string | undefined = token, fields: Record<string, unknown> = {}) {
    return hostHello(t, root, secret, { sessionId: row.sessionId, name: row.name, launchToken, ...fields });
  }
  async function client() {
    return connectUi(t, { ...hub.discovery, secret }, 'cli');
  }
  return { ...hub, fake, bridges, root, ui, store, table, row, token, secret, actor, spoke, client };
}

test('C1 host bearer welcomes only its role-holding launch session', { timeout: 10000 }, async t => {
  const f = await fixture(t); const { frame } = await f.spoke();
  assert.equal(frame.type, 'welcome'); assert.equal(frame.role, 'implementer');
});
for (const bad of ['other-host', 'local', 'no-role', 'no-credential']) test(`C2 host hello refuses ${bad}`, { timeout: 10000 }, async t => {
  const f = await fixture(t);
  f.table.put({ ...f.table.get('worker')!, ...(bad === 'other-host' ? { host: 'f2' } : bad === 'local' ? { host: 'local' } : bad === 'no-role' ? { role: null } : {}) });
  const { frame } = await f.spoke(bad === 'no-credential' ? '' : f.token);
  assert.equal(frame.type, 'error'); assert.equal(JSON.stringify(frame).includes(f.secret), false);
});
test('C3/C4 host CLI requires session credential and denies human frames', { timeout: 10000 }, async t => {
  const f = await fixture(t); await f.spoke(); const c = await f.client();
  for (const frame of [{ type: 'hub.status' }, { type: 'role.set', session: 'worker', role: 'coordinator', as: f.actor }, { type: 'session.launch', name: 'evil', as: f.actor }, { type: 'topic.withdraw', message: 'unknown', as: f.actor }]) {
    const r = await c.request(frame); assert.equal(r.ok, false); assert.match(r.error!, /forbidden/);
  }
  const r = await c.request({ type: 'session.list', as: f.actor }); assert.equal(r.ok, true, r.error);
  for (const type of ['session.signal', 'session.bridge']) {
    const response = await c.request({ type, session: f.row.name, event: 'idle', as: f.actor });
    assert.equal(response.ok, true, response.error);
    const forged = await c.request({ type, session: 'other', event: 'idle', as: f.actor });
    assert.match(forged.error!, /forbidden/);
    const stale = await c.request({ type, session: f.row.name, launch: 'another-launch', event: 'idle', as: f.actor });
    assert.match(stale.error!, /forbidden/);
  }

  assert.deepEqual(f.bridges, [f.row.sessionId]);
  const wrong = await c.request({ type: 'session.list', as: { ...f.actor, credential: 'wrong' } }); assert.match(wrong.error!, /forbidden/);
});
test('C5 human revoke closes host peers and refuses subsequent hellos', { timeout: 10000 }, async t => {
  const f = await fixture(t); const { ws } = await f.spoke(); const c = await f.client();
  const denied = await c.request({ type: 'host.revoke', host: 'f1', as: f.actor }); assert.match(denied.error!, /forbidden/);
  const fromSession = await f.ui.request({ type: 'host.revoke', host: 'f1', as: f.actor }); assert.match(fromSession.error!, /forbidden/);
  const socket = await connectSocket(f.discovery.socket); onCleanup(t, () => socket.close());
  socket.send({ type: 'hello', protocol: 2, client: 'cli', secret: f.secret }); assert.equal((await socket.next()).type, 'welcome');
  const closed = once(ws, 'close');
  const r = await clandWithEnv(f.root, {}, 'host', 'revoke', 'f1'); assert.equal(r.code, 0, r.stderr); assert.match(r.stdout, /revoked host f1/);
  await closed; await socket.closed; assert.equal(f.store.hosts.get('f1')?.state, 'revoked');
  const later = await connectSocket(f.discovery.socket); onCleanup(t, () => later.close());
  later.send({ type: 'hello', protocol: 2, client: 'cli', secret: f.secret });
  const reply = await later.next(); assert.equal(reply.type, 'error'); assert.match(String(reply.message), /revok/);
  assert.equal(JSON.stringify(reply).includes(f.secret), false);
});

test('C3 host clients cannot request human snapshots or borrow another host session', { timeout: 10000 }, async t => {
  const f = await fixture(t); await f.spoke();
  const c = await f.client();
  f.table.put({ ...f.table.get('worker')!, host: 'f2' });
  const reply = await c.request({ type: 'session.list', as: f.actor }); assert.match(reply.error!, /forbidden/);
  const socket = await connectSocket(f.discovery.socket); onCleanup(t, () => socket.close());
  socket.send({ type: 'hello', protocol: 2, client: 'cli', secret: f.secret, features: ['snapshot'] });
  assert.equal((await socket.next()).type, 'error');
});

test('C4 CLI producer carries the host session credential', { timeout: 10000 }, async t => {
  const f = await fixture(t); await f.spoke();
  const path = join(f.root, '.cland', 'host-discovery.json');
  await writeFile(path, JSON.stringify({ ...f.discovery, secret: f.secret }), { mode: 0o600 });
  const result = await clandWithEnv(f.root, { CLAND_HUB_FILE: path, CLAND_SESSION_ID: f.row.sessionId, CLAND_SESSION_NAME: f.row.name, CLAND_LAUNCH_TOKEN: f.token }, 'session', 'list', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.includes(f.secret), false);
  assert.equal(JSON.parse(result.stdout).processes.some((p: { sessionId: string }) => p.sessionId === f.row.sessionId), true);
});

for (const name of ['foreign', undefined]) test(`C2 settled first-hello token cannot join live foreign session (${name ?? 'nameless'})`, { timeout: 10000 }, async t => {
  const f = await fixture(t);
  const r = await f.ui.request({ type: 'session.launch', name: 'foreign', role: 'reviewer', harness: 'claude-code' });
  assert.equal(r.ok, true, r.error);
  const foreign = f.table.get('foreign')!;
  const own = await hostHello(t, f.root, f.discovery.secret, { sessionId: foreign.sessionId, name: foreign.name, launchToken: f.fake.spawns.at(-1)!.launchToken });
  assert.equal(own.frame.type, 'welcome'); assert.equal(own.frame.role, 'reviewer');
  const attack = await f.spoke(f.token, { sessionId: foreign.sessionId, name });
  assert.equal(attack.frame.type, 'error');
  const list = await f.ui.request({ type: 'session.list' });
  const rows = (list.value as { processes: Array<{ sessionId: string; role: string; host?: string }> }).processes;
  assert.equal(rows.find(p => p.sessionId === foreign.sessionId)?.role, 'reviewer');
  assert.equal(f.store.sessionCredential(foreign.sessionId) === f.token, false);
  const pong = once(own.ws, 'message'); own.ws.send(JSON.stringify({ type: 'ping', id: 'foreign-alive' }));
  assert.deepEqual(JSON.parse(String((await pong)[0])), { type: 'result', id: 'foreign-alive', ok: true, value: { pong: true } });
  const delivery = (async () => {
    for await (const [data] of on(own.ws, 'message', { signal: AbortSignal.timeout(2000) })) {
      const frame = JSON.parse(String(data));
      if (frame.type === 'deliver' && frame.message?.text === 'preserved foreign delivery') return frame;
    }
    throw new Error('missing foreign delivery receipt');
  })();
  const sent = await f.ui.request({ type: 'topic.send', topic: 'general', to: ['foreign'], text: 'preserved foreign delivery' });
  assert.equal(sent.ok, true, sent.error);
  assert.equal((await delivery).message.to.includes('foreign'), true);
  const positive = await f.spoke(); assert.equal(positive.frame.type, 'welcome'); assert.equal(positive.frame.role, 'implementer');
});

for (const variant of ['own', 'anonymous', 'foreign-host', 'local', 'roleless']) test(`C1/C2 held-spawn host admission ${variant}`, { timeout: 10000 }, async t => {
  const root = await tempProject(t);
  let acceptedId: string | undefined;
  const entered = Promise.withResolvers<{ request: SpawnRequest; row: HarnessProcess }>();
  const release = Promise.withResolvers<void>();
  const remote = { ...testHost('f1', () => {}), realpath: localHost(fixtureEnvironment(root,process.env)).realpath, async statDirectory() { return { refusal: null, identity: null }; } };
  const hub = await projectHub(t, root, {}, { hosts: [remote], adapters: [(host, clock) => {
    const fake = fakeHarness('claude-code', { host, clock });
    const spawn = fake.spawn.bind(fake);
    fake.spawn = async (...args) => { const row = await spawn(...args); entered.resolve({ request: args[0], row }); await release.promise; return acceptedId ? { ...row, sessionId: acceptedId } : row; };
    return fake;
  }] });
  const ui = await connectUi(t, hub.discovery, 'cli');
  const store = new Store(join(root, '.cland/hub.db'));
  const table = new ProcessTable(join(root, '.cland/hub.db'));
  const secrets = new HostSecretStore(root, store.hosts);
  for (const id of ['f1', 'f2']) secrets.register({ id, address: id, user: 'fake', clientKeyPath: '/fake', knownHosts: 'fake' });
  const launching = ui.request({ type: 'session.launch', name: 'pending', host: variant === 'local' ? 'local' : 'f1', ...(variant === 'roleless' ? {} : { role: 'implementer' }), harness: 'claude-code' });
  onCleanup(t, async () => { release.resolve(); await launching; table.close(); store.close(); });
  const { request, row } = await Promise.race([entered.promise, launching.then(() => { throw new Error('launch ended before the held spawn receipt'); })]);
  assert.equal(table.get('pending'), null, 'spawn remains held before row publication');
  const result = await hostHello(t, root, secrets.readSecret(variant === 'foreign-host' ? 'f2' : 'f1'), { sessionId: variant === 'anonymous' ? UNKNOWN_SESSION : row.sessionId, launchToken: request.launchToken }).then(async result => {
    if (variant === 'anonymous' && result.frame.type === 'welcome') {
      acceptedId = store.sessionIdOf('pending') ?? undefined;
      const again = await hostHello(t, root, secrets.readSecret('f1'), { sessionId: UNKNOWN_SESSION, launchToken: request.launchToken });
      assert.equal(again.frame.type, 'welcome');
      assert.equal(store.sessionIdOf('pending'), acceptedId, 'anonymous reconnect retains the proved identity');
    }
    return result;
  }).finally(() => release.resolve());
  const settled = await launching;
  const allowed = variant === 'own' || variant === 'anonymous';
  assert.equal(result.frame.type, allowed ? 'welcome' : 'error');
  if (allowed) { assert.equal(result.frame.name, 'pending'); assert.equal(result.frame.role, 'implementer'); }
  assert.equal(settled.ok, true, settled.error);
  assert.equal(table.get('pending')?.sessionId, acceptedId ?? row.sessionId);
});

test('host Claude native signal identity is payload bound to its authenticated durable owner',async t=>{
  const f=await fixture(t);await f.spoke();const c=await f.client();
  f.table.put({...f.table.get('worker')!,harnessSessionId:'native-worker'});
  const launched=await f.ui.request({type:'session.launch',name:'other',role:'implementer',harness:'claude-code'});assert.equal(launched.ok,true,launched.error);
  const other=f.table.get('other')!;f.table.put({...other,host:'f1',harnessSessionId:'native-other-session'});
  for(const sessionId of ['native-worker']) {
    const accepted=await c.request({type:'session.signal',session:f.row.name,sessionId,event:'idle',as:f.actor});
    assert.equal(accepted.ok,true,accepted.error);
  }
  for(const sessionId of ['native-other-session','native-unknown',f.row.sessionId]) {
    const refused=await c.request({type:'session.signal',session:f.row.name,sessionId,event:'idle',as:f.actor});
    assert.match(refused.error!,/host plumbing must target its own session/);
  }
  for(const native of ['native-other-session','native-unknown']){
    const refused=await c.request({type:'session.signal',session:f.row.name,sessionId:'native-worker',event:'idle',payload:{session_id:native},as:f.actor});
    assert.match(refused.error!,/host plumbing must target its own session/);
  }
  f.table.put({...f.table.get('worker')!,harnessSessionId:f.row.sessionId});
  const legacy=await c.request({type:'session.signal',session:f.row.name,sessionId:f.row.sessionId,event:'idle',as:f.actor});
  assert.equal(legacy.ok,true,legacy.error);
  const mismatch=await c.request({type:'session.signal',session:f.row.name,sessionId:'native-worker',event:'idle',as:{...f.actor,sessionId:other.sessionId}});
  assert.match(mismatch.error!,/forbidden/);
  assert.equal(f.table.get('other')!.harnessSessionId,'native-other-session');
});
