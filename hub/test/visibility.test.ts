import { FakeClock } from './fake-clock.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withDiscoveredPid, connectUi, eventually, fakeClaude, nativeProjectHub as projectHub, startDaemon, tempProject } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import type { Inbox, EventsPage } from '../src/protocol.ts';

test('layout saves and human choices serialize through the shared UI lock', async t => {
  const { readFile, rm } = await import('node:fs/promises');
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const path = join(root, '.cland/ui.json');
  await writeFile(path, JSON.stringify({ layout: 'latest', visibility: {} }));
  await mkdir(`${path}.lock`);
  await writeFile(join(`${path}.lock`, '00000000-0000-0000-0000-000000000001.owner'), String(process.pid));
  const blocked = await ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'mute' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error!, /being saved/);
  await rm(`${path}.lock`, { recursive: true });
  assert.equal((await ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'mute' })).ok, true);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(saved.layout, 'latest');
  assert.equal(saved.visibility.topics.general, 'mute');
});

test('concurrent human choices safely recover a dead UI writer and preserve both updates', async t => {
  const { readFile } = await import('node:fs/promises');
  const { spawn } = await import('node:child_process');
  const dead = spawn(process.execPath, ['-e', '']);
  const deadPid = dead.pid!;
  await new Promise<void>(resolve => dead.once('exit', () => resolve()));
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const a = await connectUi(t, discovery), b = await connectUi(t, discovery);
  const path = join(root, '.cland/ui.json');
  await writeFile(path, JSON.stringify({ layout: 'preserved', visibility: {} }));
  await mkdir(`${path}.lock`);
  await writeFile(join(`${path}.lock`, '00000000-0000-0000-0000-000000000001.owner'), String(deadPid));
  const results = await Promise.all([
    a.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'pin' }),
    b.request({ type: 'visibility.set', surface: 'topics', target: 'agents', mode: 'mute' }),
  ]);
  for (const result of results) assert.equal(result.ok, true, result.error);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(saved.layout, 'preserved');
  assert.deepEqual(saved.visibility.topics, { general: 'pin', agents: 'mute' });
});

test('a preference disk wait leaves the serving path responsive', { skip: process.platform === 'win32' }, async t => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery), observer = await connectUi(t, discovery);
  const path = join(root, '.cland/ui.json');
  await promisify(execFile)('mkfifo', [path]);
  const choice = ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'pin' });
  try {
    await eventually('preference file read acquired its lock', async () => {
      const { stat } = await import('node:fs/promises');
      try { return (await stat(`${path}.lock`)).isDirectory() ? true : undefined; } catch { return undefined; }
    });
    assert.equal((await observer.request({ type: 'hub.status' }, 2000)).ok, true, 'another request completes while UI file read is blocked');
  } finally {
    await writeFile(path, JSON.stringify({ layout: 'preserved', visibility: {} }));
  }
  assert.equal((await choice).ok, true);
});

test('topic history pages retained messages beyond the latest 200, including equal timestamps', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const ids: string[] = [];
  for (let i = 0; i < 205; i++) {
    const sent = await ui.request({ type: 'topic.send', topic: 'general', text: `message ${i}` });
    assert.equal(sent.ok, true, sent.error);
    ids.push((sent.value as { message: { id: string } }).message.id);
  }
  const latest = (await ui.request({ type: 'topic.history', topic: 'general', limit: 200 })).value as { messages: Array<{ id: string }> };
  assert.deepEqual(latest.messages.map(m => m.id), ids.slice(5));
  const older = (await ui.request({ type: 'topic.history', topic: 'general', limit: 200, before: latest.messages[0]!.id })).value as { messages: Array<{ id: string }> };
  assert.deepEqual(older.messages.map(m => m.id), ids.slice(0, 5));
});

