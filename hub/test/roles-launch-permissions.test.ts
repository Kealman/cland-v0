// T1: roles.toml permission values through the public parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { rolesTemplate } from '../src/roles/template.ts';

test('OpenCode role snapshots use native policy and warn only for explicit ignored keys', { timeout: 500 }, () => {
  for (const definition of parseRoles(rolesTemplate(['opencode'])).values()) {
    assert.deepEqual([definition.launch.approval, definition.launch.sandbox, definition.launch.permissions], [null, null, null]);
    assert.deepEqual(definition.warnings ?? [], []);
  }
  assert.deepEqual(parseRoles('').get('implementer')!.warnings ?? [], [], 'omitted roles do not inherit warnings');
  const explicit = parseRoles('[implementer.launch]\nharness = "opencode"\napproval = "never"\nsandbox = "read-only"\npermissions = "skip"\n').get('implementer')!;
  assert.deepEqual([explicit.launch.approval, explicit.launch.sandbox, explicit.launch.permissions], [null, null, null]);
  assert.deepEqual(explicit.warnings, ["implementer.launch: OpenCode ignores approval, sandbox, permissions; OpenCode's own configuration governs"]);
});

test('Claude Code and Codex retain per-role inherited policy', { timeout: 500 }, () => {
  for (const harness of ['claude-code', 'codex']) {
    for (const [role, approval, sandbox, permissions] of [
      ['coordinator', null, null, null], ['lead', null, null, null],
      ['implementer', 'never', { mode: 'danger-full-access', writableRoots: [], network: 'full' }, null],
      ['reviewer', 'never', { mode: 'read-only', writableRoots: [], network: 'none' }, null],
      ['qa', 'never', { mode: 'danger-full-access', writableRoots: [], network: 'full' }, null],
      ['aide', 'never', { mode: 'danger-full-access', writableRoots: [], network: 'full' }, null],
    ] as const) {
      const launch = parseRoles(`[${role}.launch]\nharness = "${harness}"\n`).get(role)!.launch;
      assert.deepEqual([launch.approval, launch.sandbox, launch.permissions], [approval, sandbox, permissions], `${harness}/${role}`);
    }
  }
});

test('roles accept auto, skip and the harness permission settings', { timeout: 500 }, () => {
  for (const [value, expected] of [['auto', 'auto'], ['skip', 'skip'], ['', null]] as const) {
    const roles = parseRoles(`[coordinator.launch]\nharness = "claude-code"\npermissions = "${value}"\n`);
    assert.equal(roles.get('coordinator')?.launch.permissions, expected);
  }
  assert.equal(parseRoles('[coordinator.launch]\nharness = "claude-code"\n').get('coordinator')?.launch.permissions, null);
});

test('unknown permission values name all three accepted settings', { timeout: 500 }, () => {
  assert.throws(() => parseRoles('[coordinator.launch]\nharness = "claude-code"\npermissions = "unguarded"\n'), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /coordinator\.launch\.permissions/);
    for (const value of ['""', 'auto', 'skip']) assert.ok(error.message.includes(value), error.message);
    return true;
  });
});

test('the template explains auto permission mode in its header', { timeout: 500 }, () => {
  assert.match(DEFAULT_ROLES_TOML.split('[coordinator]')[0]!, /auto.*--permission-mode auto/);
});
