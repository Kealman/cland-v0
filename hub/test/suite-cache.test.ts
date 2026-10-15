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


test('verify reuses a green candidate tree after a tracker-only commit and reports original provenance', async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n')"`);
  const git = await cacheRepository(f);
  const a = await git('rev-parse', 'HEAD');
  const original = await f.launch();
  const green = await eventually('original green', async () => (await f.results())[0]);
  assert.match(green.text, /exit 0/, green.text);
  const status = await f.ui.request({ type: 'hub.status' });
  assert.ok((status.value as { suites: Array<{ tree?: string }> }).suites[0]?.tree, JSON.stringify(status.value));
  const same = await f.launch();
  assert.equal(same.pid, null);
  assert.equal(same.cached?.run, original.id);
  const repeated = await eventually('same-head cached result', async () => (await f.results())[1]);
  assert.match(repeated.text, /cached/);
  assert.equal(repeated.text.split('\n').find(line => line.startsWith('Executor ')), green.text.split('\n').find(line => line.startsWith('Executor ')));
  assert.ok(repeated.text.includes(original.id) && repeated.text.includes(a));
  await git('checkout', 'dev');
  await writeFile(join(f.root, '.cland', 'tasks', 'cache-note.md'), 'tracker-only');
  await git('add', '-f', '.cland/tasks/cache-note.md'); await git('commit', '-m', 'tracker only');
  await git('push', 'origin', 'dev'); await git('checkout', 'candidate'); await git('merge', 'dev', '--no-edit');
  const b = await git('rev-parse', 'HEAD');
  assert.notEqual(a, b);
  const tracker = await f.launch();
  assert.equal(tracker.cached?.run, original.id);
  assert.equal(tracker.cached?.tree, same.cached?.tree);
  const result = await eventually('tracker cache result', async () => (await f.results())[2]);
  assert.ok(result.text.includes(`head ${b}`));
  assert.ok(result.text.includes(`Original run ${original.id}`) && result.text.includes(`head ${a}`));
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\n');
  await writeFile(join(f.root, 'source.txt'), 'changed source');
  await git('add', 'source.txt'); await git('commit', '-m', 'source change');
  const changed = await f.launch();
  assert.equal(changed.cached, undefined);
  await eventually('changed tree ran', async () => (await f.results())[3]);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\nrun\n');
});

for (const cancellation of ['requester', 'head change'] as const) test(`a fresh attempt cancelled by ${cancellation} preserves the original green cache evidence`, async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n')"`);
  const git = await cacheRepository(f);
  const original = await f.launch();
  assert.match((await eventually('original green', async () => (await f.results())[0])).text, /exit 0/);
  await mkdir(join(f.root, 'suite.lock'));
  const fresh = await f.launch('all', '--fresh');
  assert.equal(fresh.pid, null);
  assert.equal(fresh.cached, undefined);
  if (cancellation === 'requester') {
    const cancelled = await clandWithEnv(f.root, f.env, 'verify', 'cancel', fresh.id);
    assert.equal(cancelled.code, 0, cancelled.stderr);
  } else {
    await git('commit', '--allow-empty', '-m', 'same tree at a new head');
    await rm(join(f.root, 'suite.lock'), { recursive: true });
  }
  assert.match((await eventually('fresh cancellation', async () => (await f.results())[1])).text, /cancelled/);
  const hit = await f.launch();
  assert.equal(hit.cached?.run, original.id);
  assert.equal(hit.pid, null);
  const result = await eventually('original green reused', async () => (await f.results())[2]);
  assert.ok(result.text.includes(`Original run ${original.id}`), result.text);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\n');
});

test('verify --fresh runs despite a green cache and cache hits do not extend expiry', async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n')"`, undefined, '', {}, 1, 0.1);
  await cacheRepository(f);
  const first = await f.launch();
  await eventually('first completion', async () => (await f.results())[0]);
  const forced = await f.launch('all', '--fresh');
  assert.equal(forced.cached, undefined);
  assert.notEqual(forced.id, first.id);
  await eventually('fresh completion', async () => (await f.results())[1]);
  const cached = await f.launch();
  assert.equal(cached.cached?.run, forced.id);
  await eventually('cached completion', async () => (await f.results())[2]);
  await new Promise(resolve => setTimeout(resolve, 6100)); // Expiry: exceed the configured 0.1-minute cache lifetime without refreshing it.
  const expired = await f.launch();
  assert.equal(expired.cached, undefined);
  await eventually('expired completion', async () => (await f.results())[3]);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\nrun\nrun\n');
});

test('dirty candidates bypass green cache and cannot seed a later clean result', async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n')"`);
  const git = await cacheRepository(f);
  await writeFile(join(f.root, 'source.txt'), 'untracked');
  const dirty = await f.launch();
  assert.equal(dirty.cached, undefined);
  await eventually('dirty completion', async () => (await f.results())[0]);
  await git('add', 'source.txt'); await git('commit', '-m', 'clean candidate');
  const clean = await f.launch();
  assert.equal(clean.cached, undefined);
  await eventually('clean completion', async () => (await f.results())[1]);
  await writeFile(join(f.root, 'source.txt'), 'unstaged');
  const unstaged = await f.launch();
  assert.equal(unstaged.cached, undefined);
  await eventually('unstaged completion', async () => (await f.results())[2]);
  await git('add', 'source.txt');
  const staged = await f.launch();
  assert.equal(staged.cached, undefined);
  await eventually('staged completion', async () => (await f.results())[3]);
  await git('restore', '--staged', '--worktree', 'source.txt');
  const restored = await f.launch();
  assert.equal(restored.cached?.run, clean.id);
  await eventually('restored cache', async () => (await f.results())[4]);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\nrun\nrun\nrun\n');
});
