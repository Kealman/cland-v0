// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';


test('auto suite reports the fetched diff decision and transports it to the package; --all forces full', async t => {
  const f = await fixture(t, 'node -e "console.log(process.env.CLAND_SUITE_SELECTION)"');
  const exec = promisify(execFile);
  const git = async (...args: string[]) => exec('git', args, { cwd: f.root });
  const remote = join(f.root, 'origin.git');
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Suite report test'); await git('config', 'user.email', 'suite@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\norigin.git/\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote); await git('push', 'origin', 'dev');
  await git('checkout', '-b', 't/T-214');
  await mkdir(join(f.root, 'hub', 'src', 'tracker'), { recursive: true });
  await writeFile(join(f.root, 'hub', 'src', 'tracker', 'tracker.ts'), '// package-local change');
  await git('add', '.'); await git('commit', '-m', 'hub change');
  await f.launch('auto');
  const reduced = await eventually('auto result', async () => (await f.results())[0]);
  assert.match(reduced.text, /mode hub-only; all paths outside nvim\/; deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
  const log = await readFile(reduced.artifacts[0]!.path, 'utf8');
  assert.match(log, /"mode":"hub-only","files":\["hub\/src\/tracker\/tracker.ts"\]/);
  await f.launch('--all');
  const full = await eventually('forced full result', async () => (await f.results())[1]);
  assert.match(full.text, /mode full; --all \/ all forces full/);
  assert.match(full.text, /deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
});

for (const cap of [768, 384]) {
test(`a broad deciding-file list publishes once below the ${cap}-byte cap and stays complete in the log`, async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, `[hygiene]\nmax_text_bytes = ${cap}\n`);
  const exec = promisify(execFile);
  const git = async (...args: string[]) => exec('git', args, { cwd: f.root });
  const remote = join(f.root, 'origin.git');
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Suite report test'); await git('config', 'user.email', 'suite@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\norigin.git/\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote); await git('push', 'origin', 'dev');
  await git('checkout', '-b', 't/T-214');
  await mkdir(join(f.root, 'nvim', 'test'), { recursive: true });
  const names = Array.from({ length: 150 }, (_, n) => `nvim/test/${String(n).padStart(3, '0')}-${'界'.repeat(40)}.test.ts`);
  for (const name of names) await writeFile(join(f.root, name), '// local test');
  await f.launch('auto');
  const result = await eventually('bounded report publication', async () => (await f.results())[0]);
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= cap);
  assert.match(result.text, /mode nvim-only/);
  assert.match(result.text, /all paths under nvim\//);
  assert.match(result.text, /full list in log/);
  assert.ok(!result.text.includes('�'));
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.ok(names.every(name => log.includes(name)), 'every deciding path remains in the log');
  await eventually('bounded report settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 1);
});
}
