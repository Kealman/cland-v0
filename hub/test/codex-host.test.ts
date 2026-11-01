// T2: Codex lifecycle through a recording Host and scripted native connection.
// Lifecycle: no native child; disposable root, adapter closed before fixture removal.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { CodexAdapter } from '../src/adapters/codex.ts';
import type { AdapterHost, HarnessProcess } from '../src/adapters/contract.ts';
import { localHost } from '../src/host/local.ts';
import type { Host, HostCommand, HostProcess } from '../src/host/host.ts';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ScriptedCodex, deferred } from './fakes/scripted-codex.ts';
import { FakeClock } from './fake-clock.ts';
import { until, testWaitMs } from './until.ts';

// The real-clock bound watches the exact promise receipt; fixture setup and
// completion use separate invocations, independent of the behavior's FakeClock.
async function receipt<T>(what: string, work: Promise<T>): Promise<T> {
  let outcome: PromiseSettledResult<T> | undefined;
  void work.then(value => { outcome = { status: 'fulfilled', value }; }, reason => { outcome = { status: 'rejected', reason }; });
  await until(() => outcome !== undefined, { what, timeoutMs: testWaitMs(5000) });
  if (!outcome) throw new Error(`${what}: incomplete receipt`);
  if (outcome.status === 'rejected') throw outcome.reason;
  return outcome.value;
}


function adapterHost(root: string, host: Host): AdapterHost {
  return { root, discoveryFile: join(root, '.cland/hub.json'), node: process.execPath, cli: '', spoke: 'spoke.ts', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => host, hostForProcess: () => host };
}

test('Codex launch refuses the Host directory refusal before running a command', async t => {
  const root = await tempProject(t);
  const host: Host = { ...localHost(), statDirectory: async () => ({ refusal: 'recorded Host refusal', identity: null }), run: async () => { throw new Error('must not run'); } };
  const adapter = new CodexAdapter(adapterHost(root, host), { bin: 'missing-fixture-codex', env: fixtureEnvironment(root, process.env) });
  t.after(() => receipt('adapter fixture close', adapter.close()));
  await assert.rejects(adapter.spawn({ name: 'worker', role: null, model: null, cwd: root }), /recorded Host refusal/);
});

test('Codex launches, resumes, polls and stops only through the selected Host', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const commands: HostCommand[] = [];
  const versions: HostCommand[] = [];
  const checks: HostProcess[] = [];
  const stops: HostProcess[] = [];
  const dirs: string[] = [];
  const clock = new FakeClock(Date.now());
  const native = new ScriptedCodex();
  native.thread = 'host-thread';
  native.handlers.set('thread/start', () => ({ thread: { id: native.thread, status: { type: 'idle' } } }));
  let living = true;
  const host: Host = {
    ...localHost(env),
    name: 'selected-host',
    statDirectory: async path => { dirs.push(path); return { refusal: null, identity: { dev: 1, ino: 2 } }; },
    run: async command => { versions.push(command); return { code: 0, stdout: 'codex 0.160.0', stderr: '' }; },
    spawn: async command => { commands.push(command); return { pid: 987654, exited: new Promise(() => {}) }; },
    identity: async pid => ({ pid, pidStarted: 'host-start', pidIdentity: 'host-birth' }),
    alive: async row => { checks.push({ ...row }); return living; },
    stop: async row => { stops.push({ ...row }); return true; },
  };
  const exited: string[] = [];
  const boundary = adapterHost(root, host);
  boundary.hostForProcess = row => { assert.equal(row.host, 'selected-host', 'process retains selected Host ownership'); return host; };
  boundary.exited = id => { exited.push(id); };
  const adapter = new CodexAdapter(boundary, { clock, bin: 'host-codex', env, pollMs: 10, connect: async () => native });
  t.after(() => receipt('adapter fixture close', adapter.close()));
  const request = { name: 'worker', role: 'implementer', model: null, cwd: root, accountEnv: { DIGITALOCEAN_TOKEN: 'fixture-only', CODEX_HOME: join(root, 'codex-account') }, launchToken: 'fixture-launch-token' };
  const row = await adapter.spawn(request);
  assert.equal(row.host, 'selected-host');
  assert.equal(row.pidIdentity, 'host-birth');
  assert.deepEqual(dirs, [root]);
  assert.equal(versions.length, 1);
  assert.deepEqual(versions[0]?.args, ['--version']);
  assert.equal(versions[0]?.cwd, root);
  assert.equal(versions[0]?.env.DIGITALOCEAN_TOKEN, undefined);
  assert.equal(commands.length, 1);
  assert.equal(commands[0]?.cwd, root);
  assert.equal(commands[0]?.command, 'host-codex');
  assert.deepEqual(commands[0]?.args.slice(0, 3), ['app-server', '--listen', `unix://${row.harnessId}`]);
  assert.equal(commands[0]?.logFile, join(root, '.cland/log/codex-worker.log'));
  assert.equal(commands[0]?.env.CLAND_LAUNCH_TOKEN, 'fixture-launch-token');
  assert.equal(commands[0]?.env.CODEX_HOME, join(root, 'codex-account'));
  assert.equal(commands[0]?.env.DIGITALOCEAN_TOKEN, undefined);
  // A missing thread needs no socket; resume must still consult the row's Host.
  assert.deepEqual(await adapter.resume({ ...row, harnessSessionId: null }), { found: false, reason: 'no thread id recorded', alive: true });
  await writeFile(row.harnessId!, 'fixture socket boundary');
  adapter.unwatch(row.sessionId);
  native.closed = false;
  const resumed = await adapter.resume(row);
  assert.equal(resumed.found, true, JSON.stringify(resumed));
  assert.equal(native.count('thread/resume'), 1);
  adapter.watch(row);
  const gone = eventually('Host death reported', () => exited.includes(row.sessionId) || undefined);
  living = false;
  await clock.advance(10);
  await gone;
  assert.ok(checks.length >= 3);
  assert.ok(checks.every(check => check.pid === row.pid && check.pidIdentity === 'host-birth'));
  await adapter.stop(row);
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.pidIdentity, 'host-birth');
  // Another launch on this adapter must perform its own version check.
  native.closed = false;
  const next = await adapter.spawn({ ...request, name: 'next' });
  assert.equal(commands.length, 2);
  assert.equal(versions.length, 2);
  await adapter.stop(next);
});

