// T1: worker receipt cause reporting is pure; no command or process sweep is needed.
import assert from 'node:assert/strict';
import test from 'node:test';
import { compatibilityCleanupCause } from '../src/hub/suite-worker.ts';

test('worker receipt preserves inherited-pipe cleanup cause before a failed compatibility sweep', () => {
  const primary = 'stalled: no output; cleanup incomplete: unverified inherited-pipe writer (npm pid 123; stdout open; stderr closed)';
  assert.equal(compatibilityCleanupCause(primary, new Error('ps sweep failed')),
    'stalled: no output; cleanup incomplete: unverified inherited-pipe writer (npm pid 123; stdout open; stderr closed); compatibility cleanup failed: Error: ps sweep failed');
});

test('worker receipt reports a compatibility cleanup failure without a primary cause', () => {
  for (const [error, expected] of [
    [new Error('ps sweep failed'), 'compatibility cleanup failed: Error: ps sweep failed'],
    ['lease release failed', 'compatibility cleanup failed: lease release failed'],
  ] as const) assert.equal(compatibilityCleanupCause('', error), expected);
});
