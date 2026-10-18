// T3: initialized open starts one real hub, reuses it on reopening, then launches the workbench.
// T2: refusal cases exercise the CLI with scratch HOME and a stand-in launcher.
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureAccountFixture } from './account-fixture-env.ts';
import { isolateVerification, killDaemon, readDiscovery } from './harness.ts';
import { emptyFolder, initializedProject, initIn, scratchMachine, snapshot, unbornRepo } from './init-machine.ts';

async function openMachine(t: TestContext) {
  // Account/provider defaults must be isolated before scratchMachine copies process.env.
  await ensureAccountFixture();
  return scratchMachine(t, { identity: false });
}

test('open fixtures clear planted provider and account defaults before capturing the CLI environment', async t => {
  const host = await scratchMachine(t, { identity: false });
  // Only scratch sentinels are planted; assert admission before any child can start a hub.
  process.env.DIGITALOCEAN_TOKEN = 'planted-not-a-provider-token';
  process.env.CLAUDE_CONFIG_DIR = join(host.home, 'host-claude');
  process.env.CODEX_HOME = join(host.home, 'host-codex');
  process.env.OPENCODE_DB = join(host.home, 'host-opencode.db');
  const machine = await openMachine(t);
  assert.equal(machine.env.DIGITALOCEAN_TOKEN, '', 'no provider token reaches the CLI');
  assert.notEqual(machine.env.CLAUDE_CONFIG_DIR, join(host.home, 'host-claude'));
  assert.notEqual(machine.env.CODEX_HOME, join(host.home, 'host-codex'));
  assert.equal(machine.env.OPENCODE_DB, undefined);
  const receipt = join(machine.home, 'environment-observed');
  const probe = join(machine.home, 'probe.mjs');
  await writeFile(probe, `import assert from 'node:assert/strict';\nimport { writeFileSync } from 'node:fs';\nassert.equal(process.env.DIGITALOCEAN_TOKEN, '');\nassert.equal(process.env.CLAUDE_CONFIG_DIR, ${JSON.stringify(machine.env.CLAUDE_CONFIG_DIR)});\nassert.equal(process.env.CODEX_HOME, ${JSON.stringify(machine.env.CODEX_HOME)});\nassert.equal(process.env.OPENCODE_DB, undefined);\nwriteFileSync(${JSON.stringify(receipt)}, 'isolated');\n`);
  machine.env.NODE_OPTIONS = `--import=${pathToFileURL(probe).href}`;
  const result = await initIn(machine, machine.home, 'open', '--help');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(receipt, 'utf8'), 'isolated', 'the actual CLI observes the isolated defaults');
});

test('cland open refuses a scratch folder without writing or launching', async t => {
  const machine = await openMachine(t);
  const root = await emptyFolder(machine);
  const record = join(machine.home, 'launched.txt');
  const launcher = join(machine.home, 'fake-launcher');
  await writeFile(launcher, `#!/bin/sh\nprintf launched > ${JSON.stringify(record)}\n`);
  await chmod(launcher, 0o755);
  machine.env.CLAND_LAUNCHER = launcher;
  const repo = await unbornRepo(machine);
  const sub = join(repo, 'src');
  await mkdir(sub);
  const project = await emptyFolder(machine);
  await mkdir(join(project, '.cland'));
  const before = await snapshot(machine.home);

  for (const [cwd, args] of [[root, []], [project, [root]], [sub, []], [project, [sub]]] as const) {
    const result = await initIn(machine, cwd, 'open', ...args);
    for (const target of [root, repo, project]) {
      const discovery = await readDiscovery(target).catch(() => null);
      if (discovery) t.after(() => killDaemon(discovery.pid));
      assert.equal(discovery, null, 'no hub was started');
    }
    assert.equal(result.code, 1);
    assert.equal(result.stderr, 'not a cland project: run cland init\n');
    assert.equal(result.stdout, '');
    assert.deepEqual(await snapshot(root), {}, 'no .cland directory was created');
    assert.deepEqual(await snapshot(machine.home), before, 'HOME is unchanged and the launcher did not run');
  }
});

test('cland open refuses folders beneath legacy HOME state', async t => {
  const machine = await openMachine(t);
  const root = await emptyFolder(machine);
  await mkdir(join(machine.home, '.cland'));
  await writeFile(join(machine.home, '.cland', 'sentinel'), 'legacy user state');
  const record = join(machine.home, 'launched.txt');
  const launcher = join(machine.home, 'fake-launcher');
  await writeFile(launcher, `#!/bin/sh\nprintf launched > ${JSON.stringify(record)}\n`);
  await chmod(launcher, 0o755);
  machine.env.CLAND_LAUNCHER = launcher;
  const before = await snapshot(machine.home);

  for (const cwd of [root, machine.home]) {
    const result = await initIn(machine, cwd, 'open');
    const discovery = await readDiscovery(machine.home).catch(() => null);
    if (discovery) t.after(() => killDaemon(discovery.pid));
    assert.equal(result.code, 1);
    assert.equal(result.stderr, 'not a cland project: run cland init\n');
    assert.equal(discovery, null, 'HOME has no hub');
    assert.deepEqual(await snapshot(machine.home), before);
  }
});

test('cland open from a subdirectory starts the project hub, then the launcher on the project root', async (t) => {
  const machine = await openMachine(t);
  const { root } = await initializedProject(machine);
  await isolateVerification(root);
  const sub = join(root, 'src', 'deep');
  await mkdir(sub, { recursive: true });
  const record = join(root, 'launched.txt');
  const launcher = join(root, 'fake-launcher');
  await writeFile(launcher, `#!/bin/sh\nprintf '%s\\n' "$PWD" "$@" > ${JSON.stringify(record)}\nexit 3\n`);
  await chmod(launcher, 0o755);

  machine.env.CLAND_LAUNCHER = launcher;
  const r = await initIn(machine, sub, 'open', '.', '+Cland');
  const d = await readDiscovery(root).catch(() => null);
  if (d) t.after(() => killDaemon(d.pid));
  assert.equal(r.code, 3, `the launcher's exit code is cland's: ${r.stderr}`);
  assert.ok(d, 'the hub runs');
  assert.deepEqual((await readFile(record, 'utf8')).trim().split('\n'), [root, root, '+Cland']);

  // a second open finds the hub running and starts no other
  const again = await initIn(machine, root, 'open');
  assert.equal(again.code, 3);
  assert.equal((await readDiscovery(root)).pid, d?.pid);
});
