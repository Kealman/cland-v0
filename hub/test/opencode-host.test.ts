// T2: OpenCode lifecycle routes exclusively through the row's recording Host.
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { localHost } from '../src/host/local.ts';
import { fakeHarness } from './fakes/harness.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { join } from 'node:path';
import { beforeDirectories } from './process-cleanup.ts';

test('OpenCode poll, resume and stop use the row Host and preserve its birth identity', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const clock = new FakeClock();
  const row = { ...await fakeHarness('opencode').spawn({ name: 'worker', role: null, model: null, cwd: root }), pid: 987654, pidStarted: 'start', pidIdentity: 'birth' };
  const calls: string[] = [];
  let alive = true;
  const host = { ...localHost(env), alive: async (p: typeof row) => { assert.equal(p, row); calls.push('alive'); return alive; }, stop: async (p: typeof row, options?: import('../src/host/host.ts').HostStopOptions) => { assert.equal(p, row); assert.ok(options?.authorize); options.authorize([]); assert.ok(options.log); calls.push('stop'); return true; } };
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => { calls.push('exited'); }, hostForProcess: p => { assert.equal(p, row); return host; } }, { env, clock, pollMs: 100 });
  t.after(() => adapter.close());
  const resumed = await adapter.resume(row);
  assert.equal(resumed.found, false);
  assert.equal(resumed.alive, true);
  assert.deepEqual(calls, ['alive', 'alive']);
  adapter.watch(row);
  alive = false;
  await clock.advance(100);
  await eventually('poll result published as exact row exit', () => calls.at(-1) === 'exited' ? true : undefined);
  assert.deepEqual(calls, ['alive', 'alive', 'alive', 'exited']);
  let authorized = 0;
  await adapter.stop(row, undefined, () => { authorized++; });
  assert.equal(authorized, 1);
  assert.equal(calls.at(-1), 'stop');
  alive = false;
  adapter.watch(row);
  await clock.advance(100);
  await eventually('Host death reported', () => calls.at(-1) === 'exited' ? true : undefined);
  assert.deepEqual(calls.slice(-2), ['alive', 'exited']);
});

test('OpenCode launches once through Host with unchanged serve arguments, environment, cwd and log', async t => {
  const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
  const { readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env, { HOST_MARKER: 'kept', CLAND_PRIVATE: 'removed', OPENCODE_CONFIG: 'removed' });
  const commands: import('../src/host/host.ts').HostCommand[] = [];
  let finish!: (result: { code: number | null; signal: string | null }) => void;
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = resolve; });
  const host = { ...localHost(env), spawn: async (command: import('../src/host/host.ts').HostCommand) => { commands.push(command); return { pid: 987654, exited }; }, identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }), alive: async () => true, stop: async () => { finish({ code: 0, signal: null }); return true; } };
  t.mock.method(OpenCodeClient.prototype, 'request', async (_method: string, path: string) => {
    if (path === '/api/session/active') return { data: {} };
    if (path === '/api/session') return { data: { id: 'ses_host' } };
    throw new Error(`unexpected ${path}`);
  });
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => host, hostForProcess: () => host }, { env, bin: 'synthetic-opencode' });
  let row: Awaited<ReturnType<typeof adapter.spawn>> | undefined;
  t.after(async () => { if (row) await adapter.stop(row); await adapter.close(); });
  row = await adapter.spawn({ name: 'worker', role: 'implementer', model: 'openai/gpt-5.2', cwd: root });
  assert.equal(commands.length, 1);
  const command = commands[0]!;
  assert.equal(command.command, 'synthetic-opencode');
  assert.deepEqual(command.args.slice(0, 4), ['serve', '--hostname', '127.0.0.1', '--port']);
  assert.match(command.args[4]!, /^\d+$/);
  assert.equal(command.cwd, root);
  assert.equal(command.logFile, join(root, '.cland/opencode/worker/serve.log'));
  assert.equal(command.env.HOST_MARKER, 'kept');
  assert.equal(command.env.CLAND_PRIVATE, undefined);
  assert.equal(command.env.CLAND_SESSION_ID, row.sessionId);
  assert.equal(command.env.CLAND_ROLE, 'implementer');
  assert.equal(command.env.OPENCODE_CONFIG, join(root, '.cland/opencode/worker/opencode.json'));
  assert.equal(command.env.OPENCODE_PASSWORD, (await readFile(join(root, '.cland/opencode/worker/password'), 'utf8')).trim());
  assert.equal(row.pidIdentity, 'birth');
});

