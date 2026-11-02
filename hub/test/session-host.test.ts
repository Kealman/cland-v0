// T2: sessions route process and directory operations through a recording local Host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { localHost } from '../src/host/local.ts';
import { fakeHarness } from './fakes/harness.ts';
import { tempProject } from './harness.ts';

test('AdapterHost resolves rows and launches to local and launch/relaunch use its directory refusals', async t => {
  const root = await tempProject(t);
  const core = new HubCore();
  const table = new ProcessTable(':memory:', core.clock);
  const calls: string[] = [];
  let refusal: string | null = null;
  const local = { ...localHost(), statDirectory: async (path: string) => { calls.push(path); return { refusal, identity: null }; } };
  const sessions = new Sessions({ root, core, table, hosts: [local] });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  sessions.register(fakeHarness('codex', { clock: core.clock }));
  const host = sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' });
  const launch = { name: 'worker', cwd: root, role: null, model: null, harness: 'codex' };
  assert.equal(host.hostForLaunch!(launch), local);
  const row = await sessions.launch(launch);
  assert.equal(host.hostForProcess!(table.get(row.name)!), local);
  await sessions.stop(row.name);
  refusal = `session cwd ${root} no longer exists`;
  assert.equal((await sessions.resume(row.name, true)).reason, refusal);
  await assert.rejects(sessions.launch({ ...launch, name: 'missing' }), { message: `launch cwd "${root}" is not an accessible directory` });
  assert.deepEqual(calls, [root, root, root]);
});

test('launch identity and legacy stop read the recording Host identity', async t => {
  const root = await tempProject(t);
  const core = new HubCore();
  const table = new ProcessTable(':memory:', core.clock);
  const calls: number[] = [];
  const local = { ...localHost(), identity: async (pid: number) => { calls.push(pid); return { pid, pidStarted: 'fixture-start', pidIdentity: 'fixture-birth' }; } };
  const sessions = new Sessions({ root, core, table, hosts: [local] });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  const fake = fakeHarness('codex', { clock: core.clock });
  const spawn = fake.spawn.bind(fake);
  fake.spawn = async (...args) => { const row = { ...await spawn(...args), pid: 123456, pidStarted: null }; delete row.pidIdentity; return row; };
  sessions.register(fake);
  await sessions.launch({ name: 'worker', cwd: root, harness: 'codex' });
  assert.equal(table.get('worker')?.pidStarted, 'fixture-start');
  assert.equal(table.get('worker')?.pidIdentity, 'fixture-birth');
  table.update('worker', { pidIdentity: null });
  await sessions.stop('worker');
  assert.equal(table.get('worker')?.pidIdentity, 'fixture-birth');
  assert.deepEqual(calls, [123456, 123456]);
});

test('legacy LaunchFiles receipt upgrades identity durably and stops through its Host before undo', async () => {
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const calls: string[] = [];
  const host = { ...localHost(), identity: async (pid: number) => { calls.push('identity'); return { pid, pidStarted: 'old-start', pidIdentity: 'birth' }; }, stop: async () => { calls.push('stop'); return true; } };
  const files = LaunchFiles.restore({ undo: [], children: [{ pid: 123456, pidStarted: 'old-start', graceMs: 10 }] }, work => work(), host);
  await files.rollback(state => { if (state.children.length) { assert.equal(state.children[0]?.pidIdentity, 'birth'); calls.push('checkpoint'); } });
  assert.deepEqual(calls, ['identity', 'checkpoint', 'stop']);
  assert.deepEqual(await files.snapshot(), { undo: [], children: [] });
});

