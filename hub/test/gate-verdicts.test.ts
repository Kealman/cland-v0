// T1: merge verdict freshness guidance uses only annotated in-memory evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { gateVerdicts } from '../src/tracker/gate-verdicts.ts';
import { MergeError } from '../src/merge.ts';
import type { ItemView } from '../src/tracker/tracker.ts';

function evidence(kind: 'review' | 'qa', current: boolean | undefined): ItemView {
  return {
    id: 'T-12', kind: 'task', title: 'Merge evidence', state: 'open', rank: 120,
    labels: [], assignee: null, parent: null, blocked_by: [], topic: null,
    branch: 't/T-12', created: '', updated: '', file: 'T-12.md', path: 'T-12.md',
    ancestry: [], verdictBase: 'dev', body: '', plan: null, claim: null, holds: [],
    comments: [], criteriaWarnings: [],
    criteriaCounts: { total: 0, done: 0, verified: 0, stale: 0, failed: 0 },
    criteria: [], qaPolicy: { scope: 'full', when: 'per-item' },
    verdicts: (['review', 'qa'] as const).map(verdict => ({
      verdict, result: 'clear', source: 'hub', run: 'source-review',
      by: verdict, author: verdict, at: '',
      writer: { role: verdict === 'review' ? 'reviewer' : 'qa', sessionId: verdict },
      ...(verdict !== kind ? { current: true } : current === undefined ? {} : { current }),
    })),
  };
}

for (const kind of ['review', 'qa'] as const) {
  test(`pending ${kind} freshness tells the merger to wait for ready and inspect the item`, () => {
    assert.throws(() => gateVerdicts(evidence(kind, undefined)), error => {
      assert.ok(error instanceof MergeError);
      assert.equal(error.code, `${kind}-pending`);
      assert.match(error.message, /wait for .*ready/i);
      assert.match(error.message, /cland task view T-12/);
      assert.doesNotMatch(error.message, /try again/i);
      return true;
    });
  });
  test(`stale ${kind} evidence still refuses merge`, () => {
    assert.throws(() => gateVerdicts(evidence(kind, false)), error => {
      assert.ok(error instanceof MergeError);
      assert.equal(error.code, `${kind}-stale`);
      assert.equal(error.message, `${kind}-stale: T-12: ${kind} is stale`);
      return true;
    });
  });
}

test('current independent clear verdicts still satisfy the merge gate', () => {
  const result = gateVerdicts(evidence('review', true));
  assert.equal(result.review.current, true);
  assert.equal(result.qa?.current, true);
});
