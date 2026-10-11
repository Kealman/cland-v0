import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { parseRoles, type RolesSource } from '../src/roles/config.ts';
import { createHubBase } from '../src/hub/server.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { eventually, tempProject } from './harness.ts';
import { defaultCrew } from '../src/crew.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { TaskWorktrees } from '../src/hub/worktrees.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(t: TestContext, fresh: NonNullable<RolesSource['fresh']>, exclusive = true, log?: (entry: Record<string, unknown>) => void, requestGuard?: RequestGuard) {
  const root = await tempProject(t);
  const definitions = (exclusive: boolean) => parseRoles(`[coordinator]\nexclusive = ${exclusive}\n[coordinator.launch]\nharness = "test"\n`);
  let config = definitions(exclusive);
  const hub = createHubBase({ secret: 'test', roles: { get: () => config, fresh }, ...(log ? { log } : {}), ...(requestGuard ? { requestGuard } : {}) });
  t.after(() => hub.close());
  const table = new ProcessTable();
  const sessions = new Sessions({ core: hub.core, table, root });
  t.after(() => { sessions.close(); table.close(); });
  const starts: string[] = [];
  sessions.register({
    harness: 'test',
    capabilities: { history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
    spawn: async r => {
      starts.push(r.name);
      return { name: r.name, harness: 'test', role: r.role, model: r.model, cwd: r.cwd, pid: null, harnessId: null, sessionId: r.name, harnessSessionId: null, startedAt: '', status: 'running' };
    },
    resume: async p => ({ found: true, process: p, state: 'idle' }),
    stop: async () => {}, attachCommand: () => '', watch: () => {}, inject: async () => {}, confirm: () => {}, interpret: () => ({}), close: () => {},
  });
  hub.dispatcher.useSessions(sessions);
  return { root, hub, core: hub.core, sessions, table, starts, setExclusive: (exclusive: boolean) => { config = definitions(exclusive); } };
}

test('crew admission and merge-stop continuations remain measured after lifecycle awaits', async t => {
  const crew = defaultCrew();
  const root = await tempProject(t);
  const hub = createHubBase({ secret: 'test', crew: { get: () => crew, set: async () => crew } });
  const core = hub.core;
  const table = new ProcessTable();
  const sessions = new Sessions({ core, table, root });
  t.after(async () => { sessions.close(); table.close(); await hub.close(); });
  sessions.register({
    harness: 'test',
    capabilities: { history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
    spawn: async () => { throw new Error('test spawn refused'); },
    resume: async p => ({ found: true, process: p, state: 'idle' }),
    stop: async () => {}, attachCommand: () => '', watch: () => {}, inject: async () => {}, confirm: () => {}, interpret: () => ({}), close: () => {},
  });
  let depth = 0;
  const resumed = <T,>(work: () => T): T => {
    depth++;
    try { return work(); } finally { depth--; }
  };
  const measurements: boolean[] = [];
  const presence = core.presence.bind(core);
  t.mock.method(core, 'presence', () => { measurements.push(depth > 0); return presence(); });
  await assert.rejects(resumed(() => sessions.launch({ name: 'qa-probe', role: 'qa', cwd: 'missing' }, resumed)), /directory/);
  assert.ok(measurements.length > 0);
  assert.ok(measurements.every(Boolean), 'every crew presence scan belongs to a measured synchronous stretch');
  const tracker = new Tracker({ root, db: ':memory:' });
  t.after(() => tracker.stop());
  const item = await tracker.create({ id: 'human', name: 'human', role: null }, { title: 'Review container', kind: 'epic' });
  const worktrees = new TaskWorktrees({ tracker });
  const candidateScans: boolean[] = [];
  const poolRunning = table.running.bind(table);
  t.mock.method(table, 'running', () => { candidateScans.push(depth > 0); return poolRunning(); });
  await assert.rejects(resumed(() => worktrees.launch(sessions, { name: 'review-probe', role: 'reviewer', harness: 'test', item: item.id }, resumed)), /test spawn refused/);
  assert.ok(candidateScans.length > 0);
  assert.ok(candidateScans.every(Boolean), 'item-bound pool scans after worktree preparation are measured');
  t.mock.restoreAll();
  for (const name of ['first', 'second']) table.put({ name, harness: 'test', role: 'implementer', model: null, cwd: root, pid: null,
    harnessId: null, sessionId: name, harnessSessionId: null, startedAt: '', status: 'running', item: 'T-1' });
  const running = table.running.bind(table);
  t.mock.method(table, 'running', () => { assert.ok(depth > 0, 'merge-stop process scan is measured'); return running(); });
  const stop = sessions.stop.bind(sessions);
  const stopped: string[] = [];
  t.mock.method(sessions, 'stop', (...args: Parameters<typeof sessions.stop>) => {
    assert.ok(depth > 0, 'each stop initiation is measured, including after the previous stop await');
    stopped.push(args[0]);
    return stop(...args);
  });
  await sessions.stopAfterMerge('T-1', resumed);
  assert.deepEqual(stopped, ['first', 'second']);
  t.mock.restoreAll();
});

for (const operation of ['launch', 'role.set'] as const) {
  test(`${operation}: first admission wins when the fresh read makes the role exclusive`, async t => {
    const entered = deferred();
    const gate = deferred();
    t.after(() => gate.resolve());
    let reads = 0;
    const f = await fixture(t, async () => {
      if (++reads === 1) { entered.resolve(); await gate.promise; }
      else f.setExclusive(true);
    }, false);
    if (operation === 'launch') {
      const first = f.sessions.launch({ name: 'coord-1', role: 'coordinator' });
      const outcome = first.then(process => ({ process }), error => ({ error }));
      await entered.promise;
      try { await assert.rejects(f.sessions.launch({ name: 'coord-2', role: 'coordinator' }), /held by coord-1/); }
      finally { gate.resolve(); }
      assert.ok('process' in await outcome);
      assert.deepEqual(f.starts, ['coord-1']);
    } else {
      const answers: Array<Record<string, unknown>> = [];
      const conversation = f.hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
      t.after(() => conversation.closed());
      conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
      conversation.receive(JSON.stringify({ type: 'role.set', id: 'first', session: 'coord-1', role: 'coordinator' }));
      await entered.promise;
      conversation.receive(JSON.stringify({ type: 'role.set', id: 'second', session: 'coord-2', role: 'coordinator' }));
      try {
        const second = await eventually('second fresh assignment answered', () => answers.find(frame => frame.id === 'second'));
        assert.equal(second.ok, false, JSON.stringify(second));
        assert.match(String(second.error), /held by coord-1/);
      } finally { gate.resolve(); }
      const first = await eventually('first fresh assignment answered', () => answers.find(frame => frame.id === 'first'));
      assert.equal(first.ok, true, JSON.stringify(first));
      assert.equal(f.core.store.roleOf('coord-1'), 'coordinator');
      assert.equal(f.core.store.roleOf('coord-2'), null);
    }
  });
}

test('post-stat grant refusal and reservation rollback are one measured continuation', async t => {
  let clock = 0;
  const records: Array<Record<string, unknown>> = [];
  const { sessions } = await fixture(t, async () => {}, true, entry => {
    if (entry.event === 'role-admission-released') clock += 150;
  });
  const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
  let checks = 0;
  await assert.rejects(sessions.launch({ name: 'coord', role: 'coordinator' }, guard.resumer('session.launch', 'test'), () => {
    if (++checks === 3) { clock += 150; throw new Error('grant revoked after stat'); }
  }), /grant revoked/);
  assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['session.launch', 'resumed', 300]]);
});

