// T3 OpenCode real-binary contract: the fake HTTP/SSE server starts the production spoke.
// Checklist, one native proof per family (titles below):
// - launch/attach: "a launched OpenCode session" (config, private password, TUI cwd);
// - first role clause: "the first OpenCode native prompt" (one input, clause before brief);
// - injected/reply correlation: "a launched OpenCode session" (queue, stages, replyTo);
// - sender delivery: "a busy OpenCode turn" (human queues, agent steers through native HTTP/SSE);
// - signals/model/usage: "a launched OpenCode session", "a pending permission" and "a failed OpenCode turn";
// - stop: "a launched OpenCode session"; hub-process restart: "after a hub restart";
// - native-conversation relaunch: "a killed OpenCode server" and "a stopped OpenCode session".
// Port binding/readiness and opt-in instruction endpoints retain their native process/frame proofs.
// Hub composition is proven once in adapter-composition.test.ts. Approval snapshots, rejection,
// input attribution and instruction-cleanup permutations live in opencode-native.test.ts (T2).
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory } from './process-cleanup.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, realpath, stat, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import type { ApprovalRecord, HubStatus, VerificationQueue } from '../src/protocol.ts';
import { nativeProjectHub as projectHub, assertFirstLaunchClause, clandWithEnv, clauseAnswered, connectUi, eventually, inProcessSpoke, killDaemon, spawnSpoke, startDaemon, tempProject, type FrameClient, SPOKE_ENTRY, CLI_ENTRY } from './harness.ts';
import { NO_PS } from './native-process.ts';
import { writeSuiteFixture } from './suite-fixture.ts';

const FAKE_OPENCODE_DIR = fileURLToPath(new URL('./fakes/opencode', import.meta.url));

