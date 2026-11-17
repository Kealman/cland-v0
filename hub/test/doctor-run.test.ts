// T2: probe cleanup deadlines at a mocked native child-process boundary, with a fake clock.
// No native process starts; the global child_process mock is outside the T1 source guard.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import { promisify } from 'node:util';
import { run, type RunResult } from '../src/doctor/report.ts';
import { CommandOutput } from '../src/host/agent/command.ts';
import { MAX_LINE_BYTES } from '../src/host/agent/protocol.ts';
import { agentOperations } from '../src/host/agent/operations.ts';
import { fixtureWork } from '../../test-support/fixture-work.ts';
// Node's effective native delegation method is not exposed in @types/node.
const nativePrototype = cp.ChildProcess.prototype as unknown as { spawn: (...args: unknown[]) => unknown };

for (const route of ['public', 'native-delegation'] as const) test(`a swallowed ${route} forbidden launch still fails fixture cleanup`, async t => {
  // A launcher can retain its constructor before public functions are replaced.
  const Constructor = cp.ChildProcess;
  const nativeSpawn = nativePrototype.spawn;
  const scope = ownedProbe(t, async () => {
    assert.notEqual(nativePrototype.spawn, nativeSpawn, 'trap is installed before the captured launch control');
    try {
      // cland-allow-child-env: deliberately invoke the installed fake-only denial, then verify its durable attempt count
      if (route === 'public') cp.spawn('unexpected-swallowed-launch');
      else Reflect.apply(nativePrototype.spawn, new Constructor(), []);
    } catch {}
  }, () => {}, { expectedCloseFailure: /unexpected native launch attempts/ });
  await scope;
  await assert.rejects(scope.close(), /unexpected native launch attempts/);
});

test('a failed close bound retains launch guards until original work joins', async t => {
  const originalSpawn = cp.spawn, originalNativeSpawn = nativePrototype.spawn;
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let scope: ReturnType<typeof ownedProbe> | undefined;
  // Prearm release before acquisition so an assertion failure cannot strand the body.
  t.after(async () => {
    release.resolve();
    if (scope) { await scope.close().catch(() => {}); await scope.disposed(); }
  });
  scope = ownedProbe(t, async (probe, signal, track) => {
    const pending = track(() => run('synthetic-held-body', [], {}, 20_000, false, signal));
    await probe.spawned;
    entered.resolve();
    await release.promise;
    await pending;
  }, () => {}, {
    bound: () => Promise.reject(new Error('synthetic bounded join failure')),
    expectedCloseFailure: /synthetic bounded join failure/,
  });
  const workRejected = assert.rejects(scope, /fixture work admission closed/);
  await entered.promise;
  await assert.rejects(scope.close(), /synthetic bounded join failure/);
  t.mock.restoreAll(); // Model automatic context restoration while original work is held.
  assert.notEqual(cp.spawn, originalSpawn);
  assert.notEqual(nativePrototype.spawn, originalNativeSpawn);
  release.resolve();
  await workRejected;
  await scope.disposed();
  assert.equal(cp.spawn, originalSpawn);
  assert.equal(nativePrototype.spawn, originalNativeSpawn);
});