test('artifact creation chips follow keep and unkeep in frames, history and restart', async t => {
  const { cland, spawnSpoke } = await import('./harness.ts');
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'helper', role: 'aide' });
  t.after(() => impl.close()); t.after(() => aide.close());
  await impl.waitForPresence(['impl', 'helper']);
  const topic = ((await ui.request({ type: 'topic.create', title: 'Reports' })).value as { topic: { id: string } }).topic.id;
  await ui.request({ type: 'topic.send', topic, text: '@impl share your report' });
  const request = { kind: 'note', title: 'Report', topic, content: 'Notes' };
  type PlacedArtifact = { id: string; layer: string; kept?: boolean };
  const createdAgent = await impl.call<{ ok: boolean; error?: string; reason?: string; artifact: PlacedArtifact }>('artifact.create', request);
  assert.equal(createdAgent.ok, true, JSON.stringify(createdAgent));
  const agent = createdAgent.artifact;
  const human = ((await ui.request({ type: 'artifact.create', ...request })).value as { artifact: PlacedArtifact }).artifact;
  const createdAide = await aide.call<{ ok: boolean; artifact: PlacedArtifact }>('artifact.create', request);
  assert.equal(createdAide.ok, true, JSON.stringify(createdAide));
  const theirs = createdAide.artifact;
  const checkHistory = async (id: string, layer: string) => {
    const history = (await ui.request({ type: 'topic.history', topic })).value as { messages: Array<{ layer: string; artifact?: PlacedArtifact }> };
    const chip = history.messages.find(m => m.artifact?.id === id)!;
    assert.equal(chip.artifact?.layer, layer);
    assert.equal(chip.layer, layer, 'a creation chip shares the artifact placement');
  };
  for (const [a, layer] of [[agent, 'background'], [human, 'watch'], [theirs, 'watch']] as const) {
    assert.equal(a.layer, layer);
    const created = await ui.waitFor(f => f.type === 'message' && (f.message as { artifact?: PlacedArtifact }).artifact?.id === a.id);
    assert.equal((created.message as { layer: string }).layer, layer);
    await checkHistory(a.id, layer);
  }
  const change = async (kept: boolean) => {
    const mark = ui.frames.length;
    const result = await ui.request({ type: 'artifact.keep', artifact: agent.id, kept });
    assert.equal(result.ok, true, result.error);
    const expected = kept ? 'watch' : 'background';
    assert.equal((result.value as { artifact: PlacedArtifact }).artifact.layer, expected);
    const event = await ui.waitFor(f => f.type === 'artifact' && (f.artifact as PlacedArtifact).id === agent.id && ui.frames.indexOf(f) >= mark);
    assert.equal((event.artifact as PlacedArtifact).layer, expected);
    await checkHistory(agent.id, expected);
  };
  await change(true);
  await impl.close(); await aide.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const restarted = await startDaemon(t, root);
  ui = await connectUi(t, restarted.discovery);
  await ui.request({ type: 'subscribe' });
  const list = (await ui.request({ type: 'artifact.list' })).value as { artifacts: PlacedArtifact[] };
  assert.equal(list.artifacts.find(a => a.id === agent.id)?.layer, 'watch');
  await checkHistory(agent.id, 'watch');
  await checkHistory(human.id, 'watch');
  await checkHistory(theirs.id, 'watch');
  await change(false);
});

