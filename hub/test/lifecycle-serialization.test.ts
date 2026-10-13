import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { LaunchFiles } from '../src/adapters/launch-files.ts';
import { createHubBase } from '../src/hub/server.ts';
import { eventually, tempProject } from './harness.ts';
import { parseRoles } from '../src/roles/config.ts';
import { RequestGuard } from '../src/hub/budget.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(t: TestContext, log?: (entry: Record<string, unknown>) => void) {
  const root = await tempProject(t);
  let roles = parseRoles('[coordinator.launch]\nharness = "test"\n');
  const hub = createHubBase({ secret: 'test', roles: { get: () => roles } });
  const table = new ProcessTable();
  const sessions = new Sessions({ core: hub.core, table, root, ...(log ? { log } : {}) });
  t.after(() => { sessions.close(); table.close(); hub.close(); });
  const p = { name: 'impl', harness: 'test', role: null, model: null, cwd: root, pid: null, pidStarted: null, harnessId: null, sessionId: 'stable-id', harnessSessionId: 'conversation', startedAt: '', status: 'stopped' as const };
  table.put(p);
  sessions.register({
    harness: 'test',
    capabilities: { history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
    spawn: async r => ({ ...p, ...r, sessionId: 'replacement', harness: 'test', status: 'running' }),
    resume: async r => ({ found: true, process: { ...r, status: 'running' }, state: 'unknown' }),
    stop: async () => {}, attachCommand: () => '', watch: () => {}, inject: async () => {}, confirm: () => {}, interpret: () => ({}), close: () => {},
  });
  return { root, table, sessions, hub, revokeStop: () => { roles = parseRoles('[coordinator.launch]\nharness = "test"\n[coordinator.permissions]\ntools = []\n'); } };
}

test('a delayed failing relaunch cannot undo another relaunch that commits to the same files', async t => {
  const f = await fixture(t);
  const entered = deferred(), gate = deferred();
  t.after(() => gate.resolve());
  const file = join(f.root, 'launch.log');
  await writeFile(file, 'OLD\n');
  let starts = 0;
  f.sessions.register({ ...f.sessions.adapter('test'), resume: async p => {
    const files = new LaunchFiles();
    await files.file(file, true);
    if (++starts === 1) {
      await writeFile(file, 'OLD\nA tentative\n');
      entered.resolve(); await gate.promise;
      await files.rollback(); throw new Error('late A failure');
    }
    await writeFile(file, 'OLD\nB committed\n'); files.commit();
    return { found: true, process: { ...p, status: 'running' }, state: 'unknown' };
  } });
  const a = f.sessions.resume('impl', true);
  const failure = a.then(value => {
    assert.equal(value.found, false);
    assert.match(value.reason!, /late A failure/);
    assert.deepEqual(value.fresh, { brief: null });
  });
  await entered.promise;
  const b = f.sessions.resume('impl', true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 1, 'B cannot commit while A still owns its rollback snapshot');
  gate.resolve(); await failure; await b;
  assert.equal(await readFile(file, 'utf8'), 'OLD\nB committed\n');
  assert.equal(f.sessions.lifecyclePending(), false);
});

test('renaming a session does not create a second lifecycle slot', async t => {
  const f = await fixture(t);
  const entered = deferred(), gate = deferred();
  t.after(() => gate.resolve());
  let starts = 0;
  f.sessions.register({ ...f.sessions.adapter('test'), resume: async p => {
    if (++starts === 1) { entered.resolve(); await gate.promise; }
    return { found: true, process: { ...p, status: 'running' }, state: 'unknown' };
  } });
  const a = f.sessions.resume('impl'); await entered.promise;
  f.table.rename('stable-id', 'renamed');
  const b = f.sessions.resume('renamed');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(starts, 1);
  gate.resolve(); await a; await b;
  assert.equal(starts, 2);
  assert.equal(f.table.get('renamed')?.sessionId, 'stable-id');
  assert.equal(f.sessions.lifecyclePending(), false);
});

