// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, connectWsUi, inProcessSpoke, projectHub, startHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Presence } from '../src/protocol.ts';
import { Tracker } from '../src/tracker/tracker.ts';

test('session frames show review and QA holds as they are taken and released', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Verify session holds' });
  const item = (made.value as { item: { id: string } }).item.id;
  for (const role of ['reviewer', 'qa'] as const) {
    const name = `verify-${role}`;
    const launched = await ui.request({ type: 'session.launch', name, role, harness: 'claude-code' }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const process = (launched.value as { process: HarnessProcessView }).process;

    const session = await inProcessSpoke(t, { discover: true, cwd: root, name, sessionId: process.sessionId, role });
    onCleanup(t, () => session.close());
    await session.waitForPresence([name]);
    const start = ui.frames.length;
    assert.equal((await session.call<{ ok: boolean }>('task.hold', { id: item })).ok, true);
    const held = await session.call<{ item: { holds: { heldAt: string }[] } }>('task.view', { id: item });
    const expected = [{ item, role: role === 'reviewer' ? 'review' : 'qa', heldAt: held.item.holds[0]!.heldAt }];
    const status = await ui.request({ type: 'hub.status' });
    assert.deepEqual((status.value as { sessions: Presence[] }).sessions.find(s => s.name === name)?.holds, expected);
    const listed = await ui.request({ type: 'session.list' });
    assert.deepEqual((listed.value as { processes: HarnessProcessView[] }).processes.find(s => s.name === name)?.holds, expected);
    await ui.waitFor(f => ui.frames.indexOf(f) >= start && f.type === 'presence' &&
      JSON.stringify((f.sessions as Presence[]).find(s => s.name === name)?.holds) === JSON.stringify(expected));
    await ui.waitFor(f => ui.frames.indexOf(f) >= start && f.type === 'session.process' &&
      (f.process as HarnessProcessView).name === name && JSON.stringify((f.process as HarnessProcessView).holds) === JSON.stringify(expected));
    const release = ui.frames.length;
    assert.equal((await session.call<{ ok: boolean }>('task.hold', { id: item, release: true })).ok, true);
    await ui.waitFor(f => ui.frames.indexOf(f) >= release && f.type === 'presence' &&
      JSON.stringify((f.sessions as Presence[]).find(s => s.name === name)?.holds) === '[]');
    await ui.waitFor(f => ui.frames.indexOf(f) >= release && f.type === 'session.process' &&
      (f.process as HarnessProcessView).name === name && JSON.stringify((f.process as HarnessProcessView).holds) === '[]');
  }
});

test('unknown-id Reviewer holds appear in session frames and remain isolated by name', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Unknown Reviewer hold' });
  const item = (made.value as { item: { id: string } }).item.id;
  const first = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev-first', sessionId: 'unknown', role: 'reviewer' });
  const second = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev-second', sessionId: 'unknown', role: 'reviewer' });
  onCleanup(t, () => first.close()); onCleanup(t, () => second.close());
  await first.waitForPresence(['rev-first', 'rev-second']);
  const start = ui.frames.length;
  assert.equal((await first.call<{ ok: boolean }>('task.hold', { id: item })).ok, true);
  const held = await first.call<{ item: { holds: { heldAt: string }[] } }>('task.view', { id: item });
  const expected = [{ item, role: 'review', heldAt: held.item.holds[0]!.heldAt }];
  const shown = await ui.request({ type: 'hub.status' });
  const sessions = (shown.value as { sessions: Presence[] }).sessions;
  assert.deepEqual(sessions.find(s => s.name === 'rev-first')?.holds, expected);
  assert.deepEqual(sessions.find(s => s.name === 'rev-second')?.holds, []);
  await ui.waitFor(f => ui.frames.indexOf(f) >= start && f.type === 'presence' &&
    JSON.stringify((f.sessions as Presence[]).find(s => s.name === 'rev-first')?.holds) === JSON.stringify(expected));
  const release = ui.frames.length;
  assert.equal((await first.call<{ ok: boolean }>('task.hold', { id: item, release: true })).ok, true);
  await ui.waitFor(f => ui.frames.indexOf(f) >= release && f.type === 'presence' &&
    (f.sessions as Presence[]).filter(s => s.name.startsWith('rev-')).every(s => s.holds?.length === 0));
});