for (const [terminal, role, expected] of [['stopped', 'implementer', 'background'], ['exited', 'implementer', 'background'], ['stopped', 'aide', 'now']] as const) {
  test(`live ${role} ${terminal} state keeps terminal placement under an idle-now override`, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[visibility]\nsessions.idle = "now"\n');
    const fake = await fakeClaude(t, { pollMs: 50 });
    const { discovery } = await projectHub(t, root, fake.env);
    const ui = await connectUi(t, discovery);
    await ui.request({ type: 'subscribe' });
    const launched = await ui.request({ type: 'session.launch', name: 'worker', role, harness: 'claude-code' }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const processRow = (launched.value as { process: { sessionId: string; pid: number } }).process;
    if (terminal === 'stopped') assert.equal((await ui.request({ type: 'session.stop', session: 'worker' }, 30_000)).ok, true);
    else process.kill((await withDiscoveredPid(ui, processRow)).pid, 'SIGKILL');
    const changed = await ui.waitFor(f => f.type === 'session.process' && (f.process as { status: string }).status === terminal);
    assert.equal((changed.process as { layer: string }).layer, expected);
    const state = await ui.waitFor(f => f.type === 'session.state' && f.sessionId === processRow.sessionId && f.state === 'unknown' && f.source === (terminal === 'stopped' ? 'stopped' : 'process'));
    assert.equal(state.layer, expected, 'the following state event must keep terminal status and the Aide exception');
  });
}

test('project visibility raises an idle event to a warning without changing needsYou', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[visibility]\ninbox.idle = "now"\n');
  // Keep pushed idle states authoritative while testing notification visibility.
  const fake = await fakeClaude(t, { pollMs: 60_000, pushTrustMs: 120_000 });
  const { discovery } = await projectHub(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: '100' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launch = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const idle = await ui.waitFor(f => f.type === 'event' && (f.row as { text?: string; warning?: boolean })?.text?.includes('idle 1 min') === true && (f.row as { warning?: boolean }).warning === true);
  assert.equal((idle.row as { warning?: boolean }).warning, true, 'raised informational events are warnings in the events view');
  const events = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.ok(events.rows.some(r => r.text.includes('idle 1 min') && r.warning));
  const ib = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal('notifications' in ib, false);
  assert.equal(ib.needsYou, 0);
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { needsYou: number }).needsYou, 0);
});

