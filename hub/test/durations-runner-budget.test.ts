// T1: the runner's duration decision consumes planted receipts, without real waits or workers.
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDurations, lintDurationManifest, type DurationManifest } from '../src/suite-durations.ts';

const file = 'hub/test/component.test.ts', key = `${file}::known slow`;
const manifest = (): DurationManifest => ({ version: 1, source: { artifacts: [], commit: 'fixture' },
  budget: { mode: 'enforce', testSeconds: 5, fileSeconds: 60 }, files: { [file]: { seconds: 2.5, tests: 1 } }, tests: { [key]: 2.5 }, allow: {} });

test('runner duration decision fails a known T2 test at 2.5 seconds until a valid allowance covers it', () => {
  const head = manifest(), receipts = [{ file, name: 'known slow', seconds: 2.5 }];
  const tiers = { [file]: 'T2' } as const;
  assert.deepEqual(checkDurations(receipts, head, tiers).failures, [
    `duration budget: ${key} 2.5 s > 2 s (T2) (add to hub/test/durations.json with a reason)`,
  ]);
  head.allow[key] = { seconds: 2.5, owner: 'T-1', added: '2026-10-18', expires: '2026-10-24', reason: 'Temporary component migration.' };
  lintDurationManifest(head, { now: Date.parse('2026-10-18'), owners: { 'T-1': 'open' } });
  assert.deepEqual(checkDurations(receipts, head, tiers).failures, []);
  head.allow[key]!.seconds = 2.4;
  assert.equal(checkDurations(receipts, head, tiers).failures.length, 1, 'allowance caps the permitted seconds');
  delete head.allow[key];
  head.allow[file] = { file: true, seconds: 30, owner: 'E-677', legacy: true, reason: 'Existing file aggregation.' };
  assert.equal(checkDurations(receipts, head, tiers).failures.length, 1, 'file allowances do not cover individual tests');
});

test('enforce mode requires a separate file allowance and leaves T4 unbounded', () => {
  const head = manifest(), receipts = [{ file, name: 'first', seconds: 16 }, { file, name: 'second', seconds: 16 }];
  head.budget.T2 = { testSeconds: 20, fileSeconds: 30, wallSeconds: 480 };
  head.files[file] = { seconds: 32, tests: 2 };
  assert.deepEqual(checkDurations(receipts, head, { [file]: 'T2' }).failures, [
    `duration budget: ${file} 32 s > 30 s (T2) (add to hub/test/durations.json with a reason)`,
  ]);
  head.allow[file] = { seconds: 32, file: true, legacy: true, owner: 'E-677', reason: 'Existing component aggregation.' };
  assert.deepEqual(checkDurations(receipts, head, { [file]: 'T2' }).failures, []);
  assert.deepEqual(checkDurations(receipts, head, { [file]: 'T4' }).failures, []);
});

test('duration mode validation preserves omitted and explicit report modes', () => {
  const head = manifest();
  for (const mode of [undefined, 'report'] as const) {
    if (mode === undefined) delete head.budget.mode;
    else head.budget.mode = mode;
    lintDurationManifest(head);
    assert.deepEqual(checkDurations([{ file, name: 'known slow', seconds: 2.5 }], head, { [file]: 'T2' }).failures, []);
  }
  assert.throws(() => lintDurationManifest({ ...head, budget: { ...head.budget, mode: 'invalid' } } as unknown as DurationManifest), /invalid duration budget mode/);
});
