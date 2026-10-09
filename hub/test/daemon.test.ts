import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { assignRole, cland, connectSocket, killDaemon, pidAlive, readDiscovery, sleep, spawnSpoke, startDaemon, tempProject, NO_PS } from './harness.ts';

test('cland hub start creates the .cland skeleton and the discovery file', async (t) => {
  const root = await tempProject(t);
  const { result, discovery } = await startDaemon(t, root);
  assert.match(result.stdout, new RegExp(`hub started for ${root}`));

  assert.deepEqual(Object.keys(discovery).sort(), ['pid', 'port', 'root', 'secret', 'socket', 'version']);
  assert.equal(discovery.root, root);
  assert.equal(typeof discovery.port, 'number');
  assert.match(discovery.secret, /^[0-9a-f]{64}$/);
  assert.equal(discovery.socket, join(root, '.cland', 'hub.sock'));
  assert.equal((await stat(discovery.socket)).isSocket(), true);

  const secretFile = join(root, '.cland', 'secret');
  assert.equal((await readFile(secretFile, 'utf8')).trim(), discovery.secret);
  assert.equal((await stat(secretFile)).mode & 0o777, 0o600);
  assert.equal((await stat(join(root, '.cland', 'hub.json'))).mode & 0o777, 0o600);
  assert.equal((await stat(join(root, '.cland', 'hub.db'))).isFile(), true);

  const gitignore = await readFile(join(root, '.cland', '.gitignore'), 'utf8');
  assert.match(gitignore.split('\n')[0] ?? '', /^# managed by cland/);
  const patterns = gitignore.split('\n').filter((l) => l && !l.startsWith('#'));
  for (const p of ['hub.db*', 'hub.json', 'hub.sock', 'secret', 'journal.jsonl', 'log/', 'artifacts/', 'worktrees/', 'territory.git/', 'scratch/']) assert.ok(patterns.includes(p), `ignores ${p}`);
  for (const kept of ['tasks', 'roles.toml', 'config.toml', '.gitignore']) assert.ok(!patterns.some((p) => p.startsWith(kept)), `does not ignore ${kept}`);
  assert.ok(pidAlive(discovery.pid), 'the daemon outlives the `cland hub start` that spawned it');
});

test('a second cland hub start reports the running daemon instead of starting another', async (t) => {
  const root = await tempProject(t);
  const first = await startDaemon(t, root);
  const second = await startDaemon(t, root);
  assert.match(second.result.stdout, new RegExp(`hub already running for ${root}`));
  assert.match(second.result.stdout, new RegExp(`pid +${first.discovery.pid}\\b`));
  assert.equal(second.discovery.pid, first.discovery.pid);
  assert.equal(second.discovery.port, first.discovery.port);
});

test('a stale hub.json, whose pid is gone, is replaced by a fresh hub', async (t) => {
  const root = await tempProject(t);
  const dead = spawnSync(process.execPath, ['-e', '']).pid;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify({ socket: join(root, '.cland', 'hub.sock'), port: 1, secret: 'x', pid: dead, version: '0.0.0' }));
  const { result, discovery } = await startDaemon(t, root);
  assert.match(result.stdout, /replacing a stale .*hub\.json \(pid \d+ is gone\)/);
  assert.match(result.stdout, /hub started for/);
  assert.notEqual(discovery.pid, dead);
  assert.ok(pidAlive(discovery.pid));
});

test('a spoke started in the project with no hub environment connects through the discovery file; status shows it from another process', async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  // a session started deeper in the tree walks up to the project's .cland/
  const sub = join(root, 'src', 'deep');
  await mkdir(sub, { recursive: true });
  const spoke = await spawnSpoke({ discover: true, cwd: sub, name: 'alpha', role: 'implementer' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['alpha']);
  assert.match(spoke.log(), /found the hub through .*\.cland\/hub\.json/);

  const json = await cland(root, 'hub', 'status', '--json');
  assert.equal(json.code, 0, json.stderr);
  const status = JSON.parse(json.stdout) as { pid: number; sessions: Array<{ name: string; role: string | null; cwd: string }> };
  assert.deepEqual(status.sessions.map((p) => [p.name, p.role, p.cwd]), [['alpha', 'implementer', sub]]);

  const human = await cland(sub, 'hub', 'status');
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, new RegExp(`^hub running for ${root}\\n`));
  assert.match(human.stdout, new RegExp(`pid +${status.pid}\\n`));
  assert.match(human.stdout, /uptime +\d+s/);
  // the name shows with its role, as everywhere (spec 4.4)
  assert.match(human.stdout, /sessions: 1\n {2}alpha \[Implementer\] {2}\[unknown\]\n/);
  assert.match(human.stdout, /\nno coordinator\n/);
});

