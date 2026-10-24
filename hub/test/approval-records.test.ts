// T2: approval records through the public frame seam, using the sealed in-process adapter.
import { sessionUi as connectUi } from './session-credential-fixture.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { cland, frameClient, inProcessSpoke, projectHub, tempProject, type FrameClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import type { ApprovalOutcome, Inbox } from '../src/protocol.ts';

async function ok<T>(ui: FrameClient, frame: Record<string, unknown> & { type: string }): Promise<T> {
  const result = await ui.request(frame);
  assert.equal(result.ok, true, result.error);
  return result.value as T;
}
async function snapshot(t: TestContext, discovery: { socket: string; secret: string }): Promise<Inbox> {
  const socket = createConnection(discovery.socket);
  onCleanup(t, () => socket.destroy());
  await once(socket, 'connect', { signal: AbortSignal.timeout(2000) });
  socket.setEncoding('utf8');
  const ui = frameClient(line => socket.write(line), fn => socket.on('data', fn), () => socket.destroy());
  const end = ui.waitFor(f => f.type === 'snapshot.end');
  ui.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'ui', features: ['snapshot', 'numbered-deltas'] });
  await end;
  return ui.frames.find(f => f.type === 'snapshot' && f.domain === 'inbox')!.value as Inbox;
}

test('Claude Code waiting episode is one stable TUI approval record in the snapshot', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  const { process } = await ok<{ process: { sessionId: string } }>(ui, { type: 'session.launch', name: 'worker', harness: 'claude-code', role: 'implementer' });
  const command = 'printf "first line\\nsecond line" && git diff -- README.md';
  await ok(ui, { type: 'session.signal', session: 'worker', event: 'permission', at: clock.now().getTime(), payload: { tool_name: 'Bash', approvalCommand: command, privateInput: 'never publish me' } });
  const before = await snapshot(t, discovery);
  assert.equal(before.approvals.length, 1);
  const row = before.approvals[0]!;
  assert.equal(row.session, 'worker');
  assert.equal(row.sessionId, process.sessionId);
  assert.equal(row.harness, 'claude-code');
  assert.equal(row.command, command);
  assert.deepEqual(row.subject, { command });
  assert.equal(row.answerIn, 'tui');
  assert.deepEqual(row.choices, []);
  assert.equal(row.state, 'pending');
  assert.ok(row.attach);
  assert.equal(before.needsYou, 1);
  await clock.advance(1000);
  assert.deepEqual((await ok<Inbox>(ui, { type: 'inbox.list' })).approvals, before.approvals);
  assert.equal(JSON.stringify(before).includes('never publish me'), false);
});

test('adapter requests publish one approval delta and inbox row, then archive the harness outcome', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes, stop } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  const command = 'git status\nprintf done';
  const delta = ui.waitFor(f => f.type === 'approval');
  fakes.codex!.raiseApproval('worker', { id: 'native-7', kind: 'command', subject: { command, cwd: root, reason: 'Read worktree', privateInput: 'secret subject' }, choices: ['once', 'always', 'deny'], topic: 'general', privateInput: 'secret tool input' });
  const raised = (await delta).approval as Inbox['approvals'][number];
  assert.equal(raised.state, 'pending');
  assert.equal(raised.answerIn, 'hub');
  assert.deepEqual(raised.choices, ['once', 'always', 'deny']);
  assert.equal(raised.topic, 'general');
  assert.deepEqual(raised.subject, { command, cwd: root, reason: 'Read worktree' });
  assert.equal(raised.command, command);
  const inboxDelta = ui.waitFor(f => f.type === 'inbox' && (f.inbox as Inbox).approvals.some(a => a.id === raised.id));
  await clock.advance(250);
  const listed = (await inboxDelta).inbox as Inbox;
  assert.deepEqual(listed.approvals, [raised]);
  assert.equal(listed.needsYou, 1);
  assert.equal(ui.frames.filter(f => f.type === 'approval').length, 1);
  const closedDelta = ui.waitFor(f => f.type === 'approval' && (f.approval as typeof raised).state === 'closed');
  const outcome = { choice: 'deny' as const, note: 'Keep the tree', by: 'human', via: 'harness' as const, at: clock.now().toISOString() };
  fakes.codex!.closeApproval('worker', 'native-7', outcome);
  const closed = (await closedDelta).approval as typeof raised;
  assert.equal(closed.id, raised.id);
  assert.equal(closed.state, 'closed');
  assert.deepEqual(closed.outcome, outcome);
  const after = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.equal(after.needsYou, 0);
  assert.deepEqual(after.approvals, []);
  assert.equal(after.archive?.length, 1);
  assert.deepEqual(after.archive?.[0]?.outcome, outcome);
  assert.equal(after.archive?.[0]?.id, raised.id);
  assert.equal(JSON.stringify(ui.frames).includes('secret subject'), false);
  assert.equal(JSON.stringify(ui.frames).includes('secret tool input'), false);
  await stop();
  const restarted = await projectHub(t, root, {}, { clock }), again = await connectUi(t, restarted.discovery);
  assert.deepEqual((await ok<Inbox>(again, { type: 'inbox.list', archive: true })).archive, after.archive);
});

