// T2: Claude signal attribution and delivery rules through real frames, production interpretation and fake harness I/O.
// Native hook ordering, early bridge input, PID identity, escalation and held-hook reaping are in the lifecycle split.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { realClock } from '../src/hub/clock.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeHarness, type FakeHarness } from './fakes/harness.ts';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject, type FrameClient } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
type Harness = HarnessProcessView;
type Status = { sessions: Array<{ name: string; sessionId: string; state: string }>; harnesses: Harness[] };
async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status', history: true });
  assert.equal(r.ok, true, r.error);
  return r.value as Status;
}
const harness = async (ui: FrameClient, name: string): Promise<Harness> => {
  const h = (await status(ui)).harnesses.find(x => x.name === name);
  assert.ok(h, `no harness row ${name}`);
  return h;
};
const hubLog = (root: string) => readFile(join(root, '.cland/log/hub.log'), 'utf8');
async function fixture(t: TestContext) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  let fake!: FakeHarness;
  const { discovery } = await projectHub(t, root, {}, { clock, adapters: [(host, clock) => {
    // Only interpretation needs the production adapter's bounded prompt history; no native methods run.
    const interpreter = new ClaudeCodeAdapter(host, { clock, bin: 'unused-claude', env: { HOME: root } });
    fake = fakeHarness('claude-code', { host, clock });
    fake.interpret = interpreter.interpret.bind(interpreter);
    const close = fake.close.bind(fake);
    fake.close = () => { interpreter.close(); close(); };
    return fake;
  }] });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launch = async (name: string, extra: Record<string, unknown> = {}) => {
    const result = await ui.request({ type: 'session.launch', name, ...extra });
    assert.equal(result.ok, true, result.error);
    const process = (result.value as { process: Harness }).process;
    fake.idle(name);
    return process;
  };
  const signal = async (name: string, launch: string, event: string, payload: Record<string, unknown> = {}) => {
    const result = await ui.request({ type: 'session.signal', session: name, launch, event, at: typeof payload.at === 'number' ? payload.at : clock.now().getTime(), payload });
    assert.equal(result.ok, true, result.error);
    return result;
  };
  const peer = (name: string, process: Harness) => inProcessSpoke(t, { cwd: root, discover: true, name, assignRole: false, sessionId: process.sessionId, launchToken: fake.spawns.findLast(s => s.name === name)!.launchToken! });
  return { root, ui, clock, fake, launch, signal, peer };
}

test('in-process Claude signal order drops an older Stop arriving after the next turn start regardless of elapsed time', async t => {
  const f = await fixture(t);
  const { root, ui, clock } = f;
  const launched = await f.launch('coord', { role: 'coordinator', harness: 'claude-code' });
  const peer = await f.peer('coord', launched);
  await peer.waitForPresence(['coord']);
  // Stop was fired first, but its hook has not posted yet. The next start is
  // observed first; scheduling delays do not change either event's timestamp.
  const stopAt = clock.now().getTime() + 1;
  const started = await f.signal('coord', launched.sessionId, 'turn-start', { at: stopAt + 1 });
  assert.deepEqual(started.value, { applied: true, state: 'busy' });
  assert.equal((await status(ui)).sessions.find(s => s.name === 'coord')?.state, 'busy');
  await clock.advance(20_000); // Beyond the former T3 fixture's 10-second poll window.
  const stopped = await f.signal('coord', launched.sessionId, 'turn-end', { at: stopAt });
  assert.deepEqual(stopped.value, { applied: false, state: 'busy' });
  assert.equal((await status(ui)).sessions.find(s => s.name === 'coord')?.state, 'busy');
  assert.equal((await harness(ui, 'coord')).state, 'busy', 'the older Stop arrived last and was dropped');
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"signal-stale","session":"coord","state":"idle","source":"hook"/);
  // Rejecting the stale Stop must still allow this turn's own later completion.
  const completed = await f.signal('coord', launched.sessionId, 'turn-end', { at: stopAt + 2 });
  assert.deepEqual(completed.value, { applied: true, state: 'idle' });
  assert.equal((await harness(ui, 'coord')).state, 'idle');
});

