// T2: synthetic retained-history candidate equivalence and startup migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { FakeClock } from './fake-clock.ts';
import { sqliteProbe } from './sqlite-probe.ts';
import { InboxBoard } from '../src/hub/inbox.ts';
import { Visibility } from '../src/hub/visibility.ts';
import { VisibilityPreferenceFile } from '../src/hub/visibility-preferences.ts';
import { Store } from '../src/hub/store.ts';
import { oldInboxQuery, oldInboxMessages } from './inbox-query-oracle.ts';
import { receiptFixtureCase } from './receipt-fixture-case.ts';
import { tempProject, projectHub, connectUi, inProcessSpoke, eventually } from './harness.ts';

function hiddenWaitFixture(fixtures: test.TestContext, count: number, legacy = false) {
  const clock = new FakeClock(Date.parse('2026-11-19T00:00:00.000Z')), now = () => clock.now();
  const probe = sqliteProbe();
  const cursorPlans: string[][] = [];
  let db!: DatabaseSync, decoded = 0, reconciled = 0;
  const store = new Store(':memory:', path => { db = probe.open(path); return db; });
  fixtures.after(() => store.close());
  probe.trace(fixtures, (sql, method, _bindings, result) => {
    if (method === 'all' && sql.startsWith('with latest_messages')) decoded += (result as unknown[]).length;
    if (method === 'all' && sql.startsWith('with keys(kind,id)')) reconciled += (result as unknown[]).length;
    if (method === 'all' && sql.startsWith('select kind,id,(kind') && sql.includes(' where ')) {
      cursorPlans.push(db.prepare('explain query plan ' + sql).all(..._bindings as string[]).map(r => String(r.detail)));
    }
  });
  store.createTopic('retained', 'Retained', null, now().toISOString());
  db.exec(`with recursive n(x) as (select 1 union all select x+1 from n where x<${count})
    insert into messages(id,from_name,from_kind,via,to_json,text,ts,created_at,topic,seq)
    select 'hidden-'||x,'worker','agent','session','[]','Recorded hidden wait','2026-10-01T00:00:00.000Z',0,'retained',x from n;
    insert into inbox_waits(kind,id,subject,since,text) select 'message',id,'retained',ts,text from messages order by seq desc;
    update counters set value=${count} where name='message_seq';`);
  if (legacy) {
    store.inboxMessages = () => oldInboxMessages(db);
    const all = store.inboxWaits.bind(store);
    store.inboxWaits = () => all();
  }
  const board = new InboxBoard({ store, clock, now, visibility: new Visibility({ now }), log: () => {}, emit: () => {},
    topics: () => store.topics(), items: () => [], presence: () => [], stateOf: () => 'idle', idleNotifyMs: 0,
    idle: () => {}, approvalNote: () => {}, sizeRefusal: () => null });
  fixtures.after(() => board.close());
  return { store, board, db, now, clock, cursorPlans, work: () => ({ decoded, reconciled }) };
}

for (const transition of ['topic read', 'human reply'] as const) {
  test(`a bulk ${transition} drains 1,000 hidden waits in bounded pages`, t => receiptFixtureCase(t, false, async fixtures => {
    const f = hiddenWaitFixture(fixtures, 1000);
    assert.equal(f.store.inboxWaits().length, 1000);
    assert.equal(f.board.list().needsYou, 0);
    if (transition === 'topic read') f.store.markTopicRead('retained');
    else f.store.record({ id: 'human', from: 'human', fromKind: 'human', via: 'session', to: [], text: 'Reply', ts: f.now().toISOString(), topic: 'retained' }, [], 0);
    let remaining = 1000;
    for (let page = 0; page < 8 && remaining; page++) {
      const before = f.work(), reply = f.board.list(), after = f.work();
      assert.equal(reply.needsYou, 0);
      assert.ok(after.decoded - before.decoded <= 128, `page ${page}: ${after.decoded - before.decoded} candidates decoded`);
      assert.ok(after.reconciled - before.reconciled <= 128, `page ${page}: ${after.reconciled - before.reconciled} waits reconciled`);
      remaining -= Math.min(128, remaining);
      assert.equal(reply.archiveToday, 1000 - remaining);
    }
    assert.equal(remaining, 0);
    assert.equal(f.store.inboxWaits().length, 0);
    assert.equal(f.store.topics()[0]!.unread, transition === 'topic read' ? 0 : 1000);
    assert.equal(f.store.inboxDepartures(f.now().toISOString()).length, 1000);
    const old = hiddenWaitFixture(fixtures, 1000, true);
    if (transition === 'topic read') old.store.markTopicRead('retained');
    else old.store.record({ id: 'human', from: 'human', fromKind: 'human', via: 'session', to: [], text: 'Reply', ts: old.now().toISOString(), topic: 'retained' }, [], 0);
    const oldBefore = old.work(), oldReply = old.board.list(true);
    assert.equal(old.work().decoded - oldBefore.decoded, 1000, 'the reduced fixture still exceeds the page bound on the old path');
    assert.deepEqual(f.board.list(true), oldReply, 'complete drained projection and ordered archive match the old query');
  }));
}

