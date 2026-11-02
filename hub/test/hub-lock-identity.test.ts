// Hub-lock acquisition and persisted whole-record ownership; no native process launches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { acquireLock, acquireLockAsync, HubLocked, readLock } from '../src/hub/lock.ts';
import { lockHostIdentity } from '../src/hub/lock-identity.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fixtureLockIdentity, tempProject } from './harness.ts';

const identity = { hostname: 'host-a', bootId: 'boot-a', pidNamespace: 'pid:[1]' };
const now = () => new Date('2026-11-02T05:00:00.000Z');
const processes = { alive: () => false, started: () => 'own-start' };
test('hub acquisition persists identity, heartbeat and the existing ownership fields whole', async t => {
  const path = join(await tempProject(t), '.cland', 'hub.lock');
  mkdirSync(join(path, '..'), { recursive: true });
  const lock = acquireLock(path, processes, { hostIdentity: identity, now });
  try {
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(stored.hostIdentity, identity);
    assert.equal(stored.heartbeat, '2026-11-02T05:00:00.000Z');
    assert.equal(stored.pid, process.pid);
    assert.equal(stored.started, 'own-start');
    assert.equal(typeof stored.token, 'string');
  } finally { lock.release(); }
});

const foreignPid = 999_999;
const noForeignProbes = {
  alive: (pid: number) => { assert.notEqual(pid, foreignPid, 'foreign pid must never reach kill(0)'); return false; },
  started: (pid: number) => { assert.notEqual(pid, foreignPid, 'foreign pid must never reach ps'); return 'own-start'; },
};
const options = { hostIdentity: identity, now };
const foreignIdentities = [
  { ...identity, hostname: 'host-b' },
  { ...identity, bootId: 'boot-b' },
  { ...identity, pidNamespace: 'pid:[2]' },
];
for (const hostIdentity of foreignIdentities) {
  test(`foreign ${JSON.stringify(hostIdentity)} refuses fresh and takes over lapsed without probing pid`, async t => {
    const path = join(await tempProject(t), 'hub.lock');
    const holder = { pid: foreignPid, started: 'foreign-start', token: 'foreign', hostIdentity, heartbeat: '2026-11-02T04:59:01.000Z' };
    writeFileSync(path, JSON.stringify(holder));
    assert.throws(() => acquireLock(path, noForeignProbes, options), HubLocked, 'fresh heartbeat stays held');
    assert.deepEqual(readLock(path), holder);
    writeFileSync(path, JSON.stringify({ ...holder, heartbeat: '2026-11-02T04:59:00.000Z' }));
    assert.throws(() => acquireLock(path, noForeignProbes, options), HubLocked, 'exactly 60 seconds stays held');
    writeFileSync(path, JSON.stringify({ ...holder, heartbeat: '2026-11-02T04:58:59.999Z' }));
    const lock = acquireLock(path, noForeignProbes, options);
    try { assert.deepEqual(readLock(path), lock.holder); assert.notEqual(lock.holder.token, holder.token); }
    finally { lock.release(); }
  });
}

test('foreign break guard cannot probe pid and permits recovery only after lapse', async t => {
  const path = join(await tempProject(t), 'hub.lock');
  const guard = `${path}.break`;
  mkdirSync(guard);
  const owner = join(guard, 'abcd.owner');
  writeFileSync(owner, JSON.stringify({ pid: foreignPid, started: null, token: 'foreign', hostIdentity: foreignIdentities[0], heartbeat: '2026-11-02T04:59:59.000Z' }));
  // Advance after the first guard recovery observation; assert its durable owner still exists before lapse.
  let reads = 0;
  const lock = acquireLock(path, noForeignProbes, { ...options, now: () => {
    reads++;
    if (reads === 4) assert.equal(existsSync(owner), true);
    return new Date(reads < 4 ? '2026-11-02T05:00:00.000Z' : '2026-11-02T05:01:01.000Z');
  } });
  try {
    assert.equal(reads >= 3, true);
    assert.equal(existsSync(owner), false);
    assert.equal(readLock(path)?.heartbeat, '2026-11-02T05:01:01.000Z', 'new ownership starts after guard recovery');
    assert.throws(() => acquireLock(path, noForeignProbes, {
      hostIdentity: foreignIdentities[0]!, now: () => new Date('2026-11-02T05:01:01.000Z'),
    }), HubLocked, 'a second foreign contender cannot immediately steal the new lock');
  }
  finally { lock.release(); }
});

for (const legacy of [{ pid: foreignPid }, { pid: foreignPid, started: 'old' }, { pid: foreignPid, started: 'old', startedUtc: 'utc' }, { pid: foreignPid, started: 'old', token: 'old' }, { pid: foreignPid, started: 'old', hostIdentity: identity, heartbeat: '2026-11-02T05:00:00.000Z' }]) {
  test(`same-host and legacy ${JSON.stringify(legacy)} retain death and reuse rules`, async t => {
    const path = join(await tempProject(t), 'hub.lock');
    writeFileSync(path, JSON.stringify(legacy));
    const live = { alive: () => true, started: () => null };
    assert.throws(() => acquireLock(path, live, options), HubLocked);
    if ('started' in legacy) {
      const reused = acquireLock(path, { alive: () => true, started: () => 'different' }, options);
      reused.release();
    }
    writeFileSync(path, JSON.stringify(legacy));
    const dead = acquireLock(path, processes, options);
    dead.release();
    assert.equal(existsSync(path), false);
  });
}

