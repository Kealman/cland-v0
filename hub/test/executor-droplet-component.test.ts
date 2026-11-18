// T2: executor permissions through the dispatcher, with no hub or spoke process.
import { sessionDispatcherUi as dispatcherUi } from './session-credential-fixture.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { frameClient, projectHub, tempProject } from './harness.ts';
import { afterCleanup, onCleanup, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';

import { Machine } from '../src/executor/droplet/machine.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { caseDeadlines, drainFixtureWork } from './case-deadlines.ts';
import type { FixtureStep } from '../../test-support/fixture-work.ts';
import type { LogEntry } from '../src/log.ts';
import { DigitalOceanApi, DigitalOceanError } from '../src/executor/droplet/api.ts';
import { readLease, readLeases, writeLease, leaseDir, type DropletLease } from '../src/executor/droplet/lease.ts';
import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { compactLeaseHistory, spendPath } from '../src/executor/droplet/spend.ts';
import { maintainProjectGit, gitMaintenancePath } from '../src/git-maintenance.ts';
import type { Provider } from '../src/executor/droplet/dependencies.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { runInNewContext } from 'node:vm';
import { noSyncFilesystem } from './no-sync-filesystem.ts';
import { recoverPoolSnapshots } from '../src/executor/droplet/snapshot-recovery.ts';

/** Whole caller and fixture teardown finish before the positive guard restores. */
function guardedLeaseCase(t: TestContext) {
  const scope = caseDeadlines(t, { timeoutMs: 5000, ownership: { beforeDirectories, guardDirectoryRemoval } });
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restore: (() => void) | undefined;
  afterCleanup(t, async () => {
    await drainFixtureWork();
    try { guard?.verify(); } finally { restore?.(); }
  });
  return { ...scope, run: (body: (step: FixtureStep) => Promise<void>) => scope.run(async step => {
    guard = await step(() => scope.wait('native guard setup', () => fakeNativeGuard(fn => { restore = fn; })));
    await body(step);
  }) };
}

test('absent pool recovery requests no lazy module inside the synchronous filesystem trap', async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    const root = await step(() => scope.wait('empty recovery fixture setup', async () => {
      const root = await fs.mkdtemp(join(tmpdir(), 'cland-empty-pool-'));
      scope.adoptRoot(root);
      scope.fixtures.after(() => fs.rm(root, { recursive: true, force: true }));
      return root;
    }));
    const requests: string[] = [];
    const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
      if (specifier.endsWith('/pool-image.ts')) requests.push(`${context.parentURL} -> ${specifier}`);
      return nextResolve(specifier, context);
    } });
    let guard: ReturnType<typeof noSyncFilesystem> | undefined, work: Promise<void> | undefined;
    try {
      await step(() => scope.wait('loader observer positive control', () => import('../src/host/provider/pool-image.ts')));
      assert.equal(requests.length, 1, 'observer sees an explicit pool-image import');
      requests.length = 0;
      const api = new Proxy({} as Provider, { get: () => () => assert.fail('provider call without a recovery record') });
      guard = noSyncFilesystem(t);
      work = recoverPoolSnapshots(root, () => {}, fixtureEnvironment(root, process.env), api);
      await step(() => scope.wait('absent pool recovery completion', () => work!));
      assert.deepEqual(requests, [], 'no import is requested before positive recovery discovery');
      assert.deepEqual(guard.calls, []);
    } finally {
      await work?.catch(() => {});
      guard?.restore(); hooks.deregister();
    }
  });
});