test('the hub places messages, sessions, items and artifacts by the default table on snapshots and live frames', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
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
  const unread = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.deepEqual(unread.messages.map(m => m.text), ['Direct human report']);
  assert.equal(unread.needsYou, 1, 'the unread now message counts under the four-kind inbox');
  assert.equal((await ui.request({ type: 'topic.read', topic: 'general' })).ok, true);
  const read = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal(read.messages.length, 0);
  assert.equal(read.needsYou, 0, 'read the report before checking that verdict notifications add no waits');
  const create = async (title: string, extra: Record<string, unknown> = {}) => {
    const result = await ui.request({ ...((!('kind' in extra) || extra.kind === 'task') ? { size: 'M' } : {}), type: 'task.create', title, ...extra });
    assert.equal(result.ok, true, result.error);
    return (result.value as { item: { id: string; layer: string } }).item;
  };
  const release = await create('Current', { kind: 'release', version: '0.1.0' });
  const epic = await create('Visibility', { kind: 'epic', parent: release.id });
  const active = await create('Work', { parent: epic.id });
  await ui.request({ type: 'task.edit', item: active.id, status: 'in progress' });
  const planned = await create('Next', { parent: epic.id });
  await ui.request({ type: 'task.edit', item: planned.id, status: 'planned' });
  // §3.5: planned is Watch only inside the current release; an orphan is unscheduled Background.
  const orphan = await create('Unscheduled plan');
  await ui.request({ type: 'task.edit', item: orphan.id, status: 'planned' });
  const later = await create('Later', { kind: 'release', version: '0.2.0' });
  const unscheduled = await create('Future work', { parent: later.id });
  await ui.request({ type: 'task.edit', item: unscheduled.id, status: 'in progress' });
  const oldRelease = await create('Old', { kind: 'release', version: '0.0.1' });
  await ui.request({ type: 'task.close', item: oldRelease.id });
  const list = (await ui.request({ type: 'task.list' })).value as { items: Array<{ id: string; layer: string }> };
  for (const [id, layer] of [[active.id, 'now'], [planned.id, 'watch'], [orphan.id, 'background'], [unscheduled.id, 'background'], [oldRelease.id, 'archive']]) assert.equal(list.items.find(i => i.id === id)?.layer, layer);
  const mark = ui.frames.length;
  assert.equal((await ui.request({ type: 'task.edit', item: release.id, version: '0.3.0' })).ok, true);
  const promoted = await ui.waitFor(f => f.type === 'task' && f.id === release.id && ui.frames.indexOf(f) >= mark);
  assert.equal((promoted.layers as Record<string, string>)[unscheduled.id], 'now', 'changing the current release publishes newly active placements');
  assert.equal((promoted.layers as Record<string, string>)[active.id], 'background');
  assert.equal((promoted.layers as Record<string, string>)[planned.id], 'background', 'planned work leaves Watch when its release is no longer current');
  assert.equal((promoted.layers as Record<string, string>)[orphan.id], 'background');
  assert.equal((await ui.request({ type: 'task.edit', item: release.id, version: '0.1.0' })).ok, true);
  await ui.request({ type: 'task.comment', item: active.id, text: 'Fix the fold.', verdict: { verdict: 'review', scope: 'full', result: 'not clear', run: 'v-now' }, as: { name: 'rev', role: 'reviewer' } });
  const inbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.ok(((await ui.request({ type: 'events.list' })).value as EventsPage).rows.some(r => r.kind === 'verdict' && r.warning));
  assert.equal(inbox.needsYou, 0);
  await ui.request({ type: 'task.comment', item: planned.id, text: 'Looks good.', verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'v-watch' }, as: { name: 'rev', role: 'reviewer' } });
  const after = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.ok(((await ui.request({ type: 'events.list' })).value as EventsPage).rows.some(r => r.kind === 'verdict' && !r.warning));
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
    const clock = new FakeClock(Date.parse('2026-10-01T00:00:00Z'));
    const root = await tempProject(t);
    const file = join(root, 'visibility.sqlite');
    const open = () => startHub({ clock, store: new Store(file), retentionMs: 30 * 86_400_000, visibility: override ? { messages: { old: 'watch' } } : {} });
    let hub = await open();
    t.after(() => hub.close());
    let ui = await connectWsUi(t, hub);
    const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'Human notes' });
    assert.equal((sent.value as { message: { layer: string } }).message.layer, 'now');
    // T2: reopen the retained store in-process at the age boundary. No live timer owner
    // needs seven days of unrelated heartbeat ticks; history still computes age on read.
    ui.close();
    await hub.close();
    await clock.advance(7 * 86_400_000);
    hub = await open();
    ui = await connectWsUi(t, hub);
    const atBoundary = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ layer: string }> };
    assert.equal(atBoundary.messages.find(m => m.layer === 'now')?.layer, 'now');
    await clock.advance(1);
    const old = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string; layer: string }> };
    assert.equal(old.messages.find(m => m.text === 'Human notes')?.layer, override ? 'watch' : 'archive');
  }
});