test('Codex version failure from the Host refuses spawn', async t => {
  const root = await tempProject(t);
  let spawns = 0;
  const host: Host = { ...localHost(), run: async () => ({ code: 7, stdout: '', stderr: 'fixture version failure' }), spawn: async () => { spawns++; throw new Error('must not spawn'); } };
  const adapter = new CodexAdapter(adapterHost(root, host), { bin: 'host-codex', env: fixtureEnvironment(root, process.env) });
  t.after(() => receipt('adapter fixture close', adapter.close()));
  await assert.rejects(adapter.spawn({ name: 'worker', role: null, model: null, cwd: root }), /host-codex --version: fixture version failure/);
  assert.equal(spawns, 0);
});


test('a late Host liveness reply cannot retire a replacement Codex row', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(Date.now());
  const oldReply = deferred<boolean>();
  const seen: number[] = [];
  let currentAlive = true;
  const host: Host = { ...localHost(), alive: async row => { seen.push(row.pid!); return row.pid === 111111 ? oldReply.promise : currentAlive; } };
  const gone: string[] = [];
  const boundary = adapterHost(root, host);
  boundary.exited = id => { gone.push(id); };
  const adapter = new CodexAdapter(boundary, { clock, pollMs: 10, env: fixtureEnvironment(root, process.env) });
  t.after(() => receipt('adapter fixture close', adapter.close()));
  const old: HarnessProcess = { name: 'worker', harness: 'codex', role: null, model: null, cwd: root, pid: 111111, pidStarted: 'old', pidIdentity: 'old-birth', harnessId: null, harnessSessionId: null, sessionId: 'same-session', startedAt: new Date().toISOString(), status: 'running' };
  adapter.watch(old);
  const observed = eventually('old Host liveness requested', () => seen.includes(111111) || undefined);
  await clock.advance(10);
  await observed;
  adapter.watch({ ...old, pid: 222222, pidStarted: 'new', pidIdentity: 'new-birth' });
  oldReply.resolve(false);
  const replacementObserved = eventually('replacement Host liveness requested', () => seen.includes(222222) || undefined);
  await clock.advance(10);
  await replacementObserved;
  assert.deepEqual(gone, []);
  const death = eventually('current row death reported', () => gone.length === 1 || undefined);
  currentAlive = false;
  await clock.advance(10);
  await death;
  assert.deepEqual(gone, ['same-session']);
});

