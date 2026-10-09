// The Codex adapter (spec 4.3; #26) against a fake Codex at the harness process boundary: a real daemon in a
// temporary project launches the fake (`test/fakes/codex/codex`, first on the PATH) as an app-server on a Unix
// socket; the fake speaks Codex's JSON-RPC over a WebSocket there and starts the real spoke from the `-c
// mcp_servers…` overrides. The UI side is a scripted client on the daemon's Unix socket. Nothing inside the hub is
// mocked or read directly.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clandWithEnv, connectUi, eventually, killDaemon, pidAlive, startDaemon, tempProject, type FrameClient } from './harness.ts';

const FAKE_CODEX_DIR = fileURLToPath(new URL('./fakes/codex', import.meta.url));

type Presence = { name: string; sessionId: string; state: string; status: string | null; role: string | null };
type Harness = { name: string; harness: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string; attach: string | null; model: string | null; usage?: Record<string, unknown> };
type Status = { sessions: Presence[]; harnesses: Harness[] };
type StateEvent = { type: 'session.state'; session: string; state: string; source: string };
type FakeServer = { pid: number; socket: string; argv: string[]; cwd: string };

type FakeCodex = {
  env: Record<string, string>;
  home: string;
  servers: () => Promise<FakeServer[]>;
  log: (pid: number) => Promise<string>;
  approve: () => Promise<void>;
  run: (command: string) => Promise<{ code: number; stdout: string; stderr: string }>;
};

async function fakeCodex(t: TestContext, timings: { pollMs?: number; injectTimeoutMs?: number; turnMs?: number } = {}): Promise<FakeCodex> {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-codex-')));
  const env = {
    PATH: `${FAKE_CODEX_DIR}:${process.env.PATH ?? ''}`,
    FAKE_CODEX_HOME: home,
    FAKE_CODEX_TURN_MS: String(timings.turnMs ?? 300),
    CLAND_ADAPTER_POLL_MS: String(timings.pollMs ?? 200),
    CLAND_INJECT_TIMEOUT_MS: String(timings.injectTimeoutMs ?? 5000),
  };
  const servers = async () => {
    const files = await readdir(join(home, 'servers')).catch(() => [] as string[]);
    const all = await Promise.all(files.map(async (f) => JSON.parse(await readFile(join(home, 'servers', f), 'utf8')) as FakeServer));
    return all.filter((s) => pidAlive(s.pid));
  };
  t.after(async () => {
    for (const s of await servers()) await killDaemon(s.pid);
    await rm(home, { recursive: true, force: true });
  });
  return {
    env,
    home,
    servers,
    log: (pid) => readFile(join(home, 'log', `${pid}.log`), 'utf8').catch(() => ''),
    approve: () => writeFile(join(home, 'approve'), ''),
    run: (command) =>
      new Promise((resolve) =>
        execFile('sh', ['-c', command], { env: { ...process.env, ...env }, encoding: 'utf8' }, (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr })),
      ),
  };
}

async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status' });
  assert.equal(r.ok, true, r.error);
  return r.value as Status;
}

async function launch(ui: FrameClient, name: string, extra: Record<string, unknown> = {}): Promise<Harness> {
  const r = await ui.request({ type: 'session.launch', name, harness: 'codex', ...extra }, 30_000);
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

const sendGeneral = async (ui: FrameClient, text: string, extra: Record<string, unknown> = {}): Promise<string> => {
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text, ...extra });
  assert.equal(sent.ok, true, sent.error);
  return (sent.value as { message: { id: string } }).message.id;
};

