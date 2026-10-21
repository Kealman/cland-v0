// T2: client negotiation and ordered snapshot frames over the real Unix edge.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serializeItem } from '../src/tracker/item.ts';
import { Store } from '../src/hub/store.ts';
import { FakeClock } from './fake-clock.ts';
import { SNAPSHOT_LIMITS } from '../src/protocol.ts';
import { connectSocket, frameClient, projectHub, tempProject, type FrameClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';

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

test('hello negotiates snapshot alone and legacy clients keep their existing welcome', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const legacy = await client(t, discovery);
  assert.deepEqual(legacy.frames, [{ type: 'welcome', name: 'ui', presence: [] }]);
  const ui = await client(t, discovery, ['snapshot', 'numbered-deltas', 'slim-frames', 'unknown', 'snapshot']);
  assert.deepEqual(ui.frames[0]!.features, ['snapshot']);
  const end = await ui.waitFor(f => f.type === 'snapshot.end');
  const snapshots = ui.frames.slice(1, -1);
  assert.deepEqual(snapshots.map(f => f.domain), ['tracker', 'items', 'sessions', 'topics', 'inbox', 'events', 'accounts']);
  assert.ok(typeof end.epoch === 'string' && end.epoch.length > 0);
  assert.ok(Number.isSafeInteger(end.seq));
  assert.ok(snapshots.every(f => f.type === 'snapshot' && f.epoch === end.epoch && f.seq === end.seq));
  assert.equal((await legacy.request({ type: 'topic.list' })).ok, true);
  assert.equal(legacy.frames.length, 1);
  const unknown = await client(t, discovery, ['future-extension']);
  assert.equal((await unknown.request({ type: 'topic.list' })).ok, true);
  assert.deepEqual(unknown.frames.map(f => [f.type, f.features]), [['welcome', []]]);
  const again = await client(t, discovery, ['snapshot']);
  const next = await again.waitFor(f => f.type === 'snapshot.end');
  assert.equal(next.epoch, end.epoch);
  assert.ok(Number(next.seq) > Number(end.seq));
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
    comments: [1, 2, 3].map(round => ({ author: 'reviewer', at, text: 'Private verdict history', verdict: { verdict: 'review', result: 'clear', by: 'reviewer', run: `r${round}` } })),
  }));
  const store = new Store(join(root, '.cland/hub.db'));
  store.createTopic('old-closed', 'Old closed', null, '2026-10-01T00:00:00.000Z');
  store.setTopicStatus('old-closed', 'closed', '2026-10-01T00:00:00.000Z');
  store.createTopic('recent-closed', 'Recent closed', null, '2026-10-10T12:00:00.000Z');
  store.setTopicStatus('recent-closed', 'closed', '2026-10-10T12:00:00.000Z');
  store.createTopic('boundary-closed', 'Boundary closed', null, '2026-10-09T12:00:00.000Z');
  store.setTopicStatus('boundary-closed', 'closed', '2026-10-09T12:00:00.000Z');
  store.close();
  const { discovery, fakes } = await projectHub(t, root, { XDG_CONFIG_HOME: join(root, 'config') }, { clock: new FakeClock() });
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
  assert.equal(JSON.stringify(values).includes('Private verdict history'), false);
  assert.equal(Object.hasOwn(values.sessions, 'suites'), false);
  const viewed = await legacy.request({ type: 'task.view', item: 'T-1' });
  assert.equal((viewed.value as { item: { verdicts: unknown[] } }).item.verdicts.length, 3);
  assert.ok(values.topics.topics.some(topic => topic.id === 'recent-closed'));
  assert.ok(values.topics.topics.some(topic => topic.id === 'boundary-closed'));
  assert.ok(!values.topics.topics.some(topic => topic.id === 'old-closed'));
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
