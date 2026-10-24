// T3: detached worker crashes, cancellation and survival across a hub process restart.
// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath, stat, rm, readdir, utimes } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { beforeDirectories, captureProcess, cleanupProcesses, ownDirectory, ownProcess } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';

test('admission preserves recreated-root evidence and locks when a detached candidate has ambiguous ownership', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const token = randomUUID();
  const root = join(await realpath('/tmp'), `cland-suite-${token}`);
  await mkdir(root, { mode: 0o700 });
  ownDirectory(t, root);
  await writeFile(join(root, 'preserved'), 'ambiguous evidence');
  const marker = join(f.root, 'ambiguous-child');
  const child = spawn(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ready');setInterval(() => {}, 1000)`, root], {
    cwd: f.root, env: fixtureEnvironment(f.root, process.env, { TEST_SUITE_RUN_ID: token }), detached: true, stdio: 'ignore',
  });
  ownProcess(t, child.pid);
  await eventually('ambiguous candidate is running outside the root', async () => readFile(marker, 'utf8').then(() => true, () => undefined));
  const holder = { pid: 2147483647, started: null, since: 'unknown', token, root, device: 0, inode: 0, runner: { pid: 2147483647, started: 'unknown', group: 2147483647 } };
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  for (const lock of locks) {
    await mkdir(lock);
    await writeFile(`${lock}.owner`, JSON.stringify(holder));
    await writeFile(join(lock, 'holder.json'), JSON.stringify(holder));
    await utimes(`${lock}.owner`, new Date(0), new Date(0));
  }
  await f.launch();
  await eventually('ambiguous writer keeps admission blocked', async () => {
    const q = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    return q.localBlocked?.reason.includes('ambiguous writer ownership') ? true : undefined;
  });
  assert.equal(pidAlive(child.pid!), true, 'argv/environment hints alone do not authorize signalling');
  assert.equal(await readFile(join(root, 'preserved'), 'utf8'), 'ambiguous evidence');
  for (const lock of locks) assert.deepEqual(JSON.parse(await readFile(`${lock}.owner`, 'utf8')), holder);
  assert.deepEqual(await f.results(), []);
});

test('admission reaps a detached writer after its parent died before quarantining the recreated root', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const token = randomUUID();
  const root = join(await realpath('/tmp'), `cland-suite-${token}`);
  let stopParent = async () => {};
  let stopChild = async () => {};
  let quarantine: string | undefined;
  // Register before mkdir/spawn/await: a missing setup receipt still leaves its
  // writer discoverable by the exact fixture-owned cwd, including after reparenting.
  beforeDirectories(t, async () => {
    await stopParent();
    await stopChild();
    const paths = [root, `${root}.original`, ...(quarantine ? [quarantine] : [])];
    for (const path of paths) {
      if (await stat(path).then(() => true, () => false)) await cleanupProcesses(path, [], undefined, token, [], { discover: true });
    }
    for (const path of paths) await rm(path, { recursive: true, force: true });
  });
  await mkdir(root, { mode: 0o700 });
  const before = await stat(root);
  const marker = join(f.root, 'detached-writer');
  const environment = fileURLToPath(new URL('./fixture-environment.ts', import.meta.url));
  await writeFile(join(f.root, 'dead-parent.mjs'), `import { spawn } from 'node:child_process';
import { existsSync, renameSync, mkdirSync } from 'node:fs';
import { fixtureEnvironment } from ${JSON.stringify(environment)};
renameSync(${JSON.stringify(root)}, ${JSON.stringify(`${root}.original`)});
mkdirSync(${JSON.stringify(root)}, { mode: 0o700 });
const child = spawn(process.execPath, [${JSON.stringify(join(f.root, 'writer.mjs'))}], {
  cwd: ${JSON.stringify(root)}, env: fixtureEnvironment(${JSON.stringify(f.root)}, process.env), detached: true, stdio: 'ignore'
});
child.unref();
const poll = setInterval(() => { if (existsSync(${JSON.stringify(marker)})) clearInterval(poll); }, 10);`);
  await writeFile(join(f.root, 'writer.mjs'), `import { writeFileSync } from 'node:fs';
writeFileSync('preserved', 'orphan evidence');
writeFileSync(${JSON.stringify(marker)}, String(process.pid));
setInterval(() => writeFileSync('heartbeat', 'still writing'), 25);`);
  const parent = spawn(process.execPath, [join(f.root, 'dead-parent.mjs')], { cwd: f.root, env: fixtureEnvironment(f.root, process.env), detached: true, stdio: 'ignore' });
  stopParent = ownProcess(t, parent.pid);
  const identity = captureProcess(parent.pid);
  assert.ok(identity);
  const exited = new Promise<void>((resolve, reject) => { parent.once('close', () => resolve()); parent.once('error', reject); });
  const child = await eventually('detached writer has its own receipt', async () => readFile(marker, 'utf8').then(Number, () => undefined));
  stopChild = ownProcess(t, child);
  const after = await stat(root);
  quarantine = `${root}.quarantine-${after.dev}-${after.ino}`;
  await exited;
  assert.equal(pidAlive(parent.pid!), false, 'parent is already gone before recovery admission');
  const holder = { pid: parent.pid, started: identity.started, since: 'unknown', token, root, device: before.dev, inode: before.ino, runner: identity };
  for (const lock of [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')]) {
    await mkdir(lock);
    await writeFile(`${lock}.owner`, JSON.stringify(holder));
    await writeFile(join(lock, 'holder.json'), JSON.stringify(holder));
    await utimes(`${lock}.owner`, new Date(0), new Date(0));
  }
  const job = await f.launch();
  await eventually('successor admitted after orphan cleanup', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.equal(pidAlive(child), false, 'independently owned detached writer is gone before successor admission');
  assert.equal(await readFile(`${root}.quarantine-${after.dev}-${after.ino}/preserved`, 'utf8'), 'orphan evidence');
});

test('admission preserves a recreated root and both locks when stale metadata has no runner group', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const token = randomUUID();
  const root = join(await realpath('/tmp'), `cland-suite-${token}`);
  await mkdir(root, { mode: 0o700 });
  ownDirectory(t, root);
  await writeFile(join(root, 'preserved'), 'unknown descendants');
  const holder = { pid: 2147483647, started: null, since: 'unknown', token, root, device: 0, inode: 0 };
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  for (const lock of locks) {
    await mkdir(lock);
    await writeFile(`${lock}.owner`, JSON.stringify(holder));
    await writeFile(join(lock, 'holder.json'), JSON.stringify(holder));
    await utimes(`${lock}.owner`, new Date(0), new Date(0));
  }
  const job = await f.launch();
  const queue = await eventually('unknown group blocks admission with a reason', async () => {
    const q = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    return q.localBlocked?.reason.includes('runner group unknown') ? q : undefined;
  });
  assert.equal(queue.waiters[0]!.id, job.id);
  assert.equal(await readFile(join(root, 'preserved'), 'utf8'), 'unknown descendants');
  for (const lock of locks) {
    assert.equal((await stat(lock)).isDirectory(), true);
    assert.deepEqual(JSON.parse(await readFile(`${lock}.owner`, 'utf8')), holder);
  }
  assert.deepEqual(await f.results(), [], 'no worker runs or reports success');
});

