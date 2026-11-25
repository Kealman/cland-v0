// T2: client negotiation and ordered snapshot frames over the real Unix edge.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serializeItem } from '../src/tracker/item.ts';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { FakeClock } from './fake-clock.ts';
import { SNAPSHOT_LIMITS } from '../src/protocol.ts';
import type { HubFrame } from '../src/protocol.ts';
import { connectSocket, frameClient, inProcessSpoke, projectHub, tempProject, type FrameClient } from './harness.ts';
import { onCleanup, fenceFixtureCleanup, drainFixtureCleanup } from './process-cleanup.ts';
import cp from 'node:child_process';
import { existsSync } from 'node:fs';
import { setupFrames, setupSocket } from './setup-frames.ts';
import { receiptFixtureCase } from './receipt-fixture-case.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';

test('setup callback rejected close retains its root and native guard until same-owner repair', t => receiptFixtureCase(t, false, async (t, step, _adoptRoot, release) => {
  fenceFixtureCleanup(t);
  const originalSpawn = cp.spawn;
  const hooks: Array<() => unknown> = [];
  const nested = new Proxy(t, {
    get(target, key) {
      if (key === 'after') return (fn: () => unknown) => { hooks.push(fn); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  let repair = false;
  release(() => { repair = true; });
  let fixtures!: TestContext;
  let root = '', joined = false, closeCount = 0;
  const refusal = new Error('controlled setup close rejected');
  await step('nested receipt callback setup', () => receiptFixtureCase(nested, false, async (owned, setup, adoptRoot) => {
    fenceFixtureCleanup(owned);
    fixtures = owned;
    onCleanup(owned, async () => { closeCount++; if (!repair) throw refusal; joined = true; });
    root = await setup('nested retained root setup', () => tempProject(owned));
    adoptRoot(root);
  }));
  const guardedSpawn = cp.spawn;
  try {
    await step('rejected close receipt', () => assert.rejects(drainFixtureCleanup(fixtures), error => error === refusal));
    assert.equal(joined, false);
    assert.equal(existsSync(root), true, 'rejected close retains the actual fixture root');
    assert.equal(cp.spawn, guardedSpawn, 'rejected close retains the installed native guard');
  } finally {
    repair = true;
    await step('same-owner close repair receipt', () => drainFixtureCleanup(fixtures));
    for (const hook of hooks) await hook();
  }
  assert.equal(joined, true);
  assert.equal(closeCount, 2);
  assert.equal(existsSync(root), false, 'successful repair removes the root');
  assert.equal(cp.spawn, originalSpawn, 'successful repair restores the enclosing native guard');
}));

test('socket setup cancellation leaves the next ordered receipt available', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  fenceFixtureCleanup(t);
  let closing = false;
  let acquiring: ReturnType<typeof connectSocket> | undefined;
  let socket: Awaited<ReturnType<typeof connectSocket>> | undefined;
  let closeSetup = async () => {};
  release(() => { closing = true; void closeSetup(); socket?.close(); });
  onCleanup(t, async () => {
    await closeSetup();
    socket = await acquiring?.catch(() => undefined);
    socket?.close();
    await socket?.closed;
  });
  const root = await step('socket control project setup', () => tempProject(t));
  adoptRoot(root);
  const hub = await step('socket control serving hub setup', () => projectHub(t, root));
  socket = await step('socket control connection setup', () => acquiring = connectSocket(hub.discovery.socket).then(client => {
    socket = client;
    if (closing) client.close();
    return client;
  }));
  const setup = setupSocket(t, socket, 'socket handshake');
  closeSetup = setup.close;
  const cancelled = setup.next();
  const rejected = assert.rejects(cancelled, /socket handshake: receipt failed/);
  await setup.close();
  await rejected;
  socket.send({ type: 'hello', protocol: 2, client: 'ui', secret: hub.discovery.secret });
  assert.equal((await socket.next()).type, 'welcome');
}));

test('setup frame receipts tolerate delayed I/O and teardown cancels undelivered work', t => receiptFixtureCase(t, false, async (t, step, _adoptRoot, release) => {
  fenceFixtureCleanup(t);
  let closeSetup = async () => {};
  release(() => { void closeSetup(); });
  let receive!: (chunk: string) => void;
  let requestId: unknown;
  let setup: ReturnType<typeof setupFrames> | undefined;
  try {
  const owned = await step('synthetic frame setup', async () => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const ui = frameClient(line => { requestId = JSON.parse(line).id; }, fn => { receive = fn; }, () => {});
    setup = setupFrames(t, ui, 'delayed synthetic subscription');
    closeSetup = setup.close;
    return setup;
  });
  const frame = owned.waitFor(f => f.type === 'ready');
  const request = owned.request({ type: 'subscribe' });
  t.mock.timers.tick(1001);
  receive(`${JSON.stringify({ type: 'ready' })}\n${JSON.stringify({ type: 'result', id: requestId, ok: true })}\n`);
  assert.equal((await frame).type, 'ready');
  assert.equal((await request).ok, true);
  const missingFrame = owned.waitFor(f => f.type === 'missing');
  const missingRequest = owned.request({ type: 'missing' });
  const rejected = Promise.all([
    assert.rejects(missingFrame, error => error instanceof Error && error.cause instanceof Error && error.cause.message === 'delayed synthetic subscription: fixture teardown'),
    assert.rejects(missingRequest, error => error instanceof Error && error.cause instanceof Error && error.cause.message === 'delayed synthetic subscription: fixture teardown'),
  ]);
  await owned.close();
  await rejected;
  } finally {
    await setup?.close();
    t.mock.timers.reset();
  }
}));

test('explicit enclosing disposal cancels and joins setup receipts before later cleanup hooks', t => receiptFixtureCase(t, false, async (t, step, _adoptRoot, release) => {
  fenceFixtureCleanup(t);
  const abort = new AbortController();
  release(() => abort.abort(new Error('control released')));
  const owner = await step('explicit disposal owner setup', async () => pacingOwner(t));
  const client = frameClient(() => {}, () => {}, () => {});
  const cancelled = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  release(() => finish.resolve());
  let originalJoined = false, disposed = false;
  const work = owner.observe(async signal => {
    try { return await setupFrames(t, client, 'held enclosing receipt', AbortSignal.any([signal, abort.signal])).request({ type: 'held' }); }
    finally { cancelled.resolve(); await finish.promise; originalJoined = true; }
  });
  const rejected = assert.rejects(work, error => error instanceof Error && error.cause instanceof Error && error.cause.message === 'Telegram pacing fixture setup cancelled');
  void rejected.catch(() => {});
  const disposing = owner.dispose().then(() => { disposed = true; });
  await step('cancelled receipt reached original continuation', () => cancelled.promise);
  assert.equal(disposed, false, 'disposal retains ownership while the original continuation is held');
  finish.resolve();
  await step('explicit disposal completion receipt', () => disposing);
  await rejected;
  assert.equal(originalJoined, true);
  assert.equal(owner.observations(), 0);
}));

async function client(t: TestContext, discovery: { socket: string; secret: string }, features?: string[]): Promise<FrameClient> {
  const socket = createConnection(discovery.socket);
  onCleanup(t, () => socket.destroy());
  await once(socket, 'connect', { signal: AbortSignal.timeout(2000) });
  socket.setEncoding('utf8');
  const ui = frameClient(line => socket.write(line), fn => socket.on('data', fn), () => socket.destroy());
  const welcome = ui.waitFor(f => f.type === 'welcome');
  ui.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'ui', ...(features ? { features } : {}) });
  await welcome;
  return ui;
}

