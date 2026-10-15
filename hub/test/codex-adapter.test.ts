import { ownDirectory } from './process-cleanup.ts';
// The Codex adapter (spec 4.3; #26) against a fake Codex at the harness process boundary: a real daemon in a
// temporary project launches the fake (`test/fakes/codex/codex`, first on the PATH) as an app-server on a Unix
// socket; the fake speaks Codex's JSON-RPC over a WebSocket there and starts the real spoke from the `-c
// mcp_servers…` overrides. The UI side is a scripted client on the daemon's Unix socket. Nothing inside the hub is
// mocked or read directly.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { AppServerClient } from '../src/adapters/codex/app-server.ts';
import { clandWithEnv, sleep, connectUi, eventually, killDaemon, pidAlive, spawnSpoke, startDaemon, tempProject, type FrameClient, NO_PS } from './harness.ts';

const FAKE_CODEX_DIR = fileURLToPath(new URL('./fakes/codex', import.meta.url));

for (const preassigned of [false, true]) test(`an Implementer begins on its launch brief after the clause in the first Codex turn (${preassigned ? 'preassigned role' : 'explicit role'})`, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const brief = 'Build from this Codex launch brief.';
  if (preassigned) assert.equal((await ui.request({ type: 'role.set', session: 'impl-brief', role: 'implementer' })).ok, true);
  const launched = await launch(ui, 'impl-brief', { ...(preassigned ? {} : { role: 'implementer' }), brief });
  const input = await eventually('brief taken up in the native first turn', async () => {
    const log = await fake.log(launched.pid!);
    return log.includes(brief) ? log : undefined;
  });
  assert.match(input, /turn [^\n]+ item: cland hub: you hold the role Implementer/);
  assert.ok(input.indexOf('you hold the role Implementer') < input.indexOf(brief));
  await presentAs(ui, 'impl-brief', 'idle');
  const log = await fake.log(launched.pid!);
  assert.equal(log.split('\n').filter(line => line.includes('turn/start input')).length, 1);
  assert.equal(log.split('\n').filter(line => line.includes('turn/start toolOutput')).length, 0, 'no second brief injection');
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ id: string; text: string; stage?: string }> };
  const recorded = history.messages.find(m => m.text === brief);
  assert.equal(recorded?.stage, 'injected');
  await eventually('carried brief stages journalled', async () => {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string });
    return ['send', 'acked', 'injected'].every(event => journal.some(entry => entry.id === recorded!.id && entry.event === event)) || undefined;
  });
});

test('an early Codex hello does not inject its brief when the native first turn is refused', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, { ...fake.env, FAKE_CODEX_FAIL_FIRST_TURN: '1' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const brief = 'Only an accepted native input injects this brief.';
  const refused = await ui.request({ type: 'session.launch', name: 'impl-refused', role: 'implementer', harness: 'codex', brief }, 30_000);
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /model refused the first turn/);
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ id: string; text: string; stage?: string }> };
  const recorded = history.messages.find(message => message.text === brief);
  assert.equal(recorded?.stage, 'dropped');
  assert.ok(!ui.frames.some(frame => frame.type === 'delivery' && frame.message === recorded!.id && frame.stage === 'injected'));
  await eventually('refused brief journalled as dropped', async () => {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string });
    assert.ok(!journal.some(entry => entry.id === recorded!.id && entry.event === 'injected'));
    return journal.some(entry => entry.id === recorded!.id && entry.event === 'dropped') || undefined;
  });
});

test('a failed Codex turn is recorded in Agents and the events view and reported to the sender', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await coord.waitForEvent((e) => e.params.meta?.kind === 'role');
  await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['impl'], text: 'fail this turn' })).ok, true);
  const expected = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
  await ui.waitFor((f) => f.type === 'message' && (f.message as { kind?: string; text: string }).kind === 'turn-failed' && (f.message as { text: string }).text === expected);
  const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.ok(events.rows.some((n) => n.text === expected));
  await coord.waitForEvent((e) => e.params.content.includes(expected));
});

type Presence = { name: string; sessionId: string; state: string; status: string | null; role: string | null };