test('hundreds of default verdict, death and idle events leave needsYou zero', async t => {
  const root = await tempProject(t);
  // Keep pushed idle states authoritative while testing notification visibility.
  const fake = await fakeClaude(t, { pollMs: 50, pushTrustMs: 120_000 });
  const { discovery } = await projectHub(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: '40' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Repeated verdict evidence' });
  const item = (created.value as { item: { id: string } }).item.id;
  for (let i = 0; i < 200; i++) {
    const result = await ui.request({ type: 'task.comment', item, text: 'Evidence pending resolution.', verdict: { verdict: 'review', scope: 'full', result: i % 2 ? 'clear' : 'not clear', run: `storm-${i}` }, as: { name: 'rev', role: 'reviewer' } });
    assert.equal(result.ok, true, result.error);
  }
  const launched = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  await ui.waitFor(f => f.type === 'event' && (f.row as { text?: string })?.text?.includes('idle 1 min') === true);
  process.kill((await withDiscoveredPid(ui, (launched.value as { process: { sessionId: string } }).process)).pid, 'SIGKILL');
  const death = await ui.waitFor(f => f.type === 'event' && (f.row as { text?: string })?.text?.includes('impl-1 died') === true);
  assert.equal((death.row as { warning?: boolean }).warning, true);
  const events = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.ok(events.rows.some(r => r.kind === 'verdict'));
  const ib = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal('notifications' in ib, false);
  assert.equal(ib.needsYou, 0);
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { needsYou: number }).needsYou, 0);
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

test('human pins and mutes reclassify records and survive a hub restart without losing layout', async t => {
  const { cland, spawnSpoke } = await import('./harness.ts');
  const { readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/ui.json'), JSON.stringify({ version: 2, panels: { left: true, right: 'sessions', dock: false }, sizes: {}, items_filter: 'board', plan_seen: {} }));
  let { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev']);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['rev', 'coord']);
  await ui.request({ type: 'topic.send', topic: 'general', text: 'Topic notes' });
  const artifact = ((await ui.request({ type: 'artifact.create', kind: 'note', title: 'Notes', topic: 'general', content: 'Notes' })).value as { artifact: { id: string } }).artifact.id;
  const set = async (surface: string, target: string, mode: string) => {
    const result = await ui.request({ type: 'visibility.set', surface, target, mode });
    assert.equal(result.ok, true, result.error);
  };
  const asking = await coord.call<{ ok: boolean }>('ask', { topic: 'general', question: 'Review topic?', options: ['Yes'], free: true });
  assert.equal(asking.ok, true);
  assert.equal(((await ui.request({ type: 'inbox.list' })).value as Inbox).needsYou, 1);
  await set('topics', 'general', 'mute');
  await ui.waitFor(f => f.type === 'visibility');
  assert.equal(((await ui.request({ type: 'inbox.list' })).value as Inbox).needsYou, 0, 'muted asks are watch and the hub now count agrees');
  await set('sessions', 'rev', 'pin');
  await set('artifacts', artifact, 'pin');
  const check = async () => {
    const topics = (await ui.request({ type: 'topic.list' })).value as { topics: Array<{ id: string; layer: string }> };
    assert.equal(topics.topics.find(t => t.id === 'general')?.layer, 'watch', 'a muted waiting topic lowers from now to watch');
    const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string; layer: string; artifact?: { id: string } }> };
    assert.equal(history.messages.find(m => m.text === 'Topic notes')?.layer, 'watch');
    assert.equal(history.messages.find(m => m.artifact?.id === artifact)?.layer, 'now', 'artifact pin wins over topic mute');
    const status = (await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; layer: string }> };
    assert.equal(status.sessions.find(s => s.name === 'rev')?.layer, 'now');
    const list = (await ui.request({ type: 'artifact.list' })).value as { artifacts: Array<{ id: string; layer: string }> };
    assert.equal(list.artifacts.find(a => a.id === artifact)?.layer, 'now');
  };
  await check();
  assert.equal((await rev.call<{ ok: boolean }>('visibility.set', { surface: 'topics', target: 'general', mode: 'pin' })).ok, false);
  const forbidden = await ui.request({ type: 'visibility.set', surface: 'sessions', target: 'rev', mode: 'mute', as: { name: 'rev', role: 'reviewer' } });
  assert.equal(forbidden.ok, false, 'a session cannot use the human frame from its shell');
  const missing = await ui.request({ type: 'visibility.set', surface: 'artifacts', target: 'A-999', mode: 'pin' });
  assert.equal(missing.ok, false, 'unknown targets never enter ui.json');
  const preferences = JSON.parse(await readFile(join(root, '.cland/ui.json'), 'utf8'));
  assert.equal(preferences.panels.left, true);
  assert.equal(preferences.visibility.topics.general, 'mute');
  assert.equal(preferences.visibility.sessions.rev, 'pin');
  await rev.close();
  await coord.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  ({ discovery } = await startDaemon(t, root));
  ui = await connectUi(t, discovery);
  const reconnected = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  t.after(() => reconnected.close());
  await reconnected.waitForPresence(['rev']);
  await check();
  await set('topics', 'general', 'mute');
  const reset = (await ui.request({ type: 'topic.list' })).value as { topics: Array<{ id: string; layer: string }> };
  assert.equal(reset.topics.find(t => t.id === 'general')?.layer, 'now', 'same action toggles back to waiting-topic default');
});

