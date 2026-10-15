// Role handover with a note (spec 4.4, ADR 0001, decision #10, #31): the Coordinator hands its role over with
// `role.handover` and a four-section note; the human reassigns with `role.set` and an optional note; the new holder
// gets clause and note in one event, the old one a revocation; the Agents topic records both; the claims move with
// the role; the new holder pulls the role's state (`role.state`) and reads the waiting topics with `history`.
// Against a real daemon in a temporary project: spokes over MCP, the UI on the Unix socket, the CLI as its own
// process, the fake Claude Code for a holder that is busy in a turn.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clauseAnswered, connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject, type ChannelEvent, type FrameClient, type Session } from './harness.ts';
import type { RoleState } from '../src/protocol.ts';

type Result = { ok: boolean; error?: string; code?: string; missing?: string[]; permission?: string; role?: string | null; reason?: string };
type Audit = { event: 'audit'; session: string; role: string | null; tool: string; args: Record<string, unknown>; outcome: string; permission?: string };

const NOTE_MD = [
  '## Goals now',
  'Ship the tracker import (T-1).',
  '',
  '## Work in flight',
  'T-1: the importer is half done; impl-1 writes the tests.',
  '',
  '## Open decisions',
  'Whether closed GitHub issues are imported: ask the human.',
  '',
  '## Waiting on',
  'The human, on the General question about the release date.',
].join('\n');

const NOTE = { goals_now: 'Ship T-1.', work_in_flight: 'T-1 importer, half done.', open_decisions: 'Closed issues: import or not.', waiting_on: 'The human, on the release date.' };

const isRole = (e: ChannelEvent) => e.params.meta?.kind === 'role';

