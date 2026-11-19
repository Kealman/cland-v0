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
import { tempProject, projectHub, connectUi, inProcessSpoke, eventually } from './harness.ts';

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
