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
import { deferred } from './fakes/scripted-codex.ts';
import { RpcNoAnswer } from '../src/adapters/codex/app-server.ts';

const capacityError = 'Selected model is at capacity. Please try a different model.';

test('exhausted capacity retries notify the Coordinator exactly once, including completion before replay admission', async t => {
  const f = await scriptedCodex(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'sender', role: 'coordinator' })).ok, true);
  const id = await f.send('capacity bound', true);
  await f.injected(id);
  const original = f.native.calls.find(call => call.method === 'turn/start')!.params;
  const text = (original.toolOutput as { output: string }).output;
  let turn = [...f.native.turns.keys()].at(-1)!;
  f.native.item(turn, text, 'toolOutput');
  const fail = (id: string) => {
    f.native.state('idle');
    f.native.notify('turn/completed', { turn: { id, status: 'failed', error: { message: capacityError } } });
  };
  fail(turn);
  let replayId = 0;
  f.native.handlers.set('turn/start', () => {
    const id = `late-start-${++replayId}`;
    f.native.turns.set(id, []);
    return { turn: { id } }; // Some app-servers send turn/started after this reply.
  });
  for (const [index, delay] of [30_000, 60_000, 120_000].entries()) {
    await eventually(`retry ${index + 1} scheduled`, async () => (await f.log()).includes(`"attempt":${index + 1},"delay":${delay}`) || undefined);
    if (index === 2) f.native.handlers.set('turn/start', params => {
      const id = 'capacity-final';
      f.native.start(id);
      f.native.item(id, (params.toolOutput as { output: string }).output, 'toolOutput');
      fail(id); // Native completion can precede the turn/start reply.
      return { turn: { id } };
    });
    await f.clock.advance(delay - 1);
    assert.equal(f.native.count('turn/start'), index + 1);
    await f.clock.advance(1);
    await eventually(`retry ${index + 1} admitted`, async () => (await f.log()).includes(`"event":"turn-capacity-retried","session":"impl","attempt":${index + 1}`) || undefined);
    turn = [...f.native.turns.keys()].at(-1)!;
    if (index < 2) {
      f.native.state('active');
      f.native.notify('turn/started', { turn: { id: turn } });
      f.native.item(turn, text, 'toolOutput');
      fail(turn);
    }
  }
  await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).text.includes('retries exhausted'));
  fail(turn); // Duplicate native completion must not create a second terminal report.
  await f.clock.advance(300_000);
  assert.equal(f.native.count('turn/start'), 4);
  const reports = f.ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).to.includes('sender') && (frame.message as Message).text.includes('its turn failed:'));
  assert.equal(reports.length, 1, 'the sender/Coordinator receives only the terminal failure, including late attribution');
  assert.equal((await f.agents()).filter(row => row.text.includes('provider capacity retry ')).length, 3);
});

test('provider capacity replays the exact failed turn input after thirty seconds without a message', async t => {
  const f = await scriptedCodex(t);
  const id = await f.send('finish the review');
  await f.injected(id);
  const original = f.native.calls.find(call => call.method === 'turn/start')!.params;
  const turn = [...f.native.turns.keys()].at(-1)!;
  f.native.item(turn, (original.toolOutput as { output: string }).output, 'toolOutput');
  f.native.state('idle');
  f.native.notify('turn/completed', { turn: { id: turn, status: 'failed', error: { message: capacityError } } });
  await eventually('capacity retry scheduled', async () => (await f.log()).includes('"event":"turn-capacity-retry-scheduled"') || undefined);
  await f.clock.advance(29_999);
  assert.equal(f.native.count('turn/start'), 1, 'backoff does not replay early');
  const posted = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).text.includes('provider capacity retry 1/3'));
  await f.clock.advance(1);
  await posted;
  await eventually('replayed native input admitted', async () => (await f.log()).includes('"event":"turn-capacity-retried"') || undefined);
  assert.equal(f.native.count('turn/start'), 2);
  assert.deepEqual(f.native.calls.filter(call => call.method === 'turn/start')[1]!.params, original);
  const retryTurn = [...f.native.turns.keys()].at(-1)!;
  f.native.item(retryTurn, (original.toolOutput as { output: string }).output, 'toolOutput');
  f.native.complete(retryTurn);
  await f.clock.advance(300_000);
  assert.equal(f.native.count('turn/start'), 2, 'successful retry ends the episode');
});

