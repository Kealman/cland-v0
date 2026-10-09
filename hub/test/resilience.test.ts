import { ownProcess } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { spawn } from 'node:child_process';
import { cland, DOCUMENTED_TOOLS, SPOKE_ENTRY, startDaemon, startHub, spawnSpoke, tempProject, TEST_SECRET, waitForAbsence } from './harness.ts';
import { createHub } from '../src/hub/server.ts';
import { PROTOCOL_VERSION } from '../src/protocol.ts';

const until = async <T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 5000): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  let last: T = await fn();
  while (!ok(last) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    last = await fn();
  }
  return last;
};

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

test('a spoke with the wrong secret keeps running and its tools say the secret was refused', async () => {
  const hub = await startHub({ secret: 'right' });
  const spoke = await spawnSpoke({ hub, secret: 'wrong', name: 'alpha' });
  try {
    const result = await until(
      () => spoke.call<{ ok: boolean; error?: string }>('send', { to: ['beta'], text: 'hi' }),
      (r) => !r.ok && /secret/.test(r.error ?? ''),
    );
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
  const hub = await startHub();
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
  const hub = await startHub();
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
  const hub = await startHub();
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

test('a spoke not started through cland stays alive, serves its tools, and answers "not connected to a cland hub"', async () => {
  const hub = await startHub();
  const spoke = await spawnSpoke({ hub, unconfigured: true });
  try {
    const { tools } = await spoke.client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...DOCUMENTED_TOOLS]);
    const who = await spoke.call<{ ok: boolean; error?: string }>('who');
    assert.equal(who.ok, false);
    assert.match(who.error ?? '', /not connected to a cland hub: CLAND_HUB_URL and CLAND_HUB_SECRET are not set/);
    assert.equal(spoke.events.length, 0);
  } finally {
    await spoke.close();
    await hub.close();
  }
});

test('a spoke survives a hub outage: tools report it, and it reconnects when the hub is back', async () => {
  const first = await startHub();
  const port = first.port;
  const alpha = await spawnSpoke({ hub: first, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub: first, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await first.close();
    const down = await until(
      () => alpha.call<{ ok: boolean; error?: string }>('send', { to: ['beta'], text: 'still there?' }),
      (r) => !r.ok,
    );
    assert.match(down.error ?? '', /unreachable|not connected|closed/);

    const second = await createHub({ port, host: '127.0.0.1', secret: TEST_SECRET });
    try {
      await alpha.waitForPresence(['alpha', 'beta'], 10_000);
      const sent = await alpha.call<{ ok: boolean; outcomes: Array<{ outcome: string }> }>('send', { to: ['beta'], text: 'back?' });
      assert.equal(sent.outcomes[0]?.outcome, 'delivered');
      await beta.waitForEvent((e) => e.params.content === 'back?');
    } finally {
      await second.close();
    }
  } finally {
    await alpha.close();
    await beta.close();
  }
});

test('a spoke whose session vanished (stdin ended without an MCP close) exits instead of haunting the hub', async (t) => {
  const child = spawn(process.execPath, [SPOKE_ENTRY], { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH ?? '' } });
  ownProcess(t, child.pid);
  const stderr: string[] = [];
  child.stderr.on('data', (c: Buffer) => stderr.push(c.toString()));
  const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
  await new Promise((r) => setTimeout(r, 700)); // let it start
  assert.equal(child.exitCode, null, 'alive while its stdin is open');
  child.stdin.end();
  const code = await Promise.race([exited, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000))]);
  assert.equal(code, 0, `exit code (stderr: ${stderr.join('')})`);
  assert.match(stderr.join(''), /stdin (ended|closed) — exiting/);
});

