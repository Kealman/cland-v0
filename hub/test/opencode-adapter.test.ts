// The OpenCode adapter (spec 4.2, 4.3; #27) against a fake OpenCode server at the harness boundary, HTTP plus SSE:
// a real daemon in a temporary project launches the fake (`test/fakes/opencode/opencode`, first on the PATH) as
// `opencode serve`; the fake reads the config the adapter generated and starts the real spoke, which connects to
// the real hub. The UI side is a scripted client on the daemon's Unix socket. Nothing inside the hub is mocked.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clandWithEnv, clauseAnswered, connectUi, eventually, killDaemon, spawnSpoke, startDaemon, tempProject, type FrameClient, NO_PS } from './harness.ts';

const FAKE_OPENCODE_DIR = fileURLToPath(new URL('./fakes/opencode', import.meta.url));

type Presence = { name: string; sessionId: string; state: string; role: string | null };
type Harness = { name: string; harness: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string; attach: string | null; model: string | null; usage?: Record<string, unknown> };
type Status = { sessions: Presence[]; harnesses: Harness[] };
type StateEvent = { type: 'session.state'; session: string; state: string; source: string };

type FakeOpenCode = {
  env: Record<string, string>;
  home: string;
  /** What the fake's server for `session` (ses_…) received as prompts: `prompt <delivery>[ (running)]: <text>`. */
  prompts: (session: string) => Promise<string>;
  servers: () => Promise<Array<{ pid: number; url: string; cwd: string; config: string | null }>>;
};

async function fakeOpenCode(t: TestContext, timings: { pollMs?: number; injectTimeoutMs?: number; turnMs?: number } = {}): Promise<FakeOpenCode> {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-opencode-')));
  const env = {
    PATH: `${FAKE_OPENCODE_DIR}:${process.env.PATH ?? ''}`,
    FAKE_OPENCODE_HOME: home,
    FAKE_OPENCODE_TURN_MS: String(timings.turnMs ?? 300),
    CLAND_ADAPTER_POLL_MS: String(timings.pollMs ?? 200),
    CLAND_INJECT_TIMEOUT_MS: String(timings.injectTimeoutMs ?? 5000),
  };
  const servers = async () => {
    const files = await readdir(join(home, 'servers')).catch(() => [] as string[]);
    const out = [];
    for (const f of files) out.push(JSON.parse(await readFile(join(home, 'servers', f), 'utf8').catch(() => 'null')));
    return out.filter(Boolean);
  };
  t.after(async () => {
    for (const s of await servers()) await killDaemon(s.pid);
    await rm(home, { recursive: true, force: true });
  });
  return { env, home, servers, prompts: (session) => readFile(join(home, 'prompts', `${session}.log`), 'utf8').catch(() => '') };
}

async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status' });
  assert.equal(r.ok, true, r.error);
  return r.value as Status;
}

// The sessions here run as the Coordinator: the fake answers every turn to the human, which only the Coordinator
// may (the hub's permission table, spec 4.4).
async function launch(ui: FrameClient, name: string, extra: Record<string, unknown> = {}): Promise<Harness> {
  const r = await ui.request({ type: 'session.launch', name, harness: 'opencode', ...extra }, 30_000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: Harness }).process;
}

const stateEvents = (ui: FrameClient, session: string): StateEvent[] => ui.frames.filter((f): f is StateEvent => f.type === 'session.state' && f.session === session);

const presentAs = (ui: FrameClient, name: string, state: string) =>
  eventually(`${name} present as ${state}`, async () => {
    const p = (await status(ui)).sessions.find((s) => s.name === name);
    return p?.state === state ? p : undefined;
  });

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

/** The human writes in General to the session (General alone goes to the coordinator role). */
async function sendGeneral(ui: FrameClient, text: string, to: string[] = ['impl']): Promise<string> {
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text, to });
  assert.equal(sent.ok, true, sent.error);
  return (sent.value as { message: { id: string } }).message.id;
}

