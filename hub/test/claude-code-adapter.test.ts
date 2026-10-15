// The Claude Code adapter (spec 4.2, 4.3; #24) against a fake Claude Code at the harness process boundary: a
// real daemon in a temporary project launches the fake (`test/fakes/claude-code/claude`, first on the PATH),
// which starts the real spoke, runs the real `cland hook` commands and loads the real cland mod. The UI side is a
// scripted client on the daemon's Unix socket. Nothing inside the hub is mocked or read directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { withDiscoveredPid, assertFirstLaunchClause, clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, flushProjectLogs, killDaemon, sleep, spawnSpoke, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Presence = { name: string; sessionId: string; state: string; status: string | null; role: string | null };
type Harness = { name: string; harness: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string; attach: string | null; model: string | null; usage?: Record<string, unknown> };
type Status = { sessions: Presence[]; harnesses: Harness[] };
type StateEvent = { type: 'session.state'; session: string; state: string; source: string; approvalCommand?: string };

test('a Claude Code StopFailure is recorded in Agents and the events view and reported to the sender', async (t) => {
  const root = await tempProject(t);
  // Keep pushed hook states observable and authoritative while staging the turn.
  const fake = await fakeClaude(t, { pollMs: 600_000, turnMs: 1000 });
  const { discovery } = await startDaemon(t, root, fake.env);
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

test('a launched Claude Code session: the spoke connects, a UI message goes queued → delivered → injected, the reply comes back, and the state follows the hooks and the mod', async (t) => {
  const root = await tempProject(t);
  // the polled fallback out of the way (a loaded machine runs a hook's process late, and a poll would beat it): every
  // state asserted here must come from a push (a hook, the mod)
  // and `--bg` returns after the session's SessionStart hook already posted (seen with the real harness)
  // a turn long enough that its busy is still news when a hook's process (a node start) reports it
  const fake = await fakeClaude(t, { pollMs: 600_000, lateBg: true, turnMs: 1000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  const launchMark = ui.frames.length;
  const launched = await launch(ui, 'coord', { role: 'coordinator', model: 'claude-fake-1' });
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
    new Promise<string>((resolve) => execFile('sh', ['-c', attach.command], { env: { ...process.env, ...fake.env } }, (_e, stdout) => resolve(stdout)));
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
  const [session] = await fake.sessions();
  process.kill(session?.pid as number, 'SIGUSR1'); // the human approves in the harness's TUI
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: this one needs approval', 15_000);
  await presentAs(ui, 'coord', 'idle');
  const after = stateEvents(ui, 'coord').map((e) => e.state);
  assert.deepEqual(after.slice(after.lastIndexOf('waiting for approval')), ['waiting for approval', 'busy', 'idle']);

  const cleared = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ approvalCommand?: string }> };
  assert.equal(cleared.processes[0]?.approvalCommand, undefined);
  const editMark = ui.frames.length;
  await ui.request({ type: 'topic.send', topic: 'general', text: 'needs approval for Edit' });
  const edit = await ui.waitFor(f => f.type === 'session.state' && f.approvalCommand === 'Edit');
  assert.equal(edit.state, 'waiting for approval');
  assert.ok(!JSON.stringify(ui.frames.slice(editMark)).includes('PRIVATE-TOOL-INPUT'));
  process.kill(session?.pid as number, 'SIGUSR1');
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
  const { discovery } = await startDaemon(t, root, fake.env);
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
  await sleep(100);
  assert.equal((await exitLogLines()).length, 1, 'still one log event after settling');

  // the same name again: its hooks and its mod, arriving before the launch returns, belong to the new process
  const again = await launch(ui, 'impl-1', { role: 'implementer' });
  assert.notEqual(again.sessionId, launched.sessionId);
  await presentAs(ui, 'impl-1', 'idle');
  // the new process's mod has its bridge (a process of its own, which a loaded machine starts late)
  await eventually('the new bridge', async () => ((await hubLog(root, ui)).split('"event":"bridge-connected","session":"impl-1"').length > 2 ? true : undefined));
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'are you back?', to: ['impl-1'] });
  const id = (sent.value as { message: { id: string } }).message.id;
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 45_000);
  const log = await hubLog(root, ui);
  assert.ok(!log.includes(`"inject-unconfirmed","session":"impl-1","id":"${id}"`), `injected at once, through the new process:\n${log.split('\n').filter((l) => /impl-1|bridge|inject/.test(l)).slice(-40).join('\n')}`);
});

