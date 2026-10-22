// T2: ask outcomes through public socket frames; projectHub by default, no-journal hub for rapid answers.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { AskCard, Inbox, Topic, TopicMessage } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, connectWsUi, inProcessSpoke, projectHub, startHub, tempProject, type FrameClient } from './harness.ts';

async function ok<T>(ui: FrameClient, frame: Record<string, unknown> & { type: string }): Promise<T> {
  const result = await ui.request(frame);
  assert.equal(result.ok, true, `${frame.type}: ${result.error}`);
  return result.value as T;
}

test('declining C1: an Implementer receives the declined answer through its lead and the topic takes its next ask', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'decline-coord' });
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', role: 'implementer', sessionId: 'decline-impl' });
  await coord.waitForPresence(['coord', 'impl']);
  const sent = await impl.call<{ ok: boolean }>('send', { topic: 'general', to: 'coordinator', kind: 'question', text: 'May I ship?' });
  assert.equal(sent.ok, true);
  const original = (await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'general' })).messages.find(m => m.text === 'May I ship?')!;
  const forwarded = await coord.call<{ ok: boolean; ask: string }>('ask.forward', { ask: original.id });
  assert.equal(forwarded.ok, true);
  const humanDelivery = coord.waitForEvent(e => e.params.meta?.answer_to === forwarded.ask);
  const answer = await ok<{ message: TopicMessage }>(ui, { type: 'topic.answer', ask: forwarded.ask, declined: true, reason: '  QA is pending.  ' });
  assert.equal(answer.message.text, 'declined: QA is pending.');
  assert.equal((await humanDelivery).params.content, 'declined: QA is pending.');
  const implDelivery = impl.waitForEvent(e => e.params.meta?.answer_to === original.id);
  assert.equal((await coord.call<{ ok: boolean }>('ask.answer', { ask: original.id, text: answer.message.text })).ok, true);
  assert.equal((await implDelivery).params.content, 'declined: QA is pending.');
  const settled = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'general' });
  assert.equal(settled.messages.find(m => m.id === original.id)?.ask?.outcome?.status, 'declined');
  const topics = await ok<{ topics: Topic[] }>(ui, { type: 'topic.list' });
  assert.notEqual(topics.topics.find(topic => topic.id === 'general')?.status, 'closed');
  const next = await impl.call<{ ok: boolean }>('send', { topic: 'general', to: 'coordinator', kind: 'question', text: 'May I run QA?' });
  assert.equal(next.ok, true);
  const history = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'general' });
  assert.equal(history.messages.find(m => m.text === 'May I run QA?')?.ask?.state, 'open');
});

test('C1: an option outcome stays on the thread entry in live cards and later history', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(Date.parse('2026-10-22T07:00:00Z'));
  const hub = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, hub.discovery);
  await ok(ui, { type: 'subscribe' });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which port?', options: ['fixed', 'allocated'] });
  assert.equal(asked.ok, true);
  await clock.advance(1_000);
  const mark = ui.frames.length;
  const changed = ui.waitFor(f => f.type === 'ask' && f.ask === asked.ask && (f.card as AskCard).state === 'answered' && ui.frames.indexOf(f) >= mark);
  const answer = await ok<{ message: TopicMessage }>(ui, { type: 'topic.answer', ask: asked.ask, option: 2 });
  const expected = { status: 'answered', text: 'allocated', option: 2, by: 'human', at: '2026-10-22T07:00:01.000Z' };
  const card = (await changed).card as AskCard;
  assert.deepEqual(card.outcome, expected);
  assert.equal(card.answer, answer.message.id);
  const read = () => ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'general' });
  assert.deepEqual((await read()).messages.find(m => m.id === asked.ask)?.ask?.outcome, expected);
});

test('C2: the inbox publishes an answered departure with the thread outcome and keeps it in the archive', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(Date.parse('2026-10-22T08:00:00Z'));
  const hub = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, hub.discovery);
  await ok(ui, { type: 'subscribe' });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which port?', options: ['fixed', 'allocated'] });
  assert.equal(asked.ok, true);
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).asks[0]?.id, asked.ask);
  const mark = ui.frames.length;
  const departureFrame = ui.waitFor(f => f.type === 'inbox' && (f.inbox as Inbox).departures?.some(d => d.id === asked.ask && d.reason === 'answered') === true && ui.frames.indexOf(f) >= mark);
  await ok(ui, { type: 'topic.answer', ask: asked.ask, option: 2 });
  await clock.advance(250);
  const inbox = (await departureFrame).inbox as Inbox;
  const expected = { status: 'answered', text: 'allocated', option: 2, by: 'human', at: '2026-10-22T08:00:00.000Z' };
  assert.deepEqual(inbox.departures?.map(d => [d.id, d.reason, d.outcome]), [[asked.ask, 'answered', expected]]);
  assert.equal(inbox.asks.length, 0);
  const history = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'general' });
  assert.deepEqual(history.messages.find(m => m.id === asked.ask)?.ask?.outcome, expected);
  const archived = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.deepEqual(archived.archive?.[0]?.outcome, expected);
});