test('admission quarantines a dead run’s recreated root and releases both compatibility locks', async t => {
  const f = await fixture(t, 'node recreated.mjs');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'recreated.json');
  await writeFile(join(f.root, 'recreated.mjs'), `import { runSuite } from ${JSON.stringify(runner)};
process.exitCode = await runSuite([['--test', 'replace.mjs']], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});`);
  await writeFile(join(f.root, 'replace.mjs'), `import test from 'node:test';
import { readFile, rename, mkdir, writeFile, stat } from 'node:fs/promises';
test('recreated phase root after runner death', async () => {
  const root = process.env.TMPDIR;
  const owner = JSON.parse(await readFile(${JSON.stringify(`${locks[0]}.owner`)}, 'utf8'));
  await rename(root, root + '.original');
  process.kill(process.ppid, 'SIGKILL');
  await mkdir(root, { mode: 0o700 });
  await writeFile(root + '/preserved', 'recreated by fake child');
  const info = await stat(root);
  await writeFile(${JSON.stringify(marker)}, JSON.stringify({ root, before: { device: owner.device, inode: owner.inode }, after: { device: info.dev, inode: info.ino } }));
});`);
  const job = await f.launch();
  const recreated = await eventually('fake child recreated root after runner kill', async () => readFile(marker, 'utf8').then(JSON.parse, () => undefined));
  // These are exact fixture-owned paths, retained until all package writers stop.
  t.after(async () => {
    await rm(`${recreated.root}.original`, { recursive: true, force: true });
    await rm(recreated.root, { recursive: true, force: true });
    await rm(`${recreated.root}.quarantine-${recreated.after.device}-${recreated.after.inode}`, { recursive: true, force: true });
  });
  await eventually('first run reports after package crash', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  await writeFile(join(f.root, 'recreated.mjs'), 'console.log("next local run admitted");');
  const next = await f.launch('auto', '--fresh');
  const result = await eventually('next local run admitted after quarantine', async () => (await f.results()).find(m => m.id === `suite:${next.id}`), 7000);
  assert.match(result.text, /auto exit 0/);
  await f.ui.request({ type: 'hub.status', flushLogs: true });
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const event = journal.find(entry => entry.event === 'suite-recovery-quarantined');
  assert.ok(event, 'quarantine has a durable journal receipt');
  assert.deepEqual(event.before, recreated.before);
  assert.deepEqual(event.after, recreated.after);
  assert.equal(await readFile(join(event.quarantine, 'preserved'), 'utf8'), 'recreated by fake child');
  await assert.rejects(stat(recreated.root), { code: 'ENOENT' });
  for (const lock of locks) await assert.rejects(stat(lock), { code: 'ENOENT' });
});


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
  assert.doesNotMatch(result.text, /auto exit 0/);
  assert.equal(pidAlive(created.pid), false);
  await assert.rejects(stat(created.root), { code: 'ENOENT' });
  for (const lock of locks) {
    await assert.rejects(stat(lock), { code: 'ENOENT' });
    await assert.rejects(stat(`${lock}.owner`), { code: 'ENOENT' });
  }
  assert.deepEqual(await readdir(`${locks[0]}.runs`), [], 'crashed package record is removed after cleanup');
  const next = await f.launch();
  const passed = await eventually('successor borrows a clean lease', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /auto exit 0/);
});

