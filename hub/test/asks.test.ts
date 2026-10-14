// Asks and the inbox (spec 4.5 and 5, #33): only the Coordinator asks; an open ask keeps its topic waiting for the
// human and is listed in the inbox; the human's answer carries `answer_to`, reaches the asker and clears the wait;
// `resolve` withdraws, closing cancels; approvals follow the sessions' states; role changes reach events; "needs you" is asks + approvals + waiting topics. A real hub
// (in-process, or the daemon where the tracker and the adapters are needed), scripted spokes over MCP, a UI client
// speaking the frames; nothing inside either side is reached into.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, connectWsUi, sleep, eventually, fakeClaude, spawnSpoke, startDaemon, startHub, tempProject, type FrameClient, type Session } from './harness.ts';
import type { Hub } from '../src/hub/server.ts';
import { Store } from '../src/hub/store.ts';

type Topic = { id: string; title: string; status: string; item: string | null };
type Card = { question: string; options: string[]; free: boolean; state: string; answer?: string; option?: number };
type TopicMessage = { id: string; topic: string; from: string; fromKind: string; to: string[]; text: string; answerTo?: string; ask?: Card };
type InboxAsk = { id: string; topic: { id: string; title: string }; question: string; options: string[]; free: boolean; from: string; label: string };
type Approval = { session: string; label: string; harness: string | null; attach: string | null };
type Inbox = { asks: InboxAsk[]; approvals: Approval[]; waiting: Topic[]; needsYou: number };
type AskResult = { ok: boolean; ask: string; topic: { id: string }; error?: string; code?: string; permission?: string; role?: string | null; reason?: string };

async function hubFor(t: TestContext, options: Parameters<typeof startHub>[0] = {}): Promise<Hub> {
  const hub = await startHub(options);
  t.after(() => hub.close());
  return hub;
}

async function spoke(t: TestContext, hub: Hub, name: string, role?: string): Promise<Session> {
  const s = await spawnSpoke({ hub, name, sessionId: `sess-${name}`, ...(role ? { role } : {}) });
  t.after(() => s.close());
  await s.waitForPresence([name]);
  return s;
}

async function ok<T>(ui: FrameClient, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const r = await ui.request(frame);
  assert.equal(r.ok, true, `${frame.type}: ${r.error}`);
  return r.value as T;
}

const inbox = (ui: FrameClient) => ok<Inbox>(ui, { type: 'inbox.list' });
const topicOf = async (ui: FrameClient, id: string) => (await ok<{ topics: Topic[] }>(ui, { type: 'topic.list' })).topics.find((x) => x.id === id) as Topic;
const history = async (ui: FrameClient, id: string) => (await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: id })).messages;
/** The next `inbox` event (after `from` frames) that matches. */
const inboxEvent = (ui: FrameClient, match: (i: Inbox) => boolean, from = 0, timeoutMs = 10_000) =>
  ui.waitFor((f) => f.type === 'inbox' && ui.frames.indexOf(f) >= from && match(f.inbox as Inbox), timeoutMs).then((f) => f.inbox as Inbox);

async function ask(s: Session, topic: string, question: string, options: string[], free?: boolean): Promise<AskResult> {
  return s.call<AskResult>('ask', { topic, question, options, ...(free !== undefined ? { free } : {}) });
}

