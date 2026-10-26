// T1: durable outbox and fake messenger, no sockets, processes or real time.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { Outbox } from '../src/remote/outbox.ts';
import { tempProject } from './harness.ts';
import { heldRemoteBoundary } from './fakes/held-remote-boundary.ts';
import { FakeClock } from './fake-clock.ts';
import { outboxMessenger } from './fakes/outbox-messenger.ts';

test('an attempt is durable before each send and the platform message map precedes completion', async t => {
  const root = await tempProject(t);
  const path = join(root, 'hub.db');
  const db = new Store(path);
  const observer = new Store(path);
  try {
    const remote = db.remotes.forMessenger('discord');
    const view = observer.remotes.forMessenger('discord');
    const messenger = outboxMessenger();
    const outbox = new Outbox(remote, messenger, { clock: new FakeClock() });
    const id = outbox.enqueue({ kind: 'card', source: 'ask-1', payload: { text: 'Choose' } });
    messenger.beforeSend = (job, attempt) => {
      assert.equal(view.outbox().find(row => row.id === id)?.state, 'sending');
      assert.deepEqual(view.attempts(job.id), [attempt]);
      assert.equal(attempt.outcome, null);
    };
    await outbox.drain();
    assert.equal(view.outbox()[0]?.state, 'sent');
    assert.equal(view.attempts(id)[0]?.outcome, 'sent');
    assert.equal(view.message('fixture-chat', '9007199254740993')?.ask, 'ask-1');
    await outbox.drain();
    assert.equal(messenger.delivered.length, 1);
  } finally { observer.close(); db.close(); }
});

test('unknown delivery stays fenced across restart even when sending works again', async t => {
  const root = await tempProject(t);
  const path = join(root, 'hub.db');
  const messenger = outboxMessenger();
  messenger.loseReceipt();
  const clock = new FakeClock();
  const first = new Store(path);
  let id: string;
  try {
    const remote = first.remotes.forMessenger('telegram');
    const outbox = new Outbox(remote, messenger, { clock });
    id = outbox.enqueue({ kind: 'card', source: 'ask-1', payload: { text: 'Choose' } });
    await outbox.drain();
    assert.equal(remote.outbox()[0]?.state, 'uncertain');
    assert.equal(remote.attempts(id)[0]?.outcome, 'unknown');
    assert.equal(messenger.delivered.length, 1, 'the platform accepted it but lost the receipt');
  } finally { first.close(); }
  const second = new Store(path);
  try {
    messenger.recover();
    const remote = second.remotes.forMessenger('telegram');
    const outbox = new Outbox(remote, messenger, { clock });
    outbox.setAvailable(true);
    await outbox.drain();
    await outbox.drain();
    assert.equal(messenger.calls.length, 1, 'a healthy connection is not proof of non-delivery');
    assert.equal(remote.attempts(id!).length, 1);
    assert.equal(messenger.delivered.length, 1);
    assert.equal(remote.outbox()[0]?.state, 'uncertain');
  } finally { second.close(); }
});

for (const proof of ['never-left', 'unknown', 'sent'] as const) {
  test(`a pre-existing unfinished attempt is reconciled as ${proof} before any resend`, async t => {
    const root = await tempProject(t);
    const db = new Store(join(root, 'hub.db'));
    try {
      const remote = db.remotes.forMessenger('discord');
      const clock = new FakeClock();
      const messenger = outboxMessenger();
      const outbox = new Outbox(remote, messenger, { clock });
      const id = outbox.enqueue({ kind: 'card', source: 'ask-1', payload: { text: 'Choose' } });
      // The hub stopped after the durable pre-send fence; its acknowledgement is absent.
      const job = remote.outbox()[0]!;
      remote.writeOutbox({ ...job, state: 'sending' }, { id: 'interrupted', job: id, at: job.created, outcome: null });
      let inspected = 0;
      messenger.prove = async (candidate, attempt) => {
        inspected++;
        assert.equal(candidate.id, id);
        assert.equal(attempt.id, 'interrupted');
        return proof === 'sent'
          ? { status: 'sent', message: { chatId: 'fixture-chat', messageId: '9007199254740999', topic: 'general', message: null, ask: 'ask-1', approval: null } }
          : { status: proof };
      };
      await outbox.drain();
      assert.equal(inspected, 1);
      assert.equal(messenger.calls.length, proof === 'never-left' ? 1 : 0);
      assert.equal(remote.outbox()[0]?.state, proof === 'unknown' ? 'uncertain' : 'sent');
      assert.equal(remote.attempts(id).find(row => row.id === 'interrupted')?.outcome, proof);
      if (proof === 'sent') assert.equal(remote.message('fixture-chat', '9007199254740999')?.ask, 'ask-1');
    } finally { db.close(); }
  });
}

