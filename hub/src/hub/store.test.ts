import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from './store.ts';
import { HubCore } from './core.ts';
import type { Message } from '../protocol.ts';

const message = (id: string, from: string, to: string[], text: string, ts = '2026-10-08T12:00:00.000Z'): Message => ({ id, from, fromKind: 'agent', via: 'session', to, text, ts });

test('a sessions table written by an older hub gains the status and role columns in place and keeps its rows', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cland-hub-migrate-'));
  const file = join(dir, 'hub.sqlite');
  try {
    // the tables as a first hub might have written them: no status, no role, no from_role, no reply_to
    const old = new DatabaseSync(file);
    old.exec('create table sessions (name text primary key, last_seen integer not null)');
    old.exec('create table messages (id text primary key, from_name text not null, from_kind text not null, via text not null, to_json text not null, text text not null, ts text not null, created_at integer not null)');
    old.prepare('insert into sessions (name, last_seen) values (?, ?)').run('s1', 1_000);
    old.prepare('insert into messages (id, from_name, from_kind, via, to_json, text, ts, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)').run('m0', 's1', 'agent', 'session', '["s2"]', 'old text', 'then', 1_000);
    old.close();

    const store = new Store(file);
    assert.deepEqual(
      store.knownSessions().map((d) => [d.name, d.status, d.role]),
      [['s1', null, null]],
      'the row survived and the new columns read as null',
    );
    assert.deepEqual(store.message('m0'), message('m0', 's1', ['s2'], 'old text', 'then'), 'an old message reads back without the new fields');
    assert.deepEqual(store.topicMessages('general', 10), [], 'an old message belongs to no topic');
    store.rememberStatus('s1', '#27 backend: implement');
    store.rememberRole('s1', 'reviewer');
    store.rememberSessionId('s1', 'sess-1');
    assert.equal(store.statusOf('s1', 0, 'sess-1'), '#27 backend: implement');
    assert.equal(store.statusOf('s1', 0, 'sess-other'), null, "another session's line is not this one's");
    assert.equal(store.statusOf('s1', 2_000, 'sess-1'), null, 'a row older than the window answers null');
    assert.equal(store.statusOf('nobody', 0, 'sess-1'), null);
    assert.deepEqual(store.sessionsWithRole('reviewer'), ['s1']);
    store.rememberSession('s1', 3_000);
    assert.equal(store.statusOf('s1', 2_000, 'sess-1'), '#27 backend: implement', 'a fresh hello keeps the line');
    store.close();

    // opening the file again is idempotent: the columns exist, nothing is altered twice
    const again = new Store(file);
    assert.equal(again.statusOf('s1', 0, 'sess-1'), '#27 backend: implement');
    again.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('store-and-forward: a queued delivery is handed over in order until it is acked, and one past the TTL is dropped', () => {
  const store = new Store();
  store.record(message('a', 'alpha', ['beta'], 'first'), [{ session: 'beta', state: 'queued' }], 1_000);
  store.record(message('b', 'alpha', ['beta'], 'second'), [{ session: 'beta', state: 'queued' }], 5_000);
  store.record(message('c', 'alpha', ['gamma'], 'not for beta'), [{ session: 'gamma', state: 'delivered' }], 5_000);
  const taken = store.pendingFor('beta', 6_000, 4_500);
  assert.deepEqual(taken.dropped.map((m) => m.text), ['first'], 'queued 5 s ago, the TTL is 4.5 s');
  assert.deepEqual(taken.deliver.map((m) => m.text), ['second']);
  assert.deepEqual(store.pendingFor('beta', 6_000, 4_500).deliver.map((m) => m.text), ['second'], 'unacked, it is handed over again');
  assert.equal(store.markDelivered('b', 'beta', 6_100), true);
  assert.equal(store.markDelivered('b', 'beta', 6_200), false, 'a repeat ack changes nothing');
  assert.deepEqual(store.pendingFor('beta', 6_000, 4_500), { deliver: [], dropped: [] }, 'nothing is handed over after the ack');
  store.close();
});

test('prune deletes messages older than the retention window with their deliveries', () => {
  const store = new Store();
  store.record(message('old', 'alpha', ['beta'], 'old news'), [{ session: 'beta', state: 'queued' }], 1_000);
  store.record(message('new', 'alpha', ['beta'], 'fresh'), [{ session: 'beta', state: 'queued' }], 9_000);
  assert.equal(store.prune(10_000, 5_000).gone, 1);
  assert.deepEqual(store.pendingFor('beta', 10_000, 60_000).deliver.map((m) => m.text), ['fresh'], 'the pruned message took its queued delivery with it');
  store.close();
});

test('an ordinary topic can be renamed and deleted with its messages; a standing one cannot', () => {
  const core = new HubCore({ now: () => new Date('2026-10-08T12:00:00.000Z') });
  core.store.ensureTopic('t-1', 'Login page', false, '2026-10-08T12:00:00.000Z');
  core.sendFromHuman('t-1', 'how is it going?');
  assert.deepEqual(core.topics().map((t) => t.id), ['general', 'agents', 't-1']);
  assert.equal(core.renameTopic('t-1', '  Login  ').title, 'Login');
  assert.throws(() => core.renameTopic('t-1', ' '), /a topic needs a title/);
  assert.equal(core.topicHistory('t-1').messages.length, 1);
  core.deleteTopic('t-1');
  assert.deepEqual(core.topics().map((t) => t.id), ['general', 'agents']);
  assert.equal(core.store.topicMessages('t-1', 10).length, 0, 'its messages went with it');
  assert.throws(() => core.renameTopic('general', 'x'), /General is a standing topic: it cannot be renamed/);
  assert.throws(() => core.deleteTopic('agents'), /Agents is a standing topic: it cannot be deleted/);
  core.close(); core.store.close();
});

test("a human message held for a vacant role goes to the session that takes the role, and its stage follows the ack", () => {
  const core = new HubCore();
  const { message } = core.sendFromHuman('general', 'anyone?');
  assert.deepEqual(message.to, ['coordinator']);
  assert.equal(message.stage, 'queued');
  const got: string[] = [];
  const r = core.hello({ type: 'hello', protocol: 2, sessionId: 's-c', cwd: '/', name: 'coord', role: 'coordinator' }, (m) => {
    got.push(m.text);
    return true;
  });
  assert.ok(r.ok);
  core.flushQueued('coord');
  assert.deepEqual(got, ['anyone?']);
  const events: unknown[] = [];
  core.subscribe((e) => events.push(e));
  core.ack(r.connection, message.id);
  assert.deepEqual(events, [{ type: 'delivery', topic: 'general', message: message.id, stage: 'delivered' }]);
  assert.equal(core.topicHistory('general').messages[0]?.stage, 'delivered');
  core.close(); core.store.close();
});

for (const state of ['delivered', 'uncertain', 'injected'] as const) {
  test(`rename refuses a target with ${state} deliveries without changing either digest`, () => {
    const core = new HubCore();
    const hello = (name: string, got: Message[]) => {
      const result = core.hello({ type: 'hello', protocol: 2, sessionId: name, name, role: 'coordinator', cwd: '/' }, m => { got.push(m); return true; });
      assert.ok(result.ok);
      return result.connection;
    };
    const aGot: Message[] = [], bGot: Message[] = [];
    const a = hello('a', aGot), b = hello('b', bGot);
    const p = core.sendFromSession('a', ['a', 'b'], 'P', undefined, undefined, undefined, undefined, undefined, 'progress').message;
    const r1 = core.sendFromSession('a', ['a'], 'R1').message;
    const r2 = core.sendFromSession('a', ['b'], 'R2').message;
    core.ack(b, r2.id);
    if (state === 'uncertain') core.markUncertain(r2.id, 'b', 'no admission answer');
    if (state === 'injected') core.markInjected(r2.id, 'b');
    core.disconnect(b);
    const before = core.store.deliveryMessage(r2.id, 'b');
    const refused = core.rename('a', 'b');
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.match(refused.error, /"b".*2 unacknowledged/);
    assert.equal(a.name, 'a');
    assert.deepEqual(core.store.deliveryMessage(r2.id, 'b'), before);
    assert.deepEqual(core.store.deliveryMessage(r1.id, 'a')?.digest?.map(m => m.id), [p.id]);
    core.ack(a, r1.id);
    assert.equal(aGot.filter(m => m.id === r1.id).length, 1);
    assert.equal(bGot.filter(m => m.id === r2.id).length, 1);
    core.close(); core.store.close();
  });
}

for (const state of ['queued', 'delivered', 'uncertain', 'injected', 'dropped'] as const) {
  test(`deleting a trigger releases ${state} notes without replaying settled notes`, () => {
    let now = 1000;
    const journal: Array<Record<string, unknown>> = [];
    const core = new HubCore({ now: () => new Date(now), queueTtlMs: 1000, retentionMs: 100, log: e => { journal.push(e); } });
    core.store.ensureTopic('notes', 'Notes', false, new Date(now).toISOString());
    core.store.ensureTopic('reports', 'Reports', false, new Date(now).toISOString());
    const got: Message[] = [];
    const receiver = core.hello({ type: 'hello', protocol: 2, sessionId: 'receiver', name: 'receiver', role: 'coordinator', cwd: '/' }, m => { got.push(m); return true; });
    assert.ok(receiver.ok);
    const note = core.sendFromSession('sender', ['receiver'], 'surviving note', undefined, 'notes', undefined, { role: 'implementer' }, undefined, 'progress').message;
    now = 1200;
    const trigger = core.sendFromSession('sender', ['receiver'], 'deleted trigger', undefined, 'reports', undefined, { role: 'implementer' }).message;
    if (state === 'delivered' || state === 'uncertain' || state === 'injected') core.ack(receiver.connection, trigger.id);
    if (state === 'uncertain') core.markUncertain(trigger.id, 'receiver', 'no admission answer');
    if (state === 'injected') core.markInjected(trigger.id, 'receiver');
    if (state === 'dropped') core.store.expireQueued('receiver', 2201, 1000);
    now = 1500;
    const pending = state === 'queued' || state === 'delivered' || state === 'uncertain';
    if (pending) {
      core.prune();
      assert.ok(core.store.message(note.id), 'retention preserves pending notes');
      assert.ok(core.store.message(trigger.id), 'retention preserves pending triggers');
    }
    core.deleteTopic('reports');
    assert.equal(core.store.message(trigger.id), null);
    assert.equal(core.store.deliveryRoot(note.id, 'receiver'), note.id, 'no surviving note points at a missing trigger');
    assert.equal(core.store.stage(note.id), pending ? 'queued' : state);
    if (pending) {
      assert.ok(journal.some(e => e.event === 'digest-released' && e.trigger === trigger.id && JSON.stringify(e.notes) === JSON.stringify([note.id])));
      const next = core.sendFromSession('sender', ['receiver'], 'next report', undefined, 'notes', undefined, { role: 'implementer' }).message;
      assert.deepEqual(got.find(m => m.id === next.id)?.digest?.map(m => m.id), [note.id]);
      core.ack(receiver.connection, next.id);
      core.markInjected(next.id, 'receiver');
    } else {
      const next = core.sendFromSession('sender', ['receiver'], 'next report', undefined, 'notes', undefined, { role: 'implementer' }).message;
      assert.equal(got.find(m => m.id === next.id)?.digest, undefined);
    }
    core.close(); core.store.close();
  });
}

test('released progress survives restart and keeps its own original TTL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cland-released-progress-'));
  const file = join(dir, 'hub.sqlite');
  let now = 1000;
  let core = new HubCore({ store: new Store(file), now: () => new Date(now), queueTtlMs: 1000 });
  try {
    core.store.ensureTopic('reports', 'Reports', false, new Date(now).toISOString());
    for (const name of ['fresh', 'expired']) {
      const joined = core.hello({ type: 'hello', protocol: 2, sessionId: name, name, role: 'coordinator', cwd: '/' }, () => true);
      assert.ok(joined.ok);
      core.disconnect(joined.connection);
    }
    const note = core.sendFromSession('sender', ['fresh', 'expired'], 'released P', undefined, undefined, undefined, { role: 'implementer' }, undefined, 'progress').message;
    now = 1900;
    core.sendFromSession('sender', ['fresh', 'expired'], 'deleted R', undefined, 'reports', undefined, { role: 'implementer' });
    now = 1950;
    core.deleteTopic('reports');
    core.close(); core.store.close();
    core = new HubCore({ store: new Store(file), now: () => new Date(now), queueTtlMs: 1000 });
    const fresh = core.sendFromSession('sender', ['fresh'], 'fresh next report', undefined, undefined, undefined, { role: 'implementer' }).message;
    assert.deepEqual(core.store.deliveryMessage(fresh.id, 'fresh')?.digest?.map(m => m.id), [note.id]);
    now = 2001;
    const expired = core.sendFromSession('sender', ['expired'], 'expired next report', undefined, undefined, undefined, { role: 'implementer' }).message;
    assert.equal(core.store.deliveryMessage(expired.id, 'expired')?.digest, undefined, 'releasing never extends queued_at');
  } finally {
    core.close(); core.store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('retention clears a settled binding when another recipient still has a pending digest with the note', () => {
  const store = new Store();
  const note = { ...message('P', 'sender', ['a', 'b'], 'shared note'), kind: 'progress' as const };
  store.record(note, [{ session: 'a', state: 'queued' }, { session: 'b', state: 'queued' }], 1000);
  store.record(message('R', 'sender', ['a'], 'settled trigger'), [{ session: 'a', state: 'queued' }], 1100);
  store.markDelivered('R', 'a', 1200);
  store.markInjected('R', 'a');
  store.record(message('R2', 'sender', ['b'], 'other report'), [{ session: 'b', state: 'queued' }], 1900);
  const removed = store.prune(2000, 100);
  assert.equal(removed.gone, 1);
  assert.deepEqual(removed.released, [{ trigger: 'R', session: 'a', notes: ['P'], reheld: [] }]);
  assert.equal(store.deliveryRoot('P', 'a'), 'P');
  assert.deepEqual(store.pendingFor('a', 2000, 10000).deliver, [], 'settled notes never replay');
  assert.deepEqual(store.deliveryMessage('R2', 'b')?.digest?.map(m => m.id), ['P']);
  store.close();
});

test("retention prunes a broadcast recipient's settled notes while another recipient's digest is pending", () => {
  const store = new Store();
  try {
    store.record({ ...message('Pa', 'sender', ['a'], 'settled note'), kind: 'progress' }, [{ session: 'a', state: 'queued' }], 1000);
    store.record({ ...message('Pb', 'sender', ['b'], 'pending note'), kind: 'progress' }, [{ session: 'b', state: 'queued' }], 1000);
    store.record(message('R', 'sender', ['a', 'b'], 'broadcast report'), [{ session: 'a', state: 'queued' }, { session: 'b', state: 'queued' }], 1100);
    store.markDelivered('R', 'a', 1200);
    store.markInjected('R', 'a');

    assert.deepEqual(store.prune(2000, 100), { gone: 1, released: [] });
    assert.equal(store.message('Pa'), null, 'the settled recipient no longer needs its distinct note');
    assert.ok(store.message('Pb'), 'the pending recipient keeps its note');
    assert.ok(store.message('R'), 'the pending recipient keeps the shared trigger');
    assert.deepEqual(store.deliveryMessage('R', 'b')?.digest?.map(m => m.id), ['Pb']);
    assert.deepEqual(store.pendingFor('a', 2000, 10000).deliver, [], 'settled notes never replay');

    store.markDelivered('R', 'b', 2100);
    store.markInjected('R', 'b');
    assert.deepEqual(store.prune(2200, 100), { gone: 2, released: [] }, 'the remaining messages prune once both recipients settle');
  } finally {
    store.close();
  }
});

test('rename refuses a dropped duplicate and preserves the source pending digest', () => {
  let now = 1000;
  const core = new HubCore({ now: () => new Date(now), queueTtlMs: 1000 });
  const got: Message[] = [];
  const hello = (name: string) => {
    const result = core.hello({ type: 'hello', protocol: 2, sessionId: name, name, role: 'coordinator', cwd: '/' }, m => { got.push(m); return true; });
    assert.ok(result.ok);
    return result.connection;
  };
  const a = hello('a'), b = hello('b');
  const note = core.sendFromSession('a', ['a', 'b'], 'P', undefined, undefined, undefined, undefined, undefined, 'progress').message;
  now = 1100;
  const r2 = core.sendFromSession('a', ['b'], 'R2').message;
  now = 1900;
  const r1 = core.sendFromSession('a', ['a'], 'R1').message;
  now = 2201;
  core.store.expireQueued('b', now, 1000);
  core.disconnect(b);
  const source = core.store.deliveryMessage(r1.id, 'a');
  const target = core.store.deliveryMessage(r2.id, 'b');
  const refusal = core.rename('a', 'b');
  assert.equal(refusal.ok, false);
  if (!refusal.ok) assert.match(refusal.error, /"b".*1.*collid/);
  assert.equal(a.name, 'a');
  assert.deepEqual(core.store.deliveryMessage(r1.id, 'a'), source);
  assert.deepEqual(core.store.deliveryMessage(r2.id, 'b'), target);
  assert.deepEqual(source?.digest?.map(m => m.id), [note.id]);
  core.ack(a, r1.id);
  assert.equal(got.filter(m => m.id === r1.id).length, 1);
  core.close(); core.store.close();
});