test('only the Coordinator asks: an Implementer is refused with the typed forbidden error; an ask is a card in the thread, waits for the human and is listed in the inbox', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  const impl = await spoke(t, hub, 'impl-1', 'implementer');
  await coord.waitForPresence(['coord', 'impl-1']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const topic = (await ok<{ topic: Topic }>(ui, { type: 'topic.create', title: 'Spoke identity' })).topic;

  const refused = await ask(impl, topic.id, 'which should win?', ['the name', 'the session id']);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'forbidden');
  assert.equal(refused.permission, 'ask');
  assert.equal(refused.role, 'implementer');
  assert.match(String(refused.reason), /only the Coordinator asks the human/);
  assert.match(String(refused.error), /^forbidden: ask \(/);
  assert.equal((await topicOf(ui, topic.id)).status, 'open', 'a refused ask changes nothing');
  assert.equal((await inbox(ui)).asks.length, 0);

  const mark = ui.frames.length;
  const asked = await ask(coord, topic.id, 'Spoke identity on reconnect: which should win?', ['the name recorded by the spoke', 'the harness session id', 'ask me later']);
  assert.equal(asked.ok, true, JSON.stringify(asked));
  assert.equal(asked.topic.id, topic.id);
  // the message event carries the card
  const event = (await ui.waitFor((f) => f.type === 'message' && (f.message as TopicMessage).id === asked.ask)) as { message: TopicMessage };
  assert.equal(event.message.text, 'Spoke identity on reconnect: which should win?');
  assert.deepEqual(event.message.ask, { question: 'Spoke identity on reconnect: which should win?', options: ['the name recorded by the spoke', 'the harness session id', 'ask me later'], free: true, state: 'open' });
  await ui.waitFor((f) => f.type === 'topic' && (f.topic as Topic).id === topic.id && (f.topic as Topic).status === 'waiting for human' && ui.frames.indexOf(f) >= mark);
  // and the inbox follows within one event
  const listed = await inboxEvent(ui, (i) => i.asks.length === 1, mark);
  assert.deepEqual(listed.asks.map((a) => [a.id, a.topic.id, a.topic.title, a.question, a.options.length, a.free, a.from, a.label]), [
    [asked.ask, topic.id, 'Spoke identity', 'Spoke identity on reconnect: which should win?', 3, true, 'coord', 'coord [Coordinator]'],
  ]);
  assert.equal(listed.needsYou, 1);
  assert.deepEqual(listed.waiting, [], 'a topic with an open ask is listed under asks, not waiting');
  assert.equal((await history(ui, topic.id)).find((m) => m.id === asked.ask)?.ask?.state, 'open');

  // asks are bounded and checked
  for (const [args, error] of [
    [{ topic: topic.id, question: '  ', options: ['a'] }, /an ask needs a question/],
    [{ topic: topic.id, question: 'q', options: Array.from({ length: 10 }, (_, i) => `o${i}`) }, /at most 9 options/],
    [{ topic: topic.id, question: 'q', options: [], free: false }, /needs options or a free answer/],
    [{ topic: 'agents', question: 'q', options: ['a'] }, /Agents is a record/],
    [{ topic: 'topic-99', question: 'q', options: ['a'] }, /no topic "topic-99"/],
  ] as const) {
    const r = await coord.call<{ ok: boolean; error: string }>('ask', args);
    assert.equal(r.ok, false, JSON.stringify(args));
    assert.match(r.error, error);
  }
});

test('answering with option 2 posts the option as a message with answer_to, delivers it to the asker, clears the wait and the inbox row; the card shows the answer', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const asked = await ask(coord, 'general', 'Which port?', ['a fixed one', 'a free one, picked at start']);
  assert.equal(asked.ok, true, JSON.stringify(asked));
  assert.equal((await topicOf(ui, 'general')).status, 'waiting for human');

  const mark = ui.frames.length;
  const answered = await ok<{ message: TopicMessage }>(ui, { type: 'topic.answer', ask: asked.ask, option: 2 });
  assert.equal(answered.message.text, 'a free one, picked at start');
  assert.equal(answered.message.answerTo, asked.ask);
  assert.equal(answered.message.fromKind, 'human');
  assert.deepEqual(answered.message.to, ['coord'], 'the asker is the addressee');
  const event = (await ui.waitFor((f) => f.type === 'message' && (f.message as TopicMessage).id === answered.message.id)) as { message: TopicMessage };
  assert.equal(event.message.answerTo, asked.ask, 'the message event carries answerTo');
  const delivered = await coord.waitForEvent((e) => e.params.content === 'a free one, picked at start');
  assert.equal(delivered.params.meta?.answer_to, asked.ask);
  assert.equal(delivered.params.meta?.from_kind, 'human');
  assert.equal(delivered.params.meta?.topic, 'general');

  // the wait is cleared: the human spoke last, so the topic waits for the agent
  await ui.waitFor((f) => f.type === 'topic' && (f.topic as Topic).id === 'general' && (f.topic as Topic).status === 'waiting for agent' && ui.frames.indexOf(f) >= mark);
  const card = (await ui.waitFor((f) => f.type === 'ask' && f.ask === asked.ask && ui.frames.indexOf(f) >= mark)) as { topic: string; card: Card };
  assert.equal(card.topic, 'general');
  assert.deepEqual(card.card, { question: 'Which port?', options: ['a fixed one', 'a free one, picked at start'], free: true, state: 'answered', answer: answered.message.id, option: 2 });
  await inboxEvent(ui, (i) => i.asks.length === 0 && i.needsYou === 0, mark);
  const messages = await history(ui, 'general');
  assert.deepEqual(messages.find((m) => m.id === asked.ask)?.ask, card.card);
  assert.equal(messages.find((m) => m.id === answered.message.id)?.answerTo, asked.ask);
  // asks and answers are the human's business, not agent-to-agent traffic: Agents records neither (#34)
  const agents = await history(ui, 'agents');
  assert.ok(!agents.some((m) => m.id === asked.ask || m.id === answered.message.id || m.answerTo !== undefined || m.ask !== undefined), JSON.stringify(agents));

  // an answered ask takes no second answer; a bad option is refused
  const again = await ui.request({ type: 'topic.answer', ask: asked.ask, option: 1 });
  assert.equal(again.ok, false);
  assert.match(String(again.error), /the ask is answered/);
  const other = await ask(coord, 'general', 'Log level?', ['info', 'debug']);
  assert.match(String((await ui.request({ type: 'topic.answer', ask: other.ask, option: 3 })).error), /option 3 is not one of 1-2/);
  assert.match(String((await ui.request({ type: 'topic.answer', ask: 'nope', option: 1 })).error), /no ask "nope"/);
});

