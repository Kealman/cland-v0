// T2: the harness clients' byte-stream seams, with no hub or child process.
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { performance } from 'node:perf_hooks';
import { createServer, type Socket } from 'node:net';
import { once } from 'node:events';
import { getEventListeners } from 'node:events';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { connectSocket, frameClient, tempProject } from './harness.ts';
import { ensureAccountFixture } from './account-fixture-env.ts';
import { onCleanup } from './process-cleanup.ts';
import { sessionClient } from './session-credential-fixture.ts';
import { receiptFixtureCase } from './receipt-fixture-case.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { FakeClock } from './fake-clock.ts';

function cancellationCase(t: TestContext, body: (fixtures: TestContext, controller: () => AbortController, own: <T>(work: Promise<T>) => Promise<T>) => Promise<void>) {
  return receiptFixtureCase(t, false, async (fixtures, step, _adoptRoot, release) => {
    await step('FrameClient account fixture setup', ensureAccountFixture);
    const owners: AbortController[] = [];
    const pending = new Set<Promise<unknown>>();
    const abort = () => { for (const owner of owners) owner.abort(new Error('FrameClient case disposed')); };
    release(abort);
    const own = <T>(work: Promise<T>): Promise<T> => {
      pending.add(work);
      void work.then(() => pending.delete(work), () => pending.delete(work));
      return work;
    };
    await step('FrameClient cancellation scenario', async () => {
      try { await body(fixtures, () => { const owner = new AbortController(); owners.push(owner); return owner; }, own); }
      finally {
        abort();
        await Promise.allSettled([...pending]);
        fixtures.mock.restoreAll();
        fixtures.mock.timers.reset();
      }
    });
  });
}

test('frameClient fixture cancellation settles requests and waits and clears their timers', t => cancellationCase(t, async (t, controller, own) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timer = globalThis.setTimeout;
  let fired = 0;
  t.mock.method(globalThis, 'setTimeout', (callback: () => void, ms: number) => timer(() => { fired++; callback(); }, ms));
  let receive = (_chunk: string) => {};
  let predicates = 0;
  // No actor on these frames: the wrapper must forward cancellation without
  // consulting credentials or a store.
  const client = sessionClient(frameClient(() => {}, fn => { receive = fn; }, () => {}), 'unused');
  const owner = controller();
  const cancelled = new Error('fixture disposed');
  const pending = [
    own(client.request({ type: 'never-answered' }, 60_000, owner.signal)),
    own(client.waitFor(() => { predicates++; return false; }, 60_000, owner.signal)),
  ];
  const settled = Promise.allSettled(pending);
  owner.abort(cancelled);
  t.mock.timers.tick(60_000);
  assert.equal(fired, 0, 'teardown ends every pending timer');
  assert.deepEqual(await settled, pending.map(() => ({ status: 'rejected', reason: cancelled })));
  receive('{"type":"after-teardown"}\n');
  assert.equal(predicates, 0, 'cancelled waiters no longer inspect frames');
}));

test('frameClient cancellation leaves completed receipts intact and removes deadline waiters', t => cancellationCase(t, async (t, controller, own) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let receive = (_chunk: string) => {};
  const sent: Array<Record<string, unknown>> = [];
  const client = frameClient(line => sent.push(JSON.parse(line)), fn => { receive = fn; }, () => {});
  const owner = controller();
  const request = own(client.request({ type: 'status' }, 1000, owner.signal));
  const welcome = own(client.waitFor(f => f.type === 'welcome', 1000, owner.signal));
  receive(`${JSON.stringify({ type: 'result', id: sent[0]!.id, ok: true })}\n{"type":"welcome"}\n`);
  assert.equal((await request).ok, true);
  assert.deepEqual(await welcome, { type: 'welcome' });
  assert.equal(getEventListeners(owner.signal, 'abort').length, 0);
  const cancelled = new Error('already disposed');
  owner.abort(cancelled);
  await assert.rejects(client.request({ type: 'unsent' }, 1000, owner.signal), error => error === cancelled);
  await assert.rejects(client.waitFor(() => true, 1000, owner.signal), error => error === cancelled);
  assert.equal(sent.length, 1);
  let inspected = 0;
  const timeoutOwner = controller();
  const expired = assert.rejects(own(client.waitFor(() => { inspected++; return false; }, 1000, timeoutOwner.signal)), /no frame matched/);
  t.mock.timers.tick(1000);
  await expired;
  const before = inspected;
  receive('{"type":"after-timeout"}\n');
  assert.equal(inspected, before, 'expired waiters no longer inspect incoming frames');
  assert.equal(getEventListeners(timeoutOwner.signal, 'abort').length, 0);
}));

