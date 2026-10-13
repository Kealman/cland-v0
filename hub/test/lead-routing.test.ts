import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, spawnSpoke, startDaemon, tempProject, fakeClaude, eventually } from './harness.ts';
import type { Message, Subscription } from '../src/protocol.ts';

test('an Implementer reports blocked up its item chain; unclaimed descendants use the nearest Lead', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(() => impl.close());
  await coord.waitForPresence(['coord', 'impl']);
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Lead epic', kind: 'epic' });
  const launched = await coord.call<{ ok: boolean; process: { sessionId: string; harnessId: string } }>('session.launch', { name: 'lead-1', role: 'lead', item: epic.id, harness: 'claude-code' });
  assert.equal(launched.ok, true);
  const lead = await spawnSpoke({ cwd: root, discover: true, name: 'lead-1', assignRole: false, sessionId: launched.process.sessionId });
  t.after(() => lead.close());
  await coord.waitForPresence(['coord', 'lead-1', 'impl']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Blocked work', parent: epic.id, assignee: 'impl' });
  const { item: sibling } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Unclaimed work', parent: epic.id });
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  const { topic } = await impl.call<{ topic: { id: string } }>('topic.create', { title: 'Blocked work', item: item.id });
  const blocked = await impl.call<{ ok: boolean }>('send', { to: [`lead ${item.id}`], topic: topic.id, kind: 'report', text: 'blocked: need a decision' });
  assert.equal(blocked.ok, true);
  const blockedHistory = await ui.request({ type: 'topic.history', topic: topic.id });
  assert.deepEqual((blockedHistory.value as { messages: Message[] }).messages.find(m => m.text === 'blocked: need a decision')?.to, ['lead-1']);
  await eventually('blocked report reaches the Lead harness', async () => (await fake.log(launched.process.harnessId)).includes('blocked: need a decision') || undefined);
  const addressed = await ui.request({ type: 'topic.send', topic: 'general', to: [`lead ${sibling.id}`], text: 'plan the unclaimed work' });
  assert.deepEqual((addressed.value as { message: Message }).message.to, ['lead-1']);
  const history = await ui.request({ type: 'topic.history', topic: topic.id });
  assert.deepEqual((history.value as { messages: Message[] }).messages.find(m => m.text === 'blocked: need a decision')?.to, ['lead-1']);
  assert.equal(coord.events.some(e => e.params.content.includes('blocked: need a decision')), false);
  const subjects = async (session: typeof coord) => (await session.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.map(s => s.subject);
  assert.deepEqual(await subjects(coord), []);
  assert.deepEqual(await subjects(lead), [{ item: epic.id }, { item: sibling.id }]);
  assert.deepEqual(await subjects(impl), [{ item: item.id }]);
  await lead.call('send', { to: [`lead ${epic.id}`], text: 'epic report to root' });
  await coord.waitForEvent(e => e.params.content.includes('epic report to root'));
  await impl.call('task.claim', { id: item.id, release: true });
  await coord.call('send', { to: [`lead ${item.id}`], text: 'after claim release' });
  await eventually('unclaimed report reaches the Lead harness', async () => (await fake.log(launched.process.harnessId)).includes('after claim release') || undefined);
});

test('ready starts the nearest supervising Lead once, while intermediate events stay with the item lead', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(() => impl.close());
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  t.after(() => rev.close());
  await coord.waitForPresence(['coord', 'impl', 'rev']);
  const { item: release } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Lead release', kind: 'release' });
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Lead epic', kind: 'epic', parent: release.id });
  for (const [name, item] of [['release-lead', release.id], ['lead-1', epic.id]]) {
    assert.equal((await coord.call<{ ok: boolean }>('session.launch', { name, role: 'lead', item, harness: 'claude-code' })).ok, true);
  }
  await coord.waitForPresence(['coord', 'impl', 'rev', 'release-lead', 'lead-1']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Ready work', parent: epic.id, assignee: 'impl' });
  await impl.call('task.claim', { id: item.id });
  await impl.call('task.edit', { id: item.id, status: 'review' });
  await rev.call('task.comment', { id: item.id, verdict: 'review', result: 'not clear', run: 'nested-finding' });
  await rev.call('send', { to: [`lead ${item.id}`], text: 'finding for the Implementer' });
  assert.match((await impl.waitForEvent(e => e.params.content.includes('finding for the Implementer'))).params.content, /verdict posted review not clear/);
  await coord.call('task.edit', { id: item.id, status: 'ready' });
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const events = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text.includes(`task · ${item.id}`));
  const ready = events.filter(m => m.text.endsWith('→ ready') && m.detail?.digest === 'now');
  assert.deepEqual(ready.map(m => m.to), [['lead-1']]);
  assert.equal(events.some(m => m.to.includes('coord') || m.to.includes('release-lead')), false);
  const processes = await fake.sessions();
  const leadProcess = processes.find(p => p.name === 'lead-1')!;
  await eventually('ready itself starts the Lead harness', async () => (await fake.log(leadProcess.id)).includes('→ ready') || undefined);
  const { item: unclaimed } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Unclaimed ready', parent: epic.id });
  await coord.call('task.edit', { id: unclaimed.id, status: 'ready' });
  const later = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((later.value as { messages: Message[] }).messages.filter(m => m.text.includes(`task · ${unclaimed.id}`) && m.text.endsWith('→ ready')).map(m => [m.to, m.detail?.digest]), [[['lead-1'], 'now']]);
});

