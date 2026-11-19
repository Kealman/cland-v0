// T2: diagnostic wording uses a fake child; no real processes or wall-clock waits.
// T1 lint conservatively rejects the mocked child_process import (T-682).
import { test, type TestContext } from 'node:test';
import { fixtureWork } from '../../test-support/fixture-work.ts';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import fs from 'node:fs/promises';
import nativeFs from 'node:fs';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { suiteCommand, type SuiteInspectionReceipt } from '../src/suite-command.ts';
import { startupOwnerLine } from '../src/suite-startup-owner.ts';
import { suiteWorker } from '../src/hub/suite-worker.ts';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { clandCliLaunch } from './tier-cli.ts';

test('native guard permits only the scoped CLI callback launch and fences other entry points', async t => {
  let calls = 0;
  t.mock.method(cp, 'execFile', () => { calls++; return {}; });
  let restore = () => {};
  t.after(() => { restore(); t.mock.restoreAll(); syncBuiltinESMExports(); });
  const guard = await fakeNativeGuard(value => { restore = value; }, { allowCli: true });
  const cli = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
  // cland-allow-child-env: the guard delegates only to the installed in-memory callback fake
  clandCliLaunch(() => cp.execFile(process.execPath, [cli]));
  assert.equal(calls, 1);
  guard.verify();
  // cland-allow-child-env: every negative control reaches the throwing guard, never a native child
  assert.throws(() => cp.execFile(process.execPath, [cli]), /native launch forbidden/);
  // cland-allow-child-env: altered entry is refused by the scoped guard
  assert.throws(() => clandCliLaunch(() => cp.execFile(process.execPath, ['other'])), /native launch forbidden/);
  // cland-allow-child-env: custom promisification has no CLI exemption
  await assert.rejects(clandCliLaunch(() => promisify(cp.execFile)(process.execPath, [cli])), /native launch forbidden/);
  // cland-allow-child-env: the CLI scope grants no spawn permission
  assert.throws(() => clandCliLaunch(() => cp.spawn(process.execPath, [cli])), /native launch forbidden/);
  assert.equal(calls, 1, 'negative controls never reach the underlying launch');
  assert.throws(guard.verify, /unexpected native launch/, 'caught violations remain a failed guard receipt');
});

// Keep the setup deadline live while behaviour time uses mock timers.
const setupTimeout = globalThis.setTimeout;
const clearSetupTimeout = globalThis.clearTimeout;

for (const failure of ['partial installation', 'caller setup']) test(`native guard restores its registered owner after ${failure} failure`, async t => {
  const methods = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const;
  const originals = new Map(methods.map(method => [method, cp[method]]));
  const prototypeSpawn = Reflect.get(cp.ChildProcess.prototype, 'spawn');
  let ownedRestore: (() => void) | undefined;
  let acquired: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  const cleanup = () => { ownedRestore?.(); acquired?.restore(); };
  t.after(cleanup);
  const register = (restore: () => void) => {
    for (const method of methods) assert.equal(cp[method], originals.get(method), 'owner registered before mutation');
    ownedRestore = restore;
  };
  await assert.rejects(async () => {
    acquired = await fakeNativeGuard(register, failure === 'partial installation' ? {
      afterInstall: () => { assert.equal(typeof ownedRestore, 'function'); throw new Error('partial installation failed'); },
    } : {});
    throw new Error('caller setup failed before later hooks');
  }, failure === 'partial installation' ? /partial installation failed/ : /caller setup failed/);
  assert.equal(typeof ownedRestore, 'function', 'pre-enrolled cleanup captured the restorer');
  // Exercise the same registered teardown after the fault, then observe restoration.
  cleanup();
  for (const method of methods) assert.equal(cp[method], originals.get(method));
  assert.equal(Reflect.get(cp.ChildProcess.prototype, 'spawn'), prototypeSpawn);
});

