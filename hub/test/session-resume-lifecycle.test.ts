// T3: native stopped conversation resume changes the OS PID while preserving its conversation identity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeProjectHub as projectHub, withDiscoveredPid, connectUi, eventually, fakeClaude } from './harness.ts';
import { preparedProject } from './prepared-project.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

type Resumed = { found: boolean; process: HarnessProcessView; role: string | null; claim: string | null; notes: string[]; reason?: string; fresh?: { brief: string | null } };

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

