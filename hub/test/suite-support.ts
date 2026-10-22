// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { completeJournalLines } from './journal-lines.ts';
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
export async function cacheRepository(f: Awaited<ReturnType<typeof fixture>>) {
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { cwd: f.root })).stdout.trim();
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Cache test'); await git('config', 'user.email', 'cache@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\norigin.git/\nexecutions\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-m', 'candidate');
  await git('init', '--bare', join(f.root, 'origin.git')); await git('remote', 'add', 'origin', join(f.root, 'origin.git'));
  await git('push', 'origin', 'dev');
  await git('checkout', '-b', 'candidate');
  return git;
}

export async function humanRunnerFixture(t: import('node:test').TestContext) {
  const f = await fixture(t, `${process.execPath} crew.mjs`);
  await writeFile(join(f.root, 'crew.mjs'), `import { existsSync, writeFileSync } from 'node:fs';
writeFileSync('crew-started', 'yes'); while (!existsSync('crew-finish')) await new Promise(r => setTimeout(r, 25));`);
  await writeFile(join(f.root, 'human.test.mjs'), `import test from 'node:test'; import { writeFileSync, existsSync } from 'node:fs';
test('tiny human target', async () => { writeFileSync('human-started', 'yes'); while (existsSync('human-hold') && !existsSync('human-finish')) await new Promise(r => setTimeout(r, 25)); });`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = { hub: join(f.root, 'suite.lock'), nvim: join(f.root, 'suite.lock-nvim') };
  await writeFile(join(f.root, 'human-entry.mjs'), `import { runPackageSuite } from ${JSON.stringify(runner)};
process.exitCode = await runPackageSuite(process.env.CLAND_SUITE_LEASE ? 'all' : 'hub', ['human.test.mjs', ...process.argv.slice(2)], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});`);
  const start = (extra: string[] = [], envExtra: NodeJS.ProcessEnv = {}) => {
    const env: NodeJS.ProcessEnv = { ...process.env, CLAND_HUB_FILE: join(f.root, '.cland', 'hub.json'), CLAND_TEST_SKIP_LOCK: '0', NODE_TEST_CONTEXT: '', ...envExtra };
    delete env.CLAND_SESSION_NAME; delete env.CLAND_SESSION_ID; delete env.CLAND_ROLE; delete env.CLAND_SUITE_LEASE;
    Object.assign(env, envExtra);
    const child = spawn(process.execPath, ['human-entry.mjs', ...extra], { cwd: f.root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    ownProcess(t, child.pid!);
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); }); child.stderr.on('data', chunk => { output += String(chunk); });
    const done = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); await done; });
    return { child, done, output: () => output };
  };
  const queue = async () => (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  const journal = async () => {
    assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    return completeJournalLines(await readFile(join(f.root, '.cland', 'journal.jsonl'), 'utf8')).map(line => JSON.parse(line) as Record<string, unknown>);
  };
  return { ...f, start, queue, journal, locks };
}
