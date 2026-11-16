// T2: diagnostic wording uses a fake child; no real processes or wall-clock waits.
// T1 lint conservatively rejects the mocked child_process import (T-682).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import { suiteCommand } from '../src/suite-command.ts';
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
  if (inspectionFails) child.stdout.write(`suite progress ${JSON.stringify({ ...row, id: 'unfinished', name: 'long unfinished test '.repeat(80), event: 'start' })}\n`);
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
