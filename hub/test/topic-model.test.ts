// The topic model (spec 4.5, #32): statuses that follow the direction of messages, `resolve` and `close`; mentions
// in the human's messages; the "no coordinator" warning; agent- and human-created topics, their binding to a unit
// of work through the tracker; unread counts. A real hub (in-process, or the daemon where the tracker is needed),
// scripted spokes over MCP and a UI client speaking the frames; nothing inside either side is reached into.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { fixedRoles } from '../src/roles/config.ts';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, connectUi, connectWsUi, sleep, spawnSpoke, startDaemon, startHub, tempProject, type FrameClient, type Session } from './harness.ts';
import type { Hub } from '../src/hub/server.ts';

type Topic = { id: string; title: string; status: string; standing: boolean; item: string | null; unread: number; lastMessageAt: string | null; warning?: string };
type TopicMessage = { id: string; topic: string; from: string; to: string[]; text: string; stage?: string };
type Outcome = { to: string; outcome: string; reason?: string };

/** An in-process hub enforcing the default permission table (#30), as a project's hub does. */
async function hubFor(t: TestContext): Promise<Hub> {
  const hub = await startHub({ roles: fixedRoles() });
  t.after(() => hub.close());
  return hub;
}

/** A scripted session; with `role`, the human assigns it first (`role.set`), as a hub with a role table requires. */
async function spoke(t: TestContext, hub: Hub, name: string, role?: string): Promise<Session> {
  if (role) {
    const human = await connectWsUi(t, hub);
    await ok(human, { type: 'role.set', session: name, role });
  }
  const s = await spawnSpoke({ hub, name, sessionId: `sess-${name}`, ...(role ? { role } : {}) });
  t.after(() => s.close());
  return s;
}

async function ok<T>(ui: FrameClient, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const r = await ui.request(frame);
  assert.equal(r.ok, true, `${frame.type}: ${r.error}`);
  return r.value as T;
}

const create = async (ui: FrameClient, title: string, item?: string) => (await ok<{ topic: Topic }>(ui, { type: 'topic.create', title, ...(item ? { item } : {}) })).topic;
const send = (ui: FrameClient, topic: string, text: string) => ok<{ message: TopicMessage; outcomes: Outcome[] }>(ui, { type: 'topic.send', topic, text });
const listed = async (ui: FrameClient) => (await ok<{ topics: Topic[] }>(ui, { type: 'topic.list' })).topics;
const topicOf = async (ui: FrameClient, id: string) => (await listed(ui)).find((x) => x.id === id) as Topic;

/** The next `topic` event about `id` (after `from` frames) that matches. */
const topicEvent = (ui: FrameClient, id: string, match: (t: Topic) => boolean, from = 0, timeoutMs = 10_000) =>
  ui.waitFor((f) => f.type === 'topic' && (f.topic as Topic).id === id && match(f.topic as Topic) && ui.frames.indexOf(f) >= from, timeoutMs).then((f) => f.topic as Topic);

