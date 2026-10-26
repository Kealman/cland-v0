// T1: two SQLite handles, fake native process facts and hub time.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { PollerLease } from '../src/remote/poller-lease.ts';
import { FakeClock } from './fake-clock.ts';
import { fakePollerProcesses } from './fakes/poller-processes.ts';
import { tempProject } from './harness.ts';
import { heldRemoteBoundary } from './fakes/held-remote-boundary.ts';

test('a second poller waits on the same hub.db and acquires only after the owner releases', async t => {
  const root = await tempProject(t);
  const first = new Store(join(root, 'hub.db'));
  const second = new Store(join(root, 'hub.db'));
  const clock = new FakeClock();
  const fake = fakePollerProcesses();
  fake.rows.set(101, { alive: true, started: 'fixture-start', identity: 'fixture-birth-1' });
  fake.rows.set(102, { alive: true, started: 'fixture-start', identity: 'fixture-birth-2' });
  const owner = new PollerLease(first.remotes, { clock, pid: 101, processes: fake.processes });
  const contender = new PollerLease(second.remotes, { clock, pid: 102, processes: fake.processes });
  const abort = new AbortController();
  let waiting: Promise<void> | undefined;
  try {
    await owner.acquire(new AbortController().signal);
    const held = first.remotes.pollerLease();
    assert.equal(held?.pid, 101);
    assert.equal(held?.started, 'fixture-start');
    assert.equal(held?.identity, 'fixture-birth-1');
    let acquired = false;
    waiting = contender.acquire(abort.signal).then(() => { acquired = true; });
    await clock.advance(59_000);
    assert.equal(acquired, false);
    assert.deepEqual(second.remotes.pollerLease(), held, 'waiting preserves the exact live owner');
    owner.release();
    await clock.advance(1000);
    await waiting;
    assert.equal(acquired, true);
    assert.equal(second.remotes.pollerLease()?.pid, 102);
    assert.notEqual(second.remotes.pollerLease()?.owner, held?.owner);
    owner.release();
    assert.equal(second.remotes.pollerLease()?.pid, 102, 'an old release cannot delete the successor');
  } finally {
    abort.abort();
    await waiting?.catch(() => {});
    contender.release(); owner.release();
    second.close(); first.close();
  }
});

test('a live or unreadable holder is preserved and the contender reports the exact 60 second deadline', { timeout: 2000 }, async t => {
  const store = new Store();
  const clock = new FakeClock();
  const fake = fakePollerProcesses();
  fake.rows.set(101, { alive: true, started: 'one-second', identity: 'native-first' });
  fake.rows.set(102, { alive: true, started: 'one-second', identity: 'native-second' });
  const owner = new PollerLease(store.remotes, { clock, pid: 101, processes: fake.processes });
  const contender = new PollerLease(store.remotes, { clock, pid: 102, processes: fake.processes });
  const abort = new AbortController();
  let result: Promise<unknown> | undefined;
  try {
    await owner.acquire(abort.signal);
    const held = store.remotes.pollerLease();
    fake.rows.set(101, { alive: true, started: 'changed-ps-stamp', identity: null });
    result = contender.acquire(abort.signal).then(() => 'acquired', error => error);
    await clock.advance(59_999);
    assert.deepEqual(store.remotes.pollerLease(), held);
    await clock.advance(1);
    assert.match(String(await result), /held for 60 seconds; another consumer of the token/);
    assert.deepEqual(store.remotes.pollerLease(), held, 'the terminal refusal leaves the live owner intact');
    assert.equal(clock.pending, 0);
  } finally { abort.abort(); await result; contender.release(); owner.release(); store.close(); }
});

for (const receipt of ['dead', 'reused-within-the-same-ps-second'] as const) {
  test(`a contender takes a lease whose process is ${receipt}`, { timeout: 2000 }, async () => {
    const store = new Store();
    const clock = new FakeClock();
    const fake = fakePollerProcesses();
    fake.rows.set(101, { alive: true, started: 'same-second', identity: 'native-old' });
    fake.rows.set(102, { alive: true, started: 'same-second', identity: 'native-contender' });
    const owner = new PollerLease(store.remotes, { clock, pid: 101, processes: fake.processes });
    const contender = new PollerLease(store.remotes, { clock, pid: 102, processes: fake.processes });
    try {
      await owner.acquire(new AbortController().signal);
      fake.rows.set(101, receipt === 'dead' ? { alive: false, started: null, identity: null } : { alive: true, started: 'same-second', identity: 'native-reused' });
      await contender.acquire(new AbortController().signal);
      const acquired = store.remotes.pollerLease();
      assert.equal(acquired?.pid, 102);
      assert.equal(acquired?.identity, 'native-contender');
      owner.release();
      assert.deepEqual(store.remotes.pollerLease(), acquired);
    } finally { contender.release(); owner.release(); store.close(); }
  });
}

