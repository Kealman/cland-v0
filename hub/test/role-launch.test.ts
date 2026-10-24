// T2: role launch CLI and hub rules through projectHub; launch settings observed on in-process adapters.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { PERMISSIONS } from '../src/adapters/contract.ts';

const original = '# human settings\n[implementer.launch]\nharness = "claude-code" # keep harness comment\nmodel = "old"\neffort = "max"\n\n[reviewer.launch]\nharness = "codex"\nmodel = "review-model"\n';

async function fixture(t: Parameters<typeof tempProject>[0], git?: (args: string[]) => Promise<string | null>) {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, original);
  const configHome = join(root, 'config');
  await mkdir(join(configHome, 'cland'), { recursive: true });
  await writeFile(join(configHome, 'cland/accounts.toml'), '[accounts.work]\nharness = "codex"\n[accounts.other]\nharness = "opencode"\n');
  // Registry validation is real; account usage probes are outside these role-settings tests.
  const hub = await projectHub(t, root, { XDG_CONFIG_HOME: configHome }, { clock: new FakeClock(), accountReader: async () => [], ...(git ? { git } : {}) });
  const ui = await connectUi(t, hub.discovery);
  return { root, path, ui, ...hub };
}

test('role launch CLI saves combined flags while preserving every other line', { timeout: 5000 }, async t => {
  const { root, path } = await fixture(t);
  const result = await cland(root, 'role', 'launch', 'implementer', '--harness', 'codex', '--model', 'gpt-6.1-sol', '--effort', 'high', '--json');
  assert.equal(result.code, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.launch.harness, 'codex');
  assert.equal(value.launch.model, 'gpt-6.1-sol');
  assert.equal(value.launch.effort, 'high');
  assert.equal(await readFile(path, 'utf8'), original.replace('"claude-code"', '"codex"').replace('"old"', '"gpt-6.1-sol"').replace('"max"', '"high"').replace('[reviewer.launch]', 'sandbox = "workspace-write"\n[reviewer.launch]'));
  const listed = await cland(root, 'role', 'list');
  assert.equal(listed.code, 0, listed.stderr);
  assert.match(listed.stdout, /Implementer.*launch:.*codex.*gpt-6.1-sol.*effort high/);
});

test('role launch accepts parser permissions and registered accounts in role list', { timeout: 5000 }, async t => {
  const { root, ui } = await fixture(t);
  for (const permissions of PERMISSIONS) {
    const result = await ui.request({ type: 'role.launch', role: 'implementer', fields: { harness: 'codex', permissions, account: 'work' } });
    assert.equal(result.ok, true, result.error);
  }
  const listed = await cland(root, 'role', 'list');
  assert.equal(listed.code, 0, listed.stderr);
  assert.match(listed.stdout, /Implementer.*account work.*permissions skip.*approval never.*sandbox workspace-write/);
});

for (const [title, role, fields, reason] of [
  ['unknown role', 'missing', { model: 'new' }, /unknown role/],
  ['unknown harness', 'implementer', { harness: 'missing' }, /harness must be one of/],
  ['invalid permissions', 'implementer', { permissions: 'unsafe' }, /permissions must be one of/],
  ['unregistered account', 'implementer', { account: 'missing' }, /unknown account/],
  ['account for another harness', 'implementer', { account: 'other' }, /uses opencode.*harness is claude-code/],
] as const) test(`role launch refuses ${title} without changing roles.toml`, { timeout: 5000 }, async t => {
  const { path, ui } = await fixture(t);
  const result = await ui.request({ type: 'role.launch', role, fields });
  assert.equal(result.ok, false);
  assert.match(String(result.error), reason);
  assert.equal(await readFile(path, 'utf8'), original);
});

test('a harness change reports compatible model and effort resets', { timeout: 5000 }, async t => {
  const { root, ui } = await fixture(t);
  for (const [harness, effort] of [['codex', 'high'], ['opencode', null], ['claude-code', 'max']] as const) {
    const result = await cland(root, 'role', 'launch', 'implementer', '--harness', harness);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /model = harness default/);
    assert.ok(result.stdout.includes(`effort = ${effort ?? 'harness default'}`), result.stdout);
    const list = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; launch: { model: string | null; effort: string | null } }> };
    assert.equal(list.roles.find(r => r.role === 'implementer')!.launch.model, null);
    assert.equal(list.roles.find(r => r.role === 'implementer')!.launch.effort, effort);
  }
});