for (const reject of [false, true]) test(`Codex close joins and coalesces a held Host probe (${reject ? 'rejection' : 'success'})`, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(Date.now());
  const reply = deferred<boolean>();
  const requested = deferred<void>();
  let calls = 0;
  let probeFinished = false;
  const callbacks: string[] = [];
  const host: Host = { ...localHost(), alive: async () => { calls++; requested.resolve(); try { return await reply.promise; } finally { probeFinished = true; } } };
  const boundary = adapterHost(root, host);
  boundary.log = () => { callbacks.push('log'); };
  boundary.exited = () => { callbacks.push('exit'); };
  const adapter = new CodexAdapter(boundary, { clock, pollMs: 10, env: fixtureEnvironment(root, process.env) });
  t.after(async () => { reply.resolve(false); await receipt('adapter fixture close', adapter.close()); });
  const row: HarnessProcess = { name: 'worker', harness: 'codex', role: null, model: null, cwd: root, pid: 111111, harnessId: null, harnessSessionId: null, sessionId: 'held-probe', startedAt: new Date().toISOString(), status: 'running' };
  adapter.watch(row);
  await clock.advance(10);
  await receipt('Host probe setup receipt', requested.promise);
  await clock.advance(100);
  assert.equal(calls, 1, 'ticks share the exact in-flight Host probe');
  const closing = Promise.resolve(adapter.close()).then(() => { assert.equal(probeFinished, true, 'Host completion precedes close receipt'); });
  if (reject) reply.reject(new Error('held probe failed')); else reply.resolve(false);
  await receipt('close completion receipt', closing);
  assert.equal(probeFinished, true);
  assert.deepEqual(callbacks, [], 'late success and rejection cannot write or publish');
  await clock.advance(100);
  assert.equal(calls, 1);
});

type HeldStage = 'version' | 'prepare' | 'accepted' | 'identity';
async function heldLaunchClose(t: TestContext, relaunch: boolean, stage: HeldStage, earlyClose = false): Promise<void> {
  const root = await tempProject(t);
  const release = deferred<void>();
  const exited = deferred<{ code: number | null; signal: string | null }>();
  let entered = false;
  let producerFinished = false;
  let owned = false;
  let spawns = 0;
  let stops = 0;
  const held = async () => { entered = true; await release.promise; producerFinished = true; };
  const native = new ScriptedCodex();
  native.thread = 'held-thread';
  native.handlers.set('thread/start', () => ({ thread: { id: native.thread, status: { type: 'idle' } } }));
  const host: Host = {
    ...localHost(), name: 'held-host',
    run: async () => { if (stage === 'version') await held(); return { code: 0, stdout: 'codex 0.160.0', stderr: '' }; },
    spawn: async (_command, options) => {
      if (stage === 'prepare') await held();
      options?.authorize?.();
      spawns++; owned = true;
      if (stage === 'accepted') await held();
      return { pid: 987654, exited: exited.promise };
    },
    identity: async pid => { if (stage === 'identity') await held(); return { pid, pidStarted: 'start', pidIdentity: 'birth' }; },
    alive: async () => false,
    stop: async row => { if (row.pid === 987654) { stops++; owned = false; exited.resolve({ code: 0, signal: null }); } return true; },
  };
  const adapter = new CodexAdapter(adapterHost(root, host), { bin: 'host-codex', env: fixtureEnvironment(root, process.env), connect: async () => native });
  t.after(async () => { release.resolve(); exited.resolve({ code: 0, signal: null }); await receipt('adapter fixture close', adapter.close()); });
  const row: HarnessProcess = { name: 'worker', harness: 'codex', host: host.name, role: null, model: null, cwd: root, pid: 111111, harnessId: join(root, 'old.sock'), harnessSessionId: 'held-thread', sessionId: 'held-launch', startedAt: new Date().toISOString(), status: 'exited' };
  const work = relaunch ? adapter.resume(row, { relaunch: true }) : adapter.spawn({ name: 'worker', role: null, model: null, cwd: root });
  let outcome: PromiseSettledResult<unknown> | undefined;
  void work.then(value => { outcome = { status: 'fulfilled', value }; }, reason => { outcome = { status: 'rejected', reason }; });
  await until(() => entered, { what: 'held Host setup receipt', timeoutMs: testWaitMs(5000) });
  const threadStarts = native.count('thread/start');
  let closeOutcome: PromiseSettledResult<void> | undefined;
  const actualClose = adapter.close();
  void actualClose.catch(() => {});
  const observedClose = earlyClose ? Promise.resolve() : actualClose;
  const atClose = () => {
    assert.equal(producerFinished, true, 'Host producer completed at close receipt');
    assert.equal(owned, false, 'accepted PID cleanup completed at close receipt');
    assert.equal(stops, spawns, 'every accepted child stopped at close receipt');
  };
  void observedClose.then(() => {
    try { atClose(); closeOutcome = { status: 'fulfilled', value: undefined }; }
    catch (reason) { closeOutcome = { status: 'rejected', reason }; }
  }, reason => {
    try { atClose(); closeOutcome = { status: 'rejected', reason }; }
    catch (failure) { closeOutcome = { status: 'rejected', reason: failure }; }
  });
  release.resolve();
  await until(() => Boolean(outcome && closeOutcome), { what: 'launch and close completion receipts', timeoutMs: testWaitMs(5000) });
  if (closeOutcome?.status === 'rejected') throw closeOutcome.reason;
  assert.equal(producerFinished, true);
  assert.equal(outcome?.status, 'rejected');
  assert.match(String(outcome?.status === 'rejected' ? outcome.reason : ''), /closed/);
  assert.equal(closeOutcome?.status, 'fulfilled');
  assert.equal(owned, false, 'accepted PID is stopped before close receipt');
  assert.equal(spawns, stage === 'accepted' || stage === 'identity' ? 1 : 0);
  assert.equal(stops, spawns);
  assert.equal(native.count('thread/start'), threadStarts, 'shutdown never starts another native thread');
}