test('equal-timestamp hidden departures preserve old insertion order instead of key order', t => receiptFixtureCase(t, false, async fixtures => {
  const current = hiddenWaitFixture(fixtures, 3), previous = hiddenWaitFixture(fixtures, 3, true);
  for (const f of [current, previous]) f.store.markTopicRead('retained');
  const actual = current.board.list(true), expected = previous.board.list(true);
  assert.deepEqual(expected.archive?.map(d => d.id), ['hidden-1', 'hidden-2', 'hidden-3']);
  assert.deepEqual(actual, expected);
}));

test('scheduled inbox publications continue a partially drained durable change queue', t => receiptFixtureCase(t, false, async fixtures => {
  const f = hiddenWaitFixture(fixtures, 257);
  f.store.markTopicRead('retained');
  assert.equal(f.board.list().archiveToday, 128);
  assert.equal(f.store.inboxWaits().length, 129);
  await f.clock.advance(250);
  assert.equal(f.store.inboxWaits().length, 1);
  await f.clock.advance(250);
  assert.equal(f.store.inboxWaits().length, 0);
  assert.equal(f.board.list().archiveToday, 257);
}));

test('paged request departures keep the previous descending candidate order', t => receiptFixtureCase(t, false, async fixtures => {
  const current = hiddenWaitFixture(fixtures, 257), previous = hiddenWaitFixture(fixtures, 257, true);
  for (const f of [current, previous]) {
    f.db.exec(`update messages set notice='request',request_kind='review',request_subject='worker';
      delete from inbox_waits;
      insert into inbox_waits(kind,id,subject,since,text) select 'request',id,'worker',ts,text from messages order by seq;
      insert or ignore into inbox_request_candidates select id from messages;`);
    f.store.record({ id: 'human', from: 'human', fromKind: 'human', via: 'session', to: [], text: 'Reply', ts: f.now().toISOString(), topic: 'retained' }, [], 0);
  }
  for (let page = 0; page < 3; page++) {
    const before = current.work();
    current.board.list();
    const after = current.work();
    assert.ok(after.decoded - before.decoded <= 128);
    assert.ok(after.reconciled - before.reconciled <= 128);
  }
  assert.deepEqual(current.board.list(true), previous.board.list(true));
}));

test('a durable cursor reaches a hidden read past 128 pending deaf waits within two pages', t => receiptFixtureCase(t, false, async fixtures => {
  const f = hiddenWaitFixture(fixtures, 1);
  f.db.exec(`delete from inbox_waits;
    with recursive n(x) as (select 1 union all select x+1 from n where x<128)
    insert into messages(id,from_name,from_kind,via,to_json,text,ts,created_at,topic,seq,notice)
      select 'deaf-'||x,'hub','hub','hub','[]','Pending deaf notice','2026-10-01T00:00:00.000Z',0,'retained',x+1,'deaf' from n;
    insert into inbox_waits(kind,id,subject,since,text) select 'message',id,'retained',ts,text from messages where notice='deaf' order by seq;
    insert into inbox_waits(kind,id,subject,since,text) select 'message',id,'retained',ts,text from messages where id='hidden-1';`);
  f.store.markMessageRead('hidden-1');
  const initial = f.work();
  assert.equal(f.board.list().archiveToday, 0, 'the first page contains only pending notices');
  const first = f.work();
  assert.ok(first.decoded - initial.decoded <= 128);
  assert.ok(first.reconciled - initial.reconciled <= 128);
  assert.equal(f.store.inboxWaits().length, 129);
  const reopened = new Store(':memory:', () => f.db);
  assert.deepEqual(reopened.inboxWaitChangePage().keys.map(k => k.id), ['hidden-1'], 'a new Store resumes the durable examined-key cursor');
  await f.clock.advance(250);
  const second = f.work();
  assert.ok(second.decoded - first.decoded <= 128);
  assert.ok(second.reconciled - first.reconciled <= 128);
  assert.deepEqual(f.store.inboxDepartures('2026-11-19T00:00:00.000Z').map(d => [d.id, d.reason]), [['hidden-1', 'read']],
    'the exact hidden read departs by the second page, without dropping pending notices');
  assert.equal(f.store.inboxWaits().length, 128);
  assert.ok(f.cursorPlans.some(plan => plan.some(row => row.includes('SEARCH inbox_wait_changes USING INDEX inbox_wait_change_order'))),
    JSON.stringify(f.cursorPlans));
  await f.clock.advance(250);
  const cycleEnd = f.work();
  await f.clock.advance(250);
  assert.deepEqual(f.work(), cycleEnd, 'an unchanged full cycle goes quiet without dropping pending keys');
  f.board.useProcesses(() => []);
  assert.equal(f.board.list().archiveToday, 129);
  assert.equal(f.store.inboxWaits().length, 0, 'pending notices retain later process-driven settlement');
}));

