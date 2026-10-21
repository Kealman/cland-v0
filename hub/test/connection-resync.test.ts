// T2: dispatcher and stalled reader boundary, with durable frame receipts before resume.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import type { HubFrame } from '../src/protocol.ts';
import { connectUi, dispatcherUi, eventually, frameClient, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';

test('a resynced model resumes from its applied number without duplicates and keeps requests usable', async t => {
  const root = await tempProject(t);
  const { dispatcher } = await projectHub(t, root, {}, { clock: new FakeClock() });
  let bytes = 0;
  let receive = (_line: string) => {};
  const sink = {
    bufferedBytes: () => bytes,
    send: (frame: HubFrame) => { bytes += Buffer.byteLength(JSON.stringify(frame)); receive(`${JSON.stringify(frame)}\n`); },
    isOpen: () => true,
    close: () => {},
  };
  const conversation = dispatcher.open(sink, { authenticated: true, edge: 'socket' });
  const ui = frameClient(line => conversation.receive(line.trimEnd()), fn => { receive = fn; }, () => conversation.closed());
  onCleanup(t, () => ui.close());
  const snapshot = ui.waitFor(f => f.type === 'snapshot.end');
  ui.send({ type: 'hello', protocol: 2, client: 'ui', features: ['snapshot', 'numbered-deltas', 'slim-frames'] });
  const end = await snapshot;
  bytes = 4 * 1024 * 1024; // stalled reader's existing unsent transport queue
  assert.equal((await ui.request({ type: 'task.create', title: 'Held first', size: 'S' })).ok, true);
  assert.equal((await ui.request({ type: 'task.create', title: 'Held second', size: 'S' })).ok, true);
  assert.deepEqual(ui.frames.slice(ui.frames.indexOf(end) + 1), [{ type: 'resync', reason: 'queue-limit' }]);
  bytes = 0; // reader drained queued frames and resync
  const mark = ui.frames.length;
  const result = await ui.request({ type: 'resume', epoch: end.epoch, seq: end.seq });
  assert.equal(result.ok, true, result.error);
  const replay = ui.frames.slice(mark);
  assert.deepEqual(replay.map(f => f.type), ['task', 'task']);
  assert.deepEqual(replay.map(f => f.seq), [Number(end.seq) + 1, Number(end.seq) + 2]);
  assert.deepEqual(replay.map(f => (f.item as { title: string }).title), ['Held first', 'Held second']);
  assert.equal((await ui.request({ type: 'task.create', title: 'Live third', size: 'S' })).ok, true);
  assert.deepEqual(ui.frames.slice(mark).map(f => f.seq), [1, 2, 3].map(n => Number(end.seq) + n));
});

test('a paused real socket reader receives resync, drains and resumes its model', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const control = await connectUi(t, discovery);
  const created = await control.request({ type: 'task.create', title: 'Large changing item', size: 'S' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const socket = createConnection(discovery.socket);
  onCleanup(t, () => socket.destroy());
  await once(socket, 'connect', { signal: AbortSignal.timeout(2000) });
  socket.setEncoding('utf8');
  const ui = frameClient(line => socket.write(line), fn => socket.on('data', fn), () => socket.destroy());
  const snapshot = ui.waitFor(f => f.type === 'snapshot.end');
  ui.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'ui', features: ['snapshot', 'numbered-deltas', 'slim-frames'] });
  const end = await snapshot;
  // frameClient's collection observer is armed before publication; no drain timer yet.
  const observedResync = () => ui.frames.find(f => f.type === 'resync');
  socket.pause();
  for (let n = 0; n < 12; n++) {
    const sent = await control.request({ type: 'task.edit', item, title: `${n}:` + 'x'.repeat(700 * 1024) });
    assert.equal(sent.ok, true, sent.error);
  }
  socket.resume();
  const resync = await eventually('resync after edit batch completion and reader release', observedResync, 2000);
  assert.equal(resync.reason, 'queue-limit');
  // Fence the queue after drain before using the last applied delta's own cursor.
  assert.equal((await ui.request({ type: 'topic.list' })).ok, true);
  const applied = ui.frames.findLast(f => typeof f.epoch === 'string' && f.type !== 'snapshot' && f.type !== 'snapshot.end') ?? end;
  const mark = ui.frames.length;
  const result = await ui.request({ type: 'resume', epoch: applied.epoch, seq: applied.seq });
  assert.equal(result.ok, true, result.error);
  const next = ui.frames.slice(mark);
  if ((result.value as { replayed: boolean }).replayed) {
    assert.deepEqual(next.map(f => f.seq), next.map((_, i) => Number(applied.seq) + i + 1));
  } else {
    assert.equal(next.at(-1)?.type, 'snapshot.end');
    assert.ok(Number(next.at(-1)?.seq) > Number(applied.seq));
  }
  assert.equal(next.some(f => f.type === 'resync'), false);
});

