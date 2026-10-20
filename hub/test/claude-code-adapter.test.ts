// T3 Claude Code contract: the real fake binary starts the real spoke, hooks and cland mod.
// Each harness step is proved once (test titles below are the checklist):
// - "Claude Code binary contract": launch/attach, role clause in the first turn, inject through
//   the mod bridge to injected, hook signals to state, model and usage, permission hooks.
// - "Claude Code StopFailure hook": failure reaches Agents, events and the sender.
// - "a crashed Claude Code process": process exit and replacement bridge identity.
// - "Claude Code mod confirmation timeout": missing native confirmation and retry.
// - "after a hub restart": resume across a real hub-process restart, with hooks/mod reconnected.
// - "Claude unpinned binary launch": stop, native-conversation relaunch and environment frame.
// Scheduler and signed-out-latch negatives live in claude-code-schedule.test.ts on FakeClock.
import { fixtureEnvironment } from './fixture-environment.ts';
import { setRoleKey } from '../src/roles/editor.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeProjectHub as projectHub, withDiscoveredPid, assertFirstLaunchClause, clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, killDaemon, spawnSpoke, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Presence = { name: string; sessionId: string; state: string; status: string | null; role: string | null };
type Harness = { name: string; harness: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string; attach: string | null; model: string | null; usage?: Record<string, unknown> };
type Status = { sessions: Presence[]; harnesses: Harness[] };
type StateEvent = { type: 'session.state'; session: string; state: string; source: string; approvalCommand?: string };

test('Claude Code StopFailure hook reports its turn failure to Agents, events and sender', async (t) => {
  const root = await tempProject(t);
  // Drain hook/mod posts at turn boundaries so pushed states remain observable.
  const fake = await fakeClaude(t, { pollMs: 600_000, awaitSignals: true });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await coord.waitForEvent((e) => e.params.meta?.kind === 'role');
  const mark = ui.frames.length;
  await launch(ui, 'impl', { role: 'implementer' });
  await aTurn(ui, 'impl', mark);
  assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['impl'], text: 'fail this turn' })).ok, true);
  const expected = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
  await ui.waitFor((f) => f.type === 'message' && (f.message as { kind?: string; text: string }).kind === 'turn-failed' && (f.message as { text: string }).text === expected);
  const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.ok(events.rows.some((n) => n.text === expected));
  await coord.waitForEvent((e) => e.params.content.includes(expected));
});

async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status' });
  assert.equal(r.ok, true, r.error);
  return r.value as Status;
}

async function launch(ui: FrameClient, name: string, extra: Record<string, unknown> = {}): Promise<Harness> {
  // the Claude Code harness whatever the role's launch default (roles.toml) names
  const r = await ui.request({ type: 'session.launch', name, harness: 'claude-code', ...extra }, 30_000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: Harness }).process;
}

const stateEvents = (ui: FrameClient, session: string, since = 0): StateEvent[] => ui.frames.slice(since).filter((f): f is StateEvent => f.type === 'session.state' && f.session === session);

/**
 * A turn as the UI sees it, from the frames after `mark`: a busy pushed by a hook or the mod, then an idle.
 * The turn's state signals come from processes of their own (`cland hook`), so they can reach the hub after
 * the reply and after the inject's confirmation; the session was idle before the turn, so only these
 * frames — never the current state — show that the turn was reported.
 */
const aTurn = (ui: FrameClient, session: string, mark: number) =>
  eventually(`${session}: a pushed busy, then idle`, () => {
    const events = stateEvents(ui, session, mark);
    const busy = events.findIndex((e) => e.state === 'busy' && e.source !== 'poll');
    return busy >= 0 && events.slice(busy + 1).some((e) => e.state === 'idle') ? events : undefined;
  });

/** The session shows in presence (its spoke connected) with this state. */
const presentAs = (ui: FrameClient, name: string, state: string) =>
  eventually(`${name} present as ${state}`, async () => {
    const p = (await status(ui)).sessions.find((s) => s.name === name);
    return p?.state === state ? p : undefined;
  });

const hubLog = async (root: string, ui: FrameClient) => {
  const flushed = await ui.request({ type: 'hub.status', flushLogs: true });
  assert.equal(flushed.ok, true, flushed.error);
  return readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
};

