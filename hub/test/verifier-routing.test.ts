// T2: real send frames prove queued assignment and recorded delivery through fake adapters.
import { sessionUi as connectUi } from './session-credential-fixture.ts';
import { fakeHarness } from './fakes/harness.ts';
import { FakeClock } from './fake-clock.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Message, SendOutcome, TopicMessage } from '../src/protocol.ts';
import { componentProject, human } from './merge-component-support.ts';

test('landing finalization clears a disconnected verifier reservation durably before an item is reopened', async t => {
  const f = await componentProject(t);
  const coord = await inProcessSpoke(t, { hub: f.hub, cwd: f.root, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  await coord.waitForEvent(e => e.params.meta?.kind === 'role');
  const item = await f.ticket();
  const text = `review request ${item.id}\nBuild to land`;
  const sent = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['rev'], text });
  assert.equal(sent.outcomes[0]?.outcome, 'delivered');
  await f.rev.waitForEvent(e => e.params.content === text);
  const who = async () => (await coord.call<{ sessions: Array<{ name: string; pending?: { item: string; kind: string } }> }>('who')).sessions;
  assert.deepEqual((await who()).find(s => s.name === 'rev')?.pending, { item: item.id, kind: 'review' });
  await f.rev.close();
  assert.equal(await f.tracker.finishMerge(human, item.id, 'Merged fixture head into dev'), null);
  assert.equal(f.tracker.view(item.id).state, 'closed');
  await f.tracker.edit(human, item.id, { state: 'open' });
  const back = await inProcessSpoke(t, { hub: f.hub, cwd: f.root, name: 'rev', role: 'reviewer', sessionId: 'component-rev' });
  await back.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.equal((await who()).find(s => s.name === 'rev')?.pending, undefined, 'reopening cannot resurrect the landed request');
});

for (const role of ['reviewer', 'qa'] as const) {
  const kind = role === 'reviewer' ? 'review' : 'qa';
  test(`closing an item clears every pending ${kind} and assigns the oldest queued request`, async t => {
    const root = await tempProject(t);
    const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
    const ui = await connectUi(t, discovery);
    const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    const verifiers = [];
    for (const name of ['verify-a', 'verify-b']) {
      const verifier = await inProcessSpoke(t, { cwd: root, discover: true, name, role, sessionId: name });
      await verifier.waitForEvent(e => e.params.meta?.kind === 'role');
      verifiers.push({ name, verifier });
    }
    const create = async (title: string) => (await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title })).item;
    const previous = await create('Closing verification');
    const next = await create('Oldest waiting verification');
    const later = await create('Later waiting verification');
    const text = `${kind} request ${previous.id}\nOld build`;
    for (const { name, verifier } of verifiers) {
      await coord.call('send', { to: [name], text });
      await verifier.waitForEvent(e => e.params.content === text);
    }
    const pending = async () => (await coord.call<{ sessions: Array<{ name: string; pending?: { item: string; kind: string } }> }>('who')).sessions
      .filter(s => s.name.startsWith('verify-')).map(s => s.pending);
    assert.deepEqual(await pending(), [undefined, { item: previous.id, kind }], 'newer accepted request supersedes the earlier pending');
    await verifiers[0]!.verifier.call('task.hold', { id: previous.id });
    for (const item of [next, later]) {
      const result = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: [role], text: `${kind} request ${item.id}\nWaiting build` });
      assert.equal(result.outcomes[0]?.outcome, 'queued');
    }
    assert.equal((await coord.call<{ ok: boolean }>('task.close', { id: previous.id })).ok, true);
    const messages = ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages;
    const nextName = messages.find(m => m.text.startsWith(`${kind} request ${next.id}\n`))!.to[0]!;
    const laterName = messages.find(m => m.text.startsWith(`${kind} request ${later.id}\n`))!.to[0]!;
    assert.deepEqual([nextName, laterName].sort(), ['verify-a', 'verify-b']);
    await verifiers.find(v => v.name === nextName)!.verifier.waitForEvent(e => e.params.content.startsWith(`${kind} request ${next.id}\n`));
    await verifiers.find(v => v.name === laterName)!.verifier.waitForEvent(e => e.params.content.startsWith(`${kind} request ${later.id}\n`));
    assert.deepEqual(await pending(), verifiers.map(v => ({ item: v.name === nextName ? next.id : later.id, kind })));
    for (const item of [next, later]) assert.equal((await coord.call<{ ok: boolean }>('task.close', { id: item.id })).ok, true);
    assert.deepEqual(await pending(), [undefined, undefined], 'who never shows a closed item as pending');
    const lateText = `${text}\nLate delivery after closure`;
    await coord.call('send', { to: ['verify-a'], text: lateText });
    await verifiers[0]!.verifier.waitForEvent(e => e.params.content === lateText);
    assert.deepEqual(await pending(), [undefined, undefined], 'late delivery of a closed-item request cannot recreate pending work');
  });
}