test('session.list adds snapshot-shaped archived rows without changing compatibility fields', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const clock = new FakeClock();
  const at = clock.now().toISOString();
  const table = new ProcessTable(join(root, '.cland/hub.db'), clock);
  for (const name of ['worker', 'retained']) table.put({ name, role: 'implementer', harness: 'codex', model: null, cwd: root,
    pid: null, harnessId: null, sessionId: `${name}-id`, harnessSessionId: null, startedAt: at, stoppedAt: at, status: 'stopped' });
  table.close();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const unmanaged = await inProcessSpoke(t, { discover: true, cwd: root, name: 'unmanaged' });
  await unmanaged.waitForPresence(['unmanaged']);
  const ui = await client(t, discovery, ['snapshot']);
  await ui.waitFor(f => f.type === 'snapshot.end');
  const snapshot = ui.frames.find(f => f.type === 'snapshot' && f.domain === 'sessions')!.value as import('../src/protocol.ts').SnapshotValues['sessions'];
  type List = { rows: import('../src/protocol.ts').SessionRow[]; processes: import('../src/protocol.ts').HarnessProcessView[]; waiting: import('../src/protocol.ts').WaitingLaunch[]; archived: number; pendingStops: unknown[]; adapters: unknown; coordinator: string | null };
  const before = (await ui.request({ type: 'session.list' })).value as List;
  const { rows, ...legacy } = before;
  assert.deepEqual(rows, snapshot.rows);
  assert.deepEqual(snapshot.remotes?.map(row => [row.messenger, row.enabled, row.connection]),
    [['telegram', false, 'disabled'], ['discord', false, 'disabled']]);
  assert.equal(JSON.stringify(legacy), JSON.stringify({ processes: snapshot.processes, waiting: [], archived: 0, pendingStops: [], adapters: before.adapters, coordinator: null }));
  const empty = (await ui.request({ type: 'session.list', archived: true })).value as List;
  assert.deepEqual(empty.rows, [], 'unmanaged presence does not leak into archived rows');
  const archived = await ui.request({ type: 'session.archive', session: 'worker' });
  assert.equal(archived.ok, true, archived.error);
  const after = (await ui.request({ type: 'session.list', archived: true })).value as List;
  const { rows: archivedRows, ...archivedLegacy } = after;
  assert.equal(JSON.stringify(archivedLegacy), JSON.stringify({ processes: [(archived.value as { process: unknown }).process], waiting: [], archived: 1, pendingStops: [], adapters: before.adapters, coordinator: null }));
  assert.deepEqual(archivedRows, [{ ...snapshot.rows.find(row => row.name === 'worker')!, archived: true, archivedAt: at, archivedBy: 'hand', layer: 'archive' }]);
  const active = (await ui.request({ type: 'session.list' })).value as List;
  assert.deepEqual(active.rows, snapshot.rows.filter(row => row.name !== 'worker'));
  assert.deepEqual(active.processes, snapshot.processes.filter(row => row.name !== 'worker'));
  assert.equal(active.archived, 1);
});

