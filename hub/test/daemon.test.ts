import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { cland, connectSocket, pidAlive, readDiscovery, spawnSpoke, startDaemon, tempProject } from './harness.ts';

test('cland hub start creates the .cland skeleton and the discovery file', async (t) => {
  const root = await tempProject(t);
  const { result, discovery } = await startDaemon(t, root);
  assert.match(result.stdout, new RegExp(`hub started for ${root}`));

  assert.deepEqual(Object.keys(discovery).sort(), ['pid', 'port', 'secret', 'socket', 'version']);
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
  for (const p of ['hub.db*', 'hub.json', 'hub.sock', 'secret', 'journal.jsonl', 'log/', 'artifacts/', 'worktrees/', 'territory.git/']) assert.ok(patterns.includes(p), `ignores ${p}`);
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
  assert.match(human.stdout, /sessions: 1\n {2}alpha {2}\(implementer\)/);
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
  for (const volatile of ['journal.jsonl', 'artifacts/a.txt', 'worktrees/w/x', 'territory.git/HEAD']) {
    await mkdir(join(root, '.cland', volatile, '..'), { recursive: true });
    await writeFile(join(root, '.cland', volatile), 'x');
  }
  const listed = git('status', '--porcelain', '--untracked-files=all', '.cland').stdout.trim().split('\n').map((l) => l.slice(3)).sort();
  assert.deepEqual(listed, ['.cland/.gitignore', '.cland/config.toml', '.cland/roles.toml', '.cland/tasks/T-1.md']);
});

test('both edges speak one protocol: a spoke hello over the Unix socket, a client status over the WebSocket', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);

  const spoke = await connectSocket(discovery.socket);
  t.after(() => spoke.close());
  spoke.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, sessionId: 'sess-sock', cwd: root, name: 'sock' });
  assert.equal((await spoke.next()).name, 'sock');
  spoke.send({ type: 'who', id: 'w1' });
  const who = (await spoke.next()) as { value: { me: string; sessions: Array<{ name: string }> } };
  assert.equal(who.value.me, 'sock');
  assert.deepEqual(who.value.sessions.map((s) => s.name), ['sock']);

  const noSecret = await connectSocket(discovery.socket);
  noSecret.send({ type: 'hello', protocol: PROTOCOL_VERSION, sessionId: 'sess-x', cwd: root, name: 'intruder' });
  assert.equal((await noSecret.next()).code, 'unauthorized');
  await noSecret.closed;

  const frames = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${discovery.port}`, { headers: { authorization: `Bearer ${discovery.secret}` } });
    const got: Array<Record<string, unknown>> = [];
    ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'ws-test' })));
    ws.on('message', (data) => {
      got.push(JSON.parse(data.toString()) as Record<string, unknown>);
      if (got.length === 1) ws.send(JSON.stringify({ type: 'hub.status', id: 's1' }));
      else {
        ws.close();
        resolve(got);
      }
    });
    ws.on('error', reject);
  });
  assert.equal(frames[0]?.type, 'welcome');
  const status = frames[1] as { ok: boolean; value: { pid: number; sessions: Array<{ name: string }> } };
  assert.equal(status.ok, true);
  assert.equal(status.value.pid, discovery.pid);
  assert.deepEqual(status.value.sessions.map((s) => s.name), ['sock']);
});
