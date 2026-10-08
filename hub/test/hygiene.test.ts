import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import type { Socket } from 'node:net';
import { startHub, spawnSpoke, sleep, TEST_SECRET } from './harness.ts';
import { MAX_FRAME_BYTES, PROTOCOL_VERSION } from '../src/protocol.ts';

type Send = { ok: boolean; error?: string; outcomes?: Array<{ to: string; outcome: string; reason?: string }> };

test('a chatty session is rate-limited: send refuses with the reason and when the window frees', async () => {
  const hub = await startHub({ rateLimit: { max: 3, windowMs: 60_000 } });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    for (let i = 1; i <= 3; i += 1) assert.equal((await alpha.call<Send>('send', { to: ['beta'], text: `m${i}` })).ok, true);
    const fourth = await alpha.call<Send>('send', { to: ['beta'], text: 'm4' });
    assert.equal(fourth.ok, false);
    assert.match(fourth.error ?? '', /^rate limit: 3 messages in 1 min — the window frees at \d{4}-\d{2}-\d{2}T/);
    assert.equal((await beta.call<Send>('send', { to: ['alpha'], text: 'still fine' })).ok, true, 'the limit is per session');
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

test('two agents in a reply loop are muted for the mute time in both directions, and the count starts afresh after it', async () => {
  const log: Array<Record<string, unknown>> = [];
  const hub = await startHub({ loopBreaker: { max: 4, windowMs: 60_000, muteMs: 600 }, rateLimit: { max: 100, windowMs: 60_000 }, log: (e) => log.push(e) });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  const gamma = await spawnSpoke({ hub, name: 'gamma', sessionId: 'sess-g' });
  try {
    await alpha.waitForPresence(['alpha', 'beta', 'gamma']);
    const volley = [alpha, beta, alpha, beta];
    for (const [i, s] of volley.entries()) {
      const r = await s.call<Send>('send', { to: [s === alpha ? 'beta' : 'alpha'], text: `thanks ${i}` });
      assert.equal(r.outcomes?.[0]?.outcome, 'delivered', `message ${i}`);
    }
    const fifth = await alpha.call<Send>('send', { to: ['beta'], text: 'you are welcome' });
    assert.equal(fifth.outcomes?.[0]?.outcome, 'refused');
    assert.match(fifth.outcomes?.[0]?.reason ?? '', /^loop breaker: alpha ↔ beta exchanged more than 4 messages in 1 min with no human in between — a hard 0-min cool-down, muted until \d{4}-/);
    const back = await beta.call<Send>('send', { to: ['alpha'], text: 'no, thank you' });
    assert.equal(back.outcomes?.[0]?.outcome, 'refused', 'both directions');
    assert.ok(log.some((e) => e.event === 'loop-breaker' && e.pair === 'alpha|beta'), 'the mute is journalled');
    const third = await alpha.call<Send>('send', { to: ['beta', 'gamma'], text: 'gamma is fine' });
    assert.deepEqual(third.outcomes?.map((o) => `${o.to}:${o.outcome}`), ['beta:refused', 'gamma:delivered'], 'only the muted pair is refused');
    await sleep(650);
    for (let i = 0; i < 4; i += 1) {
      const r = await (i % 2 ? beta : alpha).call<Send>('send', { to: [i % 2 ? 'alpha' : 'beta'], text: `after the mute ${i}` });
      assert.equal(r.outcomes?.[0]?.outcome, 'delivered', `after the mute, message ${i}: the count started afresh`);
    }
  } finally {
    await alpha.close();
    await beta.close();
    await gamma.close();
    await hub.close();
  }
});

test('an oversized message is refused with the size, and nothing is delivered', async () => {
  const hub = await startHub({ maxTextBytes: 1024 });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    const big = await alpha.call<Send>('send', { to: ['beta'], text: 'x'.repeat(1025) });
    assert.equal(big.ok, false);
    assert.match(big.error ?? '', /^message is 1025 bytes; the cap is 1024/);
    assert.equal((await alpha.call<Send>('send', { to: ['beta'], text: 'x'.repeat(1024) })).ok, true, 'at the cap is fine');
    await beta.waitForEvent((e) => e.params.content.length === 1024);
    assert.equal(beta.events.length, 1);
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

test('a socket that misses two heartbeats is closed and the spoke reconnects with a fresh hello', async () => {
  const hub = await startHub({ heartbeatMs: 100 });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a', heartbeatMs: 10_000 }); // never heartbeats in time
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b', heartbeatMs: 30 });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    const connectedAt = async (name: string) => (await beta.call<{ sessions: Array<{ name: string; connectedAt: string }> }>('who')).sessions.find((d) => d.name === name)?.connectedAt;
    const before = await connectedAt('alpha');
    const betaBefore = await connectedAt('beta');
    // the hub closes alpha after two missed heartbeats (≤ 300 ms); alpha reconnects with a fresh hello: poll, never sleep
    const deadline = Date.now() + 5000;
    let after: string | undefined;
    while (Date.now() < deadline) {
      after = await connectedAt('alpha');
      if (after !== undefined && after !== before) break;
      await sleep(25);
    }
    assert.ok(after !== undefined && after !== before, `a fresh hello after the close (before ${before}, after ${after})`);
    assert.equal(await connectedAt('beta'), betaBefore, 'the session that heartbeats was never cut off');
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

test('a peer whose bytes still arrive is alive: a socket in the middle of one large frame is not cut off; a silent one beside it is', async () => {
  const log: Array<Record<string, unknown>> = [];
  const hub = await startHub({ heartbeatMs: 100, log: (e) => log.push(e) });
  /** A session over the raw edge: hello, welcome — then nothing from the client library at all. */
  const connect = (name: string): Promise<WebSocket> =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
      ws.on('error', reject);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, cwd: '/w', sessionId: `s-${name}`, name })));
      ws.on('message', (data) => {
        if ((JSON.parse(String(data)) as { type: string }).type === 'welcome') resolve(ws);
      });
    });
  const uploading = await connect('uploading');
  const silent = await connect('silent');
  const closed = new Set<string>();
  uploading.on('close', () => closed.add('uploading'));
  silent.on('close', () => closed.add('silent'));
  // ONE masked text frame that declares half the cap and never completes: its header now, then a few
  // payload bytes every 30 ms — no 'message' ever reaches the hub, only bytes
  const declared = MAX_FRAME_BYTES / 2;
  const raw = (uploading as unknown as { _socket: Socket })._socket;
  const header = Buffer.alloc(14);
  header[0] = 0x81; // FIN + text
  header[1] = 0x80 | 127; // masked, 64-bit length
  header.writeBigUInt64BE(BigInt(declared), 2);
  header.writeUInt32BE(0x01020304, 10); // the mask key
  raw.write(header);
  const trickle = setInterval(() => raw.write(Buffer.from('{"a":1}')), 30);
  try {
    await sleep(700); // seven heartbeat intervals: the sweep has run on both sockets many times
    assert.ok(closed.has('silent'), 'the silent socket was cut off after two missed heartbeats');
    assert.ok(!closed.has('uploading'), 'the socket whose bytes kept arriving was not');
    assert.equal(uploading.readyState, WebSocket.OPEN);
    const names = hub.core.presence().map((p) => p.name);
    assert.ok(names.includes('uploading') && !names.includes('silent'), `presence: ${names.join(', ')}`);
    assert.equal(log.filter((e) => e.event === 'heartbeat-timeout').length, 1, 'exactly one socket timed out — the silent one');
  } finally {
    clearInterval(trickle);
    uploading.terminate();
    silent.terminate();
    await hub.close();
  }
});

test('a frame over the size limit closes the socket before it is parsed', async () => {
  const hub = await startHub();
  try {
    const ws = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
    ws.on('error', () => {});
    ws.send('x'.repeat(MAX_FRAME_BYTES + 1));
    assert.equal(await closed, 1009, 'message too big');
  } finally {
    await hub.close();
  }
});
