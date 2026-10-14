import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withDiscoveredPid, cland, connectUi, eventually, fakeClaude, fakeCodex, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { HarnessProcessView, Message, SendOutcome } from '../src/protocol.ts';

test('Codex relaunch injects an early accepted clause and frees the queued QA request without a nudge', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const launch = await ui.request({ type: 'session.launch', name: 'qa-d', role: 'qa', harness: 'codex' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const before = (launch.value as { process: HarnessProcessView }).process;
  await ui.waitFor(f => f.type === 'session.usage' && f.session === 'qa-d');
  await eventually('QA idle before relaunch', async () => {
    const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    return processes.find(p => p.name === 'qa-d')?.state === 'idle' || undefined;
  });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'QA after early relaunch hello' });
  await writeFile(join(fake.home, 'hold-thread-resume'), 'hold resume until the spoke accepts its clause');
  const mark = ui.frames.length;
  const resuming = ui.request({ type: 'session.resume', session: 'qa-d', relaunch: true }, 30_000);
  try {
    await ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'presence'
      && (f.sessions as Array<{ name: string }>).some(s => s.name === 'qa-d'));
    // The fake app-server's native resume barrier keeps the process row stopped
    // while the real spoke reconnects and acknowledges the role clause.
    await eventually('relaunch clause accepted before publication', async () => {
      await ui.request({ type: 'hub.status', flushLogs: true });
      const entries = (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter(line => line.startsWith('{'))
        .map(line => JSON.parse(line) as { event: string; session?: string; id?: string });
      const clause = entries.filter(e => e.event === 'role-clause' && e.session === 'qa-d').at(-1);
      return clause && entries.some(e => e.event === 'acked' && e.id === clause.id) || undefined;
    });
  } finally {
    await writeFile(join(fake.home, 'release-thread-resume'), 'publish the running process');
    await resuming;
  }
  const resumed = await resuming;
  assert.equal(resumed.ok, true, resumed.error);
  const after = (resumed.value as { process: HarnessProcessView }).process;
  assert.equal(after.sessionId, before.sessionId);
  assert.notEqual(after.pid, before.pid);
  const text = `qa request ${item.id}\nBuild after relaunch`;
  const sent = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa'], text });
  assert.ok(['queued', 'delivered'].includes(sent.outcomes[0]!.outcome));
  const log = await eventually('relaunch clause and QA request injected without another message', async () => {
    const log = await fake.log(after.pid!);
    return log.includes('you hold the role QA') && log.includes(text) ? log : undefined;
  }, 5_000);
  assert.ok(log.indexOf('you hold the role QA') < log.indexOf(text));
  const inputs = (await readFile(join(fake.home, 'log', `${after.pid}.inputs.jsonl`), 'utf8')).trim().split('\n')
    .map(line => JSON.parse(line) as { text: string });
  assert.equal(inputs.filter(input => input.text.includes('you hold the role QA')).length, 1, 'clause consumed once');
  assert.equal(inputs.filter(input => input.text.includes(text)).length, 1, 'request consumed once');
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] };
  assert.deepEqual(history.messages.find(m => m.text === text)?.to, ['qa-d']);
});

for (const relaunch of [false, true]) {
  test(`queued QA request starts an idle verifier with held progress${relaunch ? ' after relaunch' : ''}`, async t => {
    const root = await tempProject(t);
    const fake = await fakeClaude(t);
    const { discovery } = await startDaemon(t, root, fake.env);
    const ui = await connectUi(t, discovery);
    assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
    const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
    t.after(() => coord.close());
    const launch = await ui.request({ type: 'session.launch', name: 'qa-d', role: 'qa', harness: 'claude-code' }, 30_000);
    assert.equal(launch.ok, true, launch.error);
    let processRow = await withDiscoveredPid(ui, (launch.value as { process: HarnessProcessView }).process);
    await ui.waitFor(f => f.type === 'session.usage' && f.session === 'qa-d');
    const idle = () => eventually('QA verifier idle', async () => {
      const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
      return processes.find(p => p.name === 'qa-d')?.state === 'idle' || undefined;
    });
    await idle();
    const progress = 'Keep this progress for the next QA turn.';
    const sent = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa-d'], kind: 'progress', text: progress });
    assert.equal(sent.outcomes[0]?.outcome, 'queued');
    if (relaunch) {
      const mark = ui.frames.length;
      const resumed = await ui.request({ type: 'session.resume', session: 'qa-d', relaunch: true }, 30_000);
      assert.equal(resumed.ok, true, resumed.error);
      const after = await withDiscoveredPid(ui, (resumed.value as { process: HarnessProcessView }).process);
      assert.equal(after.sessionId, processRow.sessionId);
      assert.notEqual(after.pid, processRow.pid);
      processRow = after;
      await ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'session.usage' && f.session === 'qa-d');
      await idle();
    }
    const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<Message & { stage?: string }> }).messages;
    assert.equal((await history()).find(m => m.text === progress)?.stage, 'queued');
    assert.equal((await fake.log(processRow.harnessId!)).includes(progress), false);
    const { item: occupied } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Current QA hold' });
    const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Waiting QA with progress' });
    assert.equal((await ui.request({ type: 'task.hold', item: occupied.id, as: { name: 'qa-d' } })).ok, true);
    const text = `qa request ${item.id}\nCommitted QA brief`;
    const queued = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa'], text });
    assert.equal(queued.outcomes[0]?.outcome, 'queued');
    assert.equal((await ui.request({ type: 'task.hold', item: occupied.id, release: true, as: { name: 'qa-d' } })).ok, true);
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['qa-d'], 'assigned in the hold-release tick');
    await coord.waitForEvent(e => e.params.meta?.kind === 'verifier-request' && e.params.content.includes(`for ${item.id} assigned to qa-d`));
    const log = await eventually('request starts QA and drains its held progress', async () => {
      const log = await fake.log(processRow.harnessId!);
      return log.includes(text) && log.includes(progress) ? log : undefined;
    });
    assert.ok(log.indexOf(progress) < log.indexOf(text));
    await eventually('request and progress injected together', async () => {
      const messages = await history();
      return [progress, text].every(text => messages.some(m => m.text === text && m.stage === 'injected')) || undefined;
    });
    assert.deepEqual((await history()).find(m => m.text === text)?.to, ['qa-d']);
  });
}

