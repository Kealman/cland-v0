import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject, type Session } from './harness.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import type { Message, RoleState, Subscription } from '../src/protocol.ts';

type Result = { ok: boolean; error?: string; code?: string };
type Claim = { session: string; sessionId: string; claimedAt: string };
const note = (goal: string) => ({ goals_now: goal, work_in_flight: 'Review is in flight.', open_decisions: 'No open decisions.', waiting_on: 'The next verdict.' });

async function setup(t: TestContext, crash = false, direct = false) {
  const root = await tempProject(t);
  if (direct) {
    const path = join(root, '.cland', 'roles.toml');
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(path, DEFAULT_ROLES_TOML.replace('[lead.permissions]\ntools = [', '[lead.permissions]\ntools = ["task.claim", '));
  }
  const fake = await fakeClaude(t);
  const daemon = await startDaemon(t, root, { ...fake.env, ...(crash ? { CLAND_TEST_CRASH_AT: 'handover-committed' } : {}) });
  const ui = await connectUi(t, daemon.discovery);
  const spoke = async (name: string, role?: string, sessionId = `id-${name}`): Promise<Session> => {
    const s = await spawnSpoke({ cwd: root, discover: true, name, sessionId, ...(role ? { role } : { assignRole: false }) });
    t.after(() => s.close());
    if (role) await s.waitForEvent(e => e.params.meta?.kind === 'role');
    return s;
  };
  const coord = await spoke('coord', 'coordinator');
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { title, kind, ...(parent ? { parent } : {}) })).item.id;
  const launch = async (name: string, item?: string) => {
    if (direct) {
      const s = await spoke(name, item ? 'lead' : 'implementer');
      if (item) {
        const claimed = await s.call<Result>('task.claim', { id: item });
        assert.equal(claimed.ok, true, claimed.error);
      }
      return { s, sessionId: `id-${name}`, harnessId: '' };
    }
    const r = await coord.call<Result & { process: { sessionId: string; harnessId: string } }>('session.launch', { name, role: item ? 'lead' : 'implementer', harness: 'claude-code', ...(item ? { item } : {}) });
    assert.equal(r.ok, true, r.error);
    const s = await spoke(name, undefined, r.process.sessionId);
    return { s, ...r.process };
  };
  const claim = async (id: string) => (await coord.call<{ item: { claim: Claim } }>('task.view', { id })).item.claim;
  const subjects = async (s: Session) => (await s.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter(x => x.default).map(x => x.subject);
  return { root, fake, daemon, ui, spoke, coord, create, launch, claim, subjects };
}