for (const accepted of [false, true]) test(`Codex failure before a pending steer response notifies only admitted senders (${accepted ? 'accepted' : 'rejected'})`, async (t) => {
  const root = await tempProject(t);
  // Keep the failure turn busy across presence sampling so the steer is submitted before completion (T-389 finding).
  const fake = await fakeCodex(t, { turnMs: 300 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'sender', role: 'reviewer' });
  t.after(async () => { await coord.close(); await sender.close(); });
  await coord.waitForPresence(['coord']);
  await sender.waitForPresence(['sender']);
  await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  await coord.call('send', { to: ['impl'], text: 'fail this turn' });
  await presentAs(ui, 'impl', 'busy');
  const body = `${accepted ? 'accept' : 'reject'} pending steer response`;
  await sender.call('send', { to: ['impl'], text: body });
  const sent = await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === body);
  const id = (sent.message as { id: string }).id;
  const expected = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
  await coord.waitForEvent((e) => e.params.content.includes(expected));
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  if (accepted) await sender.waitForEvent((e) => e.params.content.includes(expected));
  assert.equal(sender.events.some((e) => e.params.content.includes(expected)), accepted);
});
type Harness = { name: string; harness: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string; attach: string | null; model: string | null; usage?: Record<string, unknown> };
type Status = { sessions: Presence[]; harnesses: Harness[] };
type StateEvent = { type: 'session.state'; session: string; state: string; source: string; approvalCommand?: string };
type FakeServer = { pid: number; socket: string; argv: string[]; cwd: string; env: Record<string, string>; path: string };

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
  const cleanupHome = ownDirectory(undefined, home);
  const env = {
    PATH: `${FAKE_CODEX_DIR}:${process.env.PATH ?? ''}`,
    FAKE_CODEX_HOME: home,
    FAKE_CODEX_TURN_MS: String(timings.turnMs ?? 30),
    FAKE_CODEX_REFUSE_MS: '150',
    CLAND_PUSH_TRUST_MS: '100',
    CLAND_ADAPTER_POLL_MS: String(timings.pollMs ?? 50),
    CLAND_INJECT_TIMEOUT_MS: String(timings.injectTimeoutMs ?? 5000),
  };
  const servers = async () => {
    const files = await readdir(join(home, 'servers')).catch(() => [] as string[]);
    const all = await Promise.all(files.map(async (f) => JSON.parse(await readFile(join(home, 'servers', f), 'utf8')) as FakeServer));
    return all.filter((s) => pidAlive(s.pid));
  };
  t.after(async () => {
    for (const s of await servers()) await killDaemon(s.pid);
    await cleanupHome();
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

const hubLog = async (root: string, ui: FrameClient) => {
  const flushed = await ui.request({ type: 'hub.status', flushLogs: true });
  assert.equal(flushed.ok, true, flushed.error);
  return readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
};

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
  // (a Coordinator has no sandbox in roles.toml, so nothing else is overridden)
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
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const clauses = (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter((l) => l.includes('"event":"role-clause"') && l.includes('"session":"coord"'));
  assert.equal(clauses.length, 1);
  assert.match(clauses[0] as string, /"reason":"assigned at launch \(first turn\)"/);
  await sleep(100);
  assert.equal((await hubLog(root, ui)).split('\n').filter(line => line.includes('"event":"role-clause"') && line.includes('"session":"coord"')).length, 1, 'still one clause after settling');
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
  const usageEvent = await ui.waitFor((f) => f.type === 'session.usage' && f.session === 'coord' && (f.usage as { total?: { totalTokens?: number } }).total?.totalTokens === 24);
  // A later rate-limit read can refresh the snapshot's timestamp without changing its values.
  assert.deepEqual(
    { ...(usageEvent.usage as Record<string, unknown>), rateLimitsAt: undefined },
    { ...h.usage, rateLimitsAt: undefined },
    'token and rate-limit notifications publish usage',
  );

  // a command approval: waiting for approval from thread/status/changed, whatever the model says of itself
  const approvalId = await sendGeneral(ui, 'this one needs approval');
  const waiting = await presentAs(ui, 'coord', 'waiting for approval');
  assert.equal(waiting.status, 'idle', "the model's own status line says idle");
  const commandEvent = await ui.waitFor(f => f.type === 'session.state' && f.session === 'coord' && f.approvalCommand === 'touch approved');
  assert.equal(commandEvent.state, 'waiting for approval');
  const pending = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ name: string; approvalCommand?: string }> };
  assert.equal(pending.processes.find(p => p.name === 'coord')?.approvalCommand, 'touch approved');
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
  // The command can arrive after the waiting state and enrich it in another event.
  const after = stateEvents(ui, 'coord').map((e) => e.state).filter((s, i, all) => i === 0 || s !== all[i - 1]);
  assert.deepEqual(after.slice(after.lastIndexOf('waiting for approval') - 1), ['busy', 'waiting for approval', 'busy', 'idle']);
  assert.ok(stateEvents(ui, 'coord').every((e) => e.source === 'app-server'), 'no state ever came from the status tool');
  const cleared = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ approvalCommand?: string }> };
  assert.equal(cleared.processes[0]?.approvalCommand, undefined);
  const editMark = ui.frames.length;
  await sendGeneral(ui, 'needs approval for fileChange');
  const edit = await ui.waitFor(f => f.type === 'session.state' && f.approvalCommand === 'fileChange');
  assert.equal(edit.state, 'waiting for approval');
  assert.ok(!JSON.stringify(ui.frames.slice(editMark)).includes('PRIVATE-TOOL-INPUT'));
  await fake.approve();
  await presentAs(ui, 'coord', 'idle');


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

for (const order of ['request-first', 'state-first']) test(`a deferred Codex reconnect snapshot preserves newer approval events (${order})`, async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  fake.env.FAKE_CODEX_REFUSE_MS = '0';
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  await writeFile(join(fake.home, 'defer-subscribe'), order);
  process.kill(launched.pid!, 'SIGUSR2');
  await eventually('approval arrived during deferred subscription', async () => (await fake.log(launched.pid!)).includes('approval during deferred subscribe') || undefined);
  if (order === 'state-first') {
    await ui.waitFor(f => f.type === 'session.state' && f.approvalCommand === 'touch deferred-approved');
  }
  const beforeReply = ui.frames.length;
  await writeFile(join(fake.home, 'release-subscribe'), '');
  await eventually('subscription response and next waiting event applied', async () => {
    const rows = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ state: string; approvalCommand?: string }> };
    return rows.processes.find(p => p.state === 'waiting for approval' && p.approvalCommand === 'touch deferred-approved');
  });
  assert.ok(ui.frames.slice(beforeReply).filter(f => f.type === 'session.state').every(f => f.state !== 'busy'), 'the older busy snapshot must not overwrite events received during subscribe');
  assert.ok(!JSON.stringify(ui.frames).includes('PRIVATE-TOOL-INPUT'));
});