test('a wrong secret is refused on the WebSocket and on the Unix socket; the right one is welcomed', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);

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

test('cland hub stop ends the daemon and removes hub.json and the socket', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const stopped = await cland(root, 'hub', 'stop');
  assert.equal(stopped.code, 0, stopped.stderr);
  assert.match(stopped.stdout, new RegExp(`hub stopped for ${root} \\(pid ${discovery.pid}\\)`));
  assert.equal(pidAlive(discovery.pid), false);
  await assert.rejects(stat(join(root, '.cland', 'hub.json')), { code: 'ENOENT' });
  await assert.rejects(stat(discovery.socket), { code: 'ENOENT' });
  // what is meant to stay, stays
  assert.equal((await readFile(join(root, '.cland', 'secret'), 'utf8')).trim(), discovery.secret);
  assert.equal((await stat(join(root, '.cland', 'hub.db'))).isFile(), true);

  const status = await cland(root, 'hub', 'status');
  assert.equal(status.code, 1);
  assert.equal(status.stdout, `no hub running for ${root}\n`);
  const again = await cland(root, 'hub', 'stop');
  assert.equal(again.code, 0);
  assert.equal(again.stdout, `no hub running for ${root}\n`);
});

test('a spoke follows its hub through a restart: the discovery file is read again on reconnect', async (t) => {
  const root = await tempProject(t);
  const first = await startDaemon(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'alpha' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['alpha']);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const second = await startDaemon(t, root);
  assert.notEqual(second.discovery.pid, first.discovery.pid);
  assert.equal(second.discovery.secret, first.discovery.secret, 'the secret is kept across restarts');
  await spoke.waitForPresence(['alpha']);
  const status = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout) as { sessions: Array<{ name: string }> };
  assert.deepEqual(status.sessions.map((p) => p.name), ['alpha']);
});

test('a project path too long for a Unix socket puts the socket under the temp dir', async (t) => {
  const base = await tempProject(t);
  const root = join(base, 'a-rather-long-directory-name-'.repeat(3));
  await mkdir(root, { recursive: true });
  const { discovery } = await startDaemon(t, root);
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
  await startDaemon(t, root);
  await mkdir(join(root, '.cland', 'tasks'), { recursive: true });
  await writeFile(join(root, '.cland', 'tasks', 'T-1.md'), '# a task\n');
  await writeFile(join(root, '.cland', 'roles.toml'), '');
  await writeFile(join(root, '.cland', 'config.toml'), '');
  for (const volatile of ['journal.jsonl', 'artifacts/a.txt', 'worktrees/w/x', 'territory.git/HEAD', 'run/cx-1.sock']) {
    await mkdir(join(root, '.cland', volatile, '..'), { recursive: true });
    await writeFile(join(root, '.cland', volatile), 'x');
  }
  const listed = git('status', '--porcelain', '--untracked-files=all', '.cland').stdout.trim().split('\n').map((l) => l.slice(3)).sort();
  assert.deepEqual(listed, ['.cland/.gitignore', '.cland/config.toml', '.cland/roles.toml', '.cland/tasks/T-1.md']);
});

test('both edges speak one protocol: a spoke hello over the Unix socket; a client hello over the WebSocket is refused (the human side is the socket)', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);

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
  const { result } = await startDaemon(t, root);
  assert.match(result.stdout, /hub started for/);
  assert.ok(pidAlive(pid));
});

test('a stopping hub leaves alone a socket that is no longer the one it bound, and hub.json goes only at the end', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
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
  assert.deepEqual(events.slice(-3), ['stopping', 'socket-kept', 'stopped']);
});

test('a stale hub.lock — its hub was killed, or its pid now belongs to another process — does not stop a start', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  const lockFile = join(root, '.cland', 'hub.lock');
  const first = await startDaemon(t, root);
  await killDaemon(first.discovery.pid);
  assert.equal((JSON.parse(await readFile(lockFile, 'utf8')) as { pid: number }).pid, first.discovery.pid, 'a killed hub leaves its lock');
  const second = await startDaemon(t, root);
  assert.notEqual(second.discovery.pid, first.discovery.pid);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await assert.rejects(stat(lockFile), { code: 'ENOENT' }, 'a stopped hub releases its lock');

  // a live pid that is not the process which took the lock: the start time tells them apart
  await writeFile(lockFile, JSON.stringify({ pid: process.pid, started: 'Thu Jan  1 00:00:00 1970' }));
  const third = await startDaemon(t, root);
  assert.match(third.result.stdout, /hub started for/);
  assert.equal((JSON.parse(await readFile(lockFile, 'utf8')) as { pid: number }).pid, third.discovery.pid);
});
