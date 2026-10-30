// T2: Claude signal attribution and delivery rules through real frames, production interpretation and fake harness I/O.
// Native hook ordering, early bridge input, PID identity, escalation and held-hook reaping are in the lifecycle split.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AdapterHost, NativeJobInspection } from '../src/adapters/contract.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { realClock } from '../src/hub/clock.ts';
import { FakeClock } from './fake-clock.ts';
import { claudeComponentOwner } from './claude-component-fixture.ts';
import { fakeHarness, type FakeHarness } from './fakes/harness.ts';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject, type FrameClient, type SpokeOptions } from './harness.ts';
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
async function fixture(t: TestContext, ownedSetup = false) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  let fake!: FakeHarness;
  let hostState!: AdapterHost;
  const hubOptions = { clock, adapters: [(host, clock) => {
    hostState = host;
    // Only interpretation needs the production adapter's bounded prompt history; no native methods run.
    const interpreter = new ClaudeCodeAdapter(host, { clock, bin: 'unused-claude', env: { HOME: root } });
    fake = fakeHarness('claude-code', { host, clock });
    fake.interpret = interpreter.interpret.bind(interpreter);
    const close = fake.close.bind(fake);
    fake.close = () => { interpreter.close(); close(); };
    return fake;
  }] } satisfies import('./harness.ts').ProjectHubOptions;
  const owner = ownedSetup ? claudeComponentOwner(t, root, clock, hubOptions) : undefined;
  const hub = owner ? (await owner.start()).hub : await projectHub(t, root, {}, hubOptions);
  const { dispatcher } = hub;
  const ui = owner ? (await owner.actual).ui : await connectUi(t, hub.discovery);
  if (!owner) await ui.request({ type: 'subscribe' });
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
  const connectPeer = owner ? owner.spoke : (options: SpokeOptions) => inProcessSpoke(t, options);
  const peer = (name: string, process: Harness) => connectPeer({ cwd: root, discover: true, name, assignRole: false, sessionId: process.sessionId, launchToken: fake.spawns.findLast(s => s.name === name)!.launchToken! });
  return { root, ui, clock, fake, launch, signal, peer, host: hostState, dispatcher };
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

test('Claude launch generation fences joined spokes, hooks and bridges and reports duplicate native jobs once', async t => {
  const { HubCore } = await import('../src/hub/core.ts');
  const { Sessions } = await import('../src/adapters/sessions.ts');
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  const { launchGenerationKey } = await import('../src/adapters/launch-generation.ts');
  const core = new HubCore({ clock: new FakeClock(), env: {} });
  const table = new ProcessTable();
  const logs: Array<Record<string, unknown>> = [];
  const sessions = new Sessions({ core, table, root: '/virtual', log: e => { logs.push(e); } });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  const fake = fakeHarness('claude-code');
  const process = await fake.spawn({ name: 'coord', role: 'coordinator', model: null, cwd: '/virtual' });
  sessions.register(Object.assign(fake, { duplicateHarness: async () => ({ kind: 'duplicate' as const, job: { id: 'second-job', pid: 202 } }) }));
  table.put({ ...process, harnessId: 'first-job', pid: 101 });
  const hello = { type: 'hello' as const, protocol: 2, sessionId: process.sessionId, cwd: '/virtual', name: 'coord' };
  assert.equal(core.hello(hello, () => true).ok, true, 'previous wire shape works on a legacy row');
  core.store.setMeta(launchGenerationKey(process.sessionId), 'new-generation');
  assert.equal(core.hello({ ...hello, launchId: 'new-generation' }, () => true).ok, true);
  const refused = core.hello({ ...hello, launchId: 'old-generation' }, () => true);
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.message, /belongs to an earlier launch/);
  assert.equal(core.hello(hello, () => true).ok, false, 'legacy spoke cannot join a newly fenced row');
  assert.throws(() => sessions.bridge('coord', () => true, 'old-generation'), /belongs to an earlier launch/);
  for (let i = 0; i < 2; i++) {
    assert.equal(sessions.signal({ session: 'coord', launch: 'old-generation', event: 'session-start', payload: { session_id: 'other-native' } }).applied, false);
  }
  await eventually('durable duplicate notice', () => core.topicHistory('agents').messages.some(m => m.text.includes('second-job')) || undefined);
  assert.equal(logs.filter(e => e.event === 'duplicate-harness').length, 1);
  const notices = core.topicHistory('agents').messages.filter(m => m.text.includes('second-job'));
  assert.equal(notices.length, 1);
  assert.match(notices[0]!.text, /first-job \(pid 101\).*second-job \(pid 202\)/);
  assert.equal(table.get('coord')!.harnessSessionId, process.harnessSessionId, 'stale hook cannot change the native identity');
});

