// T4: twenty sequential settled-card cases under the runner's workers-2 capacity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, releaseRowsAndCursorIdentity } from './explorer-outline-fixture.ts';

test('explorer settled card preserves unselected-task isolation 20/20', { skip }, async t => {
  let completed = 0;
  for (let repetition = 1; repetition <= 20; repetition++) {
    await t.test(`explorer case ${repetition}`, async child => {
      await releaseRowsAndCursorIdentity(child);
      completed++;
    });
  }
  assert.equal(completed, 20, 'all twenty cases completed the original assertions');
  t.diagnostic('20/20 sequential explorer cases; settled E-3 card, zero unselected task.view requests, fold/rank cursor identity');
});