test('the status follows the direction: the human waits for an agent, the reply opens it, resolve clears a wait, close closes, a new message reopens', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });

  const topic = await create(ui, '  Spoke reconnect: flaky test  ');
  assert.equal(topic.title, 'Spoke reconnect: flaky test');
  assert.equal(topic.status, 'open');
  assert.equal(topic.item, null);
  assert.equal(topic.standing, false);
  await topicEvent(ui, topic.id, (x) => x.status === 'open');

  let mark = ui.frames.length;
  await send(ui, topic.id, 'is it the reconnect timer?');
  await topicEvent(ui, topic.id, (x) => x.status === 'waiting for agent', mark);
  const delivered = await coord.waitForEvent((e) => e.params.content === 'is it the reconnect timer?');
  assert.equal(delivered.params.meta?.topic, topic.id);
  assert.equal(delivered.params.meta?.topic_title, 'Spoke reconnect: flaky test');

  mark = ui.frames.length;
  const reply = await coord.call<{ ok: boolean; topic: { id: string } }>('send', { topic: topic.id, text: 'yes: 50 ms is too short under load' });
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal((await topicEvent(ui, topic.id, (x) => x.status === 'open', mark)).status, 'open');

  // the Coordinator clears a wait with its `resolve` tool
  mark = ui.frames.length;
  await send(ui, topic.id, 'raise it then');
  await topicEvent(ui, topic.id, (x) => x.status === 'waiting for agent', mark);
  const resolved = await coord.call<{ ok: boolean; topic: Topic }>('resolve', { topic: topic.id });
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.equal(resolved.topic.status, 'open');
  await topicEvent(ui, topic.id, (x) => x.status === 'open', mark);

  // and the human with the UI's `topic.resolve`
  await send(ui, topic.id, 'one more thing');
  assert.equal((await topicOf(ui, topic.id)).status, 'waiting for agent');
  assert.equal((await ok<{ topic: Topic }>(ui, { type: 'topic.resolve', topic: topic.id })).topic.status, 'open');

  // closed by the human; resolve has nothing to clear there; a new message reopens it, as its direction says
  mark = ui.frames.length;
  assert.equal((await ok<{ topic: Topic }>(ui, { type: 'topic.close', topic: topic.id })).topic.status, 'closed');
  await topicEvent(ui, topic.id, (x) => x.status === 'closed', mark);
  const refused = await coord.call<{ ok: boolean; error: string }>('resolve', { topic: topic.id });
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'the topic is closed: a new message reopens it');
  await coord.call('send', { topic: topic.id, text: 'the fix is merged' });
  assert.equal((await topicOf(ui, topic.id)).status, 'open');
  await ok(ui, { type: 'topic.close', topic: topic.id });
  await send(ui, topic.id, 'reopening: it failed again');
  assert.equal((await topicOf(ui, topic.id)).status, 'waiting for agent');

  // the standing topics are never closed; Agents has no status to resolve
  const general = await ui.request({ type: 'topic.close', topic: 'general' });
  assert.equal(general.error, 'General is a standing topic: it cannot be closed');
  const agents = await ui.request({ type: 'topic.resolve', topic: 'agents' });
  assert.equal(agents.ok, false);
  assert.match(String(agents.error), /Agents has no status to resolve/);
});

test('@reviewer in the text reaches the Reviewer holder, whose reply lands in the same topic; @name reaches that session; no mention, the Coordinator', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  const rev = await spoke(t, hub, 'rev-1', 'reviewer');
  const impl = await spoke(t, hub, 'impl-a', 'implementer');
  await coord.waitForPresence(['coord', 'rev-1', 'impl-a']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const topic = await create(ui, 'Review of T-12');

  const toReviewer = await send(ui, topic.id, '@reviewer does the diff hold?');
  assert.deepEqual(toReviewer.message.to, ['rev-1']);
  assert.deepEqual(toReviewer.outcomes, [{ to: 'reviewer', outcome: 'delivered' }]);
  const asked = await rev.waitForEvent((e) => e.params.content === '@reviewer does the diff hold?');
  assert.equal(asked.params.meta?.topic, topic.id);
  assert.equal((await topicOf(ui, topic.id)).status, 'waiting for agent');

  // the reviewer answers the human in the topic the event came from: a session the human's latest message there
  // mentioned may reply to the human in that topic (spec 4.4 and 4.5), and the reply answers the wait
  const mark = ui.frames.length;
  const direct = await rev.call<{ ok: boolean; error?: string }>('send', { topic: asked.params.meta?.topic, text: 'it holds', reply_to: asked.params.meta?.msg_id });
  assert.equal(direct.ok, true, direct.error);
  const answer = (await ui.waitFor((f) => f.type === 'message' && (f.message as TopicMessage).from === 'rev-1')) as { topic: { id: string }; message: TopicMessage };
  assert.equal(answer.topic.id, topic.id);
  assert.deepEqual(answer.message.to, [], 'the reply is to the human');
  await topicEvent(ui, topic.id, (x) => x.status === 'open', mark);
  const history = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: topic.id });
  assert.deepEqual(history.messages.map((m) => [m.from, m.to, m.text]), [
    ['human', ['rev-1'], '@reviewer does the diff hold?'],
    ['rev-1', [], 'it holds'],
  ]);

  // a session by name; the Coordinator heard none of it
  const toImpl = await send(ui, topic.id, 'and @impl-a, rebase please');
  assert.deepEqual(toImpl.message.to, ['impl-a']);
  await impl.waitForEvent((e) => e.params.content === 'and @impl-a, rebase please');
  // an addressed agent answering the others in the topic answers the wait too
  await impl.call('send', { topic: topic.id, to: ['rev-1'], text: 'rebased, have another look' });
  await rev.waitForEvent((e) => e.params.content === 'rebased, have another look');
  assert.equal((await topicOf(ui, topic.id)).status, 'open');

  // no mention (an address-like word that is no session is reported, not addressed): the Coordinator
  const plain = await send(ui, topic.id, 'thanks both; ping me at @nobody-here later');
  assert.deepEqual(plain.message.to, ['coord']);
  assert.deepEqual(
    plain.outcomes.map((o) => [o.to, o.outcome]),
    [
      ['nobody-here', 'unknown'],
      ['coordinator', 'delivered'],
    ],
  );
  await coord.waitForEvent((e) => e.params.content === 'thanks both; ping me at @nobody-here later');
  await sleep(200);
  assert.equal(coord.events.filter((e) => String(e.params.content).includes('diff hold') || String(e.params.content).includes('rebase')).length, 0);
});