test('actual Claude frames require resolved generation and revoke old connected spokes on rotation', async t => {
  const f = await fixture(t);
  Object.assign(f.fake, { bridge: () => () => {} });
  const launched = await f.launch('coord', { role: 'coordinator', harness: 'claude-code' });
  const credential = f.fake.spawns[0]!.launchToken!;
  const openSpoke = async (generation?: string, anonymous = false) => {
    const frames: import('../src/protocol.ts').HubFrame[] = [];
    let open = true;
    const conversation = f.dispatcher.open({ send: frame => frames.push(frame), close: () => { open = false; }, isOpen: () => open }, { authenticated: true, edge: 'ws' });
    t.after(() => conversation.closed());
    conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, name: 'coord', sessionId: anonymous ? 'unknown' : launched.sessionId, cwd: f.root, launchToken: credential, ...(generation ? { launchId: generation } : {}) }));
    await eventually('actual spoke hello outcome', () => frames.find(frame => frame.type === 'welcome' || frame.type === 'error'));
    return { frames, conversation, isOpen: () => open };
  };
  assert.equal((await f.ui.request({ type: 'session.bridge', session: 'coord' })).ok, true, 'legacy bridge allows omitted generation');
  assert.equal((await f.ui.request({ type: 'session.signal', session: 'coord', event: 'turn-end' })).ok, true, 'legacy hook allows omitted generation');
  // Anonymous credential binding still exists until the first accepted spoke.
  f.host.launchGeneration!(launched.sessionId, 'first-generation');
  for (const generation of [undefined, 'old-generation']) {
    const denied = await openSpoke(generation, true);
    assert.match(JSON.stringify(denied.frames), /belongs to an earlier launch/);
    assert.equal(denied.isOpen(), false);
  }
  const first = await openSpoke('first-generation', true);
  assert.ok(first.frames.some(frame => frame.type === 'welcome'));
  for (const generation of [undefined, 'old-generation']) {
    const denied = await openSpoke(generation);
    assert.match(JSON.stringify(denied.frames), /belongs to an earlier launch/);
    for (const type of ['session.signal', 'session.bridge']) {
      const result = await f.ui.request({ type, session: 'coord', event: 'turn-end', ...(generation ? { launch: generation } : {}) });
      assert.match(JSON.stringify(result), /belongs to an earlier launch/);
      if (type === 'session.signal') assert.equal((result.value as { applied: boolean }).applied, false);
      else assert.equal(result.ok, false);
    }
  }
  assert.equal((await f.ui.request({ type: 'session.bridge', session: 'coord', launch: 'first-generation' })).ok, true);
  f.host.launchGeneration!(launched.sessionId, 'second-generation');
  assert.equal(first.isOpen(), false);
  first.conversation.receive(JSON.stringify({ type: 'send', id: 'old-tool', topic: 'general', to: ['coord'], text: 'forbidden-old-generation' }));
  const queued = await f.ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'queued-new-generation' });
  assert.equal(queued.ok, true);
  const message = (queued.value as { message: { id: string } }).message.id;
  assert.equal(first.frames.some(frame => frame.type === 'deliver' && frame.id === message), false);
  const second = await openSpoke('second-generation');
  await eventually('new generation receives queued message', () => second.frames.some(frame => frame.type === 'deliver' && frame.id === message) || undefined);
  first.conversation.closed();
  const probe = await f.ui.request({ type: 'session.bridge', session: 'coord', launch: 'second-generation' });
  assert.equal(probe.ok, true, probe.error);
  const history = await f.ui.request({ type: 'topic.history', topic: 'general' });
  assert.doesNotMatch(JSON.stringify(history), /forbidden-old-generation/);
  assert.equal(second.isOpen(), true, 'delayed old disconnect cannot evict the replacement');
  assert.equal(second.frames.filter(frame => frame.type === 'deliver' && frame.id === message).length, 1);
});

