// T3: daemon lifecycle regressions: competing startup locks, signals, crash recovery and endpoint identity.
// The curated start/discovery/stop/restart/sweep flow lives in scenarios/hub-lifecycle.test.ts.
import { cleanupProcesses, onCleanup, ownProcess } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { assignRole, cland, clandWithEnv, CLI_ENTRY, connectSocket, killDaemon, pidAlive, projectHub, readDiscovery, eventually, sleep, startDaemon, tempProject } from './harness.ts';
import { NO_PS } from './native-process.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { askHubFrame } from '../src/cli/socket-client.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { preparedDropletFixture } from './droplet-fixture.ts';
import { syntheticProviderEnvironment } from './synthetic-provider.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';

for (const action of ['hub stop', 'SIGTERM', 'SIGTERM with stalled socket close'] as const) test(`${action} during an in-flight droplet create retains ownership and reaps the hub within three seconds`, async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('cland-test-shutdown');
  await preparedDropletFixture(root, api);
  const stalled = action === 'SIGTERM with stalled socket close';
  const preload = join(root, '.cland/stalled-close.mjs');
  if (stalled) await writeFile(preload, `
    import net from 'node:net';
    import { writeFileSync } from 'node:fs';
    net.Server.prototype.close = function() {
      writeFileSync(${JSON.stringify(join(root, '.cland/close-entered'))}, 'socket close entered');
      return this;
    };
  `);
  const env = syntheticProviderEnvironment(fixtureEnvironment(join(root, '.cland/fixture'), process.env, {
    TMPDIR: tmpdir(), CLAND_TEST_SKIP_ORPHAN_SWEEP: '1',
    ...(stalled ? { NODE_OPTIONS: `--import=${pathToFileURL(preload).href}` } : {}),
  }), { token: 'cland-test-shutdown', endpoint: api.url });
  const entered = Promise.withResolvers<void>();
  const create = Promise.withResolvers<void>();
  api.beforeCreate(async () => { entered.resolve(); await create.promise; });
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  const exited = new Promise<number | null>(resolve => child.once('exit', resolve));
  onCleanup(t, async () => {
    if (child.exitCode === null) child.kill('SIGKILL');
    await exited;
    create.resolve();
    if (api.requests.some(r => r.method === 'POST' && r.path === '/v2/droplets')) await eventually('late fake create settled before removing its files', () => api.droplets.length ? true : undefined, 5000);
    await cleanupProcesses(root, [], undefined, undefined, []);
    await api.close();
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  await eventually('hub serve startup before provisioning', () => {
    assert.equal(child.exitCode, null, output);
    return output.includes('hub serving') ? true : undefined;
  }, 10000);
  const discovery = await readDiscovery(root);
  await askHubFrame(discovery, { type: 'suite.start', mode: 'auto', cwd: root, report: 'general', executor: 'droplet' }, 5000, env);
  await eventually('fake provider create entered', () => api.requests.some(r => r.method === 'POST' && r.path === '/v2/droplets') ? true : undefined, 10000);
  await entered.promise;
  const [lease] = await readLeases(root);
  assert.ok(lease?.createStarted);
  assert.equal(lease.resource, null);
  assert.deepEqual(lease.tags.slice(0, 1), ['cland']);
  const stopped = stalled ? eventually('native socket close entered during provisioning shutdown', async () => readFile(join(root, '.cland/close-entered'), 'utf8'), 3000)
    : eventually('durable stopped receipt during provisioning', async () =>
      (await readFile(join(root, '.cland/log/hub.log'), 'utf8')).includes('"event":"stopped"') ? true : undefined, 3000);
  let timer: NodeJS.Timeout | undefined;
  try {
    const completed = Promise.all([stopped, exited]);
    const bounded = Promise.race([completed, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${action} did not reap provisioning hub within three seconds: ${output.slice(-1500)}`)), 3000); // lint-allow-wall-clock: C1/C2 bound end-to-end real hub shutdown, including its durable boundary and OS exit.
    })]);
    if (action === 'hub stop') await askHubFrame(discovery, { type: 'hub.stop' }, 3000, env);
    else assert.equal(child.kill('SIGTERM'), true);
    const [, code] = await bounded;
    assert.equal(code, stalled ? 1 : 0, output);
    if (stalled) assert.match(output, /signal shutdown deadline expired/);
  } finally { clearTimeout(timer); }
  assert.equal(pidAlive(child.pid!), false);
  const [retained] = await readLeases(root);
  assert.equal(retained?.lease, lease.lease);
  assert.notEqual(retained?.state, 'released', 'an unanswered create remains owned for reconciliation');
  assert.equal(retained?.createFinished, undefined);
  assert.deepEqual(retained?.tags, lease.tags);
  // A provider can finish after the old process has exited. Reconciliation owns
  // that resource by its original name and tags, without touching a foreign one.
  create.resolve();
  await eventually('late fake create completed after hub exit', () => api.droplets.length ? true : undefined, 5000);
  assert.deepEqual(api.droplets[0]!.tags, lease.tags);
  const foreign = { ...api.droplets[0]!, id: 9000, tags: ['human'] };
  api.droplets.push(foreign);
  const recovery = new DropletExecutor(root, undefined, () => {}, env);
  try { await recovery.reconcile(true); }
  finally { await recovery.close(); }
  assert.deepEqual(api.droplets, [foreign]);
  assert.deepEqual(api.keys, []);
  assert.equal((await readLeases(root))[0]?.state, 'released');
  assert.ok(!api.requests.some(r => r.method === 'DELETE' && r.path === '/v2/droplets/9000'));
});

test('hub serve exits fatally after abandoning a background drain with no pending operations', async t => {
  const root = await tempProject(t);
  const tasks = join(root, '.cland/tasks');
  await mkdir(tasks, { recursive: true });
  const capture = join(tasks, 'T-1-fixture.md.12345678-1234-1234-1234-123456789abc.conflict');
  await writeFile(capture, 'fixture capture');
  const entered = join(root, 'maintenance-entered');
  const preload = join(root, 'held-maintenance.mjs');
  // Conflict retention runs outside the storage operation queue. Hold its native
  // lstat boundary so stop must abandon background work even with operations: [].
  await writeFile(preload, `
    import files from 'node:fs/promises';
    import { writeFileSync } from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const lstat = files.lstat;
    files.lstat = async function(path, ...args) {
      if (String(path) === ${JSON.stringify(capture)}) {
        writeFileSync(${JSON.stringify(entered)}, 'conflict retention lstat entered');
        setInterval(() => {}, 1000);
        return new Promise(() => {});
      }
      return lstat(path, ...args);
    };
    syncBuiltinESMExports();
  `);
  const env = fixtureEnvironment(root, process.env, {
    TMPDIR: tmpdir(), CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_TEST_FIXTURE_ROOT: root,
    CLAND_TEST_TRACKER_STOP_MS: '100', NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
  });
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  const exited = new Promise<number | null>(resolve => child.once('exit', resolve));
  onCleanup(t, async () => { if (child.exitCode === null) child.kill('SIGKILL'); await exited; });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  await eventually('hub serve startup', () => {
    assert.equal(child.exitCode, null, output);
    return output.includes('hub serving') ? true : undefined;
  }, 10_000);
  await eventually('background native I/O entered', async () => await readFile(entered, 'utf8'), 5000);
  const discovery = JSON.parse(await readFile(join(root, '.cland/hub.json'), 'utf8'));
  const status = await askHubFrame(discovery, { type: 'hub.status' }, 3000, env) as {
    tracker: { storage: { active: unknown; queued: number; abandoned: unknown[] } };
  };
  assert.equal(status.tracker.storage.active, null);
  assert.equal(status.tracker.storage.queued, 0);
  assert.deepEqual(status.tracker.storage.abandoned, []);
  const stopped = eventually('durable stopped receipt after abandonment', async () => {
    const records = (await readFile(join(root, '.cland/log/hub.log'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    return records.some(record => record.event === 'stopped') ? records : undefined;
  }, 5000);
  const [records] = await Promise.all([stopped, askHubFrame(discovery, { type: 'hub.stop' }, 3000, env)]);
  assert.deepEqual(records.find(record => record.event === 'tracker-storage-abandoned')?.operations, []);
  let timer: NodeJS.Timeout | undefined;
  try {
    assert.equal(await Promise.race([exited, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`hub serve pid ${child.pid} still alive after empty-operation abandonment`)), 2000); // lint-allow-wall-clock: bounds real process exit after its durable stopped receipt.
    })]), 1, output);
  } finally { clearTimeout(timer); }
  assert.equal(pidAlive(child.pid!), false, 'the OS has reaped the abandoned hub');
});

test('hub serve with the web edge exits within two seconds of its stopped receipt', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  const env = fixtureEnvironment(root, process.env, {
    TMPDIR: tmpdir(), CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_TEST_FIXTURE_ROOT: root,
  });
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-b', 'dev');
  git('commit', '--allow-empty', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  git('commit', '--allow-empty', '-m', 'land task', '-m', 'Item: T-2');
  await writeFile(join(root, '.cland/tasks/E-1.md'), `---
id: E-1
kind: epic
title: Demo
state: open
---

## Comments

### qa · 2026-10-20T00:00:00.000Z

verdict: qa
result: clear
by: qa [qa]
run: fixture-demo
commit: ${base}

Demo checked.
`);
  await writeFile(join(root, '.cland/tasks/T-2.md'), '---\nid: T-2\nkind: task\ntitle: Landed\nstate: closed\nstatus: done\nparent: E-1\n---\n');
  const gitPidFile = join(root, 'freshness-git.pid');
  const preload = join(root, 'slow-freshness.mjs');
  // Hold the exact native Git boundary observed in the incident, with its usual
  // 5 s execFile deadline. Shutdown must cancel it rather than abandon its pipes.
  await writeFile(preload, `
    import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const execFile = cp.execFile;
    cp.execFile = function(file, args, options, callback) {
      if (file === 'git' && args[0] === 'log' && args.includes('--raw')) {
        return execFile(process.execPath, ['-e', ${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(gitPidFile)}, String(process.pid)); setInterval(() => {}, 1000);`)}], options, callback);
      }
      return execFile(file, args, options, callback);
    };
    cp.execFile[Symbol.for('nodejs.util.promisify.custom')] = execFile[Symbol.for('nodejs.util.promisify.custom')];
    syncBuiltinESMExports();
  `);
  const launchEnv = fixtureEnvironment(root, env, { ...env, NODE_OPTIONS: `--import=${pathToFileURL(preload).href}` });
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], { cwd: root, env: launchEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  const exited = new Promise<number | null>(resolve => child.once('exit', resolve));
  onCleanup(t, async () => { if (child.exitCode === null) child.kill('SIGKILL'); await exited; });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  await eventually('hub serve startup', () => {
    assert.equal(child.exitCode, null, output);
    return output.includes('hub serving') ? true : undefined;
  }, 10_000);
  const discovery = JSON.parse(await readFile(join(root, '.cland/hub.json'), 'utf8'));
  const status = await askHubFrame(discovery, { type: 'hub.status' }, 3000, env) as { web?: { available: boolean } };
  assert.equal(status.web?.available, true, 'the real web edge is enabled');
  for (let i = 0; i < 3; i++) await askHubFrame(discovery, { type: 'task.list', projection: 'summary' }, 3000, env);
  const gitPid = await eventually('native freshness Git entered', async () => Number(await readFile(gitPidFile, 'utf8')), 5000);
  ownProcess(t, gitPid);
  const stopped = eventually('durable stopped receipt', async () =>
    (await readFile(join(root, '.cland/log/hub.log'), 'utf8')).includes('"event":"stopped"') ? true : undefined, 5000);
  await Promise.all([stopped, askHubFrame(discovery, { type: 'hub.stop' }, 3000, env)]);
  let timer: NodeJS.Timeout | undefined;
  try {
    assert.equal(await Promise.race([exited, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`hub serve pid ${child.pid} still alive two seconds after stopped`)), 2000); // lint-allow-wall-clock: C1 bounds real OS process exit after the durable stopped receipt.
    })]), 0);
  } finally { clearTimeout(timer); }
  assert.equal(pidAlive(child.pid!), false, 'the OS has reaped the served hub');
  assert.equal(pidAlive(gitPid), false, 'the owned freshness Git child is also reaped');
  assert.doesNotMatch(await readFile(join(root, '.cland/log/hub.log'), 'utf8'), /"event":"tracker-storage-abandoned"/);
});

test('a second cland hub start reports the running daemon instead of starting another', async (t) => {
  const root = await tempProject(t);
  const first = await startDaemon(t, root, {}, { sweep: true });
  const second = await startDaemon(t, root, {}, { sweep: true });
  assert.match(second.result.stdout, new RegExp(`hub already running for ${root}`));
  assert.match(second.result.stdout, new RegExp(`pid +${first.discovery.pid}\\b`));
  assert.equal(second.discovery.pid, first.discovery.pid);
  assert.equal(second.discovery.port, first.discovery.port);
});

test('hub stop identifies its acknowledged hub after lock release while the process is still alive', async t => {
  const root = await tempProject(t);
  const held = join(root, 'held-after-stop');
  const hold = join(root, 'hold-after-stop.mjs');
  await writeFile(hold, `
    import { writeFileSync } from 'node:fs';
    if (process.argv[2] === 'hub' && process.argv[3] === 'serve') process.once('beforeExit', () => {
      writeFileSync(${JSON.stringify(held)}, 'shutdown completed');
      setInterval(() => {}, 1000);
    });
  `);
  const env = fixtureEnvironment(root, process.env, { TMPDIR: tmpdir() });
  const { discovery } = await startDaemon(t, root, { ...env, NODE_OPTIONS: `--import=${pathToFileURL(hold).href}` });
  const deadline = join(root, 'stop-deadline.mjs');
  await writeFile(deadline, `
    import { existsSync } from 'node:fs';
    const now = Date.now, kill = process.kill;
    let elapsed = 0;
    Date.now = () => now() + elapsed;
    process.kill = function(pid, signal) {
      const result = kill.call(process, pid, signal);
      // Only advance the CLI exit deadline after its first PID observation and
      // the fixture's completed-shutdown receipt, without spending ten seconds.
      if (pid === ${discovery.pid} && signal === 0 && existsSync(${JSON.stringify(held)})) elapsed = 20000;
      return result;
    };
  `);
  const stopped = await clandWithEnv(root, { ...env, NODE_OPTIONS: `--import=${pathToFileURL(deadline).href}` }, 'hub', 'stop');
  assert.equal(stopped.code, 1, stopped.stdout + stopped.stderr);
  assert.match(stopped.stderr, new RegExp(`stopped, lock released, process still alive.*pid ${discovery.pid}`));
  assert.doesNotMatch(stopped.stdout + stopped.stderr, /not this project's hub/);
  assert.ok(pidAlive(discovery.pid), 'a released lock never authorizes a signal');
  await assert.rejects(stat(join(root, '.cland/hub.lock')), { code: 'ENOENT' });
  assert.match(await readFile(join(root, '.cland/log/hub.log'), 'utf8'), /"event":"stopped"/);
});

test('a stale hub.json, whose pid is gone, is replaced by a fresh hub', async (t) => {
  const root = await tempProject(t);
  const dead = spawnSync(process.execPath, ['-e', '']).pid;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify({ socket: join(root, '.cland', 'hub.sock'), port: 1, secret: 'x', pid: dead, version: '0.0.0' }));
  const { result, discovery } = await startDaemon(t, root, {}, { sweep: true });
  assert.match(result.stdout, /replacing a stale .*hub\.json \(pid \d+ is gone\)/);
  assert.match(result.stdout, /hub started for/);
  assert.notEqual(discovery.pid, dead);
  assert.ok(pidAlive(discovery.pid));
});

test('a wrong secret is refused on the WebSocket and on the Unix socket; the right one is welcomed', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);

  const status = await new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${discovery.port}`, { headers: { authorization: 'Bearer not-the-secret' } });
    ws.on('unexpected-response', (_req, res) => {
      resolve(res.statusCode ?? 0);
      ws.terminate();
    });
    ws.on('open', () => reject(new Error('a wrong secret opened a socket')));
    ws.on('error', () => {});
  });
  assert.equal(status, 401);

  const wrong = await connectSocket(discovery.socket);
  wrong.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: 'not-the-secret', client: 'test' });
  assert.deepEqual(await wrong.next(), { type: 'error', code: 'unauthorized', message: "the secret does not match this project's hub" });
  await wrong.closed;

  const right = await connectSocket(discovery.socket);
  t.after(() => right.close());
  right.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'test' });
  assert.deepEqual(await right.next(), { type: 'welcome', name: 'test', presence: [] });
  right.send({ type: 'hub.status', id: 'q1' });
  const result = (await right.next()) as { type: string; id: string; ok: boolean; value: { pid: number; port: number; sessions: unknown[] } };
  assert.equal(result.ok, true);
  assert.equal(result.value.pid, discovery.pid);
  assert.equal(result.value.port, discovery.port);
});

// A real daemon is required: this proves stop/discovery teardown against a competing autostarter.

// Hold the old CLI after its PID observation, while a new daemon owns the real startup lock.
test('a late stop continuation cannot recreate grace after an explicit successor starts', async t => {
  const root = await tempProject(t);
  const initial = await startDaemon(t, root);
  const entered = join(root, 'stop-entered');
  const release = join(root, 'stop-release');
  const completed = join(root, 'stop-released');
  const preload = join(root, 'hold-stop.mjs');
  await writeFile(preload, `
    import { existsSync, writeFileSync } from 'node:fs';
    const kill = process.kill;
    let held = false;
    process.kill = function(pid, signal) {
      try { return kill.call(process, pid, signal); }
      catch (err) {
        if (!held && pid === ${initial.discovery.pid} && signal === 0 && err.code === 'ESRCH') {
          held = true;
          writeFileSync(${JSON.stringify(entered)}, '');
          const deadline = Date.now() + 10000;
          while (!existsSync(${JSON.stringify(release)})) {
            if (Date.now() >= deadline) throw new Error('stop continuation barrier expired');
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
          }
          writeFileSync(${JSON.stringify(completed)}, '');
        }
        throw err;
      }
    };
  `);
  let stopFinished = false;
  const stopping = clandWithEnv(root, { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(preload).href}` }, 'hub', 'stop').then(result => {
    stopFinished = true;
    return result;
  });
  onCleanup(t, async () => { await writeFile(release, ''); await stopping; });
  await eventually('old stop observed the exited PID', () => stat(entered).then(() => true), 5000);
  assert.equal(pidAlive(initial.discovery.pid), false);
  const successor = await startDaemon(t, root);
  assert.match(successor.result.stdout, /hub started for/);
  assert.equal(stopFinished, false, 'the old stop is still paused after the successor serves');
  const marker = join(root, '.cland', 'run', 'hub-stop.json');
  await assert.rejects(stat(marker), { code: 'ENOENT' });
  await writeFile(release, '');
  await eventually('old stop completed its barrier', () => stat(completed).then(() => true), 5000);
  const stopped = await stopping;
  assert.equal(stopped.code, 0, stopped.stderr);
  await assert.rejects(stat(marker), { code: 'ENOENT' }, 'the old stop must leave the successor grace-free');
  await killDaemon(successor.discovery.pid);
  const recovery = await clandWithEnv(root, { CLAND_TEST_SKIP_ORPHAN_SWEEP: '1' }, 'hub', 'start', '--autostart', '--client', 'nvim');
  assert.equal(recovery.code, 0, recovery.stderr);
  assert.match(recovery.stdout, /hub started for/, 'successor crash recovery is immediate');
  await readDiscovery(root);
});