test('OpenCode recovered local server without a child receipt keeps Host stop confirmation', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const row = { ...await fakeHarness('opencode').spawn({ name: 'recovered', role: null, model: null, cwd: root }), pid: 987654, pidIdentity: 'birth' };
  let stops = 0;
  const host = { ...localHost(env), stop: async () => { stops++; return true; } };
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '',
    log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForProcess: () => host }, { env });
  t.after(() => adapter.close());
  await adapter.stop(row);
  assert.equal(stops, 1);
});

for (const outcome of ['receipt', 'deadline'] as const) test(`OpenCode stop joins the launched local server exit ${outcome} after Host stop`, { timeout: 8 * testWaitMs() + 2000 }, async t => {
  const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  let finish!: () => void;
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = () => resolve({ code: null, signal: 'SIGTERM' }); });
  const clock = new FakeClock();
  let exits = 0, probes = 0;
  let publishExit!: () => void;
  const exitPublished = new Promise<void>(resolve => { publishExit = resolve; });
  let stopped!: () => void;
  const stopObserved = new Promise<void>(resolve => { stopped = resolve; });
  const host = { ...localHost(env), spawn: async () => ({ pid: 987654, exited }),
    identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }),
    alive: async () => { probes++; return false; },
    stop: async () => { stopped(); return true; } };
  t.mock.method(OpenCodeClient.prototype, 'request', async (_method: string, path: string) => {
    if (path === '/api/session/active') return { data: {} };
    if (path === '/api/session') return { data: { id: 'ses_receipt' } };
    throw new Error(`unexpected ${path}`);
  });
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '',
    log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => { exits++; publishExit(); }, hostForLaunch: () => host, hostForProcess: () => host }, { env, clock, pollMs: 100 });
  beforeDirectories(t, async () => { finish(); await adapter.close(); });
  const row = await adapter.spawn({ name: 'worker', role: null, model: 'openai/gpt-5.2', cwd: root });
  adapter.watch(row);
  if (outcome === 'deadline') t.mock.timers.enable({ apis: ['setTimeout'] });
  let completed = false;
  const stopping = adapter.stop(row).then(() => { completed = true; });
  try {
    await stopObserved;
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(completed, false, 'Host stop can observe a zombie before the local child exit is reaped');
    if (outcome === 'deadline') {
      const refused = assert.rejects(stopping, /cleanup-incomplete: launch settlement exceeded 5000 ms/);
      t.mock.timers.tick(5000);
      await refused;
      assert.equal(completed, false, 'deadline never acknowledges settlement');
      await clock.advance(100);
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.ok(probes > 0, 'watched row liveness was checked after stop timed out');
      assert.equal(exits, 0, 'negative liveness cannot retire an unreaped local launch');
    }
  } finally { finish(); await stopping.catch(() => {}); }
  if (outcome === 'deadline') {
    await exitPublished;
    assert.equal(exits, 1, 'positive native exit receipt publishes the watched row exit');
  }
  if (outcome === 'deadline') await adapter.stop(row).then(() => { completed = true; });
  assert.equal(completed, true);
});

test('Host launch rollback retains files until its native completion receipt', async t => {
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const { readFile, writeFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  let finish!: () => void;
  let stopped!: () => void;
  let stopObserved = false;
  const stopReceipt = new Promise<void>(resolve => { stopped = resolve; });
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = () => resolve({ code: null, signal: 'SIGTERM' }); });
  const host = { ...localHost(fixtureEnvironment(root, process.env)), identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }), stop: async () => { stopObserved = true; stopped(); return true; } };
  const files = new LaunchFiles(work => work(), host);
  const path = join(root, 'owned.log');
  await files.file(path);
  await writeFile(path, 'writer output');
  files.spawned({ pid: 987654, exited }, () => {}, 10);
  const rollback = files.rollback();
  try {
    await eventually('rollback stop completion setup', () => stopObserved || undefined);
    await stopReceipt;
    assert.equal(await readFile(path, 'utf8'), 'writer output');
    assert.deepEqual(files.pids, [987654]);
  } finally { finish(); await rollback; }
  await assert.rejects(readFile(path), { code: 'ENOENT' });
  assert.deepEqual(files.pids, []);
});

