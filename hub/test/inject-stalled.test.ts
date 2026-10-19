// T2: failed-inject notice policy through real hub frames, fake harnesses and fake time.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { HarnessProcessView, Message } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';

test('sustained unconfirmed injection raises one routed notice per session episode', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer']] as const) {
    const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name, role });
    assert.equal(launched.ok, true, launched.error);
    const process = (launched.value as { process: HarnessProcessView }).process;
    const peer = await inProcessSpoke(t, { cwd: root, discover: true, name, role, sessionId: process.sessionId, launchToken: fake.spawns.at(-1)!.launchToken! });
    await peer.waitForPresence([name]);
    fake.idle(name);
  }
  const notices = () => ui.frames.filter(f => f.type === 'message' && (f.message as Message).kind === 'inject-stalled').map(f => f.message as Message);
  const fail = async (name: string) => {
    fake.scriptInject(name, 'reject');
    const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [name], text: `must reach ${name}` });
    assert.equal(sent.ok, true, sent.error);
    const id = (sent.value as { message: Message }).message.id;
    await eventually('failed inject completed', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
    return id;
  };
  for (const name of ['coord', 'impl']) {
    const first = await fail(name);
    await clock.advance(59_999);
    await ui.request({ type: 'session.list' });
    assert.equal(notices().filter(note => note.detail?.session === name).length, 0);
    await clock.advance(1);
    const frame = await ui.waitFor(f => f.type === 'message' && (f.message as Message).kind === 'inject-stalled' && (f.message as Message).detail?.session === name);
    const note = frame.message as Message;
    assert.match(note.text, new RegExp(name));
    assert.match(note.text, /60000 ms/);
    assert.deepEqual(note.to, name === 'coord' ? [] : ['coord']);
    const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string; session?: string }> };
    assert.equal(events.rows.filter(row => row.text === note.text && row.session === name).length, name === 'coord' ? 1 : 0);
    await fail(name);
    await clock.advance(120_000);
    await ui.request({ type: 'session.list' });
    assert.equal(notices().filter(note => note.detail?.session === name).length, 1, 'repeated failures do not flood notices');
    fake.busy(name);
    fake.idle(name);
    await ui.waitFor(f => f.type === 'delivery' && f.message === first && f.stage === 'injected');
    await fail(name);
    await clock.advance(60_000);
    await eventually('new episode notices once', async () => {
      await ui.request({ type: 'session.list' });
      return notices().filter(note => note.detail?.session === name).length === 2 || undefined;
    });
    fake.busy(name);
    fake.idle(name);
  }
});

test('confirmation before the threshold cancels the unconfirmed-inject notice', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'coord', role: 'coordinator' });
  const peer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: (launched.value as { process: HarnessProcessView }).process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['coord']);
  fake.scriptInject('coord', 'reject');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'briefly disconnected' });
  const id = (sent.value as { message: Message }).message.id;
  await eventually('failure receipt', () => logs.some(entry => entry.event === 'inject-unconfirmed' && entry.id === id) || undefined);
  await clock.advance(59_999);
  fake.busy('coord');
  fake.idle('coord');
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  await clock.advance(120_000);
  await ui.request({ type: 'session.list' });
  assert.ok(!ui.frames.some(f => f.type === 'message' && (f.message as Message).kind === 'inject-stalled'));
});