for (const relaunch of [false, true]) test(`a Codex ${relaunch ? 'relaunch' : 'resume'} idle snapshot clears the completed approval before a new waiting episode`, { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  await sendGeneral(ui, 'needs approval');
  await ui.waitFor(f => f.type === 'session.state' && f.approvalCommand === 'touch approved');
  if (relaunch) {
    await killDaemon(launched.pid!);
    await eventually('the old process exited', async () => (await status(ui)).harnesses.find(p => p.status === 'exited'));
  }
  await writeFile(join(fake.home, 'idle-subscribe'), '');
  const resumed = await ui.request({ type: 'session.resume', session: 'coord', relaunch }, 30_000);
  assert.equal(resumed.ok, true, resumed.error);
  await presentAs(ui, 'coord', 'idle');
  const beforeWaiting = ui.frames.length;
  await writeFile(join(fake.home, 'waiting-without-command'), '');
  const event = await ui.waitFor(f => ui.frames.indexOf(f) >= beforeWaiting && f.type === 'session.state' && f.state === 'waiting for approval');
  assert.equal(event.approvalCommand, undefined, 'a completed command must not reappear in the next waiting episode');
  const rows = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ approvalCommand?: string }> };
  assert.equal(rows.processes[0]?.approvalCommand, undefined);
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
  const exitLogLines = async () => (await hubLog(root, ui)).split('\n').filter((l) => l.includes('"harness-exited"'));
  const logged = await eventually('the crash log persisted', async () => {
    const lines = await exitLogLines();
    return lines.length > 0 ? lines : undefined;
  });
  assert.equal(logged.length, 1, 'one log event for the crash');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal((await exitLogLines()).length, 1, 'still one log event after settling');

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