test('OpenCode shell tools inherit session identity and admit two separately owned verify runs', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  await writeSuiteFixture(root, 'true', 'true', { stack: 'other', check: 'true', test: 'true', verification: 'executor="local"' });
  await writeFile(join(root, 'shell-probe.mjs'), `
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
const [cli, recipient, topic] = process.argv.slice(2);
const keys = ['CLAND_HUB_FILE', 'CLAND_SESSION_ID', 'CLAND_SESSION_NAME', 'CLAND_ROLE'];
const credentialDigest = createHash('sha256').update(process.env.CLAND_LAUNCH_TOKEN ?? '').digest('hex');
const identity = Object.fromEntries(keys.map(key => [key, process.env[key] ?? null]));
// cland-allow-child-env: the fake shell seals its environment before this native CLI inheritance probe.
execFile(process.execPath, [cli, 'verify', '--report', topic, '--to', recipient, '--json'],
  { timeout: 10000 }, (error, stdout, stderr) => {
    console.log(JSON.stringify({ identity, credentialDigest, code: error ? error.code : 0, stdout, stderr }));
  });
`);
  // Admission/ownership is the subject; an occupied executor prevents any package commands.
  const { discovery } = await projectHub(t, root, fake.env, {
    compatibility: { occupied: async () => true, holder: async () => ({ holder: null, since: null }) },
  });
  const ui = await connectUi(t, discovery);
  const sessions = [
    await launch(ui, 'shell-a', { role: 'implementer', model: 'opencode/fake-paid' }),
    await launch(ui, 'shell-b', { role: 'implementer', model: 'opencode/fake-paid' }),
  ];
  const topics: string[] = [];
  for (const session of sessions) {
    const made = await ui.request({ type: 'task.create', title: session.name, size: 'S', assignee: session.name });
    assert.equal(made.ok, true, made.error);
    const item = (made.value as { item: { id: string } }).item.id;
    const config = JSON.parse(await readFile(join(root, '.cland/opencode', session.name, 'opencode.json'), 'utf8'));
    const credential = config.mcp.servers.cland.environment.CLAND_LAUNCH_TOKEN as string;
    const claimed = await ui.request({ type: 'task.claim', item, as: { name: session.name, sessionId: session.sessionId, shell: true, credential } });
    assert.equal(claimed.ok, true, claimed.error);
    const topic = await ui.request({ type: 'topic.create', title: session.name, item });
    assert.equal(topic.ok, true, topic.error);
    topics.push((topic.value as { topic: { id: string } }).topic.id);
  }
  const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
  const probes = await Promise.all(sessions.map(async (session, index) => {
    const command = [process.execPath, join(root, 'shell-probe.mjs'), CLI_ENTRY, session.name, topics[index]!].map(quote).join(' ');
    const { data } = await api(session, root, 'POST', '/test/shell', { command }) as { data: { code: number; stdout: string; stderr: string } };
    assert.equal(data.code, 0, data.stderr);
    return JSON.parse(data.stdout) as { identity: Record<string, string | null>; credentialDigest: string; code: number; stdout: string; stderr: string };
  }));
  for (const [index, probe] of probes.entries()) {
    const session = sessions[index]!;
    const config = JSON.parse(await readFile(join(root, '.cland/opencode', session.name, 'opencode.json'), 'utf8'));
    const { CLAND_DELIVERY: _delivery, CLAND_LAUNCH_TOKEN: credential, ...identity } = config.mcp.servers.cland.environment;
    assert.deepEqual(probe.identity, identity, 'the shell and MCP carry the same identity variables');
    assert.equal(probe.identity.CLAND_HUB_FILE, join(root, '.cland/hub.json'));
    assert.equal(probe.identity.CLAND_SESSION_ID, session.sessionId);
    assert.equal(probe.identity.CLAND_SESSION_NAME, session.name);
    assert.equal(probe.identity.CLAND_ROLE, 'implementer');
    assert.equal(probe.credentialDigest === createHash('sha256').update(credential).digest('hex'), true, 'the shell holds its own credential');
    assert.equal(probe.code, 0, probe.stderr);
  }
  const jobs = probes.map(probe => JSON.parse(probe.stdout) as { id: string });
  assert.notEqual(jobs[0]!.id, jobs[1]!.id, 'each session gets its own submission');
  // Observe persisted queue records, rather than trusting the launch replies.
  const queued = await ui.request({ type: 'hub.status', history: true });
  assert.equal(queued.ok, true, queued.error);
  const suites = (queued.value as HubStatus).suites!;
  const queue = await ui.request({ type: 'suite.queue' });
  assert.equal(queue.ok, true, queue.error);
  const waiters = (queue.value as VerificationQueue).waiters;
  for (const [index, job] of jobs.entries()) {
    const receipt = suites.find(suite => suite.id === job.id)!;
    assert.ok(receipt, `persisted suite ${job.id}`);
    assert.equal(receipt.state, 'queued');
    assert.equal(waiters.find(waiter => waiter.id === job.id)?.session, sessions[index]!.name);
  }
  const resumed = await ui.request({ type: 'session.resume', session: 'shell-a', relaunch: true });
  assert.equal(resumed.ok, true, resumed.error);
  const resumedProcess = (resumed.value as { process: Harness }).process;
  const config = JSON.parse(await readFile(join(root, '.cland/opencode/shell-a/opencode.json'), 'utf8'));
  assert.equal(createHash('sha256').update(config.mcp.servers.cland.environment.CLAND_LAUNCH_TOKEN).digest('hex') !== probes[0]!.credentialDigest, true, 'native relaunch receives a rotated credential');
  const command = [globalThis.process.execPath, CLI_ENTRY, 'task', 'view', 'T-1', '--json'].map(quote).join(' ');
  const shell = await api(resumedProcess, root, 'POST', '/test/shell', { command }) as { data: { code: number; stdout: string; stderr: string } };
  assert.equal(shell.data.code, 0, shell.data.stderr);
});

test('the first OpenCode native prompt carries the role clause before the launch brief', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await projectHub(t, root, fake.env);
  // Claude's permission mode does not change OpenCode's native launch settings.
  const rolesFile = join(root, '.cland/roles.toml');
  await writeFile(rolesFile, (await readFile(rolesFile, 'utf8')).replace('[implementer.launch]', '[implementer.launch]\npermissions = "auto"'));
  const ui = await connectUi(t, discovery);
  const brief = 'Build from this OpenCode launch brief.';
  const launched = await launch(ui, 'impl-brief', { role: 'implementer', brief });
  const prompts = await eventually('brief reaches the native harness', async () => {
    const log = await fake.prompts(launched.harnessSessionId!);
    return log.includes(brief) ? log : undefined;
  });
  assert.ok(prompts.indexOf('you hold the role Implementer') < prompts.indexOf(brief));
  assert.equal(prompts.split('\n').filter(line => line.startsWith('prompt ')).length, 1, 'the first harness input includes clause and brief');
  assert.equal(prompts.split(brief).length - 1, 1);
});

