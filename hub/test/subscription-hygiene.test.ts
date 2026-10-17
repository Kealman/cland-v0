// T2: hub rules use real socket frames, in-process harnesses/spokes and one FakeClock.
import assert from 'node:assert/strict';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { envelope } from '../src/adapters/contract.ts';
import type { Message, Subscription } from '../src/protocol.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { FakeClock } from './fake-clock.ts';
import { FAKE_FLAVOURS } from './fakes/harness.ts';
import { cland, clandWithEnv, connectUi, connectWsUi, eventually, inProcessSpoke, startHub, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { componentHub, launchedSpoke, stopComponentHub } from './subscription-hub.ts';

// T2: lifecycle facts retain their order even inside the coalescing window.
test('launched, died and launched within sixty seconds preserve every transition', async t => {
  const { root, ui, coord, clock, fakes } = await setup(t);
  await coord.call('subscribe', { subject: { role: 'implementer' }, events: ['session.state'] });
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { sessionId: string } }).process;
  await clock.advance(1000);
  fakes['claude-code']!.crash('impl');
  await ui.waitFor(f => f.type === 'session.process' && (f.process as { sessionId: string; status: string }).sessionId === p.sessionId && (f.process as { status: string }).status === 'exited');
  await clock.advance(1000);
  const relaunched = await ui.request({ type: 'session.resume', session: 'impl', relaunch: true });
  assert.equal(relaunched.ok, true, relaunched.error);
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord consecutive lifecycle' });
  const digest = await coord.waitForEvent(e => e.params.content.includes('consecutive lifecycle'));
  assert.deepEqual(digest.params.content.match(/event · session.state · impl (launched|died)/g), [
    'event · session.state · impl launched', 'event · session.state · impl died', 'event · session.state · impl launched',
  ]);
  assert.doesNotMatch(digest.params.content, /×/);
});