test('a message to a vacant Coordinator is queued: the topic waits for an agent with the "no coordinator" warning until a holder takes it', async (t) => {
  const hub = await hubFor(t);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const topic = await create(ui, 'Plan for slice 2');

  const { message, outcomes } = await send(ui, topic.id, 'what is next?');
  assert.equal(message.stage, 'queued');
  assert.deepEqual(outcomes.map((o) => [o.to, o.outcome]), [['coordinator', 'queued']]);
  const waiting = await topicEvent(ui, topic.id, (x) => x.status === 'waiting for agent');
  assert.equal(waiting.warning, 'no coordinator');
  assert.equal((await topicOf(ui, topic.id)).warning, 'no coordinator');

  // a session without a role stays off the hub: nothing changes; the human assigns it the Coordinator: it
  // connects on its next retry and takes the message
  const coord = await spoke(t, hub, 'coord');
  await sleep(300);
  assert.equal((await topicOf(ui, topic.id)).warning, 'no coordinator');
  const mark = ui.frames.length;
  await ok(ui, { type: 'role.set', session: 'coord', role: 'coordinator' });
  await coord.waitForEvent((e) => e.params.content === 'what is next?', 15_000);
  const cleared = await topicEvent(ui, topic.id, (x) => x.warning === undefined, mark);
  assert.equal(cleared.status, 'waiting for agent', 'the human still waits for the answer');
  assert.equal((await topicOf(ui, topic.id)).warning, undefined);
  await ui.waitFor((f) => f.type === 'delivery' && f.message === message.id && f.stage === 'delivered');
});