test('two queued edits of one target leave as one latest edit, without merging other targets or attempted edits', async t => {
  const root = await tempProject(t);
  const db = new Store(join(root, 'hub.db'));
  try {
    const messenger = outboxMessenger();
    const remote = db.remotes.forMessenger('telegram');
    const outbox = new Outbox(remote, messenger, { clock: new FakeClock() });
    const first = outbox.enqueue({ kind: 'edit', source: 'ask-1', target: 'chat:123', payload: { text: 'old' } });
    const merged = outbox.enqueue({ kind: 'edit', source: 'ask-1', target: 'chat:123', payload: { text: 'latest' } });
    outbox.enqueue({ kind: 'edit', source: 'ask-2', target: 'chat:456', payload: { text: 'other' } });
    assert.equal(first, merged);
    await outbox.drain();
    assert.deepEqual(messenger.delivered.map(job => job.payload), [{ text: 'latest' }, { text: 'other' }]);
    const next = outbox.enqueue({ kind: 'edit', source: 'ask-1', target: 'chat:123', payload: { text: 'uncertain' } });
    messenger.refuse('unknown');
    await outbox.drain();
    const last = outbox.enqueue({ kind: 'edit', source: 'ask-1', target: 'chat:123', payload: { text: 'new outcome' } });
    assert.notEqual(last, next, 'an attempt binds an immutable payload');
    assert.deepEqual(remote.outbox().find(job => job.id === next)?.payload, { text: 'uncertain' });
  } finally { db.close(); }
});

async function heldOutbox(t: import('node:test').TestContext, receipt = true) {
  const hold = heldRemoteBoundary(t, receipt);
  let db: Store | undefined;
  let outbox: Outbox | undefined;
  // Register unconditional ownership before any producer or database acquisition.
  hold.close(async () => {
    try { await outbox?.stop(); }
    finally { db?.close(); }
  });
  const root = await tempProject(t);
  db = new Store(join(root, 'hub.db'));
  const messenger = outboxMessenger();
  outbox = new Outbox(db.remotes.forMessenger('telegram'), messenger, { clock: hold.clock });
  messenger.beforeSend = () => hold.hold();
  return { hold, db, outbox, messenger };
}

test('concurrent drains share the send owner and shutdown fences new work before joining delivery', { timeout: 5000 }, async t => {
  const { hold, outbox, messenger } = await heldOutbox(t);
  try {
    outbox.enqueue({ kind: 'card', source: null, payload: { text: 'owned send' } });
    const setup = hold.setup();
    const draining = hold.own(outbox.drain());
    assert.equal(outbox.drain(), draining, 'one active drain owns every delivery');
    await hold.clock.advance(0);
    await setup;
    let stopped = false;
    const stopping = hold.own(outbox.stop().then(() => { stopped = true; }));
    assert.throws(() => outbox.enqueue({ kind: 'card', source: null, payload: {} }), /stopped/);
    assert.equal(stopped, false);
    hold.resume();
    await stopping;
    await draining;
    assert.equal(messenger.calls.length, 1);
    assert.equal(messenger.delivered.length, 1);
    await assert.rejects(outbox.drain(), /stopped/);
  } finally { await hold.dispose(); }
});

