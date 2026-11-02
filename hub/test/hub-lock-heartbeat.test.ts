// T2: embedded hub lifetime and persisted lock receipts; fake hub clock, no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { writeFileSync, readFileSync, openSync, readSync, closeSync, existsSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { until } from './until.ts';
import { join } from 'node:path';
import { projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { acquireLock, HubLocked, readLock } from '../src/hub/lock.ts';

test('serving hub replaces whole heartbeat each interval and fences foreign contenders across lapses', { timeout: 15000 }, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const hub = await projectHub(t, root, {}, { clock });
  const path = join(root, '.cland/hub.lock');
  const original = readLock(path)!;
  const oldFile = openSync(path, 'r');
  const nativeRename = fs.renameSync;
  let replacements = 0;
  const rename = t.mock.method(fs, 'renameSync', (...args: Parameters<typeof fs.renameSync>) => {
    if (String(args[1]) === path) {
      assert.ok(existsSync(`${path}.break`), 'replacement holds break guard');
      assert.equal(JSON.parse(readFileSync(args[0], 'utf8')).token, original.token);
      assert.equal(readLock(path)!.token, original.token, 'prior complete record stays published until rename');
      replacements++;
    }
    return nativeRename(...args);
  });
  syncBuiltinESMExports();
  try {
    await clock.advance(10000);
    assert.equal(readLock(path)!.heartbeat, clock.now().toISOString());
    const bytes = Buffer.alloc(4096);
    const count = readSync(oldFile, bytes);
    assert.equal(JSON.parse(bytes.subarray(0, count).toString()).heartbeat, original.heartbeat, 'old descriptor retains complete prior file after replacement');
    for (let beat = 0; beat < 20; beat++) {
      await clock.advance(10000);
      const current = readLock(path)!;
      assert.equal(current.heartbeat, clock.now().toISOString());
      assert.equal(current.token, original.token);
      assert.throws(() => acquireLock(path, { alive: () => { throw new Error('foreign PID probe'); }, started: () => 'fixture' }, {
        hostIdentity: { hostname: 'other', bootId: 'other', pidNamespace: null }, now: () => clock.now(),
      }), HubLocked);
    }
    assert.equal(replacements, 21);
  } finally { rename.mock.restore(); syncBuiltinESMExports(); closeSync(oldFile); await hub.stop(); }
  assert.equal(existsSync(path), false);
  await clock.advance(120000);
  assert.equal(existsSync(path), false, 'stopped heartbeat cannot recreate lock');
});


test('replacement token logs lost lock and joins normal shutdown without removing successor', { timeout: 15000 }, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const path = join(root, '.cland/hub.lock');
  const successor = { ...readLock(path)!, token: 'successor-token' };
  writeFileSync(path, JSON.stringify(successor));
  const stopped = hub.stopped;
  await clock.advance(10000);
  await until(() => logs.some(entry => entry.event === 'stopped'), { what: 'normal shutdown completion' });
  await stopped;
  assert.ok(logs.some(entry => entry.event === 'hub-lock-lost'));
  assert.ok(logs.some(entry => entry.event === 'stopping'));
  assert.deepEqual(readLock(path), successor);
  await clock.advance(120000);
  assert.deepEqual(readLock(path), successor);
});

test('heartbeat write failure logs and retries next beat without stopping', { timeout: 15000 }, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const path = join(root, '.cland/hub.lock');
  const original = readFileSync(path, 'utf8');
  const nativeWrite = fs.writeFileSync;
  const fault = t.mock.method(fs, 'writeFileSync', (...args: Parameters<typeof fs.writeFileSync>) => {
    if (String(args[0]).startsWith(`${path}.`) && String(args[0]).endsWith('.tmp')) throw new Error('controlled heartbeat write failure');
    return nativeWrite(...args);
  });
  syncBuiltinESMExports();
  try {
    await clock.advance(10000);
    assert.ok(logs.some(entry => entry.event === 'hub-lock-heartbeat-failed' && String(entry.error).includes('controlled heartbeat write failure')));
    assert.equal(readFileSync(path, 'utf8'), original);
    assert.equal(logs.some(entry => entry.event === 'stopping'), false);
  } finally { fault.mock.restore(); syncBuiltinESMExports(); }
  await clock.advance(10000);
  assert.equal(readLock(path)!.heartbeat, clock.now().toISOString());
  assert.equal(logs.some(entry => entry.event === 'stopping'), false);
  await hub.stop();
  assert.equal(existsSync(path), false);
});

test('unreadable ownership is not positive replacement proof', { timeout: 15000 }, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { clock, log: entry => logs.push(entry) });
  const path = join(root, '.cland/hub.lock');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, '{incomplete');
  await clock.advance(10000);
  assert.ok(logs.some(entry => entry.event === 'hub-lock-heartbeat-failed'));
  assert.equal(logs.some(entry => entry.event === 'hub-lock-lost' || entry.event === 'stopping'), false);
  assert.equal(readFileSync(path, 'utf8'), '{incomplete');
  writeFileSync(path, original);
  await clock.advance(10000);
  assert.equal(readLock(path)!.heartbeat, clock.now().toISOString());
  await hub.stop();
  assert.equal(existsSync(path), false);
});
