// The Claude Code adapter (spec 4.2, 4.3; #24) against a fake Claude Code at the harness process boundary: a
// real daemon in a temporary project launches the fake (`test/fakes/claude-code/claude`, first on the PATH),
// which starts the real spoke, runs the real `cland hook` commands and loads the real cland mod. The UI side is a
// scripted client on the daemon's Unix socket. Nothing inside the hub is mocked or read directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, connectUi, eventually, fakeClaude, killDaemon, sleep, spawnSpoke, startDaemon, tempProject, type FrameClient } from './harness.ts';

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
  const r = await ui.request({ type: 'session.launch', name, ...extra }, 30_000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: Harness }).process;
}

const stateEvents = (ui: FrameClient, session: string): StateEvent[] => ui.frames.filter((f): f is StateEvent => f.type === 'session.state' && f.session === session);

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
  const fake = await fakeClaude(t, { pollMs: 10_000, lateBg: true });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  const launched = await launch(ui, 'coord', { role: 'coordinator', model: 'claude-fake-1' });
  assert.match(await hubLog(root), /"event":"session-launched".*"early":1/, 'the early SessionStart was kept and replayed');
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
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'Reply with the single word pong' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: { id: string } }).message.id;
  const stages = async () => ui.frames.filter((f) => f.type === 'delivery' && f.message === id).map((f) => f.stage);
  await eventually('injected', async () => ((await stages()).includes('injected') ? true : undefined));
  assert.deepEqual(await stages(), ['delivered', 'injected']);
  const reply = (await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string }).from === 'coord', 15_000)) as { message: { text: string; topic: string; replyTo?: string } };
  assert.equal(reply.message.text, 'pong: Reply with the single word pong');
  assert.equal(reply.message.topic, 'general');
  assert.equal(reply.message.replyTo, id);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ id: string; stage?: string }> };
  assert.equal(history.messages.find((m) => m.id === id)?.stage, 'injected');
  // the prompt the harness got: the envelope, and the line that names the way back
  const prompt = await fake.log(launched.harnessId as string);
  assert.match(prompt, /submitted: <channel source="cland" from="human" from_kind="human"[^\n]* msg_id="[^"]+"[^\n]* topic="general" topic_title="General">\nReply with the single word pong\n<\/channel>\nTo answer, call the cland `send` tool with topic "general" and no `to`; text printed in this terminal reaches no one\./);

  // busy during the turn, idle after: pushed by the hooks and the mod
  await presentAs(ui, 'coord', 'idle');
  const turn = stateEvents(ui, 'coord').map((e) => e.state);
  assert.ok(turn.includes('busy'), `a busy state was published: ${JSON.stringify(turn)}`);
  assert.equal(turn.at(-1), 'idle');
  const busy = stateEvents(ui, 'coord').find((e) => e.state === 'busy');
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
  assert.ok(!(await hubLog(root)).includes('"inject-unconfirmed"'), 'injected at once, through the new process');
});

test('an inject the harness never confirmed stays delivered, is logged, and is retried at the next idle', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { injectTimeoutMs: 1000, dropFirst: true });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');

  const first = ((await ui.request({ type: 'topic.send', topic: 'general', text: 'first' })).value as { message: { id: string } }).message.id;
  await eventually('the unconfirmed inject logged', async () => ((await hubLog(root)).includes(`"event":"inject-unconfirmed","session":"coord","id":"${first}"`) ? true : undefined));
  const stageOf = async (id: string) => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ id: string; stage?: string }> }).messages.find((m) => m.id === id)?.stage;
  assert.equal(await stageOf(first), 'delivered', 'not confirmed: still delivered');
  await sleep(1000); // polls keep finding the session idle: that is no new idle, nothing is retried
  assert.equal(await stageOf(first), 'delivered');

  // the next turn ends idle: what waited is injected again, and this time confirmed
  await ui.request({ type: 'topic.send', topic: 'general', text: 'second' });
  await ui.waitFor((f) => f.type === 'delivery' && f.message === first && f.stage === 'injected', 15_000);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: first', 15_000);
  assert.equal(await stageOf(first), 'injected');
});

test('after a hub restart, resume re-finds the running session through the process table and state reporting continues', async (t) => {
  const root = await tempProject(t);
  // a slow poll: after the restart the states must come from the hooks and the mod, not the fallback
  const fake = await fakeClaude(t, { pollMs: 10_000 });
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
  assert.match(await hubLog(root), /"event":"session-resumed","session":"coord"/);
  await presentAs(ui2, 'coord', 'idle');

  // hooks and the mod reach the new hub: a message is injected and the turn's states arrive
  const sent = await ui2.request({ type: 'topic.send', topic: 'general', text: 'still there?' });
  const id = (sent.value as { message: { id: string } }).message.id;
  await ui2.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await ui2.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: still there?', 15_000);
  await presentAs(ui2, 'coord', 'idle');
  assert.ok(stateEvents(ui2, 'coord').some((e) => e.state === 'busy' && e.source !== 'poll'), 'busy pushed after the restart');
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

  // a session nobody launched (a spoke started by hand): accepted is as far as its messages go, its state unknown
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
