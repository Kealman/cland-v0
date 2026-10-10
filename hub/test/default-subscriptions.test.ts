import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, spawnSpoke, startDaemon, tempProject, fakeClaude, eventually, killDaemon, cland, sleep } from './harness.ts';
import type { Message, Subscription } from '../src/protocol.ts';

test('default item subscriptions follow claims and explicit subscriptions widen them', async t => {
  const root = await tempProject(t);
  let { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(async () => { await coord.close(); await impl.close(); });
  await coord.waitForPresence(['coord', 'impl']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Default ownership', assignee: 'impl' });
  const subjects = async (session: typeof coord) => (await session.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.map(s => s.subject);
  assert.deepEqual(await subjects(coord), [{ item: item.id }]);
  assert.deepEqual(await subjects(impl), []);
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  assert.deepEqual(await subjects(coord), []);
  assert.deepEqual(await subjects(impl), [{ item: item.id }]);
  const human = await ui.request({ type: 'hub.subscriptions' });
  assert.deepEqual((human.value as { subscriptions: Array<Subscription & { subscriber: string }> }).subscriptions.map(s => [s.subscriber, s.subject]), [['impl', { item: item.id }]]);
  await coord.call('task.edit', { id: item.id, status: 'review' });
  await coord.call('send', { to: ['impl'], text: 'lead next turn' });
  assert.match((await impl.waitForEvent(e => e.params.content.includes('lead next turn'))).params.content, /status changed in progress → review/);
  await impl.call('send', { to: ['coord'], text: 'root next turn' });
  assert.doesNotMatch((await coord.waitForEvent(e => e.params.content.includes('root next turn'))).params.content, /status changed in progress → review/);
  await coord.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  await coord.call('task.edit', { id: item.id, status: 'qa' });
  await impl.call('send', { to: ['coord'], text: 'explicit next turn' });
  assert.match((await coord.waitForEvent(e => e.params.content.includes('explicit next turn'))).params.content, /status changed review → qa/);
  const beforeRestart = (await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions;
  ui.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  ({ discovery } = await startDaemon(t, root));
  ui = await connectUi(t, discovery);
  await coord.waitForPresence(['coord', 'impl']);
  assert.deepEqual((await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions, beforeRestart);
  await impl.call('task.claim', { id: item.id, release: true });
  assert.deepEqual(await subjects(impl), []);
  assert.equal((await subjects(coord)).length, 2);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.text === `event · task · ${item.id} status changed review → qa`).length, 1, 'overlapping defaults and explicit subscriptions share one fan-out');
});

test('an Aide lead owns its subtree defaults without receiving crew broadcasts', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const aide = await spawnSpoke({ cwd: root, discover: true, name: 'aide-1', role: 'aide', sessionId: 'aide-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(async () => { await coord.close(); await aide.close(); await rev.close(); });
  await coord.waitForPresence(['coord', 'aide-1', 'rev']);
  const { item: parent } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Aide subtree', kind: 'epic' });
  await aide.call('task.claim', { id: parent.id });
  const { item: child } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Inherited Aide default', parent: parent.id });
  const listed = await ui.request({ type: 'hub.subscriptions' });
  assert.deepEqual((listed.value as { subscriptions: Array<Subscription & { subscriber: string }> }).subscriptions.map(s => [s.subscriber, s.subject, s.default]), [
    ['aide-1', { item: parent.id }, true], ['aide-1', { item: child.id }, true],
  ]);
  await coord.call('task.edit', { id: child.id, status: 'review' });
  await coord.call('send', { to: ['aide-1'], text: 'Aide default turn' });
  assert.match((await aide.waitForEvent(e => e.params.content.includes('Aide default turn'))).params.content, /status changed backlog → review/);
  await rev.call('task.comment', { id: child.id, verdict: 'review', result: 'not clear', run: 'aide-default' });
  await rev.call('send', { to: [`lead ${parent.id}`], text: 'Aide verdict turn' });
  assert.match((await aide.waitForEvent(e => e.params.content.includes('Aide verdict turn'))).params.content, /verdict posted review not clear · aide-default/);
  await coord.call('send', { to: ['all'], text: 'crew broadcast only' });
  await coord.call('send', { to: ['aide-1'], text: 'Aide direct barrier' });
  const direct = await aide.waitForEvent(e => e.params.content.includes('Aide direct barrier'));
  assert.doesNotMatch(direct.params.content, /crew broadcast only/);
  assert.equal(aide.events.some(e => e.params.content.includes('crew broadcast only')), false);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const events = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event');
  assert.deepEqual(events.filter(m => m.text === `event · task · ${child.id} status changed backlog → review` || m.text === `event · task · ${child.id} verdict posted review not clear · aide-default`).map(m => m.to), [['aide-1'], ['aide-1']]);
});

test('a coalesced explicit event keeps later default lead provenance after an Aide transition', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const lead = await spawnSpoke({ cwd: root, discover: true, name: 'lead-1', role: 'implementer', sessionId: 'lead-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(async () => { await coord.close(); await lead.close(); await rev.close(); });
  await coord.waitForPresence(['coord', 'lead-1', 'rev']);
  const { item: parent } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Future lead', kind: 'epic', assignee: 'lead-1' });
  const { item: child } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Coalesced lead event', parent: parent.id });
  await lead.call('subscribe', { subject: { item: child.id }, events: ['task'] });
  const verdict = { id: child.id, verdict: 'review', result: 'not clear', run: 'coalesced-default' };
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', verdict)).ok, true);
  const text = `event · task · ${child.id} verdict posted review not clear · coalesced-default`;
  const before = await ui.request({ type: 'topic.history', topic: 'agents' });
  const original = (before.value as { messages: Message[] }).messages.find(m => m.text === text);
  assert.ok(original);
  assert.ok(original.to.includes('lead-1'));
  assert.equal((await lead.call<{ ok: boolean }>('task.claim', { id: parent.id })).ok, true);
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', verdict)).ok, true);
  const repeated = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((repeated.value as { messages: Message[] }).messages.filter(m => m.text === text).map(m => m.id), [original.id]);
  assert.equal((await ui.request({ type: 'role.set', session: 'lead-1', role: 'aide' })).ok, true);
  await lead.waitForEvent(e => e.params.meta?.role === 'aide');
  await coord.call('send', { to: ['lead-1'], text: 'coalesced lead turn' });
  const delivered = await lead.waitForEvent(e => e.params.content.includes('coalesced lead turn'));
  assert.ok(delivered.params.content.includes(`${text} (×2)`), delivered.params.content);
});

test('a stopped pooled Reviewer reaches its item lead; a killed lead reaches the Coordinator with watch inbox notifications', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50, pushTrustMs: 120_000 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: '800' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Review lifecycle', assignee: 'impl' });
  const implLaunch = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', item: item.id });
  assert.equal(implLaunch.ok, true, implLaunch.error);
  const implProcess = (implLaunch.value as { process: { pid: number; sessionId: string; harnessId: string } }).process;
  t.after(() => killDaemon(implProcess.pid));
  await coord.waitForPresence(['coord', 'impl']);
  const revLaunch = await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code' });
  assert.equal(revLaunch.ok, true, revLaunch.error);
  await coord.waitForPresence(['coord', 'impl', 'rev']);
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
  const signal = async (session: string, event: string) => {
    const result = await ui.request({ type: 'session.signal', session, event, payload: event === 'permission' ? { tool_name: 'Bash' } : {}, at: Date.now() });
    assert.equal(result.ok, true, result.error);
  };
  await signal('rev', 'turn-start');
  await signal('rev', 'permission');
  const approval = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · rev waiting for approval');
  assert.deepEqual((approval.message as Message).to, ['impl']);
  await signal('rev', 'turn-start');
  await signal('rev', 'turn-end');
  await signal('rev', 'turn-start');
  await sleep(900);
  assert.equal(ui.frames.some(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · rev idle 1 min'), false, 'returning to busy cancels the idle timer');
  await signal('rev', 'turn-end');
  const idle = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · rev idle 1 min');
  assert.deepEqual((idle.message as Message).to, ['impl']);
  assert.equal(ui.frames.some(f => f.type === 'message' && (f.message as Message).kind === 'event' && ['event · session.state · rev idle', 'event · session.state · rev busy', 'event · session.state · rev launched'].includes((f.message as Message).text)), false);
  await signal('impl', 'turn-start');
  await signal('impl', 'turn-end');
  const leadIdle = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · impl idle 1 min');
  assert.deepEqual((leadIdle.message as Message).to, ['coord']);
  assert.equal((await ui.request({ type: 'session.stop', session: 'rev' })).ok, true);
  const stopped = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · rev stopped · ${item.id}`);
  assert.deepEqual((stopped.message as Message).to, ['impl']);
  assert.equal((stopped.message as Message & { stage: string }).stage, 'queued');
  await coord.call('send', { to: ['impl'], text: 'release reviewer event' });
  const log = await eventually('Reviewer stop injected into lead', async () => {
    const text = await fake.log(implProcess.harnessId);
    return text.includes('release reviewer event') ? text : undefined;
  });
  assert.match(log, /rev stopped[\s\S]*release reviewer event/);
  process.kill(implProcess.pid, 'SIGKILL');
  const died = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · impl died · ${item.id}`);
  assert.deepEqual((died.message as Message).to, ['coord']);
  assert.equal((died.message as Message & { stage: string }).stage, 'queued');
  await ui.request({ type: 'topic.send', topic: 'general', text: '@coord release death event' });
  assert.match((await coord.waitForEvent(e => e.params.content.includes('release death event'))).params.content, /impl died/);
  const inbox = await ui.request({ type: 'inbox.list' });
  assert.ok((inbox.value as { notifications: Array<{ kind: string; layer: string }> }).notifications.filter(n => ['death', 'idle', 'verdict'].includes(n.kind)).every(n => n.layer === 'watch'));
  assert.equal((inbox.value as { needsYou: number }).needsYou, 0);
});

test('a claim before hello already belongs to its lead and adopts that lead identity once', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Pending lead', assignee: 'impl' });
  assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
  assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions, []);
  const listing = await ui.request({ type: 'hub.subscriptions' });
  assert.deepEqual((listing.value as { subscriptions: Array<Subscription & { subscriber: string }> }).subscriptions.map(s => [s.subscriber, s.subject]), [['impl', { item: item.id }]]);
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-real' });
  t.after(() => impl.close());
  await impl.waitForPresence(['coord', 'impl']);
  await coord.call('send', { to: ['impl'], text: 'pending lead next turn' });
  const digest = (await impl.waitForEvent(e => e.params.content.includes('pending lead next turn'))).params.content;
  assert.equal(digest.match(/status changed backlog → in progress/g)?.length, 1);
  assert.doesNotMatch(digest, /claimed by impl/);
  await coord.call('task.close', { id: item.id });
  await coord.call('send', { to: ['impl'], text: 'closed lead next turn' });
  assert.match((await impl.waitForEvent(e => e.params.content.includes('closed lead next turn'))).params.content, /T-1 closed/);
  assert.deepEqual((await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions, []);
});

test('a lead death while the hub is down reaches the offline Coordinator once after restart', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50 });
  let { discovery } = await startDaemon(t, root, fake.env);
  let ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Recover default', assignee: 'impl' });
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', item: item.id });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { pid: number } }).process;
  t.after(() => killDaemon(p.pid));
  await coord.waitForPresence(['coord', 'impl']);
  ui.close();
  await coord.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  process.kill(p.pid, 'SIGKILL');
  for (let restart = 0; restart < 2; restart++) {
    ({ discovery } = await startDaemon(t, root, fake.env));
    ui = await connectUi(t, discovery);
    const deaths = await eventually('offline Coordinator death queued', async () => {
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      const events = (history.value as { messages: Array<Message & { stage: string }> }).messages.filter(m => m.text === `event · session.state · impl died · ${item.id}`);
      return events.length ? events : undefined;
    });
    assert.equal(deaths.length, 1);
    assert.deepEqual(deaths[0]?.to, ['coord']);
    assert.equal(deaths[0]?.stage, 'queued');
    ui.close();
    assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  }
});

test('removing a claimed item sends its final default event to the previous lead', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(async () => { await coord.close(); await impl.close(); });
  await coord.waitForPresence(['coord', 'impl']);
  const { item } = await coord.call<{ item: { id: string; path: string } }>('task.create', { title: 'Removed default', assignee: 'impl' });
  await impl.call('task.claim', { id: item.id });
  const { unlink } = await import('node:fs/promises');
  const { join } = await import('node:path');
  await unlink(join(root, item.path)); // real watcher removal, the same filesystem input as a human deleting an item
  await eventually('removed item leaves defaults', async () => (await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.length === 0 || undefined);
  await coord.call('send', { to: ['impl'], text: 'removed default next turn' });
  assert.match((await impl.waitForEvent(e => e.params.content.includes('removed default next turn'))).params.content, /T-1 removed/);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const removed = (history.value as { messages: Message[] }).messages.filter(m => m.text === 'event · task · T-1 removed');
  assert.equal(removed.length, 1);
  assert.deepEqual(removed[0]?.to, ['impl']);
});

for (const pendingReceipt of [false, true]) test(`terminal recovery routes an older pooled Reviewer death past its ${pendingReceipt ? 'verified-stopped lead with pending cleanup' : 'already-dead lead'}`, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50 });
  let { discovery } = await startDaemon(t, root, fake.env);
  let ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const reviewer = await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code' });
  assert.equal(reviewer.ok, true, reviewer.error);
  const r = (reviewer.value as { process: { pid: number } }).process;
  t.after(() => killDaemon(r.pid));
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Terminal lead order', assignee: 'impl' });
  const implementer = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', item: item.id });
  assert.equal(implementer.ok, true, implementer.error);
  const p = (implementer.value as { process: { pid: number } }).process;
  t.after(() => killDaemon(p.pid));
  await coord.waitForPresence(['coord', 'rev', 'impl']);
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
  ui.close();
  await coord.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  process.kill(r.pid, 'SIGKILL');
  process.kill(p.pid, 'SIGKILL');
  // Reuse subscription-hygiene.test.ts's recovery arrangement: durable facts committed before terminal fan-out.
  // Coordinator authorized this fixture arrangement; all assertions use frame history.
  const { DatabaseSync } = await import('node:sqlite');
  const { join } = await import('node:path');
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.prepare("update harness_processes set status = 'exited' where name in ('rev', 'impl')").run();
  db.close();
  if (pendingReceipt) {
    const { ProcessTable } = await import('../src/adapters/processes.ts');
    const table = new ProcessTable(join(root, '.cland', 'hub.db'));
    const process = table.get('impl');
    assert.ok(process);
    table.pendingStop({ process, error: 'crash after verified stop', published: true, stages: { stopped: true, rowRemoved: false, roleRolledBack: false } });
    table.close();
  }
  for (let restart = 0; restart < 2; restart++) {
    ({ discovery } = await startDaemon(t, root, fake.env));
    ui = await connectUi(t, discovery);
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const deaths = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text.includes(' died'));
    assert.deepEqual(deaths.map(m => [m.text, m.to]), [
      [`event · session.state · rev died · ${item.id}`, ['coord']],
      ...(!pendingReceipt ? [[`event · session.state · impl died · ${item.id}`, ['coord']]] : []),
    ]);
    ui.close();
    assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  }
});