async function setup(t: test.TestContext, config?: string, env: Record<string, string> = {}, serve = componentHub) {
  const root = await tempProject(t);
  if (config) { await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland', 'config.toml'), config); }
  const { discovery, clock, fakes } = await serve(t, root, env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  onCleanup(t, () => coord.close()); onCleanup(t, () => rev.close());
  await coord.waitForPresence(['coord', 'rev']);
  return { root, ui, coord, rev, clock, fakes };
}

test('coalescing and the event cap freeze per recipient across restart and partial delivery', async t => {
  const { root, ui, coord, rev } = await setup(t, undefined, undefined);
  const made = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Counts' });
  const item = made.item.id;
  for (const spoke of [coord, rev]) await spoke.call('subscribe', { subject: { item }, events: ['task'] });
  const claim = async () => {
    await coord.call('task.claim', { id: item, release: true });
    assert.equal((await coord.call<{ ok: boolean }>('task.claim', { id: item })).ok, true);
  };
  // Releases emit no task event, so these three identical claim facts are consecutive.
  for (let i = 0; i < 3; i++) await claim();
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord freeze counts' });
  const first = await coord.waitForEvent(e => e.params.content.includes('freeze counts'));
  assert.match(first.params.content, /claimed by coord \(×3\)/);
  // These equal occurrences may coalesce only into rev's unbound rows.
  await claim();
  const topic = (await coord.call<{ topic: { id: string } }>('topic.create', { title: 'Overflow', item })).topic.id;
  for (const spoke of [coord, rev]) await spoke.call('subscribe', { subject: { topic }, events: ['artifact'] });
  for (let i = 0; i < 12; i++) assert.equal((await coord.call<{ ok: boolean }>('artifact.create', { kind: 'prompt', title: `overflow-${i}`, topic, content: 'material', status: 'draft' })).ok, true);
  await rev.close();
  await coord.waitForPresence(['coord']);
  await ui.request({ type: 'topic.send', topic: 'general', text: '@rev frozen offline overflow' });
  // A bound offline digest must retain its counts and cap after subsequent events and restart.
  await claim();
  ui.close();
  await stopComponentHub(root);
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui2 = await connectUi(t, discovery);
  const rev2 = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  onCleanup(t, () => rev2.close());
  const second = await rev2.waitForEvent(e => e.params.content.includes('frozen offline overflow'));
  assert.match(second.params.content, /claimed by coord \(×4\)/);
  assert.match(second.params.content, /and 3 more/);
  assert.equal(second.params.content.match(/event · (task|artifact) ·/g)?.length, 10);
  assert.equal(second.params.content.match(/overflow-\d+/g)?.length, 9);
  assert.equal(first.params.content.match(/claimed by coord \(×3\)/g)?.length, 1);
  await coord.waitForPresence(['coord', 'rev']);
  await ui2.request({ type: 'topic.send', topic: 'general', text: '@coord independent cap' });
  const third = await coord.waitForEvent(e => e.params.content.includes('independent cap'));
  assert.match(third.params.content, /claimed by coord \(×2\)/);
  assert.match(third.params.content, /and 3 more/);
  await ui2.request({ type: 'topic.send', topic: 'general', text: '@rev after fixed batch' });
  const fourth = await rev2.waitForEvent(e => e.params.content.includes('after fixed batch'));
  assert.match(fourth.params.content, /claimed by coord/);
  assert.doesNotMatch(fourth.params.content, /overflow|×/);
});

test('topic and artifact events match item subtrees, and a closed topic sends its final event', async t => {
  const { root, ui, coord, rev } = await setup(t);
  const parent = (await coord.call<{ item: { id: string } }>('task.create', { kind: 'epic', title: 'Subtree' })).item.id;
  const child = (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Child', parent })).item.id;
  const other = (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Elsewhere' })).item.id;
  const topic = (await coord.call<{ topic: { id: string } }>('topic.create', { title: 'Child topic', item: child })).topic.id;
  const extra = (await coord.call<{ topic: { id: string } }>('topic.create', { title: 'Outside', item: other })).topic.id;
  await rev.call('subscribe', { subject: { subtree: parent }, events: ['topic', 'artifact', 'task'] });
  await coord.call('subscribe', { subject: { topic }, events: ['artifact'] });
  await coord.call('artifact.create', { kind: 'note', title: 'Shared evidence', topic, content: 'body', status: 'shared' });
  await coord.call('artifact.create', { kind: 'note', title: 'Outside evidence', topic: extra, content: 'body', status: 'shared' });
  await coord.call('ask', { topic, question: 'Waiting fact', options: ['One'] });
  await ui.request({ type: 'topic.close', topic });
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [], 'even artifact-only topic subscriptions end with a final topic event');
  const listing = await cland(root, 'hub', 'subscriptions', '--json');
  assert.equal(listing.code, 0, listing.stderr);
  const rows = JSON.parse(listing.stdout).subscriptions.filter((s: Subscription) => !s.default);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subscriber, 'rev');
  const denied = await clandWithEnv(root, { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'coord-id', CLAND_ROLE: 'coordinator' }, 'hub', 'subscriptions', '--json');
  assert.equal(denied.code, 1);
  assert.match(denied.stderr, /forbidden/);
  await ui.request({ type: 'topic.send', topic: 'general', text: '@rev deliver subtree' });
  const delivered = await rev.waitForEvent(e => e.params.content.includes('deliver subtree'));
  assert.match(delivered.params.content, /created · Shared evidence/);
  assert.match(delivered.params.content, /shared · Shared evidence/);
  assert.match(delivered.params.content, /waiting for human/);
  assert.match(delivered.params.content, /event · topic · .* closed/);
  assert.doesNotMatch(delivered.params.content, /Outside evidence/);
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord final topic event' });
  const final = await coord.waitForEvent(e => e.params.content.includes('final topic event'));
  assert.match(final.params.content, /event · topic · .* closed/);
});

test('events have their own durable limit, preserve final events, and consume no message allowance', async t => {
  const fixture = await setup(t, '[hygiene]\nrate_limit_max = 2\nevent_limit_max = 2\nevent_limit_window_minutes = 10\n', undefined);
  const { root, coord } = fixture;
  let ui = fixture.ui;
  const item = (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Limits' })).item.id;
  await coord.call('subscribe', { subject: { item }, events: ['task'] });
  for (const status of ['planned', 'review']) await coord.call('task.edit', { id: item, status });
  ui.close();
  await stopComponentHub(root);
  const { discovery, clock, fakes } = await componentHub(t, root);
  ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  await coord.waitForPresence(['coord', 'rev']);
  for (const status of ['planned', 'review']) await coord.call('task.edit', { id: item, status });
  await coord.call('task.close', { id: item });
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), []);
  for (const text of ['allowed one', 'allowed two']) assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['rev'], text })).ok, true);
  assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['rev'], text: 'too many' })).ok, false);
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord release limited events' });
  const delivered = await coord.waitForEvent(e => e.params.content.includes('release limited events'));
  assert.equal(delivered.params.content.match(/event · task ·/g)?.length, 3);
  assert.match(delivered.params.content, /closed/);
  assert.doesNotMatch(delivered.params.content, /review → planned|review → done/);
  await ui.request({ type: 'hub.status', flushLogs: true });
  const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(journal.filter(e => e.event === 'event-limited').length, 3);
  assert.ok(journal.filter(e => e.event === 'event-delivery').every(e => e.count === 1 && e.text === undefined));
  const inbox = await ui.request({ type: 'inbox.list' });
  assert.doesNotMatch(JSON.stringify(inbox.value), /event ·|subscription/);
});