test('a launched Codex session: the app-server runs with the spoke, a UI message goes queued → delivered → injected, the reply comes back, and the state follows thread/status/changed', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  const launched = await launch(ui, 'coord', { role: 'coordinator', model: 'gpt-fake-mini' });
  assert.equal(launched.harness, 'codex');
  assert.equal(launched.status, 'running');
  assert.equal(launched.model, 'gpt-fake-mini');
  assert.equal(typeof launched.pid, 'number');
  assert.match(launched.harnessSessionId ?? '', /^[0-9a-f-]{36}$/, 'the thread id');
  assert.match(launched.harnessId ?? '', /\.sock$/, 'the socket');

  // the app-server got the spoke as an MCP server through -c overrides, and only those
  const [server] = await fake.servers();
  assert.ok(server, 'one fake app-server runs');
  assert.equal(server.pid, launched.pid);
  assert.deepEqual(server.argv.slice(0, 2), ['--listen', `unix://${launched.harnessId}`]);
  const overrides = server.argv.filter((_, i) => server.argv[i - 1] === '-c');
  assert.ok(overrides.every((o) => o.startsWith('mcp_servers.cland.')), JSON.stringify(overrides));
  assert.ok(overrides.includes(`mcp_servers.cland.env.CLAND_SESSION_NAME="coord"`));
  assert.ok(overrides.includes(`mcp_servers.cland.env.CLAND_SESSION_ID="${launched.sessionId}"`));
  assert.ok(overrides.includes('mcp_servers.cland.env.CLAND_DELIVERY="adapter"'));
  assert.ok(!overrides.some((o) => o.includes(discovery.secret)), 'no secret on the command line');

  // the spoke connected under the launch's name, role and session id; the clause turn ran and ended idle
  const present = await presentAs(ui, 'coord', 'idle');
  assert.equal(present.role, 'coordinator');
  assert.equal(present.sessionId, launched.sessionId);
  const firstLog = await fake.log(launched.pid as number);
  assert.match(firstLog, /turn\/start input/, 'the first turn is a plain input turn');
  assert.match(firstLog, /item: cland hub: you hold the role Coordinator in this project, shown to others as coord \[Coordinator\]/, 'the first turn carries the role clause from roles.toml');
  // ... so the hub records it as injected at the first hello and does not inject it a second time
  const clauses = (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter((l) => l.includes('"event":"role-clause"') && l.includes('"session":"coord"'));
  assert.equal(clauses.length, 1);
  assert.match(clauses[0] as string, /"reason":"assigned at launch \(first turn\)"/);
  assert.equal((firstLog.match(/you hold the role Coordinator/g) ?? []).length, 1, 'the clause was handed over once');

  // the human writes in General: injected as a hub_event tool output; the reply comes back
  const id = await sendGeneral(ui, 'Reply with the single word pong');
  const stages = () => ui.frames.filter((f) => f.type === 'delivery' && f.message === id).map((f) => f.stage);
  await eventually('injected', () => (stages().includes('injected') ? true : undefined));
  assert.deepEqual(stages(), ['delivered', 'injected']);
  const reply = (await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string }).from === 'coord', 15_000)) as { message: { text: string; topic: string; replyTo?: string } };
  assert.equal(reply.message.text, 'pong: Reply with the single word pong');
  assert.equal(reply.message.topic, 'general');
  assert.equal(reply.message.replyTo, id);
  const log = await fake.log(launched.pid as number);
  assert.match(log, /turn\/start toolOutput hub_event/);
  assert.match(log, /item: <channel source="cland" from="human" from_kind="human"[^\n]* topic="general" topic_title="General">\nReply with the single word pong\n<\/channel>\nTo answer, call the cland `send` tool/);

  // busy during the turn, idle after: all from the app-server
  await presentAs(ui, 'coord', 'idle');
  const turn = stateEvents(ui, 'coord');
  assert.ok(turn.some((e) => e.state === 'busy'), `busy was published: ${JSON.stringify(turn)}`);
  assert.equal(turn.at(-1)?.state, 'idle');
  assert.ok(turn.every((e) => e.source === 'app-server'), `every state came from the app-server: ${JSON.stringify(turn)}`);

  // usage: the thread's token counts and the account's rate limits
  const h = await eventually('usage', async () => (await status(ui)).harnesses.find((x) => x.name === 'coord' && (x.usage as { tokens?: unknown } | undefined)?.tokens));
  const usage = h.usage as { model: string; tokens: { last: { totalTokens: number } }; rateLimits: { primary: { usedPercent: number } } };
  assert.equal(usage.model, 'gpt-fake-mini');
  assert.equal(usage.tokens.last.totalTokens, 12);
  assert.equal(usage.rateLimits.primary.usedPercent, 6);
  assert.deepEqual(h.usage?.total, { totalTokens: 24, inputTokens: 8, outputTokens: 4, cacheReadTokens: 12, cacheWriteTokens: 0, reasoningTokens: 2 });
  assert.deepEqual(h.usage?.last, { totalTokens: 12, inputTokens: 4, outputTokens: 2, cacheReadTokens: 6, cacheWriteTokens: 0, reasoningTokens: 1 });

  // a command approval: waiting for approval from thread/status/changed, whatever the model says of itself
  const approvalId = await sendGeneral(ui, 'this one needs approval');
  const waiting = await presentAs(ui, 'coord', 'waiting for approval');
  assert.equal(waiting.status, 'idle', "the model's own status line says idle");
  // a message during the active turn is steered into it, and confirmed by turn/steer's result
  const steerId = await sendGeneral(ui, 'and this one while you wait');
  await ui.waitFor((f) => f.type === 'delivery' && f.message === steerId && f.stage === 'injected', 15_000);
  assert.match(await fake.log(launched.pid as number), /turn\/steer [0-9a-f-]+: <channel [^\n]*>\nand this one while you wait/);
  assert.equal((await status(ui)).sessions.find((s) => s.name === 'coord')?.state, 'waiting for approval', 'the steer does not change the state');
  await fake.approve(); // the human approves in the attached TUI
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: this one needs approval', 15_000);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: and this one while you wait', 15_000);
  await presentAs(ui, 'coord', 'idle');
  assert.equal(ui.frames.filter((f) => f.type === 'delivery' && f.message === approvalId && f.stage === 'injected').length, 1);
  const after = stateEvents(ui, 'coord').map((e) => e.state);
  assert.deepEqual(after.slice(after.lastIndexOf('waiting for approval') - 1), ['busy', 'waiting for approval', 'busy', 'idle']);
  assert.ok(stateEvents(ui, 'coord').every((e) => e.source === 'app-server'), 'no state ever came from the status tool');

  // the capability table
  const list = (await ui.request({ type: 'session.list' })).value as { adapters: Record<string, unknown> };
  assert.deepEqual(list.adapters.codex, {
    history: 'none',
    usage: 'reliable',
    setModel: 'none',
    approvalRelay: 'none',
    states: { busy: 'reliable', idle: 'reliable', 'waiting for approval': 'reliable', 'waiting for human': 'reliable' },
  });
});