test('role launch enforces shell roles and records refusals in Agents', { timeout: 5000 }, async t => {
  const { root, path, ui } = await fixture(t);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const role of ['coordinator', 'aide', 'lead', 'implementer', 'reviewer', 'qa']) {
    const name = `settings-${role}`;
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const before = await readFile(path, 'utf8');
    const result = await clandWithEnv(root, { CLAND_SESSION_NAME: name }, 'role', 'launch', 'reviewer', '--model', role);
    const allowed = role === 'coordinator' || role === 'aide';
    assert.equal(result.code, allowed ? 0 : 1, result.stderr);
    if (!allowed) {
      assert.match(result.stderr, /forbidden.*role.launch.*Coordinator, an Aide or the human/);
      assert.equal(await readFile(path, 'utf8'), before);
      await ui.waitFor(frame => JSON.stringify(frame).includes(name) && JSON.stringify(frame).includes('role launch editing belongs'));
    }
  }
});

test('role launch clears model and account to harness defaults', { timeout: 5000 }, async t => {
  const { root, ui } = await fixture(t);
  assert.equal((await ui.request({ type: 'role.launch', role: 'reviewer', fields: { account: 'work' } })).ok, true);
  const result = await cland(root, 'role', 'launch', 'reviewer', '--model', '', '--account', '', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).launch.model, null);
  assert.equal(JSON.parse(result.stdout).launch.account, null);
});

test('role launch settings apply to the next CLI launch without changing the caller session', { timeout: 5000 }, async t => {
  const { root, fakes } = await fixture(t);
  const first = await cland(root, 'session', 'launch', '--name', 'aide-first', '--role', 'aide');
  assert.equal(first.code, 0, first.stderr);
  const before = fakes['claude-code']!.spawns.find(s => s.name === 'aide-first')!;
  const edit = await clandWithEnv(root, { CLAND_SESSION_NAME: 'aide-first' }, 'role', 'launch', 'aide', '--harness', 'codex', '--model', 'next-model', '--effort', 'high');
  assert.equal(edit.code, 0, edit.stderr);
  assert.match(edit.stdout, /applies from the role's next launch.*your own session keeps its settings until its next launch/);
  const second = await cland(root, 'session', 'launch', '--name', 'aide-next', '--role', 'aide');
  assert.equal(second.code, 0, second.stderr);
  const after = fakes.codex!.spawns.find(s => s.name === 'aide-next')!;
  assert.equal(after.model, 'next-model');
  assert.equal(after.effort, 'high');
  assert.equal(before.model, null);
});

test('role set still assigns a role and usage describes every launch flag', { timeout: 5000 }, async t => {
  const { root, ui } = await fixture(t);
  const result = await cland(root, 'role', 'set', 'assigned', 'implementer', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).session.role, 'implementer');
  const usage = await cland(root, 'role', 'unknown');
  assert.match(usage.stderr, /role launch <role>/);
  for (const flag of ['harness', 'model', 'effort', 'account', 'permissions']) assert.ok(usage.stderr.includes(`--${flag}`));
  const listed = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; holders: Array<{ name: string }> }> };
  assert.equal(listed.roles.find(r => r.role === 'implementer')!.holders[0]!.name, 'assigned');
});

test('a queued role launch rechecks caller authority before writing', { timeout: 5000 }, async t => {
  let block = false;
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  t.after(release);
  const { path, ui } = await fixture(t, async args => {
    if (block && args[0] === 'log') { entered(); await barrier; }
    return null;
  });
  assert.equal((await ui.request({ type: 'role.set', session: 'settings-aide', role: 'aide' })).ok, true);
  block = true;
  const reload = ui.request({ type: 'hub.reload' });
  await waiting;
  const change = ui.request({ type: 'role.launch', role: 'implementer', fields: { model: 'denied' }, as: { name: 'settings-aide' } });
  assert.equal((await ui.request({ type: 'role.clear', session: 'settings-aide' })).ok, true);
  release();
  assert.equal((await reload).ok, true);
  const refused = await change;
  assert.equal(refused.ok, false);
  assert.match(String(refused.error), /forbidden.*role.launch/);
  assert.equal(await readFile(path, 'utf8'), original);
});