for (const holder of ['live', 'stale'] as const) test(`admission stays responsive and bounds a held ps probe for a ${holder} compatibility holder`, async t => {
  const bin = await tempProject(t, 'cland-held-admission-ps-');
  // cland-allow-child-env: read-only OS identity/tool-discovery probe; no account, provider or Git operation
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
  // cland-allow-child-env: read-only OS identity/tool-discovery probe; no account, provider or Git operation
  const started = (await promisify(execFile)(ps, ['-o', 'lstart=', '-p', String(process.pid)])).stdout.trim().replace(/\s+/g, ' ');
  await writeFile(`${lock}.owner`, JSON.stringify({ pid: holder === 'live' ? process.pid : 2147483647, started, token: 'held-compatibility-probe', since: new Date().toISOString() }));
  await writeFile(held, 'hold');
  try {
    const pid = await eventually('admission probe held', async () => readFile(probe, 'utf8').then(Number, () => undefined));
    // The T2 held-inspection case proves replies precede admission completion.
    // Use the normal socket watchdog here; host scheduling is not a latency SLA.
    const status = await f.ui.request({ type: 'hub.status' });
    assert.equal(status.ok, true);
    const cancel = await f.ui.request({ type: 'suite.cancel', suite: job.id });
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
  assert.doesNotMatch(failed.text, /auto exit 0/);
  const next = await f.launch();
  const passed = await eventually('successor admitted after stale recovery', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /auto exit 0/);
  await assert.rejects(stat(root), { code: 'ENOENT' });
  for (const lock of locks) await assert.rejects(stat(`${lock}.owner`), { code: 'ENOENT' });
  assert.deepEqual(await readdir(`${locks[0]}.runs`), [], 'stale and successful records are removed');
});

test('cancel removes an admitted worker’s compatibility FIFO ticket without releasing a racing hand holder', async t => {
  const bin = await tempProject(t, 'cland-worker-lease-race-');
  // cland-allow-child-env: read-only OS identity/tool-discovery probe; no account, provider or Git operation
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

// T3: the detached worker must survive an actual hub process restart mid-command.
test('hub restart preserves the submitted command lines while its worker finishes', async t => {
  const f = await fixture(t, 'exit 91', 'exit 92', undefined, undefined, undefined, undefined, startDaemon);
  const path = join(f.root, '.cland/config.toml');
  const config = parseConfig(await readFile(path, 'utf8'), 'restart commands');
  const commands = { prepare: 'exit 93', check: 'printf frozen-check', test: 'node barrier.mjs' };
  Object.assign(config.verification, commands);
  await writeFile(path, renderConfig(config));
  await writeFile(join(f.root, 'barrier.mjs'), `import { writeFileSync, existsSync, watch } from 'node:fs';
await new Promise(resolve => {
  const watcher = watch('.', () => {
    if (!existsSync('finish')) return;
    watcher.close();
    resolve();
  });
  writeFileSync('entered', 'ready');
});
console.log('frozen-test');`);
  const job = await f.launch();
  await f.workerPid(job.id);
  await eventually('submitted command entered', () => stat(join(f.root, 'entered')).then(() => true, () => undefined));
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  Object.assign(config.verification, { check: 'exit 94', test: 'exit 95' });
  await writeFile(path, renderConfig(config));
  const restarted = await startDaemon(t, f.root);
  const ui = await connectUi(t, restarted.discovery);
  await writeFile(join(f.root, 'finish'), 'go');
  const receipt = await eventually('released worker completion receipt', async () => readFile(join(f.root, '.cland/run/suites', job.id, 'result.json'), 'utf8').then(text => JSON.parse(text) as { code: number }, () => undefined));
  assert.equal(receipt.code, 0);
  const result = await eventually('restored command run reported', async () => {
    const history = await ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /exit 0/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.match(log, /Commands: check printf frozen-check · test node barrier.mjs/);
  assert.match(log, /\$ printf frozen-check[\s\S]*\$ node barrier.mjs[\s\S]*frozen-test/);
  assert.doesNotMatch(log, /\$ exit 9[1-5]/);
});
