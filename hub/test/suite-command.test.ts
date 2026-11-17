// T2: diagnostic wording uses a fake child; no real processes or wall-clock waits.
// T1 lint conservatively rejects the mocked child_process import (T-682).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import { suiteCommand } from '../src/suite-command.ts';
import { startupOwnerLine } from '../src/suite-startup-owner.ts';
for (const mode of ['infrastructure', 'hung', 'unrelated', 'other-reporter', 'duplicate', 'test', 'suite', 'empty', 'scaled', 'capped', 'legacy', 'closed', 'owner-finish', 'owner-exit', 'owner-active', 'invalid-owner', 'owner-reclaim-open-pipe'] as const)
test(`file startup watchdog handles ${mode} receipts`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const child = Object.assign(new EventEmitter(), { pid: 40001, stdout: new PassThrough(), stderr: new PassThrough() });
  const launched = Promise.withResolvers<void>();
  let stopped = false;
  let nativeExited = false;
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
    assert.equal(bin, '/bin/sh');
    launched.resolve();
    return child;
  });
  // The fake process never has host process authority, including on regression.
  t.mock.method(cp, 'execFile', () => { throw new Error('native probe forbidden'); });
  syncBuiltinESMExports();
  t.after(async () => {
    try {
      if (result) {
        await Promise.race([launched.promise, result.then(() => {}, () => {})]);
        child.emit('close', 0, null);
        await result;
      }
    } finally {
      child.stdout.destroy(); child.stderr.destroy();
      t.mock.restoreAll(); syncBuiltinESMExports();
    }
  });
  const row = { pid: 40001, parent: 1, group: 40001, started: 'birth', identity: 'root', state: 'S', command: '/bin/fake-command' };
  const writer = { ...row, pid: 40002, parent: 40001, identity: 'writer', command: '/bin/fake-inherited-writer' };
  const ended: number[] = [];
  const budget = mode === 'scaled' ? 60000 : mode === 'capped' ? 5000 : 30000;
  result = suiteCommand('fake command', '/scratch/t1841', {
    CLAND_SUITE_LIMITS_CWD: '/scratch/t1841',
    CLAND_SUITE_LIMITS: JSON.stringify({ stallTimeoutMs: mode === 'capped' ? 10000 : 600000 }),
    CLAND_TEST_LOAD_FACTOR: mode === 'scaled' ? '2' : '1',
  }, {
    processIdentityAsync: async () => 'root', processStartedAsync: async () => 'birth',
    systemProcesses: async () => mode === 'owner-reclaim-open-pipe' ? nativeExited ? [writer] : [row, writer] : [row],
    stdioWriters: async () => mode === 'owner-reclaim-open-pipe' ? [writer] : [],
    endProcess: async proof => {
      ended.push(proof.pid!);
      stopped = true;
      if (mode !== 'owner-reclaim-open-pipe' || proof.pid === writer.pid) child.emit('close', null, 'SIGTERM');
      return true;
    },
  });
  // Observe the launch receipt before injecting a file that never registers a test.
  await launched.promise;
  await Promise.resolve();
  if (mode === 'infrastructure') {
    const cause = 'suite infrastructure: suite ticket lost; remover unknown';
    child.stderr.write(cause + '\n');
    child.emit('exit', 75, null);
    child.emit('close', 75, null);
    assert.deepEqual(await result, { code: 75, cause });
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
});

import { suiteEvidence } from '../src/suite-log.ts';

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
  assert.deepEqual(outcome, { code: 1, cause: 'command terminated by SIGTERM' });
});

import { fixtureWork as ownFixtureWork } from './fixture-work.ts';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