test('two pending requests of one session count once each, and native ids are scoped to the session', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  for (const name of ['one', 'two']) await ok(ui, { type: 'session.launch', name, harness: 'opencode', role: 'implementer' });
  const request = { id: '7', kind: 'command' as const, subject: { command: 'echo one' }, choices: ['once', 'deny'] as Array<'once' | 'deny'> };
  fakes.opencode!.raiseApproval('one', request);
  fakes.opencode!.raiseApproval('one', request); // Native replay adds no duplicate.
  fakes.opencode!.raiseApproval('one', { ...request, id: '8', kind: 'file change', subject: { files: ['a.txt'], change: '+hello\n-world' } });
  fakes.opencode!.waitingForApproval('one'); // The derived state must not add a third row.
  const before = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.equal(before.approvals.length, 2);
  assert.equal(before.needsYou, 2);
  assert.deepEqual(before.approvals.find(r => r.kind === 'file change')?.subject, { files: ['a.txt'], change: '+hello\n-world' });
  fakes.opencode!.raiseApproval('two', request);
  const both = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.equal(both.needsYou, 3);
  assert.equal(new Set(both.approvals.map(r => r.id)).size, 3);
  assert.equal((await ok<{ needsYou: number }>(ui, { type: 'hub.status' })).needsYou, 3);
  const outcome = { choice: 'once' as const, by: 'human', via: 'harness' as const, at: clock.now().toISOString() };
  fakes.opencode!.closeApproval('one', '7', outcome);
  const after = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.equal(after.needsYou, 2);
  assert.deepEqual(after.approvals.map(r => [r.session, r.kind]).sort(), [['one', 'file change'], ['two', 'command']]);
  assert.equal(after.archive?.length, 1);
  fakes.opencode!.closeApproval('one', '7', { ...outcome, choice: 'deny' });
  assert.deepEqual((await ok<Inbox>(ui, { type: 'inbox.list', archive: true })).archive, after.archive);
});

test('TUI waiting episodes close without claiming consent and a later wait gets its own record', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'claude-code', role: 'implementer' });
  const pending = ui.waitFor(f => f.type === 'approval');
  fakes['claude-code']!.waitingForApproval('worker');
  const first = (await pending).approval as Inbox['approvals'][number];
  const closed = ui.waitFor(f => f.type === 'approval' && (f.approval as typeof first).state === 'closed');
  fakes['claude-code']!.idle('worker');
  assert.equal(((await closed).approval as typeof first).outcome?.choice, 'answered in the harness');
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list', archive: true })).archive?.[0]?.outcome?.by, 'harness');
  fakes['claude-code']!.waitingForApproval('worker');
  const second = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.equal(second.approvals.length, 1);
  assert.notEqual(second.approvals[0]?.id, first.id);
  assert.equal(second.needsYou, 1);
});

