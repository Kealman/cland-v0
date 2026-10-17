// T1: machine counter arithmetic and partial receipt selection use only literal data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpuDelta, cpuSample, machineHealthFromLog } from '../src/executor/droplet/health.ts';

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
