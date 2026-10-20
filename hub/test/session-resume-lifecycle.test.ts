// T3: native conversation resume and recovery of live harnesses across hub-process restart.
// Rules: session-resume-component.test.ts and claude-code-schedule.test.ts (T2).
// Hub starts: two for the restart/stop scenario; the stopped-conversation case uses projectHub.
// Both real hub starts are necessary to prove persisted PID recovery with fresh adapter instances.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeProjectHub as projectHub, withDiscoveredPid, connectUi, eventually, fakeClaude, fakeCodex, startDaemon, tempProject, clandWithEnv, pidAlive } from './harness.ts';
import { ownProcess } from './process-cleanup.ts';
import { systemProcesses, type SystemProcess } from '../src/system-processes.ts';
import { preparedProject } from './prepared-project.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

type Resumed = { found: boolean; process: HarnessProcessView; role: string | null; claim: string | null; notes: string[]; reason?: string; fresh?: { brief: string | null } };

test('restart retains undiscoverable harness PIDs and session stop reaps their spokes and descendants', async t => {
  const root = await tempProject(t);
  const claude = await fakeClaude(t);
  const codex = await fakeCodex(t);
  const opencode = await tempProject(t, 'recovery-opencode-');
  const config = join(root, 'claude');
  await mkdir(config);
  const opencodeBin = fileURLToPath(new URL('./fakes/opencode', import.meta.url));
  const env = { ...claude.env, ...codex.env, PATH: `${opencodeBin}:${claude.env.PATH}:${codex.env.PATH}`, CLAUDE_CONFIG_DIR: config, FAKE_OPENCODE_HOME: opencode, XDG_DATA_HOME: join(opencode, 'data'), FAKE_OPENCODE_TURN_MS: '30', FAKE_OPENCODE_CHILD: '1', CLAND_STOP_GRACE_MS: '200' };
  const first = await startDaemon(t, root, env);
  let ui = await connectUi(t, first.discovery);
  const launched: HarnessProcessView[] = [];
  for (const harness of ['claude-code', 'codex', 'opencode']) {
    const result = await ui.request({ type: 'session.launch', name: harness, harness, role: 'implementer' }, 30_000);
    assert.equal(result.ok, true, result.error);
    const p = await withDiscoveredPid(ui, (result.value as { process: HarnessProcessView }).process);
    ownProcess(t, p.pid); // Teardown can only signal processes this test launched.
    launched.push(p);
  }
  await eventually('all native spokes connected', async () => {
    const status = (await ui.request({ type: 'hub.status' })).value as { sessions: { name: string }[] };
    return launched.every(p => status.sessions.some(s => s.name === p.name)) || undefined;
  });
  const owned = new Map<number, SystemProcess>();
  const census = async () => {
    const rows = await systemProcesses();
    const tree = new Set(launched.map(p => p.pid!));
    for (let changed = true; changed;) {
      changed = false;
      for (const row of rows) if (tree.has(row.parent) && !tree.has(row.pid)) { tree.add(row.pid); changed = true; }
    }
    for (const row of rows) if (tree.has(row.pid)) {
      owned.set(row.pid, row);
      ownProcess(t, row.pid);
    }
    return rows.filter(row => tree.has(row.pid));
  };
  const before = await census();
  assert.ok(before.filter(p => /spoke\.ts/.test(p.command)).length >= 3, 'census includes each harness spoke');
  assert.ok(before.some(p => p.parent === launched.find(p => p.harness === 'opencode')!.pid && !/spoke\.ts/.test(p.command)), 'census includes the TERM-ignoring server child');
  ui.close();
  assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
  for (const p of launched) assert.equal(pidAlive(p.pid!), true, 'hub stop preserves live harnesses');
  // Model three native discovery failures without ending any owned process.
  await writeFile(join(config, 'agents-omit'), 'omit');
  await rm(launched.find(p => p.harness === 'codex')!.harnessId!);
  await rm(join(root, '.cland', 'opencode', 'opencode', 'password'));
  const second = await startDaemon(t, root, env);
  ui = await connectUi(t, second.discovery);
  for (const p of launched) {
    const result = await ui.request({ type: 'session.resume', session: p.name });
    assert.equal(result.ok, true, result.error);
    const recovered = result.value as Resumed;
    assert.equal(recovered.found, false, `${p.harness} discovery is unavailable`);
    assert.equal(recovered.process.status, 'running');
    assert.equal(recovered.process.pid, p.pid);
    assert.equal(recovered.process.sessionId, p.sessionId);
    assert.equal(pidAlive(p.pid!), true);
  }
  await census();
  for (const p of launched) {
    const stopped = await clandWithEnv(root, env, 'session', 'stop', p.name);
    assert.equal(stopped.code, 0, stopped.stderr);
  }
  await eventually('all captured project processes are reaped after session stop', () => [...owned.keys()].every(pid => !pidAlive(pid)) || undefined);
  for (const pid of owned.keys()) assert.equal(pidAlive(pid), false, `owned PID ${pid} is gone`);
  assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
  await eventually('both hub PIDs are gone', () => !pidAlive(first.discovery.pid) && !pidAlive(second.discovery.pid) || undefined);
  assert.equal(pidAlive(first.discovery.pid), false);
  assert.equal(pidAlive(second.discovery.pid), false);
});

test('a stopped Claude Implementer resumes its conversation, role and item claim and receives its clause again', async t => {
  const root = await preparedProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Resume work' })).ok, true);
  const launch = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', model: 'claude-fake-1', item: 'T-1' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const before = await withDiscoveredPid(ui, (launch.value as { process: HarnessProcessView }).process);
  await eventually('first clause reaches fake Claude', async () => (await fake.log(before.harnessId!)).includes('you hold the role Implementer') || undefined);
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl' }, 30_000)).ok, true);
  const r = await ui.request({ type: 'session.resume', session: 'impl', relaunch: true }, 30_000);
  assert.equal(r.ok, true, r.error);
  const after = r.value as Resumed;
  after.process = await withDiscoveredPid(ui, after.process);
  assert.equal(after.found, true);
  assert.equal(after.role, 'implementer');
  assert.equal(after.claim, 'T-1');
  assert.deepEqual(after.notes, []);
  assert.equal(after.process.name, 'impl');
  assert.equal(after.process.sessionId, before.sessionId);
  assert.equal(after.process.harnessSessionId, before.harnessSessionId);
  assert.equal(after.process.cwd, before.cwd);
  assert.notEqual(after.process.pid, before.pid);
  await eventually('new role clause delivered on resumed hello', async () => {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const log = await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
    return log.split('\n').filter(line => line.includes('"event":"role-clause","session":"impl"')).length >= 2 || undefined;
  });
  const view = (await ui.request({ type: 'task.view', item: 'T-1' })).value as { item: { claim: { sessionId: string } } };
  assert.equal(view.item.claim.sessionId, before.sessionId);
});

