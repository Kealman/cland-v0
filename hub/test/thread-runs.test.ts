// T2: fold lines through disposable projectHub history pages and live frames; no native process.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

type Run = { id: string; firstSeq: number; participants: string[]; otherParticipants: number; messageCount: number; latest: { kind: string; preview: string; at: string }; ageMs: number; foldLine: string };
type Row = { id: string; seq: number; text: string; runId?: string };
type Page = { messages: Row[]; runs: Run[] };

async function fixture(t: TestContext, at?: number) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nrate_limit_max = 1000\nloop_breaker_max = 1000\n');
  const clock = new FakeClock(at);
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'rev-id', role: 'reviewer' });
  await impl.waitForPresence(['impl', 'rev']);
  async function send(text: string, reverse = false) {
    const received = ui.waitFor(f => f.type === 'message' && (f.message as Row).text === text && (f.message as { topic: string }).topic === 'general');
    assert.equal((await (reverse ? rev : impl).call<{ ok: boolean }>('send', { topic: 'general', to: [reverse ? 'impl' : 'rev'], text })).ok, true);
    return received;
  }
  async function history(fields: Record<string, unknown> = {}) {
    const result = await ui.request({ type: 'topic.history', topic: 'general', ...fields });
    assert.equal(result.ok, true, result.error);
    return result.value as Page;
  }
  return { root, discovery, ui, clock, impl, rev, send, history };
}

test('four Implementer–Reviewer messages share one factual fold line', async t => {
  const { send, history, clock } = await fixture(t);
  for (let i = 1; i <= 4; i++) await send(`Step ${i} checks complete`, i % 2 === 0);
  await clock.advance(120_000);
  const page = await history();
  assert.equal(page.runs?.length, 1, 'one full run accompanies history');
  const run = page.runs[0]!;
  assert.deepEqual(page.messages.map(m => m.runId), Array(4).fill(run.id));
  assert.equal(run.firstSeq, page.messages[0]!.seq);
  assert.deepEqual(run.participants, ['impl', 'rev']);
  assert.equal(run.otherParticipants, 0);
  assert.equal(run.messageCount, 4);
  assert.deepEqual(run.latest, { kind: 'report', preview: 'Step 4 checks complete', at: new Date(clock.now().getTime() - 120_000).toISOString() });
  assert.equal(run.ageMs, 120_000);
  assert.equal(run.foldLine, 'impl → rev · 4 messages · report: Step 4 checks complete · 2m');
});

test('a fifth message updates the same run by delta without another history read', async t => {
  const { send, history, clock, ui } = await fixture(t);
  for (let i = 1; i <= 4; i++) await send(`Initial ${i}`);
  const initial = (await history()).runs[0]!;
  const mark = ui.frames.length;
  await clock.advance(1000);
  const frame = await send('Fifth step ready', true);
  assert.ok(frame.run, 'the message delta carries the updated full run');
  const run = frame.run as Run;
  assert.equal((frame.message as Row).runId, initial.id);
  assert.equal(run.id, initial.id);
  assert.equal(run.firstSeq, initial.firstSeq);
  assert.equal(run.messageCount, 5);
  assert.deepEqual(run.latest, { kind: 'report', preview: 'Fifth step ready', at: clock.now().toISOString() });
  assert.equal(run.ageMs, 0);
  assert.equal(run.foldLine, 'impl → rev · 5 messages · report: Fifth step ready · 0s');
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  assert.equal(ui.frames.slice(mark).filter(f => f.type === 'message' && (f.run as Run | undefined)?.id === initial.id).length, 1);
});

