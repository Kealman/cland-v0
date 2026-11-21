// T1: deadline policy and fake-time waits; no sockets or native children.
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { waitTimeoutMs, testSetupWaitMs, testDeadlineMs, suiteLoadFactor, until, eventually } from './until.ts';
import { FakeClock } from './fake-clock.ts';
import { browserWaitDefaults } from './browser-wait-defaults.ts';
import { runnerTestTimeoutArgument } from '../src/suite-wait-budget.ts';
import { EventEmitter } from 'node:events';
import { suiteLimits, suiteLimitsFromSource } from '../src/suite-limits.ts';
import { fileStartupTimeoutMs } from '../src/file-startup-watchdog.ts';

let savedExecutor: string | undefined;
beforeEach(() => {
 savedExecutor = process.env.CLAND_SUITE_EXECUTOR;
 delete process.env.CLAND_SUITE_EXECUTOR;
});

test('startup defaults sample supplied runner environment and current load per admission', t => {
 t.mock.method(os, 'availableParallelism', () => 10);
 let load = 0;
 t.mock.method(os, 'loadavg', () => [load, load, load]);
 const env: NodeJS.ProcessEnv = { CLAND_SUITE_EXECUTOR: 'droplet' };
 assert.equal(fileStartupTimeoutMs(600000, undefined, env), 60000);
 delete env.CLAND_SUITE_EXECUTOR;
 load = 10;
 assert.equal(fileStartupTimeoutMs(600000, undefined, env), 60000);
 load = 20;
 assert.equal(fileStartupTimeoutMs(600000, undefined, env), 90000);
 env.CLAND_TEST_LOAD_FACTOR = '4';
 assert.equal(fileStartupTimeoutMs(600000, undefined, env), 120000);
 assert.equal(fileStartupTimeoutMs(100000, undefined, env), 50000, 'no-output cap remains exact');
 assert.equal(fileStartupTimeoutMs(600000, 1, env), 30000, 'explicit controlled factor remains exact');
});

test('startup policy refuses a converted missing or invalid explicit factor', () => {
 const env: NodeJS.ProcessEnv = {};
 assert.throws(() => fileStartupTimeoutMs(600000, Number(env.CLAND_TEST_LOAD_FACTOR)), /load factor must be finite and at least 1/);
 for (const factor of [NaN, Infinity, 0, -1]) assert.throws(() => fileStartupTimeoutMs(600000, factor), /load factor must be finite and at least 1/);
});
afterEach(() => {
 if (savedExecutor === undefined) delete process.env.CLAND_SUITE_EXECUTOR;
 else process.env.CLAND_SUITE_EXECUTOR = savedExecutor;
});

test('explicit configured and legacy admitted Node timeouts stay exact under load', async () => {
 const saved = process.env.CLAND_TEST_LOAD_FACTOR;
 process.env.CLAND_TEST_LOAD_FACTOR = '3';
 try {
  const explicit = suiteLimitsFromSource('[verification]\ntest_timeout="1s"', 'fixture');
  assert.equal(runnerTestTimeoutArgument(explicit.testTimeoutMs, explicit.testTimeoutIsDefault === true), '--test-timeout=1000');
  const equalToDefault = suiteLimitsFromSource('verification.test_timeout="120s"', 'fixture');
  assert.equal(runnerTestTimeoutArgument(equalToDefault.testTimeoutMs, equalToDefault.testTimeoutIsDefault === true), '--test-timeout=120000');
  const absent = suiteLimitsFromSource('[verification]\nworkers=2', 'fixture');
  assert.equal(runnerTestTimeoutArgument(absent.testTimeoutMs, absent.testTimeoutIsDefault === true), '--test-timeout=360000');
  const legacy = { testTimeoutMs: 1000, stallTimeoutMs: 600000, workers: 1, loadGateWorkers: 2 };
  const admitted = await suiteLimits('/scratch/legacy', 'local', { CLAND_SUITE_LIMITS_CWD: '/scratch/legacy', CLAND_SUITE_LIMITS: JSON.stringify(legacy) });
  assert.deepEqual(admitted, legacy, 'previous cached shape remains readable');
  assert.equal(runnerTestTimeoutArgument(admitted.testTimeoutMs, admitted.testTimeoutIsDefault === true), '--test-timeout=1000');
 } finally {
  if (saved === undefined) delete process.env.CLAND_TEST_LOAD_FACTOR;
  else process.env.CLAND_TEST_LOAD_FACTOR = saved;
 }
});

