// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import { FakeClock } from './fake-clock.ts';
import { assertDefaultEventVisibility } from './visibility-events.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import type { EventsPage, Inbox } from '../src/protocol.ts';

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
  let stopHub = async () => {};
  const serve = async (...args: Parameters<typeof projectHub>) => {
    const hub = await projectHub(...args);
    stopHub = hub.stop;
    return hub;
  };
  const { cland, inProcessSpoke } = await import('./harness.ts');
  const root = await tempProject(t);
  const { discovery } = await serve(t, root);
  let ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', role: 'implementer' });
  const aide = await inProcessSpoke(t, { discover: true, cwd: root, name: 'helper', role: 'aide' });
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
  await stopHub();
  const restarted = await serve(t, root);
  ui = await connectUi(t, restarted.discovery);
  await ui.request({ type: 'subscribe' });
  const list = (await ui.request({ type: 'artifact.list' })).value as { artifacts: PlacedArtifact[] };
  assert.equal(list.artifacts.find(a => a.id === agent.id)?.layer, 'watch');
  await checkHistory(agent.id, 'watch');
  await checkHistory(human.id, 'watch');
  await checkHistory(theirs.id, 'watch');
  await change(false);
});

test('project visibility raises an idle event to a warning without changing needsYou', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[visibility]\ninbox.idle = "now"\n');
  // Keep pushed idle states authoritative while testing notification visibility.
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, { CLAND_IDLE_NOTIFY_MS: '100' }, { clock });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launch = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-1', sessionId: (launch.value as { process: { sessionId: string } }).process.sessionId, role: 'implementer' });
  await peer.waitForPresence(['impl-1']);
  fakes['claude-code']!.idle('impl-1');
  await clock.advance(101);
  const idle = await ui.waitFor(f => f.type === 'event' && (f.row as { text?: string; warning?: boolean })?.text?.includes('idle 1 min') === true && (f.row as { warning?: boolean }).warning === true);
  assert.equal((idle.row as { warning?: boolean }).warning, true, 'raised informational events are warnings in the events view');
  const events = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.ok(events.rows.some(r => r.text.includes('idle 1 min') && r.warning));
  const ib = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal('notifications' in ib, false);
  assert.equal(ib.needsYou, 0);
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { needsYou: number }).needsYou, 0);
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

test('default verdict, death and idle events leave needsYou zero', async t => {
  await assertDefaultEventVisibility(t, 4);
});

test('artifact placement keeps the author role at publication across a later role change and restart', async t => {
  const { startHub, inProcessSpoke, TEST_SECRET } = await import('./harness.ts');
  const { createSocketEdge } = await import('../src/hub/socket.ts');
  const { Store } = await import('../src/hub/store.ts');
  const root = await tempProject(t);
  const source = join(root, 'source.md');
  await writeFile(source, 'Report notes');
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const options = {
    env: {},
    visibility: { artifacts: { human: 'now', coordinator: 'background' } } as const,
    control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: new Date().toISOString(), uptimeMs: 0 }), stop() {} },
  };
  let hub = await startHub({ ...options, store: new Store(join(root, 'hub.db')), readArtifact: async () => { entered.resolve(); await release.promise; return Buffer.from('Report notes'); } });
  t.after(() => hub.close());
  const socket = join(root, 'hub.sock');
  let edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const ui = await connectUi(t, { socket, secret: TEST_SECRET });
  const coord = await inProcessSpoke(t, { hub, cwd: root, name: 'coord', role: 'coordinator' });
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
  let stopHub = async () => {};
  const serve = async (...args: Parameters<typeof projectHub>) => {
    const hub = await projectHub(...args);
    stopHub = hub.stop;
    return hub;
  };
  const { cland, inProcessSpoke } = await import('./harness.ts');
  const { readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/ui.json'), JSON.stringify({ version: 2, panels: { left: true, right: 'sessions', dock: false }, sizes: {}, items_filter: 'board', plan_seen: {} }));
  let { discovery } = await serve(t, root);
  let ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev']);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
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
  await stopHub();
  ({ discovery } = await serve(t, root));
  ui = await connectUi(t, discovery);
  const reconnected = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  t.after(() => reconnected.close());
  await reconnected.waitForPresence(['rev']);
  await check();
  await set('topics', 'general', 'mute');
  const reset = (await ui.request({ type: 'topic.list' })).value as { topics: Array<{ id: string; layer: string }> };
  assert.equal(reset.topics.find(t => t.id === 'general')?.layer, 'now', 'same action toggles back to waiting-topic default');
});

test('D17 verdicts and deaths carry warn severity in events and the event log, never needing the human', async t => {
  const { cland, inProcessSpoke } = await import('./harness.ts');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[visibility]\ninbox.not_clear = "now"\ninbox.death = "now"\nmessages.not_clear = "now"\n');
  const { discovery, fakes } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const item = ((await ui.request({ size: 'M', type: 'task.create', title: 'Warning evidence' })).value as { item: { id: string } }).item.id;
  const topic = ((await ui.request({ type: 'topic.create', title: 'Warning evidence', item })).value as { topic: { id: string } }).topic.id;
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
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
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev-live', role: 'reviewer', sessionId: 'rev-live-id' });
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
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'worker', sessionId: (launch.value as { process: { sessionId: string } }).process.sessionId, role: 'implementer' });
  await peer.waitForPresence(['worker']);
  fakes['claude-code']!.crash('worker');
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
