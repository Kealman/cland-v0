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
import { FakeClock } from './fake-clock.ts';
import { SNAPSHOT_LIMITS } from '../src/protocol.ts';
import type { HubFrame } from '../src/protocol.ts';
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

test('hello negotiates model features and legacy clients keep their existing welcome', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const legacy = await client(t, discovery);
  assert.deepEqual(legacy.frames, [{ type: 'welcome', name: 'ui', presence: [] }]);
  const ui = await client(t, discovery, ['snapshot', 'numbered-deltas', 'slim-frames', 'unknown', 'snapshot']);
  assert.deepEqual(ui.frames[0]!.features, ['snapshot', 'numbered-deltas', 'slim-frames']);
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
  const movedFrame = featured.waitFor(f => f.type === 'task' && f.id === first);
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
      send: frame => { frames.push(JSON.parse(JSON.stringify(frame)) as HubFrame); },
      sendSerialized: line => { frames.push(JSON.parse(line) as HubFrame); },
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