test('after a hub restart, resume re-finds the app-server and its thread through the process table; state and inject continue', { skip: NO_PS }, async (t) => {
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
  assert.match(await hubLog(root, ui2), /"event":"session-resumed","session":"coord"/);
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

/** The params of every `thread/start` and `thread/resume` the fake app-server got, as it logged them. */
const threadCalls = (log: string, method: 'thread/start' | 'thread/resume'): Array<Record<string, unknown>> =>
  log
    .split('\n')
    .map((line) => new RegExp(`^\\S+ ${method} (\\{.*\\})$`).exec(line)?.[1])
    .filter((json) => json !== undefined)
    .map((json) => JSON.parse(json) as Record<string, unknown>);

test('Codex launches Implementer and QA with full access, Reviewer read-only, and the T-48 profile when configured (T-65)', async (t) => {
  const root = await tempProject(t);
  // a repository with a worktree under .cland/worktrees, as an Implementer's item gets
  const worktree = join(root, '.cland', 'worktrees', 'T-1');
  const gitDir = join(root, '.git', 'worktrees', 'T-1');
  await mkdir(worktree, { recursive: true });
  await mkdir(gitDir, { recursive: true });
  await writeFile(join(worktree, '.git'), `gitdir: ${gitDir}\n`);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  // This profile comparison keeps two QA sessions alive across a role-file edit.
  assert.equal((await ui.request({ type: 'crew.set', key: 'qa.policy', value: 'pool' })).ok, true);
  assert.equal((await ui.request({ type: 'crew.set', key: 'qa.size', value: 2 })).ok, true);
  const tmp = await realpath(tmpdir());
  // approval and sandbox belong to the role, not to its default harness: the built-in Implementer runs on OpenCode,
  // and launched on Codex it still gets them
  const file = join(root, '.cland', 'roles.toml');
  // what the app-server was given beside the spoke: `-c key=<TOML>` overrides, parsed
  const overridesOf = async (pid: number): Promise<Record<string, unknown>> => {
    const server = (await fake.servers()).find((s) => s.pid === pid);
    assert.ok(server, 'the app-server runs');
    const own = server.argv.filter((a, i) => server.argv[i - 1] === '-c' && !a.startsWith('mcp_servers.cland.'));
    const value = (o: string): unknown => JSON.parse(JSON.stringify(parseToml(`v=${o.slice(o.indexOf('=') + 1)}`).v));
    return Object.fromEntries(own.map((o) => [o.slice(0, o.indexOf('=')), value(o)]));
  };
  const started = async (name: string, extra: Record<string, unknown>) => {
    const launched = await launch(ui, name, extra);
    const [params] = threadCalls(await fake.log(launched.pid as number), 'thread/start');
    assert.ok(params, `${name}: a thread/start was logged`);
    const { cwd, model, ...thread } = params;
    return { launched, cwd, model, thread, overrides: await overridesOf(launched.pid as number) };
  };
  const sockets = (cwd: string) => ({ [join(root, '.cland')]: 'allow', [cwd]: 'allow', [tmp]: 'allow', [join(root, '.cland', 'run')]: 'deny', [join(tmp, 'cland-run')]: 'deny' });
  const localNetwork = (cwd: string) => ({ enabled: true, allow_local_binding: true, unix_sockets: sockets(cwd) });

  // the Implementer has full access even when launched in a worktree: no profile overrides are needed.
  const impl = await started('impl-1', { role: 'implementer', cwd: worktree });
  assert.equal(impl.cwd, worktree);
  assert.deepEqual([impl.thread, impl.overrides], [{ approvalPolicy: 'never', permissions: ':danger-full-access' }, {}]);

  // the Reviewer: read-only, no network, so a built-in profile is enough
  const rev = await started('rev-1', { role: 'reviewer' });
  assert.deepEqual([rev.thread, rev.overrides], [{ approvalPolicy: 'never', permissions: ':read-only' }, {}]);

  // QA can run all checks, including watchers, pid identity and nested harnesses.
  const qa = await started('qa-1', { role: 'qa' });
  assert.deepEqual([qa.thread, qa.overrides], [{ approvalPolicy: 'never', permissions: ':danger-full-access' }, {}]);

  // no role, so no launch defaults: approvals are still never asked, the sandbox is Codex's own
  const plain = await started('plain-1', {});
  assert.deepEqual([plain.thread, plain.overrides], [{ approvalPolicy: 'never' }, {}]);

  // the session's shell is the session's: `cland task` run there acts as it, not as the human
  const [server] = (await fake.servers()).filter((s) => s.pid === impl.launched.pid);
  assert.ok(server);
  const { CLAND_LAUNCH_TOKEN: launchToken, CODEX_HOME: codexHome, ...sessionEnv } = server.env;
  assert.equal(codexHome, process.env.CODEX_HOME, 'an unpinned launch inherits the hub environment');
  assert.deepEqual(sessionEnv, { CLAND_SESSION_ID: impl.launched.sessionId, CLAND_SESSION_NAME: 'impl-1', CLAND_ROLE: 'implementer' });
  assert.equal(typeof launchToken === 'string' && launchToken.length > 0, true, 'the launch credential is forwarded to the session shell');
  // ... and `node` there is the hub's own, ahead of any other on the PATH
  assert.equal(server?.path.split(delimiter)[0], dirname(process.execPath));

  // roles.toml is read as it is at each launch: an edit changes the next one, and a relaunch takes it too
  const text = await readFile(file, 'utf8');
  const profileText = text.replaceAll('sandbox = "danger-full-access"', 'sandbox = "workspace-write"\nnetwork = "local"');
  const implStart = profileText.indexOf('[implementer.launch]');
  const implEnd = profileText.indexOf('[implementer.permissions]', implStart);
  const implLaunch = profileText.slice(implStart, implEnd);
  const withRoots = profileText.replace(implLaunch, implLaunch + 'writable_roots = ["."]\n\n');
  const qaLaunch = withRoots.slice(withRoots.indexOf('[qa.launch]'));
  await writeFile(file, withRoots.replace(qaLaunch, qaLaunch.replace('approval = "never"', 'approval = "on-request"')));
  const qa2 = await started('qa-2', { role: 'qa' });
  // QA's workspace-write profile also grants its runs and evidence directory (T-62)
  const qaProfile = { default_permissions: 'cland', 'permissions.cland': { extends: ':workspace', filesystem: { [join(root, '.cland', 'qa')]: 'write' }, network: localNetwork(root) }, 'features.network_proxy': true };
  assert.deepEqual(qa2.thread, { approvalPolicy: 'on-request', permissions: 'cland' });
  assert.deepEqual(qa2.overrides, qaProfile);

  // This case exercises relaunch policy, so await the hub's acknowledged stop
  // rather than racing its background detection of an externally killed PID.
  await presentAs(ui, 'qa-1', 'idle');
  const stoppedQa = await ui.request({ type: 'session.stop', session: 'qa-1' }, 15_000);
  assert.equal(stoppedQa.ok, true, stoppedQa.error);
  assert.equal((stoppedQa.value as { process: Harness }).process.status, 'stopped');
  assert.equal(pidAlive(qa.launched.pid as number), false);
  await eventually('qa-1 is seen gone', async () => ((await status(ui)).harnesses.find((h) => h.name === 'qa-1')?.state === 'unknown' ? true : undefined));
  const relaunched = await ui.request({ type: 'session.resume', session: 'qa-1', relaunch: true }, 30_000);
  assert.equal(relaunched.ok, true, relaunched.error);
  const again = (relaunched.value as { process: Harness }).process;
  const [resumed] = threadCalls(await fake.log(again.pid as number), 'thread/resume');
  assert.deepEqual(resumed, { threadId: qa.launched.harnessSessionId, cwd: root, model: again.model, approvalPolicy: 'on-request', permissions: 'cland' });
  assert.deepEqual(await overridesOf(again.pid as number), qaProfile, 'the relaunched app-server defines the configured profile');

  // the Implementer's configured profile still grants the main worktree and both git directories
  await presentAs(ui, 'impl-1', 'idle');
  const stoppedImpl = await ui.request({ type: 'session.stop', session: 'impl-1' }, 15_000);
  assert.equal(stoppedImpl.ok, true, stoppedImpl.error);
  assert.equal((stoppedImpl.value as { process: Harness }).process.status, 'stopped');
  assert.equal(pidAlive(impl.launched.pid as number), false);
  await eventually('impl-1 is seen gone', async () => ((await status(ui)).harnesses.find((h) => h.name === 'impl-1')?.state === 'unknown' ? true : undefined));
  const implAgain = await ui.request({ type: 'session.resume', session: 'impl-1', relaunch: true }, 30_000);
  assert.equal(implAgain.ok, true, implAgain.error);
  const implPid = (implAgain.value as { process: Harness }).process.pid as number;
  assert.deepEqual(await overridesOf(implPid), {
    default_permissions: 'cland',
    'permissions.cland': { extends: ':workspace', filesystem: { [root]: 'write', [join(root, '.git')]: 'write', [gitDir]: 'write' }, network: localNetwork(worktree) },
    'features.network_proxy': true,
  });
  const [implResumed] = threadCalls(await fake.log(implPid), 'thread/resume');
  assert.deepEqual([implResumed?.approvalPolicy, implResumed?.permissions], ['never', 'cland']);
});

// T-51. Measured with Codex 0.160.0: every `thread/start` on an app-server spawns its MCP servers again, so any
// further thread there (a helper's, a sub-agent's, a client's) brings a second spoke with the session's identity,
// while the session's own thread goes on calling its tools through the first one.
test('a second spoke of a live Codex session (another thread on its app-server) leaves the session its tools: the hub answers both, and says so once', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');
  const clauses = async () => (await hubLog(root, ui)).split('\n').filter((l) => l.includes('"event":"role-clause"')).length;
  const clausesBefore = await clauses();

  // another client starts a thread on the session's app-server
  const other = await AppServerClient.connect(launched.harnessId as string, { client: { name: 'test', title: 'test', version: '0' }, timeoutMs: 15_000, connectTimeoutMs: 3000 });
  t.after(() => other.close());
  await other.request('thread/start', { cwd: root });
  await eventually('the second spoke said hello', async () => (/"event":"replaced","name":"impl-1","sessionId":"[^"]+","spokes":2/.test(await hubLog(root, ui)) ? true : undefined));
  assert.match(await fake.log(launched.pid as number), /mcp cland ready \(another thread's\)/);

  // one session still, and nothing of a hello happened again: no clause is injected into its thread a second time
  assert.equal((await status(ui)).sessions.filter((s) => s.name === 'impl-1').length, 1);
  assert.equal(await clauses(), clausesBefore);
  await sleep(100);
  assert.equal(await clauses(), clausesBefore, 'still no second clause after settling');

  // the session's thread calls its tools through its first spoke, and they work: the pong is a `send`
  const id = await sendGeneral(ui, '@impl-1 still there?');
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 still there?', 15_000);
  assert.doesNotMatch(await fake.log(launched.pid as number), /replaced/);

  // the Agents record says there are two, once
  const agents = (await ui.request({ type: 'topic.history', topic: 'agents', limit: 50 })).value as { messages: Array<{ kind?: string; text: string }> };
  assert.deepEqual(agents.messages.filter((m) => m.kind === 'spoke-joined').map((m) => m.text), ['impl-1 [Implementer]: another spoke of the session connected (2 now); each is answered, and deliveries go to the newest']);
});

test('session resume --relaunch on a live session relaunches it: the app-server is stopped and a new one resumes the thread, with its role and its tools', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  // without --relaunch a live session is only re-found
  const found = await ui.request({ type: 'session.resume', session: 'impl-1' }, 30_000);
  assert.equal((found.value as { process: Harness }).process.pid, launched.pid);

  const r = await ui.request({ type: 'session.resume', session: 'impl-1', relaunch: true }, 30_000);
  assert.equal(r.ok, true, r.error);
  const again = (r.value as { found: boolean; process: Harness }).process;
  assert.notEqual(again.pid, launched.pid, 'a new app-server');
  assert.equal(pidAlive(launched.pid as number), false, 'the old one was stopped');
  assert.equal(again.harnessSessionId, launched.harnessSessionId, 'the same thread');
  assert.equal(again.status, 'running');
  assert.match(await hubLog(root, ui), /"event":"session-resumed","session":"impl-1",.*"relaunched":true/);
  const present = await presentAs(ui, 'impl-1', 'idle');
  assert.equal(present.role, 'implementer', 'the relaunch kept its role');

  const id = await sendGeneral(ui, '@impl-1 back?');
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 back?', 15_000);
});

// T-51, the second occurrence: a hub restart with a session whose first spoke an older hub had told it was replaced.
// That spoke never came back, and the session's thread went on calling it. Now every spoke reconnects and is taken.
test('after a hub restart every spoke of a Codex session reconnects, and the session\'s thread still has its tools', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const first = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');
  const other = await AppServerClient.connect(launched.harnessId as string, { client: { name: 'test', title: 'test', version: '0' }, timeoutMs: 15_000, connectTimeoutMs: 3000 });
  t.after(() => other.close());
  await other.request('thread/start', { cwd: root });
  await eventually('two spokes', async () => (/"event":"replaced","name":"impl-1","sessionId":"[^"]+","spokes":2/.test(await hubLog(root, ui)) ? true : undefined));
  ui.close();

  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  const restarted = Date.now();
  const second = await startDaemon(t, root, fake.env);
  const ui2 = await connectUi(t, second.discovery);
  assert.equal((await ui2.request({ type: 'subscribe' })).ok, true);
  const since = async (event: string) =>
    (await hubLog(root, ui2))
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .map((l) => JSON.parse(l) as { ts: string; event: string; name?: string; spokes?: number })
      .filter((e) => e.event === event && Date.parse(e.ts) >= restarted && e.name === 'impl-1');
  // both come back: one says hello, the other joins it
  await eventually('both spokes are back', async () => ((await since('hello')).length === 1 && (await since('replaced')).some((e) => e.spokes === 2) ? true : undefined));
  await presentAs(ui2, 'impl-1', 'idle');

  const id = await sendGeneral(ui2, '@impl-1 after the restart?');
  await ui2.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await ui2.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 after the restart?', 15_000);
});

// Review rev-20261009-51-2c2e706: the stop of a live relaunch is awaited, and the session may rename itself meanwhile.
test('session resume --relaunch on a live session that renames itself while it is being stopped relaunches it under its new name', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, { ...fake.env, FAKE_CODEX_TERM_DELAY_MS: '1200' });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');

  // its turn renames it 300 ms in; the relaunch's stop is under way by then, and takes 1200 ms
  const id = await sendGeneral(ui, 'rename to coord-2');
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  const r = await ui.request({ type: 'session.resume', session: 'coord', relaunch: true }, 30_000);
  assert.equal(r.ok, true, r.error);
  const again = (r.value as { found: boolean; process: Harness }).process;
  assert.match(await fake.log(launched.pid as number), /tool rename → \{"ok":true/, 'the rename landed while the app-server was going');
  assert.equal(again.name, 'coord-2');
  assert.equal(again.status, 'running');
  assert.notEqual(again.pid, launched.pid);
  assert.equal(pidAlive(launched.pid as number), false);
  assert.equal(again.harnessSessionId, launched.harnessSessionId, 'the same thread');
  // one row, under the new name, with a live process behind it
  const rows = (await status(ui)).harnesses.filter((h) => h.sessionId === launched.sessionId);
  assert.deepEqual(rows.map((h) => [h.name, h.status, h.pid]), [['coord-2', 'running', again.pid]]);
  const present = await presentAs(ui, 'coord-2', 'idle');
  assert.equal(present.role, 'coordinator');
});

// T-50. Measured with Codex 0.160.0 (11 steers in the last 5 to 120 ms of a turn): an accepted `turn/steer` is taken up
// by the turn, which goes on and answers it, and one that comes too late is refused (`no active turn to steer`). The
// adapter does not rest on that: a turn that ends without an accepted steer among its inputs gets it again.
test('a steer the app-server accepted and the turn never took up is delivered again as a new turn, and the journal and Agents say so', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  const first = await sendGeneral(ui, '@impl-1 start a turn; needs approval');
  await ui.waitFor((f) => f.type === 'delivery' && f.message === first && f.stage === 'injected', 15_000);
  // Hold the turn at an observed approval barrier until both steers are admitted; injection alone
  // does not keep a fast turn active while a loaded test runner stages the next delivery.
  await presentAs(ui, 'impl-1', 'waiting for approval');
  // steered into the running turn, twice: one the turn takes up, one it accepts and drops
  const taken = await sendGeneral(ui, '@impl-1 a steer the turn takes up');
  const dropped = await sendGeneral(ui, '@impl-1 drop this steer');
  await ui.waitFor((f) => f.type === 'delivery' && f.message === dropped && f.stage === 'injected', 15_000);
  const log = await fake.log(launched.pid as number);
  assert.match(log, /turn\/steer [0-9a-f-]+: <channel [^\n]*>\n@impl-1 a steer the turn takes up/);
  assert.match(log, /turn\/steer [0-9a-f-]+ accepted and dropped: <channel [^\n]*>\n@impl-1 drop this steer/);
  await fake.approve();

  // every message is answered: the dropped one in a turn of its own, after the first turn ended without it
  for (const text of ['start a turn; needs approval', 'a steer the turn takes up', 'drop this steer']) {
    await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: @impl-1 ${text}`, 15_000);
  }
  await presentAs(ui, 'impl-1', 'idle');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const events = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as { event: string; id?: string; session?: string });
  assert.deepEqual(events.filter((e) => e.event === 'harness-redelivered').map((e) => [e.session, e.id]), [['impl-1', dropped]], 'only the dropped steer, once');
  assert.equal((await hubLog(root, ui)).split('\n').filter((line) => line.includes('"event":"harness-steered"') && line.includes(taken)).length, 1);
  await sleep(100);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const settled = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; session?: string });
  assert.deepEqual(settled.filter(e => e.event === 'harness-redelivered').map(e => [e.session, e.id]), [['impl-1', dropped]]);
  assert.equal((await hubLog(root, ui)).split('\n').filter(line => line.includes('"event":"harness-steered"') && line.includes(taken)).length, 1);
  const pongs = ui.frames.filter((f) => f.type === 'message' && /^pong: /.test((f.message as { text: string }).text)).map((f) => (f.message as { text: string }).text);
  assert.deepEqual(pongs.sort(), ['pong: @impl-1 a steer the turn takes up', 'pong: @impl-1 drop this steer', 'pong: @impl-1 start a turn; needs approval'], 'each answered once');

  const agents = (await ui.request({ type: 'topic.history', topic: 'agents', limit: 50 })).value as { messages: Array<{ kind?: string; text: string }> };
  assert.deepEqual(agents.messages.filter((m) => m.kind === 'redelivered').map((m) => m.text), ['impl-1 [Implementer]: its turn ended without a message it had accepted; the message was delivered again as a new turn']);
});

// T-68. Codex 0.160.0 records a delivery into an idle thread (`turn/start` with a `hub_event` toolOutput) as a
// `functionCallOutput` item, not a `userMessage`: the turn that carries it took it up, and nothing is owed.
test('a delivery to an idle Codex session runs one turn and is never redelivered', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  await sendGeneral(ui, '@impl-1 an idle delivery');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 an idle delivery', 15_000);
  await presentAs(ui, 'impl-1', 'idle');
  // a second idle delivery, answered after the first turn's check has run: a redelivery would have come before it
  await sendGeneral(ui, '@impl-1 a later idle delivery');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 a later idle delivery', 15_000);
  await presentAs(ui, 'impl-1', 'idle');

  const log = await fake.log(launched.pid as number);
  assert.equal(log.split('\n').filter((line) => line.includes('turn/start toolOutput hub_event')).length, 2, 'one turn per delivery');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const events = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as { event: string; id?: string });
  assert.deepEqual(events.filter((e) => e.event === 'harness-redelivered' || e.event === 'harness-redelivery-failed'), []);
  assert.equal((await hubLog(root, ui)).split('\n').filter((line) => line.includes('"event":"harness-redelivered"') || line.includes('"event":"harness-redelivery-failed"')).length, 0);
  const pongs = ui.frames.filter((f) => f.type === 'message' && /^pong: /.test((f.message as { text: string }).text)).map((f) => (f.message as { text: string }).text);
  assert.deepEqual(pongs, ['pong: @impl-1 an idle delivery', 'pong: @impl-1 a later idle delivery'], 'each answered once');
  const agents = (await ui.request({ type: 'topic.history', topic: 'agents', limit: 50 })).value as { messages: Array<{ kind?: string; text: string }> };
  assert.deepEqual(agents.messages.filter((m) => m.kind === 'redelivered' || m.kind === 'turn-failed'), []);
});

test('an idle delivery whose item the turn never announced is found in the turn record and not redelivered', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  await sendGeneral(ui, '@impl-1 leave unannounced');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 leave unannounced', 15_000);
  await presentAs(ui, 'impl-1', 'idle');
  await sendGeneral(ui, '@impl-1 a later idle delivery');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 a later idle delivery', 15_000);

  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const events = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as { event: string });
  assert.deepEqual(events.filter((e) => /^harness-(redelivered|redelivery-failed|turn-unread)$/.test(e.event)), []);
  assert.equal((await fake.log(launched.pid as number)).split('\n').filter((line) => line.includes('turn/start toolOutput hub_event')).length, 2, 'one turn per delivery');
});

for (const [body, error] of [
  ['leave unannounced, lose its envelope', "the turn's record shows no input item of the shape it was admitted in"],
  ['leave unannounced, fail the readback', 'readback refused'],
] as const) test(`an idle delivery the turn record cannot vouch for (${body}) is reported as unread and not redelivered`, async (t) => {
  // a tool output owed in a turn that shows only a userMessage is not judged; nor is anything when the read fails
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  const id = await sendGeneral(ui, `@impl-1 ${body}`);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: @impl-1 ${body}`, 15_000);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  await eventually('the unread turn is journaled', async () => (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).includes('"event":"harness-turn-unread"') || undefined);
  await presentAs(ui, 'impl-1', 'idle');

  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const events = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as { event: string; ids?: string[]; error?: string });
  assert.deepEqual(events.filter((e) => e.event === 'harness-turn-unread').map((e) => [e.ids, e.error]), [[[id], error]]);
  await sleep(100);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const settled = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; ids?: string[]; error?: string });
  assert.deepEqual(settled.filter(e => e.event === 'harness-turn-unread').map(e => [e.ids, e.error]), [[[id], error]], 'still one unread record after settling');
  assert.deepEqual(events.filter((e) => e.event === 'harness-redelivered' || e.event === 'harness-redelivery-failed'), []);
  assert.equal((await fake.log(launched.pid as number)).split('\n').filter((line) => line.includes('turn/start toolOutput hub_event')).length, 1, 'one turn');
});

