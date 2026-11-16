// T1: delivered-tree runner phase startup/exit ownership on a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { watchSuitePhase } from './suite-phase.ts';
import { FakeClock } from './fake-clock.ts';
import { startupOwnerLine } from '../src/suite-startup-owner.ts';
import { suiteEvidence } from '../src/suite-log.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { suiteProgress } from '../src/suite-progress.ts';

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
    phase.progress({ event: 'start', id: 'runner:1', file: 'held-import.test.ts', name: 'held-import.test.ts', type: 'file', nesting: 0, at: clock.now().getTime() });
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
