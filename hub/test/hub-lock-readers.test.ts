import fs from 'node:fs/promises';
import { Tracker } from '../src/tracker/tracker.ts';
import { createServer, type Socket } from 'node:net';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { until } from './until.ts';
import { FakeClock } from './fake-clock.ts';
// T2: persisted lock and CLI/doctor readers with sealed scratch files; no hub or browser launched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fixtureLockIdentity, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { layout } from '../src/project.ts';
import { readForeignHolder, liveHolder, liveHolderAsync, readLock, acquireLock, HubLocked } from '../src/hub/lock.ts';
import { runHub, startProjectHub } from '../src/cli/hub.ts';
import { checkProject } from '../src/doctor/project.ts';
import { migrateOffline } from '../src/tracker/offline-migrate.ts';
import { localHubInRows } from '../src/orphans.ts';

async function fixture(t: test.TestContext, age = 5000) {
  const root = await tempProject(t), l = layout(root);
  mkdirSync(l.tasks, { recursive: true });
  const local = fixtureLockIdentity(fixtureEnvironment(root, process.env));
  const holder = { pid: process.pid, started: null, token: 'foreign', hostIdentity: { ...local, hostname: 'other-host' }, heartbeat: new Date(Date.now() - age).toISOString() };
  const discovery = { root, pid: process.pid, socket: join(root, 'absent.sock'), port: 1, version: 'test', secret: 'synthetic' };
  writeFileSync(l.discovery, JSON.stringify(discovery));
  writeFileSync(l.lock, JSON.stringify(holder));

  let out = '', err = '';
  const io = { out: (s: string) => { out += s; }, err: (s: string) => { err += s; } };
  const previousEnv = process.env;
  const env = fixtureEnvironment(root, process.env, { CLAND_HUB_FILE: l.discovery });
  process.env = env;
  t.after(() => { process.env = previousEnv; });
  return { root, l, holder, local, io, output: () => out + err, env };
}

test('start refuses fresh foreign holder before spawning; stop retains both files without local signals', async t => {
  const f = await fixture(t);
  const lock = readFileSync(f.l.lock, 'utf8'), discovery = readFileSync(f.l.discovery, 'utf8');
  const spawn = t.mock.method(cp, 'spawn', () => { assert.fail('must not launch a second hub'); });
  syncBuiltinESMExports();
  t.after(() => { spawn.mock.restore(); syncBuiltinESMExports(); });
  const kill = t.mock.method(process, 'kill', () => { assert.fail('foreign PID must not be probed or signalled'); });
  assert.equal(await startProjectHub(f.root, f.io, { client: 'cli', parentPid: process.pid, cwd: f.root }, false, f.env), 1);
  assert.equal(await runHub(['stop'], f.root, f.io), 1);
  assert.match(f.output(), /other-host/);
  assert.match(f.output(), new RegExp(`pid ${process.pid}`));
  assert.match(f.output(), /heartbeat age \d+s/);
  assert.equal(spawn.mock.callCount(), 0);
  assert.equal(kill.mock.callCount(), 0);
  assert.equal(readFileSync(f.l.lock, 'utf8'), lock);
  assert.equal(readFileSync(f.l.discovery, 'utf8'), discovery);
});

for (const age of [5000, 65000]) test(`status and doctor describe foreign age ${age} without local probes`, async t => {
  const f = await fixture(t, age);
  const kill = t.mock.method(process, 'kill', () => { assert.fail('foreign PID must not reach local probes'); });
  assert.equal(await runHub(['status', '--json'], f.root, f.io), age < 60000 ? 0 : 1);
  const status = JSON.parse(f.output());
  assert.equal(status.hostname, 'other-host');
  assert.equal(status.startable, age > 60000);
  assert.ok(status.heartbeatAgeMs >= age);
  const checks = await checkProject(f.root, { started: async () => assert.fail('foreign PID must not reach ps'), territoryProblems: () => null }, f.env);
  const hub = checks.find(c => c.name === 'hub')!;
  assert.match(hub.detail, /other-host.*heartbeat age/);
  if (age > 60000) assert.match(hub.detail, /lapsed, startable/);
  assert.equal(kill.mock.callCount(), 0);
  assert.ok(existsSync(f.l.discovery));
});

