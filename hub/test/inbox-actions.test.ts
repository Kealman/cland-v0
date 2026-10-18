// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { Store } from '../src/hub/store.ts';
import { isClientRequest, type Inbox } from '../src/protocol.ts';
import { decide } from '../src/roles/permissions.ts';
import { cland, connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';

async function ok<T>(ui: Awaited<ReturnType<typeof connectUi>>, frame: Record<string, unknown> & { type: string }): Promise<T> {
  const result = await ui.request(frame);
  assert.equal(result.ok, true, `${frame.type}: ${result.error}`);
  return result.value as T;
}

test('declining a request tells its real spoke once, drops the chip and archives it through the CLI', async t => {
  const root = await tempProject(t), { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const sender = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', role: 'implementer', sessionId: 'sess-impl' });
  t.after(() => sender.close()); await sender.waitForPresence(['impl']);
  const sent = await sender.call<{ ok: boolean }>('send', { kind: 'request', request: 'review', subject: 'impl', text: 'Review this build\nLong body' });
  assert.equal(sent.ok, true);
  const before = await ok<Inbox>(ui, { type: 'inbox.list' }), row = before.requests[0]!;
  assert.equal(before.needsYou, 1);
  const after = await ok<Inbox>(ui, { type: 'inbox.decline', request: row.id });
  assert.equal(after.needsYou, 0); assert.equal(after.archiveToday, 1);
  const notice = await sender.waitForEvent(e => e.params.content.includes('The human declined request'));
  assert.match(notice.params.content, new RegExp(row.id));
  assert.match(notice.params.content, /review impl.*Review this build/);
  assert.doesNotMatch(notice.params.content, /Long body/);
  const push = await ui.waitFor(f => f.type === 'inbox' && (f.inbox as Inbox).archiveToday === 1);
  assert.equal((push.inbox as Inbox).needsYou, 0);
  for (const id of [row.id, 'unknown-request']) {
    const refused = await ui.request({ type: 'inbox.decline', request: id });
    assert.equal(refused.ok, false); assert.ok(String(refused.error).includes(id));
  }
  const frame = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.deepEqual(frame.archive?.map(r => [r.id, r.kind, r.subject, r.text, r.reason]), [[row.id, 'request', 'impl', 'Review this build', 'declined']]);
  const json = await cland(root, 'inbox', '--archive', '--json');
  assert.equal(json.code, 0, json.stderr); assert.deepEqual(JSON.parse(json.stdout), frame);
  const cli = await cland(root, 'inbox', '--archive');
  assert.equal(cli.code, 0, cli.stderr);
  assert.match(cli.stdout, /request.*impl.*Review this build.*declined/);
  assert.doesNotMatch(cli.stdout, /Long body|needs you:/);
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const journal = (await cland(root, 'hub', 'journal', '--json')).stdout.trim().split('\n').map(s => JSON.parse(s));
  assert.equal(journal.filter(r => r.event === 'inbox-departure' && r.id === row.id && r.reason === 'declined').length, 1);
});

test('individual message read and queued offline decline survive a hub restart', async t => {
  let stopHub = async () => {};
  const serve = async (...args: Parameters<typeof projectHub>) => {
    const hub = await projectHub(...args);
    stopHub = hub.stop;
    return hub;
  };
  const root = await tempProject(t), { discovery } = await serve(t, root);
  const ui = await connectUi(t, discovery);
  const sender = await inProcessSpoke(t, { discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-aide' });
  t.after(() => sender.close()); await sender.waitForPresence(['aide-1']);
  for (const text of ['First message', 'Second message', 'Third message']) assert.equal((await sender.call<{ ok: boolean }>('send', { text })).ok, true);
  const before = await ok<Inbox>(ui, { type: 'inbox.list' });
  const id = before.messages[1]!.id;
  const after = await ok<Inbox>(ui, { type: 'inbox.read', message: id });
  assert.deepEqual(after.messages.map(r => r.text), ['Third message', 'First message']);
  const topics = await ok<{ topics: Array<{ id: string; unread: number }> }>(ui, { type: 'topic.list' });
  assert.equal(topics.topics.find(r => r.id === 'general')?.unread, 2);
  assert.equal((await ui.request({ type: 'inbox.read', message: id })).ok, false);
  assert.equal((await ui.request({ type: 'inbox.read', message: 'missing' })).ok, false);
  assert.equal((await sender.call<{ ok: boolean }>('send', { kind: 'request', request: 'handover', subject: 'aide-1', text: 'Take over the build' })).ok, true);
  const req = (await ok<Inbox>(ui, { type: 'inbox.list' })).requests[0]!;
  await sender.close();
  await ok(ui, { type: 'inbox.decline', request: req.id });
  const archived = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.deepEqual(archived.archive?.map(r => r.reason), ['declined', 'read']);
  await stopHub();
  const restarted = await serve(t, root), again = await connectUi(t, restarted.discovery);
  const persisted = await ok<Inbox>(again, { type: 'inbox.list', archive: true });
  assert.deepEqual(persisted.archive, archived.archive);
  assert.deepEqual(persisted.messages.map(r => r.text), ['Third message', 'First message']);
  assert.equal(persisted.requests.length, 0);
  const reconnected = await inProcessSpoke(t, { discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-aide' });
  t.after(() => reconnected.close()); await reconnected.waitForPresence(['aide-1']);
  const notice = await reconnected.waitForEvent(e => e.params.content.includes('The human declined request'));
  assert.ok(notice.params.content.includes(req.id));
  assert.equal(reconnected.events.filter(e => e.params.content.includes('The human declined request')).length, 1);
  await ok(again, { type: 'topic.send', topic: 'general', text: 'Answered remaining messages' });
  const answered = await ok<Inbox>(again, { type: 'inbox.list', archive: true });
  assert.equal(answered.needsYou, 0);
  assert.deepEqual(answered.archive?.slice(0, 2).map(r => r.reason), ['answered', 'answered']);
});

test('human-only row actions refuse session CLI frames and remain forbidden even with explicit role grants', async t => {
  const root = await tempProject(t), { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const sender = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => sender.close()); await sender.waitForPresence(['coord']);
  for (const type of ['inbox.decline', 'inbox.read']) {
    const result = await ui.request({ type, request: 'r', message: 'm', as: { name: 'coord', sessionId: 'sess-coord' } });
    assert.equal(result.ok, false); assert.match(String(result.error), /only the human/);
    for (const role of ['coordinator', 'aide', 'implementer', 'reviewer', 'qa', null]) assert.equal(decide(role, [type], { tool: type }).ok, false);
  }
  assert.equal(isClientRequest({ type: 'inbox.list', id: 'i', archive: 'true' }), false);
  assert.equal(isClientRequest({ type: 'inbox.list', id: 'i', archive: true }), true);
});

test('archive time ranges use the timestamp index, retain first lines, and exclude departures older than seven days', async t => {
  const root = await tempProject(t); await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/hub.db'), store = new Store(path), now = Date.now();
  store.transaction(() => {
    for (let i = 0; i < 3000; i++) {
      const ts = new Date(now - 30 * 86400000).toISOString();
      const row = { kind: 'request' as const, id: `old-${i}`, subject: 'historical', since: ts };
      store.departInbox(row, 'replied', ts, `Old ${i}`);
    }
    const old = new Date(now - 10 * 86400000).toISOString();
    store.createTopic('old-reply', 'Old reply', null, old);
    store.record({ id: 'old-request', topic: 'old-reply', from: 'aide-1', fromKind: 'agent', via: 'session', to: [], kind: 'request', request: 'review', subject: 'historical', text: 'Old same-tick request', ts: old }, [], now - 10 * 86400000);
    store.record({ id: 'old-answer', topic: 'old-reply', from: 'human', fromKind: 'human', via: 'session', to: [], text: 'Old reply', ts: old }, [], now - 10 * 86400000);
    const row = { kind: 'request' as const, id: 'recent', subject: 'T-1', since: new Date(now).toISOString() };
    store.departInbox(row, 'declined', row.since, 'Recent first line');
  }); store.close();
  const db = new DatabaseSync(path);
  const plan = db.prepare('explain query plan select * from inbox_departures where ts >= ? order by ts desc, number desc').all(new Date(now - 7 * 86400000).toISOString());
  assert.match(JSON.stringify(plan), /SEARCH.*inbox_departures.*inbox_departures_time.*ts>/);
  db.close();
  const { discovery } = await projectHub(t, root), ui = await connectUi(t, discovery);
  const frame = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.deepEqual(frame.archive?.map(r => r.id), ['recent']); assert.equal(frame.archiveToday, 1);
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).archive, undefined);
});

test('a row reply reaches its original sender and archives request and message first lines', async t => {
  const root = await tempProject(t), { discovery } = await projectHub(t, root), ui = await connectUi(t, discovery);
  const sender = await inProcessSpoke(t, { discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-aide' });
  t.after(() => sender.close()); await sender.waitForPresence(['aide-1']);
  for (const kind of ['request', 'report']) {
    assert.equal((await sender.call<{ ok: boolean }>('send', { kind, text: `Reply to ${kind}\nSecond line`, ...(kind === 'request' ? { request: 'qa', subject: 'aide-1' } : {}) })).ok, true);
    const before = await ok<Inbox>(ui, { type: 'inbox.list' });
    const row = kind === 'request' ? before.requests[0]! : before.messages[0]!;
    const result = await ok<{ message: { to: string[]; replyTo: string } }>(ui, { type: 'topic.send', topic: row.topic.id, replyTo: row.id, text: `Human reply to ${kind}` });
    assert.deepEqual(result.message.to, ['aide-1']); assert.equal(result.message.replyTo, row.id);
    await sender.waitForEvent(e => e.params.content.includes(`Human reply to ${kind}`));
    const after = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
    assert.equal(after.needsYou, 0);
    assert.equal(after.archive?.[0]?.reason, kind === 'request' ? 'replied' : 'answered');
    assert.equal(after.archive?.[0]?.text, `Reply to ${kind}`);
  }
});