test('C3: a free answer retains its full text and answerer in the thread and departure before the first inbox tick', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(Date.parse('2026-10-22T09:00:00Z'));
  // No journal is installed: it cannot incidentally read the inbox before the answer.
  // This is the existing socket frame fixture; no project/tracker or native process is needed.
  const hub = await startHub({ clock });
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  await ok(ui, { type: 'subscribe' });
  const coord = await inProcessSpoke(t, { hub, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'What next?', options: [], free: true });
  assert.equal(asked.ok, true);
  const mark = ui.frames.length;
  const changed = ui.waitFor(f => f.type === 'ask' && f.ask === asked.ask && (f.card as AskCard).state === 'answered' && ui.frames.indexOf(f) >= mark);
  const departed = ui.waitFor(f => f.type === 'inbox' && ui.frames.indexOf(f) >= mark);
  const answer = await ok<{ message: TopicMessage }>(ui, { type: 'topic.answer', ask: asked.ask, text: '  Wait for QA.\nThen ship.  ', as: { name: 'stand-in' } });
  const expected = { status: 'answered', text: 'Wait for QA.\nThen ship.', by: 'stand-in', at: '2026-10-22T09:00:00.000Z' };
  assert.equal(answer.message.text, expected.text);
  assert.deepEqual(((await changed).card as AskCard).outcome, expected);
  await clock.advance(250);
  const inbox = (await departed).inbox as Inbox;
  assert.deepEqual(inbox.departures?.map(d => [d.id, d.reason, d.outcome]), [[asked.ask, 'answered', expected]]);
  const history = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'general' });
  assert.deepEqual(history.messages.find(m => m.id === asked.ask)?.ask?.outcome, expected);
  const archive = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.deepEqual(archive.archive?.filter(d => d.id === asked.ask).map(d => d.outcome), [expected], 'exactly one durable departure');
  const nextMark = ui.frames.length;
  const next = ui.waitFor(f => f.type === 'inbox' && (f.inbox as Inbox).asks.some(a => a.question === 'Next step?') && ui.frames.indexOf(f) >= nextMark);
  const nextAsk = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Next step?', options: ['continue'] });
  assert.equal(nextAsk.ok, true);
  await clock.advance(250);
  assert.equal(((await next).inbox as Inbox).departures, undefined, 'a later delta does not repeat departures');
});


test('declining C2: missing or blank reasons are refused without settling the ask', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'reason-coord' });
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Ship?', options: ['yes'], free: false });
  assert.equal(asked.ok, true);
  for (const reason of [undefined, '', '  \n  ']) {
    const refused = await ui.request({ type: 'topic.answer', ask: asked.ask, declined: true, ...(reason === undefined ? {} : { reason }) });
    assert.equal(refused.ok, false);
    assert.match(String(refused.error), /declining an ask needs a reason/);
    const history = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'general' });
    assert.equal(history.messages.find(m => m.id === asked.ask)?.ask?.state, 'open');
    assert.equal(history.messages.some(m => m.answerTo === asked.ask), false);
    assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).asks.some(a => a.id === asked.ask), true);
  }
});

test('declining C3: thread and inbox departure retain the reason, answerer and time', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(Date.parse('2026-10-22T10:00:00Z'));
  const hub = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, hub.discovery);
  await ok(ui, { type: 'subscribe' });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'outcome-coord' });
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Ship?', options: ['yes'], free: false });
  assert.equal(asked.ok, true);
  const mark = ui.frames.length;
  const changed = ui.waitFor(f => f.type === 'ask' && f.ask === asked.ask && (f.card as AskCard).state === 'answered' && ui.frames.indexOf(f) >= mark);
  const departed = ui.waitFor(f => f.type === 'inbox' && (f.inbox as Inbox).departures?.some(d => d.id === asked.ask) === true && ui.frames.indexOf(f) >= mark);
  await ok(ui, { type: 'topic.answer', ask: asked.ask, declined: true, reason: '  QA pending.\nWait for its report.  ', as: { name: 'stand-in' } });
  const expected = { status: 'declined', reason: 'QA pending.\nWait for its report.', by: 'stand-in', at: '2026-10-22T10:00:00.000Z' };
  assert.deepEqual(((await changed).card as AskCard).outcome, expected);
  await clock.advance(250);
  const inbox = (await departed).inbox as Inbox;
  assert.deepEqual(inbox.departures?.map(d => [d.id, d.reason, d.outcome]), [[asked.ask, 'declined', expected]]);
  assert.equal(inbox.asks.some(a => a.id === asked.ask), false);
  const history = await ok<{ messages: TopicMessage[] }>(ui, { type: 'topic.history', topic: 'general' });
  assert.deepEqual(history.messages.find(m => m.id === asked.ask)?.ask?.outcome, expected);
  const archive = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.deepEqual(archive.archive?.filter(d => d.id === asked.ask).map(d => [d.reason, d.outcome]), [['declined', expected]]);
});