for (const baseMs of [2000, 30000]) test(`condition receipt survives its former ${baseMs} ms bound under injected load`, async t => {
 const saved = process.env.CLAND_TEST_LOAD_FACTOR;
 delete process.env.CLAND_TEST_LOAD_FACTOR;
 t.mock.method(os, 'availableParallelism', () => 10);
 t.mock.method(os, 'loadavg', () => [10, 10, 10]);
 t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
 let receipt = false;
 const work = eventually('durable setup receipt', () => receipt ? 'committed' : undefined, { timeoutMs: baseMs });
 void work.catch(() => {});
 try {
  await Promise.resolve();
  receipt = true;
  t.mock.timers.tick(baseMs + 1);
  assert.equal(await work, 'committed');
 } finally {
  t.mock.timers.reset();
  if (saved === undefined) delete process.env.CLAND_TEST_LOAD_FACTOR;
  else process.env.CLAND_TEST_LOAD_FACTOR = saved;
 }
});

test('browser navigation listeners and predicates retain native Frame identity', async t => {
 const locator = { locator() { return this; } };
 const frame = { locator: () => locator, page: (): object => rawPage };
 const rawPage = Object.assign(new EventEmitter(), {
  locator: () => locator,
  mainFrame: () => frame,
  frames: () => [frame],
  context: (): { pages: () => object[] } => ({ pages: () => [rawPage] }),
  waitForEvent(event: string, options: { predicate: (value: typeof frame) => boolean }): Promise<typeof frame> {
   return new Promise((resolve, reject) => rawPage.once(event, value => {
    if (options.predicate(value)) resolve(value);
    else reject(new Error('native Frame predicate mismatch'));
   }));
  },
 });
 const page = browserWaitDefaults(rawPage, { setDefaultTimeout() {} });
 let documents = 0, predicateFrame: object | undefined;
 const listener = (value: typeof frame) => { if (value === page.mainFrame()) documents++; };
 page.on('framenavigated', listener);
 const reloaded = page.waitForEvent('framenavigated', { predicate(value) {
  predicateFrame = value;
  return value === page.mainFrame();
 } });
 const observed = reloaded.then(value => ({ value, error: undefined }), error => ({ value: undefined, error: String(error) }));
 rawPage.emit('framenavigated', frame);
 const receipt = await observed;
 assert.equal(documents, 1, 'one raw native navigation reaches the unchanged equality guard');
 assert.equal(receipt.error, undefined);
 assert.equal(receipt.value, page.mainFrame());
 assert.equal(predicateFrame, page.mainFrame());
 assert.equal(page, rawPage);
 assert.equal(page.mainFrame().page(), page);
 assert.equal(page.frames()[0], frame);
 assert.equal(page.context().pages()[0], page);
 assert.equal(page.locator(), locator);
 assert.ok(page.listeners('framenavigated').includes(listener), 'native listener identity remains available');
 page.off('framenavigated', listener);
 assert.ok(!page.listeners('framenavigated').includes(listener));
 t.diagnostic(`T1 identity receipt ${JSON.stringify({ documents, predicateMatches: predicateFrame === page.mainFrame(), pageMatches: page === rawPage })}`);
});

test('new native frames and popups keep identity and sample defaults on later actions', async t => {
 const saved = process.env.CLAND_TEST_LOAD_FACTOR;
 delete process.env.CLAND_TEST_LOAD_FACTOR;
 let load = 0, timeout = 0;
 t.mock.method(os, 'availableParallelism', () => 10);
 t.mock.method(os, 'loadavg', () => [load, load, load]);
 const locator = { locator() { return this; }, waitFor() { return timeout; } };
 const frame = { locator: () => locator };
 const popup = Object.assign(new EventEmitter(), { locator: () => locator, mainFrame: () => frame, frames: () => [frame] });
 const raw = Object.assign(new EventEmitter(), {
  locator: () => locator, mainFrame: () => frame, frames: () => [frame],
  nextPopup: async () => popup,
 });
 const page = browserWaitDefaults(raw, { setDefaultTimeout(ms) { timeout = ms; } });
 let observedPopup: object | undefined, observedFrame: object | undefined;
 page.on('popup', value => { observedPopup = value; });
 popup.on('frameattached', value => { observedFrame = value; });
 try {
  raw.emit('popup', popup);
  assert.equal(observedPopup, popup);
  assert.equal(await page.nextPopup(), popup);
  load = 10;
  assert.equal(popup.locator().waitFor(), 6000);
  const attachedLocator = { locator() { return this; }, waitFor() { return timeout; } };
  const attached = { locator: () => attachedLocator };
  popup.emit('frameattached', attached);
  assert.equal(observedFrame, attached);
  load = 20;
  assert.equal(attached.locator().waitFor(), 9000);
  assert.equal(attached.locator(), attachedLocator);
 } finally {
  if (saved === undefined) delete process.env.CLAND_TEST_LOAD_FACTOR;
  else process.env.CLAND_TEST_LOAD_FACTOR = saved;
 }
});