test('a legacy durable pending-stop receipt reopens and recovers through Host processes and identity', async t => {
  const root = await tempProject(t);
  const { join } = await import('node:path');
  const core = new HubCore();
  const fake = fakeHarness('codex', { clock: core.clock });
  const process = { ...await fake.spawn({ name: 'failed', role: null, model: null, cwd: root }), pid: 123456, pidStarted: 'old-start', pidIdentity: 'old-birth' };
  const path = join(root, 'processes.db');
  const before = new ProcessTable(path, core.clock);
  before.put(process);
  before.pendingStop({ process, error: 'interrupted stop', stopIntent: true, stages: { stopped: false, rowRemoved: false, roleRolledBack: false } });
  before.close();
  const table = new ProcessTable(path, core.clock);
  const calls: string[] = [];
  const local = { ...localHost(), processes: async () => { calls.push('processes'); return [{ pid: 123456, parent: 1, rssBytes: 0, cpuPercent: 0 }]; }, identity: async (pid: number) => { calls.push('identity'); return { pid, pidStarted: 'replacement-start', pidIdentity: 'replacement-birth' }; } };
  const sessions = new Sessions({ root, core, table, hosts: [local] });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  sessions.register(fake);
  await sessions.resumeAll();
  assert.deepEqual(calls, ['processes', 'identity']);
  assert.deepEqual(table.pendingStops(), []);
  assert.equal(table.get('failed'), null);
  assert.deepEqual(fake.stops, [], 'a reused PID is never stopped');
});

test('deaf episodes use Host liveness both at startup and on the held-message timer', async t => {
  const { FakeClock } = await import('./fake-clock.ts');
  const { eventually } = await import('./harness.ts');
  const root = await tempProject(t);
  const clock = new FakeClock();
  const core = new HubCore({ clock });
  const table = new ProcessTable(':memory:', clock);
  const fake = fakeHarness('claude-code', { clock });
  const row = { ...await fake.spawn({ name: 'worker', role: null, model: null, cwd: root }), pid: 123456 };
  table.put(row);
  const episode = { message: 'old', since: clock.now().toISOString(), text: 'old', notice: 'old-notice' };
  core.store.setMeta(`deaf-episode:${row.sessionId}`, JSON.stringify(episode));
  let checks = 0;
  let alive = false;
  const local = { ...localHost(), alive: async () => { checks++; return alive; } };
  const sessions = new Sessions({ root, core, table, hosts: [local] });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  sessions.register(fake);
  await eventually('dead startup episode cleared durably', () => core.store.meta(`deaf-episode:${row.sessionId}`) === null ? true : undefined);
  assert.equal(checks, 1);
  const joined = core.hello({ type: 'hello', protocol: 2, name: row.name, sessionId: row.sessionId, cwd: root }, () => true);
  assert.equal(joined.ok, true);
  alive = true;
  // Arm the durable decision observer before admitting the held input. The
  // startup check above has already settled from its own durable checkpoint.
  const processedEpisode = () => {
    const saved = core.store.meta(`deaf-episode:${row.sessionId}`);
    return saved ? JSON.parse(saved) as typeof episode : null;
  };
  const receipt = eventually('live timer decision persisted for held input', () => processedEpisode() ?? undefined);
  const { message } = core.sendFromHuman('general', 'held input', [row.name]);
  await clock.advance(300_001);
  const completed = await receipt;
  const notice = core.topicHistory('agents').messages.find(m => m.id === completed.notice);
  assert.equal(notice?.kind, 'deaf');
  assert.equal(notice?.detail?.message, message.id);
  assert.equal(processedEpisode()?.message, message.id);
  assert.equal(sessions.view(row).stateReason, 'deaf');
  assert.ok(checks >= 2, 'the timer read Host liveness in addition to startup');
});

test('Implementer pool restart checks the requested cwd through Host before stopping the idle member', async t => {
  const { defaultCrew } = await import('../src/crew.ts');
  const root = await tempProject(t);
  const config = defaultCrew();
  config.crew.implementer!.policy = 'pool';
  const core = new HubCore({ crew: { get: () => config, set: async () => config } });
  const table = new ProcessTable(':memory:', core.clock);
  const calls: string[] = [];
  const local = { ...localHost(), statDirectory: async (path: string) => { calls.push(path); return { refusal: 'fixture directory refusal', identity: null }; } };
  const sessions = new Sessions({ root, core, table, hosts: [local] });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  const fake = fakeHarness('codex', { clock: core.clock, host: sessions.host({ discoveryFile: '', node: '', cli: '', spoke: '' }) });
  sessions.register(fake);
  const row = await fake.spawn({ name: 'idle', role: 'implementer', model: null, cwd: root });
  table.put(row);
  const joined = core.hello({ type: 'hello', protocol: 2, name: row.name, role: 'implementer', sessionId: row.sessionId, cwd: root }, () => true);
  assert.equal(joined.ok, true);
  fake.idle(row.name);
  const cwd = `${root}/next`;
  await assert.rejects(sessions.launch({ name: 'next', role: 'implementer', harness: 'codex', cwd, item: 'T-1' }), { message: `launch cwd "${cwd}" is not an accessible directory` });
  assert.deepEqual(calls, [cwd]);
  assert.deepEqual(fake.stops, []);
});

