// T2: the harness clients' byte-stream seams, with no hub or child process.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { performance } from 'node:perf_hooks';
import { createServer, type Socket } from 'node:net';
import { once } from 'node:events';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { connectSocket, frameClient, tempProject } from './harness.ts';
import { ensureAccountFixture } from './account-fixture-env.ts';
import { onCleanup } from './process-cleanup.ts';

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
  const path = join(root, 'peer.sock');
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