test('browser defaults refresh for a retained locator at each operation', async t => {
 const saved = process.env.CLAND_TEST_LOAD_FACTOR;
 delete process.env.CLAND_TEST_LOAD_FACTOR;
 let load = 0, timeout = 0;
 t.mock.method(os, 'availableParallelism', () => 10);
 t.mock.method(os, 'loadavg', () => [load, load, load]);
 const locator = { locator() { return this; }, async all() { return [this]; }, waitFor(options?: { timeout: number }) { return options?.timeout ?? timeout; } };
 const page = browserWaitDefaults({ locator: () => locator }, { setDefaultTimeout(ms) { timeout = ms; } });
 try {
  const retained = page.locator();
  assert.equal(retained.waitFor(), 3000);
  load = 10;
  assert.equal(retained.waitFor(), 6000);
  assert.equal(retained.waitFor({ timeout: 100 }), 100);
  assert.equal(retained.locator(), retained);
  const [fromAll] = await retained.all();
  assert.equal(fromAll, retained);
  load = 20;
  assert.equal(fromAll!.waitFor(), 9000, 'async locator collections retain per-operation sampling');
 } finally {
  if (saved === undefined) delete process.env.CLAND_TEST_LOAD_FACTOR;
  else process.env.CLAND_TEST_LOAD_FACTOR = saved;
 }
});

test('each setup deadline samples current load even below CPU saturation', t => {
 const saved = process.env.CLAND_TEST_LOAD_FACTOR;
 delete process.env.CLAND_TEST_LOAD_FACTOR;
 t.mock.method(os, 'availableParallelism', () => 10);
 let load = 0;
 t.mock.method(os, 'loadavg', () => [load, load, load]);
 try {
  assert.equal(waitTimeoutMs(2000), 2000);
  load = 6;
  assert.equal(waitTimeoutMs(2000), 3200);
  load = 10;
  assert.equal(waitTimeoutMs(30000), 60000);
  assert.equal(waitTimeoutMs(3000), 6000);
  assert.equal(waitTimeoutMs(5000), 10000);
  assert.equal(runnerTestTimeoutArgument(5000), '--test-timeout=10000');
  assert.equal(testDeadlineMs(2000), 4000);
  assert.equal(testDeadlineMs(2000, new FakeClock()), 2000);
  assert.equal(testDeadlineMs(2000, undefined, 2500), 2500);
  assert.equal(waitTimeoutMs(2000, 1), 2000, 'behaviour bounds stay exact');
 } finally {
  if (saved === undefined) delete process.env.CLAND_TEST_LOAD_FACTOR;
  else process.env.CLAND_TEST_LOAD_FACTOR = saved;
 }
});

test('eventually keeps its observation cadence and returns a falsy receipt', async () => {
 const clock = new FakeClock(0);
 const observed: number[] = [];
 const work = eventually('persisted zero count', () => {
  observed.push(clock.now().getTime());
  return clock.now().getTime() >= 75 ? 0 : undefined;
 }, { timeoutMs: 200, clock });
 await clock.advance(100);
 assert.equal(await work, 0);
 assert.deepEqual(observed, [0, 50, 100]);
 assert.equal(clock.pending, 0);
});

test('eventually rejects a late async value even before the timer callback runs', async () => {
 const clock = new FakeClock(0);
 const work = eventually('late receipt', async () => { clock.block(101); return 7; },
  { timeoutMs: 100, clock, behaviour: 'receipt latency' });
 await assert.rejects(work, /late receipt: not within 100 ms/);
 assert.equal(clock.pending, 0);
});

test('eventually expires while an async observation is held and ignores its late value', async () => {
 const clock = new FakeClock(0);
 const gate = Promise.withResolvers<number | undefined>();
 let observations = 0;
 let outcome: unknown;
 const work = eventually('held receipt', () => { observations++; return gate.promise; },
  { timeoutMs: 100, clock, behaviour: 'receipt latency' });
 const settled = work.then(value => { outcome = { value, at: clock.now().getTime() }; },
  error => { outcome = { error: String(error), at: clock.now().getTime() }; });
 try {
  await clock.advance(100);
  assert.deepEqual(outcome, { error: 'Error: held receipt: not within 100 ms', at: 100 });
  gate.resolve(7);
  await settled;
  await clock.advance(100);
  assert.deepEqual(outcome, { error: 'Error: held receipt: not within 100 ms', at: 100 });
  assert.equal(observations, 1);
  assert.equal(clock.pending, 0);
 } finally { gate.resolve(7); await settled; }
});

