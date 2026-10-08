import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hygiene, pairKey } from './hygiene.ts';
import { Store } from './store.ts';

test("the rate limit counts a session's sends in a sliding window and names when it frees", () => {
  const h = new Hygiene({ rateLimit: { max: 2, windowMs: 1000 } });
  assert.equal(h.rateRefusal('a', 0), null);
  assert.equal(h.rateRefusal('a', 100), null);
  assert.match(h.rateRefusal('a', 200) ?? '', /^rate limit: 2 messages in 0 min — the window frees at 1970-01-01T00:00:01\.000Z$/);
  assert.equal(h.rateRefusal('b', 200), null, 'per session');
  assert.equal(h.rateRefusal('a', 1001), null, 'the first send slid out of the window');
});

test('the loop breaker mutes a pair past the threshold for the mute time, whichever direction talks', () => {
  const h = new Hygiene({ loopBreaker: { max: 2, windowMs: 1000, muteMs: 500 } });
  assert.equal(h.countPair('a', 'b', 0), null);
  assert.equal(h.countPair('b', 'a', 10), null);
  assert.equal(h.countPair('a', 'b', 20), 520, 'the third crosses the threshold: muted until 20 + 500');
  assert.match(h.muteRefusal('b', 'a', 30) ?? '', /muted until 1970-01-01T00:00:00\.520Z/);
  assert.equal(h.muteRefusal('a', 'b', 520), null, 'the mute runs its course and is forgotten');
  assert.equal(pairKey('b', 'a'), 'a|b');
});

test('a human touching a session resets the pair counts but does not lift a running mute', () => {
  const h = new Hygiene({ loopBreaker: { max: 2, windowMs: 1000, muteMs: 500 } });
  h.countPair('a', 'b', 0);
  h.countPair('a', 'b', 1);
  h.humanTouched('a');
  assert.equal(h.countPair('a', 'b', 2), null, 'the count started afresh');
  assert.equal(h.countPair('a', 'b', 3), null);
  assert.equal(h.countPair('a', 'b', 4), 504);
  h.humanTouched('b');
  assert.match(h.muteRefusal('a', 'b', 5) ?? '', /muted until/, 'the mute stands');
});

test('the size cap refuses an oversized send and truncates oversized human text with the original length', () => {
  const h = new Hygiene({ maxTextBytes: 100 });
  assert.equal(h.sizeRefusal('x'.repeat(100)), null);
  assert.match(h.sizeRefusal('x'.repeat(101)) ?? '', /^message is 101 bytes; the cap is 100/);
  const cut = h.truncate('y'.repeat(300));
  assert.ok(Buffer.byteLength(cut) <= 100);
  assert.match(cut, / … \[truncated by the hub: 300 chars\]$/);
  assert.equal(h.truncate('short'), 'short');
});

test('a person lifts a running mute with unmute, order-independent, and the count resets with it', () => {
  const h = new Hygiene({ loopBreaker: { max: 2, windowMs: 1000, muteMs: 500 } });
  h.countPair('a', 'b', 0);
  h.countPair('a', 'b', 10);
  assert.equal(h.countPair('a', 'b', 20), 520, 'muted');
  assert.equal(h.unmute('b', 'a'), true, 'unmute lifts it, order-independent');
  assert.equal(h.muteRefusal('a', 'b', 31), null, 'the pair can talk again immediately');
  assert.equal(h.countPair('a', 'b', 32), null, 'the count was reset too — one message does not re-mute');
  assert.equal(h.unmute('a', 'b'), false, 'unmute of a pair that is not muted reports nothing lifted');
});

test('mutes and counters live in the store: a hub reopened on the same file keeps them', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'cland-hygiene-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'hub.db');
  const options = { rateLimit: { max: 2, windowMs: 1000 }, loopBreaker: { max: 2, windowMs: 1000, muteMs: 500 } };

  let store = new Store(file);
  let h = new Hygiene({ ...options, memory: store });
  h.countPair('a', 'b', 0);
  h.countPair('a', 'b', 10);
  assert.equal(h.countPair('a', 'b', 20), 520, 'muted');
  h.countPair('c', 'd', 30);
  h.rateRefusal('a', 40);
  h.rateRefusal('a', 50);
  store.close();

  store = new Store(file);
  h = new Hygiene({ ...options, memory: store });
  assert.match(h.muteRefusal('a', 'b', 100) ?? '', /muted until 1970-01-01T00:00:00\.520Z/, 'the mute survived');
  assert.match(h.rateRefusal('a', 60) ?? '', /^rate limit/, 'the rate window survived');
  h.countPair('c', 'd', 40);
  assert.equal(h.countPair('c', 'd', 50), 550, 'the pair count survived: the third crosses');
  assert.equal(h.unmute('a', 'b'), true);
  store.close();

  store = new Store(file);
  h = new Hygiene({ ...options, memory: store });
  assert.equal(h.muteRefusal('a', 'b', 100), null, 'a lifted mute stays lifted');
  assert.notEqual(h.muteRefusal('c', 'd', 100), null);
  assert.equal(h.muteRefusal('c', 'd', 550), null, 'an expired mute is forgotten');
  store.close();
  store = new Store(file);
  h = new Hygiene({ ...options, memory: store });
  assert.equal(h.muteRefusal('c', 'd', 100), null, 'and forgotten in the store too');
  store.close();
});
