// T2: production ClaudeCodeAdapter scheduling/latch with FakeClock and a replaced execFile edge.
// Scheduler cases need only an in-memory host; the sender/journal case reopens projectHub's store.
// No harness binary, child process or wall-clock sleep is used; native deadlines remain real.
import { completeJournalLines } from './journal-lines.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { setImmediate as yieldIO } from 'node:timers/promises';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { AdapterHost, HarnessProcess, InjectFrame } from '../src/adapters/contract.ts';
import type { Message } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

function cli(t: TestContext) {
  const calls: Array<{ args: string[]; configDir: string | undefined; env: NodeJS.ProcessEnv }> = [];
  const sessions: Array<{ id: string; sessionId: string; pid?: number; status: string }> = [];
  let loggedOut = false;
  let hold = false;
  let knownPid = false;
  let pid = process.pid;
  const pending: Array<() => void> = [];
  const killed: string[] = [];
  t.mock.method(cp, 'execFile', (bin: string, args: string[], options: cp.ExecFileOptions, callback: (error: { code: number } | null, stdout: string, stderr: string) => void) => {
    assert.equal(bin, 'fixture-claude', 'no native command escapes the scripted edge');
    calls.push({ args, configDir: options.env?.CLAUDE_CONFIG_DIR, env: { ...options.env } });
    const listing = JSON.stringify(sessions); // Native output can describe the query's earlier snapshot.
    const finish = () => {
      if (args[0] === '--bg') {
        if (loggedOut) { callback({ code: 1 }, '', 'authentication expired'); return; }
        const id = `background-${sessions.length}`;
        sessions.push({ id, sessionId: `native-${args[args.indexOf('--session-id') + 1]!}`, status: 'idle', ...(knownPid ? { pid } : {}) });
        callback(null, `claude attach ${id}`, '');
      } else if (args[0] === 'agents') callback(null, listing, '');
      else if (args[0] === 'stop') { const i = sessions.findIndex(s => s.id === args[1]); if (i >= 0) sessions.splice(i, 1); callback(null, '', ''); }
      else assert.fail(`unscripted command ${args[0]}`);
    };
    if (hold && args[0] === 'agents') pending.push(finish);
    else queueMicrotask(finish);
    return { kill: (signal: string) => { killed.push(signal); return true; } };
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  return { calls, sessions, pending, killed, set loggedOut(value: boolean) { loggedOut = value; }, set hold(value: boolean) { hold = value; }, set knownPid(value: boolean) { knownPid = value; }, set pid(value: number) { pid = value; }, agents: () => calls.filter(c => c.args[0] === 'agents') };
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

async function memoryHost(t: TestContext): Promise<AdapterHost> {
  const root = await mkdtemp(join(tmpdir(), 'cland-claude-schedule-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = new Map<string, string>();
  return { root, discoveryFile: join(root, 'hub.json'), node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, adapterState: { read: key => state.get(key) ?? null, write: (key, value) => { state.set(key, value); } } };
}
const request = (name: string) => ({ name, cwd: '/fixture', role: null, model: null });
const options = (clock: FakeClock) => ({ clock, processStarted: async () => 'fixture-start', bin: 'fixture-claude', env: { HOME: '/fixture/home', CLAUDE_CONFIG_DIR: '/fixture/claude' } });

test('Claude close cancels a held native query and drains its callback before releasing ownership', async t => {
  const native = cli(t);
  const clock = new FakeClock();
  const adapter = new ClaudeCodeAdapter(await memoryHost(t), options(clock));
  t.after(() => adapter.close());
  try {
    await adapter.spawn(request('held-query'));
    native.hold = true;
    await clock.advance(30_000);
    assert.equal(native.pending.length, 1, 'the native query has entered the scripted hold');
    const closing = adapter.close();
    assert.deepEqual(native.killed, ['SIGKILL'], 'only the in-flight CLI is cancelled');
    let closed = false;
    const drained = Promise.resolve(closing).then(() => { closed = true; });
    await yieldIO();
    assert.equal(closed, false, 'sending a signal is not the native close receipt');
    native.pending.shift()!();
    await receipt(drained);
    assert.equal(closed, true);
    const calls = native.calls.length;
    await clock.advance(60_000);
    assert.equal(native.calls.length, calls, 'no later polling restarts a native query');
  } finally {
    // Assertion failures must release the only native completion receipt before
    // after hooks close the adapter again or restore the scripted command edge.
    const closing = adapter.close();
    for (const finish of native.pending.splice(0)) finish();
    await receipt(Promise.resolve(closing));
  }
});

test('Claude discovery misses retain liveness without accepting a conflicting native or process identity', async t => {
  const native = cli(t);
  native.knownPid = true;
  const clock = new FakeClock();
  let started: string | null = 'fixture-start';
  const adapter = new ClaudeCodeAdapter(await memoryHost(t), { ...options(clock), agentsMs: 1, processStarted: async () => started });
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
  const host = { ...await memoryHost(t), log: (event: Record<string, unknown>) => { events.push(event); } };
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

async function component(t: TestContext, pidAlive?: (pid: number) => boolean, processStarted: (pid: number) => Promise<string | null> = async pid => `fixture-start-${pid}`, reexecGraceMs: number | null = 30_000) {
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
      const adapter = new ClaudeCodeAdapter(adapterHost, { clock, bin: 'fixture-claude', pollMs: 5000, ...(reexecGraceMs === null ? {} : { reexecGraceMs }), ...(pidAlive ? { pidAlive } : {}), processStarted, env: fixtureEnvironment(root, {}, { CLAUDE_CONFIG_DIR: directory, DISABLE_AUTOUPDATER: '0' }) });
      return adapter;
    }] });
    const ui = await connectUi(t, hub.discovery);
    await receipt(ui.request({ type: 'subscribe' }));
    return { hub, ui };
  };
  async function records(ui: Awaited<ReturnType<typeof connectUi>>) {
    await receipt(ui.request({ type: 'hub.status', flushLogs: true }));
    return completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line) as { event: string });
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

test('hub-launched Claude disables auto-update in both the filtered CLI environment and supervised settings', async t => {
  const f = await component(t);
  const { ui } = await f.open();
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'coord', role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  const bg = f.native.calls.find(call => call.args[0] === '--bg')!;
  assert.equal(bg.env.DISABLE_AUTOUPDATER, '1');
  assert.equal(bg.env.DIGITALOCEAN_TOKEN, undefined);
  const settings = JSON.parse(await readFile(bg.args[bg.args.indexOf('--settings') + 1]!, 'utf8'));
  assert.equal(settings.env.DISABLE_AUTOUPDATER, '1', 'the supervised background harness does not inherit CLI env');
});

test('Claude re-exec bridge acknowledgement without a model turn remains unconfirmed', async t => {
  const f = await component(t);
  const { hub, ui } = await f.open();
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'coord', role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcess }).process;
  const args = f.native.calls.find(call => call.args[0] === '--bg')!.args;
  const settings = JSON.parse(await readFile(args[args.indexOf('--settings') + 1]!, 'utf8'));
  const peer = () => inProcessSpoke(t, { cwd: f.root, discover: true, name: p.name, assignRole: false, sessionId: p.sessionId, launchToken: settings.env.CLAND_LAUNCH_TOKEN });
  const first = await peer();
  await first.waitForPresence([p.name]);
  const signal = async (event: string, payload: object) => {
    const result = await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event, payload });
    assert.equal(result.ok, true, result.error);
  };
  const bridge = await connectUi(t, hub.discovery, 'mod-bridge');
  assert.equal((await bridge.request({ type: 'session.bridge', session: p.name, launch: p.sessionId })).ok, true);
  const clause = await bridge.waitFor(frame => frame.type === 'inject') as InjectFrame;
  await signal('mod-turn-start', { text: clause.text });
  await ui.request({ type: 'hub.status', flushLogs: true });
  assert.ok((await readFile(join(f.root, '.cland/log/hub.log'), 'utf8')).includes(`"event":"injected","id":"${clause.message}"`));
  bridge.close();
  await first.close();
  const second = await peer(); // Same launch identity, replacement spoke and bridge after re-exec.
  await second.waitForPresence([p.name]);
  const replacement = await connectUi(t, hub.discovery, 'mod-bridge');
  assert.equal((await replacement.request({ type: 'session.bridge', session: p.name, launch: p.sessionId })).ok, true);
  await signal('mod-turn-complete', {});
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [p.name], text: 'accepted by the replacement mod, never run' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: Message }).message.id;
  const input = await replacement.waitFor(frame => frame.type === 'inject' && frame.message === id) as InjectFrame;
  // Previous wire shape remains accepted, but prompt.submit success proves no model turn.
  await signal('injected', { message: id });
  await f.clock.advance(60_000);
  await ui.request({ type: 'hub.status', flushLogs: true });
  const log = await readFile(join(f.root, '.cland/log/hub.log'), 'utf8');
  assert.match(log, new RegExp(`"event":"inject-unconfirmed","session":"coord","id":"${id}"`));
  assert.equal(ui.frames.some(frame => frame.type === 'delivery' && frame.message === id && frame.stage === 'injected'), false);
  // An unrelated turn cannot confirm this input; the exact envelope can, even after timeout.
  await signal('mod-turn-start', { text: 'unrelated human prompt' });
  assert.equal(ui.frames.some(frame => frame.type === 'delivery' && frame.message === id && frame.stage === 'injected'), false);
  await signal('mod-turn-start', { text: input.text });
  await ui.waitFor(frame => frame.type === 'delivery' && frame.message === id && frame.stage === 'injected');
});

