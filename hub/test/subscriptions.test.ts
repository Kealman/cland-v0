import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withDiscoveredPid, cland, clandWithEnv, clauseAnswered, eventually, connectSocket, connectUi, fakeCodex, fakeClaude, killDaemon, spawnSpoke, projectHub, startDaemon, tempProject, sleep } from './harness.ts';
import { PROTOCOL_VERSION, type Message } from '../src/protocol.ts';
import { taskWriteGate } from './tracker-write-gate.ts';

type Subscription = { id: string; subject: { item: string } | { session: string }; events: string[]; digest: string; default?: true };

test('caller-owned subscriptions hold task status events in the ordinary next-turn digest', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(async () => { await coord.close(); await impl.close(); });
  await coord.waitForPresence(['coord', 'impl']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Subscription target', assignee: 'impl' });
  await impl.call('task.claim', { id: item.id });
  const subscribed = await coord.call<{ ok: boolean; subscription: Subscription }>('subscribe', { subject: { item: item.id }, events: ['task'] });
  assert.equal(subscribed.ok, true, JSON.stringify(subscribed));
  assert.deepEqual(subscribed.subscription.subject, { item: item.id });
  assert.equal(subscribed.subscription.digest, 'turn');
  assert.deepEqual((await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), []);
  const duplicate = await coord.call<{ subscription: Subscription }>('subscribe', { subject: { item: item.id }, events: ['task'] });
  assert.equal(duplicate.subscription.id, subscribed.subscription.id);
  const mark = coord.events.length;
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, status: 'planned' })).ok, true);
  const queued = await ui.waitFor(f => f.type === 'message' && (f.message as Message).kind === 'event' && (f.message as Message).to.includes('coord'));
  assert.equal((queued.message as Message).text, `event · task · ${item.id} status changed in progress → planned`);
  assert.equal((queued.message as Message & { stage: string }).stage, 'queued');
  await sleep(100);
  assert.equal(coord.events.length, mark, 'an event cannot start a turn');
  assert.equal((await impl.call<{ ok: boolean }>('send', { to: ['coord'], text: 'forged event', kind: 'event' })).ok, false);
  const socket = await connectSocket(discovery.socket);
  t.after(() => socket.close());
  socket.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, sessionId: 'impl-id', name: 'impl', cwd: root });
  assert.equal((await socket.next()).type, 'welcome');
  socket.send({ type: 'send', id: 'forged-kind', to: ['coord'], text: 'forged raw event', kind: 'event' });
  const refused = await socket.next();
  assert.equal(refused.type, 'result');
  assert.equal(refused.ok, false, 'the hub itself refuses session-originated kind event');
  socket.close();
  await socket.closed;
  await impl.call('send', { to: ['coord'], text: 'next turn' });
  const delivery = await coord.waitForEvent(e => e.params.meta?.from === 'impl' && e.params.content.includes('next turn'));
  assert.match(delivery.params.content, /event · task · T-\d+ status changed in progress → planned[\s\S]*next turn/);
  const removedByOther = await impl.call<{ removed: boolean }>('unsubscribe', { subscription: subscribed.subscription.id });
  assert.equal(removedByOther.removed, false);
  assert.equal((await coord.call<{ removed: boolean }>('unsubscribe', { subscription: subscribed.subscription.id })).removed, true);
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), []);
  const count = ui.frames.filter(f => f.type === 'message' && (f.message as Message).kind === 'event' && (f.message as Message).to.includes('coord')).length;
  await coord.call('task.edit', { id: item.id, status: 'review' });
  await impl.call('send', { to: ['coord'], text: 'after unsubscribe' });
  await coord.waitForEvent(e => e.params.content === 'after unsubscribe');
  assert.equal(ui.frames.filter(f => f.type === 'message' && (f.message as Message).kind === 'event' && (f.message as Message).to.includes('coord')).length, count);
});

