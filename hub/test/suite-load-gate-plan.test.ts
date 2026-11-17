// T1: soak admission uses planted duration manifests, without native work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soakDeadlinePlan, loadGateCompletionSummary, soakCalibration, soakExecutionSeconds, SOAK_RUNNER_STARTED } from '../src/suite-load-gate-plan.ts';
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

test('marker discovery keeps a two-match allocation budget across large semantic logs', t => {
  const marker = 'suite runner started 2026-11-17T01:00:00Z\n';
  const noise = 'suite progress {"event":"finish","type":"file","outcome":"pass"}\n'.repeat(50000);
  const log = marker + noise + marker + noise;
  const nativeExec = RegExp.prototype.exec;
  let matches = 0;
  t.mock.method(RegExp.prototype, 'exec', function(this: RegExp, input: string) {
    if (this.source === SOAK_RUNNER_STARTED.source && ++matches > 2) throw new Error('marker scan exceeded two regex-result allocations');
    return nativeExec.call(this, input);
  });
  assert.equal(soakExecutionSeconds(log, '2026-11-17T01:00:03Z'), null);
  assert.equal(matches, 2);
});

test('soak execution interval uses remote receipts and leaves missing or invalid time unknown', () => {
  const start = 'suite runner started 2026-11-17T01:00:00Z\n';
  assert.equal(soakExecutionSeconds(start, '2026-11-17T01:00:03Z'), 3);
  assert.equal(soakExecutionSeconds('', '2026-11-17T01:00:03Z'), null);
  assert.equal(soakExecutionSeconds('suite runner started invalid\n', '2026-11-17T01:00:03Z'), null);
  assert.equal(soakExecutionSeconds(start, '2026-11-17T00:59:59Z'), null);
  assert.equal(soakExecutionSeconds(start, '2026-11-17T01:00:00Z'), null);
  assert.equal(soakExecutionSeconds(start + start, '2026-11-17T01:00:03Z'), null);
  assert.equal(soakExecutionSeconds('suite runner started 2026-11-17T01:00:00.000Z\n', '2026-11-17T01:00:03Z'), null);
});

test('soak calibration retains its floor and uses a larger later completion ratio', () => {
  assert.equal(soakCalibration(null), 2.17);
  assert.equal(soakCalibration({ projected: 100, observed: 50 }), 2.17);
  assert.equal(soakCalibration({ projected: 100, observed: 300 }), 3);
  assert.equal(soakCalibration({ projected: 0, observed: 300 }), 2.17);
  assert.equal(soakCalibration({ projected: 100, observed: NaN }), 2.17);
});

test('soak calibrates worker projections from observed history and trims an oversized base', () => {
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
  const fittedBase = soakDeadlinePlan(selection, plan, manifest, 4500000);
  assert.ok(fittedBase.shard);
  assert.match(fittedBase.reason, /unexecuted coverage/);
  assert.match(fittedBase.reason, /base calibration 2.17.*A-19799/);
  // A larger existing deadline can fit the same complete base, with the reserve
  // intact, but still trims expensive new repetitions.
  manifest.tests[`${plan[2]!.files[0]}::expensive`] = 300;
  const fitted = soakDeadlinePlan(selection, plan, manifest, 9000000);
  assert.deepEqual(fitted.loadGateTests, [`${file}::repeat`]);
  assert.match(fitted.reason, /20% margin/);
});

test('rotating base keeps each tier and advances through every file within its cycle', () => {
  const manifest: DurationManifest = { version: 1, source: { artifacts: [], commit: 'fake' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {} };
  const plan: TierPlan = (['T1', 'T4', 'Web'] as const).map(tier => {
    const files = [0, 1, 2].map(i => `${tier === 'Web' ? 'web' : 'hub'}/test/${tier}-${i}.test.ts`);
    for (const file of files) manifest.files[file] = { seconds: 10, tests: 1 };
    return { tier, files, seconds: 30, projectedWall: 30, workers: 1, missing: 0, tests: 3 };
  });
  const cursors: Record<string, number> = {};
  const seen = new Set<string>();
  for (let night = 0; night < 3; night++) {
    const selection = soakDeadlinePlan({ mode: 'full', files: [], reason: 'soak', soak: true }, plan, manifest, 175000, cursors);
    const files = [...selection.shard!.files, ...selection.batchTests!.Web!];
    assert.equal(files.length, 3);
    for (const row of plan) {
      const selected = row.files.filter(file => files.includes(file));
      assert.equal(selected.length, 1);
      cursors[row.tier] = (cursors[row.tier] ?? 0) + selected.length;
    }
    for (const file of files) seen.add(file);
    assert.match(selection.reason, /full cycle at most 3 admitted nights/);
    assert.match(selection.reason, /projected 68.1 s <= 80.0 s/);
  }
  assert.equal(seen.size, 9);
});