test('two open asks in one topic: answering one keeps the wait, a plain message keeps it too, a free answer to the other clears it', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const topic = (await ok<{ topic: Topic }>(ui, { type: 'topic.create', title: 'Two questions' })).topic;
  const first = await ask(coord, topic.id, 'First?', ['yes', 'no']);
  const second = await ask(coord, topic.id, 'Second, in your words?', []);
  assert.equal((await inbox(ui)).asks.map((a) => a.id).join(), [second.ask, first.ask].join(), 'newest first');
  assert.equal((await inbox(ui)).needsYou, 2);

  await ok(ui, { type: 'topic.answer', ask: first.ask, option: 1 });
  assert.equal((await topicOf(ui, topic.id)).status, 'waiting for human', 'one ask is still open');
  await ok(ui, { type: 'topic.send', topic: topic.id, text: 'thinking about the second one' });
  assert.equal((await topicOf(ui, topic.id)).status, 'waiting for human', 'an open ask keeps the topic waiting for the human');
  await coord.call('send', { topic: topic.id, text: 'take your time' });
  assert.equal((await topicOf(ui, topic.id)).status, 'waiting for human');
  const options = await ui.request({ type: 'topic.answer', ask: second.ask, option: 1 });
  assert.match(String(options.error), /this ask has no options: answer it with a text/);
  const free = await ok<{ message: TopicMessage }>(ui, { type: 'topic.answer', ask: second.ask, text: '  keep both, behind a flag  ' });
  assert.equal(free.message.text, 'keep both, behind a flag');
  assert.equal(free.message.answerTo, second.ask);
  await coord.waitForEvent((e) => e.params.content === 'keep both, behind a flag' && e.params.meta?.answer_to === second.ask);
  assert.equal((await topicOf(ui, topic.id)).status, 'waiting for agent');
  assert.equal((await inbox(ui)).needsYou, 0);

  // options only: no free answer
  const strict = await ask(coord, topic.id, 'Pick one', ['left', 'right'], false);
  assert.match(String((await ui.request({ type: 'topic.answer', ask: strict.ask, text: 'neither' })).error), /takes one of its options/);
});