for (const ready of [false, true]) for (const queued of [false, true]) {
  test(`legacy ${ready ? 'ready' : 'closed'}-item pending after restart ${queued ? 'cannot block the oldest queued review' : 'is absent from who and session rows'}`, async t => {
    const root = await tempProject(t);
    const served = await projectHub(t, root, {}, { clock: new FakeClock() });
    const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    const create = async (title: string) => (await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title })).item;
    const previous = await create('Already landed before upgrade');
    const next = await create('Oldest queued review');
    const later = await create('Later queued review');
    assert.equal((await coord.call<{ ok: boolean }>(ready ? 'task.edit' : 'task.close', { id: previous.id, ...(ready ? { status: 'ready' } : {}) })).ok, true);
    const text = `review request ${next.id}\nOldest build`;
    const laterText = `review request ${later.id}\nLater build`;
    if (queued) for (const request of [text, laterText]) {
      assert.equal((await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text: request })).outcomes[0]?.outcome, 'queued');
    }
    await coord.close();
    await served.stop();
    // Seed the pre-fix durable format only while every writer is stopped.
    const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
    try {
      db.prepare('insert into meta (key, value) values (?, ?)').run('pending-verification:rev-id', JSON.stringify({ item: previous.id, kind: 'review' }));
      // Older queued deliveries had no private admission receipt.
      db.prepare('update messages set verifier_admitted = null where text = ? or text = ?').run(text, laterText);
    } finally { db.close(); }
    const restarted = await projectHub(t, root, {}, { clock: new FakeClock() });
    const ui = await connectUi(t, restarted.discovery);
    const back = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', assignRole: false, sessionId: 'coord-id' });
    const rev = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-d', role: 'reviewer', sessionId: 'rev-id' });
    await rev.waitForEvent(e => e.params.meta?.kind === 'role');
    if (queued) {
      const messages = ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages;
      assert.deepEqual(messages.find(m => m.text === text)?.to, ['rev-d']);
      assert.deepEqual(messages.find(m => m.text === laterText)?.to, ['reviewer']);
      await rev.waitForEvent(e => e.params.content === text);
      // The local event precedes the hub's ack transaction and pending reservation.
      await eventually('oldest queued review accepted by the hub', async () => {
        const history = await ui.request({ type: 'topic.history', topic: 'agents' });
        assert.equal(history.ok, true, history.error);
        return (history.value as { messages: TopicMessage[] }).messages
          .find(m => m.text === text)?.stage === 'delivered' || undefined;
      });
    }
    const who = (await back.call<{ sessions: Array<{ name: string; pending?: { item: string; kind: string } }> }>('who')).sessions;
    assert.deepEqual(who.find(s => s.name === 'rev-d')?.pending, queued ? { item: next.id, kind: 'review' } : undefined);
    const rows = (await ui.request({ type: 'session.list' })).value as { rows: Array<{ name: string; pending?: { item: string } }> };
    assert.notEqual(rows.rows.find(s => s.name === 'rev-d')?.pending?.item, previous.id);
  });
}

for (const relaunch of [false, true]) {
  test(`queued QA request starts an idle verifier with held progress${relaunch ? ' after relaunch' : ''}`, async t => {
    const root = await tempProject(t);
    const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
    const fake = fakes['claude-code']!;
    const ui = await connectUi(t, discovery);
    assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
    const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    t.after(() => coord.close());
    const launch = await ui.request({ type: 'session.launch', name: 'qa-d', role: 'qa', harness: 'claude-code' }, 30_000);
    assert.equal(launch.ok, true, launch.error);
    let processRow = (launch.value as { process: HarnessProcessView }).process;
    const qa = await inProcessSpoke(t, { cwd: root, discover: true, name: 'qa-d', assignRole: false, sessionId: processRow.sessionId });
    fake.idle('qa-d');
    const idle = () => eventually('QA verifier idle', async () => {
      const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
      return processes.find(p => p.name === 'qa-d')?.state === 'idle' || undefined;
    });
    await idle();
    const progress = 'Keep this progress for the next QA turn.';
    const sent = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa-d'], kind: 'progress', text: progress });
    assert.equal(sent.outcomes[0]?.outcome, 'queued');
    if (relaunch) {
      const resumed = await ui.request({ type: 'session.resume', session: 'qa-d', relaunch: true }, 30_000);
      assert.equal(resumed.ok, true, resumed.error);
      const after = (resumed.value as { process: HarnessProcessView }).process;
      assert.equal(after.sessionId, processRow.sessionId);
      assert.equal(fake.resumes.at(-1)?.options?.relaunch, true);
      processRow = after;
      fake.idle('qa-d');
      await idle();
    }
    const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<Message & { stage?: string }> }).messages;
    assert.equal((await history()).find(m => m.text === progress)?.stage, 'queued');
    assert.equal(qa.events.some(e => e.params.content.includes(progress)), false);
    const { item: occupied } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Current QA hold' });
    const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Waiting QA with progress' });
    assert.equal((await ui.request({ type: 'task.hold', item: occupied.id, as: { name: 'qa-d' } })).ok, true);
    const text = `qa request ${item.id}\nCommitted QA brief`;
    const queued = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa'], text });
    assert.equal(queued.outcomes[0]?.outcome, 'queued');
    assert.equal((await ui.request({ type: 'task.hold', item: occupied.id, release: true, as: { name: 'qa-d' } })).ok, true);
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['qa-d'], 'assigned in the hold-release tick');
    await coord.waitForEvent(e => e.params.meta?.kind === 'verifier-request' && e.params.content.includes(`for ${item.id} assigned to qa-d`));
    const delivery = await qa.waitForEvent(e => e.params.content.includes(text));
    assert.ok(delivery.params.content.indexOf(progress) < delivery.params.content.indexOf(text));
    await eventually('request and progress injected together', async () => {
      const messages = await history();
      return [progress, text].every(text => messages.some(m => m.text === text && m.stage === 'injected')) || undefined;
    });
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['qa-d']);
  });
}

