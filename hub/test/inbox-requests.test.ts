import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, connectUi, spawnSpoke, projectHub, startDaemon, tempProject, eventually, fakeClaude } from './harness.ts';
import type { Inbox } from '../src/protocol.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';

async function ok<T>(ui: Awaited<ReturnType<typeof connectUi>>, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const result = await ui.request(frame);
  assert.equal(result.ok, true, `${frame.type}: ${result.error}`);
  return result.value as T;
}

test('a request from an unmentioned Implementer raises needsYou and the human reply journals its departure', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer', sessionId: 'sess-impl' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  const sent = await impl.call<{ ok: boolean; error?: string }>('send', { kind: 'request', request: 'review', subject: 'impl', text: 'Review this session' });
  assert.equal(sent.ok, true, sent.error);
  const result = await cland(root, 'inbox', '--json');
  assert.equal(result.code, 0, result.stderr);
  const before = JSON.parse(result.stdout) as Inbox;
  assert.equal(before.needsYou, 1);
  assert.equal(before.requests[0]?.subject, 'impl');
  assert.equal(before.requests[0]?.fromRole, 'implementer');
  assert.ok(Date.parse(before.requests[0]!.since));
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Reviewed' })).ok, true);
  const after = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.equal(after.needsYou, 0);
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const journal = await cland(root, 'hub', 'journal', '--json');
  assert.equal(journal.code, 0, journal.stderr);
  assert.match(journal.stdout, /inbox-departure/);
  assert.match(journal.stdout, /replied/);
});

test('request validation names the fix and accepts each known subject and request kind from any role', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer', sessionId: 'sess-impl' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  const item = await ui.request({ size: 'M', type: 'task.create', title: 'Review subject' });
  assert.equal(item.ok, true, item.error);
  const id = (item.value as { item: { id: string } }).item.id;
  const artifact = await ui.request({ type: 'artifact.create', topic: 'general', title: 'Subject', kind: 'note', content: 'Review me' });
  assert.equal(artifact.ok, true, artifact.error);
  const aid = (artifact.value as { artifact: { id: string } }).artifact.id;
  const base = { kind: 'request', request: 'review', subject: id, text: 'Please review' };
  for (const [fields, reason] of [
    [{ to: ['impl'] }, /omit to|empty to/],
    [{ request: 'wrong' }, /review, qa or handover/],
    [{ request: null }, /review, qa or handover/],
    [{ request: ['qa'] }, /review, qa or handover/],
    [{ subject: '' }, /needs subject/],
    [{ subject: 'T-999999' }, /unknown subject.*known item/],
    [{ subject: 'A-999999' }, /unknown subject/],
    [{ subject: 'unknown-session' }, /unknown subject/],
    [{ kind: 'report' }, /require kind: request/],
  ] as const) {
    const result = await impl.call<{ ok: boolean; error?: string }>('send', { ...base, ...fields });
    assert.equal(result.ok, false, JSON.stringify(fields));
    assert.match(result.error!, reason);
  }
  const missing = await impl.call<{ ok: boolean; error?: string }>('send', { kind: 'request', request: 'qa', text: 'Missing subject' });
  assert.equal(missing.ok, false);
  assert.match(missing.error!, /needs subject/);
  for (const [request, subject] of [['review', id], ['qa', aid], ['handover', 'impl']]) {
    assert.equal((await impl.call<{ ok: boolean }>('send', { ...base, to: [], request, subject })).ok, true);
  }
  const inbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.deepEqual(inbox.requests.map(row => row.request), ['handover', 'qa', 'review']);
  assert.equal(inbox.requests.length, 3);
  assert.equal(inbox.messages.length, 0, 'requests do not repeat as messages');
  assert.equal(inbox.needsYou, 3);
});