for (const [role, reconnectAt, identity] of [['implementer', 5000, 'known'], ['coordinator', 0, 'known'], ['coordinator', 31_000, 'known'], ['coordinator', 5000, 'discovery'], ['coordinator', 5000, 'hook'], ['coordinator', 5000, 'flight']] as const) test(`Claude ${role} re-exec retains its row, role and claim with ${identity} identity and hello at ${reconnectAt}ms`, async t => {
  const alive = new Set([91001]);
  const f = await component(t, pid => alive.has(pid));
  f.native.knownPid = identity !== 'discovery';
  f.native.pid = 91001;
  const { ui } = await f.open();
  const result = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role });
  assert.equal(result.ok, true, result.error);
  const launched = (result.value as { process: HarnessProcess }).process;
  const launchArgs = f.native.calls.find(call => call.args[0] === '--bg')!.args;
  const settings = JSON.parse(await readFile(launchArgs[launchArgs.indexOf('--settings') + 1]!, 'utf8'));
  const credential = settings.env.CLAND_LAUNCH_TOKEN as string;
  assert.equal(typeof credential === 'string' && credential.length > 0, true);
  const peer = () => inProcessSpoke(t, { cwd: f.root, discover: true, name: 'impl', assignRole: false, sessionId: launched.sessionId, launchToken: credential });
  const first = await peer();
  await first.waitForPresence(['impl']);
  const made = await ui.request({ type: 'task.create', title: 'Re-exec work', size: 'S', assignee: 'impl' });
  assert.equal(made.ok, true, made.error);
  const id = (made.value as { item: { id: string } }).item.id;
  const claimed = await first.call<{ ok: boolean; error?: string }>('task.claim', { id });
  assert.equal(claimed.ok, true, claimed.error);
  const nativeId = identity === 'hook' ? `cleared-${f.native.sessions[0]!.sessionId}` : f.native.sessions[0]!.sessionId;
  assert.notEqual(nativeId, launched.sessionId, 'native and cland identities are distinct');
  if (identity === 'hook') {
    f.native.sessions[0]!.sessionId = nativeId;
    const signalled = await ui.request({ type: 'session.signal', session: 'impl', launch: launched.sessionId, event: 'session-start', at: f.clock.now().getTime(), payload: { session_id: nativeId } });
    assert.equal(signalled.ok, true, signalled.error);
  }
  if (identity === 'discovery') {
    f.native.sessions[0]!.pid = 91001;
    const discovered = ui.waitFor(frame => frame.type === 'session.process' && (frame.process as HarnessProcess)?.pid === 91001);
    await f.clock.advance(30_000);
    await receipt(discovered);
    const learned = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
    assert.equal(learned.processes[0]?.harnessSessionId, nativeId, 'late discovery publishes the native identity');
  }
  await first.close();
  alive.delete(91001);
  f.native.sessions.length = 0;
  if (reconnectAt) await f.clock.advance(reconnectAt);
  let rows = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
  assert.equal(rows.processes.find(p => p.name === 'impl')?.status, 'running', 'a missing PID is held during the re-exec grace');
  alive.add(91002);
  f.native.sessions.push({ id: launched.harnessId!, sessionId: nativeId, pid: 91002, status: 'idle' });
  const second = await peer();
  await second.waitForPresence(['impl']);
  let updated = identity !== 'flight' ? ui.waitFor(frame => frame.type === 'session.process' && (frame.process as HarnessProcess)?.pid === 91002) : undefined;
  if (identity === 'flight') {
    await f.clock.advance(24_000);
    f.clock.block(1000); // Launch's discovery enters at t=30s, before the grace boundary.
    f.native.hold = true;
    f.native.pid = 91003;
    alive.add(91003);
    const helper = ui.request({ type: 'session.launch', harness: 'claude-code', name: 'helper' });
    try {
      await receipt((async () => { while (!f.native.pending.length) await yieldIO(); })());
      await f.clock.advance(5000);
      const held = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
      assert.equal(held.processes.find(p => p.name === 'impl')?.status, 'running', 'pending native discovery is settled before ownership release');
      updated = ui.waitFor(frame => frame.type === 'session.process' && (frame.process as HarnessProcess)?.pid === 91002);
    } finally {
      f.native.hold = false;
      for (const finish of f.native.pending.splice(0)) finish();
      const completed = await helper;
      assert.equal(completed.ok, true, completed.error);
    }
  } else await f.clock.advance(35_000 - reconnectAt);
  assert.ok(updated);
  await receipt(updated);
  rows = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
  const row = rows.processes.find(p => p.name === 'impl')!;
  const shellRead = await ui.request({ type: 'inbox.list', as: { name: 'impl', sessionId: launched.sessionId, shell: true, credential } });
  assert.equal(shellRead.ok, true, shellRead.error);
  assert.equal(row.pid, 91002);
  assert.equal(row.status, 'running');
  assert.equal(row.sessionId, launched.sessionId);
  assert.equal(row.harnessSessionId, nativeId);
  assert.equal(row.role, role);
  const viewed = await ui.request({ type: 'task.view', item: id });
  assert.equal(viewed.ok, true, viewed.error);
  const item = viewed.value as { item: { claim: { sessionId: string } } };
  assert.equal(item.item.claim.sessionId, launched.sessionId);
  assert.equal((await f.records(ui)).some(r => ['role-revoked', 'harness-exited'].includes(r.event)), false);
});

