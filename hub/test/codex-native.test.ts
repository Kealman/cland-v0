// T2: production Codex admission/reconciliation on a scripted in-process native connection.
// Lifecycle comes from T-686's fake; socket peers and hub reports remain real. No binary or
// elapsed-time wait. Native request replies and journal receipts bound every negative assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { AppServerClient, RpcError, RpcNoAnswer } from '../src/adapters/codex/app-server.ts';
import { deferred, scriptedCodex } from './fakes/scripted-codex.ts';
import { eventually } from './harness.ts';
import type { Message } from '../src/protocol.ts';

const failure = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
const redelivered = (intoActive: boolean) => `impl [Implementer]: its turn ended without a message it had accepted; the message was delivered again ${intoActive ? 'into a running turn' : 'as a new turn'}`;
type Fixture = Awaited<ReturnType<typeof scriptedCodex>>;
async function active(f: Fixture) {
  f.native.start('original');
  // A known input lets readback judge missing steers independently of their shape.
  f.native.item('original', 'original native input');
  f.native.approval();
  f.native.state('active', ['waitingOnApproval']);
  await f.ui.request({ type: 'session.list' });
}
const textOf = (params: Record<string, unknown>) => ((params.input as Array<{ text: string }> | undefined)?.[0]?.text ?? (params.toolOutput as { output: string } | undefined)?.output)!;
async function recoveries(f: Fixture, id: string, count: number) {
  await eventually('recovery receipt', async () => (await f.records()).filter(e => e.event === 'harness-redelivered' && e.id === id).length === count || undefined);
}
async function consumeRecovery(f: Fixture) {
  const request = f.native.calls.filter(c => c.method === 'turn/start').at(-1)!;
  const id = [...f.native.turns.keys()].at(-1)!;
  f.native.item(id, textOf(request.params), request.params.toolOutput ? 'toolOutput' : 'text');
  f.native.complete(id);
  await f.records();
}

// Both orderings share one hub, and use a new connection per table row.
test('deferred reconnect snapshots preserve newer approval events in either arrival order', async t => {
  const f = await scriptedCodex(t);
  for (const order of ['request-first', 'state-first']) {
    const subscription = deferred<unknown>();
    f.native.handlers.set('thread/resume', () => subscription.promise);
    const beforeCalls = f.native.count('thread/resume');
    await f.reconnect();
    await eventually('subscription pending', () => f.native.count('thread/resume') === beforeCalls + 1 || undefined);
    const approvalMark = f.ui.frames.length;
    if (order === 'request-first') f.native.approval('touch deferred-approved');
    f.native.state('active', ['waitingOnApproval']);
    if (order === 'state-first') f.native.approval('touch deferred-approved');
    await f.ui.waitFor(frame => f.ui.frames.indexOf(frame) >= approvalMark && frame.type === 'session.state' && frame.approvalCommand === 'touch deferred-approved');
    const mark = f.ui.frames.length;
    subscription.resolve({ thread: { id: f.native.thread, status: { type: 'active', activeFlags: [] } } });
    await f.records();
    const rows = (await f.ui.request({ type: 'session.list' })).value as { processes: Array<{ state: string; approvalCommand?: string }> };
    assert.ok(rows.processes.some(p => p.state === 'waiting for approval' && p.approvalCommand === 'touch deferred-approved'), order);
    assert.ok(f.ui.frames.slice(mark).filter(frame => frame.type === 'session.state').every(frame => frame.state !== 'busy'), 'stale busy snapshot cannot overwrite a newer event');
    assert.ok(!JSON.stringify(f.ui.frames).includes('PRIVATE-TOOL-INPUT'));
    f.native.state('idle');
    await f.records();
  }
});