test('an agent-created topic needs a title, is listed last until its first message, and cannot be bound on a hub with no tracker', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });

  for (const args of [{}, { title: '   ' }]) {
    const r = await coord.call<{ ok: boolean; error: string }>('topic.create', args);
    assert.equal(r.ok, false);
    assert.match(r.error, /topic\.create needs a `title`|a topic needs a title/);
  }
  const fromUi = await ui.request({ type: 'topic.create', title: '' });
  assert.equal(fromUi.error, 'a topic needs a title');
  const bound = await coord.call<{ ok: boolean; error: string }>('topic.create', { title: 'About T-1', item: 'T-1' });
  assert.equal(bound.ok, false);
  assert.match(bound.error, /no tracker/);

  const made = await coord.call<{ ok: boolean; topic: Topic }>('topic.create', { title: 'Which free model?' });
  assert.equal(made.ok, true, JSON.stringify(made));
  assert.equal(made.topic.status, 'open');
  assert.equal(made.topic.lastMessageAt, null);
  await topicEvent(ui, made.topic.id, (x) => x.title === 'Which free model?');
  const older = await create(ui, 'Older but talked in');
  await send(ui, older.id, 'hello');
  assert.deepEqual((await listed(ui)).map((x) => x.id), ['general', 'agents', older.id, made.topic.id], 'a topic with no message comes last');
  await coord.call('send', { topic: made.topic.id, text: 'OpenCode lists three; I pick big-pickle unless you object' });
  assert.deepEqual((await listed(ui)).map((x) => x.id), ['general', 'agents', made.topic.id, older.id], 'then it sorts by activity');
});

test('the human has unread counts per topic: messages from others since the last read; topic.read marks them read', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const topic = await create(ui, 'Counting');
  assert.equal(topic.unread, 0);

  for (const text of ['one', 'two', 'three']) await coord.call('send', { topic: topic.id, text });
  assert.equal((await topicOf(ui, topic.id)).unread, 3);
  assert.equal((await topicOf(ui, 'general')).unread, 0);
  const history = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: topic.id });
  const mark = ui.frames.length;
  const read = await ok<{ topic: Topic }>(ui, { type: 'topic.read', topic: topic.id, upTo: history.messages[0]?.id });
  assert.equal(read.topic.unread, 2);
  assert.equal((await topicEvent(ui, topic.id, (x) => x.unread === 2, mark)).unread, 2);
  // reading never moves back
  await ok(ui, { type: 'topic.read', topic: topic.id });
  assert.equal((await topicOf(ui, topic.id)).unread, 0);
  assert.equal((await ok<{ topic: Topic }>(ui, { type: 'topic.read', topic: topic.id, upTo: history.messages[1]?.id })).topic.unread, 0);
  const unknown = await ui.request({ type: 'topic.read', topic: topic.id, upTo: 'nope' });
  assert.equal(unknown.error, 'no message "nope" in this topic');

  // the human's own message is never unread, and writing reads what came before it
  await coord.call('send', { topic: topic.id, text: 'four' });
  assert.equal((await topicOf(ui, topic.id)).unread, 1);
  await send(ui, topic.id, 'got them');
  assert.equal((await topicOf(ui, topic.id)).unread, 0);
});

test("a topic bound to an item: the item's topic field is set, a second topic for it is refused, and closing the item closes the topic", async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const item = (await ok<{ item: { id: string } }>(ui, { type: 'task.create', title: 'Hub daemon and spoke hello' })).item.id;
  assert.equal(item, 'T-1');

  // an agent opens the task's topic
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const made = await coord.call<{ ok: boolean; topic: Topic }>('topic.create', { title: 'T-1: which port?', item: 't-1' });
  assert.equal(made.ok, true, JSON.stringify(made));
  assert.equal(made.topic.item, 'T-1');
  const view = await ok<{ item: { topic: string | null } }>(ui, { type: 'task.view', item: 'T-1' });
  assert.equal(view.item.topic, made.topic.id, "the item's topic field names the topic");
  assert.equal((await topicOf(ui, made.topic.id)).item, 'T-1');

  // one topic per unit of work, whoever asks
  const again = await ui.request({ type: 'topic.create', title: 'T-1 again', item: 'T-1' });
  assert.equal(again.ok, false);
  assert.equal(again.error, `T-1 already has a topic: "T-1: which port?" (${made.topic.id}); one topic per unit of work: write there`);
  const byAgent = await coord.call<{ ok: boolean; error: string }>('topic.create', { title: 'T-1 a third time', item: 'T-1' });
  assert.equal(byAgent.ok, false);
  assert.match(byAgent.error, /T-1 already has a topic/);
  const missing = await ui.request({ type: 'topic.create', title: 'About nothing', item: 'T-9' });
  assert.equal(missing.error, 'no item T-9');

  // a delivery carries the binding
  await send(ui, made.topic.id, 'the hub picks a free one');
  const event = await coord.waitForEvent((e) => e.params.content === 'the hub picks a free one');
  assert.equal(event.params.meta?.topic_item, 'T-1');

  // closing the item closes its topic; a message reopens the topic, never the item
  const mark = ui.frames.length;
  await ok(ui, { type: 'task.close', item: 'T-1' });
  await topicEvent(ui, made.topic.id, (x) => x.status === 'closed', mark);
  await coord.call('send', { topic: made.topic.id, text: 'noted, closing out' });
  assert.equal((await topicOf(ui, made.topic.id)).status, 'open');
  assert.equal((await ok<{ item: { state: string } }>(ui, { type: 'task.view', item: 'T-1' })).item.state, 'closed');
  const late = await ui.request({ type: 'topic.create', title: 'Too late', item: 'T-1' });
  assert.match(String(late.error), /T-1 already has a topic/);
});