test('cancelling lease startup drains its wait and preserves the current owner', { timeout: 2000 }, async () => {
  const store = new Store();
  const clock = new FakeClock();
  const fake = fakePollerProcesses();
  fake.rows.set(101, { alive: true, started: 'fixture', identity: 'native-first' });
  fake.rows.set(102, { alive: true, started: 'fixture', identity: 'native-second' });
  const owner = new PollerLease(store.remotes, { clock, pid: 101, processes: fake.processes });
  const contender = new PollerLease(store.remotes, { clock, pid: 102, processes: fake.processes });
  const abort = new AbortController();
  let waiting: Promise<unknown> | undefined;
  try {
    await owner.acquire(new AbortController().signal);
    const held = store.remotes.pollerLease();
    waiting = contender.acquire(abort.signal).then(() => 'acquired', error => error);
    await clock.advance(1000);
    abort.abort();
    assert.match(String(await waiting), /gateway stopped while waiting/);
    assert.deepEqual(store.remotes.pollerLease(), held);
    assert.equal(clock.pending, 0);
  } finally { abort.abort(); await waiting; contender.release(); owner.release(); store.close(); }
});

test('a poller lease survives reopening hub.db and an unreadable own birth cannot claim it', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'hub.db');
  const fake = fakePollerProcesses();
  fake.rows.set(101, { alive: true, started: 'fixture-start', identity: 'fixture-native-birth' });
  const first = new Store(path);
  let held;
  try {
    await new PollerLease(first.remotes, { pid: 101, processes: fake.processes }).acquire(new AbortController().signal);
    held = first.remotes.pollerLease();
  } finally { first.close(); }
  const reopened = new Store(path);
  try {
    assert.deepEqual(reopened.remotes.pollerLease(), held);
    fake.rows.set(102, { alive: true, started: 'fixture-start', identity: null });
    const unknown = new PollerLease(reopened.remotes, { pid: 102, processes: fake.processes });
    await assert.rejects(unknown.acquire(new AbortController().signal), /cannot verify gateway poller process identity/);
    assert.deepEqual(reopened.remotes.pollerLease(), held);
  } finally { reopened.close(); }
});

function heldProbe(t: import('node:test').TestContext, receipt = true) {
  const hold = heldRemoteBoundary(t, receipt);
  const store = new Store();
  const fake = fakePollerProcesses();
  for (const pid of [101, 102, 103]) fake.rows.set(pid, { alive: true, started: 'fixture', identity: `fixture-birth-${pid}` });
  const owner = new PollerLease(store.remotes, { clock: hold.clock, pid: 101, processes: fake.processes });
  const successor = new PollerLease(store.remotes, { clock: hold.clock, pid: 103, processes: fake.processes });
  const contender = new PollerLease(store.remotes, { clock: hold.clock, pid: 102, processes: { inspect: async pid => {
    if (pid === 101) { await hold.hold(); return { alive: false, started: null, identity: null }; }
    return fake.processes.inspect(pid);
  } } });
  const abort = new AbortController();
  // Cancel before joining a native inspection that ignores the lease's abort.
  // The boundary disposer releases that inspection before draining its writer.
  hold.setupAbort.signal.addEventListener('abort', () => abort.abort(), { once: true });
  hold.close(() => { contender.release(); successor.release(); owner.release(); store.close(); });
  return { hold, store, owner, successor, abort,
    begin: () => hold.own(contender.acquire(abort.signal).then(() => 'acquired', error => error)),
  };
}

test('a late death observation cannot overwrite a new owner that acquired during the native probe', { timeout: 2000 }, async t => {
  const f = heldProbe(t);
  try {
    await f.hold.own(f.owner.acquire(new AbortController().signal));
    const setup = f.hold.setup(); // arm before triggering inspection
    const waiting = f.begin();
    await setup;
    f.owner.release();
    await f.hold.own(f.successor.acquire(new AbortController().signal));
    const held = f.store.remotes.pollerLease();
    f.hold.resume();
    await f.hold.clock.advance(1000);
    assert.deepEqual(f.store.remotes.pollerLease(), held);
    f.abort.abort();
    assert.match(String(await waiting), /gateway stopped while waiting/);
    assert.equal(f.store.remotes.pollerLease()?.pid, 103);
  } finally { await f.hold.dispose(); }
});

for (const failure of ['missing receipt', 'aborted setup'] as const) {
  test(`held native probe disposal drains the writer after ${failure}`, { timeout: 2000 }, async t => {
    const f = heldProbe(t, false);
    await f.hold.own(f.owner.acquire(new AbortController().signal));
    const setup = f.hold.setup();
    const failed = assert.rejects(setup, failure === 'missing receipt' ? /setup receipt deadline reached/ : /setup cancelled/);
    const actual = f.hold.actual();
    const waiting = f.begin();
    await actual;
    if (failure === 'missing receipt') await f.hold.clock.advance(1000);
    else f.hold.setupAbort.abort(new Error('remote fixture setup cancelled'));
    await failed;
    await f.hold.dispose(); // same unconditional resource hook
    assert.match(String(await waiting), /gateway stopped while waiting/);
    assert.equal(f.hold.clock.pending, 0);
    assert.throws(() => f.store.remotes.pollerLease(), /not open|closed/i, 'disposal joined the probe and closed SQLite');
  });
}
