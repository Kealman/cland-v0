// T2: admission's real socket boundary with a complete fake clock; no hub process
// or elapsed-time wait is needed to delay the suite.slot answer beyond 3000 ms.
import './cover-quiet.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertTestAdmission } from '../src/test-admission.ts';
import { FakeClock } from './fake-clock.ts';
import { AdmissionTimeout } from '../src/test-admission-outcome.ts';

async function delayedHub(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-admission-'));
  const socketPath = join(root, 'hub.sock');
  const sockets = new Set<Socket>();
  let received!: (reply: (ok?: boolean, error?: string) => void) => void;
  const request = new Promise<(ok?: boolean, error?: string) => void>(resolve => { received = resolve; });
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const frame = JSON.parse(buffer.slice(0, nl)); buffer = buffer.slice(nl + 1);
        if (frame.type === 'hello') socket.write(JSON.stringify({ type: 'welcome', protocol: 2 }) + '\n');
        else if (frame.type === 'suite.slot') received((ok = true, error) => socket.write(JSON.stringify({ type: 'result', id: frame.id, ok, error }) + '\n'));
      }
    });
  });
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
  await mkdir(join(root, '.cland'));
  const discovery = join(root, '.cland', 'hub.json');
  await writeFile(discovery, JSON.stringify({ socket: socketPath, secret: 'fixture', port: 1, pid: process.pid, version: 'fixture' }));
  return { root, request, env: { CLAND_HUB_FILE: discovery } };
}

test('admission accepts a suite.slot answer delayed beyond 3000 ms', async t => {
  const hub = await delayedHub(t);
  const clock = new FakeClock();
  const outcome = assertTestAdmission(hub.root, hub.env, { clock, load: 0, parallelism: 1 }).then(() => 'admitted', error => error);
  const reply = await hub.request;
  await clock.advance(3001);
  reply();
  assert.equal(await outcome, 'admitted');
  assert.equal(clock.pending, 0, 'admission releases its deadline');
});

test('silent admission ends as a typed infrastructure timeout with a load-scaled bound', async t => {
  for (const [load, deadline] of [[0, 15000], [2, 30000], [100, 60000]] as const) {
    const hub = await delayedHub(t);
    const clock = new FakeClock();
    let settled = false;
    const outcome = assertTestAdmission(hub.root, hub.env, { clock, load, parallelism: 1 }).then(() => undefined, error => error).finally(() => { settled = true; });
    await hub.request;
    await clock.advance(deadline - 1);
    assert.equal(settled, false, 'admission keeps waiting until its own deadline');
    await clock.advance(1);
    const error = await outcome;
    assert.ok(error instanceof AdmissionTimeout);
    assert.equal(error.code, 'CLAND_ADMISSION_TIMEOUT');
    assert.match(error.message, /^admission timed out after \d+ s: project hub busy; not a test result$/);
    assert.equal(error.timeoutMs, deadline);
    assert.equal(clock.pending, 0);
  }
});