test('foreign reader shares exact lapse boundary, unknown and future heartbeat rules with acquisition', async t => {
  const f = await fixture(t);
  const now = new Date();
  for (const [heartbeat, active] of [[new Date(now.getTime() - 60000).toISOString(), true], [new Date(now.getTime() - 60001).toISOString(), false], ['invalid', true], [new Date(now.getTime() + 1000).toISOString(), true]] as const) {
    writeFileSync(f.l.lock, JSON.stringify({ ...f.holder, heartbeat }));
    const options = { hostIdentity: f.local, now: () => now };
    assert.equal(readForeignHolder(f.l.lock, options)?.active, active);
    assert.equal(liveHolder(f.l.lock, options)?.token, active ? 'foreign' : undefined);
    assert.equal((await liveHolderAsync(f.l.lock, async () => assert.fail('no foreign ps'), options))?.token, active ? 'foreign' : undefined);
  }
});

test('orphan reader rejects foreign PID-table matches before looking at local rows; legacy remains local', async t => {
  const f = await fixture(t);
  let reads = 0;
  const rows = [{ get pid() { reads++; return process.pid; }, started: 'same-start' }];
  const holder = { ...f.holder, pid: process.pid + 1 };
  assert.equal(localHubInRows(holder, rows, f.local), false);
  assert.equal(reads, 0);
  assert.equal(localHubInRows({ pid: process.pid + 1, started: null }, [{ pid: process.pid + 1, started: 'x' }], f.local), true);
});

for (const age of [5000, 65000]) test(`offline migration handles foreign age ${age} without local signals`, async t => {
  const f = await fixture(t, age);
  const kill = t.mock.method(process, 'kill', (pid: number) => { assert.notEqual(pid, f.holder.pid); return false; });
  // A malformed config supplies a positive receipt of admission after stale-lock reclamation.
  writeFileSync(f.l.config, 'not valid toml [');
  if (age < 60000) {
    await assert.rejects(migrateOffline(f.root, true), /other-host.*heartbeat age/);
    assert.equal(readFileSync(f.l.lock, 'utf8'), JSON.stringify(f.holder));
    assert.equal(kill.mock.callCount(), 0);
  } else {
    await assert.rejects(migrateOffline(f.root, true), /TOML|parse|Unexpected|Invalid/i);
    assert.equal(existsSync(f.l.lock), false, 'migration acquired and released its replacement lock');
  }
});

test('start treats a lapsed foreign holder as eligible for the existing launch path', async t => {
  const f = await fixture(t, 65000);
  const spawn = t.mock.method(cp, 'spawn', () => { throw new Error('launch-admitted'); });
  syncBuiltinESMExports();
  t.after(() => { spawn.mock.restore(); syncBuiltinESMExports(); });
  const kill = t.mock.method(process, 'kill', () => assert.fail('no foreign PID probe'));
  await assert.rejects(startProjectHub(f.root, f.io, { client: 'cli', parentPid: process.pid, cwd: f.root }, false, f.env), /launch-admitted/);
  assert.equal(spawn.mock.callCount(), 1);
  assert.equal(kill.mock.callCount(), 0);
});

for (const age of [65000, null]) test(`stop preserves foreign holder with ${age === null ? 'unknown' : 'lapsed'} heartbeat`, async t => {
  const f = await fixture(t, age ?? 5000);
  if (age === null) writeFileSync(f.l.lock, JSON.stringify({ ...f.holder, heartbeat: 'unknown' }));
  const lock = readFileSync(f.l.lock, 'utf8'), discovery = readFileSync(f.l.discovery, 'utf8');
  const kill = t.mock.method(process, 'kill', () => assert.fail('no foreign local probe or signal'));
  assert.equal(await runHub(['stop'], f.root, f.io), 1);
  assert.match(f.output(), /other-host/);
  assert.equal(kill.mock.callCount(), 0);
  assert.equal(readFileSync(f.l.lock, 'utf8'), lock);
  assert.equal(readFileSync(f.l.discovery, 'utf8'), discovery);
});