for (const restart of [true, false]) test(`executor close joins held index publication (startup: ${restart})`, async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    const f = await step(() => scope.wait('held index fixture setup', async () => {
      const root = await fs.mkdtemp(join(tmpdir(), 'cland-index-close-'));
      scope.adoptRoot(root);
      let executor: DropletExecutor | undefined;
      scope.fixtures.after(async () => { await executor?.close(); await fs.rm(root, { recursive: true, force: true }); });
      let closed = false;
      const meta = new Map<string, string>();
      const store = { meta: (key: string) => meta.get(key) ?? null, setMeta: (key: string, value: string) => {
        assert.equal(closed, false, 'index publication precedes storage close'); meta.set(key, value);
      } } as unknown as ConstructorParameters<typeof DropletExecutor>[1];
      const api = new Proxy({} as Provider, { get: () => () => assert.fail('provider call in empty index recovery') });
      executor = new DropletExecutor(root, store, () => {}, fixtureEnvironment(root, process.env), undefined, { api, clock: new FakeClock() });
      if (!restart) await executor.reconcile(true);
      return { root, executor, closeStorage: () => { closed = true; } };
    }));
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
    const nativeRename = fs.rename;
    const fault = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
      if (String(args[1]) === join(f.executor.root, '.cland/run/executor/lease-index.json')) { entered.resolve(); await release.promise; }
      return nativeRename(...args);
    });
    syncBuiltinESMExports();
    let recovery: Promise<void> | undefined, closing: Promise<void> | undefined;
    const order: string[] = [];
    try {
      await step(() => scope.wait('held recovery and close receipts', async () => {
        recovery = f.executor.reconcile(restart).then(() => { order.push('reconciled'); });
        await Promise.race([entered.promise, recovery.then(() => { throw new Error('recovery completed without held index publication'); })]);
        closing = f.executor.close().then(() => { order.push('closed'); f.closeStorage(); });
        release.resolve();
        await Promise.all([recovery, closing]);
      }));
      assert.deepEqual(order, ['reconciled', 'closed']);
      assert.deepEqual(JSON.parse(await step(() => fs.readFile(join(f.root, '.cland/run/executor/lease-index.json'), 'utf8'))), { version: 1, leases: [] });
    } finally {
      release.resolve();
      await Promise.allSettled([recovery, closing]);
      fault.mock.restore(); syncBuiltinESMExports();
    }
  });
});

for (const disk of ['incomplete', 'absent'] as const) test(`maintenance grace after repair retains ${disk} lease records`, async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    const root = await step(() => scope.wait('policy fixture setup', async () => {
      const root = await fs.mkdtemp(join(tmpdir(), 'cland-repair-policy-'));
      scope.adoptRoot(root);
      scope.fixtures.after(() => fs.rm(root, { recursive: true, force: true }));
      await fs.mkdir(join(root, '.git'));
      await fs.mkdir(join(root, '.cland/run/executor/leases', ...(disk === 'incomplete' ? ['held'] : [])), { recursive: true });
      if (disk === 'absent') await fs.writeFile(join(root, '.cland/run/executor/lease-index.json'), '{"version":1,"leases":["held"]}');
      return root;
    }));
    const events: Record<string, unknown>[] = [], commands: string[][] = [];
    const env = fixtureEnvironment(root, process.env);
    await step(() => scope.wait('index repair', () => compactLeaseHistory(root, env, event => events.push(event), true)));
    assert.ok(events.some(event => event.event === 'executor-lease-record-missing' && event.lease === 'held'));
    await step(() => scope.wait('maintenance decision', () => maintainProjectGit(root, () => null, env, {
      lock: async (_root, operation) => operation(),
      run: async (_bin, args) => { commands.push([...args]); return { code: 0, stdout: '', stderr: '' }; },
    })));
    const gc = commands.filter(args => args.includes('gc'));
    assert.equal(gc.length, 1, 'maintenance reached its injected command boundary');
    assert.ok(gc[0]!.includes('--cruft')); assert.ok(gc[0]!.includes('--prune=never'));
    assert.equal(JSON.parse(await step(() => fs.readFile(gitMaintenancePath(root), 'utf8'))).expire, 'never');
  });
});

