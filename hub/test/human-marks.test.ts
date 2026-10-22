// T2: human marks through two real frame clients; persistence reopens an in-process hub.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { frameClient, projectHub, tempProject, type FrameClient } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';

async function client(t: TestContext, discovery: { socket: string; secret: string }): Promise<FrameClient> {
  const socket = createConnection(discovery.socket);
  onCleanup(t, () => socket.destroy());
  await once(socket, 'connect', { signal: AbortSignal.timeout(2000) });
  socket.setEncoding('utf8');
  const ui = frameClient(line => socket.write(line), fn => socket.on('data', fn), () => socket.destroy());
  const end = ui.waitFor(f => f.type === 'snapshot.end');
  ui.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'ui', features: ['snapshot', 'numbered-deltas'] });
  await end;
  return ui;
}
async function ok(ui: FrameClient, frame: { type: string } & Record<string, unknown>): Promise<any> {
  const r = await ui.request(frame);
  assert.equal(r.ok, true, r.error);
  return r.value;
}

test('C1: clients share monotonic events, plan receipts and topic read positions', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const a = await client(t, discovery), b = await client(t, discovery);
  const epic = (await ok(a, { type: 'task.create', kind: 'epic', title: 'Marked plan' })).item.id;
  const task = (await ok(a, { type: 'task.create', title: 'Work', size: 'S', parent: epic })).item.id;
  const receipts: string[] = [];
  for (const name of ['First', 'Second']) {
    await ok(a, { type: 'task.plan', op: 'set', item: epic, yaml: `stages:\n  - name: ${name}\n    qa: { scope: none, when: per-item }\n    lanes:\n      - - ${task}\n` });
    const history = (await ok(a, { type: 'task.plan', op: 'show', item: epic })).history;
    receipts.push(history.at(-1).id);
  }
  const changed = b.waitFor(f => f.type === 'marks' && (f.marks as any).events === '2026-10-22T12:00:00.000Z');
  const latest = await ok(a, { type: 'marks.set', events: '2026-10-22T12:00:00.000Z', plans: { [epic]: receipts[1] } });
  assert.deepEqual((await changed).marks, latest.marks);
  await ok(b, { type: 'marks.set', events: '2026-10-21T12:00:00.000Z', plans: { [epic]: receipts[0] } });
  assert.deepEqual(await ok(a, { type: 'marks.get' }), latest);
  const fresh = await client(t, discovery);
  assert.deepEqual((fresh.frames.find(f => f.type === 'snapshot' && f.domain === 'topics')!.value as any).marks, latest.marks);
  const messages = [];
  for (const text of ['one', 'two']) messages.push((await ok(a, { type: 'topic.send', topic: 'general', text })).message.id);
  const newest = await ok(a, { type: 'topic.read', topic: 'general', upTo: messages[1] });
  const older = await ok(b, { type: 'topic.read', topic: 'general', upTo: messages[0] });
  assert.equal(older.topic.readSeq, newest.topic.readSeq);
  assert.ok(newest.topic.readSeq > 0);
  const imported = await ok(b, { type: 'marks.set', import: true, events: '2026-10-20T00:00:00.000Z', plans: { [epic]: receipts[0] } });
  assert.equal(imported.marks.events, latest.marks.events);
  assert.deepEqual(imported.marks.plans, latest.marks.plans);
  assert.equal(imported.marks.imported, true);
  assert.deepEqual(await ok(a, { type: 'marks.set', import: true, events: '2099-01-01T00:00:00Z' }), imported);
});

test('C4: human marks survive reopening the hub with their topic positions and import receipt', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const a = await client(t, hub.discovery);
  const marked = await ok(a, { type: 'marks.set', import: true, events: '2026-10-22T12:00:00.000Z', plans: { 'E-99': 'retained-away-receipt' } });
  const message = (await ok(a, { type: 'topic.send', topic: 'general', text: 'Read before restart' })).message.id;
  const read = await ok(a, { type: 'topic.read', topic: 'general', upTo: message });
  a.close();
  await hub.stop();
  const restarted = await projectHub(t, root, {}, { clock: new FakeClock() });
  const b = await client(t, restarted.discovery);
  const snapshot = b.frames.find(f => f.type === 'snapshot' && f.domain === 'topics')!.value as any;
  assert.deepEqual(snapshot.marks, marked.marks);
  assert.equal(snapshot.topics.find((topic: any) => topic.id === 'general').readSeq, read.topic.readSeq);
  assert.deepEqual(await ok(b, { type: 'marks.get' }), marked);
  assert.deepEqual(await ok(b, { type: 'marks.set', import: true, events: '2099-01-01T00:00:00Z' }), marked);
});