function ownedMocks(t: TestContext, body: (signal: AbortSignal, cleanup: (release: () => Promise<void>, dispose: () => void | Promise<void>) => void, registerRestore: (restore: () => void) => void) => Promise<void>) {
  const work = fixtureWork();
  const restorations: Array<() => void> = [];
  let release = async () => {}, dispose: () => void | Promise<void> = () => {};
  t.after(async () => {
    const joined = work.close(); // Fence the whole callback before releasing held work.
    await release();
    await joined;
    try { t.mock.restoreAll(); await dispose(); }
    finally { for (const restore of restorations) restore(); syncBuiltinESMExports(); }
  });
  return work.run(async (_step, signal) => body(signal, (unblock, destroy) => { release = unblock; dispose = destroy; }, restore => { restorations.push(restore); }));
}
for (const mode of ['infrastructure', 'infrastructure-output', 'infrastructure-green', 'infrastructure-read-error', 'infrastructure-close-error', 'infrastructure-oversize', 'infrastructure-inspection', 'infrastructure-inspection-write-error', 'infrastructure-inspection-callback-error', 'infrastructure-inspection-both-error', 'infrastructure-green-inspection-write-error', 'infrastructure-green-inspection-callback-error', 'infrastructure-green-inspection-both-error', 'infrastructure-inspection-async-error', 'infrastructure-green-inspection-async-error', 'hung', 'unrelated', 'other-reporter', 'duplicate', 'test', 'suite', 'empty', 'scaled', 'capped', 'legacy', 'closed', 'owner-finish', 'owner-exit', 'owner-active', 'invalid-owner', 'owner-reclaim-open-pipe', 'inspection-recovery'] as const)
test(`file startup watchdog handles ${mode} receipts`, t => ownedMocks(t, async (signal, cleanup, registerRestore) => {
  const child = Object.assign(new EventEmitter(), { pid: 40001, stdout: new PassThrough(), stderr: new PassThrough() });
  const launched = Promise.withResolvers<void>();
  const listeners = new Map((['SIGINT', 'SIGTERM'] as const).map(name => [name, process.listeners(name)]));
  let published: SuiteInspectionReceipt | undefined;
  let summaryAttempts = 0, callbackAttempts = 0;
  const failSummary = mode.includes('inspection-write-error') || mode.includes('inspection-both-error');
  const failCallback = mode.includes('inspection-callback-error') || mode.includes('inspection-both-error');
  let result: ReturnType<typeof suiteCommand> | undefined;
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  cleanup(async () => {
    if (result) {
      await Promise.race([launched.promise, result.then(() => {}, () => {})]);
      child.emit('close', 0, null); launched.resolve();
      await result.then(() => {}, () => {});
    }
  }, () => {
    child.stdout.destroy(); child.stderr.destroy();
    for (const [name, before] of listeners) for (const listener of process.listeners(name)) if (!before.includes(listener)) process.off(name, listener);
    guard?.verify();
  });
  guard = await fakeNativeGuard(registerRestore);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let receipt = '';
  t.mock.method(fs, 'writeFile', async () => { receipt = ''; });
  t.mock.method(fs, 'readFile', async () => {
    if (mode === 'infrastructure-read-error') throw new Error('receipt denied');
    return receipt;
  });
  let retained = 0;
  t.mock.method(nativeFs, 'openSync', () => 42);
  t.mock.method(nativeFs, 'readSync', (_fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
    if (mode === 'infrastructure-read-error') throw new Error('receipt denied');
    const bytes = Buffer.from(receipt).subarray(position, position + length);
    bytes.copy(buffer, offset); retained += bytes.length;
    assert.ok(retained <= 4097, '4096 payload bytes plus one oversize sentinel');
    return bytes.length;
  });
  t.mock.method(nativeFs, 'closeSync', () => {
    if (mode === 'infrastructure-close-error') throw new Error('receipt close denied');
  });
  let stopped = false;
  let nativeExited = false;
  let log = '';
  const stdout = process.stdout.write.bind(process.stdout);
  const stderr = process.stderr.write.bind(process.stderr);
  t.mock.method(process.stdout, 'write', (chunk: string) => chunk.startsWith('suite ') ? true : stdout(chunk));
  t.mock.method(process.stderr, 'write', (chunk: string) => {
    if (chunk.startsWith('suite inspection ')) {
      summaryAttempts++;
      if (failSummary) throw new Error('sensitive sink payload');
    }
    if (!chunk.startsWith('stalled:') && !chunk.startsWith('suite stall')) return stderr(chunk);
    log += chunk; return true;
  });
  t.mock.method(cp, 'spawn', (bin: string) => {
    assert.equal(bin, '/bin/sh');
    launched.resolve();
    return child;
  });
  // The fake process never has host process authority, including on regression.
  syncBuiltinESMExports();
  const row = { pid: 40001, parent: 1, group: 40001, started: 'birth', identity: 'root', state: 'S', command: '/bin/fake-command' };
  const writer = { ...row, pid: 40002, parent: 40001, identity: 'writer', command: '/bin/fake-inherited-writer' };
  const ended: number[] = [];
  let inspections = 0;
  const budget = mode === 'scaled' ? 60000 : mode === 'capped' ? 5000 : 30000;
  result = suiteCommand('fake command', '/scratch/t1841', {
    CLAND_SUITE_LIMITS_CWD: '/scratch/t1841',
    CLAND_SUITE_LIMITS: JSON.stringify({ stallTimeoutMs: mode === 'capped' ? 10000 : 600000 }),
    CLAND_TEST_LOAD_FACTOR: mode === 'scaled' ? '2' : '1',
    CLAND_SUITE_CAUSE_FILE: '/scratch/runner-cause',
  }, {
    processIdentityAsync: async () => 'root', processStartedAsync: async () => 'birth',
    systemProcesses: async () => {
      if (mode.startsWith('infrastructure') && mode.includes('inspection')) throw new Error('fake inspection unavailable');
      if (mode === 'inspection-recovery') {
        inspections++;
        if (inspections <= 3 || inspections === 5) throw new Error('fake inspection unavailable');
        return inspections === 4 ? [row, writer] : [row, { ...writer, parent: 1 }, { ...writer, pid: 40003, parent: 1, identity: 'unrelated' }];
      }
      return mode === 'owner-reclaim-open-pipe' ? nativeExited ? [writer] : [row, writer] : [row];
    },
    stdioWriters: async () => mode === 'owner-reclaim-open-pipe' ? [writer] : [],
    endProcess: async proof => {
      ended.push(proof.pid!);
      stopped = true;
      if (mode !== 'owner-reclaim-open-pipe' || proof.pid === writer.pid) child.emit('close', null, 'SIGTERM');
      return true;
    },
  }, receipt => {
    callbackAttempts++;
    published = receipt;
    if (failCallback) throw new TypeError('sensitive callback payload');
    if (mode.includes('inspection-async-error')) return Promise.reject(new Error('sensitive async payload'));
  });
  // Observe command rejection immediately, before waiting for its launch receipt.
  const settled = result.then(value => ({ value }), error => ({ error }));
  // Observe the launch receipt before injecting a file that never registers a test.
  const setupExpired = Promise.withResolvers<never>();
  const setupTimer = setupTimeout(() => setupExpired.reject(new Error('fake command launch setup: deadline exceeded after 5000 ms')), 5000);
  try {
    await Promise.race([launched.promise, settled.then(outcome => {
      if ('error' in outcome) throw outcome.error;
      throw new Error(`fake command launch setup: command finished before launch; exit ${outcome.value.code}; cause ${outcome.value.cause}`);
    }), setupExpired.promise]);
  } finally { clearSetupTimeout(setupTimer); }
  await Promise.resolve();
  signal.throwIfAborted();
  if (mode === 'inspection-recovery') {
    const drain = async () => { for (let i = 0; i < 30; i++) { signal.throwIfAborted(); await Promise.resolve(); } };
    await drain();
    for (let i = 0; i < 4; i++) { t.mock.timers.tick(1000); await drain(); }
    assert.equal(inspections, 5, 'three failures, recovery, then another failed round');
    assert.deepEqual(ended, []);
  }
  if (mode.startsWith('infrastructure')) {
    const cause = 'suite infrastructure: suite ticket lost; remover unknown';
    child.stderr.write(cause + '\n');
    receipt = !mode.includes('green') && (mode === 'infrastructure' || mode === 'infrastructure-close-error' || mode === 'infrastructure-oversize' || mode.includes('inspection')) ? cause : '';
    if (mode === 'infrastructure-oversize') receipt += 'x'.repeat(100000);
    const code = mode.includes('green') ? 0 : 75;
    child.emit('exit', code, null);
    child.emit('close', code, null);
    const outcome = await result;
    assert.equal(outcome.code, code);
    if (mode.includes('inspection')) {
      if (code === 75) assert.ok(outcome.cause.startsWith(cause));
      assert.equal(summaryAttempts, 1);
      assert.equal(callbackAttempts, 1, 'durable publication attempted independently of summary');
      assert.deepEqual(outcome.inspection, published);
      for (const [name, before] of listeners) assert.deepEqual(process.listeners(name), before);
      if (failSummary) assert.match(outcome.cause, /secondary diagnostic: inspection summary publication failed \(Error\)/);
      if (failCallback) assert.match(outcome.cause, /secondary diagnostic: inspection callback publication failed \(TypeError\)/);
      if (mode.includes('inspection-async-error')) assert.match(outcome.cause, /secondary diagnostic: inspection callback publication failed \(Error\)/);
      assert.doesNotMatch(outcome.cause, /sensitive/);
      assert.equal(outcome.inspection?.failures, 1);
      assert.equal(outcome.inspection?.lastErrorClass, 'Error');
    } else if (mode === 'infrastructure-read-error') assert.match(outcome.cause, /secondary diagnostic:.*receipt denied/);
    else if (mode === 'infrastructure-oversize') {
      assert.match(outcome.cause, /secondary diagnostic:.*exceeds 4096 bytes/);
      assert.doesNotMatch(outcome.cause, /^suite infrastructure:/);
    } else if (mode === 'infrastructure-close-error') {
      assert.match(outcome.cause, /^suite infrastructure:.*secondary diagnostic:.*receipt close denied/);
    } else assert.deepEqual(outcome, { code, cause: receipt });
    return;
  }
  const start = { event: 'start', id: 'reporter:1', file: 'hung-import.test.ts', name: 'hung-import.test.ts', at: 0, nesting: 0, ...(mode === 'legacy' ? {} : { type: 'file' }) };
  const emit = (row: object) => child.stdout.write(`suite progress ${JSON.stringify(row)}\n`);
  const owner = (event: 'start' | 'finish') => child.stdout.write(startupOwnerLine({ id: 'inner-phase:1', event }) + '\n');
  if (mode.startsWith('owner-')) owner('start');
  if (mode === 'owner-reclaim-open-pipe') {
    nativeExited = true;
    child.emit('exit', 0, null); // No finish: the inherited writer still owns both pipes.
    assert.equal(child.stdout.readableEnded, false);
    assert.equal(child.stderr.readableEnded, false);
  }
  if (mode === 'invalid-owner') child.stdout.write('suite startup owner {"event":"start"}\n');
  emit(start);
  t.mock.timers.tick(budget - 1);
  assert.equal(stopped, false, 'startup deadline must not fire early');
  if (mode === 'test' || mode === 'suite') emit({ ...start, id: 'reporter:2', type: mode });
  if (mode === 'other-reporter') emit({ ...start, id: 'different-reporter:2', type: 'test' });
  if (mode === 'empty') emit({ ...start, event: 'finish', outcome: 'pass', seconds: 0 });
  if (mode === 'test' || mode === 'suite' || mode === 'empty') emit(start); // Replay cannot rearm a settled file.
  if (mode === 'unrelated') {
    child.stdout.write('still writing unrelated output\n');
    emit({ ...start, id: 'other-file', file: 'other.test.ts' });
    emit({ ...start, id: 'other-test', file: 'other.test.ts', type: 'test' });
  }
  if (mode === 'duplicate') emit(start);
  if (mode === 'closed') { child.emit('close', 0, null); await result; }
  if (mode === 'owner-finish') {
    owner('finish');
    emit({ ...start, id: 'next-phase:1' });
    t.mock.timers.tick(budget - 1);
    assert.equal(stopped, false, 'finish returns startup ownership for the next phase');
  }
  t.mock.timers.tick(1);
  if (mode === 'owner-exit' || mode === 'owner-active') {
    assert.equal(stopped, false, 'inner owner retains cleanup while alive');
    if (mode === 'owner-exit') child.emit('exit', 0, null);
    else t.mock.timers.tick(600000 - budget); // No renewals: the no-output guard remains the backstop.
  }
  // Let the async owner finish its captured-process inspection, without advancing time.
  for (let turn = 0; turn < 50 && !stopped; turn++) await Promise.resolve();
  if (['test', 'suite', 'empty', 'legacy', 'closed'].includes(mode)) {
    t.mock.timers.tick(budget + 1);
    assert.equal(stopped, false, 'positive body/empty-file/close receipts disarm; older untyped receipts stay compatible');
    child.emit('close', 0, null);
    assert.deepEqual(await result, { code: 0, cause: '' });
    return;
  }
  assert.equal(stopped, true, 'file startup must stop at its bound, before the no-output guard');
  const outcome = await result;
  assert.equal(outcome.code, 1);
  assert.ok(outcome.cause.includes(mode === 'owner-active' ? 'stalled: no output for 10 min' : `hung-import.test.ts no test started within ${budget / 1000} s`));
  assert.match(log, mode === 'owner-exit' || mode === 'owner-reclaim-open-pipe' ? /command exit 0; stdout open; stderr open/ : /command exit pending; stdout open; stderr open/);
  assert.match(log, /suite stall processes /);
  if (mode === 'owner-reclaim-open-pipe') assert.ok(ended.includes(writer.pid), 'outer owner joins inherited writer cleanup before returning');
  if (mode === 'inspection-recovery') assert.deepEqual(ended, [40001, 40002], 'failed rounds retain the proven writer without admitting an unrelated process');
}));

