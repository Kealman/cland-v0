import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, fakeClaude, startDaemon, tempProject } from './harness.ts';
import type { Inbox } from '../src/protocol.ts';

for (const [terminal, role, expected] of [['stopped', 'implementer', 'background'], ['exited', 'implementer', 'background'], ['stopped', 'aide', 'now']] as const) {
  test(`live ${role} ${terminal} state keeps terminal placement under an idle-now override`, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[visibility]\nsessions.idle = "now"\n');
    const fake = await fakeClaude(t, { pollMs: 50 });
    const { discovery } = await startDaemon(t, root, fake.env);
    const ui = await connectUi(t, discovery);
    await ui.request({ type: 'subscribe' });
    const launched = await ui.request({ type: 'session.launch', name: 'worker', role, harness: 'claude-code' }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const processRow = (launched.value as { process: { sessionId: string; pid: number } }).process;
    if (terminal === 'stopped') assert.equal((await ui.request({ type: 'session.stop', session: 'worker' }, 30_000)).ok, true);
    else process.kill(processRow.pid, 'SIGKILL');
    const changed = await ui.waitFor(f => f.type === 'session.process' && (f.process as { status: string }).status === terminal);
    assert.equal((changed.process as { layer: string }).layer, expected);
    const state = await ui.waitFor(f => f.type === 'session.state' && f.sessionId === processRow.sessionId && f.state === 'unknown' && f.source === (terminal === 'stopped' ? 'stopped' : 'process'));
    assert.equal(state.layer, expected, 'the following state event must keep terminal status and the Aide exception');
  });
}

test('project visibility raises a fake harness long idle to now in inbox events and hub.status', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[visibility]\ninbox.idle = "now"\n');
  const fake = await fakeClaude(t, { pollMs: 60_000, pushTrustMs: 120_000 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: '100' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launch = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const ib = await eventually('long idle is now', async () => {
    const r = await ui.request({ type: 'inbox.list' });
    const value = r.value as Inbox;
    return value.notifications.some(n => n.kind === 'idle') ? value : undefined;
  });
  assert.equal(ib.notifications.find(n => n.kind === 'idle')?.layer, 'now');
  assert.equal(ib.needsYou, 1);
  const status = await ui.request({ type: 'hub.status' });
  assert.equal((status.value as { needsYou: number }).needsYou, 1);
  const pushed = await ui.waitFor(f => f.type === 'inbox' && (f.inbox as Inbox).notifications.some(n => n.kind === 'idle'));
  assert.equal((pushed.inbox as Inbox).needsYou, 1);
  await ui.request({ type: 'inbox.dismiss', notification: ib.notifications.find(n => n.kind === 'idle')!.id });
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { needsYou: number }).needsYou, 0);
});