for (const alreadyReleased of [false, true]) test(`confirmed release accounting survives compaction failure (already released: ${alreadyReleased})`, async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    const f = await step(() => scope.wait('release fixture setup', async () => {
      const root = await fs.mkdtemp(join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), 'cland-release-receipt-'));
      let executor: DropletExecutor | undefined;
      scope.adoptRoot(root); scope.fixtures.after(async () => { await executor?.close(); await fs.rm(root, { recursive: true, force: true }); });
      const env = fixtureEnvironment(root, process.env), clock = new FakeClock();
      const created = clock.now().toISOString(), expected = { lifetimeMs: alreadyReleased ? 1234 : 0, costUsd: alreadyReleased ? 0.5 : 1 / 60 };
      const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: 'owned', run: 'run', name: 'owned', tags: ['cland'], size: 'fixture', region: 'fixture', priceHourly: 1, keyName: 'owned', state: alreadyReleased ? 'released' : 'active', resource: 42, keyId: null, created, createStarted: created, deadline: new Date(clock.now().getTime() + 60000).toISOString(), ...(alreadyReleased ? { released: created, ...expected } : {}) };
      await writeLease(root, lease);
      await fs.writeFile(join(root, '.cland/run/executor/lease-index.json'), '{"version":1,"leases":["owned"]}');
      await fs.mkdir(dirname(spendPath(env)), { recursive: true });
      await fs.writeFile(spendPath(env), JSON.stringify({ version: 1, legacyRetired: true, entries: [{ project: root, lease: lease.lease, run: lease.run, size: lease.size, reservation: 1, cost: alreadyReleased ? expected.costUsd : null, created, deadline: lease.deadline, ...(alreadyReleased ? { released: created } : {}) }] }));
      let absenceReads = 0;
      const api = { droplets: async () => [], keys: async () => [], droplet: async (id: number) => { assert.equal(id, 42); absenceReads++; throw new DigitalOceanError(404, 'not_found', 'fixture absent'); } } as unknown as Provider;
      const events: Record<string, unknown>[] = [];
      executor = new DropletExecutor(root, undefined, event => events.push(event), env, undefined, { clock, api,
        processes: { alive: () => true, started: () => null },
        host: { createKey: async () => assert.fail('unexpected key creation'), armWatchdog: async () => { throw new Error('unexpected watchdog'); }, stopWatchdog: async () => {}, watchdogAlive: async () => false },
      });
      return { root, env, lease, executor, expected, events, absenceReads: () => absenceReads };
    }));
    const rename = fs.rename;
    const fault = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
      if (String(args[1]).endsWith('/lease-index.json')) throw new Error('fixture compaction publication failed');
      return rename(...args);
    });
    syncBuiltinESMExports();
    let releaseWork: ReturnType<DropletExecutor['release']> | undefined;
    try {
      const result = await step(() => scope.wait('confirmed release', () => {
        releaseWork = f.executor.release(f.lease); return releaseWork;
      }));
      assert.deepEqual(result, f.expected);
      const durable = await step(() => readLease(leaseDir(f.root, f.lease)));
      assert.equal(durable.state, 'released'); assert.equal(durable.costUsd, f.expected.costUsd);
      const ledger = JSON.parse(await step(() => fs.readFile(spendPath(f.env), 'utf8')));
      assert.equal(ledger.entries.find((entry: { lease: string }) => entry.lease === f.lease.lease).cost, f.expected.costUsd);
      assert.ok((await step(() => readLeases(f.root))).some(lease => lease.lease === f.lease.lease), 'failed maintenance retains hot recovery membership');
      assert.ok(f.events.some(event => event.event === 'executor-lease-maintenance-deferred' && event.lease === f.lease.lease));
      assert.equal(f.events.some(event => event.event === 'executor-release-unconfirmed'), false);
      assert.equal(f.absenceReads() > 0, !alreadyReleased);
    } finally {
      // A bounded wait may reject before its original owner has settled.
      await releaseWork?.catch(() => {});
      fault.mock.restore(); syncBuiltinESMExports();
    }
  });
});