test('Claude Code binary contract: launch, attach, first clause, mod injection, hook state and usage', async (t) => {
  const root = await tempProject(t);
  // the polled fallback out of the way (a loaded machine runs a hook's process late, and a poll would beat it): every
  // state asserted here must come from a push (a hook, the mod)
  // and `--bg` returns after the session's SessionStart hook already posted (seen with the real harness)
  // Drain hook/mod posts at each boundary so even a fast turn keeps its pushed states observable.
  const fake = await fakeClaude(t, { pollMs: 600_000, lateBg: true, awaitSignals: true });
  const { discovery } = await projectHub(t, root, fake.env);
  const rolesFile = join(root, '.cland/roles.toml');
  await writeFile(rolesFile, setRoleKey(await readFile(rolesFile, 'utf8'), 'coordinator', 'launch', 'permissions', 'auto'));
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  const launchMark = ui.frames.length;
  const launched = await launch(ui, 'coord', { role: 'coordinator', model: 'claude-fake-1' });
  const calls = (await readFile(join(fake.home, 'invocations.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { args: string[] });
  const bg = calls.find(c => c.args.includes('--bg'))!.args;
  assert.equal(bg[bg.indexOf('--permission-mode') + 1], 'auto');
  assert.ok(!bg.includes('--dangerously-skip-permissions'));
  // Precedence permutations live at T2 in claude-code-environment.test.ts; prove the binary frame once.
  assert.deepEqual(JSON.parse(bg[bg.indexOf('--settings') + 1]!).worktree, { bgIsolation: 'none' });
  assert.match(await hubLog(root, ui), /"event":"session-launched".*"early":1/, 'the early SessionStart was kept and replayed');
  // the session's first turn is its role clause, injected as soon as the launch's bridge and SessionStart are in
  await clauseAnswered(ui, 'coord');
  await aTurn(ui, 'coord', launchMark);
  assert.equal(launched.harness, 'claude-code');
  assert.equal(launched.status, 'running');
  assert.match(launched.harnessId ?? '', /^[0-9a-f]{8}$/);
  const discovered = await withDiscoveredPid(ui, launched);
  assert.equal(typeof discovered.pid, 'number');
  assert.equal(launched.attach, `claude attach ${launched.harnessId}`);
  // like the real `--bg`, the fake picks its own session id: the hub records it beside its own
  const [listed] = await fake.sessions();
  assert.equal(listed?.sessionId, launched.harnessSessionId);
  assert.ok(launched.harnessSessionId?.startsWith(launched.harnessId as string));
  assert.notEqual(launched.harnessSessionId, launched.sessionId);

  // SessionStart (a hook) makes it idle; the spoke connected under the launch's name, role and session id
  const present = await presentAs(ui, 'coord', 'idle');
  assert.equal(present.role, 'coordinator');
  assert.equal(present.sessionId, launched.sessionId);
  assertFirstLaunchClause(await hubLog(root, ui), 'coord');

  // attach is the harness's own command; run in a terminal, it attaches (twice: two clients)
  const attach = (await ui.request({ type: 'session.attach', session: 'coord' })).value as { command: string };
  assert.equal(attach.command, launched.attach);
  const runAttach = () =>
    new Promise<string>((resolve) => execFile('sh', ['-c', attach.command], { env: fixtureEnvironment(root, process.env, { ...fake.env }) }, (_e, stdout) => resolve(stdout)));
  const [one, two] = await Promise.all([runAttach(), runAttach()]);
  assert.equal(one, `fake claude attached to ${launched.harnessId} (coord)\n`);
  assert.equal(two, one);

  // the human writes in General: the coordinator gets it, the mod submits it, the reply comes back
  const mark = ui.frames.length;
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'Reply with the single word pong' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: { id: string } }).message.id;
  const stages = async () => ui.frames.filter((f) => f.type === 'delivery' && f.message === id).map((f) => f.stage);
  await eventually('injected', async () => ((await stages()).includes('injected') ? true : undefined));
  assert.deepEqual(await stages(), ['delivered', 'injected']);
  const reply = (await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string }).from === 'coord' && (f.message as { replyTo?: string }).replyTo === id, 15_000)) as { message: { text: string; topic: string; replyTo?: string } };
  assert.equal(reply.message.text, 'pong: Reply with the single word pong');
  assert.equal(reply.message.topic, 'general');
  assert.equal(reply.message.replyTo, id);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ id: string; stage?: string }> };
  assert.equal(history.messages.find((m) => m.id === id)?.stage, 'injected');
  // the prompt the harness got: the envelope, and the line that names the way back
  const prompt = await fake.log(launched.harnessId as string);
  assert.match(prompt, /submitted: <channel source="cland" from="human" from_kind="human"[^\n]* msg_id="[^"]+"[^\n]* topic="general" topic_title="General">\nReply with the single word pong\n<\/channel>\nTo answer, call the cland `send` tool with topic "general" and no `to`; text printed in this terminal reaches no one\./);

  // busy during the turn, idle after: pushed by the hooks and the mod
  const turn = await aTurn(ui, 'coord', mark);
  await presentAs(ui, 'coord', 'idle');
  const busy = turn.find((e) => e.state === 'busy');
  assert.ok(busy && ['hook', 'mod'].includes(busy.source), `busy came from ${busy?.source}`);

  // the turn's model and usage, from the mod's turn.complete
  const h = await eventually('usage for both turns', async () => (await status(ui)).harnesses.find((x) => x.name === 'coord' && (x.usage?.total as { outputTokens?: number } | undefined)?.outputTokens === 4));
  assert.equal(h.model, 'claude-fake-1');
  assert.deepEqual(h.usage, {
    model: 'claude-fake-1',
    total: { totalTokens: 38, inputTokens: 20, outputTokens: 4, reasoningTokens: 0, cacheReadTokens: 8, cacheWriteTokens: 6 },
    last: { totalTokens: 19, inputTokens: 10, outputTokens: 2, reasoningTokens: 0, cacheReadTokens: 4, cacheWriteTokens: 3 },
  });

  // a permission prompt: waiting for approval, from the PermissionRequest hook, whatever the model says of itself
  await ui.request({ type: 'topic.send', topic: 'general', text: 'this one needs approval' });
  const waiting = await presentAs(ui, 'coord', 'waiting for approval');
  assert.equal(waiting.status, 'idle', "the model's own status line says idle");
  const event = stateEvents(ui, 'coord').findLast((e) => e.state === 'waiting for approval');
  assert.equal(event?.source, 'hook');
  assert.equal(event?.approvalCommand, 'touch approved');
  const pending = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ name: string; approvalCommand?: string }> };
  assert.equal(pending.processes.find(p => p.name === 'coord')?.approvalCommand, 'touch approved');
  assert.ok(!stateEvents(ui, 'coord').some((e) => e.source === 'status'), 'no state ever came from the status tool');
  process.kill(discovered.pid, 'SIGUSR1'); // the human approves in the harness's TUI
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: this one needs approval', 15_000);
  await presentAs(ui, 'coord', 'idle');
  const after = stateEvents(ui, 'coord').map((e) => e.state);
  assert.deepEqual(after.slice(after.lastIndexOf('waiting for approval')), ['waiting for approval', 'busy', 'idle']);

  const cleared = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ approvalCommand?: string }> };
  assert.equal(cleared.processes[0]?.approvalCommand, undefined);
  const editMark = ui.frames.length;
  await ui.request({ type: 'topic.send', topic: 'general', text: 'needs approval for Edit' });
  const edit = await ui.waitFor(f => f.type === 'session.state' && f.approvalCommand === 'Edit');
  // T3 signal boundary (T-725): approve immediately on the waiting frame, with no intervening I/O.
  process.kill(discovered.pid, 'SIGUSR1');
  assert.equal(edit.state, 'waiting for approval');
  assert.ok(!JSON.stringify(ui.frames.slice(editMark)).includes('PRIVATE-TOOL-INPUT'));
  await presentAs(ui, 'coord', 'idle');

  // the capability table declares what the adapter cannot do
  const list = (await ui.request({ type: 'session.list' })).value as { adapters: Record<string, { approvalRelay: string; history: string; setModel: string; usage: string; states: Record<string, string> }> };
  assert.deepEqual(list.adapters['claude-code'], {
    history: 'none',
    usage: 'reliable',
    setModel: 'none',
    approvalRelay: 'none',
    states: { busy: 'reliable', idle: 'reliable', 'waiting for approval': 'reliable', 'waiting for human': 'heuristic' },
  });
});

