// T2: production ClaudeCodeAdapter scheduling/latch with FakeClock and a replaced execFile edge.
// Scheduler cases need only an in-memory host; the sender/journal case reopens projectHub's store.
// No harness binary, child process or wall-clock sleep is used; native deadlines remain real.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { setImmediate as yieldIO } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { AdapterHost, HarnessProcess } from '../src/adapters/contract.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';

function cli(t: TestContext) {
  const calls: Array<{ args: string[]; configDir: string | undefined }> = [];
  const sessions: Array<{ id: string; sessionId: string; pid?: number; status: string }> = [];
  let loggedOut = false;
  let hold = false;
  let knownPid = false;
  const pending: Array<() => void> = [];
  t.mock.method(cp, 'execFile', (bin: string, args: string[], options: cp.ExecFileOptions, callback: (error: { code: number } | null, stdout: string, stderr: string) => void) => {
    assert.equal(bin, 'fixture-claude', 'no native command escapes the scripted edge');
    calls.push({ args, configDir: options.env?.CLAUDE_CONFIG_DIR });
    const finish = () => {
      if (args[0] === '--bg') {
        if (loggedOut) { callback({ code: 1 }, '', 'authentication expired'); return; }
        const id = `background-${sessions.length}`;
        sessions.push({ id, sessionId: args[args.indexOf('--session-id') + 1]!, status: 'idle', ...(knownPid ? { pid: process.pid } : {}) });
        callback(null, `claude attach ${id}`, '');
      } else if (args[0] === 'agents') callback(null, JSON.stringify(sessions), '');
      else if (args[0] === 'stop') { const i = sessions.findIndex(s => s.id === args[1]); if (i >= 0) sessions.splice(i, 1); callback(null, '', ''); }
      else assert.fail(`unscripted command ${args[0]}`);
    };
    if (hold && args[0] === 'agents') pending.push(finish);
    else queueMicrotask(finish);
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  return { calls, sessions, pending, set loggedOut(value: boolean) { loggedOut = value; }, set hold(value: boolean) { hold = value; }, set knownPid(value: boolean) { knownPid = value; }, agents: () => calls.filter(c => c.args[0] === 'agents') };
}

// Native socket/MCP completion is bounded in real time while hub time stays fixed.
async function receipt<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('receipt within the native I/O deadline')), 10_000); // lint-allow-wall-clock: native I/O deadline, not a scheduler wait
    })]);
  } finally { clearTimeout(timer); }
}

function memoryHost(): AdapterHost {
  const state = new Map<string, string>();
  return { root: '/fixture', discoveryFile: '/fixture/hub.json', node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, adapterState: { read: key => state.get(key) ?? null, write: (key, value) => { state.set(key, value); } } };
}
const request = (name: string) => ({ name, cwd: '/fixture', role: null, model: null });
const options = (clock: FakeClock) => ({ clock, processStarted: async () => 'fixture-start', bin: 'fixture-claude', env: { HOME: '/fixture/home', CLAUDE_CONFIG_DIR: '/fixture/claude' } });

test('Claude discovery misses retain liveness without accepting a conflicting native or process identity', async t => {
  const native = cli(t);
  native.knownPid = true;
  const clock = new FakeClock();
  let started: string | null = 'fixture-start';
  const adapter = new ClaudeCodeAdapter(memoryHost(), { ...options(clock), agentsMs: 1, processStarted: async () => started });
  t.after(() => adapter.close());
  const p = await adapter.spawn(request('recover'));
  assert.equal(p.pid, process.pid, 'only observe the test process; never signal it');
  assert.equal(p.pidStarted, 'fixture-start');
  const original = native.sessions[0]!;
  native.sessions.length = 0;
  const probe = async () => {
    await clock.advance(1); // Expire the prior native directory snapshot.
    const result = adapter.resume(p);
    await yieldIO();
    await clock.advance(1);
    return result;
  };
  const missing = await probe();
  assert.equal(missing.found, false);
  if (!missing.found) assert.equal(missing.alive, true, 'a missing listing cannot discard a matching live PID');
  native.sessions.push(original);
  started = null;
  const unavailable = await probe();
  assert.equal(unavailable.found, false);
  if (!unavailable.found) assert.equal(unavailable.alive, true, 'an unavailable identity probe is not an exit');
  started = 'different-start';
  const reused = await probe();
  assert.equal(reused.found, false);
  if (!reused.found) assert.equal(reused.alive, false, 'an observed start mismatch is never retained');
  started = 'fixture-start';
  native.sessions[0] = { ...original, id: 'other-background', sessionId: 'other-session' };
  const conflicting = await probe();
  assert.equal(conflicting.found, false);
  if (!conflicting.found) assert.equal(conflicting.alive, false, 'another native session at the same PID cannot match by a same-second stamp');
});