test('lead-1 hands its node and question to lead-2; the next verdict reaches the new Lead through the fake harness', async t => {
  const { fake, ui, coord, create, launch, claim, subjects, spoke } = await setup(t);
  const epic = await create('Mid-flight epic', 'epic');
  const task = await create('Unclaimed work under review', 'task', epic);
  const otherEpic = await create('Other epic', 'epic');
  const otherTask = await create('Other work', 'task', otherEpic);
  const a = await launch('lead-1', epic);
  const b = await launch('lead-2');
  const other = await launch('other', otherEpic);
  const rev = await spoke('rev', 'reviewer');
  const impl = await spoke('impl', 'implementer');
  const heldTask = await create('Claimed item', 'task', epic);
  await coord.call('task.edit', { id: heldTask, assignee: 'impl' });
  const claimed = await impl.call<Result>('task.claim', { id: heldTask });
  assert.equal(claimed.ok, true, claimed.error);
  const before = await claim(epic);
  assert.equal((await ui.request({ type: 'role.set', session: 'lead-2', role: 'coordinator', item: epic, move: true })).ok, false);
  assert.equal((await ui.request({ type: 'role.set', session: 'lead-2', role: 'lead', item: epic })).ok, false);
  const own = await b.s.call<Result & RoleState>('role.state');
  assert.equal(own.role, 'implementer');
  const oldState = await a.s.call<Result & RoleState>('role.state');
  assert.deepEqual([oldState.item, oldState.holders.map(h => h.name), oldState.claims.map(c => c.item)], [epic, ['lead-1'], [epic]]);
  assert.deepEqual((await other.s.call<Result & RoleState>('role.state')).claims.map(c => c.item), [otherEpic]);
  for (const to of ['other', 'impl', 'coord']) {
    const refused = await a.s.call<Result>('role.handover', { to, note: note(epic) });
    assert.equal(refused.ok, false, to);
    assert.match(refused.error ?? '', /already claims|root Coordinator/);
  }
  assert.equal((await a.s.call<Result>('role.handover', { to: 'lead-2', note: { goals_now: 'Incomplete' } })).code, 'note-incomplete');
  assert.equal((await claim(epic)).session, 'lead-1');
  const topic = (await coord.call<{ topic: { id: string } }>('topic.create', { title: 'Pending decision', item: heldTask })).topic.id;
  const asked = await impl.call<Result>('send', { to: [`lead ${heldTask}`], topic, kind: 'question', text: 'Which implementation?' });
  assert.equal(asked.ok, true, asked.error);
  const questionHistory = await ui.request({ type: 'topic.history', topic });
  const askId = (questionHistory.value as { messages: Message[] }).messages.find(m => m.text === 'Which implementation?')!.id;
  const moved = await a.s.call<Result>('role.handover', { to: 'lead-2', note: note(epic) });
  assert.equal(moved.ok, true, moved.error);
  const clause = await b.s.waitForEvent(e => e.params.meta?.role === 'lead');
  assert.match(clause.params.content, /Handover note from lead-1:/);
  assert.ok(clause.params.content.includes(epic));
  await a.s.waitForEvent(e => e.params.meta?.reason === 'handover' && e.params.meta?.role === '');
  assert.deepEqual(await claim(epic), { ...before, session: 'lead-2', sessionId: b.sessionId });
  assert.equal((await claim(otherEpic)).session, 'other');
  assert.equal((await b.s.call<Result>('ask.answer', { ask: askId, text: 'Use the established seam.' })).ok, true);
  await impl.waitForEvent(e => e.params.meta?.answer_to === askId);
  const state = await b.s.call<Result & RoleState>('role.state');
  assert.deepEqual([state.item, state.holders.map(h => h.name), state.claims.map(c => c.item), state.note?.sections.goals_now], [epic, ['lead-2'], [epic], epic]);
  assert.equal((await a.s.call<Result>('role.state')).code, 'forbidden');
  assert.deepEqual(await subjects(b.s), [{ item: epic }, { item: task }]);
  assert.deepEqual(await subjects(other.s), [{ item: otherEpic }, { item: otherTask }]);
  assert.deepEqual(await subjects(coord), []);
  const uiState = await ui.request({ type: 'role.state', role: 'lead', session: 'lead-2' });
  assert.deepEqual((uiState.value as RoleState).claims, state.claims);
  assert.equal((await ui.request({ type: 'role.state', role: 'lead' })).ok, false);
  assert.equal((await rev.call<Result>('task.comment', { id: task, verdict: 'review', result: 'not clear', run: 'after-handover' })).ok, true);
  // Progress events fold into the successor's next turn, which this ordinary report starts.
  await rev.call('send', { to: [`lead ${task}`], text: 'Inspect the next verdict.' });
  await eventually('the next verdict reaches lead-2 harness', async () => (await fake.log(b.harnessId)).includes(`${task} verdict posted review not clear`) || undefined);
  const history = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  const events = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text.includes(`${task} verdict posted`));
  assert.deepEqual(events.map(m => m.to), [['lead-2']]);
  assert.equal((await other.s.call<Result & RoleState>('role.state')).note, null);
});

