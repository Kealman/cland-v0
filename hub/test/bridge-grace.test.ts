// T1: the shipped bridge grace and its explicit test override.
import assert from 'node:assert/strict';
import test from 'node:test';
import { BRIDGE_GRACE_MS, bridgeGraceMs } from '../src/cli/hook-timing.ts';

test('bridge reconnect grace defaults to sixty seconds', () => {
  assert.equal(BRIDGE_GRACE_MS, 60_000);
  for (const value of [undefined, '', '0', '-1', 'NaN', 'Infinity']) {
    assert.equal(bridgeGraceMs({ CLAND_TEST_BRIDGE_GRACE_MS: value }), 60_000);
  }
  assert.equal(bridgeGraceMs({ CLAND_TEST_BRIDGE_GRACE_MS: '2000' }), 2000);
});