type Presence = { name: string; sessionId: string; state: string; role: string | null };
type Harness = { name: string; harness: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string; attach: string | null; model: string | null; usage?: Record<string, unknown> };
type Status = { sessions: Presence[]; harnesses: Harness[] };
type StateEvent = { type: 'session.state'; session: string; state: string; source: string; approvalCommand?: string };

type FakeOpenCode = {
  env: Record<string, string>;
  home: string;
  /** What the fake's server for `session` (ses_…) received as prompts: `prompt <delivery>[ (running)]: <text>`. */
  prompts: (session: string) => Promise<string>;
  servers: () => Promise<Array<{ pid: number; port: number; url: string; cwd: string; config: string | null }>>;
};

async function fakeOpenCode(t: TestContext, timings: { pollMs?: number; injectTimeoutMs?: number; turnMs?: number } = {}): Promise<FakeOpenCode> {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-opencode-')));
  const cleanupHome = ownDirectory(undefined, home);
  const env = {
    PATH: `${FAKE_OPENCODE_DIR}:${process.env.PATH ?? ''}`,
    FAKE_OPENCODE_HOME: home,
    XDG_DATA_HOME: join(home, 'data'),
    FAKE_OPENCODE_TURN_MS: String(timings.turnMs ?? 30),
    CLAND_ADAPTER_POLL_MS: String(timings.pollMs ?? 50),
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
    await cleanupHome();
  });
  return { env, home, servers, prompts: (session) => readFile(join(home, 'prompts', `${session}.log`), 'utf8').catch(() => '') };
}

async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status', history: true });
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

const hubLog = async (root: string, ui: FrameClient) => {
  const flushed = await ui.request({ type: 'hub.status', history: true, flushLogs: true });
  assert.equal(flushed.ok, true, flushed.error);
  return readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
};

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

test('OpenCode launches on the port cland chose without a listening log line', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  fake.env.FAKE_OPENCODE_QUIET = '1';
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'impl', { role: 'coordinator', model: 'opencode/fake-paid' });
  assert.equal(launched.status, 'running');
  const [server] = await fake.servers();
  assert.ok(server && server.port > 0, 'cland passes a nonzero port');
  assert.equal(server.url, launched.harnessId);
  assert.doesNotMatch(await readFile(join(root, '.cland/opencode/impl/serve.log'), 'utf8'), /listening on/);
});

test('the collision fixture settles a failed bind and drains its bounded no-probe fallback', async (t) => {
  const freshHome = async () => {
    const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-opencode-')));
    t.after(ownDirectory(undefined, home));
    return home;
  };
  const freePort = () => new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address() as { port: number };
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
  const fakeServe = (home: string, port: number, extra: Record<string, string>) => new Promise<{ code: number | null; stderr: string; timedOut: boolean }>((resolve) => {
    execFile(process.execPath, [join(FAKE_OPENCODE_DIR, 'fake-opencode.ts'), 'serve', '--hostname', '127.0.0.1', '--port', String(port)], {
      env: fixtureEnvironment(home, process.env, { FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_COLLIDE_ONCE: '1', ...extra }),
      timeout: 5_000,
    }, (error, _stdout, stderr) => resolve({
      code: !error ? 0 : typeof error.code === 'number' ? error.code : null,
      stderr,
      timedOut: Boolean(error && (error as { killed?: boolean }).killed),
    }));
  });

  // No probe ever arrives: the fixture's own bound drains the listener and sockets, so the child exits with
  // EADDRINUSE (the retry receipt) instead of holding the launch open, and the taken port is free again.
  const idleHome = await freshHome();
  const idlePort = await freePort();
  const idle = await fakeServe(idleHome, idlePort, { FAKE_OPENCODE_COLLIDE_SETTLE_MS: '150' });
  assert.equal(idle.timedOut, false, 'the no-probe fallback exits inside its own bound');
  assert.equal(idle.code, 1);
  assert.match(idle.stderr, /Error: listen EADDRINUSE/);
  assert.doesNotMatch(idle.stderr, /collision listener/);
  await assert.rejects(readFile(join(idleHome, 'collided-served'), 'utf8'));
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(idlePort, '127.0.0.1', () => probe.close((error) => error ? reject(error) : resolve()));
  });

  // A fresh home enters the competitor path again. Its own bind is taken, so it reports the failed competitor
  // listen (not the ordinary HTTP server bind) and exits rather than waiting forever.
  const takenHome = await freshHome();
  const takenPort = await freePort();
  const occupying = createServer();
  await new Promise<void>((resolve, reject) => {
    occupying.once('error', reject);
    occupying.listen(takenPort, '127.0.0.1', resolve);
  });
  t.after(() => occupying.close());
  const failed = await fakeServe(takenHome, takenPort, { FAKE_OPENCODE_COLLIDE_SETTLE_MS: '5000' });
  assert.equal(failed.timedOut, false, 'a failed competitor bind exits instead of hanging');
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /Error: collision listener EADDRINUSE/);
});

