// T3: real PID SIGKILL, hub-down recovery and pending-stop reconciliation prove process lifecycle boundaries.
import { sessionUi as connectUi } from './session-credential-fixture.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Message } from '../src/protocol.ts';
import { cland, eventually, fakeClaude, killDaemon, nativeProjectHub as projectHub, spawnSpoke, startDaemon, tempProject, testWaitMs, withDiscoveredPid } from './harness.ts';

test('a stopped pooled Reviewer reaches its item lead; a killed lead reaches the Coordinator with warning events', async t => {
  const root = await tempProject(t);
  // Keep pushed states authoritative while the idle notification timer runs.
  const fake = await fakeClaude(t, { pollMs: 50, reexecGraceMs: 100, pushTrustMs: 120_000 });
  const idleNotifyMs = 800;
  const { discovery } = await projectHub(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: String(idleNotifyMs) });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Review lifecycle', assignee: 'impl' });
  const implLaunch = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', item: item.id });
  assert.equal(implLaunch.ok, true, implLaunch.error);
  const implProcess = await withDiscoveredPid(ui, (implLaunch.value as { process: { pid: number; sessionId: string; harnessId: string } }).process);
  t.after(() => killDaemon(implProcess.pid));
  await coord.waitForPresence(['coord', 'impl']);
  const revLaunch = await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code' });
  assert.equal(revLaunch.ok, true, revLaunch.error);
  await coord.waitForPresence(['coord', 'impl', 'rev']);
  // The faster fixture can reach the injected states before the clause's late
  // Stop/mod signals. Settle that automatic turn before testing cancellation.
  const reviewer = (revLaunch.value as { process: { harnessId: string } }).process;
  await eventually('Reviewer clause signals settled', async () => {
    const log = await fake.log(reviewer.harnessId);
    return log.includes('hooks Stop done') && log.includes('session.measure done') ? true : undefined;
  });
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
  assert.equal((await ui.request({ type: 'session.stop', session: 'rev' })).ok, true);
  const stopped = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · rev stopped · ${item.id}`);
  assert.deepEqual((stopped.message as Message).to, ['impl']);
  assert.equal((stopped.message as Message & { stage: string }).stage, 'queued');
  await coord.call('send', { to: ['impl'], text: 'release reviewer event' });
  const log = await eventually('Reviewer stop injected into lead', async () => {
    const text = await fake.log(implProcess.harnessId);
    return text.includes('release reviewer event') ? text : undefined;
  });
  assert.match(log, /rev stopped[\s\S]*release reviewer event/);
  const published = ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · impl died · ${item.id}`);
  process.kill(implProcess.pid, 'SIGKILL');
  await killDaemon(implProcess.pid);
  const died = await published;
  assert.deepEqual((died.message as Message).to, ['coord']);
  assert.equal((died.message as Message & { stage: string }).stage, 'queued');
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord release death event' });
  assert.match((await coord.waitForEvent(e => e.params.content.includes('release death event'))).params.content, /impl died/);
  const inbox = await ui.request({ type: 'inbox.list' });
  assert.equal('notifications' in (inbox.value as object), false);
  const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string; warning?: boolean }> };
  assert.ok(events.rows.some(r => r.text.includes('impl died') && r.warning));
  assert.equal((inbox.value as { needsYou: number }).needsYou, 0);
});


test('a lead death while the hub is down reaches the offline Coordinator once after restart', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50, reexecGraceMs: 100 });
  let { discovery } = await startDaemon(t, root, fake.env);
  let ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Recover default', assignee: 'impl' });
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', item: item.id });
  assert.equal(launched.ok, true, launched.error);
  const p = await withDiscoveredPid(ui, (launched.value as { process: { pid: number; sessionId: string } }).process);
  t.after(() => killDaemon(p.pid));
  await coord.waitForPresence(['coord', 'impl']);
  ui.close();
  await coord.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  process.kill(p.pid, 'SIGKILL');
  await killDaemon(p.pid);
  for (let restart = 0; restart < 2; restart++) {
    ({ discovery } = await startDaemon(t, root, fake.env));
    ui = await connectUi(t, discovery);
    const deaths = await eventually('offline Coordinator death queued', async () => {
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      const events = (history.value as { messages: Array<Message & { stage: string }> }).messages.filter(m => m.text === `event · session.state · impl died · ${item.id}`);
      return events.length ? events : undefined;
    });
    assert.equal(deaths.length, 1);
    assert.deepEqual(deaths[0]?.to, ['coord']);
    assert.equal(deaths[0]?.stage, 'queued');
    ui.close();
    assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  }
});

for (const pendingReceipt of [false, true]) test(`terminal recovery routes an older pooled Reviewer death past its ${pendingReceipt ? 'verified-stopped lead with pending cleanup' : 'already-dead lead'}`, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50, reexecGraceMs: 100 });
  let { discovery } = await startDaemon(t, root, fake.env);
  let ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  // Await each launch's correlated completion receipt: Claude's native agents probe
  // alone has a 15 s deadline, so the generic 5 s frame budget can expire under load.
  const reviewer = await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code' }, testWaitMs(30_000));
  assert.equal(reviewer.ok, true, reviewer.error);
  const r = await withDiscoveredPid(ui, (reviewer.value as { process: { pid: number; sessionId: string } }).process);
  t.after(() => killDaemon(r.pid));
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Terminal lead order', assignee: 'impl' });
  const implementer = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', item: item.id }, testWaitMs(30_000));
  assert.equal(implementer.ok, true, implementer.error);
  const p = await withDiscoveredPid(ui, (implementer.value as { process: { pid: number; sessionId: string } }).process);
  t.after(() => killDaemon(p.pid));
  await coord.waitForPresence(['coord', 'rev', 'impl']);
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
  ui.close();
  await coord.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  process.kill(r.pid, 'SIGKILL');
  await killDaemon(r.pid);
  process.kill(p.pid, 'SIGKILL');
  await killDaemon(p.pid);
  // Reuse subscription-hygiene.test.ts's recovery arrangement: durable facts committed before terminal fan-out.
  // Coordinator authorized this fixture arrangement; all assertions use frame history.
  const { DatabaseSync } = await import('node:sqlite');
  const { join } = await import('node:path');
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.prepare("update harness_processes set status = 'exited' where name in ('rev', 'impl')").run();
  db.close();
  if (pendingReceipt) {
    const { ProcessTable } = await import('../src/adapters/processes.ts');
    const table = new ProcessTable(join(root, '.cland', 'hub.db'));
    const process = table.get('impl');
    assert.ok(process);
    table.pendingStop({ process, error: 'crash after verified stop', published: true, stages: { stopped: true, rowRemoved: false, roleRolledBack: false } });
    table.close();
  }
  for (let restart = 0; restart < 2; restart++) {
    ({ discovery } = await startDaemon(t, root, fake.env));
    ui = await connectUi(t, discovery);
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const deaths = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text.includes(' died'));
    assert.deepEqual(deaths.map(m => [m.text, m.to]), [
      [`event · session.state · rev died · ${item.id}`, ['coord']],
      ...(!pendingReceipt ? [[`event · session.state · impl died · ${item.id}`, ['coord']]] : []),
    ]);
    ui.close();
    assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  }
});