test('setup waits scale while named behaviour deadlines remain exact', async t => {
 const saved = process.env.CLAND_TEST_LOAD_FACTOR;
 process.env.CLAND_TEST_LOAD_FACTOR = '3';
 t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
 try {
  for (const api of ['until', 'eventually'] as const) {
   for (const behaviour of [undefined, 'reply latency']) {
    const options = { timeoutMs: 100, ...(behaviour ? { behaviour } : {}) };
    const expected = behaviour ? 100 : 300;
    const work = api === 'until'
     ? until(() => false, { what: 'completion receipt', ...options })
     : eventually('completion receipt', () => undefined, options);
    const outcome = work.then(() => 'unexpected success', error => String(error));
    await Promise.resolve();
    t.mock.timers.tick(expected);
    assert.match(await outcome, new RegExp(`completion receipt: not within ${expected} ms`));
   }
  }
 } finally {
  t.mock.timers.reset();
  if (saved === undefined) delete process.env.CLAND_TEST_LOAD_FACTOR;
  else process.env.CLAND_TEST_LOAD_FACTOR = saved;
 }
});

test('injected wait clocks retain exact deadlines despite the suite factor', async () => {
 const saved = process.env.CLAND_TEST_LOAD_FACTOR;
 process.env.CLAND_TEST_LOAD_FACTOR = '4';
 try {
  for (const api of ['until', 'eventually'] as const) {
   const clock = new FakeClock(0);
   const work = api === 'until'
    ? until(() => false, { what: 'durable receipt', timeoutMs: 100, clock })
    : eventually('durable receipt', () => undefined, { timeoutMs: 100, clock });
   const outcome = work.then(() => ({ error: 'unexpected success', at: clock.now().getTime() }),
    error => ({ error: String(error), at: clock.now().getTime() }));
   await clock.advance(400);
   assert.deepEqual(await outcome, { error: 'Error: durable receipt: not within 100 ms', at: 100 });
   assert.equal(clock.pending, 0);
  }
 } finally {
  if (saved === undefined) delete process.env.CLAND_TEST_LOAD_FACTOR;
  else process.env.CLAND_TEST_LOAD_FACTOR = saved;
 }
});

test('suite setup budgets account for load and phase workers on either executor', () => {
 assert.equal(suiteLoadFactor({ load: 12, workers: 4, parallelism: 8 }), 2);
 assert.equal(suiteLoadFactor({ load: 0, workers: 1, parallelism: 8 }), 1);
 assert.equal(suiteLoadFactor({ load: 0, workers: 1, parallelism: 8, executor: 'droplet' }), 2);
 assert.equal(suiteLoadFactor({ load: 20, workers: 4, parallelism: 8, override: '1.5' }), 1.5);
 assert.equal(suiteLoadFactor({ load: 20, workers: 4, parallelism: 8, override: 'bad' }), 3);
});

test('fractional setup factors yield integer deadlines without shortening headroom', () => {
 for (const [ms, factor, expected] of [[5000, 1.159, 5795], [5000, 1.1591, 5796], [0.1, 1, 1]] as const) {
  const deadline = waitTimeoutMs(ms, factor);
  assert.equal(deadline, expected);
  assert.ok(Number.isInteger(deadline));
  assert.ok(deadline >= ms * factor);
  assert.doesNotThrow(() => AbortSignal.timeout(deadline));
 }
 const keys = ['CLAND_TEST_LOAD_FACTOR', 'CLAND_TEST_WAIT_MS'] as const;
 const saved = keys.map(key => process.env[key]);
 try {
  process.env.CLAND_TEST_LOAD_FACTOR = '1.1591';
  process.env.CLAND_TEST_WAIT_MS = '5000';
  assert.equal(testSetupWaitMs(), 5796);
  assert.doesNotThrow(() => AbortSignal.timeout(testSetupWaitMs()));
 } finally { keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; }); }
});

test('wait deadline policy preserves local, droplet, explicit and invalid scaling',t=>{
 t.mock.method(os, 'loadavg', () => [0, 0, 0]);
 const keys=['CLAND_TEST_LOAD_FACTOR','CLAND_SUITE_EXECUTOR'] as const;
 const saved=keys.map(key=>process.env[key]);
 try {
  for(const key of keys)delete process.env[key];
  assert.equal(waitTimeoutMs(100),100);
  process.env.CLAND_SUITE_EXECUTOR='droplet';assert.equal(waitTimeoutMs(100),200);
  assert.equal(waitTimeoutMs(100,3),300);
  process.env.CLAND_TEST_LOAD_FACTOR='invalid';assert.equal(waitTimeoutMs(100),100);
  assert.equal(waitTimeoutMs(100,0),100);
  assert.throws(()=>waitTimeoutMs(0),/positive finite deadline/);
  assert.throws(()=>waitTimeoutMs(-1),/positive finite deadline/);
  assert.throws(()=>waitTimeoutMs(Number.POSITIVE_INFINITY),/positive finite deadline/);
 } finally {keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];});}
});
