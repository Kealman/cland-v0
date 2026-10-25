// T4: twenty owned headless launcher cases, two at a time under suite capacity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skip } from './shell-fixture.ts';
import { failedOrEmptyModelAnswers } from './launcher-model-fixture.ts';

test('launcher Insert receipt holds 20/20 under parallel load', { skip, concurrency: 2 }, async t => {
  const completed: number[] = [];
  for (let batch = 0; batch < 20; batch += 2) {
    await Promise.all([0, 1].map(offset => t.test(`launcher case ${batch + offset + 1}`, async child => {
      const receipts = await failedOrEmptyModelAnswers(child);
      assert.equal(receipts, 2, 'error and empty answers both completed native model input');
      completed.push(receipts);
    })));
  }
  assert.equal(completed.length, 20, 'every case completed all original assertions');
  assert.equal(completed.reduce((sum, count) => sum + count, 0), 40, 'forty native input receipts');
  t.diagnostic('20/20 launcher cases passed in batches of 2; 40 native TextChangedI model-input receipts');
});