test('removing an indexed item clears its claim and verifier hold from session work', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Removed work', assignee: 'impl' });
  const item = (made.value as { item: { id: string; path: string } }).item;
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'rev-id', role: 'reviewer' });
  onCleanup(t, () => impl.close()); onCleanup(t, () => rev.close());
  await rev.waitForPresence(['impl', 'rev']);
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: item.id })).ok, true);
  const heldAt = (await rev.call<{ item: { holds: { heldAt: string }[] } }>('task.view', { id: item.id })).item.holds[0]!.heldAt;
  const before = await ui.request({ type: 'hub.status' });
  const held = (before.value as { sessions: Presence[] }).sessions;
  assert.deepEqual(held.find(s => s.name === 'impl')?.holds, [{ item: item.id, role: 'item' }]);
  assert.deepEqual(held.find(s => s.name === 'rev')?.holds, [{ item: item.id, role: 'review', heldAt }]);
  const start = ui.frames.length;
  const contents = await readFile(join(root, item.path), 'utf8');
  await rm(join(root, item.path));
  await ui.waitFor(f => ui.frames.indexOf(f) >= start && f.type === 'task' && f.id === item.id && f.item === null);
  const after = await ui.request({ type: 'hub.status' });
  for (const session of (after.value as { sessions: Presence[] }).sessions) assert.deepEqual(session.holds, []);
  await ui.waitFor(f => ui.frames.indexOf(f) >= start && f.type === 'presence' &&
    (f.sessions as Presence[]).every(s => s.holds?.length === 0));
  // Ownership remains durable: restoring the file restores the projected work.
  const restored = ui.frames.length;
  await writeFile(join(root, item.path), contents);
  await ui.waitFor(f => ui.frames.indexOf(f) >= restored && f.type === 'presence' &&
    (f.sessions as Presence[]).every(s => s.holds?.some(h => h.item === item.id)));
  const recovered = await ui.request({ type: 'hub.status' });
  const work = (recovered.value as { sessions: Presence[] }).sessions;
  assert.deepEqual(work.find(s => s.name === 'impl')?.holds, [{ item: item.id, role: 'item' }]);
  assert.deepEqual(work.find(s => s.name === 'rev')?.holds, [{ item: item.id, role: 'review', heldAt }]);
});

test('session work is empty after tracker shutdown while sessions still disconnect', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), git: async () => null });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  const rev = await inProcessSpoke(t, { hub, name: 'rev-stopping', sessionId: 'stopping-id', role: 'reviewer' });
  onCleanup(t, () => rev.close());
  await rev.waitForPresence(['rev-stopping']);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Tracker shutdown work' });
  const item = (made.value as { item: { id: string } }).item.id;
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: item })).ok, true);
  const heldAt = (await rev.call<{ item: { holds: { heldAt: string }[] } }>('task.view', { id: item })).item.holds[0]!.heldAt;
  assert.deepEqual(hub.core.presence()[0]?.holds, [{ item, role: 'review', heldAt }]);
  await tracker.stop();
  assert.deepEqual(hub.core.presence()[0]?.holds, []);
});

test('session.list orders verifier holds newest first with their durable timestamps', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const ids: string[] = [];
  for (const title of ['Older hold', 'Latest hold']) {
    const made = await ui.request({ size: 'M', type: 'task.create', title });
    ids.push((made.value as { item: { id: string } }).item.id);
  }
  const launch = await ui.request({ type: 'session.launch', name: 'ordered-reviewer', role: 'reviewer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const processRow = (launch.value as { process: HarnessProcessView }).process;

  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: processRow.name, sessionId: processRow.sessionId, role: 'reviewer' });
  onCleanup(t, () => rev.close());
  await rev.waitForPresence([processRow.name]);
  for (const id of ids) assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id })).ok, true);
  const list = await ui.request({ type: 'session.list' });
  const holds = (list.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === processRow.name)!.holds!;
  assert.deepEqual(holds.map(h => h.item), [ids[1], ids[0]]);
  for (const hold of holds) assert.match(hold.heldAt!, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(holds[0]!.heldAt! >= holds[1]!.heldAt!);
});
