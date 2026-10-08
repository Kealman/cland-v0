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
  assert.equal(store.prune(10_000, 5_000), 1);
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
  core.store.close();
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
  core.store.close();
});