test('a free bare Reviewer can receive its first role request after accepting its clause', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const rev = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-d', role: 'reviewer', sessionId: 'rev-id' });
  t.after(() => rev.close());
  await rev.waitForPresence(['coord', 'rev-d']);
  await rev.waitForEvent(e => e.params.meta?.kind === 'role');
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'First bare review' });
  const text = `review request ${item.id}\nFirst build`;
  const result = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text });
  assert.equal(result.outcomes[0]?.outcome, 'delivered');
  assert.equal(result.outcomes[0]?.resolvedTo, 'rev-d');
  await rev.waitForEvent(e => e.params.content === text);
});

test('queued QA requests survive sender rename and hub restart, and closed items are refused explicitly', async t => {
  const root = await tempProject(t);
  const served = await projectHub(t, root, {}, { clock: new FakeClock() });
  const { discovery } = served;
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Queued QA' });
  const { topic } = await coord.call<{ topic: { id: string } }>('topic.create', { title: 'Queued QA', item: item.id });
  const text = `qa request ${item.id}\nCommitted QA brief`;
  const result = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['@qa'], text, topic: topic.id });
  assert.equal(result.outcomes[0]?.outcome, 'queued');
  assert.equal(result.outcomes[0]?.resolvedTo, undefined);
  const topics = (await ui.request({ type: 'topic.list' })).value as { topics: Array<{ id: string; warning?: string }> };
  assert.equal(topics.topics.find(t => t.id === topic.id)?.warning, 'waiting for free qa');
  const renamed = await coord.call<{ ok: boolean; error?: string }>('rename', { name: 'coord-renamed' });
  assert.equal(renamed.ok, true, renamed.error);
  await served.stop();
  const restarted = await projectHub(t, root, {}, { clock: new FakeClock() });
  const nextUi = await connectUi(t, restarted.discovery);
  assert.equal((await nextUi.request({ type: 'subscribe' })).ok, true);
  await coord.waitForPresence(['coord-renamed']);
  const qa = await inProcessSpoke(t, { cwd: root, discover: true, name: 'qa-d', role: 'qa', sessionId: 'qa-id' });
  t.after(() => qa.close());
  await qa.waitForPresence(['coord-renamed', 'qa-d']);
  await qa.waitForEvent(e => e.params.content === text);
  await coord.waitForEvent(e => e.params.meta?.kind === 'verifier-request' && e.params.content.includes(`for ${item.id} assigned to qa-d`));
  await nextUi.waitFor(f => f.type === 'topic' && (f.topic as { id: string; warning?: string }).id === topic.id
    && !(f.topic as { warning?: string }).warning);
  const history = (await nextUi.request({ type: 'topic.history', topic: topic.id })).value as { messages: Message[] };
  assert.deepEqual(history.messages.find(m => m.text === text)?.to, ['qa-d']);
  assert.equal(qa.events.filter(e => e.params.content === text).length, 1);
  await qa.call('task.hold', { id: item.id });
  const { item: cancelled } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Cancelled QA' });
  const cancelledText = `qa request ${cancelled.id}\nBuild closed before selection`;
  assert.equal((await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa'], text: cancelledText })).outcomes[0]?.outcome, 'queued');
  assert.equal((await coord.call<{ ok: boolean }>('task.close', { id: cancelled.id })).ok, true);
  await coord.waitForEvent(e => e.params.meta?.kind === 'verifier-request' && e.params.content.includes(`for ${cancelled.id} refused:`));
  await qa.call('task.hold', { id: item.id, release: true });
  const cancelledHistory = (await nextUi.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<Message & { stage?: string }> };
  assert.equal(cancelledHistory.messages.find(m => m.text === cancelledText)?.stage, 'dropped');
  assert.equal(qa.events.filter(e => e.params.content === cancelledText).length, 0);
});


for (const role of ['qa', 'reviewer'] as const) for (const restart of [false, true]) {
  const kind = role === 'qa' ? 'qa' : 'review';
  test(`queued ${kind} reaches idle after verdict and hold release despite uncertain traffic${restart ? ' across restart' : ''}`, async t => {
    const root = await tempProject(t);
    const logs: Record<string, unknown>[] = [];
    const options = { clock: new FakeClock(), log: (entry: Record<string, unknown>) => logs.push(entry) };
    let served = await projectHub(t, root, {}, options);
    let fake = served.fakes.codex!;
    let ui = await connectUi(t, served.discovery);
    let coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    const launch = await ui.request({ type: 'session.launch', name: 'verify-d', role, harness: 'codex' });
    assert.equal(launch.ok, true, launch.error);
    const process = (launch.value as { process: HarnessProcessView }).process;
    const connectVerifier = () => inProcessSpoke(t, { cwd: root, discover: true, name: 'verify-d', assignRole: false, sessionId: process.sessionId });
    let verifier = await connectVerifier();
    await verifier.waitForEvent(e => e.params.meta?.kind === 'role');
    fake.busy('verify-d');
    const { item: previous } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Previous verification' });
    const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Next verification' });
    assert.equal((await verifier.call<{ ok: boolean }>('task.hold', { id: previous.id })).ok, true);
    // Like the production outage notice, this unanswered operational message persists as uncertain.
    fake.scriptInject('verify-d', 'uncertain');
    const report = 'Inspect outstanding writes after the hub storage outage.';
    await coord.call('send', { to: ['verify-d'], text: report });
    const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<Message & { stage?: string }> }).messages;
    const reportId = (await history()).find(m => m.text === report)!.id;
    await eventually('operational report uncertain', () => logs.some(e => e.event === 'inject-uncertain' && e.id === reportId) || undefined);
    if (restart) {
      await verifier.close();
      await coord.close();
      await ui.close();
      await served.stop();
      served = await projectHub(t, root, {}, { ...options, adapters: [(host, clock) => {
        const recovered = fakeHarness('codex', { host, clock });
        recovered.scriptResume('verify-d', 'found');
        fake = recovered;
        return recovered;
      }] });
      ui = await connectUi(t, served.discovery);
      coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', assignRole: false, sessionId: 'coord-id' });
      verifier = await connectVerifier();
      await verifier.waitForEvent(e => e.params.meta?.kind === 'role');
      fake.busy('verify-d');
    }
    assert.equal((await verifier.call<{ ok: boolean }>('task.comment', { id: previous.id, verdict: kind, ...(kind === 'review' ? { scope: 'full' } : {}), result: 'clear', run: 'previous-verdict' })).ok, true);
    assert.equal((await verifier.call<{ ok: boolean }>('task.hold', { id: previous.id, release: true })).ok, true);
    const text = `${kind} request ${item.id}\nCommitted verification brief`;
    const queued = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: [role], text });
    assert.equal(queued.outcomes[0]?.outcome, 'queued');
    assert.deepEqual((await history()).find(m => m.text === text)?.to, [role]);
    fake.idle('verify-d');
    // The signal drains synchronously; the socket request is a barrier, not a timed wait.
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['verify-d']);
    await verifier.waitForEvent(e => e.params.content.includes(text));
    await eventually('new request injected', async () => (await history()).find(m => m.text === text)?.stage === 'injected' || undefined);
    assert.equal((await history()).find(m => m.id === reportId)?.stage, 'delivered', 'uncertain receipt stays available for explicit retry');
    assert.equal(fake.injections.filter(i => i.message.id === reportId).length, restart ? 0 : 1, 'uncertain traffic is never replayed automatically');
  });
}