test('resolve withdraws the open asks: the Coordinator takes its questions back; the human resolving tells the asker', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const topic = (await ok<{ topic: Topic }>(ui, { type: 'topic.create', title: 'Withdrawn' })).topic;
  const a = await ask(coord, topic.id, 'A?', ['1']);
  const b = await ask(coord, topic.id, 'B?', ['1']);
  const mark = ui.frames.length;
  const resolved = await coord.call<{ ok: boolean; topic: Topic }>('resolve', { topic: topic.id });
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.equal(resolved.topic.status, 'open');
  for (const id of [a.ask, b.ask]) {
    const card = (await ui.waitFor((f) => f.type === 'ask' && f.ask === id && ui.frames.indexOf(f) >= mark)) as { card: Card };
    assert.equal(card.card.state, 'withdrawn');
  }
  await inboxEvent(ui, (i) => i.asks.length === 0, mark);
  assert.match(String((await ui.request({ type: 'topic.answer', ask: a.ask, option: 1 })).error), /the ask is withdrawn/);
  assert.equal((await history(ui, topic.id)).filter((m) => m.from === 'hub').length, 0, "the asker's own resolve needs no note");

  // the human's topic.resolve withdraws too, and the asker hears of it
  const c = await ask(coord, topic.id, 'C?', ['1']);
  assert.equal((await ok<{ topic: Topic }>(ui, { type: 'topic.resolve', topic: topic.id })).topic.status, 'open');
  const note = await coord.waitForEvent((e) => String(e.params.content).includes('withdrew your ask "C?"'));
  assert.equal(note.params.meta?.from, 'hub');
  assert.equal(note.params.meta?.topic, topic.id);
  assert.match(String((await ui.request({ type: 'topic.answer', ask: c.ask, option: 1 })).error), /withdrawn/);
});

test('closing the topic cancels its open asks; a topic left waiting without an ask is listed as waiting, and needsYou counts it', async (t) => {
  // a topic an earlier hub left waiting for the human with no ask open (the store as it was found at start)
  const store = new Store();
  store.createTopic('topic-1', 'Left waiting', null, new Date().toISOString());
  store.setTopicStatus('topic-1', 'waiting for human');
  store.record({ id: 'waiting-report', from: 'legacy', fromKind: 'agent', via: 'session', to: ['coord'], kind: 'report', text: 'Waiting for your response', topic: 'topic-1', ts: new Date().toISOString() }, [], Date.now());
  const hub = await hubFor(t, { store });
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  let listed = await inbox(ui);
  assert.deepEqual(listed.waiting.map((x) => x.id), ['topic-1']);
  assert.equal(listed.needsYou, 1);

  const topic = (await ok<{ topic: Topic }>(ui, { type: 'topic.create', title: 'To be closed' })).topic;
  const a = await ask(coord, topic.id, 'Still needed?', ['yes', 'no']);
  listed = await inbox(ui);
  assert.equal(listed.needsYou, 2, 'one ask and one waiting topic');
  const mark = ui.frames.length;
  assert.equal((await ok<{ topic: Topic }>(ui, { type: 'topic.close', topic: topic.id })).topic.status, 'closed');
  const card = (await ui.waitFor((f) => f.type === 'ask' && f.ask === a.ask && ui.frames.indexOf(f) >= mark)) as { card: Card };
  assert.equal(card.card.state, 'cancelled');
  const note = await coord.waitForEvent((e) => String(e.params.content).includes('your ask "Still needed?" was cancelled'));
  assert.match(String(note.params.content), /the topic "To be closed" was closed by the human/);
  listed = await inboxEvent(ui, (i) => i.asks.length === 0, mark);
  assert.equal(listed.needsYou, 1);
  assert.equal((await topicOf(ui, topic.id)).status, 'closed', 'the note does not reopen it');
});

test('on a project: closing the item cancels the ask; verdicts and role changes reach events; retired dismissal frames leave asks waiting', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const item = (await ok<{ item: { id: string } }>(ui, { size: 'M', type: 'task.create', title: 'Hub daemon' })).item.id;
  const topic = (await ok<{ topic: Topic }>(ui, { type: 'topic.create', title: 'T-1: port', item })).topic;
  const a = await ask(coord, topic.id, 'Fixed or free port?', ['fixed', 'free']);
  assert.equal(a.ok, true, JSON.stringify(a));
  const status = await ok<{ needsYou: number }>(ui, { type: 'hub.status' });
  assert.equal(status.needsYou, 1, 'hub.status carries the count');

  let mark = ui.frames.length;
  await ok(ui, { type: 'task.close', item });
  const card = (await ui.waitFor((f) => f.type === 'ask' && f.ask === a.ask && ui.frames.indexOf(f) >= mark)) as { card: Card };
  assert.equal(card.card.state, 'cancelled');
  await coord.waitForEvent((e) => String(e.params.content).includes('was cancelled: T-1 was closed'));
  assert.equal((await topicOf(ui, topic.id)).status, 'closed');

  await ok(ui, { type: 'task.comment', item, text: 'Two findings.', verdict: { verdict: 'review', scope: 'full', result: 'not clear', run: 'r-1' }, as: { name: 'rev-1', role: 'reviewer' } });
  await ok(ui, { type: 'role.set', session: 'rev-1', role: 'reviewer' });
  const events = await ok<import('../src/protocol.ts').EventsPage>(ui, { type: 'events.list' });
  assert.ok(events.rows.some(r => r.kind === 'verdict' && r.warning));
  assert.ok(events.rows.some(r => r.text === 'rev-1 is Reviewer: assigned'));
  assert.equal((await inbox(ui)).needsYou, 0, 'events never require human action');
  const b = await ask(coord, 'general', 'Anything else?', ['no']);
  for (const type of ['inbox.dismiss', 'inbox.dismiss_all']) {
    const refused = await ui.request({ type, notification: b.ask });
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /events view/);
  }
  assert.equal((await inbox(ui)).asks.length, 1, 'retired frames leave the ask waiting');

});

