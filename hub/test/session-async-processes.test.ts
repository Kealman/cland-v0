// T2: dispatch and post-await logging budgets with fake harnesses and complete fake time.
// Native process instrumentation and file-backed CLI stderr are in the lifecycle split.
import { sessionDispatcherUi as dispatcherUi } from './session-credential-fixture.ts';
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { Tracker } from '../src/tracker/tracker.ts';
import { TaskWorktrees } from '../src/hub/worktrees.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { projectSessions } from '../src/adapters/index.ts';
import { FakeClock } from './fake-clock.ts';
import { FAKE_FLAVOURS, fakeHarness } from './fakes/harness.ts';
import { eventually, projectHub, startHub, tempProject } from './harness.ts';
import type { AdapterFactory } from '../src/adapters/index.ts';

// The stop edge reports completion after its await, just like the native endProcess contract.
const adapters: AdapterFactory[] = FAKE_FLAVOURS.map(flavour => (host, clock) => {
  const fake = fakeHarness(flavour, { host, clock });
  const stop = fake.stop.bind(fake);
  fake.stop = async (process, resumed = work => work(), authorize) => {
    await stop(process, resumed, authorize);
    resumed(() => host.log({ event: 'harness-ended', session: process.name }));
  };
  return fake;
});

// T-75: shared gate + read/refusal dispatch + audit logging. T-77 adds tracker/filesystem
// coverage in tracker-native-boundary.test.ts (territory reads T-78; native adapter files T-79);
// startup/shutdown are outside this guard. The session paths below retain T-70's process boundary coverage.
test('in-process dispatch avoids synchronous filesystem and process calls for allowed or refused requests', async t => {
  const root = await tempProject(t);
  const daemon = await projectHub(t, root, {}, { clock: new FakeClock() });
  const answers: Array<Record<string, unknown>> = [];
  const conversation = daemon.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  onCleanup(t, () => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: daemon.discovery.secret, client: 'guard' }));
  assert.ok(answers.some(frame => frame.type === 'welcome'));
  conversation.receive(JSON.stringify({ type: 'role.set', id: 'role', session: 'impl', role: 'implementer' }));
  assert.equal((await eventually('role assigned', () => answers.find(frame => frame.id === 'role'))).ok, true);
  // Authenticate the synthetic provisional caller before arming the no-sync observer.
  const { Store } = await import('../src/hub/store.ts');
  const store = new Store(join(root, '.cland/hub.db'));
  store.rememberSessionCredential('unknown', 'fixture-session-authority');
  store.close();
  const originalsFs = { statSync: fs.statSync, readFileSync: fs.readFileSync, writeSync: fs.writeSync };
  const originalsCp = { spawnSync: cp.spawnSync, execFileSync: cp.execFileSync, execSync: cp.execSync };
  const calls: string[] = [];
  const restore = () => { Object.assign(fs, originalsFs); Object.assign(cp, originalsCp); syncBuiltinESMExports(); };
  onCleanup(t, restore);
  for (const [native, originals] of [[fs, originalsFs], [cp, originalsCp]] as const) {
    for (const key of Object.keys(originals)) Object.assign(native, { [key]: () => { calls.push(key); throw new Error(`synchronous ${key} in request`); } });
  }
  syncBuiltinESMExports();
  try {
    for (const [id, type] of [['allowed', 'task.list'], ['refused', 'task.close'], ['human', 'hub.status']]) {
      conversation.receive(JSON.stringify({ type, id, ...(id === 'human' ? {} : { as: { name: 'impl', credential: 'fixture-session-authority' } }), item: 'T-1' }));
      await eventually(`${id} answered`, () => answers.find(frame => frame.id === id));
    }
    assert.deepEqual(calls, []);
    assert.equal(answers.find(frame => frame.id === 'allowed')?.ok, true);
    assert.equal(answers.find(frame => frame.id === 'refused')?.code, 'forbidden');
    assert.equal(answers.find(frame => frame.id === 'human')?.ok, true);
  } finally { restore(); }
});

