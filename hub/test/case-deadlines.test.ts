// T2: real projectHub writers stay owned across held startup/teardown deadlines.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { caseDeadlines, drainFixtureWork } from './case-deadlines.ts';
import { FakeClock } from './fake-clock.ts';
import { projectHub, tempProject } from './harness.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { realClock } from '../src/hub/clock.ts';
import { stageCase } from './stage-case-fixture.ts';
import { fenceFixtureCleanup } from './process-cleanup.ts';
import { drainFixtureCleanup, onCleanup } from './process-cleanup.ts';
import { guardedLeaseCase } from './executor-lease-fixture.ts';
import cp from 'node:child_process';
import { fixtureNativeGuard } from './fake-native-guard.ts';
import { receiptFixtureCase } from './receipt-fixture-case.ts';
import { testWaitMs } from './until.ts';
import { suiteCase } from './suite-case-fixture.ts';
import { fixture as runnerFixture } from './durations-runner-fixture.ts';
import { EventEmitter } from 'node:events';

for (const registration of ['outer context', 'fixture context'] as const) test(`suite case retains roots and native denial until rejected resource close is repaired (${registration})`, async t => {
  const supervisor = stageCase(t);
  await supervisor.run(async step => {
    const hooks: Array<() => unknown> = [];
    const context = { name: t.name, signal: t.signal, after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
    const dispose = () => supervisor.wait('suite case cleanup receipt', async () => { for (const hook of hooks) await hook(); }, testWaitMs(5000));
    const rejection = new Error('controlled suite case resource close rejection');
    const originalSpawn = cp.spawn;
    let refuse = true, closed = false, attempts = 0, root = '';
    supervisor.requireClose(async () => { refuse = false; await dispose(); });
    await step(() => supervisor.wait('suite case setup', () => suiteCase(context, async ({ setup, fixtures, guardControl }) => {
      guardControl();
      onCleanup(registration === 'outer context' ? context : fixtures, async () => {
        attempts++;
        if (refuse) throw rejection;
        assert.equal((await stat(root)).isDirectory(), true, 'close precedes root disposal');
        closed = true;
      });
      await setup(async () => ({ root: root = await tempProject(fixtures) }));
    }), testWaitMs(5000)));
    await step(() => supervisor.wait('rejected cleanup and positive repair', async () => {
      const guardedSpawn = cp.spawn;
      assert.notEqual(guardedSpawn, originalSpawn);
      await assert.rejects(dispose(), error => registration === 'outer context' ? error === rejection : error instanceof Error && error.cause instanceof AggregateError && error.cause.errors.includes(rejection));
      assert.equal(closed, false);
      assert.equal((await stat(root)).isDirectory(), true, 'failed close retains root');
      assert.equal(cp.spawn, guardedSpawn, 'failed close retains native denial');
      assert.equal(attempts, 1);
      refuse = false;
      await dispose();
      assert.equal(closed, true);
      await assert.rejects(stat(root), { code: 'ENOENT' });
      assert.equal(cp.spawn, originalSpawn);
      await dispose();
      assert.equal(attempts, 2, 'confirmed close is not repeated');
    }, testWaitMs(5000)));
  });
});

test('runner case close stops its held child before joining completion and releasing root or guard', async t => {
  const supervisor = stageCase(t);
  await supervisor.run(async () => {
    const hooks: Array<() => unknown> = [];
    const context = { name: t.name, signal: t.signal, after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
    const dispose = async () => { for (const hook of hooks) await hook(); };
    const entered = Promise.withResolvers<void>(), closing = Promise.withResolvers<void>();
    const completion = Promise.withResolvers<{ stdout: string; stderr: string }>();
    const child = Object.assign(new EventEmitter(), { pid: undefined, stdout: undefined });
    let launches = 0, stops = 0, closed = false, root = '', guarded = cp.spawn;
    const finish = () => {
      if (closed) return;
      closed = true; child.emit('close', 0, null); completion.resolve({ stdout: '', stderr: '' });
    };
    const execute = ((_file: unknown, _args: unknown, options: { signal?: AbortSignal }) => {
      launches++;
      options.signal?.addEventListener('abort', () => { stops++; }, { once: true });
      return Object.assign(completion.promise, { child });
    }) as unknown as NonNullable<Parameters<typeof runnerFixture>[3]>;
    let running: Promise<void> | undefined;
    supervisor.releaseOnClose(finish);
    supervisor.requireClose(async () => { finish(); await running?.catch(() => {}); await dispose(); });
    const outerGuard = cp.spawn;
    running = suiteCase(context, async scope => {
      scope.releaseOnClose(() => closing.resolve());
      guarded = cp.spawn;
      const f = await runnerFixture(scope.fixtures, false, scope, execute);
      root = f.root;
      const started = await f.start();
      entered.resolve();
      await started.result;
    });
    const rejected = assert.rejects(running, /fixture work admission closed/);
    void rejected.catch(() => {});
    await supervisor.wait('held child acquisition receipt', () => entered.promise, testWaitMs(5000));
    assert.equal(launches, 1);
    assert.equal(stops, 0);
    const disposing = dispose(); void disposing.catch(() => {});
    try {
      await supervisor.wait('case close entered before native completion join', () => closing.promise, testWaitMs(5000));
      assert.equal(stops, 1, 'case close requests native stop before awaiting its held completion');
      assert.equal(closed, false, 'stop request is not the producer close receipt');
      assert.equal((await stat(root)).isDirectory(), true, 'held child retains its root');
      assert.equal(cp.spawn, guarded, 'held child retains its launch guard');
    } finally { finish(); }
    await supervisor.wait('native close and original caller drainage', async () => { await rejected; await disposing; }, testWaitMs(5000));
    assert.equal(closed, true);
    assert.equal(stops, 1);
    await assert.rejects(stat(root), { code: 'ENOENT' });
    assert.equal(cp.spawn, outerGuard, 'inner guard releases only after native close and root cleanup');
  });
});

test('runner case close fences a held configuration continuation before any native launch', async t => {
  const supervisor = stageCase(t);
  await supervisor.run(async () => {
    const hooks: Array<() => unknown> = [];
    const context = { name: t.name, signal: t.signal, after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
    const dispose = async () => { for (const hook of hooks) await hook(); };
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
    let launches = 0;
    const execute = (() => {
      launches++;
      const child = Object.assign(new EventEmitter(), { pid: undefined, stdout: undefined });
      queueMicrotask(() => child.emit('close', 0, null));
      return Object.assign(Promise.resolve({ stdout: '', stderr: '' }), { child });
    }) as unknown as NonNullable<Parameters<typeof runnerFixture>[3]>;
    let running: Promise<void> | undefined;
    supervisor.releaseOnClose(() => release.resolve());
    supervisor.requireClose(async () => { release.resolve(); await running?.catch(() => {}); await dispose(); });
    running = suiteCase(context, async scope => {
      scope.releaseOnClose(() => release.resolve());
      const f = await runnerFixture(scope.fixtures, false, scope, execute);
      await scope.step('held configuration continuation', async () => {
        entered.resolve(); await release.promise;
        const started = await f.start();
        await started.result;
      });
    });
    const rejected = assert.rejects(running, /fixture work admission closed/);
    void rejected.catch(() => {});
    await supervisor.wait('configuration hold receipt', () => entered.promise, testWaitMs(5000));
    await supervisor.wait('case close and held continuation drainage', dispose, testWaitMs(5000));
    await rejected;
    assert.equal(launches, 0, 'closed admission prevents the native effect itself');
  });
});

for (const owner of ['fixtureNativeGuard', 'receiptFixtureCase'] as const) test(`${owner} defaults retain the native guard until rejected resource closure is repaired`, async t => {
  const supervisor = stageCase(t);
  await supervisor.run(async step => {
    const hooks: Array<() => unknown> = [];
    const context = { name: t.name, signal: t.signal, after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
    let refuse = true, closed = false, attempts = 0, completedHookCalls = 0;
    const originalSpawn = cp.spawn;
    const rejection = new Error('controlled resource close rejection');
    const dispose = async () => { for (const hook of hooks) await hook(); };
    const acquire = async (owned: TestContext) => {
      if (owner === 'receiptFixtureCase') owned.after(() => { completedHookCalls++; });
      onCleanup(owned, async () => {
        attempts++;
        if (refuse) throw rejection;
        closed = true;
      });
    };
    supervisor.requireClose(async () => { refuse = false; await dispose(); });
    await step(() => supervisor.wait('default fixture setup', async () => {
      if (owner === 'fixtureNativeGuard') {
        await fixtureNativeGuard(context);
        await acquire(context);
      } else await receiptFixtureCase(context, false, acquire);
    }, testWaitMs(5000)));
    await step(() => supervisor.wait('outer cleanup rejection and repaired closure proof', async () => {
      const guardedSpawn = cp.spawn;
      assert.notEqual(guardedSpawn, originalSpawn, 'positively controlled guard installed');
      await assert.rejects(dispose(), error => owner === 'fixtureNativeGuard' ? error === rejection : error instanceof Error && error.cause instanceof AggregateError && error.cause.errors.includes(rejection));
      assert.equal(closed, false);
      assert.equal(cp.spawn, guardedSpawn, 'failed close retains native denial');
      refuse = false;
      await dispose();
      assert.equal(closed, true, 'resource positively closed before restoration');
      assert.equal(attempts, 2, 'failed close retried');
      assert.equal(cp.spawn, originalSpawn);
      if (owner === 'receiptFixtureCase') {
        await dispose();
        assert.equal(completedHookCalls, 1, 'successful outer hooks are not replayed on repair');
        assert.equal(attempts, 2, 'successful resource close is not replayed');
      }
    }, testWaitMs(5000)));
  });
});

test('lease fixture retains seams and native guard after rejected resource close until positive repair', async t => {
  const context = { name: t.name, signal: t.signal, after: () => {} } as unknown as TestContext;
  const scope = guardedLeaseCase(context);
  const originalSpawn = cp.spawn;
  const seam = { open: false };
  const rejection = new Error('controlled lease resource cleanup rejection');
  let refuse = true, closed = false;
  onCleanup(context, async () => {
    if (refuse) throw rejection;
    closed = true;
  });
  t.after(async () => { refuse = false; await drainFixtureCleanup(context); });
  await scope.run(async () => { scope.patch(seam, 'open', true); });
  const guardedSpawn = cp.spawn;
  assert.notEqual(guardedSpawn, originalSpawn, 'positive native launch guard installed');
  await assert.rejects(drainFixtureCleanup(context), error => error === rejection);
  await drainFixtureWork();
  assert.equal(cp.spawn, guardedSpawn, 'rejection must retain the native guard');
  assert.equal(seam.open, true, 'rejection must retain the resource seam');
  assert.equal(closed, false);
  assert.throws(scope.releaseSeams, /resource closure unconfirmed/);
  refuse = false;
  await drainFixtureCleanup(context);
  assert.equal(closed, true, 'positive close receipt precedes restoration');
  assert.equal(seam.open, false);
  assert.equal(cp.spawn, originalSpawn);
});

for (const rejectedClose of [false, true]) test(`stage case TestContext abort fences held writer with ${rejectedClose ? 'rejected then confirmed' : 'confirmed'} resource close`, async t => {
  const supervisor = stageCase(t);
  await supervisor.run(async () => {
    const abort = new AbortController(), hooks: Array<() => unknown> = [];
    const context = { name: 'controlled stage abort', signal: abort.signal, after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
    const dispose = async () => {
      const failures: unknown[] = [];
      for (const hook of hooks) try { await hook(); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, 'controlled stage cleanup rejected');
    };
    fenceFixtureCleanup(context);
    const nested = stageCase(context), outerBoundary = supervisor.nativeBoundary();
    const entered = Promise.withResolvers<string>(), release = Promise.withResolvers<void>();
    const seam = { active: true };
    let running: Promise<void> | undefined, wrote = false, nextAdmitted = false, closed = false, refuse = rejectedClose;
    supervisor.releaseOnClose(() => { refuse = false; release.resolve(); });
    supervisor.requireClose(async () => {
      refuse = false; release.resolve(); await running?.catch(() => {});
      await nested.close(); await dispose();
    });
    nested.requireClose(async () => {
      assert.equal(wrote, true, 'resource close follows the original held write');
      if (refuse) throw new Error('controlled stage resource close refusal');
      closed = true;
    });
    running = nested.run(async step => {
      const root = await nested.wait('held writer root setup', () => step(async () => {
        const root = await tempProject(nested.fixtures); nested.adoptRoot(root); return root;
      }));
      nested.patch(seam, 'active', false);
      await step(async () => {
        entered.resolve(root); await release.promise;
        await writeFile(join(root, 'held-writer'), 'complete'); wrote = true;
      });
      await step(async () => { nextAdmitted = true; await writeFile(join(root, 'forbidden-next'), 'must not run'); });
    });
    const rejected = assert.rejects(running, /fixture work admission closed/); void rejected.catch(() => {});
    const root = await supervisor.wait('held writer entered', () => entered.promise);
    const heldBoundary = nested.nativeBoundary();
    abort.abort(new Error('controlled TestContext abort'));
    assert.throws(() => nested.run(async () => {}), /fixture work admission closed/, 'abort fences new admission synchronously before normal hooks');
    const disposing = dispose(); void disposing.catch(() => {});
    assert.equal((await stat(root)).isDirectory(), true, 'real cleanup retains the root while its writer is held');
    assert.equal(nested.nativeBoundary(), heldBoundary); assert.equal(seam.active, false); assert.equal(closed, false);
    release.resolve(); await rejected;
    if (rejectedClose) {
      await assert.rejects(disposing, /controlled stage cleanup rejected/);
      await assert.rejects(nested.restore(), /resource close unconfirmed/);
      assert.equal((await stat(root)).isDirectory(), true);
      assert.equal(nested.nativeBoundary(), heldBoundary); assert.equal(seam.active, false); assert.equal(closed, false);
      refuse = false; await nested.close(); await dispose();
    } else await disposing;
    assert.equal(wrote, true); assert.equal(nextAdmitted, false); assert.equal(closed, true);
    await assert.rejects(stat(root), { code: 'ENOENT' });
    assert.equal(seam.active, true); assert.equal(nested.nativeBoundary(), outerBoundary);
  });
});

test('whole-case cleanup is registered before admission and adopted roots retain its join guard', async t => {
  let sharedClose: (() => Promise<unknown>) | undefined;
  const guards: string[] = [];
  const scope = caseDeadlines(t, { ownership: {
    beforeDirectories: (_context, close) => { sharedClose = close; },
    guardDirectoryRemoval: root => { guards.push(root); },
  } });
  assert.equal(typeof sharedClose, 'function', 'shared signal cleanup must be registered before acquisition');
  scope.adoptRoot('held-root');
  assert.deepEqual(guards, ['held-root']);
  await sharedClose!();
  assert.throws(() => scope.run(async () => {}), /fixture work admission closed/);
});

function controlled(t: TestContext, clock: FakeClock, releaseOnClose?: () => void) {
  let cleanup: (() => Promise<unknown>) | undefined;
  const owner = new Proxy(t, {
    get(target, key) {
      if (key === 'after') return (fn: Parameters<TestContext['after']>[0]) => { cleanup = async () => fn?.(target, () => {}); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const scope = caseDeadlines(owner, { clock, timeoutMs: 10,
    ...(releaseOnClose ? { releaseOnClose, ownership: { beforeDirectories, guardDirectoryRemoval } } : {}) });
  return { ...scope, cleanup: () => { assert.ok(cleanup); return cleanup(); } };
}

for (const phase of ['acquisition', 'writer'] as const) test(`closing a whole case joins held ${phase} and fences its next step before cleanup`, async t => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let root: string | undefined, laterAdmitted = false, completed = false;
  let retainedAtRelease = false;
  const scope = controlled(t, new FakeClock(), () => {
    retainedAtRelease = root ? existsSync(root) : true;
    release.resolve();
  });
  let cleanup: Promise<unknown> | undefined;
  t.after(async () => { cleanup ??= scope.cleanup(); await cleanup; await drainFixtureWork(); });
  const sequence = scope.run(async step => {
    if (phase === 'writer') {
      root = await step(() => tempProject(scope.fixtures));
      scope.adoptRoot(root);
    }
    await step(async () => {
      entered.resolve(); await release.promise;
      if (!root) root = await tempProject(scope.fixtures);
      scope.adoptRoot(root);
      await writeFile(join(root, 'held-write'), 'complete');
      completed = true;
    });
    await step(async () => { laterAdmitted = true; await writeFile(join(root!, 'late-write'), 'must not run'); });
  });
  const rejected = assert.rejects(sequence, /fixture work admission closed/);
  void rejected.catch(() => {});
  await within(entered.promise, 1000, realClock, () => new Error('whole-case held-work setup receipt missing'));
  if (root) assert.ok((await stat(root)).isDirectory(), 'admitted writer retains its root');
  cleanup = scope.cleanup();
  await cleanup; await rejected;
  assert.equal(retainedAtRelease, true, 'shared cleanup released held work while its root was retained');
  assert.equal(completed, true, 'admitted acquisition and write settled before cleanup');
  assert.equal(laterAdmitted, false, 'next continuation was fenced');
  assert.ok(root, 'late acquisition was adopted');
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('a timed-out startup drains late hub ownership before removing its root', async t => {
  const clock = new FakeClock();
  const scope = controlled(t, clock);
  const root = await tempProject(scope.fixtures);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  let stoppedWithRootPresent: Promise<boolean> | undefined;
  let cleanup: Promise<unknown> | undefined;
  const startup = scope.wait('held projectHub startup', async () => {
    entered.resolve();
    await release.promise;
    hub = await projectHub(scope.fixtures, root, {}, { clock: new FakeClock() });
    stoppedWithRootPresent = hub.stopped.then(() => existsSync(root));
    return hub;
  });
  const expired = assert.rejects(startup, /timed-out startup.*held projectHub startup.*deadline exceeded/);
  t.after(async () => {
    release.resolve();
    await drainFixtureWork();
    await hub?.stop();
    await cleanup?.catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  await entered.promise;
  await clock.advance(10);
  await expired;
  cleanup = scope.cleanup();
  assert.ok((await stat(root)).isDirectory(), 'root survives the timeout while startup still owns work');
  release.resolve();
  await cleanup;
  assert.ok(hub, 'late startup completed and registered its shutdown owner');
  await hub.stopped;
  assert.equal(await stoppedWithRootPresent, true, 'late hub shutdown is observed before root removal');
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('a timed-out teardown retains worker drainage until writers stop and the root is removed', async t => {
  const clock = new FakeClock();
  const scope = controlled(t, clock);
  const root = await tempProject(scope.fixtures);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  let stoppedWithRootPresent = false;
  beforeDirectories(scope.fixtures, async () => {
    entered.resolve();
    await release.promise;
    await hub!.stop();
    stoppedWithRootPresent = (await stat(root)).isDirectory();
  });
  hub = await projectHub(scope.fixtures, root, {}, { clock: new FakeClock() });
  t.after(async () => {
    release.resolve();
    await drainFixtureWork();
    await hub?.stop();
    await rm(root, { recursive: true, force: true });
  });
  const cleanup = scope.cleanup();
  const expired = assert.rejects(cleanup, /timed-out teardown.*fixture teardown.*deadline exceeded/);
  await entered.promise;
  await clock.advance(10);
  await expired;
  let drained = false;
  const drainage = drainFixtureWork(clock, 100).then(() => { drained = true; });
  await clock.advance(0);
  assert.equal(drained, false, 'the rejected hook cannot release worker directory ownership');
  assert.ok((await stat(root)).isDirectory(), 'the held writer still has its root');
  release.resolve();
  await drainage;
  assert.equal(stoppedWithRootPresent, true, 'writer stop completes before directory removal');
  await hub.stopped;
  await assert.rejects(stat(root), { code: 'ENOENT' });
});