test('uploaded status bounds cause ingestion and keeps the recorded exit through receipt failures', async t => {
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restoreGuard: (() => void) | undefined;
  t.after(() => { try { guard?.verify(); } finally { t.mock.restoreAll(); restoreGuard?.(); } });
  guard = await fakeNativeGuard(restore => { restoreGuard = restore; });
  const { runStatusProgram } = await import('../src/executor/droplet/run.ts');
  for (const mode of ['valid', 'oversize', 'read failure', 'close failure', 'missing', 'green read failure']) {
    const cause = 'suite infrastructure: ticket lost';
    const content = Buffer.from(cause + (mode === 'oversize' ? 'x'.repeat(100000) : ''));
    let retained = 0;
    let closed = 0;
    const rows: Array<{ code: number; cause: string; state: string }> = [];
    const fakeFs = {
      existsSync: (path: string) => !path.endsWith('/platform'),
      readFileSync: (path: string) => {
        if (path.endsWith('/done')) return '2026-11-17T00:00:00Z';
        if (path.endsWith('/exit')) return mode === 'green read failure' ? '0' : '75';
        assert.fail('whole cause read forbidden');
      },
      openSync: () => { if (mode === 'missing') throw Object.assign(new Error('absent'), { code: 'ENOENT' }); return 9; },
      readSync: (_fd: number, bytes: Buffer, offset: number, length: number, position: number) => {
        if (mode.endsWith('read failure')) throw new Error('read denied');
        const chunk = content.subarray(position, position + Math.min(length, 37));
        chunk.copy(bytes, offset); retained += chunk.length;
        assert.ok(retained <= 4097, 'payload plus one oversize sentinel');
        return chunk.length;
      },
      closeSync: () => { closed++; if (mode === 'close failure') throw new Error('close denied'); },
    };
    runInNewContext(runStatusProgram(), {
      Buffer, require: (name: string) => { assert.equal(name, 'fs'); return fakeFs; },
      process: { argv: ['node', '/receipt'], kill: () => assert.fail('unexpected native signal') },
      console: { log: (text: string) => rows.push(JSON.parse(text)) },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.state, 'done');
    assert.equal(rows[0]!.code, mode === 'green read failure' ? 0 : 75);
    assert.equal(closed, mode === 'missing' ? 0 : 1);
    if (mode === 'valid') assert.equal(rows[0]!.cause, cause);
    else if (mode === 'missing') assert.equal(rows[0]!.cause, '');
    else if (mode === 'close failure') assert.match(rows[0]!.cause, /^suite infrastructure:.*secondary diagnostic:.*close denied/);
    else assert.match(rows[0]!.cause, /secondary diagnostic:.*(?:exceeds 4096 bytes|read denied)/);
  }
});


test('executor CLI controls respect each caller role', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root, { DIGITALOCEAN_TOKEN: '' }, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const ui = await dispatcherUi(t, hub.dispatcher, root);
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer'], ['rev', 'reviewer'], ['qa-one', 'qa']] as const) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    let receive = (_line: string) => {};
    let open = true;
    const conversation = hub.dispatcher.open({ send: frame => receive(`${JSON.stringify(frame)}\n`), close: () => { open = false; }, isOpen: () => open }, { authenticated: true, edge: 'socket' });
    const peer = frameClient(line => conversation.receive(line.trimEnd()), fn => { receive = fn; }, () => { if (open) { open = false; conversation.closed(); } }, root);
    onCleanup(t, () => peer.close());
    peer.send({ type: 'hello', protocol: 2, name, sessionId: `${name}-id`, cwd: root });
    await peer.waitFor(frame => frame.type === 'welcome');
    const clause = await peer.waitFor(frame => frame.type === 'role');
    peer.send({ type: 'ack', id: clause.id });
    for (const sub of ['status', 'reap']) {
      const result = await ui.request({ type: `executor.${sub}`, as: { name, sessionId: `${name}-id`, shell: true } });
      if (role === 'coordinator') {
        assert.equal(result.ok, sub === 'status', result.error);
        assert.doesNotMatch(result.error ?? '', /forbidden/);
      } else {
        assert.equal(result.ok, false);
        assert.match(result.error!, new RegExp(`forbidden.*executor\\.${sub}`));
      }
    }
    peer.close();
  }
});

// Observe production status through Machine's native-execute seam: no SSH process,
// network, account lookup or machine service is touched.

async function statusCase(t: import('node:test').TestContext, work: (root: string, step: FixtureStep, fixtures: import('node:test').TestContext) => Promise<void>) {
  const owner = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return owner.run(async step => {
    const root = await step(() => tempProject(owner.fixtures));
    owner.adoptRoot(root);
    await work(root, step, owner.fixtures);
  });
}

async function statusFixture(t: import('node:test').TestContext, root: string, stderr: string, code: string | number = 255) {
  const clock = new FakeClock();
  const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: 'status-fixture',
    run: 'status-fixture', name: 'fixture', tags: ['cland'], size: 'fixture', region: 'fixture',
    priceHourly: 0, keyName: 'fixture', state: 'active', resource: 1, keyId: 1,
    address: '192.0.2.1', created: clock.now().toISOString(),
    deadline: new Date(clock.now().getTime() + 3600000).toISOString(),
    execution: { head: 'fixture', delivered: true, started: true } };
  let broken = true;
  let gone = false;
  let unavailable = false;
  const api = new DigitalOceanApi({}, clock);
  t.mock.method(api, 'droplet', async () => {
    if (gone) throw new DigitalOceanError(404, 'not_found', 'fixture gone');
    if (unavailable) throw new Error('provider unavailable');
    return { id: 1, name: 'fixture', tags: ['cland'], created_at: clock.now().toISOString(), status: 'active', networks: { v4: [] } };
  });
  const env = fixtureEnvironment(root, {});
  const machine = new Machine(root, env, async () => {
    if (broken) throw { code, stderr };
    return { stdout: JSON.stringify({ state: 'running' }) };
  });
  const logs: LogEntry[] = [];
  const observer = new DropletExecutor(root, undefined, entry => logs.push(entry), env, undefined, { clock, api, machine });
  t.after(() => observer.close());
  return { root, clock, lease, observer, logs, recover: () => { broken = false; },
    gone: () => { gone = true; }, unavailable: () => { unavailable = true; } };
}