test('message read marks and request replies survive stop/start, while an unanswered Aide request stays counted', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-aide' });
  t.after(() => aide.close());
  await aide.waitForPresence(['aide-1']);
  assert.equal((await aide.call<{ ok: boolean }>('send', { text: 'Read this' })).ok, true);
  const messages = ((await ui.request({ type: 'inbox.list' })).value as Inbox).messages;
  assert.equal(messages.length, 1);
  assert.equal((await ui.request({ type: 'topic.read', topic: 'general', upTo: messages[0]!.id })).ok, true);
  assert.equal(((await ui.request({ type: 'inbox.list' })).value as Inbox).needsYou, 0);
  assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'request', request: 'review', subject: 'aide-1', text: 'Reply to this' })).ok, true);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Reviewed' })).ok, true);
  assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'request', request: 'handover', subject: 'aide-1', text: 'Still waiting' })).ok, true);
  const before = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal(before.needsYou, 1);
  await aide.close();
  const stop = await cland(root, 'hub', 'stop');
  assert.equal(stop.code, 0, stop.stderr);
  const restarted = await startDaemon(t, root);
  const again = await connectUi(t, restarted.discovery);
  const after = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.equal(after.needsYou, 1);
  assert.deepEqual(after.requests, before.requests);
  assert.deepEqual(after.messages, []);
  await ok(again, { type: 'hub.status', flushLogs: true });
  const journal = (await cland(root, 'hub', 'journal', '--json')).stdout;
  assert.match(journal, /"reason":"read"/);
  assert.match(journal, /"reason":"replied"/);
});

test('now messages are counted per message, newest first, and leave individually on read or topic answer', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-aide' });
  t.after(() => aide.close());
  await aide.waitForPresence(['aide-1']);
  for (const text of ['First', 'Second', 'Third']) assert.equal((await aide.call<{ ok: boolean }>('send', { text })).ok, true);
  assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'progress', text: 'Progress is excluded' })).ok, true);
  const before = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.deepEqual(before.messages.map(m => m.text), ['Third', 'Second', 'First']);
  assert.ok(before.messages.every(m => m.layer === 'now' && Date.parse(m.since)));
  assert.equal(before.needsYou, 3);
  await ok(ui, { type: 'topic.read', topic: 'general', upTo: before.messages[1]!.id });
  const read = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.deepEqual(read.messages.map(m => m.text), ['Third']);
  assert.equal(read.needsYou, 1);
  await ok(ui, { type: 'topic.send', topic: 'general', text: 'Answered' });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 0);
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const journal = (await cland(root, 'hub', 'journal', '--json')).stdout.trim().split('\n').map(line => JSON.parse(line) as { event: string; reason: string });
  const departures = journal.filter(r => r.event === 'inbox-departure');
  assert.deepEqual(departures.map(r => r.reason), ['read', 'read', 'answered']);
});

test('pending valid plans count only with human approval, and approval, invalidation and closure record departures', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind: string, parent?: string) => (await ok<{ item: { id: string } }>(ui, { ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, ...(parent ? { parent } : {}) })).item.id;
  const epic = await create('Plan', 'epic');
  const task = await create('Work', 'task', epic);
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).plans.length, 0, 'an epic without a valid plan does not wait');
  const plan = { stages: [{ name: 'Build', lanes: [[task]], qa: { scope: 'none', when: 'after-stage' } }] };
  await ok(ui, { type: 'task.plan', item: epic, op: 'set', yaml: JSON.stringify(plan) });
  const pending = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.equal(pending.needsYou, 1);
  assert.equal(pending.plans[0]?.subject, epic);
  assert.ok(Date.parse(pending.plans[0]!.since));
  const approved = await cland(root, 'task', 'plan', 'approve', epic, '--json');
  assert.equal(approved.code, 0, approved.stderr);
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 0);
  // A revised plan begins a fresh wait, then removing the plan invalidates it.
  plan.stages[0]!.name = 'Revised';
  await ok(ui, { type: 'task.plan', item: epic, op: 'set', yaml: JSON.stringify(plan) });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 1);
  await ok(ui, { type: 'task.edit', item: epic, body: '## Summary\nRemoved plan' });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 0);
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const journal = (await cland(root, 'hub', 'journal', '--json')).stdout;
  assert.match(journal, /"reason":"approved"/);
  assert.match(journal, /"reason":"invalidated"/);
  await ok(ui, { type: 'task.plan', item: epic, op: 'set', yaml: JSON.stringify(plan) });
  await ok(ui, { type: 'task.close', item: task });
  await ok(ui, { type: 'task.close', item: epic, override: 'Fixture closes without after-stage QA' });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 0);
  await ok(ui, { type: 'hub.status', flushLogs: true });
  assert.match((await cland(root, 'hub', 'journal', '--json')).stdout, /"reason":"closed"/);
  const other = await tempProject(t);
  const none = await projectHub(t, other);
  const otherUi = await connectUi(t, none.discovery);
  const e = (await ok<{ item: { id: string } }>(otherUi, { type: 'task.create', title: 'No approval', kind: 'epic' })).item.id;
  const w = (await ok<{ item: { id: string } }>(otherUi, { size: 'M', type: 'task.create', title: 'Work', parent: e })).item.id;
  await ok(otherUi, { type: 'task.plan', item: e, op: 'set', yaml: JSON.stringify({ stages: [{ name: 'Build', lanes: [[w]], qa: { scope: 'none', when: 'after-stage' } }] }) });
  assert.equal((await ok<Inbox>(otherUi, { type: 'inbox.list' })).plans.length, 0);
});

