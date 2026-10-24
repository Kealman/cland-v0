// T2: hub startup policy and Aide launch defaults through one real socket; no native harness processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RoleList } from '../src/protocol.ts';
import { parseRoles, DEFAULTS } from '../src/roles/config.ts';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { rolesTemplate } from '../src/roles/template.ts';
import { threadPolicy } from '../src/adapters/codex.ts';
import { parse } from 'smol-toml';

test('generated and fallback Implementer policy resolves narrow task-worktree Git and artifact roots (T-1222)', { timeout: 2000 }, async t => {
  for (const source of [rolesTemplate(['codex']), '[implementer.launch]\nharness = "codex"\n']) {
    const root = await tempProject(t);
    const worktree = join(root, '.cland/worktrees/T-1');
    const gitDir = join(root, '.git/worktrees/T-1');
    await mkdir(worktree, { recursive: true });
    await mkdir(gitDir, { recursive: true });
    await writeFile(join(worktree, '.git'), `gitdir: ${gitDir}\n`);
    await writeFile(join(root, '.cland/roles.toml'), source);
    const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
    const ui = await connectUi(t, discovery);
    const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex', cwd: worktree });
    assert.equal(launched.ok, true, launched.error);
    const request = fakes.codex!.spawns[0]!;
    assert.equal(request.cwd, worktree);
    const roots = [
      join(root, '.git/objects'), join(root, '.git/refs'), join(root, '.git/logs'), join(root, '.git/worktrees'),
      join(root, '.cland/territory.git/objects'), join(root, '.cland/territory.git/refs'), join(root, '.cland/territory.git/logs'),
      join(root, '.cland/artifacts'),
    ];
    assert.deepEqual(request.sandbox, { mode: 'workspace-write', writableRoots: roots, network: 'full' });
    const policy = await threadPolicy({ discoveryFile: join(root, '.cland/hub.json') }, worktree, request);
    const profile = parse(policy.overrides.find(value => value.startsWith('permissions.cland='))!).permissions as { cland: { filesystem: Record<string, string> } };
    assert.deepEqual({ ...profile.cland.filesystem }, Object.fromEntries(roots.map(path => [path, 'write'])));
    for (const protectedPath of ['.git', '.git/hooks', '.git/config', '.cland/territory.git', '.cland/territory.git/hooks', '.cland/territory.git/config']) {
      assert.equal(roots.some(path => join(root, protectedPath) === path || join(root, protectedPath).startsWith(path + '/')), false, protectedPath);
    }
    assert.deepEqual(policy.thread, { approvalPolicy: 'never', permissions: 'cland' });
    assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true);
  }
});

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
