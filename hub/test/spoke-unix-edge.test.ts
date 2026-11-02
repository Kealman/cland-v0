// T2: scratch projectHub and native Unix WebSocket edge; fake harnesses, no SSH or cloud.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, rename, writeFile, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { layout } from '../src/project.ts';
import { beforeDirectories, onCleanup } from './process-cleanup.ts';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { connectUi, projectHub, tempProject } from './harness.ts';

async function hello(t: TestContext, url: string, secret: string) {
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${secret}` }, handshakeTimeout: 3000 });
  onCleanup(t, async () => { if (ws.readyState === WebSocket.CLOSED) return; const closed = once(ws, 'close'); ws.terminate(); await closed; });
  await once(ws, 'open');
  const reply = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'hello', protocol: 2, name: 'unix-spoke', sessionId: 'unix-spoke', cwd: '/fixture' }));
  return JSON.parse(String((await reply)[0])) as { type: string; name?: string };
}

for (const parent of ['/tmp', undefined]) test(`C1: started hub welcomes spokes over its private Unix WebSocket (${parent ? 'short root' : 'system temp root'})`, { timeout: 15000 }, async t => {
  const root = await tempProject(t, parent ? 'cland-unix-' : 'cland-unix-' + 'long'.repeat(30), parent);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'unix-spoke', role: 'implementer' })).ok, true);
  const path = layout(root).spokeSocket;
  assert.equal((await lstat(path)).mode & 0o777, 0o600);
  assert.equal((await lstat(path)).isSocket(), true);
  assert.equal((await hello(t, `ws+unix:${path}:/`, discovery.secret)).type, 'welcome');
});

for (const authorization of [undefined, 'Bearer wrong-secret']) test(`C2: Unix upgrade refuses ${authorization ? 'wrong' : 'missing'} bearer like loopback`, { timeout: 15000 }, async t => {
  const root = await tempProject(t);
  const logs: Array<Record<string, unknown>> = [];
  const { discovery } = await projectHub(t, root, {}, { log: event => logs.push(event) });
  for (const url of [`ws+unix:${layout(root).spokeSocket}:/`, `ws://127.0.0.1:${discovery.port}`]) {
    const ws = new WebSocket(url, { headers: authorization ? { Authorization: authorization } : {}, handshakeTimeout: 3000 });
    onCleanup(t, async () => { if (ws.readyState === WebSocket.CLOSED) return; const closed = once(ws, 'close'); ws.terminate(); await closed; });
    // Observe both failure and native close before attempting the upgrade.
    const closed = new Promise<void>(resolve => ws.once('close', () => resolve()));
    const failed = once(ws, 'error');
    const [error] = await failed;
    await closed;
    assert.match(String(error), /401/);
  }
  assert.equal(logs.filter(e => e.event === 'refused' && e.code === 'unauthorized').length, 2);
});

test('C3: replaces a stale socket and removes its own endpoint on stop', { timeout: 15000 }, async t => {
  const root = await tempProject(t);
  const path = layout(root).spokeSocket;
  await mkdir(dirname(path), { recursive: true });
  const stale = createServer();
  onCleanup(t, async () => { if (stale.listening) await new Promise<void>(resolve => stale.close(() => resolve())); });
  stale.listen(path);
  await once(stale, 'listening');
  const old = await lstat(path);
  onCleanup(t, () => rm(`${path}.stale`, { force: true }));
  await rename(path, `${path}.stale`);
  await new Promise<void>(resolve => stale.close(() => resolve()));
  await rename(`${path}.stale`, path);
  const hub = await projectHub(t, root);
  assert.notEqual((await lstat(path)).ino, old.ino);
  await hub.stop();
  await assert.rejects(lstat(path), { code: 'ENOENT' });
});

test('C3: stopping an old hub preserves a replacement endpoint', { timeout: 15000 }, async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const path = layout(root).spokeSocket;
  beforeDirectories(t, () => rm(`${path}.old`, { force: true }));
  beforeDirectories(t, () => rm(path, { force: true }));
  await rename(path, `${path}.old`);
  // Keep the bound inode alive under another name so inode reuse cannot mask a failure.
  await writeFile(path, 'replacement-owner');
  await hub.stop();
  assert.equal(await readFile(path, 'utf8'), 'replacement-owner');
});

test('C4: both spoke edges refuse a client hello after authenticated upgrade', { timeout: 15000 }, async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  for (const url of [`ws+unix:${layout(root).spokeSocket}:/`, `ws://127.0.0.1:${discovery.port}`]) {
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${discovery.secret}` }, handshakeTimeout: 3000 });
    onCleanup(t, async () => { if (ws.readyState === WebSocket.CLOSED) return; const closed = once(ws, 'close'); ws.terminate(); await closed; });
    await once(ws, 'open');
    const reply = once(ws, 'message');
    const closed = once(ws, 'close');
    ws.send(JSON.stringify({ type: 'hello', protocol: 2, client: 'cli' }));
    const frame = JSON.parse(String((await reply)[0]));
    assert.equal(frame.type, 'error');
    assert.equal(frame.code, 'unauthorized');
    await closed;
  }
});

test('C1: long and UTF-8 roots select a stable short endpoint distinct from the human socket', () => {
  for (const root of ['/short', '/project/' + 'deep/'.repeat(40), '/project/' + 'é'.repeat(100)]) {
    const path = layout(root).spokeSocket;
    assert.ok(Buffer.byteLength(path) <= 100, path);
    assert.equal(layout(root).spokeSocket, path);
    assert.notEqual(path, layout(root).socket);
    assert.notEqual(path, layout(`${root}/other`).spokeSocket);
  }
  assert.equal(layout('/short').spokeSocket, '/short/.cland/run/spoke.sock');
});


for (const character of ['space here', 'é', ':', '#']) test(`C1: URL-safe fallback welcomes a spoke with ${character} in root and TMPDIR`, { timeout: 15000 }, async t => {
  const root = await tempProject(t, `cland-${character}-`, '/tmp');
  const original = process.env.TMPDIR;
  const temporary = join(root, 'temporary ' + character);
  await mkdir(temporary);
  process.env.TMPDIR = temporary;
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  try {
    hub = await projectHub(t, root);
    const ui = await connectUi(t, hub.discovery);
    assert.equal((await ui.request({ type: 'role.set', session: 'unix-spoke', role: 'implementer' })).ok, true);
    const path = layout(root).spokeSocket;
    assert.equal((await lstat(path)).mode & 0o777, 0o600);
    assert.equal((await hello(t, `ws+unix:${path}:/`, hub.discovery.secret)).type, 'welcome');
    assert.equal(layout(root).socket, join(root, '.cland/hub.sock'), 'human socket path stays compatible');
    assert.equal(dirname(path), '/tmp', 'unsafe root and TMPDIR fall back to the fixed short directory');
  } finally {
    await hub?.stop();
    if (original === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = original;
  }
});