test('deferred native inspections fence unknown results and join captured lifecycle ownership', async t => {
  for (const scenario of ['unavailable', 'throw', 'newer-hook', 'stop', 'relaunch', 'close', 'same-job', 'old-launch-stop'] as const) await t.test(scenario, async t => {
    const { HubCore } = await import('../src/hub/core.ts');
    const { Sessions } = await import('../src/adapters/sessions.ts');
    const { ProcessTable } = await import('../src/adapters/processes.ts');
    const { launchGenerationKey } = await import('../src/adapters/launch-generation.ts');
    const root = await tempProject(t);
    const clock = new FakeClock();
    const core = new HubCore({ clock, env: {} });
    const table = new ProcessTable();
    const logs: Array<Record<string, unknown>> = [];
    const sessions = new Sessions({ core, table, root, log: e => { logs.push(e); } });
    const result = Promise.withResolvers<NativeJobInspection>();
    let closed = false;
    t.after(async () => { result.resolve({ kind: 'unavailable' }); if (!closed) await sessions.close(); table.close(); core.close(); core.store.close(); });
    const fake = fakeHarness('claude-code', { clock });
    let entered = false;
    sessions.register(Object.assign(fake, { duplicateHarness: () => { entered = true; return result.promise; } }));
    const process = await fake.spawn({ name: 'coord', role: null, model: null, cwd: root });
    table.put(process);
    core.store.setMeta(launchGenerationKey(process.sessionId), 'current');
    sessions.signal({ session: 'coord', launch: scenario === 'old-launch-stop' ? 'old' : 'current', event: 'session-start', payload: { session_id: 'changed' } });
    await eventually('native query started before lifecycle action', () => entered || undefined);
    assert.equal(table.get('coord')!.harnessSessionId, process.harnessSessionId, 'held query grants no identity');
    let drain: Promise<void> | undefined;
    let drained = false;
    if (scenario === 'newer-hook') sessions.signal({ session: 'coord', launch: 'current', event: 'turn-start', payload: { session_id: process.harnessSessionId } });
    if (scenario === 'stop' || scenario === 'old-launch-stop') await sessions.stop('coord');
    if (scenario === 'relaunch') await sessions.resume('coord', true);
    if (scenario === 'close') {
      closed = true;
      drain = Promise.resolve(sessions.close()).then(() => { drained = true; });
      await Promise.resolve();
      assert.equal(drained, false, 'close joins the held native inspection before releasing storage');
    }
    if (scenario === 'throw') result.reject(new Error('synthetic native query failure'));
    else result.resolve(scenario === 'unavailable' ? { kind: 'unavailable' } : scenario === 'same-job' ? { kind: 'same-job' } : { kind: 'duplicate', job: { id: 'foreign', pid: 202 } });
    await eventually('native inspection completion receipt', () => logs.some(e => e.event === 'native-job-inspection') || undefined);
    if (drain) await drain;
    assert.equal(table.get('coord')!.harnessSessionId, scenario === 'same-job' ? 'changed' : process.harnessSessionId);
    assert.equal(logs.filter(e => e.event === 'duplicate-harness').length, 0, 'superseded/unknown inspections produce no duplicate notice');
    assert.doesNotMatch(JSON.stringify(core.topicHistory('agents')), /foreign/);
    if (scenario === 'close') assert.equal(drained, true);
  });
});

test('an adapter-owned relaunch with unconfirmed native stop retains its running row role and claim', async t => {
  const f = await fixture(t, true);
  const p = await f.launch('coord', { role: 'coordinator', harness: 'claude-code' });
  const peer = await f.peer('coord', p);
  const made = await f.ui.request({ type: 'task.create', title: 'Retained through uncertain native stop', size: 'S', assignee: 'coord' });
  assert.equal(made.ok, true, made.error);
  const id = (made.value as { item: { id: string } }).item.id;
  assert.equal((await peer.call<{ ok: boolean }>('task.claim', { id })).ok, true);
  Object.assign(f.fake, { relaunchStopsProcess: true, resume: async () => { throw new Error('synthetic native job stop is unconfirmed'); } });
  const result = await f.ui.request({ type: 'session.resume', session: p.name, relaunch: true });
  const row = await harness(f.ui, p.name);
  assert.equal(row.status, 'running', 'unconfirmed stop must not publish native exit or release supervision');
  assert.equal(row.role, 'coordinator');
  assert.equal(row.sessionId, p.sessionId);
  assert.equal(row.harnessId, p.harnessId);
  const viewed = await f.ui.request({ type: 'task.view', item: id });
  assert.equal((viewed.value as { item: { claim: { sessionId: string } } }).item.claim.sessionId, p.sessionId);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /native job stop is unconfirmed/);
  assert.equal(f.fake.spawns.length, 1, 'no replacement was spawned');
});
