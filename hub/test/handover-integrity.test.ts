// T3: an actual hub process crash after handover commit and restart finishes claims and notices exactly once.
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
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Held by the Coordinator'));
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