test('hello negotiates model features and legacy clients keep their existing welcome', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const legacy = await client(t, discovery);
  await legacy.waitFor(frame => frame.type === 'hosts.state');
  assert.deepEqual(legacy.frames[0], { type: 'welcome', name: 'ui', presence: [] });
  assert.deepEqual(legacy.frames.map(frame => frame.type), ['welcome', 'remote.state', 'hosts.state']);
  const ui = await client(t, discovery, ['snapshot', 'numbered-deltas', 'slim-frames', 'unknown', 'snapshot']);
  assert.deepEqual(ui.frames[0]!.features, ['snapshot', 'numbered-deltas', 'slim-frames']);
  const end = await ui.waitFor(f => f.type === 'snapshot.end');
  const snapshots = ui.frames.slice(1, -1);
  assert.deepEqual(snapshots.map(f => f.domain), ['tracker', 'items', 'sessions', 'topics', 'inbox', 'events', 'accounts']);
  assert.ok(typeof end.epoch === 'string' && end.epoch.length > 0);
  assert.ok(Number.isSafeInteger(end.seq));
  assert.ok(snapshots.every(f => f.type === 'snapshot' && f.epoch === end.epoch && f.seq === end.seq));
  assert.equal((await legacy.request({ type: 'topic.list' })).ok, true);
  assert.equal(legacy.frames.length, 3);
  const unknown = await client(t, discovery, ['future-extension']);
  assert.equal((await unknown.request({ type: 'topic.list' })).ok, true);
  assert.deepEqual(unknown.frames.map(f => [f.type, f.features]), [['welcome', []], ['remote.state', undefined], ['hosts.state', undefined]]);
  const again = await client(t, discovery, ['snapshot']);
  const next = await again.waitFor(f => f.type === 'snapshot.end');
  assert.equal(next.epoch, end.epoch);
  assert.equal(next.seq, end.seq, 'snapshots do not consume model delta numbers');
});