test('an empty drain resets ordering before a new bulk invalidation after a middle read', t => receiptFixtureCase(t, false, async fixtures => {
  const current = hiddenWaitFixture(fixtures, 300), previous = hiddenWaitFixture(fixtures, 300, true);
  for (const f of [current, previous]) f.store.markMessageRead('hidden-150');
  assert.deepEqual(current.board.list(true), previous.board.list(true));
  assert.equal(current.db.prepare('select count(*) as n from inbox_wait_changes').get()!.n, 0, 'middle-read change queue is durably empty');
  assert.equal(current.store.meta('inbox-wait-cursor'), null, 'an empty queue retains no cursor for a later invalidation');
  assert.equal(current.store.inboxWaits().length, 299);
  for (const f of [current, previous]) f.store.markTopicRead('retained');
  for (let page = 0; page < 4; page++) {
    const before = current.work();
    current.board.list();
    const after = current.work();
    assert.ok(after.decoded - before.decoded <= 128);
    assert.ok(after.reconciled - before.reconciled <= 128);
  }
  assert.equal(current.store.inboxWaits().length, 0);
  const actual = current.board.list(true), expected = previous.board.list(true);
  assert.equal(actual.archiveToday, 300);
  assert.deepEqual(actual, expected, 'fresh invalidation preserves old insertion order at equal timestamps');
}));

test('an inbox page reconciles only its selected waits with 50,000 hidden durable waits', t => receiptFixtureCase(t, false, async fixtures => {
  const clock = new FakeClock(Date.parse('2026-11-19T00:00:00.000Z')), now = () => clock.now();
  const waits = new Map(Array.from({ length: 50000 }, (_, i) => [`hidden-${i}`, { kind: 'message' as const, id: `hidden-${i}`, subject: 'general', since: '2026-10-01T00:00:00.000Z' }]));
  let reconciled = 0;
  const store = {
    remotes: { forMessenger: () => ({ requests: () => [] }) }, pendingApprovals: () => [], openAsks: () => [],
    inboxWaitChangePage: () => ({ keys: [], more: false }), finishInboxWaitChangePage: () => {},
    inboxMessages: () => [],
    inboxWaits: (ids?: string[]) => {
      const selected = ids ? ids.flatMap(id => waits.has(id) ? [waits.get(id)!] : []) : [...waits.values()];
      reconciled += selected.length;
      return selected;
    },
    inboxDeparturesToday: () => 0,
    message: () => undefined,
  } as unknown as Store;
  const board = new InboxBoard({ store, clock, now, visibility: new Visibility({ now }), log: () => {}, emit: () => {},
    topics: () => [], items: () => [], presence: () => [], stateOf: () => 'idle', idleNotifyMs: 0,
    idle: () => {}, approvalNote: () => {}, sizeRefusal: () => null });
  fixtures.after(() => board.close());
  const page = board.list();
  assert.equal(waits.size, 50000);
  assert.equal(page.needsYou, 0);
  assert.ok(reconciled <= page.messages.length + 1, `${reconciled} waits reconciled`);
}));

