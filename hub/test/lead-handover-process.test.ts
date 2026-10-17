// T3: crash after the durable handover commit recovers one node without changing another.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { Message, RoleState } from '../src/protocol.ts';

type Result = { ok: boolean; error?: string; code?: string };
type Claim = { session: string; sessionId: string; claimedAt: string };
const note = (goal: string) => ({ goals_now: goal, work_in_flight: 'Review is in flight.', open_decisions: 'No open decisions.', waiting_on: 'The next verdict.' });

async function setup(t: TestContext) {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const daemon = await startDaemon(t, root, { ...fake.env, CLAND_TEST_CRASH_AT: 'handover-committed' });
  const ui = await connectUi(t, daemon.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'id-coord' });
  t.after(() => coord.close());
  const create = async (title: string, kind = 'task') => (await coord.call<{ item: { id: string } }>('task.create', { ...(kind === 'task' ? { size: 'M' } : {}), title, kind })).item.id;
  const launch = async (name: string, item?: string) => {
    const r = await coord.call<Result & { process: { sessionId: string } }>('session.launch', { name, role: item ? 'lead' : 'implementer', harness: 'claude-code', ...(item ? { item } : {}) });
    assert.equal(r.ok, true, r.error);
    await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === r.process.sessionId);
    const s = await spawnSpoke({ cwd: root, discover: true, name, assignRole: false, sessionId: r.process.sessionId });
    t.after(() => s.close());
    return { s, ...r.process };
  };
  return { root, fake, daemon, create, launch };
}

test('a committed Lead handover recovers its node claim after a crash without touching another Lead', async t => {
  const { root, fake, daemon, create, launch } = await setup(t);
  const epic = await create('Crash epic', 'epic');
  const second = await create('Untouched epic', 'epic');
  const a = await launch('lead-1', epic);
  const b = await launch('lead-2');
  const other = await launch('other', second);
  await a.s.call<Result>('role.handover', { to: 'lead-2', note: note('Recovered node') }).catch(() => undefined);
  await eventually('the hub crashed', () => { try { process.kill(daemon.discovery.pid, 0); return undefined; } catch { return true; } });
  const restarted = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, restarted.discovery);
  const view = async (id: string) => ((await ui.request({ type: 'task.view', item: id })).value as { item: { claim: Claim } }).item.claim;
  const recovered = await view(epic);
  assert.deepEqual([recovered.session, recovered.sessionId], ['lead-2', b.sessionId]);
  assert.equal((await view(second)).sessionId, other.sessionId);
  const state = await ui.request({ type: 'role.state', role: 'lead', session: 'lead-2' });
  assert.equal((state.value as RoleState).note?.sections.goals_now, 'Recovered node');
  const history = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'handover').length, 1);
});