test('idle subscription snapshots clear completed approval metadata before the next waiting episode', async t => {
  const f = await scriptedCodex(t);
  for (const lifecycle of ['resume', 'relaunch']) {
    await active(f);
    // Resume retains Live; relaunch unwatches and reconstructs it, both through #subscribe.
    if (lifecycle === 'relaunch') f.adapter.unwatch(f.process.sessionId);
    const before = f.native.count('thread/resume');
    if (lifecycle === 'relaunch') { f.native.removeAllListeners(); f.adapter.watch(f.process); }
    else await f.reconnect();
    await eventually('idle snapshot applied', () => f.native.count('thread/resume') === before + 1 || undefined);
    await f.records();
    const mark = f.ui.frames.length;
    f.native.state('active', ['waitingOnApproval']);
    const event = await f.ui.waitFor(frame => f.ui.frames.indexOf(frame) >= mark && frame.type === 'session.state' && frame.state === 'waiting for approval');
    assert.equal(event.approvalCommand, undefined, lifecycle);
    const rows = (await f.ui.request({ type: 'session.list' })).value as { processes: Array<{ approvalCommand?: string }> };
    assert.equal(rows.processes[0]?.approvalCommand, undefined);
  }
});

test('failure before a pending steer response notifies only admitted senders', async t => {
  const f = await scriptedCodex(t);
  for (const accepted of [false, true]) {
    await active(f);
    const response = deferred<unknown>();
    f.native.handlers.set('turn/steer', () => response.promise);
    const id = await f.send(`${accepted ? 'accepted' : 'rejected'} pending failure`, true);
    await eventually('pending steer', () => f.native.calls.some(c => c.method === 'turn/steer' && textOf(c.params).includes(id)) || undefined);
    const mark = f.sender.events.length;
    f.native.complete('original', true);
    if (accepted) response.resolve({});
    else response.reject(new RpcError(-32000, 'no active turn to steer'));
    await f.injected(id); // Rejected steer falls back to a new, successful native admission.
    if (accepted) await f.sender.waitForEvent(e => e.params.content.includes(failure));
    await f.records();
    assert.equal(f.sender.events.slice(mark).some(e => e.params.content.includes(failure)), accepted);
    if (!accepted) await consumeRecovery(f);
  }
});

test('completion before an unanswered late steer never replays an ambiguous admission', async t => {
  const f = await scriptedCodex(t);
  for (const mode of ['rejected', 'unanswered']) {
    await active(f);
    const response = deferred<unknown>();
    f.native.handlers.set('turn/steer', () => response.promise);
    const id = await f.send(`late ${mode} steer`);
    await eventually('pending steer', () => f.native.calls.some(c => c.method === 'turn/steer' && textOf(c.params).includes(id)) || undefined);
    f.native.complete('original');
    // At the native boundary both an absent reply and a reply held beyond its deadline are RpcNoAnswer.
    response.reject(new RpcNoAnswer(`no answer before deadline (${mode})`));
    await eventually('uncertain receipt', async () => (await f.log()).includes(`"event":"inject-uncertain","id":"${id}"`) || undefined);
    const events = await f.records();
    assert.equal(events.filter(e => e.event === 'harness-redelivered' && e.id === id).length, 0);
    assert.equal(f.native.count('turn/start'), 0);
    assert.equal(f.ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).text === `pong: @impl late ${mode} steer`).length, 0);
  }
});

test('successful completion reconciles late rejected, consumed and dropped steer responses', async t => {
  const f = await scriptedCodex(t);
  for (const mode of ['reject', 'accept', 'accept dropped']) {
    await active(f);
    const response = deferred<unknown>();
    f.native.handlers.set('turn/steer', () => response.promise);
    const body = `${mode} pending steer response`;
    const id = await f.send(body);
    await eventually('pending admission', () => f.native.calls.some(c => c.method === 'turn/steer' && textOf(c.params).includes(id)) || undefined);
    const input = textOf(f.native.calls.filter(c => c.method === 'turn/steer').at(-1)!.params);
    if (mode === 'accept') f.native.item('original', input);
    f.native.complete('original');
    if (mode === 'reject') response.reject(new RpcError(-32000, 'no active turn to steer'));
    else response.resolve({});
    await f.injected(id);
    if (mode === 'accept dropped') await recoveries(f, id, 1);
    if (mode !== 'accept') await consumeRecovery(f);
    await f.reply(id, body);
    const events = await f.records();
    assert.equal(events.filter(e => e.event === 'harness-redelivered' && e.id === id).length, mode === 'accept dropped' ? 1 : 0);
    assert.equal(f.ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).text === `pong: @impl ${body}`).length, 1);
  }
});

