import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer, type WebSocket } from 'ws';
import { HubClient, READINESS_TIMEOUT_MS, REQUEST_TIMEOUT_MS, type ConnectionState } from '../src/spoke/hub-client.ts';
import { PROTOCOL_VERSION } from '../src/protocol.ts';

/** A peer that upgrades, reads hello, and holds welcome until the test releases it. */
async function heldWelcome(t: TestContext, answer = true) {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>(resolve => server.once('listening', resolve));
  const peers: Array<ReturnType<typeof Promise.withResolvers<WebSocket>>> = [];
  const hello = (index = 0) => (peers[index] ??= Promise.withResolvers<WebSocket>()).promise;
  const requests: Array<{ connection: number; type: string }> = [];
  const requestSeen = Promise.withResolvers<void>();
  let connections = 0;
  server.on('connection', ws => {
    const connection = connections++;
    ws.on('message', data => {
      const frame = JSON.parse(String(data)) as { type: string; id: string };
      if (frame.type === 'hello') {
        peers[connection] ??= Promise.withResolvers<WebSocket>();
        peers[connection].resolve(ws);
      } else {
        requests.push({ connection, type: frame.type });
        requestSeen.resolve();
        if (answer) ws.send(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { connection } }));
      }
    });
  });
  const client = new HubClient({ url: `ws://127.0.0.1:${(server.address() as { port: number }).port}`,
    secret: 'test', hello: { cwd: '/', sessionId: 'held', name: 'old', role: 'coordinator' } });
  t.after(async () => {
    client.stop();
    for (const ws of server.clients) ws.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  client.start();
  const ws = await hello();
  const welcome = (peer = ws, name = 'accepted', role = 'reviewer') => peer.send(JSON.stringify({
    type: 'welcome', protocol: PROTOCOL_VERSION, name, role, presence: [],
  }));
  return { client, ws, hello, welcome, requests, requestSeen: requestSeen.promise };
}

function nextState(client: HubClient, kind: ConnectionState['kind']): Promise<ConnectionState> {
  return new Promise(resolve => {
    const onState = (state: ConnectionState) => {
      if (state.kind !== kind) return;
      client.off('state', onState);
      resolve(state);
    };
    client.on('state', onState);
  });
}

test('concurrent tools wait for welcome, then use its accepted identity and role', async t => {
  const { client, welcome, requests } = await heldWelcome(t);
  const calls = [client.request({ type: 'who' }), client.request({ type: 'status', text: 'ready' })];
  assert.equal(requests.length, 0);
  welcome();
  assert.deepEqual(await Promise.all(calls), [{ connection: 0 }, { connection: 0 }]);
  assert.deepEqual(client.state, { kind: 'connected', name: 'accepted', role: 'reviewer' });
  assert.deepEqual(requests.map(r => r.type), ['who', 'status']);
});

test('a held welcome fails at the readiness deadline and expired calls never run on a late welcome', async t => {
  const { client, welcome, requests } = await heldWelcome(t);
  // The real socket has said hello already; only new tool timers use this clock.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let settled = false;
  const call = client.request({ type: 'status', text: 'expired' });
  const rejected = assert.rejects(call, /did not become ready within 20 s \(waiting for welcome\)/).then(() => { settled = true; });
  t.mock.timers.tick(READINESS_TIMEOUT_MS - 1);
  await Promise.resolve();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await rejected;
  t.mock.timers.reset();
  const ready = nextState(client, 'connected');
  welcome();
  await ready;
  assert.deepEqual(await client.request({ type: 'who' }), { connection: 0 });
  assert.deepEqual(requests.map(r => r.type), ['who']);
});

test('disconnect rejects all waiting tools immediately; reconnect waits for the new welcome', async t => {
  const { client, ws, hello, welcome, requests } = await heldWelcome(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [client.request({ type: 'who' }), client.request({ type: 'status', text: 'abandoned' })];
  const rejected = calls.map(call => assert.rejects(call, /connection closed .* before the welcome/));
  const down = nextState(client, 'disconnected');
  ws.close(1000, 'lost');
  await down;
  await Promise.all(rejected); // no time advanced: a close, not the deadline, released them
  assert.equal(client.name, null);
  t.mock.timers.tick(1000); // advance the normal reconnect delay, without sleeping
  t.mock.timers.reset();
  const peer = await hello(1);
  const fresh = client.request({ type: 'who' });
  assert.deepEqual(requests, []);
  welcome(peer, 'new-name', 'implementer');
  assert.deepEqual(await fresh, { connection: 1 });
  assert.deepEqual(client.state, { kind: 'connected', name: 'new-name', role: 'implementer' });
  assert.deepEqual(requests, [{ connection: 1, type: 'who' }]);
});

test('a refusal rejects waiting tools with its reason instead of the readiness deadline', async t => {
  const { client, ws, requests } = await heldWelcome(t);
  const rejected = assert.rejects(client.request({ type: 'who' }), /refused this session \(no-role\): role needed/);
  ws.send(JSON.stringify({ type: 'error', code: 'no-role', message: 'role needed' }));
  await rejected;
  assert.deepEqual(requests, []);
});

test('stopping rejects waiting tools immediately, even before a socket was started', async () => {
  const client = new HubClient({ url: 'ws://127.0.0.1:1', secret: 'test', hello: { cwd: '/', sessionId: 'held' } });
  const rejected = assert.rejects(client.request({ type: 'who' }), /stopped before the hub welcome/);
  client.stop();
  await rejected;
  await assert.rejects(client.request({ type: 'who' }), /spoke is stopped/);
});

test('a connection stopped as welcome arrives cannot run a previously waiting tool', async t => {
  const { client, welcome, requests } = await heldWelcome(t);
  client.on('state', state => { if (state.kind === 'connected') client.stop(); });
  const rejected = assert.rejects(client.request({ type: 'who' }), /closed|stopped/);
  welcome();
  await rejected;
  assert.deepEqual(requests, []);
});

test('ordinary replies still time out after 10 s once ready', async t => {
  const { client, welcome, requestSeen } = await heldWelcome(t, false);
  const ready = nextState(client, 'connected');
  welcome();
  await ready;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let settled = false;
  const rejected = assert.rejects(client.request({ type: 'who' }), /did not answer within 10 s/).then(() => { settled = true; });
  await requestSeen;
  t.mock.timers.tick(REQUEST_TIMEOUT_MS - 1);
  await Promise.resolve();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await rejected;
});