test('a synchronous action during replay cannot insert a live delta before the remaining missed deltas', async t => {
  const root = await tempProject(t);
  const { dispatcher } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const frames: HubFrame[] = [];
  const writer = dispatcher.open({ send: () => {}, close: () => {}, isOpen: () => true }, { authenticated: true, edge: 'socket' });
  onCleanup(t, () => writer.closed());
  writer.receive('{"type":"hello","protocol":2,"client":"ui"}');
  const control = await dispatcherUi(t, dispatcher, root);
  const initial = await control.request({ type: 'resume', epoch: 'absent', seq: 0 });
  assert.equal(initial.ok, false, 'unfeatured clients cannot resume');
  const baseline: Record<string, unknown>[] = [];
  const observer = dispatcher.open({ send: frame => baseline.push(frame), close: () => {}, isOpen: () => true }, { authenticated: true, edge: 'socket' });
  onCleanup(t, () => observer.closed());
  observer.receive('{"type":"hello","protocol":2,"client":"ui","features":["numbered-deltas"]}');
  await control.request({ type: 'task.create', title: 'Before disconnect', size: 'S' });
  const cursor = baseline.findLast(f => typeof f.seq === 'number')!;
  observer.closed();
  await control.request({ type: 'task.create', title: 'Missed first', size: 'S' });
  await control.request({ type: 'task.create', title: 'Missed second', size: 'S' });
  let raced = false;
  const next = dispatcher.open({
    send: frame => {
      frames.push(frame);
      if (frame.type === 'task' && !raced) {
        raced = true;
        writer.receive('{"type":"topic.create","id":"race","title":"During replay"}');
      }
    }, close: () => {}, isOpen: () => true,
  }, { authenticated: true, edge: 'socket' });
  onCleanup(t, () => next.closed());
  next.receive(JSON.stringify({ type: 'hello', protocol: 2, client: 'ui', features: ['numbered-deltas'], resume: { epoch: cursor.epoch, seq: cursor.seq } }));
  assert.deepEqual(frames.filter(f => f.type !== 'welcome').map(f => f.type), ['task', 'task', 'topic']);
  assert.deepEqual(frames.filter(f => f.type === 'task').map(f => f.item?.title), ['Missed first', 'Missed second']);
});

test('explicit resume invalidates an existing subscriber captured by in-flight and queued publications', async t => {
  const root = await tempProject(t);
  const { dispatcher } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const control = await dispatcherUi(t, dispatcher, root);
  const received: HubFrame[] = [];
  let later: ReturnType<typeof dispatcher.open>;
  let resumed = false;
  const earlier = dispatcher.open({
    send: frame => {
      if (frame.type === 'task' && 'seq' in frame && !resumed) {
        resumed = true;
        // This publication captures the old later subscription but is queued behind fan-out.
        earlier.receive('{"type":"topic.create","id":"nested","title":"Queued during fan-out"}');
        later.receive(JSON.stringify({ type: 'resume', id: 'resume', epoch: frame.epoch, seq: frame.seq - 1 }));
      }
    }, close: () => {}, isOpen: () => true,
  }, { authenticated: true, edge: 'socket' });
  later = dispatcher.open({ send: frame => received.push(frame), close: () => {}, isOpen: () => true }, { authenticated: true, edge: 'socket' });
  onCleanup(t, () => { earlier.closed(); later.closed(); });
  for (const peer of [earlier, later]) peer.receive('{"type":"hello","protocol":2,"client":"ui","features":["numbered-deltas"]}');
  assert.equal((await control.request({ type: 'task.create', title: 'Published once', size: 'S' })).ok, true);
  const deltas = received.filter(f => 'seq' in f);
  assert.deepEqual(deltas.map(f => f.type), ['task', 'topic']);
  assert.deepEqual(deltas.map(f => f.seq), [1, 2]);
  assert.equal(received.filter(f => f.type === 'result' && f.id === 'resume' && f.ok).length, 1);
});