test('digest now uses steering capabilities or waits for the next turn across flavours', async t => {
  const root = await tempProject(t);
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const harness of FAKE_FLAVOURS) {
    const fake = fakes[harness]!;
    const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness });
    assert.equal(launched.ok, true, launched.error);
    const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', assignRole: false, sessionId: (launched.value as { process: { sessionId: string } }).process.sessionId });
    await peer.waitForPresence(['coord']);
    fake.idle('coord');
    const item = ((await ui.request({ size: 'M', type: 'task.create', title: 'Immediate event' })).value as { item: { id: string } }).item.id;
    // One CLI frame proves --digest parsing; the other rows exercise the shared MCP rule.
    let subscribed: { subscription: Subscription };
    if (harness === 'claude-code') {
      const result = await cland(root, 'subscribe', 'item', item, '--event', 'task', '--digest', 'now', '--as', 'coord', '--json');
      assert.equal(result.code, 0, result.stderr);
      subscribed = JSON.parse(result.stdout);
    } else subscribed = await peer.call('subscribe', { subject: { item }, events: ['task'], digest: 'now' });
    assert.equal(subscribed.subscription.digest, 'now');
    fake.busy('coord');
    const mark = fake.injections.length;
    const historyBefore = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] };
    const priorIds = new Set(historyBefore.messages.map(m => m.id));
    if (harness !== 'claude-code') {
      const topic = ((await ui.request({ type: 'topic.create', title: 'Before immediate cap' })).value as { topic: { id: string } }).topic.id;
      const held = await peer.call<{ ok: boolean }>('subscribe', { subject: { topic }, events: ['artifact'] });
      assert.equal(held.ok, true);
      for (let i = 0; i < 12; i++) assert.equal((await ui.request({ type: 'artifact.create', kind: 'prompt', title: `held-${i}`, topic, content: 'material', status: 'draft' })).ok, true);
    }
    assert.equal((await ui.request({ type: 'task.edit', item, status: 'planned' })).ok, true);
    const recorded = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · task · ${item} status changed backlog → planned`);
    const id = (recorded.message as Message).id;
    if (harness === 'claude-code') {
      await clock.advance(350);
      assert.equal(fake.injections.slice(mark).some(i => i.message.text.includes(`event · task · ${item}`)), false);
      fake.idle('coord');
      await ui.request({ type: 'topic.send', topic: 'general', text: '@coord next turn releases now fallback' });
    }
    await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
    const log = fake.injections.slice(mark).map(i => envelope(i.message, i.topic)).join('\n');
    assert.match(log, new RegExp(`event · task · ${item}`));
    if (harness !== 'claude-code') {
      assert.equal(log.match(/event · (artifact|task) ·/g)?.length, 10);
      assert.match(log, /and 3 more/);
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      const events = (history.value as { messages: Array<Message & { stage: string }> }).messages.filter(m => m.kind === 'event' && m.to.includes('coord') && !priorIds.has(m.id));
      const current = events.filter(m => m.text.includes(item) || m.text.includes('held-'));
      assert.equal(current.length, 13);
      assert.ok(current.every(m => m.stage === 'injected'));
    }
    const watcher = await inProcessSpoke(t, { cwd: root, discover: true, name: 'watcher', sessionId: 'watcher-id' });
    await watcher.waitForPresence(['watcher', 'coord']);
    await watcher.call('subscribe', { subject: { session: 'coord' }, events: ['usage'], threshold: { tokens: 999999999 } });
    await watcher.call('subscribe', { subject: { role: 'coordinator' }, events: ['session.state'] });
    assert.equal((await ui.request({ type: 'session.stop', session: 'coord' })).ok, true);
    const rows = ((await ui.request({ type: 'hub.subscriptions' })).value as { subscriptions: Subscription[] }).subscriptions.filter(s => !s.default);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]!.subject, { role: 'coordinator' });
    await ui.request({ type: 'topic.send', topic: 'general', text: '@watcher final subject delivery' });
    const final = await watcher.waitForEvent(e => e.params.content.includes('final subject delivery'));
    assert.equal(final.params.content.match(/event · session.state · coord stopped/g)?.length, 1);
    await watcher.close(); await peer.close();
    // Remove the surviving role subscription before reusing the fixture's names.
    await ui.request({ type: 'event.unsubscribe', subscription: rows[0]!.id, as: { name: 'watcher' } });
  }
});

test('usage thresholds name cost or tokens, deduplicate overlapping subjects and survive restart', async t => {
  const root = await tempProject(t);
  // Suppress fallback polls while pushed usage and lifecycle states drive the subscription assertions.
  let { discovery, clock, fakes } = await componentHub(t, root);
  let ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  onCleanup(t, () => coord.close());
  await coord.waitForPresence(['coord']);
  const launched = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { name: string; pid: number; sessionId: string } }).process;
  const workerPeer = await launchedSpoke(t, root, p);
  fakes['claude-code']!.idle('worker');
  await ui.waitFor(f => f.type === 'session.state' && f.session === 'worker' && f.state === 'idle');

  await coord.waitForPresence(['coord', 'worker']);
  for (const threshold of [undefined, {}, { tokens: 0 }, { tokens: 1.5 }, { cost: -1 }, { cost: 1, tokens: 5 }, { dollars: 1 }]) {
    assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject: { session: 'worker' }, events: ['usage'], threshold })).ok, false);
    assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'coord' }, subject: { session: 'worker' }, events: ['usage'], threshold })).ok, false);
  }
  for (const subject of [{ session: 'worker' }, { role: 'implementer' }]) {
    const result = await coord.call<{ ok: boolean }>('subscribe', { subject, events: ['usage'], threshold: { cost: 3 } });
    assert.equal(result.ok, true);
  }
  const token = await clandWithEnv(root, {}, 'subscribe', 'session', 'worker', '--event', 'usage', '--tokens', '1000000', '--as', 'coord', '--json');
  assert.equal(token.code, 0, token.stderr);
  const signal = async (usage: Record<string, number>) => {
    const before = ui.frames.filter(f => f.type === 'session.usage' && f.session === 'worker').length;
    fakes['claude-code']!.feedUsage('worker', { total: { inputTokens: usage.input_tokens!, totalTokens: usage.input_tokens!, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, ...(usage.cost === undefined ? {} : { cost: usage.cost }) } });
    await clock.advance(1000);
    await eventually('usage snapshot published', () => ui.frames.filter(f => f.type === 'session.usage' && f.session === 'worker').length > before || undefined);
  };
  const usageEvents = async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.detail?.event === 'usage');
  };
  await signal({ input_tokens: 400000 });
  assert.equal((await usageEvents()).length, 0, 'unknown cost cannot cross a cost threshold');
  await signal({ input_tokens: 1000000, cost: 3 });
  assert.equal((await usageEvents()).length, 2, 'one crossing per token/cost threshold despite overlapping subjects');
  await signal({ input_tokens: 1000001, cost: 3.1 });
  assert.equal((await usageEvents()).length, 2, 'updates above the threshold do not repeat the event');
  const subscriptions = (await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default);
  ui.close();
  await stopComponentHub(root);
  ({ discovery, fakes } = await componentHub(t, root));
  ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  await coord.waitForPresence(['coord', 'worker']);
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), subscriptions);
  await signal({ input_tokens: 1000001, cost: 3.1 });
  assert.equal((await usageEvents()).length, 2, 'restart remembers the already crossed thresholds');
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord threshold digest' });
  const delivered = await coord.waitForEvent(e => e.params.content.includes('threshold digest'));
  assert.equal(delivered.params.content.match(/event · usage ·/g)?.length, 2);
  assert.doesNotMatch(delivered.params.content, /×2/);
});

// T2: hub time is driven by FakeClock; protocol peers run in-process.
test('the default coalescing window includes 59999 ms and excludes 60000 ms', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), now: () => clock.now() });
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles(), clock });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const coord = await inProcessSpoke(t, { hub, name: 'coord', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  await coord.waitForPresence(['coord']);
  const item = (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Default window' })).item.id;
  await coord.call('subscribe', { subject: { item }, events: ['task'] });
  await coord.call('task.claim', { id: item });
  await coord.call('task.claim', { id: item, release: true });
  await clock.advance(59_999);
  await coord.call('task.claim', { id: item });
  await coord.call('task.claim', { id: item, release: true });
  await clock.advance(1);
  await coord.call('task.claim', { id: item });
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord default boundary' });
  const delivered = await coord.waitForEvent(e => e.params.content.includes('default boundary'));
  assert.equal(delivered.params.content.match(/claimed by coord/g)?.length, 2);
  assert.equal(delivered.params.content.match(/claimed by coord \(×2\)/g)?.length, 1);
  assert.match(delivered.params.content, /claimed by coord \(×2\)[\s\S]*claimed by coord/);
});

test('equal events outside the configured coalescing window remain separate', async t => {
  const { ui, coord, clock } = await setup(t, undefined, { CLAND_TEST_EVENT_WINDOW_MS: '250' });
  const item = (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Coalescing window' })).item.id;
  await coord.call('subscribe', { subject: { item }, events: ['task'] });
  await coord.call('task.claim', { id: item });
  await coord.call('task.claim', { id: item, release: true });
  await clock.advance(300);
  await coord.call('task.claim', { id: item });
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord window boundary' });
  const delivered = await coord.waitForEvent(e => e.params.content.includes('window boundary'));
  assert.equal(delivered.params.content.match(/claimed by coord/g)?.length, 2);
  assert.doesNotMatch(delivered.params.content, /×/);
});

test('the cap retains final subject events and leaves mixed progress uncapped', async t => {
  const { ui, coord, rev } = await setup(t);
  const topic = (await coord.call<{ topic: { id: string } }>('topic.create', { title: 'Final fact after overflow' })).topic.id;
  await rev.call('subscribe', { subject: { topic }, events: ['artifact'] });
  for (let i = 0; i < 12; i++) {
    assert.equal((await coord.call<{ ok: boolean }>('artifact.create', { kind: 'prompt', title: `bounded-${i}`, topic, content: 'material', status: 'draft' })).ok, true);
    assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['rev'], text: `progress-${i}`, kind: 'progress' })).ok, true);
  }
  await ui.request({ type: 'topic.close', topic });
  assert.deepEqual((await rev.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), []);
  await ui.request({ type: 'topic.send', topic: 'general', text: '@rev cap with final fact' });
  const delivered = await rev.waitForEvent(e => e.params.content.includes('cap with final fact'));
  assert.equal(delivered.params.content.match(/event · (artifact|topic) ·/g)?.length, 10);
  assert.match(delivered.params.content, /event · topic · .* closed/);
  assert.match(delivered.params.content, /and 3 more/);
  for (let i = 0; i < 12; i++) assert.ok(delivered.params.content.includes(`progress-${i}\n`));
});

test('subtree subjects include sessions working on descendant items and survive their death', async t => {
  const root = await tempProject(t);

  // Suppress fallback polls while pushed usage and lifecycle states drive the subscription assertions.
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  onCleanup(t, () => coord.close());
  await coord.waitForPresence(['coord']);
  const parent = ((await ui.request({ type: 'task.create', title: 'Parent', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const child = ((await ui.request({ size: 'M', type: 'task.create', title: 'Child', parent })).value as { item: { id: string } }).item.id;
  await coord.call('subscribe', { subject: { subtree: parent }, events: ['session.state'] });
  const launched = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code', item: child }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { name: string; pid: number; sessionId: string } }).process;
  const workerPeer = await launchedSpoke(t, root, p);
  await coord.waitForPresence(['coord', 'worker']);
  fakes['claude-code']!.idle('worker');
  await ui.waitFor(f => f.type === 'session.state' && f.session === 'worker' && f.state === 'idle');
  await ui.request({ type: 'session.signal', session: 'worker', launch: p.sessionId, event: 'permission', payload: { tool_name: 'Bash' }, at: clock.now().getTime() });
  assert.equal((await ui.request({ type: 'session.stop', session: 'worker' })).ok, true);
  assert.equal((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default).length, 1);
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord descendant lifecycle' });
  const delivered = await coord.waitForEvent(e => e.params.content.includes('descendant lifecycle'));
  assert.match(delivered.params.content, new RegExp(`worker launched · ${child}`));
  assert.match(delivered.params.content, /worker waiting for approval/);
  assert.match(delivered.params.content, new RegExp(`worker stopped · ${child}`));
});


test('deleting a subscribed topic records its final fact and ends only that exact subject', async t => {
  const { ui, coord, rev } = await setup(t);
  const parent = (await coord.call<{ item: { id: string } }>('task.create', { kind: 'epic', title: 'Delete tree' })).item.id;
  const child = (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Delete child', parent })).item.id;
  const topic = (await coord.call<{ topic: { id: string } }>('topic.create', { title: 'Delete topic', item: child })).topic.id;
  await coord.call('subscribe', { subject: { topic }, events: ['artifact'] });
  await rev.call('subscribe', { subject: { subtree: parent }, events: ['topic'] });
  assert.equal((await ui.request({ type: 'topic.delete', topic })).ok, true);
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), []);
  assert.equal((await rev.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default).length, 1);
  for (const spoke of [coord, rev]) {
    await ui.request({ type: 'topic.send', topic: 'general', text: `@${spoke === coord ? 'coord' : 'rev'} deleted subject` });
    const delivered = await spoke.waitForEvent(e => e.params.content.includes('deleted subject'));
    assert.match(delivered.params.content, new RegExp(`event · topic · ${topic} deleted`));
  }
});

test('removed and reparented descendants notify former ancestor subtrees without ending them', async t => {
  const { root, ui, coord, rev } = await setup(t);
  const parent = (await coord.call<{ item: { id: string } }>('task.create', { kind: 'epic', title: 'Original tree' })).item.id;
  const elsewhere = (await coord.call<{ item: { id: string } }>('task.create', { kind: 'epic', title: 'Destination tree' })).item.id;
  const moved = (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Moved child', parent })).item.id;
  const removed = (await coord.call<{ item: { id: string; path: string } }>('task.create', { size: 'M', title: 'Removed child', parent })).item;
  await rev.call('subscribe', { subject: { subtree: parent }, events: ['task'] });
  await coord.call('subscribe', { subject: { item: removed.id }, events: ['artifact'] });
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: moved, parent: elsewhere })).ok, true);
  await unlink(join(root, removed.path)); // real watcher removal, after the tracker has lost the indexed descendant
  await eventually('removed subject subscriptions end', async () => (await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default).length === 0 || undefined);
  assert.equal((await rev.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default).length, 1);
  await ui.request({ type: 'topic.send', topic: 'general', text: '@rev departed descendants' });
  const tree = await rev.waitForEvent(e => e.params.content.includes('departed descendants'));
  assert.match(tree.params.content, new RegExp(`event · task · ${moved} left subtree`));
  assert.match(tree.params.content, new RegExp(`event · task · ${removed.id} removed`));
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord removed subject' });
  const exact = await coord.waitForEvent(e => e.params.content.includes('removed subject'));
  assert.match(exact.params.content, new RegExp(`event · task · ${removed.id} removed`));
  assert.doesNotMatch(exact.params.content, /left subtree/);
});

test('restart reconciles a committed stop once and retains role and ancestor subtree subscriptions', async t => {
  const root = await tempProject(t);
  let { discovery, clock, fakes } = await componentHub(t, root);
  let ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  onCleanup(t, () => coord.close()); onCleanup(t, () => rev.close());
  await coord.waitForPresence(['coord', 'rev']);
  const parent = (await coord.call<{ item: { id: string } }>('task.create', { kind: 'epic', title: 'Recovery tree' })).item.id;
  const child = (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Recovery child', parent })).item.id;
  const workerLaunch = await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer', item: child });
  assert.equal(workerLaunch.ok, true);
  const workerPeer = await launchedSpoke(t, root, (workerLaunch.value as { process: { name: string; sessionId: string } }).process);
  await coord.waitForPresence(['coord', 'rev', 'worker']);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
  const watcherLaunch = await ui.request({ type: 'session.launch', name: 'now-watcher', harness: 'codex', role: 'reviewer' });
  assert.equal(watcherLaunch.ok, true, watcherLaunch.error);
  const watcherPeer = await launchedSpoke(t, root, (watcherLaunch.value as { process: { name: string; sessionId: string } }).process);
  await coord.waitForPresence(['coord', 'rev', 'worker', 'now-watcher']);
  assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'now-watcher' }, subject: { session: 'worker' }, events: ['session.state'], digest: 'now' })).ok, true);
  await coord.call('subscribe', { subject: { session: 'worker' }, events: ['usage'], threshold: { tokens: 100 } });
  await rev.call('subscribe', { subject: { role: 'implementer' }, events: ['session.state'] });
  await rev.call('subscribe', { subject: { subtree: parent }, events: ['session.state'] });
  assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'worker' }, subject: { topic: 'general' }, events: ['artifact'] })).ok, true);
  ui.close();
  await stopComponentHub(root);
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.prepare("update harness_processes set status = 'stopped' where name = 'worker'").run(); // crash gap: status persisted, event listener never ran
  db.close();
  for (let restart = 0; restart < 2; restart++) {
    ({ discovery, fakes } = await componentHub(t, root));
    ui = await connectUi(t, discovery);
    const listing = await clandWithEnv(root, {}, 'hub', 'subscriptions', '--json');
    assert.equal(listing.code, 0, listing.stderr);
    assert.deepEqual(JSON.parse(listing.stdout).subscriptions.filter((s: Subscription) => !s.default).map((s: Subscription) => s.subject), [{ role: 'implementer' }, { subtree: parent }]);
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const final = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text.includes('worker stopped'));
    assert.equal(final.length, 2, 'one turn group and one now group, without replay on the second restart');
    assert.deepEqual(final.find(m => m.detail?.digest === 'turn')?.to, ['coord', 'rev']);
    const immediate = final.find(m => m.to.includes('now-watcher'));
    assert.equal(immediate?.detail?.digest, 'now', 'startup knows which running harness can steer before reconciling terminal rows');
    await eventually('recovered final event injected immediately', async () => {
      const snapshot = await ui.request({ type: 'topic.history', topic: 'agents' });
      return (snapshot.value as { messages: Array<Message & { stage: string }> }).messages.find(m => m.id === immediate?.id)?.stage === 'injected' || undefined;
    });
    const inputs = fakes.codex!.injections.filter(i => i.process.name === 'now-watcher' && i.message.text.includes('event · session.state · worker stopped'));
    assert.equal(inputs.length, restart ? 0 : 1, 'restarting an admitted now fact does not inject twice');
    if (!restart) { ui.close(); await stopComponentHub(root); }
  }
});
