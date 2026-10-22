// T1 unit: clock scheduling and the source boundary; no sockets or child processes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FakeClock } from './fake-clock.ts';
import { until } from './until.ts';
import { remoteWaits } from './remote-clock.ts';
import { scriptedMachine } from './fakes/digitalocean/scripted-machine.ts';
import type { DropletLease } from '../src/executor/droplet/lease.ts';
import type { RunRef } from '../src/executor/executor.ts';
import { realClock, resolveClock, type ClockOptions } from '../src/hub/clock.ts';

test('scripted native publications block peer clock drivers until their receipt completes', async t => {
  const key = { node: process.version, lock: 'lock', base: 'base' };
  for (const step of ['key', 'deliver', 'start', 'coverage', 'bundle'] as const) {
    const clock = new FakeClock(0);
    const advance = t.mock.method(clock, 'advance');
    const publication = Promise.withResolvers<void>();
    let held = false;
    const write = async () => { if (held) await publication.promise; };
    const owner = scriptedMachine('/unused', clock, key, {}, { writeFile: write, writeLease: write });
    const peer = scriptedMachine('/peer', clock, key);
    const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: step, run: step, name: step,
      tags: ['cland'], size: 'c-8', region: 'lon1', priceHourly: 0.25, keyName: 'key', state: 'active',
      resource: 1, keyId: 1, created: new Date(0).toISOString(), deadline: new Date(120000).toISOString() };
    const ref: RunRef = { id: step, cwd: '/unused', head: 'head', mode: 'auto', log: 'log', result: 'result', gate: 'gate' };
    await owner.dependencies.run.deliver(lease, ref);
    held = true;
    const operations = {
      key: () => owner.dependencies.host.createKey('/unused', 'key', {}),
      deliver: () => owner.dependencies.run.deliver(lease, ref),
      start: () => owner.dependencies.run.start(lease),
      coverage: () => owner.dependencies.run.collectCoverage(lease, '/unused/coverage'),
      bundle: () => owner.dependencies.prepareBundle('/unused', '/unused'),
    };
    const writer = operations[step]();
    const completion = peer.waits.run(Promise.all([writer, peer.waits.wait(60000)]));
    try {
      await owner.waits.run(Promise.resolve());
      assert.equal(advance.mock.callCount(), 0, `${step}: peer must join native publication before advancing`);
      assert.equal(clock.now().getTime(), 0);
    } finally { publication.resolve(); await writer; await completion; }
    assert.equal(clock.now().getTime(), 60000);
    assert.equal(clock.pending, 0);
  }
});

test('remote clock waits for concurrent native work before spending a lock retry deadline', async t => {
  const clock = new FakeClock(0), waits = remoteWaits(clock);
  const advance = t.mock.method(clock, 'advance');
  const publication = Promise.withResolvers<void>();
  const writer = waits.track(() => publication.promise);
  const contender = waits.track(() => waits.wait(60000));
  const completion = waits.run(Promise.all([writer, contender]));
  try {
    // Another caller can finish while publication is in flight. Neither driver
    // may consume the contender's entire deadline before the owner can release.
    await waits.run(Promise.resolve());
    assert.equal(advance.mock.callCount(), 0, 'no driver may start advancing over native publication');
    assert.equal(clock.now().getTime(), 0);
  } finally { publication.resolve(); await completion; }
  assert.equal(clock.now().getTime(), 60000);
  assert.equal(clock.pending, 0);
});

test('FakeClock runs nested timers in deadline order with microtasks between callbacks', async () => {
  const clock = new FakeClock(0);
  const seen: Array<[string, number]> = [];
  const record = (name: string) => { seen.push([name, clock.now().getTime()]); };
  const interval = clock.setInterval(() => record('interval'), 10);
  clock.setTimeout(() => {
    record('first');
    void Promise.resolve().then(() => {
      record('microtask');
      clock.setTimeout(() => record('nested'), 2);
    });
  }, 5);
  clock.setTimeout(() => record('second'), 5);
  const cancelled = clock.setTimeout(() => record('cancelled'), 7);
  clock.clearTimeout(cancelled);
  clock.setTimeout(() => clock.clearInterval(interval), 20);
  await clock.advance(30);
  assert.deepEqual(seen, [['first', 5], ['microtask', 5], ['second', 5], ['nested', 7], ['interval', 10]]);
  assert.equal(clock.now().getTime(), 30);
  assert.equal(clock.pending, 0);
});

test('clock boundaries reject mixed clocks and foreign timer handles', () => {
  const a = new FakeClock(), b = new FakeClock();
  const timer = a.setTimeout(() => {}, 1);
  assert.throws(() => b.clearTimeout(timer), /another clock/);
  assert.throws(() => realClock.clearTimeout(timer), /another clock/);
  a.clearTimeout(timer);
  a.clearTimeout(timer); // cancellation remains idempotent
  assert.throws(() => resolveClock({ clock: a, now: () => new Date(0) } as unknown as ClockOptions), /never both/);
  // @ts-expect-error a complete clock cannot be combined with a timestamp-only override
  const mixed: ClockOptions = { clock: a, now: () => new Date(0) };
  void mixed;
});

