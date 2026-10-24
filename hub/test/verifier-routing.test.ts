// T2: real send frames prove queued assignment and recorded delivery through fake adapters.
import { fakeHarness } from './fakes/harness.ts';
import { FakeClock } from './fake-clock.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Message, SendOutcome } from '../src/protocol.ts';
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
    assert.deepEqual(await pending(), [0, 1].map(() => ({ item: previous.id, kind })));
    for (const item of [next, later]) {
      const result = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: [role], text: `${kind} request ${item.id}\nWaiting build` });
      assert.equal(result.outcomes[0]?.outcome, 'queued');
    }
    assert.equal((await coord.call<{ ok: boolean }>('task.close', { id: previous.id })).ok, true);
    const messages = ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages;
    assert.deepEqual(messages.find(m => m.text.startsWith(`${kind} request ${next.id}\n`))?.to, ['verify-a']);
    assert.deepEqual(messages.find(m => m.text.startsWith(`${kind} request ${later.id}\n`))?.to, ['verify-b']);
    await verifiers[0]!.verifier.waitForEvent(e => e.params.content.startsWith(`${kind} request ${next.id}\n`));
    await verifiers[1]!.verifier.waitForEvent(e => e.params.content.startsWith(`${kind} request ${later.id}\n`));
    assert.deepEqual(await pending(), [{ item: next.id, kind }, { item: later.id, kind }]);
    for (const item of [next, later]) assert.equal((await coord.call<{ ok: boolean }>('task.close', { id: item.id })).ok, true);
    assert.deepEqual(await pending(), [undefined, undefined], 'who never shows a closed item as pending');
    const lateText = `${text}\nLate delivery after closure`;
    await coord.call('send', { to: ['verify-a'], text: lateText });
    await verifiers[0]!.verifier.waitForEvent(e => e.params.content === lateText);
    assert.deepEqual(await pending(), [undefined, undefined], 'late delivery of a closed-item request cannot recreate pending work');
  });
}

for (const queued of [false, true]) {
  test(`legacy closed-item pending after restart ${queued ? 'cannot block the oldest queued review' : 'is absent from who and session rows'}`, async t => {
    const root = await tempProject(t);
    const served = await projectHub(t, root, {}, { clock: new FakeClock() });
    const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    const create = async (title: string) => (await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title })).item;
    const previous = await create('Already landed before upgrade');
    const next = await create('Oldest queued review');
    const later = await create('Later queued review');
    assert.equal((await coord.call<{ ok: boolean }>('task.close', { id: previous.id })).ok, true);
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