test('snapshot contains each workbench domain, compact verdict rounds and recent closed topics', async t => {
  const root = await tempProject(t);
  const at = '2026-10-16T12:00:00.000Z';
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await mkdir(join(root, 'config/cland'), { recursive: true });
  await writeFile(join(root, 'config/cland/accounts.toml'), '[accounts.fixture]\nharness = "codex"\n');
  await writeFile(join(root, '.cland/tasks/T-1-fixture.md'), serializeItem({
    fm: { id: 'T-1', kind: 'task', title: 'Fixture', state: 'open', size: 'S', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: at, updated: at },
    body: '## Acceptance criteria\n\n- [ ] C1. Works.',
    comments: [1, 2, 3].map(round => ({ author: 'reviewer', at, text: `Visible verdict reason ${round}. Private verdict history ${round}.`, verdict: { verdict: 'review', result: 'clear', by: 'reviewer', run: `r${round}` } })),
  }));
  const store = new Store(join(root, '.cland/hub.db'));
  store.createTopic('old-closed', 'Old closed', null, '2026-10-01T00:00:00.000Z');
  store.setTopicStatus('old-closed', 'closed', '2026-10-01T00:00:00.000Z');
  store.createTopic('recent-closed', 'Recent closed', null, '2026-10-10T12:00:00.000Z');
  store.setTopicStatus('recent-closed', 'closed', '2026-10-10T12:00:00.000Z');
  store.createTopic('boundary-closed', 'Boundary closed', null, '2026-10-09T12:00:00.000Z');
  store.setTopicStatus('boundary-closed', 'closed', '2026-10-09T12:00:00.000Z');
  store.close();
  const { discovery, fakes } = await projectHub(t, root, { XDG_CONFIG_HOME: join(root, 'config') }, { clock: new FakeClock(), accountReader: async () => [] });
  const legacy = await client(t, discovery);
  const launched = await legacy.request({ type: 'session.launch', name: 'coord', harness: 'claude-code', role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  const spoke = await connectSocket(discovery.socket);
  onCleanup(t, () => spoke.close());
  spoke.send({ type: 'hello', protocol: 2, secret: discovery.secret, name: 'coord', sessionId: (launched.value as { process: { sessionId: string } }).process.sessionId, cwd: root, launchToken: fakes['claude-code']!.spawns[0]!.launchToken });
  assert.equal((await spoke.next()).type, 'welcome');
  const sent = await legacy.request({ type: 'topic.send', topic: 'general', text: 'Snapshot event fixture' });
  assert.equal(sent.ok, true, sent.error);
  const ui = await client(t, discovery, ['snapshot']);
  await ui.waitFor(f => f.type === 'snapshot.end');
  const values = Object.fromEntries(ui.frames.filter(f => f.type === 'snapshot').map(f => [f.domain, f.value])) as import('../src/protocol.ts').SnapshotValues;
  assert.deepEqual(values.tracker.ladder, [['release', 'category'], ['epic']]);
  assert.deepEqual(values.tracker.levels, ['release', 'epic']);
  assert.deepEqual(values.items.items.map(i => [i.id, i.verdicts.map(v => [v.verdict, v.run, v.round])]), [['T-1', [['review', 'r3', 3]]]]);
  assert.equal(values.sessions.processes[0]?.name, 'coord');
  assert.equal(values.sessions.presence[0]?.name, 'coord');
  assert.equal(values.sessions.coordinator, 'coord');
  assert.ok(values.sessions.roles.roles.some(r => r.role === 'coordinator' && r.holders.some(h => h.name === 'coord')));
  assert.ok(values.sessions.crew.config.crew.implementer);
  assert.ok(values.sessions.verification);
  assert.ok(values.topics.topics.some(topic => topic.id === 'general'));
  assert.equal(typeof values.inbox.needsYou, 'number');
  assert.ok(values.events.rows.length > 0);
  assert.ok(values.events.rows.length <= 200);
  assert.equal(values.accounts.accounts[0]?.name, 'fixture');
  for (const f of ui.frames.filter(f => f.type === 'snapshot')) {
    assert.ok(Buffer.byteLength(JSON.stringify(f)) <= SNAPSHOT_LIMITS[f.domain as keyof typeof SNAPSHOT_LIMITS]);
  }
  const card=values.items.items[0]!;
  assert.equal(card.verdicts[0]?.reason,'Visible verdict reason 3.');
  for (const older of ['Visible verdict reason 1.','Visible verdict reason 2.']) {
    assert.equal(JSON.stringify(values).includes(older),false,'historical reasons stay on demand');
  }
  assert.equal(Object.hasOwn(card,'body'),false);assert.equal(Object.hasOwn(card,'comments'),false);
  assert.equal(JSON.stringify(values).includes('Private verdict history'), false);
  assert.equal(Object.hasOwn(values.sessions, 'suites'), false);
  const viewed = await legacy.request({ type: 'task.view', item: 'T-1' });
  assert.equal((viewed.value as { item: { verdicts: unknown[] } }).item.verdicts.length, 3);
  assert.deepEqual((viewed.value as {item:{comments:Array<{text:string}>}}).item.comments.map(c=>c.text),
    [1,2,3].map(round=>`Visible verdict reason ${round}. Private verdict history ${round}.`));
  assert.ok(values.topics.topics.some(topic => topic.id === 'recent-closed'));
  assert.ok(values.topics.topics.some(topic => topic.id === 'boundary-closed'));
  assert.ok(!values.topics.topics.some(topic => topic.id === 'old-closed'));
});

test('numbered model deltas continue the snapshot without gaps across tracker, topics, sessions and inbox', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await client(t, discovery, ['snapshot', 'numbered-deltas', 'slim-frames']);
  const end = await ui.waitFor(f => f.type === 'snapshot.end');
  // A featured snapshot starts the model stream; subscribe remains idempotent.
  const changed = ui.waitFor(f => f.type === 'task');
  assert.equal((await ui.request({ type: 'task.create', title: 'Numbered item', size: 'S' })).ok, true);
  await changed;
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'session.launch', name: 'coord', harness: 'claude-code', role: 'coordinator' })).ok, true);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Numbered message' })).ok, true);
  const inbox = ui.waitFor(f => f.type === 'inbox');
  await clock.advance(1000);
  await inbox;
  // An ordered request result fences every prior socket write, including coalesced inbox output.
  assert.equal((await ui.request({ type: 'topic.list' })).ok, true);
  const deltas = ui.frames.slice(ui.frames.indexOf(end) + 1);
  for (const type of ['task', 'topic', 'session.process', 'message', 'inbox']) assert.ok(deltas.some(f => f.type === type), type);
  assert.deepEqual(deltas.map(f => f.seq), deltas.map((_, i) => Number(end.seq) + i + 1));
  assert.ok(deltas.every(f => f.epoch === end.epoch));
});

