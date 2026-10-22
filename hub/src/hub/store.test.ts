// T1: store persistence and hub rules in-process, with one complete clock for scheduling.
import { FakeClock } from '../../test/fake-clock.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from './store.ts';
import { HubCore } from './core.ts';
import { isClientRequest, type AskOutcome, type Message, type TopicHistoryFilter, type TopicMessage } from '../protocol.ts';

const message = (id: string, from: string, to: string[], text: string, ts = '2026-10-08T12:00:00.000Z'): Message => ({ id, from, fromKind: 'agent', via: 'session', to, text, ts });

test('ask outcomes and inbox departures preserve option and free-text decisions across Store reopen', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cland-ask-outcomes-'));
  const file = join(dir, 'hub.db');
  const at = '2026-10-22T09:00:00.000Z';
  const outcomes: AskOutcome[] = [
    { status: 'answered', text: 'allocated', option: 2, by: 'human', at },
    { status: 'answered', text: 'Wait for QA.\nThen ship.', by: 'stand-in', at },
  ];
  let store = new Store(file);
  try {
    store.createTopic('general', 'General', null, at);
    for (const [i, outcome] of outcomes.entries()) {
      const id = `ask-${i}`, question = `Decision ${i}`;
      store.record({ ...message(id, 'coord', [], question, at), topic: 'general' }, [], Date.parse(at));
      store.createAsk({ id, topic: 'general', from: 'coord', question, options: ['fixed', 'allocated'], free: true, ts: at });
      const wait = { kind: 'ask' as const, id, subject: 'general', since: at, text: question };
      store.waitInInbox(wait);
      assert.equal(store.closeAsk(id, 'answered', at, { id: `reply-${i}`, outcome }), true);
      store.departInbox(wait, 'answered', at, question, outcome);
    }
    store.close();
    store = new Store(file);
    for (const [i, outcome] of outcomes.entries()) {
      assert.deepEqual(store.ask(`ask-${i}`)?.outcome, outcome);
      assert.deepEqual(store.topicMessages('general', 10).find(m => m.id === `ask-${i}`)?.ask?.outcome, outcome);
      const departure = store.inboxDepartures(at).find(d => d.id === `ask-${i}`);
      assert.equal(departure?.reason, 'answered');
      assert.deepEqual(departure?.outcome, outcome);
      assert.equal(store.message(`reply-${i}`), null, 'outcomes do not require a retained reply message');
    }
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('store reuses prepared SQL with fresh bindings and keeps connections and rollback isolated', () => {
  const counts: Map<string, number>[] = [];
  const open = (path: string) => {
    const db = new DatabaseSync(path), prepare = db.prepare;
    const prepared = new Map<string, number>();
    counts.push(prepared);
    db.prepare = function(sql) {
      prepared.set(sql, (prepared.get(sql) ?? 0) + 1);
      return prepare.call(this, sql);
    };
    return db;
  };
  const first = new Store(':memory:', open), second = new Store(':memory:', open);
  try {
    first.rememberSession('alpha', 1000);
    first.rememberSession('beta', 1000);
    first.rememberRole('alpha', 'reviewer');
    first.rememberRole('beta', 'implementer');
    for (let i = 0; i < 3; i++) {
      assert.equal(first.roleOf('alpha'), 'reviewer');
      assert.equal(first.roleOf('beta'), 'implementer');
      assert.equal(first.roleOf('missing'), null);
      assert.equal(second.roleOf('alpha'), null);
    }
    assert.throws(() => first.transaction(() => {
      first.rememberRole('alpha', 'qa');
      throw new Error('rollback');
    }), /rollback/);
    assert.equal(first.roleOf('alpha'), 'reviewer');
    first.rememberRole('alpha', 'coordinator');
    assert.equal(first.roleOf('alpha'), 'coordinator');
    for (const prepared of counts) assert.equal(prepared.get('select role from sessions where name = ?'), 1);
  } finally { first.close(); second.close(); }
});

test('a Coordinator vacancy posts one decision in General after ten minutes and resets when filled', async () => {
  const clock = new FakeClock();
  const core = new HubCore({ clock });
  try {
    const joined = core.hello({ type: 'hello', protocol: 2, sessionId: 'vacancy-coord', name: 'coord', cwd: '/', role: 'coordinator' }, () => true);
    assert.ok(joined.ok);
    core.disconnect(joined.connection);
    const decisions = () => core.topicHistory('general').messages.filter(m => m.kind === 'decision');
    await clock.advance(599_999);
    assert.equal(decisions().length, 0);
    await clock.advance(1);
    assert.equal(decisions().length, 1);
    assert.match(decisions()[0]!.text, /last holder.*coord/);
    assert.ok(decisions()[0]!.text.includes('cland session resume coord --relaunch'));
    assert.ok(decisions()[0]!.text.includes('cland role set coord coordinator'));
    await clock.advance(20 * 60_000);
    assert.equal(decisions().length, 1, 'no repeated alarm during one vacancy');
    const back = core.hello({ type: 'hello', protocol: 2, sessionId: 'vacancy-coord', name: 'coord', cwd: '/', role: 'coordinator' }, () => true);
    assert.ok(back.ok);
    core.disconnect(back.connection);
    await clock.advance(599_999);
    const rescued = core.hello({ type: 'hello', protocol: 2, sessionId: 'vacancy-coord', name: 'coord', cwd: '/', role: 'coordinator' }, () => true);
    assert.ok(rescued.ok);
    await clock.advance(600_000);
    assert.equal(decisions().length, 1, 'a filled role cancels the pending alarm');
    core.disconnect(rescued.connection);
    await clock.advance(600_000);
    assert.equal(decisions().length, 2, 'a later vacancy gets its own notice');
  } finally { core.close(); core.store.close(); }
});

test('a reopened core recovers an absent Coordinator vacancy and keeps its one-notice receipt across store reopen', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cland-vacancy-'));
  const file = join(root, 'hub.sqlite');
  const clock = new FakeClock();
  let core = new HubCore({ clock, store: new Store(file) });
  const reopen = () => { core.close(); core.store.close(); core = new HubCore({ clock, store: new Store(file) }); };
  const decisions = () => core.topicHistory('general').messages.filter(m => m.kind === 'decision');
  try {
    const joined = core.hello({ type: 'hello', protocol: 2, sessionId: 'restart-coord', name: 'coord', cwd: '/', role: 'coordinator' }, () => true);
    assert.ok(joined.ok);
    // The previous hub had a live holder. Its successor starts without that peer.
    core.store.clearMeta('coordinator-last-holder'); // Pre-feature stores know the holder through its role row.
    reopen();
    await clock.advance(240_000);
    reopen(); // An existing vacancy must not restart its ten-minute deadline.
    await clock.advance(359_999);
    assert.equal(decisions().length, 0);
    await clock.advance(1);
    assert.equal(decisions().length, 1);
    assert.ok(decisions()[0]!.text.includes('cland session resume coord --relaunch'));
    assert.ok(decisions()[0]!.text.includes('cland role set coord coordinator'));
    reopen();
    await clock.advance(600_000);
    assert.equal(decisions().length, 1, 'a delivered alarm is not duplicated by restart');
    const back = core.hello({ type: 'hello', protocol: 2, sessionId: 'restart-coord', name: 'coord', cwd: '/', role: 'coordinator' }, () => true);
    assert.ok(back.ok);
    core.disconnect(back.connection);
    await clock.advance(240_000);
    reopen();
    const rescued = core.hello({ type: 'hello', protocol: 2, sessionId: 'restart-coord', name: 'coord', cwd: '/', role: 'coordinator' }, () => true);
    assert.ok(rescued.ok);
    await clock.advance(600_000);
    assert.equal(decisions().length, 1, 'refill cancels a recovered vacancy alarm');
  } finally { core.close(); core.store.close(); await rm(root, { recursive: true, force: true }); }
});

test('a late Coordinator disconnect after core and store close cannot write, publish or rearm vacancy monitoring', async () => {
  for (const vacant of [false, true]) {
    const clock = new FakeClock();
    const core = new HubCore({ clock });
    const joined = core.hello({ type: 'hello', protocol: 2, sessionId: 'closed-coord', name: 'coord', cwd: '/', role: 'coordinator' }, () => true);
    assert.ok(joined.ok);
    if (vacant) core.disconnect(joined.connection);
    core.close();
    core.store.close();
    assert.equal(clock.pending, 0, 'close cancels an already pending vacancy timer');
    const published: string[] = [];
    core.subscribe(event => published.push(event.type));
    assert.doesNotThrow(() => core.disconnect(joined.connection), 'late socket close cannot touch the closed database');
    assert.equal(clock.pending, 0, 'late disconnect cannot rearm a timer');
    await clock.advance(600_000);
    assert.equal(clock.pending, 0);
    assert.deepEqual(published, [], 'no lifecycle publication after terminal close');
  }
});

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
    assert.equal(store.messageSeq('m0'), 1, 'old rows keep their migrated durable number');
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
    assert.equal(again.messageSeq('m0'), 1);
    again.record({ ...message('m1', 's1', [], 'new'), topic: 'general' }, [], 4000);
    assert.equal(again.topicMessages('general', 1)[0]?.seq, 2);
    again.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a Coordinator harness exit posts one immediate General notice even after its spoke disconnected', () => {
  for (const disconnected of [false, true]) {
    const clock = new FakeClock(Date.parse('2026-10-18T17:48:00Z'));
    const core = new HubCore({ clock });
    try {
      const published: Message[] = [];
      core.subscribe(event => { if (event.type === 'message') published.push(event.message); });
      const coord = core.hello({ type: 'hello', protocol: 2, sessionId: 'sess-coord', name: 'coord', cwd: '/', role: 'coordinator' }, () => true);
      assert.ok(coord.ok);
      if (disconnected) core.disconnect(coord.connection);
      assert.equal(core.topicHistory('general').messages.length, 0, 'a spoke disconnect alone is not a harness exit');
      core.vacateRole('coord', 'its harness exited');
      const notices = core.topicHistory('general').messages;
      assert.equal(notices.length, 1, 'notice is available without advancing the heartbeat clock');
      const notice = notices[0]!;
      assert.equal(notice.fromKind, 'hub');
      assert.equal(notice.ts, '2026-10-18T17:48:00.000Z');
      assert.match(notice.text, /coord.*harness exited at 2026-10-18T17:48:00.000Z/);
      assert.match(notice.text, /Coordinator role was released/);
      assert.ok(notice.text.includes('cland session resume coord --relaunch'));
      assert.ok(notice.text.includes('cland session attach coord'));
      assert.equal(published.filter(m => m.id === notice.id).length, 1, 'the workbench receives the notice');
      assert.equal(core.holderOf('coordinator'), null);
      core.vacateRole('coord', 'its harness exited');
      const worker = core.hello({ type: 'hello', protocol: 2, sessionId: 'sess-worker', name: 'worker', cwd: '/', role: 'implementer' }, () => true);
      assert.ok(worker.ok);
      core.vacateRole('worker', 'its harness exited');
      assert.equal(core.topicHistory('general').messages.length, 1, 'repeated reports and other roles do not duplicate the notice');
    } finally { core.close(); core.store.close(); }
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
  const core = new HubCore({ clock: new FakeClock(Date.parse('2026-10-08T12:00:00.000Z')) });
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
  test(`deleting a trigger releases ${state} notes without replaying settled notes`, async () => {
    const clock = new FakeClock(1000);
    const journal: Array<Record<string, unknown>> = [];
    const core = new HubCore({ clock, queueTtlMs: 1000, retentionMs: 100, log: e => { journal.push(e); } });
    core.store.ensureTopic('notes', 'Notes', false, clock.now().toISOString());
    core.store.ensureTopic('reports', 'Reports', false, clock.now().toISOString());
    const got: Message[] = [];
    const receiver = core.hello({ type: 'hello', protocol: 2, sessionId: 'receiver', name: 'receiver', role: 'coordinator', cwd: '/' }, m => { got.push(m); return true; });
    assert.ok(receiver.ok);
    const note = core.sendFromSession('sender', ['receiver'], 'surviving note', undefined, 'notes', undefined, { role: 'implementer' }, undefined, 'progress').message;
    await clock.advance(200);
    const trigger = core.sendFromSession('sender', ['receiver'], 'deleted trigger', undefined, 'reports', undefined, { role: 'implementer' }).message;
    if (state === 'delivered' || state === 'uncertain' || state === 'injected') core.ack(receiver.connection, trigger.id);
    if (state === 'uncertain') core.markUncertain(trigger.id, 'receiver', 'no admission answer');
    if (state === 'injected') core.markInjected(trigger.id, 'receiver');
    if (state === 'dropped') core.store.expireQueued('receiver', 2201, 1000);
    await clock.advance(300);
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
  const clock = new FakeClock(1000);
  let core = new HubCore({ store: new Store(file), clock, queueTtlMs: 1000 });
  try {
    core.store.ensureTopic('reports', 'Reports', false, clock.now().toISOString());
    for (const name of ['fresh', 'expired']) {
      const joined = core.hello({ type: 'hello', protocol: 2, sessionId: name, name, role: 'coordinator', cwd: '/' }, () => true);
      assert.ok(joined.ok);
      core.disconnect(joined.connection);
    }
    const note = core.sendFromSession('sender', ['fresh', 'expired'], 'released P', undefined, undefined, undefined, { role: 'implementer' }, undefined, 'progress').message;
    await clock.advance(900);
    core.sendFromSession('sender', ['fresh', 'expired'], 'deleted R', undefined, 'reports', undefined, { role: 'implementer' });
    await clock.advance(50);
    core.deleteTopic('reports');
    core.close(); core.store.close();
    core = new HubCore({ store: new Store(file), clock, queueTtlMs: 1000 });
    const fresh = core.sendFromSession('sender', ['fresh'], 'fresh next report', undefined, undefined, undefined, { role: 'implementer' }).message;
    assert.deepEqual(core.store.deliveryMessage(fresh.id, 'fresh')?.digest?.map(m => m.id), [note.id]);
    await clock.advance(51);
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

test('rename refuses a dropped duplicate and preserves the source pending digest', async () => {
  const clock = new FakeClock(1000);
  const core = new HubCore({ clock, queueTtlMs: 1000 });
  const got: Message[] = [];
  const hello = (name: string) => {
    const result = core.hello({ type: 'hello', protocol: 2, sessionId: name, name, role: 'coordinator', cwd: '/' }, m => { got.push(m); return true; });
    assert.ok(result.ok);
    return result.connection;
  };
  const a = hello('a'), b = hello('b');
  const note = core.sendFromSession('a', ['a', 'b'], 'P', undefined, undefined, undefined, undefined, undefined, 'progress').message;
  await clock.advance(100);
  const r2 = core.sendFromSession('a', ['b'], 'R2').message;
  await clock.advance(800);
  const r1 = core.sendFromSession('a', ['a'], 'R1').message;
  await clock.advance(301);
  core.store.expireQueued('b', clock.now().getTime(), 1000);
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

test('merge queue preserves FIFO, pinned evidence and positions when the store reopens', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cland-merge-queue-store-'));
  const file = join(dir, 'hub.sqlite');
  let store = new Store(file);
  const entry = { item: 'T-1', branch: 't/parser', head: 'b'.repeat(40), verdictBase: 'dev', enqueued: '2026-10-18T09:00:00Z', by: { id: 'coord-id', name: 'coord', role: 'coordinator' } };
  const second = { ...entry, item: 'T-2', branch: 't/lexer' };
  try {
    assert.equal(store.enqueueMerge(entry), 1);
    assert.equal(store.enqueueMerge(second), 2);
    assert.equal(store.enqueueMerge({ ...entry, enqueued: 'later' }), 1, 'a duplicate request retains its order and original evidence');
    store.close();
    store = new Store(file);
    assert.deepEqual(store.mergeQueue(), [entry, second]);
    store.dropMerge('1');
    assert.deepEqual(store.mergeQueue(), [second]);
    assert.equal(store.enqueueMerge(entry), 2, 'a new request follows the surviving request');
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});


test('numeric history walks 450 messages in three pages in either direction without gaps or repeats', () => {
  const core = new HubCore({ clock: new FakeClock() });
  try {
    const expected = Array.from({ length: 450 }, (_, i) => `page-${i}`);
    core.store.transaction(() => {
      for (const [i, id] of expected.entries()) {
        core.store.record({ ...message(id, 'alpha', [], id), topic: 'general' }, [], 1000 - i);
        // The sequence belongs to the whole store, so topic cursors need not be consecutive.
        if (i % 100 === 0) core.store.record({ ...message(`other-${i}`, 'alpha', [], 'other'), topic: 'agents' }, [], i);
      }
    });
    const page = (filter: TopicHistoryFilter) => core.topicHistory('general', 999, filter).messages;
    let forward: TopicMessage[] = [], backward: TopicMessage[] = [];
    let after = 0, before = Number.MAX_SAFE_INTEGER;
    const forwardSizes: number[] = [], backwardSizes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const next = page({ after }), prev = page({ before });
      forwardSizes.push(next.length); backwardSizes.push(prev.length);
      forward.push(...next); backward = [...prev, ...backward];
      after = next.at(-1)!.seq; before = prev[0]!.seq;
    }
    assert.deepEqual(forwardSizes, [200, 200, 50]);
    assert.deepEqual(backwardSizes, [200, 200, 50]);
    assert.deepEqual(forward.map(m => m.id), expected);
    assert.deepEqual(backward.map(m => m.id), expected);
    assert.ok(forward.every((m, i) => Number.isSafeInteger(m.seq) && m.seq > (forward[i - 1]?.seq ?? 0)));
    assert.deepEqual(page({ after }), []);
    assert.deepEqual(page({ before }), []);
    assert.deepEqual(core.topicHistory('agents', 2, { after: 0, session: 'alpha' }).messages.map(m => m.id), ['other-0', 'other-100']);
    const last = forward.at(-1)!.seq;
    core.store.prune(10000, 1);
    core.store.record({ ...message('after-retention', 'alpha', [], 'new'), topic: 'general' }, [], 10000);
    const retained = page({ after: last });
    assert.deepEqual(retained.map(m => m.id), ['after-retention']);
    assert.ok(retained[0]!.seq > last, 'emptying the table never reuses a cursor');
  } finally { core.close(); core.store.close(); }
});

test('a message inserted between forward pages appears exactly once after the existing tail', () => {
  const core = new HubCore({ clock: new FakeClock() });
  try {
    core.store.transaction(() => {
      for (let i = 0; i < 450; i++) core.store.record({ ...message(`m-${i}`, 'alpha', [], 'old'), topic: 'general' }, [], 1000);
    });
    const first = core.topicHistory('general', 200, { after: 0 }).messages;
    const live: TopicMessage[] = [];
    core.subscribe(event => { if (event.type === 'message') live.push(event.message); });
    const inserted = core.sendFromHuman('general', 'new tail').message;
    const second = core.topicHistory('general', 200, { after: first.at(-1)!.seq }).messages;
    const third = core.topicHistory('general', 200, { after: second.at(-1)!.seq }).messages;
    const all = [...first, ...second, ...third];
    assert.equal(third.length, 51);
    assert.equal(all.filter(m => m.id === inserted.id).length, 1);
    assert.equal(third.at(-1)?.seq, inserted.seq);
    assert.deepEqual(live.find(m => m.id === inserted.id), inserted, 'send result and published event use the stored number');
    assert.deepEqual(core.topicHistory('general', 200, { after: inserted.seq }).messages, []);
  } finally { core.close(); core.store.close(); }
});

test('legacy history keeps its latest-first selection and oldest-first output, including message-id before', () => {
  const core = new HubCore({ clock: new FakeClock() });
  try {
    core.store.transaction(() => {
      for (let i = 0; i < 55; i++) core.store.record({ ...message(`legacy-${i}`, 'alpha', [], 'old'), topic: 'general' }, [], 1000);
    });
    const latest = core.topicHistory('general').messages;
    assert.deepEqual(latest.map(m => m.id), Array.from({ length: 50 }, (_, i) => `legacy-${i + 5}`));
    assert.deepEqual(core.topicHistory('general', 200, { before: latest[0]!.id }).messages.map(m => m.id), ['legacy-0', 'legacy-1', 'legacy-2', 'legacy-3', 'legacy-4']);
    assert.deepEqual(core.topicHistory('general', 10, { before: 'missing' }).messages, []);
    assert.equal(core.topicHistory('general', 3).messages.length, 3);
    const agents = core.topicHistory('agents', 200, { after: 0, session: 'alpha' });
    assert.deepEqual(agents.messages, []);
    assert.throws(() => core.topicHistory('general', 200, { after: 0, session: 'alpha' }), /Agents/);
  } finally { core.close(); core.store.close(); }
});

test('history accepts exclusive safe-integer cursors and refuses ambiguous or invalid cursors', () => {
  const frame = { type: 'topic.history', id: 'history', topic: 'general' };
  for (const filter of [{}, { before: 'message-id' }, { before: 1 }, { after: 0 }, { after: Number.MAX_SAFE_INTEGER }]) assert.equal(isClientRequest({ ...frame, ...filter }), true);
  const core = new HubCore({ clock: new FakeClock() });
  try {
    for (const cursor of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      for (const key of ['before', 'after']) {
        assert.equal(isClientRequest({ ...frame, [key]: cursor }), false);
        assert.throws(() => core.topicHistory('general', 200, { [key]: cursor }), /safe integer/);
      }
    }
    for (const filter of [{ before: 10, after: 0 }, { before: 'message-id', after: 0 }]) {
      assert.equal(isClientRequest({ ...frame, ...filter }), false);
      assert.throws(() => core.topicHistory('general', 200, filter), /not both/);
    }
    assert.equal(isClientRequest({ ...frame, after: '1' }), false);
  } finally { core.close(); core.store.close(); }
});
