// T2: approval records through the public frame seam, using the sealed in-process adapter.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { cland, connectUi, frameClient, inProcessSpoke, projectHub, tempProject, type FrameClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import type { Inbox } from '../src/protocol.ts';

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
