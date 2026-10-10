import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, connectWsUi, fakeClaude, spawnSpoke, startDaemon, startHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Presence } from '../src/protocol.ts';
import { Tracker } from '../src/tracker/tracker.ts';

test('session frames show review and QA holds as they are taken and released', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ type: 'task.create', title: 'Verify session holds' });
  const item = (made.value as { item: { id: string } }).item.id;
  for (const role of ['reviewer', 'qa'] as const) {
    const name = `verify-${role}`;
    const launched = await ui.request({ type: 'session.launch', name, role, harness: 'claude-code' }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const process = (launched.value as { process: HarnessProcessView }).process;
    const session = await spawnSpoke({ discover: true, cwd: root, name, sessionId: process.sessionId, role });
    t.after(() => session.close());
    await session.waitForPresence([name]);
    const start = ui.frames.length;
    assert.equal((await session.call<{ ok: boolean }>('task.hold', { id: item })).ok, true);
    const expected = [{ item, role: role === 'reviewer' ? 'review' : 'qa' }];
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
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ type: 'task.create', title: 'Unknown Reviewer hold' });
  const item = (made.value as { item: { id: string } }).item.id;
  const first = await spawnSpoke({ discover: true, cwd: root, name: 'rev-first', sessionId: 'unknown', role: 'reviewer' });
  const second = await spawnSpoke({ discover: true, cwd: root, name: 'rev-second', sessionId: 'unknown', role: 'reviewer' });
  t.after(async () => { await first.close(); await second.close(); });
  await first.waitForPresence(['rev-first', 'rev-second']);
  const start = ui.frames.length;
  assert.equal((await first.call<{ ok: boolean }>('task.hold', { id: item })).ok, true);
  const expected = [{ item, role: 'review' }];
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
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ type: 'task.create', title: 'Removed work', assignee: 'impl' });
  const item = (made.value as { item: { id: string; path: string } }).item;
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', sessionId: 'rev-id', role: 'reviewer' });
  t.after(async () => { await impl.close(); await rev.close(); });
  await rev.waitForPresence(['impl', 'rev']);
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: item.id })).ok, true);
  const before = await ui.request({ type: 'hub.status' });
  const held = (before.value as { sessions: Presence[] }).sessions;
  assert.deepEqual(held.find(s => s.name === 'impl')?.holds, [{ item: item.id, role: 'item' }]);
  assert.deepEqual(held.find(s => s.name === 'rev')?.holds, [{ item: item.id, role: 'review' }]);
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
  assert.deepEqual(work.find(s => s.name === 'rev')?.holds, [{ item: item.id, role: 'review' }]);
});

test('session work is empty after tracker shutdown while sessions still disconnect', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  tracker.start();
  t.after(() => tracker.stop());
  const hub = await startHub({ tracker });
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  const rev = await spawnSpoke({ hub, name: 'rev-stopping', sessionId: 'stopping-id', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev-stopping']);
  const made = await ui.request({ type: 'task.create', title: 'Tracker shutdown work' });
  const item = (made.value as { item: { id: string } }).item.id;
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: item })).ok, true);
  assert.deepEqual(hub.core.presence()[0]?.holds, [{ item, role: 'review' }]);
  await tracker.stop();
  assert.deepEqual(hub.core.presence()[0]?.holds, []);
});
