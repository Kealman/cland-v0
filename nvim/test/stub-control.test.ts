// T2 component: an in-process control peer closes or refuses the real socket exchange.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { join } from 'node:path';
import { tempProject, beforeDirectories } from './fixture.ts';
import { stubControl } from './stub-control.ts';

async function peer(t: TestContext, answer: (socket: Socket) => void): Promise<string> {
  const root = await tempProject(t);
  const path = join(root, 'control.sock');
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.once('data', () => answer(socket));
  });
  beforeDirectories(t, async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path, resolve); });
  return path;
}

test('a peer close rejects the outstanding operation with the emitted request named', async t => {
  const path = await peer(t, socket => socket.end());
  await assert.rejects(stubControl(path, { emit: { type: 'inbox' } }), /stub control emit inbox:.*closed before/);
});

test('a refused replay rejects the control operation with the recorder diagnostic', async t => {
  const path = await peer(t, socket => socket.end('{"ok":false,"error":"unrecorded protocol frame operation=frame request=inbox"}\n'));
  await assert.rejects(stubControl(path, { emit: { type: 'inbox' } }), /stub control emit inbox:.*unrecorded protocol frame.*request=inbox/);
});

test('a complete control reply is decoded before the peer closes', async t => {
  const path = await peer(t, socket => {
    socket.write('{"ok":true,');
    queueMicrotask(() => socket.end('"requests":[{"type":"inbox.list"}]}\n'));
  });
  assert.deepEqual(await stubControl(path, { requests: true }), { ok: true, requests: [{ type: 'inbox.list' }] });
});