test('slim task frames carry only changed layers, including changes to other items', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await client(t, discovery);
  const create = async (input: Record<string, unknown>) => {
    const result = await ui.request({ type: 'task.create', ...input });
    assert.equal(result.ok, true, result.error);
    return (result.value as { item: { id: string } }).item.id;
  };
  const first = await create({ kind: 'release', title: 'First', version: '1.0.0' });
  const second = await create({ kind: 'release', title: 'Second', version: '2.0.0' });
  const a = await create({ title: 'Active first', size: 'S', parent: first, status: 'planned' });
  const b = await create({ title: 'Active second', size: 'S', parent: second, status: 'planned' });
  for (const id of [a, b]) assert.equal((await ui.request({ type: 'task.edit', item: id, status: 'planned' })).ok, true);
  const featured = await client(t, discovery, ['snapshot', 'numbered-deltas', 'slim-frames']);
  await featured.waitFor(f => f.type === 'snapshot.end');
  await ui.request({ type: 'subscribe' });
  const changed = featured.waitFor(f => f.type === 'task' && f.id === a);
  assert.equal((await ui.request({ type: 'task.edit', item: a, title: 'Renamed first' })).ok, true);
  const delta = await changed;
  assert.equal((delta.item as { title: string }).title, 'Renamed first');
  assert.equal(Object.hasOwn(delta, 'items'), false);
  assert.deepEqual(delta.layers, {}, 'unchanged layers are not resent');
  const movedFrame = featured.waitFor(f => f.type === 'task' && f.id === first
    && (f.item as { version?: string } | null)?.version === '3.0.0');
  const edited = await ui.request({ type: 'task.edit', item: first, version: '3.0.0' });
  assert.equal(edited.ok, true, edited.error);
  const moved = await movedFrame;
  assert.deepEqual(moved.layers, { [a]: 'background', [b]: 'watch' });
  const legacy = ui.frames.findLast(f => f.type === 'task' && f.id === first)!;
  assert.deepEqual(legacy.layers, { [first]: 'background', [second]: 'background', [a]: 'background', [b]: 'watch' });
  assert.equal(Object.hasOwn(legacy, 'seq'), false);
});

test('pin and mute push re-projected topic and message rows to featured clients', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await client(t, discovery, ['snapshot', 'numbered-deltas', 'slim-frames']);
  await ui.waitFor(f => f.type === 'snapshot.end');
  const legacy = await client(t, discovery);
  await legacy.request({ type: 'subscribe' });
  await ui.request({ type: 'topic.send', topic: 'general', text: 'Placed message' });
  const created = await ui.request({ type: 'artifact.create', kind: 'note', topic: 'general', title: 'Placed artifact', content: 'Fixture' });
  assert.equal(created.ok, true, created.error);
  const artifact = (created.value as { artifact: { id: string } }).artifact.id;
  for (const [mode, layer, messageLayer] of [['pin', 'now', 'now'], ['pin', 'watch', 'now'], ['mute', 'background', 'watch'], ['mute', 'watch', 'now']] as const) {
    const mark = ui.frames.length;
    const changed = ui.waitFor(f => f.type === 'visibility' && ui.frames.indexOf(f) >= mark);
    const result = await ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode });
    assert.equal(result.ok, true, result.error);
    const frame = await changed;
    const rows = frame.rows as { topics: Array<{ id: string; layer: string }>; messages: Array<{ text: string; layer: string }>; artifacts: Array<{ id: string; layer: string }> };
    assert.equal(rows.topics.find(row => row.id === 'general')?.layer, layer);
    assert.equal(rows.messages.find(row => row.text === 'Placed message')?.layer, messageLayer);
    const read = await ui.request({ type: 'artifact.list', artifact });
    assert.equal(read.ok, true, read.error);
    assert.equal(rows.artifacts.find(row => row.id === artifact)?.layer, (read.value as { artifact: { layer: string } }).artifact.layer);
    assert.equal((await legacy.request({ type: 'topic.list' })).ok, true);
    assert.deepEqual(legacy.frames.findLast(f => f.type === 'visibility'), { type: 'visibility' });
  }
});

