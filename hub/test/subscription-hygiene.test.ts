import { DatabaseSync } from 'node:sqlite';
import { mkdir, unlink, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, clandWithEnv, clauseAnswered, eventually, connectUi, connectWsUi, fakeCodex, fakeClaude, killDaemon, spawnSpoke, startDaemon, startHub, tempProject, sleep, TEST_SECRET } from './harness.ts';
import type { Message, Subscription } from '../src/protocol.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { projectSessions } from '../src/adapters/index.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { writeDiscovery } from '../src/project.ts';

test('launched, died and launched within sixty seconds preserve every transition', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50 });
  let now = Date.now();
  const hub = await startHub({ now: () => new Date(now) });
  t.after(() => hub.close());
  const dir = join(root, '.cland');
  await mkdir(dir, { recursive: true });
  const socket = join(dir, 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const discoveryFile = join(dir, 'hub.json');
  writeDiscovery(discoveryFile, { root, socket, port: hub.port, secret: TEST_SECRET, pid: process.pid, version: 'test' });
  const project = projectSessions({ core: hub.core, root, db: join(dir, 'hub.db'), discoveryFile, log: () => {}, env: { ...process.env, ...fake.env } });
  t.after(() => project.close());
  hub.dispatcher.useSessions(project.sessions);
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ hub, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await coord.call('subscribe', { subject: { role: 'implementer' }, events: ['session.state'] });
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { pid: number; sessionId: string } }).process;
  now += 1000;
  process.kill(p.pid, 'SIGKILL');
  await ui.waitFor(f => f.type === 'session.process' && (f.process as { sessionId: string; status: string }).sessionId === p.sessionId && (f.process as { status: string }).status === 'exited');
  now += 1000;
  const relaunched = await ui.request({ type: 'session.resume', session: 'impl', relaunch: true });
  assert.equal(relaunched.ok, true, relaunched.error);
  t.after(() => killDaemon((relaunched.value as { process: { pid: number } }).process.pid));
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord consecutive lifecycle' });
  const digest = await coord.waitForEvent(e => e.params.content.includes('consecutive lifecycle'));
  assert.deepEqual(digest.params.content.match(/event · session.state · impl (launched|died)/g), [
    'event · session.state · impl launched', 'event · session.state · impl died', 'event · session.state · impl launched',
  ]);
  assert.doesNotMatch(digest.params.content, /×/);
});