test('an uncertain unheld review reserves its verifier for role routing and pool reuse', async t => {
  const root = await tempProject(t);
  const logs: Record<string, unknown>[] = [];
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock(), log: entry => logs.push(entry) });
  const fake = fakes.codex!;
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 1 })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const launch = await ui.request({ type: 'session.launch', name: 'rev-d', role: 'reviewer', harness: 'codex' });
  assert.equal(launch.ok, true, launch.error);
  const process = (launch.value as { process: HarnessProcessView }).process;
  const reviewer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-d', assignRole: false, sessionId: process.sessionId });
  await reviewer.waitForEvent(e => e.params.meta?.kind === 'role');
  fake.busy('rev-d');
  const { item: first } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Uncertain first review' });
  const { item: next } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Waiting second review' });
  assert.equal((await reviewer.call<{ ok: boolean }>('task.comment', { id: next.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'prior-next-review' })).ok, true);
  fake.scriptInject('rev-d', 'uncertain');
  const text = `review request ${first.id}\nFirst build`;
  await coord.call('send', { to: ['rev-d'], text });
  const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages;
  const firstId = (await history()).find(m => m.text === text)!.id;
  await eventually('first review uncertain', () => logs.some(e => e.event === 'inject-uncertain' && e.id === firstId) || undefined);
  fake.idle('rev-d');
  const row = ((await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'rev-d')!;
  assert.deepEqual(row.pending, { item: first.id, kind: 'review' });
  assert.deepEqual(row.holds, []);
  const second = `review request ${next.id}\nSecond build`;
  assert.equal((await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text: second })).outcomes[0]?.outcome, 'queued');
  const reuse = await ui.request({ type: 'session.launch', name: 'reused-reviewer', role: 'reviewer', harness: 'codex', item: next.id });
  assert.equal(reuse.ok, false, 'pool reuse cannot bypass the pending verification reservation');
  assert.match(reuse.error!, /pool size 1/);
  assert.deepEqual((await history()).find(m => m.text === second)?.to, ['reviewer']);
  assert.equal((await reviewer.call<{ ok: boolean }>('task.hold', { id: first.id })).ok, true);
  assert.deepEqual((await history()).find(m => m.text === second)?.to, ['reviewer'], 'a hold preserves the reservation when it replaces pending work');
  assert.equal((await reviewer.call<{ ok: boolean }>('task.comment', { id: first.id, verdict: 'review', scope: 'full', result: 'clear', run: 'first-reviewed' })).ok, true);
  assert.deepEqual((await history()).find(m => m.text === second)?.to, ['rev-d'], 'the verdict frees the reservation and dispatches the next review');
  await reviewer.waitForEvent(e => e.params.content.includes(second));
  assert.equal(fake.injections.filter(i => i.message.id === firstId).length, 1);
});