test('public approval subjects cap UTF-8 at 64 KiB, preserve small changes and exclude private tool input', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  const subject = { command: 'echo 🚀'.repeat(14000), cwd: root, reason: 'Long approval', files: ['one.ts', 'two.ts'], change: '+new\n-old', privateInput: 'PRIVATE-NATIVE-BODY' };
  fakes.codex!.raiseApproval('worker', { id: 'huge', kind: 'command', subject, choices: ['once'], privateInput: 'PRIVATE-TOOL-BODY' });
  const inbox = await snapshot(t, discovery), row = inbox.approvals[0]!;
  assert.ok(Buffer.byteLength(JSON.stringify(row.subject)) <= 65536);
  assert.equal(row.command, row.subject.command);
  assert.ok(row.command && subject.command.startsWith(row.command));
  assert.doesNotMatch(row.command!, /[\uD800-\uDBFF]$/);
  assert.equal(JSON.stringify(inbox).includes('PRIVATE-'), false);
  fakes.codex!.raiseApproval('worker', { id: 'small', kind: 'file change', subject: { cwd: root, files: ['one.ts', 'two.ts'], change: '+new\n-old', reason: 'Review patch', input: 'PRIVATE-FILE-BODY' }, choices: ['once', 'deny'] });
  const small = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals.find(a => a.kind === 'file change')!;
  assert.deepEqual(small.subject, { cwd: root, files: ['one.ts', 'two.ts'], change: '+new\n-old', reason: 'Review patch' });
  assert.equal(JSON.stringify(small).includes('PRIVATE-'), false);
});

test('inbox CLI prints approval states, choices, TUI routing and archived outcome attribution', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'session.launch', name: 'claude', harness: 'claude-code', role: 'implementer' });
  await ok(ui, { type: 'session.launch', name: 'codex', harness: 'codex', role: 'implementer' });
  fakes['claude-code']!.waitingForApproval('claude');
  fakes.codex!.raiseApproval('codex', { id: 'cmd', kind: 'command', subject: { command: 'echo review' }, choices: ['once', 'always', 'deny'] });
  const current = await cland(root, 'inbox');
  assert.equal(current.code, 0, current.stderr);
  assert.match(current.stdout, /claude.*pending.*answer in Neovim/);
  assert.match(current.stdout, /codex.*echo review.*pending.*once.*always.*deny/);
  const at = clock.now().toISOString();
  fakes.codex!.closeApproval('codex', 'cmd', { choice: 'deny', by: 'human', via: 'harness', at, note: 'Keep it local' });
  const archive = await cland(root, 'inbox', '--archive');
  assert.equal(archive.code, 0, archive.stderr);
  assert.match(archive.stdout, /approval.*codex.*closed.*deny.*human.*Keep it local/);
  assert.ok(archive.stdout.includes(at));
});


test('a native approval keeps its identity and attachment while the owning session is renamed', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  const { process } = await ok<{ process: { sessionId: string } }>(ui, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'coordinator' });
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'worker', sessionId: process.sessionId, role: 'coordinator' });
  await spoke.waitForPresence(['worker']);
  fakes.codex!.raiseApproval('worker', { id: 'cmd', kind: 'command', subject: { command: 'echo review' }, choices: ['once'] });
  const before = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  assert.equal((await spoke.call<{ ok: boolean }>('rename', { name: 'renamed' })).ok, true);
  const after = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  assert.equal(after.session, 'renamed');
  assert.equal(after.label, 'renamed [Coordinator]');
  assert.equal(after.id, before.id);
  assert.equal(after.attach, before.attach);
});