// Expiry and crash recovery concern real process/lock identity, so these launches stay out of process.
test('autostart recovers after grace expires and after a crash, recording only starter provenance', async t => {
  const root = await tempProject(t);
  const initial = await startDaemon(t, root);
  const marker = join(root, '.cland', 'run', 'hub-stop.json');
  await killDaemon(initial.discovery.pid);
  await assert.rejects(stat(marker), { code: 'ENOENT' }, 'a crash creates no stop marker');
  const env = { CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_STARTUP_SENTINEL: 'must-not-be-journalled' };
  const recovered = await clandWithEnv(root, env, 'hub', 'start', '--autostart', '--client', 'other');
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.match(recovered.stdout, /hub started for/);
  const replacement = await readDiscovery(root);
  assert.notEqual(replacement.pid, initial.discovery.pid);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const grace = JSON.parse(await readFile(marker, 'utf8')) as { expiresAt: number };
  assert.ok(grace.expiresAt > Date.now(), 'stop leaves a live grace marker');
  // Model elapsed wall time at the on-disk boundary without spending ten seconds asleep.
  await writeFile(marker, JSON.stringify({ expiresAt: Date.now() - 1 }));
  const sub = join(root, 'src');
  await mkdir(sub);
  // clandWithEnv provisions a fixture at its cwd for start; invoke the CLI directly to keep this a subdirectory.
  const automatic = await promisify(execFile)(process.execPath, [CLI_ENTRY, 'hub', 'start', '--autostart', '--client', 'nvim'], {
    cwd: sub, env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_'))), ...env }, timeout: 30_000,
  });
  assert.match(automatic.stdout, /hub started for/);
  await readDiscovery(root); // register the detached replacement for fixture teardown
  const journal = await cland(root, 'hub', 'journal', '--kind', 'hub-started', '--json');
  const starts = journal.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(starts.length, 3);
  assert.deepEqual(starts[1].starter, { client: 'other', parentPid: process.pid, cwd: root });
  assert.deepEqual(starts[2].starter, { client: 'nvim', parentPid: process.pid, cwd: sub });
  assert.doesNotMatch(journal.stdout, /CLAND_STARTUP_SENTINEL|must-not-be-journalled/);
});