test('attach is `codex resume --remote` with no -c and no --profile, and the TUI joins the hub-owned thread', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  const attach = (await ui.request({ type: 'session.attach', session: 'impl-1' })).value as { command: string };
  assert.equal(attach.command, launched.attach);
  assert.equal(attach.command, `codex resume --remote unix://${launched.harnessId} --cd ${root} ${launched.harnessSessionId}`);
  assert.doesNotMatch(attach.command, /(^|\s)(-c|--config|-p|--profile)(\s|=|$)/);
  // run as a terminal would, twice (two clients on one thread)
  const [one, two] = await Promise.all([fake.run(attach.command), fake.run(attach.command)]);
  assert.equal(one.code, 0, one.stderr);
  assert.equal(one.stdout, `fake codex attached to thread ${launched.harnessSessionId} (idle) in ${root}\n`);
  assert.equal(two.stdout, one.stdout);
  // the fake refuses what would put the real TUI in embedded mode
  const embedded = await fake.run(`codex resume -c model="x" --remote unix://${launched.harnessId} ${launched.harnessSessionId}`);
  assert.equal(embedded.code, 2);
});

test('a Codex app-server that dies: the state turns unknown and the hub logs it once', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  // the Coordinator: the fake answers the human, which only the Coordinator may
  const launched = await launch(ui, 'impl-1', { role: 'coordinator' });
  await presentAs(ui, 'impl-1', 'idle');

  await killDaemon(launched.pid as number);
  const gone = await eventually('the process gone', async () => (await status(ui)).harnesses.find((x) => x.name === 'impl-1' && x.status === 'exited'));
  assert.equal(gone.state, 'unknown');
  assert.equal(gone.attach, null);
  const event = await ui.waitFor((f) => f.type === 'session.state' && f.session === 'impl-1' && f.state === 'unknown');
  assert.equal(event.source, 'process');
  const logged = (await hubLog(root)).split('\n').filter((l) => l.includes('"harness-exited"'));
  assert.equal(logged.length, 1, 'one log event for the crash');

  // relaunched on its own thread: a new app-server resumes the rollout
  const r = await ui.request({ type: 'session.resume', session: 'impl-1', relaunch: true }, 30_000);
  assert.equal(r.ok, true, r.error);
  const resumed = (r.value as { found: boolean; process: Harness }).process;
  assert.equal(resumed.harnessSessionId, launched.harnessSessionId);
  assert.notEqual(resumed.pid, launched.pid);
  await presentAs(ui, 'impl-1', 'idle');
  const id = await sendGeneral(ui, 'are you back?', { to: ['impl-1'] });
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: are you back?', 15_000);
});

test('after a hub restart, resume re-finds the app-server and its thread through the process table; state and inject continue', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const first = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  ui.close();

  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  assert.equal((await fake.servers()).length, 1, 'the app-server outlives the hub');
  const second = await startDaemon(t, root, fake.env);
  const ui2 = await connectUi(t, second.discovery);
  assert.equal((await ui2.request({ type: 'subscribe' })).ok, true);

  const resumed = await eventually('resumed', async () => (await status(ui2)).harnesses.find((x) => x.name === 'coord' && x.state === 'idle'));
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.pid, launched.pid);
  assert.equal(resumed.harnessSessionId, launched.harnessSessionId);
  assert.match(await hubLog(root), /"event":"session-resumed","session":"coord"/);
  await presentAs(ui2, 'coord', 'idle');

  const id = await sendGeneral(ui2, 'still there?');
  await ui2.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await ui2.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: still there?', 15_000);
  await presentAs(ui2, 'coord', 'idle');
  assert.ok(stateEvents(ui2, 'coord').some((e) => e.state === 'busy' && e.source === 'app-server'), 'busy from the app-server after the restart');

  // stop: the app-server is closed, the session is stopped
  const stopped = await ui2.request({ type: 'session.stop', session: 'coord' }, 15_000);
  assert.equal(stopped.ok, true, stopped.error);
  assert.equal((stopped.value as { process: Harness }).process.status, 'stopped');
  assert.equal(pidAlive(launched.pid as number), false);
  assert.deepEqual(await fake.servers(), []);
});
