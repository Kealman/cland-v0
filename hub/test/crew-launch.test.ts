// T2: pool admission, retention policy and live crew clauses over in-process adapters.
// Native cwd/thread/history and merge process stops: session-native-lifecycle.test.ts pending T-708.
import { sessionUi as connectUi } from './session-credential-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eventually, inProcessSpoke, tempProject } from './harness.ts';
import { ruleHub } from './rule-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { FAKE_FLAVOURS } from './fakes/harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
test('Reviewer pool handoffs enforce admission and retention policy across flavours', async t => {
  const root = await tempProject(t);
  // Keep reviewers busy while the next pool admission tests the busy cap.
  const clock = new FakeClock();
  const { discovery, fakes } = await ruleHub(t, root, clock);
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  for (const harness of FAKE_FLAVOURS) {
    const fake = fakes[harness]!;
    assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.keep_context', value: true })).ok, true);
    assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
    const create = async () => (await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Review build' })).item.id;
    const firstItem = await create();
    const secondItem = await create();
    const launch = (name: string, item?: string, brief?: string) => coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', { name, role: 'reviewer', harness, ...(item ? { item } : {}), ...(brief ? { brief } : {}) });
    // Failed admission leaves capacity available for the next two launches.
    const invalid = await coord.call<{ ok: boolean }>('session.launch', { name: 'bad', role: 'reviewer', harness, cwd: 'missing' });
    assert.equal(invalid.ok, false);
    const [one, two] = await Promise.all([launch('rev-one', firstItem), launch('rev-two')]);
    assert.equal(one.ok, true, one.error);
    assert.equal(two.ok, true, two.error);
    const third = await launch('rev-three');
    assert.equal(third.ok, false);
    assert.match(third.error!, /crew.reviewer.*pool size 2/);
    const processes = async () => (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    const peers = [];
    for (const p of [one.process, two.process]) {
      peers.push(await inProcessSpoke(t, { cwd: root, discover: true, name: p.name, role: 'reviewer', sessionId: p.sessionId, assignRole: false }));
      fake.busy(p.name);
    }
    fake.idle('rev-one');
    assert.equal((await processes()).processes.find(p => p.name === 'rev-one')?.state, 'idle');
    // A verifier hold reserves the other reviewer even between native turns.
    assert.equal((await ui.request({ type: 'task.hold', item: firstItem, as: { name: 'rev-two' } })).ok, true);
    const brief = `review request ${secondItem}\nReview the committed build.`;
    const reused = await launch('rev-new-name', secondItem, brief);
    assert.equal(reused.ok, true, reused.error);
    assert.equal(reused.process.name, 'rev-one');
    assert.equal(reused.process.sessionId, one.process.sessionId);
    assert.equal(reused.process.harnessId, one.process.harnessId);
    assert.equal(reused.process.cwd, root);
    assert.equal(reused.process.item, secondItem);
    assert.equal(fake.spawns.length, 2);
    await eventually('review brief reaches retained harness', async () => fake.injections.some(i => i.message.text.includes(brief)) ? true : undefined);
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
    assert.match(journal, /"event":"session-reused"/);
    assert.equal((await peers[0]!.call<{ ok: boolean }>('task.comment', { id: secondItem, verdict: 'review', scope: 'full', result: 'clear', run: `completed-${harness}` })).ok, true);
    fake.idle('rev-one');
    await eventually('retained reviewer finishes its review turn', async () => (await processes()).processes.find(p => p.name === 'rev-one')?.state === 'idle' ? true : undefined);
    const handoff = await launch('next-handoff', firstItem);
    assert.equal(handoff.ok, true, handoff.error);
    assert.equal(handoff.process.name, 'rev-one');
    const overlap = await launch('overlapping-handoff', secondItem);
    assert.equal(overlap.ok, false, 'an unbriefed handoff remains reserved for its requester');
    assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['rev-one'], text: `review request ${firstItem}\nContinue on this build.` })).ok, true);
    // A keep_context=false pool never hands out its idle members.
    assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.keep_context', value: false })).ok, true);
    const refused = await launch('rev-four', firstItem);
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /size 2/);
    for (const p of [one.process, two.process]) assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);
    await Promise.all(peers.map(peer => peer.close()));
    await coord.waitForPresence(['coord']);
  }
});


