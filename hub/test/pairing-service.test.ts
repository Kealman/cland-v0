// T1: durable pairing service with in-memory hub.db and fake time; no transport.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Store } from '../src/hub/store.ts';
import { PairingCodes } from '../src/remote/pairing.ts';
import { FakeClock } from './fake-clock.ts';
import { HubCore } from '../src/hub/core.ts';

test('local approval can resolve a live pairing by id and clear only its messenger', async () => {
  const store = new Store();
  const clock = new FakeClock();
  const codes = new PairingCodes(store.remotes, clock, () => {});
  try {
    const identity = { userId: '9007199254740993', chatId: '1234567890123456789', guildId: '987654321098765432', name: 'Fixture human' };
    for (const messenger of ['telegram', 'discord'] as const) {
      for (const userId of [identity.userId, '2', '3']) assert.ok(codes.issue(messenger, { ...identity, userId }));
    }
    const rows = codes.waiting();
    assert.equal(rows.length, 6, 'each messenger owns its own three-code allowance');
    const row = rows.find(row => row.messenger === 'discord' && row.userId === identity.userId)!;
    assert.deepEqual(codes.get(row.id), row);
    assert.equal(codes.get('pairing:discord:UNKNOWN2'), null);
    codes.clear('telegram');
    assert.deepEqual(codes.waiting(), rows.filter(row => row.messenger === 'discord'));
    await clock.advance(900_000);
    assert.equal(codes.get(row.id), null, 'an expired request cannot grant access');
    assert.deepEqual(store.remotes.forMessenger('discord').requests(), [], 'expiry removes the durable waiting records');
    assert.deepEqual(codes.waiting(), []);
    codes.close();
    assert.equal(clock.pending, 0);
    assert.throws(() => codes.issue('discord', identity), /pairing is closed/);
  } finally { codes.close(); store.close(); }
});

for (const ordinary of [false, true]) test(`remote needs-you excludes pairing when time crosses expiry during projection (ordinary request: ${ordinary})`, () => {
  const clock = new FakeClock();
  const core = new HubCore({ clock });
  try {
    if (ordinary) core.store.record({ id: 'ordinary-request', from: 'fixture', fromKind: 'agent', via: 'session', to: [],
      kind: 'request', request: 'review', subject: 'fixture', text: 'Review this work', topic: 'general', ts: clock.now().toISOString() }, [], clock.now().getTime());
    const expected = ordinary ? 1 : 0;
    assert.equal(core.inbox.list().needsYou, expected, 'the ordinary request is a positive control');
    assert.ok(core.inbox.pairingCodes.issue('telegram', { userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' }));
    assert.equal(core.inbox.needsYou(), expected + 1, 'prime the local total while the pairing is live');
    clock.block(3600_000 - 1);
    const now = clock.now.bind(clock);
    let reads = 0;
    clock.now = () => {
      if (++reads === 2) clock.block(1); // Cross exactly between the cached-total check and the old pairing subtraction.
      return now();
    };
    assert.equal(core.inbox.needsYou(false), expected, 'the remote count never includes the pairing-only contribution');
    assert.ok(reads >= 2, 'the injected clock crossed the boundary during this projection');
    clock.now = now;
    assert.equal(core.inbox.needsYou(false), expected, 'the ordinary request remains after exact expiry');
    assert.deepEqual(core.inbox.list().pairings, []);
  } finally { core.close(); core.store.close(); }
});