for (const relaunch of [false, true]) for (const stage of ['version', 'prepare', 'accepted', 'identity'] as const) test(`Codex close joins held ${relaunch ? 'relaunch' : 'launch'} ${stage} work`, t => heldLaunchClose(t, relaunch, stage));

test('held launch close assertions reject an early close receipt while work continues', async t => {
  await assert.rejects(heldLaunchClose(t, false, 'accepted', true), /Host producer completed at close receipt/);
});

test('Codex close reports incomplete late-launch cleanup and retains its durable receipt', async t => {
  const { LaunchRecoveryPending, LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const { stat } = await import('node:fs/promises');
  const root = await tempProject(t);
  const release = deferred<void>();
  const exited = deferred<{ code: number | null; signal: string | null }>();
  let admitted = false;
  let producerFinished = false;
  let cleanupAttempted = false;
  let allowStop = false;
  const host: Host = {
    ...localHost(),
    run: async () => ({ code: 0, stdout: 'codex 0.160.0', stderr: '' }),
    spawn: async () => { admitted = true; await release.promise; producerFinished = true; return { pid: 987654, exited: exited.promise }; },
    identity: async pid => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }),
    stop: async () => { cleanupAttempted = true; if (!allowStop) return false; exited.resolve({ code: 0, signal: null }); return true; },
  };
  const boundary = adapterHost(root, host);
  boundary.durableLaunchRecovery = true;
  const adapter = new CodexAdapter(boundary, { bin: 'host-codex', env: fixtureEnvironment(root, process.env) });
  const launch = adapter.spawn({ name: 'worker', role: null, model: null, cwd: root });
  let durable: unknown;
  void launch.catch(error => { durable = error; });
  const failed = assert.rejects(launch, (error: unknown) => error instanceof LaunchRecoveryPending);
  let recovered = false;
  t.after(async () => {
    const closing = adapter.close().catch(() => {});
    allowStop = true;
    release.resolve();
    exited.resolve({ code: 0, signal: null });
    const pending = await receipt('fixture launch settlement', launch.catch(error => error));
    await receipt('close completion receipt', closing);
    if (pending instanceof LaunchRecoveryPending && !recovered) {
      await receipt('fixture durable recovery completion', LaunchFiles.restore(pending.files, work => work(), host).rollback());
      pending.settled();
    }
  });
  await until(() => admitted, { what: 'late launch setup receipt', timeoutMs: testWaitMs(5000) });
  const closing = assert.rejects(adapter.close().catch(error => {
    assert.equal(producerFinished, true, 'producer completed at close rejection');
    assert.equal(cleanupAttempted, true, 'cleanup attempted before close rejection');
    assert.ok(durable instanceof LaunchRecoveryPending, 'durable owner exists at close rejection');
    assert.equal(durable.files.children[0]?.pidIdentity, 'birth');
    assert.ok(durable.files.undo.length > 0);
    throw error;
  }), /cleanup incomplete/);
  release.resolve();
  await receipt('incomplete cleanup rejection receipts', Promise.all([failed, closing]));
  const error = await receipt('durable launch outcome', launch.catch(error => error)) as InstanceType<typeof LaunchRecoveryPending>;
  assert.ok(error instanceof LaunchRecoveryPending);
  assert.equal(error.files.children[0]?.pid, 987654);
  assert.equal(error.files.children[0]?.pidIdentity, 'birth');
  assert.ok(error.files.undo.length > 0, 'resources remain owned until captured process exits');
  assert.ok((await stat(root)).isDirectory());
  // Model the durable recovery owner's later confirmed cleanup, then remove the fixture.
  allowStop = true;
  await receipt('durable recovery completion', LaunchFiles.restore(error.files, work => work(), host).rollback());
  error.settled();
  recovered = true;
});