for (const verification of [false, true]) {
  test(`idle before an inject becomes uncertain ${verification ? 'preserves verification reservations' : 'dispatches queued review'}`, async t => {
    const root = await tempProject(t);
    const logs: Record<string, unknown>[] = [];
    const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock(), log: entry => logs.push(entry) });
    const fake = fakes.codex!;
    const ui = await connectUi(t, discovery);
    const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    const launch = await ui.request({ type: 'session.launch', name: 'rev-d', role: 'reviewer', harness: 'codex' });
    assert.equal(launch.ok, true, launch.error);
    const process = (launch.value as { process: HarnessProcessView }).process;
    const reviewer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-d', assignRole: false, sessionId: process.sessionId });
    const clause = await reviewer.waitForEvent(e => e.params.meta?.kind === 'role');
    await eventually('reviewer clause injected', () => logs.some(e => e.event === 'injected' && e.id === clause.params.meta?.msg_id) || undefined);
    fake.busy('rev-d');
    const { item: first } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Outstanding input' });
    const { item: next } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Queued next review' });
    fake.scriptInject('rev-d', 'hold');
    const input = verification ? `review request ${first.id}\nFirst build` : 'Inspect outstanding writes after the hub storage outage.';
    await coord.call('send', { to: ['rev-d'], text: input });
    const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<Message & { stage?: string }> }).messages;
    const inputId = (await history()).find(m => m.text === input)!.id;
    await eventually('outstanding inject entered', () => fake.injections.some(i => i.message.id === inputId && i.outcome === 'hold') || undefined);
    fake.idle('rev-d');
    const text = `review request ${next.id}\nSecond build`;
    assert.equal((await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text })).outcomes[0]?.outcome, 'queued');
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['reviewer']);
    assert.equal(fake.injections.filter(i => i.message.id === inputId).length, 1);
    fake.settle('rev-d', inputId, 'uncertain');
    await eventually('uncertain completion receipt', () => logs.some(e => e.event === 'inject-uncertain' && e.id === inputId) || undefined);
    if (verification) {
      assert.deepEqual((await history()).find(m => m.text === text)?.to, ['reviewer'], 'uncertain verification must stay reserved');
      assert.equal((await reviewer.call<{ ok: boolean }>('task.comment', { id: first.id, verdict: 'review', scope: 'full', result: 'clear', run: 'outstanding-reviewed' })).ok, true);
    }
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['rev-d'], 'the eligibility change drains without another idle signal');
    await eventually('next review injected', async () => (await history()).find(m => m.text === text)?.stage === 'injected' || undefined);
    assert.equal((await history()).find(m => m.id === inputId)?.stage, 'delivered');
    assert.equal(fake.injections.filter(i => i.message.id === inputId).length, 1, 'uncertain input is never replayed automatically');
  });
}

test('ready clears an idle reviewer reservation and assigns queued work while another reviewer stays busy', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
  const reviewers = [];
  for (const name of ['rev-busy', 'rev-idle']) {
    const launch = await ui.request({ type: 'session.launch', name, role: 'reviewer', harness: 'codex' });
    assert.equal(launch.ok, true, launch.error);
    const process = (launch.value as { process: HarnessProcessView }).process;
    const peer = await inProcessSpoke(t, { cwd: root, discover: true, name, assignRole: false, sessionId: process.sessionId });
    await peer.waitForEvent(e => e.params.meta?.kind === 'role');
    reviewers.push(peer);
  }
  fakes.codex!.busy('rev-busy');
  fakes.codex!.idle('rev-idle');
  const create = async (title: string) => (await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title })).item;
  const previous = await create('Ready review');
  const next = await create('Queued review');
  const first = `review request ${previous.id}\nPrevious build`;
  await coord.call('send', { to: ['rev-idle'], text: first });
  await reviewers[1]!.waitForEvent(e => e.params.content === first);
  const who = async () => (await coord.call<{ sessions: Array<{ name: string; pending?: { item: string; kind: string } }> }>('who')).sessions;
  assert.deepEqual((await who()).find(s => s.name === 'rev-idle')?.pending, { item: previous.id, kind: 'review' });
  const text = `review request ${next.id}\nNext build`;
  assert.equal((await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text })).outcomes[0]?.outcome, 'queued');
  // The request response is the durable status boundary; no clock tick or idle signal follows it.
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: previous.id, status: 'ready' })).ok, true);
  const history = ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages;
  assert.deepEqual(history.find(m => m.text === text)?.to, ['rev-idle'], 'assignment happens in the ready transition tick');
  await reviewers[1]!.waitForEvent(e => e.params.content === text);
  assert.deepEqual((await who()).find(s => s.name === 'rev-idle')?.pending, { item: next.id, kind: 'review' });
  assert.equal(reviewers[0]!.events.some(e => e.params.content === text), false);
  const late = `${first}\nLate ready-item delivery`;
  await coord.call('send', { to: ['rev-idle'], text: late });
  await reviewers[1]!.waitForEvent(e => e.params.content === late);
  assert.deepEqual((await who()).find(s => s.name === 'rev-idle')?.pending, { item: next.id, kind: 'review' }, 'late ready delivery cannot replace live work');
});

for (const role of ['reviewer', 'qa'] as const) {
  test(`same-item ${role} request after a settled verdict reaches the idle verifier`, async t => {
    const root = await tempProject(t);
    const clock = new FakeClock(Date.parse('2026-10-30T12:38:00Z'));
    const { discovery, fakes } = await projectHub(t, root, {}, { clock });
    const ui = await connectUi(t, discovery);
    const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    const launch = await ui.request({ type: 'session.launch', name: 'verify-d', role, harness: 'codex' });
    assert.equal(launch.ok, true, launch.error);
    const process = (launch.value as { process: HarnessProcessView }).process;
    const verifier = await inProcessSpoke(t, { cwd: root, discover: true, name: 'verify-d', assignRole: false, sessionId: process.sessionId });
    await verifier.waitForEvent(e => e.params.meta?.kind === 'role');
    const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Review again after verdict' });
    const kind = role === 'reviewer' ? 'review' : 'qa';
    const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: TopicMessage[] }).messages;
    const first = `${kind} request ${item.id}\nSource review`;
    await coord.call('send', { to: ['verify-d'], text: first });
    await eventually('first request injected', async () => (await history()).find(m => m.text === first)?.stage === 'injected' || undefined);
    assert.equal((await verifier.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: kind, ...(kind === 'review' ? { scope: 'full' } : {}), result: 'not clear', run: 'source-not-clear' })).ok, true);
    fakes.codex!.idle('verify-d');
    await clock.advance(5 * 60_000);
    const text = `${kind} request ${item.id}\nEvidence review`;
    await coord.call('send', { to: [role], text });
    await clock.advance(1000);
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['verify-d']);
    await eventually('same-item follow-up injected', async () => (await history()).find(m => m.text === text)?.stage === 'injected' || undefined);
  });
}