const replyTo = (ui: FrameClient, from: string, text: string) => ui.waitFor((f) => f.type === 'message' && (f.message as { from: string; text: string }).from === from && (f.message as { text: string }).text === text, 15_000);

/** The API a human's OpenCode TUI would use to answer: the fake server's own reply endpoints. */
async function api(h: Harness, root: string, method: string, path: string, body?: unknown): Promise<unknown> {
  const password = (await readFile(join(root, '.cland', 'opencode', h.name, 'password'), 'utf8')).trim();
  const res = await fetch(`${h.harnessId}${path}`, {
    method,
    headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(res.ok, true, `${method} ${path}: ${res.status}`);
  return res.json();
}

test('a launched OpenCode session: its own server, the spoke connects, a UI message goes queued → delivered → injected, the reply comes back, the state follows the event stream', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  // no model asked for: a free one the server lists
  const launched = await launch(ui, 'impl', { role: 'coordinator' });
  assert.equal(launched.harness, 'opencode');
  assert.equal(launched.status, 'running');
  assert.equal(launched.model, 'opencode/fake-free');
  assert.match(launched.harnessId ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(launched.harnessSessionId ?? '', /^ses_/);
  const [server] = await fake.servers();
  assert.equal(server?.pid, launched.pid, 'the process table holds the server pid');
  assert.equal(server?.url, launched.harnessId);
  assert.equal(server?.cwd, root);

  // the spoke came from OpenCode's own config, generated outside the committed project files
  assert.equal(server?.config, join(root, '.cland', 'opencode', 'impl', 'opencode.json'));
  const config = JSON.parse(await readFile(server?.config as string, 'utf8')) as { mcp: { servers: { cland: { type: string; environment: Record<string, string> } } } };
  assert.equal(config.mcp.servers.cland.type, 'local');
  assert.equal(config.mcp.servers.cland.environment.CLAND_SESSION_ID, launched.sessionId);
  assert.equal(config.mcp.servers.cland.environment.CLAND_DELIVERY, 'adapter');
  assert.equal(await readFile(join(root, '.cland', 'opencode', '.gitignore'), 'utf8').then((s) => s.split('\n').includes('*')), true);
  assert.equal((await stat(join(root, '.cland', 'opencode', 'impl', 'password'))).mode & 0o077, 0, 'the password file is private');
  // the first turn is the role clause the hub delivered
  await clauseAnswered(ui, 'impl');
  const present = await presentAs(ui, 'impl', 'idle');
  assert.equal(present.role, 'coordinator');
  assert.equal(present.sessionId, launched.sessionId);

  // session.list: the session, its state, and the capability table with its heuristic waiting states
  const list = (await ui.request({ type: 'session.list' })).value as { processes: Harness[]; adapters: Record<string, unknown> };
  assert.equal(list.processes.find((p) => p.name === 'impl')?.state, 'idle');
  assert.deepEqual(list.adapters.opencode, {
    history: 'none',
    usage: 'reliable',
    setModel: 'none',
    approvalRelay: 'none',
    states: { busy: 'reliable', idle: 'reliable', 'waiting for approval': 'heuristic', 'waiting for human': 'heuristic' },
  });

  // attach: the OpenCode TUI against that server and session; the password comes from its file, not the command line.
  // The TUI is started in the session's directory, whatever the attaching terminal's: a TUI in another directory makes
  // the server open an instance there, whose MCP servers start a second spoke for the session (T-42's run).
  const attach = (await ui.request({ type: 'session.attach', session: 'impl' })).value as { command: string };
  assert.equal(attach.command, launched.attach);
  assert.equal(attach.command, `OPENCODE_PASSWORD="$(cat '${join(root, '.cland', 'opencode', 'impl', 'password')}')" opencode --server ${launched.harnessId} --session ${launched.harnessSessionId} '${root}'`);
  const tuiOut = await new Promise<string>((resolve) => execFile('sh', ['-c', attach.command], { cwd: tmpdir(), env: { ...process.env, ...fake.env } }, (_e, stdout, stderr) => resolve(stdout + stderr)));
  assert.equal(tuiOut, `fake opencode TUI on ${launched.harnessId} session ${launched.harnessSessionId} (impl) in ${root}\n`);

  // the human writes in General: the prompt API admits it (injected), the answer comes through the spoke
  const id = await sendGeneral(ui, 'Reply with the single word pong');
  const stages = () => ui.frames.filter((f) => f.type === 'delivery' && f.message === id).map((f) => f.stage);
  await eventually('injected', () => (stages().includes('injected') ? true : undefined));
  assert.deepEqual(stages(), ['delivered', 'injected']);
  const reply = (await replyTo(ui, 'impl', 'pong: Reply with the single word pong')) as { message: { topic: string; replyTo?: string } };
  assert.equal(reply.message.topic, 'general');
  assert.equal(reply.message.replyTo, id);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ id: string; stage?: string }> };
  assert.equal(history.messages.find((m) => m.id === id)?.stage, 'injected');
  // queued (the session was idle), as the envelope with the line that names the way back
  const prompts = await fake.prompts(launched.harnessSessionId as string);
  assert.match(prompts, /^prompt queue: <channel source="cland" from="hub" from_kind="hub"[^\n]*>\ncland hub: you hold the role Coordinator/);
  assert.match(prompts, /\nprompt queue: <channel source="cland" from="human" from_kind="human"[^\n]* msg_id="[^"]+"[^\n]* topic="general" topic_title="General">\nReply with the single word pong\n<\/channel>\nTo answer, call the cland `send` tool/);



  // busy during the turn, idle after, from the event stream
  await presentAs(ui, 'impl', 'idle');
  const turn = stateEvents(ui, 'impl').map((e) => `${e.state}/${e.source}`);
  assert.ok(turn.includes('busy/sse'), `busy came from the stream: ${JSON.stringify(turn)}`);
  assert.equal(turn.at(-1), 'idle/sse');

  // the message's usage, from session.step.ended
  const h = await eventually('usage', async () => (await status(ui)).harnesses.find((x) => x.name === 'impl' && x.usage));
  assert.deepEqual(h.usage, {
    model: 'opencode/fake-free',
    total: { totalTokens: 38, inputTokens: 20, outputTokens: 4, reasoningTokens: 2, cacheReadTokens: 8, cacheWriteTokens: 6, cost: 0.5 },
    last: { totalTokens: 19, inputTokens: 10, outputTokens: 2, reasoningTokens: 1, cacheReadTokens: 4, cacheWriteTokens: 3, cost: 0.25 },
  });

  // stop: the server ends, the row says stopped, the state is unknown
  const stopped = (await ui.request({ type: 'session.stop', session: 'impl' }, 15_000)).value as { process: Harness };
  assert.equal(stopped.process.status, 'stopped');
  assert.equal(stopped.process.state, 'unknown');
  assert.deepEqual(await fake.servers(), []);
});