// ------------------------------------------------------------------ one binding, startup reconciliation, unread past retention (review of #32)

test('task.link and task.create with a topic go through the binding: one topic per item and one item per topic, both sides agree, and closing the item closes it', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  for (const title of ['First', 'Second']) await ok(ui, { type: 'task.create', title });
  const a = await create(ui, 'Topic A');
  const b = await create(ui, 'Topic B');
  const view = async (item: string) => (await ok<{ item: { topic: string | null; state: string } }>(ui, { type: 'task.view', item })).item;

  // link binds: the topic names the item and the item names the topic
  await ok(ui, { type: 'task.link', item: 'T-1', topic: a.id });
  assert.equal((await topicOf(ui, a.id)).item, 'T-1');
  assert.equal((await view('T-1')).topic, a.id);

  // a second item for the same topic is refused, by link and by create; nothing is written
  const second = await ui.request({ type: 'task.link', item: 'T-2', topic: a.id });
  assert.equal(second.ok, false);
  assert.match(String(second.error), new RegExp(`${a.id} is already bound to T-1`));
  assert.equal((await view('T-2')).topic, null);
  const made = await ui.request({ type: 'task.create', title: 'Third', topic: a.id });
  assert.equal(made.ok, false);
  assert.match(String(made.error), new RegExp(`${a.id} is already bound to T-1`));
  assert.equal((await ok<{ items: unknown[] }>(ui, { type: 'task.list' })).items.length, 2, 'no item was created');

  // a second topic for the same item is refused
  const other = await ui.request({ type: 'task.link', item: 'T-1', topic: b.id });
  assert.equal(other.ok, false);
  assert.match(String(other.error), /T-1 already has a topic/);
  assert.equal((await topicOf(ui, b.id)).item, null);

  // a topic that does not exist, or a standing one, cannot be bound
  assert.match(String((await ui.request({ type: 'task.link', item: 'T-2', topic: 'topic-99' })).error), /no topic "topic-99"/);
  assert.match(String((await ui.request({ type: 'task.link', item: 'T-2', topic: 'general' })).error), /standing/);

  // create binds too
  const third = (await ok<{ item: { id: string; topic: string | null } }>(ui, { type: 'task.create', title: 'Third', topic: b.id })).item;
  assert.equal(third.topic, b.id);
  assert.equal((await topicOf(ui, b.id)).item, third.id);

  // linking to null unbinds both sides; the topic can then be bound again
  await ok(ui, { type: 'task.link', item: third.id, topic: null });
  assert.equal((await topicOf(ui, b.id)).item, null);
  assert.equal((await view(third.id)).topic, null);
  await ok(ui, { type: 'task.link', item: 'T-2', topic: b.id });
  assert.equal((await topicOf(ui, b.id)).item, 'T-2');

  // closing a linked item closes its topic
  const mark = ui.frames.length;
  await ok(ui, { type: 'task.close', item: 'T-1' });
  await topicEvent(ui, a.id, (x) => x.status === 'closed', mark);
});