test('resolveClock requires a complete clock instead of a bare timestamp callback', () => {
  const clock = new FakeClock(0);
  assert.equal(resolveClock({}), realClock);
  assert.equal(resolveClock({ clock }), clock);
  // @ts-expect-error timestamp-only injection cannot define a hub clock
  const legacy: ClockOptions = { now: () => new Date(0) };
  void legacy;
  assert.throws(() => resolveClock({ now: () => new Date(0) } as unknown as ClockOptions), /complete Clock/);
});

test('realClock preserves cancellation with Node mocked timeout and interval timers', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const fired: string[] = [];
  const timeout = realClock.setTimeout(() => { fired.push('timeout'); }, 5);
  const interval = realClock.setInterval(() => { fired.push('interval'); }, 5);
  t.mock.timers.tick(5);
  assert.deepEqual(fired, ['timeout', 'interval']);
  realClock.clearTimeout(timeout);
  realClock.clearInterval(interval);
  t.mock.timers.tick(100);
  assert.deepEqual(fired, ['timeout', 'interval']);
});

test('FakeClock rejects invalid or overlapping advances without losing scheduled work', async () => {
  const clock = new FakeClock(0);
  await assert.rejects(clock.advance(-1), /non-negative/);
  let fired = false;
  clock.setTimeout(() => { fired = true; }, 1);
  const pending = clock.advance(1);
  await assert.rejects(clock.advance(1), /already in progress/);
  await pending;
  assert.equal(fired, true);
});

test('hub time owners call only their clock except documented real I/O timers', async () => {
  const modules: Record<string, { scope?: (s: string) => string; io?: string[] }> = {
    'hub/core': {}, 'hub/inbox': {}, 'hub/asks': {}, 'hub/hygiene': {}, 'hub/heartbeat': {},
    'hub/visibility': {}, 'hub/verification-wait': {}, 'hub/artifact-lifecycle': {}, 'hub/artifacts': {},
    'adapters/processes': {},
    'hub/server': { scope: s => s.slice(0, s.indexOf('export async function createWebSocketEdge')) }, // socket keepalive stays real
    'hub/daemon': { io: ['setTimeout(done, 10)'] }, // tracker fixture filesystem gate retry
    'adapters/sessions': {}, // native signal ordering/stop retries explicitly use realClock
  };
  for (const [file, { scope = (s: string) => s, io = [] }] of Object.entries(modules)) {
    let source = scope(await readFile(new URL(`../src/${file}.ts`, import.meta.url), 'utf8'));
    for (const allowed of io) {
      assert.equal(source.split(allowed).length - 1, 1, `${file}: keep the I/O allowance exact`);
      source = source.replace(allowed, 'IO_RETRY(');
    }
    assert.doesNotMatch(source, /(?<![\w.])(?:setTimeout|setInterval|clearTimeout|clearInterval)\s*\(|\bDate\s*\.\s*now\s*\(/, file);
  }
});

test('until names the unmet condition at one load-scaled deadline', async () => {
  const clock = new FakeClock(0);
  let finished = false;
  const waiting = until(() => false, { what: 'worker completion receipt', timeoutMs: 100, loadFactor: 3, clock });
  const failure = assert.rejects(waiting, /worker completion receipt: not within 300 ms/).then(() => { finished = true; });
  await clock.advance(299);
  assert.equal(finished, false);
  await clock.advance(1);
  await failure;
  assert.equal(clock.pending, 0);
});


test('until returns on its observation and cancels the deadline', async () => {
  const clock = new FakeClock(0);
  let ready = false;
  const waiting = until(() => ready, { what: 'ready receipt', clock });
  ready = true;
  await waiting;
  assert.equal(clock.pending, 0);
});

test('FakeClock blocking work delays due callbacks without moving time backwards', async () => {
  const clock = new FakeClock(0);
  const observed: number[] = [];
  const record = () => { observed.push(clock.now().getTime()); };
  clock.setTimeout(record, 5);
  clock.block(20);
  assert.deepEqual(observed, [], 'synchronous work cannot run timer callbacks');
  await clock.advance(0);
  assert.deepEqual(observed, [20]);
  assert.equal(clock.now().getTime(), 20);
  clock.setTimeout(() => clock.block(10), 5);
  clock.setTimeout(record, 10);
  clock.setTimeout(record, 16);
  await clock.advance(5);
  assert.deepEqual(observed, [20, 35], 'blocking drains the second elapsed deadline while a future timer stays pending');
  assert.equal(clock.pending, 1);
  assert.equal(clock.now().getTime(), 35, 'blocking inside a callback also preserves monotonic time');
  await clock.advance(1);
  assert.deepEqual(observed, [20, 35, 36]);
  assert.equal(clock.pending, 0);
  for (const ms of [-1, NaN, Infinity]) assert.throws(() => clock.block(ms), /finite non-negative/);
});

test('FakeClock delivers a blocked interval once at wakeup and schedules its next tick in the future', async () => {
  const clock = new FakeClock(0), ticks: number[] = [];
  clock.setInterval(() => ticks.push(clock.now().getTime()), 1000);
  clock.block(3000);
  await clock.advance(0);
  assert.deepEqual(ticks, [3000]);
  await clock.advance(1000);
  assert.deepEqual(ticks, [3000, 4000]);
});
