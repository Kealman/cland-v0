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


test('worker cleanup removes a borrowed root when its package runner dies during mkdir', async t => {
  const f = await fixture(t, `${process.execPath} borrowed-crash.mjs`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'created-root.json');
  await writeFile(join(f.root, 'borrowed-crash.mjs'), `import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const mkdir = fs.mkdir;
fs.mkdir = async (...args) => {
  const result = await mkdir(...args);
  const root = String(args[0]);
  if (root.split('/').at(-1).startsWith('cland-suite-') && !existsSync(${JSON.stringify(marker)})) {
    await fs.writeFile(${JSON.stringify(marker)}, JSON.stringify({ root, pid: process.pid }));
    process.kill(process.pid, 'SIGKILL');
  }
  return result;
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)});
process.exitCode = await runSuite([], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});
`);
  const job = await f.launch();
  const created = await eventually('borrowed root creation crashed', async () => readFile(marker, 'utf8').then(text => JSON.parse(text) as { root: string; pid: number }, () => undefined));
  t.after(() => rm(created.root, { recursive: true, force: true }));
  const result = await eventually('worker reports package crash after cleanup', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.doesNotMatch(result.text, /all exit 0/);
  assert.equal(pidAlive(created.pid), false);
  await assert.rejects(stat(created.root), { code: 'ENOENT' });
  for (const lock of locks) {
    await assert.rejects(stat(lock), { code: 'ENOENT' });
    await assert.rejects(stat(`${lock}.owner`), { code: 'ENOENT' });
  }
  assert.deepEqual(await readdir(`${locks[0]}.runs`), [], 'crashed package record is removed after cleanup');
  const next = await f.launch();
  const passed = await eventually('successor borrows a clean lease', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /all exit 0/);
});

for (const holder of ['live', 'stale'] as const) test(`admission stays responsive and bounds a held ps probe for a ${holder} compatibility holder`, async t => {
  const bin = await tempProject(t, 'cland-held-admission-ps-');
  const ps = (await promisify(execFile)('which', ['ps'])).stdout.trim();
  const held = join(bin, 'held');
  const release = join(bin, 'release');
  const probe = join(bin, 'probe-pid');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
if (existsSync(${JSON.stringify(held)})) {
  writeFileSync(${JSON.stringify(probe)}, String(process.pid));
  while (!existsSync(${JSON.stringify(release)})) await pause(25);
}
const result = spawnSync(${JSON.stringify(ps)}, process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const job = await f.launch();
  assert.equal(job.pid, null);
  const started = (await promisify(execFile)(ps, ['-o', 'lstart=', '-p', String(process.pid)])).stdout.trim().replace(/\s+/g, ' ');
  await writeFile(`${lock}.owner`, JSON.stringify({ pid: holder === 'live' ? process.pid : 2147483647, started, token: 'held-compatibility-probe', since: new Date().toISOString() }));
  await writeFile(held, 'hold');
  try {
    const pid = await eventually('admission probe held', async () => readFile(probe, 'utf8').then(Number, () => undefined));
    const status = await f.ui.request({ type: 'hub.status' }, 500);
    assert.equal(status.ok, true);
    const cancel = await f.ui.request({ type: 'suite.cancel', suite: job.id }, 500);
    assert.equal(cancel.ok, true, cancel.error);
    await eventually('held admission probe terminated at its deadline', () => !pidAlive(pid) ? true : undefined, 7000);
  } finally {
    await writeFile(release, 'release');
  }
});

// T3: real worker death during package mkdir proves admission recovers its borrowed root.
test('admission recovers a borrowed planned root after the worker dies during package mkdir', async t => {
  const f = await fixture(t, `${process.execPath} paused-borrow.mjs`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'planned-root');
  await writeFile(join(f.root, 'paused-borrow.mjs'), `import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const mkdir = fs.mkdir;
fs.mkdir = async (...args) => {
  const result = await mkdir(...args);
  const root = String(args[0]);
  if (root.split('/').at(-1).startsWith('cland-suite-') && !existsSync(${JSON.stringify(marker)})) {
    await fs.writeFile(${JSON.stringify(marker)}, root);
    // Artificial hold: kill the worker while borrowed-root publication is in flight.
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  return result;
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)});
process.exitCode = await runSuite([], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});
`);
  const job = await f.launch();
  const root = await eventually('borrowed planned root exists', async () => readFile(marker, 'utf8').catch(() => undefined));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pid = await f.workerPid(job.id);
  process.kill(pid, 'SIGKILL');
  const failed = await eventually('worker crash reported', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.doesNotMatch(failed.text, /all exit 0/);
  const next = await f.launch();
  const passed = await eventually('successor admitted after stale recovery', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /all exit 0/);
  await assert.rejects(stat(root), { code: 'ENOENT' });
  for (const lock of locks) await assert.rejects(stat(`${lock}.owner`), { code: 'ENOENT' });
  assert.deepEqual(await readdir(`${locks[0]}.runs`), [], 'stale and successful records are removed');
});

test('cancel removes an admitted worker’s compatibility FIFO ticket without releasing a racing hand holder', async t => {
  const bin = await tempProject(t, 'cland-worker-lease-race-');
  const ps = (await promisify(execFile)('which', ['ps'])).stdout.trim();
  const hold = join(bin, 'hold-worker');
  const entered = join(bin, 'worker-held');
  const release = join(bin, 'release-worker');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
const args = process.argv.slice(2);
// Startup no longer warms the hub's async self probe. Hold only the worker's
// self probe, so admission can still read the hub's own identity.
const parent = spawnSync(${JSON.stringify(ps)}, ['-o', 'command=', '-p', String(process.ppid)], { encoding: 'utf8' });
if (existsSync(${JSON.stringify(hold)}) && args.at(-1) === String(process.ppid) && parent.stdout?.includes('/hub/suite-worker.ts')) {
  writeFileSync(${JSON.stringify(entered)}, String(process.ppid));
  while (!existsSync(${JSON.stringify(release)})) await pause(25);
}
const result = spawnSync(${JSON.stringify(ps)}, args, { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'admitted\',\'yes\')"', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  await writeFile(hold, 'hold');
  const job = await f.launch();
  const pid = await f.workerPid(job.id);
  assert.ok(pid);
  await eventually('worker paused before compatibility acquisition', async () => readFile(entered, 'utf8').then(enteredPid => Number(enteredPid) === pid ? true : undefined, () => undefined));
  const lock = join(f.root, 'suite.lock');
  try { await mkdir(lock); }
  finally { await writeFile(release, 'release'); }
  await eventually('admitted worker has a legacy FIFO ticket', async () => readdir(`${lock}.queue`).then(files => files.length === 1 ? true : undefined, () => undefined));
  const cancelled = await clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id, '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('queued worker cancellation posted', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 143; cancelled/);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.deepEqual(await readdir(`${lock}.queue`), []);
  assert.equal(pidAlive(pid), false);
  assert.equal((await stat(lock)).isDirectory(), true);
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  assert.equal((await f.results()).filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite report includes locked shard duration, free duration and queue waits', () => {
  const summary = suiteSummary('ℹ tests 2\nℹ pass 2\nverification queue wait 12.30s\nshard duration hub free 1.00s; workers 1; resource free; machine wait 0.00s\nshard duration hub machine 55.00s; workers 4; resource machine; machine wait 0.03s\nsuite duration 57.00s; lock wait 0.10s; peak 1m load 8.00\n');
  assert.match(summary, /verification queue wait 12.30s/);
  assert.match(summary, /shard duration hub machine 55.00s/);
  assert.match(summary, /shard duration hub free 1.00s/);
  assert.match(summary, /suite duration 57.00s; lock wait 0.10s/);
});