for (const failure of ['missing receipt', 'aborted setup'] as const) {
  test(`held outbox disposal drains delivery and closes SQLite after ${failure}`, { timeout: 5000 }, async t => {
    const { hold, db, outbox, messenger } = await heldOutbox(t, false);
    outbox.enqueue({ kind: 'card', source: null, payload: { text: 'owned send' } });
    const setup = hold.setup();
    const failed = assert.rejects(setup, failure === 'missing receipt' ? /setup receipt deadline reached/ : /setup cancelled/);
    const actual = hold.actual();
    const draining = hold.own(outbox.drain());
    assert.equal(outbox.drain(), draining, 'the control retains single-owner proof');
    await hold.clock.advance(0);
    await actual;
    if (failure === 'missing receipt') await hold.clock.advance(1000);
    else hold.setupAbort.abort(new Error('remote fixture setup cancelled'));
    await failed;
    // Exercise the same registered disposer, with no lexical release/close path.
    await hold.dispose();
    await draining;
    assert.equal(messenger.calls.length, 1);
    assert.equal(messenger.delivered.length, 1, 'the real delivery drains before SQLite closes');
    assert.throws(() => outbox.enqueue({ kind: 'card', source: null, payload: {} }), /stopped/);
    await assert.rejects(outbox.drain(), /stopped/);
    assert.throws(() => db.remotes.forMessenger('telegram').outbox(), /not open|closed/i);
    assert.equal(hold.clock.pending, 0);
  });
}


test('pre-entry shutdown disposes omitted setup and actual-entry observers without starting a client send', { timeout: 5000 }, async t => {
  const { hold, db, outbox, messenger } = await heldOutbox(t, false);
  outbox.enqueue({ kind: 'card', source: null, payload: { text: 'fenced before entry' } });
  const setup = hold.setup();
  const actual = hold.actual();
  const failures = Promise.all([
    assert.rejects(setup, /setup receipt deadline reached/),
    assert.rejects(actual, /setup receipt deadline reached/),
  ]);
  const draining = hold.own(outbox.drain());
  assert.equal(outbox.drain(), draining);
  // Stop before the drain microtask: neither setup nor actual-entry can arrive.
  const stopping = hold.own(outbox.stop());
  await hold.clock.advance(1000);
  await failures;
  await hold.dispose();
  await stopping;
  await draining;
  assert.equal(messenger.calls.length, 0);
  assert.equal(messenger.delivered.length, 0);
  assert.throws(() => outbox.enqueue({ kind: 'card', source: null, payload: {} }), /stopped/);
  await assert.rejects(outbox.drain(), /stopped/);
  assert.throws(() => db.remotes.forMessenger('telegram').outbox(), /not open|closed/i);
  assert.equal(hold.clock.pending, 0);
});

for (const synchronous of [true, false]) test(`a ${synchronous ? 'thrown' : 'rejected'} platform failure is unknown, never proof or a persisted native error`, async t => {
  const root = await tempProject(t);
  const db = new Store(join(root, 'hub.db'));
  try {
    const remote = db.remotes.forMessenger('telegram');
    const messenger = outboxMessenger();
    let calls = 0;
    messenger.send = () => {
      calls++;
      const error = new Error('fixture-private-platform-diagnostic');
      if (synchronous) throw error;
      return Promise.reject(error);
    };
    const outbox = new Outbox(remote, messenger, { clock: new FakeClock() });
    const id = outbox.enqueue({ kind: 'card', source: null, payload: { text: 'Choice' } });
    await outbox.drain();
    outbox.setAvailable(true);
    await outbox.drain();
    assert.equal(calls, 1);
    assert.equal(remote.attempts(id)[0]?.outcome, 'unknown');
    assert.equal(remote.outbox()[0]?.state, 'uncertain');
    assert.equal(JSON.stringify([remote.outbox(), remote.attempts(id)]).includes('fixture-private-platform-diagnostic'), false);
  } finally { db.close(); }
});

test('a source that closes during delivery reconciliation is dropped before resending', async t => {
  const root = await tempProject(t);
  const db = new Store(join(root, 'hub.db'));
  try {
    const remote = db.remotes.forMessenger('telegram');
    const messenger = outboxMessenger();
    let open = true;
    const outbox = new Outbox(remote, messenger, { clock: new FakeClock(), sourceOpen: () => open });
    const id = outbox.enqueue({ kind: 'card', source: 'ask-1', payload: { text: 'Choice' } });
    const job = remote.outbox()[0]!;
    remote.writeOutbox({ ...job, state: 'sending' }, { id: 'old', job: id, at: job.created, outcome: null });
    messenger.prove = async () => { open = false; return { status: 'never-left' }; };
    await outbox.drain();
    assert.equal(messenger.calls.length, 0);
    assert.equal(remote.outbox()[0]?.state, 'dropped');
    assert.equal(remote.attempts(id).length, 1);
  } finally { db.close(); }
});