test('a free bare Reviewer can receive its first role request after accepting its clause', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev-d', role: 'reviewer', sessionId: 'rev-id' });
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

test('three live Reviewers receive one request, and a repeat returns to the same reviewer', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 3 })).ok, true);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(() => impl.close());
  const reviewers = [];
  for (const name of ['rev-1', 'rev-2', 'rev-3']) {
    const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', { name, role: 'reviewer', harness: 'claude-code' });
    assert.equal(launched.ok, true, launched.error);
    // Idle can precede the native MCP hello. Its first completed turn proves that
    // spoke is connected before our observer joins: deliveries go to the newest.
    await ui.waitFor(f => f.type === 'session.usage' && f.session === name);
    const rev = await spawnSpoke({ cwd: root, discover: true, name, assignRole: false, sessionId: launched.process.sessionId });
    t.after(() => rev.close());
    reviewers.push(rev);
  }
  await coord.waitForPresence(['coord', 'impl', 'rev-1', 'rev-2', 'rev-3']);
  await eventually('reviewer pool idle', async () => {
    const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    return processes.filter(p => p.role === 'reviewer' && p.state === 'idle').length === 3 || undefined;
  });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Single verifier', assignee: 'impl' });
  await impl.call('task.claim', { id: item.id });
  const { topic } = await impl.call<{ topic: { id: string } }>('topic.create', { title: 'Single verifier', item: item.id });
  const send = (text: string) => impl.call<{ ok: boolean; outcomes: SendOutcome[] }>('send', { to: ['reviewer'], topic: topic.id, text });
  const first = `review request ${item.id}\nFirst build`;
  const sent = await send(first);
  assert.equal(sent.ok, true);
  assert.equal(sent.outcomes[0]?.outcome, 'delivered');
  const history = async () => ((await ui.request({ type: 'topic.history', topic: topic.id })).value as { messages: Message[] }).messages;
  assert.deepEqual((await history()).find(m => m.text === first)?.to, ['rev-1']);
  assert.equal(sent.outcomes[0]?.resolvedTo, 'rev-1');
  const beforeVerdict = `review request ${item.id}\nRepeat before hold`;
  assert.equal((await send(beforeVerdict)).outcomes[0]?.resolvedTo, 'rev-1');
  await reviewers[0]!.call('task.hold', { id: item.id });
  await reviewers[0]!.call('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'first-build' });
  const second = `review request ${item.id}\nFixed build`;
  assert.equal((await send(second)).outcomes[0]?.resolvedTo, 'rev-1');
  assert.deepEqual((await history()).find(m => m.text === second)?.to, ['rev-1']);
  const ordinary = 'Reviewer pool update';
  await send(ordinary);
  assert.deepEqual((await history()).find(m => m.text === ordinary)?.to, ['rev-1', 'rev-2', 'rev-3']);
  const { item: other } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Other review' });
  await reviewers[1]!.call('task.hold', { id: other.id });
  assert.equal((await ui.request({ type: 'session.stop', session: 'rev-1' })).ok, true);
  await eventually('fallback reviewer idle', async () => {
    const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    return processes.find(p => p.name === 'rev-3')?.state === 'idle' || undefined;
  });
  const fallback = `review request ${item.id}\nPrevious reviewer stopped`;
  assert.equal((await send(fallback)).outcomes[0]?.resolvedTo, 'rev-3');
  assert.deepEqual((await history()).find(m => m.text === fallback)?.to, ['rev-3']);
  await reviewers[2]!.call('task.hold', { id: item.id });
  const { item: waiting } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Waiting review' });
  const unavailable = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text: `review request ${waiting.id}\nAll holders occupied` });
  assert.equal(unavailable.outcomes[0]?.outcome, 'queued');
  assert.match(unavailable.outcomes[0]!.reason!, /next free live verifier/);
  await reviewers[1]!.call('task.hold', { id: other.id, release: true });
  await reviewers[1]!.waitForEvent(e => e.params.content === `review request ${waiting.id}\nAll holders occupied`);
  await coord.waitForEvent(e => e.params.meta?.kind === 'verifier-request' && e.params.content.includes(`for ${waiting.id} assigned to rev-2`));
  const waitingHistory = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] };
  assert.deepEqual(waitingHistory.messages.find(m => m.text === `review request ${waiting.id}\nAll holders occupied`)?.to, ['rev-2']);
  assert.equal(reviewers[1]!.events.filter(e => e.params.content === `review request ${waiting.id}\nAll holders occupied`).length, 1);
  assert.equal((await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['@reviewer'], text: `review request ${waiting.id}\nA holder freed` })).outcomes[0]?.resolvedTo, 'rev-2');
});

