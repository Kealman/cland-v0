import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteRetentionCandidates, suiteRunOldEnough } from '../src/suite-retention-policy.ts';

test('suite retention preserves references, unsettled runs and the newest runs of each occasion', () => {
  const runs = Array.from({ length: 12 }, (_, i) => ({ id: `run-${i}`, occasion: i % 2 ? 'stage' : 'task', sequence: i, settled: true }));
  runs[2]!.settled = false;
  assert.deepEqual(suiteRetentionCandidates(runs, new Set(['run-0']), 2), ['run-1', 'run-3', 'run-4', 'run-5', 'run-6', 'run-7']);
});

test('suite retention refuses invalid retention counts', () => {
  for (const keep of [0, -1, 1.5, NaN]) assert.throws(() => suiteRetentionCandidates([], new Set(), keep));
});

test('suite retention requires a known settled age beyond the seven day floor', () => {
  const now = Date.parse('2026-11-19T00:00:00Z');
  assert.equal(suiteRunOldEnough('2026-11-12T00:00:00Z', now), true);
  assert.equal(suiteRunOldEnough('2026-11-12T00:00:01Z', now), false);
  assert.equal(suiteRunOldEnough(undefined, now), false);
  assert.equal(suiteRunOldEnough('invalid', now), false);
  assert.equal(suiteRunOldEnough('2026-11-20T00:00:00Z', now), false);
});
