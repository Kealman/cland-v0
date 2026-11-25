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
