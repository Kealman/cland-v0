import test from 'node:test';
import assert from 'node:assert/strict';
import { planFixtureEntry } from '../../shared/fixture-cleanup-plan.ts';

test('historical roots and aliases without positive closure stay retained despite an empty process census', () => {
  for (const name of ['cland-h-' + 'a'.repeat(20), 'hc-live', 'cland-account-fixture-live', 'cland-suite-live', 'ct-' + 'a'.repeat(32)]) {
    assert.deepEqual(planFixtureEntry(name, null), { eligible: false, reason: 'no positive alias closure proof' });
  }
});
