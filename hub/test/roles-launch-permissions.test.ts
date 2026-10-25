// T1: roles.toml permission values through the public parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoles, roleLaunchPolicy } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { DEFAULT_PERMISSIONS, decide, grantRefusal, toolAvailability } from '../src/roles/permissions.ts';
import { rolesTemplate } from '../src/roles/template.ts';
import { withRole } from '../src/names.ts';
import { setMissingCodexSandbox } from '../src/roles/launch.ts';

test('a custom role loads its own clause, skills, launch settings and deny-by-default tools', () => {
  const text = `[custom.docs-writer]
clause = "Write the project documentation."
skills = ["research"]
[custom.docs-writer.launch]
harness = "codex"
model = "docs-model"
effort = "high"
sandbox = "workspace-write"
approval = "never"
`;
  const roles = parseRoles(text);
  const role = roles.get('docs-writer')!;
  assert.equal(roles.size, 7, 'the six built-in roles remain available');
  assert.equal(role.role, 'docs-writer');
  assert.equal(role.clause, 'Write the project documentation.');
  assert.deepEqual(role.skills, ['research']);
  assert.equal(role.launch.harness, 'codex');
  assert.equal(role.launch.model, 'docs-model');
  assert.equal(role.launch.effort, 'high');
  assert.equal(role.launch.sandbox?.mode, 'workspace-write');
  assert.deepEqual(role.permissions.tools, []);
  assert.equal(decide(role.role, role.permissions.tools, { tool: 'who' }).ok, false);
});

test('custom definitions refuse missing fields, collisions, unknown fields and forbidden grants at load', () => {
  const valid = '[custom.writer]\nclause = "Write docs"\n[custom.writer.launch]\nharness = "codex"\n';
  for (const [text, field] of [
    [valid.replace('clause = "Write docs"', ''), 'custom.writer.clause'],
    [valid.replace('harness = "codex"', ''), 'custom.writer.launch.harness'],
    [valid.replaceAll('writer', 'reviewer'), 'custom.reviewer'],
    [valid.replaceAll('writer', 'Bad'), 'custom.Bad'],
    [valid.replace('clause =', 'typo ='), 'custom.writer.typo'],
    [valid + 'typo = true\n', 'custom.writer.launch.typo'],
    [valid + '[custom.writer.permissions]\nextra = []\n', 'custom.writer.permissions.extra'],
    ...['missing-tool', 'send', 'send:human', 'merge', 'session.launch', 'task.comment', 'task.comment:verdict', 'task.hold', 'task.criterion', 'task.criterion:verify', 'task.plan:set'].map(tool =>
      [valid + `[custom.writer.permissions]\ntools = ["${tool}"]\n`, 'custom.writer.permissions.tools']),
  ]) assert.throws(() => parseRoles(text!), error => error instanceof Error && error.message.includes(field!), field);
});

test('custom roles complete only their own work and cannot acquire built-in authority at decision time', () => {
  const grants = ['task.edit:review', 'task.criterion:done', 'verify', 'task.comment:own', 'send:agents'];
  assert.equal(decide('writer', grants, { tool: 'task.edit', status: 'review', statusOnly: true, claimed: () => true }).ok, true);
  for (const status of ['ready', 'done', 'in progress', 'qa']) {
    assert.equal(decide('writer', grants, { tool: 'task.edit', status, statusOnly: true, claimed: () => true }).ok, false);
  }
  assert.equal(decide('writer', grants, { tool: 'task.edit', status: 'review', statusOnly: true, claimed: () => false }).ok, false);
  assert.equal(decide('writer', grants, { tool: 'task.edit', status: 'review', statusOnly: false, claimed: () => true }).ok, false);
  assert.equal(decide('writer', grants, { tool: 'task.criterion', criterionOp: 'done', claimed: () => true }).ok, true);
  assert.equal(decide('writer', grants, { tool: 'task.criterion', criterionOp: 'done', claimed: () => false }).ok, false);
  for (const tool of ['merge', 'release', 'session.launch', 'role.handover', 'task.hold']) {
    assert.equal(decide('writer', [tool], { tool }).ok, false, tool);
    assert.equal(toolAvailability('writer', [tool], tool).ok, false, `${tool} availability`);
  }
  assert.equal(decide('writer', ['task.comment'], { tool: 'task.comment', verdict: true, verdictKind: 'review' }).ok, false);
  assert.equal(decide('writer', ['task.comment:verdict'], { tool: 'task.comment', verdict: true, verdictKind: 'qa' }).ok, false);
  assert.equal(decide('writer', ['task.criterion'], { tool: 'task.criterion', criterionOp: 'verify' }).ok, false);
  assert.equal(decide('writer', ['send'], { tool: 'send', toHuman: true }).ok, false);
});

test('custom verification grants require an own claimed task without modes or occasions', () => {
  assert.equal(decide('writer', ['verify'], { tool: 'verify', claimed: () => true }).ok, true);
  assert.equal(decide('writer', [], { tool: 'verify', claimed: () => true }).ok, false);
  assert.equal(decide('writer', ['verify'], { tool: 'verify', claimed: () => false }).ok, false);
  assert.equal(decide('writer', ['verify'], { tool: 'verify', claimed: () => true, verifyMode: 'all' }).ok, false);
  assert.equal(decide('writer', ['verify'], { tool: 'verify', claimed: () => true, verifyOccasion: 'stage' }).ok, false);
});

test('a valid custom name cannot inherit JavaScript object members as grants or labels', () => {
  const roles = parseRoles('[custom.constructor]\nclause = "Write docs"\n[custom.constructor.launch]\nharness = "codex"\n');
  assert.deepEqual(roles.get('constructor')!.permissions.tools, []);
  assert.equal(withRole('worker-1', 'constructor'), 'worker-1 [constructor]');
  const source = '[custom.constructor]\nclause = "Write docs"\n[custom.constructor.launch]\nharness = "codex"\n';
  assert.equal(setMissingCodexSandbox(source, 'constructor', 'codex'), source, 'custom roles have no built-in sandbox compatibility default');
});

const implementerSandbox = { mode: 'workspace-write', network: 'full', writableRoots: [
  '.git/objects', '.git/refs', '.git/logs', '.git/worktrees',
  '.cland/territory.git/objects', '.cland/territory.git/refs', '.cland/territory.git/logs', '.cland/artifacts',
] };

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
      ['coordinator', null, { mode: 'danger-full-access', writableRoots: [], network: 'full' }, null],
      ['lead', null, { mode: 'danger-full-access', writableRoots: [], network: 'full' }, null],
      ['implementer', 'never', implementerSandbox, null],
      ['reviewer', 'never', { mode: 'read-only', writableRoots: [], network: 'none' }, null],
      ['qa', 'never', { mode: 'danger-full-access', writableRoots: [], network: 'full' }, null],
      ['aide', 'never', { mode: 'workspace-write', writableRoots: [], network: 'full' }, null],
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
      approval: 'never', sandbox: implementerSandbox, permissions: null,
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
    assert.match(error.message, /"unguarded"/);
    for (const value of ['""', 'auto', 'skip']) assert.ok(error.message.includes(value), error.message);
    return true;
  });
});

test('the template explains auto permission mode in its header', { timeout: 500 }, () => {
  assert.match(DEFAULT_ROLES_TOML.split('[coordinator]')[0]!, /auto.*--permission-mode auto/);
});