test('accepted dropped steers are recovered once while consumed steers stay consumed', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const taken = await f.send('a steer the turn takes up');
  await f.injected(taken);
  const input = textOf(f.native.calls.filter(c => c.method === 'turn/steer').at(-1)!.params);
  f.native.item('original', input);
  const dropped = await f.send('drop this steer');
  await f.injected(dropped);
  assert.equal(f.native.count('turn/steer'), 2);
  f.native.complete('original');
  await recoveries(f, dropped, 1);
  await consumeRecovery(f);
  await f.reply(taken, 'a steer the turn takes up');
  await f.reply(dropped, 'drop this steer');
  assert.deepEqual((await f.records()).filter(e => e.event === 'harness-redelivered').map(e => [e.session, e.id]), [['impl', dropped]]);
  assert.equal((await f.log()).split('\n').filter(line => line.includes('"harness-steered"') && line.includes(taken)).length, 1);
  assert.deepEqual((await f.agents()).filter(m => m.kind === 'redelivered').map(m => m.text), [redelivered(false)]);
});

test('idle tool-output readback distinguishes consumed, unannounced and unread inputs', async t => {
  const f = await scriptedCodex(t);
  for (const mode of ['announced', 'unannounced', 'lost envelope', 'read refused', 'unknown item']) {
    f.native.handlers.delete('thread/read');
    const before = f.native.count('turn/start');
    const body = `idle ${mode}`;
    const id = await f.send(body);
    await f.injected(id);
    const request = f.native.calls.filter(c => c.method === 'turn/start').at(-1)!;
    assert.equal((request.params.toolOutput as { name: string }).name, 'hub_event');
    const turn = [...f.native.turns.keys()].at(-1)!;
    if (mode === 'announced' || mode === 'unannounced') f.native.item(turn, textOf(request.params), 'toolOutput', mode === 'announced');
    else if (mode === 'unknown item') f.native.turns.get(turn)!.push({ type: 'unknownInput' });
    else f.native.item(turn, 'unrelated user input', 'text', false);
    if (mode === 'read refused') f.native.handlers.set('thread/read', () => { throw new RpcError(-32000, 'readback refused'); });
    f.native.complete(turn);
    await f.reply(id, body);
    const unread = !['announced', 'unannounced'].includes(mode);
    if (unread) await eventually('unread receipt', async () => (await f.records()).some(e => e.event === 'harness-turn-unread' && e.ids?.includes(id)) || undefined);
    f.native.handlers.delete('thread/read');
    // A later completed native input is the positive barrier replacing every settling sleep.
    const later = await f.send(`later ${mode}`);
    await f.injected(later);
    await consumeRecovery(f);
    await f.reply(later, `later ${mode}`);
    const records = await f.records();
    assert.deepEqual(records.filter(e => e.event === 'harness-turn-unread' && e.ids?.includes(id)).map(e => [e.ids, e.error]), unread ? [[[id], mode === 'read refused' ? 'readback refused' : "the turn's record shows no input item of the shape it was admitted in"]] : []);
    assert.deepEqual(records.filter(e => /harness-(redelivered|redelivery-failed)/.test(e.event)), []);
    assert.equal(f.native.count('turn/start'), before + 2, 'one native turn per delivery');
    assert.deepEqual(f.ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).replyTo === id).map(frame => (frame.message as Message).text), [`pong: @impl ${body}`]);
  }
  assert.deepEqual((await f.agents()).filter(m => m.kind === 'redelivered' || m.kind === 'turn-failed'), []);
});

test('a recovery dropped in a newer turn retains its obligation until consumed', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const id = await f.send('drop recovery in newer turn');
  await f.injected(id);
  f.native.handlers.set('thread/read', () => {
    if (!f.native.turns.has('newer')) f.native.start('newer');
    return { thread: { turns: [...f.native.turns].map(([id, items]) => ({ id, items })) } };
  });
  f.native.handlers.set('turn/start', () => ({ turn: { id: 'newer' } }));
  f.native.complete('original');
  await recoveries(f, id, 1);
  f.native.item('newer', 'unrelated newer input');
  f.native.handlers.delete('turn/start');
  f.native.complete('newer');
  await recoveries(f, id, 2);
  await consumeRecovery(f);
  await f.reply(id, 'drop recovery in newer turn');
  assert.equal((await f.records()).filter(e => e.event === 'harness-redelivered' && e.id === id).length, 2);
  assert.deepEqual((await f.agents()).filter(m => m.kind === 'redelivered').map(m => m.text), [redelivered(true), redelivered(false)]);
});