test('asks and a fake harness command approval wait with ages, then journal each leave reason once', async t => {
  const root = await tempProject(t);
  // Keep pushed approval and idle states authoritative throughout the inbox assertions.
  const fake = await fakeClaude(t, { pollMs: 60_000, pushTrustMs: 120_000 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const a = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Answer?', options: [] });
  const topic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Withdraw' })).topic.id;
  const b = await coord.call<{ ok: boolean; ask: string }>('ask', { topic, question: 'Withdraw?', options: [] });
  const cancelledTopic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Cancel' })).topic.id;
  const c = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: cancelledTopic, question: 'Cancel?', options: [] });
  assert.ok(a.ok && b.ok && c.ok);
  await ok(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  await eventually('worker idle', async () => {
    const status = await ok<{ sessions: Array<{ name: string; state: string }> }>(ui, { type: 'hub.status' });
    return status.sessions.some(s => s.name === 'worker' && s.state === 'idle') || undefined;
  });
  await ok(ui, { type: 'session.signal', session: 'worker', event: 'permission', at: Date.now(), payload: { tool_name: 'Bash', approvalCommand: 'git status' } });
  const before = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.equal(before.needsYou, 4);
  assert.deepEqual(before.asks.map(row => row.id), [c.ask, b.ask, a.ask]);
  assert.ok(before.asks.every(row => Date.parse(row.ts)));
  assert.equal(before.approvals[0]?.command, 'git status');
  assert.ok(Date.parse(before.approvals[0]!.since));
  await ok(ui, { type: 'topic.answer', ask: a.ask, text: 'Yes' });
  await ok(ui, { type: 'topic.resolve', topic });
  await ok(ui, { type: 'topic.close', topic: cancelledTopic });
  await ok(ui, { type: 'session.signal', session: 'worker', event: 'tool-done', at: Date.now(), payload: {} });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 0);
  // A repeated snapshot must not write a second departure.
  const archive = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.equal(archive.archive?.find(r => r.kind === 'approval')?.text, 'git status', 'the archive retains the command after approval metadata is cleared');
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const records = (await cland(root, 'hub', 'journal', '--json')).stdout.trim().split('\n').map(line => JSON.parse(line) as { event: string; reason: string });
  assert.deepEqual(records.filter(r => r.event === 'inbox-departure').map(r => r.reason), ['answered', 'withdrawn', 'cancelled', 'approved']);
});

