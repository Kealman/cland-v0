// T1: soak admission uses planted duration manifests, without native work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soakDeadlinePlan, loadGateCompletionSummary } from '../src/suite-load-gate-plan.ts';
import type { TierPlan } from '../src/suite-tier-report.ts';
import type { DurationManifest } from '../src/suite-durations.ts';

test('load repetition summary requires positive completion and preserves ambiguous legacy failures', () => {
  const file = 'hub/test/example.test.ts';
  const line = (name: string, result: string) => `load gate: ${file}::${name} ${result}\n`;
  assert.deepEqual(loadGateCompletionSummary(line('pass', '5/5 passed').repeat(2)), { complete: 1, unknown: 0 });
  assert.deepEqual(loadGateCompletionSummary('quarantine ' + line('quarantined', '3/5 passed; 2/5 quarantined failures')), { complete: 1, unknown: 0 });
  assert.deepEqual(loadGateCompletionSummary(line('skipped', 'skipped, not load-gated; 5/5 skipped; reasons: ["missing binary"]')), { complete: 0, unknown: 0 });
  // Both a fully failed legacy run and an interrupted run can emit this shape.
  for (const name of ['complete failure without attempt receipt', 'interrupted']) {
    assert.deepEqual(loadGateCompletionSummary('✖ ' + line(name, '3/5 passed')), { complete: 0, unknown: 1 });
  }
  assert.deepEqual(loadGateCompletionSummary('quarantine ' + line('partial', '2/5 passed; 2/5 quarantined failures')), { complete: 0, unknown: 1 });
  assert.deepEqual(loadGateCompletionSummary(`load gate start: ${file}::pending; five repetitions alongside phase\n`), { complete: 0, unknown: 1 });
  assert.deepEqual(loadGateCompletionSummary(`load gate start: ${file}::pass; five repetitions alongside phase\n` + line('pass', '5/5 passed')), { complete: 1, unknown: 0 });
  assert.deepEqual(loadGateCompletionSummary(line('pass', '5/5 passed') + '✖ ' + line('interrupted', '3/5 passed')), { complete: 1, unknown: 1 });
  assert.deepEqual(loadGateCompletionSummary(`load gate start: ${file}::skipped; five repetitions alongside phase\n` + line('skipped', 'skipped, not load-gated; 5/5 skipped; reasons: ["missing binary"]')), { complete: 0, unknown: 0 });
});

test('soak reserves all tier file costs before spending on repetitions', () => {
  // A-19799 baseline totals and worker projections, including Web. Its actual
  // T0–T4 wall was already 4480 s, before Web completed, on a 4500 s deadline.
  const samples = [
    ['T1', 220, 32.524, 32.524], ['T2', 425, 760.374, 380.213],
    ['T3', 267, 3111.517, 1556.012], ['T4', 17, 194.847, 98.236],
    ['Web', 55, 405.690, 202.870],
  ] as const;
  const manifest: DurationManifest = { version: 1, source: { artifacts: [], commit: 'fake' },
    budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {} };
  const plan: TierPlan = samples.map(([tier, count, seconds, projectedWall]) => {
    const files = Array.from({ length: count }, (_, i) => `${tier === 'Web' ? 'web' : 'hub'}/test/${tier}-${i}.test.ts`);
    for (const file of files) manifest.files[file] = { seconds: seconds / count, tests: 1 };
    return { tier, files, seconds, projectedWall, workers: tier === 'T1' ? 1 : 2, tests: count, missing: 0 };
  });
  const file = plan[0]!.files[0]!;
  manifest.tests[`${file}::repeat`] = 1;
  const selection = { mode: 'full' as const, files: [], reason: 'soak', loadGate: true, loadGateBaseline: { run: null, tests: [] } };
  assert.throws(() => soakDeadlinePlan(selection, plan, manifest, 4500000), /soak deadline plan refused: base projection/);
  // A larger existing deadline can fit the same complete base, with the reserve
  // intact, but still trims expensive new repetitions.
  manifest.tests[`${plan[2]!.files[0]}::expensive`] = 300;
  const fitted = soakDeadlinePlan(selection, plan, manifest, 7200000);
  assert.deepEqual(fitted.loadGateTests, [`${file}::repeat`]);
  assert.match(fitted.reason, /20% margin/);
});