test('a launch without a model prefers big-pickle over a listed but deprecated free model', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await startDaemon(t, root, { ...fake.env, FAKE_OPENCODE_DEPRECATED_FIRST: '1' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await launch(ui, 'impl', { role: 'coordinator' });
  assert.equal(launched.model, 'opencode/big-pickle');
  await clauseAnswered(ui, 'impl');
  await presentAs(ui, 'impl', 'idle');
  await sendGeneral(ui, 'does the default answer?');
  await replyTo(ui, 'impl', 'pong: does the default answer?');
});

test('a no-model OpenCode launch waits for big-pickle after a partial cold catalog', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await startDaemon(t, root, { ...fake.env, FAKE_OPENCODE_STAGED_CATALOG: '1' });
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'impl');
  assert.equal(launched.model, 'opencode/big-pickle');
});

test('a failed OpenCode turn is recorded in Agents and the inbox and reported to the sender', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForEvent((e) => e.params.meta?.kind === 'role');
  const launched = await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  // Wait for the launch's role-clause turn to finish before sending the failing work.
  await eventually('clause turn ended', () => stateEvents(ui, 'impl').some((e) => e.state === 'busy') && stateEvents(ui, 'impl').at(-1)?.state === 'idle' ? true : undefined);
  const sent = await coord.call<{ ok: boolean }>('send', { to: ['impl'], text: 'fail this turn' });
  assert.equal(sent.ok, true);
  const expected = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
  await ui.waitFor((f) => f.type === 'message' && (f.message as { kind?: string; text: string }).kind === 'turn-failed' && (f.message as { text: string }).text === expected);
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ kind?: string; text: string }> };
  assert.equal(history.messages.filter((m) => m.kind === 'turn-failed' && m.text === expected).length, 1);
  const inbox = (await ui.request({ type: 'inbox.list' })).value as { notifications: Array<{ kind: string; session?: string; text: string }> };
  assert.ok(inbox.notifications.some((n) => n.kind === 'turn-failed' && n.session === 'impl' && n.text === expected));
  await coord.waitForEvent((e) => e.params.content.includes(expected));
  assert.equal((await status(ui)).harnesses.find((h) => h.name === launched.name)?.status, 'running');
});

