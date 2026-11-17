// T1: worker receipt cause reporting is pure; no command or process sweep is needed.
import assert from 'node:assert/strict';
import test from 'node:test';
import { compatibilityCleanupCause, runWorkerWithAdmission, type WorkerCompletion } from '../src/suite-worker-admission.ts';
import { suiteCommandOutcome } from '../src/suite-infrastructure.ts';
import { FakeClock } from './fake-clock.ts';

test('worker admission gate expiry names its 15 second deadline', async () => {
  const clock = new FakeClock(1000);
  const logs: string[] = [];
  const receipts: WorkerCompletion[] = [];
  let setupCalls = 0;
  const completion = runWorkerWithAdmission({
    gate: async () => false, signal: () => null, clock,
    run: async () => { setupCalls++; throw new Error('cannot establish compatibility lease identity'); },
    log: line => logs.push(line), persist: async receipt => { receipts.push(receipt); },
  });
  await clock.advance(15000);
  assert.deepEqual(receipts, [{ code: 1, cause: 'worker admission gate wait expired after 15000 ms', finished: '1970-01-01T00:00:16.000Z' }]);
  await completion;
  assert.equal(setupCalls, 0);
  assert.deepEqual(logs, ['\nFinished: exit 1; worker admission gate wait expired after 15000 ms\n']);
});

test('worker interrupted by SIGTERM before admission retains the signal cause', async () => {
  const clock = new FakeClock(1000);
  let signal: string | null = null;
  const logs: string[] = [];
  const receipts: WorkerCompletion[] = [];
  clock.setTimeout(() => { signal = 'SIGTERM'; }, 25);
  let setupCalls = 0;
  const completion = runWorkerWithAdmission({
    gate: async () => false, signal: () => signal, clock,
    run: async () => { setupCalls++; throw new Error('native setup must not run'); },
    log: line => logs.push(line), persist: async receipt => { receipts.push(receipt); },
  });
  await clock.advance(25);
  assert.deepEqual(receipts, [{ code: 143, cause: 'worker interrupted by SIGTERM', finished: '1970-01-01T00:00:01.025Z' }]);
  await completion;
  assert.equal(setupCalls, 0);
  assert.deepEqual(logs, ['\nFinished: exit 143; worker interrupted by SIGTERM\n']);
});

test('worker admission succeeds when the gate is published before the deadline', async () => {
  const clock = new FakeClock(1000);
  let published = false;
  const receipts: WorkerCompletion[] = [];
  clock.setTimeout(() => { published = true; }, 25);
  const completion = runWorkerWithAdmission({
    gate: async () => published, signal: () => null, clock,
    run: async () => ({ code: 0, cause: '' }),
    log: () => {}, persist: async receipt => { receipts.push(receipt); },
  });
  await clock.advance(25);
  assert.deepEqual(receipts, [{ code: 0, cause: '', finished: '1970-01-01T00:00:01.025Z' }]);
  await completion;
});

test('worker completion preserves both legacy and gate deadline causes in the existing receipt shape', () => {
  for (const cause of ['hub stopped before worker admission completed', 'worker admission gate wait expired after 15000 ms']) {
    assert.deepEqual(suiteCommandOutcome(1, cause), { code: 1, cause });
  }
  assert.deepEqual(suiteCommandOutcome(143, 'worker interrupted by SIGTERM'), { code: 143, cause: 'worker interrupted by SIGTERM' });
});

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
