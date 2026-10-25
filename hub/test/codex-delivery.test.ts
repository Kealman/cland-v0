// T2: hub delivery policy on T-686's in-process adapter. Native malformed/disconnected
// replies are classified at the scripted app-server boundary in codex-native.test.ts;
// one missing-result binary proof remains in codex-adapter.test.ts. Artifact composition
// is shared across flavours in adapter-composition.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FakeClock } from './fake-clock.ts';
import { clandWithEnv, connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { scriptedCodex } from './fakes/scripted-codex.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';

test('uncertain inputs survive idle observations and replay only through explicit session retry', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake' });
  const fake = fakes.codex!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'codex', name: 'coord', role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['coord']);
  fake.idle('coord');
  const log = async () => { await ui.request({ type: 'hub.status', flushLogs: true }); return readFile(join(root, '.cland/log/hub.log'), 'utf8'); };
  for (const reason of ['answer never came', 'answer was not JSON', 'connection dropped after acceptance']) {
    fake.scriptInject('coord', 'uncertain');
    const text = `uncertain: ${reason}`;
    const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text });
    assert.equal(sent.ok, true, sent.error);
    const id = (sent.value as { message: Message }).message.id;
    await eventually('uncertain native attempt completed', async () => (await log()).includes(`"event":"inject-uncertain","id":"${id}"`) || undefined);
    assert.equal((await peer.call<{ ok: boolean }>('send', { topic: 'general', text: `pong: ${text}`, reply_to: id })).ok, true);
    await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `pong: ${text}`);
    for (let i = 0; i < 8; i++) fake.idle('coord');
    await clock.advance(800); // Once, after the uncertain receipt: no clock pumping for I/O.
    await ui.request({ type: 'session.list' });
    assert.equal(fake.injections.filter(input => input.message.id === id).length, 1, 'accepted input is not replayed by idle observations');
    assert.equal(ui.frames.filter(f => f.type === 'message' && (f.message as Message).text === `pong: ${text}`).length, 1);
    assert.ok(!ui.frames.some(f => f.type === 'delivery' && f.message === id && f.stage === 'injected'));
    const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string; session?: string }> };
    const note = events.rows.find(row => row.text.includes(id) && row.text.includes('may or may not have reached'));
    assert.ok(note);
    assert.equal(note.session, 'coord');
    assert.ok(note.text.includes(`cland session retry coord ${id}`));
    // Retain one real CLI frame for retry itself; remaining policy cells use the protocol.
    if (reason === 'answer never came') {
      const retried = await clandWithEnv(root, {}, 'session', 'retry', 'coord', id);
      assert.equal(retried.code, 0, retried.stderr);
    } else assert.equal((await ui.request({ type: 'session.retry', session: 'coord', message: id })).ok, true);
    await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
    assert.equal(fake.injections.filter(input => input.message.id === id).length, 2);
    assert.equal((await peer.call<{ ok: boolean }>('send', { topic: 'general', text: `pong: ${text}`, reply_to: id })).ok, true);
    await eventually('second answer', () => ui.frames.filter(f => f.type === 'message' && (f.message as Message).text === `pong: ${text}`).length === 2 || undefined);
    const again = await ui.request({ type: 'session.retry', session: 'coord', message: id });
    assert.equal(again.ok, false);
    assert.match(again.error ?? '', /no uncertain delivery/);
  }
});

test('a reconnected idle native transport retries input that failed while disconnected', async t => {
  const f = await scriptedCodex(t);
  f.refuseConnections(new Error('app-server temporarily refuses connection'));
  await f.reconnect();
  await eventually('reconnection refusal observed', async () => (await f.log()).includes('"event":"harness-reconnect-failed"') || undefined);
  const id = await f.send('are you there');
  await eventually('inject failed while disconnected', async () => (await f.log()).includes(`"event":"inject-unconfirmed","session":"impl","id":"${id}"`) || undefined);
  f.refuseConnections(null);
  await f.clock.advance(100); // Positive refusal and failed-inject receipts precede the retry tick.
  await f.injected(id);
  const request = f.native.calls.filter(call => call.method === 'turn/start').at(-1)!;
  const input = request.params.toolOutput as { output: string };
  assert.ok(input.output.includes(id));
  const turn = [...f.native.turns.keys()].at(-1)!;
  f.native.item(turn, input.output, 'toolOutput');
  f.native.complete(turn);
  await f.reply(id, 'are you there');
  assert.equal(f.native.count('turn/start'), 1);
});

test('Codex app-server confirmation at ninety seconds cancels the startup injection alarm', async t => {
  const f = await scriptedCodex(t, undefined, { startupDelayMs: 50_000 });
  const started = f.clock.now().getTime();
  f.refuseConnections(new Error('app-server temporarily refuses connection'));
  await f.reconnect();
  await eventually('startup reconnection refusal receipt', async () => (await f.log()).includes('"event":"harness-reconnect-failed"') || undefined);
  const id = await f.send('recover during startup grace');
  await eventually('disconnected injection receipt', async () => (await f.log()).includes(`"event":"inject-unconfirmed","session":"impl","id":"${id}"`) || undefined);
  await f.clock.advance(60_000);
  assert.equal((await f.agents()).filter(row => row.kind === 'inject-stalled').length, 0, 'startup reconnect must not raise the ordinary one-minute alarm');
  await f.clock.advance(started + 89_900 - f.clock.now().getTime());
  f.refuseConnections(null);
  const confirmed = f.injected(id);
  await f.clock.advance(100);
  await confirmed;
  assert.equal(f.clock.now().getTime() - started, 90_000);
  await f.clock.advance(120_000);
  assert.equal((await f.agents()).filter(row => row.kind === 'inject-stalled').length, 0, 'exact delivery confirmation cancels the deferred alarm');
});

for (const [beforeDisconnect, deadline, unconfirmedMs] of [[29_900, 120_000, 90_000], [129_900, 190_000, 60_000]] as const) {
  test(`Codex unconfirmed injection after ${beforeDisconnect + 100} ms alarms at hub startup plus ${deadline} ms`, async t => {
    const f = await scriptedCodex(t, undefined, { startupDelayMs: 50_000 });
    const started = f.clock.now().getTime();
    await f.clock.advance(beforeDisconnect);
    f.refuseConnections(new Error('app-server temporarily refuses connection'));
    await f.reconnect();
    await eventually('native reconnection refusal receipt', async () => (await f.log()).includes('"event":"harness-reconnect-failed"') || undefined);
    const id = await f.send('still disconnected');
    await eventually('failed injection receipt', async () => (await f.log()).includes(`"event":"inject-unconfirmed","session":"impl","id":"${id}"`) || undefined);
    const alarm = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).kind === 'inject-stalled' && (frame.message as Message).detail?.message === id);
    await f.clock.advance(started + deadline - 1 - f.clock.now().getTime());
    assert.equal((await f.agents()).filter(row => row.kind === 'inject-stalled').length, 0, 'no alarm before the later of startup grace and ordinary timeout');
    await f.clock.advance(1);
    const note = (await alarm).message as Message;
    assert.equal(note.topic, 'agents');
    assert.deepEqual(note.detail, { session: 'impl', message: id });
    assert.match(note.text, new RegExp(`unconfirmed for ${unconfirmedMs} ms`));
    await f.clock.advance(300_000);
    assert.equal((await f.agents()).filter(row => row.kind === 'inject-stalled').length, 1, 'one notice per unconfirmed episode');
  });
}