test('a recovered turn failing before its admission response notifies the original sender once', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const id = await f.send('fail recovered turn before response', true);
  await f.injected(id);
  const response = deferred<unknown>();
  f.native.handlers.set('turn/start', () => { f.native.start('recovery'); f.native.complete('recovery', true); return response.promise; });
  f.native.complete('original');
  await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).text === failure);
  response.resolve({ turn: { id: 'recovery' } });
  await f.sender.waitForEvent(e => e.params.content.includes(failure));
  await f.records();
  assert.equal(f.sender.events.filter(e => e.params.content.includes(failure)).length, 1);
  const events = (await f.ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.equal(events.rows.filter(row => row.text === failure).length, 1);
});

test('a refused recovery reports its failure through journal, Agents, events and original sender', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const id = await f.send('refuse recovered request', true);
  await f.injected(id);
  f.native.handlers.set('turn/start', () => { throw new RpcError(-32000, 'recovery request refused'); });
  f.native.complete('original');
  const expected = 'impl [Implementer]: its turn ended without a message it had accepted, and delivering it again failed: recovery request refused';
  await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).kind === 'turn-failed' && (frame.message as Message).text === expected);
  const records = await f.records();
  assert.equal(records.filter(e => e.event === 'harness-redelivery-failed' && e.id === id && e.error === 'recovery request refused').length, 1);
  assert.equal(records.filter(e => e.event === 'harness-redelivered' && e.id === id).length, 0);
  const events = (await f.ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.equal(events.rows.filter(row => row.text === expected).length, 1);
  await f.sender.waitForEvent(e => e.params.content.includes('redelivery failed: recovery request refused'));
});

test('repeated dropped recoveries stop visibly after two attempts', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const id = await f.send('drop every recovery');
  await f.injected(id);
  f.native.complete('original');
  for (let attempt = 1; attempt <= 2; attempt++) {
    await recoveries(f, id, attempt);
    const turn = [...f.native.turns.keys()].at(-1)!;
    // A known tool output of the right shape permits a negative consumption judgment.
    f.native.item(turn, 'another envelope', 'toolOutput');
    f.native.complete(turn);
  }
  await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).kind === 'turn-failed' && (frame.message as Message).text.includes('still missing after two redeliveries'));
  const records = await f.records();
  assert.equal(records.filter(e => e.event === 'harness-redelivered' && e.id === id).length, 2);
  assert.equal(records.filter(e => e.event === 'harness-redelivery-failed' && e.id === id).length, 1);
  assert.equal(f.native.count('turn/start'), 2, 'no third native recovery');
});

test('native RPC classifies malformed replies and accepted-then-disconnected requests as unanswered', async () => {
  for (const mode of ['malformed', 'disconnected']) {
    const output = new PassThrough();
    const input = new PassThrough();
    const calls: string[] = [];
    input.on('data', bytes => {
      for (const line of String(bytes).trim().split('\n')) {
        const frame = JSON.parse(line) as { id?: number; method: string };
        calls.push(frame.method);
        if (frame.method === 'initialize') output.write(JSON.stringify({ id: frame.id, result: {} }) + '\n');
        else if (frame.method === 'turn/start') {
          // Receipt of this request precedes either fault: the server may have run the input.
          if (mode === 'malformed') output.write('not JSON\n');
          else output.end();
        }
      }
    });
    const client = await AppServerClient.connectStdio(output, input, { client: { name: 'test', version: '0' } });
    try {
      await assert.rejects(client.request('turn/start', { threadId: 'thread', input: [] }), RpcNoAnswer);
      assert.equal(calls.filter(method => method === 'turn/start').length, 1);
    } finally { client.close(); output.destroy(); input.destroy(); }
  }
});
