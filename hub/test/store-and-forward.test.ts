// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import WebSocket from 'ws';
import { createHub } from '../src/hub/server.ts';
import { Store } from '../src/hub/store.ts';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { eventually, inProcessSpoke, startHub, TEST_SECRET, waitForAbsence } from './harness.ts';

type Send = { ok: boolean; outcomes: Array<{ to: string; outcome: string; reason?: string }> };

test('a message to an offline session waits for it and arrives on its next hello, once and in order', async (t) => {
  const hub = await startHub();
  const alpha = await inProcessSpoke(t, { hub, name: 'alpha', sessionId: 'sess-a' });
  const gamma = await inProcessSpoke(t, { hub, name: 'gamma', sessionId: 'sess-g' });
  let beta = await inProcessSpoke(t, { hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await gamma.waitForPresence(['gamma']);
    await beta.waitForPresence(['beta']);
    await alpha.waitForPresence(['alpha', 'beta', 'gamma']);
    await beta.close();
    await waitForAbsence(alpha, 'beta');

    const first = await alpha.call<Send>('send', { to: ['beta'], text: 'first while you were away' });
    assert.equal(first.outcomes[0]?.outcome, 'queued');
    assert.match(first.outcomes[0]?.reason ?? '', /beta offline — queued for up to 24 h/);
    const second = await gamma.call<Send>('send', { to: ['beta', 'alpha'], text: 'second, to both of you' });
    assert.deepEqual(second.outcomes.map((o) => `${o.to}:${o.outcome}`), ['beta:queued', 'alpha:delivered'], 'one addressee queued, the other delivered at once');

    beta = await inProcessSpoke(t, { hub, name: 'beta', sessionId: 'sess-b' });
    await beta.waitForPresence(['beta']);
    await beta.waitForEvent((e) => e.params.content === 'second, to both of you');
    assert.deepEqual(beta.events.map((e) => e.params.content), ['first while you were away', 'second, to both of you']);
    assert.deepEqual(beta.events.map((e) => e.params.meta?.from), ['alpha', 'gamma']);

    // a restart delivers nothing twice
    await beta.close();
    beta = await inProcessSpoke(t, { hub, name: 'beta', sessionId: 'sess-b' });
    await beta.waitForPresence(['beta']);
    await beta.call('who');
    assert.equal(beta.events.length, 0);
  } finally {
    await alpha.close();
    await gamma.close();
    await beta.close();
    await hub.close();
  }
});

test('a queued message survives a hub restart on the same store and is delivered by the new hub', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'cland-hub-restart-'));
  const file = join(dir, 'hub.sqlite');
  const first = await createHub({ port: 0, host: '127.0.0.1', secret: 'test-secret', store: new Store(file) });
  const port = first.port;
  const alpha = await inProcessSpoke(t, { hub: first, name: 'alpha', sessionId: 'sess-a' });
  let beta = await inProcessSpoke(t, { hub: first, name: 'beta', sessionId: 'sess-b' });
  let second: Awaited<ReturnType<typeof createHub>> | null = null;
  try {
    await beta.waitForPresence(['beta']);
    await alpha.waitForPresence(['alpha', 'beta']);
    await beta.close();
    await waitForAbsence(alpha, 'beta');
    assert.equal((await alpha.call<Send>('send', { to: ['beta'], text: 'kept across the restart' })).outcomes[0]?.outcome, 'queued');
    await first.close();
    second = await createHub({ port, host: '127.0.0.1', secret: 'test-secret', store: new Store(file) });
    beta = await inProcessSpoke(t, { hub: second, name: 'beta', sessionId: 'sess-b' });
    await beta.waitForPresence(['beta']);
    await beta.waitForEvent((e) => e.params.content === 'kept across the restart');
    assert.equal(beta.events.length, 1);
  } finally {
    await alpha.close();
    await beta.close();
    await second?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

// T2: hub time is driven by FakeClock; protocol peers run in-process.
test('a queued message older than the TTL is dropped, and the session never sees it', async t => {
  // The hub's clock is injected: with a wall-clock TTL the send could race the close under a loaded suite.
  const clock = new FakeClock(Date.parse('2026-10-08T12:00:00Z'));
  const hub = await startHub({ queueTtlMs: 60_000, clock });
  const alpha = await inProcessSpoke(t, { hub, name: 'alpha', sessionId: 'sess-a' });
  let beta = await inProcessSpoke(t, { hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await beta.waitForPresence(['beta']);
    await alpha.waitForPresence(['alpha', 'beta']);
    await beta.close();
    await waitForAbsence(alpha, 'beta');
    const sent = await alpha.call<Send>('send', { to: ['beta'], text: 'stale' });
    assert.equal(sent.outcomes[0]?.outcome, 'queued', 'the message waited for beta');
    await clock.advance(61_000); // past the TTL: the queued message is stale
    beta = await inProcessSpoke(t, { hub, name: 'beta', sessionId: 'sess-b' });
    await beta.waitForPresence(['beta']);
    await beta.call('who'); // ordered round trip after hello's queued-delivery flush
    assert.equal(beta.events.length, 0);
    // the message itself is still on the record
    const history = await beta.call<{ messages: Array<{ text: string }> }>('history');
    assert.deepEqual(history.messages.map((m) => m.text), ['stale']);
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

test('messages older than the retention window are pruned', async (t) => {
  const clock = new FakeClock();
  const hub = await startHub({ retentionMs: 200, clock });
  const alpha = await inProcessSpoke(t, { hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await inProcessSpoke(t, { hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await beta.waitForPresence(['beta']);
    await alpha.waitForPresence(['alpha', 'beta']);
    await alpha.call('send', { to: ['beta'], text: 'old news' });
    await clock.advance(250);
    await alpha.call('send', { to: ['beta'], text: 'fresh' });
    assert.equal(hub.prune(), 1);
    const history = await beta.call<{ messages: Array<{ text: string }> }>('history');
    assert.deepEqual(history.messages.map((m) => m.text), ['fresh']);
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

test("history returns a session's own traffic, newest last, filtered to one counterpart, capped by limit", async (t) => {
  const hub = await startHub();
  const alpha = await inProcessSpoke(t, { hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await inProcessSpoke(t, { hub, name: 'beta', sessionId: 'sess-b' });
  const gamma = await inProcessSpoke(t, { hub, name: 'gamma', sessionId: 'sess-g' });
  try {
    await beta.waitForPresence(['beta']);
    await gamma.waitForPresence(['gamma']);
    await alpha.waitForPresence(['alpha', 'beta', 'gamma']);
    await alpha.call('send', { to: ['beta'], text: 'a→b 1' });
    await beta.call('send', { to: ['alpha'], text: 'b→a 2' });
    await alpha.call('send', { to: ['gamma'], text: 'a→g 3' });
    await gamma.call('send', { to: ['beta'], text: 'g→b 4' });
    await alpha.call('send', { to: ['beta', 'gamma'], text: 'a→bg 5' });

    const all = await alpha.call<{ messages: Array<{ text: string; from: string; to: string; msg_id: string; from_kind: string }> }>('history');
    assert.deepEqual(all.messages.map((m) => m.text), ['a→b 1', 'b→a 2', 'a→g 3', 'a→bg 5']);
    assert.equal(all.messages[0]?.from, 'alpha');
    assert.equal(all.messages[0]?.to, 'beta');
    assert.equal(all.messages[0]?.from_kind, 'agent');
    assert.match(all.messages[0]?.msg_id ?? '', /^[0-9a-f-]{36}$/);

    const withBeta = await alpha.call<{ messages: Array<{ text: string }> }>('history', { with: '@beta' });
    assert.deepEqual(withBeta.messages.map((m) => m.text), ['a→b 1', 'b→a 2', 'a→bg 5']);

    const last2 = await alpha.call<{ messages: Array<{ text: string }> }>('history', { limit: 2 });
    assert.deepEqual(last2.messages.map((m) => m.text), ['a→g 3', 'a→bg 5']);
  } finally {
    await alpha.close();
    await beta.close();
    await gamma.close();
    await hub.close();
  }
});

test('history filtered to one counterpart finds an older exchange behind a burst of traffic with others', async (t) => {
  const hub = await startHub({ rateLimit: { max: 100, windowMs: 60_000 } });
  const alpha = await inProcessSpoke(t, { hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await inProcessSpoke(t, { hub, name: 'beta', sessionId: 'sess-b' });
  const gamma = await inProcessSpoke(t, { hub, name: 'gamma', sessionId: 'sess-g' });
  try {
    await beta.waitForPresence(['beta']);
    await gamma.waitForPresence(['gamma']);
    await alpha.waitForPresence(['alpha', 'beta', 'gamma']);
    await alpha.call('send', { to: ['beta'], text: 'the one with beta' });
    // more traffic with gamma than any multiple of the limit a pre-filter window would cover
    for (let i = 0; i < 12; i += 1) await alpha.call('send', { to: ['gamma'], text: `to gamma ${i}` });
    const withBeta = await alpha.call<{ messages: Array<{ text: string }> }>('history', { with: 'beta', limit: 2 });
    assert.deepEqual(withBeta.messages.map((m) => m.text), ['the one with beta']);
  } finally {
    await alpha.close();
    await beta.close();
    await gamma.close();
    await hub.close();
  }
});

test('a delivery stays queued until the spoke acks it: an unacked message is sent again on the next connect, an acked one never', async (t) => {
  const hub = await startHub();
  const alpha = await inProcessSpoke(t, { hub, name: 'alpha', sessionId: 'sess-a' });
  /** beta as a raw session: hello, then collect delivers; acks only when told to. */
  const connectBeta = (ack: boolean): Promise<{ ws: WebSocket; delivers: Array<{ id: string; message: { id: string; text: string } }> }> =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
      const delivers: Array<{ id: string; message: { id: string; text: string } }> = [];
      ws.on('error', reject);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, cwd: '/w', sessionId: 'sess-b', name: 'beta' })));
      ws.on('message', (d) => {
        const f = JSON.parse(String(d)) as { type: string; id: string; message: { id: string; text: string } };
        if (f.type === 'welcome') resolve({ ws, delivers });
        if (f.type === 'deliver') {
          delivers.push(f);
          if (ack) ws.send(JSON.stringify({ type: 'ack', id: f.id }));
        }
      });
    });
  const closeRaw = (ws: WebSocket) => new Promise<void>((resolve) => {
    ws.once('close', () => resolve());
    ws.close();
  });
  const waitFor = async (cond: () => boolean) => {
    await eventually('raw spoke receipt', () => cond() || undefined);
    assert.ok(cond());
  };
  try {
    let beta = await connectBeta(false);
    await alpha.waitForPresence(['alpha', 'beta']);
    const sent = await alpha.call<Send>('send', { to: ['beta'], text: 'please confirm' });
    assert.equal(sent.outcomes[0]?.outcome, 'delivered');
    await waitFor(() => beta.delivers.length === 1);
    assert.equal(beta.delivers[0]?.id, beta.delivers[0]?.message.id, 'the deliver frame carries the message id to ack');
    await closeRaw(beta.ws);
    await waitForAbsence(alpha, 'beta');

    // never acked: still queued, so the next connect gets it again
    beta = await connectBeta(true);
    await waitFor(() => beta.delivers.length === 1);
    assert.equal(beta.delivers[0]?.message.text, 'please confirm');
    await new Promise<void>(resolve => {
      beta.ws.on('message', data => { if (JSON.parse(String(data)).id === 'ack-barrier') resolve(); });
      beta.ws.send(JSON.stringify({ type: 'who', id: 'ack-barrier' }));
    });
    await closeRaw(beta.ws);
    await waitForAbsence(alpha, 'beta');

    // acked: delivered, never sent again
    beta = await connectBeta(true);
    await new Promise<void>(resolve => {
      beta.ws.on('message', data => { if (JSON.parse(String(data)).id === 'hello-barrier') resolve(); });
      beta.ws.send(JSON.stringify({ type: 'who', id: 'hello-barrier' }));
    });
    assert.equal(beta.delivers.length, 0);
    await closeRaw(beta.ws);
  } finally {
    await alpha.close();
    await hub.close();
  }
});
