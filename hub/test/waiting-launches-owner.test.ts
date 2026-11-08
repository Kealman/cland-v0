// T1: exported in-memory waiting owner; bounded microtask work, no timers or I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WaitingLaunches } from '../src/adapters/waiting-launches.ts';
const MAX_MICROTASK_TURNS = 32;
test('an add in the completed-pass finalizer window receives its own placement pass', async t => {
  const completed: string[] = [], attempted: string[] = [];
  const row = (name: string) => ({ name, role:'implementer', pool:'agents', reason:'waiting for a host', since:'2026-11-08T00:00:00Z' });
  const owner = new WaitingLaunches((waiting, end) => {
    if (end !== 'placed') return;
    completed.push(waiting.name);
    if (waiting.name === 'a') queueMicrotask(() => owner.add(row('b'), async () => { attempted.push('b'); }));
  });
  t.after(() => owner.close());
  owner.add(row('a'), async () => { attempted.push('a'); });
  for (let turn = 0; turn < MAX_MICROTASK_TURNS && !completed.includes('b'); turn++) await Promise.resolve();
  assert.deepEqual(attempted, ['a','b']);
  assert.deepEqual(completed, ['a','b']);
  assert.deepEqual(owner.list(), []);
});
