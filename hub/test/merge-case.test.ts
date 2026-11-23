// T2: actual Node context mock teardown, with a fake filesystem boundary and owned scratch storage.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import files from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { mergeContext } from './merge-case.ts';
import { pruneCase } from './prune-case.ts';
import { tempProject } from './harness.ts';
import { drainFixtureCleanup, onCleanup, ownDirectory } from './process-cleanup.ts';

test('merge context retains actual native method mocks and timers after rejected close until repair', t => pruneCase(t, async (scope, step) => {
  const hooks: Array<() => unknown> = [];
  // Use the real node:test tracker that the framework resets independently.
  const raw = { name: 'controlled real mock restoration', signal: t.signal, mock: t.mock,
    after: (hook: () => unknown) => hooks.push(hook) } as unknown as TestContext;
  const { context, owner } = mergeContext(raw);
  const nativeRead = files.readFile, nativeTimer = globalThis.setTimeout;
  let refuse = true, closed = false, calls = 0, ticks = 0, root = '';
  let remove!: () => Promise<void>;
  scope.releaseOnClose(() => { refuse = false; });
  scope.requireClose(async () => { refuse = false; await drainFixtureCleanup(context); });
  await owner.run(() => owner.step('actual mock restoration fixture setup', async () => {
    root = await tempProject(context, 'cland-merge-mock-owner-');
    remove = ownDirectory(context, root);
    onCleanup(context, async () => {
      if (refuse) throw new Error('controlled actual mock close rejected');
      closed = true;
    });
    context.mock.method(files, 'readFile', async () => { calls++; return Buffer.from('controlled read'); });
    context.mock.timers.enable({ apis: ['setTimeout'] });
  }));
  const mockedRead = files.readFile, mockedTimer = globalThis.setTimeout;
  assert.notEqual(mockedRead, nativeRead);
  assert.notEqual(mockedTimer, nativeTimer);
  assert.equal(hooks.length, 1);
  await assert.rejects(remove(), /controlled actual mock close rejected/);
  await assert.rejects(Promise.resolve(hooks[0]!()), /controlled actual mock close rejected/);
  // These are actual restoration APIs, including node:test's automatic reset path.
  raw.mock.reset();
  raw.mock.restoreAll();
  raw.mock.timers.reset();
  assert.equal(files.readFile, mockedRead, 'native seam survives independent context teardown');
  assert.equal(globalThis.setTimeout, mockedTimer, 'actual timer seam remains installed');
  assert.equal((await files.readFile(join(root, 'controlled-read'))).toString(), 'controlled read');
  setTimeout(() => { ticks++; }, 10);
  context.mock.timers.tick(10);
  assert.equal(calls, 1, 'retained filesystem mock still handles the read');
  assert.equal(ticks, 1, 'retained timer owner still executes its queued callback');
  assert.equal(closed, false);
  assert.equal((await stat(root)).isDirectory(), true);
  refuse = false;
  await step('repair and positive resource closure', () => drainFixtureCleanup(context));
  assert.equal(closed, true);
  assert.equal(files.readFile, nativeRead, 'filesystem seam is restored only after positive close');
  assert.equal(globalThis.setTimeout, nativeTimer);
  assert.throws(() => context.mock.timers.tick(1), { code: 'ERR_INVALID_STATE' });
  await assert.rejects(stat(root), { code: 'ENOENT' });
}));
