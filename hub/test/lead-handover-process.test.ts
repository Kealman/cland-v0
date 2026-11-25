// T3: crash after the durable handover commit recovers one node without changing another.
import { claudeLaunchIdentity } from './claude-launch-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, fakeClaude, killDaemon, spawnSpoke, startDaemon } from './harness.ts';
import type { Message, RoleState } from '../src/protocol.ts';
import { waitForCrash } from './crash-wait.ts';
import { crashProcess } from './crash-wait-native.ts';
import { handoverCase, type HandoverStep } from './handover-case.ts';

type Result = { ok: boolean; error?: string; code?: string };
type Claim = { session: string; sessionId: string; claimedAt: string };
const note = (goal: string) => ({ goals_now: goal, work_in_flight: 'Review is in flight.', open_decisions: 'No open decisions.', waiting_on: 'The next verdict.' });

async function setup(owner: ReturnType<typeof handoverCase>, step: HandoverStep) {
  const root = await step('project setup', () => owner.root());
  const fake = await step('fake harness setup', () => fakeClaude(owner.fixtures, { lifecycle: {
    requireClose: owner.requireClose, adoptRoot: root => owner.adoptRoot(root),
  } }));
  const daemon = await step('crashing hub setup', () => owner.acquire('hub launch',
    () => startDaemon(owner.resources, root, { ...fake.env, CLAND_TEST_CRASH_AT: 'handover-committed' }),
    hub => killDaemon(hub.discovery.pid)));
  const ui = await step('UI setup', () => connectUi(owner.resources, daemon.discovery));
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await step('Coordinator setup', () => owner.acquire('Coordinator spoke',
    () => spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'id-coord' }), s => s.close()));
  const create = async (title: string, kind = 'task') => (await coord.call<{ item: { id: string } }>('task.create', { ...(kind === 'task' ? { size: 'M' } : {}), title, kind })).item.id;
  const launch = async (name: string, item?: string) => {
    const r = await coord.call<Result & { process: { sessionId: string } }>('session.launch', { name, role: item ? 'lead' : 'implementer', harness: 'claude-code', ...(item ? { item } : {}) });
    assert.equal(r.ok, true, r.error);
    await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === r.process.sessionId);
    const s = await owner.acquire(`${name} spoke`, async () => spawnSpoke({ cwd: root, discover: true, name, ...(await claudeLaunchIdentity(fake, name)), assignRole: false, sessionId: r.process.sessionId }), s => s.close());
    return { s, ...r.process };
  };
  return { root, fake, daemon, create, launch };
}

test('a committed Lead handover recovers its node claim after a crash without touching another Lead', async t => {
  const owner = handoverCase(t);
  await owner.run(async step => {
  const { root, fake, daemon, create, launch } = await setup(owner, step);
  const epic = await step('first node setup', () => create('Crash epic', 'epic'));
  const second = await step('other node setup', () => create('Untouched epic', 'epic'));
  const a = await step('first Lead setup', () => launch('lead-1', epic));
  const b = await step('receiver setup', () => launch('lead-2'));
  const other = await step('other Lead setup', () => launch('other', second));
  let crashed: ReturnType<typeof waitForCrash> | undefined;
  owner.requireClose(async () => { await crashed?.catch(() => {}); });
  crashed = waitForCrash(crashProcess(daemon.discovery.pid), { signal: owner.signal });
  void crashed.catch(() => {});
  await step('handover request', () => a.s.call<Result>('role.handover', { to: 'lead-2', note: note('Recovered node') }).catch(() => undefined));
  assert.ok(['absent', 'exited'].includes(await step('native crash receipt', () => crashed!)));
  if (process.env.CLAND_TEST_HANDOVER_FAILURE === 'after-crash') assert.fail('controlled handover assertion failure');
  const restarted = await step('recovery hub setup', () => owner.acquire('hub restart',
    () => startDaemon(owner.resources, root, fake.env), hub => killDaemon(hub.discovery.pid)));
  const ui = await step('recovery UI setup', () => connectUi(owner.resources, restarted.discovery));
  const view = async (id: string) => ((await ui.request({ type: 'task.view', item: id })).value as { item: { claim: Claim } }).item.claim;
  const recovered = await view(epic);
  assert.deepEqual([recovered.session, recovered.sessionId], ['lead-2', b.sessionId]);
  assert.equal((await view(second)).sessionId, other.sessionId);
  const state = await ui.request({ type: 'role.state', role: 'lead', session: 'lead-2' });
  assert.equal((state.value as RoleState).note?.sections.goals_now, 'Recovered node');
  const history = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'handover').length, 1);
  });
});