test('new native work cancels capacity replay without reporting retry exhaustion', async t => {
  const f = await scriptedCodex(t);
  const id = await f.send('old work');
  await f.injected(id);
  const turn = [...f.native.turns.keys()].at(-1)!;
  f.native.item(turn, 'old input');
  f.native.state('idle');
  f.native.notify('turn/completed', { turn: { id: turn, status: 'failed', error: { message: capacityError } } });
  await eventually('old work retry scheduled', async () => (await f.log()).includes('"event":"turn-capacity-retry-scheduled"') || undefined);
  f.native.start('human-next-turn');
  f.native.item('human-next-turn', 'new work');
  f.native.complete('human-next-turn');
  await f.clock.advance(30_000);
  await f.ui.request({ type: 'session.list' });
  assert.equal(f.native.count('turn/start'), 1);
  assert.equal((await f.agents()).filter(row => row.text.includes('provider capacity replay stopped')).length, 0, 'superseded work is cancellation, not exhausted recovery');
});

test('new native work staying busy during held capacity readback cancels without terminal failure', async t => {
  const f = await scriptedCodex(t);
  const id = await f.send('superseded during readback');
  await f.injected(id);
  const turn = [...f.native.turns.keys()].at(-1)!;
  f.native.item(turn, 'old input');
  f.native.state('idle');
  f.native.notify('turn/completed', { turn: { id: turn, status: 'failed', error: { message: capacityError } } });
  await eventually('retry scheduled before held readback', async () => (await f.log()).includes('"event":"turn-capacity-retry-scheduled"') || undefined);
  const held = deferred<{ thread: { turns: Array<{ id: string; items: Array<{ type: string; content: Array<{ text: string }> }> }> } }>();
  let reading = false;
  f.native.handlers.set('thread/read', () => { reading = true; return held.promise; });
  await f.clock.advance(30_000);
  await eventually('held native readback entered', () => reading || undefined);
  const busy = f.ui.waitFor(frame => frame.type === 'session.state' && frame.sessionId === f.process.sessionId && frame.state === 'busy');
  f.native.start('new-work-during-readback');
  await busy;
  held.resolve({ thread: { turns: [{ id: turn, items: [{ type: 'userMessage', content: [{ text: 'old input' }] }] }] } });
  await eventually('readback continuation settled', async () => (await f.log()).includes('"event":"turn-capacity-retry-cancelled"') || (await f.agents()).some(row => row.text.includes('provider capacity replay stopped')) || undefined);
  assert.equal(f.native.count('turn/start'), 1, 'obsolete input is never submitted');
  assert.equal((await f.agents()).filter(row => row.text.includes('provider capacity replay stopped') || row.text.includes('retries exhausted')).length, 0, 'superseded readback is cancellation even while new work stays busy');
});

for (const action of ['stop', 'archive', 'reassign', 'new message', 'held readback reassign', 'item reassignment'] as const) {
  test(`capacity retry is cancelled by ${action}`, async t => {
    const f = await scriptedCodex(t);
    const id = await f.send('cancel this retry');
    await f.injected(id);
    const turn = [...f.native.turns.keys()].at(-1)!;
    f.native.item(turn, 'the original input');
    f.native.state('idle');
    f.native.notify('turn/completed', { turn: { id: turn, status: 'failed', error: { message: capacityError } } });
    await eventually('retry scheduled before cancellation', async () => (await f.log()).includes('"event":"turn-capacity-retry-scheduled"') || undefined);
    const held = deferred<{ thread: { turns: Array<{ id: string; items: Array<{ type: string; content: Array<{ text: string }> }> }> } }>();
    let reading = false;
    if (action === 'held readback reassign') {
      f.native.handlers.set('thread/read', () => { reading = true; return held.promise; });
      await f.clock.advance(30_000);
      await eventually('readback request entered', () => reading || undefined);
    }
    if (action === 'stop' || action === 'archive') {
      assert.equal((await f.ui.request({ type: 'session.stop', session: 'impl' })).ok, true);
      if (action === 'archive') assert.equal((await f.ui.request({ type: 'session.archive', session: 'impl' })).ok, true);
    } else if (action === 'new message') {
      const next = await f.send('replacement work');
      await f.injected(next);
    } else if (action === 'item reassignment') {
      const created = await f.ui.request({ type: 'task.create', title: 'Replacement assignment', size: 'S', assignee: 'impl' });
      assert.equal(created.ok, true, created.error);
      const item = (created.value as { item: { id: string } }).item.id;
      assert.equal((await f.peer.call<{ ok: boolean }>('task.claim', { id: item })).ok, true);
    } else {
      assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'reviewer' })).ok, true);
      // Even assigning the old role back must not resurrect its cancelled retry.
      assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
    }
    held.resolve({ thread: { turns: [{ id: turn, items: [{ type: 'userMessage', content: [{ text: 'the original input' }] }] }] } });
    const before = f.native.count('turn/start');
    await f.clock.advance(300_000);
    await f.ui.request({ type: 'session.list' });
    assert.equal(f.native.count('turn/start'), before, 'no obsolete turn is submitted');
    assert.equal((await f.agents()).filter(row => row.text.includes('provider capacity retry ')).length, 0);
  });
}