test('D17 verdicts and deaths carry warn severity in events and the event log, never needing the human', async t => {
  const { cland, spawnSpoke } = await import('./harness.ts');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[visibility]\ninbox.not_clear = "now"\ninbox.death = "now"\nmessages.not_clear = "now"\n');
  const fake = await fakeClaude(t, { pollMs: 50 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const item = ((await ui.request({ size: 'M', type: 'task.create', title: 'Warning evidence' })).value as { item: { id: string } }).item.id;
  const topic = ((await ui.request({ type: 'topic.create', title: 'Warning evidence', item })).value as { topic: { id: string } }).topic.id;
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const ask = await coord.call<{ ok: boolean; error?: string }>('ask', { topic: 'general', question: 'Choose a direction', options: ['Continue'], free: true });
  assert.equal(ask.ok, true, ask.error);
  assert.equal(((await ui.request({ type: 'inbox.list' })).value as Inbox).needsYou, 1);
  const verdict = await ui.request({ type: 'task.comment', item, text: 'Fix the regression.', verdict: { verdict: 'review', scope: 'full', result: 'not clear', run: 'warn-review' }, as: { name: 'rev', role: 'reviewer' } });
  assert.equal(verdict.ok, true, verdict.error);
  type WarnMessage = { id: string; layer: string; severity?: string; kind: string; detail?: Record<string, unknown> };
  const failed = await ui.waitFor(f => f.type === 'message' && (f.message as WarnMessage).detail?.run === 'warn-review' && (f.message as WarnMessage).kind === 'report');
  assert.equal((failed.message as WarnMessage).layer, 'watch');
  assert.equal((failed.message as WarnMessage).severity, 'warn');
  const verdictEvent = await ui.waitFor(f => f.type === 'message' && (f.message as WarnMessage).kind === 'event' && (f.message as WarnMessage).detail?.run === 'warn-review');
  assert.equal((verdictEvent.topic as { id: string }).id, 'agents', 'a normal bound-topic verdict also reaches the event log');
  assert.equal((verdictEvent.message as WarnMessage).detail?.event, 'task');
  assert.equal((verdictEvent.message as WarnMessage).detail?.result, 'not clear');
  assert.equal((verdictEvent.message as WarnMessage).layer, 'watch');
  assert.equal((verdictEvent.message as WarnMessage).severity, 'warn');
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev-live', role: 'reviewer', sessionId: 'rev-live-id' });
  t.after(() => rev.close());
  const sent = await rev.call<{ ok: boolean; error?: string; message?: { id: string } }>('send', { topic, to: ['coord'], text: 'review not clear: follow-up evidence', kind: 'report' });
  assert.equal(sent.ok, true, sent.error);
  const reference = await ui.waitFor(f => f.type === 'message' && (f.message as WarnMessage).kind === 'agent-message' && (f.message as WarnMessage).detail?.from === 'rev-live');
  assert.equal((reference.message as WarnMessage).layer, 'watch');
  assert.equal((reference.message as WarnMessage).severity, 'warn');
  const launch = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const subscribed = await coord.call<{ ok: boolean; error?: string }>('subscribe', { subject: { session: 'worker' }, events: ['session.state'] });
  assert.equal(subscribed.ok, true, subscribed.error);
  process.kill((await withDiscoveredPid(ui, (launch.value as { process: { sessionId: string } }).process)).pid, 'SIGKILL');
  const deathEvent = await ui.waitFor(f => f.type === 'message' && (f.message as WarnMessage).kind === 'event' && (f.message as WarnMessage).detail?.lifecycle === 'died');
  assert.equal((deathEvent.message as WarnMessage).layer, 'watch');
  assert.equal((deathEvent.message as WarnMessage).severity, 'warn');
  const died = await ui.waitFor(f => f.type === 'message' && (f.message as WarnMessage).kind === 'session-death');
  assert.equal((died.message as WarnMessage).layer, 'watch');
  assert.equal((died.message as WarnMessage).severity, 'warn');
  const warnings = ((await ui.request({ type: 'events.list' })).value as EventsPage).rows;
  assert.ok(warnings.some(r => r.text.includes('worker died') && r.warning));
  assert.ok(warnings.some(r => r.kind === 'verdict' && r.warning));
  assert.equal(((await ui.request({ type: 'inbox.list' })).value as Inbox).needsYou, 1);
  const clear = await ui.request({ type: 'task.comment', item, text: 'Fixed.', verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'clear-review' }, as: { name: 'rev', role: 'reviewer' } });
  assert.equal(clear.ok, true, clear.error);
  const clearEvent = await ui.waitFor(f => f.type === 'message' && (f.message as WarnMessage).kind === 'event' && (f.message as WarnMessage).detail?.run === 'clear-review');
  assert.equal((clearEvent.message as WarnMessage).severity, undefined, 'clear events are not warnings');
  const events = ((await ui.request({ type: 'events.list' })).value as EventsPage).rows;
  assert.ok(events.some(r => r.kind === 'verdict' && !r.warning));
  assert.equal('notifications' in ((await ui.request({ type: 'inbox.list' })).value as object), false);
  const history = (await ui.request({ type: 'topic.history', topic })).value as { messages: WarnMessage[] };
  assert.equal(history.messages.find(m => m.id === (failed.message as WarnMessage).id)?.severity, 'warn');
  const log = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: WarnMessage[] };
  assert.equal(log.messages.find(m => m.id === (died.message as WarnMessage).id)?.severity, 'warn');
  assert.equal(log.messages.find(m => m.id === (deathEvent.message as WarnMessage).id)?.severity, 'warn');
  assert.equal(log.messages.find(m => m.id === (verdictEvent.message as WarnMessage).id)?.severity, 'warn');
  assert.equal(log.messages.find(m => m.id === (reference.message as WarnMessage).id)?.severity, 'warn');
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { needsYou: number }).needsYou, 1);
  const cli = await cland(root, 'inbox', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.equal((JSON.parse(cli.stdout) as Inbox).needsYou, 1);
  assert.equal('notifications' in JSON.parse(cli.stdout), false);
  const plain = await cland(root, 'inbox');
  assert.equal(plain.code, 0, plain.stderr);
  assert.doesNotMatch(plain.stdout, /notification:/);
  // §3.6 human choices compose after D17's warning default; severity and needsYou remain hub facts.
  assert.equal((await ui.request({ type: 'visibility.set', surface: 'topics', target: topic, mode: 'pin' })).ok, true);
  const pinnedHistory = (await ui.request({ type: 'topic.history', topic })).value as { messages: WarnMessage[] };
  const pinned = pinnedHistory.messages.find(m => m.id === (failed.message as WarnMessage).id);
  assert.equal(pinned?.layer, 'now');
  assert.equal(pinned?.severity, 'warn');
  assert.equal(((await ui.request({ type: 'inbox.list' })).value as Inbox).needsYou, 1, 'pinned events still do not require a response');
  assert.equal((await ui.request({ type: 'visibility.set', surface: 'topics', target: topic, mode: 'mute' })).ok, true);
  const mutedHistory = (await ui.request({ type: 'topic.history', topic })).value as { messages: WarnMessage[] };
  const muted = mutedHistory.messages.find(m => m.id === (failed.message as WarnMessage).id);
  assert.equal(muted?.layer, 'background');
  assert.equal(muted?.severity, 'warn');
});