test('in-process Claude failures retain sender attribution across delayed prompt starts', async (t) => {
  const f = await fixture(t);
  const { root, ui, clock, launch } = f;
  const launched = await launch('coord', { role: 'coordinator' });
  const coord = await f.peer('coord', launched);
  await coord.waitForPresence(['coord']);
  const a = await inProcessSpoke(t, { cwd: root, discover: true, name: 'sender-a', role: 'implementer' });
  const b = await inProcessSpoke(t, { cwd: root, discover: true, name: 'sender-b', role: 'reviewer' });
  t.after(async () => { await a.close(); await b.close(); });
  await a.waitForPresence(['sender-a']);
  await b.waitForPresence(['sender-b']);
  await a.call('send', { to: ['coord'], text: 'first turn' });
  await coord.waitForEvent(e => e.params.content.includes('first turn'));
  await coord.call('send', { to: ['sender-a'], text: 'pong: first turn' });

  await b.call('send', { to: ['coord'], text: 'second turn' });
  await coord.waitForEvent(e => e.params.content.includes('second turn'));
  await coord.call('send', { to: ['sender-b'], text: 'pong: second turn' });
  const first = await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string; text: string }).from === 'sender-a');
  const second = await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string; text: string }).from === 'sender-b');
  const firstId = (first.message as { id: string }).id;
  const secondId = (second.message as { id: string }).id;
  await eventually('both inputs answered', () => ui.frames.filter((f) => f.type === 'message' && (f.message as { from: string; text: string }).from === 'coord' && ['pong: first turn', 'pong: second turn'].includes((f.message as { text: string }).text)).length === 2 ? true : undefined);
  const at = clock.now().getTime() + 10_000;
  const signal = (event: string, payload: Record<string, unknown>) => f.signal('coord', launched.sessionId, event, payload);
  await signal('turn-start', { at, prompt_id: 'first', ids: [firstId] });
  await signal('turn-start', { at: at + 2000, prompt_id: 'second', ids: [secondId] });
  await signal('turn-start', { at: at + 100, prompt_id: 'first', ids: [firstId] }); // A's older hook arrives after B's
  await signal('turn-end', { at: at + 1000, prompt_id: 'first', hook_event_name: 'StopFailure', error: 'server_error', error_details: 'first turn failed' });
  await a.waitForEvent((e) => e.params.content.includes('its turn failed: first turn failed'));
  assert.equal(b.events.some((e) => e.params.content.includes('its turn failed: first turn failed')), false);
  assert.equal((await harness(ui, 'coord')).state, 'busy', 'the older failure is reported without replacing the newer busy');
  await signal('turn-end', { at: at + 3000, prompt_id: 'second', hook_event_name: 'StopFailure', error: 'server_error', error_details: 'second turn failed' });
  await b.waitForEvent((e) => e.params.content.includes('its turn failed: second turn failed'));
  assert.equal(a.events.some((e) => e.params.content.includes('its turn failed: second turn failed')), false);

  clock.block(20_000);
  await t.test('a failure preceding prompt start later reaches only its matching sender', async () => {
    await signal('turn-start', { prompt_id: 'prior', ids: [firstId] });
    await signal('turn-end', { prompt_id: 'late-start', hook_event_name: 'StopFailure', error: 'failure before start' });
    await ui.waitFor((f) => f.type === 'message' && (f.message as { kind?: string; text: string }).kind === 'turn-failed' && (f.message as { text: string }).text.includes('failure before start'));
    assert.equal(a.events.some((e) => e.params.content.includes('its turn failed: failure before start')), false);
    assert.equal(b.events.some((e) => e.params.content.includes('its turn failed: failure before start')), false);
    await signal('turn-start', { prompt_id: 'late-start', ids: [secondId] });
    await b.waitForEvent((e) => e.params.content.includes('its turn failed: failure before start'));
    assert.equal(a.events.some((e) => e.params.content.includes('its turn failed: failure before start')), false);
  });

  await t.test('bounded Claude prompt history forgets unresolved old sender attribution', async () => {
    await signal('turn-end', { prompt_id: 'expired', hook_event_name: 'StopFailure', error: 'expired failure' });
    for (let i = 0; i < 128; i++) await signal('turn-start', { prompt_id: `recent-${i}`, ids: [secondId] });
    await signal('turn-start', { prompt_id: 'expired', ids: [firstId] });
    await signal('turn-end', { prompt_id: 'recent-127', hook_event_name: 'StopFailure', error: 'recent failure' });
    await b.waitForEvent((e) => e.params.content.includes('its turn failed: recent failure'));
    assert.equal(a.events.some((e) => e.params.content.includes('its turn failed: expired failure')), false);
  });
});