for (const stage of ['alive', 'connect'] as const) test(`Codex close joins live resume ${stage} without returning a running row`, async t => {
  const root = await tempProject(t);
  const release = deferred<void>();
  let entered = false;
  let producerFinished = false;
  const held = async () => { entered = true; await release.promise; producerFinished = true; };
  const native = new ScriptedCodex();
  native.thread = 'resume-thread';
  const host: Host = { ...localHost(), alive: async () => { if (stage === 'alive') await held(); return true; } };
  const adapter = new CodexAdapter(adapterHost(root, host), { env: fixtureEnvironment(root, process.env), connect: async () => { if (stage === 'connect') await held(); return native; } });
  t.after(async () => { release.resolve(); await receipt('adapter fixture close', adapter.close()); });
  const socket = join(root, 'resume.sock');
  await writeFile(socket, 'fixture socket');
  const row: HarnessProcess = { name: 'worker', harness: 'codex', role: null, model: null, cwd: root, pid: 111111, harnessId: socket, harnessSessionId: native.thread, sessionId: 'resume', startedAt: new Date().toISOString(), status: 'running' };
  const resumed = assert.rejects(adapter.resume(row), /closed/);
  await until(() => entered, { what: 'live resume setup receipt', timeoutMs: testWaitMs(5000) });
  const closing = adapter.close().then(() => {
    assert.equal(producerFinished, true, 'live resume producer completed at close receipt');
    if (stage === 'connect') assert.equal(native.closed, true, 'late connection released at close receipt');
    assert.equal(native.count('thread/resume'), 0);
  });
  release.resolve();
  await receipt('live resume and close completion receipts', Promise.all([closing, resumed]));
  assert.equal(native.count('thread/resume'), 0);
  if (stage === 'connect') assert.equal(native.closed, true, 'late native connection is released');
});

test('Codex keeps Host liveness polling while reconnect connection acquisition is held', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(Date.now());
  const release = deferred<void>();
  const native = new ScriptedCodex();
  native.thread = 'held-subscription';
  let subscribed = false;
  let probes = 0;
  const host: Host = { ...localHost(), alive: async () => { probes++; return true; } };
  const adapter = new CodexAdapter(adapterHost(root, host), { clock, pollMs: 10, env: fixtureEnvironment(root, process.env), connect: async () => { subscribed = true; await release.promise; return native; } });
  t.after(async () => { release.resolve(); await receipt('adapter fixture close', adapter.close()); });
  adapter.watch({ name: 'worker', harness: 'codex', role: null, model: null, cwd: root, pid: 111111, harnessId: 'scripted.sock', harnessSessionId: native.thread, sessionId: 'held-subscription', startedAt: new Date().toISOString(), status: 'running' });
  await eventually('reconnect connection acquisition entered', () => subscribed || undefined);
  await clock.advance(40);
  assert.equal(probes, 4, 'completed Host probes keep their cadence while RPC reconnect is separately owned');
  release.resolve();
  await receipt('reconnect close completion', adapter.close().then(() => {
    assert.equal(native.closed, true, 'late connection released at close receipt');
  }));
  assert.equal(native.closed, true);
});
