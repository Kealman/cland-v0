// Instrument the native process boundary while real session requests run in an in-process project hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { Tracker } from '../src/tracker/tracker.ts';
import { TaskWorktrees } from '../src/hub/worktrees.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { projectSessions } from '../src/adapters/index.ts';
import { serveProject } from '../src/hub/daemon.ts';
import { connectSocket, connectUi, eventually, fakeCodex, tempProject } from './harness.ts';

test('session launch, list, resume, relaunch and stop spawn no synchronous process', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const previous = { ...process.env };
  Object.assign(process.env, fake.env);
  const daemon = await serveProject(root);
  t.after(async () => { await daemon.stop(); process.env = previous; });
  const ui = await connectSocket(daemon.discovery!.socket);
  t.after(() => ui.close());
  ui.send({ type: 'hello', protocol: 2, secret: daemon.discovery!.secret, client: 'instrumented' });
  assert.equal((await ui.next()).type, 'welcome');
  const originals = { spawnSync: cp.spawnSync, execSync: cp.execSync, execFileSync: cp.execFileSync };
  const calls: string[] = [];
  const restore = () => { Object.assign(cp, originals); syncBuiltinESMExports(); };
  t.after(restore);
  for (const key of Object.keys(originals) as Array<keyof typeof originals>) {
    Object.assign(cp, { [key]: (command: string) => { calls.push(`${key}: ${command}`); throw new Error('synchronous process in a session request'); } });
  }
  syncBuiltinESMExports();
  try {
    let id = 0;
    for (const frame of [
      { type: 'session.launch', name: 'impl', harness: 'codex' },
      { type: 'session.list' },
      { type: 'hub.status' },
      { type: 'session.resume', session: 'impl' },
      { type: 'session.resume', session: 'impl', relaunch: true },
      { type: 'session.stop', session: 'impl' },
    ]) {
      ui.send({ ...frame, id: String(++id) });
      let answer;
      do { answer = await ui.next(30_000); } while (answer.type !== 'result' || answer.id !== String(id));
      assert.equal(answer.ok, true, `${frame.type}: ${String(answer.error)}`);
      if (frame.type === 'session.launch') {
        const deadline = Date.now() + 15_000;
        for (;;) {
          ui.send({ type: 'session.list', id: String(++id) });
          do { answer = await ui.next(30_000); } while (answer.type !== 'result' || answer.id !== String(id));
          const processes = (answer.value as { processes: Array<{ state: string }> }).processes;
          if (processes[0]?.state === 'idle') break;
          assert.ok(Date.now() < deadline, 'first turn completes before resume');
          await new Promise(done => setTimeout(done, 50));
        }
      }
    }
    assert.deepEqual(calls, []);
  } finally { restore(); }
});


test('session stop counts post-await harness-ended logging as resumed work', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const previous = { ...process.env };
  Object.assign(process.env, fake.env);
  const records: Array<Record<string, unknown>> = [];
  const daemon = await serveProject(root, { log: entry => {
    records.push(entry);
    if (entry.event === 'harness-ended') {
      const until = performance.now() + 400;
      while (performance.now() < until) { /* a real synchronous journal consumer */ }
    }
  } });
  t.after(async () => { await daemon.stop(); process.env = previous; });
  const ui = await connectUi(t, daemon.discovery!);
  assert.equal((await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex' }, 30_000)).ok, true);
  records.length = 0;
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl' }, 15_000)).ok, true);
  const slow = records.filter(entry => entry.event === 'slow-request' && entry.tool === 'session.stop');
  assert.equal(slow.length, 1, JSON.stringify(slow));
  assert.equal(slow[0]?.phase, 'resumed');
  assert.ok((slow[0]?.ms as number) >= 400);
  const status = await ui.request({ type: 'hub.status' });
  assert.ok(((status.value as { requests: { slow: number } }).requests.slow) >= 1);
});


test('claim-conflict cleanup counts harness-ended logging as one resumed slow request', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const records: Array<Record<string, unknown>> = [];
  const log = (entry: Record<string, unknown>) => {
    records.push(entry);
    if (entry.event === 'harness-ended') {
      const until = performance.now() + 400;
      while (performance.now() < until) { /* a real synchronous journal consumer */ }
    }
  };
  const daemon = await serveProject(root, { log });
  t.after(() => daemon.stop());
  await eventually('startup cleanup settled', async () => records.some(entry => entry.event === 'orphan-sweep-completed') ? true : undefined);
  const tracker = new Tracker({ root, db: daemon.layout.db, log });
  t.after(() => tracker.stop());
  tracker.create({ id: 'human', name: 'human', role: null }, { title: 'Contested', kind: 'task' });
  tracker.claim({ id: 'sess-coord', name: 'coord', role: 'coordinator' }, 'T-1');
  const project = projectSessions({ core: daemon.hub.core, root, db: daemon.layout.db, discoveryFile: daemon.layout.discovery, log, env: { ...process.env, ...fake.env } });
  t.after(() => project.close());
  const launch = project.sessions.launch.bind(project.sessions);
  project.sessions.launch = async (request, resumed) => {
    const p = await launch(request, resumed);
    tracker.claim({ id: 'sess-impl-9', name: 'impl-9', role: 'implementer' }, 'T-1', { force: true });
    return p;
  };
  const guard = new RequestGuard({ log });
  await assert.rejects(new TaskWorktrees({ tracker, log }).launch(project.sessions,
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
