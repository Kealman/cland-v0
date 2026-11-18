// T1: history receipt observation with fake time; no native dependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock } from './fake-clock.ts';
import { waitForDiscordHistorySettlement } from './discord-history-settlement.ts';

let savedWait: string | undefined;
test.beforeEach(() => {
  savedWait = process.env.CLAND_TEST_WAIT_MS;
  delete process.env.CLAND_TEST_WAIT_MS;
});
test.afterEach(() => {
  if (savedWait === undefined) delete process.env.CLAND_TEST_WAIT_MS;
  else process.env.CLAND_TEST_WAIT_MS = savedWait;
});

test('history completion accepts both receipts arriving after ten seconds', async () => {
  const clock = new FakeClock(0);
  let inputs = 0, overflowSent = false;
  const waiting = waitForDiscordHistorySettlement(() => ({ inputs, overflowSent }), 500, clock);
  const outcome = waiting.then(() => 'complete', error => String(error));
  await clock.advance(10_001);
  inputs = 500; overflowSent = true;
  await clock.advance(0);
  assert.equal(await outcome, 'complete');
  assert.equal(clock.pending, 0);
});

test('history observation honours the shared configured wait budget', async () => {
  process.env.CLAND_TEST_WAIT_MS = '60000';
  const clock = new FakeClock(0);
  const waiting = waitForDiscordHistorySettlement(() => ({ inputs: 500, overflowSent: false }), 500, clock);
  const rejected = assert.rejects(waiting, /not within 60000 ms/);
  await clock.advance(60_000);
  await rejected;
  assert.equal(clock.pending, 0);
});

for (const missing of ['inputs', 'overflow'] as const) test(`history completion requires the ${missing} receipt`, async () => {
  const clock = new FakeClock(0);
  let receipt = { inputs: missing === 'inputs' ? 499 : 500, overflowSent: missing !== 'overflow' };
  let completed = false;
  const waiting = waitForDiscordHistorySettlement(() => receipt, 500, clock).then(() => { completed = true; });
  await clock.advance(100);
  assert.equal(completed, false);
  receipt = { inputs: 500, overflowSent: true };
  await clock.advance(0);
  await waiting;
  assert.equal(completed, true);
  assert.equal(clock.pending, 0);
});

test('missing history settlement expires at its bounded observation budget', async () => {
  const clock = new FakeClock(0);
  const waiting = waitForDiscordHistorySettlement(() => ({ inputs: 500, overflowSent: false }), 500, clock);
  const rejected = assert.rejects(waiting, /500 inputs and overflow settlement: not within 50000 ms/);
  await clock.advance(50_000);
  await rejected;
  assert.equal(clock.pending, 0);
});