/** Enroll the body and commands before acquisition; restore globals only after joining. */
function ownedProbe(t: TestContext, body: (probe: ReturnType<typeof fakeProbe>, signal: AbortSignal, track: <T>(start: () => Promise<T>) => Promise<T>) => Promise<void>, release: () => void = () => {}, options: { bound?: (joined: Promise<void>) => Promise<void>; expectedCloseFailure?: RegExp } = {}) {
  const owner = fixtureWork();
  const originalWork = new Set<Promise<unknown>>();
  const adopt = <T>(work: Promise<T>) => {
    originalWork.add(work);
    void work.then(() => originalWork.delete(work), () => originalWork.delete(work));
    return work;
  };
  const hooks: Array<() => unknown> = [];
  let probe: ReturnType<typeof fakeProbe> | undefined;
  let closing: Promise<void> | undefined;
  let disposed: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    const joined = owner.close(); // Fences the body and aborts admitted commands, including late setup.
    void joined.catch(() => {}); // An injected failed-bound control still owns the real join.
    release(); // A held setup continuation remains owned on failure or cancellation.
    probe?.child.emit('close', null); // Release the fake native boundary before joining.
    disposed = (async () => {
      // This original-work join never races a deadline. A failed bound leaves
      // independently installed guards live until this positive receipt.
      while (originalWork.size) await Promise.allSettled([...originalWork]);
      for (const hook of hooks) await hook();
    })();
    void disposed.catch(() => {});
    await (options.bound ? options.bound(joined) : joined);
    await disposed;
  })();
  t.after(async () => {
    try { await close(); } catch (error) {
      if (!options.expectedCloseFailure) throw error;
      assert.match(String(error), options.expectedCloseFailure);
    }
  });
  const onAbort = () => { void close().catch(() => {}); };
  t.signal.addEventListener('abort', onAbort, { once: true });
  t.after(() => t.signal.removeEventListener('abort', onAbort));
  const work = adopt(owner.run(async (_step, signal) => {
    const context = new Proxy(t, { get(target, key) {
      if (key === 'after') return (hook: () => unknown) => hooks.push(hook);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    // New cases need no deadline advancement. Native immediates drain naturally,
    // leaving the shared owner's bounded join timer operational during teardown.
    probe = fakeProbe(context);
    await body(probe, signal, start => adopt(owner.run(start)));
  }));
  return Object.assign(work, { close, disposed: () => disposed });
}

test('command fixture joins an abandoned command before restoring global mocks', async t => {
  const originalSpawn = cp.spawn;
  let commandJoined = false;
  const scope = ownedProbe(t, async (probe, signal, track) => {
    track(() => run('synthetic-abandoned', [], {}, 20_000, false, signal).then(() => { commandJoined = true; }));
    await probe.spawned;
    throw new Error('synthetic assertion failure');
  });
  await assert.rejects(scope, /synthetic assertion failure/);
  assert.notEqual(cp.spawn, originalSpawn);
  await scope.close();
  assert.equal(commandJoined, true);
  assert.equal(cp.spawn, originalSpawn);
});

test('command fixture joins late environment continuation before restoring global mocks', async t => {
  const originalSpawn = cp.spawn;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let lateJoined = false;
  const scope = ownedProbe(t, async (_probe, signal) => {
    entered.resolve();
    await release.promise;
    const result = await agentOperations({}, signal).run!({ command: 'synthetic-late', args: [], env: {}, cwd: '/synthetic' }) as RunResult;
    assert.equal(result.nativeAdmission, 'no-process');
    assert.equal(_probe.spawnCount(), 0);
    lateJoined = true;
  }, () => release.resolve());
  // The whole body owns this held continuation even before a command exists.
  const observed = assert.rejects(scope, /fixture work admission closed/);
  await entered.promise;
  const closing = scope.close();
  assert.notEqual(cp.spawn, originalSpawn);
  release.resolve();
  await observed;
  await closing;
  assert.equal(lateJoined, true);
  assert.equal(cp.spawn, originalSpawn);
});

test('agent command output stays bounded while draining ten frame caps and waits for close', async t => {
  await ownedProbe(t, async ({ child, signals, spawned }, signal, track) => {
    const output = new CommandOutput(MAX_LINE_BYTES);
    let observed: RunResult | undefined;
    const pending = track(() => run('synthetic-noisy-command', [], {}, 20_000, false, signal, 'utf8', undefined, output).then(value => { observed = value; }));
    await spawned;
    const chunk = '界'.repeat(4096);
    for (let sent = 0; sent < 10 * MAX_LINE_BYTES; sent += Buffer.byteLength(chunk)) {
      (Math.floor(sent / Buffer.byteLength(chunk)) % 2 ? child.stdout : child.stderr).write(chunk);
      assert.ok(output.retainedBytes <= MAX_LINE_BYTES, 'combined retained UTF-8 bytes never exceed one frame');
      assert.equal(output.retainedBytes, Buffer.byteLength(output.stdout) + Buffer.byteLength(output.stderr));
    }
    child.stdout.write('🙂'.repeat(4096) + 'stdout-end');
    child.stderr.write('界'.repeat(4096) + 'stderr-end');
    assert.ok(output.stdout.endsWith('stdout-end'));
    assert.ok(output.stderr.endsWith('stderr-end'));
    assert.ok(Buffer.byteLength(output.stdout) <= 4096);
    assert.ok(Buffer.byteLength(output.stderr) <= 4096);
    assert.ok(!output.stdout.includes('\uFFFD') && !output.stderr.includes('\uFFFD'), 'tail boundaries preserve complete UTF-8 characters');
    assert.equal(output.retainedBytes, Buffer.byteLength(output.stdout) + Buffer.byteLength(output.stderr));
    assert.equal(observed, undefined, 'overflow and drained data are not native close');
    assert.deepEqual(signals, [], 'overflow drains without killing the command');
    child.emit('close', 7);
    await pending;
    assert.equal(observed!.code, 7);
    assert.match(observed!.error!, /output exceeds agent frame cap/);
    assert.ok(Buffer.byteLength(observed!.stdout) + Buffer.byteLength(observed!.stderr) <= MAX_LINE_BYTES);
  });
});

test('agent run preserves the frame cap refusal after an oversized first chunk closes', async t => {
  await ownedProbe(t, async ({ child, spawned, spawnCount }, signal, track) => {
    const pending = track(() => agentOperations({}, signal).run!({ command: 'synthetic-agent', args: [], env: {}, cwd: '/synthetic' }));
    const refused = track(() => assert.rejects(pending, { message: 'agent result exceeds frame cap' }));
    await spawned; // Positive receipt from the fake native spawn boundary.
    assert.equal(spawnCount(), 1);
    child.stdout.write('x'.repeat(10 * MAX_LINE_BYTES));
    child.emit('close', 0);
    await refused;
  });
});

test('doctor command collection retains its existing complete output and result shape', async t => {
  await ownedProbe(t, async ({ child, spawned }, signal, track) => {
    const pending = track(() => run('synthetic-doctor', [], {}, undefined, false, signal));
    await spawned;
    const stdout = 'x'.repeat(2 * MAX_LINE_BYTES);
    child.stdout.write(stdout);
    child.stderr.write('diagnostic');
    child.emit('close', 3);
    assert.deepEqual(await pending, { code: 3, stdout, stderr: 'diagnostic' });
  });
});

/** Existing fake-clock cases keep their original context-owned native fake. */
function legacyProbe(t: TestContext) {
  const child = Object.assign(new EventEmitter(), { pid: 42, stdout: new PassThrough(), stderr: new PassThrough(), kill() { return true; } });
  const spawned = Promise.withResolvers<void>();
  const signals: Array<[number, NodeJS.Signals | number | undefined]> = [];
  const spawn = t.mock.method(cp, 'spawn', () => { spawned.resolve(); return child as unknown as cp.ChildProcess; });
  t.mock.method(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => { signals.push([pid, signal]); return true; });
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  syncBuiltinESMExports();
  t.mock.timers.enable({ apis: ['setTimeout', 'setImmediate'] });
  return { child, signals, spawned: spawned.promise, spawnCount: () => spawn.mock.callCount() };
}

/** Called only through ownedProbe, which captures disposal until original work joins. */
function fakeProbe(t: TestContext) {
  const child = Object.assign(new EventEmitter(), { pid: 42, stdout: new PassThrough(), stderr: new PassThrough(), kill() { return true; } });
  const originals = { spawn: cp.spawn, exec: cp.exec, execFile: cp.execFile, execSync: cp.execSync, execFileSync: cp.execFileSync, spawnSync: cp.spawnSync, fork: cp.fork };
  const originalNativeSpawn = nativePrototype.spawn;
  const originalKill = process.kill;
  const attempts: string[] = [];
  let control = true, spawnCalls = 0;
  t.after(async () => {
    const streams = [child.stdout, child.stderr];
    const closed = streams.map(stream => stream.closed ? Promise.resolve() : once(stream, 'close'));
    for (const stream of streams) stream.destroy();
    await Promise.all(closed);
    child.removeAllListeners();
    try { assert.deepEqual(attempts, [], 'unexpected native launch attempts'); }
    finally {
      Object.assign(cp, originals);
      nativePrototype.spawn = originalNativeSpawn;
      process.kill = originalKill;
      syncBuiltinESMExports();
    }
  });
  const spawned = Promise.withResolvers<void>();
  const signals: Array<[number, NodeJS.Signals | number | undefined]> = [];
  const denied = (boundary: string): never => {
    if (!control) attempts.push(boundary);
    throw new Error('unexpected native launch');
  };
  nativePrototype.spawn = () => denied('ChildProcess.prototype.spawn');
  cp.execSync = (() => denied('execSync')) as typeof cp.execSync;
  cp.execFileSync = (() => denied('execFileSync')) as typeof cp.execFileSync;
  cp.spawnSync = (() => denied('spawnSync')) as typeof cp.spawnSync;
  cp.fork = (() => denied('fork')) as typeof cp.fork;
  for (const name of ['exec', 'execFile'] as const) {
    // Native custom promisifiers are nonconfigurable; replace the complete function.
    cp[name] = Object.assign(() => denied(name), { [promisify.custom]: () => denied(name + '.custom') }) as unknown as typeof cp.exec & typeof cp.execFile;
    const callbackLaunch = cp[name] as unknown as (command: string) => unknown;
    // cland-allow-child-env: positive control invokes the installed fake refusal, never a native launcher
    assert.throws(() => callbackLaunch('synthetic-positive-control'), /unexpected native launch/);
    // cland-allow-child-env: positive control invokes the installed fake custom promisifier, never a native launcher
    assert.throws(() => promisify(cp[name])('synthetic-positive-control'), /unexpected native launch/);
  }
  cp.spawn = ((bin: string) => {
    if (!bin.startsWith('synthetic-')) return denied('spawn');
    spawnCalls++;
    spawned.resolve(); return child as unknown as cp.ChildProcess;
  }) as typeof cp.spawn;
  // cland-allow-child-env: positive control invokes the installed fake spawn refusal, never a native launcher
  assert.throws(() => cp.spawn('unexpected-positive-control'), /unexpected native launch/);
  // cland-allow-child-env: positive control invokes the effective prototype trap, never its original native implementation
  assert.throws(() => Reflect.apply(nativePrototype.spawn, child, []), /unexpected native launch/);
  control = false;
  process.kill = (pid: number, signal?: NodeJS.Signals | number) => { signals.push([pid, signal]); return true; };
  syncBuiltinESMExports();
  return { child, signals, spawned: spawned.promise, spawnCount: () => spawnCalls };
}

test('a probe whose close never arrives reports bounded incomplete cleanup after SIGKILL', async t => {
  const { child, signals } = legacyProbe(t);
  let result: RunResult | undefined;
  const observed = (): RunResult | undefined => result;
  const pending = run('synthetic-probe', [], {}, 100).then(r => { result = r; });
  t.mock.timers.tick(100);
  assert.deepEqual(signals, [[-42, 'SIGKILL']], 'the deadline forcibly terminates the owned group');
  assert.equal(child.stdout.destroyed, true);
  assert.equal(child.stderr.destroyed, true);
  assert.equal(observed(), undefined, 'signalling and pipe destruction alone are not close');
  t.mock.timers.tick(1000);
  t.mock.timers.tick(0);
  await Promise.resolve();
  const receipt = observed();
  assert.ok(receipt, 'forced cleanup must produce its bounded failure receipt even when close never arrives');
  await pending;
  assert.deepEqual(receipt, { code: null, stdout: '', stderr: '', error: 'no answer within 0.1 s; cleanup incomplete: child did not close within 1 s of SIGKILL' });
  child.emit('close', null);
  t.mock.timers.tick(0);
  assert.equal(observed(), receipt, 'a late close cannot rewrite the failure receipt');
});

test('a probe error starts its own close bound without waiting for the answer deadline', async t => {
  const { child, signals } = legacyProbe(t);
  let result: RunResult | undefined;
  const observed = (): RunResult | undefined => result;
  const pending = run('synthetic-probe', [], {}, 20_000).then(r => { result = r; });
  child.emit('error', new Error('probe failure'));
  assert.deepEqual(signals, [[-42, 'SIGKILL']]);
  t.mock.timers.tick(999);
  await Promise.resolve();
  assert.equal(observed(), undefined, 'an error alone is not close');
  t.mock.timers.tick(1);
  t.mock.timers.tick(0);
  await Promise.resolve();
  const receipt = observed();
  assert.ok(receipt, 'the error cleanup bound ends independently of the 20 s answer deadline');
  await pending;
  assert.deepEqual(receipt, { code: null, stdout: '', stderr: '', error: 'probe failure; cleanup incomplete: child did not close within 1 s of SIGKILL' });
});

test('an aborted owned command kills its group and waits for native close before returning', async t => {
  const { child, signals } = legacyProbe(t);
  const abort = new AbortController();
  let result: RunResult | undefined;
  const observed = () => result;
  const pending = run('synthetic-maintenance', [], {}, 30_000, false, abort.signal).then(value => { result = value; });
  abort.abort();
  assert.deepEqual(signals, [[-42, 'SIGKILL']]);
  assert.equal(observed(), undefined, 'an abort request is not native close');
  child.emit('close', null);
  t.mock.timers.tick(0);
  await pending;
  assert.deepEqual(observed(), { code: null, stdout: '', stderr: '', error: 'cancelled' });
});

test('a command cancelled before launch starts no child', async t => {
  const { spawnCount } = legacyProbe(t);
  const abort = new AbortController();
  abort.abort();
  const pending = run('synthetic-maintenance', [], {}, 30_000, false, abort.signal);
  assert.equal(spawnCount(), 0);
  t.mock.timers.tick(0);
  assert.deepEqual(await pending, { code: null, stdout: '', stderr: '', error: 'cancelled', nativeAdmission:'no-process' });
});

test('seventh-slot binary output preserves bytes while sixth-slot cancellation still awaits close', async t => {
  const { child, signals } = legacyProbe(t);
  const abort = new AbortController();
  let result: RunResult | undefined;
  const pending = run('synthetic-native-birth', [], {}, 30_000, false, abort.signal, 'latin1').then(value => { result = value; });
  child.stdout.end(Buffer.from([0, 128, 255]));
  abort.abort();
  assert.deepEqual(signals, [[-42, 'SIGKILL']]);
  assert.equal(result, undefined, 'binary output and cancellation are not a native close receipt');
  child.emit('close', null);
  t.mock.timers.tick(0);
  await pending;
  assert.deepEqual(result, { code: null, stdout: '\x00\x80\xff', stderr: '', error: 'cancelled' });
});

for(const boundary of ['closed','missing-close','pid-seen'] as const)test(`native no-PID error admission ${boundary}`,async t=>{
 const {child}=legacyProbe(t);
 if(boundary!=='pid-seen')Object.assign(child,{pid:undefined});
 let observed:RunResult|undefined;
 const pending=run('synthetic-no-process',[],{},20000).then(result=>{observed=result;});
 Object.assign(child,{pid:undefined});
 child.emit('error',new Error('synthetic spawn error'));
 t.mock.timers.tick(0);await Promise.resolve();assert.equal(observed,undefined,'error is not a drained native close');
 if(boundary==='missing-close')t.mock.timers.tick(1000);else child.emit('close',null);
 t.mock.timers.tick(0);await pending;
 assert.equal(observed!.nativeAdmission,boundary==='closed'?'no-process':undefined);
 if(boundary==='missing-close')assert.match(observed!.error!,/cleanup incomplete/);
});
