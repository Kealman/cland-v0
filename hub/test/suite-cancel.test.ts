// T3: cancellation terminates real suite workers and descendants; hub restart recovers worker death and reports once.
// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { verificationFixture } from './verification-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { onCleanup, ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';

for (const recreate of [true, false]) test(`verify cancel reaps a detached fake child ${recreate ? 'that recreates the root after runner death' : 'before removing the phase root'}, then admits the next run`, async t => {
  const f = await fixture(t, 'node detached.mjs');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const environment = fileURLToPath(new URL('./fixture-environment.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'fake-child.json');
  const recreated = join(f.root, 'fake-recreated.json');
  const earlyRemoval = join(f.root, 'removed-with-live-child');
  await writeFile(join(f.root, 'detached.mjs'), `import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const remove = fs.rm;
fs.rm = async (path, options) => {
  const fake = await fs.readFile(${JSON.stringify(marker)}, 'utf8').then(JSON.parse, () => null);
  if (fake && path === fake.root) {
    try { process.kill(fake.pid, 0); await fs.writeFile(${JSON.stringify(earlyRemoval)}, 'root removal while descendant is alive'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  return remove(path, options);
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)});
process.exitCode = await runSuite([['--test', 'detached.test.mjs']], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});`);
  await writeFile(join(f.root, 'detached.test.mjs'), `import test from 'node:test';
import { spawn } from 'node:child_process';
import { fixtureEnvironment } from ${JSON.stringify(environment)};
test('detached fake harness', async () => {
  const child = spawn(process.execPath, ['fake.mjs', String(process.ppid), process.env.TMPDIR], {
    cwd: ${JSON.stringify(f.root)}, env: fixtureEnvironment(process.env.TMPDIR, process.env), detached: true, stdio: 'ignore'
  });
  child.unref();
  await new Promise(resolve => setTimeout(resolve, 30000)); // Artificial hold, ended by cancellation.
});`);
  await writeFile(join(f.root, 'fake.mjs'), `import { existsSync, readFileSync, renameSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
const parent = Number(process.argv[2]), root = process.argv[3];
const owner = JSON.parse(readFileSync(${JSON.stringify(`${locks[0]}.owner`)}, 'utf8'));
process.on('SIGTERM', () => {});
writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ pid: process.pid, root, device: owner.device, inode: owner.inode }));
const poll = setInterval(() => {
  try { process.kill(parent, 0); return; } catch (error) { if (error.code !== 'ESRCH') throw error; }
  clearInterval(poll);
  if (!${recreate}) { setInterval(() => {}, 1000); return; }
  if (existsSync(root)) renameSync(root, root + '.original');
  mkdirSync(root, { mode: 0o700 });
  writeFileSync(root + '/preserved', 'fake recreated after kill');
  const info = statSync(root);
  writeFileSync(${JSON.stringify(recreated)}, JSON.stringify({ device: info.dev, inode: info.ino }));
  setInterval(() => {}, 1000); // Cancellation must reap this detached survivor.
}, 10);`);
  const job = await f.launch();
  const fake = await eventually('detached fake child ready', async () => readFile(marker, 'utf8').then(JSON.parse, () => undefined));
  const stopFake = ownProcess(t, fake.pid);
  onCleanup(t, async () => {
    await stopFake();
    await rm(fake.root, { recursive: true, force: true });
    await rm(`${fake.root}.original`, { recursive: true, force: true });
    const after = await readFile(recreated, 'utf8').then(JSON.parse, () => null);
    if (after) await rm(`${fake.root}.quarantine-${after.device}-${after.inode}`, { recursive: true, force: true });
  });
  const cancelled = await clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  await eventually('cancelled result after complete tree cleanup', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.equal(pidAlive(fake.pid), false, 'detached descendant is reaped before cancellation is reported');
  await assert.rejects(stat(earlyRemoval), { code: 'ENOENT' }, 'suite root is never removed with a live detached descendant');
  if (recreate) {
    const after = JSON.parse(await readFile(recreated, 'utf8'));
    assert.notEqual(after.inode, fake.inode, 'fake recreated the root after the runner died');
  }
  await writeFile(join(f.root, 'detached.mjs'), 'console.log("next run admitted");');
  const next = await f.launch('auto', '--fresh');
  const result = await eventually('next local run after cancelled recreated root', async () => (await f.results()).find(m => m.id === `suite:${next.id}`), 7000);
  assert.match(result.text, /auto exit 0/);
  for (const lock of locks) await assert.rejects(stat(lock), { code: 'ENOENT' });
});


test('suite cancel defaults to the caller’s active run, stops its child and posts one cancelled result', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'child-pid\',String(process.pid));setTimeout(()=>{},30000)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  const child = await eventually('package child started', async () => readFile(join(f.root, 'child-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  assert.equal(JSON.parse(cancelled.stdout).id, job.id);
  const result = await eventually('cancelled result', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal(result.from, 'impl');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  await eventually('cancelled processes stopped', () => !pidAlive(job.pid!) && !pidAlive(child) ? true : undefined);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json'), 'utf8'));
  assert.equal(receipt.code, 143);
  assert.match(receipt.cause, /SIGTERM/);
  assert.equal((await f.results()).length, 1);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel refuses another session’s run while the human can cancel it by id', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"', undefined, '[hygiene]\nmax_text_bytes = 384\n');
  const rev = await spawnSpoke({ discover: true, cwd: f.root, name: 'rev', sessionId: 'suite-reviewer', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev']);
  const job = await f.launch();
  const refused = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'suite-reviewer' }, 'suite', 'cancel', job.id);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /cannot cancel another session’s suite/);
  assert.equal(pidAlive(job.pid!), true);
  assert.equal((await f.results()).length, 0);
  const cancelled = await cland(f.root, 'suite', 'cancel', job.id, '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('human cancellation report', async () => (await f.results())[0]);
  assert.equal(result.from, 'impl');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /exit 143; cancelled/);
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= 384);
  const repeated = await cland(f.root, 'suite', 'cancel', job.id);
  assert.equal(repeated.code, 0, repeated.stderr);
  assert.equal((await f.results()).length, 1);
  const missing = await clandWithEnv(f.root, f.env, 'suite', 'cancel');
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /no suite queued or running/);
});

