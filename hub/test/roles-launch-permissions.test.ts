// T1: roles.toml permission values through the public parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoles, roleLaunchPolicy } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { DEFAULT_PERMISSIONS, decide, grantRefusal } from '../src/roles/permissions.ts';
import { rolesTemplate } from '../src/roles/template.ts';

test('session.list is a named read granted to every role separately from session mutations', () => {
  const shipped = parseRoles(DEFAULT_ROLES_TOML);
  const project = parseRoles(readFileSync(new URL('../../.cland/roles.toml', import.meta.url), 'utf8'));
  assert.equal(grantRefusal('session.list', 'permissions.tools'), null);
  for (const role of ['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide']) {
    for (const grants of [DEFAULT_PERMISSIONS[role], shipped.get(role)!.permissions.tools, project.get(role)!.permissions.tools]) {
      assert.deepEqual(decide(role, grants, { tool: 'session.list' }), { ok: true }, role);
    }
  }
  for (const tool of ['session.launch', 'session.stop', 'session.resume', 'session.archive', 'session.prune']) {
    const denied = decide('implementer', ['session.list'], { tool });
    assert.equal(denied.ok, false, tool);
    if (!denied.ok) assert.equal(denied.permission, tool);
  }
  assert.equal(decide('implementer', ['session.launch'], { tool: 'session.list' }).ok, false, 'launch is not a read grant');
  assert.equal(decide(null, ['session.list'], { tool: 'session.list' }).ok, false, 'a roleless session has no tools');
});

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

test('OpenCode defaults retain policy inputs for launches on another harness (T-944)', { timeout: 500 }, () => {
  const native = { approval: null, sandbox: null, permissions: null };
  for (const text of ['', '[implementer.launch]\nharness = "opencode"\n']) {
    const definition = parseRoles(text).get('implementer')!;
    assert.deepEqual(roleLaunchPolicy(definition, 'opencode'), native);
    for (const harness of ['claude-code', 'codex']) assert.deepEqual(roleLaunchPolicy(definition, harness), {
      approval: 'never', sandbox: { mode: 'danger-full-access', writableRoots: [], network: 'full' }, permissions: null,
    });
  }
  const own = parseRoles('[implementer.launch]\nharness = "opencode"\napproval = ""\nsandbox = ""\npermissions = ""\n').get('implementer')!;
  for (const harness of ['claude-code', 'codex', 'opencode']) assert.deepEqual(roleLaunchPolicy(own, harness), native);
  const invalid = parseRoles('[implementer.launch]\nharness = "opencode"\napproval = "invalid"\n').get('implementer')!;
  assert.deepEqual(roleLaunchPolicy(invalid, 'opencode'), native, 'OpenCode never consumes ignored inputs');
  assert.throws(() => roleLaunchPolicy(invalid, 'codex'), /implementer\.launch\.approval must be one of/);
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
