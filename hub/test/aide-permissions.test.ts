// T1: the Aide's fixed import/push boundary and the shipped grants, without a shell or hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERMISSIONS, decide } from '../src/roles/permissions.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { parseRoles } from '../src/roles/config.ts';

test('the Aide gains import and push in built-in and shipped permissions only', () => {
  const shipped = parseRoles(DEFAULT_ROLES_TOML);
  for (const tool of ['task.import', 'push']) {
    for (const grants of [DEFAULT_PERMISSIONS.aide, shipped.get('aide')!.permissions.tools]) {
      assert.deepEqual(decide('aide', grants, { tool }), { ok: true }, tool);
    }
    for (const role of ['implementer', 'reviewer', 'qa', 'lead']) {
      for (const grants of [DEFAULT_PERMISSIONS[role], shipped.get(role)!.permissions.tools]) {
        assert.equal(decide(role, grants, { tool }).ok, false, `${role}: ${tool}`);
      }
    }
  }
});

test('extra Aide grants cannot admit release or sync', () => {
  for (const tool of ['release', 'sync']) {
    const decision = decide('aide', [tool], { tool });
    assert.equal(decision.ok, false, tool);
    if (!decision.ok) assert.match(decision.reason, /Aide rule/);
  }
});
