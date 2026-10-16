// T2 component: projectHub owns scheduling; its real socket and journal edges keep running.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock } from './fake-clock.ts';
import { connectSocket, connectUi, projectHub, tempProject } from './harness.ts';
import type { Message } from '../src/protocol.ts';

const heartbeat = (f: Record<string, unknown>) => f.type === 'message' && (f.message as Message).detail?.event === 'heartbeat';

test('projectHub delivers a heartbeat only after its clock reaches the interval', async t => {
  const clock = new FakeClock();
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, { CLAND_HEARTBEAT_MS: '1000' }, { clock });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const spoke = await connectSocket(discovery.socket);
  t.after(() => spoke.close());
  spoke.send({ type: 'hello', protocol: 2, secret: discovery.secret, name: 'coord', sessionId: 'clock-coord', cwd: root });
  const welcome = await spoke.next();
  assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
  // The first scheduler tick establishes the new session's durable schedule.
  await clock.advance(250);
  await clock.advance(999);
  assert.equal(ui.frames.filter(heartbeat).length, 0);
  await clock.advance(1);
  const fired = await ui.waitFor(heartbeat);
  assert.equal((fired.message as Message).ts, clock.now().toISOString());
});

async function fixture(t: import('node:test').TestContext) {
  const clock = new FakeClock();
  const root = await tempProject(t);
  const hub = await projectHub(t, root, { CLAND_QUEUE_TTL_MS: '1000' }, { clock });
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const connect = async () => {
    const spoke = await connectSocket(hub.discovery.socket);
    t.after(() => spoke.close());
    spoke.send({ type: 'hello', protocol: 2, secret: hub.discovery.secret, name: 'coord', sessionId: 'ttl-coord', cwd: root });
    const welcome = await spoke.next();
    assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
    return spoke;
  };
  return { clock, hub, ui, connect };
}

async function reply(spoke: Awaited<ReturnType<typeof connectSocket>>, id: string) {
  for (;;) {
    const frame = await spoke.next();
    if (frame.type === 'result' && frame.id === id) return frame;
  }
}

test('projectHub drops store-and-forward delivery after the injected TTL', async t => {
  const { clock, hub, ui, connect } = await fixture(t);
  let spoke = await connect();
  spoke.close();
  await ui.waitFor(f => f.type === 'presence' && (f.sessions as unknown[]).length === 0);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'expires in fake time' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: Message }).message;
  const stages = async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true, history.error);
    return (history.value as { messages: Array<Message & { stage: string }> }).messages.find(m => m.id === message.id)?.stage;
  };
  await clock.advance(999);
  assert.equal(await stages(), 'queued');
  await clock.advance(2);
  spoke = await connect(); // hello drops expired delivery before returning its welcome
  await ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'dropped');
  assert.equal(await stages(), 'dropped');
  await hub.stop();
  assert.equal(clock.pending, 0, 'stopping the project clears every hub timer');
});

test('projectHub forgets remembered presence status after the injected TTL', async t => {
  const { clock, ui, connect } = await fixture(t);
  let spoke = await connect();
  spoke.send({ type: 'status', id: 'status', text: 'remembered' });
  assert.equal((await reply(spoke, 'status')).ok, true);
  const disconnect = async () => {
    const count = ui.frames.length;
    spoke.close();
    await ui.waitFor(f => ui.frames.indexOf(f) >= count && f.type === 'presence' && (f.sessions as unknown[]).length === 0);
  };
  await disconnect();
  await clock.advance(999);
  spoke = await connect();
  spoke.send({ type: 'who', id: 'before' });
  assert.equal(((await reply(spoke, 'before')).value as { sessions: Array<{ status: string }> }).sessions[0]?.status, 'remembered');
  await disconnect();
  await clock.advance(1001);
  spoke = await connect();
  spoke.send({ type: 'who', id: 'after' });
  assert.equal(((await reply(spoke, 'after')).value as { sessions: Array<{ status: string | null }> }).sessions[0]?.status, null);
});
