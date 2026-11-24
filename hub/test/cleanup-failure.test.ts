import test from 'node:test';
import assert from 'node:assert/strict';
import { withCleanupFailure } from '../src/cleanup-failure.ts';

test('cleanup diagnostics keep primary identity and its existing cause', () => {
  const cause = new Error('original cause'), primary = new Error('initialization failed', { cause });
  const cleanup = new Error('close failed');
  assert.equal(withCleanupFailure(primary, cleanup), primary);
  assert.ok(primary.cause instanceof AggregateError);
  assert.deepEqual(primary.cause.errors, [cause, cleanup]);
});

for (const primary of [Object.freeze(new Error('frozen failure')), undefined, 'initialization failed']) {
  test(`cleanup diagnostics retain an unmodifiable primary (${typeof primary})`, () => {
    const cleanup = new Error('close failed');
    const actual = withCleanupFailure(primary, cleanup);
    assert.ok(actual instanceof AggregateError);
    assert.equal(actual.cause, primary);
    assert.deepEqual(actual.errors, [primary, cleanup]);
  });
}
