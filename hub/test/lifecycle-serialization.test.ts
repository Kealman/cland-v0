// T1: fake adapters and deferred dispatcher operations prove serialization and rollback without child processes or sockets.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test, { before, type TestContext } from 'node:test';
import { LaunchFiles } from '../src/adapters/launch-files.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { localHost } from '../src/host/local.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { createHubBase } from '../src/hub/server.ts';
import { parseRoles } from '../src/roles/config.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { lifecycleOwner, ownedCase } from './lifecycle-fixture-owner.ts';
import { ensureAccountFixture } from './account-fixture-env.ts';
import { waitTimeoutMs } from './until.ts';

// Worker admission can await a busy hub for up to 60 s. Complete it before
// starting the lifecycle cases' explicit 2 s behaviour deadline.
before(ensureAccountFixture, { timeout: waitTimeoutMs(75_000) });

type Scope = ReturnType<typeof lifecycleOwner>['scope'];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(t: TestContext, log?: (entry: Record<string, unknown>) => void, processStarted?: (pid: number) => Promise<string | null>, afterTable?: (root: string, table: ProcessTable) => Promise<void>, afterSessions?: (root: string, sessions: Sessions) => Promise<void>) {
  const { scope, step } = lifecycleOwner(t);
  let hub: ReturnType<typeof createHubBase> | undefined;
  let table: ProcessTable | undefined;
  let sessions: Sessions | undefined;
  let tableClosed = false, hubClosed = false;
  // Register before acquisition, capturing each owner as soon as it exists.
  // A failed writer close retains storage, root and guard for a repaired retry.
  scope.requireClose(async () => {
    await sessions?.close();
    if (table && !tableClosed) { table.close(); tableClosed = true; }
    if (hub && !hubClosed) { await hub.close(); hubClosed = true; }
  });
  const root = await step(async () => {
    const root = await tempProject(scope.fixtures);
    scope.adoptRoot(root);
    return root;
  });
  let roles = parseRoles('[coordinator.launch]\nharness = "test"\n');
  const clock = new FakeClock();
  await step(async () => {
    hub = createHubBase({ clock, secret: 'test', roles: { get: () => roles } });
    table = new ProcessTable(':memory:', clock);
    await afterTable?.(root, table);
  });
  const acquiredHub = hub!, acquiredTable = table!;
  await step(async () => {
    sessions = new Sessions({ core: acquiredHub.core, table: acquiredTable, root, env: fixtureEnvironment(root, {}), ...(log ? { log } : {}), ...(processStarted ? { hosts: [{ ...localHost(), identity: async pid => ({ pid, pidStarted: await processStarted(pid), pidIdentity: null }) }] } : {}) });
    await afterSessions?.(root, sessions);
  });
  const acquiredSessions = sessions!;
  const p = { name: 'impl', harness: 'test', role: null, model: null, cwd: root, pid: null, pidStarted: null, harnessId: null, sessionId: 'stable-id', harnessSessionId: 'conversation', startedAt: '', status: 'stopped' as const };
  acquiredTable.put(p);
  acquiredSessions.register({
    harness: 'test',
    capabilities: { terminal: 'none', history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
    spawn: async r => ({ ...p, ...r, sessionId: 'replacement', harness: 'test', status: 'running' }),
    resume: async r => ({ found: true, process: { ...r, status: 'running' }, state: 'unknown' }),
    stop: async () => {}, attachCommand: () => '', watch: () => {}, inject: async () => {}, confirm: () => {}, interpret: () => ({}), close: () => {},
  });
  return { root, table: acquiredTable, sessions: acquiredSessions, hub: acquiredHub, revokeStop: () => { roles = parseRoles('[coordinator.launch]\nharness = "test"\n[coordinator.permissions]\ntools = []\n'); } };
}

for (const acquired of ['table', 'Sessions'] as const) for (const rejectedClose of [false, true]) test(`lifecycle fixture cancellation retains acquired ${acquired} until ${rejectedClose ? 'repaired' : 'confirmed'} close`, ownedCase(async t => {
  const { scope: supervisor } = lifecycleOwner(t);
  const abort = new AbortController();
  const hooks: Array<() => unknown> = [];
  const controlled = { name: 'controlled lifecycle cancellation', signal: abort.signal, after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
  const dispose = async () => { for (const hook of hooks) await hook(); };
  const entered = Promise.withResolvers<{ root: string; scope: Scope }>();
  const release = deferred();
  let refuse = rejectedClose, closed = false;
  const outerBoundary = supervisor.nativeBoundary();
  supervisor.releaseOnClose(() => { refuse = false; release.resolve(); });
  supervisor.requireClose(async () => { refuse = false; release.resolve(); await running.catch(() => {}); await dispose(); });
  const running = ownedCase(async inner => {
    const { scope } = lifecycleOwner(inner);
    const hold = async (root: string, resource: { close: () => void | Promise<void> }) => {
      const close = resource.close.bind(resource);
      scope.patch(resource, 'close', () => {
        if (refuse) throw new Error('controlled lifecycle resource close rejected');
        const result = close();
        if (result) return result.then(() => { closed = true; });
        closed = true;
      });
      entered.resolve({ root, scope });
      await release.promise;
      throw new Error('controlled partial acquisition failure');
    };
    await fixture(inner, undefined, undefined, acquired === 'table' ? hold : undefined, acquired === 'Sessions' ? hold : undefined);
  })(controlled);
  const rejected = assert.rejects(running, /controlled partial acquisition failure/);
  const { root, scope } = await supervisor.wait('partial acquisition entered', () => entered.promise);
  const heldBoundary = scope.nativeBoundary();
  abort.abort(new Error('controlled fixture abort'));
  assert.equal((await stat(root)).isDirectory(), true);
  assert.equal(scope.nativeBoundary(), heldBoundary);
  assert.equal(closed, false, 'the held original acquisition has not closed');
  await assert.rejects(scope.restore(), /resource close unconfirmed/);
  release.resolve();
  await rejected;
  if (rejectedClose) {
    await assert.rejects(dispose(), /controlled lifecycle resource close rejected/);
    await assert.rejects(scope.restore(), /resource close unconfirmed/);
    assert.equal((await stat(root)).isDirectory(), true, 'real guarded cleanup retains the root after rejected close');
    assert.equal(scope.nativeBoundary(), heldBoundary);
    assert.equal(closed, false);
    refuse = false;
  }
  await dispose();
  assert.equal(closed, true, 'resource close returned positively');
  await assert.rejects(stat(root), { code: 'ENOENT' });
  assert.equal(scope.nativeBoundary(), outerBoundary, 'guard restored only after original work and resources closed');
}));

for (const outcome of ['found', 'alive', 'identity'] as const) test(`shutdown drains a held ${outcome} resume without restarting supervision or publishing its result`, { timeout: 2000 }, ownedCase(async t => {
  const entered = deferred(), gate = deferred(), closed = deferred();
  t.after(() => gate.resolve()); // Release before fixture cleanup even if setup hits the test bound.
  const records: Array<Record<string, unknown>> = [];
  const f = await fixture(t, entry => records.push(entry), async () => {
    entered.resolve(); await gate.promise; return 'fixture-start';
  });
  const before = { ...f.table.get('impl')!, status: 'running' as const };
  f.table.put(before);
  let watches = 0;
  f.sessions.register({ ...f.sessions.adapter('test'),
    resume: async p => {
      if (outcome !== 'identity') { entered.resolve(); await gate.promise; }
      return outcome === 'alive' ? { found: false, alive: true, reason: 'native discovery unavailable' }
        : { found: true, process: { ...p, ...(outcome === 'identity' ? { pid: 91001 } : {}), model: 'late-model' }, state: 'idle' };
    },
    watch: () => { watches++; },
    close: () => closed.resolve(),
  });
  // Observe the result immediately, including a shutdown rejection, so no native
  // completion or failing assertion can strand the lifecycle drain in cleanup.
  const result = f.sessions.resume('impl').then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  let closing: void | Promise<void>;
  try {
    await entered.promise;
    closing = f.sessions.close();
    await closed.promise; // Adapter closure, not elapsed time, releases the late completion.
    gate.resolve();
    const answer = await result;
    await closing;
    assert.match(String(answer.error), /the hub is closing/);
    assert.equal(watches, 0, 'a closed adapter cannot be asked to watch again');
    assert.deepEqual(f.table.get('impl'), before, 'the late resume cannot replace the persisted process');
    assert.equal(records.some(entry => ['session-launched', 'session-resumed', 'session-resume-unavailable'].includes(String(entry.event))), false);
    assert.equal(f.sessions.lifecyclePending(), false, 'the held operation actually drained');
  } finally {
    gate.resolve();
    await result;
    await f.sessions.close();
  }
}));

test('a delayed failing relaunch cannot undo another relaunch that commits to the same files', ownedCase(async t => {
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
}));

test('renaming a session does not create a second lifecycle slot', ownedCase(async t => {
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
}));

test('launch waits behind an existing identity and rechecks a successful resume before replacing its row', ownedCase(async t => {
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
}));

test('a stop queued behind relaunch reads the replacement process after admission', ownedCase(async t => {
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
}));

test('a Coordinator CLI stop queued behind relaunch rechecks a revoked grant before stopping the replacement', ownedCase(async t => {
  const f = await fixture(t);
  const entered = deferred(), gate = deferred();
  t.after(() => gate.resolve());
  let stops = 0;
  f.sessions.register({ ...f.sessions.adapter('test'), stop: async () => { stops++; }, resume: async p => {
    entered.resolve(); await gate.promise;
    return { found: true, process: { ...p, harnessSessionId: 'replacement', status: 'running' }, state: 'unknown' };
  } });
  f.hub.core.assignRole('coord', 'coordinator');
  const credential = randomUUID();
  f.hub.core.store.rememberSessionCredential('unknown', credential);
  f.hub.dispatcher.useSessions(f.sessions);
  const answers: Array<Record<string, unknown>> = [];
  const completion = Promise.withResolvers<Record<string, unknown>>();
  const cli = f.hub.dispatcher.open({ send: frame => { answers.push(frame); if ('id' in frame && frame.id === 'stop') completion.resolve(frame); }, close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => cli.closed());
  cli.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
  const resume = f.sessions.resume('impl', true); await entered.promise;
  cli.receive(JSON.stringify({ type: 'session.stop', id: 'stop', session: 'impl', as: { name: 'coord', credential } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stops, 0);
  assert.equal(answers.some(frame => frame.id === 'stop'), false, 'the granted request waits in the lifecycle queue');
  f.revokeStop(); gate.resolve(); await resume;
  const answer = await completion.promise;
  assert.equal(answer.code, 'forbidden', JSON.stringify(answer));
  assert.equal(stops, 0);
  assert.equal(f.table.get('impl')?.harnessSessionId, 'replacement');
  assert.equal(f.table.get('impl')?.status, 'running');
  assert.equal(f.sessions.lifecyclePending(), false);
}));

test('stop publication and lifecycle slot release share one resumed scope', ownedCase(async t => {
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
}));