test('a project path too long for a Unix socket puts the socket under the temp dir', async (t) => {
  const base = await tempProject(t);
  const root = join(base, 'a-rather-long-directory-name-'.repeat(3));
  await mkdir(root, { recursive: true });
  const { discovery } = await startDaemon(t, root, {}, { sweep: true });
  assert.ok(discovery.socket.startsWith(tmpdir()), discovery.socket);
  assert.ok(Buffer.byteLength(discovery.socket) <= 100);
  assert.match((await cland(root, 'hub', 'status')).stdout, /^hub running for/);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await assert.rejects(stat(discovery.socket), { code: 'ENOENT' });
});

test('git sees only what is meant to be committed under .cland/ while a hub runs', async (t) => {
  const root = await tempProject(t);
  const git = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(git('init', '-q').status, 0);
  await projectHub(t, root);
  await mkdir(join(root, '.cland', 'tasks'), { recursive: true });
  await writeFile(join(root, '.cland', 'tasks', 'T-1.md'), '# a task\n');
  await writeFile(join(root, '.cland', 'roles.toml'), '');
  await writeFile(join(root, '.cland', 'config.toml'), '');
  for (const volatile of ['journal.jsonl', 'artifacts/a.txt', 'worktrees/w/x', 'territory.git/HEAD', 'run/cx-1.sock', 'qa/runs.jsonl', 'qa/T-1/r1/SHELL-001.screen.txt']) {
    await mkdir(join(root, '.cland', volatile, '..'), { recursive: true });
    await writeFile(join(root, '.cland', volatile), 'x');
  }
  const listed = git('status', '--porcelain', '--untracked-files=all', '.cland').stdout.trim().split('\n').map((l) => l.slice(3)).sort();
  assert.deepEqual(listed, ['.cland/.gitignore', '.cland/RULES.md', '.cland/config.toml', '.cland/crew.toml', '.cland/roles.toml', '.cland/tasks/T-1.md']);
});

