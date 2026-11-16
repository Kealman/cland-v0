// T2: every production MCP handler over an in-memory MCP transport and a stub hub socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { DOCUMENTED_TOOLS, inProcessSpoke, until, type Session } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { runSpoke } from '../src/spoke/spoke.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';

async function discoveringSpoke(t: import('node:test').TestContext, root: string, clock: FakeClock, file?: string) {
  const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
  const runtime = await runSpoke(fixtureEnvironment(root, {}, {
    CLAND_SESSION_NAME: 'fixture', CLAND_HUB_RECONNECT_MS: '50',
    ...(file ? { CLAND_HUB_FILE: file } : {}),
  }), { cwd: root, clock, transport, exit: () => {}, log: () => {} });
  const client = new Client({ name: 'fixture', version: '1' });
  onCleanup(t, () => client.close());
  onCleanup(t, () => runtime.hub?.stop());
  onCleanup(t, () => runtime.server.close());
  await client.connect(clientTransport);
  return { ...runtime, client };
}

for (const explicit of [false, true]) {
  test(explicit ? 'C3 an explicit absent discovery file connects when published' : 'C1 a project spoke connects when discovery is published after startup', async t => {
    const root = await tempProject(t);
    const directory = join(root, explicit ? 'discovery' : '.cland');
    await mkdir(directory);
    const file = join(directory, 'hub.json');
    const cwd = join(root, 'nested');
    await mkdir(cwd);
    const clock = new FakeClock();
    const spoke = await discoveringSpoke(t, cwd, clock, explicit ? file : undefined);
    assert.ok(spoke.hub, 'a configured project retains its reconnecting client while discovery is absent');
    const offline = await spoke.client.callTool({ name: 'who' });
    assert.equal(offline.isError, true);
    assert.match(JSON.parse((offline.content as Array<{ text: string }>)[0]!.text).error, /the hub is unreachable .*reconnecting/);
    await clock.advance(50); // still absent: exercise another discovery attempt
    const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    onCleanup(t, async () => {
      for (const peer of server.clients) peer.terminate();
      await new Promise<void>(resolve => server.close(() => resolve()));
    });
    await receipt(once(server, 'listening'));
    server.on('connection', peer => peer.on('message', data => {
      const frame = JSON.parse(String(data)) as { type: string; id: string };
      if (frame.type === 'hello') peer.send(JSON.stringify({ type: 'welcome', protocol: 2, name: 'fixture', presence: [] }));
      else peer.send(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { connected: true } }));
    }));
    let welcomed = false;
    const observeWelcome = () => { if (spoke.hub!.state.kind === 'connected') welcomed = true; };
    spoke.hub.on('state', observeWelcome);
    try {
      await writeFile(file, JSON.stringify({ socket: join(root, 'unused.sock'), port: (server.address() as { port: number }).port, secret: 'fixture', pid: 0, version: 'fixture' }));
      await clock.advance(100);
      await until(() => welcomed, { what: 'spoke processed the published hub welcome' });
    } finally { spoke.hub.off('state', observeWelcome); }
    assert.deepEqual(spoke.hub.state, { kind: 'connected', name: 'fixture' });
    const result = await spoke.client.callTool({ name: 'who' });
    assert.equal(JSON.parse((result.content as Array<{ text: string }>)[0]!.text).connected, true);
    await spoke.hub.stop();
    assert.equal(clock.pending, 0, 'stop cancels discovery retries and connected timers');
  });
}

test('C2 a spoke outside a project stays unconfigured without polling', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const spoke = await discoveringSpoke(t, root, clock);
  const expected = { ok: false, error: 'this session is not connected to a cland hub: CLAND_HUB_URL and CLAND_HUB_SECRET are not set and no .cland/hub.json was found from the cwd up — run `cland hub start` in the project, or start the session through cland' };
  assert.equal(spoke.hub, null);
  assert.equal(clock.pending, 0);
  await mkdir(join(root, '.cland'));
  await clock.advance(60_000);
  const result = await spoke.client.callTool({ name: 'who' });
  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse((result.content as Array<{ text: string }>)[0]!.text), expected);
  assert.equal(clock.pending, 0);
});