test('OpenCode retries a port taken between choice and bind on a different port', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  fake.env.FAKE_OPENCODE_COLLIDE_ONCE = '1';
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'impl', { role: 'coordinator', model: 'opencode/fake-paid' });
  const ports = (await readFile(join(fake.home, 'serve-ports.jsonl'), 'utf8')).trim().split('\n').map(Number);
  // The collision port closes only after the adapter's readiness request against it settled, so no
  // in-flight request meets a socket whose process has already gone (T-1092).
  const served = (await readFile(join(fake.home, 'collided-served'), 'utf8')).trim();
  assert.equal(served, String(ports[0]));
  assert.equal(ports.length, 2);
  assert.ok(ports.every(port => port > 0));
  assert.notEqual(ports[0], ports[1]);
  assert.equal(new URL(launched.harnessId!).port, String(ports[1]));
});

test('OpenCode readiness bounds an unresponsive server and names its log explanation', { timeout: 3000 }, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: process.execPath, cli: CLI_ENTRY, spoke: SPOKE_ENTRY, log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} }, {
    bin: join(FAKE_OPENCODE_DIR, 'opencode'), env: { ...process.env, ...fake.env, FAKE_OPENCODE_UNREADY: '1' }, spawnDeadlineMs: 1000, stopGraceMs: 50,
  });
  t.after(() => adapter.close());
  await assert.rejects(adapter.spawn({ name: 'impl', role: null, model: 'opencode/fake-paid', cwd: root }), /did not answer within 1000 ms:.*database unavailable/);
  // The whole-test deadline bounds the rejected HTTP launch as well as its cleanup.
  assert.deepEqual(await fake.servers(), [], 'failed launch stops its owned server');
});