test('queued QA requests survive sender rename and hub restart, and closed items are refused explicitly', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
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
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const restarted = await startDaemon(t, root);
  const nextUi = await connectUi(t, restarted.discovery);
  assert.equal((await nextUi.request({ type: 'subscribe' })).ok, true);
  await coord.waitForPresence(['coord-renamed']);
  const qa = await spawnSpoke({ cwd: root, discover: true, name: 'qa-d', role: 'qa', sessionId: 'qa-id' });
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

test('QA affinity survives copied and reordered verdict headers, including stage requests', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'crew.set', key: 'qa.policy', value: 'pool' })).ok, true);
  assert.equal((await ui.request({ type: 'crew.set', key: 'qa.size', value: 2 })).ok, true);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const verifiers = [];
  for (const name of ['qa-1', 'qa-2']) {
    const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', { name, role: 'qa', harness: 'claude-code' });
    assert.equal(launched.ok, true, launched.error);
    const session = await spawnSpoke({ cwd: root, discover: true, name, assignRole: false, sessionId: launched.process.sessionId });
    t.after(() => session.close());
    verifiers.push(session);
  }
  await coord.waitForPresence(['coord', 'qa-1', 'qa-2']);
  await eventually('both QA holders idle before affinity probe', async () => {
    const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    return processes.filter(p => p.role === 'qa' && p.state === 'idle').length === 2 || undefined;
  });
  const { item } = await coord.call<{ item: { id: string; path: string } }>('task.create', { size: 'M', title: 'QA affinity' });
  await verifiers[0]!.call('task.comment', { id: item.id, verdict: 'qa', result: 'not clear', run: 'older-qa' });
  await verifiers[1]!.call('task.comment', { id: item.id, verdict: 'qa', result: 'not clear', run: 'previous-qa' });
  const file = join(root, item.path);
  const original = await readFile(file, 'utf8');
  const firstHeader = original.indexOf('### qa-1');
  const secondHeader = original.indexOf('### qa-2');
  assert.ok(firstHeader >= 0 && secondHeader > firstHeader);
  const older = original.slice(firstHeader, secondHeader);
  const latest = original.slice(secondHeader);
  // Simulate a human moving comments and copying an older header with a claimed later time.
  await writeFile(file, original.slice(0, firstHeader) + latest + '\n' + older + '\n'
    + older.replace(/### qa-1 · \S+/, '### qa-1 · 2099-01-01T00:00:00.000Z').replace('run: older-qa', 'run: copied-qa'));
  await eventually('copied and reordered verdict headers indexed', async () => {
    const listed = await coord.call<{ items: Array<{ id: string; verdicts: Array<{ run: string }> }> }>('task.list');
    return listed.items.find(i => i.id === item.id)?.verdicts.map(v => v.run).join(',') === 'previous-qa,older-qa,copied-qa' || undefined;
  });
  const text = `qa request ${item.id}\nCommitted brief and fixed build`;
  const result = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['@qa'], text });
  assert.equal(result.outcomes[0]?.resolvedTo, 'qa-2');
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] };
  assert.deepEqual(history.messages.find(m => m.text === text)?.to, ['qa-2']);
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Stage QA', kind: 'epic' });
  await eventually('other QA idle', async () => {
    const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    return processes.find(p => p.name === 'qa-1')?.state === 'idle' || undefined;
  });
  const stage = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa'], text: `qa request ${epic.id} stage first\nStage brief` });
  assert.equal(stage.outcomes[0]?.resolvedTo, 'qa-1');
  const repeat = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa'], text: `qa request ${epic.id} stage first\nRepeat stage brief` });
  assert.equal(repeat.outcomes[0]?.resolvedTo, 'qa-1');
});
