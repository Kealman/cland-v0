// T3: daemon lifecycle regressions: competing startup locks, signals, crash recovery and endpoint identity.
// The curated start/discovery/stop/restart/sweep flow lives in scenarios/hub-lifecycle.test.ts.
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup, ownProcess } from './process-cleanup.ts';
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

test('a second cland hub start reports the running daemon instead of starting another', async (t) => {
  const root = await tempProject(t);
  const first = await startDaemon(t, root, {}, { sweep: true });
  const second = await startDaemon(t, root, {}, { sweep: true });
  assert.match(second.result.stdout, new RegExp(`hub already running for ${root}`));
  assert.match(second.result.stdout, new RegExp(`pid +${first.discovery.pid}\\b`));
  assert.equal(second.discovery.pid, first.discovery.pid);
  assert.equal(second.discovery.port, first.discovery.port);
});

test('a stale hub.json, whose pid is gone, is replaced by a fresh hub', async (t) => {
  const root = await tempProject(t);
  const dead = spawnSync(process.execPath, ['-e', ''], { env: fixtureEnvironment(root, process.env) }).pid;
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
    cwd: sub, env: fixtureEnvironment(sub, process.env, { ...env }), timeout: 30_000,
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
  const git = (...args: string[]) => spawnSync('git', args, { env: fixtureEnvironment(root, process.env), cwd: root, encoding: 'utf8' });
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
  const stranger = spawn('sleep', ['30'], { env: fixtureEnvironment(root, process.env), stdio: 'ignore' });
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
