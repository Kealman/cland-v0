// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { serializeTierManifest } from '../src/suite-shards.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, eventually, spawnSpoke } from './harness.ts';
import { fixture } from './suite-fixture.ts';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { cacheRepository } from './suite-support.ts';
import { onCleanup } from './process-cleanup.ts';

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
  assert.match(reduced.text, /mode hub-only; all paths outside nvim\/; coverage map missing; deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
  const log = await readFile(reduced.artifacts[0]!.path, 'utf8');
  assert.match(log, /"mode":"hub-only","files":\["hub\/src\/tracker\/tracker.ts"\]/);
  const reserved = await f.spoke.call<{ ok: boolean; code: string; error: string }>('verify', { mode: 'all', cwd: f.root, report: f.topic, to: ['rev'] });
  assert.equal(reserved.ok, false);
  assert.equal(reserved.code, 'verify-all-reserved');
  assert.match(reserved.error, /mode hub-only/);
  assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, []);
  assert.equal(((await f.ui.request({ type: 'hub.status' })).value as HubStatus).suites!.length, 1, 'MCP refusal creates no suite');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
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

test('integrated dev verify publishes a portable function map once; task verify never captures', async t => {
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const f = await fixture(t, 'node hub/test/run-suite.ts');
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await mkdir(join(f.root, 'hub/src/hub'), { recursive: true });
  await mkdir(join(f.root, 'nvim/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/run-suite.ts'), `// inheritedLease and reduceCoverage supplied by the imported package runner\nimport { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], { cwd: process.cwd() });`);
  await writeFile(join(f.root, 'hub/src/hub/covered.ts'), 'export function called() { return 42; }\nexport function never() { return 0; }\n');
  await writeFile(join(f.root, 'hub/test/covered.test.ts'), "import test from 'node:test'; import assert from 'node:assert/strict'; import { called } from '../src/hub/covered.ts'; test('fixture calls function', () => assert.equal(called(), 42));\n");
  for (const file of ['hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts', 'nvim/test/scenarios/workbench.test.ts']) { await mkdir(join(f.root, file, '..'), { recursive: true }); await writeFile(join(f.root, file), "import test from 'node:test'; test('smoke', () => {});\n"); }
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: Object.fromEntries(['hub/test/covered.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts', 'nvim/test/scenarios/workbench.test.ts'].map(file => [file, 'T3'])) }));
  await git('add', '.'); await git('commit', '-m', 'coverage fixture'); await git('push', 'origin', 'dev');
  const head = await git('rev-parse', 'HEAD');
  const coord = await spawnSpoke({ discover: true, cwd: f.root, name: 'coord', sessionId: 'coverage-coord', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  const launched = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'coverage-coord' }, 'verify', 'all', '--fresh', '--report', f.topic, '--to', 'rev', '--json');
  assert.equal(launched.code, 0, launched.stderr);
  const submitted = JSON.parse(launched.stdout) as { id: string; pid: number | null };
  if (submitted.pid) ownProcess(t, submitted.pid);
  const result = await eventually('integrated coverage result', async () => (await f.results())[0], 15000).catch(async error => {
    const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
    const log = await readFile(join(f.root, '.cland/run/suites', submitted.id, 'suite.log'), 'utf8');
    throw new Error(`${error.message}\n${JSON.stringify(status.suites)}\n${log}`);
  });
  assert.match(result.text, /exit 0/);
  const artifacts = (await f.ui.request({ type: 'artifact.list', topic: f.topic })).value as { artifacts: Artifact[] };
  const maps = artifacts.artifacts.filter(a => a.title.startsWith('Coverage map '));
  assert.equal(maps.length, 1);
  const map = JSON.parse(await readFile(maps[0]!.path, 'utf8'));
  assert.equal(map.head, head);
  assert.equal(map.tree, ((await f.ui.request({ type: 'hub.status' })).value as HubStatus).suites!.find(job => job.id === JSON.parse(launched.stdout).id)!.tree);
  assert.deepEqual(map.testFiles, ['hub/test/covered.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts']);
  const functions = map.files['hub/src/hub/covered.ts'].functions;
  assert.deepEqual(functions.find((fn: { name: string }) => fn.name === 'called').tests, ['hub/test/covered.test.ts']);
  assert.deepEqual(functions.find((fn: { name: string }) => fn.name === 'never').tests, []);
  await git('checkout', '-b', 'task-coverage');
  await writeFile(join(f.root, 'hub/src/hub/covered.ts'), 'export function called() { return 43; }\nexport function never() { return 0; }\n');
  await git('add', '.'); await git('commit', '-m', 'one function');
  const task = await f.launch('auto');
  const taskResult = await eventually('selected task result', async () => (await f.results()).find(message => message.text.startsWith(`suite result ${task.id}`)), 15000);
  assert.match(taskResult.text, /mode hub-selected/);
  assert.match(taskResult.text, /deciding functions.*called/);
  // The selected run catches this deliberately changed return value.
  assert.match(taskResult.text, /exit 1/);
  const after = (await f.ui.request({ type: 'artifact.list', topic: f.topic })).value as { artifacts: Artifact[] };
  assert.equal(after.artifacts.filter(a => a.title.startsWith('Coverage map ')).length, 1);
});
