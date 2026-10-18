// T2: hub startup policy and Aide launch defaults through one real socket; no native harness processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RoleList } from '../src/protocol.ts';
import { parseRoles, DEFAULTS } from '../src/roles/config.ts';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

test('hub startup builds missing role policy from its own installation environment', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const { fakes, discovery } = await projectHub(t, root, {
    HOME: root, XDG_CONFIG_HOME: join(root, 'config'), PATH: '',
    CLAND_CLAUDE_BIN: process.execPath, CLAND_CODEX_BIN: join(root, 'absent-codex'), CLAND_OPENCODE_BIN: join(root, 'absent-opencode'),
  }, { clock: new FakeClock() });
  const roles = parseRoles(await readFile(join(root, '.cland/roles.toml'), 'utf8'));
  for (const [role, definition] of roles) {
    assert.equal(definition.launch.harness, 'claude-code', role);
    assert.equal(definition.launch.permissions, 'auto', role);
  }
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'aide-demo', role: 'aide' });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(fakes['claude-code']!.spawns[0]!.permissions, 'auto');
});

test('different installation environments leave omitted-role fallbacks identical', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const file = join(root, '.cland/roles.toml');
  const env = { HOME: root, XDG_CONFIG_HOME: join(root, 'config'), PATH: '', CLAND_CLAUDE_BIN: join(root, 'absent'), CLAND_OPENCODE_BIN: join(root, 'absent') };
  const hub = await projectHub(t, root, { ...env, PATH: join(root, 'first-path'), CLAND_CODEX_BIN: process.execPath }, { clock: new FakeClock() });
  assert.equal(parseRoles(await readFile(file, 'utf8')).get('aide')!.launch.harness, 'codex');
  await writeFile(file, '[aide.launch]\nharness = "codex"\n');
  const ui = await connectUi(t, hub.discovery);
  const loaded = await ui.request({ type: 'hub.reload' });
  assert.equal(loaded.ok, true, loaded.error);
  const first = await ui.request({ type: 'role.list' });
  assert.equal(first.ok, true, first.error);
  for (const role of (first.value as RoleList).roles) {
    if (role.role === 'aide') continue;
    assert.deepEqual(role.launch, DEFAULTS.get(role.role)!.launch, role.role);
  }
  await hub.stop();
  const secondHub = await projectHub(t, root, { ...env, PATH: join(root, 'second-path'), CLAND_CODEX_BIN: join(root, 'absent'), CLAND_CLAUDE_BIN: process.execPath }, { clock: new FakeClock() });
  const other = await connectUi(t, secondHub.discovery);
  const second = await other.request({ type: 'role.list' });
  assert.equal(second.ok, true, second.error);
  assert.deepEqual(second.value, first.value);
  const crew = await other.request({ type: 'crew.show' });
  assert.equal(crew.ok, true, crew.error);
  assert.equal((crew.value as { config: { crew: { aide: { subagents: boolean } } } }).config.crew.aide.subagents, true);
});
