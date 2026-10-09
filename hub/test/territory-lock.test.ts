// The shared territory-operation seam: synchronous and overlapping async callers against the real lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTerritoryLock } from '../src/territory.ts';
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