test('unclaimed descendants inherit their nearest claimed ancestor lead', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(async () => { await coord.close(); await impl.close(); });
  await coord.waitForPresence(['coord', 'impl']);
  const parent = await ui.request({ type: 'task.create', title: 'Claimed container', kind: 'release', assignee: 'impl' });
  assert.equal(parent.ok, true, parent.error);
  const parentId = (parent.value as { item: { id: string } }).item.id;
  const child = await ui.request({ type: 'task.create', title: 'Unclaimed child', kind: 'epic', parent: parentId });
  assert.equal(child.ok, true, child.error);
  const childId = (child.value as { item: { id: string } }).item.id;
  const grandchild = await ui.request({ type: 'task.create', title: 'Inherited grandchild', parent: childId });
  assert.equal(grandchild.ok, true, grandchild.error);
  const grandchildId = (grandchild.value as { item: { id: string } }).item.id;
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: parentId })).ok, true);
  await coord.call('task.edit', { id: grandchildId, status: 'review' });
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const status = (history.value as { messages: Message[] }).messages.find(m => m.text === `event · task · ${grandchildId} status changed backlog → review`);
  assert.deepEqual(status?.to, ['impl']);
  assert.deepEqual((await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.map(s => s.subject), [{ item: parentId }, { item: childId }, { item: grandchildId }]);
  const launched = await ui.request({ type: 'session.launch', name: 'child-lead', role: 'implementer', harness: 'claude-code', item: childId });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { pid: number } }).process;
  t.after(() => killDaemon(p.pid));
  await coord.waitForPresence(['coord', 'impl', 'child-lead']);
  await coord.call('task.close', { id: grandchildId });
  const inherited = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · task · ${grandchildId} closed`);
  assert.deepEqual((inherited.message as Message).to, ['child-lead']);
  process.kill(p.pid, 'SIGKILL');
  const death = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · child-lead died · ${childId}`);
  assert.deepEqual((death.message as Message).to, ['impl'], 'a gone child lead routes to the nearest ancestor lead');
});

