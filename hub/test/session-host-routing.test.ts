// T2: real adapter lifecycle through recording Hosts and projectHub frames; no native harness launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { localHost } from '../src/host/local.ts';
import { recordingHost } from './recording-host.ts';
import { testHost } from '../src/host/test-host.ts';
import { fakeHarness } from './fakes/harness.ts';
import { tempProject, projectHub, connectUi, eventually, flushProjectLogs } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { sweepOrphans } from '../src/orphans.ts';

function observingHost(root: string, name: string, record: (operation: string) => void) {
  return recordingHost(root, {record, overrides: {name, limitPolls: false,
    identity: async pid => { record('identity'); return {pid, pidStarted: null, pidIdentity: `linux:test-${name}:${pid}`}; },
  }});
}

async function seed(root: string) {
  return { ...await fakeHarness('opencode').spawn({ name: 'remote', cwd: root, role: null, model: null }), host: 't1', pid: process.pid, pidStarted: null, pidIdentity: `linux:test-t1:${process.pid}`, harnessId: null, harnessSessionId: null };
}

test('startup, poll, resume and stop reach only the named Host despite a live local PID collision', async t => {
  const root = await tempProject(t);
  const calls: string[] = [];
  // The limitPolls getter is pure fixture configuration, not a process operation.
  const record = (name: string) => observingHost(root, name, operation => calls.push(`${name}:${operation}`));
  let alive = true;
  const remote = { ...record('t1'), alive: async () => { calls.push('t1:alive'); return alive; }, stop: async () => { calls.push('t1:stop'); alive = false; return true; } };
  const core = new HubCore();
  await mkdir(join(root, '.cland'), { recursive: true });
  const table = new ProcessTable(join(root, '.cland/hub.db'));
  const row = await seed(root);
  table.put(row);
  const sessions = new Sessions({ root, core, table, hosts: [record('local'), remote] });
  const adapter = new OpenCodeAdapter(sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' }), { env: fixtureEnvironment(root, process.env), pollMs: 10 });
  sessions.register(adapter);
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  await sessions.resumeAll();
  assert.equal(table.get('remote')?.status, 'running');
  const beforePoll = calls.filter(c => c === 't1:alive').length;
  await eventually('adapter poll received remote liveness', () => calls.filter(c => c === 't1:alive').length > beforePoll ? true : undefined);
  await sessions.resume('remote');
  await sessions.stop('remote');
  assert.equal(table.get('remote')?.status, 'stopped');
  assert.equal(calls.filter(c => c === 't1:stop').length, 1);
  await sweepOrphans(root, () => {});
  assert.ok(calls.includes('t1:identity'));
  assert.equal(calls.some(c => c.startsWith('local:')), false, JSON.stringify(calls));
  assert.doesNotThrow(() => process.kill(process.pid, 0));
});

test('remote pending-stop recovery completes with Linux birth and no legacy timestamp', async t => {
  const root = await tempProject(t);
  const calls: string[] = [];
  const remote = { ...observingHost(root, 't1', operation => calls.push(operation)),
    processes: async () => { calls.push('processes'); return [{ pid: process.pid, parent: 1, rssBytes: 0, cpuPercent: 0 }]; },
    stop: async () => { calls.push('stop'); return true; },
  };
  const core = new HubCore();
  const table = new ProcessTable();
  const row = await seed(root);
  table.put(row);
  table.pendingStop({ process: row, error: 'interrupted', stopIntent: true, stages: { stopped: false, rowRemoved: false, roleRolledBack: false } });
  const sessions = new Sessions({ root, core, table, hosts: [remote] });
  sessions.register(new OpenCodeAdapter(sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' }), { env: fixtureEnvironment(root, process.env) }));
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  await sessions.resumeAll();
  assert.deepEqual(table.pendingStops(), []);
  assert.equal(table.get('remote'), null);
  assert.ok(calls.includes('processes'));
  assert.ok(calls.includes('stop'));
});

test('projectHub frame stop uses CLAND_TEST_HOSTS and leaves the colliding local process alive', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const table = new ProcessTable(join(root, '.cland/hub.db'));
  table.put(await seed(root));
  table.close();
  const hub = await projectHub(t, root, { CLAND_TEST_HOSTS: 't1' }, { adapters: [host => new OpenCodeAdapter({ ...host, hostForProcess: row => ({ ...host.hostForProcess!(row), layout: localHost(fixtureEnvironment(root, {})).layout }) }, { env: fixtureEnvironment(root, process.env), pollMs: 10 })] });
  const ui = await connectUi(t, hub.discovery);
  const stopped = await ui.request({ type: 'session.stop', session: 'remote' });
  assert.equal(stopped.ok, false, 'test host refuses native signals');
  assert.match(String(stopped.error), /could not stop/);
  assert.doesNotThrow(() => process.kill(process.pid, 0));
  await flushProjectLogs(t, root);
  const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  assert.match(log, /"host":"t1".*"operation":"identity"/);
  assert.match(log, /"host":"t1".*"operation":"stop"/);
});

test('remote Claude without a recorded PID cannot stop by native harness id alone', async t => {
  const { ClaudeCodeAdapter } = await import('../src/adapters/claude-code.ts');
  const root = await tempProject(t);
  const calls: string[] = [];
  const remote = testHost('t1', e => calls.push(String(e.operation)));
  const core = new HubCore();
  const table = new ProcessTable();
  const row = { ...await seed(root), harness: 'claude-code', pid: null, harnessId: 'abcdef12' };
  table.put(row);
  const sessions = new Sessions({ root, core, table, hosts: [remote] });
  sessions.register(new ClaudeCodeAdapter(sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' }), { env: fixtureEnvironment(root, process.env) }));
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  await assert.rejects(sessions.stop(row.name), /identity cannot be verified/);
  assert.equal(calls.includes('run'), false);
  assert.equal(calls.includes('stop'), false);
});

for (const harness of ['codex', 'claude-code'] as const) test(`${harness} stop routes its Linux birth and signal only to the row Host`, async t => {
  const { CodexAdapter } = await import('../src/adapters/codex.ts');
  const { ClaudeCodeAdapter } = await import('../src/adapters/claude-code.ts');
  const root = await tempProject(t);
  const calls: string[] = [];
  const remote = { ...observingHost(root, 't1', operation => calls.push(`t1:${operation}`)), run: async () => { calls.push('t1:run'); return { code: 0, stdout: '', stderr: '' }; }, stop: async (p: import('../src/host/host.ts').HostProcess) => {
    calls.push('t1:stop');
    assert.equal(p.pid, process.pid);
    assert.equal(p.pidIdentity, `linux:test-t1:${process.pid}`);
    return true;
  } };
  const core = new HubCore();
  const table = new ProcessTable();
  const row = { ...await seed(root), harness, harnessId: harness === 'claude-code' ? 'abcdef12' : null };
  table.put(row);
  const sessions = new Sessions({ root, core, table, hosts: [testHost('local', e => calls.push(`local:${e.operation}`)), remote] });
  const host = sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' });
  sessions.register(harness === 'codex' ? new CodexAdapter(host, { env: fixtureEnvironment(root, process.env) }) : new ClaudeCodeAdapter(host, { env: fixtureEnvironment(root, process.env) }));
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  await sessions.stop(row.name);
  assert.equal(table.get(row.name)?.status, 'stopped');
  assert.deepEqual(calls.filter(c => c !== 't1:limitPolls'), harness === 'claude-code' ? ['t1:identity', 't1:stop', 't1:run'] : ['t1:identity', 't1:stop']);
  calls.length = 0;
  table.put({ ...row, pidIdentity: null });
  await assert.rejects(sessions.stop(row.name), /identity cannot be verified/);
  assert.equal(calls.includes('t1:run'), false);
  assert.equal(calls.includes('t1:stop'), false);
});

for (const mode of ['poll', 'resume'] as const) for (const pending of [false, true]) test(mode === 'resume' ? `remote Claude ${mode} persists ${pending ? 'pending' : 'replacement'} PID Linux proof without a legacy timestamp` : `remote Claude poll keeps ${pending ? 'pending' : 'replacement'} PID Linux ownership without discovery`, async t => {
  const { ClaudeCodeAdapter } = await import('../src/adapters/claude-code.ts');
  const root = await tempProject(t);
  const core = new HubCore();
  const table = new ProcessTable();
  const calls: string[] = [];
  const replacement = 987654;
  const clock = new FakeClock(Date.now());
  let discoveries = 0;
  const remote = { ...observingHost(root, 't1', operation => calls.push(operation)),
    run: async () => { discoveries++; return { code: 0, stdout: JSON.stringify([{ id: 'job', sessionId: 'native', pid: replacement, status: 'idle' }]), stderr: '' }; },
    identity: async (pid: number) => { calls.push(`identity:${pid}`); return { pid, pidStarted: null, pidIdentity: `linux:boot:${pid}` }; },
    alive: async (p: import('../src/host/host.ts').HostProcess) => { calls.push(`alive:${p.pid}`); return p.pid === replacement; },
  };
  const row = { ...await seed(root), harness: 'claude-code', harnessId: 'job', harnessSessionId: pending ? null : 'native', pid: pending ? null : process.pid, pidIdentity: pending ? null : `linux:boot:${process.pid}` };
  table.put(row);
  const sessions = new Sessions({ root, core, table, hosts: [remote] });
  const adapter = new ClaudeCodeAdapter(sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' }), { ...(mode === 'poll' ? { clock } : {}), env: fixtureEnvironment(root, process.env), agentsMs: 0, pollMs: mode === 'poll' ? 10 : 600_000 });
  sessions.register(adapter);
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  if (mode === 'poll') {
    adapter.watch(row);
    await clock.advance(100);
    assert.equal(discoveries, 0);
    const saved = table.get(row.name)!;
    assert.equal(saved.pid, row.pid);
    assert.equal(saved.pidStarted, null);
    assert.equal(saved.harnessId, 'job');
    assert.equal(saved.harnessSessionId, pending ? null : 'native');
    assert.equal(saved.pidIdentity, pending ? null : `linux:boot:${process.pid}`);
    assert.equal(row.pidIdentity, pending ? null : `linux:boot:${process.pid}`);
    assert.equal(calls.includes(`identity:${replacement}`), false);
    assert.equal(calls.includes(`alive:${replacement}`), false);
    if (!pending) assert.ok(calls.includes(`alive:${process.pid}`));
    else assert.equal(calls.some(c => c.startsWith('alive:')), false);
    return;
  }
  const receipt = eventually('replacement PID and Linux birth persisted', () => table.get(row.name)?.pid === replacement ? table.get(row.name)! : undefined);
  const action = mode === 'resume' ? sessions.resume(row.name) : (adapter.watch(row), Promise.resolve(null));
  // Both observations settle before fixture teardown, including a failing action.
  const [persisted, resumed] = await Promise.allSettled([receipt, action]);
  if (persisted.status === 'rejected') throw persisted.reason;
  if (resumed.status === 'rejected') throw resumed.reason;
  const saved = persisted.value;
  if (resumed.value) assert.equal(resumed.value.found, true);
  assert.equal(saved.pid, replacement);
  assert.equal(saved.pidStarted, null);
  assert.equal(saved.pidIdentity, `linux:boot:${replacement}`);
  assert.equal(saved.status, 'running');
  assert.ok(calls.includes(`identity:${replacement}`));
  assert.ok(calls.includes(`alive:${replacement}`));
});

for (const control of ['different-job', 'different-conversation', 'changed-birth', 'stale-job', 'stale-conversation', 'closed'] as const) test(`remote Claude replacement refuses ${control} authority`, async t => {
  const { ClaudeCodeAdapter } = await import('../src/adapters/claude-code.ts');
  const { within } = await import('../src/executor/droplet/deadline.ts');
  const root = await tempProject(t);
  const core = new HubCore();
  const table = new ProcessTable();
  const row = { ...await seed(root), harness: 'claude-code', harnessId: 'job', harnessSessionId: 'native', pidIdentity: `linux:boot:${process.pid}` };
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const publications: number[] = [];
  let reads = 0;
  const remote = { ...observingHost(root, 't1', () => {}),
    run: async () => ({ code: 0, stdout: JSON.stringify([{ id: control === 'different-job' ? 'other-job' : 'job', sessionId: control === 'different-conversation' ? 'other-native' : 'native', pid: 987654, status: 'idle' }]), stderr: '' }),
    identity: async (pid: number) => {
      if (pid === 987654) {
        reads++;
        if (control.startsWith('stale') || control === 'closed') { entered.resolve(); await release.promise; }
      }
      return { pid, pidStarted: null, pidIdentity: `linux:boot:${control === 'changed-birth' && reads > 1 ? 2 : pid}` };
    }, alive: async () => true,
  };
  const sessions = new Sessions({ root, core, table, hosts: [remote] });
  const host = sessions.host({ node: '', cli: '', spoke: '', discoveryFile: '' });
  host.recordPid = (_id, pid) => { publications.push(pid); };
  const adapter = new ClaudeCodeAdapter(host, { env: fixtureEnvironment(root, process.env), agentsMs: 0, pollMs: 600_000 });
  sessions.register(adapter);
  t.after(async () => { release.resolve(); await sessions.close(); table.close(); core.close(); core.store.close(); });
  const flight = adapter.resume(row);
  const outcome = flight.then(value => ({ value }), error => ({ error: String(error) }));
  if (control.startsWith('stale') || control === 'closed') {
    await within(entered.promise, 5000);
    if (control === 'stale-job') row.harnessId = 'new-job';
    if (control === 'stale-conversation') row.harnessSessionId = 'new-native';
    const closing = control === 'closed' ? Promise.resolve(adapter.close()) : Promise.resolve();
    release.resolve();
    await within(closing, 5000);
  }
  const result = await within(outcome, 5000);
  if ('value' in result) assert.equal(result.value.found, false);
  else assert.match(result.error, /changed while resuming|adapter is closed/);
  assert.deepEqual(publications, []);
  assert.equal(row.pid, process.pid);
  if (control.startsWith('different')) assert.equal(reads, 0, 'foreign native ownership cannot acquire candidate proof');
});