test('OpenCode failure attribution follows delivered inbox items when two idle admissions queue separate turns', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await startDaemon(t, root, { ...fake.env, FAKE_OPENCODE_START_DELAY_MS: '1000' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'sender', role: 'reviewer' });
  t.after(async () => { await coord.close(); await sender.close(); });
  await coord.waitForEvent((e) => e.params.meta?.kind === 'role');
  await sender.waitForEvent((e) => e.params.meta?.kind === 'role');
  const launched = await launch(ui, 'impl', { role: 'implementer' });
  await eventually('clause turn ended', () => stateEvents(ui, 'impl').some((e) => e.state === 'busy') && stateEvents(ui, 'impl').at(-1)?.state === 'idle' ? true : undefined);
  await coord.call('send', { to: ['impl'], text: 'first queued turn succeeds' });
  await sender.call('send', { to: ['impl'], text: 'fail this turn' });
  const expected = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
  await sender.waitForEvent((e) => e.params.content.includes(expected));
  assert.equal(coord.events.some((e) => e.params.content.includes(expected)), false, 'the sender of the successful first turn gets no failure note');
  const prompts = (await fake.prompts(launched.harnessSessionId as string)).split('\n').filter((line) => line.startsWith('prompt '));
  assert.match(prompts[1] as string, /^prompt queue:/);
  assert.match(prompts[2] as string, /^prompt queue \(running\):/);
});

test('OpenCode forgets prior execution inputs when completion is missed during an SSE outage', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t, { turnMs: 1000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'sender', role: 'reviewer' });
  t.after(async () => { await coord.close(); await sender.close(); });
  const launched = await launch(ui, 'impl', { role: 'implementer' });
  await eventually('clause turn ended', () => stateEvents(ui, 'impl').some((e) => e.state === 'busy') && stateEvents(ui, 'impl').at(-1)?.state === 'idle' ? true : undefined);
  await coord.call('send', { to: ['impl'], text: 'successful turn before outage' });
  await presentAs(ui, 'impl', 'busy');
  await api(launched, root, 'POST', '/test/stream', { paused: true });
  await eventually('execution completed while stream paused', async () => {
    const active = await api(launched, root, 'GET', '/api/session/active') as { data: Record<string, unknown> };
    return Object.keys(active.data).length === 0 ? true : undefined;
  });
  await api(launched, root, 'POST', '/test/stream', { paused: false });
  await presentAs(ui, 'impl', 'idle'); // reconnect snapshot, not the missed completion
  await sender.call('send', { to: ['impl'], text: 'fail this turn' });
  const expected = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
  await sender.waitForEvent((e) => e.params.content.includes(expected));
  assert.equal(coord.events.some((e) => e.params.content.includes(expected)), false);
});

