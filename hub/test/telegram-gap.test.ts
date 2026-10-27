// T1: durable captured gaps and injected delivery receipts; no sockets, processes or real time.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { flushTelegramGap } from '../src/remote/telegram-gap.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';
import { pairing } from './telegram-polling-fixture.ts';
import { heldTelegramGap } from './telegram-gap-fixture.ts';

test('Telegram gap counts sources once and acknowledges only captured jobs after its send receipt', async t => {
  const f = await heldTelegramGap(t);
  try {
    f.missed('part-1', 'source-1'); f.missed('part-2', 'source-1'); f.missed('other', 'source-2');
    await f.start();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0]!.chat, '101');
    assert.equal(f.calls[0]!.text, '2 General messages missed since 13:20');
    assert.deepEqual(f.view.outbox().map(row => row.state), ['missed', 'missed', 'missed'], 'no acknowledgement before the matching delivery receipt');
    f.missed('during-send', 'source-3');
    f.accept();
    assert.equal(await f.completion(), false, 'a new missed source remains pending');
    assert.deepEqual(f.view.outbox().map(row => row.state), ['reported', 'reported', 'reported', 'missed']);
    assert.equal(await flushTelegramGap(f.store, f.clock, async (chat, text, key) => { f.calls.push({ chat, text, key }); }), true);
    assert.equal(f.calls[1]!.text, '1 General messages missed since 13:20');
    assert.notEqual(f.calls[0]!.key, f.calls[1]!.key);
    assert.equal(await flushTelegramGap(f.store, f.clock, async () => { assert.fail('zero missed messages must stay silent'); }), true);
  } finally { await f.dispose(); }
  assert.deepEqual(f.receipts(), { joined: true, closed: true, outcome: 'fulfilled', finalStates: ['reported', 'reported', 'reported', 'reported'] });
  assert.equal(f.clock.pending, 0);
  assert.equal(f.setupClock.pending, 0);
});

test('Telegram uncertain gap retains its captured ids and stable send key across reopening', async t => {
  const root = await tempProject(t);
  const path = join(root, 'gap.db');
  const clock = new FakeClock(new Date(2026, 9, 16, 13, 20));
  let key = '';
  const first = new Store(path);
  try {
    const store = first.remotes.forMessenger('telegram');
    store.setPairing(pairing);
    store.putOutbox({ id: 'missed', kind: 'general', source: 'one', state: 'missed',
      payload: { telegram: true, params: { chat_id: '101' }, userId: '101' },
      created: clock.now().toISOString(), updated: clock.now().toISOString() });
    await assert.rejects(flushTelegramGap(store, clock, async (_chat, _text, captured) => {
      key = captured; throw new Error('delivery unknown');
    }), /delivery unknown/);
    assert.equal(store.outbox()[0]!.state, 'missed');
  } finally { first.close(); }
  const second = new Store(path);
  try {
    const store = second.remotes.forMessenger('telegram');
    assert.equal(await flushTelegramGap(store, clock, async (chat, text, captured) => {
      assert.equal(captured, key, 'the sender must reconcile the same job, never create another attempt');
      assert.equal(chat, '101');
      assert.equal(text, '1 General messages missed since 13:20');
    }), true);
    assert.equal(store.outbox()[0]!.state, 'reported');
    assert.equal(store.get('telegram.gap'), null);
  } finally { second.close(); }
});


test('Telegram held gap missing setup receipt cancels and joins its writer before closing stores', async t => {
  const f = await heldTelegramGap(t);
  f.missed('pending', 'source');
  const failed = assert.rejects(f.start({ publishReady: false }), /Telegram gap setup receipt deadline reached/);
  assert.equal(f.calls.length, 1, 'the captured producer is active while its setup receipt is suppressed');
  await failed; // start owns deadline progression; the caller advances no clock.
  assert.deepEqual(f.receipts(), { joined: true, closed: true, outcome: 'rejected', finalStates: ['missed'] });
  assert.equal(f.clock.pending, 0);
  assert.equal(f.setupClock.pending, 0);
});

test('Telegram held gap aborted setup cancels and joins its writer before closing stores', async t => {
  const f = await heldTelegramGap(t);
  f.missed('pending', 'source');
  const abort = new AbortController();
  const failed = assert.rejects(f.start({ publishReady: false, signal: abort.signal }), /cancel held gap setup/);
  assert.equal(f.calls.length, 1);
  abort.abort(new Error('cancel held gap setup'));
  await failed;
  assert.deepEqual(f.receipts(), { joined: true, closed: true, outcome: 'rejected', finalStates: ['missed'] });
  assert.equal(f.clock.pending, 0);
  assert.equal(f.setupClock.pending, 0);
});
