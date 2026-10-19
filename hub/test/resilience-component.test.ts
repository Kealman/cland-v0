// T2: protocol refusals, acknowledgements and connection deadlines with in-process peers and FakeClock.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket, { WebSocketServer } from 'ws';
import { DOCUMENTED_TOOLS, inProcessSpoke, startHub, TEST_SECRET, until, waitForAbsence } from './harness.ts';
import { HubClient, type ConnectionState } from '../src/spoke/hub-client.ts';
import { FakeClock } from './fake-clock.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { PROTOCOL_VERSION } from '../src/protocol.ts';

/** Open a raw socket, send one frame, and collect what comes back until the hub closes it. */
const rawExchange = async (url: string, frame: unknown): Promise<{ code: number; frames: Array<Record<string, unknown>> }> => {
  const ws = new WebSocket(url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
  const frames: Array<Record<string, unknown>> = [];
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  ws.on('message', (d) => frames.push(JSON.parse(d.toString()) as Record<string, unknown>));
  await new Promise<void>((resolve) => ws.on('open', () => resolve()));
  ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame));
  return { code: await closed, frames };
};

test('a spoke with the wrong secret keeps running and its tools say the secret was refused', async (t) => {
  const hub = await startHub({ secret: 'right', clock: new FakeClock() });
  const spoke = await inProcessSpoke(t, { clock: new FakeClock(), hub, secret: 'wrong', name: 'alpha' });
  try {
    let result: { ok: boolean; error?: string } = { ok: true };
    await until(async () => {
      result = await spoke.call('send', { to: ['beta'], text: 'hi' });
      return !result.ok && /secret/.test(result.error ?? '');
    }, { what: 'the secret refusal reaches the MCP tool' });
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /refused the project's secret \(401\)/);
    const { tools } = await spoke.client.listTools();
    assert.equal(tools.length, DOCUMENTED_TOOLS.length);
  } finally {
    await spoke.close();
    await hub.close();
  }
});

test('a hello with another protocol version is refused with the fix named', async () => {
  const hub = await startHub({ clock: new FakeClock() });
  try {
    const { code, frames } = await rawExchange(hub.url, { type: 'hello', protocol: PROTOCOL_VERSION + 1, cwd: '/', sessionId: 's' });
    assert.equal(code, 4000);
    assert.equal(frames[0]?.type, 'error');
    assert.equal(frames[0]?.code, 'version');
    assert.match(String(frames[0]?.message), /update cland and restart the session/);
  } finally {
    await hub.close();
  }
});

test('a first frame that is not a hello, or not a frame at all, is refused as bad-hello', async () => {
  const hub = await startHub({ clock: new FakeClock() });
  try {
    for (const frame of [{ type: 'who', id: '1' }, 'not json', { type: 'hello', protocol: PROTOCOL_VERSION }]) {
      const { code, frames } = await rawExchange(hub.url, frame);
      assert.equal(code, 4000, JSON.stringify(frame));
      assert.equal(frames[0]?.code, 'bad-hello');
    }
  } finally {
    await hub.close();
  }
});

test('hello is answered by welcome with the name and the presence table; an unknown request type is a failed result, not a close', async () => {
  const hub = await startHub({ clock: new FakeClock() });
  try {
    const ws = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
    const frames: Array<Record<string, unknown>> = [];
    const next = () => new Promise<Record<string, unknown>>((resolve) => ws.once('message', (d) => resolve(JSON.parse(d.toString()) as Record<string, unknown>)));
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, cwd: '/w', sessionId: 's-raw', name: 'raw', role: 'implementer' }));
    const welcome = await next();
    frames.push(welcome);
    assert.equal(welcome.type, 'welcome');
    assert.equal(welcome.name, 'raw');
    assert.equal(welcome.role, 'implementer');
    assert.deepEqual((welcome.presence as Array<{ name: string }>).map((p) => p.name), ['raw']);
    ws.send(JSON.stringify({ type: 'claim_epic', id: 'r1', epic: 'x' }));
    assert.deepEqual(await next(), { type: 'result', id: 'r1', ok: false, error: 'unknown request type "claim_epic"' });
    ws.send(JSON.stringify({ type: 'ping', id: 'r2' }));
    assert.deepEqual(await next(), { type: 'result', id: 'r2', ok: true, value: { pong: true } });
    ws.close();
  } finally {
    await hub.close();
  }
});