for (const probeIdentity of ['known', 'unavailable', 'query']) test(`a newer hook identity fences an in-flight ${probeIdentity} replacement PID probe before grace expiry`, async t => {
  const alive = new Set([91001, 91002, 91003]);
  let entered!: () => void;
  const probeEntered = new Promise<void>(resolve => { entered = resolve; });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const f = await component(t, pid => alive.has(pid), async pid => {
    if (pid === 91002 && probeIdentity !== 'query') { entered(); await held; if (probeIdentity === 'unavailable') return null; }
    return `fixture-start-${pid}`;
  });
  f.native.knownPid = true;
  f.native.pid = 91001;
  const { ui } = await f.open();
  const result = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'coord', role: 'coordinator' });
  assert.equal(result.ok, true, result.error);
  const launched = (result.value as { process: HarnessProcess }).process;
  const peer = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', assignRole: false, sessionId: launched.sessionId });
  await peer.waitForPresence(['coord']);
  const made = await ui.request({ type: 'task.create', title: 'Probe work', size: 'S', assignee: 'coord' });
  assert.equal(made.ok, true, made.error);
  const id = (made.value as { item: { id: string } }).item.id;
  const claimed = await peer.call<{ ok: boolean; error?: string }>('task.claim', { id });
  assert.equal(claimed.ok, true, claimed.error);
  const oldNative = launched.harnessSessionId!;
  const newNative = `cleared-${oldNative}`;
  assert.notEqual(oldNative, launched.sessionId);
  alive.delete(91001);
  f.native.sessions[0]!.pid = 91002;
  const mark = ui.frames.length;
  try {
    if (probeIdentity === 'query') f.native.hold = true;
    await f.clock.advance(30_000);
    if (probeIdentity === 'query') await receipt((async () => { while (!f.native.pending.length) await yieldIO(); })());
    else await receipt(probeEntered);
    await f.clock.advance(2000);
    f.native.sessions[0] = { ...f.native.sessions[0]!, sessionId: newNative, pid: 91003 };
    const hook = await ui.request({ type: 'session.signal', session: 'coord', launch: launched.sessionId, event: 'session-start', at: f.clock.now().getTime(), payload: { session_id: newNative } });
    assert.equal(hook.ok, true, hook.error);
    await f.clock.advance(3000); // The original 30-second missing-PID grace expires while the probe is held.
    release();
    f.native.hold = false;
    for (const finish of f.native.pending.splice(0)) finish();
    const intermediate = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
    assert.equal(intermediate.processes[0]?.harnessSessionId, newNative, 'a resolved stale probe cannot overwrite the newer native identity');
    assert.equal(intermediate.processes[0]?.status, 'running', 'newer identity is reconciled before grace exit');
    const adopted = ui.waitFor(frame => frame.type === 'session.process' && (frame.process as HarnessProcess)?.pid === 91003);
    await f.clock.advance(5000);
    await receipt(adopted);
    const rows = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
    assert.equal(rows.processes[0]?.pid, 91003);
    assert.equal(rows.processes[0]?.harnessSessionId, newNative);
    assert.equal(rows.processes[0]?.role, 'coordinator');
    assert.equal(rows.processes[0]?.status, 'running');
    const viewed = (await ui.request({ type: 'task.view', item: id })).value as { item: { claim: { sessionId: string } } };
    assert.equal(viewed.item.claim.sessionId, launched.sessionId);
    assert.equal(ui.frames.slice(mark).some(frame => frame.type === 'session.process' && (frame.process as HarnessProcess)?.pid === 91002), false, 'no stale PID was published');
    assert.equal((await f.records(ui)).some(r => ['role-revoked', 'harness-exited'].includes(r.event)), false);
  } finally { release(); f.native.hold = false; for (const finish of f.native.pending.splice(0)) finish(); }
});