test('the hub places messages, sessions, items and artifacts by the default table on snapshots and live frames', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const { spawnSpoke } = await import('./harness.ts');
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => coord.close()); t.after(() => impl.close());
  await coord.waitForPresence(['coord', 'impl']);
  await coord.call('send', { topic: 'general', text: 'Report to the human' });
  await impl.call('send', { topic: 'general', text: 'Implementation question', to: ['coord'] });
  await ui.request({ type: 'topic.send', topic: 'general', text: '@impl what changed?' });
  const direct = await impl.call<{ ok: boolean; error?: string }>('send', { topic: 'general', text: 'Direct human report' });
  assert.equal(direct.ok, true, direct.error);
  const { messages } = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ id: string; text: string; layer: string }> };
  for (const [text, layer] of [['Report to the human', 'watch'], ['Implementation question', 'background'], ['Direct human report', 'now']]) {
    const m = messages.find(m => m.text === text)!;
    assert.equal(m.layer, layer);
    const event = await ui.waitFor(f => f.type === 'message' && (f.message as { id: string }).id === m.id);
    assert.equal((event.message as { layer: string }).layer, layer);
  }
  const create = async (title: string, extra: Record<string, unknown> = {}) => {
    const result = await ui.request({ type: 'task.create', title, ...extra });
    assert.equal(result.ok, true, result.error);
    return (result.value as { item: { id: string; layer: string } }).item;
  };
  const release = await create('Current', { kind: 'release', version: '0.1.0' });
  const epic = await create('Visibility', { kind: 'epic', parent: release.id });
  const active = await create('Work', { parent: epic.id });
  await ui.request({ type: 'task.edit', item: active.id, status: 'in progress' });
  const planned = await create('Next', { parent: epic.id });
  await ui.request({ type: 'task.edit', item: planned.id, status: 'planned' });
  const later = await create('Later', { kind: 'release', version: '0.2.0' });
  const unscheduled = await create('Future work', { parent: later.id });
  await ui.request({ type: 'task.edit', item: unscheduled.id, status: 'in progress' });
  const oldRelease = await create('Old', { kind: 'release', version: '0.0.1' });
  await ui.request({ type: 'task.close', item: oldRelease.id });
  const list = (await ui.request({ type: 'task.list' })).value as { items: Array<{ id: string; layer: string }> };
  for (const [id, layer] of [[active.id, 'now'], [planned.id, 'watch'], [unscheduled.id, 'background'], [oldRelease.id, 'archive']]) assert.equal(list.items.find(i => i.id === id)?.layer, layer);
  const mark = ui.frames.length;
  assert.equal((await ui.request({ type: 'task.edit', item: release.id, version: '0.3.0' })).ok, true);
  const promoted = await ui.waitFor(f => f.type === 'task' && f.id === release.id && ui.frames.indexOf(f) >= mark);
  assert.equal((promoted.layers as Record<string, string>)[unscheduled.id], 'now', 'changing the current release publishes newly active placements');
  assert.equal((promoted.layers as Record<string, string>)[active.id], 'background');
  assert.equal((await ui.request({ type: 'task.edit', item: release.id, version: '0.1.0' })).ok, true);
  await ui.request({ type: 'task.comment', item: active.id, text: 'Fix the fold.', verdict: { verdict: 'review', result: 'not clear', run: 'v-now' }, as: { name: 'rev', role: 'reviewer' } });
  const inbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal(inbox.notifications.find(n => n.kind === 'verdict')?.layer, 'watch');
  assert.equal(inbox.needsYou, 0);
  await ui.request({ type: 'task.comment', item: planned.id, text: 'Looks good.', verdict: { verdict: 'review', result: 'clear', run: 'v-watch' }, as: { name: 'rev', role: 'reviewer' } });
  const after = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal(after.notifications.find(n => n.result === 'clear')?.layer, 'watch');
  assert.equal(after.needsYou, 0);
  const humanArtifact = (await ui.request({ type: 'artifact.create', kind: 'note', title: 'Mine', topic: 'general', content: 'Notes' })).value as { artifact: { layer: string } };
  assert.equal(humanArtifact.artifact.layer, 'watch');
  const topicResult = await ui.request({ type: 'topic.create', title: 'Agent artifacts' });
  const agentTopic = (topicResult.value as { topic: { id: string } }).topic.id;
  await ui.request({ type: 'topic.send', topic: agentTopic, text: '@impl share the report' });
  const agentArtifact = await impl.call<{ artifact: { layer: string } }>('artifact.create', { kind: 'note', title: 'Agent report', topic: agentTopic, content: 'Notes' });
  assert.equal(agentArtifact.artifact.layer, 'background');
  const reportArtifact = await coord.call<{ artifact: { layer: string } }>('artifact.create', { kind: 'note', title: 'Human report', topic: 'general', content: 'Notes' });
  assert.equal(reportArtifact.artifact.layer, 'watch');
  const sessions = (await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; layer: string }> };
  assert.equal(sessions.sessions.find(s => s.name === 'impl')?.layer, 'watch', 'unobserved live sessions are watch');
});

test('history reclassifies retained messages after seven days, with project age overrides', async t => {
  const { startHub, connectWsUi } = await import('./harness.ts');
  for (const override of [false, true]) {
    let clock = Date.parse('2026-10-01T00:00:00Z');
    const hub = await startHub({ now: () => new Date(clock), retentionMs: 30 * 86_400_000, visibility: override ? { messages: { old: 'watch' } } : {} });
    t.after(() => hub.close());
    const ui = await connectWsUi(t, hub);
    const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'Human notes' });
    assert.equal((sent.value as { message: { layer: string } }).message.layer, 'now');
    clock += 7 * 86_400_000;
    const atBoundary = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ layer: string }> };
    assert.equal(atBoundary.messages.find(m => m.layer === 'now')?.layer, 'now');
    clock += 1;
    const old = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string; layer: string }> };
    assert.equal(old.messages.find(m => m.text === 'Human notes')?.layer, override ? 'watch' : 'archive');
  }
});