test('both edges speak one protocol: a spoke hello over the Unix socket; a client hello over the WebSocket is refused (the human side is the socket)', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);

  await assignRole(root, 'sock', 'implementer');
  const spoke = await connectSocket(discovery.socket);
  t.after(() => spoke.close());
  spoke.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, sessionId: 'sess-sock', cwd: root, name: 'sock' });
  assert.equal((await spoke.next()).name, 'sock');
  // the role's clause comes first, as a hub event the spoke acks
  const clause = await spoke.next();
  assert.equal(clause.type, 'role');
  spoke.send({ type: 'ack', id: clause.id });
  spoke.send({ type: 'who', id: 'w1' });
  const who = (await spoke.next()) as { value: { me: string; sessions: Array<{ name: string }> } };
  assert.equal(who.value.me, 'sock');
  assert.deepEqual(who.value.sessions.map((s) => s.name), ['sock']);

  const noSecret = await connectSocket(discovery.socket);
  noSecret.send({ type: 'hello', protocol: PROTOCOL_VERSION, sessionId: 'sess-x', cwd: root, name: 'intruder' });
  assert.equal((await noSecret.next()).code, 'unauthorized');
  await noSecret.closed;

  // the bearer secret every spoke holds makes no human: a client hello on the WebSocket is refused
  const frames = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${discovery.port}`, { headers: { authorization: `Bearer ${discovery.secret}` } });
    const got: Array<Record<string, unknown>> = [];
    ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'ws-test' })));
    ws.on('message', (data) => got.push(JSON.parse(data.toString()) as Record<string, unknown>));
    ws.on('close', () => resolve(got));
    ws.on('error', reject);
  });
  assert.deepEqual(frames.map((f) => [f.type, f.code]), [['error', 'unauthorized']]);
  // the same status over the Unix socket, the client's edge
  const client = await connectSocket(discovery.socket);
  t.after(() => client.close());
  client.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'sock-test' });
  assert.equal((await client.next()).type, 'welcome');
  client.send({ type: 'hub.status', id: 's1' });
  const status = (await client.next()) as { ok: boolean; value: { pid: number; sessions: Array<{ name: string }> } };
  assert.equal(status.ok, true);
  assert.equal(status.value.pid, discovery.pid);
  assert.deepEqual(status.value.sessions.map((s) => s.name), ['sock']);
});

test('two cland hub start at the same instant leave exactly one hub, and both report it', async (t) => {
  const root = await tempProject(t);
  const results = await Promise.all([cland(root, 'hub', 'start'), cland(root, 'hub', 'start')]);
  // every hub either start left behind is killed when the test ends
  for (const r of results) {
    const pid = Number(/pid +(\d+)/.exec(r.stdout)?.[1]);
    if (pid) t.after(() => killDaemon(pid));
  }
  const discovery = await readDiscovery(root);
  t.after(() => killDaemon(discovery.pid));
  for (const r of results) assert.equal(r.code, 0, `${r.stdout}\n${r.stderr}`);
  const pids = results.map((r) => Number(/pid +(\d+)/.exec(r.stdout)?.[1]));
  assert.deepEqual(pids, [discovery.pid, discovery.pid], results.map((r) => r.stdout).join('\n'));
  assert.ok(pidAlive(discovery.pid));
  // the hub.json hub answers on its socket, and only one hub ever got as far as serving
  const status = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout) as { pid: number };
  assert.equal(status.pid, discovery.pid);
  const log = await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
  assert.equal(log.split('\n').filter((l) => l.includes('"event":"serving"')).length, 1, log);
  // the lock names the hub that runs
  assert.equal((JSON.parse(await readFile(join(root, '.cland', 'hub.lock'), 'utf8')) as { pid: number }).pid, discovery.pid);
});

test('cland hub stop never signals a process that is not the project\'s hub: it only removes the hub.json naming it', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  // a live process that is no hub at all — a reused pid, as far as hub.json can tell
  const stranger = spawn('sleep', ['30'], { stdio: 'ignore' });
  ownProcess(t, stranger.pid);
  t.after(() => stranger.kill('SIGKILL'));
  const pid = stranger.pid as number;
  await mkdir(join(root, '.cland'), { recursive: true });
  const bogus = { socket: join(root, '.cland', 'hub.sock'), port: 1, secret: 'x'.repeat(64), pid, version: '0.1.0' };
  for (const lock of [null, { pid, started: 'Thu Jan  1 00:00:00 1970' }]) {
    await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify(bogus));
    if (lock) await writeFile(join(root, '.cland', 'hub.lock'), JSON.stringify(lock));
    const stopped = await cland(root, 'hub', 'stop');
    assert.equal(stopped.code, 0, stopped.stderr);
    assert.match(stopped.stdout, new RegExp(`pid ${pid} .*is not this project's hub`));
    await sleep(100);
    assert.ok(pidAlive(pid), 'the stranger was left alone');
    await assert.rejects(stat(join(root, '.cland', 'hub.json')), { code: 'ENOENT' });
  }
  // and `start` treats such a hub.json as stale instead of refusing
  await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify(bogus));
  const { result } = await startDaemon(t, root, {}, { sweep: true });
  assert.match(result.stdout, /hub started for/);
  assert.ok(pidAlive(pid));
});