test('hidden waits remain durable while indexed pages preserve read and reply departures', t => receiptFixtureCase(t, false, async fixtures => {
  const clock = new FakeClock(Date.parse('2026-11-19T00:00:00.000Z')), now = () => clock.now();
  const make = (legacy: boolean) => {
    const probe = sqliteProbe();
    let db!: DatabaseSync, decoded = 0, reconciled = 0;
    const store = new Store(':memory:', path => { db = probe.open(path); return db; });
    fixtures.after(() => store.close());
    probe.trace(fixtures, (sql, method, _bindings, result) => {
      if (method === 'all' && sql.startsWith('with latest_messages')) decoded += (result as unknown[]).length;
      if (method === 'all' && sql.startsWith('with keys(kind,id)')) reconciled += (result as unknown[]).length;
    });
    store.createTopic('retained', 'Retained', null, now().toISOString());
    db.exec(`with recursive n(x) as (select 1 union all select x+1 from n where x<1000)
      insert into messages(id,from_name,from_kind,via,to_json,text,ts,created_at,topic,seq)
      select 'wait-'||x,'worker','agent','session','[]','Recorded wait',
        case when x>997 then '2026-11-19T00:00:00.000Z' else '2026-10-01T00:00:00.000Z' end,0,'retained',x from n;
      insert into inbox_waits(kind,id,subject,since,text)
        select 'message',id,'retained',ts,text from messages;
      update counters set value=1000 where name='message_seq';`);
    if (legacy) {
      store.inboxMessages = () => oldInboxMessages(db);
      const all = store.inboxWaits.bind(store);
      store.inboxWaits = () => all();
    }
    const board = new InboxBoard({ store, clock, now, visibility: new Visibility({ now }), log: () => {}, emit: () => {},
      topics: () => store.topics(), items: () => [], presence: () => [], stateOf: () => 'idle', idleNotifyMs: 0,
      idle: () => {}, approvalNote: () => {}, sizeRefusal: () => null });
    fixtures.after(() => board.close());
    return { store, board, work: () => ({ decoded, reconciled }), db };
  };
  const current = make(false);
  const page = current.board.list(true);
  assert.deepEqual(page.messages.map(m => m.id), ['wait-1000', 'wait-999', 'wait-998']);
  assert.deepEqual(current.work(), { decoded: 3, reconciled: 3 });
  assert.equal(current.store.inboxWaits().length, 1000);
  assert.equal(current.store.topics()[0]!.unread, 1000);
  // The recorded old fixture remains the independent departure oracle.
  const previous = make(true);
  assert.deepEqual(page, previous.board.list(true));
  assert.equal(previous.work().decoded, 1000, 'the old path still fails the clean-window decode bound');
  for (const f of [current, previous]) f.store.markMessageRead('wait-1');
  const read = current.board.list(true);
  assert.deepEqual(read, previous.board.list(true));
  assert.deepEqual(read.archive?.map(r => [r.id, r.reason]), [['wait-1', 'read']]);
  // A topic watermark settles a second hidden wait without exposing it first.
  for (const f of [current, previous]) f.store.markTopicRead('retained', 'wait-2');
  assert.deepEqual(current.board.list(true), previous.board.list(true));
  // Keep the reply fixture small: only two old durable waits remain in this topic.
  for (const f of [current, previous]) {
    f.db.exec("delete from inbox_waits where id not in ('wait-3','wait-4')");
    f.store.record({ id: 'human', from: 'human', fromKind: 'human', via: 'session', to: [], text: 'Reply',
      ts: now().toISOString(), topic: 'retained' }, [], 0);
  }
  const replied = current.board.list(true);
  assert.deepEqual(replied, previous.board.list(true));
  assert.deepEqual(replied.archive?.filter(r => r.reason === 'answered').map(r => r.id).sort(), ['wait-3', 'wait-4']);
  assert.equal(current.store.inboxWaits().length, 0);
}));

test('existing 1,000 wait stores backfill once and remain compatible with older writers', t => receiptFixtureCase(t, false, async fixtures => {
  const db = new DatabaseSync(':memory:');
  fixtures.after(() => db.close());
  const store = new Store(':memory:', () => db);
  store.createTopic('retained', 'Retained', null, '2026-11-19T00:00:00.000Z');
  // Reconstruct the previous schema additions on this synthetic connection.
  db.exec(`drop trigger inbox_wait_changed_insert; drop trigger inbox_wait_changed_delete;
    drop trigger inbox_wait_read; drop trigger inbox_wait_topic_read; drop trigger inbox_wait_reply;
    drop table inbox_wait_changes; drop index inbox_wait_topic_seq;
    alter table inbox_waits drop column message_topic;
    alter table inbox_waits drop column message_seq;
    delete from meta where key = 'inbox-wait-changes';
    with recursive n(x) as (select 1 union all select x+1 from n where x<1000)
    insert into messages(id,from_name,from_kind,via,to_json,text,ts,created_at,topic,seq)
      select 'old-'||x,'worker','agent','session','[]','Old wait','2026-10-01T00:00:00.000Z',0,'retained',x from n;
    insert into inbox_waits(kind,id,subject,since,text) select 'message',id,'retained',ts,text from messages;
    insert into message_reads values ('old-1');
    update counters set value=1000 where name='message_seq';`);
  let backfills = 0;
  const exec = db.exec.bind(db);
  db.exec = sql => { if (sql.startsWith('update inbox_waits set message_topic')) backfills++; return exec(sql); };
  const start = performance.now();
  const upgraded = new Store(':memory:', () => db);
  const migrationMs = performance.now() - start;
  assert.equal(backfills, 1);
  assert.equal(db.prepare('select count(*) as n from inbox_waits where message_topic = ? and message_seq is not null').get('retained')!.n, 1000);
  assert.deepEqual(upgraded.inboxWaits([]).map(w => w.id), ['old-1']);
  const reopenStart = performance.now();
  const reopened = new Store(':memory:', () => db);
  const reopenMs = performance.now() - reopenStart;
  assert.equal(backfills, 1, 'reopen never repeats the backfill');
  assert.equal(reopened.inboxWaits().length, 1000);
  // Old SQL writers omit the additive columns; triggers still maintain them.
  exec(`insert into inbox_waits(kind,id,subject,since,text) values ('request','old-2','T-1','2026-10-01','Request');
    insert into messages(id,from_name,from_kind,via,to_json,text,ts,created_at,topic,seq,reply_to)
      values ('reply','human','human','session','[]','Cross-topic reply','2026-11-19',0,'general',1001,'old-2');`);
  assert.deepEqual(reopened.inboxWaits([]).map(w => [w.kind,w.id]), [['message','old-1'],['request','old-2']]);
  exec("delete from inbox_waits where kind = 'request' and id = 'old-2'");
  assert.deepEqual(reopened.inboxWaits([]).map(w => w.id), ['old-1']);
  t.diagnostic(JSON.stringify({ migrationMs, reopenMs, backfills, waits: 1000, platform: process.platform,
    executor: 'local', storage: 'synthetic in-memory SQLite; excludes hub startup and disk IO' }));
}));

