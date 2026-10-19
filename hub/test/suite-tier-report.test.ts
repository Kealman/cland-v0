// T1: tier accounting and run-summary rendering use planted plans and receipts in-process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planTierReport, tierReport, taskTierEvidence, type TierPlan } from '../src/suite-tier-report.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

test('tier planning enforces supplied legacy allowance history without a repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tier-history-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, 'hub/test/one.test.ts'), '');
  await writeFile(join(root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: { 'hub/test/one.test.ts': 'T1' } }));
  await writeFile(join(root, '.cland/tasks/E-677-fixture.md'), '---\nid: E-677\nkind: epic\ntitle: Allowance owner\nstate: open\n---\n');
  const key = 'hub/test/one.test.ts::recorded';
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({
    version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 5, fileSeconds: 60 },
    files: { 'hub/test/one.test.ts': { seconds: 2, tests: 1 } }, tests: {},
    allow: { [key]: { seconds: 6, legacy: true, owner: 'E-677', reason: 'Recorded before tier budgets.' } },
  }));
  const selection = { mode: 'full' as const, files: [], reason: 'fixture' };
  const planned = await planTierReport(root, selection, 2, undefined, { legacyKeys: new Set([key]) });
  assert.deepEqual(planned.map(({ tier, files, tests, seconds }) => ({ tier, files, tests, seconds })), [
    { tier: 'T1', files: ['hub/test/one.test.ts'], tests: 1, seconds: 2 },
  ]);
  await assert.rejects(planTierReport(root, selection, 2, undefined, { legacyKeys: new Set() }), /new duration allowance cannot be legacy/);
});

test('task evidence names deferred T3 with the current merge queue state', () => {
  const selection = { mode: 'full' as const, files: [], reason: 'task', tiers: ['T1', 'T2'] as const };
  const task = { ...selection, tiers: [...selection.tiers] };
  const entry = { item: 'T-713', branch: 't/T-713', head: 'head', verdictBase: 'dev', enqueued: 'time', by: { id: 'id', name: 'lead', role: 'coordinator' } };
  assert.equal(taskTierEvidence(task, { enabled: true, entries: [], batch: null }, 'T-713'), 'T3: in the merge batch; queue enabled; item awaiting enqueue; batch idle');
  assert.equal(taskTierEvidence(task, { enabled: true, entries: [entry], batch: { id: 'batch-1', members: [entry], run: 'run-1' } }, 'T-713'), 'T3: in the merge batch; queue position 1; batch batch-1 (run-1)');
  assert.match(taskTierEvidence(task, { enabled: false, entries: [], batch: null }, 'T-713')!, /queue disabled; process evidence unavailable/);
  assert.equal(taskTierEvidence({ mode: 'full', files: [], reason: 'integrated' }, { enabled: true, entries: [], batch: null }, null), null);
});