test('Claude discovery and watch share the default schedule across adapter restart; unknown-pid stop ends the watch', async t => {
  const native = cli(t);
  const clock = new FakeClock();
  const events: Array<Record<string, unknown>> = [];
  const host = { ...memoryHost(), log: (event: Record<string, unknown>) => { events.push(event); } };
  let adapter = new ClaudeCodeAdapter(host, options(clock));
  t.after(() => adapter.close());
  assert.ok(events.some(e => e.event === 'claude-schedule' && e.agentsMs === 30_000));
  await clock.advance(30_000);
  assert.equal(native.calls.length, 0, 'an idle directory runs no CLI');
  // A known live identity lets resume prove that the persisted shared snapshot is reused.
  native.knownPid = true;
  const first = await adapter.spawn({ ...request('first'), sessionId: 'first-id' });
  native.knownPid = false;
  adapter.close();
  adapter = new ClaudeCodeAdapter(host, options(clock));
  const resumed = await adapter.resume(first);
  assert.equal(resumed.found, true, 're-found from the shared persisted snapshot');
  if (resumed.found) assert.equal(resumed.process.status, 'running');
  const second = await adapter.spawn(request('second'));
  assert.equal(second.pid, null, 'the next launch does not bypass the schedule');
  await adapter.stop(second);
  assert.equal(native.agents().length, 1, 'launch discovery and watch use one call');
  assert.equal(native.agents()[0]?.configDir, '/fixture/claude');
  assert.ok(native.calls.some(c => c.args[0] === 'stop' && c.args[1] === second.harnessId));
  await clock.advance(29_999);
  assert.equal(native.agents().length, 1, 'every agents call respects the resolved interval');
  let polled!: () => void;
  const poll = new Promise<void>(resolve => { polled = resolve; });
  host.signal = id => { if (id === first.sessionId) polled(); };
  await clock.advance(1);
  await receipt(poll);
  assert.equal(native.agents().length, 2);
  // Stop the same session through its background handle, modelling a hub row whose PID is unknown.
  await adapter.stop({ ...first, pid: null });
  const count = native.calls.length;
  await clock.advance(40_000);
  assert.equal(native.calls.length, count, 'no CLI after the last watch ends');
  assert.equal(clock.pending, 0);
});