test('a human answer reaches the adapter once and both clients observe the attributed closed record', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const first = await connectUi(t, discovery), second = await connectUi(t, discovery);
  for (const ui of [first, second]) await ok(ui, { type: 'subscribe' });
  const { process } = await ok<{ process: { sessionId: string } }>(first, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  fakes.codex!.raiseApproval('worker', { id: 'native:7', kind: 'command', subject: { command: 'echo safe' }, choices: ['once', 'deny'] });
  const record = (await ok<Inbox>(first, { type: 'inbox.list' })).approvals[0]!;
  const closed = [first, second].map(ui => ui.waitFor(f => f.type === 'approval' && (f.approval as typeof record).state === 'closed'));
  const at = clock.now().toISOString();
  await ok(first, { type: 'approval.answer', approval: record.id, choice: 'once' });
  for (const receipt of await Promise.all(closed)) {
    assert.equal((receipt.approval as typeof record).id, record.id);
    assert.deepEqual((receipt.approval as typeof record).outcome, { choice: 'once', by: 'human', via: 'neovim', at });
  }
  assert.deepEqual(fakes.codex!.approvalAnswers, [{ sessionId: process.sessionId, requestId: 'native:7', choice: 'once' }]);
  assert.deepEqual((await ok<Inbox>(second, { type: 'inbox.list' })).approvals, []);
});

test('two clients in one tick reserve one winner before adapter confirmation and refuse the loser with attribution', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const first = await connectUi(t, discovery), second = await connectUi(t, discovery);
  await ok(first, { type: 'subscribe' });
  await ok(first, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  fakes.codex!.raiseApproval('worker', { id: 'race', kind: 'command', subject: { command: 'echo safe' }, choices: ['once', 'always', 'deny'] });
  const record = (await ok<Inbox>(first, { type: 'inbox.list' })).approvals[0]!;
  fakes.codex!.scriptApproval('hold');
  const answering = first.waitFor(f => f.type === 'approval' && (f.approval as typeof record).state === 'answering');
  const answers = [first.request({ type: 'approval.answer', approval: record.id, choice: 'once' }), second.request({ type: 'approval.answer', approval: record.id, choice: 'deny' })];
  const reserved = (await answering).approval as typeof record;
  assert.ok(reserved.outcome?.choice === 'once' || reserved.outcome?.choice === 'deny');
  assert.equal(reserved.outcome.by, 'human');
  assert.equal(reserved.outcome.via, 'neovim');
  assert.equal(reserved.outcome.at, clock.now().toISOString());
  const winner = reserved.outcome.choice === 'once' ? 0 : 1;
  const loser = await answers[1 - winner]!;
  assert.equal(loser.ok, false);
  assert.match(loser.error!, /human.*neovim/);
  assert.ok(loser.error!.includes(reserved.outcome!.at));
  assert.equal(fakes.codex!.approvalAnswers.length, 1);
  fakes.codex!.settleApproval('worker', 'race');
  assert.equal((await answers[winner]!).ok, true);
  const after = await ok<Inbox>(second, { type: 'inbox.list', archive: true });
  assert.equal(after.archive?.length, 1);
  assert.deepEqual(after.archive?.[0]?.outcome, reserved.outcome);
  const late = await second.request({ type: 'approval.answer', approval: record.id, choice: 'always' });
  assert.equal(late.ok, false);
  assert.match(late.error!, /human.*neovim/);
  assert.ok(late.error!.includes(reserved.outcome!.at));
  assert.equal(fakes.codex!.approvalAnswers.length, 1);
});

test('unoffered choices and TUI-only approvals refuse answers without changing their records', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  await ok(ui, { type: 'session.launch', name: 'claude', harness: 'claude-code', role: 'implementer' });
  fakes.codex!.raiseApproval('worker', { id: 'limited', kind: 'command', subject: { command: 'echo safe' }, choices: ['once', 'deny'] });
  fakes['claude-code']!.waitingForApproval('claude');
  const before = await ok<Inbox>(ui, { type: 'inbox.list' });
  const limited = before.approvals.find(a => a.session === 'worker')!, tui = before.approvals.find(a => a.session === 'claude')!;
  for (const [approval, choice, reason] of [[limited.id, 'always', /not offered/], [tui.id, 'once', /answer in Neovim/]] as const) {
    const result = await ui.request({ type: 'approval.answer', approval, choice });
    assert.equal(result.ok, false);
    assert.match(result.error!, reason);
    assert.deepEqual((await ok<Inbox>(ui, { type: 'inbox.list' })).approvals, before.approvals);
  }
  assert.deepEqual(fakes.codex!.approvalAnswers, []);
  assert.deepEqual(fakes['claude-code']!.approvalAnswers, []);
});