test('a pending admission refusal names the earlier request and tells the caller to retry', async t => {
  const { core } = await fixture(t, async () => {});
  const first = core.admitRole('coord-1', 'coordinator');
  try {
    assert.throws(() => core.admitRole('coord-2', 'coordinator'), {
      message: 'role "coordinator" is held by coord-1 [Coordinator] (admission pending): the earlier request is still pending — retry after it finishes',
    });
    assert.equal(core.store.roleOf('coord-1'), null, 'a ticket reserves admission without granting the role');
  } finally { first.release(); }
  const retry = core.admitRole('coord-2', 'coordinator');
  retry.release();
});

test('admission tickets let concurrent launches proceed when the fresh role remains nonexclusive', async t => {
  const entered = deferred();
  const gate = deferred();
  t.after(() => gate.resolve());
  let reads = 0;
  const { sessions, starts } = await fixture(t, async () => {
    if (++reads === 1) { entered.resolve(); await gate.promise; }
  }, false);
  const first = sessions.launch({ name: 'one', role: 'coordinator' });
  const outcome = first.then(process => ({ process }), error => ({ error }));
  await entered.promise;
  try {
    assert.equal((await sessions.launch({ name: 'two', role: 'coordinator' })).name, 'two');
    assert.deepEqual(starts, ['two']);
  } finally { gate.resolve(); }
  assert.ok('process' in await outcome);
  assert.deepEqual(starts, ['two', 'one']);
});