test('only a human review or QA verdict replies to requests on its subject item', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-aide' });
  const reviewer = await spawnSpoke({ discover: true, cwd: root, name: 'rev-1', role: 'reviewer', sessionId: 'sess-reviewer' });
  t.after(() => aide.close());
  t.after(() => reviewer.close());
  await aide.waitForPresence(['aide-1', 'rev-1']);
  const id = (await ok<{ item: { id: string } }>(ui, { size: 'M', type: 'task.create', title: 'Review this' })).item.id;
  assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'request', request: 'review', subject: id, text: 'Review' })).ok, true);
  const agentVerdict = await reviewer.call<{ ok: boolean; error?: string }>('task.comment', { id, text: 'Agent review', verdict: 'review', scope: 'full', result: 'clear', run: 'agent-review' });
  assert.equal(agentVerdict.ok, true, agentVerdict.error);
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).requests.length, 1);
  await ok(ui, { type: 'task.comment', item: id, text: 'Human review', verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'human-review' } });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).requests.length, 0);
  assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'request', request: 'qa', subject: id, text: 'QA' })).ok, true);
  await ok(ui, { type: 'task.comment', item: id, text: 'Human QA', verdict: { verdict: 'qa', result: 'clear', run: 'human-qa' } });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).requests.length, 0);
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const records = (await cland(root, 'hub', 'journal', '--json')).stdout.trim().split('\n').map(line => JSON.parse(line) as { event: string; kind: string; subject: string; reason: string });
  assert.equal(records.filter(r => r.event === 'inbox-departure' && r.kind === 'request' && r.subject === id && r.reason === 'replied').length, 2);
});

test('reading leaves requests waiting, an explicit reply settles one across topics, and request text is never parsed', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-aide' });
  t.after(() => aide.close());
  await aide.waitForPresence(['aide-1']);
  const topic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Reply elsewhere' })).topic.id;
  for (const text of ['review request T-999999\nExplicit subject wins', 'Another request']) {
    assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'request', request: 'review', subject: 'aide-1', text })).ok, true);
  }
  const before = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.equal(before.needsYou, 2);
  const mark = ui.frames.length;
  await ok(ui, { type: 'topic.read', topic: 'general' });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 2);
  await ok(ui, { type: 'topic.send', topic, replyTo: before.requests[0]!.id, text: 'This one reviewed' });
  const pushed = await ui.waitFor(frame => frame.type === 'inbox' && ui.frames.indexOf(frame) >= mark && (frame.inbox as Inbox).needsYou === 1);
  assert.deepEqual((pushed.inbox as Inbox).requests.map(row => row.id), [before.requests[1]!.id]);
  await ok(ui, { type: 'topic.send', topic: 'general', text: 'The other reviewed too' });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 0);
});

test('progress and hub notices preserve a waiting topic report until it is read', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const fixture = new Store(join(root, '.cland/hub.db'));
  fixture.createTopic('waiting', 'Waiting report', null, new Date().toISOString());
  fixture.setTopicStatus('waiting', 'waiting for human');
  fixture.record({ id: 'waiting-report', topic: 'waiting', from: 'coord', fromRole: 'coordinator', fromKind: 'agent', via: 'session', to: ['rev-legacy'], text: 'Needs your response', kind: 'report', ts: new Date().toISOString() }, [], Date.now());
  fixture.close();
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const epic = (await ok<{ item: { id: string } }>(ui, { type: 'task.create', title: 'Report subject', kind: 'epic', topic: 'waiting' })).item.id;
  const topic = 'waiting';
  const before = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.equal(before.messages.length, 1);
  assert.equal(before.needsYou, 1);
  const mark = ui.frames.length;
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic, kind: 'progress', text: 'Still progressing' })).ok, true);
  const progress = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.deepEqual(progress.messages, before.messages);
  assert.equal(progress.needsYou, 1);
  await ok(ui, { type: 'task.comment', item: epic, text: 'Review notice', verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'notice-review' } });
  const history = await ok<{ messages: Array<{ fromKind: string; kind?: string }> }>(ui, { type: 'topic.history', topic });
  assert.ok(history.messages.some(m => m.fromKind === 'hub'), 'a real hub notice was appended to the waiting topic');
  const afterNotice = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.deepEqual(afterNotice.messages, before.messages);
  assert.equal(afterNotice.needsYou, 1);
  const latestPush = ui.frames.slice(mark).filter(frame => frame.type === 'inbox').at(-1);
  if (latestPush) assert.equal((latestPush.inbox as Inbox).needsYou, 1);
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const beforeRead = (await cland(root, 'hub', 'journal', '--json')).stdout;
  assert.doesNotMatch(beforeRead, /"event":"inbox-departure"/);
  await ok(ui, { type: 'topic.read', topic });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 0);
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const records = (await cland(root, 'hub', 'journal', '--json')).stdout.trim().split('\n').map(line => JSON.parse(line) as { event: string; id: string; reason: string });
  assert.deepEqual(records.filter(record => record.event === 'inbox-departure').map(record => [record.id, record.reason]), [[before.messages[0]!.id, 'read']]);
});

