// T1: deadline policy and fake-time waits; no sockets or native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { waitTimeoutMs, testSetupWaitMs, suiteLoadFactor, until, eventually } from './until.ts';
import { FakeClock } from './fake-clock.ts';

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

test('wait deadline policy preserves local, droplet, explicit and invalid scaling',()=>{
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