test('a turn whose input items the hub cannot classify is reported once as unread and not redelivered', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl-1', { role: 'implementer' });
  await presentAs(ui, 'impl-1', 'idle');

  const id = await sendGeneral(ui, '@impl-1 record an unknown item');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 record an unknown item', 15_000);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  await eventually('the unread turn is journaled', async () => (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).includes('"event":"harness-turn-unread"') || undefined);
  await presentAs(ui, 'impl-1', 'idle');
  await sendGeneral(ui, '@impl-1 a later idle delivery');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: @impl-1 a later idle delivery', 15_000);

  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const events = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as { event: string; ids?: string[]; error?: string });
  const unread = events.filter((e) => e.event === 'harness-turn-unread');
  assert.equal(unread.length, 1, 'reported once');
  assert.deepEqual(unread[0]?.ids, [id]);
  await sleep(100);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const settled = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; session?: string });
  assert.equal(settled.filter(e => e.event === 'harness-turn-unread').length, 1, 'still reported once after settling');
  assert.equal(unread[0]?.error, "the turn's record shows no input item of the shape it was admitted in");
  assert.deepEqual(events.filter((e) => e.event === 'harness-redelivered' || e.event === 'harness-redelivery-failed'), []);
  assert.equal((await fake.log(launched.pid as number)).split('\n').filter((line) => line.includes('turn/start toolOutput hub_event')).length, 2, 'one turn per delivery');
  const pongs = ui.frames.filter((f) => f.type === 'message' && /^pong: /.test((f.message as { text: string }).text)).map((f) => (f.message as { text: string }).text);
  assert.deepEqual(pongs, ['pong: @impl-1 record an unknown item', 'pong: @impl-1 a later idle delivery'], 'each answered once');
});