test('inbox decodes only its recent window with 100,000 retained unread messages', t => {
  const probe = sqliteProbe();
  let db!: DatabaseSync;
  const store = new Store(':memory:', path => { db = probe.open(path); return db; });
  t.after(() => store.close());
  let decoded = 0;
  let plan: string[] = [];
  probe.trace(t, (sql, method, _bindings, result) => {
    if (sql.startsWith('with latest_messages') && method === 'all') {
      decoded += (result as unknown[]).length;
      plan = db.prepare('explain query plan ' + sql).all(..._bindings as string[]).map(r => String(r.detail));
    }
  });
  const clock = new FakeClock(Date.parse('2026-11-19T00:00:00.000Z'));
  const now = () => clock.now();
  store.createTopic('retained', 'Retained', null, now().toISOString());
  // Fixture owns one in-memory connection; reuse one insert in one transaction.
  const insert = db.prepare(`insert into messages(id,from_name,from_kind,via,to_json,text,ts,created_at,topic,seq)
    values (?, 'worker', 'agent', 'session', '[]', 'retained', ?, 0, 'retained', ?)`);
  store.transaction(() => {
    for (let i = 0; i < 100000; i++) insert.run(`retained-${i}`, i < 99997 ? '2026-10-01T00:00:00.000Z' : now().toISOString(), i + 1);
    db.prepare("update counters set value=100000 where name='message_seq'").run();
  });
  const board = new InboxBoard({ store, clock, visibility: new Visibility({ now }), now, log: () => {}, emit: () => {},
    topics: () => store.topics(), items: () => [], presence: () => [], stateOf: () => 'idle',
    idleNotifyMs: 0, idle: () => {}, approvalNote: () => {}, sizeRefusal: () => null });
  t.after(() => board.close());
  const frame = board.list();
  const facts = { ids: frame.messages.map(m => m.id), needsYou: frame.needsYou,
    topics: store.topics().map(t => ({ id: t.id, unread: t.unread, readSeq: t.readSeq })) };
  t.diagnostic(JSON.stringify({ facts, decoded }));
  assert.deepEqual(facts, { ids: ['retained-99999', 'retained-99998', 'retained-99997'], needsYou: 3,
    topics: [{ id: 'retained', unread: 100000, readSeq: 0 }] });
  assert.ok(decoded <= frame.messages.length + 1, `decoded ${decoded} for ${frame.messages.length} returned messages`);
  t.diagnostic(JSON.stringify({ plan }));
  assert.ok(plan.some(row => row.includes('messages_inbox_recent')), 'recent window uses its timestamp index');
  // Whole-reply equivalence runs in the small policy differential below. The
  // volume case keeps its independently recorded facts without decoding the
  // retained history again through the legacy oracle.
});