test('never-fold messages and day changes end a run', async t => {
  const { root, ui, impl, rev, send, clock, history } = await fixture(t, new Date(2026, 9, 16, 23, 59, 59).getTime());
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  const aide = await inProcessSpoke(t, { discover: true, cwd: root, name: 'helper', sessionId: 'helper-id', role: 'aide' });
  await impl.waitForPresence(['impl', 'rev', 'coord', 'helper']);
  let ask = '';
  const agent = async (sender: typeof impl, text: string, to?: string[], kind?: string) => {
    const result = await sender.call<{ ok: boolean }>('send', { topic: 'general', text, ...(to ? { to } : {}), ...(kind ? { kind } : {}) });
    assert.equal(result.ok, true, JSON.stringify(result));
  };
  const cases: Array<[string, () => Promise<unknown>]> = [
    ['review clear · complete', () => agent(rev, 'review clear · complete', ['impl'])],
    ['Which path?', () => agent(impl, 'Which path?', ['coord'], 'question')],
    ['Use the existing path', async () => { assert.equal((await coord.call<{ ok: boolean }>('ask.answer', { ask, text: 'Use the existing path' })).ok, true); }],
    ['Human @impl reply', async () => { assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Human @impl reply' })).ok, true); }],
    ['Report to human', () => agent(impl, 'Report to human')],
    ['Message to helper', () => agent(impl, 'Message to helper', ['helper'])],
    ['Message from helper', () => agent(aide, 'Message from helper', ['impl'])],
  ];
  for (const [text, trigger] of cases) {
    const before = await send(`Before ${text}`);
    const boundary = ui.waitFor(f => f.type === 'message' && (f.message as Row).text === text && (f.message as { topic: string }).topic === 'general');
    await trigger();
    const frame = await boundary;
    const row = frame.message as Row;
    if (text === 'Which path?') {
      ask = row.id;
      assert.ok((frame.message as { ask?: unknown }).ask, 'exercise a tracked agent ask');
    }
    assert.equal(row.runId, undefined, text);
    assert.equal(frame.run, undefined, text);
    const after = await send(`After ${text}`);
    assert.ok((after.message as Row).runId, text);
    assert.notEqual((after.message as Row).runId, (before.message as Row).runId, text);
    assert.equal((after.run as Run).messageCount, 1, text);
    assert.equal((await history()).messages.find(m => m.id === row.id)!.runId, undefined, text);
  }
  const peerBefore = await send('Before peer question');
  const peerQuestion = ui.waitFor(f => f.type === 'message' && (f.message as Row).text === 'Peer question');
  await agent(impl, 'Peer question', ['rev'], 'question');
  const peer = await peerQuestion;
  assert.equal((peer.message as { ask?: unknown }).ask, undefined, 'a peer question is not a tracked ask');
  assert.equal((peer.message as Row).runId, (peerBefore.message as Row).runId);
  const yesterday = await send('Before midnight');
  await clock.advance(1000);
  const today = await send('After midnight');
  assert.notEqual((today.run as Run).id, (yesterday.run as Run).id);
  assert.equal((today.run as Run).messageCount, 1);
});

test('history pages beginning mid-run carry its full identity and fold line', async t => {
  const { send, history, discovery, root, impl } = await fixture(t);
  for (const name of ['third', 'fourth', 'fifth']) {
    await inProcessSpoke(t, { discover: true, cwd: root, name, sessionId: `${name}-id`, role: 'reviewer' });
  }
  await impl.waitForPresence(['impl', 'rev', 'third', 'fourth', 'fifth']);
  const first = await send('First step');
  assert.equal((await impl.call<{ ok: boolean }>('send', { topic: 'general', to: ['rev', 'third', 'fourth', 'fifth'], text: 'All participants' })).ok, true);
  await send('Third step');
  await send('Latest step');
  const full = await history();
  const run = full.runs[0]!;
  assert.equal(run.id, (first.message as Row).runId);
  assert.deepEqual(run.participants, ['impl', 'rev', 'third']);
  assert.equal(run.otherParticipants, 2);
  assert.equal(run.foldLine, 'impl, rev, third +2 · 4 messages · report: Latest step · 0s');
  for (const fields of [{ limit: 2 }, { after: full.messages[1]!.seq, limit: 2 }, { before: full.messages[3]!.seq, limit: 1 }, { before: full.messages[3]!.id, limit: 1 }]) {
    const page = await history(fields);
    assert.ok(page.messages.length > 0);
    assert.ok(page.messages.every(m => m.seq > run.firstSeq));
    assert.deepEqual(page.runs, [run]);
    assert.ok(page.messages.every(m => m.runId === run.id));
  }
  // A new client starts with a suffix, having never seen the run's beginning.
  const late = await connectUi(t, discovery);
  const response = await late.request({ type: 'topic.history', topic: 'general', limit: 1 });
  assert.equal(response.ok, true);
  assert.deepEqual((response.value as Page).runs, [run]);
});

test('queued verifier assignment refreshes participants in its same-id run delta', async t => {
  const { ui, impl, rev, history } = await fixture(t);
  const ids: string[] = [];
  for (const title of ['Occupied reviewer', 'Pending review']) {
    const made = await ui.request({ type: 'task.create', title, size: 'S', ...(title === 'Pending review' ? { assignee: 'impl' } : {}) });
    assert.equal(made.ok, true, made.error);
    ids.push((made.value as { item: { id: string } }).item.id);
  }
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: ids[1] })).ok, true);
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: ids[0] })).ok, true);
  const made = await impl.call<{ ok: boolean; topic: { id: string } }>('topic.create', { title: 'Pending review', item: ids[1] });
  assert.equal(made.ok, true);
  const topic = made.topic.id;
  const text = `review request ${ids[1]}`;
  const waiting = ui.waitFor(f => f.type === 'message' && (f.message as Row).text === text);
  const queued = await impl.call<{ ok: boolean; outcomes: Array<{ outcome: string }> }>('send', { to: ['reviewer'], topic, text });
  assert.equal(queued.ok, true);
  assert.equal(queued.outcomes[0]!.outcome, 'queued');
  const initial = await waiting;
  const original = initial.run as Run;
  assert.deepEqual(original.participants, ['impl', 'reviewer']);
  assert.equal((await impl.call<{ ok: boolean }>('send', { topic, to: ['rev'], text: 'Still waiting' })).ok, true); // Assignment is not the tail.
  await ui.waitFor(f => f.type === 'message' && (f.message as Row).text === 'Still waiting');
  const assigned = ui.waitFor(f => f.type === 'message' && (f.message as Row).id === (initial.message as Row).id && (f.message as { to: string[] }).to[0] === 'rev');
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: ids[0], release: true })).ok, true);
  const delta = await assigned;
  const run = delta.run as Run;
  assert.deepEqual(run.participants, ['impl', 'rev']);
  assert.equal(run.id, original.id);
  assert.equal((delta.message as Row).runId, original.id);
  assert.equal(run.firstSeq, original.firstSeq);
  assert.equal(run.messageCount, 2);
  assert.equal(run.latest.preview, 'Still waiting');
  assert.equal(run.foldLine, 'impl → rev · 2 messages · report: Still waiting · 0s');
  const page = await history({ topic });
  assert.deepEqual(page.runs.find(r => r.id === run.id), run);
  assert.deepEqual((page.messages.find(m => m.id === (initial.message as Row).id) as Row & { to: string[] }).to, ['rev']);
});
