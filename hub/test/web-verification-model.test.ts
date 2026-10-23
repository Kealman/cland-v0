// T1: queue presentation from recorded scratch-hub/semantic-executor frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { VerificationQueue } from '../../shared/wire/index.ts';
import { verificationModel, type ExecutorStatus } from '../../web/src/sessions/verification.ts';
const recorded = JSON.parse(readFileSync(new URL('../../web/test/fixtures/verification.json', import.meta.url), 'utf8')) as {
  queueFrame: { type: 'verification.queue'; queue: VerificationQueue };
  executorFrame: { value: ExecutorStatus };
};

test('recorded queue renders local and remote slots, ordered waiters, last twenty metrics and daily spend', () => {
  const view = verificationModel(recorded.queueFrame.queue, 2000, recorded.executorFrame.value);
  assert.equal(view.summary, 'verify: caller-2 5s · remote 1/1 · 2 waiting · next ~6s');
  assert.deepEqual(view.local, { slot: 'local 1/1', session: 'caller-2', item: '—', detail: 'hub-only · pid unknown · /scratch/queue', since: '2026-10-16T12:00:10.000Z', time: '5s', eta: '~6s' });
  assert.deepEqual(view.remote, [{ slot: 'remote 1/1', session: 'caller-3', item: '—', detail: 'hub-only · droplet cland-recorded-run-2 · c-8 · lon1', since: '2026-10-16T12:00:10.000Z', time: '5s', eta: '?' }]);
  assert.deepEqual(view.waiters, [
    { slot: 'waiting 1', session: 'caller-4', item: '—', detail: 'hub-only · executor local · /scratch/queue', since: '2026-10-16T12:00:10.000Z', time: '5s', eta: '~6s' },
    { slot: 'waiting 2', session: 'caller-5', item: '—', detail: 'hub-only · executor droplet · /scratch/queue', since: '2026-10-16T12:00:11.000Z', time: '4s', eta: '?' },
  ]);
  assert.equal(view.metrics, 'last 1/20 runs · run median 9s, p90 9s · wait median 0s, p90 0s');
  assert.equal(view.spend, 'droplets today $0.00 of the $5.00 cap');
});

test('remote-only summary estimates admission and ageing preserves estimates and unknowns', () => {
  const recordedQueue = recorded.queueFrame.queue;
  const queue: VerificationQueue = { ...recordedQueue, holder: null, waiters: [], remote: [{ ...recordedQueue.remote![0]!, runMs: 59000, etaMs: 30000 }] };
  assert.equal(verificationModel(queue, 2000).summary, 'verify: free · remote 1/1 · next ~30s');
  const view = verificationModel({ ...recordedQueue, holder: { ...recordedQueue.holder!, kind: 'hand run', session: null, runMs: null } }, 60_000);
  assert.match(view.summary, /^verify: hand run \?/);
  assert.equal(view.local?.time, '?');
  assert.deepEqual(view.waiters.map(row => [row.time, row.eta]), [['1m', '~6s'], ['1m', '?']]);
  assert.equal(verificationModel(null, 60_000).summary, 'verify: —');
  assert.equal(verificationModel({ ...recordedQueue, holder: null, remote: [], waiters: [] }, 0).summary, 'verify: idle · remote 0/1');
  assert.equal(verificationModel(recordedQueue, -5000).local?.time, '3s');
  assert.equal(verificationModel(queue, 0, { spend: { spent: 1.12, cap: 3 } }).spend, 'droplets today $1.12 of the $3.00 cap');
});
