import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { spawn } from 'node:child_process';
import type { Socket } from 'node:net';
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

/** One masked client text frame, written straight to a socket (what a client sends, whatever its library thinks). */
const maskedTextFrame = (text: string): Buffer => {
  const payload = Buffer.from(text);
  if (payload.length >= 126) throw new Error('short frames only');
  const mask = Buffer.from([1, 2, 3, 4]);
  const masked = Buffer.from(payload.map((b, i) => b ^ (mask[i % 4] as number)));
  return Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
};

test('a replaced spoke whose socket is still closing cannot act under the name it lost', async () => {
  const hub = await startHub();
  const open = (): Promise<{ ws: WebSocket; frames: Array<Record<string, unknown>> }> =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
      const frames: Array<Record<string, unknown>> = [];
      ws.on('error', reject);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, cwd: '/w', sessionId: 'sess-a', name: 'alpha' })));
      ws.on('message', (d) => {
        const f = JSON.parse(String(d)) as Record<string, unknown>;
        frames.push(f);
        if (f.type === 'welcome') resolve({ ws, frames });
      });
    });
  const stale = await open();
  // the stale spoke stops reading: it never sees the hub's close, and its socket stays half-open
  const raw = (stale.ws as unknown as { _socket: Socket })._socket;
  raw.pause();
  const fresh = await open();
  try {
    fresh.ws.send(JSON.stringify({ type: 'status', id: 'f1', text: 'the fresh one' }));
    await until(async () => fresh.frames.some((f) => f.id === 'f1'), (ok) => ok);
    raw.write(maskedTextFrame(JSON.stringify({ type: 'status', id: 's1', text: 'stale overwrite' })));
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(hub.core.presence().find((p) => p.name === 'alpha')?.status, 'the fresh one', 'the replaced socket changed nothing');
  } finally {
    stale.ws.terminate();
    fresh.ws.terminate();
    await hub.close();
  }
});

test('a spoke acks every deliver and hands a message re-sent under the same id to its session once', async () => {
  // a minimal hub over the real wire: welcome, then the same deliver twice
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>((resolve) => wss.once('listening', () => resolve()));
  const acks: string[] = [];
  const message = { id: 'm-1', from: 'alpha', fromKind: 'agent', via: 'session', to: ['beta'], text: 'only once, please', ts: new Date().toISOString() };
  wss.on('connection', (ws) => {
    ws.on('message', (d) => {
      const f = JSON.parse(String(d)) as { type: string; id?: string };
      if (f.type === 'hello') {
        ws.send(JSON.stringify({ type: 'welcome', name: 'beta', presence: [] }));
        ws.send(JSON.stringify({ type: 'deliver', id: message.id, message }));
        ws.send(JSON.stringify({ type: 'deliver', id: message.id, message }));
      }
      if (f.type === 'ack' && f.id) acks.push(f.id);
    });
  });
  const port = (wss.address() as { port: number }).port;
  const spoke = await spawnSpoke({ hub: { url: `ws://127.0.0.1:${port}` }, name: 'beta', sessionId: 'sess-b' });
  try {
    await until(async () => acks.length, (n) => n >= 2);
    assert.deepEqual(acks, ['m-1', 'm-1'], 'both copies acked');
    await spoke.waitForEvent((e) => e.params.content === 'only once, please');
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(spoke.events.length, 1, 'the session saw it once');
  } finally {
    await spoke.close();
    for (const c of wss.clients) c.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  }
});

/** A hub that welcomes every hello and then never answers anything: alive on the wire, dead in the protocol. */
const silentHub = async () => {
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>((resolve) => wss.once('listening', () => resolve()));
  let hellos = 0;
  wss.on('connection', (ws) => {
    ws.on('message', (d) => {
      if ((JSON.parse(String(d)) as { type: string }).type !== 'hello') return;
      hellos += 1;
      ws.send(JSON.stringify({ type: 'welcome', name: 'alpha', presence: [] }));
    });
  });
  return {
    url: `ws://127.0.0.1:${(wss.address() as { port: number }).port}`,
    hellos: () => hellos,
    close: async () => {
      for (const c of wss.clients) c.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
};

test('a request the hub never answers fails at its deadline instead of hanging the tool call', async () => {
  const hub = await silentHub();
  const spoke = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a', requestTimeoutMs: 300 });
  try {
    await until(async () => hub.hellos(), (n) => n >= 1);
    await new Promise((r) => setTimeout(r, 100)); // the welcome is in
    const started = Date.now();
    const who = await spoke.call<{ ok: boolean; error?: string }>('who');
    assert.equal(who.ok, false);
    assert.match(who.error ?? '', /the hub did not answer within 0\.3 s/);
    assert.ok(Date.now() - started < 3000, 'bounded by the deadline');
  } finally {
    await spoke.close();
    await hub.close();
  }
});

test('a spoke whose heartbeats go unanswered closes the connection and reconnects', async () => {
  const hub = await silentHub();
  const spoke = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a', heartbeatMs: 100 });
  try {
    const hellos = await until(async () => hub.hellos(), (n) => n >= 2, 5000);
    assert.ok(hellos >= 2, `a fresh hello after the missed heartbeats (saw ${hellos})`);
    assert.match(spoke.log(), /missed 2 heartbeat replies/);
  } finally {
    await spoke.close();
    await hub.close();
  }
});
