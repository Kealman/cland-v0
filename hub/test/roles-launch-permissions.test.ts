// T1: roles.toml permission values through the public parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';

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