test('an item closed while the hub was stopped closes its topic when the hub starts again', async (t) => {
  const root = await tempProject(t);
  const first = await startDaemon(t, root);
  let ui = await connectUi(t, first.discovery);
  await ok(ui, { type: 'task.create', title: 'Close me offline' });
  const topic = await create(ui, 'About T-1', 'T-1');
  assert.equal(topic.item, 'T-1');
  ui.close();
  const stopped = await cland(root, 'hub', 'stop');
  assert.equal(stopped.code, 0, stopped.stderr);

  // a hand edit while nothing watches
  const dir = join(root, '.cland', 'tasks');
  const file = (await readdir(dir)).find((n) => n.startsWith('T-1-')) as string;
  await writeFile(join(dir, file), (await readFile(join(dir, file), 'utf8')).replace(/^state: open$/m, 'state: closed'));

  const again = await startDaemon(t, root);
  ui = await connectUi(t, again.discovery);
  assert.equal((await topicOf(ui, topic.id)).status, 'closed');
});

test('a hub.db written before the message sequence, its messages pruned: the migrated watermark hides no new message', async (t) => {
  const root = await tempProject(t);
  // the shape an older hub left: no `seq`, no `read_seq`; the human had read up to rowid 1000, then retention emptied
  // the messages table
  await mkdir(join(root, '.cland'), { recursive: true });
  const old = new DatabaseSync(join(root, '.cland', 'hub.db'));
  old.exec(`
    create table messages (id text primary key, from_name text not null, from_kind text not null, from_role text, via text not null,
      to_json text not null, text text not null, reply_to text, ts text not null, created_at integer not null, topic text);
    create table topics (id text primary key, title text not null, status text not null, standing integer not null default 0,
      created_at text not null, updated_at text not null, item text, read_rowid integer not null default 0);
  `);
  const at = '2026-10-01T00:00:00.000Z';
  old.prepare('insert into topics (id, title, status, standing, created_at, updated_at, read_rowid) values (?, ?, ?, 0, ?, ?, 1000)').run('t-old', 'Read long ago', 'open', at, at);
  old.prepare("insert into messages (id, from_name, from_kind, via, to_json, text, ts, created_at, topic) values ('m-1', 'coord', 'session', 'spoke', '[]', 'x', ?, 0, 't-old')").run(at);
  old.exec('delete from messages');
  old.close();

  const { discovery } = await startDaemon(t, root);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'sess-coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const ui = await connectUi(t, discovery);
  assert.equal((await topicOf(ui, 't-old')).unread, 0);
  await coord.call('send', { topic: 't-old', text: 'after the migration' });
  assert.equal((await topicOf(ui, 't-old')).unread, 1);
  await ok(ui, { type: 'topic.read', topic: 't-old' });
  assert.equal((await topicOf(ui, 't-old')).unread, 0);
});

test('the unread count survives retention emptying the messages table: a message after the prune is unread', async (t) => {
  let clock = Date.parse('2026-10-01T00:00:00Z');
  const hub = await startHub({ roles: fixedRoles(), now: () => new Date(clock), retentionMs: 60_000 });
  t.after(() => hub.close());
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  const topic = await create(ui, 'Kept a while');
  for (const text of ['one', 'two', 'three']) await coord.call('send', { topic: topic.id, text });
  await ok(ui, { type: 'topic.read', topic: topic.id });
  assert.equal((await topicOf(ui, topic.id)).unread, 0);

  clock += 120_000;
  assert.ok(hub.prune() >= 3, 'the old messages went');
  assert.deepEqual((await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: topic.id })).messages, []);
  await coord.call('send', { topic: topic.id, text: 'after the prune' });
  assert.equal((await topicOf(ui, topic.id)).unread, 1);
  await ok(ui, { type: 'topic.read', topic: topic.id });
  assert.equal((await topicOf(ui, topic.id)).unread, 0);
});