test('a crashed Claude Code process: the state turns unknown and the hub logs it once; launched again under its name, it works', async (t) => {
  const root = await tempProject(t);
  // a confirmation comes from a hook's or the mod's process, which a loaded machine starts seconds late: the deadline is
  // wide, so an unconfirmed inject below means the new process's confirmation was not taken, not that it was slow
  const fake = await fakeClaude(t, { lateBg: true, injectTimeoutMs: 30_000 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  await killDaemon((await withDiscoveredPid(ui, launched)).pid);
  const gone = await eventually('the process gone', async () => (await status(ui)).harnesses.find((x) => x.name === 'impl-1' && x.status === 'exited'));
  assert.equal(gone.state, 'unknown');
  assert.equal(gone.attach, null);
  const event = await ui.waitFor((f) => f.type === 'session.state' && f.session === 'impl-1' && f.state === 'unknown');
  assert.equal(event.source, 'process');
  const exitLogLines = async () => (await hubLog(root, ui)).split('\n').filter((l) => l.includes('"harness-exited"'));
  const logged = await exitLogLines();
  assert.equal(logged.length, 1, 'one log event for the crash');
  assert.match(logged[0] as string, /"session":"impl-1"/);

  // the same name again: its hooks and its mod, arriving before the launch returns, belong to the new process
  const again = await launch(ui, 'impl-1', { role: 'implementer' });
  assert.notEqual(again.sessionId, launched.sessionId);
  await presentAs(ui, 'impl-1', 'idle');
  // the new process's mod has its bridge (a process of its own, which a loaded machine starts late)
  await eventually('the new bridge', async () => ((await hubLog(root, ui)).split('"event":"bridge-connected","session":"impl-1"').length > 2 ? true : undefined));
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'are you back?', to: ['impl-1'] });
  const id = (sent.value as { message: { id: string } }).message.id;
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 45_000);
  assert.equal((await exitLogLines()).length, 1, 'the replacement injection is a barrier after crash handling');
  const log = await hubLog(root, ui);
  assert.ok(!log.includes(`"inject-unconfirmed","session":"impl-1","id":"${id}"`), `injected at once, through the new process:\n${log.split('\n').filter((l) => /impl-1|bridge|inject/.test(l)).slice(-40).join('\n')}`);
});

