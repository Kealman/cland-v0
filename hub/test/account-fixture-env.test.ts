// T2: fixture admission may use the project socket; no hub or harness process.
// Account defaults belong to the worker, even when its first fixture is a subtest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clandWithEnv, connectUi, projectHub, tempProject, until } from './harness.ts';
import { legacyLedger, scratchMachine, snapshot } from './init-machine.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';
import { DigitalOceanApi } from '../src/executor/droplet/api.ts';
import { FakeClock } from './fake-clock.ts';

test('account isolation outlives the first test that requests a fixture', async t => {
  const keys = ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME'];
  let homes: string[] = [];
  await t.test('first fixture', async first => {
    await tempProject(first);
    for (const key of ['DIGITALOCEAN_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_SYSTEM']) assert.ok(!(key in process.env), key);
    homes = keys.map(key => {
      assert.ok(process.env[key], `${key} must have a fixture default`);
      return process.env[key]!;
    });
  });
  await t.test('later fixture', async later => {
    await tempProject(later);
    for (const [index, key] of keys.entries()) {
      assert.ok(process.env[key] === homes[index], `${key} must retain the same worker default`);
      assert.ok((await stat(homes[index]!)).isDirectory(), `${key} must survive the first fixture's cleanup`);
    }
  });
});

test('CLI child environment rejects poisoned HOME, Git config and credential overlays', async t => {
  const root = await tempProject(t);
  const receipt = join(root, 'sealed');
  const probe = join(root, 'probe.mjs');
  const removed = ['DIGITALOCEAN_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_SYSTEM', 'SSH_AUTH_SOCK', 'NPM_CONFIG_USERCONFIG', 'npm_config_userconfig'];
  await writeFile(probe, `
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
for (const key of ${JSON.stringify(removed)}) assert.ok(!(key in process.env), key);
assert.ok(process.env.HOME === ${JSON.stringify(process.env.HOME)}, 'HOME');
assert.ok(process.env.GIT_CONFIG_GLOBAL === ${JSON.stringify(process.env.GIT_CONFIG_GLOBAL)}, 'GIT_CONFIG_GLOBAL');
assert.ok(process.env.GIT_CONFIG_NOSYSTEM === '1', 'GIT_CONFIG_NOSYSTEM');
writeFileSync(${JSON.stringify(receipt)}, 'sealed');
`);
  const result = await clandWithEnv(root, {
    ...Object.fromEntries(removed.map(key => [key, 'poison'])),
    HOME: join(root, 'poison-home'), GIT_CONFIG_GLOBAL: join(root, 'poison-gitconfig'), GIT_CONFIG_NOSYSTEM: '0',
    NODE_OPTIONS: `--import=${pathToFileURL(probe).href}`,
  }, '--version');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(receipt, 'utf8'), 'sealed', 'observe child receipt after its CLI result');
});

test('projectHub re-registers a pruned root while leaving inherited scratch ledgers unchanged', async t => {
  const root = await tempProject(t);
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, []);
  await mkdir(join(machine.env.XDG_STATE_HOME!, 'cland'), { recursive: true });
  await writeFile(spendPath(machine.env), JSON.stringify({ version: 1, entries: [], projects: [] }));
  const ambient = { HOME: machine.home, XDG_STATE_HOME: machine.env.XDG_STATE_HOME!, CLAND_EXECUTOR_STATE: join(machine.home, 'override') };
  await mkdir(ambient.CLAND_EXECUTOR_STATE);
  await writeFile(join(ambient.CLAND_EXECUTOR_STATE, 'spend.json'), JSON.stringify({ version: 1, entries: [], projects: [] }));
  const before = await snapshot(machine.home);
  const previous = Object.fromEntries(Object.keys(ambient).map(key => [key, process.env[key]]));
  const clock = new FakeClock();
  await mkdir(join(root, '.cland/executor-state'), { recursive: true });
  await writeFile(join(root, '.cland/executor-state/spend.json'), JSON.stringify({ version: 1, entries: [], projects: [],
    missingProjects: [{ project: root, since: '2026-10-01T00:00:00Z', pruned: true }] }));
  const api = new DigitalOceanApi({}, clock, async () => ({ droplets: [], ssh_keys: [] }));
  const events: Record<string, unknown>[] = [];
  Object.assign(process.env, ambient);
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  try {
    hub = await projectHub(t, root, {}, { clock, log: event => events.push(event), droplet: { api }, syntheticProvider: { token: 'cland-test-ledger-isolation', api } });
    await until(() => events.some(event => event.event === 'executor-sweep'), { what: 'executor sweep completed', timeoutMs: 5000 });
    const ui = await connectUi(t, hub.discovery);
    const status = await ui.request({ type: 'executor.status' });
    assert.equal(status.ok, true, status.error);
    assert.equal((status.value as { spend: { path: string } }).spend.path, join(root, '.cland/executor-state/spend.json'));
    const ledger = JSON.parse(await readFile(join(root, '.cland/executor-state/spend.json'), 'utf8'));
    assert.deepEqual(ledger.projects, [root]);
    assert.deepEqual(ledger.missingProjects, [], 'hub startup clears its old prune record');
    await hub.stop();
    assert.deepEqual(await snapshot(machine.home), before, 'fixture sweep never imports or writes any inherited ledger');
  } finally {
    await hub?.stop();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