test('a failed held stop preserves a foreign successor with the same numeric PID', async t => {
  const f = await fixture(t);
  const socketPath = fixtureSocketPath(f.root, 'held-stop.sock');
  let held: Socket | undefined;
  let entered = false;
  const server = createServer(socket => {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      for (const line of chunk.trim().split('\n')) {
        const frame = JSON.parse(line);
        if (frame.type === 'hello') socket.write(`${JSON.stringify({ type: 'welcome' })}\n`);
        if (frame.type === 'hub.stop') { held = socket; entered = true; }
      }
    });
  });
  t.after(async () => { held?.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); });
  await new Promise<void>(resolve => server.listen(socketPath, resolve));
  writeFileSync(f.l.discovery, JSON.stringify({ ...JSON.parse(readFileSync(f.l.discovery, 'utf8')), socket: socketPath }));
  writeFileSync(f.l.lock, JSON.stringify({ pid: process.pid, started: null }));
  const kill = t.mock.method(process, 'kill', (_pid: number, signal?: NodeJS.Signals | number) => { assert.equal(signal, 0, 'only initial local liveness is allowed'); return true; });
  const stopping = runHub(['stop'], f.root, f.io);
  try {
    await until(() => entered, { what: 'stop request reached held socket', timeoutMs: 3000 });
    writeFileSync(f.l.lock, JSON.stringify(f.holder));
    const successor = JSON.stringify({ ...JSON.parse(readFileSync(f.l.discovery, 'utf8')), version: 'successor' });
    writeFileSync(f.l.discovery, successor);
    const signalsBefore = kill.mock.callCount();
    held!.destroy();
    assert.equal(await stopping, 1);
    assert.equal(kill.mock.callCount(), signalsBefore, 'no local PID checks or signals after foreign takeover');
    assert.equal(readFileSync(f.l.discovery, 'utf8'), successor);
    assert.equal(readFileSync(f.l.lock, 'utf8'), JSON.stringify(f.holder));
  } finally { held?.destroy(); await stopping; }
});

for (const replace of [false, true]) test(`held offline migration ${replace ? 'fences a lost lock' : 'renews across several lapse periods and releases'}`, async t => {
  const f = await fixture(t, 65000);
  // Hold a real read after lock admission, before any publication.
  const clock = new FakeClock(new Date());
  const release = Promise.withResolvers<void>();
  let entered = false;
  const config = '[tracker]\nlevels = [["release", "category"], "epic"]\n';
  writeFileSync(f.l.config, config);
  const running = migrateOffline(f.root, true, undefined, undefined, { clock, readText: async path => {
    if (path === f.l.config) { entered = true; await release.promise; }
    return readFileSync(path, 'utf8');
  } });
  // Own rejection immediately; assertion below inspects its actual outcome.
  const result = running.then(value => ({ value, error: null }), error => ({ value: null, error }));
  try {
    await until(() => entered, { what: 'migration config read after admitted lock', timeoutMs: 3000 });
    for (let step = 0; step < 3; step++) {
      await clock.advance(70000);
      assert.equal(readLock(f.l.lock)?.heartbeat, clock.now().toISOString());
      assert.throws(() => acquireLock(f.l.lock, { alive: () => assert.fail('no foreign PID probe'), started: () => null }, { hostIdentity: f.holder.hostIdentity, now: () => clock.now() }), HubLocked);
    }
    if (replace) writeFileSync(f.l.lock, JSON.stringify({ ...f.holder, heartbeat: clock.now().toISOString() }));
    release.resolve();
    const done = await result;
    if (replace) {
      assert.match(String(done.error), /lost its hub lock/);
      assert.equal(readLock(f.l.lock)?.token, 'foreign');
    } else {
      assert.equal(done.error, null);
      assert.equal(existsSync(f.l.lock), false);
    }
    assert.equal(clock.pending, 0);
    await clock.advance(70000);
    assert.equal(existsSync(f.l.lock), replace, 'stopped renewal cannot recreate a released lock');
  } finally { release.resolve(); await result; }
});


test('migration rechecks ownership after held temporary write before publishing item bytes', async t => {
  const f = await fixture(t);
  const path = join(f.l.tasks, 'T-1-original.md');
  const original = '---\nid: T-1\nkind: task\ntitle: "Task: Original"\nstate: open\nlabels: []\nparent: null\nblocked_by: []\ncreated: 2026-11-02T00:00:00.000Z\nupdated: 2026-11-02T00:00:00.000Z\n---\nBody\n';
  writeFileSync(path, original);
  let entered = false, owned = true;
  const release = Promise.withResolvers<void>();
  const tracker = new Tracker({ root: f.root, db: f.l.db, env: f.env, git: async () => null, readBase: async () => null,
    files: { ...fs, writeFile: async (path, text) => { await fs.writeFile(path, text); entered = true; await release.promise; } } });
  const running = tracker.migrate({ id: 'human', name: 'human', human: true, role: null }, undefined, undefined, () => { if (!owned) throw new Error('lost migration ownership'); });
  const outcome = running.then(() => null, error => error);
  try {
    await until(() => entered, { what: 'migration temporary bytes written', timeoutMs: 3000 });
    owned = false;
    release.resolve();
    assert.match(String(await outcome), /lost migration ownership/);
    assert.equal(readFileSync(path, 'utf8'), original);
    assert.deepEqual(await fs.readdir(f.l.tasks), ['T-1-original.md'], 'temporary writer drained and no replacement published');
  } finally { release.resolve(); await outcome; await tracker.stop(); }
});