test('Claude Code mod confirmation timeout leaves delivery retryable at the next turn', async (t) => {
  const root = await tempProject(t);
  // The retry needs an observed busy→idle transition, not a turn shorter than its hook processes' startup.
  const fake = await fakeClaude(t, { injectTimeoutMs: 1000, dropFirst: true, awaitSignals: true });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');

  // the first turn a launched session gets is its role clause, a hub notice with no topic: the fake drops it
  const clause = await eventually('the clause recorded', async () => /"event":"role-clause","session":"coord"[^\n]*"id":"([^"]+)"/.exec(await hubLog(root, ui))?.[1]);
  // An earlier attempt may have failed before the bridge connected; only this timeout proves the drop.
  await eventually('the dropped inject timed out', async () => ((await hubLog(root, ui)).includes(`"event":"inject-unconfirmed","session":"coord","id":"${clause}","error":"the mod did not confirm the turn within `) ? true : undefined));
  const injected = async () => (await hubLog(root, ui)).includes(`"event":"injected","id":"${clause}"`);
  // The observed unconfirmed-inject record is the completion barrier. Hub-only repeated idle
  // notifications are covered in adapter-composition.test.ts without a binary or elapsed-time wait.
  assert.equal(await injected(), false, 'not confirmed: still delivered');

  // the next turn ends idle: what waited is injected again, and this time confirmed
  const first = ((await ui.request({ type: 'topic.send', topic: 'general', text: 'first' })).value as { message: { id: string } }).message.id;
  await ui.waitFor((f) => f.type === 'delivery' && f.message === first && f.stage === 'injected', 15_000);
  await eventually('the clause injected on the retry', async () => ((await injected()) ? true : undefined));
  await clauseAnswered(ui, 'coord');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: first', 15_000);
});

