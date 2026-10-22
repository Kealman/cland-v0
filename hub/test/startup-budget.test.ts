// T1: the copied-tracker probe's membership assertions; no hub, processes or I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStartupItems } from '../../test-support/startup-budget.ts';

const items = [
  { id: 'R-1', kind: 'release', state: 'closed' },
  { id: 'C-2', kind: 'category', state: 'closed' },
  { id: 'E-3', kind: 'epic', state: 'closed', parent:'R-1' },
  { id: 'E-4', kind: 'epic', state: 'open', parent:'C-2' },
  { id: 'T-5', kind: 'task', state: 'open', parent:'E-3' },
  { id: 'T-6', kind: 'task', state: 'closed' },
  { id: 'Q-7', kind: 'question', state: 'closed' },
  { id: 'S-8', kind: 'spec', state: 'closed' },
  { id: 'M-9', kind: 'map', state: 'closed' },
  { id: 'R-10', kind: 'release', state: 'closed' },
  { id: 'E-11', kind: 'epic', state: 'closed', parent:'R-10' },
];
const expected = ['R-1', 'C-2', 'E-3', 'E-4', 'T-5'];

test('startup probe accepts open items and their ancestors while omitting fully closed subtrees', () => {
  assertStartupItems(items, expected.toReversed(), expected);
});

test('startup probe rejects missing, extra and duplicate wire or installed rows', () => {
  for (const invalid of [
    expected.filter(id => id !== 'E-3'),
    expected.filter(id => id !== 'T-5'),
    ...['T-6','Q-7','S-8','M-9','R-10','E-11'].map(id=>[...expected,id]),
    [...expected, 'T-999'],
    [...expected, 'R-1'],
  ]) {
    assert.throws(() => assertStartupItems(items, invalid, expected), /first wire payload/);
    assert.throws(() => assertStartupItems(items, expected, invalid), /all startup summaries/);
  }
});
