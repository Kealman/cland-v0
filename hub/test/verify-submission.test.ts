// T2: the public verify CLI over a real socket and projectHub dispatcher. A held
// response and complete fake clocks prove the deadline without a wall-clock wait.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, connectUi, inProcessSpoke, tempProject, eventually } from './harness.ts';
import { beforeDirectories, onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { runSuiteCommand } from '../src/cli/suite.ts';
import { verificationFixture } from './verification-fixture.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef, RunStatus } from '../src/executor/executor.ts';
import type { HubFrame, VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { SuiteSelection } from '../src/suite-selection.ts';

async function fixture(t: TestContext, delayFrame: 'welcome' | 'result' = 'result', otherStack = false) {
  const root = await tempProject(t, 'verify-submit-');
  await verificationFixture(root, otherStack ? { stack: 'other', check: '', test: 'true' } : {});
  const clock = new FakeClock();
  const cliClock = new FakeClock();
  let held = true, head = 'a'.repeat(40);
  const started = Promise.withResolvers<RunRef>();
  const receipts = new Map<string, RunStatus>();
  const inspections: Array<SuiteSelection | undefined> = [];
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => { started.resolve(run); });
  t.mock.method(LocalExecutor.prototype, 'status', async (lease: Lease) => receipts.get(lease.run) ?? { state: 'running' });
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest="true"\nexecutor="local"\n');
  const hub = await projectHub(t, root, {}, { clock, durationContext: null,
    compatibility: { holder: async () => null, occupied: async () => held },
    candidate: { head: async () => head, tree: async () => null, inspect: async (_cwd, _mode, _workers, projectTest) => {
      inspections.push(projectTest);
      return { head, branch: 'candidate', tree: null,
        selection: { mode: 'hub-selected', files: ['hub/src/example.ts'], reason: 'cland coverage fixture', loadGate: true,
          coverage: { artifact: 'A-1', path: '/fixture/coverage.json', head } }, tierPlan: [], budgetBase: undefined };
    } },
  });
  const ui = await connectUi(t, hub.discovery, 'cli');
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const spoke = await inProcessSpoke(t, { cwd: root, discover: true, assignRole: false, name: 'impl', sessionId: 'submission-impl', role: 'implementer' });
  onCleanup(t, () => spoke.close());
  await spoke.waitForPresence(['impl']);
  const item = ((await ui.request({ type: 'task.create', size: 'S', title: 'Submission', assignee: 'impl' })).value as { item: { id: string } }).item.id;
  const topic = ((await ui.request({ type: 'topic.create', title: 'Submission', item })).value as { topic: { id: string } }).topic.id;
  const firstReply = Promise.withResolvers<{ frame: HubFrame; release: () => void }>();
  let delay = !otherStack;
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    const conversation = hub.dispatcher.open({ isOpen: () => !socket.destroyed, close: () => socket.destroy(), send: frame => {
      const send = () => { if (!socket.destroyed) socket.write(JSON.stringify(frame) + '\n'); };
      if (delay && frame.type === delayFrame) { delay = false; firstReply.resolve({ frame, release: send }); }
      else send();
    } }, { authenticated: false, edge: 'socket' });
    socket.on('close', () => { sockets.delete(socket); conversation.closed(); });
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        conversation.receive(buffer.slice(0, nl)); buffer = buffer.slice(nl + 1);
      }
    });
  });
  beforeDirectories(t, async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const socket = join(root, 'cli.sock');
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
  await writeFile(join(root, '.cland/hub.json'), JSON.stringify({ ...hub.discovery, socket }));
  const env = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'submission-impl', CLAND_ROLE: 'implementer' };
  const outputs: string[] = [], errors: string[] = [];
  const submitAs = (callerEnv: NodeJS.ProcessEnv, mode: string, extra: string[]) => runSuiteCommand([mode, '--report', topic, '--to', 'impl', '--json', ...extra], root,
    { env: callerEnv, clock: cliClock, out: text => { outputs.push(text); }, err: text => { errors.push(text); } });
  const submit = (mode = 'auto', ...extra: string[]) => submitAs(env, mode, extra);
  const queue = async () => (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  return { root, clock, cliClock, ui, firstReply, submit, queue, outputs, errors, started, receipts, inspections,
    human: (mode: string, ...extra: string[]) => submitAs({}, mode, extra),
    hold(value: boolean) { held = value; }, head(value: string) { head = value; } };
}

