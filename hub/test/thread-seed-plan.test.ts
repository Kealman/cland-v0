// T1: deterministic merge-path and soak work plans, independent of Neovim.
// Manifest T2: the legacy T1 regex matches harness/Neovim text (T-682).
import assert from 'node:assert/strict';
import test from 'node:test';
import { threadSeedPlan } from '../../nvim/test/thread-seed-plan.ts';

test('thread oracle plans retain both widths and every phase', () => {
  assert.deepEqual(threadSeedPlan(false), { seeds: [1, 2], renders: 12 });
  assert.deepEqual(threadSeedPlan(true), { seeds: [1, 2, 3, 4], renders: 25 });
  for (const soak of [false, true]) {
    const { seeds, renders } = threadSeedPlan(soak);
    assert.deepEqual([...new Set(seeds.map(seed => seed % 2 ? 80 : 120))], [80, 120]);
    assert.deepEqual([...new Set(Array.from({ length: renders - 1 }, (_, step) => step % 8))], [0, 1, 2, 3, 4, 5, 6, 7]);
  }
});