for (const [label, stderr, code] of [
  ['user lookup', 'No user exists for uid 501', 255],
  ['key format', 'Load key "/fixture/key": invalid format', 255],
  ['key permissions', 'Load key "/fixture/key": bad permissions', 255],
  ['missing binary', '', 'ENOENT'],
] as const) test(`local SSH ${label} holds an active run past the lost bound and recovers`, async t => statusCase(t, async (root, step, fixtures) => {
  const f = await step(() => statusFixture(fixtures, root, stderr, code));
  f.lease.execution!.unreachableSince = new Date(f.clock.now().getTime() - 300001).toISOString();
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'unknown', cause: 'local SSH client unavailable' });
  f.clock.block(300001);
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'unknown', cause: 'local SSH client unavailable' });
  assert.equal((await step(() => readLease(leaseDir(f.root, f.lease)))).execution!.unreachableSince, undefined);
  assert.equal(f.logs.length, 1, 'one enter event despite repeated failed polls');
  assert.equal(f.logs[0]!.event, 'executor-local-ssh-hold-enter');
  assert.equal(f.logs[0]!.run, f.lease.run);
  assert.equal(f.logs[0]!.cause, 'local SSH client unavailable');
  assert.match(String(f.logs[0]!.error), /machine command failed/);
  if (stderr) assert.ok(String(f.logs[0]!.error).includes(stderr));
  f.recover();
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'running' });
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'running' });
  assert.equal(f.logs.length, 2, 'one leave event despite repeated successful polls');
  assert.deepEqual(f.logs[1], { event: 'executor-local-ssh-hold-leave', run: f.lease.run,
    cause: 'local SSH client unavailable', error: f.logs[0]!.error, state: 'running' });
}));

test('ordinary SSH connection failure still becomes lost at five minutes', async t => statusCase(t, async (root, step, fixtures) => {
  const f = await step(() => statusFixture(fixtures, root, 'ssh: connect to host 192.0.2.1 port 22: Connection timed out'));
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'unknown' }); // previous reply shape
  f.clock.block(299999);
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'unknown' });
  f.clock.block(1);
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'lost', code: 1, cause: 'remote machine lost' });
}));

test('provider absence and lifetime expiry win over a local SSH failure', async t => statusCase(t, async (root, step, fixtures) => {
  const f = await step(() => statusFixture(fixtures, root, 'No user exists for uid 501'));
  f.gone();
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'lost', code: 1, cause: 'remote machine lost' });
  f.lease.resource = null;
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'lost', code: 1, cause: 'remote machine lost' });
  f.clock.block(3600000);
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'lost', code: 1, cause: 'remote machine lifetime expired' });
}));

test('unconfirmed provider stays unknown during local SSH failure', async t => statusCase(t, async (root, step, fixtures) => {
  const f = await step(() => statusFixture(fixtures, root, 'No user exists for uid 501'));
  f.unavailable();
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'unknown' });
}));

test('provider loss ends a local SSH hold once with its original diagnostic', async t => statusCase(t, async (root, step, fixtures) => {
  const f = await step(() => statusFixture(fixtures, root, 'No user exists for uid 501'));
  await step(() => f.observer.status(f.lease));
  assert.equal(f.logs.length, 1);
  f.gone();
  assert.deepEqual(await step(() => f.observer.status(f.lease)), { state: 'lost', code: 1, cause: 'remote machine lost' });
  await step(() => f.observer.status(f.lease));
  assert.deepEqual(f.logs.map(entry => entry.event), ['executor-local-ssh-hold-enter', 'executor-local-ssh-hold-leave']);
  assert.equal(f.logs[1]!.run, f.lease.run);
  assert.equal(f.logs[1]!.cause, 'local SSH client unavailable');
  assert.equal(f.logs[1]!.error, f.logs[0]!.error);
  assert.equal(f.logs[1]!.state, 'lost');
}));