test('windowed inbox preserves old replies through pins, overrides, reads and waiting-topic transitions', async t => {
  const root = await tempProject(t), clock = new FakeClock(Date.parse('2026-11-19T00:00:00.000Z'));
  const now = () => clock.now();
  for (const mode of ['default', 'topic-pin', 'session-pin', 'topic-mute', 'old-now'] as const) {
    const uiPath = join(root, `${mode}.json`);
    await writeFile(uiPath, JSON.stringify({ visibility: mode === 'topic-pin' ? { topics: { open: 'pin' } }
      : mode === 'session-pin' ? { sessions: { worker: 'pin' } } : mode === 'topic-mute' ? { topics: { open: 'mute' } } : {} }));
    const preferences = new VisibilityPreferenceFile(uiPath);
    const make = (oracle: boolean) => {
      const db = new DatabaseSync(':memory:'), store = new Store(':memory:', () => db);
      for (const topic of ['open', 'waiting']) store.createTopic(topic, topic, null, now().toISOString());
      store.setTopicStatus('waiting', 'waiting for human', now().toISOString());
      const add = (id: string, ts: string, topic = 'open', extra: Partial<import('../src/protocol.ts').Message> = {}) =>
        store.record({ id, from: 'worker', fromKind: 'agent', via: 'session', to: [], text: id, ts, topic, ...extra }, [], 0);
      add('old', '2026-10-01T00:00:00.000Z');
      add('old-wait', '2026-10-01T00:00:00.000Z', 'waiting', { to: ['reviewer'] });
      add('boundary', '2026-11-12T00:00:00.000Z');
      add('hour-24-boundary', '2026-11-11T24:00:00.000Z');
      add('backdated', '2026-10-02T00:00:00.000Z');
      add('tied', '2026-11-12T00:00:00.000Z');
      add('noncanonical', '2026-11-18T00:00:00Z');
      add('invalid-time', 'unknown');
      add('sqlite-special-time', 'now');
      add('request', '2026-10-01T00:00:00.000Z', 'open', { kind: 'request', request: 'review', subject: 'T-1' });
      if (oracle) store.inboxMessages = () => oldInboxMessages(db);
      const board = new InboxBoard({ store, clock, visibility: new Visibility({ now, preferences,
        overrides: mode === 'old-now' ? { messages: { old: 'now' } } : {} }), now, log: () => {}, emit: () => {},
        topics: () => store.topics(), items: () => [], presence: () => [], stateOf: () => 'idle',
        idleNotifyMs: 0, idle: () => {}, approvalNote: () => {}, sizeRefusal: () => null });
      t.after(() => { board.close(); store.close(); });
      return { store, board, add };
    };
    const current = make(false), previous = make(true);
    const compare = () => assert.deepEqual(current.board.list(true), previous.board.list(true), mode);
    compare();
    for (const fixture of [current, previous]) {
      fixture.store.markMessageRead('tied');
      fixture.add('human', now().toISOString(), 'open', { from: 'human', fromKind: 'human' });
      fixture.store.setTopicStatus('waiting', 'open', now().toISOString());
    }
    compare();
    clock.block(1);
    compare();
  }
});

function seed(path: string) {
  new Store(path).close();
  const db = new DatabaseSync(path);
  db.exec(`create index if not exists messages_inbox_human on messages(topic, seq)
    where (from_kind = 'agent' or (from_kind = 'hub' and json_extract(notice_detail, '$.event') = 'verification-cleanup-incomplete'))
      and coalesce(notice, '') not in ('progress', 'event', 'request') and json_array_length(to_json) = 0;
    begin;
    with recursive n(x) as (select 0 union all select x+1 from n where x<199)
    insert into topics(id,title,status,created_at,updated_at) select 'q-'||x,'Query '||x,case when x%3=0 then 'waiting for human' else 'open' end,'2026-11-01','2026-11-01' from n;
    with recursive n(x) as (select 1 union all select x+1 from n where x<50000)
    insert into messages(id,from_name,from_kind,via,to_json,text,ts,created_at,topic,seq,notice)
    select 'm-'||x,'worker',case when x%31=0 and x>7000 and x%200!=1 then 'human' else 'agent' end,'session',
      case when x%7=0 and x>5000 then '["reviewer"]' else '[]' end,'Synthetic message '||x,'2026-11-01T12:00:00Z',x,
      'q-'||case when x<=5000 then 1 else x%200 end,x,
      case when x>5000 and x<=7000 then 'request' when x%11=0 and x>7000 then 'progress' else null end from n;
    insert into inbox_departures(kind,id,subject,since,ts,reason)
      select 'request',id,'T-1',ts,ts,'replied' from messages where notice='request';
    update topics set read_seq=50000 where id!='q-1';
    update counters set value=50000 where name='message_seq';
    commit;`);
  db.close();
}