test('a message sent while the session works steers the running turn; one sent while idle is queued', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl', { role: 'coordinator', model: 'opencode/fake-paid' });
  assert.equal(launched.model, 'opencode/fake-paid');
  await clauseAnswered(ui, 'impl');
  await presentAs(ui, 'impl', 'idle');
  const clauseTurn = stateEvents(ui, 'impl').length;

  const first = await sendGeneral(ui, 'take your time with this one');
  await presentAs(ui, 'impl', 'busy');
  const second = await sendGeneral(ui, 'and this too');
  for (const id of [first, second]) await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await replyTo(ui, 'impl', 'pong: take your time with this one');
  await replyTo(ui, 'impl', 'pong: and this too');
  await presentAs(ui, 'impl', 'idle');
  const prompts = (await fake.prompts(launched.harnessSessionId as string)).split('\n').filter((l) => l.startsWith('prompt '));
  // the role clause was the first prompt
  assert.match(prompts[1] as string, /^prompt queue: /);
  assert.match(prompts[2] as string, /^prompt steer \(running\): /, 'the second steered the running turn');
  // one turn answered both: busy once, then idle
  const states = stateEvents(ui, 'impl').slice(clauseTurn).map((e) => e.state);
  assert.deepEqual(states.slice(states.indexOf('busy')), ['busy', 'idle']);
});

test('a pending permission is waiting for approval within one event, and the reply brings the turn back; a form is waiting for human', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl', { role: 'coordinator' });
  await clauseAnswered(ui, 'impl');
  await presentAs(ui, 'impl', 'idle');
  const clauseTurn = stateEvents(ui, 'impl').length;

  await sendGeneral(ui, 'this one needs approval');
  await presentAs(ui, 'impl', 'waiting for approval');
  const asked = stateEvents(ui, 'impl').slice(clauseTurn).map((e) => e.state);
  // permission.asked is the event right after busy: no state in between
  assert.deepEqual(asked.slice(asked.indexOf('busy')), ['busy', 'waiting for approval']);
  const pending = (await api(launched, root, 'GET', `/api/session/${launched.harnessSessionId}/permission`)) as { data: Array<{ id: string }> };
  assert.equal(pending.data.length, 1);
  // the human approves in the TUI (the reply endpoint): the turn goes on, then ends
  await api(launched, root, 'POST', `/api/session/${launched.harnessSessionId}/permission/${pending.data[0]?.id}/reply`, { decision: 'once' });
  await replyTo(ui, 'impl', 'pong: this one needs approval');
  await presentAs(ui, 'impl', 'idle');
  const after = stateEvents(ui, 'impl').map((e) => e.state);
  assert.deepEqual(after.slice(after.lastIndexOf('waiting for approval')), ['waiting for approval', 'busy', 'idle']);

  await sendGeneral(ui, 'this one needs a form');
  await presentAs(ui, 'impl', 'waiting for human');
  const forms = (await api(launched, root, 'GET', `/api/session/${launched.harnessSessionId}/form`)) as { data: Array<{ id: string }> };
  await api(launched, root, 'DELETE', `/api/session/${launched.harnessSessionId}/form/${forms.data[0]?.id}`);
  await replyTo(ui, 'impl', 'pong: this one needs a form');
  await presentAs(ui, 'impl', 'idle');
  const formStates = stateEvents(ui, 'impl').map((e) => e.state);
  assert.deepEqual(formStates.slice(formStates.lastIndexOf('waiting for human')), ['waiting for human', 'busy', 'idle']);
  assert.ok(stateEvents(ui, 'impl').every((e) => e.source === 'sse' || e.source === 'resume'), 'every state came from the event stream');
});