async function component(t: TestContext) {
  const native = cli(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const directory = join(root, 'claude');
  let scheduleWrites = 0;
  let polls = 0;
  const open = async () => {
    const hub = await projectHub(t, root, {}, { clock, probes: 'fake', adapters: [(host) => {
      const adapterHost: AdapterHost = { ...host,
        signal: (id, signal) => { if (signal.source === 'poll') polls++; host.signal(id, signal); },
        adapterState: { read: key => host.adapterState!.read(key), write: (key, value) => {
          host.adapterState!.write(key, value);
          scheduleWrites++;
        } },
      };
      const adapter = new ClaudeCodeAdapter(adapterHost, { clock, bin: 'fixture-claude', pollMs: 5000, env: { HOME: root, CLAUDE_CONFIG_DIR: directory } });
      return adapter;
    }] });
    const ui = await connectUi(t, hub.discovery);
    await receipt(ui.request({ type: 'subscribe' }));
    return { hub, ui };
  };
  async function records(ui: Awaited<ReturnType<typeof connectUi>>) {
    await receipt(ui.request({ type: 'hub.status', flushLogs: true }));
    return (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string });
  }
  async function nextPoll() {
    const before = polls;
    // Callers have observed recovery input acceptance. Cover the 30s agents slot
    // plus at most one 5s liveness tick, then await its signal with time fixed.
    await clock.advance(35_000);
    const deadline = performance.now() + 10_000;
    while (polls === before && performance.now() < deadline) await yieldIO();
    assert.ok(polls > before, 'production poll state receipt');
  }
  async function queryCompleted(after: number) {
    const deadline = performance.now() + 10_000;
    while (scheduleWrites === after && performance.now() < deadline) await yieldIO();
    assert.ok(scheduleWrites > after, 'shared query persisted its completion receipt');
  }
  return { native, root, clock, directory, open, records, nextPoll, queryCompleted, get scheduleWrites() { return scheduleWrites; } };
}