test('a launched OpenCode session: its own server, the spoke connects, a UI message goes queued → delivered → injected, the reply comes back, the state follows the event stream', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  // Suppress polling while SSE outage and stream recovery determine the observed state.
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const { discovery } = await projectHub(t, root, fake.env);
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
  assert.ok(config.mcp.servers.cland.environment.CLAND_LAUNCH_TOKEN, 'the private MCP configuration carries the launch credential');
  assert.equal(await readFile(join(root, '.cland', 'opencode', '.gitignore'), 'utf8').then((s) => s.split('\n').includes('*')), true);
  assert.equal((await stat(join(root, '.cland', 'opencode', 'impl', 'password'))).mode & 0o077, 0, 'the password file is private');
  // the first turn is the role clause the hub delivered
  await clauseAnswered(ui, 'impl');
  const present = await presentAs(ui, 'impl', 'idle');
  assert.equal(present.role, 'coordinator');
  assert.equal(present.sessionId, launched.sessionId);
  assertFirstLaunchClause(await hubLog(root, ui), 'impl');

  // session.list: the session, its state, and the capability table with its heuristic waiting states
  const list = (await ui.request({ type: 'session.list' })).value as { processes: Harness[]; adapters: Record<string, unknown> };
  assert.equal(list.processes.find((p) => p.name === 'impl')?.state, 'idle');
  assert.deepEqual(list.adapters.opencode, {
    terminal: 'none',
    launchPolicy: 'rules, not a sandbox',
    history: 'none',
    usage: 'reliable',
    setModel: 'none',
    approvalRelay: 'reliable',
    states: { busy: 'reliable', idle: 'reliable', 'waiting for approval': 'heuristic', 'waiting for human': 'heuristic' },
  });

  // attach: the OpenCode TUI against that server and session; the password comes from its file, not the command line.
  // The TUI is started in the session's directory, whatever the attaching terminal's: a TUI in another directory makes
  // the server open an instance there, whose MCP servers start a second spoke for the session (T-42's run).
  const attach = (await ui.request({ type: 'session.attach', session: 'impl' })).value as { command: string };
  assert.equal(attach.command, launched.attach);
  assert.equal(attach.command, `OPENCODE_DB='${join(fake.home, 'data', 'cland', 'opencode', 'opencode.db')}' env -u XDG_DATA_HOME OPENCODE_PASSWORD="$(cat '${join(root, '.cland', 'opencode', 'impl', 'password')}')" opencode --server ${launched.harnessId} --session ${launched.harnessSessionId} '${root}'`);
  const tuiOut = await new Promise<string>((resolve) => execFile('sh', ['-c', attach.command], { cwd: tmpdir(), env: fixtureEnvironment(fake.home, process.env, { ...fake.env }) }, (_e, stdout, stderr) => resolve(stdout + stderr)));
  assert.equal(tuiOut, `fake opencode TUI on ${launched.harnessId} session ${launched.harnessSessionId} (impl) in ${root}\n`);

  // the human writes in General: the prompt API admits it (injected), the answer comes through the spoke
  const id = await sendGeneral(ui, 'Reply with the single word pong');
  const stages = () => ui.frames.filter((f) => f.type === 'delivery' && f.message === id).map((f) => f.stage);
  await eventually('injected', () => (stages().includes('injected') ? true : undefined));
  assert.deepEqual(stages(), ['delivered', 'delivered', 'injected']); // Acceptance, submission fence, confirmation.
  assert.deepEqual(ui.frames.filter(f => f.type === 'delivery' && f.message === id).map(f => f.withdrawable), [true, false, false]);
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

  const usageEvent = await ui.waitFor((f) => f.type === 'session.usage' && f.session === 'impl' && (f.usage as { total?: { outputTokens?: number } }).total?.outputTokens === 4);
  assert.deepEqual(usageEvent.usage, h.usage, 'the stream publishes usage without a session list refresh');

  // stop: the server ends, the row says stopped, the state is unknown
  const stopped = (await ui.request({ type: 'session.stop', session: 'impl' }, 15_000)).value as { process: Harness };
  assert.equal(stopped.process.status, 'stopped');
  assert.equal(stopped.process.state, 'unknown');
  assert.deepEqual(await fake.servers(), []);
});

test('a launch without a model prefers big-pickle over a listed but deprecated free model', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await projectHub(t, root, { ...fake.env, FAKE_OPENCODE_DEPRECATED_FIRST: '1' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await launch(ui, 'impl', { role: 'coordinator' });
  assert.equal(launched.model, 'opencode/big-pickle');
  await clauseAnswered(ui, 'impl');
  await presentAs(ui, 'impl', 'idle');
  await sendGeneral(ui, 'does the default answer?');
  await replyTo(ui, 'impl', 'pong: does the default answer?');
});

test('a failed OpenCode turn is recorded in Agents and the events view and reported to the sender', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
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
  const events = (await ui.request({ type: 'events.list' })).value as { rows: Array<{ session?: string; text: string }> };
  assert.ok(events.rows.some((n) => n.session === 'impl' && n.text === expected));
  await coord.waitForEvent((e) => e.params.content.includes(expected));
  assert.equal((await status(ui)).harnesses.find((h) => h.name === launched.name)?.status, 'running');
});

