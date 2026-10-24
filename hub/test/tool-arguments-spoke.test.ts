// T2: the MCP boundary and real hub-client socket against a disposable stub hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { inProcessSpoke, until, type Session } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

async function receipt<T>(pending: Promise<T>, what: string): Promise<T> {
  let outcome: { value: T } | { error: unknown } | undefined;
  void pending.then(value => { outcome = { value }; }, error => { outcome = { error }; });
  await until(() => outcome !== undefined, { what });
  if ('error' in outcome!) throw outcome.error;
  return outcome!.value;
}

test('MCP envelope errors name arguments, and tool validation stays typed through the spoke', async t => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  let spoke: Session | undefined;
  t.after(async () => {
    await spoke?.close();
    for (const peer of server.clients) peer.terminate();
    await receipt(new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())), 'stub hub closes');
  });
  await receipt(once(server, 'listening'), 'stub hub listens');
  const requests: string[] = [];
  const reason = 'op must be done, verify, fail, add, edit or remove';
  server.on('connection', peer => peer.on('message', data => {
    const frame = JSON.parse(String(data)) as { type: string; id: string };
    if (frame.type === 'hello') peer.send(JSON.stringify({ type: 'welcome', protocol: 2, name: 'fixture', presence: [] }));
    else if (frame.type !== 'ack') {
      requests.push(frame.type);
      peer.send(JSON.stringify(frame.type === 'who'
        ? { type: 'result', id: frame.id, ok: true, value: {} }
        : { type: 'result', id: frame.id, ok: false, code: 'invalid_argument', error: reason, reason }));
    }
  }));
  spoke = await receipt(inProcessSpoke(t, { hub: { url: `ws://127.0.0.1:${(server.address() as { port: number }).port}` }, clock: new FakeClock() }), 'MCP connects');
  await receipt(spoke.call('who'), 'welcome is consumed');
  await assert.rejects(spoke.client.request({ method: 'tools/call', params: { name: 'task.criterion', arguments: 42 } }, CallToolResultSchema), error => {
    assert.equal((error as { code: number }).code, -32603);
    assert.match(String(error), /arguments/);
    assert.doesNotMatch(String(error), /forbidden/);
    return true;
  });
  assert.deepEqual(requests, ['who'], 'SDK envelope rejection never reaches the hub');
  const result = await receipt(spoke.call<Record<string, unknown>>('task.criterion', { id: 'T-1', op: 'done', criterion: 'C1' }), 'typed hub error');
  assert.deepEqual(result, { ok: false, error: reason, code: 'invalid_argument', reason });
  const local = await receipt(spoke.call<Record<string, unknown>>('task.criterion', { id: 'T-1', action: 'done' }), 'local argument error');
  assert.equal(local.code, 'invalid_argument');
  assert.match(String(local.reason), /action/);
  assert.match(String(local.reason), /op.*done.*verify.*fail.*add.*edit.*remove/);
  assert.deepEqual(requests, ['who', 'task.criterion'], 'invalid tool arguments never reach the hub');
});

test('a free-only MCP ask succeeds and supplies concrete empty options to the hub', async t => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  let spoke: Session | undefined;
  t.after(async () => {
    await spoke?.close();
    for (const peer of server.clients) peer.terminate();
    await receipt(new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())), 'stub hub closes');
  });
  await receipt(once(server, 'listening'), 'stub hub listens');
  const asks: Record<string, unknown>[] = [];
  server.on('connection', peer => peer.on('message', data => {
    const frame = JSON.parse(String(data)) as Record<string, unknown>;
    if (frame.type === 'hello') peer.send(JSON.stringify({ type: 'welcome', protocol: 2, name: 'fixture', presence: [] }));
    else if (frame.type !== 'ack') {
      if (frame.type === 'ask') asks.push(frame);
      peer.send(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: frame.type === 'ask' ? { ask: 'fixture-ask' } : {} }));
    }
  }));
  spoke = await receipt(inProcessSpoke(t, { hub: { url: `ws://127.0.0.1:${(server.address() as { port: number }).port}` }, clock: new FakeClock() }), 'MCP connects');
  await receipt(spoke.call('who'), 'welcome is consumed');
  const result = await receipt(spoke.call('ask', { topic: 'general', question: 'Approve publication?', free: true }), 'free-only ask completes');
  assert.deepEqual(result, { ok: true, ask: 'fixture-ask' });
  assert.equal(asks.length, 1);
  const ask = asks[0];
  assert.ok(ask);
  const { id, ...frame } = ask;
  assert.equal(typeof id, 'string');
  assert.deepEqual(frame, { type: 'ask', topic: 'general', question: 'Approve publication?', options: [], free: true });
});
