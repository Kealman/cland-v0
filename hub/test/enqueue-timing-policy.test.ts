// T1: immutable admission facts, no native imports or clocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueTimingPolicy } from '../src/enqueue-timing-policy.ts';

test('enqueue refuses absent or mismatched Linux proof independently of manifest timings', () => {
  const identity = { run: 'r', head: 'h', tree: 't' };
  const row = { ...identity, platform: 'linux', command: 'unit', step: 'T1', samples: [{ file: 'unit', name: 'passing anchor', seconds: 0.1, outcome: 'pass' }] };
  assert.equal(enqueueTimingPolicy({ ...identity, receipts: [row], known: [], allow: {}, owner: 'E-1', now: 0 }).kind, 'clear');
  for (const receipts of [undefined, [], [{ ...row, samples: [] }], [{ ...row, head: 'old' }], [{ ...row, tree: 'old' }], [{ ...row, platform: 'darwin' }], [{ ...row, run: 'other' }]]) {
    assert.equal(enqueueTimingPolicy({ ...identity, receipts, known: [], allow: {}, owner: 'E-1', now: 0 }).kind, 'missing');
  }
});

test('new passing Linux identities at four seconds require an allowance with measured headroom', () => {
  const identity = { run: 'r', head: 'h', tree: 't' };
  const sample = { file: 'hub/test/example.test.ts', name: 'case', seconds: 4, outcome: 'pass' };
  const facts = { ...identity, receipts: [{ ...identity, platform: 'linux', command: 'unit', step: 'T1', samples: [sample] }], known: [], allow: {}, owner: 'E-1', now: 0 };
  assert.deepEqual(enqueueTimingPolicy(facts), { kind: 'allowance', stanzas: { 'hub/test/example.test.ts::case': { seconds: 6, owner: 'E-1', added: '1970-01-01', expires: '1970-01-08', reason: 'Linux measured peak 4 s; 1.5x headroom for example.test.ts: case.' } } });
  for (const change of [{ known: ['hub/test/example.test.ts::case'] }, { allow: { 'hub/test/example.test.ts::case': { seconds: 6 } } }]) assert.equal(enqueueTimingPolicy({ ...facts, ...change }).kind, 'clear');
  for (const changed of [{ seconds: 3.999 }, { outcome: 'fail' }, { outcome: 'skip' }, { outcome: 'todo' }]) assert.equal(enqueueTimingPolicy({ ...facts, receipts: [{ ...facts.receipts[0]!, samples: [{ ...sample, name: 'passing anchor', seconds: 0.1 }, { ...sample, ...changed }] }] }).kind, 'clear');
});