test('frameClient dispatch skips synchronously cancelled waiters and preserves unrelated receipts', t => cancellationCase(t, async (t, controller, own) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let receive = (_chunk: string) => {};
  const client = frameClient(() => {}, fn => { receive = fn; }, () => {});
  const first = controller(), cancelled = controller(), last = controller();
  const reason = new Error('cancelled during dispatch');
  let inspected = 0;
  const a = own(client.waitFor(() => { cancelled.abort(reason); first.abort(reason); return true; }, 1000, first.signal));
  const b = own(client.waitFor(() => { inspected++; return true; }, 1000, cancelled.signal));
  const frame = { type: 'unrelated', value: 42 };
  const c = own(client.waitFor(f => f.type === 'unrelated', 1000, last.signal));
  const rejected = Promise.all([assert.rejects(a, error => error === reason), assert.rejects(b, error => error === reason)]);
  receive('{"type":"trigger"}\n');
  assert.equal(inspected, 0, 'cancelled snapshot entries never evaluate their predicate');
  receive(`${JSON.stringify(frame)}\n`);
  assert.deepEqual(await c, frame, 'unrelated waiter retains its exact later receipt');
  await rejected;
}));

for (const hit of [false, true]) test(`frameClient buffered predicate cancellation refuses admission with hit ${hit}`, t => cancellationCase(t, async (t, controller, own) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timer = globalThis.setTimeout;
  let fired = 0, inspected = 0;
  t.mock.method(globalThis, 'setTimeout', (callback: () => void, ms: number) => timer(() => { fired++; callback(); }, ms));
  let receive = (_chunk: string) => {};
  const client = frameClient(() => {}, fn => { receive = fn; }, () => {});
  receive('{"type":"buffered"}\n');
  const owner = controller();
  const reason = new Error('cancelled in buffered scan');
  const receipt = own(client.waitFor(() => { inspected++; owner.abort(reason); return hit; }, 1000, owner.signal));
  const rejected = assert.rejects(receipt, error => error === reason);
  t.mock.timers.tick(1000);
  await rejected;
  assert.equal(fired, 0, 'buffered cancellation admits no timer');
  assert.equal(getEventListeners(owner.signal, 'abort').length, 0);
  receive('{"type":"after-buffered-cancellation"}\n');
  assert.equal(inspected, 1, 'buffered cancellation retains no waiter');
}));

