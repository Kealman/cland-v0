// T1: generated role policy through provisioning and the public roles parser; no harness is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCrew } from '../src/crew.ts';
import { fixedRoles, parseRoles, roleLaunchPolicy } from '../src/roles/config.ts';
import { parse } from 'smol-toml';
import type { HarnessId } from '../src/doctor/ranges.ts';
import { harnessBinary, harnessInstallation, installedHarnesses, installedHarnessesAsync } from '../src/doctor/harnesses.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { rolesTemplate, isRolesTemplate, ROLE_HARNESS_ORDER } from '../src/roles/template.ts';
import { provision } from '../src/init/provision.ts';

test('a Claude-only installation provisions six auto-permission roles', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-role-template-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(join(bin, 'claude'), '', { mode: 0o755 });
  await provision(root, { territory: false, env: { HOME: join(root, 'home'), XDG_CONFIG_HOME: join(root, 'config'), PATH: bin } });
  const roles = parseRoles(await readFile(join(root, '.cland/roles.toml'), 'utf8'));
  assert.equal(roles.size, 6);
  for (const [role, definition] of roles) {
    assert.equal(definition.launch.harness, 'claude-code', role);
    assert.equal(definition.launch.permissions, 'auto', role);
  }
});

test('Codex fallback uses each role sandbox without replacing shipped Codex models', () => {
  const roles = parseRoles(rolesTemplate(['codex']));
  const sandboxes = { coordinator: 'danger-full-access', lead: 'danger-full-access', implementer: 'workspace-write', reviewer: 'read-only', qa: 'danger-full-access', aide: 'workspace-write' };
  for (const [role, sandbox] of Object.entries(sandboxes)) {
    const launch = roles.get(role)!.launch;
    assert.equal(launch.harness, 'codex', role);
    assert.equal(launch.approval, 'never', role);
    assert.equal(launch.sandbox?.mode, sandbox, role);
    assert.equal(launch.effort, 'high', role);
    if (role !== 'reviewer' && role !== 'qa') assert.equal(launch.model, null, role);
  }
  assert.equal(roles.get('reviewer')!.launch.model, 'gpt-6.1-sol');
  assert.equal(roles.get('qa')!.launch.model, 'gpt-6-astra');
});

test('generated Codex sandboxes match missing-file and missing-key fallbacks for every role (T-1222)', () => {
  const generated = parseRoles(rolesTemplate(['codex']));
  const missingFile = fixedRoles().get();
  const omittedRoles = parseRoles('');
  const expected = {
    coordinator: 'danger-full-access', lead: 'danger-full-access',
    implementer: 'workspace-write', reviewer: 'read-only', qa: 'danger-full-access', aide: 'workspace-write',
  };
  for (const [role, mode] of Object.entries(expected)) {
    const sandbox = generated.get(role)!.launch.sandbox;
    const writableRoots = role === 'implementer' ? [
      '.git/objects', '.git/refs', '.git/logs', '.git/worktrees',
      '.cland/territory.git/objects', '.cland/territory.git/refs', '.cland/territory.git/logs', '.cland/artifacts',
    ] : [];
    assert.deepEqual(sandbox, { mode, writableRoots, network: role === 'reviewer' ? 'none' : 'full' }, role);
    const missingKey = parseRoles(`[${role}.launch]\nharness = "codex"\n`);
    for (const [source, roles] of [['missing file', missingFile], ['omitted role', omittedRoles], ['missing sandbox key', missingKey]] as const) {
      assert.deepEqual(roleLaunchPolicy(roles.get(role)!, 'codex').sandbox, sandbox, `${role}: ${source}`);
    }
  }
});

test('new crew policy gives the Aide sub-agents', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-crew-template-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await provision(root, { territory: false, env: { HOME: root, XDG_CONFIG_HOME: join(root, 'config'), PATH: '' } });
  assert.equal(parseCrew(await readFile(join(root, '.cland/crew.toml'), 'utf8')).crew.aide!.subagents, true);
});