test('a stopping hub leaves alone a socket that is no longer the one it bound, and hub.json goes only at the end', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root, {}, { sweep: true });
  // someone else's socket now stands at the path (the old hub's file was replaced under it)
  await rm(discovery.socket);
  const other = createServer((c) => c.destroy());
  await new Promise<void>((resolve) => other.listen(discovery.socket, () => resolve()));
  t.after(() => other.close());
  const otherIno = (await stat(discovery.socket)).ino;

  const stopped = await cland(root, 'hub', 'stop');
  assert.equal(stopped.code, 0, stopped.stderr);
  assert.match(stopped.stdout, new RegExp(`hub stopped for ${root} \\(pid ${discovery.pid}\\)`));
  assert.equal(pidAlive(discovery.pid), false);
  assert.equal((await stat(discovery.socket)).ino, otherIno, "the other socket's file is still there");
  await assert.rejects(stat(join(root, '.cland', 'hub.json')), { code: 'ENOENT' });
  const log = await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
  const events = log.split('\n').filter((l) => l.startsWith('{')).map((l) => (JSON.parse(l) as { event: string }).event);
  // Stop closes the socket before awaiting the startup sweep, so its logs may interleave.
  const shutdownEvents = events.slice(events.lastIndexOf('stopping')).filter((event) => !event.startsWith('orphan-sweep-'));
  assert.deepEqual(shutdownEvents, ['stopping', 'socket-kept', 'stopped']);
  assert.equal(events.at(-1), 'stopped', 'shutdown finishes the log');
});

test('a stale hub.lock — its hub was killed, or its pid now belongs to another process — does not stop a start', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  const lockFile = join(root, '.cland', 'hub.lock');
  const first = await startDaemon(t, root, {}, { sweep: true });
  await killDaemon(first.discovery.pid);
  assert.equal((JSON.parse(await readFile(lockFile, 'utf8')) as { pid: number }).pid, first.discovery.pid, 'a killed hub leaves its lock');
  const second = await startDaemon(t, root, {}, { sweep: true });
  assert.notEqual(second.discovery.pid, first.discovery.pid);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await assert.rejects(stat(lockFile), { code: 'ENOENT' }, 'a stopped hub releases its lock');

  // a live pid that is not the process which took the lock: the start time tells them apart
  await writeFile(lockFile, JSON.stringify({ pid: process.pid, started: 'Thu Jan  1 00:00:00 1970' }));
  const third = await startDaemon(t, root, {}, { sweep: true });
  assert.match(third.result.stdout, /hub started for/);
  assert.equal((JSON.parse(await readFile(lockFile, 'utf8')) as { pid: number }).pid, third.discovery.pid);
});