test('a session entering waiting for approval is an approval within one event, with its attach command, and leaves when the state changes; needsYou = asks + approvals + waiting', async (t) => {
  const root = await tempProject(t);
  // pushed states only: the fallback poll would read the fake's own idle back
  // Keep pushed approval and idle states authoritative throughout the inbox assertions.
  const fake = await fakeClaude(t, { pollMs: 60_000, pushTrustMs: 120_000 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: '400' });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const attach = (launched.value as { process: { attach: string } }).process.attach;
  await eventually('impl-1 idle', async () => ((await ok<{ sessions: Array<{ name: string; state: string }> }>(ui, { type: 'hub.status' })).sessions.find((s) => s.name === 'impl-1' && s.state === 'idle') ? true : undefined));
  // a Coordinator started by hand asks meanwhile
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.equal((await ask(coord, 'general', 'Merge T-3 first?', ['yes', 'no'])).ok, true);

  // the hook path the harness's PermissionRequest takes
  let mark = ui.frames.length;
  const signal = await ok<{ applied: boolean; state: string }>(ui, { type: 'session.signal', session: 'impl-1', event: 'permission', at: Date.now(), payload: { tool_name: 'Bash' } });
  assert.equal(signal.state, 'waiting for approval');
  const listed = await inboxEvent(ui, (i) => i.approvals.length === 1, mark);
  assert.deepEqual(listed.approvals.map((a) => [a.session, a.label, a.harness, a.attach]), [['impl-1', 'impl-1 [Implementer]', 'claude-code', attach]]);
  assert.equal(listed.asks.length, 1);
  assert.equal(listed.needsYou, 2, 'one ask and one approval');
  assert.equal((await ok<{ needsYou: number }>(ui, { type: 'hub.status' })).needsYou, 2);
  assert.match(String((await ui.request({ type: 'inbox.dismiss', notification: 'impl-1' })).error), /events view/);

  mark = ui.frames.length;
  await ok(ui, { type: 'session.signal', session: 'impl-1', event: 'tool-done', at: Date.now(), payload: {} });
  const gone = await inboxEvent(ui, (i) => i.approvals.length === 0, mark);
  assert.equal(gone.needsYou, 1);
  // Long idle defaults to watch (CLAND_IDLE_NOTIFY_MS here; [inbox] idle_minutes in config).
  await ok(ui, { type: 'session.signal', session: 'impl-1', event: 'turn-end', at: Date.now(), payload: {} });
  await eventually('long idle appears in events', async () => (await ok<import('../src/protocol.ts').EventsPage>(ui, { type: 'events.list' })).rows.some(r => r.text.includes('idle 1 min')) ? true : undefined);
  assert.ok((await ok<import('../src/protocol.ts').EventsPage>(ui, { type: 'events.list' })).rows.some(r => r.text.includes('idle 1 min')));
});

