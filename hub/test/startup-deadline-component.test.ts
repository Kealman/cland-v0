// T2: CLI start's deadline path with a fake spawned child and a fake clock.
// No daemon is launched: killing/reaping a real process is covered by startup-smoke.
import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess, { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { appendFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { setImmediate as yieldIO } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { runHub } from '../src/cli/hub.ts';
import { tempProject } from './harness.ts';
import { markHubStop } from '../src/hub/startup.ts';

test('hub start names this attempt\'s pending step before killing a child at its deadline', async t => {
  const root = await tempProject(t);
  const log = join(root, '.cland/log/hub.log');
  await mkdir(join(root, '.cland/log'), { recursive: true });
  await writeFile(log, JSON.stringify({ event: 'tracker-storage-stalled', operation: 'old attempt', item: 'T-99' }) + '\n');
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const spawned = Promise.withResolvers<void>();
  let killed = false;
  const child = Object.assign(new EventEmitter(), { pid: 99999999, unref() {}, kill(signal: string) { assert.equal(signal, 'SIGKILL'); killed = true; return true; } });
  t.mock.method(childProcess, 'spawn', () => {
    appendFileSync(log, JSON.stringify({ event: 'hub-startup-step', step: 'indexing tracker' }) + '\n' + JSON.stringify({ event: 'hub-startup-storage', suiteJobsBytes: 226304 }) + '\n');
    spawned.resolve();
    return child as unknown as ChildProcess;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  let stderr = '';
  const starting = runHub(['start'], root, { out: () => assert.fail('unexpected success'), err: line => {
    assert.equal(killed, false, 'the diagnostic is emitted before SIGKILL'); stderr += line;
  } });
  await spawned.promise;
  t.mock.timers.tick(15_001);
  assert.equal(await starting, 1);
  assert.equal(killed, true);
  assert.match(stderr, /after 15 s without startup log progress/);
  assert.match(stderr, /last startup step: indexing tracker/);
  assert.match(stderr, /suite-jobs: 226304 bytes/);
  assert.doesNotMatch(stderr, /old attempt|T-99/);
});


test('hub start preserves a child logging startup progress past 15 seconds until it serves', async t => {
  const root = await tempProject(t);
  const log = join(root, '.cland/log/hub.log');
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const spawned = Promise.withResolvers<void>();
  let killed = false;
  const child = Object.assign(new EventEmitter(), { pid: 99999999, unref() {}, kill() { killed = true; return true; } });
  t.mock.method(childProcess, 'spawn', () => { spawned.resolve(); return child as unknown as ChildProcess; });
  // The fake hub's authenticated welcome is the CLI's serving observation.
  t.mock.method(net, 'createConnection', () => {
    const socket = Object.assign(new EventEmitter(), {
      setEncoding() {}, destroy() {},
      write() { queueMicrotask(() => socket.emit('data', '{"type":"welcome"}\n')); },
    });
    queueMicrotask(() => socket.emit('connect'));
    return socket;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  let stdout = '', stderr = '';
  const starting = runHub(['start'], root, { out: line => { stdout += line; }, err: line => { stderr += line; } });
  await spawned.promise;
  // Opening storage, listening and session restoration all count as progress.
  for (const step of ['opening storage', 'listening', 'restoring sessions', 'restoring sessions', 'ready']) {
    t.mock.timers.tick(4000);
    appendFileSync(log, JSON.stringify({ event: 'hub-startup-step', step }) + '\n');
    await yieldIO();
    assert.equal(killed, false, `progress at ${step} must keep the child alive`);
  }
  writeFileSync(join(root, '.cland/hub.json'), JSON.stringify({ pid: child.pid, socket: 'fake.sock', secret: 'fixture', port: 1, version: '0.0.0' }));
  t.mock.timers.tick(50);
  await yieldIO();
  assert.equal(await starting, 0, stderr);
  assert.equal(killed, false);
  assert.match(stdout, /hub started for/);
});


test('hub start stops a child only after a full inactivity deadline following its last progress', async t => {
  const root = await tempProject(t);
  const log = join(root, '.cland/log/hub.log');
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const spawned = Promise.withResolvers<void>();
  let killed = false;
  const child = Object.assign(new EventEmitter(), { pid: 99999999, unref() {}, kill() { killed = true; return true; } });
  t.mock.method(childProcess, 'spawn', () => { spawned.resolve(); return child as unknown as ChildProcess; });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  let stderr = '';
  const starting = runHub(['start'], root, { out: () => assert.fail('unexpected success'), err: line => { stderr += line; } });
  await spawned.promise;
  t.mock.timers.tick(10_000);
  appendFileSync(log, '{"event":"hub-startup-step","step":"restoring sessions"}\n');
  await yieldIO();
  t.mock.timers.tick(14_000);
  await yieldIO();
  assert.equal(killed, false, 'progress renews the full 15 s allowance');
  t.mock.timers.tick(1000);
  await yieldIO();
  assert.equal(await starting, 1);
  assert.equal(killed, true, 'logging then stalling cannot wait forever');
  assert.match(stderr, /after 15 s without startup log progress/);
  assert.match(stderr, /last startup step: restoring sessions/);
});

test('CLI autostart honors the operator window at the incident retry while explicit start bypasses it', async t => {
  const root = await tempProject(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  markHubStop(root);
  t.mock.timers.tick(12_000);
  const spawned = Promise.withResolvers<void>();
  const child = Object.assign(new EventEmitter(), { pid: 99999999, unref() {}, kill() { assert.fail('exited child must not be killed'); } });
  const spawn = t.mock.method(childProcess, 'spawn', () => {
    queueMicrotask(() => child.emit('exit', 1));
    spawned.resolve();
    return child as unknown as ChildProcess;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  let stdout = '';
  const io = { out: (line: string) => { stdout += line; }, err: () => {} };
  assert.equal(await runHub(['start', '--autostart', '--client', 'nvim'], root, io), 0);
  assert.equal(spawn.mock.callCount(), 0);
  assert.match(stdout, /autostart deferred/);
  const explicit = runHub(['start'], root, io);
  await spawned.promise;
  t.mock.timers.tick(50);
  await yieldIO();
  assert.equal(await explicit, 1, 'explicit start reaches the fake child, which exits with code 1');
  assert.equal(spawn.mock.callCount(), 1);
});
