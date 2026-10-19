// T1: summaries render command logs without starting a worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteSummary } from '../src/hub/suites.ts';

function commandLog(line: string, output: string[], code: number, id = 'command-1') {
  return [`$ ${line}`, `suite command start ${JSON.stringify({ id, name: 'test', line })}`, ...output,
    '', `suite command end ${id} ${code}`, `Finished: exit ${code}`].join('\n');
}

test('a failed command without node counts reports its exit and last 20 output lines', () => {
  const output = Array.from({ length: 25 }, (_, n) => `assertion ${n + 1}`);
  const log = ['$ sh -n test.sh', 'check passed', commandLog('sh test.sh', output, 7), 'suite duration 1.00s'].join('\n');
  assert.equal(suiteSummary(log), `test exited 7: sh test.sh\nsuite duration 1.00s\nFailures:\n${output.slice(5).join('\n')}`);
  assert.equal(suiteSummary(log, [], { priorityOnly: true }), 'test exited 7: sh test.sh');
});

test('node counts keep the existing summary even after a failed command', () => {
  assert.equal(suiteSummary('$ npm test\nℹ tests 2\nℹ pass 1\nℹ fail 1\n✖ broken\nFinished: exit 1\n# tests 3\n# pass 3\n# fail 0\n'),
    'tests 5; pass 4; fail 1\nFailures:\n✖ broken');
});

test('a completed project test reports success without a failure excerpt', () => {
  assert.equal(suiteSummary(commandLog('sh test.sh', ['assertion passed'], 0)), 'test exited 0: sh test.sh');
  assert.equal(suiteSummary('$ sh test.sh\npartial output\n'), 'counts unavailable (suite did not finish)');
});

test('command-like stdout stays in the failed command output tail', () => {
  const output = ['$ echo preparing', 'suite command end unrelated 0', 'Finished: exit 0', 'assertion failed'];
  assert.equal(suiteSummary(commandLog('sh test.sh', output, 1)),
    `test exited 1: sh test.sh\nFailures:\n${output.join('\n')}`);
});