test('the first admitted exclusive role.set wins while its fresh read is deferred', async t => {
  const entered = deferred();
  const gate = deferred();
  t.after(() => gate.resolve());
  let reads = 0;
  const { hub, core } = await fixture(t, async () => {
    if (++reads === 1) { entered.resolve(); await gate.promise; }
  });
  const answers: Array<Record<string, unknown>> = [];
  const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
  conversation.receive(JSON.stringify({ type: 'role.set', id: 'first', session: 'coord-1', role: 'coordinator' }));
  await entered.promise;
  conversation.receive(JSON.stringify({ type: 'role.set', id: 'second', session: 'coord-2', role: 'coordinator' }));
  try {
    const second = await eventually('second assignment answered while first waits', () => answers.find(frame => frame.id === 'second'));
    assert.equal(second.ok, false, JSON.stringify(second));
    assert.match(String(second.error), /held by coord-1/);
    assert.equal(core.store.roleOf('coord-1'), null, 'the role is not published before its fresh read');
    assert.throws(() => core.reserveLaunchRole('other', 'coordinator'), /held by coord-1/);
  } finally { gate.resolve(); }
  const first = await eventually('first assignment answered', () => answers.find(frame => frame.id === 'first'));
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(core.store.roleOf('coord-1'), 'coordinator');
  assert.equal(core.store.roleOf('coord-2'), null);
});

test('a role.set whose fresh read fails releases admission without changing the prior role', async t => {
  const { hub, core } = await fixture(t, async () => { throw new Error('fresh read failed'); });
  core.assignRole('target', 'implementer');
  const answers: Array<Record<string, unknown>> = [];
  const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
  conversation.receive(JSON.stringify({ type: 'role.set', id: 'failed', session: 'target', role: 'coordinator' }));
  const failed = await eventually('failed assignment answered', () => answers.find(frame => frame.id === 'failed'));
  assert.equal(failed.ok, false);
  assert.match(String(failed.error), /fresh read failed/);
  assert.equal(core.store.roleOf('target'), 'implementer');
  assert.equal(core.assignRole('next', 'coordinator').role, 'coordinator');
});

test('a role.set move refused after the fresh read releases admission and preserves the holder', async t => {
  const { hub, core } = await fixture(t, async () => {});
  core.assignRole('old', 'coordinator');
  const answers: Array<Record<string, unknown>> = [];
  const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
  conversation.receive(JSON.stringify({ type: 'role.set', id: 'failed', session: 'target', role: 'coordinator', note: {} }));
  const failed = await eventually('refused move answered', () => answers.find(frame => frame.id === 'failed'));
  assert.equal(failed.ok, false, JSON.stringify(failed));
  assert.equal(core.store.roleOf('old'), 'coordinator');
  assert.equal(core.store.roleOf('target'), null);
  core.clearRole('old');
  assert.equal(core.assignRole('next', 'coordinator').role, 'coordinator');
});