import { suiteEvidence } from '../src/suite-log.ts';

for (const sinkFault of ['none', 'summary', 'both'] as const) test(`failed stall inspection reaches the durable worker result${sinkFault === 'none' ? '' : ` with ${sinkFault} publication failure`}`, t => ownedMocks(t, async (signal, cleanup) => {
  let root: string | undefined;
  const child = Object.assign(new EventEmitter(), { pid: 40001, stdout: new PassThrough(), stderr: new PassThrough() });
  const launched = Promise.withResolvers<void>();
  let worker: Promise<void> | undefined;
  let attempts = 0;
  const originalExec = cp.execFile;
  let nativeDelegations = 0;
  cleanup(async () => {
    if (worker) {
      await Promise.race([launched.promise, worker]);
      child.emit('close', 0, null);
      launched.resolve();
      await worker;
    }
  }, async () => {
    cp.execFile = originalExec;
    child.stdout.destroy(); child.stderr.destroy();
    if (root) await rm(root, { recursive: true, force: true });
  });
  root = await mkdtemp(join(tmpdir(), 'cland-inspection-result-'));
  signal.throwIfAborted();
  const result = join(root, 'result.json'), input = join(root, 'job.json');
  await writeFile(join(root, 'gate'), 'ready');
  await writeFile(input, JSON.stringify({ id: 'fake', cwd: root, result, gate: join(root, 'gate'), locks: [],
    commands: { check: 'fake', test: '' }, limits: { stallTimeoutMs: 7000 } }));
  signal.throwIfAborted();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  t.mock.method(cp, 'spawn', () => { launched.resolve(); return child; });
  // A synthetic native boundary makes the inherited-custom bug fail without
  // ever reaching the host. Prove the negative control before installing fakes.
  const nativeBoundary = () => { nativeDelegations++; throw new Error('native delegation forbidden'); };
  cp.execFile = Object.assign(nativeBoundary, { [promisify.custom]: nativeBoundary }) as unknown as typeof cp.execFile;
  // cland-allow-child-env: synthetic throwing custom-promisifier control cannot launch a native process or consume an environment
  assert.throws(() => promisify(cp.execFile)('git', [], {}), /native delegation forbidden/);
  assert.equal(nativeDelegations, 1);
  // Node exposes this native entry at runtime but omits it from ChildProcess's public type.
  t.mock.method(cp.ChildProcess.prototype as unknown as { spawn: () => void }, 'spawn', () => { assert.fail('native child launch forbidden'); });
  let callbackProbes = 0, customProbes = 0;
  const fakeExec = (bin: string, _args: string[], _options: unknown, callback: (error: null, stdout: string, stderr: string) => void) => {
    assert.ok(bin === 'git' || bin === 'node');
    callbackProbes++;
    callback(null, 'fake', ''); return new EventEmitter();
  };
  Object.defineProperty(fakeExec, promisify.custom, { value: (bin: string, args: string[], options: unknown) => {
    customProbes++;
    return new Promise(resolve => fakeExec(bin, args, options, (_error, stdout, stderr) => resolve({ stdout, stderr })));
  } });
  // Replace the entire binding: t.mock.method proxies can inherit the old
  // custom promisifier, which closes over its native launch implementation.
  cp.execFile = fakeExec as unknown as typeof cp.execFile;
  let callbackControl = false;
  fakeExec('git', [], {}, () => { callbackControl = true; });
  assert.equal(callbackControl, true);
  // The worker installs process-entry signal forwarding; this fixture owns no group.
  const on = process.on.bind(process);
  t.mock.method(process, 'on', (event: string, listener: (...args: unknown[]) => void) => event === 'SIGINT' || event === 'SIGTERM' ? process : on(event, listener));
  t.mock.method(process.stdout, 'write', () => true);
  t.mock.method(process.stderr, 'write', (chunk: string) => {
    if (sinkFault !== 'none' && chunk.startsWith('suite inspection ')) throw new Error('sensitive summary payload');
    return true;
  });
  syncBuiltinESMExports();
  worker = suiteWorker(input, {
    processStartedAsync: async () => 'fake birth',
    suiteCommand: (line, cwd, env, _native, report) => suiteCommand(line, cwd, env, {
      processIdentityAsync: async () => 'root', processStartedAsync: async () => 'birth',
      systemProcesses: async () => { attempts++; throw new TypeError('fake inspection failed'); },
      stdioWriters: async () => [],
      endProcess: async () => { assert.fail('failed inspection cannot signal a process'); },
    }, receipt => {
      if (sinkFault === 'both') throw new TypeError('sensitive callback payload');
      report?.(receipt);
    }),
  });
  await Promise.race([launched.promise, worker.then(() => { throw new Error('worker completed before fake command launch'); })]);
  const drain = async () => { for (let i = 0; i < 40; i++) { signal.throwIfAborted(); await Promise.resolve(); } };
  await drain();
  for (let i = 0; i < 7; i++) { t.mock.timers.tick(1000); await drain(); }
  await worker;
  const receipt = JSON.parse(await readFile(result, 'utf8'));
  assert.equal(receipt.code, 1);
  if (sinkFault === 'none') assert.equal(receipt.cause, 'fake inspection failed');
  else {
    assert.match(receipt.cause, /^fake inspection failed; secondary diagnostic: inspection summary publication failed \(Error\)/);
    if (sinkFault === 'both') assert.match(receipt.cause, /inspection callback publication failed \(TypeError\)/);
    assert.doesNotMatch(receipt.cause, /sensitive/);
  }
  assert.ok(attempts >= 8, 'periodic retries and terminal cleanup both failed');
  assert.equal(receipt.inspections.length, 1);
  assert.equal(receipt.inspections[0].receipt.unobservedPastBound, true);
  assert.equal(receipt.inspections[0].receipt.unobservedBoundMs, 5000);
  assert.equal(receipt.inspections[0].receipt.lastErrorClass, 'TypeError');
  assert.equal(nativeDelegations, 1, 'only the deliberate negative control reaches the synthetic native boundary');
  assert.ok(customProbes > 0, 'worker setup used the explicit fake custom promisifier');
  assert.equal(callbackProbes, customProbes + 1, 'custom and callback control share the same fake');
}));