test('a launched session that renamed itself is one approval, with its attach command (review of #33)', async (t) => {
  const root = await tempProject(t);
  // Keep pushed approval and idle states authoritative throughout the inbox assertions.
  const fake = await fakeClaude(t, { pollMs: 60_000, pushTrustMs: 120_000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord-1', role: 'coordinator', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const { attach, sessionId } = (launched.value as { process: { attach: string; sessionId: string } }).process;
  const present = (name: string) => eventually(`${name} idle`, async () => ((await ok<{ sessions: Array<{ name: string; state: string }> }>(ui, { type: 'hub.status' })).sessions.find((s) => s.name === name && s.state === 'idle') ? true : undefined));
  await present('coord-1');
  // the session renames itself in a turn (the fake does what the text says; only the Coordinator may rename)
  await ok(ui, { type: 'topic.send', topic: 'general', text: 'rename to lead-1', to: ['coord-1'] });
  await present('lead-1');

  const mark = ui.frames.length;
  // the hook still names the launch name, and carries the launch's session id, as a real hook does after a rename
  await ok(ui, { type: 'session.signal', session: 'coord-1', launch: sessionId, event: 'permission', at: Date.now(), payload: { tool_name: 'Bash' } });
  const listed = await inboxEvent(ui, (i) => i.approvals.length > 0, mark);
  assert.equal(listed.approvals.length, 1, JSON.stringify(listed.approvals));
  assert.equal(listed.approvals[0]?.attach, attach);
  assert.equal(listed.needsYou, 1);
});

test('retention keeps an unanswered ask and its message; an answered one goes with its message (review of #33)', async (t) => {
  let clock = Date.parse('2026-10-01T00:00:00Z');
  const hub = await hubFor(t, { now: () => new Date(clock), retentionMs: 60_000 });
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const open = await ask(coord, 'general', 'Still open?', ['yes']);
  const done = await ask(coord, 'general', 'Answered soon?', ['yes']);
  await ok(ui, { type: 'topic.answer', ask: done.ask, option: 1 });

  clock += 120_000;
  hub.prune();
  const after = await inbox(ui);
  assert.deepEqual(after.asks.map((a) => a.id), [open.ask], 'the open ask is still in the inbox');
  assert.deepEqual((await history(ui, 'general')).map((m) => m.id), [open.ask], 'its message is kept; the rest went');
  assert.equal((await topicOf(ui, 'general')).status, 'waiting for human');
  // and it can still be answered
  const answered = await ok<{ message: TopicMessage }>(ui, { type: 'topic.answer', ask: open.ask, option: 1 });
  assert.equal(answered.message.answerTo, open.ask);
  assert.equal((await inbox(ui)).asks.length, 0);
});

test('deleting a topic with an open ask refreshes the subscribed inbox (review of #33)', async (t) => {
  const hub = await hubFor(t);
  const coord = await spoke(t, hub, 'coord', 'coordinator');
  await coord.waitForPresence(['coord']);
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const topic = (await ok<{ topic: Topic }>(ui, { type: 'topic.create', title: 'Doomed' })).topic;
  const asked = await ask(coord, topic.id, 'Keep it?', ['no']);
  await inboxEvent(ui, (i) => i.asks.some((a) => a.id === asked.ask));
  const mark = ui.frames.length;
  await ok(ui, { type: 'topic.delete', topic: topic.id });
  const refreshed = await inboxEvent(ui, (i) => i.asks.length === 0, mark);
  assert.equal(refreshed.needsYou, 0);
});

test('a verdict written as text appears in events without adding an inbox row', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  await ok(ui, { size: 'M', type: 'task.create', title: 'Textual verdict' });
  await ok(ui, { type: 'task.comment', item: 'T-1', text: 'verdict: qa\nresult: clear\nby: qa-1 [qa]\nrun: q-7\n\nAll green.', as: { name: 'qa-1', role: 'qa' } });
  assert.ok((await ok<import('../src/protocol.ts').EventsPage>(ui, { type: 'events.list' })).rows.some(r => r.kind === 'verdict'));
  assert.equal((await inbox(ui)).needsYou, 0);
  const before = (await ok<import('../src/protocol.ts').EventsPage>(ui, { type: 'events.list' })).rows.filter(r => r.kind === 'verdict').length;
  // A plain comment adds no verdict event.
  await ok(ui, { type: 'task.comment', item: 'T-1', text: 'Just a note.', as: { name: 'qa-1', role: 'qa' } });
  assert.equal((await ok<import('../src/protocol.ts').EventsPage>(ui, { type: 'events.list' })).rows.filter(r => r.kind === 'verdict').length, before);
});
