// T1: issue-kind label mapping is pure; CLI import coverage lives in import-github.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindOfLabels } from '../src/tracker/import-github.ts';

test('an issue kind follows its labels as the own-tracker template files them', () => {
  assert.equal(kindOfLabels(['epic', 'slice-1']), 'epic');
  assert.equal(kindOfLabels(['wayfinder:map']), 'map');
  assert.equal(kindOfLabels(['wayfinder:grilling']), 'question');
  assert.equal(kindOfLabels(['wayfinder:research']), 'question');
  assert.equal(kindOfLabels(['wayfinder:task']), 'task');
  assert.equal(kindOfLabels(['ready-for-agent']), 'task');
});