test('a killed OpenCode server: the state turns unknown and the hub logs it once', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl', { role: 'coordinator' });
  await presentAs(ui, 'impl', 'idle');

  await killDaemon(launched.pid as number);
  // the slow poll is not what notices: the event stream ends with its server
  const gone = await eventually('the server gone', async () => (await status(ui)).harnesses.find((x) => x.name === 'impl' && x.status === 'exited'), 5000);
  assert.equal(gone.state, 'unknown');
  assert.equal(gone.attach, null);
  const event = await ui.waitFor((f) => f.type === 'session.state' && f.session === 'impl' && f.state === 'unknown');
  assert.equal(event.source, 'process');
  const logged = (await hubLog(root)).split('\n').filter((l) => l.includes('"harness-exited"'));
  assert.equal(logged.length, 1, 'one log event for the crash');
  assert.match(logged[0] as string, /"session":"impl"/);

  // resume with relaunch: a new server on the same session, which the old messages reach
  const resumed = (await ui.request({ type: 'session.resume', session: 'impl', relaunch: true }, 30_000)).value as { found: boolean; process: Harness };
  assert.equal(resumed.found, true);
  assert.equal(resumed.process.harnessSessionId, launched.harnessSessionId);
  assert.notEqual(resumed.process.pid, launched.pid);
  await presentAs(ui, 'impl', 'idle');
  const id = await sendGeneral(ui, 'are you back?');
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await replyTo(ui, 'impl', 'pong: are you back?');
});

test('after a hub restart, resume re-finds the OpenCode server and session through the process table and the event stream goes on', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const first = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await launch(ui, 'impl', { role: 'coordinator' });
  await presentAs(ui, 'impl', 'idle');
  ui.close();

  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  assert.equal((await fake.servers()).length, 1, 'the server outlives the hub');
  const second = await startDaemon(t, root, fake.env);
  const ui2 = await connectUi(t, second.discovery);
  assert.equal((await ui2.request({ type: 'subscribe' })).ok, true);

  const resumed = await eventually('resumed', async () => (await status(ui2)).harnesses.find((x) => x.name === 'impl' && x.state === 'idle'));
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.pid, launched.pid);
  assert.equal(resumed.harnessId, launched.harnessId);
  assert.equal(resumed.harnessSessionId, launched.harnessSessionId);
  assert.equal(resumed.attach, launched.attach, 'attach still points at the same server and session');
  assert.match(await hubLog(root), /"event":"session-resumed","session":"impl"/);
  await presentAs(ui2, 'impl', 'idle');

  const id = await sendGeneral(ui2, 'still there?');
  await ui2.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await replyTo(ui2, 'impl', 'pong: still there?');
  await presentAs(ui2, 'impl', 'idle');
  assert.ok(stateEvents(ui2, 'impl').some((e) => e.state === 'busy' && e.source === 'sse'), 'busy from the stream after the restart');
});


test('a shared artifact injected into OpenCode names its id and durable path in the envelope', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await launch(ui, 'impl', { role: 'coordinator' });
  await clauseAnswered(ui, 'impl');
  await presentAs(ui, 'impl', 'idle');
  const artifactResult = await ui.request({ type: 'artifact.create', kind: 'diagram', title: 'Merge flow', content: 'graph TD; A-->B', topic: 'general' });
  assert.equal(artifactResult.ok, true, artifactResult.error);
  const artifact = (artifactResult.value as { artifact: { id: string; path: string } }).artifact;
  await eventually('artifact envelope in OpenCode', async () => {
    const log = await fake.prompts(launched.harnessSessionId as string);
    return log.includes(`artifact_id="${artifact.id}"`) && log.includes(`artifact_path="${artifact.path}"`) ? true : undefined;
  });
});