test('generic synchronous and asynchronous acquisitions keep their prior record shapes', async t => {
  for (const name of ['spend', 'territory', 'suite', 'termination']) {
    const path = join(await tempProject(t), `${name}.lock`);
    const sync = acquireLock(path, processes);
    try { assert.deepEqual(Object.keys(JSON.parse(readFileSync(path, 'utf8'))).sort(), ['pid', 'started', 'token']); }
    finally { sync.release(); }
    const asyncLock = await acquireLockAsync(path, undefined, undefined, 'UTC', processes);
    try { assert.deepEqual(Object.keys(JSON.parse(readFileSync(path, 'utf8'))).sort(), ['pid', 'started', 'startedUtc', 'token']); }
    finally { await asyncLock.release(); }
  }
});

test('identity reads the shared Linux boot id and namespace, and the Darwin boot-session UUID', () => {
  const calls: string[] = [];
  const readers = {
    hostname: () => 'machine', linuxBoot: () => { calls.push('linux'); return ' boot-linux\n'; },
    sysctl: (key: string) => { calls.push(key); return ' boot-darwin\n'; },
    pidNamespace: () => { calls.push('namespace'); return 'pid:[42]'; },
  };
  assert.deepEqual(lockHostIdentity('linux', readers), { hostname: 'machine', bootId: 'boot-linux', pidNamespace: 'pid:[42]' });
  assert.deepEqual(calls, ['linux', 'namespace']);
  calls.length = 0;
  assert.deepEqual(lockHostIdentity('darwin', readers), { hostname: 'machine', bootId: 'boot-darwin', pidNamespace: null });
  assert.deepEqual(calls, ['kern.bootsessionuuid']);
  assert.throws(() => lockHostIdentity('linux', { ...readers, linuxBoot: () => { throw new Error('unavailable'); } }), /unavailable/);
});

for (const malformed of [
  { hostIdentity: { hostname: 'foreign', bootId: 'boot' } },
  { hostIdentity: null }, { hostIdentity: 'foreign' },
  { hostIdentity: { ...identity, hostname: '' } },
  { hostIdentity: { ...identity, bootId: 7 } },
  { hostIdentity: { ...identity, pidNamespace: false } },
  { heartbeat: '2026-11-02T04:00:00.000Z' },
]) for (const kind of ['main', 'guard']) {
  test(`malformed identity ${JSON.stringify(malformed)} in ${kind} refuses without PID probes or removal`, async t => {
    const path = join(await tempProject(t), 'hub.lock');
    const file = kind === 'main' ? path : join(`${path}.break`, 'abcd.owner');
    if (kind === 'guard') mkdirSync(`${path}.break`);
    const bytes = JSON.stringify({ pid: foreignPid, started: 'foreign-start', token: 'foreign', ...malformed });
    writeFileSync(file, bytes);
    assert.throws(() => acquireLock(path, noForeignProbes, options), /invalid host identity/);
    assert.equal(readFileSync(file, 'utf8'), bytes);
    assert.throws(() => readLock(file), /invalid host identity/);
  });
}


test('native-to-embedded fixture handoff reclaims a dead same-host holder and preserves foreign refusal', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland', 'hub.lock');
  mkdirSync(join(path, '..'), { recursive: true });
  const clock = new FakeClock();
  const nativeIdentity = fixtureLockIdentity(fixtureEnvironment(root, process.env));
  const prior = { pid: foreignPid, started: 'native-start', token: 'native-lock', hostIdentity: nativeIdentity, heartbeat: clock.now().toISOString() };
  writeFileSync(path, JSON.stringify(prior));
  const probes: number[] = [];
  const deadProcesses = { alive: (pid: number) => { probes.push(pid); return false; }, started: () => null };
  const foreignOwner = pacingOwner(t, { lockIdentity: { hostname: 'explicit-foreign-fixture', bootId: 'foreign', pidNamespace: null } });
  await assert.rejects(foreignOwner.start(root, {}, clock, { hubOptions: { processes: deadProcesses } }), /a hub already runs/);
  assert.deepEqual(probes, [], 'a different identity never probes the numeric PID');
  assert.deepEqual(readLock(path), prior, 'foreign refusal preserves the held record');
  const nativeOwner = pacingOwner(t);
  const hub = await nativeOwner.start(root, {}, clock, { hubOptions: { processes: deadProcesses } });
  try {
    const installed = readLock(path);
    assert.equal(installed?.pid, process.pid, 'reopened fixture has a durable ownership record');
    assert.deepEqual(installed?.hostIdentity, nativeIdentity);
    assert.notEqual(installed?.token, prior.token);
    assert.deepEqual(probes, [foreignPid], 'same-host native handoff reclaims the positively dead holder');
  } finally { await hub.stop(); await nativeOwner.dispose(); }
  assert.equal(existsSync(path), false);
});
