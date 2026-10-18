// T3 lifecycle: Claude native resume relaunches a stopped conversation with its original identity;
// Codex resume refusal and CLI --fresh create a new native conversation carrying the recorded artifact brief.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeProjectHub as projectHub, withDiscoveredPid, connectUi, eventually, fakeClaude, fakeCodex, cland } from './harness.ts';
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

test('a refused Codex resume offers and launches fresh with its recorded artifact id brief', async t => {
  const root = await preparedProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Fresh work' })).ok, true);
  const text = 'Implement the fresh work from this recorded brief.';
  const a = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Fresh brief', topic: 'general', content: text });
  assert.equal(a.ok, true, a.error);
  const brief = (a.value as { artifact: { id: string } }).artifact.id;
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex', model: 'gpt-fake-1', effort: 'high', item: 'T-1', brief }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const before = (launched.value as { process: HarnessProcessView }).process;
  await eventually('the fake finishes its first turn', async () => {
    const thread = JSON.parse(await readFile(join(fake.home, 'threads', `${before.harnessSessionId}.json`), 'utf8')) as { turns: number };
    return thread.turns > 0 || undefined;
  });
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl' }, 30_000)).ok, true);
  await writeFile(join(fake.home, 'cannot-resume'), 'refuse native resume');
  const failed = await ui.request({ type: 'session.resume', session: 'impl', relaunch: true }, 30_000);
  assert.equal(failed.ok, true, failed.error);
  const offer = failed.value as Resumed;
  assert.equal(offer.found, false);
  assert.match(offer.reason!, /resume failure/);
  assert.deepEqual(offer.fresh, { brief });
  const cli = await cland(root, 'session', 'resume', 'impl', '--relaunch');
  assert.equal(cli.code, 1);
  assert.match(cli.stdout, /--fresh/);
  const fresh = await cland(root, 'session', 'resume', 'impl', '--fresh', '--json');
  assert.equal(fresh.code, 0, fresh.stderr);
  const after = JSON.parse(fresh.stdout) as Resumed;
  assert.equal(after.found, true);
  assert.equal(after.process.sessionId, before.sessionId);
  assert.equal(after.role, 'implementer');
  assert.equal(after.claim, 'T-1');
  assert.equal(after.process.model, before.model);
  assert.equal(after.process.cwd, before.cwd);
  assert.notEqual(after.process.harnessSessionId, before.harnessSessionId);
  const log = await eventually('the fake records its native first input', async () => {
    const log = await fake.log(after.process.pid!);
    return log.includes(' item: ') ? log : undefined;
  });
  assert.match(log, /effort=high/);
  assert.ok(log.includes(text), 'the first turn includes the recorded brief');
});