for (const outcome of ['death', 'reconnect-first', 'shutdown'] as const) test(`default Claude grace publishes promptly at one second: ${outcome}`, async t => {
  const alive = new Set([91001, 91002]);
  // null leaves the production grace default intact; race tests above inject long virtual windows.
  const f = await component(t, pid => alive.has(pid), undefined, null);
  f.native.knownPid = true;
  f.native.pid = 91001;
  const { hub, ui } = await f.open();
  const result = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'coord', role: 'coordinator' });
  assert.equal(result.ok, true, result.error);
  const launched = (result.value as { process: HarnessProcess }).process;
  const peer = () => inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', assignRole: false, sessionId: launched.sessionId });
  const first = await peer();
  await first.waitForPresence(['coord']);
  if (outcome === 'reconnect-first') {
    const made = await ui.request({ type: 'task.create', title: 'Reconnect before missing PID', size: 'S', assignee: 'coord' });
    assert.equal(made.ok, true, made.error);
    const id = (made.value as { item: { id: string } }).item.id;
    assert.equal((await first.call<{ ok: boolean }>('task.claim', { id })).ok, true);
    await first.close();
    const reconnected = await peer();
    await reconnected.waitForPresence(['coord']); // Reconnect receipt precedes the missing-PID observation.
    f.native.sessions[0]!.pid = 91002;
  } else f.native.sessions.length = 0;
  alive.delete(91001);
  await f.clock.advance(5999); // First missing observation at 5000; expiry must run before the 10000 poll.
  const before = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
  assert.equal(before.processes[0]?.status, 'running');
  assert.equal(before.processes[0]?.pid, 91001);
  if (outcome === 'shutdown') {
    await hub.stop();
    assert.equal(f.clock.pending, 0, 'shutdown cancels the pending grace expiry');
    await f.clock.advance(1000);
    assert.equal(f.clock.pending, 0);
    return;
  }
  await f.clock.advance(1);
  const after = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
  assert.equal(after.processes[0]?.status, outcome === 'death' ? 'exited' : 'running');
  assert.equal(after.processes[0]?.pid, outcome === 'death' ? 91001 : 91002);
  const records = await f.records(ui);
  assert.equal(records.filter(r => r.event === 'harness-exited').length, outcome === 'death' ? 1 : 0);
  if (outcome === 'reconnect-first') {
    assert.equal(after.processes[0]?.role, 'coordinator');
    assert.equal(after.processes[0]?.harnessSessionId, launched.harnessSessionId);
    const viewed = (await ui.request({ type: 'task.view', item: 'T-1' })).value as { item: { claim: { sessionId: string } } };
    assert.equal(viewed.item.claim.sessionId, launched.sessionId);
    assert.equal(records.some(r => r.event === 'role-revoked'), false);
  }
});

test('a different native session cannot inherit a dead Claude session by reusing its background id', async t => {
  const alive = new Set([91001, 91002]);
  const f = await component(t, pid => alive.has(pid));
  f.native.knownPid = true;
  f.native.pid = 91001;
  const { ui } = await f.open();
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'coord', role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcess }).process;
  const peer = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', assignRole: false, sessionId: p.sessionId });
  await peer.waitForPresence(['coord']);
  alive.delete(91001);
  f.native.sessions[0] = { id: p.harnessId!, sessionId: 'another-native-conversation', pid: 91002, status: 'idle' };
  const exited = ui.waitFor(frame => frame.type === 'session.process' && (frame.process as HarnessProcess)?.status === 'exited');
  await f.clock.advance(34_999);
  const before = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
  assert.equal(before.processes[0]?.status, 'running', 'ownership is held up to the grace deadline');
  assert.equal(before.processes[0]?.pid, 91001, 'a different native identity is never adopted');
  await f.clock.advance(1);
  await receipt(exited);
  const after = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcess[] };
  assert.equal(after.processes[0]?.status, 'exited');
  assert.equal(after.processes[0]?.pid, 91001);
  assert.equal((await f.records(ui)).filter(r => r.event === 'harness-exited').length, 1);
});

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
