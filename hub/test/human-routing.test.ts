// The human's messages through the UI's frames (spec 4.2, 4.5): who a role address reaches, what waits for a
// role nobody holds, and the delivery events the UI sees. An in-process hub, a UI client on its WebSocket
// (a client hello works there), and real spokes over MCP.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { connectWsUi, sleep, spawnSpoke, startHub, waitForAbsence, type FrameClient, type Session } from './harness.ts';
import type { Hub, HubOptions } from '../src/hub/server.ts';

type TopicMessage = { id: string; topic: string; from: string; to: string[]; text: string; stage?: string };
type Sent = { message: TopicMessage; outcomes: Array<{ to: string; outcome: string; reason?: string }> };

async function hubFor(t: TestContext, options: Partial<HubOptions> = {}): Promise<Hub> {
  const hub = await startHub(options);
  t.after(() => hub.close());
  return hub;
}

async function spoke(t: TestContext, hub: Hub, name: string, sessionId: string, role?: string): Promise<Session> {
  const s = await spawnSpoke({ hub, name, sessionId, ...(role ? { role } : {}) });
  t.after(() => s.close());
  return s;
}

async function send(ui: FrameClient, frame: Record<string, unknown>): Promise<Sent> {
  const r = await ui.request({ type: 'topic.send', topic: 'general', ...frame });
  assert.equal(r.ok, true, r.error);
  return r.value as Sent;
}

const deliveryOf = (ui: FrameClient, id: string, stage: string, timeoutMs = 10_000) =>
  ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === stage, timeoutMs);

test('a replacement coordinator gets the human message alone: the offline previous holder is not an addressee', async (t) => {
  const hub = await hubFor(t);
  const viewer = await spoke(t, hub, 'viewer', 'sess-v');
  const old = await spoke(t, hub, 'coord-old', 'sess-old', 'coordinator');
  await viewer.waitForPresence(['viewer', 'coord-old']);
  await old.close();
  await waitForAbsence(viewer, 'coord-old');
  const fresh = await spoke(t, hub, 'coord-new', 'sess-new', 'coordinator');
  await viewer.waitForPresence(['coord-new']);

  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const { message, outcomes } = await send(ui, { text: 'for whoever coordinates now' });
  assert.deepEqual(message.to, ['coord-new']);
  assert.deepEqual(outcomes, [{ to: 'coordinator', outcome: 'delivered' }]);
  await fresh.waitForEvent((e) => e.params.content === 'for whoever coordinates now');
  await deliveryOf(ui, message.id, 'delivered');
});

test('with only an offline coordinator, the human message waits for the role and the next holder takes it', async (t) => {
  const hub = await hubFor(t);
  const viewer = await spoke(t, hub, 'viewer', 'sess-v');
  const old = await spoke(t, hub, 'coord-old', 'sess-old', 'coordinator');
  await viewer.waitForPresence(['viewer', 'coord-old']);
  await old.close();
  await waitForAbsence(viewer, 'coord-old');

  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const { message, outcomes } = await send(ui, { text: 'anyone coordinating?' });
  assert.deepEqual(message.to, ['coordinator']);
  assert.equal(message.stage, 'queued');
  assert.deepEqual(
    outcomes.map((o) => [o.to, o.outcome]),
    [['coordinator', 'queued']],
  );
  const fresh = await spoke(t, hub, 'coord-new', 'sess-new', 'coordinator');
  await fresh.waitForEvent((e) => e.params.content === 'anyone coordinating?', 15_000);
  await deliveryOf(ui, message.id, 'delivered');
});

