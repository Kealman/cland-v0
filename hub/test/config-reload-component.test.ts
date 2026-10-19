// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, projectHub, tempProject } from './harness.ts';

const config = (root: string, budget: number) => `[verification]\nlock_path=${JSON.stringify(join(root, "suite.lock"))}\nremote_budget=${budget}\n`;

const roles = (model: string) => `[implementer.launch]\nharness="codex"\nmodel="${model}"\n`;

// T2: command reload is a hub rule; no process lifecycle is involved.
test('hub reload applies changed verification commands without a restart', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/config.toml');
  await writeFile(path, config(root, 2) + 'test="before"\n');
  await projectHub(t, root);
  await writeFile(path, config(root, 2) + 'prepare="install"\ncheck="compile"\ntest="after"\n');
  const result = await cland(root, 'hub', 'reload');
  assert.equal(result.code, 0, result.stderr);
  for (const key of ['prepare', 'check', 'test']) assert.ok(result.stdout.includes(`verification.${key}`), result.stdout);
});

test('hub reload publishes config and roles together and retains both after either file fails', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/config.toml');
  const rolePath = join(root, '.cland/roles.toml');
  await writeFile(path, config(root, 2)); await writeFile(rolePath, roles('before'));
  const commit = '1'.repeat(40);
  const daemon = await projectHub(t, root, {}, { git: async args => args[0] === 'log' ? commit : null });
  const ui = await connectUi(t, daemon.discovery);
  const status = async () => JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
  const initial = await status();
  assert.equal(initial.config.sourceCommit, commit);
  assert.ok(Date.parse(initial.config.loadedAt));
  await writeFile(path, config(root, 3));
  assert.equal((await status()).verification.remoteBudget, 2, 'config-only edits wait for reload');
  const loaded = await cland(root, 'hub', 'reload');
  assert.equal(loaded.code, 0, loaded.stderr);
  assert.equal((await status()).verification.remoteBudget, 3);
  for (const [bad, contents, expected] of [[path, config(root, 0), 'remote_budget'], [path, '[broken', 'config.toml'], [rolePath, '[broken', 'roles.toml'], [rolePath, '[implementer.launch]\nharness=1', 'harness']] as const) {
    // Keep at least one file invalid throughout setup, including across cases.
    await writeFile(bad, contents);
    await writeFile(bad === path ? rolePath : path, bad === path ? roles('after') : config(root, 4));
    const failed = await cland(root, 'hub', 'reload');
    assert.notEqual(failed.code, 0);
    assert.match(failed.stderr, new RegExp(expected));
    assert.equal((await status()).verification.remoteBudget, 3);
    const listed = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; launch: { model: string } }> };
    assert.equal(listed.roles.find(r => r.role === 'implementer')?.launch.model, 'before');
    const journal = await cland(root, 'hub', 'journal', '--kind', 'config-reload-failed', '--json');
    assert.ok(journal.stdout.includes(bad));
  }
});

test('role auto-refresh applies the pair only when valid, and running launches retain their defaults', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/config.toml');
  const rolePath = join(root, '.cland/roles.toml');
  const roleText = (model: string) => `[reviewer.launch]\nharness="claude-code"\nmodel="${model}"\n`;
  await writeFile(path, config(root, 2)); await writeFile(rolePath, roleText('before'));
  const daemon = await projectHub(t, root);
  const ui = await connectUi(t, daemon.discovery);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 3 })).ok, true);
  const launch = async (name: string) => {
    const r = await ui.request({ type: 'session.launch', name, role: 'reviewer' });
    assert.equal(r.ok, true, r.error);
    return (r.value as { process: { name: string } }).process;
  };
  const first = await launch('before');
  await writeFile(path, config(root, 0)); await writeFile(rolePath, roleText('after'));
  // A launch forces a role refresh and must still use the complete last-good pair.
  const refusedPair = await launch('retained');
  assert.equal(daemon.fakes['claude-code']!.spawns.find(r => r.name === refusedPair.name)!.model, 'before');
  assert.equal((await ui.request({ type: 'session.stop', session: 'retained' }, 15000)).ok, true);
  await writeFile(path, config(root, 4));
  assert.equal((await cland(root, 'hub', 'reload')).code, 0);
  const second = await launch('after');
  assert.equal(daemon.fakes['claude-code']!.spawns.find(r => r.name === first.name)!.model, 'before');
  assert.equal(daemon.fakes['claude-code']!.spawns.find(r => r.name === second.name)!.model, 'after');
  const s = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
  assert.equal(s.verification.remoteBudget, 4);
  assert.equal(s.harnesses.find((p: { name: string }) => p.name === 'before').model, 'before');
  assert.equal(s.harnesses.find((p: { name: string }) => p.name === 'after').model, 'after');
  const denied = await clandWithEnv(root, { CLAND_SESSION_NAME: 'after', CLAND_SESSION_ID: s.harnesses.find((p: { name: string }) => p.name === 'after').sessionId }, 'hub', 'reload');
  assert.equal(denied.code, 1);
  assert.match(denied.stderr, /forbidden/);
  await writeFile(path, config(root, 5)); await writeFile(rolePath, roleText('automatic'));
  await eventually('role auto-refresh publishes config too', async () => {
    const s = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
    return s.verification.remoteBudget === 5 ? true : undefined;
  });
});

test('missing config retains the loaded policy and permits role refresh with a warning', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/config.toml');
  const rolePath = join(root, '.cland/roles.toml');
  await writeFile(path, config(root, 6)); await writeFile(rolePath, roles('before'));
  const daemon = await projectHub(t, root);
  const ui = await connectUi(t, daemon.discovery);
  const initial = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
  await unlink(path);
  await writeFile(rolePath, roles('without-config'));
  await eventually('role edit published with config absent', async () => {
    const listed = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; launch: { model: string } }> };
    return listed.roles.find(r => r.role === 'implementer')?.launch.model === 'without-config' ? true : undefined;
  });
  const loaded = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
  assert.equal(loaded.verification.remoteBudget, 6);
  assert.deepEqual(loaded.config, initial.config, 'retained config keeps its loaded time and provenance');
  const reloaded = await cland(root, 'hub', 'reload');
  assert.equal(reloaded.code, 0, reloaded.stderr);
  assert.match(reloaded.stdout, /config.toml missing; keeping the last loaded config/);
  const journal = await cland(root, 'hub', 'journal', '--kind', 'config-reload-warning', '--json');
  assert.match(journal.stdout, /config.toml missing; keeping the last loaded config/);
  // An existing invalid file is a refusal, not the missing-file fallback.
  await writeFile(path, '[broken'); await writeFile(rolePath, roles('must-not-publish'));
  const denied = await cland(root, 'hub', 'reload');
  assert.equal(denied.code, 1);
  const listed = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; launch: { model: string } }> };
  assert.equal(listed.roles.find(r => r.role === 'implementer')?.launch.model, 'without-config');
  assert.equal(JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout).verification.remoteBudget, 6);
});
