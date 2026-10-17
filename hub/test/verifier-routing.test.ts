// T2: real send frames prove queued assignment and recorded delivery through fake adapters.
import { FakeClock } from './fake-clock.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Message, SendOutcome } from '../src/protocol.ts';

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
