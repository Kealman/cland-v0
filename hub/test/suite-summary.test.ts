// T1: summaries render command logs without starting a worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteSummary } from '../src/hub/suites.ts';
import { suiteEvidence } from '../src/suite-log.ts';
import { soakExecutionSeconds } from '../src/suite-load-gate-plan.ts';

function commandLog(line: string, output: string[], code: number, id = 'command-1') {
  return [`$ ${line}`, `suite command start ${JSON.stringify({ id, name: 'test', line })}`, ...output,
    '', `suite command end ${id} ${code}`, `Finished: exit ${code}`].join('\n');
}

test('native runner timing survives semantic retention without changing test results', () => {
  const marker = 'suite runner started 2026-11-17T01:00:00Z';
  const malformed = 'suite runner started ordinary command noise';
  const log = marker + '\n' + malformed + '\n' + commandLog('sh test.sh', ['assertion passed'], 0);
  const retained = suiteEvidence(log);
  assert.equal(soakExecutionSeconds(retained, '2026-11-17T01:00:03Z'), 3);
  assert.ok(retained.includes(marker));
  assert.ok(!retained.includes(malformed));
  assert.equal(suiteSummary(retained), 'test exited 0: sh test.sh');
  assert.equal(soakExecutionSeconds(suiteEvidence(commandLog('sh test.sh', [], 0)), '2026-11-17T01:00:03Z'), null);
});

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

test('ticket infrastructure outcomes retain their cause without classifying ordinary test exits', async () => {
  const { suiteCommandOutcome } = await import('../src/suite-infrastructure.ts');
  const cause = 'suite infrastructure: suite ticket lost; remover 42; native identity changed';
  assert.deepEqual(suiteCommandOutcome(75, cause), { code: 75, cause, notRun: 'infrastructure' });
  assert.deepEqual(suiteCommandOutcome(1, cause), { code: 1, cause });
  assert.deepEqual(suiteCommandOutcome(75, 'ordinary command exit'), { code: 75, cause: 'ordinary command exit' });
  assert.match(suiteSummary('ℹ tests 1\nℹ pass 1\n', [], { outcome: { code: 75, cause } }), /suite infrastructure: suite ticket lost; remover 42/);
});

test('green test output cannot supply an infrastructure cause', () => {
  const log = 'ℹ tests 1\nℹ pass 1\nsuite infrastructure: suite ticket lost; remover unknown\n';
  assert.equal(suiteSummary(log), 'tests 1; pass 1');
  assert.equal(suiteSummary(log, [], { outcome: { code: 0, cause: '' }, priorityOnly: true }), 'tests 1; pass 1');
});

test('a shard-prefixed aggregate summary retains structured child infrastructure causes', () => {
  const cause = 'suite infrastructure: suite ticket fixture lost; remover 42';
  const log = 'ℹ tests 2\nℹ pass 2\nsuite infrastructure: unrelated fixture output\n';
  const source = {
    outcome: { code: 1, cause: `shard-2: ${cause}` },
    shards: [
      { shardName: 'shard-1', outcome: { code: 0, cause: '' } },
      { shardName: 'shard-2', outcome: { code: 75, cause } },
    ],
  };
  assert.equal(suiteSummary(log, [], source), `tests 2; pass 2\nshard-2: ${cause}`);
  source.outcome.cause = 'aggregate description unavailable';
  assert.equal(suiteSummary(log, [], source), `tests 2; pass 2\nshard-2: ${cause}`);
});
