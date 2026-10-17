// T1: tier accounting and run-summary rendering use planted plans and receipts in-process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tierReport, type TierPlan } from '../src/suite-tier-report.ts';
import { suiteSummary } from '../src/hub/suites.ts';

const plan: TierPlan = [
  { tier: 'T1', files: ['unit'], tests: 2, seconds: 200, projectedWall: 200, workers: 1, missing: 0 },
  { tier: 'T2', files: ['component'], tests: 3, seconds: 300, projectedWall: 300, workers: 2, missing: 0 },
  { tier: 'T3', files: ['integration'], tests: 4, seconds: 400, projectedWall: 400, workers: 2, missing: 0 },
  { tier: 'T4', files: ['soak'], tests: 1, seconds: 100, projectedWall: 100, workers: 2, missing: 0 },
];

test('run summary carries tier counts, observed test-seconds and manifest share', () => {
  const receipts = [{ file: 'unit', name: 'one', seconds: 0.25 }, { file: 'component', name: 'two', seconds: 0.5 }];
  const lines = tierReport(plan, receipts);
  const summary = suiteSummary('# tests 2\n# pass 2\n' + lines.join('\n'));
  assert.match(summary, /tier T1: files 1; tests 1; observed 0.25 s; projected wall 200 s at 1 workers; wall budget 120 s; over wall \(report only\)/);
  assert.match(summary, /tier T2: files 1; tests 1; observed 0.5 s; projected wall 300 s at 2 workers; wall budget 480 s/);
  assert.match(summary, /tier T3: files 1; tests 0; observed unavailable; projected wall 400 s at 2 workers; wall budget 900 s/);
  assert.match(summary, /tier T4:.*wall budget none/);
  assert.match(summary, /tier share: T1\+T2 50 % of 1000 s \(T3 400 s, T4 100 s\)$/);
  assert.match(summary, /^tests 2; pass 2/);
});

test('dry-run tier lines distinguish planned counts from absent execution evidence', () => {
  const lines = tierReport(plan);
  assert.match(lines[0]!, /tests 2 planned; observed unavailable/);
  assert.match(lines[0]!, /over wall \(report only\)/);
});


test('close-run summary retains the aggregate census after differently ordered shard tiers', () => {
  const child = tierReport([plan[2]!], [{ file: 'integration', name: 'scenario', seconds: 1 }]);
  const aggregate = tierReport(plan, [{ file: 'component', name: 'component', seconds: 2 }]);
  const summary = suiteSummary([...child, ...aggregate].join('\n'));
  assert.equal(summary.split('tier T3:').length - 1, 1);
  assert.ok(summary.indexOf('tier T2:') < summary.indexOf('tier T3:'));
  assert.match(summary, /tier share: T1\+T2 50 % of 1000 s \(T3 400 s, T4 100 s\)$/);
});
