import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withDiscoveredPid, cland, connectUi, connectWsUi, eventually, fakeClaude, fakeCodex, spawnSpoke, projectHub, startDaemon, startHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Presence } from '../src/protocol.ts';
import { Tracker } from '../src/tracker/tracker.ts';

test('session frames show review and QA holds as they are taken and released', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Verify session holds' });
  const item = (made.value as { item: { id: string } }).item.id;
  for (const role of ['reviewer', 'qa'] as const) {
    const name = `verify-${role}`;
    const launched = await ui.request({ type: 'session.launch', name, role, harness: 'claude-code' }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const process = (launched.value as { process: HarnessProcessView }).process;
    // Wait for the native MCP spoke before connecting the observer.
    await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === process.sessionId);
    const session = await spawnSpoke({ discover: true, cwd: root, name, sessionId: process.sessionId, role });
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
  const first = await spawnSpoke({ discover: true, cwd: root, name: 'rev-first', sessionId: 'unknown', role: 'reviewer' });
  const second = await spawnSpoke({ discover: true, cwd: root, name: 'rev-second', sessionId: 'unknown', role: 'reviewer' });
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
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', sessionId: 'rev-id', role: 'reviewer' });
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
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  const rev = await spawnSpoke({ hub, name: 'rev-stopping', sessionId: 'stopping-id', role: 'reviewer' });
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
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
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
  // Wait for the native MCP spoke before connecting the observer.
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === processRow.sessionId);
  const rev = await spawnSpoke({ discover: true, cwd: root, name: processRow.name, sessionId: processRow.sessionId, role: 'reviewer' });
  onCleanup(t, () => rev.close());
  await rev.waitForPresence([processRow.name]);
  for (const id of ids) assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id })).ok, true);
  const list = await ui.request({ type: 'session.list' });
  const holds = (list.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === processRow.name)!.holds!;
  assert.deepEqual(holds.map(h => h.item), [ids[1], ids[0]]);
  for (const hold of holds) assert.match(hold.heldAt!, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(holds[0]!.heldAt! >= holds[1]!.heldAt!);
});

test('delivered verifier requests persist across restart and clear on hold, verdict, stop and death', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const started = await startDaemon(t, root, fake.env);
  let ui = await connectUi(t, started.discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord-pending', sessionId: 'coord-pending-id', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  const ids: string[] = [];
  for (const title of ['First request', 'Newer request']) {
    const made = await ui.request({ size: 'M', type: 'task.create', title });
    ids.push((made.value as { item: { id: string } }).item.id);
  }
  const launch = await ui.request({ type: 'session.launch', name: 'pending-reviewer', role: 'reviewer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const processRow = (launch.value as { process: HarnessProcessView }).process;
  // Wait for the native MCP spoke before connecting the observer.
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === processRow.sessionId);
  let rev = await spawnSpoke({ discover: true, cwd: root, name: processRow.name, sessionId: processRow.sessionId, role: 'reviewer' });
  onCleanup(t, () => rev.close());
  await rev.waitForPresence(['coord-pending', processRow.name]);
  const row = async () => ((await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes.find(p => p.name === processRow.name)!;
  const request = async (text: string) => {
    const before = rev.events.length;
    assert.equal((await coord.call<{ ok: boolean }>('send', { to: [processRow.name], text })).ok, true);
    await rev.waitForEvent(e => rev.events.indexOf(e) >= before && e.params.content === text);
  };
  await request(`review request ${ids[0]}\nFirst build`);
  await eventually('pending review is delivered', async () => (await row()).pending?.item === ids[0] || undefined);
  assert.deepEqual((await row()).pending, { item: ids[0], kind: 'review' });
  await request(`qa request E-${ids[1]!.split('-')[1]} stage the verifier`);
  await eventually('newer prefixed request replaces pending', async () => (await row()).pending?.item === ids[1] || undefined);
  assert.deepEqual((await row()).pending, { item: ids[1], kind: 'qa' });
  await request('review request Q-999999');
  assert.equal((await row()).pending?.item, ids[1], 'unknown items do not replace pending work');
  await rev.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const restarted = await startDaemon(t, root, fake.env);
  ui = await connectUi(t, restarted.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.deepEqual((await row()).pending, { item: ids[1], kind: 'qa' });
  // Only the native spoke can now make the reviewer present. Reattach the observer after it,
  // since restart reconnects the two spokes independently and deliveries go to the newest.
  await coord.waitForPresence(['coord-pending', processRow.name]);
  rev = await spawnSpoke({ discover: true, cwd: root, name: processRow.name, sessionId: processRow.sessionId, assignRole: false });
  await rev.waitForPresence(['coord-pending', processRow.name]);
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: ids[1] })).ok, true);
  assert.equal((await row()).pending, undefined);
  await request(`review request ${ids[1]}`);
  assert.equal((await row()).pending, undefined, 'a request for an already-held item stays held');
  await rev.call('task.hold', { id: ids[1], release: true });
  await request(`review request ${ids[0]}`);
  await eventually('request before verdict', async () => (await row()).pending?.item === ids[0] || undefined);
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: ids[0], verdict: 'review', scope: 'full', result: 'clear', run: 'pending-verdict', text: 'Reviewed' })).ok, true);
  assert.equal((await row()).pending, undefined);
  await request(`qa request ${ids[1]}`);
  await eventually('request before stop', async () => (await row()).pending?.item === ids[1] || undefined);
  assert.equal((await ui.request({ type: 'session.stop', session: processRow.name }, 30_000)).ok, true);
  assert.equal((await row()).pending, undefined);
  const death = await ui.request({ type: 'session.launch', name: 'pending-qa', role: 'qa', harness: 'claude-code' }, 30_000);
  assert.equal(death.ok, true, death.error);
  const dying = (death.value as { process: HarnessProcessView }).process;
  // Wait for the native MCP spoke before connecting the observer.
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === dying.sessionId);
  const next = await spawnSpoke({ discover: true, cwd: root, name: dying.name, sessionId: dying.sessionId, assignRole: false });
  onCleanup(t, () => next.close());
  await next.waitForPresence(['coord-pending', dying.name]);
  await coord.call('send', { to: [dying.name], text: `qa request ${ids[0]}` });
  const dyingRow = async () => ((await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes.find(p => p.name === dying.name)!;
  await eventually('request before death', async () => (await dyingRow()).pending?.item === ids[0] || undefined);
  const discovered = await withDiscoveredPid(ui, dying);
  process.kill(discovered.pid, 'SIGKILL');
  await eventually('dead session clears pending', async () => (await dyingRow()).status === 'exited' && !(await dyingRow()).pending || undefined);
});


test('a native first-turn verifier request counts as delivered pending work', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Native first-turn review' });
  const item = (made.value as { item: { id: string } }).item.id;
  const launched = await ui.request({ type: 'session.launch', name: 'native-reviewer', role: 'reviewer', harness: 'codex', brief: `review request ${item}` }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  assert.deepEqual((launched.value as { process: HarnessProcessView }).process.pending, { item, kind: 'review' });
});