for (const boundary of ['alive', 'identity'] as const) test(`OpenCode close joins held resume ${boundary} and fences relaunch`, async t => {
  const root = await tempProject(t);
  const row = { ...await fakeHarness('opencode').spawn({ name: 'held', cwd: root, role: null, model: null }), pid: 987654 };
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered = false, completed = false, stops = 0, spawns = 0;
  const host = { ...localHost(fixtureEnvironment(root, process.env)), alive: async () => {
    if (boundary === 'alive') { entered = true; await held; completed = true; }
    return false;
  }, identity: async (pid: number) => { entered = true; await held; completed = true; return { pid, pidIdentity: 'birth', pidStarted: 'start' }; }, stop: async () => { stops++; return true; }, spawn: async () => { spawns++; throw new Error('unexpected spawn'); } };
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForProcess: () => host, hostForLaunch: () => host }, { bin: 'synthetic-opencode', env: fixtureEnvironment(root, process.env) });
  const resumed = adapter.resume(row, { relaunch: true });
  const outcome = resumed.then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  t.after(async () => { release(); await outcome; await adapter.close(); });
  await eventually(`held ${boundary} setup admitted`, () => entered || undefined);
  let closedBeforeCompletion = false;
  const closing = adapter.close().then(() => { closedBeforeCompletion = !completed; });
  await new Promise<void>(resolve => setImmediate(resolve));
  release();
  await closing;
  const result = await outcome;
  assert.equal(closedBeforeCompletion, false);
  assert.match(String(result.error), /closed/);
  assert.equal(result.value, undefined);
  assert.equal(stops, 0);
  assert.equal(spawns, 0);
});

test('OpenCode close joins stream Host liveness and prevents late reconnect work', async t => {
  const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  const clock = new FakeClock();
  const row = { ...await fakeHarness('opencode').spawn({ name: 'stream', cwd: root, role: null, model: null }), pid: 987654, harnessId: 'http://scripted', harnessSessionId: 'ses_stream' };
  await mkdir(join(root, '.cland/opencode/stream'), { recursive: true });
  await writeFile(join(root, '.cland/opencode/stream/password'), 'synthetic');
  let endStream: (() => void) | undefined;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered = false, completed = false, exits = 0, probes = 0;
  t.mock.method(OpenCodeClient.prototype, 'events', async () => new Promise<void>(resolve => { endStream = resolve; }));
  const host = { ...localHost(fixtureEnvironment(root, process.env)), alive: async () => { probes++; entered = true; await held; completed = true; return true; } };
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => { exits++; }, hostForProcess: () => host }, { env: fixtureEnvironment(root, process.env), clock, pollMs: 10000 });
  t.after(async () => { endStream?.(); release(); await adapter.close(); });
  adapter.watch(row);
  await eventually('stream subscription setup admitted', () => endStream);
  endStream!();
  await eventually('stream liveness setup admitted', () => entered || undefined);
  let closedBeforeCompletion = false;
  const closing = adapter.close().then(() => { closedBeforeCompletion = !completed; });
  await new Promise<void>(resolve => setImmediate(resolve));
  release();
  await closing;
  assert.equal(closedBeforeCompletion, false);
  await clock.advance(10000);
  assert.equal(probes, 1);
  assert.equal(exits, 0);
});

