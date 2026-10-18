// T1: planted timing manifests and Suites reports on semantic worker receipts; no processes or wall-clock waits.
import assert from 'node:assert/strict';
import test from 'node:test';
import { durationBudgetReport, type DurationBudgetContext } from '../src/suite-duration-budget.ts';
import type { DurationManifest } from '../src/suite-durations.ts';
import { suiteUnit } from './suite-unit-fixture.ts';

const manifest = (): DurationManifest => ({ version: 1, source: { artifacts: [], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {} });

test('Suites budget reports use supplied history without a repository', async t => {
  const before = manifest(), current = manifest();
  const file = 'hub/test/history.test.ts';
  before.files[file] = { seconds: 8, tests: 2 };
  before.tests = { [`${file}::keep`]: 5, [`${file}::removed`]: 3 };
  current.allow[`${file}::keep`] = { seconds: 6, legacy: true, owner: 'E-677', reason: 'Planted existing allowance.' };
  const tiers = { [file]: 'T3' } as const;
  const durationContext: DurationBudgetContext = { manifest: current, tiers, base: {
    manifest: before, tiers, retained: [`${file}::keep`], sources: { [file]: { patterns: ['^keep$', '^removed$'], dynamic: false } },
  } };
  const f = await suiteUnit(t, { durationContext });
  const preview = await f.suites.start({ mode: 'auto', cwd: f.root, topic: 'unit-topic', to: [], actor: null, dryRun: true }, () => {});
  assert.ok('dryRun' in preview);
  assert.ok(preview.lines.includes('T3 ratchet (report only): 5 s vs base 8 s'));
  assert.ok(preview.lines.includes('budget legacy allowances: 1; 6 s; owner E-677'));
  const job = await f.launch();
  await f.finish(job.id, 0, `# tests 1\n# pass 1\nsuite timing ${JSON.stringify({ file, name: 'new', seconds: 2 })}\n`);
  const log = await f.log(job.id);
  assert.match(log, /T3 ratchet \(report only\): 7 s vs base 8 s/);
  assert.match(log, /budget legacy allowances: 1; 6 s; owner E-677/);
});

test('tier budgets rank all observed identities, naming missing baselines', () => {
  const head = manifest();
  head.tests['known::slow'] = 20;
  head.files.known = { seconds: 20, tests: 1 };
  const report = durationBudgetReport(head, { known: 'T1', missing: 'T2', soak: 'T4' }, [
    { file: 'known', name: 'slow', seconds: 20 }, { file: 'missing', name: 'new', seconds: 35 }, { file: 'soak', name: 'long', seconds: 1000 },
  ]);
  assert.deepEqual(report.slice(0, 4), [
    'budget (report only): would fail missing::new 35 s > 2 s (T2)',
    'budget (report only): would fail known::slow 20 s > 0.5 s (T1)',
    'budget (report only): would fail known 20 s > 10 s (T1)',
    'budget (report only): would fail missing 35 s > 30 s (T2)',
  ]);
  assert.ok(report.includes('budget (report only): missing duration baseline missing; observed 35 s (T2)'));
  assert.equal(report.some(line => line.includes('would fail soak')), false);
});

test('T3 projection removes retired identities and charges new or promoted tests once', () => {
  const before = manifest();
  before.files = { integration: { seconds: 10, tests: 2 }, moved: { seconds: 4, tests: 1 }, component: { seconds: 1, tests: 1 } };
  before.tests = { 'integration::keep': 6, 'integration::removed': 4, 'moved::old': 4, 'component::promoted': 1 };
  const tiers = { integration: 'T3', moved: 'T3', component: 'T2' } as const;
  const base = { manifest: before, tiers, retained: Object.keys(before.tests), sources: { integration: { patterns: ['^keep$', '^removed$'], dynamic: false } } };
  const added = [{ file: 'integration', name: 'new', seconds: 3 }];
  assert.ok(durationBudgetReport(manifest(), tiers, added, base).includes('T3 ratchet (report only): 17 s vs base 14 s; would refuse growth (needs T3 allowance)'));
  const reduced = durationBudgetReport(manifest(), { ...tiers, moved: 'T2' }, [...added, ...added], { ...base, retained: ['integration::keep'] });
  assert.ok(reduced.includes('T3 ratchet (report only): 9 s vs base 14 s'));
  const promoted = durationBudgetReport(manifest(), { ...tiers, component: 'T3' }, [{ file: 'component', name: 'promoted', seconds: 2 }], base);
  assert.ok(promoted.includes('T3 ratchet (report only): 16 s vs base 14 s; would refuse growth (needs T3 allowance)'));
  const head = manifest();
  head.allow.T3 = { seconds: 17, owner: 'T-1', added: '2026-10-17', expires: '2026-10-24', reason: 'Curated lifecycle coverage.' };
  assert.ok(durationBudgetReport(head, tiers, added, base).includes('T3 ratchet (report only): 17 s vs base 14 s; allowed'));
});

test('allowance lint names bad reasons, owners and dates while legacy entries follow owner closure', async () => {
  const { lintDurationManifest } = await import('../src/suite-durations.ts');
  const head = manifest();
  const key = 'known::slow';
  const entry = { seconds: 6, reason: 'Curated lifecycle coverage.', owner: 'T-1', added: '2026-10-17', expires: '2026-10-24' };
  const now = Date.parse('2026-10-17');
  const owners = { 'T-1': 'open', 'T-2': 'closed', 'E-677': 'open' } as const;
  for (const [patch, message] of [
    [{ reason: 'TODO explain' }, /non-TODO reason/], [{ owner: '' }, /owner/], [{ owner: 'T-2' }, /closed owner/], [{ owner: 'T-3' }, /unknown owner/],
    [{ expires: '2026-10-25' }, /seven days/], [{ expires: '2026-10-17' }, /seven days/], [{ added: '2026-10-09', expires: '2026-10-16' }, /expired/],
    [{ expires: '2026-02-30' }, /seven days/],
  ] as const) {
    head.allow[key] = { ...entry, ...patch };
    assert.throws(() => lintDurationManifest(head, { now, owners }), error => error instanceof Error && message.test(error.message) && error.message.includes(key));
  }
  head.allow[key] = entry;
  assert.doesNotThrow(() => lintDurationManifest(head, { now, owners }));
  head.allow[key] = { seconds: 6, reason: 'Original reason.', owner: 'E-677', legacy: true };
  assert.doesNotThrow(() => lintDurationManifest(head, { now, owners }));
  assert.throws(() => lintDurationManifest(head, { now, owners: { ...owners, 'E-677': 'closed' } }), /closed owner.*known::slow/);
});

test('result summaries cap ranked overages at ten and retain legacy progress separately', async () => {
  const { durationBudgetSummary } = await import('../src/suite-duration-budget.ts');
  const head = manifest();
  head.allow['file::legacy'] = { seconds: 6, reason: 'Original reason.', owner: 'E-677', legacy: true };
  const report = durationBudgetReport(head, { file: 'T1' }, Array.from({ length: 12 }, (_, i) => ({ file: 'file', name: `n${i}`, seconds: i + 1 })));
  assert.equal(report.filter(line => line.startsWith('budget (report only): would fail ')).length, 13);
  const summary = durationBudgetSummary(report);
  assert.equal(summary.filter(line => line.startsWith('budget (report only): would fail ')).length, 10);
  assert.equal(summary[0], 'budget (report only): would fail file 78 s > 10 s (T1)');
  assert.ok(summary.includes('budget legacy allowances: 1; 6 s; owner E-677'));
});

test('result summaries count missing baselines without copying per-file diagnostics', async () => {
  const { durationBudgetSummary } = await import('../src/suite-duration-budget.ts');
  const lines = Array.from({ length: 400 }, (_, n) => `budget (report only): missing duration baseline file-${n}; observed 1 s (T2)`);
  assert.deepEqual(durationBudgetSummary(lines), ['budget missing baselines: 400']);
  assert.deepEqual(durationBudgetSummary(lines.map(line => line.replace(' (report only)', ''))), ['budget missing baselines: 400']);
});

test('uncertain source identity does not invent T3 growth from missing timing keys', () => {
  const before = manifest();
  const tiers = { existing: 'T3' } as const;
  for (const sources of [{}, { existing: { patterns: [], dynamic: true } }]) {
    const report = durationBudgetReport(manifest(), tiers, [{ file: 'existing', name: 'generated', seconds: 3 }], { manifest: before, tiers, retained: [], sources });
    const ratchet = report.find(line => line.startsWith('T3 ratchet (report only):'))!;
    assert.match(ratchet, /^T3 ratchet \(report only\): 0 s vs base 0 s/);
    assert.match(ratchet, /incomplete base timings/);
    assert.match(ratchet, /uncertain source identity \(1 observed tests retained\)/);
    assert.doesNotMatch(ratchet, /would refuse growth/);
  }
});
