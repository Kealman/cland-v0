import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startHub, spawnSpoke, sleep, waitForAbsence } from './harness.ts';
import { createHub } from '../src/hub/server.ts';
import { Store } from '../src/hub/store.ts';

type Send = { ok: boolean; outcomes: Array<{ to: string; outcome: string; reason?: string }> };

test('a message to an offline session waits for it and arrives on its next hello, once and in order', async () => {
  const hub = await startHub();
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const gamma = await spawnSpoke({ hub, name: 'gamma', sessionId: 'sess-g' });
  let beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta', 'gamma']);
    await beta.close();
    await waitForAbsence(alpha, 'beta');

    const first = await alpha.call<Send>('send', { to: ['beta'], text: 'first while you were away' });
    assert.equal(first.outcomes[0]?.outcome, 'queued');
    assert.match(first.outcomes[0]?.reason ?? '', /beta offline — queued for up to 24 h/);
    const second = await gamma.call<Send>('send', { to: ['beta', 'alpha'], text: 'second, to both of you' });
    assert.deepEqual(second.outcomes.map((o) => `${o.to}:${o.outcome}`), ['beta:queued', 'alpha:delivered'], 'one addressee queued, the other delivered at once');

    beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
    await beta.waitForEvent((e) => e.params.content === 'second, to both of you');
    assert.deepEqual(beta.events.map((e) => e.params.content), ['first while you were away', 'second, to both of you']);
    assert.deepEqual(beta.events.map((e) => e.params.meta?.from), ['alpha', 'gamma']);

    // a restart delivers nothing twice
    await beta.close();
    beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
    await beta.waitForPresence(['beta']);
    await sleep(100);
    assert.equal(beta.events.length, 0);
  } finally {
    await alpha.close();
    await gamma.close();
    await beta.close();
    await hub.close();
  }
});

test('a queued message survives a hub restart on the same store and is delivered by the new hub', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cland-hub-restart-'));
  const file = join(dir, 'hub.sqlite');
  const first = await createHub({ port: 0, host: '127.0.0.1', secret: 'test-secret', store: new Store(file) });
  const port = first.port;
  const alpha = await spawnSpoke({ hub: first, name: 'alpha', sessionId: 'sess-a' });
  let beta = await spawnSpoke({ hub: first, name: 'beta', sessionId: 'sess-b' });
  let second: Awaited<ReturnType<typeof createHub>> | null = null;
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await beta.close();
    await waitForAbsence(alpha, 'beta');
    assert.equal((await alpha.call<Send>('send', { to: ['beta'], text: 'kept across the restart' })).outcomes[0]?.outcome, 'queued');
    await first.close();
    second = await createHub({ port, host: '127.0.0.1', secret: 'test-secret', store: new Store(file) });
    beta = await spawnSpoke({ hub: second, name: 'beta', sessionId: 'sess-b' });
    await beta.waitForEvent((e) => e.params.content === 'kept across the restart');
    assert.equal(beta.events.length, 1);
  } finally {
    await alpha.close();
    await beta.close();
    await second?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a queued message older than the TTL is dropped, and the session never sees it', async () => {
  // The hub's clock is injected: with a wall-clock TTL the send could race the close under a loaded suite.
  let now = Date.parse('2026-10-08T12:00:00Z');
  const hub = await startHub({ queueTtlMs: 60_000, now: () => new Date(now) });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  let beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await beta.close();
    await waitForAbsence(alpha, 'beta');
    const sent = await alpha.call<Send>('send', { to: ['beta'], text: 'stale' });
    assert.equal(sent.outcomes[0]?.outcome, 'queued', 'the message waited for beta');
    now += 61_000; // past the TTL: the queued message is stale
    beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
    await beta.waitForPresence(['beta']);
    await sleep(100);
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

test('messages older than the retention window are pruned', async () => {
  const hub = await startHub({ retentionMs: 200 });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await alpha.call('send', { to: ['beta'], text: 'old news' });
    await sleep(250);
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

test("history returns a session's own traffic, newest last, filtered to one counterpart, capped by limit", async () => {
  const hub = await startHub();
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  const gamma = await spawnSpoke({ hub, name: 'gamma', sessionId: 'sess-g' });
  try {
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