test('synthetic inbox candidates stay equivalent and indexed as retained history doubles', async t => {
  const root = await tempProject(t), path = join(root, 'fixture.db');
  seed(path);
  const oldDb = new DatabaseSync(path);
  t.after(() => oldDb.close());
  // Run the baseline without the new candidate index, as on the old hub.
  oldDb.exec('drop index messages_inbox_human_v2');
  const oldAt = performance.now();
  const expected = oldInboxMessages(oldDb);
  const oldMs = performance.now()-oldAt;
  const probe = sqliteProbe();
  let querySql = '';
  probe.trace(t, (sql, method) => { if (sql.startsWith('with latest_messages') && method === 'all') querySql = sql; });
  const current = new Store(path, probe.open);
  t.after(() => current.close());
  const coldAt = performance.now(), actual = current.inboxMessages(), coldMs = performance.now()-coldAt;
  const samples = Array.from({ length: 5 }, () => {
    const at = performance.now(); current.inboxMessages(); return performance.now()-at;
  });
  const ms = [...samples].sort((a,b) => a-b)[2]!;
  t.diagnostic(JSON.stringify({ oldFullQueryMs: oldMs, warmMedianMs: ms, coldMs, samples, candidates: actual.length, platform: process.platform, node: process.version }));
  assert.ok(actual.length >= 4000);
  assert.deepEqual(actual, expected);
  const plan = oldDb.prepare('explain query plan '+querySql).all().map(r => String(r.detail));
  t.diagnostic(JSON.stringify({ plan }));
  assert.ok(!plan.some(detail => /^SCAN [mh](?: |$)/.test(detail)), 'no retained message scan');
  assert.ok(plan.some(detail => detail.includes('messages_inbox_human_v2')), 'unread candidates use their partial index');
  assert.ok(plan.some(detail => /^SCAN r(?: |$)/.test(detail)), 'requests drive lookups from the bounded unsettled set');
  oldDb.exec(`insert into messages(id,from_name,from_kind,via,to_json,text,ts,created_at,topic,seq,notice)
    select 'extra-'||id,from_name,'agent',via,to_json,'Unrelated retained progress',ts,created_at,topic,seq+50000,'progress'
    from messages where seq<=50000;
    update counters set value=100000 where name='message_seq';`);
  assert.equal(oldDb.prepare('select count(*) as n from messages').get()!.n, 100000);
  const grown = current.inboxMessages();
  assert.equal(grown.length, actual.length, 'doubling irrelevant history adds no produced candidates');
  assert.deepEqual(grown, actual);
  assert.deepEqual(grown, oldInboxMessages(oldDb));
});

test('existing large synthetic database migrates and serves hub.status within 15 seconds', async t => {
  const root = await tempProject(t), source = join(root, 'fixture.db');
  seed(source);
  await mkdir(join(root, '.cland'), { recursive: true });
  const legacy = new DatabaseSync(source);
  legacy.exec("drop index messages_inbox_human_v2; drop trigger inbox_request_insert; drop trigger inbox_request_depart; drop table inbox_request_candidates; delete from meta where key='inbox-request-candidates';");
  legacy.close();
  await copyFile(source, join(root, '.cland', 'hub.db'));
  const at = performance.now();
  const daemon = await projectHub(t, root, {}, { probes: 'fake', harnesses: 'fake' });
  const ui = await connectUi(t, daemon.discovery);
  const result = await ui.request({ type: 'hub.status' });
  assert.equal(result.ok, true);
  t.diagnostic(`startup hub.status ${performance.now()-at} ms`);
  const migrated = new DatabaseSync(join(root, '.cland', 'hub.db'));
  assert.ok(migrated.prepare("select 1 from sqlite_master where name='messages_inbox_human_v2'").get());
  assert.equal(migrated.prepare('select count(*) as n from inbox_request_candidates').get()!.n, 0);
  migrated.close();
  assert.ok(performance.now()-at < 15000); // lint-allow-wall-clock: C4 measures end-to-end start through actual hub.status receipt.
});