for (const mode of ['rejected', 'unanswered']) test(`a successful completion before a late ${mode} steer response never replays a pending admission`, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { injectTimeoutMs: 1500 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  await sendGeneral(ui, '@impl needs approval');
  await presentAs(ui, 'impl', 'waiting for approval');
  const body = `@impl late ${mode} steer`;
  const id = await sendGeneral(ui, body);
  await eventually('steer pending', async () => (await fake.log(launched.pid as number)).includes('pending late steer:') || undefined);
  await fake.approve();
  await eventually('completion before reply', async () => (await fake.log(launched.pid as number)).includes('late steer completed before response') || undefined);
  // Keep the reply blocked through the inject deadline: admission is ambiguous, never owed.
  await eventually('uncertain admission', async () => (await hubLog(root, ui)).includes(`"event":"inject-uncertain","id":"${id}"`) || undefined);
  const events = (await hubLog(root, ui)).split('\n').filter((line) => line.startsWith('{')).map((line) => JSON.parse(line) as { event: string; id?: string });
  assert.equal(events.filter((e) => e.event === 'harness-redelivered' && e.id === id).length, 0);
  assert.equal(ui.frames.filter((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: ${body}`).length, 0);
  await writeFile(join(fake.home, 'release-steer-response'), '');
});

test('a recovery accepted and dropped in a newer turn retains its obligation', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  await sendGeneral(ui, '@impl needs approval');
  await presentAs(ui, 'impl', 'waiting for approval');
  const body = '@impl drop this steer; drop recovery in newer turn';
  const id = await sendGeneral(ui, body);
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  await writeFile(join(fake.home, 'new-turn-during-read'), '');
  await fake.approve();
  await eventually('recovery accepted by newer turn', async () => (await fake.log(launched.pid as number)).includes('recovery accepted and dropped in newer turn:') || undefined);
  await writeFile(join(fake.home, 'release-newer-turn'), '');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: ${body}`, 5000);
  await presentAs(ui, 'impl', 'idle');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  const recoveries = journal.split('\n').filter((line) => line.includes('"event":"harness-redelivered"') && line.includes(id));
  assert.equal(recoveries.length, 2, 'the recovery in the newer turn is recovered again, then consumed');
  await sleep(100);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const settled = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; session?: string });
  assert.equal(settled.filter(e => e.event === 'harness-redelivered' && e.id === id).length, 2, 'still two recoveries after settling');
  const agents = (await ui.request({ type: 'topic.history', topic: 'agents', limit: 50 })).value as { messages: Array<{ kind?: string; text: string }> };
  assert.deepEqual(agents.messages.filter((m) => m.kind === 'redelivered').map((m) => m.text), [
    'impl [Implementer]: its turn ended without a message it had accepted; the message was delivered again into a running turn',
    'impl [Implementer]: its turn ended without a message it had accepted; the message was delivered again as a new turn',
  ]);
});

