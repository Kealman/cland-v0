// T1: worker receipt cause reporting is pure; no command or process sweep is needed.
import assert from 'node:assert/strict';
import test from 'node:test';
import { compatibilityCleanupOutcome } from '../src/hub/suite-worker.ts';
import { compatibilityCleanupCause, runWorkerWithAdmission, type WorkerCompletion } from '../src/suite-worker-admission.ts';
import { suiteCommandOutcome } from '../src/suite-infrastructure.ts';
import { FakeClock } from './fake-clock.ts';
import { tierReceipt } from '../src/verification-tier-receipts.ts';

test('terminal logging failure preserves the persisted worker outcome and reports a secondary diagnostic', async () => {
  for (const outcome of [{ code: 0, cause: '' }, { code: 75, cause: 'suite infrastructure: ticket lost' }]) {
    const receipts: WorkerCompletion[] = [];
    const diagnostics: string[] = [];
    const effects: string[] = [];
    await runWorkerWithAdmission({
      gate: async () => true, signal: () => null, clock: new FakeClock(1000),
      run: async () => outcome,
      log: () => {
        effects.push('log');
        throw new Error('terminal unavailable');
      },
      diagnostic: line => { effects.push('diagnostic'); diagnostics.push(line); },
      persist: async receipt => { effects.push('persist'); receipts.push(receipt); },
    });
    assert.deepEqual(receipts, [{ ...outcome, ...(outcome.code === 75 ? { notRun: 'infrastructure' } : {}), finished: '1970-01-01T00:00:01.000Z' }]);
    assert.deepEqual(diagnostics, ['secondary diagnostic: worker terminal logging failed: Error: terminal unavailable']);
    assert.deepEqual(effects, ['log', 'diagnostic', 'persist'], 'receipt publication must be the final callback');
  }
});

test('worker publication retains producing tier receipts through signal and cleanup diagnostics', async () => {
  const rows = [tierReceipt({ id: 'run', tree: 'tree' }, { name: 'T1', command: 'unit' }, 0)];
  const timings = [{ run: 'run', head: 'head', tree: 'tree', command: 'unit', step: 'T1', platform: 'linux', samples: [{ file: 'unit', name: 'case', seconds: 4, outcome: 'pass' as const }] }];
  for (const signal of [null, 'SIGTERM']) {
    const receipts: WorkerCompletion[] = [];
    await runWorkerWithAdmission({ gate: async () => true, signal: () => signal, clock: new FakeClock(1000),
      run: async () => ({ ...compatibilityCleanupOutcome({ code: 0, cause: '' }, 'cleanup denied'), tierReceipts: rows, timingReceipts: timings }),
      log: () => {}, persist: async receipt => { receipts.push(receipt); } });
    assert.deepEqual(receipts[0]!.tierReceipts, rows);
    assert.deepEqual(receipts[0]!.timingReceipts, timings);
    assert.equal(receipts[0]!.code, signal ? 143 : 0);
  }
});

test('a failed diagnostic sink cannot replace the durable worker outcome', async () => {
  const receipts: WorkerCompletion[] = [];
  await runWorkerWithAdmission({
    gate: async () => true, signal: () => null, clock: new FakeClock(1000),
    run: async () => ({ code: 2, cause: 'tests failed' }),
    log: () => { throw new Error('terminal unavailable'); },
    diagnostic: () => { throw new Error('diagnostic unavailable'); },
    persist: async receipt => { receipts.push(receipt); },
  });
  assert.deepEqual(receipts, [{ code: 2, cause: 'tests failed', finished: '1970-01-01T00:00:01.000Z' }]);
});

test('receipt publication preserves its exact error after both diagnostic sinks fail', async () => {
  const failure = new Error('receipt unavailable');
  const effects: string[] = [];
  await assert.rejects(runWorkerWithAdmission({
    gate: async () => true, signal: () => null, clock: new FakeClock(1000),
    run: async () => ({ code: 0, cause: '' }),
    log: () => { effects.push('log'); throw new Error('terminal unavailable'); },
    diagnostic: () => { effects.push('diagnostic'); throw new Error('diagnostic unavailable'); },
    persist: async () => { effects.push('persist'); throw failure; },
  }), error => error === failure);
  assert.deepEqual(effects, ['log', 'diagnostic', 'persist']);
});

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

test('worker cleanup keeps selected ticket loss and its infrastructure metadata', () => {
  assert.deepEqual(compatibilityCleanupOutcome({ code: 75, cause: 'suite infrastructure: ticket lost' }, new Error('sweep denied')), {
    code: 75, cause: 'suite infrastructure: ticket lost; compatibility cleanup failed: Error: sweep denied', notRun: 'infrastructure',
  });
  assert.deepEqual(compatibilityCleanupOutcome({ code: 0, cause: '' }, 'release denied'), {
    code: 0, cause: 'compatibility cleanup failed: release denied',
  });
  assert.deepEqual(compatibilityCleanupOutcome(null, 'release denied'), {
    code: 1, cause: 'compatibility cleanup failed: release denied',
  });
});

test('worker receipt reports a compatibility cleanup failure without a primary cause', () => {
  for (const [error, expected] of [
    [new Error('ps sweep failed'), 'compatibility cleanup failed: Error: ps sweep failed'],
    ['lease release failed', 'compatibility cleanup failed: lease release failed'],
  ] as const) assert.equal(compatibilityCleanupCause('', error), expected);
});
