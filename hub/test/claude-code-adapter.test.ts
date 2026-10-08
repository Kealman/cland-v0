// The Claude Code adapter (spec 4.2, 4.3; #24) against a fake Claude Code at the harness process boundary: a
// real daemon in a temporary project launches the fake (`test/fakes/claude-code/claude`, first on the PATH),
// which starts the real spoke, runs the real `cland hook` commands and loads the real cland mod. The UI side is a
// scripted client on the daemon's Unix socket. Nothing inside the hub is mocked or read directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, killDaemon, sleep, spawnSpoke, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Presence = { name: string; sessionId: string; state: string; status: string | null; role: string | null };
type Harness = { name: string; harness: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string; attach: string | null; model: string | null; usage?: Record<string, unknown> };
type Status = { sessions: Presence[]; harnesses: Harness[] };
type StateEvent = { type: 'session.state'; session: string; state: string; source: string };

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

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

test('a launched Claude Code session: the spoke connects, a UI message goes queued → delivered → injected, the reply comes back, and the state follows the hooks and the mod', async (t) => {
  const root = await tempProject(t);
  // the polled fallback slowed down: every state asserted here must come from a push (a hook, the mod)
  // and `--bg` returns after the session's SessionStart hook already posted (seen with the real harness)
  // a turn long enough that its busy is still news when a hook's process (a node start) reports it
  const fake = await fakeClaude(t, { pollMs: 10_000, lateBg: true, turnMs: 1000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  const launchMark = ui.frames.length;
  const launched = await launch(ui, 'coord', { role: 'coordinator', model: 'claude-fake-1' });
  assert.match(await hubLog(root), /"event":"session-launched".*"early":1/, 'the early SessionStart was kept and replayed');
  // the session's first turn is its role clause, injected as soon as the launch's bridge and SessionStart are in
  await clauseAnswered(ui, 'coord');
  await aTurn(ui, 'coord', launchMark);
  assert.equal(launched.harness, 'claude-code');
  assert.equal(launched.status, 'running');
  assert.match(launched.harnessId ?? '', /^[0-9a-f]{8}$/);
  assert.equal(typeof launched.pid, 'number');
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
  const h = await eventually('usage', async () => (await status(ui)).harnesses.find((x) => x.name === 'coord' && x.usage));
  assert.equal(h.model, 'claude-fake-1');
  assert.deepEqual(h.usage, { model: 'claude-fake-1', inputTokens: 10, outputTokens: 2 });

  // a permission prompt: waiting for approval, from the PermissionRequest hook, whatever the model says of itself
  await ui.request({ type: 'topic.send', topic: 'general', text: 'this one needs approval' });
  const waiting = await presentAs(ui, 'coord', 'waiting for approval');
  assert.equal(waiting.status, 'idle', "the model's own status line says idle");
  const event = stateEvents(ui, 'coord').findLast((e) => e.state === 'waiting for approval');
  assert.equal(event?.source, 'hook');
  assert.ok(!stateEvents(ui, 'coord').some((e) => e.source === 'status'), 'no state ever came from the status tool');
  const [session] = await fake.sessions();
  process.kill(session?.pid as number, 'SIGUSR1'); // the human approves in the harness's TUI
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: this one needs approval', 15_000);
  await presentAs(ui, 'coord', 'idle');
  const after = stateEvents(ui, 'coord').map((e) => e.state);
  assert.deepEqual(after.slice(after.lastIndexOf('waiting for approval')), ['waiting for approval', 'busy', 'idle']);

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
  const fake = await fakeClaude(t, { lateBg: true });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  await killDaemon(launched.pid as number);
  const gone = await eventually('the process gone', async () => (await status(ui)).harnesses.find((x) => x.name === 'impl-1' && x.status === 'exited'));
  assert.equal(gone.state, 'unknown');
  assert.equal(gone.attach, null);
  const event = await ui.waitFor((f) => f.type === 'session.state' && f.session === 'impl-1' && f.state === 'unknown');
  assert.equal(event.source, 'process');
  const logged = (await hubLog(root)).split('\n').filter((l) => l.includes('"harness-exited"'));
  assert.equal(logged.length, 1, 'one log event for the crash');
  assert.match(logged[0] as string, /"session":"impl-1"/);

  // the same name again: its hooks and its mod, arriving before the launch returns, belong to the new process
  const again = await launch(ui, 'impl-1', { role: 'implementer' });
  assert.notEqual(again.sessionId, launched.sessionId);
  await presentAs(ui, 'impl-1', 'idle');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'are you back?', to: ['impl-1'] });
  const id = (sent.value as { message: { id: string } }).message.id;
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  assert.ok(!(await hubLog(root)).includes(`"inject-unconfirmed","session":"impl-1","id":"${id}"`), 'injected at once, through the new process');
});

test('an inject the harness never confirmed stays delivered, is logged, and is retried at the next idle', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { injectTimeoutMs: 1000, dropFirst: true });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');

  // the first turn a launched session gets is its role clause, a hub notice with no topic: the fake drops it
  const clause = await eventually('the clause recorded', async () => /"event":"role-clause","session":"coord"[^\n]*"id":"([^"]+)"/.exec(await hubLog(root))?.[1]);
  await eventually('the unconfirmed inject logged', async () => ((await hubLog(root)).includes(`"event":"inject-unconfirmed","session":"coord","id":"${clause}"`) ? true : undefined));
  const injected = async () => (await hubLog(root)).includes(`"event":"injected","id":"${clause}"`);
  await sleep(1000); // polls keep finding the session idle: that is no new idle, nothing is retried
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
  // a slow poll: after the restart the states must come from the hooks and the mod, not the fallback
  const fake = await fakeClaude(t, { pollMs: 10_000, turnMs: 1000 });
  const first = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
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
  assert.equal(resumed.pid, launched.pid);
  assert.equal(resumed.sessionId, launched.sessionId);
  // a late hook of the launch's clause turn can make the row idle before the resume itself is logged
  await eventually('the resume logged', async () => (/"event":"session-resumed","session":"coord"/.test(await hubLog(root)) ? true : undefined));
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
  await sleep(500);
  assert.ok(!ui.frames.some((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected'));
});