for (const recovers of [true, false]) test(`inspection failures are summarized when observation ${recovers ? 'recovers' : 'stays unavailable'}`, t => ownedMocks(t, async (signal, cleanup) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const child = Object.assign(new EventEmitter(), { pid: 40001, stdout: new PassThrough(), stderr: new PassThrough() });
  const launched = Promise.withResolvers<void>();
  let result: ReturnType<typeof suiteCommand> | undefined;
  let attempts = 0, log = '';
  t.mock.method(cp, 'spawn', () => { launched.resolve(); return child; });
  t.mock.method(cp, 'execFile', () => { throw new Error('native probe forbidden'); });
  const stderr = process.stderr.write.bind(process.stderr);
  t.mock.method(process.stderr, 'write', (chunk: string) => {
    if (!chunk.startsWith('suite inspection ')) return stderr(chunk);
    log += chunk; return true;
  });
  syncBuiltinESMExports();
  cleanup(async () => {
      if (result) {
        await Promise.race([launched.promise, result.then(() => {}, () => {})]);
        child.emit('close', 0, null); launched.resolve(); await result.then(() => {}, () => {});
      }
    }, () => {
      child.stdout.destroy(); child.stderr.destroy();
    });
  result = suiteCommand('fake command', '/scratch/inspection', {
    CLAND_SUITE_LIMITS_CWD: '/scratch/inspection',
    CLAND_SUITE_LIMITS: JSON.stringify({ stallTimeoutMs: 600000 }),
  }, {
    processIdentityAsync: async () => 'root', processStartedAsync: async () => 'birth',
    systemProcesses: async () => {
      attempts++;
      if (!recovers || attempts <= 3) throw new TypeError('secret token must not be logged');
      return [];
    },
    stdioWriters: async () => [],
    endProcess: async () => { assert.fail('ordinary close grants no cleanup authority'); },
  });
  await launched.promise;
  signal.throwIfAborted();
  // Drain the fake capture and its scheduled retry; no native time passes.
  const drain = async () => { for (let i = 0; i < 30; i++) { signal.throwIfAborted(); await Promise.resolve(); } };
  await drain();
  for (let i = 0; i < 6; i++) { t.mock.timers.tick(1000); await drain(); }
  assert.equal(attempts, 7, 'inspection retries after failures and after recovery');
  child.emit('close', 0, null);
  const outcome = await result;
  assert.equal(outcome.code, 0, 'observation diagnostics are report-only');
  assert.equal(outcome.cause, '');
  const lines = log.trim().split('\n');
  assert.equal(lines.length, 1, 'one summary per command, without retry log flooding');
  const receipt = JSON.parse(lines[0]!.slice('suite inspection '.length));
  assert.equal(receipt.failures, recovers ? 3 : 7);
  assert.equal(receipt.maxConsecutiveFailures, recovers ? 3 : 7);
  assert.equal(receipt.firstFailureAt, 10000);
  assert.equal(receipt.lastErrorClass, 'TypeError');
  assert.equal(receipt.unobservedBoundMs, 5000);
  assert.equal(receipt.unobservedPastBound, !recovers);
  assert.equal(receipt.consecutiveFailures, recovers ? 0 : 7);
  assert.deepEqual(outcome.inspection, receipt);
  assert.match(suiteEvidence(log + 'later noise\n'.repeat(40)), /suite inspection /);
  assert.doesNotMatch(log, /secret|token/);
}));