test('an inject the harness never confirmed stays delivered, is logged, and is retried at the next idle', async (t) => {
  const root = await tempProject(t);
  // The retry needs an observed busy→idle transition, not a turn shorter than its hook processes' startup.
  const fake = await fakeClaude(t, { injectTimeoutMs: 1000, dropFirst: true, awaitSignals: true });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');

  // the first turn a launched session gets is its role clause, a hub notice with no topic: the fake drops it
  const clause = await eventually('the clause recorded', async () => /"event":"role-clause","session":"coord"[^\n]*"id":"([^"]+)"/.exec(await hubLog(root, ui))?.[1]);
  // An earlier attempt may have failed before the bridge connected; only this timeout proves the drop.
  await eventually('the dropped inject timed out', async () => ((await hubLog(root, ui)).includes(`"event":"inject-unconfirmed","session":"coord","id":"${clause}","error":"the mod did not confirm the turn within `) ? true : undefined));
  const injected = async () => (await hubLog(root, ui)).includes(`"event":"injected","id":"${clause}"`);
  await sleep(5 * Number(fake.env.CLAND_ADAPTER_POLL_MS)); // Negative: five idle polls must not retry.
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
  // A slow poll keeps restarted states on the hook/mod path; a long turn keeps busy observable during hook startup.
  const fake = await fakeClaude(t, { pollMs: 10_000, turnMs: 1000 });
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

test('a message for a session with no adapter stays delivered; an unknown session or harness is refused', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const unknownHarness = await ui.request({ type: 'session.launch', name: 'x', harness: 'nope' });
  assert.equal(unknownHarness.ok, false);
  assert.match(unknownHarness.error ?? '', /no adapter for harness "nope"/);
  const badRole = await ui.request({ type: 'session.launch', name: 'x', role: 'boss' });
  assert.match(badRole.error ?? '', /unknown role "boss"/);
  const attach = await ui.request({ type: 'session.attach', session: 'nobody' });
  assert.match(attach.error ?? '', /no session "nobody" was launched by this hub/);
  // a hook signal for a session the hub did not launch changes nothing
  const signal = await ui.request({ type: 'session.signal', session: 'nobody', event: 'turn-start' });
  assert.deepEqual(signal.value, { applied: false });

  // a session nobody launched (a spoke started by hand, with a role the human assigned): accepted is as far as its
  // messages go, its state unknown
  assert.equal((await ui.request({ type: 'role.set', session: 'plain', role: 'implementer' })).ok, true);
  const plain = await spawnSpoke({ discover: true, cwd: root, name: 'plain', sessionId: 'sess-plain' });
  t.after(() => plain.close());
  await presentAs(ui, 'plain', 'unknown');
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'hi', to: ['plain'] });
  const id = (sent.value as { message: { id: string } }).message.id;
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'delivered');
  await sleep(3 * Number(fake.env.CLAND_ADAPTER_POLL_MS)); // Negative: three idle polls cannot inject a message without an adapter.
  assert.ok(!ui.frames.some((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected'));
});


test('Claude discovery and watch share the default 30-second schedule, and stop works before the next pid arrives', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  // Prove the production default as resolved data, then exercise its schedule at a short override.
  const defaults = await startDaemon(t, root, { ...fake.env, CLAND_CLAUDE_AGENTS_MS: '' });
  const defaultUi = await connectUi(t, defaults.discovery);
  assert.match(await hubLog(root, defaultUi), /"event":"claude-schedule","agentsMs":30000/);
  defaultUi.close();
  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  // Keep the next discovery behind the stop request, so stop must work without a discovered pid.
  const agentsMs = 3000;
  const env = { ...fake.env, CLAND_CLAUDE_AGENTS_MS: String(agentsMs), CLAUDE_CONFIG_DIR: fake.home };
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  await sleep(6 * Number(fake.env.CLAND_ADAPTER_POLL_MS)); // Negative: an idle directory stays quiet across six polls.
  assert.equal((await fake.calls()).length, 0, 'an idle directory runs no CLI');
  await launch(ui, 'first');
  ui.close();
  assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
  const restarted = await startDaemon(t, root, env);
  const ui2 = await connectUi(t, restarted.discovery);
  await eventually('first re-found from the shared snapshot', async () => (await status(ui2)).harnesses.find(p => p.name === 'first' && p.status === 'running'));
  const second = await launch(ui2, 'second');
  assert.equal(second.pid, null, 'the next launch does not bypass the schedule');
  assert.equal((await ui2.request({ type: 'session.stop', session: 'second' })).ok, true);
  const calls = await fake.calls();
  const polls = calls.filter(c => c.args[0] === 'agents');
  assert.equal(polls.length, 1, 'launch discovery and watch use one call');
  assert.equal(polls[0]?.configDir, fake.home);
  assert.ok(calls.some(c => c.args[0] === 'stop' && c.args[1] === second.harnessId));
  await eventually('the next scheduled agents call', async () => (await fake.calls()).filter(c => c.args[0] === 'agents').length >= 2 ? true : undefined);
  const scheduled = (await fake.calls()).filter(c => c.args[0] === 'agents');
  for (let i = 1; i < scheduled.length; i++) assert.ok(scheduled[i]!.at - scheduled[i - 1]!.at >= agentsMs, 'every agents call respects the resolved interval');
  assert.equal((await ui2.request({ type: 'session.stop', session: 'first' })).ok, true);
  const count = (await fake.calls()).length;
  await sleep(8 * Number(fake.env.CLAND_ADAPTER_POLL_MS)); // Negative: eight liveness polls cannot run the stopped agents watch.
  assert.equal((await fake.calls()).length, count, 'no CLI after the last watch ends');
});


