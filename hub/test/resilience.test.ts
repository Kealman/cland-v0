import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { spawn } from 'node:child_process';
import { DOCUMENTED_TOOLS, SPOKE_ENTRY, startHub, spawnSpoke, TEST_SECRET } from './harness.ts';
import { createHub } from '../src/hub/server.ts';
import { PROTOCOL_VERSION } from '../src/protocol.ts';

const until = async <T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 5000): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  let last: T = await fn();
  while (!ok(last) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    last = await fn();
  }
  return last;
};

/** Open a raw socket, send one frame, and collect what comes back until the hub closes it. */
const rawExchange = async (url: string, frame: unknown): Promise<{ code: number; frames: Array<Record<string, unknown>> }> => {
  const ws = new WebSocket(url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
  const frames: Array<Record<string, unknown>> = [];
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  ws.on('message', (d) => frames.push(JSON.parse(d.toString()) as Record<string, unknown>));
  await new Promise<void>((resolve) => ws.on('open', () => resolve()));
  ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame));
  return { code: await closed, frames };
};

test('a spoke with the wrong secret keeps running and its tools say the secret was refused', async () => {
  const hub = await startHub({ secret: 'right' });
  const spoke = await spawnSpoke({ hub, secret: 'wrong', name: 'alpha' });
  try {
    const result = await until(
      () => spoke.call<{ ok: boolean; error?: string }>('send', { to: ['beta'], text: 'hi' }),
      (r) => !r.ok && /secret/.test(r.error ?? ''),
    );
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /refused the project's secret \(401\)/);
    const { tools } = await spoke.client.listTools();
    assert.equal(tools.length, DOCUMENTED_TOOLS.length);
  } finally {
    await spoke.close();
    await hub.close();
  }
});

test('a hello with another protocol version is refused with the fix named', async () => {
  const hub = await startHub();
  try {
    const { code, frames } = await rawExchange(hub.url, { type: 'hello', protocol: PROTOCOL_VERSION + 1, cwd: '/', sessionId: 's' });
    assert.equal(code, 4000);
    assert.equal(frames[0]?.type, 'error');
    assert.equal(frames[0]?.code, 'version');
    assert.match(String(frames[0]?.message), /update cland and restart the session/);
  } finally {
    await hub.close();
  }
});

test('a first frame that is not a hello, or not a frame at all, is refused as bad-hello', async () => {
  const hub = await startHub();
  try {
    for (const frame of [{ type: 'who', id: '1' }, 'not json', { type: 'hello', protocol: PROTOCOL_VERSION }]) {
      const { code, frames } = await rawExchange(hub.url, frame);
      assert.equal(code, 4000, JSON.stringify(frame));
      assert.equal(frames[0]?.code, 'bad-hello');
    }
  } finally {
    await hub.close();
  }
});

test('hello is answered by welcome with the name and the presence table; an unknown request type is a failed result, not a close', async () => {
  const hub = await startHub();
  try {
    const ws = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
    const frames: Array<Record<string, unknown>> = [];
    const next = () => new Promise<Record<string, unknown>>((resolve) => ws.once('message', (d) => resolve(JSON.parse(d.toString()) as Record<string, unknown>)));
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, cwd: '/w', sessionId: 's-raw', name: 'raw', role: 'implementer' }));
    const welcome = await next();
    frames.push(welcome);
    assert.equal(welcome.type, 'welcome');
    assert.equal(welcome.name, 'raw');
    assert.equal(welcome.role, 'implementer');
    assert.deepEqual((welcome.presence as Array<{ name: string }>).map((p) => p.name), ['raw']);
    ws.send(JSON.stringify({ type: 'claim_epic', id: 'r1', epic: 'x' }));
    assert.deepEqual(await next(), { type: 'result', id: 'r1', ok: false, error: 'unknown request type "claim_epic"' });
    ws.send(JSON.stringify({ type: 'ping', id: 'r2' }));
    assert.deepEqual(await next(), { type: 'result', id: 'r2', ok: true, value: { pong: true } });
    ws.close();
  } finally {
    await hub.close();
  }
});

test('a spoke not started through cland stays alive, serves its tools, and answers "not connected to a cland hub"', async () => {
  const hub = await startHub();
  const spoke = await spawnSpoke({ hub, unconfigured: true });
  try {
    const { tools } = await spoke.client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...DOCUMENTED_TOOLS]);
    const who = await spoke.call<{ ok: boolean; error?: string }>('who');
    assert.equal(who.ok, false);
    assert.match(who.error ?? '', /not connected to a cland hub: CLAND_HUB_URL and CLAND_HUB_SECRET are not set/);
    assert.equal(spoke.events.length, 0);
  } finally {
    await spoke.close();
    await hub.close();
  }
});

test('a spoke survives a hub outage: tools report it, and it reconnects when the hub is back', async () => {
  const first = await startHub();
  const port = first.port;
  const alpha = await spawnSpoke({ hub: first, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub: first, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await first.close();
    const down = await until(
      () => alpha.call<{ ok: boolean; error?: string }>('send', { to: ['beta'], text: 'still there?' }),
      (r) => !r.ok,
    );
    assert.match(down.error ?? '', /unreachable|not connected|closed/);

    const second = await createHub({ port, host: '127.0.0.1', secret: TEST_SECRET });
    try {
      await alpha.waitForPresence(['alpha', 'beta'], 10_000);
      const sent = await alpha.call<{ ok: boolean; outcomes: Array<{ outcome: string }> }>('send', { to: ['beta'], text: 'back?' });
      assert.equal(sent.outcomes[0]?.outcome, 'delivered');
      await beta.waitForEvent((e) => e.params.content === 'back?');
    } finally {
      await second.close();
    }
  } finally {
    await alpha.close();
    await beta.close();
  }
});

test('a spoke whose session vanished (stdin ended without an MCP close) exits instead of haunting the hub', async () => {
  const child = spawn(process.execPath, [SPOKE_ENTRY], { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH ?? '' } });
  const stderr: string[] = [];
  child.stderr.on('data', (c: Buffer) => stderr.push(c.toString()));
  const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
  await new Promise((r) => setTimeout(r, 700)); // let it start
  assert.equal(child.exitCode, null, 'alive while its stdin is open');
  child.stdin.end();
  const code = await Promise.race([exited, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000))]);
  assert.equal(code, 0, `exit code (stderr: ${stderr.join('')})`);
  assert.match(stderr.join(''), /stdin (ended|closed) — exiting/);
});