test('launch waits behind an existing identity and rechecks a successful resume before replacing its row', async t => {
  const f = await fixture(t);
  const entered = deferred(), gate = deferred();
  t.after(() => gate.resolve());
  let spawns = 0;
  f.sessions.register({ ...f.sessions.adapter('test'), spawn: async () => { spawns++; throw new Error('should not spawn'); }, resume: async p => {
    entered.resolve(); await gate.promise;
    return { found: true, process: { ...p, status: 'running' }, state: 'unknown' };
  } });
  const a = f.sessions.resume('impl'); await entered.promise;
  const rejected = assert.rejects(f.sessions.launch({ name: 'impl', harness: 'test' }), /changed while waiting/);
  gate.resolve(); await a; await rejected;
  assert.equal(spawns, 0); assert.equal(f.sessions.lifecyclePending(), false);
});

test('a stop queued behind relaunch reads the replacement process after admission', async t => {
  const f = await fixture(t);
  const entered = deferred(), gate = deferred();
  t.after(() => gate.resolve());
  let stopped: string | null = null;
  f.sessions.register({ ...f.sessions.adapter('test'), stop: async p => { stopped = p.harnessSessionId; }, resume: async p => {
    entered.resolve(); await gate.promise;
    return { found: true, process: { ...p, harnessSessionId: 'new-conversation', status: 'running' }, state: 'unknown' };
  } });
  const resume = f.sessions.resume('impl', true); await entered.promise;
  const stop = f.sessions.stop('impl');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(stopped, null);
  gate.resolve(); await resume; await stop;
  assert.equal(stopped, 'new-conversation');
  assert.equal(f.sessions.lifecyclePending(), false);
});

test('a Coordinator CLI stop queued behind relaunch rechecks a revoked grant before stopping the replacement', async t => {
  const f = await fixture(t);
  const entered = deferred(), gate = deferred();
  t.after(() => gate.resolve());
  let stops = 0;
  f.sessions.register({ ...f.sessions.adapter('test'), stop: async () => { stops++; }, resume: async p => {
    entered.resolve(); await gate.promise;
    return { found: true, process: { ...p, harnessSessionId: 'replacement', status: 'running' }, state: 'unknown' };
  } });
  f.hub.core.assignRole('coord', 'coordinator');
  f.hub.dispatcher.useSessions(f.sessions);
  const answers: Array<Record<string, unknown>> = [];
  const cli = f.hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => cli.closed());
  cli.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
  const resume = f.sessions.resume('impl', true); await entered.promise;
  cli.receive(JSON.stringify({ type: 'session.stop', id: 'stop', session: 'impl', as: { name: 'coord' } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stops, 0);
  assert.equal(answers.some(frame => frame.id === 'stop'), false, 'the granted request waits in the lifecycle queue');
  f.revokeStop(); gate.resolve(); await resume;
  const answer = await eventually('queued stop refused after revocation', () => answers.find(frame => frame.id === 'stop'));
  assert.equal(answer.code, 'forbidden', JSON.stringify(answer));
  assert.equal(stops, 0);
  assert.equal(f.table.get('impl')?.harnessSessionId, 'replacement');
  assert.equal(f.table.get('impl')?.status, 'running');
  assert.equal(f.sessions.lifecyclePending(), false);
});

test('stop publication and lifecycle slot release share one resumed scope', async t => {
  let clock = 0;
  const records: Array<Record<string, unknown>> = [];
  const f = await fixture(t, entry => { if (entry.event === 'session-stopped') clock += 150; });
  const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
  const measure = guard.resumer('session.stop', 'cli');
  await f.sessions.stop('impl', work => measure(() => {
    const pending = f.sessions.lifecyclePending();
    try { return work(); }
    finally { if (pending && !f.sessions.lifecyclePending()) clock += 150; }
  }));
  assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['session.stop', 'resumed', 300]]);
});