test('a recovered turn failing before its admission response notifies the original sender', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'sender', role: 'reviewer' });
  t.after(() => sender.close());
  await sender.waitForPresence(['sender']);
  const launched = await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  await sendGeneral(ui, '@impl needs approval');
  await presentAs(ui, 'impl', 'waiting for approval');
  const body = 'drop this steer; fail recovered turn before response';
  const sent = await sender.call<{ ok: boolean }>('send', { to: ['impl'], text: body });
  assert.equal(sent.ok, true);
  const frame = await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === body);
  const id = (frame.message as { id: string }).id;
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  await fake.approve();
  const expected = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === expected);
  await eventually('failure preceded response', async () => (await fake.log(launched.pid as number)).includes('recovered turn failed before response') || undefined);
  await sender.waitForEvent((e) => e.params.content.includes(expected), 5000);
  assert.equal(sender.events.filter((e) => e.params.content.includes(expected)).length, 1);
  const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.equal(events.rows.filter((n) => n.text === expected).length, 1);
});

test('a refused recovery request records journal, Agents and events-view failure and tells the sender', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'sender', role: 'reviewer' });
  t.after(() => sender.close());
  await sender.waitForPresence(['sender']);
  await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  await sendGeneral(ui, '@impl needs approval');
  await presentAs(ui, 'impl', 'waiting for approval');
  const body = 'drop this steer; refuse recovered request';
  assert.equal((await sender.call<{ ok: boolean }>('send', { to: ['impl'], text: body })).ok, true);
  const frame = await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === body);
  const id = (frame.message as { id: string }).id;
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  await fake.approve();
  const expected = 'impl [Implementer]: its turn ended without a message it had accepted, and delivering it again failed: recovery request refused';
  await ui.waitFor((f) => f.type === 'message' && (f.message as { kind?: string; text: string }).kind === 'turn-failed' && (f.message as { text: string }).text === expected);
  const flushed = await ui.request({ type: 'hub.status', flushLogs: true });
  assert.equal(flushed.ok, true, flushed.error);
  const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as { event: string; id?: string; error?: string });
  assert.equal(journal.filter((e) => e.event === 'harness-redelivery-failed' && e.id === id && e.error === 'recovery request refused').length, 1);
  assert.equal(journal.filter((e) => e.event === 'harness-redelivered' && e.id === id).length, 0);
  const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.equal(events.rows.filter((n) => n.text === expected).length, 1);
  await sender.waitForEvent((e) => e.params.content.includes('redelivery failed: recovery request refused'));
});