const calls: Record<string, Record<string, unknown>> = {
  'verification.decline': { request: 'request-id', reason: 'fixture' },
  verify: {}, 'merge.queue': {}, merge: { item: 'T-1' },
  'artifact.create': { kind: 'note', title: 'fixture', topic: 'general', content: 'fixture' },
  'artifact.keep': { artifact: 'A-1' }, 'artifact.archive': { artifact: 'A-1' },
  'artifact.move': { artifact: 'A-1', folder: 'A-2' }, 'artifact.list': {},
  'artifact.promote': { artifact: 'A-1', path: 'fixture.md' },
  send: { text: 'fixture', to: ['fixture'] },
  subscribe: { subject: { topic: 'general' }, events: ['topic'] },
  unsubscribe: { subscription: 'subscription-id' }, subscriptions: {},
  'topic.create': { title: 'fixture' }, resolve: { topic: 'general' },
  'ask.forward': { ask: 'ask-id' }, 'ask.answer': { ask: 'ask-id', text: 'fixture' },
  ask: { topic: 'general', question: 'fixture' },
  who: {}, status: { text: 'fixture' }, rename: { name: 'fixture' }, history: {},
  'session.archive': { session: 'fixture' }, 'session.prune': { olderThan: '7d' },
  'session.launch': { name: 'fixture' }, 'session.stop': { session: 'fixture' },
  'role.handover': { to: 'fixture', note: { goals_now: '', work_in_flight: '', open_decisions: '', waiting_on: '' } },
  'role.state': {}, 'task.plan': { op: 'show', id: 'T-1' },
  'task.criterion': { id: 'T-1', op: 'done', criterion: 'C1' },
  'task.hold': { id: 'T-1' }, 'task.create': { title: 'fixture', size: 'S' },
  'task.view': { id: 'T-1' }, 'task.list': {}, 'task.comment': { id: 'T-1', text: 'fixture' },
  'task.edit': { id: 'T-1', title: 'fixture' }, 'task.close': { id: 'T-1' },
  'task.link': { id: 'T-1' }, 'task.rank': { id: 'T-1', top: true }, 'task.claim': { id: 'T-1' },
  'rule.add': { text: 'fixture', scope: 'all', reason: 'fixture' },
  'rule.edit': { number: 1, text: 'fixture' }, 'rule.retire': { number: 1, reason: 'fixture' }, 'rule.list': {},
};

async function receipt<T>(promise: Promise<T>): Promise<T> {
  let result: { value: T } | { error: unknown } | undefined;
  void promise.then(value => { result = { value }; }, error => { result = { error }; });
  await until(() => result !== undefined, { what: 'MCP/hub receipt' });
  if ('error' in result!) throw result.error;
  return result!.value;
}

test('C4 concurrent first tool listings and every documented tool answer through unchanged handlers', async t => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  let spoke: Session | undefined;
  t.after(async () => {
    await spoke?.close();
    for (const peer of server.clients) peer.terminate();
    await receipt(new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  });
  await receipt(once(server, 'listening'));
  const frames: string[] = [];
  server.on('connection', peer => peer.on('message', data => {
    const frame = JSON.parse(String(data)) as { type: string; id: string };
    if (frame.type === 'hello') peer.send(JSON.stringify({ type: 'welcome', protocol: 2, name: 'fixture', presence: [] }));
    else if (frame.type !== 'ack') {
      frames.push(frame.type);
      peer.send(JSON.stringify({ type: 'result', id: frame.id, ok: true,
        value: { name: 'fixture', status: 'fixture', messages: [], outcomes: [], topic: { id: 'general', title: 'General' } } }));
    }
  }));
  spoke = await receipt(inProcessSpoke(t, { hub: { url: `ws://127.0.0.1:${(server.address() as { port: number }).port}` }, clock: new FakeClock() }));
  const lists = await receipt(Promise.all([spoke.client.listTools(), spoke.client.listTools()]));
  for (const list of lists) assert.deepEqual(list.tools.map(tool => tool.name).sort(), [...DOCUMENTED_TOOLS]);
  assert.deepEqual(Object.keys(calls).sort(), [...DOCUMENTED_TOOLS]);
  for (const [name, args] of Object.entries(calls)) {
    const result: { ok: boolean; error?: string } = await receipt(spoke.call<{ ok: boolean; error?: string }>(name, args));
    assert.equal(result.ok, true, `${name}: ${JSON.stringify(result)}`);
  }
  assert.deepEqual(frames, Object.keys(calls).map(name => name === 'verify' ? 'suite.start'
    : name === 'subscribe' ? 'event.subscribe' : name === 'unsubscribe' ? 'event.unsubscribe'
    : name === 'subscriptions' ? 'event.subscriptions' : name), 'every tool reached its native frame handler');
});
