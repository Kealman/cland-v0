// T1: delivered-tree runner phase startup/exit ownership on a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { watchSuitePhase } from './suite-phase.ts';
import { FakeClock } from './fake-clock.ts';
import { startupOwnerLine } from '../src/suite-startup-owner.ts';
import { suiteEvidence } from '../src/suite-log.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { suiteProgress } from '../src/suite-progress.ts';
import { ownRepetition } from './repetition-owner.ts';

test('runner phase stops a file with no first test and joins cleanup before failing native zero exit', async () => {
  const clock = new FakeClock();
  const exit = Promise.withResolvers<number>();
  const cleaned = Promise.withResolvers<void>();
  const failures: string[] = [];
  const report: string[] = [];
  const phase = watchSuitePhase({ clock, startupMs: 30000, exit: exit.promise,
    owner: { id: 'phase:1', report: line => report.push(line) },
    commandState: () => ({ commandPid: 12345, exit: null, stdout: 'open', stderr: 'open' }),
    report: line => report.push(line),
    stalled: reason => { failures.push(reason); return cleaned.promise; } });
  let outcome: number | undefined;
  void phase.result.then(code => { outcome = code; });
  try {
    const row = JSON.stringify({ event: 'start', id: 'runner:1', file: 'held-import.test.ts', name: 'held-import.test.ts', type: 'file', nesting: 0, at: clock.now().getTime() });
    phase.output('unrelated output\nsuite progress {torn}\nsuite prog');
    phase.output('ress ' + row + '\n');
    await clock.advance(29999);
    assert.deepEqual(failures, []);
    await clock.advance(1);
    assert.deepEqual(failures, ['stalled: held-import.test.ts no test started within 30 s']);
    assert.match(report.join('\n'), /suite stall command .*"commandPid":12345,"exit":null/);
    assert.match(report.join('\n'), /held-import.test.ts no test started within 30 s; command exit pending; stdout open; stderr open/);
    assert.match(suiteEvidence(report.join('\n') + '\nlater noise\n'.repeat(40)), /suite stall startup stalled: held-import.test.ts no test started within 30 s/);
    exit.resolve(0);
    await clock.advance(0);
    assert.equal(outcome, undefined, 'native exit does not publish before cleanup joins');
    cleaned.resolve();
    assert.equal(await phase.result, 1, 'the runner cannot publish zero after a startup stall');
    phase.finished();
    assert.match(report[0]!, /suite startup owner .*"event":"start"/);
    assert.match(report.at(-1)!, /suite startup owner .*"event":"finish"/);
  } finally {
    phase.stop(); cleaned.resolve(); exit.resolve(0); await phase.result;
  }
});

test('startup ownership markers leave suite counts, progress and durable evidence unchanged', () => {
  const marker = startupOwnerLine({ id: 'phase:1', event: 'start' }) + '\n' + startupOwnerLine({ id: 'phase:1', event: 'finish' }) + '\n';
  const counts = '# tests 1\n# pass 1\n# fail 0\n';
  assert.equal(suiteSummary(marker + counts), suiteSummary(counts));
  assert.equal(suiteProgress(marker, 0), null);
  assert.doesNotMatch(suiteEvidence(marker + 'later noise\n'.repeat(40)), /suite startup owner /);
});

test('repetition progress bounds kept UTF-8 bytes and recovers after oversized lines', async () => {
  const clock = new FakeClock();
  const exit = Promise.withResolvers<number>();
  const observed: string[] = [], failures: string[] = [];
  const phase = watchSuitePhase({ clock, startupMs: 30000, exit: exit.promise,
    owner: { id: 'repeat:1', report: () => {} }, report: () => {},
    commandState: () => ({ commandPid: 123, exit: null, stdout: 'open', stderr: 'open' }),
    observed: row => observed.push(row.id),
    stalled: async reason => { failures.push(reason); } });
  try {
    for (let n = 0; n < 100; n++) {
      phase.output('é'.repeat(4096));
      assert.ok(phase.bufferedBytes <= 65536);
    }
    // An oversized tail containing a convincing prefix cannot become a receipt.
    const row = JSON.stringify({ event: 'start', id: 'repeat:1', file: 'held.test.ts', name: 'held.test.ts', type: 'file', nesting: 0, at: 0 });
    phase.output('suite progress ' + row + '\n');
    assert.deepEqual(observed, []);
    phase.output('unrelated\nsuite prog');
    phase.output('ress ' + row.slice(0, 40));
    phase.output(row.slice(40) + '\n');
    assert.deepEqual(observed, ['repeat:1'], 'receipt follows consumption by the guard');
    await clock.advance(30000);
    assert.deepEqual(failures, ['stalled: held.test.ts no test started within 30 s']);
  } finally { phase.stop(); exit.resolve(0); await phase.result; }
});

test('rejected repetition cleanup joins original failure and restoration before reporting secondary errors', async () => {
  const held = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const original = new Error('original repetition failure'), stop = new Error('stop failed'), sweep = new Error('sweep failed');
  let restored = false;
  const owner = ownRepetition(async () => { await held.promise; throw original; }, () => { restored = true; });
  const cleanup = owner.cleanup(async () => { throw stop; }, async () => { entered.resolve(); throw sweep; });
  const failed = assert.rejects(cleanup, error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [original, stop, sweep]);
    assert.equal(restored, true);
    return true;
  });
  await entered.promise;
  assert.equal(restored, false);
  held.resolve();
  await failed;
});