test('a signed-out Claude directory is reported once, remains quiet across restart, and recovers only on explicit success', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { lateBg: true });
  const env = { ...fake.env, CLAUDE_CONFIG_DIR: fake.home };
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'sender', role: 'coordinator' });
  t.after(() => sender.close());
  await sender.waitForPresence(['sender']);
  const running = await launch(ui, 'running');
  await writeFile(join(fake.home, 'agents-hold'), '');
  const inFlight = await eventually('a poll is in flight before the signed-out latch', () =>
    readFile(join(fake.home, 'agents-started'), 'utf8').catch(() => undefined));
  await sender.call('send', { to: ['running'], kind: 'progress', text: 'waiting input' });
  const input = await ui.waitFor(f => f.type === 'message' && (f.message as { from: string; text: string }).from === 'sender' && (f.message as { text: string }).text === 'waiting input');
  const inputId = (input.message as { id: string }).id;
  await ui.request({ type: 'session.signal', session: 'running', launch: running.sessionId, event: 'turn-start', payload: { prompt_id: 'auth-turn', ids: [inputId] } });
  await writeFile(join(fake.home, 'logged-out'), '');
  const signal = { type: 'session.signal', session: 'running', launch: running.sessionId, event: 'turn-end', payload: { prompt_id: 'auth-turn', hook_event_name: 'StopFailure', error: 'authentication_failed' } };
  assert.equal((await ui.request(signal)).ok, true);
  assert.equal((await ui.request(signal)).ok, true);
  await ui.waitFor(f => f.type === 'message' && (f.message as { kind?: string }).kind === 'claude-signed-out');
  await sender.waitForEvent(e => e.params.content.includes(`signed out: ${fake.home}; see the Agents notice`));
  await sleep(100);
  assert.equal(sender.events.filter(e => e.params.content.includes(`signed out: ${fake.home}; see the Agents notice`)).length, 1, 'one sender delivery per latched directory');
  // The latch prevents new polls; a child admitted before it can log its call later.
  // Drain that observed child before counting, including across the hub restart.
  await writeFile(join(fake.home, 'agents-release'), '');
  await eventually('the pre-latch child finishes', () =>
    readFile(join(fake.home, 'agents-finished'), 'utf8').catch(() => undefined));
  const count = (await fake.calls()).length;
  await sleep(4 * Number(fake.env.CLAND_ADAPTER_POLL_MS)); // Negative: a latched watch stays silent for four polls.
  assert.equal((await fake.calls()).length, count, 'the latched watch makes no CLI calls');
  assert.equal(await readFile(join(fake.home, 'agents-started'), 'utf8'), inFlight, 'the latch admits no new poll child');
  ui.close();
  assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
  const restarted = await startDaemon(t, root, env);
  const ui2 = await connectUi(t, restarted.discovery);
  await sleep(3 * Number(fake.env.CLAND_ADAPTER_POLL_MS)); // Negative: three idle polls cannot lift the signed-out latch.
  assert.equal((await fake.calls()).length, count, 'latched startup resume makes no CLI calls');
  assert.equal(await readFile(join(fake.home, 'agents-started'), 'utf8'), inFlight, 'restart admits no new poll child');
  await ui2.request({ ...signal, event: 'turn-start', payload: { prompt_id: 'auth-turn', ids: [inputId] } });
  await ui2.request(signal);
  await sleep(100);
  assert.equal(sender.events.filter(e => e.params.content.includes(`signed out: ${fake.home}; see the Agents notice`)).length, 1, 'sender deduplication survives restart');
  const rows = (await ui2.request({ type: 'session.list' })).value as { processes: Array<{ name: string; status: string; state: string; stateReason?: string }> };
  assert.ok(rows.processes.some(p => p.name === 'running' && p.status === 'running' && p.state === 'unknown' && p.stateReason === 'signed-out'));
  for (const name of ['failed-one', 'failed-two']) {
    const failed = await ui2.request({ type: 'session.launch', harness: 'claude-code', name });
    assert.equal(failed.ok, false);
    assert.match(failed.error ?? '', /expired/);
  }
  await flushProjectLogs(t, root);
  const records = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records.filter(r => r.event === 'claude-signed-out').length, 1);
  const history = (await ui2.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ kind?: string; text: string }> };
  const notices = history.messages.filter(m => m.kind === 'claude-signed-out');
  assert.equal(notices.length, 1);
  assert.equal(history.messages.filter(m => m.kind === 'turn-failed').length, 0, 'no generic human failure duplicate');
  assert.ok(notices[0]?.text.includes(fake.home));
  assert.ok(notices[0]?.text.includes('CLAUDE_CONFIG_DIR='));
  assert.ok(notices[0]?.text.includes('claude auth login'));
  await unlink(join(fake.home, 'logged-out'));
  const recovered = await ui2.request({ type: 'session.launch', harness: 'claude-code', name: 'recovered' });
  assert.equal(recovered.ok, true, recovered.error);
  assert.match((recovered.value as { process: { warning: string } }).process.warning, /latched signed out/);
  const before = (await fake.calls()).filter(c => c.args[0] === 'agents').length;
  await eventually('polling resumes after the explicit success', async () => (await fake.calls()).filter(c => c.args[0] === 'agents').length > before ? true : undefined);
  assert.ok(!(await fake.calls()).some(c => ['auth', 'doctor'].includes(c.args[0] ?? '')));
  const recoveredProcess = (recovered.value as { process: Harness }).process;
  const again = { ...signal, session: 'recovered', launch: recoveredProcess.sessionId };
  await ui2.request(again);
  const latched = (await fake.calls()).filter(c => c.args[0] === 'agents').length;
  await ui2.request({ ...again, payload: { hook_event_name: 'StopFailure', error: 'server_error' } });
  await sleep(3 * Number(fake.env.CLAND_ADAPTER_POLL_MS)); // Negative: three idle polls cannot lift the signed-out latch.
  assert.equal((await fake.calls()).filter(c => c.args[0] === 'agents').length, latched, 'another StopFailure never lifts the latch');
  await ui2.request({ ...again, payload: { hook_event_name: 'Stop' } });
  await eventually('a pushed success resumes polling', async () => (await fake.calls()).filter(c => c.args[0] === 'agents').length > latched ? true : undefined);
});

test('an expired --bg launch latches a directory once without any discovery or retry calls', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  await writeFile(join(fake.home, 'logged-out'), '');
  const { discovery } = await startDaemon(t, root, { ...fake.env, CLAUDE_CONFIG_DIR: fake.home });
  const ui = await connectUi(t, discovery);
  for (const name of ['one', 'two']) assert.equal((await ui.request({ type: 'session.launch', harness: 'claude-code', name })).ok, false);
  await sleep(3 * Number(fake.env.CLAND_ADAPTER_POLL_MS)); // Negative: a failed launch never starts discovery.
  assert.deepEqual((await fake.calls()).map(c => c.args[0]), ['--bg', '--bg']);
  await flushProjectLogs(t, root);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.equal(journal.split('\n').filter(line => line.includes('"event":"claude-signed-out"')).length, 1);
});
