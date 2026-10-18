// A hostile inherited registry is scratch-owned; no real account or binary is used in the proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';

const harness = new URL('./harness.ts', import.meta.url).href;
const daemon = new URL('../src/hub/daemon.ts', import.meta.url).href;
const cleanup = new URL('./process-cleanup.ts', import.meta.url).href;
const cli = new URL('../bin/cland.ts', import.meta.url).pathname;

test('generic fixture daemon, in-process daemon and raw CLI cannot inherit a host account registry or binaries', async t => {
  const root = await tempProject(t);
  const config = join(root, 'host-config');
  const account = join(root, 'host-account');
  const bin = join(root, 'host-bin');
  const executorState = join(root, 'host-executor-state');
  for (const dir of [join(config, 'cland'), account, bin]) await mkdir(dir, { recursive: true });
  await writeFile(join(config, 'cland', 'accounts.toml'), `[accounts.host]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(account)}\n`);
  const marker = join(root, 'host-invocations');
  // The inherited fake host binaries record an invocation; they have no provider or credential access.
  for (const name of ['claude', 'codex']) await writeFile(join(bin, name), '#!/bin/sh\nprintf invoked >> "$HOST_ACCOUNT_MARKER"\nexit 1\n', { mode: 0o755 });
  const scenario = join(root, 'fixture.test.mjs');
  await writeFile(scenario, `
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { startDaemon, tempProject, connectUi, cland, readDiscovery } from ${JSON.stringify(harness)};
import { serveProject } from ${JSON.stringify(daemon)};
import { onCleanup, ownProcess } from ${JSON.stringify(cleanup)};
test('all startup paths are isolated', async t => {
  const roots = await Promise.all(Array.from({length: 3}, () => tempProject(t)));
  assert.equal(process.env.DIGITALOCEAN_TOKEN, '', 'fixture startup must clear the inherited provider token');
  assert.notEqual(process.env.CLAND_EXECUTOR_STATE, ${JSON.stringify(executorState)}, 'fixture startup must replace inherited executor state');
  assert.equal(dirname(process.env.CLAND_EXECUTOR_STATE), dirname(process.env.XDG_CONFIG_HOME), 'executor state must belong to the worker fixture');
  assert.equal(process.env.XDG_STATE_HOME, join(dirname(process.env.XDG_CONFIG_HOME), 'state'), 'fallback state must belong to the worker fixture');
  const external = await startDaemon(t, roots[0]);
  const direct = await serveProject(roots[1], { log: () => {} });
  onCleanup(t, () => direct.stop());
  await new Promise((resolve, reject) => execFile(process.execPath, [${JSON.stringify(cli)}, 'hub', 'start'], { cwd: roots[2], env: process.env }, error => error ? reject(error) : resolve()));
  const raw = await readDiscovery(roots[2]);
  ownProcess(t, raw.pid);
  onCleanup(t, () => cland(roots[2], 'hub', 'stop'));
  const discoveries = [external.discovery, direct.discovery, raw];
  for (const discovery of discoveries) {
    const ui = await connectUi(t, discovery);
    const result = await ui.request({ type: 'account.poll' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.accounts, [], 'host registry must never enter a fixture');
    assert.notEqual(result.value.registry, ${JSON.stringify(join(config, 'cland', 'accounts.toml'))});
  }
});
`);
  const workerEnv = { ...process.env };
  delete workerEnv.NODE_TEST_CONTEXT;
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    execFile(process.execPath, ['--test', scenario], { env: { ...workerEnv, XDG_CONFIG_HOME: config, CLAUDE_CONFIG_DIR: account, CODEX_HOME: account,
      DIGITALOCEAN_TOKEN: 'sentinel-host-token', CLAND_EXECUTOR_STATE: executorState, XDG_STATE_HOME: join(root, 'host-state'),
      CLAND_CLAUDE_BIN: join(bin, 'claude'), CLAND_CODEX_BIN: join(bin, 'codex'), PATH: `${bin}:${process.env.PATH ?? ''}`, HOST_ACCOUNT_MARKER: marker }, timeout: 30000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') reject(error);
      else resolve({ code: error ? error.code as number : 0, stdout, stderr });
    });
  });
  assert.match(result.stdout, /all startup paths are isolated/, result.stdout + result.stderr);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.equal(await readFile(marker, 'utf8').catch(() => ''), '', 'neither inherited binary ran');
});