test('other-stack verify submits a full project test without cland planning', async t => {
  const f = await fixture(t, 'result', true);
  await writeFile(join(f.root, 'hub'), 'another stack may have a file named hub');
  assert.equal(await f.submit(), 0);
  const id = JSON.parse(f.outputs.pop()!).id;
  const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus).suites!;
  const job = jobs.find(job => job.id === id)!;
  assert.deepEqual(job.selection, { mode: 'full', files: [], reason: 'project test runs in full' });
  assert.deepEqual(f.inspections, [{ mode: 'full', files: [], reason: 'project test runs in full' }], 'admission supplies the project plan instead of asking for coverage selection');
  assert.equal(job.selection?.loadGate, undefined);
  assert.equal(job.selection?.coverage, undefined);
});

test('other-stack CLI refuses cland phases while accepting default and all', async t => {
  const f = await fixture(t, 'result', true);
  for (const mode of ['hub', 'nvim']) await assert.rejects(f.submit(mode),
    /hub and nvim are cland's own suite phases; this project's test runs in full: cland verify/);
  assert.deepEqual(f.inspections, [], 'refused phases never inspect coverage');
  assert.equal(await f.submit(), 0);
  assert.equal(await f.human('all'), 0);
  const all = JSON.parse(f.outputs.pop()!).id;
  const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus).suites!;
  assert.deepEqual(jobs.find(job => job.id === all)?.selection, { mode: 'full', files: [], reason: 'project test runs in full' });
});

test('an accepted verify submission times out as unconfirmed and safely retries the active run', async t => {
  const f = await fixture(t);
  const pending = f.submit().then(code => ({ code }), error => ({ code: 1, error }));
  const reply = await f.firstReply.promise;
  assert.ok(reply.frame.type === 'result' && reply.frame.ok, JSON.stringify(reply.frame));
  const id = (reply.frame.value as { id: string }).id;
  assert.deepEqual((await f.queue()).waiters.map(run => run.id), [id], 'accepted before the CLI deadline');
  await f.cliClock.advance(15000);
  assert.deepEqual(await pending, { code: 75 });
  assert.deepEqual(f.errors, ['cland: submission sent; no reply within 15 s; check `cland verify queue` before resubmitting\n']);
  assert.deepEqual(f.outputs, []);
  reply.release();
  assert.equal(await f.submit(), 0);
  const reused = JSON.parse(f.outputs.pop()!);
  assert.equal(reused.id, id);
  assert.equal(reused.reused, true);
  assert.equal(await f.submit('auto', '--fresh'), 0, '--fresh does not duplicate an active run');
  assert.equal(JSON.parse(f.outputs.pop()!).id, id);
  assert.deepEqual((await f.queue()).waiters.map(run => run.id), [id]);
  // A different head or mode must not alias the existing active submission.
  f.head('b'.repeat(40));
  await assert.rejects(f.submit(), /already has a suite/);
  f.head('a'.repeat(40));
  await assert.rejects(f.submit('hub'), /already has a suite/);
  f.hold(false);
  await f.clock.advance(1000);
  const run = await f.started.promise;
  assert.equal(run.id, id);
  assert.equal(await f.submit(), 0, 'running retries also reuse the id');
  assert.equal(JSON.parse(f.outputs.pop()!).id, id);
  f.receipts.set(id, { state: 'done', code: 1, finished: f.clock.now().toISOString() });
  await f.clock.advance(1000);
  await eventually('red terminal run', async () => ((await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus).suites?.find(run => run.id === id && run.reported));
  f.hold(true);
  assert.equal(await f.submit(), 0, 'a terminal red permits a new receipt');
  assert.notEqual(JSON.parse(f.outputs.pop()!).id, id);
});


test('verify never calls an unwritten request a sent submission', async t => {
  const f = await fixture(t, 'welcome');
  const pending = f.submit().then(() => undefined, error => error);
  const reply = await f.firstReply.promise;
  assert.equal(reply.frame.type, 'welcome');
  await f.cliClock.advance(15000);
  assert.match((await pending).message, /the hub did not answer/);
  assert.deepEqual(f.errors, []);
  assert.deepEqual((await f.queue()).waiters, []);
});

test('a dry-run timeout never claims a verification was submitted', async t => {
  const f = await fixture(t);
  const pending = f.submit('auto', '--dry-run').then(() => undefined, error => error);
  const reply = await f.firstReply.promise;
  assert.equal('ok' in reply.frame && reply.frame.ok, true, JSON.stringify(reply.frame));
  await f.cliClock.advance(15000);
  assert.match((await pending).message, /the hub did not answer/);
  assert.deepEqual(f.errors, []);
  assert.deepEqual((await f.queue()).waiters, []);
});

test('overlapping verify retries reserve one active run', async t => {
  const f = await fixture(t);
  const first = f.submit();
  const second = f.submit();
  const reply = await f.firstReply.promise;
  reply.release();
  assert.deepEqual(await Promise.all([first, second]), [0, 0]);
  const ids = f.outputs.map(output => JSON.parse(output).id);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  assert.deepEqual((await f.queue()).waiters.map(run => run.id), [ids[0]]);
});
