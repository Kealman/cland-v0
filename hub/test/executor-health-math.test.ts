// T1: machine counter arithmetic and partial receipt selection use only literal data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpuDelta, cpuSample, machineHealthFromLog } from '../src/executor/droplet/health.ts';
import { startMachineMetrics, withMachineMetrics, appendMachineMetrics, ownPackage } from '../src/executor/droplet/metrics.ts';
import { suiteEvidence } from '../src/suite-log.ts';

test('supervisor termination before launch or with a resistant child hands off incomplete ownership', async () => {
  let removed = false;
  assert.deepEqual(await ownPackage({
    observe: () => () => { removed = true; }, after: () => assert.fail('normal close needs no shutdown deadline'),
    launch: async () => 0, handoff: () => assert.fail('normal close cannot hand off'),
  }), { state: 'closed', code: 0 });
  assert.equal(removed, true);
  for (const beforeLaunch of [true, false]) {
    let terminate: (signal: string) => void = () => {};
    let deadline: (() => void) | undefined, detached = false, launched = false;
    const close = Promise.withResolvers<number>();
    const result = ownPackage({
      observe: listener => { terminate = listener; if (beforeLaunch) listener('SIGTERM'); return () => {}; },
      after: (ms, callback) => { assert.equal(ms, 2000); deadline = callback; return () => {}; },
      launch: () => { launched = true; return close.promise; },
      handoff: () => { detached = true; },
    });
    if (!beforeLaunch) terminate('SIGTERM');
    let returned = false; void result.then(() => { returned = true; });
    await Promise.resolve();
    assert.equal(returned, false, 'TERM is not a native close receipt');
    assert.equal(launched, !beforeLaunch, 'a pre-launch TERM cannot start package work');
    deadline!();
    assert.deepEqual(await result, { state: 'incomplete', signal: 'SIGTERM' });
    assert.equal(detached, true, 'the machine owner retains the remaining child');
    close.resolve(143); await Promise.resolve();
    assert.deepEqual(await result, { state: 'incomplete', signal: 'SIGTERM' }, 'late native close cannot overwrite the handoff');
  }
});

test('separate metrics retain framing across interleaved package writes without newlines', () => {
  let packageLog = 'progress', metrics = '', tick: (() => void) | undefined;
  const stop = startMachineMetrics({ now: () => 1000,
    every: (_ms, callback) => { tick = callback; return () => {}; },
    read: () => ({ stat: '', loadavg: '1 2 3' }), write: line => { metrics += line; },
  });
  tick!(); packageLog += 'more'; tick!(); stop();
  const chunks = metrics.match(/.{1,13}|\n/g)!;
  appendMachineMetrics(() => chunks.shift() ?? null, chunk => { packageLog += chunk; });
  assert.equal(packageLog, 'progressmore\n' + metrics + '\n');
  assert.equal(suiteEvidence(packageLog).split('\n').filter(line => line.startsWith('suite machine metrics ')).length, 2);
  const incomplete = 'suite machine metrics-incomplete {"version":1,"stage":"append","exit":124}';
  assert.ok(suiteEvidence(packageLog + incomplete).includes(incomplete), 'native append failure remains explicit in retained evidence');
  let partial = 'progress';
  const partialChunks = ['suite machine metrics {'];
  appendMachineMetrics(() => partialChunks.shift() ?? null, chunk => { partial += chunk; });
  assert.equal(partial + 'suite machine health {}', 'progress\nsuite machine metrics {\nsuite machine health {}', 'a killed partial sample cannot consume the following aggregate health line');
});

test('foreground package closure stops metrics even after a stalled package is terminated', async () => {
  let tick: (() => void) | undefined;
  let stopped = false;
  const nativeClose = Promise.withResolvers<number>();
  const result = withMachineMetrics({ now: () => 1000,
    every: (_ms, callback) => { tick = callback; return () => { stopped = true; }; },
    read: () => ({ stat: '', loadavg: '' }),
    write: () => { throw new Error('controlled unavailable writer'); },
  }, () => nativeClose.promise);
  tick!();
  assert.equal(stopped, false, 'stalled package remains owned until native close');
  nativeClose.resolve(137);
  assert.equal(await result, 137, 'native forced-stop exit remains the outcome');
  assert.equal(stopped, true, 'no independent sampler process remains to stop or reap');
});

test('machine metrics log one-second load and CPU intervals and stop without later writes', () => {
  let time = 0, tick: (() => void) | undefined;
  const lines: string[] = [];
  const stats = ['cpu 100 0 0 100 0 0 0 0', 'cpu 130 0 0 150 10 0 0 10', 'cpu 160 0 0 200 20 0 0 20'];
  const stop = startMachineMetrics({
    now: () => time,
    every: (ms, callback) => { assert.equal(ms, 1000); tick = callback; return () => { tick = undefined; }; },
    read: () => ({ stat: stats.shift()!, loadavg: '2.50 1.25 0.75 2/100 123' }),
    write: line => { lines.push(line); },
  });
  assert.equal(lines.length, 0, 'baseline is not a CPU interval');
  time = 1000; tick!(); time = 2000; tick!();
  assert.deepEqual(lines.map(line => JSON.parse(line.slice('suite machine metrics '.length))), [
    { version: 1, at: 1000, elapsedMs: 1000, load: [2.5, 1.25, 0.75], cpuPct: 30, iowaitPct: 10, stealPct: 10 },
    { version: 1, at: 2000, elapsedMs: 1000, load: [2.5, 1.25, 0.75], cpuPct: 30, iowaitPct: 10, stealPct: 10 },
  ]);
  const queued = tick!;
  stop(); queued(); stop();
  assert.equal(lines.length, 2, 'even an already queued callback cannot write after stop');
});

test('run CPU deltas exclude guest counters and retain iowait/steal ticks', () => {
  const before = cpuSample('cpu 100 20 30 400 10 5 5 30 60 10\ncpu0 10 2 3 40 1 0 0 3\n');
  assert.deepEqual(before, { totalTicks: 600, iowaitTicks: 10, stealTicks: 30 });
  const after = cpuSample('cpu 110 20 30 460 30 5 5 40 99 99\n');
  assert.deepEqual(cpuDelta(before, after), { totalTicks: 100, iowaitTicks: 20, stealTicks: 10, iowaitPct: 20, stealPct: 10 });
  for (const invalid of ['', 'cpu 1 2 3', 'cpu 0 0 0 0 -1 0 0 0']) assert.equal(cpuSample(invalid), null);
  assert.equal(cpuDelta(before, before), null);
  assert.equal(cpuDelta(after, before), null);
  assert.equal(cpuDelta(null, after), null);
});

test('a partial or malformed final health line retains the last complete receipt', () => {
  const health = { version: 1, temp: { root: '/tmp', kind: 'disk', capBytes: null, fallback: 'tmpfs setup unavailable' }, storage: { disk: null, temp: null }, cpu: null };
  const log = `suite machine health ${JSON.stringify(health)}\nsuite machine health {\n`;
  assert.deepEqual(machineHealthFromLog(log), health);
  assert.equal(machineHealthFromLog('suite machine health {"version":1}'), undefined);
  assert.equal(machineHealthFromLog(`suite machine health ${JSON.stringify({ ...health, version: 2 })}`), undefined);
});