test('anonymous hellos cannot give another name the claimant default identity', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'unknown' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'unknown' });
  t.after(async () => { await coord.close(); await rev.close(); await impl.close(); });
  await coord.waitForPresence(['coord', 'rev', 'impl']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Anonymous claimant', assignee: 'impl' });
  assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
  await coord.call('task.edit', { id: item.id, status: 'review' });
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const status = (history.value as { messages: Message[] }).messages.find(m => m.text === `event · task · ${item.id} status changed in progress → review`);
  assert.deepEqual(status?.to, ['impl']);
  const listing = await ui.request({ type: 'hub.subscriptions' });
  assert.deepEqual((listing.value as { subscriptions: Array<Subscription & { subscriber: string }> }).subscriptions.map(s => [s.id, s.subscriber]), [[`default:name:impl:${item.id}`, 'impl']]);
});


for (const restart of [false, true]) test(`the item lead runs not-clear, re-review and QA; only ready starts the Coordinator (${restart ? 'after restart' : 'connected'})`, async t => {
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  assert.equal((await cland(root, 'init')).code, 0);
  let { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  let coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  const qa = await spawnSpoke({ cwd: root, discover: true, name: 'qa-one', role: 'qa', sessionId: 'qa-id' });
  t.after(async () => { await Promise.all([coord, impl, rev, qa].map(s => s.close())); });
  await coord.waitForPresence(['coord', 'impl', 'rev', 'qa-one']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Own loop', assignee: 'impl', labels: ['qa-required'] });
  const claimed = await impl.call<{ ok: boolean; worktree: { path: string } }>('task.claim', { id: item.id });
  assert.equal(claimed.ok, true);
  const work = claimed.worktree.path;
  await writeFile(join(work, 'feature'), 'first\n');
  git(work, 'add', 'feature');
  git(work, 'commit', '-qm', 'First pass');
  const request = async (who: typeof rev, role: string, text: string) => {
    const sent = await impl.call<{ ok: boolean }>('send', { to: [role], kind: 'report', text });
    assert.equal(sent.ok, true);
    await who.waitForEvent(e => e.params.content.includes(text));
  };
  await impl.call('task.edit', { id: item.id, status: 'review' });
  await request(rev, 'reviewer', `review request ${item.id} first pass`);
  await rev.call('task.hold', { id: item.id });
  await rev.call('task.comment', { id: item.id, verdict: 'review', result: 'not clear', run: 'loop-first' });
  await rev.call('send', { to: [`lead ${item.id}`], kind: 'report', text: `review not clear ${item.id}` });
  const finding = await impl.waitForEvent(e => e.params.content.includes(`review not clear ${item.id}`));
  assert.match(finding.params.content, /verdict posted review not clear/);
  assert.equal(coord.events.some(e => e.params.content.includes(`event · task · ${item.id}`)), false);
  await writeFile(join(work, 'feature'), 'fixed\n');
  git(work, 'add', 'feature');
  git(work, 'commit', '-qm', 'Fix findings');
  await request(rev, 'reviewer', `review request ${item.id} fixed pass`);
  await rev.call('task.hold', { id: item.id });
  await rev.call('task.comment', { id: item.id, verdict: 'review', result: 'clear', run: 'loop-fixed' });
  await rev.call('send', { to: [`lead ${item.id}`], text: `review clear ${item.id}` });
  await impl.waitForEvent(e => e.params.content.includes(`review clear ${item.id}`));
  await request(qa, 'qa', `qa request ${item.id} qa/briefs/${item.id}.md`);
  await qa.call('task.hold', { id: item.id });
  const before = await coord.call<{ item: { status: string } }>('task.view', { id: item.id });
  assert.notEqual(before.item.status, 'ready');
  if (restart) await coord.close();
  await qa.call('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'loop-qa' });
  const readyText = `event · task · ${item.id} status changed qa → ready`;
  const readyHistory = async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.to.includes('coord') && m.text.includes(`task · ${item.id}`));
  };
  await eventually('one ready event recorded for Coordinator', async () => (await readyHistory()).some(m => m.text === readyText) ? true : undefined);
  if (restart) {
    ui.close();
    assert.equal((await cland(root, 'hub', 'stop')).code, 0);
    ({ discovery } = await startDaemon(t, root));
    ui = await connectUi(t, discovery);
    coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  }
  const ready = await coord.waitForEvent(e => e.params.content.includes(readyText));
  assert.equal(ready.params.meta?.kind, 'event', 'ready itself starts a turn without a relay message');
  const deliveries = await readyHistory();
  assert.equal(deliveries.length, 1, JSON.stringify(deliveries));
  assert.equal(deliveries[0]?.detail?.digest, 'now');
  const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.equal(journal.filter(e => e.event === 'event-delivery' && e.subject?.item === item.id && e.to?.includes('coord')).length, 1);
});