test('a busy OpenCode turn queues the human’s message while an agent’s report steers it', async (t) => {
  const root = await tempProject(t);
  // Observe turn boundaries from SSE rather than polling.
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'impl', { role: 'coordinator', model: 'opencode/fake-paid' });
  assert.equal(launched.model, 'opencode/fake-paid');
  await clauseAnswered(ui, 'impl');
  await presentAs(ui, 'impl', 'idle');
  const sender = await inProcessSpoke(t, { cwd: root, discover: true, name: 'sender', role: 'reviewer' });
  await sender.waitForPresence(['sender', 'impl']);
  const clauseTurn = stateEvents(ui, 'impl').length;

  // Hold native execution without changing its busy state; no timer races the assertions.
  await api(launched, root, 'POST', '/test/turn', { paused: true });
  const first = await sendGeneral(ui, 'work on the first input');
  await ui.waitFor(f => f.type === 'delivery' && f.message === first && f.stage === 'injected');
  await presentAs(ui, 'impl', 'busy');
  const second = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'human input for the next turn' });
  assert.equal(second.ok, true, second.error);
  const queued = second.value as { message: { id: string }; outcomes: Array<{ outcome: string }> };
  assert.deepEqual(queued.outcomes.map(o => o.outcome), ['queued']);
  const report = await sender.call<{ ok: boolean; error?: string }>('send', { to: ['impl'], topic: 'general', text: 'agent report for this turn' });
  assert.equal(report.ok, true, report.error);
  const reportFrame = await ui.waitFor(f => f.type === 'message' && (f.message as { text: string }).text === 'agent report for this turn');
  const reportId = (reportFrame.message as { id: string }).id;
  await ui.waitFor(f => f.type === 'delivery' && f.message === reportId && f.stage === 'injected');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ id: string; stage: string }> };
  assert.equal(history.messages.find(m => m.id === queued.message.id)?.stage, 'queued');
  const heldPrompts = await fake.prompts(launched.harnessSessionId!);
  assert.ok(!heldPrompts.includes(queued.message.id), 'human input never reaches the native busy turn');
  assert.match(heldPrompts, /prompt steer \(running\): <channel [^\n]*from_kind="agent"[^\n]*>\nagent report for this turn/);

  await api(launched, root, 'POST', '/test/turn', { paused: false });
  await replyTo(ui, 'impl', 'pong: work on the first input');
  await replyTo(ui, 'impl', 'pong: agent report for this turn');
  await ui.waitFor(f => f.type === 'delivery' && f.message === queued.message.id && f.stage === 'injected');
  await replyTo(ui, 'impl', 'pong: human input for the next turn');
  await presentAs(ui, 'impl', 'idle');
  const prompts = (await fake.prompts(launched.harnessSessionId as string)).split('\n').filter((l) => l.startsWith('prompt '));
  // the role clause was the first prompt
  assert.match(prompts[1] as string, /^prompt queue: /);
  assert.match(prompts[2] as string, /^prompt steer \(running\): /, 'the agent report steered the running turn');
  assert.match(prompts[3] as string, /^prompt queue: /, 'the human input starts after the running turn ends');
  assert.equal(prompts.length, 4, 'each input reaches the native harness once');
  // The first turn consumes the agent report; the queued human input starts a second turn.
  const states = stateEvents(ui, 'impl').slice(clauseTurn).map((e) => e.state);
  assert.deepEqual(states.slice(states.indexOf('busy')), ['busy', 'idle', 'busy', 'idle']);
});