test('a signed-out Claude directory stays quiet across store reopen and recovers only on explicit success', async t => {
  const f = await component(t);
  const { native, clock, directory } = f;
  let { hub, ui } = await f.open();
  const sender = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'sender', role: 'coordinator' });
  await receipt(sender.waitForPresence(['sender']));
  const launched = await receipt(ui.request({ type: 'session.launch', harness: 'claude-code', name: 'running' }));
  assert.equal(launched.ok, true, launched.error);
  const running = (launched.value as { process: HarnessProcess }).process;
  native.hold = true;
  await clock.advance(30_000);
  assert.equal(native.pending.length, 1, 'a poll is in flight before the latch');
  const inFlight = native.agents().length;
  await receipt(sender.call('send', { to: ['running'], kind: 'progress', text: 'waiting input' }));
  const input = await receipt(ui.waitFor(frame => frame.type === 'message' && (frame.message as { from: string; text: string }).from === 'sender' && (frame.message as { text: string }).text === 'waiting input'));
  const inputId = (input.message as { id: string }).id;
  const push = (frame: { type: string } & Record<string, unknown>) => receipt(ui.request({ ...frame, at: clock.now().getTime() }));
  const start = { type: 'session.signal', session: 'running', launch: running.sessionId, event: 'turn-start', payload: { prompt_id: 'auth-turn', ids: [inputId] } };
  await push(start);
  native.loggedOut = true;
  const signal = { type: 'session.signal', session: 'running', launch: running.sessionId, event: 'turn-end', payload: { prompt_id: 'auth-turn', hook_event_name: 'StopFailure', error: 'authentication_failed' } };
  for (let i = 0; i < 2; i++) assert.equal((await push(signal)).ok, true);
  await receipt(ui.waitFor(frame => frame.type === 'message' && (frame.message as { kind?: string }).kind === 'claude-signed-out'));
  const failure = `signed out: ${directory}; see the Agents notice`;
  await receipt(sender.waitForEvent(e => e.params.content.includes(failure)));
  const failures = () => sender.events.filter(e => e.params.content.includes(failure)).length;
  await receipt(ui.request({ type: 'topic.send', topic: 'general', to: ['sender'], text: 'initial sender barrier' }));
  await receipt(sender.waitForEvent(e => e.params.content.includes('initial sender barrier')));
  assert.equal(failures(), 1, 'one sender delivery per latched directory');
  // Release the admitted CLI callback, then observe the adapter's persisted completion receipt.
  native.hold = false;
  const finish = native.pending.shift()!;
  const completions = f.scheduleWrites;
  finish();
  await f.queryCompleted(completions);
  const count = native.calls.length;
  await clock.advance(4 * 30_000);
  assert.equal(native.calls.length, count, 'the latched watch makes no CLI calls');
  assert.equal(native.agents().length, inFlight, 'the latch admits no new poll child');
  await sender.close();
  ui.close();
  await hub.stop();
  ({ hub, ui } = await f.open());
  const resumedSender = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'sender', role: 'coordinator' });
  await receipt(resumedSender.waitForPresence(['sender']));
  await clock.advance(3 * 30_000);
  assert.equal(native.calls.length, count, 'latched startup resume makes no CLI calls');
  assert.equal(native.agents().length, inFlight, 'restart admits no new poll child');
  await push(start);
  await push(signal);
  // The same sender connection receives a positive ordered message after the duplicate failure.
  // Its receipt drains prior deliveries; no sleep is needed to assert the negative.
  await receipt(ui.request({ type: 'topic.send', topic: 'general', to: ['sender'], text: 'sender barrier' }));
  await receipt(resumedSender.waitForEvent(e => e.params.content.includes('sender barrier')));
  assert.equal(failures() + resumedSender.events.filter(e => e.params.content.includes(failure)).length, 1, 'sender deduplication survives restart');
  const rows = (await receipt(ui.request({ type: 'session.list' }))).value as { processes: Array<{ name: string; status: string; state: string; stateReason?: string }> };
  assert.ok(rows.processes.some(p => p.name === 'running' && p.status === 'running' && p.state === 'unknown' && p.stateReason === 'signed-out'));
  for (const name of ['failed-one', 'failed-two']) {
    const failed = await receipt(ui.request({ type: 'session.launch', harness: 'claude-code', name }));
    assert.equal(failed.ok, false);
    assert.match(failed.error ?? '', /expired/);
  }
  assert.equal((await f.records(ui)).filter(r => r.event === 'claude-signed-out').length, 1);
  const history = (await receipt(ui.request({ type: 'topic.history', topic: 'agents' }))).value as { messages: Array<{ kind?: string; text: string }> };
  const notices = history.messages.filter(m => m.kind === 'claude-signed-out');
  assert.equal(notices.length, 1);
  assert.equal(history.messages.filter(m => m.kind === 'turn-failed').length, 0, 'no generic human failure duplicate');
  assert.ok(notices[0]?.text.includes(directory));
  assert.ok(notices[0]?.text.includes('CLAUDE_CONFIG_DIR='));
  assert.ok(notices[0]?.text.includes('claude auth login'));
  native.loggedOut = false;
  const recovered = await receipt(ui.request({ type: 'session.launch', harness: 'claude-code', name: 'recovered' }));
  assert.equal(recovered.ok, true, recovered.error);
  assert.match((recovered.value as { process: { warning: string } }).process.warning, /latched signed out/);
  const before = native.agents().length;
  await f.nextPoll();
  assert.ok(native.agents().length > before, 'polling resumes after the explicit success');
  assert.ok(!native.calls.some(c => ['auth', 'doctor'].includes(c.args[0] ?? '')));
  const recoveredProcess = (recovered.value as { process: HarnessProcess }).process;
  const again = { ...signal, session: 'recovered', launch: recoveredProcess.sessionId };
  await push(again);
  const latched = native.agents().length;
  await push({ ...again, payload: { hook_event_name: 'StopFailure', error: 'server_error' } });
  await clock.advance(3 * 30_000);
  assert.equal(native.agents().length, latched, 'another StopFailure never lifts the latch');
  await push({ ...again, payload: { hook_event_name: 'Stop' } });
  await f.nextPoll();
  assert.ok(native.agents().length > latched, 'a pushed success resumes polling');
});

test('an expired --bg launch latches a directory once without discovery or retry calls', async t => {
  const f = await component(t);
  f.native.loggedOut = true;
  const { ui } = await f.open();
  for (const name of ['one', 'two']) assert.equal((await receipt(ui.request({ type: 'session.launch', harness: 'claude-code', name }))).ok, false);
  await f.clock.advance(3 * 30_000);
  assert.deepEqual(f.native.calls.map(c => c.args[0]), ['--bg', '--bg']);
  assert.equal((await f.records(ui)).filter(record => record.event === 'claude-signed-out').length, 1);
});