test('long idle and death climb from item to epic to release; stopped Leads leave inherited routing', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 50, pushTrustMs: 120_000 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: '800' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const { item: release } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Lifecycle release', kind: 'release' });
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Lifecycle epic', kind: 'epic', parent: release.id });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Lifecycle work', parent: epic.id, assignee: 'impl' });
  for (const [name, role, node] of [['release-lead', 'lead', release.id], ['lead-1', 'lead', epic.id], ['impl', 'implementer', item.id]]) {
    const launched = await coord.call<{ ok: boolean; error?: string }>('session.launch', { name, role, item: node, harness: 'claude-code' });
    assert.equal(launched.ok, true, launched.error);
  }
  await coord.waitForPresence(['coord', 'release-lead', 'lead-1', 'impl']);
  for (const [session, owner] of [['impl', 'lead-1'], ['lead-1', 'release-lead'], ['release-lead', 'coord']]) {
    for (const event of ['turn-start', 'turn-end']) assert.equal((await ui.request({ type: 'session.signal', session, event, payload: {}, at: Date.now() })).ok, true);
    const idle = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · ${session} idle 1 min`);
    assert.deepEqual((idle.message as Message).to, [owner]);
  }
  const processes = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ name: string; pid: number }> };
  const impl = processes.processes.find(p => p.name === 'impl')!;
  process.kill(impl.pid, 'SIGKILL');
  const death = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · impl died · ${item.id}`);
  assert.deepEqual((death.message as Message).to, ['lead-1']);
  assert.equal((await ui.request({ type: 'session.stop', session: 'lead-1' })).ok, true);
  const stopped = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · lead-1 stopped · ${epic.id}`);
  assert.deepEqual((stopped.message as Message).to, ['release-lead']);
  const inherited = await ui.request({ type: 'topic.send', topic: 'general', to: [`lead ${item.id}`], text: 'release takes over' });
  assert.deepEqual((inherited.value as { message: Message }).message.to, ['release-lead']);
  assert.equal((await ui.request({ type: 'session.stop', session: 'release-lead' })).ok, true);
  const flat = await ui.request({ type: 'topic.send', topic: 'general', to: [`lead ${item.id}`], text: 'root takes over' });
  assert.deepEqual((flat.value as { message: Message }).message.to, ['coord']);
  assert.match((await coord.waitForEvent(e => e.params.content.includes('root takes over'))).params.content, /release-lead stopped/);
});