/** A real socket peer whose replies are controlled by the test, not a paused OS process. */
async function scriptedPeer(t: TestContext, clock: FakeClock, welcome = true, keepaliveMs?: number) {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>(resolve => server.once('listening', resolve));
  const connections: Array<ReturnType<typeof Promise.withResolvers<WebSocket>>> = [];
  const frames: Array<{ connection: number; frame: Record<string, unknown> }> = [];
  let count = 0;
  server.on('connection', ws => {
    const connection = count++;
    ws.on('message', data => {
      const frame = JSON.parse(String(data)) as Record<string, unknown>;
      frames.push({ connection, frame });
      if (frame.type === 'hello') {
        (connections[connection] ??= Promise.withResolvers<WebSocket>()).resolve(ws);
        if (welcome) ws.send(JSON.stringify({ type: 'welcome', protocol: PROTOCOL_VERSION, name: 'alpha', presence: [] }));
      }
    });
  });
  const log: string[] = [];
  const client = new HubClient({ url: `ws://127.0.0.1:${(server.address() as { port: number }).port}`, secret: TEST_SECRET,
    hello: { cwd: '/', name: 'alpha', sessionId: 'sess-a' }, clock, requestTimeoutMs: 300, welcomeTimeoutMs: 300,
    ...(keepaliveMs ? { keepaliveMs } : {}), log: line => log.push(line) });
  t.after(async () => {
    await client.stop();
    for (const ws of server.clients) ws.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const state = (kind: ConnectionState['kind']) => new Promise<ConnectionState>(resolve => {
    const listener = (value: ConnectionState) => {
      if (value.kind !== kind) return;
      client.off('state', listener);
      resolve(value);
    };
    client.on('state', listener);
  });
  const hello = (index = 0) => (connections[index] ??= Promise.withResolvers<WebSocket>()).promise;
  return { client, hello, state, frames, log, url: `ws://127.0.0.1:${(server.address() as { port: number }).port}` };
}

test('a request the hub never answers fails at its deadline instead of hanging the tool call', { timeout: 5000 }, async t => {
  const clock = new FakeClock();
  const peer = await scriptedPeer(t, clock);
  const spoke = await inProcessSpoke(t, { hub: peer, name: 'alpha', sessionId: 'sess-a', clock, requestTimeoutMs: 300 });
  await peer.hello();
  const started = clock.now().getTime();
  let settled = false;
  const call = spoke.call<{ ok: boolean; error?: string }>('who').then(result => { settled = true; return result; });
  await until(() => peer.frames.some(({ frame }) => frame.type === 'who'), { what: 'the held request reached the peer' });
  await clock.advance(299);
  assert.equal(settled, false, 'the tool remains pending before its deadline');
  await clock.advance(1);
  const who = await call;
  assert.equal(who.ok, false);
  assert.match(who.error ?? '', /the hub did not answer within 0\.3 s/);
  assert.ok(clock.now().getTime() - started < 3000, 'bounded by the deadline');
  // The same spoke works again when the peer resumes answering.
  const ws = await peer.hello();
  ws.on('message', data => {
    const frame = JSON.parse(String(data)) as { id: string; type: string };
    if (frame.type === 'who') ws.send(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { me: 'alpha', sessions: [{ name: 'alpha' }] } }));
  });
  await spoke.waitForPresence(['alpha']);
});

test('a spoke whose heartbeats go unanswered closes the connection and reconnects', { timeout: 5000 }, async t => {
  const hubClock = new FakeClock();
  const hub = await startHub({ clock: hubClock });
  beforeDirectories(t, () => hub.close());
  const control = { dropPings: false };
  const relay = await lostAckRelay(t, hub.url, control);
  const clock = new FakeClock();
  const log: string[] = [];
  // Logs are part of the existing public client seam.
  const observed = new HubClient({ url: relay.url, secret: TEST_SECRET, hello: { cwd: '/', name: 'alpha', sessionId: 'sess-a' }, clock, keepaliveMs: 100, log: line => log.push(line) });
  const state = (kind: ConnectionState['kind']) => new Promise<void>(resolve => {
    const listener = (value: ConnectionState) => { if (value.kind === kind) { observed.off('state', listener); resolve(); } };
    observed.on('state', listener);
  });
  t.after(() => observed.stop());
  const ready = state('connected');
  observed.start();
  await ready;
  const before = await observed.who();
  control.dropPings = true;
  const down = state('disconnected');
  await clock.advance(300);
  await down;
  assert.match(log.join('\n'), /missed 2 keepalive replies/);
  control.dropPings = false;
  // Timestamp the new hello later without running the hub's independent heartbeat sweep.
  hubClock.block(1);
  const back = state('connected');
  await clock.advance(1000);
  await back;
  const after = await observed.who();
  assert.deepEqual(after.sessions.map(session => session.name), ['alpha']);
  assert.ok((after.sessions[0]?.connectedAt ?? '') > (before.sessions[0]?.connectedAt ?? ''), JSON.stringify({ before, after }));
});