test('CLI and MCP share durable subscriptions; unsubscribing leaves the queued event for its next turn', async t => {
  const root = await tempProject(t);
  let { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(async () => { await coord.close(); await impl.close(); });
  await coord.waitForPresence(['coord', 'impl']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Durable subscription', assignee: 'impl' });
  await impl.call('task.claim', { id: item.id });
  const created = await cland(root, 'subscribe', 'item', item.id, '--event', 'task', '--as', 'coord', '--json');
  assert.equal(created.code, 0, created.stderr);
  const { subscription } = JSON.parse(created.stdout) as { subscription: Subscription };
  await coord.call('task.edit', { id: item.id, status: 'planned' });
  await ui.waitFor(f => f.type === 'message' && (f.message as Message).kind === 'event' && (f.message as Message).to.includes('coord'));
  ui.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  ({ discovery } = await startDaemon(t, root));
  ui = await connectUi(t, discovery);
  await coord.waitForPresence(['coord', 'impl']);
  const listing = await cland(root, 'subscriptions', '--as', 'coord', '--json');
  assert.equal(listing.code, 0, listing.stderr);
  assert.deepEqual(JSON.parse(listing.stdout).subscriptions.filter((s: Subscription) => !s.default), [subscription]);
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [subscription]);
  const removed = await cland(root, 'unsubscribe', subscription.id, '--as', 'coord', '--json');
  assert.equal(removed.code, 0, removed.stderr);
  assert.equal(JSON.parse(removed.stdout).removed, true);
  await coord.call('task.edit', { id: item.id, status: 'review' });
  await impl.call('send', { to: ['coord'], text: 'release durable event' });
  const received = await coord.waitForEvent(e => e.params.meta?.from === 'impl' && e.params.content.includes('release durable event'));
  assert.match(received.params.content, /status changed in progress → planned/);
  assert.doesNotMatch(received.params.content, /status changed planned → review/);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const events = (history.value as { messages: Array<Message & { stage: string }> }).messages.filter(m => m.kind === 'event' && m.to.includes('coord'));
  assert.equal(events.length, 1);
  await coord.call('send', { to: ['impl'], text: 'release the lead digest' });
  await impl.waitForEvent(e => e.params.content.includes('release the lead digest'));
  await eventually('both recipients delivered', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Array<Message & { stage: string }> }).messages.find(m => m.id === events[0]?.id)?.stage === 'delivered' || undefined;
  });
});

