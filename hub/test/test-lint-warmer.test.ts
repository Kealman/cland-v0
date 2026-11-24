// T1: debounce uses an injected clock and pass; no worker or Git is launched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock } from './fake-clock.ts';
import { LintWarmQueue } from '../src/test-lint-warm-queue.ts';

test('five dev moves warm only the latest head after the quiet interval', async () => {
  const clock = new FakeClock();
  const heads: string[] = [];
  const queue = new LintWarmQueue(clock, async head => { heads.push(head); }, 1000);
  for (let n = 0; n < 5; n++) { queue.request(`head-${n}`); await clock.advance(100); }
  assert.deepEqual(heads, []);
  await clock.advance(900);
  assert.deepEqual(heads, ['head-4']);
  await queue.close();
});

test('close joins the active pass and discards queued heads', async () => {
  const clock = new FakeClock();
  const gate = Promise.withResolvers<void>();
  const heads: string[] = [];
  const queue = new LintWarmQueue(clock, async head => { heads.push(head); await gate.promise; });
  queue.request('first'); await clock.advance(1000);
  queue.request('second'); await clock.advance(1000);
  let closed = false;
  const closing = queue.close().then(() => { closed = true; });
  await Promise.resolve();
  assert.equal(closed, false);
  gate.resolve(); await closing; await clock.advance(1000);
  assert.deepEqual(heads, ['first']);
  assert.equal(closed, true);
});

test('a failed pass leaves later requests eligible and active passes never overlap', async () => {
  const clock = new FakeClock();
  const gate = Promise.withResolvers<void>();
  const heads: string[] = [];
  const queue = new LintWarmQueue(clock, async head => {
    heads.push(head);
    if (heads.length === 1) { await gate.promise; throw new Error('analysis failed'); }
  });
  queue.request('first'); await clock.advance(1000);
  queue.request('second'); await clock.advance(1000);
  assert.deepEqual(heads, ['first']);
  gate.resolve(); await clock.advance(1); await clock.advance(1);
  assert.deepEqual(heads, ['first', 'second']);
  await queue.close();
});