test('frameClient throwing result observer settles the request and retains the unread stream', t => cancellationCase(t, async (t, controller, own) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timer = globalThis.setTimeout;
  let fired = 0;
  t.mock.method(globalThis, 'setTimeout', (callback: () => void, ms: number) => timer(() => { fired++; callback(); }, ms));
  let receive = (_chunk: string) => {}, id = '';
  const observerError = new Error('result observer failed');
  const client = frameClient(line => { id = JSON.parse(line).id; }, fn => { receive = fn; }, () => {}, undefined, () => { throw observerError; });
  const owner = controller();
  const clock = new FakeClock(Date.now());
  // Bound the settlement observer independently: the defective result handler
  // loses every way to settle its read-only promise. Missing settlement is an
  // explicit incomplete receipt, never a successful teardown observation.
  const request = own(within(client.request({ type: 'status' }, 60_000, owner.signal), 1000, clock,
    () => new Error('incomplete request settlement after observer failure')));
  const rejected = assert.rejects(request, error => error === observerError);
  void rejected.catch(() => {});
  const nextFrame = { type: 'after-observer', value: 42 };
  const next = own(client.waitFor(f => f.type === nextFrame.type, 60_000, owner.signal));
  assert.throws(() => receive(`${JSON.stringify({ type: 'result', id, ok: true })}\n${JSON.stringify(nextFrame)}\n`), error => error === observerError);
  receive('');
  assert.deepEqual(await next, nextFrame);
  owner.abort(new Error('fixture disposed after observer failure'));
  t.mock.timers.tick(60_000);
  assert.equal(fired, 0, 'observer failure leaves no timer after teardown');
  assert.equal(getEventListeners(owner.signal, 'abort').length, 0);
  await clock.advance(1000);
  await rejected;
}));

for (const chunkKiB of [64, 4]) test(`frameClient receives a 20 MiB frame in ${chunkKiB} KiB chunks within 2 seconds`, async (t) => {
  await ensureAccountFixture();
  let receive = (_chunk: string) => {};
  let requestId = '';
  const client = frameClient(line => { requestId = JSON.parse(line).id; }, fn => { receive = fn; }, () => {});
  const result = client.request({ type: 'hub.status' });
  const payload = 'x'.repeat(20 * 1024 * 1024);
  const wire = `${JSON.stringify({ type: 'result', id: requestId, ok: true, value: payload })}\n`;
  const chunks: string[] = [];
  for (let start = 0; start < wire.length; start += chunkKiB * 1024) chunks.push(wire.slice(start, start + chunkKiB * 1024));

  const started = performance.now();
  for (const chunk of chunks) receive(chunk);
  const frame = await result;
  const elapsed = performance.now() - started;
  assert.equal(frame.ok, true);
  assert.equal(frame.value, payload);
  t.diagnostic(`20 MiB receipt: ${elapsed.toFixed(1)} ms (excludes setup/serialization)`);
  assert.ok(elapsed < 2000, `20 MiB receipt took ${elapsed.toFixed(1)} ms; expected < 2000 ms`); // lint-allow-wall-clock: T-1041 requires the complete 20 MiB client receipt in under 2 s
});

async function socketPair(t: TestContext) {
  const root = await tempProject(t, 'cland-framing-');
  const path = fixtureSocketPath(root, 'peer.sock');
  const server = createServer();
  let peer: Socket | undefined;
  let client: Awaited<ReturnType<typeof connectSocket>> | undefined;
  onCleanup(t, async () => {
    const peerClosed = peer && !peer.closed ? once(peer, 'close', { signal: AbortSignal.timeout(5000) }) : undefined;
    client?.close();
    peer?.destroy();
    await Promise.all([peerClosed, client?.closed]);
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(5000) });
  server.listen(path);
  await listening;
  const connected = once(server, 'connection', { signal: AbortSignal.timeout(5000) });
  client = await connectSocket(path);
  [peer] = await connected as [Socket];
  return { peer: peer!, client };
}

for (const chunkKiB of [64, 4]) test(`connectSocket receives a 20 MiB frame in ${chunkKiB} KiB writes within 2 seconds`, async (t) => {
  const { client, peer } = await socketPair(t);
  const payload = 'x'.repeat(20 * 1024 * 1024);
  const wire = `${JSON.stringify({ type: 'message', text: payload })}\n`;
  const chunks: string[] = [];
  for (let start = 0; start < wire.length; start += chunkKiB * 1024) chunks.push(wire.slice(start, start + chunkKiB * 1024));
  const received = client.next(15_000);
  const started = performance.now();
  for (const chunk of chunks) {
    if (!peer.write(chunk)) await once(peer, 'drain', { signal: AbortSignal.timeout(5000) });
    // Yield to socket reads without adding a wall-clock delay or coalescing all writes.
    await setImmediate();
  }
  const frame = await received;
  const elapsed = performance.now() - started;
  assert.equal(frame.text, payload);
  t.diagnostic(`20 MiB socket receipt: ${elapsed.toFixed(1)} ms (excludes setup/serialization)`);
  assert.ok(elapsed < 2000, `20 MiB socket receipt took ${elapsed.toFixed(1)} ms; expected < 2000 ms`); // lint-allow-wall-clock: T-1041 measures socket delivery and parsing of a 20 MiB payload
});

