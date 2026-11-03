// T1: shared recipient enumeration and scoped ownership; no transport.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Store } from '../src/hub/store.ts';
import { remotePublications } from '../src/remote/cards.ts';

test('publications scope every user, deduplicate shared channels and preserve single mode', async t => {
  const db = new Store(); t.after(() => db.close());
  const state = db.remotes.forMessenger('telegram');
  const alice = db.users.firstAdmin('Alice', [], 1), bob = db.users.add('bob', 'Bob', [], 2);
  state.setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Alice' });
  assert.equal((await remotePublications(state, async p => p.chatId)).length, 1);
  db.users.setMode('users', 3);
  state.setUserPairing(bob.id, { userId: '202', chatId: '202', guildId: null, name: 'Bob' });
  const seen = await remotePublications(state, async p => { await Promise.resolve(); return state.pairing()?.clandUserId; });
  assert.deepEqual(new Set(seen), new Set([alice.id, bob.id]));
  const discord = db.remotes.forMessenger('discord');
  for (const [id, native] of [[alice.id, '101'], [bob.id, '202']]) discord.setUserPairing(id!, { userId: native!, chatId: '303', guildId: '404', name: native! });
  assert.equal((await remotePublications(discord, async p => p.chatId)).length, 1);
});

test('publication failure retains ownership until every admitted destination finishes', async t => {
  const db = new Store(); t.after(() => db.close());
  const state = db.remotes.forMessenger('telegram');
  const a = db.users.firstAdmin('Alice', [], 1), b = db.users.add('bob', 'Bob', [], 2);
  db.users.setMode('users', 3);
  for (const [user, chat] of [[a.id, '101'], [b.id, '202']]) state.setUserPairing(user!, { userId: chat!, chatId: chat!, guildId: null, name: chat! });
  const entered = Promise.withResolvers<void>(), finish = Promise.withResolvers<void>();
  let settled = false;
  const work = remotePublications(state, async pair => {
    if (pair.chatId === '101') throw new Error('peer failed');
    entered.resolve(); await finish.promise;
  });
  const observed = work.then(() => { settled = true; }, () => { settled = true; });
  await entered.promise; await Promise.resolve();
  assert.equal(settled, false);
  finish.resolve(); await assert.rejects(work, /peer failed/); await observed;
  assert.equal(settled, true);
});

test('a scoped delivery cannot inherit a reassigned chat owner', async t => {
  const db = new Store(); t.after(() => db.close());
  const state = db.remotes.forMessenger('telegram');
  const a = db.users.firstAdmin('Alice', [], 1), b = db.users.add('bob', 'Bob', [], 2);
  db.users.setMode('users', 3);
  state.setUserPairing(a.id, { userId: '101', chatId: '101', guildId: null, name: 'Alice' });
  const captured = state.userPairing(a.id)!;
  await state.withPairing(captured, async () => {
    await Promise.resolve();
    state.removeUserPairing(a.id); state.setUserPairing(b.id, captured);
    assert.equal(state.deliveryPairing('101'), null);
  });
  assert.equal(state.deliveryPairing('101')?.clandUserId, b.id);
});

for (const retained of ['fresh', 'retained', 'legacy']) test(`Telegram gap cannot settle a reassigned project owner's jobs (retained: ${retained})`, async t => {
  const { flushTelegramGap } = await import('../src/remote/telegram-gap.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const db = new Store(); t.after(() => db.close());
  const state = db.remotes.forMessenger('telegram'), clock = new FakeClock();
  const a = db.users.firstAdmin('Alice', [], 1), b = db.users.add('bob', 'Bob', [], 2);
  db.users.setMode('users', 3);
  const native = { userId: '101', chatId: '101', guildId: null, name: 'Alice' };
  state.setUserPairing(a.id, native);
  const at = clock.now().toISOString();
  state.putOutbox({ id: 'alice-missed', source: 'alice-line', kind: 'general', state: 'missed', created: at, updated: at,
    payload: { telegram: true, userId: '101', clandUserId: a.id, params: { chat_id: '101' } } });
  if (retained === 'retained') await assert.rejects(flushTelegramGap(state, clock, async () => { throw new Error('held gap'); }), /held gap/);
  if (retained === 'legacy') state.set('telegram.gap:101', JSON.stringify({ chat: '101', user: '101', jobs: ['alice-missed'], key: 'legacy-gap', text: 'Alice gap' }));
  state.removeUserPairing(a.id); state.setUserPairing(b.id, native);
  let sends = 0;
  await flushTelegramGap(state, clock, async () => { sends++; });
  assert.equal(sends, 0, 'Bob cannot publish Alice gap');
  assert.equal(state.outbox()[0]!.state, 'missed');
});

test('Telegram gap cannot settle an admitted owner after reassignment during its send', async t => {
  const { flushTelegramGap } = await import('../src/remote/telegram-gap.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const db = new Store(); t.after(() => db.close());
  const state = db.remotes.forMessenger('telegram'), clock = new FakeClock();
  const a = db.users.firstAdmin('Alice', [], 1), b = db.users.add('bob', 'Bob', [], 2);
  db.users.setMode('users', 3);
  const native = { userId: '101', chatId: '101', guildId: null, name: 'Alice' };
  state.setUserPairing(a.id, native);
  const at = clock.now().toISOString();
  state.putOutbox({ id: 'held', source: 'line', kind: 'general', state: 'missed', created: at, updated: at,
    payload: { telegram: true, userId: '101', clandUserId: a.id, params: { chat_id: '101' } } });
  const entered = Promise.withResolvers<void>(), sent = Promise.withResolvers<void>();
  const work = flushTelegramGap(state, clock, async () => { entered.resolve(); await sent.promise; });
  await entered.promise;
  state.removeUserPairing(a.id); state.setUserPairing(b.id, native);
  sent.resolve(); assert.equal(await work, false);
  assert.equal(state.outbox()[0]!.state, 'missed');
});
