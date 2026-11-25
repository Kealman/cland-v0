import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock } from './fake-clock.ts';
import { waitForCrash } from './crash-wait.ts';

test('crash observation accepts native exit while the PID awaits collection', async () => {
  const clock = new FakeClock();
  const result = waitForCrash({ signalZero() {}, exited: () => true }, { clock, timeoutMs: 200 })
    .catch(error => String(error));
  await clock.advance(200);
  assert.equal(await result, 'exited');
});

test('crash observation accepts a positively absent PID', async () => {
  assert.equal(await waitForCrash({
    signalZero() { throw Object.assign(new Error('absent'), { code: 'ESRCH' }); },
    exited: () => false,
  }, { clock: new FakeClock(), timeoutMs: 200 }), 'absent');
});

for (const state of ['running', 'unreadable'] as const) test(`crash observation bounds ${state} state without claiming exit`, async () => {
  const clock = new FakeClock();
  const wait = waitForCrash({
    signalZero() { if (state === 'unreadable') throw Object.assign(new Error('permission denied'), { code: 'EPERM' }); },
    exited: () => false,
  }, { clock, timeoutMs: 200 });
  const rejected = assert.rejects(wait, /the hub crashed: not within 200 ms/);
  await clock.advance(200);
  await rejected;
});

test('closing the owner cancels and drains an armed crash observer', async () => {
  const clock = new FakeClock(), abort = new AbortController();
  let probes = 0;
  const waiting = waitForCrash({ signalZero() { probes++; }, exited: () => false }, { clock, timeoutMs: 200, signal: abort.signal });
  const rejected = assert.rejects(waiting, /controlled owner close/);
  abort.abort(new Error('controlled owner close'));
  await clock.advance(50);
  await rejected;
  const count = probes;
  await clock.advance(200);
  assert.equal(probes, count, 'cancelled observer performs no further native observations');
});