test('a spoke acks every deliver and hands a message re-sent under the same id to its session once', async () => {
  // The real hub re-sends a message whose ack it never got. Beta's spoke is paused, so the deliver waits
  // unread in its socket while the hub's heartbeat sweep drops that socket; resumed, the spoke reads the
  // first copy (its ack goes to a socket the hub has closed), reconnects, and is sent the message again.
  const events: Array<Record<string, unknown>> = [];
  const hub = await startHub({ heartbeatMs: 100, log: (e) => void events.push(e) });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a', heartbeatMs: 40 });
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b', heartbeatMs: 40 });
  let paused = false;
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    process.kill(beta.pid, 'SIGSTOP');
    paused = true;
    const sent = await alpha.call<{ outcomes: Array<{ outcome: string }> }>('send', { to: ['beta'], text: 'only once, please' });
    assert.equal(sent.outcomes[0]?.outcome, 'delivered', 'the frame went out on the open socket');
    await waitForAbsence(alpha, 'beta');
    process.kill(beta.pid, 'SIGCONT');
    paused = false;

    await beta.waitForEvent((e) => e.params.content === 'only once, please');
    await alpha.waitForPresence(['beta']);
    const id = await until(
      async () => events.find((e) => e.event === 'acked' && e.session === 'beta')?.id,
      (v) => v !== undefined,
    );
    assert.ok(id, 'the second copy was acked');
    assert.ok(
      events.some((e) => e.event === 'flushed' && e.session === 'beta'),
      'the hub sent the unacked message again on the next hello',
    );
    await until(async () => beta.log(), (log) => new RegExp(`message ${String(id)} was sent again`).test(log));
    assert.match(beta.log(), new RegExp(`message ${String(id)} was sent again; acked again`), 'the spoke received both copies');
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(beta.events.filter((e) => e.params.content === 'only once, please').length, 1, 'the session saw it once');
  } finally {
    if (paused) process.kill(beta.pid, 'SIGCONT');
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

/** A paused (SIGSTOP) process answers nothing: its sockets stay open, every frame to it goes unread. */
const pause = (pid: number) => process.kill(pid, 'SIGSTOP');
const resume = (pid: number) => {
  try {
    process.kill(pid, 'SIGCONT');
  } catch {
    /* gone already: the test's cleanup killed it */
  }
};

test('a request the hub never answers fails at its deadline instead of hanging the tool call', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'alpha', sessionId: 'sess-a', requestTimeoutMs: 300 });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['alpha']);
  pause(discovery.pid);
  t.after(() => resume(discovery.pid));
  const started = Date.now();
  const who = await spoke.call<{ ok: boolean; error?: string }>('who');
  assert.equal(who.ok, false);
  assert.match(who.error ?? '', /the hub did not answer within 0\.3 s/);
  assert.ok(Date.now() - started < 3000, 'bounded by the deadline');
  resume(discovery.pid);
  // the hub is back: the same spoke works again
  await spoke.waitForPresence(['alpha']);
});

test('a spoke whose heartbeats go unanswered closes the connection and reconnects', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'alpha', sessionId: 'sess-a', heartbeatMs: 100 });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['alpha']);
  const before = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout) as { sessions: Array<{ name: string; connectedAt: string }> };
  pause(discovery.pid);
  t.after(() => resume(discovery.pid));
  await until(async () => spoke.log(), (log) => /missed 2 heartbeat replies/.test(log));
  assert.match(spoke.log(), /missed 2 heartbeat replies/);
  resume(discovery.pid);
  // a fresh hello: the hub shows alpha connected again, since a later time
  const after = await until(
    async () => JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout) as { sessions: Array<{ name: string; connectedAt: string }> },
    (s) => s.sessions.some((p) => p.name === 'alpha' && p.connectedAt > (before.sessions[0]?.connectedAt ?? '')),
    10_000,
  );
  assert.deepEqual(after.sessions.map((p) => p.name), ['alpha']);
  assert.ok((after.sessions[0]?.connectedAt ?? '') > (before.sessions[0]?.connectedAt ?? ''), JSON.stringify({ before, after }));
});

test('a hub that takes the connection but never welcomes it is left at the welcome deadline, and the spoke reconnects', async () => {
  // Scripted on purpose: the real hub always answers a hello (with a welcome or a refusal) as soon as it
  // runs, and a paused one never completes the WebSocket upgrade. Only a scripted peer upgrades and then
  // stays silent.
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>((resolve) => wss.once('listening', () => resolve()));
  let hellos = 0;
  wss.on('connection', (ws) => {
    ws.on('message', (d) => {
      if ((JSON.parse(String(d)) as { type: string }).type === 'hello') hellos += 1;
    });
  });
  const spoke = await spawnSpoke({ hub: { url: `ws://127.0.0.1:${(wss.address() as { port: number }).port}` }, name: 'alpha', sessionId: 'sess-a', requestTimeoutMs: 300 });
  try {
    const seen = await until(async () => hellos, (n) => n >= 2, 5000);
    assert.ok(seen >= 2, `a fresh hello after the welcome deadline (saw ${seen})`);
    assert.match(spoke.log(), /did not welcome .* within 0\.3 s/);
  } finally {
    await spoke.close();
    for (const c of wss.clients) c.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  }
});