for (const inspectionFails of [false, true]) for (const exited of [false, true]) test(`stall retains completed-file and ${exited ? 'exited command with open pipes' : 'live command'} evidence${inspectionFails ? ' when inspection fails' : ''}`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const child = Object.assign(new EventEmitter(), { pid: 40001, stdout: new PassThrough(), stderr: new PassThrough() });
  const launched = Promise.withResolvers<void>();
  let result: ReturnType<typeof suiteCommand> | undefined;
  let log = '';
  const stdout = process.stdout.write.bind(process.stdout);
  const stderr = process.stderr.write.bind(process.stderr);
  t.mock.method(process.stdout, 'write', (chunk: string) => chunk.startsWith('suite ') ? true : stdout(chunk));
  t.mock.method(process.stderr, 'write', (chunk: string) => {
    if (!chunk.startsWith('stalled:') && !chunk.startsWith('suite stall')) return stderr(chunk);
    log += chunk; return true;
  });
  t.mock.method(cp, 'spawn', (bin: string) => {
    if (bin !== '/bin/sh') throw new Error('native inspection unavailable in fake');
    launched.resolve();
    return child;
  });
  syncBuiltinESMExports();
  t.after(async () => {
    try {
      if (result) {
        // Admission can still be awaiting limits when an early assertion fails.
        // Wait for launch or rejection before publishing the fake close receipt.
        await Promise.race([launched.promise, result.then(() => {}, () => {})]);
        child.emit('exit', 0, null);
        child.emit('close', 0, null);
        await result.then(() => {}, () => {}); // The body asserts intentional inspection rejection.
      }
    } finally {
      child.stdout.destroy(); child.stderr.destroy();
      t.mock.restoreAll(); syncBuiltinESMExports();
    }
  });
  const rows = [{ pid: 40001, parent: 1, group: 40001, started: 'birth', identity: 'root', state: 'S', command: '/bin/fake-command secret-argument' },
    { pid: 40002, parent: 40001, group: 40001, started: 'birth', identity: 'writer', state: 'S', command: '/bin/fake-writer secret-argument' }];
  const ended: number[] = [];
  result = suiteCommand('fake command', process.cwd(), {
    CLAND_SUITE_LIMITS_CWD: process.cwd(),
    CLAND_SUITE_LIMITS: JSON.stringify({ stallTimeoutMs: 1000 }),
  }, {
    processIdentityAsync: async () => 'root', processStartedAsync: async () => 'birth',
    systemProcesses: async () => {
      if (inspectionFails) throw new Error('fake native inspection failed');
      return exited ? rows.slice(1) : rows;
    },
    stdioWriters: async () => [rows[1]!],
    endProcess: async proof => {
      ended.push(proof.pid!);
      if (proof.pid === 40002) child.emit('close', exited ? 0 : null, exited ? null : 'SIGTERM');
      return true;
    },
  });
  void result.catch(() => {}); // Teardown joins and propagates a rejected command.
  await launched.promise;
  await Promise.resolve();
  const row = { id: 'done', file: 'finished.test.ts', name: 'finished file', at: 1, nesting: 0, type: 'file' };
  child.stdout.write(`suite start ${JSON.stringify(row)}\nsuite progress ${JSON.stringify({ ...row, event: 'start' })}\n`);
  child.stdout.write(`suite progress ${JSON.stringify({ ...row, event: 'finish', outcome: 'pass', seconds: 0.1 })}\n`);
  if (inspectionFails) child.stdout.write(`suite progress ${JSON.stringify({ ...row, id: 'unfinished', type: 'test', name: 'long unfinished test '.repeat(80), event: 'start' })}\n`);
  if (exited) child.emit('exit', 0, null);
  t.mock.timers.tick(1000);
  if (inspectionFails) {
    await assert.rejects(result, /fake native inspection failed/);
    assert.doesNotMatch(log, /suite stall processes /);
    const retained = suiteEvidence(log + 'later noise\n'.repeat(40));
    const state = retained.split('\n').find(line => line.startsWith('suite stall command '));
    assert.ok(state, 'pre-cleanup command receipt survives without a census or outcome cause');
    assert.deepEqual(JSON.parse(state.slice('suite stall command '.length)), {
      commandPid: 40001, exit: exited ? { code: 0, signal: null } : null, stdout: 'open', stderr: 'open',
    });
    assert.deepEqual(ended, [], 'inspection failure grants no cleanup authority');
    return;
  }
  const outcome = await result;
  assert.equal(outcome.code, 1);
  assert.match(outcome.cause, /stalled: no output for 0\.017 min/);
  assert.match(log, /last started tests: \(none reported\)/);
  assert.doesNotMatch(log, /finished\.test\.ts/);
  assert.match(log, exited ? /command exit 0; stdout open; stderr open/ : /command exit pending; stdout open; stderr open/);
  const snapshot = JSON.parse(log.split('\n').find(line => line.startsWith('suite stall processes '))!.slice('suite stall processes '.length));
  assert.deepEqual(snapshot.processes, exited ? [{ pid: 40002, name: 'fake-writer' }] : [{ pid: 40001, name: 'fake-command' }, { pid: 40002, name: 'fake-writer' }]);
  assert.deepEqual(ended, [40001, 40002]);
  assert.doesNotMatch(log, /secret-argument/);
});

