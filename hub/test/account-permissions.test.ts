// T1: fixed account.clear role boundary, even with a forged grant; one frame proof stays in account-limited.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/roles/permissions.ts';
test('account.clear permits only the Coordinator among role shells', () => {
  for (const role of ['implementer', 'reviewer', 'qa', 'lead', 'aide', null]) {
    const result = decide(role, ['account.clear'], { tool: 'account.clear' });
    assert.equal(result.ok, false, String(role));
    if (!result.ok) {
      assert.equal(result.permission, 'account.clear');
      assert.match(result.reason, /Coordinator or the human/);
    }
  }
  assert.deepEqual(decide('coordinator', undefined, { tool: 'account.clear' }), { ok: true });
});