test('an overdue queued request names idle verifier exclusions once in Agents', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-d', role: 'reviewer', sessionId: 'rev-id' });
  await rev.waitForEvent(e => e.params.meta?.kind === 'role');
  const create = async (title: string) => (await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title })).item;
  const occupied = await create('Still held review');
  const waiting = await create('Waiting review');
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: occupied.id })).ok, true);
  const result = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text: `review request ${waiting.id}\nWaiting build` });
  assert.equal(result.outcomes[0]?.outcome, 'queued');
  await clock.advance(1001);
  const notices = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages
    .filter(m => m.kind === 'verifier-request' && m.detail?.outcome === 'stalled');
  const rows = await notices();
  assert.equal(rows.length, 1);
  assert.match(rows[0]!.text, new RegExp(((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages.find(m => m.text === `review request ${waiting.id}\nWaiting build`)!.id));
  assert.match(rows[0]!.text, /rev-d/);
  assert.match(rows[0]!.text, new RegExp(occupied.id));
  await clock.advance(3000);
  assert.equal((await notices()).length, 1);
});

for (const settlement of ['verdict', 'newer request'] as const) {
  test(`a delayed request accepted after ${settlement} cannot reserve an idle reviewer`, async t => {
    const root = await tempProject(t);
    const clock = new FakeClock(Date.parse('2026-10-30T12:38:00Z'));
    const { discovery } = await projectHub(t, root, {}, { clock });
    const ui = await connectUi(t, discovery);
    const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    const old = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-a', role: 'reviewer', sessionId: 'a-id' });
    const current = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-b', role: 'reviewer', sessionId: 'b-id' });
    await old.waitForEvent(e => e.params.meta?.kind === 'role');
    await current.waitForEvent(e => e.params.meta?.kind === 'role');
    const create = async (title: string) => (await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title })).item;
    const served = await create('Delayed already served request');
    const next = await create('Next review after settled verdict');
    await current.call('task.comment', { id: next.id, verdict: 'review', scope: 'full', result: 'not clear', run: '12:38-verdict' });
    await old.close();
    const first = `review request ${served.id}\nDelayed source request`;
    await coord.call('send', { to: ['rev-a'], text: first });
    await clock.advance(1);
    if (settlement === 'verdict') {
      await current.call('task.comment', { id: served.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'served-elsewhere' });
    } else {
      const newer = `review request ${served.id}\nNewer source request`;
      await coord.call('send', { to: ['rev-b'], text: newer });
      await current.waitForEvent(e => e.params.content === newer);
    }
    await current.call('task.hold', { id: served.id });
    const back = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-a', assignRole: false, sessionId: 'a-id' });
    await back.waitForEvent(e => e.params.content === first);
    const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: TopicMessage[] }).messages;
    await eventually('delayed request durably accepted', async () => (await history()).find(m => m.text === first)?.stage === 'delivered' || undefined);
    await clock.advance(5 * 60_000);
    const text = `review request ${next.id}\n12:43 follow-up`;
    await coord.call('send', { to: ['reviewer'], text });
    await clock.advance(1000);
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['rev-a']);
    await back.waitForEvent(e => e.params.content === text);
  });
}

test('legacy open pending without provenance retires on the next other-verifier verdict', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const served = await projectHub(t, root, {}, { clock });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Legacy reserved review' });
  await coord.close();
  await served.stop();
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  try {
    db.prepare('insert into meta (key, value) values (?, ?)').run('pending-verification:a-id', JSON.stringify({ item: item.id, kind: 'review' }));
  } finally { db.close(); }
  const restarted = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, restarted.discovery);
  const a = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-a', role: 'reviewer', sessionId: 'a-id' });
  const b = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-b', role: 'reviewer', sessionId: 'b-id' });
  await a.waitForEvent(e => e.params.meta?.kind === 'role');
  await b.waitForEvent(e => e.params.meta?.kind === 'role');
  const pending = async () => ((await ui.request({ type: 'session.list' })).value as { rows: Array<{ name: string; pending?: { item: string; kind: string } }> }).rows.find(r => r.name === 'rev-a')?.pending;
  assert.deepEqual(await pending(), { item: item.id, kind: 'review' });
  await clock.advance(1);
  const qa = await inProcessSpoke(t, { cwd: root, discover: true, name: 'qa-d', role: 'qa', sessionId: 'qa-id' });
  await qa.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'different-kind' })).ok, true);
  assert.deepEqual(await pending(), { item: item.id, kind: 'review' });
  assert.equal((await b.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'legacy-settled' })).ok, true);
  assert.equal(await pending(), undefined);
});

