// A role's handover that survives a crash, a receiver not known yet, and a chain of moves (Codex review of #31):
// the move, its record (with the claims it takes along) and its Agents notices are one store transaction; the
// claims follow from that record, at once, at the next start, or at the receiver's first hello; the role's state
// remembers every holder it passed through. Against a real daemon in a temporary project: spokes over MCP, the UI
// on the Unix socket, the CLI as its own process.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { cland, connectUi, eventually, spawnSpoke, startDaemon, tempProject, type Discovery, type Session } from './harness.ts';

type Result = { ok: boolean; error?: string; code?: string };
type Claim = { session: string; sessionId: string } | null;
const NOTE = { goals_now: 'Ship T-1.', work_in_flight: 'T-1 half done.', open_decisions: 'None.', waiting_on: 'The human on the build.' };

const ok = (r: { code: number | null; stdout: string; stderr: string }) => {
  assert.equal(r.code, 0, `exit ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};
const claimOf = async (root: string, id: string): Promise<Claim> => (JSON.parse(ok(await cland(root, 'task', 'view', id, '--json')).stdout) as { item: { claim: Claim } }).item.claim;

async function spokes(t: TestContext, root: string) {
  return async (name: string, role?: string): Promise<Session> => {
    const s = await spawnSpoke({ discover: true, cwd: root, name, sessionId: `sess-${name}`, ...(role ? { role } : { assignRole: false }) });
    t.after(() => s.close());
    await s.waitForPresence([name]);
    return s;
  };
}

test('a hub that dies between a handover\'s commit and its claims finishes the move at its next start: the role, the notices and the claims, once', async (t) => {
  const root = await tempProject(t);
  const first = await startDaemon(t, root, { CLAND_TEST_CRASH_AT: 'handover-committed' });
  const spoke = await spokes(t, root);
  const a = await spoke('coord', 'coordinator');
  await spoke('next', 'implementer');
  ok(await cland(root, 'task', 'create', 'Held by the Coordinator'));
  assert.equal((await a.call<Result>('task.claim', { id: 'T-1' })).ok, true);

  // the hub is killed right after the move's transaction committed
  await a.call<Result>('role.handover', { to: 'next', note: NOTE }).catch(() => undefined);
  await eventually('the hub is gone', () => {
    try {
      process.kill(first.discovery.pid, 0);
      return undefined;
    } catch {
      return true;
    }
  });
  const second = await startDaemon(t, root);
  const ui = await connectUi(t, second.discovery as Discovery);
  assert.deepEqual(await claimOf(root, 'T-1').then((c) => [c?.session, c?.sessionId]), ['next', 'sess-next']);
  const list = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; holders: Array<{ name: string }> }> };
  assert.deepEqual(list.roles.find((r) => r.role === 'coordinator')?.holders.map((h) => h.name), ['next']);
  const agents = (await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 })).value as { messages: Array<{ kind?: string; text: string }> };
  assert.equal(agents.messages.filter((m) => m.kind === 'handover').length, 1, JSON.stringify(agents.messages));
  assert.equal(agents.messages.filter((m) => m.kind === 'role-assign' && /took over the Coordinator role from coord/.test(m.text)).length, 1);
});

test('a role moved to a name no session holds yet: its claims follow when a session takes that name', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const spoke = await spokes(t, root);
  const a = await spoke('coord', 'coordinator');
  ok(await cland(root, 'task', 'create', 'Held by the Coordinator'));
  assert.equal((await a.call<Result>('task.claim', { id: 'T-1' })).ok, true);
  const moved = await ui.request({ type: 'role.set', session: 'later', role: 'coordinator', move: true });
  assert.equal(moved.ok, true, moved.error);
  // nobody to hold them yet: they stay where they were
  assert.equal((await claimOf(root, 'T-1'))?.session, 'coord');
  // the receiver connects: the role is its, and so are the claims
  await spoke('later');
  await eventually('the claim moved', async () => ((await claimOf(root, 'T-1'))?.sessionId === 'sess-later' ? true : undefined));
  assert.equal((await claimOf(root, 'T-1'))?.session, 'later');
});

test('a role moved on again before its receiver ever connected: the first holder\'s claims still follow it to the end of the chain', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const spoke = await spokes(t, root);
  const a = await spoke('coord', 'coordinator');
  ok(await cland(root, 'task', 'create', 'Held by the Coordinator'));
  assert.equal((await a.call<Result>('task.claim', { id: 'T-1' })).ok, true);
  // coord → later (never connects) → final (connects only afterwards)
  const first = await ui.request({ type: 'role.set', session: 'later', role: 'coordinator', move: true });
  assert.equal(first.ok, true, first.error);
  const second = await ui.request({ type: 'role.set', session: 'final', role: 'coordinator', move: true });
  assert.equal(second.ok, true, second.error);
  assert.equal((await claimOf(root, 'T-1'))?.session, 'coord');
  await spoke('final');
  await eventually('the claim reached the end of the chain', async () => ((await claimOf(root, 'T-1'))?.sessionId === 'sess-final' ? true : undefined));
  assert.equal((await claimOf(root, 'T-1'))?.session, 'final');
});

test('a second handover keeps what waited for the first holder: the role state recognises every holder in the chain', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
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