test('the first admitted exclusive-role launch wins while its fresh roles read is deferred', async t => {
  const entered = deferred();
  const gate = deferred();
  t.after(() => gate.resolve());
  let reads = 0;
  const { core, sessions, starts } = await fixture(t, async () => {
    if (++reads === 1) { entered.resolve(); await gate.promise; }
  });
  const first = sessions.launch({ name: 'coord-1', role: 'coordinator' });
  // Attach the handler before testing the competing launch, including on unfixed code.
  const outcome = first.then(process => ({ process }), error => ({ error }));
  await entered.promise;
  await assert.rejects(sessions.launch({ name: 'coord-1', role: 'implementer' }), /is being launched/);
  const second = sessions.launch({ name: 'coord-2', role: 'coordinator' });
  const refused = assert.rejects(second, /role "coordinator" is held by coord-1/);
  try {
    await refused;
    assert.throws(() => core.assignRole('other', 'coordinator'), /held by coord-1/);
    assert.deepEqual(starts, [], 'the reservation precedes any spawn');
  } finally { gate.resolve(); }
  const result = await outcome;
  assert.ok('process' in result, 'the first launch must succeed');
  assert.deepEqual(starts, ['coord-1']);
  assert.deepEqual(core.store.reservations(), []);
});

for (const failure of ['fresh read', 'bad cwd', 'spawn'] as const) {
  test(`a launch failing at ${failure} releases its admission reservation`, async t => {
    let fail = true;
    const { core, sessions, root } = await fixture(t, async () => {
      if (failure === 'fresh read' && fail) throw new Error('fresh read failed');
    });
    if (failure === 'spawn') sessions.register({ ...sessions.adapter('test'), spawn: async () => { throw new Error('spawn failed'); } });
    await assert.rejects(sessions.launch({ name: 'failed', role: 'coordinator', ...(failure === 'bad cwd' ? { cwd: join(root, 'absent') } : {}) }), /failed|not an accessible directory/);
    assert.equal(core.store.roleOf('failed'), null);
    assert.deepEqual(core.store.reservations(), []);
    assert.equal(sessions.lifecyclePending(), false);
    fail = false;
    assert.equal(core.assignRole('next', 'coordinator').role, 'coordinator');
  });
}


test('cwd resolution and stat initiation share one resumed scope', async t => {
  let clock = 0;
  const records: Array<Record<string, unknown>> = [];
  const { sessions } = await fixture(t, async () => {});
  const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
  const native = fsp.stat;
  t.mock.method(fsp, 'stat', (...args: Parameters<typeof native>) => { clock += 150; return Reflect.apply(native, fsp, args); });
  syncBuiltinESMExports();
  try {
    await sessions.launch({ name: 'coord', role: 'coordinator', get cwd() { clock += 150; return '.'; } }, guard.resumer('session.launch', 'test'));
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['session.launch', 'resumed', 300]]);
});

test('role assignment refusal, error conversion and admission release share one resumed scope', async t => {
  let clock = 0;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
  const { hub, core } = await fixture(t, async () => {}, true, undefined, guard);
  const error = new Error('assignment refused');
  Object.defineProperty(error, 'message', { get() { clock += 150; return 'assignment refused'; } });
  t.mock.method(core, 'assignRole', () => { clock += 150; throw error; });
  const answers: Array<Record<string, unknown>> = [];
  const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
  conversation.receive(JSON.stringify({ type: 'role.set', id: 'failed', session: 'target', role: 'coordinator' }));
  const answer = await eventually('refusal answered', () => answers.find(frame => frame.id === 'failed'));
  assert.equal(answer.ok, false);
  assert.equal(answer.error, 'assignment refused');
  assert.deepEqual(core.store.reservations(), []);
  assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['role.set', 'resumed', 300]]);
});

test('post-fresh authorization and cwd/stat initiation share one resumed scope', async t => {
  let clock = 0;
  const records: Array<Record<string, unknown>> = [];
  const { sessions } = await fixture(t, async () => {});
  const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
  let authorizations = 0;
  await sessions.launch({ name: 'coord', role: 'coordinator', get cwd() { clock += 150; return '.'; } }, guard.resumer('session.launch', 'test'), () => {
    if (++authorizations === 2) clock += 150;
  });
  assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['session.launch', 'resumed', 300]]);
});