test('Implementer handoff retains or resets native context across flavours', async t => {
  const root = await tempProject(t);
  const previous = join(root, 'previous-item');
  await mkdir(previous);
  const clock = new FakeClock();
  const { discovery, fakes } = await ruleHub(t, root, clock);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.policy', value: 'pool' })).ok, true);
  for (const harness of FAKE_FLAVOURS) for (const keepContext of [true, false]) {
    assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.keep_context', value: keepContext })).ok, true);
    const made = await ui.request({ size: 'M', type: 'task.create', title: `Handoff ${harness} ${keepContext}` });
    const item = (made.value as { item: { id: string } }).item.id;
    const launch = await ui.request({ type: 'session.launch', name: `${harness}-${keepContext}`, role: 'implementer', harness, cwd: previous });
    assert.equal(launch.ok, true, launch.error);
    const one = (launch.value as { process: HarnessProcessView }).process;
    const spoke = await inProcessSpoke(t, { cwd: root, discover: true, name: one.name, role: 'implementer', sessionId: one.sessionId, assignRole: false });
    await spoke.waitForPresence([one.name]);
    fakes[harness]!.idle(one.name);
    // A stopped harness loses its protocol peer before replacement admission.
    const fake = fakes[harness]!;
    const stop = fake.stop.bind(fake);
    fake.stop = async (...args) => { await stop(...args); await spoke.close(); };
    const brief = 'Next item brief';
    const next = await ui.request({ type: 'session.launch', name: 'requested-next', role: 'implementer', harness, item, brief });
    assert.equal(next.ok, true, next.error);
    const two = (next.value as { process: HarnessProcessView; worktree: null });
    assert.equal(two.process.name, one.name);
    assert.notEqual(two.process.sessionId, one.sessionId);
    assert.equal(two.worktree, null, 'native Git worktree assertions remain in the T3 handoff table');
    assert.equal(two.process.cwd, root);
    assert.notEqual(two.process.cwd, one.cwd);
    assert.equal(two.process.item, item);
    assert.equal(two.process.harnessSessionId === one.harnessSessionId, keepContext);
    const request = fakes[harness]!.spawns.at(-1)!;
    assert.equal(request.resumeConversation, keepContext ? one.harnessSessionId : undefined);
    assert.match(request.brief!.text, /Next item brief/);
    assert.equal(fakes[harness]!.stops.at(-1)!.sessionId, one.sessionId);
    assert.match(request.clause!, /Sub-agent delegation is disabled/);
    await spoke.close();
    assert.equal((await ui.request({ type: 'session.stop', session: one.name })).ok, true);
    fake.stop = stop;
  }
});
test('crew caps and live clauses follow current policy across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await ruleHub(t, root, clock);
  const ui = await connectUi(t, discovery);
  for (const harness of FAKE_FLAVOURS) {
    const fake = fakes[harness]!;
    assert.equal((await ui.request({ type: 'crew.set', key: 'leads', value: [] })).ok, true);
    assert.equal((await ui.request({ type: 'crew.set', key: 'coordinator.subagents', value: true })).ok, true);
    const launch = (name: string, role: string) => ui.request({ type: 'session.launch', name, role, harness });
    for (const role of ['qa', 'implementer']) {
      if (role === 'implementer') assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.size', value: 1 })).ok, true);
      const results = await Promise.all([launch(`${role}-one`, role), launch(`${role}-two`, role)]);
      assert.equal(results.filter(r => r.ok).length, 1, JSON.stringify(results));
      assert.match(results.find(r => !r.ok)!.error!, /size 1/);
    }
    const coordinator = await launch('coord-native', 'coordinator');
    assert.equal(coordinator.ok, true, coordinator.error);
    const process = (coordinator.value as { process: HarnessProcessView }).process;
    await eventually('default staffing clause', async () => fake.spawns.find(p => p.name === process.name)?.clause?.includes('leads = []') ? true : undefined);
    const peer = await inProcessSpoke(t, { cwd: root, discover: true, name: process.name, role: 'coordinator', sessionId: process.sessionId, assignRole: false });
    assert.equal((await ui.request({ type: 'crew.set', key: 'leads', value: ['epic'] })).ok, true);
    await eventually('new lead levels delivered', async () => fake.injections.some(i => i.message.text.includes('Launch Leads for these container levels: epic')) ? true : undefined);
    assert.equal((await ui.request({ type: 'crew.set', key: 'coordinator.subagents', value: false })).ok, true);
    await eventually('delegation disabled live', async () => fake.injections.some(i => i.message.text.includes('Sub-agent delegation is disabled')) ? true : undefined);
    await peer.close();
    for (const name of ['qa-one', 'qa-two', 'implementer-one', 'implementer-two', process.name]) {
      const rows = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
      if (rows.processes.some(p => p.name === name && p.status === 'running')) assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
    }
  }
});
