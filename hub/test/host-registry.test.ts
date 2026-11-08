// T2: additive process-row host migration and local wire compatibility through disposable fixtures.
import { removeProcessHostColumn } from './legacy-process-schema.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ProcessTable } from '../src/adapters/processes.ts';
import { tempProject } from './harness.ts';
import { fakeHarness } from './fakes/harness.ts';
import { orphanSessions } from '../src/orphans.ts';

test('legacy process database migrates host in place and persists named hosts', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland', 'hub.db');
  const row = await fakeHarness('codex').spawn({ name: 'legacy', cwd: root, role: null, model: null });
  const old = new ProcessTable(path);
  old.put(row);
  old.close();
  const db = new DatabaseSync(path);
  removeProcessHostColumn(db);
  db.close();
  const table = new ProcessTable(path);
  t.after(() => table.close());
  assert.equal(table.get('legacy')?.host, 'local');
  table.put({ ...row, name: 'remote', host: 't1' });
  assert.equal(table.get('remote')?.host, 't1');
  assert.deepEqual(orphanSessions(root)?.map(p => p.name), ['legacy']);
});

test('test Host logs every operation, returns synthetic Linux identities and refuses native work', async () => {
  const { testHost } = await import('../src/host/test-host.ts');
  const events: Record<string, unknown>[] = [];
  const host = testHost('t1', event => events.push(event));
  const proof = await host.identity(123);
  assert.match(proof!.pidIdentity!, /^linux:/);
  assert.equal(await host.alive(proof!), false);
  assert.equal(await host.stop(proof!), false);
  assert.deepEqual(await host.processes(), []);
  await assert.rejects(host.spawn({ command: 'node', args: [], cwd: '/', env: {} }), /test host t1/);
  assert.deepEqual(events.map(e => e.operation), ['identity', 'alive', 'stop', 'processes', 'spawn']);
  assert.equal(host.limitPolls, false);
  await assert.rejects(host.run({ command: 'node', args: [], cwd: '/', env: {} }), /test host t1/);
  for (const operation of ['statDirectory', 'realpath', 'fileType', 'readFile', 'listFolder'] as const) await assert.rejects(host[operation]('/'), /test host t1/);
  await assert.rejects(host.worktreeAdd({ root: '/', path: '/', branch: 'dev' }), /test host t1/);
  await assert.rejects(host.worktreeRemove({ root: '/', path: '/' }), /test host t1/);
  await assert.rejects(host.occupants('/', []), /test host t1/);
  assert.deepEqual(events.map(e => e.operation), ['identity', 'alive', 'stop', 'processes', 'spawn', 'limitPolls', 'run', 'statDirectory', 'realpath', 'fileType', 'readFile', 'listFolder', 'worktreeAdd', 'worktreeRemove', 'occupants']);
});

test('real project hub registers only opted-in test hosts and keeps local session frames unchanged', async t => {
  const { projectHub, connectUi } = await import('./harness.ts');
  const root = await tempProject(t);
  const hub = await projectHub(t, root, { CLAND_TEST_HOSTS: 't1' }, { adapters: [(host, clock) => {
    const fake = fakeHarness('codex', { clock });
    const spawn = fake.spawn.bind(fake);
    fake.spawn = async (...args) => {
      const row = await spawn(...args);
      const remote = host.hostForProcess!({ ...row, host: 't1' });
      assert.equal(remote.name, 't1');
      await remote.identity(123);
      await assert.rejects(remote.spawn({ command: 'node', args: [], cwd: root, env: {} }), /test host t1/);
      assert.throws(() => host.hostForProcess!({ ...row, host: 'absent' }), /unknown host/);
      return row;
    };
    return fake;
  }] });
  const ui = await connectUi(t, hub.discovery);
  const reply = await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex' });
  assert.equal(reply.ok, true, reply.error);
  assert.equal(Object.hasOwn((reply.value as { process: object }).process, 'host'), false);
  const list = await ui.request({ type: 'session.list' });
  assert.equal(list.ok, true, list.error);
  assert.equal(JSON.stringify(list.value).includes('"host"'), false);
  const { clandWithEnv, flushProjectLogs } = await import('./harness.ts');
  const cli = await clandWithEnv(root, {}, 'session', 'list', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.equal(cli.stdout.includes('"host"'), false);
  const { readFile } = await import('node:fs/promises');
  await flushProjectLogs(t, root);
  const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  assert.match(log, /"host":"t1".*"operation":"identity"/);
  assert.match(log, /"host":"t1".*"operation":"spawn"/);
});


test('without the test-host environment only local is registered; unknown host rows exit without native authority', async t => {
  const { Sessions } = await import('../src/adapters/sessions.ts');
  const { HubCore } = await import('../src/hub/core.ts');
  const root = await tempProject(t);
  const core = new HubCore();
  const table = new ProcessTable();
  const sessions = new Sessions({ root, core, table });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  const row = await fakeHarness('codex').spawn({ name: 'remote', cwd: root, role: null, model: null });
  const host = sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' });
  assert.equal(host.hostForProcess!(row).name, 'local');
  assert.throws(() => host.hostForProcess!({ ...row, host: 't1' }), /unknown host t1/);
  const adapter = fakeHarness('codex');
  const nativeCalls: string[] = [];
  adapter.watch = () => { nativeCalls.push('watch'); };
  adapter.stop = async () => { nativeCalls.push('stop'); };
  adapter.resume = async () => { nativeCalls.push('resume'); throw new Error('must not resume unknown host'); };
  sessions.register(adapter);
  table.put({ ...row, host: 'missing', pid: process.pid });
  await sessions.resumeAll();
  assert.equal(sessions.list()[0]?.status, 'exited');
  assert.equal(sessions.list()[0]?.state, 'unknown');
  assert.equal(sessions.list()[0]?.attach, null);
  await assert.rejects(sessions.stop('remote'), /unknown host missing/);
  await assert.rejects(sessions.resume('remote'), /unknown host missing/);
  assert.throws(() => sessions.attachCommand('remote'), /unknown host missing/);
  assert.equal(await sessions.readAccountLimits('default:codex'), null);
  assert.deepEqual(nativeCalls, []);
});

test('registered host without a transport remains running during restart recovery',async t=>{
 const { Sessions }=await import('../src/adapters/sessions.ts');
 const { HubCore }=await import('../src/hub/core.ts');
 const root=await tempProject(t),core=new HubCore(),table=new ProcessTable();
 const sessions=new Sessions({root,core,table});
 t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
 core.store.hosts.insert({id:'offline',address:'offline',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 const adapter=fakeHarness('codex');sessions.register(adapter);
 const row={...await adapter.spawn({name:'outage',cwd:root,role:null,model:null}),host:'offline'};
 table.put(row);
 await sessions.resumeAll();
 assert.equal(table.get('outage')!.status,'running');
 assert.deepEqual(adapter.stops,[]);
 assert.deepEqual(adapter.resumes,[]);
});
