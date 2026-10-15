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


test('cache survives hub restart, separates effective modes, and never reuses a failed run', async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n');process.exit(require('fs').existsSync('.cland/fail')?1:0)"`);
  const pkg = JSON.parse(await readFile(join(f.root, 'package.json'), 'utf8'));
  pkg.workspaces = ['hub'];
  await writeFile(join(f.root, 'package.json'), JSON.stringify(pkg));
  await mkdir(join(f.root, 'hub'));
  await writeFile(join(f.root, 'hub', 'package.json'), JSON.stringify({ name: 'hub', scripts: { test: `node -e "require('fs').appendFileSync('../executions','run\\n')"` } }));
  const git = await cacheRepository(f);
  await mkdir(join(f.root, 'hub', 'src', 'tracker'), { recursive: true });
  await writeFile(join(f.root, 'hub', 'src', 'tracker', 'example.ts'), '// change');
  await git('add', 'hub'); await git('commit', '-m', 'hub-only change');
  await writeFile(join(f.root, '.cland', 'fail'), 'fail');
  const failed = await f.launch();
  assert.match((await eventually('failed run', async () => (await f.results())[0])).text, /exit 1/);
  await rm(join(f.root, '.cland', 'fail'));
  const green = await f.launch();
  assert.equal(green.cached, undefined);
  assert.notEqual(green.id, failed.id);
  assert.match((await eventually('green run', async () => (await f.results())[1])).text, /exit 0/);
  await writeFile(join(f.root, '.cland', 'fail'), 'fail');
  const freshFailure = await f.launch('all', '--fresh');
  assert.equal(freshFailure.cached, undefined);
  assert.match((await eventually('fresh failure', async () => (await f.results())[2])).text, /exit 1/);
  await rm(join(f.root, '.cland', 'fail'));
  const recoveredGreen = await f.launch();
  assert.equal(recoveredGreen.cached, undefined, 'a fresh failure supersedes the old green');
  await eventually('recovered green', async () => (await f.results())[3]);
  const reduced = await f.launch('hub');
  assert.equal(reduced.cached, undefined, 'full and hub-only have separate keys');
  await eventually('reduced run', async () => (await f.results())[4]);
  const reducedAgain = await f.launch('auto');
  assert.equal(reducedAgain.cached?.run, reduced.id, 'auto resolves to the same effective mode');
  await eventually('reduced cache', async () => (await f.results())[5]);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery, 'cli');
  await f.spoke.waitForPresence(['impl']);
  const recovered = await f.launch();
  assert.equal(recovered.cached?.run, recoveredGreen.id);
  const result = await eventually('recovered cache result', async () => {
    const history = await ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${recovered.id}`);
  });
  assert.match(result.text, /cached/);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\nrun\nrun\nrun\nrun\n');
});

test('a bounded cached report retains both heads, original run and candidate tree', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '[hygiene]\nmax_text_bytes = 384\n');
  const git = await cacheRepository(f);
  const original = await f.launch();
  await eventually('bounded original', async () => (await f.results())[0]);
  await git('commit', '--allow-empty', '-m', 'same tree');
  const head = await git('rev-parse', 'HEAD');
  const hit = await f.launch();
  assert.equal(hit.cached?.run, original.id);
  const result = await eventually('bounded cache', async () => (await f.results())[1]);
  assert.ok(Buffer.byteLength(result.text) <= 384);
  assert.ok(result.text.includes('cached') && result.text.includes(head) && result.text.includes(original.id) && result.text.includes(hit.cached!.head) && result.text.includes(hit.cached!.tree));
  assert.equal(result.artifacts.length, 1);
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  await eventually('bounded cache settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(j => j.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 2);
});

test('a package subdirectory cannot borrow root-tree cache evidence for different npm scripts', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  await mkdir(join(f.root, 'other-package'));
  await writeFile(join(f.root, 'other-package', 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: 'node -e "process.exit(1)"' } }));
  await cacheRepository(f);
  await f.launch();
  assert.match((await eventually('root green', async () => (await f.results())[0])).text, /exit 0/);
  const response = await clandWithEnv(join(f.root, 'other-package'), f.env, 'verify', 'all', '--report', f.topic, '--to', 'rev', '--json');
  assert.equal(response.code, 0, response.stderr);
  const subdirectory = JSON.parse(response.stdout) as { id: string; cached?: unknown; pid?: number };
  if (subdirectory.pid) ownProcess(t, subdirectory.pid);
  assert.equal(subdirectory.cached, undefined);
  assert.match((await eventually('package failure', async () => (await f.results())[1])).text, /exit 1/);
});
