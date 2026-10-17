// T1: identity fallback is pure policy; no process or socket is started.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tierTestName } from './tier-context.ts';

test('older Node keeps file-only attribution with one missing-API warning', () => {
  const warnings: string[] = [];
  const name = tierTestName(undefined, line => warnings.push(line));
  assert.equal(name(), '(file only)');
  assert.equal(name(), '(file only)');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /node:test.getTestContext unavailable/);
});

test('resource calls query the current nested test or identify file setup', () => {
  let context: { fullName: string } | undefined;
  const name = tierTestName(() => context, () => assert.fail('API is present'));
  assert.equal(name(), '(module initialization or file cleanup)');
  context = { fullName: 'parent > nested' };
  assert.equal(name(), 'parent > nested');
});