test('a pending permission is waiting for approval within one event, and the reply brings the turn back; a form is waiting for human', async (t) => {
  const root = await tempProject(t);
  // Suppress polling while SSE outage and stream recovery determine the observed state.
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const { discovery } = await projectHub(t, root, fake.env);
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
  const event = stateEvents(ui, 'impl').at(-1);
  assert.equal(event?.approvalCommand, 'edit', 'a non-shell approval exposes only its tool name, even if input has a command');
  assert.doesNotMatch(JSON.stringify(stateEvents(ui, 'impl')), /private-|touch approved|wrong command/);
  const rows = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ approvalCommand?: string }> };
  assert.equal(rows.processes[0]?.approvalCommand, 'edit');
  const pending = (await api(launched, root, 'GET', `/api/session/${launched.harnessSessionId}/permission`)) as { data: Array<{ id: string }> };
  assert.equal(pending.data.length, 1);
  // the human approves in the TUI (the reply endpoint): the turn goes on, then ends
  await api(launched, root, 'POST', `/api/session/${launched.harnessSessionId}/permission/${pending.data[0]?.id}/reply`, { decision: 'once' });
  await replyTo(ui, 'impl', 'pong: this one needs approval');
  await presentAs(ui, 'impl', 'idle');
  const after = stateEvents(ui, 'impl').map((e) => e.state);
  assert.deepEqual(after.slice(after.lastIndexOf('waiting for approval')), ['waiting for approval', 'busy', 'idle']);
  const cleared = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ approvalCommand?: string }> };
  assert.equal(cleared.processes[0]?.approvalCommand, undefined);

  await sendGeneral(ui, 'this one needs a form');
  await presentAs(ui, 'impl', 'waiting for human');
  const forms = (await api(launched, root, 'GET', `/api/session/${launched.harnessSessionId}/form`)) as { data: Array<{ id: string }> };
  await api(launched, root, 'DELETE', `/api/session/${launched.harnessSessionId}/form/${forms.data[0]?.id}`);
  await replyTo(ui, 'impl', 'pong: this one needs a form');
  await presentAs(ui, 'impl', 'idle');
  const formStates = stateEvents(ui, 'impl').map((e) => e.state);
  assert.deepEqual(formStates.slice(formStates.lastIndexOf('waiting for human')), ['waiting for human', 'busy', 'idle']);
  assert.ok(stateEvents(ui, 'impl').every((e) => e.source === 'sse' || e.source === 'resume'), 'every state came from the event stream');

  // C8: the human gate carries a Deny and its note through the real HTTP edge to the fake binary.
  const mark = ui.frames.length;
  await sendGeneral(ui, 'this one needs approval: shell approval');
  const permission = await ui.waitFor(e => ui.frames.indexOf(e) >= mark && e.type === 'approval' && (e.approval as ApprovalRecord).answerIn === 'hub' && (e.approval as ApprovalRecord).subject.command === 'touch approved && echo done');
  const record = permission.approval as ApprovalRecord;
  const note = 'Do not change the workspace.';
  const answer = await ui.request({ type: 'approval.answer', approval: record.id, choice: 'deny', note });
  assert.equal(answer.ok, true, answer.error);
  const receipt = await eventually('fake binary durably logs the permission reply', async () => (await fake.prompts(launched.harnessSessionId!)).split('\n').find(line => line.startsWith('permission-reply ') && JSON.parse(line.slice('permission-reply '.length)).request === record.id.slice(launched.sessionId.length + 1)));
  assert.deepEqual(JSON.parse(receipt.slice('permission-reply '.length)), { session: launched.harnessSessionId, request: record.id.slice(launched.sessionId.length + 1), decision: 'reject', message: note });
  t.diagnostic(receipt);
  await ui.waitFor(e => ui.frames.indexOf(e) >= mark && e.type === 'approval' && (e.approval as ApprovalRecord).id === record.id && (e.approval as ApprovalRecord).state === 'closed');
  assert.equal(((answer.value as { approval: ApprovalRecord }).approval).outcome?.choice, 'deny');
});

test('a killed OpenCode server: the state turns unknown and the hub logs it once', async (t) => {
  const root = await tempProject(t);
  // Suppress polling while SSE outage and stream recovery determine the observed state.
  const fake = await fakeOpenCode(t, { pollMs: 10_000 });
  const { discovery } = await projectHub(t, root, fake.env);
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
  const exitLogLines = async () => (await hubLog(root, ui)).split('\n').filter((l) => l.includes('"harness-exited"'));
  const logged = await exitLogLines();
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
  assert.equal((await exitLogLines()).length, 1, 'one crash event after the relaunched server replies');
});

test('after a hub restart, resume re-finds the OpenCode server and session through the process table and the event stream goes on', async (t) => {
  const root = await tempProject(t);
  // Suppress polling while SSE outage and stream recovery determine the observed state.
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
  assert.match(await hubLog(root, ui2), /"event":"session-resumed","session":"impl"/);
  await presentAs(ui2, 'impl', 'idle');

  const id = await sendGeneral(ui2, 'still there?');
  await ui2.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await replyTo(ui2, 'impl', 'pong: still there?');
  await presentAs(ui2, 'impl', 'idle');
  assert.ok(stateEvents(ui2, 'impl').some((e) => e.state === 'busy' && e.source === 'sse'), 'busy from the stream after the restart');
});