test('an unchanged cached item emits its first committed status change after restart', async t => {
  const root = await tempProject(t);
  let { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Unchanged cached item' });
  await coord.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  ui.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  ({ discovery } = await startDaemon(t, root));
  ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  await coord.waitForPresence(['coord']);
  const before = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((before.value as { messages: Message[] }).messages.filter(m => m.kind === 'event'), [], 'restart itself emits no task transition');
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, status: 'planned' })).ok, true);
  await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · task · ${item.id} status changed backlog → planned`);
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'impl-id' });
  t.after(() => sender.close());
  await sender.waitForPresence(['coord', 'impl']);
  await sender.call('send', { to: ['coord'], text: 'first post-restart turn' });
  const received = await coord.waitForEvent(e => e.params.content.includes('first post-restart turn'));
  assert.match(received.params.content, /status changed backlog → planned/);
});

test('adopting a provisional claim at hello does not announce another claim', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Provisional claim', assignee: 'impl' });
  await coord.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-real' });
  t.after(() => impl.close());
  await impl.waitForPresence(['coord', 'impl']);
  await eventually('provisional claim adopted', async () => {
    const result = await ui.request({ type: 'task.view', item: item.id });
    return (result.value as { item: { claim: { sessionId: string } } }).item.claim.sessionId === 'impl-real' || undefined;
  });
  await impl.call('send', { to: ['coord'], text: 'after claim adoption' });
  const received = await coord.waitForEvent(e => e.params.content.includes('after claim adoption'));
  assert.equal(received.params.content.match(/claimed by impl/g)?.length, 1);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text === `event · task · ${item.id} claimed by impl`).length, 1);
});

test('resume --relaunch announces each transition into running once for the same session id', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await coord.call('subscribe', { subject: { session: 'impl' }, events: ['session.state'] });
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const first = await withDiscoveredPid(ui, (launched.value as { process: { pid: number; sessionId: string } }).process);
  t.after(() => killDaemon(first.pid));
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord freeze initial launch' });
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true);
  for (const count of [2, 3]) {
    if (count === 3) assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true);
    await coord.call('subscribe', { subject: { session: 'impl' }, events: ['session.state'] });
    const result = await cland(root, 'session', 'resume', 'impl', '--relaunch', '--json');
    assert.equal(result.code, 0, result.stderr);
    const process = await withDiscoveredPid(ui, JSON.parse(result.stdout).process as { pid: number; sessionId: string });
    t.after(() => killDaemon(process.pid));
    assert.equal(process.sessionId, first.sessionId, 'relaunch retains the stable session identity');
    await eventually('launched event after relaunch', async () => {
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      return (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text === 'event · session.state · impl launched').length === count || undefined;
    });
    await ui.request({ type: 'topic.send', topic: 'general', text: `@coord freeze launch ${count}` });
  }
  assert.equal((await ui.request({ type: 'session.resume', session: 'impl' })).ok, true);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text === 'event · session.state · impl launched').length, 3, 'a live resume does not announce a launch');
});

test('session state and lifecycle events include death, held until the Coordinator next turns', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject: { session: 'impl' }, events: ['session.state'] })).ok, true);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = await withDiscoveredPid(ui, (launched.value as { process: { pid: number; sessionId: string } }).process);
  t.after(() => killDaemon(p.pid));
  await coord.waitForPresence(['coord', 'impl']);
  const event = (text: string) => ui.waitFor(f => f.type === 'message' && (f.message as Message).kind === 'event' && (f.message as Message).text === `event · session.state · impl ${text}`);
  await event('launched');
  for (const [state, hook, payload] of [['idle', 'turn-end', {}], ['busy', 'turn-start', {}], ['waiting for human', 'permission', { tool_name: 'AskUserQuestion' }], ['waiting for approval', 'permission', { tool_name: 'Bash' }]] as const) {
    const result = await ui.request({ type: 'session.signal', session: 'impl', launch: p.sessionId, event: hook, payload, at: Date.now() });
    assert.equal(result.ok, true, result.error);
    await event(state);
  }
  process.kill(p.pid, 'SIGKILL');
  const death = await event('died');
  assert.equal((death.message as Message & { stage: string }).stage, 'queued');
  assert.equal(coord.events.some(e => e.params.content.includes('event · session.state')), false);
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'messenger', sessionId: 'messenger' });
  t.after(() => impl.close());
  await impl.waitForPresence(['coord', 'messenger']);
  await impl.call('send', { to: ['coord'], text: 'Coordinator next turn' });
  const received = await coord.waitForEvent(e => e.params.meta?.from === 'messenger' && e.params.content.includes('Coordinator next turn'));
  assert.match(received.params.content, /impl died[\s\S]*Coordinator next turn/);
  await coord.call('subscribe', { subject: { session: 'impl' }, events: ['session.state'] });
  const relaunch = await ui.request({ type: 'session.resume', session: 'impl', relaunch: true });
  assert.equal(relaunch.ok, true, relaunch.error);
  assert.equal((relaunch.value as { process: { sessionId: string } }).process.sessionId, p.sessionId);
  assert.equal(ui.frames.filter(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · impl launched').length, 2, 'resuming an exited process emits launched');
  const stopped = await ui.request({ type: 'session.stop', session: 'impl' });
  assert.equal(stopped.ok, true, stopped.error);
  await event('stopped');
  assert.equal(ui.frames.filter(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · impl died').length, 1, 'an intentional stop does not report another death');
});

test('task events report claims, verdicts and closes once; ordinary comments do not become events', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(async () => { await coord.close(); await impl.close(); await rev.close(); });
  await coord.waitForPresence(['coord', 'impl', 'rev']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Workflow events', assignee: 'impl' });
  await coord.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  await impl.call('task.edit', { id: item.id, status: 'review' });
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'subscription-review' })).ok, true);
  await coord.call('task.comment', { id: item.id, text: 'An ordinary note.' });
  await coord.call('task.close', { id: item.id });
  await impl.call('send', { to: ['coord'], text: 'workflow digest' });
  const received = await coord.waitForEvent(e => e.params.meta?.from === 'impl' && e.params.content.includes('workflow digest'));
  assert.match(received.params.content, /claimed by impl/);
  assert.match(received.params.content, /verdict posted review not clear · full · subscription-review/);
  assert.match(received.params.content, /status changed review → in progress/);
  assert.match(received.params.content, /closed/);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const messages = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event').map(m => m.text);
  assert.deepEqual(messages, [
    `event · task · ${item.id} status changed backlog → in progress`,
    `event · task · ${item.id} claimed by impl`,
    `event · task · ${item.id} status changed in progress → review`,
    `event · task · ${item.id} status changed review → in progress`,
    `event · task · ${item.id} verdict posted review not clear · full · subscription-review`,
    `event · task · ${item.id} status changed in progress → done`,
    `event · task · ${item.id} closed`,
  ]);
});

for (const harness of ['claude-code', 'codex', 'opencode']) {
  test(`${harness}: events and progress use one ordered next-turn digest, before and after restart`, async t => {
    const root = await tempProject(t);
    // Suppress fallback polls while the test stages pushed session states.
    const fake = harness === 'claude-code' ? await fakeClaude(t, { pollMs: 10_000 }) : harness === 'codex' ? await fakeCodex(t, { pollMs: 10_000 }) : null;
    const home = fake?.home ?? join(root, '.fake-opencode');
    const env = fake?.env ?? { PATH: `${fileURLToPath(new URL('./fakes/opencode', import.meta.url))}:${process.env.PATH ?? ''}`, FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_TURN_MS: '30', CLAND_ADAPTER_POLL_MS: '10000', CLAND_INJECT_TIMEOUT_MS: '5000' };
    let { discovery } = await startDaemon(t, root, env);
    let ui = await connectUi(t, discovery);
    await ui.request({ type: 'subscribe' });
    const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const p = await withDiscoveredPid(ui, (launched.value as { process: { pid: number; sessionId: string; harnessId: string; harnessSessionId: string } }).process);
    t.after(() => killDaemon(p.pid));
    if (harness !== 'codex') await clauseAnswered(ui, 'coord');
    const idle = () => eventually('coord idle', async () => {
      const result = await ui.request({ type: 'hub.status', flushLogs: true });
      return (result.value as { harnesses: Array<{ name: string; state: string }> }).harnesses.some(p => p.name === 'coord' && p.state === 'idle') || undefined;
    });
    await idle();
    const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
    t.after(() => sender.close());
    await sender.waitForPresence(['impl', 'coord']);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Harness subscription' });
    const item = (made.value as { item: { id: string } }).item;
    const subscribed = await clandWithEnv(root, env, 'subscribe', 'item', item.id, '--event', 'task', '--as', 'coord', '--json');
    assert.equal(subscribed.code, 0, subscribed.stderr);
    const inputLog = async () => {
      const log = await readFile(harness === 'claude-code' ? join(home, 'jobs', `${p.harnessId}.log`) : harness === 'codex' ? join(home, 'log', `${p.pid}.inputs.jsonl`) : join(home, 'prompts', `${p.harnessSessionId}.log`), 'utf8').catch(() => '');
      // Codex logs a steer both at RPC admission and when the turn consumes it. Count
      // consumption receipts so a busy turn's diagnostic echo cannot become a third input.
      return harness === 'codex' ? log.split('\n').filter(Boolean).map(line => (JSON.parse(line) as { text: string }).text).join('\n') : log;
    };
    for (const restart of [false, true]) {
      const prefix = restart ? 'durable' : 'initial';
      await sender.call('send', { to: ['coord'], text: `${prefix} progress before`, kind: 'progress' });
      assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: restart ? 'review' : 'planned' })).ok, true);
      const eventText = `event · task · ${item.id} status changed ${restart ? 'planned → review' : 'backlog → planned'}`;
      const recorded = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === eventText);
      await sender.call('send', { to: ['coord'], text: `${prefix} progress after`, kind: 'progress' });
      await sleep(150);
      assert.equal((await inputLog()).includes(eventText), false);
      if (restart) {
        ui.close();
        assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
        ({ discovery } = await startDaemon(t, root, env));
        ui = await connectUi(t, discovery);
        await ui.request({ type: 'subscribe' });
        await sender.waitForPresence(['coord', 'impl']);
        await idle();
        const listing = await clandWithEnv(root, env, 'subscriptions', '--as', 'coord', '--json');
        assert.equal(listing.code, 0, listing.stderr);
        assert.deepEqual(JSON.parse(listing.stdout).subscriptions.filter((s: Subscription) => !s.default), [JSON.parse(subscribed.stdout).subscription]);
        assert.equal((await inputLog()).includes(eventText), false, 'restart role clauses leave events held');
      }
      const report = `${prefix} report releases events`;
      await sender.call('send', { to: ['coord'], text: report });
      const log = await eventually('mixed digest reaches harness', async () => {
        const log = await inputLog();
        return log.includes(report) && log.includes(eventText) ? log : undefined;
      });
      const before = log.indexOf(`${prefix} progress before`), event = log.indexOf(eventText), after = log.indexOf(`${prefix} progress after`), end = log.indexOf(report);
      assert.ok(before < event && event < after && after < end);
      const id = (recorded.message as Message).id;
      await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
      await eventually('every mixed digest member injected', async () => {
        const result = await ui.request({ type: 'topic.history', topic: 'agents' });
        const messages = (result.value as { messages: Array<{ text: string; stage?: string }> }).messages;
        return [`${prefix} progress before`, eventText, `${prefix} progress after`, report].every(text => messages.some(message => message.text === text && message.stage === 'injected')) || undefined;
      });
      await idle();
      assert.equal((await inputLog()).split('Turn digest (3 entries, oldest first):').length - 1, restart ? 2 : 1);
      assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
      const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { event: string; id?: string; text?: string });
      assert.ok(journal.some(entry => entry.event === 'event-delivery' && entry.id === id));
      assert.ok(journal.some(entry => entry.event === 'injected' && entry.id === id));
      assert.ok(journal.filter(entry => entry.event === 'event-delivery').every(entry => entry.text === undefined));
      assert.equal(JSON.stringify(journal).includes(eventText), false, 'event journal records metadata, never the event body');
    }
  });
}

test('fan-out preserves independent recipient digests when one subscriber disconnects', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  let qa = await spawnSpoke({ cwd: root, discover: true, name: 'qa-1', role: 'qa', sessionId: 'qa-id' });
  t.after(async () => { await coord.close(); await rev.close(); await qa.close(); });
  await coord.waitForPresence(['coord', 'rev', 'qa-1']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Fan-out' });
  await rev.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  const { subscription } = await qa.call<{ subscription: Subscription }>('subscribe', { subject: { item: item.id }, events: ['task'] });
  await qa.close();
  await coord.waitForPresence(['coord', 'rev']);
  await coord.call('send', { to: ['rev', 'qa-1'], text: 'before event', kind: 'progress' });
  await coord.call('task.edit', { id: item.id, status: 'planned' });
  assert.equal((await cland(root, 'unsubscribe', subscription.id, '--as', 'qa-1', '--json')).code, 0);
  await coord.call('send', { to: ['rev', 'qa-1'], text: 'after event', kind: 'progress' });
  await coord.call('task.edit', { id: item.id, status: 'review' });
  await coord.call('send', { to: ['rev', 'qa-1'], text: 'shared trigger' });
  const first = await rev.waitForEvent(e => e.params.meta?.from === 'coord' && e.params.content.includes('shared trigger'));
  assert.match(first.params.content, /before event[\s\S]*backlog → planned[\s\S]*after event[\s\S]*planned → review[\s\S]*shared trigger/);
  const queued = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.equal((queued.value as { messages: Array<Message & { stage: string }> }).messages.find(m => m.text === 'shared trigger')?.stage, 'queued');
  qa = await spawnSpoke({ cwd: root, discover: true, name: 'qa-1', role: 'qa', sessionId: 'qa-id' });
  const second = await qa.waitForEvent(e => e.params.meta?.from === 'coord' && e.params.content.includes('shared trigger'));
  assert.match(second.params.content, /before event[\s\S]*backlog → planned[\s\S]*after event[\s\S]*shared trigger/);
  assert.doesNotMatch(second.params.content, /planned → review/);
  await eventually('whole fan-out acknowledged', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Array<Message & { stage: string }> }).messages.find(m => m.text === 'shared trigger')?.stage === 'delivered' || undefined;
  });
  assert.equal(rev.events.filter(e => e.params.meta?.from === 'coord' && e.params.content.includes('shared trigger')).length, 1);
});

test('subscribe and unsubscribe racing an awaited task write take effect before its event is recorded', async t => {
  const root = await tempProject(t);
  const gate = await taskWriteGate(t, root);
  const { discovery } = await projectHub(t, root, gate.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(async () => { await coord.close(); await rev.close(); });
  await coord.waitForPresence(['coord', 'rev']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Racing subscription' });
  for (const subscribing of [true, false]) {
    await gate.arm();
    const editing = ui.request({ type: 'task.edit', item: item.id, status: subscribing ? 'planned' : 'review' });
    await gate.entered();
    if (subscribing) await rev.call('subscribe', { subject: { item: item.id }, events: ['task'] });
    else {
      const { subscriptions } = await rev.call<{ subscriptions: Subscription[] }>('subscriptions');
      assert.equal((await rev.call<{ removed: boolean }>('unsubscribe', { subscription: subscriptions[0]!.id })).removed, true);
    }
    await gate.release();
    assert.equal((await editing).ok, true);
  }
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.to.includes('rev')).map(m => m.text), [`event · task · ${item.id} status changed backlog → planned`]);
});

test('renames preserve subscription ownership and each converging subject id', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(async () => { await coord.close(); await rev.close(); });
  await coord.waitForPresence(['coord', 'rev']);
  const subscriptions = [];
  for (const session of ['coord', 'renamed']) subscriptions.push((await rev.call<{ subscription: Subscription }>('subscribe', { subject: { session }, events: ['session.state'] })).subscription);
  const own = (await coord.call<{ subscription: Subscription }>('subscribe', { subject: { session: 'rev' }, events: ['session.state'] })).subscription;
  assert.equal((await coord.call<{ ok: boolean }>('rename', { name: 'renamed' })).ok, true);
  assert.deepEqual((await rev.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), subscriptions.map(s => ({ ...s, subject: { session: 'renamed' } })));
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [own]);
  for (const { id } of subscriptions) assert.equal((await rev.call<{ removed: boolean }>('unsubscribe', { subscription: id })).removed, true);
});

test('invalid subjects and events are refused at the frame and MCP boundaries; CLI identities stay hub-held', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  for (const [subject, events] of [
    [{ session: 'impl', item: 'T-1' }, ['session.state']], [{ session: 'impl' }, ['task']],
    [{ topic: 'missing' }, ['topic']], [{ item: 'T-999' }, ['task']], [{ session: 'impl' }, []],
    [{ session: 'coordinator' }, ['session.state']], [{ session: 'impl' }, ['usage']],
  ]) {
    assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject, events })).ok, false);
    assert.equal((await ui.request({ type: 'event.subscribe', subject, events, as: { name: 'coord' } })).ok, false);
  }
  assert.equal((await cland(root, 'subscriptions', '--json')).code, 1, 'human must select a known session');
  const impostor = await clandWithEnv(root, { CLAND_SESSION_NAME: 'made-up', CLAND_SESSION_ID: 'not-known', CLAND_ROLE: 'coordinator' }, 'subscribe', 'session', 'impl', '--event', 'session.state', '--as', 'coord', '--json');
  assert.equal(impostor.code, 1);
  assert.match(impostor.stderr, /forbidden/);
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), []);
});

test('a terminal session role update preserves a subscription created for its next launch', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.equal((await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code' })).ok, true);
  await coord.waitForPresence(['coord', 'impl']);
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true);
  const subscribed = await coord.call<{ subscription: Subscription }>('subscribe', { subject: { session: 'impl' }, events: ['session.state'] });
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'qa' })).ok, true);
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [subscribed.subscription], 'a metadata update is not another terminal occurrence');
  assert.equal((await ui.request({ type: 'session.resume', session: 'impl', relaunch: true })).ok, true);
  await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · impl launched');
  // The resumed first turn may already be complete when launch returns. Observe
  // its idle event before checking that no prior terminal fact was replayed.
  await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · impl idle');
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const events = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event');
  assert.deepEqual(events.map(m => m.text), ['event · session.state · impl launched', 'event · session.state · impl idle'], 'the prior terminal fact must not replay into a new subscription');
});
