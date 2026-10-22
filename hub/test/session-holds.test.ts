// T3: real hub restart, verifier SIGKILL and native early-first-turn pending work.
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, connectUi, eventually, fakeClaude, fakeCodex, killDaemon, nativeProjectHub as projectHub, spawnSpoke, startDaemon, tempProject, withDiscoveredPid } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('delivered verifier requests persist across restart and clear on hold, verdict, stop and death', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { reexecGraceMs: 100 });
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
  await killDaemon(discovered.pid);
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