test('capacity exhaustion on an item claimant reports to the Coordinator without waking itself', async t => {
  const f = await scriptedCodex(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'sender', role: 'coordinator' })).ok, true);
  const created = await f.ui.request({ type: 'task.create', title: 'Claimed capacity failure', size: 'S', assignee: 'impl' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const claimed = await f.peer.call<{ ok: boolean; error?: string }>('task.claim', { id: item });
  assert.equal(claimed.ok, true, claimed.error);
  const id = await f.send('claimed work');
  await f.injected(id);
  const turn = [...f.native.turns.keys()].at(-1)!;
  // Unavailable readback takes the same terminal reporting path as exhaustion.
  f.native.state('idle');
  f.native.notify('turn/completed', { turn: { id: turn, status: 'failed', error: { message: capacityError } } });
  await eventually('claimed retry scheduled', async () => (await f.log()).includes('"event":"turn-capacity-retry-scheduled"') || undefined);
  await f.clock.advance(30_000);
  const note = await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).text.includes('provider capacity replay stopped'));
  assert.deepEqual((note.message as Message).to, ['sender']);
  await f.clock.advance(300_000);
  assert.equal(f.native.count('turn/start'), 1, 'the terminal report must not start a new failed-turn episode');
});

test('capacity replay retains native launch input without a hub delivery id', async t => {
  const f = await scriptedCodex(t);
  f.native.start('launch-turn');
  f.native.item('launch-turn', 'role clause\n\noriginal launch brief');
  f.native.state('idle');
  f.native.notify('turn/completed', { turn: { id: 'launch-turn', status: 'failed', error: { message: capacityError } } });
  await eventually('launch input replay scheduled', async () => (await f.log()).includes('"event":"turn-capacity-retry-scheduled"') || undefined);
  await f.clock.advance(30_000);
  await eventually('initial turn replay admitted', async () => (await f.log()).includes('"event":"turn-capacity-retried"') || undefined);
  assert.deepEqual(f.native.calls.find(call => call.method === 'turn/start')!.params.input, [{ type: 'text', text: 'role clause\n\noriginal launch brief', text_elements: [] }]);
});

for (const fault of ['missing input', 'ambiguous admission'] as const) {
  test(`capacity recovery stops once on ${fault}`, async t => {
    const f = await scriptedCodex(t);
    assert.equal((await f.ui.request({ type: 'role.set', session: 'sender', role: 'coordinator' })).ok, true);
    const id = await f.send('do not guess this input');
    await f.injected(id);
    const turn = [...f.native.turns.keys()].at(-1)!;
    if (fault !== 'missing input') f.native.item(turn, 'original input');
    f.native.state('idle');
    f.native.notify('turn/completed', { turn: { id: turn, status: 'failed', error: { message: capacityError } } });
    await eventually('faulted retry scheduled', async () => (await f.log()).includes('"event":"turn-capacity-retry-scheduled"') || undefined);
    if (fault === 'ambiguous admission') f.native.handlers.set('turn/start', () => { throw new RpcNoAnswer('native answer lost after submission'); });
    const stopped = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).to.includes('sender') && (frame.message as Message).text.includes('provider capacity replay stopped'));
    await f.clock.advance(30_000);
    await stopped;
    await f.clock.advance(300_000);
    assert.equal(f.native.count('turn/start'), fault === 'missing input' ? 1 : 2);
    assert.equal(f.ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).to.includes('sender') && (frame.message as Message).text.includes('provider capacity replay stopped')).length, 1);
  });
}

for (const error of ['Upstream request failed: Endpoint is unavailable', 'usage limit exceeded', 'authentication_failed']) {
  test(`ordinary turn failure is not capacity-retried: ${error}`, async t => {
    const f = await scriptedCodex(t);
    const id = await f.send('ordinary failure', true);
    await f.injected(id);
    const turn = [...f.native.turns.keys()].at(-1)!;
    const reported = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).kind === 'turn-failed' && (frame.message as Message).text.endsWith(error));
    f.native.state('idle');
    f.native.notify('turn/completed', { turn: { id: turn, status: 'failed', error: { message: error } } });
    await reported;
    await f.clock.advance(300_000);
    assert.equal(f.native.count('turn/start'), 1);
    assert.equal((await f.agents()).filter(row => row.text.includes('provider capacity retry ')).length, 0);
  });
}

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
