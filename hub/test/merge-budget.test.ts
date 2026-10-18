// T1: merge admission policy over immutable candidate/base manifest facts.
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkMergeBudgets, type DurationBudgetContext } from '../src/suite-duration-budget.ts';
import type { DurationManifest } from '../src/suite-durations.ts';

const manifest = (): DurationManifest => ({ version: 1, source: { artifacts: [], commit: 'fixture' },
  budget: { mode: 'enforce', testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {} });
function context(): DurationBudgetContext {
  const before = manifest(), head = manifest();
  before.files.integration = { seconds: 10, tests: 1 };
  before.tests['integration::old'] = 10;
  head.files.integration = { seconds: 13, tests: 2 };
  head.tests = { 'integration::old': 10, 'integration::new': 3 };
  const tiers = { integration: 'T3' } as const;
  return { manifest: head, tiers, base: { manifest: before, tiers, retained: ['integration::old'], sources: { integration: { patterns: ['^old$'], dynamic: false } } } };
}

test('merge-budget refuses T3 growth until a T3 allowance covers the projected total', () => {
  const current = context();
  assert.deepEqual(checkMergeBudgets(current, 4).failures, ['merge-budget: T3 growth 13 s > base 10 s (needs T3 allowance)']);
  current.manifest.allow.T3 = { seconds: 13, owner: 'T-1', added: '2026-10-18', expires: '2026-10-24', reason: 'New curated lifecycle coverage.' };
  assert.deepEqual(checkMergeBudgets(current, 4).failures, []);
  current.manifest.budget.mode = 'report';
  delete current.manifest.allow.T3;
  assert.deepEqual(checkMergeBudgets(current, 4).failures, []);
});

test('merge-budget projects the T2 wall at configured workers over the whole manifest', () => {
  const current = context();
  current.manifest.tests = { 'integration::old': 10 };
  current.manifest.files = { integration: { seconds: 10, tests: 1 }, a: { seconds: 300, tests: 1 }, b: { seconds: 300, tests: 1 } };
  current.tiers = { integration: 'T3', a: 'T2', b: 'T2' };
  assert.deepEqual(checkMergeBudgets(current, 1).failures, ['merge-budget: T2 projected wall 600 s > 480 s at 1 workers']);
  assert.deepEqual(checkMergeBudgets(current, 2).failures, []);
  current.manifest.budget.mode = 'report';
  assert.deepEqual(checkMergeBudgets(current, 1).failures, []);
});

test('T3 wall enforcement starts only after the base projection is under 900 seconds', () => {
  for (const baseSeconds of [2640, 900, 899]) {
    const current = context();
    current.base!.manifest.files.integration!.seconds = baseSeconds;
    current.base!.manifest.tests['integration::old'] = baseSeconds;
    current.manifest.files.integration = { seconds: 901, tests: 1 };
    current.manifest.tests = { 'integration::old': 901 };
    const result = checkMergeBudgets(current, 1);
    assert.deepEqual(result.failures, baseSeconds < 900 ? ['merge-budget: T3 projected wall 901 s > 900 s at 1 workers'] : []);
    assert.deepEqual(result.lines, baseSeconds >= 900 ? [`T3 wall 900 s not yet enforced: base ${baseSeconds} s`] : []);
  }
});

test('unmeasured new T3 source identities use the tier budget estimate at admission', () => {
  const current = context();
  current.manifest.tests = { 'integration::old': 10 };
  current.manifest.files.integration = { seconds: 10, tests: 1 };
  current.candidateSources = { integration: { patterns: ['^old$', '^new$'], dynamic: false } };
  assert.deepEqual(checkMergeBudgets(current, 4).failures, [
    'merge-budget: T3 growth 20 s > base 10 s (needs T3 allowance); 10 s estimated (no receipt)',
  ]);
  current.manifest.allow.T3 = { seconds: 20, owner: 'T-1', added: '2026-10-18', expires: '2026-10-24', reason: 'Estimated new lifecycle test.' };
  assert.deepEqual(checkMergeBudgets(current, 4).failures, []);
  assert.match(checkMergeBudgets(current, 4).lines.join('\n'), /10 s estimated \(no receipt\)/);
  current.manifest.budget.mode = 'report';
  assert.deepEqual(checkMergeBudgets(current, 4), { failures: [], lines: [] });
});