test('cland inbox prints all four sections, all rows with ages, plan size and first lines, with the hub count last', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  // Keep pushed approval and idle states authoritative throughout the inbox assertions.
  const fake = await fakeClaude(t, { pollMs: 60_000, pushTrustMs: 120_000 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-aide' });
  t.after(() => coord.close()); t.after(() => aide.close());
  await coord.waitForPresence(['coord', 'aide-1']);
  const epic = (await ok<{ item: { id: string } }>(ui, { type: 'task.create', kind: 'epic', title: 'Inbox plan' })).item.id;
  const item = (await ok<{ item: { id: string } }>(ui, { size: 'M', type: 'task.create', title: 'Planned work', parent: epic })).item.id;
  await ok(ui, { type: 'task.plan', item: epic, op: 'set', yaml: JSON.stringify({ stages: [{ name: 'Build', lanes: [[item]], qa: { scope: 'none', when: 'after-stage' } }] }) });
  await ok(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  await eventually('worker idle', async () => {
    const status = await ok<{ sessions: Array<{ name: string; state: string }> }>(ui, { type: 'hub.status' });
    return status.sessions.some(s => s.name === 'worker' && s.state === 'idle') || undefined;
  });
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which path?\nFull question', options: ['Continue'] });
  assert.equal(asked.ok, true);
  assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'request', request: 'qa', subject: item, text: 'Check the build\nRequest body' })).ok, true);
  for (let i = 0; i < 7; i++) assert.equal((await aide.call<{ ok: boolean }>('send', { text: `Message ${i}\nMessage body` })).ok, true);
  const commandTopic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Command approval' })).topic.id;
  await ok(ui, { type: 'topic.send', topic: commandTopic, text: '@worker needs approval' });
  await eventually('fake harness holds a real command approval', async () => {
    const inbox = await ok<Inbox>(ui, { type: 'inbox.list' });
    return inbox.approvals.some(a => a.session === 'worker') || undefined;
  });
  const frame = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.deepEqual([frame.plans[0]?.stages, frame.plans[0]?.lanes, frame.plans[0]?.items], [1, 1, 1]);
  assert.equal(frame.asks[0]?.fromRole, 'coordinator');
  assert.equal(frame.approvals[0]?.command, 'touch approved');
  const cli = await cland(root, 'inbox');
  assert.equal(cli.code, 0, cli.stderr);
  const lines = cli.stdout.trim().split('\n');
  const titles = ['Asks and approvals (2)', 'Plan approvals (1)', 'Requests to you (1)', 'Messages to you (7)'];
  const positions = titles.map(title => lines.indexOf(title));
  assert.ok(positions.every(n => n >= 0), cli.stdout);
  assert.deepEqual([...positions].sort((a,b) => a-b), positions);
  assert.ok(lines[1]?.startsWith('approval '), 'new command approval precedes the older ask');
  assert.ok(lines[2]?.startsWith(`ask ${asked.ask}`));
  assert.match(cli.stdout, /1 stages · 1 lanes · 1 items/);
  assert.match(cli.stdout, /Check the build  from aide-1 \[aide\]  · 0 m/);
  assert.doesNotMatch(cli.stdout, /Full question|Full command|Request body|Message body|more/);
  const messages = lines.filter(line => line.startsWith('message '));
  assert.equal(messages.length, 7);
  assert.deepEqual(messages.map(line => line.match(/Message (\d)/)?.[1]), ['6', '5', '4', '3', '2', '1', '0']);
  assert.ok(lines.filter(line => /^(ask|approval|plan|qa|message) /.test(line)).every(line => / · \d+ m$/.test(line)));
  assert.doesNotMatch(cli.stdout, /notification:/);
  assert.equal('notifications' in frame, false);
  assert.equal(lines.at(-1), `needs you: ${frame.needsYou}`);
  assert.equal(frame.needsYou, 11);
});