test('a hub that takes the connection but never welcomes it is left at the welcome deadline, and the spoke reconnects', { timeout: 5000 }, async t => {
  const clock = new FakeClock();
  const peer = await scriptedPeer(t, clock, false);
  peer.client.start();
  await peer.hello();
  await clock.advance(299);
  assert.equal(peer.frames.filter(({ frame }) => frame.type === 'hello').length, 1);
  const down = peer.state('disconnected');
  await clock.advance(1);
  await down;
  await clock.advance(1000);
  await peer.hello(1);
  const seen = peer.frames.filter(({ frame }) => frame.type === 'hello').length;
  assert.ok(seen >= 2, `a fresh hello after the welcome deadline (saw ${seen})`);
  assert.match(peer.log.join('\n'), /did not welcome .* within 0\.3 s/);
});

/** Relay a real hub connection, dropping only the first acknowledgement of the target message. */
async function lostAckRelay(t: TestContext, url: string, control: { dropPings?: boolean } = {}) {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>(resolve => server.once('listening', resolve));
  const held = Promise.withResolvers<{ id: string; drop: () => Promise<void> }>();
  const sockets = new Set<WebSocket>();
  let target: string | undefined;
  let lost = false;
  server.on('connection', downstream => {
    const upstream = new WebSocket(url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
    sockets.add(upstream);
    const opened = new Promise<void>(resolve => upstream.once('open', resolve));
    upstream.on('error', () => downstream.terminate());
    downstream.on('message', async data => {
      await opened;
      const frame = JSON.parse(String(data)) as { type: string; id: string };
      if (control.dropPings && frame.type === 'ping') return;
      if (!lost && frame.type === 'ack' && frame.id === target) {
        lost = true;
        held.resolve({ id: frame.id, drop: async () => {
          const closed = new Promise<void>(resolve => downstream.once('close', () => resolve()));
          upstream.terminate();
          await closed;
        } });
      } else if (upstream.readyState === WebSocket.OPEN) upstream.send(String(data));
    });
    upstream.on('message', data => {
      const frame = JSON.parse(String(data)) as { type: string; id: string; message?: { text: string } };
      if (frame.type === 'deliver' && frame.message?.text === 'only once, please') target = frame.id;
      if (downstream.readyState === WebSocket.OPEN) downstream.send(String(data));
    });
    upstream.on('close', () => { sockets.delete(upstream); downstream.close(); });
    downstream.on('close', () => upstream.close());
  });
  beforeDirectories(t, async () => {
    for (const ws of sockets) ws.terminate();
    for (const ws of server.clients) ws.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  return { url: `ws://127.0.0.1:${(server.address() as { port: number }).port}`, held: held.promise };
}

test('a spoke acks every deliver and hands a message re-sent under the same id to its session once', { timeout: 5000 }, async t => {
  const events: Array<Record<string, unknown>> = [];
  const hub = await startHub({ clock: new FakeClock(), log: event => { events.push(event); } });
  beforeDirectories(t, () => hub.close());
  const relay = await lostAckRelay(t, hub.url);
  const clock = new FakeClock();
  const alpha = await inProcessSpoke(t, { hub, name: 'alpha', sessionId: 'sess-a', clock: new FakeClock() });
  const beta = await inProcessSpoke(t, { hub: relay, name: 'beta', sessionId: 'sess-b', clock });
  await alpha.waitForPresence(['alpha', 'beta']);
  const sent = await alpha.call<{ ok: boolean; outcomes?: Array<{ outcome: string }> }>('send', { to: ['beta'], text: 'only once, please' });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.ok(Array.isArray(sent.outcomes), JSON.stringify(sent));
  assert.equal(sent.outcomes[0]?.outcome, 'delivered', 'the frame went out on the open socket');
  const held = await relay.held;
  assert.equal(events.some(event => event.event === 'acked' && event.id === held.id), false, 'the first ack is held before the hub can record it');
  await beta.waitForEvent(event => event.params.content === 'only once, please');
  await held.drop();
  await waitForAbsence(alpha, 'beta');
  await until(async () => !(await beta.call<{ ok: boolean }>('who')).ok, { what: 'beta observed its socket closing' });
  await clock.advance(1000);
  await alpha.waitForPresence(['beta']);
  await until(() => events.some(event => event.event === 'acked' && event.session === 'beta' && event.id === held.id), { what: 'the second copy was acked' });
  assert.ok(held.id, 'the second copy was acked');
  assert.ok(events.some(event => event.event === 'flushed' && event.session === 'beta'), 'the hub sent the unacked message again on the next hello');
  assert.match(beta.log(), new RegExp(`message ${held.id} was sent again; acked again`), 'the spoke received both copies');
  // A subsequent MCP result is a transport barrier after the duplicate delivery notification.
  assert.equal((await beta.call<{ ok: boolean }>('who')).ok, true);
  assert.equal(beta.events.filter(event => event.params.content === 'only once, please').length, 1, 'the session saw it once');
});