for (const mode of ['reject', 'accept', 'accept dropped']) test(`a successful completion reconciles a late ${mode} pending steer response`, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  await sendGeneral(ui, '@impl needs approval');
  await presentAs(ui, 'impl', 'waiting for approval');
  const body = `@impl ${mode} pending steer response`;
  const id = await sendGeneral(ui, body);
  await eventually('pending steer received', async () => (await fake.log(launched.pid as number)).includes(`pending response: ${body}`) || undefined);
  // The fake holds this result until the turn has completed, with uptake only in accept mode.
  await fake.approve();
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: ${body}`);
  await presentAs(ui, 'impl', 'idle');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as { event: string; id?: string });
  assert.equal(journal.filter((e) => e.event === 'harness-redelivered' && e.id === id).length, mode === 'accept dropped' ? 1 : 0);
  await sleep(100);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const settled = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; session?: string });
  assert.equal(settled.filter(e => e.event === 'harness-redelivered' && e.id === id).length, mode === 'accept dropped' ? 1 : 0);
  assert.equal(ui.frames.filter((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: ${body}`).length, 1);
});

test('repeated dropped recoveries stop with a visible failure after two attempts', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  await launch(ui, 'impl', { role: 'implementer' });
  await presentAs(ui, 'impl', 'idle');
  await sendGeneral(ui, '@impl needs approval');
  await presentAs(ui, 'impl', 'waiting for approval');
  const id = await sendGeneral(ui, '@impl drop this steer; drop every recovery');
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  await fake.approve();
  await ui.waitFor((f) => f.type === 'message' && (f.message as { kind?: string; text: string }).kind === 'turn-failed' && (f.message as { text: string }).text.includes('still missing after two redeliveries'));
  await presentAs(ui, 'impl', 'idle');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as { event: string; id?: string });
  assert.equal(journal.filter((e) => e.event === 'harness-redelivered' && e.id === id).length, 2);
  assert.equal(journal.filter((e) => e.event === 'harness-redelivery-failed' && e.id === id).length, 1);
  await sleep(100);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const settled = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; session?: string });
  assert.equal(settled.filter(e => e.event === 'harness-redelivered' && e.id === id).length, 2);
  assert.equal(settled.filter(e => e.event === 'harness-redelivery-failed' && e.id === id).length, 1);
});


test('a codex Lead receives its epic claim, role clause and direct node address', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ type: 'task.create', title: 'Led epic', kind: 'epic' });
  assert.equal(created.ok, true, created.error);
  const id = (created.value as { item: { id: string } }).item.id;
  const launched = await launch(ui, 'lead-1', { role: 'lead', item: id });
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: `@lead ${id} explain the epic` });
  assert.equal(sent.ok, true, sent.error);
  const log = await eventually('Lead clause and node message reach the native harness', async () => {
    const log = await fake.log(launched.pid!);
    return log.includes('you hold the role Lead') && log.includes('explain the epic') ? log : undefined;
  });
  assert.match(log, /you hold the role Lead/);
  const viewed = await ui.request({ type: 'task.view', item: id });
  assert.equal(viewed.ok, true, viewed.error);
  assert.equal((viewed.value as { item: { claim: { session: string } } }).item.claim.session, 'lead-1');
});