test('only the human may answer: every agent role including Aides is refused on socket and spoke', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  const { process } = await ok<{ process: { sessionId: string } }>(ui, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  fakes.codex!.raiseApproval('worker', { id: 'human', kind: 'command', subject: { command: 'echo safe' }, choices: ['once', 'deny'] });
  const before = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals;
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'worker', sessionId: process.sessionId, role: 'implementer' });
  await spoke.waitForPresence(['worker']);
  const agentAnswer = await spoke.call<{ ok: boolean }>('approval.answer', { approval: before[0]!.id, choice: 'once' });
  assert.equal(agentAnswer.ok, false);
  const { item } = await ok<{ item: { id: string } }>(ui, { type: 'task.create', title: 'Fixture epic', kind: 'epic' });
  for (const role of ['coordinator', 'lead', 'reviewer', 'qa', 'aide', null]) {
    await ok(ui, { type: 'session.launch', name: `agent-${role ?? 'no-role'}`, harness: 'opencode', ...(role ? { role } : {}), ...(role === 'lead' ? { item: item.id } : {}) });
  }
  const sessions = await ok<{ processes: Array<{ name: string; sessionId: string }> }>(ui, { type: 'session.list' });
  for (const session of sessions.processes) {
    const result = await ui.request({ type: 'approval.answer', approval: before[0]!.id, choice: 'once', as: { name: session.name, sessionId: session.sessionId, shell: true } });
    assert.equal(result.ok, false, session.name);
    assert.match(result.error!, /human|permission|forbidden/i);
  }
  assert.deepEqual((await ok<Inbox>(ui, { type: 'inbox.list' })).approvals, before);
  assert.deepEqual(fakes.codex!.approvalAnswers, []);
});

test('failed adapter delivery returns to pending, refuses with the reason and journals a warning before a human retry', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  fakes.codex!.raiseApproval('worker', { id: 'retry', kind: 'command', subject: { command: 'echo safe' }, choices: ['once', 'deny'] });
  const before = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  fakes.codex!.scriptApproval('fail');
  const warning = ui.waitFor(f => f.type === 'event' && String((f.row as { text: string }).text).includes('fake approval delivery failed'));
  const result = await ui.request({ type: 'approval.answer', approval: before.id, choice: 'deny', note: 'Keep it local' });
  assert.equal(result.ok, false);
  assert.match(result.error!, /fake approval delivery failed/);
  assert.deepEqual((await ok<Inbox>(ui, { type: 'inbox.list' })).approvals, [before]);
  const row = (await warning).row as { id: string; warning: boolean; text: string };
  assert.equal(row.warning, true);
  const events = await ok<{ rows: Array<{ id: string; warning?: boolean }> }>(ui, { type: 'events.list' });
  assert.ok(events.rows.some(event => event.id === row.id && event.warning));
  await ok(ui, { type: 'approval.answer', approval: before.id, choice: 'deny' });
  assert.deepEqual(fakes.codex!.approvalAnswers.map(a => a.choice), ['deny', 'deny']);
  const after = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.equal(after.archive?.length, 1);
  assert.equal((after.archive?.[0]?.outcome as ApprovalOutcome)?.choice, 'deny');
});