test('verify cancel removes a pid-null queued job while an unrelated submission is held, preserving the holder’s lock', async t => {
  const bin = await tempProject(t, 'cland-suite-held-git-');
  // cland-allow-child-env: read-only which lookup for ps/Git wrappers; no account or Git operation
  const git = (await promisify(execFile)('which', ['git'])).stdout.trim();
  await writeFile(join(bin, 'git'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
if (existsSync('hold-git')) { writeFileSync('git-held', 'held'); while (!existsSync('release-git')) await pause(25); }
const result = spawnSync(${JSON.stringify(git)}, process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node queued.mjs', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'queued.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['-e', "require('fs').writeFileSync('admitted','yes')"]], { lockDir: ${JSON.stringify(lock)}, cwd: ${JSON.stringify(f.root)} });`);
  const job = await f.launch();
  assert.equal(job.pid, null);
  const other = join(f.root, 'other');
  await mkdir(other);
  await writeFile(join(other, 'hold-git'), 'hold');
  // This package inherits the root's verification commands and hub discovery.
  await verificationFixture(other);
  const submission = f.ui.request({ type: 'suite.start', mode: 'all', cwd: other, report: f.topic, to: ['impl', 'rev'] }, 15000);
  await eventually('unrelated submission held in git', async () => stat(join(other, 'git-held')).then(() => true, () => undefined));
  const cancellation = clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id);
  let cancelled;
  try {
    await eventually('queued cancellation reported before unrelated submission resumes', async () => (await f.results()).find(m => m.id === `suite:${job.id}`), 5000);
    cancelled = await cancellation;
  } finally {
    await writeFile(join(other, 'release-git'), 'release');
    const submitted = await submission;
    assert.equal(submitted.ok, true, submitted.error);
    const pid = (submitted.value as { pid: number | null }).pid;
    if (pid) ownProcess(t, pid);
    await cancellation;
  }
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const status = await f.ui.request({ type: 'hub.status', history: true });
  const queued = (status.value as { suites: Array<{ id: string; pid: number | null; state: string }> }).suites.find(s => s.id === job.id)!;
  assert.equal(queued.pid, null);
  assert.equal(queued.state, 'finished');
  const result = await eventually('queued cancellation result', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal((await stat(lock)).isDirectory(), true, 'manual holder lock remains intact');
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  await assert.rejects(stat(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json')), { code: 'ENOENT' });
  assert.equal((await f.results()).filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel cleans a running lock runner’s children and temporary root before publishing', async t => {
  const f = await fixture(t, 'node running.mjs');
  const lock = join(f.root, 'suite.lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'running.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'holding.mjs']], { lockDirs: ${JSON.stringify([lock, `${lock}-nvim`])}, cwd: ${JSON.stringify(f.root)} });`);
  // Artificial hold: cancellation ends this child; the 30-second timer is a failure ceiling.
  await writeFile(join(f.root, 'holding.mjs'), `import test from 'node:test'; import { writeFile } from 'node:fs/promises'; test('holding', async () => { await writeFile(${JSON.stringify(join(f.root, 'holder.json'))}, JSON.stringify({ pid: process.pid, root: process.env.TMPDIR })); await new Promise(r => setTimeout(r, 30000)); });`);
  const job = await f.launch();
  const holder = await eventually('runner child started', async () => readFile(join(f.root, 'holder.json'), 'utf8').then(text => JSON.parse(text) as { pid: number; root: string }, () => undefined));
  ownProcess(t, holder.pid);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('running runner cancellation result', async () => (await f.results())[0]);
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal(pidAlive(holder.pid), false);
  await assert.rejects(stat(lock), { code: 'ENOENT' });
  await assert.rejects(stat(holder.root), { code: 'ENOENT' });
  assert.deepEqual(await readdir(`${lock}.queue`), []);
  assert.equal((await f.results()).length, 1);
});

test('cancelled results held by reporting permissions survive restart and publish once', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  await eventually('worker test started', async () => (await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8')).includes('$ npm test') ? true : undefined);
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  await eventually('cancellation report held', async () => {
    const status = await f.ui.request({ type: 'hub.status', history: true });
    return (status.value as { suites: Array<{ error: string | null }> }).suites[0]?.error?.includes('forbidden') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const result = await eventually('cancelled result after restart', async () => {
    const history = await ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /exit 143; cancelled/);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  const repeated = await cland(f.root, 'suite', 'cancel', job.id);
  assert.equal(repeated.code, 0, repeated.stderr);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('a worker killed while the hub is down is reported after restart and its package children are cleaned', async t => {
  // T3: killing a worker while the hub is stopped proves restart crash recovery.
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'child-pid\',String(process.pid));setTimeout(()=>{},30000)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  const child = await eventually('package child identity', async () => readFile(join(f.root, 'child-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  const pid = await f.workerPid(job.id);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  process.kill(pid, 'SIGKILL');
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const result = await eventually('recovered crash report', async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /worker disappeared \(killed or crashed without an exit receipt\)/);
  await eventually('package child stopped', () => !pidAlive(child) ? true : undefined);
});
