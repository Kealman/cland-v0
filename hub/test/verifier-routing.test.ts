import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { HarnessProcessView, Message, SendOutcome } from '../src/protocol.ts';

test('three live Reviewers receive one request, and a repeat returns to the same reviewer', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 3 })).ok, true);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  t.after(() => impl.close());
  const reviewers = [];
  for (const name of ['rev-1', 'rev-2', 'rev-3']) {
    const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', { name, role: 'reviewer', harness: 'claude-code' });
    assert.equal(launched.ok, true, launched.error);
    const rev = await spawnSpoke({ cwd: root, discover: true, name, assignRole: false, sessionId: launched.process.sessionId });
    t.after(() => rev.close());
    reviewers.push(rev);
  }
  await coord.waitForPresence(['coord', 'impl', 'rev-1', 'rev-2', 'rev-3']);
  await eventually('reviewer pool idle', async () => {
    const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    return processes.filter(p => p.role === 'reviewer' && p.state === 'idle').length === 3 || undefined;
  });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Single verifier', assignee: 'impl' });
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
  await reviewers[0]!.call('task.comment', { id: item.id, verdict: 'review', result: 'not clear', run: 'first-build' });
  const second = `review request ${item.id}\nFixed build`;
  assert.equal((await send(second)).outcomes[0]?.resolvedTo, 'rev-1');
  assert.deepEqual((await history()).find(m => m.text === second)?.to, ['rev-1']);
  const ordinary = 'Reviewer pool update';
  await send(ordinary);
  assert.deepEqual((await history()).find(m => m.text === ordinary)?.to, ['rev-1', 'rev-2', 'rev-3']);
  const { item: other } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Other review' });
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
  const { item: waiting } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Waiting review' });
  const unavailable = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['reviewer'], text: `review request ${waiting.id}\nAll holders occupied` });
  assert.equal(unavailable.outcomes[0]?.outcome, 'empty');
  assert.match(unavailable.outcomes[0]!.reason!, /no free live verifier/);
  await reviewers[1]!.call('task.hold', { id: other.id, release: true });
  assert.equal((await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['@reviewer'], text: `review request ${waiting.id}\nA holder freed` })).outcomes[0]?.resolvedTo, 'rev-2');
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
  const { item } = await coord.call<{ item: { id: string; path: string } }>('task.create', { title: 'QA affinity' });
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