const audits = async (root: string, ui: FrameClient): Promise<Audit[]> => {
  const flushed = await ui.request({ type: 'hub.status', flushLogs: true });
  assert.equal(flushed.ok, true, JSON.stringify(flushed));
  return (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8'))
    .split('\n')
    .filter((l) => l.includes('"event":"audit"'))
    .map((l) => JSON.parse(l) as Audit);
};

const ok = (r: { code: number | null; stdout: string; stderr: string }) => {
  assert.equal(r.code, 0, `exit ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};

/** A hub notice in the Agents topic, as the subscribed UI sees it. */
const agentsNotice = (ui: FrameClient, text: RegExp | string) =>
  ui.waitFor((f) => {
    const m = f.message as { from?: string; topic?: string; text?: string } | undefined;
    return f.type === 'message' && m?.from === 'hub' && m.topic === 'agents' && (typeof text === 'string' ? m.text === text : text.test(m.text ?? ''));
  });

const coordinator = async (ui: FrameClient) => ((await ui.request({ type: 'hub.status' })).value as { coordinator: string | null }).coordinator;

async function setup(t: TestContext, env: Record<string, string> = {}) {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const spawn = async (name: string, role: string): Promise<Session> => {
    const s = await spawnSpoke({ discover: true, cwd: root, name, sessionId: `sess-${name}`, role });
    t.after(() => s.close());
    await s.waitForEvent((e) => isRole(e) && e.params.meta?.role === role, 30_000);
    return s;
  };
  return { root, ui, spawn };
}

test('the Coordinator hands over with a note: B gets clause and note in one event, A the revocation, Agents both; the claims move; B pulls the role state', async (t) => {
  const { root, ui, spawn } = await setup(t);
  const a = await spawn('coord', 'coordinator');
  const b = await spawn('next', 'implementer');
  await a.waitForPresence(['coord', 'next']);
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Tracker import'));
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Someone else'));

  // before: A claims T-1, and the human asks the Coordinator something in General that A has not answered
  assert.equal((await a.call<Result>('task.claim', { id: 'T-1' })).ok, true);
  const asked = await ui.request({ type: 'topic.send', topic: 'general', text: 'When do we release?' });
  assert.equal(asked.ok, true, asked.error);
  await a.waitForEvent((e) => e.params.content.includes('When do we release?'));
  // the Agents topic: a message to the Coordinator that A answered is not waiting
  assert.equal((await b.call<Result>('send', { to: ['coordinator'], text: 'T-2 is blocked' })).ok, true);
  assert.equal((await a.call<Result>('send', { to: ['next'], text: 'Noted.' })).ok, true);
  // and A has asked the human something (#33) in a topic of its own, still open at the handover
  const release = (await ui.request({ type: 'topic.create', title: 'Release' })).value as { topic: { id: string } };
  const question = await a.call<Result & { ask: string }>('ask', { topic: release.topic.id, question: 'Ship on Friday?', options: ['yes', 'no'] });
  assert.equal(question.ok, true, question.error);

  const before = ui.frames.length;
  const handed = await a.call<Result & { session?: { label: string } }>('role.handover', { to: 'next', note: NOTE_MD });
  assert.equal(handed.ok, true, handed.error);
  assert.equal(handed.session?.label, 'next [Coordinator]');

  // B: the clause and the note in one event
  const clause = await b.waitForEvent((e) => isRole(e) && e.params.meta?.role === 'coordinator', 15_000);
  assert.equal(clause.params.meta?.from, 'hub');
  assert.equal(clause.params.meta?.handover_from, 'coord');
  assert.match(clause.params.content, /^cland hub: you hold the role Coordinator in this project, shown to others as next \[Coordinator\]/);
  assert.match(clause.params.content, /You are the Coordinator: lead the root of the item tree\./);
  assert.match(clause.params.content, /Handover note from coord:\n\n## Goals now\n\nShip the tracker import \(T-1\)\.\n\n## Work in flight\n\nT-1: the importer is half done; impl-1 writes the tests\.\n\n## Open decisions\n\n.+\n\n## Waiting on\n\nThe human, on the General question about the release date\./);
  assert.match(clause.params.content, /`role\.state`/);

  // A: revoked, told to stop
  const revoked = await a.waitForEvent((e) => isRole(e) && e.params.meta?.role === '', 15_000);
  assert.deepEqual([revoked.params.meta?.reason, revoked.params.meta?.handed_to], ['handover', 'next']);
  assert.match(revoked.params.content, /^cland hub: coord no longer holds the role Coordinator \(handed over to next\)\. Stop acting as Coordinator/);

  // Agents: both notices, the note recorded with the first
  await agentsNotice(ui, /^coord \[Coordinator\] handed the Coordinator role over to next, with a handover note:\n\n## Goals now\n\nShip the tracker import/);
  await agentsNotice(ui, 'next [Coordinator] took over the Coordinator role from coord.');
  // One journal row records the handover, from its Agents notice.
  const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.deepEqual(events.rows.filter(r => /handed the Coordinator role over/.test(r.text)).map(r => r.text), ['coord [Coordinator] handed the Coordinator role over to next, with a handover note']);
  // the UI's events: both sessions' roles, the Coordinator filled by B; and the status
  await ui.waitFor((f) => f.type === 'role.filled' && f.session === 'next');
  const roleEvents = ui.frames.slice(before).filter((f) => f.type === 'session.role' || f.type === 'role.filled' || f.type === 'role.vacant');
  assert.deepEqual(
    roleEvents.map((f) => [f.type, f.session, f.role, f.previous, f.reason]),
    [
      ['session.role', 'coord', null, 'coordinator', 'handover'],
      ['session.role', 'next', 'coordinator', 'implementer', 'handover'],
      ['role.filled', 'next', 'coordinator', undefined, undefined],
    ],
  );
  assert.equal(await coordinator(ui), 'next');
  // the moved claim reaches the UI as a `task` event (#36): the items panel shows T-1 claimed by B
  await ui.waitFor((f) => f.type === 'task' && f.id === 'T-1' && (f as { item?: { claim?: { session?: string } } }).item?.claim?.session === 'next');

  // the audit log: the call, its addressee, the note only as its length
  const record = await eventually('handover audit recorded', async () => (await audits(root, ui)).find(r => r.tool === 'role.handover'));
  assert.deepEqual([record?.session, record?.role, record?.outcome, record?.args.to, record?.args.noteChars], ['coord', 'coordinator', 'ok', 'next', NOTE_MD.length]);

  // A's next tool call as Coordinator is refused
  const after = await a.call<Result>('send', { text: 'still here' });
  assert.deepEqual([after.ok, after.code, after.role], [false, 'forbidden', null]);

  // the state pull: the waiting topic, the claim (moved to B), the note, the open ask
  const state = await b.call<Result & RoleState>('role.state');
  assert.equal(state.ok, true, state.error);
  assert.equal(state.role, 'coordinator');
  assert.deepEqual(state.holders.map((h) => h.label), ['next [Coordinator]']);
  assert.deepEqual(
    state.waiting.map((w) => [w.topic.id, w.reason, w.pending]),
    // General waits for an agent (#32), and the human's latest message there addressed the Coordinator's holder
    [['general', 'status', 1]],
  );
  // a Reviewer's state does not list General: the human's message there waits for the Coordinator, not for it
  const rev = await spawn('rev', 'reviewer');
  const revState = await rev.call<Result & RoleState>('role.state');
  assert.equal(revState.ok, true, revState.error);
  assert.deepEqual(revState.waiting, []);
  // the open ask A put to the human is the role's: B inherits it, and the human's answer reaches B (#33)
  assert.deepEqual(state.asks.map((x) => [x.id, x.from, x.question]), [[question.ask, 'coord', 'Ship on Friday?']]);
  assert.deepEqual(state.claims.map((c) => [c.item, c.session, c.sessionId]), [['T-1', 'next', 'sess-next']]);
  assert.deepEqual([state.note?.from, state.note?.to, state.note?.sections.waiting_on], ['coord', 'next', 'The human, on the General question about the release date.']);
  assert.deepEqual([state.handover?.from, state.handover?.to, state.handover?.by], ['coord', 'next', 'coord']);
  // the UI's frame answers the same
  const viaUi = (await ui.request({ type: 'role.state', role: 'coordinator' })).value as RoleState;
  assert.deepEqual(viaUi.claims, state.claims);
  assert.deepEqual(viaUi.waiting, state.waiting);
  // the human answers A's ask: the answer reaches B, which holds the role A asked as
  const answered = await ui.request({ type: 'topic.answer', ask: question.ask, option: 1 });
  assert.equal(answered.ok, true, answered.error);
  const answer = await b.waitForEvent((e) => e.params.meta?.answer_to === question.ask, 15_000);
  assert.ok(answer.params.content === 'yes' || answer.params.content.includes('\nyes\n'));
  // task view shows B's claim; B's history on the waiting topic has the human's question
  const view = await b.call<Result & { item: { claim: { session: string; sessionId: string } | null } }>('task.view', { id: 'T-1' });
  assert.deepEqual([view.item.claim?.session, view.item.claim?.sessionId], ['next', 'sess-next']);
  assert.match(ok(await cland(root, 'task', 'view', 'T-1')).stdout, /next/);
  const history = await b.call<Result & { messages: Array<{ from: string; text: string; topic?: string }> }>('history', { topic: 'general' });
  assert.ok(history.messages.some((m) => m.from === 'human' && m.text === 'When do we release?'), JSON.stringify(history.messages));
  // A, roleless, reads no role state
  assert.equal((await a.call<Result>('role.state')).code, 'forbidden');

  // a reconnect of B brings the clause with the note again
  ok(await cland(root, 'hub', 'stop'));
  await startDaemon(t, root);
  const again = await eventually('the clause again', () => b.events.filter((e) => isRole(e) && e.params.meta?.role === 'coordinator')[1], 30_000);
  assert.equal(again.params.meta?.handover_from, 'coord');
  assert.match(again.params.content, /Handover note from coord:/);
});

test('a handover without a complete note is refused with the typed error naming the missing sections; only the Coordinator hands over', async (t) => {
  const { root, ui, spawn } = await setup(t);
  const a = await spawn('coord', 'coordinator');
  const b = await spawn('next', 'implementer');
  await a.waitForPresence(['coord', 'next']);

  const none = await a.call<Result>('role.handover', { to: 'next' });
  assert.deepEqual([none.ok, none.code, none.missing], [false, 'note-incomplete', ['goals_now', 'work_in_flight', 'open_decisions', 'waiting_on']]);
  assert.match(none.error ?? '', /^handover refused: the note has no "goals now", "work in flight", "open decisions", "waiting on" sections/);
  const noWaiting = await a.call<Result>('role.handover', { to: 'next', note: NOTE_MD.replace(/## Waiting on[\s\S]*$/, '') });
  assert.deepEqual([noWaiting.code, noWaiting.missing], ['note-incomplete', ['waiting_on']]);
  assert.match(noWaiting.error ?? '', /^handover refused: the note has no "waiting on" section —/);
  const empty = await a.call<Result>('role.handover', { to: 'next', note: { ...NOTE, open_decisions: '  ' } });
  assert.deepEqual([empty.code, empty.missing], ['note-incomplete', ['open_decisions']]);
  // a receiver the hub does not know, and the holder itself
  assert.match((await a.call<Result>('role.handover', { to: 'nobody', note: NOTE })).error ?? '', /"nobody" is not a session the hub knows/);
  assert.match((await a.call<Result>('role.handover', { to: 'coord', note: NOTE })).error ?? '', /already holds the role/);
  // nothing moved
  assert.equal(await coordinator(ui), 'coord');
  assert.equal(b.events.filter((e) => isRole(e) && e.params.meta?.role === 'coordinator').length, 0);
  // an Implementer may not hand over at all
  const impl = await b.call<Result>('role.handover', { to: 'coord', note: NOTE });
  assert.deepEqual([impl.code, impl.permission, impl.role], ['forbidden', 'role.handover', 'implementer']);
  // the refusals are audited
  const records = await eventually('all handover refusals are audited', async () => {
    const records = (await audits(root, ui)).filter(r => r.tool === 'role.handover');
    return records.some(r => r.session === 'next' && r.outcome === 'forbidden') ? records : undefined;
  });
  assert.deepEqual(
    records.map((r) => [r.session, r.outcome]),
    [
      ['coord', 'error'],
      ['coord', 'error'],
      ['coord', 'error'],
      ['coord', 'error'],
      ['coord', 'error'],
      ['next', 'forbidden'],
    ],
  );
});

test('the human reassigns with role.set: without a note (move), with a note (CLI --note-file); a handover may leave the holder an Implementer', async (t) => {
  const { root, ui, spawn } = await setup(t);
  const a = await spawn('coord', 'coordinator');
  const b = await spawn('next', 'implementer');
  const c = await spawn('third', 'reviewer');
  await a.waitForPresence(['coord', 'next', 'third']);

  // a plain role.set of a held Coordinator is still refused
  assert.match((await ui.request({ type: 'role.set', session: 'next', role: 'coordinator' })).error ?? '', /held by coord \[Coordinator\]/);

  // without a note: `move`
  const moved = await ui.request({ type: 'role.set', session: 'next', role: 'coordinator', move: true });
  assert.equal(moved.ok, true, moved.error);
  const clause = await b.waitForEvent((e) => isRole(e) && e.params.meta?.role === 'coordinator', 15_000);
  assert.equal(clause.params.meta?.handover_from, undefined);
  assert.doesNotMatch(clause.params.content, /Handover note/);
  const revoked = await a.waitForEvent((e) => isRole(e) && e.params.meta?.role === '', 15_000);
  assert.deepEqual([revoked.params.meta?.reason, revoked.params.meta?.handed_to], ['handover', 'next']);
  await agentsNotice(ui, 'the human moved the Coordinator role from coord [Coordinator] to next, with no note.');
  await agentsNotice(ui, 'next [Coordinator] took over the Coordinator role from coord.');
  assert.equal(await coordinator(ui), 'next');

  // with a note, through the CLI
  const file = join(root, 'note.md');
  await writeFile(file, NOTE_MD);
  const set = ok(await cland(root, 'role', 'set', 'third', 'coordinator', '--note-file', file));
  assert.match(set.stdout, /^third \[Coordinator\]: role set, with the handover note/);
  const withNote = await c.waitForEvent((e) => isRole(e) && e.params.meta?.role === 'coordinator', 15_000);
  assert.equal(withNote.params.meta?.handover_from, 'human');
  assert.match(withNote.params.content, /Handover note from human:\n\n## Goals now\n\nShip the tracker import/);
  await b.waitForEvent((e) => isRole(e) && e.params.meta?.role === '' && e.params.meta?.handed_to === 'third', 15_000);
  await agentsNotice(ui, /^the human moved the Coordinator role from next \[Coordinator\] to third, with a handover note:\n\n## Goals now/);
  assert.equal(await coordinator(ui), 'third');
  const state = (await ui.request({ type: 'role.state', role: 'coordinator' })).value as RoleState;
  assert.deepEqual([state.note?.from, state.note?.to, state.handover?.by], ['human', 'third', 'human']);
  // a note missing a section is refused for the human too
  const bad = await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator', note: '## Goals now\nx' });
  assert.equal(bad.ok, false);
  assert.match(bad.error ?? '', /handover refused: the note has no "work in flight", "open decisions", "waiting on" sections/);

  // the Coordinator hands over and stays on as an Implementer
  const handed = await c.call<Result>('role.handover', { to: 'coord', note: NOTE, then: 'implementer' });
  assert.equal(handed.ok, true, handed.error);
  const implementer = await c.waitForEvent((e) => isRole(e) && e.params.meta?.role === 'implementer', 15_000);
  assert.equal(implementer.params.meta?.handed_to, 'coord');
  assert.match(implementer.params.content, /^cland hub: you handed the role Coordinator over to coord: stop acting as Coordinator\.\n\ncland hub: you hold the role Implementer/);
  const who = await c.call<{ sessions: Array<{ name: string; role: string | null }> }>('who');
  assert.deepEqual(
    who.sessions.map((s) => [s.name, s.role]).sort(),
    [
      ['coord', 'coordinator'],
      ['next', null],
      ['third', 'implementer'],
    ],
  );
  // an Implementer now: its next Coordinator call is refused
  assert.equal((await c.call<Result>('send', { text: 'to the human' })).code, 'forbidden');
});

test('revocation mid-turn: the human reassigns while the launched Coordinator is busy; its next call is refused and the revocation reaches it', async (t) => {
  // Keep the Coordinator mid-turn while the human revokes its role.
  const fake = await fakeClaude(t, { turnMs: 2500 });
  const { root, ui, spawn } = await setup(t, fake.env);
  const launched = (await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', model: 'claude-fake-1' }, 30_000)) as { ok: boolean; error?: string; value?: { process: { harnessId: string } } };
  assert.equal(launched.ok, true, launched.error);
  const job = launched.value?.process.harnessId as string;
  await clauseAnswered(ui, 'coord', 30_000);
  const b = await spawn('next', 'implementer');

  // a turn: the human asks the Coordinator; the fake thinks for 2.5 s, then answers with `send`
  const asked = await ui.request({ type: 'topic.send', topic: 'general', text: 'Plan the week' });
  assert.equal(asked.ok, true, asked.error);
  await eventually('the turn started', async () => ((await fake.log(job)).includes('submitted: <channel') && (await fake.log(job)).includes('Plan the week') ? true : undefined));
  await ui.waitFor((f) => f.type === 'session.state' && f.session === 'coord' && f.state === 'busy');

  // mid-turn, the human hands the role to B with a note
  const moved = await ui.request({ type: 'role.set', session: 'next', role: 'coordinator', note: NOTE });
  assert.equal(moved.ok, true, moved.error);
  const clause = await b.waitForEvent((e) => isRole(e) && e.params.meta?.role === 'coordinator', 15_000);
  assert.equal(clause.params.meta?.handover_from, 'human');
  assert.equal(await coordinator(ui), 'next');

  // the turn ends: A's answer (a `send` to the human) is refused, it no longer holds a role
  await eventually('the answer refused', async () => (/tool send → .*"code":"forbidden"/.test(await fake.log(job)) ? true : undefined), 20_000);
  assert.match(await fake.log(job), /tool send → .*"role":null,"reason":"a session with no role has no tools"/);
  await agentsNotice(ui, 'coord tried send to the human: forbidden (a session with no role has no tools)');
  const refused = (await audits(root, ui)).find((r) => r.session === 'coord' && r.tool === 'send' && r.outcome === 'forbidden');
  assert.equal(refused?.role, null);
  // and the revocation reached the session, injected as its next turn
  await eventually('the revocation injected', async () => (/submitted: <channel [^\n]*from="hub"[^\n]*>\ncland hub: coord no longer holds the role Coordinator \(handed over to next\)/.test(await fake.log(job)) ? true : undefined), 20_000);
  // the process table follows: the relaunch would start roleless
  const list = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ name: string; role: string | null }>; coordinator: string | null };
  assert.deepEqual([list.processes.find((p) => p.name === 'coord')?.role, list.coordinator], [null, 'next']);
});