test('hundreds of default verdict, death and idle notifications leave needsYou zero', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50, pushTrustMs: 120_000 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: '40' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const created = await ui.request({ type: 'task.create', title: 'Repeated verdict evidence' });
  const item = (created.value as { item: { id: string } }).item.id;
  for (let i = 0; i < 200; i++) {
    const result = await ui.request({ type: 'task.comment', item, text: 'Evidence pending resolution.', verdict: { verdict: 'review', result: i % 2 ? 'clear' : 'not clear', run: `storm-${i}` }, as: { name: 'rev', role: 'reviewer' } });
    assert.equal(result.ok, true, result.error);
  }
  const launched = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  await eventually('default long idle notification', async () => {
    const ib = (await ui.request({ type: 'inbox.list' })).value as Inbox;
    return ib.notifications.some(n => n.kind === 'idle') ? true : undefined;
  });
  process.kill((launched.value as { process: { pid: number } }).process.pid, 'SIGKILL');
  const ib = await eventually('default death notification', async () => {
    const ib = (await ui.request({ type: 'inbox.list' })).value as Inbox;
    return ib.notifications.some(n => n.kind === 'death') ? ib : undefined;
  });
  assert.equal(ib.notifications.filter(n => n.kind === 'verdict').length, 200);
  assert.ok(ib.notifications.filter(n => ['verdict', 'death', 'idle'].includes(n.kind)).every(n => n.layer === 'watch'));
  assert.equal(ib.needsYou, 0);
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { needsYou: number }).needsYou, 0);
  const pushed = await ui.waitFor(f => f.type === 'inbox' && (f.inbox as Inbox).notifications.some(n => n.kind === 'death'));
  assert.equal((pushed.inbox as Inbox).needsYou, 0);
});

test('artifact placement keeps the author role at publication across a later role change and restart', async t => {
  const { startHub, spawnSpoke, TEST_SECRET } = await import('./harness.ts');
  const { createSocketEdge } = await import('../src/hub/socket.ts');
  const { Store } = await import('../src/hub/store.ts');
  const root = await tempProject(t);
  const source = join(root, 'source.md');
  await writeFile(source, 'Report notes');
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const options = {
    visibility: { artifacts: { human: 'now', coordinator: 'background' } } as const,
    control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: new Date().toISOString(), uptimeMs: 0 }), stop() {} },
  };
  let hub = await startHub({ ...options, store: new Store(join(root, 'hub.db')), readArtifact: async () => { entered.resolve(); await release.promise; return Buffer.from('Report notes'); } });
  t.after(() => hub.close());
  const socket = join(root, 'hub.sock');
  let edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const ui = await connectUi(t, { socket, secret: TEST_SECRET });
  const coord = await spawnSpoke({ hub, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const creating = coord.call<{ ok: boolean; artifact: { id: string; layer: string; creatorRole: string } }>('artifact.create', { kind: 'note', title: 'Author role', topic: 'general', path: source });
  await entered.promise;
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'aide' })).ok, true);
  release.resolve();
  const result = await creating;
  assert.equal(result.ok, true);
  assert.equal(result.artifact.creatorRole, 'aide');
  assert.equal(result.artifact.layer, 'now');
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'reviewer' })).ok, true);
  const list = (await ui.request({ type: 'artifact.list' })).value as { artifacts: Array<{ id: string; layer: string }> };
  assert.equal(list.artifacts.find(a => a.id === result.artifact.id)?.layer, 'now');
  await coord.close();
  await edge.close();
  await hub.close();
  hub = await startHub({ ...options, store: new Store(join(root, 'hub.db')) });
  edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  const restarted = await connectUi(t, { socket, secret: TEST_SECRET });
  const after = (await restarted.request({ type: 'artifact.list' })).value as { artifacts: Array<{ id: string; layer: string }> };
  assert.equal(after.artifacts.find(a => a.id === result.artifact.id)?.layer, 'now');
});