test('after a hub restart, resume re-finds the running session through the process table and state reporting continues', async (t) => {
  const root = await tempProject(t);
  // A slow poll keeps restarted states on the hook/mod path; hook receipts order each turn.
  const fake = await fakeClaude(t, { pollMs: 10_000, awaitSignals: true });
  const first = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const discovered = await withDiscoveredPid(ui, launched);
  ui.close();

  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  assert.equal((await fake.sessions()).length, 1, 'the session outlives the hub');
  const second = await startDaemon(t, root, fake.env);
  assert.notEqual(second.discovery.pid, first.discovery.pid);
  const ui2 = await connectUi(t, second.discovery);
  assert.equal((await ui2.request({ type: 'subscribe' })).ok, true);

  // re-found: the same pid and session id, still running, its state known again; the spoke is back too
  const resumed = await eventually('resumed', async () => (await status(ui2)).harnesses.find((x) => x.name === 'coord' && x.state === 'idle'));
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.pid, discovered.pid);
  assert.equal(resumed.sessionId, launched.sessionId);
  // a late hook of the launch's clause turn can make the row idle before the resume itself is logged
  await eventually('the resume logged', async () => (/"event":"session-resumed","session":"coord"/.test(await hubLog(root, ui2)) ? true : undefined));
  await presentAs(ui2, 'coord', 'idle');

  // hooks and the mod reach the new hub: a message is injected and the turn's states arrive
  const mark = ui2.frames.length;
  const sent = await ui2.request({ type: 'topic.send', topic: 'general', text: 'still there?' });
  const id = (sent.value as { message: { id: string } }).message.id;
  await ui2.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await ui2.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: still there?', 15_000);
  await aTurn(ui2, 'coord', mark); // busy pushed after the restart, then idle
  await presentAs(ui2, 'coord', 'idle');
});

// One real environment frame proof; the four-way table lives in claude-code-environment.test.ts.
test('Claude unpinned binary launch, native relaunch and remedies preserve an unset CLAUDE_CONFIG_DIR (T-603)', async t => {
  const fake = await fakeClaude(t);
  const root = fake.home; // The fake's owned scratch HOME is this contract's project too.
  // Model an unset variable even if the hub inherited a human's selection.
  const env: Record<string, string> = { ...fake.env };
  Object.assign(env, { CLAUDE_CONFIG_DIR: undefined });
  const { discovery } = await projectHub(t, root, env, { scratchAccountPaths: { home: fake.home } });
  const ui = await connectUi(t, discovery);
  const p = await launch(ui, 'plain');
  assert.equal(p.status, 'running');
  assert.equal(p.attach?.includes('CLAUDE_CONFIG_DIR='), false);
  assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);
  const resumed = await ui.request({ type: 'session.resume', session: p.name, relaunch: true }, 30_000);
  assert.equal(resumed.ok, true, resumed.error);
  assert.equal((resumed.value as { found: boolean }).found, true);
  assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);

  const calls = (await readFile(join(fake.home, 'invocations.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { args: string[]; configDir: string; CLAUDE_CONFIG_DIR: string | null });
  const commands = calls.filter(c => c.args.includes('--bg') || c.args[0] === 'agents' || c.args[0] === 'stop');
  const bg = commands.filter(c => c.args.includes('--bg'));
  assert.equal(bg.length, 2, 'launch and relaunch both reach the harness');
  assert.ok(bg[1]?.args.includes('--resume'), 'relaunch resumes the native conversation');
  assert.ok(calls.some(c => c.args[0] === 'agents'), 'discovery reaches the harness');
  assert.ok(commands.every(c => c.CLAUDE_CONFIG_DIR === null), 'launch, resume, discovery and stop preserve the implicit selection');
  assert.ok(commands.every(c => c.configDir === join(fake.home, '.claude')), 'directory bookkeeping retains its fallback');
  await writeFile(join(fake.home, 'logged-out'), '');
  assert.equal((await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'failed' })).ok, false);
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ kind?: string; text: string }> };
  const notice = history.messages.find(m => m.kind === 'claude-signed-out');
  assert.ok(notice);
  assert.ok(notice.text.includes('claude auth login'));
  assert.equal(notice.text.includes('CLAUDE_CONFIG_DIR='), false);
});