async function setup(t: test.TestContext, config?: string, env: Record<string, string> = {}) {
  const root = await tempProject(t);
  if (config) { await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland', 'config.toml'), config); }
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(async () => { await coord.close(); await rev.close(); });
  await coord.waitForPresence(['coord', 'rev']);
  return { root, ui, coord, rev };
}

test('coalescing and the event cap freeze per recipient across restart and partial delivery', async t => {
  const { root, ui, coord, rev } = await setup(t);
  const made = await coord.call<{ item: { id: string } }>('task.create', { title: 'Counts' });
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
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, root);
  const ui2 = await connectUi(t, discovery);
  const rev2 = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(() => rev2.close());
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
  const child = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Child', parent })).item.id;
  const other = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Elsewhere' })).item.id;
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
  const fixture = await setup(t, '[hygiene]\nrate_limit_max = 2\nevent_limit_max = 2\nevent_limit_window_minutes = 10\n');
  const { root, coord } = fixture;
  let ui = fixture.ui;
  const item = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Limits' })).item.id;
  await coord.call('subscribe', { subject: { item }, events: ['task'] });
  for (const status of ['planned', 'review']) await coord.call('task.edit', { id: item, status });
  ui.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, root);
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

for (const harness of ['claude-code', 'codex', 'opencode']) {
  test(`${harness}: digest now steers through the existing queue or waits for the next turn`, async t => {
    const root = await tempProject(t);
    const fake = harness === 'claude-code' ? await fakeClaude(t, { pollMs: 10_000, turnMs: 2500 }) : harness === 'codex' ? await fakeCodex(t, { pollMs: 10_000, turnMs: 2500 }) : null;
    const home = fake?.home ?? join(root, '.fake-opencode');
    const env = fake?.env ?? { PATH: `${fileURLToPath(new URL('./fakes/opencode', import.meta.url))}:${process.env.PATH ?? ''}`, FAKE_OPENCODE_HOME: home, CLAND_ADAPTER_POLL_MS: '10000', CLAND_INJECT_TIMEOUT_MS: '5000' };
    const { discovery } = await startDaemon(t, root, env);
    const ui = await connectUi(t, discovery);
    await ui.request({ type: 'subscribe' });
    const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const p = (launched.value as { process: { pid: number; sessionId: string; harnessId: string; harnessSessionId: string } }).process;
    t.after(() => killDaemon(p.pid));
    if (harness !== 'codex') await clauseAnswered(ui, 'coord');
    await eventually('idle before steering', async () => {
      const status = await ui.request({ type: 'hub.status' });
      return (status.value as { harnesses: Array<{ name: string; state: string }> }).harnesses.some(p => p.name === 'coord' && p.state === 'idle') || undefined;
    });
    const item = ((await ui.request({ type: 'task.create', title: 'Immediate event' })).value as { item: { id: string } }).item.id;
    const subscribed = await clandWithEnv(root, env, 'subscribe', 'item', item, '--event', 'task', '--digest', 'now', '--as', 'coord', '--json');
    assert.equal(subscribed.code, 0, subscribed.stderr);
    assert.equal(JSON.parse(subscribed.stdout).subscription.digest, 'now');
    await ui.request({ type: 'topic.send', topic: 'general', text: '@coord take your time with a running turn' });
    await ui.waitFor(f => f.type === 'session.state' && f.session === 'coord' && f.state === 'busy');
    if (harness !== 'claude-code') {
      const topic = ((await ui.request({ type: 'topic.create', title: 'Before immediate cap' })).value as { topic: { id: string } }).topic.id;
      const held = await clandWithEnv(root, env, 'subscribe', 'topic', topic, '--event', 'artifact', '--as', 'coord', '--json');
      assert.equal(held.code, 0, held.stderr);
      for (let i = 0; i < 12; i++) assert.equal((await ui.request({ type: 'artifact.create', kind: 'prompt', title: `held-${i}`, topic, content: 'material', status: 'draft' })).ok, true);
    }
    assert.equal((await ui.request({ type: 'task.edit', item, status: 'planned' })).ok, true);
    const recorded = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · task · ${item} status changed backlog → planned`);
    const id = (recorded.message as Message).id;
    const inputLog = () => readFile(harness === 'claude-code' ? join(home, 'jobs', `${p.harnessId}.log`) : harness === 'codex' ? join(home, 'log', `${p.pid}.log`) : join(home, 'prompts', `${p.harnessSessionId}.log`), 'utf8').catch(() => '');
    if (harness === 'claude-code') {
      await sleep(350);
      assert.equal((await inputLog()).includes(`event · task · ${item}`), false);
      await ui.request({ type: 'topic.send', topic: 'general', text: '@coord next turn releases now fallback' });
    }
    await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
    const log = await inputLog();
    assert.match(log, new RegExp(`event · task · ${item}`));
    if (harness === 'codex') assert.match(log, /turn\/steer .*event · task/s);
    if (harness === 'opencode') assert.match(log, /steer/);
    if (harness !== 'claude-code') {
      assert.equal(log.match(/event · (artifact|task) ·/g)?.length, 10, 'the immediate event itself occupies one of the ten event slots');
      assert.match(log, /and 3 more/);
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      const events = (history.value as { messages: Array<Message & { stage: string }> }).messages.filter(m => m.kind === 'event');
      assert.equal(events.length, 13);
      assert.ok(events.every(m => m.stage === 'injected'), 'summarized members settle with the admitted immediate batch');
    }
    // Subscriber death removes every owned subscription. The final event remains queued for another subscriber.
    const watcher = await spawnSpoke({ cwd: root, discover: true, name: 'watcher', sessionId: 'watcher-id' });
    t.after(() => watcher.close());
    await watcher.waitForPresence(['watcher', 'coord']);
    await watcher.call('subscribe', { subject: { session: 'coord' }, events: ['usage'], threshold: { tokens: 999999999 } });
    await watcher.call('subscribe', { subject: { role: 'coordinator' }, events: ['session.state'] });
    assert.equal((await ui.request({ type: 'session.stop', session: 'coord' })).ok, true);
    const listing = await cland(root, 'hub', 'subscriptions', '--json');
    const rows = JSON.parse(listing.stdout).subscriptions.filter((s: Subscription) => !s.default);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].subject, { role: 'coordinator' });
    await ui.request({ type: 'topic.send', topic: 'general', text: '@watcher final subject delivery' });
    const final = await watcher.waitForEvent(e => e.params.content.includes('final subject delivery'));
    assert.equal(final.params.content.match(/event · session.state · coord stopped/g)?.length, 1);
  });
}

test('usage thresholds name cost or tokens, deduplicate overlapping subjects and survive restart', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 10_000 });
  let { discovery } = await startDaemon(t, root, fake.env);
  let ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const launched = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { pid: number; sessionId: string } }).process;
  t.after(() => killDaemon(p.pid));
  await ui.waitFor(f => f.type === 'session.state' && f.session === 'worker' && f.state === 'idle');
  await ui.waitFor(f => f.type === 'session.usage' && f.session === 'worker');
  await coord.waitForPresence(['coord', 'worker']);
  for (const threshold of [undefined, {}, { tokens: 0 }, { tokens: 1.5 }, { cost: -1 }, { cost: 1, tokens: 5 }, { dollars: 1 }]) {
    assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject: { session: 'worker' }, events: ['usage'], threshold })).ok, false);
    assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'coord' }, subject: { session: 'worker' }, events: ['usage'], threshold })).ok, false);
  }
  for (const subject of [{ session: 'worker' }, { role: 'implementer' }]) {
    const result = await coord.call<{ ok: boolean }>('subscribe', { subject, events: ['usage'], threshold: { cost: 3 } });
    assert.equal(result.ok, true);
  }
  const token = await clandWithEnv(root, fake.env, 'subscribe', 'session', 'worker', '--event', 'usage', '--tokens', '1000000', '--as', 'coord', '--json');
  assert.equal(token.code, 0, token.stderr);
  const signal = async (usage: Record<string, number>) => {
    const before = ui.frames.filter(f => f.type === 'session.usage' && f.session === 'worker').length;
    assert.equal((await ui.request({ type: 'session.signal', session: 'worker', launch: p.sessionId, event: 'mod-turn-complete', payload: { usage }, at: Date.now() })).ok, true);
    await eventually('usage snapshot published', () => ui.frames.filter(f => f.type === 'session.usage' && f.session === 'worker').length > before || undefined);
  };
  const usageEvents = async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.detail?.event === 'usage');
  };
  await signal({ input_tokens: 400000 });
  assert.equal((await usageEvents()).length, 0, 'unknown cost cannot cross a cost threshold');
  await signal({ input_tokens: 600000, cost: 3 });
  assert.equal((await usageEvents()).length, 2, 'one crossing per token/cost threshold despite overlapping subjects');
  await signal({ input_tokens: 1, cost: 0.1 });
  assert.equal((await usageEvents()).length, 2, 'updates above the threshold do not repeat the event');
  const subscriptions = (await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default);
  ui.close();
  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  ({ discovery } = await startDaemon(t, root, fake.env));
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

test('the default coalescing window includes 59999 ms and excludes 60000 ms', async t => {
  const root = await tempProject(t);
  let now = Date.now();
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  t.after(() => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles(), now: () => new Date(now) });
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const coord = await spawnSpoke({ hub, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const item = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Default window' })).item.id;
  await coord.call('subscribe', { subject: { item }, events: ['task'] });
  await coord.call('task.claim', { id: item });
  await coord.call('task.claim', { id: item, release: true });
  now += 59_999;
  await coord.call('task.claim', { id: item });
  await coord.call('task.claim', { id: item, release: true });
  now += 1;
  await coord.call('task.claim', { id: item });
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord default boundary' });
  const delivered = await coord.waitForEvent(e => e.params.content.includes('default boundary'));
  assert.equal(delivered.params.content.match(/claimed by coord/g)?.length, 2);
  assert.equal(delivered.params.content.match(/claimed by coord \(×2\)/g)?.length, 1);
  assert.match(delivered.params.content, /claimed by coord \(×2\)[\s\S]*claimed by coord/);
});

test('equal events outside the configured coalescing window remain separate', async t => {
  const { ui, coord } = await setup(t, undefined, { CLAND_TEST_EVENT_WINDOW_MS: '250' });
  const item = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Coalescing window' })).item.id;
  await coord.call('subscribe', { subject: { item }, events: ['task'] });
  await coord.call('task.claim', { id: item });
  await coord.call('task.claim', { id: item, release: true });
  await sleep(300);
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
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git('add', '.');
  git('commit', '-qm', 'Initial');
  const initialized = await cland(root, 'init', '--json');
  assert.equal(initialized.code, 0, initialized.stderr);
  const fake = await fakeClaude(t, { pollMs: 10_000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const parent = ((await ui.request({ type: 'task.create', title: 'Parent', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const child = ((await ui.request({ type: 'task.create', title: 'Child', parent })).value as { item: { id: string } }).item.id;
  await coord.call('subscribe', { subject: { subtree: parent }, events: ['session.state'] });
  const launched = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code', item: child }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { pid: number; sessionId: string } }).process;
  t.after(() => killDaemon(p.pid));
  await coord.waitForPresence(['coord', 'worker']);
  await ui.waitFor(f => f.type === 'session.state' && f.session === 'worker' && f.state === 'idle');
  await ui.request({ type: 'session.signal', session: 'worker', launch: p.sessionId, event: 'permission', payload: { tool_name: 'Bash' }, at: Date.now() });
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
  const child = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Delete child', parent })).item.id;
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
  const moved = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Moved child', parent })).item.id;
  const removed = (await coord.call<{ item: { id: string; path: string } }>('task.create', { title: 'Removed child', parent })).item;
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
  const fake = await fakeCodex(t);
  let { discovery } = await startDaemon(t, root, fake.env);
  let ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(async () => { await coord.close(); await rev.close(); });
  await coord.waitForPresence(['coord', 'rev']);
  const parent = (await coord.call<{ item: { id: string } }>('task.create', { kind: 'epic', title: 'Recovery tree' })).item.id;
  const child = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Recovery child', parent })).item.id;
  assert.equal((await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer', item: child })).ok, true);
  await coord.waitForPresence(['coord', 'rev', 'worker']);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
  const watcherLaunch = await ui.request({ type: 'session.launch', name: 'now-watcher', harness: 'codex', role: 'reviewer' });
  assert.equal(watcherLaunch.ok, true, watcherLaunch.error);
  const watcher = (watcherLaunch.value as { process: { pid: number } }).process;
  await coord.waitForPresence(['coord', 'rev', 'worker', 'now-watcher']);
  assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'now-watcher' }, subject: { session: 'worker' }, events: ['session.state'], digest: 'now' })).ok, true);
  await coord.call('subscribe', { subject: { session: 'worker' }, events: ['usage'], threshold: { tokens: 100 } });
  await rev.call('subscribe', { subject: { role: 'implementer' }, events: ['session.state'] });
  await rev.call('subscribe', { subject: { subtree: parent }, events: ['session.state'] });
  assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'worker' }, subject: { topic: 'general' }, events: ['artifact'] })).ok, true);
  ui.close();
  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.prepare("update harness_processes set status = 'stopped' where name = 'worker'").run(); // crash gap: status persisted, event listener never ran
  db.close();
  for (let restart = 0; restart < 2; restart++) {
    ({ discovery } = await startDaemon(t, root, fake.env));
    ui = await connectUi(t, discovery);
    const listing = await clandWithEnv(root, fake.env, 'hub', 'subscriptions', '--json');
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
    const readInputs = async () => {
      const log = await readFile(join(fake.home, 'log', `${watcher.pid}.log`), 'utf8');
      // The fake logs both steer admission and consumption; count only consumed input items.
      return [...log.matchAll(/^\d{4}-\d\d-\d\dT\S+ turn [\w-]+ item: ([\s\S]*?)(?=^\d{4}-\d\d-\d\dT\S+ |$(?![\s\S]))/gm)]
        .filter(m => m[1]?.includes('event · session.state · worker stopped'));
    };
    await eventually('fake consumes recovered final input', async () => (await readInputs()).length > 0 || undefined);
    assert.equal((await readInputs()).length, 1, 'ordinary queue retry/restart does not inject the now fact twice');
    if (!restart) { ui.close(); assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0); }
  }
});