test('a known roleless session addressed beside the vacant coordinator role, back as coordinator, clears both deliveries with one ack', async (t) => {
  const hub = await hubFor(t);
  const viewer = await spoke(t, hub, 'viewer', 'sess-v');
  const first = await spoke(t, hub, 'alpha', 'sess-a');
  await viewer.waitForPresence(['viewer', 'alpha']);
  await first.close();
  await waitForAbsence(viewer, 'alpha');

  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const { message } = await send(ui, { text: 'to alpha and the coordinator', to: ['alpha', 'coordinator'] });
  assert.deepEqual(message.to, ['alpha', 'coordinator']);
  assert.equal(message.stage, 'queued');

  const back = await spoke(t, hub, 'alpha', 'sess-a', 'coordinator');
  await back.waitForEvent((e) => e.params.content === 'to alpha and the coordinator', 15_000);
  await deliveryOf(ui, message.id, 'delivered');
  const h = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal((h.value as { messages: TopicMessage[] }).messages.find((m) => m.id === message.id)?.stage, 'delivered');
  await sleep(200);
  assert.equal(back.events.filter((e) => e.params.content === 'to alpha and the coordinator').length, 1);
});

test('the same role named twice is one addressee: the send succeeds, is published, and reaches the next coordinator once', async (t) => {
  const hub = await hubFor(t);
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const { message, outcomes } = await send(ui, { text: 'twice named', to: ['coordinator', '@coordinator'] });
  assert.deepEqual(message.to, ['coordinator']);
  assert.deepEqual(
    outcomes.map((o) => [o.to, o.outcome]),
    [['coordinator', 'queued']],
  );
  await ui.waitFor((f) => f.type === 'message' && (f.message as TopicMessage).id === message.id);

  const coord = await spoke(t, hub, 'coord', 'sess-c', 'coordinator');
  await coord.waitForEvent((e) => e.params.content === 'twice named', 15_000);
  await deliveryOf(ui, message.id, 'delivered');

  // a live session named twice, with and without the @
  const again = await send(ui, { text: 'coord twice', to: ['coord', '@coord'] });
  assert.deepEqual(again.message.to, ['coord']);
  assert.deepEqual(again.outcomes, [{ to: 'coord', outcome: 'delivered' }]);
});

test('a delivery dropped past the TTL moves the stage, and the UI hears it', async (t) => {
  const hub = await hubFor(t, { queueTtlMs: 1500 });
  const a = await spoke(t, hub, 'a', 'sess-a');
  const b = await spoke(t, hub, 'b', 'sess-b');
  await a.waitForPresence(['a', 'b']);
  await b.close();
  await waitForAbsence(a, 'b');

  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const both = await send(ui, { text: 'to a and b', to: ['a', 'b'] });
  const onlyB = await send(ui, { text: 'to b alone', to: ['b'] });
  await a.waitForEvent((e) => e.params.content === 'to a and b');
  await sleep(300);
  assert.equal(ui.frames.some((f) => f.type === 'delivery'), false, 'b still waits: the stage stays queued');

  await sleep(1500);
  const back = await spoke(t, hub, 'b', 'sess-b');
  await deliveryOf(ui, both.message.id, 'delivered');
  await deliveryOf(ui, onlyB.message.id, 'dropped');
  assert.equal(back.events.length, 0, 'nothing past the TTL is handed over');
});

test('the human cannot write into Agents; an agent-to-agent send still lands there', async (t) => {
  const hub = await hubFor(t);
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const refused = await ui.request({ type: 'topic.send', topic: 'agents', text: 'let me in' });
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'Agents is read-only: it records what agents send each other; reply to a message there, or write in General or another topic');
  const empty = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((empty.value as { messages: unknown[] }).messages, []);
  assert.equal(ui.frames.some((f) => f.type === 'message'), false);

  const a = await spoke(t, hub, 'a', 'sess-a');
  const b = await spoke(t, hub, 'b', 'sess-b');
  await a.waitForPresence(['a', 'b']);
  await a.call('send', { to: ['b'], text: 'between us' });
  const event = (await ui.waitFor((f) => f.type === 'message')) as { topic: { id: string }; message: TopicMessage };
  assert.equal(event.topic.id, 'agents');
  assert.equal(event.message.text, 'between us');
});