test('deny remains deny and a note the native protocol cannot carry is a human message to the session in General', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'opencode', role: 'implementer' });
  fakes.opencode!.approvalNotes = false;
  fakes.opencode!.raiseApproval('worker', { id: 'deny', kind: 'command', subject: { command: 'rm important' }, choices: ['once', 'deny'] });
  const record = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  await ok(ui, { type: 'approval.answer', approval: record.id, choice: 'deny', note: 'Keep this file' });
  assert.deepEqual(fakes.opencode!.approvalAnswers.map(a => [a.choice, a.note]), [['deny', 'Keep this file']]);
  const history = await ok<{ messages: Array<{ from: string; fromKind: string; to: string[]; text: string }> }>(ui, { type: 'topic.history', topic: 'general' });
  const notes = history.messages.filter(m => m.text === 'Keep this file');
  assert.equal(notes.length, 1);
  assert.deepEqual({ from: notes[0]!.from, fromKind: notes[0]!.fromKind, to: notes[0]!.to }, { from: 'human', fromKind: 'human', to: ['worker'] });
  assert.equal(((await ok<Inbox>(ui, { type: 'inbox.list', archive: true })).archive?.[0]?.outcome as ApprovalOutcome)?.choice, 'deny');
});

test('a pending request has no default answer after 24 hours of fake time', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  fakes.codex!.raiseApproval('worker', { id: 'wait', kind: 'command', subject: { command: 'echo safe' }, choices: ['once', 'deny'] });
  const before = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals;
  // Wake after a suspended day: overdue one-shot timers and interval checks still run.
  clock.block(24 * 60 * 60 * 1000);
  await clock.advance(0);
  assert.deepEqual((await ok<Inbox>(ui, { type: 'inbox.list' })).approvals, before);
  assert.deepEqual(fakes.codex!.approvalAnswers, []);
});

test('a deny note follows the session claim to its item topic and native note support avoids a duplicate message', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  const { item } = await ok<{ item: { id: string } }>(ui, { type: 'task.create', title: 'Approval fixture', size: 'S', assignee: 'worker' });
  const { topic } = await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Approval item', item: item.id });
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'opencode', role: 'implementer' });
  await ok(ui, { type: 'task.claim', item: item.id, as: { name: 'worker' } });
  fakes.opencode!.approvalNotes = false;
  const request = { id: 'without-note', kind: 'command' as const, subject: { command: 'rm important' }, choices: ['once', 'deny'] as Array<'once' | 'deny'> };
  fakes.opencode!.raiseApproval('worker', request);
  const record = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  await ok(ui, { type: 'approval.answer', approval: record.id, choice: 'deny', note: 'Keep the item file' });
  const history = await ok<{ messages: Array<{ text: string; fromKind: string; to: string[] }> }>(ui, { type: 'topic.history', topic: topic.id });
  assert.ok(history.messages.some(m => m.text === 'Keep the item file' && m.fromKind === 'human' && m.to[0] === 'worker'));
  const general = await ok<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: 'general' });
  assert.equal(general.messages.some(m => m.text === 'Keep the item file'), false);
  fakes.opencode!.approvalNotes = true;
  fakes.opencode!.raiseApproval('worker', { ...request, id: 'with-note' });
  const next = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  await ok(ui, { type: 'approval.answer', approval: next.id, choice: 'deny', note: 'Native note' });
  const after = await ok<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: topic.id });
  assert.equal(after.messages.some(m => m.text === 'Native note'), false);
  assert.deepEqual(fakes.opencode!.approvalAnswers.map(a => [a.choice, a.note]), [['deny', 'Keep the item file'], ['deny', 'Native note']]);
});

test('adapter close confirmation during delivery preserves the reserved human outcome and publishes one close', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  fakes.codex!.raiseApproval('worker', { id: 'callback', kind: 'command', subject: { command: 'echo safe' }, choices: ['once', 'deny'] });
  const record = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  fakes.codex!.scriptApproval('hold');
  const answering = ui.waitFor(f => f.type === 'approval' && (f.approval as typeof record).state === 'answering');
  const answer = ui.request({ type: 'approval.answer', approval: record.id, choice: 'deny', note: 'Keep it' });
  const winner = ((await answering).approval as typeof record).outcome!;
  const closed = ui.waitFor(f => f.type === 'approval' && (f.approval as typeof record).state === 'closed');
  fakes.codex!.closeApproval('worker', 'callback', winner);
  assert.deepEqual(((await closed).approval as typeof record).outcome, winner);
  fakes.codex!.settleApproval('worker', 'callback');
  const result = await answer;
  assert.equal(result.ok, true, result.error);
  await ok(ui, { type: 'inbox.list' });
  assert.equal(ui.frames.filter(f => f.type === 'approval' && (f.approval as typeof record).state === 'closed').length, 1);
  const after = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.equal(after.archive?.length, 1);
  assert.deepEqual(after.archive?.[0]?.outcome, winner);
});

