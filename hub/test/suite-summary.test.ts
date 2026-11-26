// T1: summaries render command logs without starting a worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteSummary } from '../src/hub/suites.ts';
import { suiteEvidence } from '../src/suite-log.ts';
import { soakExecutionSeconds } from '../src/suite-load-gate-plan.ts';
import { suiteAccounting } from '../src/suite-accounting.ts';
import { suiteProvenance } from '../src/suite-provenance.ts';
import { fixtureWork } from '../../test-support/fixture-work.ts';
import { passAccounting, suiteProgress } from '../src/suite-progress.ts';

test('accounting and interruption readers accept legacy receipt fields and refuse malformed common fields', async t => {
  const owner = fixtureWork();
  t.after(() => owner.close());
  await owner.run(async () => {
    const finish = { event: 'finish', id: 'legacy', file: 'output.test.ts', name: 'control', at: 1, nesting: 0, outcome: 'pass', seconds: 0 };
    const encode = (row: unknown) => 'suite progress ' + JSON.stringify(row);
    for (const row of [finish, { ...finish, type: 'test', scope: 'load-gate', futureField: true }]) {
      const line = encode(row);
      assert.equal(suiteProgress(line, 1)?.completed.length, 1);
      assert.equal(passAccounting([line], 0).length, 1);
    }
    for (const row of [null, {}, { ...finish, id: 1 }, { ...finish, file: null }, { ...finish, name: false },
      { ...finish, at: '1' }, { ...finish, at: null }, { ...finish, nesting: 0.5 }, { ...finish, nesting: '0' }]) {
      const line = encode(row);
      assert.equal(suiteProgress(line, 1), null);
      assert.deepEqual(passAccounting([line], 0), []);
    }
    for (const line of ['suite progress {torn', 'ordinary output', 'suite progress']) {
      assert.equal(suiteProgress(line, 1), null);
      assert.deepEqual(passAccounting([line], 0), []);
    }
  });
});

test('pass accounting scans once and counts unique test finishes without envelopes or invented starts', async t => {
  const owner = fixtureWork();
  t.after(() => owner.close());
  await owner.run(async () => {
    let visits = 0;
    const finish = { event: 'finish', id: 'base', file: 'output.test.ts', name: 'control', at: 1, nesting: 0, outcome: 'pass', seconds: 0 };
    const encode = (row: object) => 'suite progress ' + JSON.stringify(row);
    function* lines() {
      for (let n = 0; n < 10000; n++) { visits++; yield 'ordinary output'; }
      for (const row of [finish, finish, { ...finish, id: 'file', type: 'file' }, { ...finish, id: 'suite', type: 'suite' },
        { ...finish, id: 'fail', outcome: 'fail' }]) { visits++; yield encode(row); }
      visits++; yield 'suite progress null';
    }
    assert.deepEqual(passAccounting(lines(), undefined), ['Pass accounting: aggregate unknown; raw base pass finishes 1 (difference unknown); finishes without retained start: base 1, load-gate 0']);
    assert.equal(visits, 10006, 'one visit per input record');
    assert.deepEqual(passAccounting([encode({ ...finish, event: 'start' }), encode(finish)], 1), []);
    assert.deepEqual(passAccounting([], 3), [], 'legacy aggregate without progress stays unchanged');
  });
});

test('summary discloses finish-only base passes separately from load repetitions', async t => {
  const owner = fixtureWork();
  t.after(() => owner.close());
  await owner.run(async () => {
    const row = { file: 'hub/test/output.test.ts', name: 'output control', at: 1, nesting: 0, type: 'test' };
    const records = [
      { ...row, event: 'start', id: 'paired' },
      { ...row, event: 'finish', id: 'paired', outcome: 'pass', seconds: 0 },
      { ...row, event: 'finish', id: 'base', outcome: 'pass', seconds: 0 },
      { ...row, event: 'finish', id: 'loaded', scope: 'load-gate', outcome: 'pass', seconds: 0 },
    ];
    const log = '# tests 1\n# pass 1\n' + records.map(row => 'suite progress ' + JSON.stringify(row)).join('\n');
    assert.equal(suiteSummary(log), 'tests 1; pass 1\nPass accounting: aggregate 1; raw base pass finishes 2 (difference +1); finishes without retained start: base 1, load-gate 1');
    assert.equal(suiteSummary(log, [], { priorityOnly: true }), suiteSummary(log));
  });
});

test('interrupted metrics disclosure retains native zero and unknown without claiming samples', () => {
  const input = { head: 'head', executor: 'droplet' as const };
  assert.ok(!suiteProvenance(input, []).includes('machine metrics unavailable:'));
  for (const [nativeExit, display] of [[137, '137'], [0, '0'], [null, 'unknown']] as const) {
    const footer = suiteProvenance({ ...input, packageClosure: { state: 'incomplete', nativeExit } }, []);
    const marker = 'machine metrics unavailable: run interrupted before collection; cause: package closure incomplete; foreground exit ' + display;
    assert.ok(footer.includes(marker)); assert.ok(suiteEvidence(footer).includes(marker));
    assert.ok(!footer.includes('suite machine metrics {'), 'unavailable is never an invented measurement');
  }
});

test('accounting distinguishes confirmed spend from pending confirmation', () => {
  assert.equal(suiteAccounting({ executor: 'droplet', machine: { name: 'cland-run', size: 'c-8', region: 'ams3', lifetimeMs: 123000, costUsd: 0.0123 }, workers: 8 }),
    'Executor droplet · c-8 ams3 · cland-run · wall lifetime 123 s · cost $0.0123 · workers 8');
  assert.equal(suiteAccounting({ executor: 'droplet', machine: { lifetimeMs: null, costUsd: null } }),
    'Executor droplet · unknown unknown · unavailable · wall lifetime pending confirmation · cost pending confirmation');
});

function commandLog(line: string, output: string[], code: number, id = 'command-1') {
  return [`$ ${line}`, `suite command start ${JSON.stringify({ id, name: 'test', line })}`, ...output,
    '', `suite command end ${id} ${code}`, `Finished: exit ${code}`].join('\n');
}

test('native runner timing survives semantic retention without changing test results', () => {
  const marker = 'suite runner started 2026-11-17T01:00:00Z';
  const malformed = 'suite runner started ordinary command noise';
  const metrics = 'suite machine metrics {"version":1,"at":1000,"elapsedMs":1000,"load":[2.5,1.25,0.75],"cpuPct":30,"iowaitPct":10,"stealPct":10}';
  const log = marker + '\n' + malformed + '\n' + metrics + '\n' + commandLog('sh test.sh', ['assertion passed'], 0);
  const retained = suiteEvidence(log);
  assert.equal(soakExecutionSeconds(retained, '2026-11-17T01:00:03Z'), 3);
  assert.ok(retained.includes(marker));
  assert.ok(retained.includes(metrics), 'machine samples survive semantic log reduction');
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
