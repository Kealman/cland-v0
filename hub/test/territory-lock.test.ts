// The shared territory-operation seam: synchronous and overlapping async callers against the real lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withTerritoryLock, withTerritoryLockAsync } from '../src/territory.ts';
import { tempProject } from './harness.ts';

test('an async territory operation keeps overlapping callers out until its promise settles', async (t) => {
  const root = await tempProject(t);
  const pending = Promise.withResolvers<string>();
  const first = withTerritoryLock(root, async () => pending.promise);
  let secondEntered = false;
  try {
    await assert.rejects(async () => withTerritoryLock(root, async () => {
      secondEntered = true;
    }), /another territory operation holds the lock/);
    assert.equal(secondEntered, false);
  } finally {
    pending.resolve('finished');
    await first;
  }
  assert.equal(await first, 'finished');
  assert.equal(await withTerritoryLock(root, async () => 'next'), 'next');
  assert.equal(withTerritoryLock(root, () => 'synchronous'), 'synchronous');
});

test('a rejected async operation releases the territory lock and preserves its rejection', async (t) => {
  const root = await tempProject(t);
  const failure = new Error('operation failed');
  await assert.rejects(withTerritoryLock(root, async () => { throw failure; }), (err) => err === failure);
  assert.equal(withTerritoryLock(root, () => 42), 42);
});

test('the hub\'s non-blocking territory lock excludes the synchronous one both ways, breaks a stale lock and releases on rejection', async (t) => {
  const root = await tempProject(t);
  const pending = Promise.withResolvers<string>();
  const first = withTerritoryLockAsync(root, async () => pending.promise);
  // while the hub holds it (once its own start time is probed), init's synchronous lock and a second hub operation are refused
  await new Promise((r) => setTimeout(r, 100));
  assert.throws(() => withTerritoryLock(root, () => 'init'), /another territory operation holds the lock/);
  await assert.rejects(withTerritoryLockAsync(root, async () => 'second'), /another territory operation holds the lock/);
  pending.resolve('finished');
  assert.equal(await first, 'finished');
  // and the hub's is refused while the synchronous one is held
  const held = withTerritoryLock(root, async () => {
    await assert.rejects(withTerritoryLockAsync(root, async () => 'inside'), /another territory operation holds the lock/);
    return 'held';
  });
  assert.equal(await held, 'held');
  // a lock left by a process that is gone is broken
  await writeFile(join(root, '.cland', 'territory.lock'), `${JSON.stringify({ pid: 999_999, started: 'Thu Jan  1 00:00:00 1970' })}\n`);
  assert.equal(await withTerritoryLockAsync(root, async () => 'after stale'), 'after stale');
  const failure = new Error('operation failed');
  await assert.rejects(withTerritoryLockAsync(root, async () => { throw failure; }), (err) => err === failure);
  assert.equal(withTerritoryLock(root, () => 42), 42);
});