test('three clients serialize a model frame only once per negotiated feature set', async t => {
  const root = await tempProject(t);
  const { dispatcher } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const peers = [
    ['numbered-deltas', 'slim-frames'],
    ['slim-frames', 'numbered-deltas', 'numbered-deltas'],
    [],
  ].map(features => {
    const frames: HubFrame[] = [];
    const conversation = dispatcher.open({
      send: (frame, serialized) => { frames.push(JSON.parse(serialized ?? JSON.stringify(frame)) as HubFrame); },
      close: () => {}, isOpen: () => true,
    }, { authenticated: true, edge: 'socket' });
    onCleanup(t, () => conversation.closed());
    conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, client: 'ui', features }));
    conversation.receive(JSON.stringify({ type: 'subscribe', id: 'sub' }));
    return { frames, conversation };
  });
  let serializations = 0;
  const stringify = JSON.stringify;
  const mock = t.mock.method(JSON, 'stringify', (value: unknown) => {
    if ((value as { type?: string })?.type === 'topic') serializations++;
    return stringify(value);
  });
  peers[0]!.conversation.receive('{"type":"topic.create","id":"create","title":"Serialized once"}');
  mock.mock.restore();
  assert.ok(peers.every(peer => peer.frames.some(f => f.type === 'topic' && f.topic.title === 'Serialized once')));
  assert.equal(serializations, 2);
  const frame = (i: number) => peers[i]!.frames.find(f => f.type === 'topic' && f.topic.title === 'Serialized once');
  assert.deepEqual(frame(0), frame(1));
  assert.equal(Object.hasOwn(frame(2)!, 'seq'), false);
});

test('artifact placement re-projects retained older messages in bounded frames without unrelated history', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  const at = new FakeClock().now().toISOString();
  store.createTopic('general', 'General', null, at);
  const artifact = store.registerArtifact(id => ({ id, kind: 'note', title: 'History fixture', path: join(root, 'note.md'), creator: 'human', time: at, topic: 'general', status: 'shared' }), () => {});
  for (let n = 0; n < 401; n++) {
    for (const affected of [true, false]) store.record({ id: `${affected ? 'affected' : 'unrelated'}-${n}`, from: 'human', fromKind: 'human', via: 'hub', to: [], text: 'x'.repeat(8000), ts: at, topic: 'general', ...(affected ? { artifact } : {}) }, [], Date.parse(at));
  }
  // Simulate a pre-extension store: startup must backfill retained references,
  // rather than only finding attachments written by this version of record().
  store.setMeta('visibility-artifact-refs', '');
  store.close();
  const old = new DatabaseSync(join(root, '.cland/hub.db'));
  old.exec('drop table message_artifact_refs');
  old.close();
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await client(t, discovery, ['snapshot', 'numbered-deltas', 'slim-frames']);
  await ui.waitFor(f => f.type === 'snapshot.end');
  const changed = ui.waitFor(f => f.type === 'visibility');
  const result = await ui.request({ type: 'visibility.set', surface: 'artifacts', target: artifact.id, mode: 'pin' });
  assert.equal(result.ok, true, result.error);
  await changed;
  const frames = ui.frames.filter(f => f.type === 'visibility');
  assert.ok(frames.length > 1, 'retained rows are chunked, not truncated to the latest page');
  assert.ok(frames.every(f => Buffer.byteLength(JSON.stringify(f)) <= 1024 * 1024), 'every wire frame stays bounded');
  const messages = frames.flatMap(f => (f.rows as { messages: Array<{ id: string; layer: string }> }).messages);
  assert.deepEqual(messages.map(m => m.id).sort(), Array.from({ length: 401 }, (_, n) => `affected-${n}`).sort());
  assert.ok(messages.every(m => m.layer === 'now'));
});

