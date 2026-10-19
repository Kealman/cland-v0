// T2: absent-receiver claims and handover chains through in-process hub and MCP seams.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject, type FrameClient, type Session } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

type Result = { ok: boolean; error?: string; code?: string };
type Claim = { session: string; sessionId: string } | null;
const NOTE = { goals_now: 'Ship T-1.', work_in_flight: 'T-1 half done.', open_decisions: 'None.', waiting_on: 'The human on the build.' };
const claimOf = async (ui: FrameClient, id: string): Promise<Claim> => {
  const result = await ui.request({ type: 'task.view', item: id });
  assert.equal(result.ok, true, result.error);
  return (result.value as { item: { claim: Claim } }).item.claim;
};

async function spokes(t: TestContext, root: string) {
  return async (name: string, role?: string): Promise<Session> => {
    const s = await inProcessSpoke(t, { discover: true, cwd: root, name, sessionId: `sess-${name}`, clock: new FakeClock(), ...(role ? { role } : { assignRole: false }) });
    await s.waitForPresence([name]);
    return s;
  };
}

test('a role moved to a name no session holds yet: its claims follow when a session takes that name', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const spoke = await spokes(t, root);
  const a = await spoke('coord', 'coordinator');
  assert.equal((await ui.request({ type: 'task.create', size: 'M', title: 'Held by the Coordinator' })).ok, true);
  assert.equal((await a.call<Result>('task.claim', { id: 'T-1' })).ok, true);
  const moved = await ui.request({ type: 'role.set', session: 'later', role: 'coordinator', move: true });
  assert.equal(moved.ok, true, moved.error);
  // nobody to hold them yet: they stay where they were
  assert.equal((await claimOf(ui, 'T-1'))?.session, 'coord');
  // the receiver connects: the role is its, and so are the claims
  await spoke('later');
  await eventually('the claim moved', async () => ((await claimOf(ui, 'T-1'))?.sessionId === 'sess-later' ? true : undefined));
  assert.equal((await claimOf(ui, 'T-1'))?.session, 'later');
});

test('a role moved on again before its receiver ever connected: the first holder\'s claims still follow it to the end of the chain', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const spoke = await spokes(t, root);
  const a = await spoke('coord', 'coordinator');
  assert.equal((await ui.request({ type: 'task.create', size: 'M', title: 'Held by the Coordinator' })).ok, true);
  assert.equal((await a.call<Result>('task.claim', { id: 'T-1' })).ok, true);
  // coord → later (never connects) → final (connects only afterwards)
  const first = await ui.request({ type: 'role.set', session: 'later', role: 'coordinator', move: true });
  assert.equal(first.ok, true, first.error);
  const second = await ui.request({ type: 'role.set', session: 'final', role: 'coordinator', move: true });
  assert.equal(second.ok, true, second.error);
  assert.equal((await claimOf(ui, 'T-1'))?.session, 'coord');
  await spoke('final');
  await eventually('the claim reached the end of the chain', async () => ((await claimOf(ui, 'T-1'))?.sessionId === 'sess-final' ? true : undefined));
  assert.equal((await claimOf(ui, 'T-1'))?.session, 'final');
});

test('a second handover keeps what waited for the first holder: the role state recognises every holder in the chain', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const spoke = await spokes(t, root);
  const a = await spoke('coord', 'coordinator');
  const b = await spoke('second', 'implementer');
  const c = await spoke('third', 'implementer');
  const ops = ((await ui.request({ type: 'topic.create', title: 'Ops' })).value as { topic: { id: string } }).topic.id;
  assert.equal((await ui.request({ type: 'topic.send', topic: ops, text: '@coord check the build' })).ok, true);
  await a.waitForEvent((e) => e.params.content === '@coord check the build');

  assert.equal((await a.call<Result>('role.handover', { to: 'second', note: NOTE })).ok, true);
  await b.waitForEvent((e) => e.params.meta?.kind === 'role' && e.params.meta?.role === 'coordinator', 15_000);
  assert.equal((await b.call<Result>('role.handover', { to: 'third', note: NOTE })).ok, true);
  await c.waitForEvent((e) => e.params.meta?.kind === 'role' && e.params.meta?.role === 'coordinator', 15_000);
  const state = await c.call<Result & { waiting: Array<{ topic: { id: string }; reason: string }> }>('role.state');
  assert.equal(state.ok, true, state.error);
  assert.ok(state.waiting.some((w) => w.topic.id === ops), JSON.stringify(state.waiting));
});
