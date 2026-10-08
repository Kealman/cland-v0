import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, spawnSpoke, waitForAbsence } from './harness.ts';

type Send = { ok: boolean; outcomes: Array<{ to: string; outcome: string; reason?: string }> };
const summary = (s: Send) => s.outcomes.map((o) => `${o.to}:${o.outcome}`).sort();

test('@all and a glob reach the connected and the known-offline sessions, never the sender', async () => {
  const hub = await startHub();
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const impl1 = await spawnSpoke({ hub, name: 'impl-1', sessionId: 'sess-1' });
  const impl2 = await spawnSpoke({ hub, name: 'impl-2', sessionId: 'sess-2' });
  try {
    await alpha.waitForPresence(['alpha', 'impl-1', 'impl-2']);
    await impl2.close();
    await waitForAbsence(alpha, 'impl-2');
    const glob = await alpha.call<Send>('send', { to: ['impl-*'], text: 'to the implementers' });
    assert.deepEqual(glob.outcomes, [{ to: 'impl-*', outcome: 'delivered', reason: 'queued for impl-2 (offline)' }]);
    await impl1.waitForEvent((e) => e.params.content === 'to the implementers');
    const everyone = await impl1.call<Send>('send', { to: ['@all'], text: 'to everyone' });
    assert.deepEqual(summary(everyone), ['all:delivered']);
    await alpha.waitForEvent((e) => e.params.content === 'to everyone');
    assert.ok(!impl1.events.some((e) => e.params.content === 'to everyone'), 'the sender is not its own addressee');
    assert.deepEqual(summary(await alpha.call<Send>('send', { to: ['nobody-*', 'ghost'], text: 'x' })), ['ghost:unknown', 'nobody-*:unknown']);
  } finally {
    await alpha.close();
    await impl1.close();
    await hub.close();
  }
});

test('@all reaches a session seen within the queue TTL and not one older', async () => {
  let now = Date.parse('2026-10-08T12:00:00Z');
  const hub = await startHub({ queueTtlMs: 60_000, now: () => new Date(now) });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const old = await spawnSpoke({ hub, name: 'old-one', sessionId: 'sess-o' });
  try {
    await alpha.waitForPresence(['alpha', 'old-one']);
    await old.close();
    await waitForAbsence(alpha, 'old-one');
    now += 30_000; // still within the TTL: old-one is an addressee, queued
    let sent = await alpha.call<Send>('send', { to: ['all'], text: 'first' });
    assert.equal(sent.outcomes[0]?.outcome, 'queued');
    now += 31_000; // past the TTL: old-one is history
    sent = await alpha.call<Send>('send', { to: ['all', 'old-one'], text: 'second' });
    assert.deepEqual(summary(sent), ['all:unknown', 'old-one:unknown']);
  } finally {
    await alpha.close();
    await hub.close();
  }
});

test('a role is a tag: @reviewer reaches the sessions holding it, live or offline; an unheld role answers empty', async () => {
  const hub = await startHub();
  const coord = await spawnSpoke({ hub, name: 'coord', role: 'coordinator', sessionId: 'sess-c' });
  const rev = await spawnSpoke({ hub, name: 'rev', role: 'reviewer', sessionId: 'sess-r' });
  const other = await spawnSpoke({ hub, name: 'other', role: 'no-such-role', sessionId: 'sess-o' });
  try {
    await coord.waitForPresence(['coord', 'rev', 'other']);
    const who = await coord.call<{ sessions: Array<{ name: string; role: string | null }> }>('who');
    assert.equal(who.sessions.find((s) => s.name === 'other')?.role, null, 'an unknown role is ignored, not taken');
    const live = await coord.call<Send>('send', { to: ['@reviewer'], text: 'please review #21' });
    assert.deepEqual(live.outcomes, [{ to: 'reviewer', outcome: 'delivered' }]);
    const event = await rev.waitForEvent((e) => e.params.content === 'please review #21');
    assert.equal(event.params.meta?.from_role, 'coordinator');
    assert.equal(event.params.meta?.to, 'rev');
    await rev.close();
    await waitForAbsence(coord, 'rev');
    const offline = await coord.call<Send>('send', { to: ['reviewer'], text: 'when you are back' });
    assert.equal(offline.outcomes[0]?.outcome, 'queued', 'an offline holder is a queue target');
    const empty = await coord.call<Send>('send', { to: ['qa'], text: 'anyone?' });
    assert.deepEqual(empty.outcomes, [{ to: 'qa', outcome: 'empty', reason: 'role "qa" has no holder' }]);
  } finally {
    await coord.close();
    await rev.close();
    await other.close();
    await hub.close();
  }
});