test('topic placement re-projects old-thread creation chips after an artifact moves across topics', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await client(t, discovery, ['snapshot', 'numbered-deltas', 'slim-frames']);
  await ui.waitFor(f => f.type === 'snapshot.end');
  const topic = await ui.request({ type: 'topic.create', title: 'Destination' });
  assert.equal(topic.ok, true, topic.error);
  const destination = (topic.value as { topic: { id: string } }).topic.id;
  const source = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'note', title: 'Moved notes', content: 'Fixture' });
  const folder = await ui.request({ type: 'artifact.create', topic: destination, kind: 'note', title: 'Destination folder', folder: true, content: 'Folder' });
  assert.equal(source.ok, true, source.error); assert.equal(folder.ok, true, folder.error);
  const artifact = (source.value as { artifact: { id: string } }).artifact.id;
  const moved = await ui.request({ type: 'artifact.move', artifact, folder: (folder.value as { artifact: { id: string } }).artifact.id, name: 'moved.md' });
  assert.equal(moved.ok, true, moved.error);
  for (const mode of ['pin', 'pin', 'mute', 'mute'] as const) {
    const mark = ui.frames.length;
    const updated = await ui.request({ type: 'visibility.set', surface: 'topics', target: destination, mode });
    assert.equal(updated.ok, true, updated.error);
    const history = await ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true, history.error);
    type Row = { id: string; layer: string; artifact?: { id: string } };
    const fresh = (history.value as { messages: Row[] }).messages.find(message => message.artifact?.id === artifact)!;
    const pushed = ui.frames.slice(mark).filter(f => f.type === 'visibility').flatMap(f => (f.rows as { messages: Row[] }).messages);
    assert.deepEqual(pushed.find(row => row.id === fresh.id), fresh);
  }
});

test('a synchronous client action cannot invert delta order for another client', async t => {
  const root = await tempProject(t);
  const { dispatcher } = await projectHub(t, root, {}, { clock: new FakeClock() });
  let nested = false;
  const peers = [0, 1].map(index => {
    const frames: HubFrame[] = [];
    const conversation = dispatcher.open({
      send: frame => {
        frames.push(frame);
        if (index === 0 && frame.type === 'topic' && frame.topic.title === 'Outer' && !nested) {
          nested = true;
          conversation.receive('{"type":"topic.create","id":"nested","title":"Inner"}');
        }
      }, close: () => {}, isOpen: () => true,
    }, { authenticated: true, edge: 'socket' });
    onCleanup(t, () => conversation.closed());
    conversation.receive('{"type":"hello","protocol":2,"client":"ui","features":["numbered-deltas"]}');
    return { frames, conversation };
  });
  peers[0]!.conversation.receive('{"type":"topic.create","id":"outer","title":"Outer"}');
  const topics = peers.map(peer => peer.frames.filter(f => f.type === 'topic'));
  assert.deepEqual(topics[1], topics[0]);
  assert.deepEqual(topics[1]!.map(f => f.topic.title), ['Outer', 'Inner']);
});

test('an oversized domain refuses the whole snapshot and leaves legacy reads usable', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, 'config/cland'), { recursive: true });
  await writeFile(join(root, 'config/cland/accounts.toml'), `[accounts.large]\nharness = "codex"\nhome = "/${'x'.repeat(256 * 1024)}"\n`);
  const { discovery } = await projectHub(t, root, { XDG_CONFIG_HOME: join(root, 'config') });
  const ui = await client(t, discovery, ['snapshot']);
  const refusal = await ui.waitFor(f => f.type === 'snapshot.refused');
  assert.equal(refusal.code, 'frame-too-large');
  assert.equal(refusal.domain, 'accounts');
  assert.ok(Number(refusal.bytes) > Number(refusal.limit));
  assert.deepEqual(ui.frames.map(f => f.type), ['welcome', 'snapshot.refused']);
  const fallback = await ui.request({ type: 'task.list' });
  assert.equal(fallback.ok, true, fallback.error);
});

test('a model change raced against the first snapshot frame runs after its end marker', async t => {
  const root = await tempProject(t);
  const { dispatcher } = await projectHub(t, root);
  let receive = (_line: string) => {};
  let open = true;
  let raced = false;
  // Arm the competing microtask at the first frame: any yield during compose or
  // sends would let its subscribed message/result split the snapshot transaction.
  const conversation = dispatcher.open({
    send: frame => {
      receive(`${JSON.stringify(frame)}\n`);
      if (frame.type === 'snapshot' && !raced) {
        raced = true;
        queueMicrotask(() => conversation.receive(JSON.stringify({ type: 'topic.send', id: 'race', topic: 'general', text: 'raced change' })));
      }
    }, close: () => { open = false; }, isOpen: () => open,
  }, { authenticated: true, edge: 'socket' });
  const ui = frameClient(line => conversation.receive(line.trimEnd()), fn => { receive = fn; }, () => { open = false; conversation.closed(); });
  onCleanup(t, () => ui.close());
  const completed = ui.waitFor(f => f.type === 'result' && f.id === 'race');
  ui.send({ type: 'hello', protocol: 2, client: 'ui', features: ['snapshot'] });
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await completed).ok, true);
  const first = ui.frames.findIndex(f => f.type === 'snapshot');
  const end = ui.frames.findIndex(f => f.type === 'snapshot.end');
  assert.equal(end - first, 7);
  assert.ok(ui.frames.slice(first, end).every(f => f.type === 'snapshot'));
  assert.ok(ui.frames.findIndex(f => f.type === 'message') > end);
  assert.ok(ui.frames.findIndex(f => f.type === 'result' && f.id === 'race') > end);
  const topics = ui.frames.find(f => f.domain === 'topics')!.value as { topics: Array<{ id: string; unread: number }> };
  assert.equal(topics.topics.find(topic => topic.id === 'general')!.unread, 0);
});