test('every installed set preserves shipped choices or takes the first installed harness', () => {
  const shipped = parseRoles(DEFAULT_ROLES_TOML);
  for (let mask = 0; mask < 8; mask++) {
    const installed = ROLE_HARNESS_ORDER.filter((_id, index) => mask & (1 << index));
    const text = rolesTemplate(installed);
    const raw = parse(text) as Record<string, { launch: Record<string, unknown> }>;
    const roles = parseRoles(text);
    for (const [role, definition] of roles) {
      const original = shipped.get(role)!.launch;
      const expected = !installed.length || installed.includes(original.harness as HarnessId) ? original.harness : installed[0];
      assert.equal(definition.launch.harness, expected, `${mask}/${role}`);
      if (expected === original.harness) {
        assert.equal(definition.launch.model, original.model, role);
        assert.equal(definition.launch.effort, original.effort, role);
      } else {
        assert.equal(raw[role]!.launch.model, '', role);
        assert.equal(definition.launch.effort, expected === 'claude-code' ? 'max' : expected === 'codex' ? 'high' : null, role);
      }
      assert.notEqual(raw[role]!.launch.permissions, 'skip', role);
      if (expected === 'claude-code') assert.equal(raw[role]!.launch.permissions, 'auto', role);
      if (expected === 'opencode') for (const key of ['permissions', 'approval', 'sandbox']) assert.ok(!(key in raw[role]!.launch), `${role}/${key}`);
    }
    assert.equal(isRolesTemplate(text), true);
    assert.ok(text.includes(`# cland roles template v1; harnesses = ${JSON.stringify(installed)}`));
    assert.equal(isRolesTemplate(text + '# edited\n'), false);
    assert.equal(isRolesTemplate(text.replace('skills = [', '# edited\nskills = [')), false);
  }
  assert.equal(rolesTemplate(['opencode', 'codex', 'codex']), rolesTemplate(['codex', 'opencode']));
  for (const text of ['', DEFAULT_ROLES_TOML, '# cland roles template v1; harnesses = broken', '# cland roles template v1; harnesses = ["unknown"]']) assert.equal(isRolesTemplate(text), false);
});

test('no installed harness is reported while edited role and crew policy remain byte-identical', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-roles-update-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { HOME: root, XDG_CONFIG_HOME: join(root, 'config'), PATH: '' };
  const changes = await provision(root, { territory: false, env });
  assert.match(changes.find(change => change.path === '.cland/roles.toml')!.note!, /no harness was found/);
  const rolePath = join(root, '.cland/roles.toml');
  const crewPath = join(root, '.cland/crew.toml');
  const roles = '# human edit\r\n' + await readFile(rolePath, 'utf8');
  const crew = (await readFile(crewPath, 'utf8')).replace(/subagents = true/g, 'subagents = false') + '# human edit\n';
  await writeFile(rolePath, roles);
  await writeFile(crewPath, crew);
  await provision(root, { territory: false, env: { ...env, CLAND_CODEX_BIN: process.execPath } });
  assert.equal(await readFile(rolePath, 'utf8'), roles);
  assert.equal(await readFile(crewPath, 'utf8'), crew);
});

test('discovery shares executable, override and installer folder rules with doctor', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-harness-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'path');
  const local = join(root, '.local/bin');
  const open = join(root, '.opencode/bin');
  for (const dir of [path, local, open]) await mkdir(dir, { recursive: true });
  for (const file of [join(path, 'codex'), join(local, 'claude'), join(open, 'opencode')]) await writeFile(file, '', { mode: 0o755 });
  const env: NodeJS.ProcessEnv = { HOME: root, XDG_CONFIG_HOME: join(root, 'config'), PATH: path };
  assert.deepEqual(installedHarnesses(env), ['claude-code', 'codex', 'opencode']);
  assert.deepEqual(await installedHarnessesAsync(env), ['claude-code', 'codex', 'opencode']);
  assert.equal(harnessBinary('claude-code', env), join(local, 'claude'));
  assert.equal(harnessBinary('codex', env), 'codex', 'PATH commands retain their portable attach spelling');
  assert.equal(harnessBinary('opencode', env), join(open, 'opencode'));
  assert.equal((await harnessInstallation('claude-code', env)).bin, join(local, 'claude'));
  env.CLAND_CLAUDE_BIN = join(root, 'absent');
  assert.deepEqual(installedHarnesses(env), ['codex', 'opencode'], 'an invalid override is authoritative');
  assert.equal((await harnessInstallation('claude-code', env)).bin, null);
  assert.equal(harnessBinary('claude-code', env), env.CLAND_CLAUDE_BIN, 'launch preserves an invalid authoritative override');
  await writeFile(join(path, 'claude'), '', { mode: 0o644 });
  assert.equal(installedHarnesses({ ...env, HOME: join(root, 'no-home'), CLAND_CLAUDE_BIN: '' }).includes('claude-code'), false, 'non-executable files are not installations');
  env.CLAND_CLAUDE_BIN = process.execPath;
  assert.equal((await harnessInstallation('claude-code', env)).bin, process.execPath);
});