test('independent node notes survive a rename, a second handover and a hub restart', async t => {
  const { root, fake, ui, coord, create, launch, claim } = await setup(t, false, true);
  const epic = await create('First epic', 'epic');
  const second = await create('Second epic', 'epic');
  const a = await launch('lead-1', epic);
  const b = await launch('lead-2');
  const c = await launch('lead-3');
  const x = await launch('other-1', second);
  const y = await launch('other-2');
  assert.equal((await a.s.call<Result>('role.handover', { to: 'lead-2', note: note('First node') })).ok, true);
  assert.equal((await x.s.call<Result>('role.handover', { to: 'other-2', note: note('Second node') })).ok, true);
  // The human temporarily gives this session the Coordinator role, the only role allowed to rename itself.
  assert.equal((await ui.request({ type: 'role.set', session: 'lead-2', role: 'coordinator', move: true })).ok, true);
  assert.equal((await b.s.call<Result>('rename', { name: 'renamed' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'renamed', role: 'lead' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  assert.deepEqual([(await b.s.call<Result & RoleState>('role.state')).note?.sections.goals_now, (await y.s.call<Result & RoleState>('role.state')).note?.sections.goals_now], ['First node', 'Second node']);
  assert.equal((await b.s.call<Result>('role.handover', { to: 'lead-3', note: note('First node continued'), then: 'implementer' })).ok, true);
  await b.s.waitForEvent(e => e.params.meta?.role === 'implementer' && e.params.meta?.reason === 'handover');
  assert.equal((await claim(epic)).session, 'lead-3');
  assert.equal((await claim(second)).session, 'other-2');
  const cBefore = c.s.events.length;
  const yBefore = y.s.events.length;
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root, fake.env);
  await eventually('first Lead reconnects with its own note', () => c.s.events.slice(cBefore).find(e => e.params.meta?.role === 'lead' && e.params.content.includes('First node continued')), 30_000);
  await eventually('second Lead reconnects with its own note', () => y.s.events.slice(yBefore).find(e => e.params.meta?.role === 'lead' && e.params.content.includes('Second node')), 30_000);
  const firstState = await c.s.call<Result & RoleState>('role.state');
  const secondState = await y.s.call<Result & RoleState>('role.state');
  assert.equal(firstState.ok, true, JSON.stringify(firstState));
  assert.equal(secondState.ok, true, JSON.stringify(secondState));
  assert.equal(firstState.note?.sections.goals_now, 'First node continued', JSON.stringify(firstState));
  assert.equal(secondState.note?.sections.goals_now, 'Second node', JSON.stringify(secondState));
});

test('a committed Lead handover recovers its node claim after a crash without touching another Lead', async t => {
  const { root, fake, daemon, create, launch } = await setup(t, true);
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

test('the human hands a node to an offline successor, then launches it and the next verdict reaches it', async t => {
  const { root, fake, coord, create, launch, claim, spoke, subjects } = await setup(t);
  const epic = await create('Human move', 'epic');
  const task = await create('Work awaiting review', 'task', epic);
  await launch('lead-1', epic);
  const before = await claim(epic);
  const file = join(root, 'handover.md');
  await writeFile(file, '## Goals now\nHuman move\n## Work in flight\nReview\n## Open decisions\nNone\n## Waiting on\nVerdict\n');
  const moved = await cland(root, 'role', 'set', 'later', 'lead', '--item', epic, '--note-file', file, '--json');
  assert.equal(moved.code, 0, moved.stderr);
  assert.deepEqual(await claim(epic), { ...before, session: 'later', sessionId: 'name:later' });
  const refused = await coord.call<Result>('session.launch', { name: 'different', role: 'lead', harness: 'claude-code', item: epic });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /claimed by later/);
  const wrongRole = await coord.call<Result>('session.launch', { name: 'later', role: 'implementer', harness: 'claude-code', item: epic });
  assert.equal(wrongRole.ok, false);
  assert.match(wrongRole.error ?? '', /claimed by later/);
  const later = await launch('later', epic);
  assert.deepEqual(await claim(epic), { ...before, session: 'later', sessionId: later.sessionId });
  const live = await coord.call<Result>('session.launch', { name: 'later', role: 'lead', harness: 'claude-code', item: epic });
  assert.equal(live.ok, false);
  assert.match(live.error ?? '', /already running|live session/);
  assert.deepEqual(await claim(epic), { ...before, session: 'later', sessionId: later.sessionId });
  assert.deepEqual(await subjects(later.s), [{ item: epic }, { item: task }]);
  const state = await later.s.call<Result & RoleState>('role.state');
  assert.equal(state.note?.sections.goals_now, 'Human move');
  const rev = await spoke('rev', 'reviewer');
  assert.equal((await rev.call<Result>('task.comment', { id: task, verdict: 'review', result: 'not clear', run: 'after-offline-handover' })).ok, true);
  await rev.call('send', { to: [`lead ${task}`], text: 'Inspect the successor verdict.' });
  await eventually('the next verdict reaches the launched successor', async () => (await fake.log(later.harnessId)).includes(`${task} verdict posted review not clear`) || undefined);
});