test('1,000 real sends and their mirror notices across windows do not rebuild or emit', async t => {
  const root = await tempProject(t), clock = new FakeClock(Date.now()), database = sqliteProbe();
  let rebuilds = 0;
  database.trace(t, (sql, method) => { if (sql.startsWith('with latest_messages') && method === 'all') rebuilds++; });
  const daemon = await projectHub(t, root, {}, { clock, openDatabase: database.open, probes: 'fake', harnesses: 'fake' });
  const ui = await connectUi(t, daemon.discovery);
  const sender = await inProcessSpoke(t, { discover: true, cwd: root, name: 'sender', role: 'coordinator', sessionId: 'sender-id' });
  const receiver = await inProcessSpoke(t, { discover: true, cwd: root, name: 'receiver', role: 'implementer', sessionId: 'receiver-id' });
  await sender.waitForPresence(['sender', 'receiver']);
  const created = await ui.request({ type: 'topic.create', title: 'Progress traffic' });
  assert.equal(created.ok, true);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  await ui.request({ type: 'subscribe' });
  await clock.advance(250);
  assert.ok(rebuilds > 0, 'native tracer observes initial publication');
  rebuilds = 0;
  const baseline = ui.frames.length;
  const store = new Store(join(root, '.cland', 'hub.db'));
  t.after(() => store.close());
  for (let i=0; i<1000; i++) {
    const sent = await sender.call<{ ok: boolean }>('send', { topic, to: ['receiver'], text: `Progress ${i}`, kind: 'progress' });
    assert.equal(sent.ok, true);
    assert.equal(store.topicMessages(topic, 1).at(-1)?.text, `Progress ${i}`, 'send committed');
    // Keep the real rate/loop policies enabled: each next group starts after their windows.
    if (i%20 === 19) await clock.advance(10 * 60_000 + 1);
  }
  await clock.advance(250);
  await eventually('all production companion notices', () => ui.frames.slice(baseline).filter(f => f.type === 'message' && (f.message as { kind?: string }).kind === 'agent-message').length === 1000 || undefined);
  const publications = () => ui.frames.slice(baseline).filter(f => f.type === 'inbox').length;
  assert.ok(rebuilds <= 1, `${rebuilds} rebuilds`);
  assert.equal(publications(), 0);
  // Relevant writes still invalidate and publish a durable candidate.
  const sent = await sender.call<{ ok: boolean }>('send', { topic, kind: 'request', request: 'review', subject: 'sender', text: 'Human report' });
  assert.equal(sent.ok, true);
  const report = store.topicMessages(topic, 1).at(-1)!;
  assert.equal(report.text, 'Human report');
  await clock.advance(250);
  assert.ok(rebuilds > 0);
  const inbox = await ui.request({ type: 'inbox.list' });
  await eventually('relevant inbox publication', () => publications() > 0 || undefined);
  assert.ok((inbox.value as { requests: Array<{ id: string }> }).requests.some(m => m.id === report.id));
  assert.ok(receiver);
});


test('candidate flags preserve reads, asks, hub notices and cross-topic request replies', async t => {
  const root = await tempProject(t), path = join(root, 'cases.db');
  const store = new Store(path);
  t.after(() => store.close());
  const ts = new Date().toISOString();
  for (const topic of ['waiting', 'open', 'other']) store.createTopic(topic, topic, null, ts);
  store.setTopicStatus('waiting', 'waiting for human', ts);
  const add = (id: string, topic: string, extras: Partial<import('../src/protocol.ts').Message> = {}) => {
    store.record({ id, from: 'worker', fromKind: 'agent', via: 'session', to: [], text: id, ts, topic, ...extras }, [], Date.now());
  };
  add('read', 'open'); store.markMessageRead('read');
  add('asked', 'waiting'); store.createAsk({ id: 'asked', topic: 'waiting', from: 'worker', question: '?', options: [], free: true, ts });
  add('addressed', 'waiting', { to: ['reviewer'] });
  add('retired', 'open', { from: 'hub', fromKind: 'hub', kind: 'coordinator-retired' });
  add('cleanup', 'open', { from: 'hub', fromKind: 'hub', detail: { event: 'verification-cleanup-incomplete' } });
  add('request', 'open', { kind: 'request', request: 'review', subject: 'T-1' });
  add('reply', 'other', { from: 'human', fromKind: 'human', replyTo: 'request' });
  add('waiting-replied', 'other');
  store.waitInInbox({ kind: 'message', id: 'waiting-replied', subject: 'other', since: ts });
  add('topic-reply', 'other', { from: 'human', fromKind: 'human' });
  const db = new DatabaseSync(path);
  t.after(() => db.close());
  const compare = () => {
    const expected = db.prepare(oldInboxQuery).all();
    const actual = store.inboxMessages();
    assert.deepEqual(actual.map(c => [c.message.id, c.read, c.replied, c.toHuman, c.latest]),
      expected.map(r => [r.id, r.was_read === 1, r.replied === 1, r.to_human === 1, r.latest === 1]));
    for (const c of actual) assert.deepEqual(c.message, { ...store.message(c.message.id), seq: c.message.seq, topic: c.message.topic });
    return actual;
  };
  const before = compare();
  assert.equal(before.find(c => c.message.id === 'request')?.replied, true);
  assert.ok(before.some(c => c.message.id === 'retired'));
  assert.ok(before.some(c => c.message.id === 'cleanup'));
  assert.ok(!before.some(c => c.message.id === 'asked'));
  store.departInbox({ kind: 'request', id: 'request', subject: 'T-1', since: ts }, 'replied', ts);
  assert.ok(!compare().some(c => c.message.id === 'request'));
});