test('changing an events subscription filters pages, snapshots, live rows and replay on the same connection', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await client(t, discovery, ['snapshot', 'numbered-deltas']);
  const initial = await ui.waitFor(f => f.type === 'snapshot.end');
  const all = await client(t, discovery);
  await all.request({ type: 'subscribe' });
  const topics: string[] = [];
  for (const title of ['Selected topic', 'Other topic']) {
    const created = await all.request({ type: 'topic.create', title });
    assert.equal(created.ok, true, created.error);
    topics.push((created.value as { topic: { id: string } }).topic.id);
  }
  await ui.request({ type: 'subscribe', filter: { warnings: true } });
  const changed = await ui.request({ type: 'subscribe', filter: { kinds: ['topic'], subject: { kind: 'topic', id: topics[0] } } });
  assert.equal(changed.ok, true, changed.error);
  type Page = import('../src/protocol.ts').EventsPage;
  const page = (changed.value as { events: Page }).events;
  assert.equal(page.rows.length, 1);
  assert.equal(page.rows[0]!.subject.id, topics[0]);
  assert.deepEqual((await ui.request({ type: 'events.list', limit: 1 })).value, page);
  const older = (await ui.request({ type: 'events.list', before: page.before, limit: 1 })).value as Page;
  assert.deepEqual(older.rows, []);
  const mark = ui.frames.length;
  for (const topic of topics) {
    const receipt = all.waitFor(f => f.type === 'event' && (f.row as { text: string }).text.includes(`${topic} closed`));
    assert.equal((await all.request({ type: 'topic.close', topic })).ok, true);
    await receipt;
  }
  await ui.request({ type: 'topic.list' });
  const live = ui.frames.slice(mark);
  assert.deepEqual(live.filter(f => f.type === 'event').map(f => (f.row as { subject: { id: string } }).subject.id), [topics[0]]);
  assert.ok(live.some(f => f.type === 'model.advance'));
  const numbered = ui.frames.slice(ui.frames.indexOf(initial) + 1);
  assert.deepEqual(numbered.map(f => f.seq), numbered.map((_, i) => Number(initial.seq) + i + 1));
  const replayMark = ui.frames.length;
  const replay = await ui.request({ type: 'resume', epoch: initial.epoch, seq: initial.seq });
  assert.equal(replay.ok, true, replay.error);
  assert.equal((replay.value as { replayed: boolean }).replayed, true);
  const replayed = ui.frames.slice(replayMark);
  assert.ok(replayed.some(f => f.type === 'event'));
  assert.ok(replayed.filter(f => f.type === 'event').every(f => (f.row as { subject: { id: string } }).subject.id === topics[0]));
  assert.deepEqual(replayed.map(f => f.seq), replayed.map((_, i) => Number(initial.seq) + i + 1));
  const snapshotMark = ui.frames.length;
  await ui.request({ type: 'resume', epoch: 'expired-epoch', seq: 0 });
  const events = ui.frames.slice(snapshotMark).find(f => f.type === 'snapshot' && f.domain === 'events')!.value as Page;
  assert.ok(events.rows.length > 0);
  assert.ok(events.rows.every(row => row.subject.id === topics[0]));
  assert.deepEqual((await ui.request({ type: 'subscribe' })).value, { subscribed: true });
  const reset = (await ui.request({ type: 'events.list' })).value as Page;
  assert.ok(reset.rows.some(row => row.subject.id === topics[1]));
  const received = ui.waitFor(f => f.type === 'event' && (f.row as { text: string }).text.includes(' created') && (f.row as { subject: { id: string } }).subject.id !== topics[0] && (f.row as { subject: { id: string } }).subject.id !== topics[1]);
  assert.equal((await all.request({ type: 'topic.create', title: 'Unfiltered again' })).ok, true);
  await received;
});
