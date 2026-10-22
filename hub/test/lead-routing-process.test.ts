// T3: SIGKILL of a real harness PID proves death notification and inherited routing.
import test from 'node:test';
import { FakeClock } from './fake-clock.ts';
import assert from 'node:assert/strict';
import { withDiscoveredPid, connectUi, killDaemon, spawnSpoke, nativeProjectHub as projectHub, tempProject, fakeClaude } from './harness.ts';
import type { Message, Subscription } from '../src/protocol.ts';

test('long idle and death climb from item to epic to release; stopped Leads leave inherited routing', async t => {
  const root = await tempProject(t);
  // Keep pushed idle and death states authoritative while testing inherited routing.
  const pollMs = 50;
  const fake = await fakeClaude(t, { pollMs, reexecGraceMs: 100, pushTrustMs: 120_000 });
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, { ...fake.env, CLAND_IDLE_NOTIFY_MS: '800' }, { clock });
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
    for (const event of ['turn-start', 'turn-end']) assert.equal((await ui.request({ type: 'session.signal', session, event, payload: {}, at: clock.now().getTime() })).ok, true);
    await clock.advance(800);
    const idle = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · ${session} idle 1 min`);
    assert.deepEqual((idle.message as Message).to, [owner]);
  }
  const processes = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ name: string; sessionId: string; pid: number | null }> };
  const impl = await withDiscoveredPid(ui, processes.processes.find(p => p.name === 'impl')!);
  const published = ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `event · session.state · impl died · ${item.id}`);
  process.kill(impl.pid, 'SIGKILL');
  await killDaemon(impl.pid);
  await clock.advance(pollMs + 100);
  const death = await published;
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