test('non-npm command signal diagnostic uses stack-neutral wording', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
  t.mock.method(cp, 'spawn', (bin: string, args: string[]) => {
    // Process-table inspection is irrelevant to the signal diagnostic.
    if (bin === 'ps') throw new Error('no real process table in this fixture');
    assert.equal(bin, '/bin/sh');
    assert.deepEqual(args, ['-c', 'python -m pytest']);
    queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => {
    child.stdout.destroy(); child.stderr.destroy();
    t.mock.restoreAll(); syncBuiltinESMExports();
  });
  const outcome = await suiteCommand('python -m pytest', process.cwd(), {
    CLAND_SUITE_LIMITS_CWD: process.cwd(),
    CLAND_SUITE_LIMITS: JSON.stringify({ stallTimeoutMs: 1000 }),
  });
  // Older callers consume code/cause; additive inspection metadata is advisory.
  assert.deepEqual({ code: outcome.code, cause: outcome.cause }, { code: 1, cause: 'command terminated by SIGTERM' });
});

import { fixtureWork as ownFixtureWork } from './fixture-work.ts';
import { liveTickets } from '../src/suite-lock.ts';

for (const late of [false, true]) test(`native ticket census shares the total deadline (late evidence: ${late})`, async t => {
  await ownFixtureWork(t).run(async work => {
    const root = await work.root(() => mkdtemp(join(tmpdir(), 'cland-ticket-budget-')));
    const rows = [1, 2].map(pid => ({ pid, started: null, token: `waiter-${pid}`, queued: String(pid), birth: `native-${pid}` }));
    for (const row of rows) await work.step(() => writeFile(join(root, `${row.token}.json`), JSON.stringify(row)));
    let now = 4800;
    const calls: number[][] = [];
    const native = {
      alive: () => true, now: () => now,
      births: async (pids: number[], timeout: number) => {
        calls.push(pids);
        assert.equal(timeout, 200, 'one census consumes the remaining inspection budget');
        now = late ? 5001 : 4999;
        // Missing evidence is unknown, never a changed native generation.
        return new Map<number, string>();
      },
    };
    if (late) await assert.rejects(work.step(() => liveTickets(root, 5000, native)), /inspection deadline reached; ownership preserved/);
    else assert.deepEqual((await work.step(() => liveTickets(root, 5000, native))).map(row => row.token), rows.map(row => row.token));
    assert.deepEqual(calls, [[1, 2]], 'one joined native probe group for every waiting PID');
    for (const row of rows) assert.deepEqual(JSON.parse(await work.step(() => readFile(join(root, `${row.token}.json`), 'utf8'))), row);
  });
});