test('current native authorization survives a failed answer that was reserved before replay validation', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'opencode', role: 'implementer' });
  const request = { id: 'revalidation-race', kind: 'command' as const, subject: { command: 'touch original' }, choices: ['once', 'deny'] as Array<'once' | 'deny'> };
  fakes.opencode!.raiseApproval('worker', request);
  const original = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  fakes.opencode!.scriptApproval('hold');
  const answering = ui.waitFor(f => f.type === 'approval' && (f.approval as typeof original).state === 'answering');
  const answer = ui.request({ type: 'approval.answer', approval: original.id, choice: 'once' });
  const reserved = ((await answering).approval as typeof original).outcome;
  const refreshed = ui.waitFor(f => f.type === 'approval' && (f.approval as typeof original).id === original.id && (f.approval as typeof original).answerIn === 'tui');
  fakes.opencode!.raiseApproval('worker', { ...request, subject: {}, choices: [], answerIn: 'tui' });
  const updated = (await refreshed).approval as typeof original;
  assert.equal(updated.state, 'answering');
  assert.deepEqual(updated.outcome, reserved);
  fakes.opencode!.settleApproval('worker', request.id, 'fail');
  assert.equal((await answer).ok, false);
  const current = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals[0]!;
  assert.equal(current.id, original.id);
  assert.equal(current.since, original.since);
  assert.equal(current.state, 'pending');
  assert.equal(current.answerIn, 'tui');
  assert.deepEqual(current.choices, []);
  assert.deepEqual(current.subject, {});
  assert.equal((await ui.request({ type: 'approval.answer', approval: current.id, choice: 'once' })).ok, false);
  assert.equal(fakes.opencode!.approvalAnswers.length, 1);
});

for (const cap of [8192, 1024]) test(`an oversized fallback note is refused before delivering deny and can be corrected (cap ${cap})`, async t => {
  const root = await tempProject(t), clock = new FakeClock();
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Approval note size fixture');
  config.hygiene.maxTextBytes = cap;
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'session.launch', name: 'worker', harness: 'opencode', role: 'implementer' });
  fakes.opencode!.approvalNotes = false;
  fakes.opencode!.raiseApproval('worker', { id: 'note-limit', kind: 'command', subject: { command: 'rm important' }, choices: ['once', 'deny'] });
  const before = (await ok<Inbox>(ui, { type: 'inbox.list' })).approvals;
  const refused = await ui.request({ type: 'approval.answer', approval: before[0]!.id, choice: 'deny', note: '🚀'.repeat(cap / 4 + 1) });
  assert.equal(refused.ok, false);
  assert.ok(refused.error!.includes(`${cap + 4} bytes; the cap is ${cap}`));
  assert.equal(fakes.opencode!.approvalAnswers.length, 0);
  assert.deepEqual((await ok<Inbox>(ui, { type: 'inbox.list' })).approvals, before);
  await ok(ui, { type: 'approval.answer', approval: before[0]!.id, choice: 'deny', note: 'Keep it' });
  assert.equal(fakes.opencode!.approvalAnswers.length, 1);
  assert.equal(fakes.opencode!.approvalAnswers[0]!.choice, 'deny');
  const history = await ok<{ messages: Array<{ text: string; fromKind: string }> }>(ui, { type: 'topic.history', topic: 'general' });
  assert.ok(history.messages.some(m => m.text === 'Keep it' && m.fromKind === 'human'));
});