test('OpenCode close owns a late accepted spawn and joins rollback before releasing files', async t => {
  const { readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  let releaseSpawn!: () => void, finish!: () => void;
  const held = new Promise<void>(resolve => { releaseSpawn = resolve; });
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = () => resolve({ code: null, signal: 'SIGTERM' }); });
  let spawning = false, stopped = false, complete = false;
  const host = { ...localHost(fixtureEnvironment(root, process.env)), spawn: async () => { spawning = true; await held; return { pid: 987654, exited }; }, identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }), stop: async () => { stopped = true; return true; } };
  const adapter = new OpenCodeAdapter({ root, durableLaunchRecovery: true, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForProcess: () => host, hostForLaunch: () => host }, { bin: 'synthetic-opencode', env: fixtureEnvironment(root, process.env) });
  const launch = adapter.spawn({ name: 'late', cwd: root, role: null, model: 'openai/gpt-5.2' });
  const rejected = assert.rejects(launch, /closed/);
  t.after(async () => { releaseSpawn(); finish(); await Promise.allSettled([rejected, adapter.close()]); });
  await eventually('spawn setup admitted', () => spawning || undefined);
  const closing = adapter.close().then(() => { complete = true; });
  releaseSpawn();
  await eventually('late native PID stop completed', () => stopped || undefined);
  assert.equal(complete, false);
  assert.ok(await readFile(join(root, '.cland/opencode/late/password'), 'utf8'));
  finish();
  await rejected;
  await closing;
  await assert.rejects(readFile(join(root, '.cland/opencode/late/password')), { code: 'ENOENT' });
});

test('OpenCode revocation during Host log open is checked before native spawn', async t => {
  const { default: fs } = await import('node:fs/promises');
  const { default: cp } = await import('node:child_process');
  const { syncBuiltinESMExports } = await import('node:module');
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let opened = false, revoked = false, nativeSpawns = 0;
  const open = fs.open;
  const intercepted = t.mock.method(fs, 'open', async (...args: Parameters<typeof open>) => {
    const handle = await open(...args);
    if (args[0] === join(root, '.cland/opencode/revoked/serve.log')) { opened = true; await held; }
    return handle;
  });
  const spawn = t.mock.method(cp, 'spawn', () => { nativeSpawns++; throw new Error('unexpected native spawn'); });
  syncBuiltinESMExports();
  const host = localHost(env);
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => host }, { env, bin: 'synthetic-opencode' });
  const launch = adapter.spawn({ name: 'revoked', cwd: root, role: null, model: 'openai/gpt-5.2' }, undefined, () => { if (revoked) throw new Error('authority revoked'); });
  const rejected = assert.rejects(launch, /authority revoked/);
  t.after(async () => { release(); await Promise.allSettled([rejected, adapter.close()]); intercepted.mock.restore(); spawn.mock.restore(); syncBuiltinESMExports(); });
  await eventually('native log preparation held', () => opened || undefined);
  revoked = true;
  release();
  await rejected;
  assert.equal(nativeSpawns, 0);
  await assert.rejects(fs.readFile(join(root, '.cland/opencode/revoked/password')), { code: 'ENOENT' });
});

test('OpenCode close reports incomplete launch cleanup and retains its durable owner', async t => {
  const { LaunchFiles, LaunchRecoveryPending } = await import('../src/adapters/launch-files.ts');
  const { readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  let releaseSpawn!: () => void, finish!: () => void;
  const held = new Promise<void>(resolve => { releaseSpawn = resolve; });
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = () => resolve({ code: 0, signal: null }); });
  let spawning = false, canStop = false;
  const host = { ...localHost(fixtureEnvironment(root, process.env)), spawn: async () => { spawning = true; await held; return { pid: 987654, exited }; }, identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }), stop: async () => canStop };
  const adapter = new OpenCodeAdapter({ root, durableLaunchRecovery: true, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => host }, { bin: 'synthetic-opencode', env: fixtureEnvironment(root, process.env) });
  const outcome = adapter.spawn({ name: 'incomplete', cwd: root, role: null, model: 'openai/gpt-5.2' }).catch(error => error as unknown);
  t.after(async () => {
    releaseSpawn(); finish(); await exited; canStop = true;
    const error = await outcome;
    if (error instanceof LaunchRecoveryPending) await LaunchFiles.restore(error.files, work => work(), host).rollback();
    await adapter.close().catch(() => {});
  });
  await eventually('incomplete spawn setup admitted', () => spawning || undefined);
  const closing = assert.rejects(adapter.close(), /launch cleanup incomplete/);
  releaseSpawn();
  await closing;
  const error = await outcome;
  assert.ok(error instanceof LaunchRecoveryPending);
  assert.equal(error.files.children[0]?.pid, 987654);
  assert.ok(await readFile(join(root, '.cland/opencode/incomplete/password'), 'utf8'));
});