test('frameClient preserves partial/coalesced lines, result correlation, event order and parse errors', async () => {
  await ensureAccountFixture();
  let receive = (_chunk: string) => {};
  const sent: Array<Record<string, unknown>> = [];
  const observed: Array<Record<string, unknown>> = [];
  const client = frameClient(line => sent.push(JSON.parse(line)), fn => { receive = fn; }, () => {}, undefined, result => { observed.push(result as Record<string, unknown>); });
  const first = client.request({ type: 'first' });
  const second = client.request({ type: 'second' });
  const event = { type: 'message', text: 'héllo 😀' };
  const pushed = client.waitFor(frame => frame.type === 'message');
  receive(' \r');
  receive(`\n\n${JSON.stringify(event).slice(0, 8)}`);
  assert.equal(client.frames.length, 0, 'an incomplete line is not a frame');
  receive(`${JSON.stringify(event).slice(8)}\r\n${JSON.stringify({ type: 'result', id: sent[1]!.id, ok: false, error: 'refused' })}\n{`);
  receive(`${JSON.stringify({ type: 'result', id: sent[0]!.id, ok: true, value: 42 }).slice(1)}\n\n${JSON.stringify({ type: 'delivery', seq: 2 })}\n`);
  assert.deepEqual(await pushed, event);
  assert.equal((await first).value, 42);
  assert.equal((await second).error, 'refused');
  assert.deepEqual(observed.map(frame => frame.id), [sent[1]!.id, sent[0]!.id]);
  assert.deepEqual(client.frames, [event, { type: 'delivery', seq: 2 }]);
  assert.throws(() => receive('invalid JSON\n'), SyntaxError);
  receive('{"type":"after-error"}\n');
  assert.equal(client.frames.at(-1)!.type, 'after-error');
  assert.throws(() => receive('invalid JSON\n{"type":"buffered-after-error"}\n{"type":"partial'), SyntaxError);
  receive('');
  assert.equal(client.frames.at(-1)!.type, 'buffered-after-error');
  receive('-after-error"}\n');
  assert.equal(client.frames.at(-1)!.type, 'partial-after-error');
  const callbackError = new Error('consumer callback failed');
  const afterCallback = client.waitFor(frame => {
    if (frame.type === 'callback-error') throw callbackError;
    return frame.type === 'buffered-after-callback';
  });
  assert.throws(() => receive('{"type":"callback-error"}\n{"type":"buffered-after-callback"}\n'), callbackError);
  receive('');
  assert.equal((await afterCallback).type, 'buffered-after-callback');
});

test('connectSocket preserves queued/waiting frames, blank lines, UTF-8 and peer close', async (t) => {
  const { client, peer } = await socketPair(t);
  const first = client.next();
  const second = client.next();
  const text = 'héllo 😀';
  const wire = Buffer.from(` \r\n\n${JSON.stringify({ seq: 1, text })}\r\n${JSON.stringify({ seq: 2 })}\n${JSON.stringify({ seq: 3 })}\n`);
  const split = wire.indexOf(Buffer.from('😀')) + 1;
  peer.write(wire.subarray(0, split));
  await setImmediate();
  peer.end(wire.subarray(split));
  assert.deepEqual(await first, { seq: 1, text });
  assert.deepEqual(await second, { seq: 2 });
  assert.deepEqual(await client.next(), { seq: 3 });
  await client.closed;
});