// T-304: a missing native conversation needs explicit consent to launch fresh.
test('a stopped OpenCode session whose native conversation disappeared offers fresh instead of recreating its id', { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const before = await launch(ui, 'impl', { role: 'implementer', brief: 'Start the replacement from this OpenCode brief.' });
  await eventually('first input reaches OpenCode', async () => (await fake.prompts(before.harnessSessionId!)).includes('OpenCode brief') || undefined);
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl' }, 30_000)).ok, true);
  await rm(join(fake.home, 'sessions', `${before.harnessSessionId}.json`));
  const r = await ui.request({ type: 'session.resume', session: 'impl', relaunch: true }, 30_000);
  assert.equal(r.ok, true, r.error);
  const value = r.value as { found: boolean; reason: string; fresh: { brief: string } };
  assert.equal(value.found, false);
  assert.match(value.reason, /session not found/);
  assert.equal(value.fresh.brief, 'Start the replacement from this OpenCode brief.');
  await writeFile(join(fake.home, 'fail-session'), 'refuse the fresh launch');
  const refused = await ui.request({ type: 'session.resume', session: 'impl', fresh: true }, 30_000);
  assert.equal(refused.ok, false);
  const listed = (await ui.request({ type: 'session.list' })).value as { processes: Harness[] };
  assert.equal(listed.processes[0]?.harnessSessionId, before.harnessSessionId, 'failed fresh launch preserves the stopped conversation row');
  await rm(join(fake.home, 'fail-session'));
  const fresh = await ui.request({ type: 'session.resume', session: 'impl', fresh: true }, 30_000);
  assert.equal(fresh.ok, true, fresh.error);
  const after = (fresh.value as { process: Harness }).process;
  assert.equal(after.sessionId, before.sessionId);
  assert.notEqual(after.harnessSessionId, before.harnessSessionId);
  await eventually('fresh first input carries OpenCode brief', async () => (await fake.prompts(after.harnessSessionId!)).includes('OpenCode brief') || undefined);
});

for (const fallback of [false, true]) test(`OpenCode role instructions are opt-in and replace the entry on role changes (${fallback ? 'message fallback' : 'instructions'})`, async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  if (fallback) await writeFile(join(fake.home, 'fail-instructions'), 'unsupported');
  const { discovery } = await projectHub(t, root, { ...fake.env, CLAND_OPENCODE_ROLE_INSTRUCTIONS: '1' });
  const ui = await connectUi(t, discovery);
  const h = await launch(ui, 'impl-instructions', { role: 'implementer', brief: 'Build the synthetic brief.' });
  await eventually('brief still arrives as a prompt', async () => (await fake.prompts(h.harnessSessionId!)).includes('Build the synthetic brief.') || undefined);
  const path = `/api/experimental/session/${h.harnessSessionId}/instructions/entries`;
  const entries = async () => (await api(h, root, 'GET', path) as { data: Array<{ key: string; value: string }> }).data;
  if (fallback) {
    assert.match(await fake.prompts(h.harnessSessionId!), /you hold the role Implementer/);
    assert.deepEqual(await entries(), []);
    assert.match(await hubLog(root, ui), /opencode-instructions-fallback/);
  } else {
    assert.doesNotMatch(await fake.prompts(h.harnessSessionId!), /you hold the role Implementer/);
    assert.equal((await entries()).length, 1);
    assert.equal((await entries())[0]?.key, 'cland-role');
    assert.match((await entries())[0]!.value, /you hold the role Implementer/);
    assert.equal((await ui.request({ type: 'role.set', session: h.name, role: 'reviewer' })).ok, true);
    await eventually('role instruction replaced', async () => (await entries())[0]?.value.includes('you hold the role Reviewer') || undefined);
    assert.equal((await entries()).length, 1);
    assert.equal((await ui.request({ type: 'role.clear', session: h.name })).ok, true);
    await eventually('revocation replaces the old instruction', async () => (await entries())[0]?.value.includes('no longer holds') || undefined);
    assert.equal((await entries()).length, 1);
  }
});