test('stopping an in-process session projects post-await harness logging into status request counters', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const records: Array<Record<string, unknown>> = [];
  const log = (entry: Record<string, unknown>) => {
    records.push(entry);
    if (entry.event === 'harness-ended') clock.block(400);
  };
  const guard = new RequestGuard({ log, now: () => clock.now().getTime() });
  // A suite can already own the machine when this status proof runs. Keep its
  // ownership record inside the fixture, never in the machine's real suite slot.
  const compatibilityLock = join(root, 'fixture-suite.lock');
  await writeFile(`${compatibilityLock}.owner`, JSON.stringify({
    pid: process.pid, started: 'Mon Oct 19 00:00:00 2026', token: 'fixture-suite-holder', since: clock.now().toISOString(),
  }));
  const hub = await startHub({ clock, log, requestGuard: guard,
    // Machine occupancy is a supplied fact; status still projects the real guard.
    verification: { locks: [compatibilityLock], compatibility: {
      holder: async () => null,
      occupied: async () => false,
    } }, control: {
    status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: clock.now().toISOString(), uptimeMs: 0 }),
    stop: () => {},
  } });
  onCleanup(t, () => hub.close());
  const project = projectSessions({ core: hub.core, root, discoveryFile: '', log,
    adapters });
  onCleanup(t, () => project.close());
  hub.dispatcher.useSessions(project.sessions);
  const ui = await dispatcherUi(t, hub.dispatcher, root);
  assert.equal((await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex' }, 30_000)).ok, true);
  assert.equal((await ui.request({ type: 'suite.queue' })).ok, true);
  records.length = 0;
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl' }, 15_000)).ok, true);
  const slow = records.filter(entry => entry.event === 'slow-request' && entry.tool === 'session.stop');
  assert.equal(slow.length, 1, JSON.stringify(slow));
  assert.equal(slow[0]?.phase, 'resumed');
  assert.ok((slow[0]?.ms as number) >= 400);
  const status = await ui.request({ type: 'hub.status' });
  assert.equal(status.ok, true, status.error);
  assert.ok(((status.value as { requests: { slow: number } }).requests.slow) >= 1);
  assert.ok(guard.counters.slow >= 1, 'the internal guard also records the resumed work');
});


test('in-process claim-race cleanup logs one resumed slow request for harness completion', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const records: Array<Record<string, unknown>> = [];
  const log = (entry: Record<string, unknown>) => {
    records.push(entry);
    if (entry.event === 'harness-ended') clock.block(400);
  };
  const hub = await startHub({ clock, log });
  onCleanup(t, () => hub.close());
  const tracker = new Tracker({ root, db: ':memory:', log, clock, git: async () => null });
  onCleanup(t, () => tracker.stop());
  await tracker.create({ id: 'human', name: 'human', role: null }, { title: 'Contested', kind: 'task' });
  await tracker.claim({ id: 'sess-coord', name: 'coord', role: 'coordinator' }, 'T-1');
  const project = projectSessions({ core: hub.core, root, discoveryFile: '', log,
    adapters });
  onCleanup(t, () => project.close());
  const launch = project.sessions.launch.bind(project.sessions);
  project.sessions.launch = async (request, resumed) => {
    const p = await launch(request, resumed);
    await tracker.claim({ id: 'sess-impl-9', name: 'impl-9', role: 'implementer' }, 'T-1', { force: true });
    return p;
  };
  const guard = new RequestGuard({ log, now: () => clock.now().getTime() });
  await assert.rejects(new TaskWorktrees({ tracker, log, hasTerritory: async () => false }).launch(project.sessions,
    { name: 'impl-1', harness: 'codex', role: 'implementer', item: 'T-1' },
    work => guard.measure('session.launch', 'claim-race-ui', work, 'resumed')),
    /taken while impl-1 started.*impl-1 was stopped/);
  assert.equal(tracker.view('T-1').claim?.session, 'impl-9');
  assert.equal(project.sessions.list()[0]?.status, 'stopped');
  assert.equal(records.filter(entry => entry.event === 'harness-ended').length, 1);
  const slow = records.filter(entry => entry.event === 'slow-request' && entry.tool === 'session.launch');
  assert.equal(slow.length, 1, JSON.stringify(slow));
  assert.equal(slow[0]?.phase, 'resumed');
  assert.equal(slow[0]?.client, 'claim-race-ui');
  assert.ok((slow[0]?.ms as number) >= 400);
  assert.equal(guard.counters.slow, 1);
});
