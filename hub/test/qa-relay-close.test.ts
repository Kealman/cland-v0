// T1: independent relay shutdown receipts; no native resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { closeRelayResources, RelayCloseError } from '../../qa/support/relay-close.ts';

test('rejected relay work still joins every already-open resource close', async () => {
  const primary = Error('tick rejected'), closed: string[] = [];
  const first = Promise.withResolvers<void>(), second = Promise.withResolvers<void>();
  const closing = closeRelayResources(Promise.reject(primary), () => [
    async () => { await first.promise; closed.push('socket'); },
    async () => { await second.promise; closed.push('server'); },
  ]);
  const rejected = assert.rejects(closing, error => error instanceof RelayCloseError && error.cause === primary && error.closed);
  second.resolve(); first.resolve();
  await rejected;
  assert.deepEqual(closed.sort(), ['server', 'socket']);
});

test('relay close failure retains the tick cause and independently attempts later closes', async () => {
  const primary = Error('tick rejected'), secondary = Error('socket close rejected');
  let serverClosed = false;
  await assert.rejects(closeRelayResources(Promise.reject(primary), () => [
    async () => { throw secondary; }, async () => { serverClosed = true; },
  ]), error => {
    assert.ok(error instanceof RelayCloseError);
    assert.equal(error.cause, primary); assert.equal(error.closed, false);
    assert.deepEqual(error.secondary, [secondary]);
    return true;
  });
  assert.equal(serverClosed, true);
});

test('relay shutdown captures resources acquired before the producer settles', async () => {
  const tick = Promise.withResolvers<void>();
  let acquired = false, closed = false;
  const closing = closeRelayResources(tick.promise, () => acquired ? [async () => { closed = true; }] : []);
  acquired = true; tick.resolve();
  assert.deepEqual(await closing, { closed: true });
  assert.equal(closed, true);
});

test('a metadata-free producer rejection remains a rejection after successful closes', async () => {
  await assert.rejects(closeRelayResources(Promise.reject(undefined), () => []), error =>
    error instanceof RelayCloseError && error.producerRejected && error.cause === undefined && error.closed);
});
