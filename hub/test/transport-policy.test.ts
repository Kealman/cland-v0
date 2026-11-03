import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock } from './fake-clock.ts';
import { ReconnectPolicy } from '../src/transport/transport.ts';
test('C3 exponential jitter, cap, stable uptime reset and wake clock jump', () => {
  const clock = new FakeClock(0), p = new ReconnectPolicy(clock, () => 0.5);
  assert.deepEqual(Array.from({length: 8}, () => p.failed()), [1000,2000,4000,8000,16000,30000,30000,30000]);
  p.connected(); clock.block(29999); p.disconnected(); assert.equal(p.failed(),30000);
  p.connected(); clock.block(30000); p.disconnected(); assert.equal(p.failed(),1000);
  assert.equal(new ReconnectPolicy(clock, () => 0).failed(),800);
  assert.equal(new ReconnectPolicy(clock, () => 1).failed(),1200);
  p.observe(); clock.block(1); assert.equal(p.observe(),false); clock.block(90000); assert.equal(p.observe(),true);
});