test('remote process liveness and signals require its matching Linux birth, never a local probe', async t => {
  const root = await tempProject(t);
  const core = new HubCore();
  const table = new ProcessTable();
  const calls: string[] = [];
  let birth: string | null = 'linux:boot:123';
  const remote = { ...localHost(), name: 't1',
    identity: async (pid: number) => { calls.push('t1:identity'); return { pid, pidStarted: null, pidIdentity: birth }; },
    alive: async () => { calls.push('t1:alive'); return true; },
    stop: async () => { calls.push('t1:stop'); return true; },
  };
  const local = { ...localHost(), identity: async () => { throw new Error('local probe'); }, alive: async () => { throw new Error('local probe'); }, stop: async () => { throw new Error('local signal'); } };
  const sessions = new Sessions({ root, core, table, hosts: [local, remote] });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  const row = { ...await fakeHarness('codex').spawn({ name: 'remote', cwd: root, role: null, model: null }), host: 't1', pid: process.pid, pidStarted: null, pidIdentity: 'linux:boot:123' };
  const host = sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' }).hostForProcess!(row);
  assert.equal(await host.alive(row), true);
  assert.equal(await host.stop(row), true);
  for (const identity of [null, 'darwin:123', 'linux:boot:124', 'linux:other:123']) {
    birth = identity;
    assert.equal(await host.alive(row), false, `mismatched observed birth ${identity}`);
    assert.equal(await host.stop(row), false);
  }
  const signals = calls.filter(c => c === 't1:stop').length;
  birth = 'linux:boot:123';
  for (const identity of [null, 'darwin:123', 'linux:bad', 'linux:boot:abc']) {
    assert.equal(await host.alive({ ...row, pidIdentity: identity }), false);
    assert.equal(await host.stop({ ...row, pidIdentity: identity }), false);
  }
  assert.equal(calls.filter(c => c === 't1:stop').length, signals);
  assert.ok(calls.includes('t1:identity'));
  assert.equal(calls.filter(c => c === 't1:stop').length, 1);
});

test('remote legacy timestamps never acquire signal authority during stop or LaunchFiles recovery', async t => {
  const { OpenCodeAdapter } = await import('../src/adapters/opencode.ts');
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const { fixtureEnvironment } = await import('./fixture-environment.ts');
  const root = await tempProject(t);
  const core = new HubCore();
  const table = new ProcessTable();
  const calls: string[] = [];
  const remote = { ...localHost(), name: 't1', identity: async (pid: number) => { calls.push('identity'); return { pid, pidStarted: 'legacy', pidIdentity: 'linux:boot:1' }; }, stop: async () => { calls.push('stop'); return true; } };
  const sessions = new Sessions({ root, core, table, hosts: [remote] });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  sessions.register(new OpenCodeAdapter(sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' }), { env: fixtureEnvironment(root, process.env) }));
  const row = { ...await fakeHarness('opencode').spawn({ name: 'legacy', role: null, model: null, cwd: root }), host: 't1', pid: process.pid, pidStarted: 'legacy', pidIdentity: null };
  table.put(row);
  await assert.rejects(sessions.stop(row.name), /could not stop/);
  assert.equal(table.get(row.name)?.pidIdentity, null);
  const host = sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' }).hostForProcess!(row);
  const files = LaunchFiles.restore({ undo: [], children: [{ pid: process.pid, pidStarted: 'legacy', graceMs: 1 }] }, work => work(), host);
  await assert.rejects(files.rollback(), /could not roll back/);
  assert.equal((await files.snapshot()).children[0]?.pidIdentity, null);
  assert.equal(calls.includes('stop'), false);
});