test('in-process Claude signals cannot replace a newer launch identity', async (t) => {
  const f = await fixture(t);
  const { root, ui, fake, launch } = f;
  const first = await launch('impl-1', { role: 'coordinator', harness: 'claude-code' });

  fake.exit('impl-1');
  await eventually('the first process gone', async () => ((await harness(ui, 'impl-1')).status === 'exited' ? true : undefined));

  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const second = await launch('impl-1', { role: 'coordinator', harness: 'claude-code' });

  const row = await harness(ui, 'impl-1');
  assert.equal(row.sessionId, second.sessionId);

  // the first launch's hooks, late: its own conversation id, a turn start
  await f.signal('impl-1', first.sessionId, 'session-start', { session_id: first.harnessSessionId });
  await f.signal('impl-1', first.sessionId, 'turn-start', { session_id: first.harnessSessionId });
  const after = await harness(ui, 'impl-1');
  assert.equal(after.harnessSessionId, row.harnessSessionId, "the replacement keeps its own conversation id");
  assert.equal(after.state, 'idle', 'and its own state');
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"signal-other-launch","session":"impl-1"/);
});

test('in-process Claude SessionStart leaves an exited session inactive', async (t) => {
  const f = await fixture(t);
  const { root, ui, fake, launch } = f;
  const launched = await launch('impl-1', { role: 'implementer', harness: 'claude-code' });

  fake.exit('impl-1');
  await eventually('the process gone', async () => ((await harness(ui, 'impl-1')).status === 'exited' ? true : undefined));

  await f.signal('impl-1', launched.sessionId, 'session-start', { session_id: launched.harnessSessionId });
  const row = await harness(ui, 'impl-1');
  assert.equal(row.status, 'exited');
  assert.equal(row.state, 'unknown');
});


for (const rename of [false, true]) test(rename
  ? 'renaming an in-process Claude session preserves a pending input confirmation'
  : 'in-process Claude injection remembers an idle received before its rejection', async t => {
  const f = await fixture(t);
  const { ui, fake, clock } = f;
  const launched = await f.launch('coord', { role: 'coordinator' });
  const peer = await f.peer('coord', launched);
  await peer.waitForPresence(['coord']);
  // Carried clauses are already confirmed at spawn. This message exercises the same
  // unconfirmed-inject state machine without pretending to execute the harness's first turn.
  fake.scriptInject('coord', { outcome: 'reject', afterMs: 1000 }, 'accept');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'pending input' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: { id: string } }).message.id;
  await peer.waitForEvent(e => e.params.content.includes('pending input'));
  await eventually('the pending inject starts', () => fake.injections.some(i => i.message.id === id) || undefined);
  // Signals carry transport timestamps, independently of the policy clock.
  const at = realClock.now().getTime() + 1;
  await f.signal('coord', launched.sessionId, 'turn-start', { at });
  await f.signal('coord', launched.sessionId, 'turn-end', { at: at + 1 });
  if (rename) {
    const renamed = await peer.call<{ ok: boolean; error?: string }>('rename', { name: 'pool-1' });
    assert.equal(renamed.ok, true, renamed.error);
  }
  await clock.advance(1000);
  await ui.waitFor(frame => frame.type === 'delivery' && frame.message === id && frame.stage === 'injected');
  const attempts = fake.injections.filter(i => i.message.id === id);
  assert.equal(attempts.length, 2, 'the remembered idle retries the unconfirmed input once');
  assert.equal(attempts.at(-1)!.process.name, rename ? 'pool-1' : 'coord');
  assert.equal((await harness(ui, rename ? 'pool-1' : 'coord')).state, 'idle');
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  assert.ok((await hubLog(f.root)).includes(`"event":"injected","id":"${id}"`));
});
