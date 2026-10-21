// T2: atomic reconnect over the real Unix edge; no hub child process.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { connectUi, frameClient, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';

type Cursor = { epoch: string; seq: number };
async function featured(t: TestContext, discovery: { socket: string; secret: string }, resume?: Cursor) {
  const socket = createConnection(discovery.socket);
  onCleanup(t, () => socket.destroy());
  await once(socket, 'connect', { signal: AbortSignal.timeout(2000) });
  socket.setEncoding('utf8');
  const ui = frameClient(line => socket.write(line), fn => socket.on('data', fn), () => socket.destroy());
  const welcome = ui.waitFor(f => f.type === 'welcome');
  ui.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'ui', features: ['snapshot', 'numbered-deltas', 'slim-frames'], ...(resume ? { resume } : {}) });
  await welcome;
  return ui;
}
const cursor = (frame: Record<string, unknown>): Cursor => ({ epoch: String(frame.epoch), seq: Number(frame.seq) });

test('atomic resume replays exactly five missed item deltas before the next live change', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const control = await connectUi(t, discovery);
  const ids: string[] = [];
  for (let n = 0; n < 5; n++) {
    const created = await control.request({ type: 'task.create', title: `Item ${n}`, size: 'S' });
    assert.equal(created.ok, true, created.error);
    ids.push((created.value as { item: { id: string } }).item.id);
  }
  const first = await featured(t, discovery);
  const end = await first.waitFor(f => f.type === 'snapshot.end');
  first.close();
  for (const [n, id] of ids.entries()) assert.equal((await control.request({ type: 'task.edit', item: id, title: `Changed ${n}` })).ok, true);
  const next = await featured(t, discovery, cursor(end));
  // The result is ordered behind catch-up and proves its completion even if no deltas arrive.
  assert.equal((await next.request({ type: 'topic.list' })).ok, true);
  const missed = next.frames.filter(f => f.type !== 'welcome');
  assert.deepEqual(missed.map(f => f.type), Array(5).fill('task'));
  assert.deepEqual(missed.map(f => f.id), ids);
  assert.deepEqual(missed.map(f => f.seq), [1, 2, 3, 4, 5].map(n => Number(end.seq) + n));
  assert.ok(missed.every(f => f.epoch === end.epoch));
  const live = next.waitFor(f => f.type === 'task' && f.seq === Number(end.seq) + 6);
  assert.equal((await control.request({ type: 'task.edit', item: ids[0], title: 'Live' })).ok, true);
  assert.equal(((await live).item as { title: string }).title, 'Live');
});

test('expired and foreign-epoch cursors fall back to a current snapshot; explicit resume excludes non-model frames', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const control = await connectUi(t, discovery);
  const ui = await featured(t, discovery);
  const end = await ui.waitFor(f => f.type === 'snapshot.end');
  assert.equal((await control.request({ type: 'task.create', title: 'Expired', size: 'S' })).ok, true);
  clock.block(15 * 60 * 1000 + 1);
  for (const stale of [cursor(end), { epoch: 'previous-epoch', seq: 0 }]) {
    const fallback = await featured(t, discovery, stale);
    const fresh = await fallback.waitFor(f => f.type === 'snapshot.end');
    assert.equal(fresh.epoch, end.epoch);
    assert.ok(Number(fresh.seq) > Number(end.seq));
    assert.deepEqual(fallback.frames.map(f => f.type), ['welcome', ...Array(7).fill('snapshot'), 'snapshot.end']);
    const mark = fallback.frames.length;
    const resumed = await fallback.request({ type: 'resume', ...cursor(fresh) });
    assert.equal(resumed.ok, true, resumed.error);
    assert.deepEqual(fallback.frames.slice(mark), [], 'welcome, snapshots and request results never become replay deltas');
    const snapshotMark = fallback.frames.length;
    const replaced = await fallback.request({ type: 'resume', epoch: 'foreign', seq: 0 });
    assert.equal(replaced.ok, true, replaced.error);
    assert.deepEqual(fallback.frames.slice(snapshotMark).map(f => f.type), [...Array(7).fill('snapshot'), 'snapshot.end']);
  }
});

test('two hub starts produce distinct epochs and a resume across them gets a new snapshot', async t => {
  const root = await tempProject(t);
  const firstHub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const first = await featured(t, firstHub.discovery);
  const end = await first.waitFor(f => f.type === 'snapshot.end');
  first.close();
  await firstHub.stop();
  await firstHub.stopped;
  const secondHub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const second = await featured(t, secondHub.discovery, cursor(end));
  const fresh = await second.waitFor(f => f.type === 'snapshot.end');
  assert.notEqual(fresh.epoch, end.epoch);
  assert.deepEqual(second.frames.map(f => f.type), ['welcome', ...Array(7).fill('snapshot'), 'snapshot.end']);
});