test('an already served queued request is retired before a second reviewer is assigned', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const a = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-a', role: 'reviewer', sessionId: 'a-id' });
  const b = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-b', role: 'reviewer', sessionId: 'b-id' });
  await a.waitForEvent(e => e.params.meta?.kind === 'role');
  await b.waitForEvent(e => e.params.meta?.kind === 'role');
  const create = async (title: string) => (await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title })).item;
  const occupied = await create('Occupied review');
  const item = await create('Served queued review');
  await a.call('task.hold', { id: occupied.id });
  await b.call('task.hold', { id: occupied.id });
  const text = `review request ${item.id}\nQueued source`;
  assert.equal((await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text })).outcomes[0]?.outcome, 'queued');
  await clock.advance(1);
  await b.call('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'named-review-complete' });
  await a.call('task.hold', { id: occupied.id, release: true });
  const history = ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(history.find(m => m.text === text)?.stage, 'dropped');
  assert.ok(history.some(m => m.kind === 'verifier-request' && m.text.includes('superseded by rev-b verdict')));
});

test('unrelated named request cannot supersede an authorized live reservation', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const unrelated = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl-other', role: 'implementer', sessionId: 'other-id' });
  const a = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-a', role: 'reviewer', sessionId: 'a-id' });
  const b = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-b', role: 'reviewer', sessionId: 'b-id' });
  await a.waitForEvent(e => e.params.meta?.kind === 'role');
  await b.waitForEvent(e => e.params.meta?.kind === 'role');
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Authorized reserved review' });
  const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: TopicMessage[] }).messages;
  const send = async (sender: typeof coord, name: string, label: string) => {
    const text = `review request ${item.id}\n${label}`;
    await sender.call('send', { to: [name], text });
    await eventually(`${label} accepted`, async () => (await history()).find(m => m.text === text)?.stage === 'delivered' || undefined);
  };
  const pending = async (name: string) => ((await ui.request({ type: 'session.list' })).value as { rows: Array<{ name: string; pending?: { item: string; kind: string } }> }).rows.find(r => r.name === name)?.pending;
  await send(coord, 'rev-a', 'Authorized initial request');
  await clock.advance(1);
  await send(unrelated, 'rev-b', 'Unrelated sender request');
  assert.deepEqual(await pending('rev-a'), { item: item.id, kind: 'review' });
  assert.equal(await pending('rev-b'), undefined);
  const qa = await inProcessSpoke(t, { cwd: root, discover: true, name: 'qa-d', role: 'qa', sessionId: 'qa-id' });
  await qa.waitForEvent(e => e.params.meta?.kind === 'role');
  await send(coord, 'qa-d', 'Wrong recipient kind');
  assert.deepEqual(await pending('rev-a'), { item: item.id, kind: 'review' });
  // Authorized named cross-kind work still updates local pending, without superseding rev-a globally.
  assert.deepEqual(await pending('qa-d'), { item: item.id, kind: 'review' });
  await clock.advance(1);
  await send(coord, 'rev-b', 'Authorized replacement request');
  assert.equal(await pending('rev-a'), undefined);
  assert.deepEqual(await pending('rev-b'), { item: item.id, kind: 'review' });
});

for (const authorized of [true, false, 'human'] as const) {
  test(`legacy ${authorized === 'human' ? 'human ' : ''}named request without admission receipt ${authorized ? 'reserves its authorized reviewer' : 'cannot reserve for an unrelated sender'}`, async t => {
    const root = await tempProject(t);
    const clock = new FakeClock();
    const served = await projectHub(t, root, {}, { clock });
    const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    const unrelated = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl-other', role: 'implementer', sessionId: 'other-id' });
    const a = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-a', role: 'reviewer', sessionId: 'a-id' });
    await a.waitForEvent(e => e.params.meta?.kind === 'role');
    const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Legacy named review' });
    await a.close();
    const text = `review request ${item.id}\nPre-upgrade named delivery`;
    if (authorized === 'human') {
      const human = await connectUi(t, served.discovery);
      assert.equal((await human.request({ type: 'topic.send', topic: 'general', to: ['rev-a'], text })).ok, true);
      await human.close();
    } else await (authorized ? coord : unrelated).call('send', { to: ['rev-a'], text });
    await unrelated.close();
    await coord.close();
    await served.stop();
    const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
    try { db.prepare('update messages set verifier_admitted = null where text = ?').run(text); }
    finally { db.close(); }
    const restarted = await projectHub(t, root, {}, { clock });
    const ui = await connectUi(t, restarted.discovery);
    const back = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-a', assignRole: false, sessionId: 'a-id' });
    await back.waitForEvent(e => e.params.content === text);
    await eventually('legacy named delivery durably accepted', async () => {
      const history = (await ui.request({ type: 'topic.history', topic: authorized === 'human' ? 'general' : 'agents' })).value as { messages: TopicMessage[] };
      return history.messages.find(m => m.text === text)?.stage === 'delivered' || undefined;
    });
    const rows = (await ui.request({ type: 'session.list' })).value as { rows: Array<{ name: string; pending?: { item: string; kind: string } }> };
    assert.deepEqual(rows.rows.find(r => r.name === 'rev-a')?.pending, authorized ? { item: item.id, kind: 'review' } : undefined);
  });
}

test('trusted human review requests reserve and supersede without a sender session', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const a = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-a', role: 'reviewer', sessionId: 'a-id' });
  const b = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-b', role: 'reviewer', sessionId: 'b-id' });
  await a.waitForEvent(e => e.params.meta?.kind === 'role');
  await b.waitForEvent(e => e.params.meta?.kind === 'role');
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Human requested review' });
  const send = async (name: string, label: string) => {
    const text = `review request ${item.id}\n${label}`;
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: [name], text })).ok, true);
    await eventually(`${label} durably accepted`, async () => {
      const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
      return history.messages.find(m => m.text === text)?.stage === 'delivered' || undefined;
    });
  };
  const pending = async (name: string) => ((await ui.request({ type: 'session.list' })).value as { rows: Array<{ name: string; pending?: { item: string; kind: string } }> }).rows.find(row => row.name === name)?.pending;
  await send('rev-a', 'Human initial request');
  assert.deepEqual(await pending('rev-a'), { item: item.id, kind: 'review' });
  await clock.advance(1);
  await send('rev-b', 'Human replacement request');
  assert.equal(await pending('rev-a'), undefined);
  assert.deepEqual(await pending('rev-b'), { item: item.id, kind: 'review' });
});

test('trusted launch brief admission reserves carried first-turn verification work', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Carried launch review' });
  const text = `review request ${item.id}\nOwned launch brief`;
  const launch = await ui.request({ type: 'session.launch', name: 'rev-carried', role: 'reviewer', harness: 'codex', brief: text });
  assert.equal(launch.ok, true, launch.error);
  await eventually('carried brief has durable native completion', async () => {
    const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: TopicMessage[] };
    return history.messages.find(m => m.text.startsWith(text))?.stage === 'injected' || undefined;
  });
  const processes = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  assert.deepEqual(processes.processes.find(p => p.name === 'rev-carried')?.pending, { item: item.id, kind: 'review' });
});

test('trusted reuse brief admission reserves the existing verifier', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 1 })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Reused verifier review' });
  const initial = await ui.request({ type: 'session.launch', name: 'rev-reuse', role: 'reviewer', harness: 'codex' });
  assert.equal(initial.ok, true, initial.error);
  const process = (initial.value as { process: HarnessProcessView }).process;
  const verifier = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev-reuse', assignRole: false, sessionId: process.sessionId });
  await verifier.waitForEvent(e => e.params.meta?.kind === 'role');
  fakes.codex!.idle('rev-reuse');
  const text = `review request ${item.id}\nOwned reused brief`;
  const launch = await ui.request({ type: 'session.launch', name: 'new-name', role: 'reviewer', harness: 'codex', item: item.id, brief: text });
  assert.equal(launch.ok, true, launch.error);
  assert.equal((launch.value as { process: HarnessProcessView }).process.sessionId, process.sessionId);
  await eventually('reused brief has durable injection receipt', async () => {
    const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: TopicMessage[] };
    return history.messages.find(m => m.text === text)?.stage === 'injected' || undefined;
  });
  const rows = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  assert.deepEqual(rows.processes.find(p => p.sessionId === process.sessionId)?.pending, { item: item.id, kind: 'review' });
});

for (const variant of ['owned', 'ordinary hub', 'cancelled', 'wrong owner', 'denied'] as const) {
  test(`legacy NULL launch admission after Store reopen: ${variant}`, async t => {
    const { HubCore } = await import('../src/hub/core.ts');
    const { Store } = await import('../src/hub/store.ts');
    const { Tracker } = await import('../src/tracker/tracker.ts');
    const { trackerItems } = await import('../src/hub/topics.ts');
    const { beforeDirectories } = await import('./process-cleanup.ts');
    const root = await tempProject(t);
    const file = join(root, '.cland', 'hub.db');
    const clock = new FakeClock();
    let tracker = new Tracker({ root, db: file, git: async () => null, now: () => clock.now() });
    let core = new HubCore({ store: new Store(file), items: trackerItems(tracker), clock });
    let open = true;
    const close = async () => {
      if (!open) return;
      open = false;
      core.close();
      core.store.close();
      await tracker.stop();
    };
    beforeDirectories(t, close);
    const item = await tracker.create(human, { title: 'Legacy owned launch request', size: 'S' });
    const connect = () => {
      const result = core.hello({ type: 'hello', protocol: 2, name: 'rev', sessionId: 'rev-id', role: 'reviewer', cwd: root }, () => true);
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error('fixture hello refused');
      return result.connection;
    };
    connect();
    core.store.rememberSessionCredential('rev-id', variant === 'wrong owner' ? 'different-owner' : 'fixture-launch');
    const text = `review request ${item.id}\nLegacy launch input`;
    let id = 'legacy-launch-input';
    if (variant === 'ordinary hub') {
      const notice = core.noticeInTopic('agents', { kind: 'report', to: ['rev'], text });
      assert.ok(notice);
      id = notice;
    } else {
      core.recordLaunchBrief({ id, from: 'hub', fromKind: 'hub', via: 'hub', to: ['rev'], text, ts: clock.now().toISOString(), topic: 'agents' }, 'fixture-launch', true);
      if (variant === 'cancelled') core.cancelLaunchBrief('fixture-launch');
    }
    await close();
    const db = new DatabaseSync(file);
    try { db.prepare('update messages set verifier_admitted = ? where id = ?').run(variant === 'denied' ? 0 : null, id); }
    finally { db.close(); }
    tracker = new Tracker({ root, db: file, git: async () => null, now: () => clock.now() });
    core = new HubCore({ store: new Store(file), items: trackerItems(tracker), clock });
    open = true;
    const connection = connect();
    if (variant === 'ordinary hub') core.ack(connection, id);
    else core.completeCarriedBrief('fixture-launch', 'rev-id');
    assert.equal(core.topicHistory('agents').messages.find(m => m.id === id)?.stage, variant === 'cancelled' ? 'dropped' : variant === 'ordinary hub' ? 'delivered' : 'injected');
    assert.deepEqual(core.sessionPending(connection), variant === 'owned' ? { item: item.id, kind: 'review' } : undefined);
  });
}
