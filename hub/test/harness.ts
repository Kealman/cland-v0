// The test harness for the two seams:
//   1. the spoke's MCP stdio surface — the real spoke process, driven by the SDK's client
//   2. the hub's WebSocket edge — an in-process hub on an ephemeral port
//   3. the daemon — `cland hub …` run as its own process in a temporary project, and its Unix socket
// Nothing here reaches into either side's state; everything goes through the seams.
import './account-fixture-env.ts';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { createHub, type Hub, type HubOptions } from '../src/hub/server.ts';
import { findDiscovery, readDiscovery as readDiscoveryFile } from '../src/project.ts';
import { processStarted } from '../src/hub/lock.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { cleanupOwnedProcesses, ownDirectory, ownProcess, recordedProcess, rememberProcess, rememberResultProcesses } from './process-cleanup.ts';

export const SPOKE_ENTRY = fileURLToPath(new URL('../bin/cland-spoke.ts', import.meta.url));

/** The tools the spoke serves — the one list every surface assertion reads. */
export const DOCUMENTED_TOOLS = ['artifact.archive', 'artifact.create', 'artifact.keep', 'artifact.list', 'artifact.move', 'artifact.promote', 'ask', 'ask.answer', 'ask.forward', 'history', 'merge', 'rename', 'resolve', 'role.handover', 'role.state', 'send', 'session.archive', 'session.launch', 'session.prune', 'status', 'subscribe', 'subscriptions', 'task.claim', 'task.close', 'task.comment', 'task.create', 'task.criterion', 'task.edit', 'task.hold', 'task.link', 'task.list', 'task.plan', 'task.rank', 'task.view', 'topic.create', 'unsubscribe', 'who'] as const;

export const ChannelEvent = z.object({
  method: z.literal('notifications/claude/channel'),
  params: z.object({ content: z.string(), meta: z.record(z.string(), z.string()).optional() }),
});
export type ChannelEvent = z.infer<typeof ChannelEvent>;

export const TEST_SECRET = 'test-secret';

/** An early first clause grants the launch role; after acceptance it uses the authoritative held role. */
export function assertFirstLaunchClause(log: string, session: string): void {
  const events = log.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line) as { event: string; session?: string; name?: string; reason?: string });
  const acceptedAt = events.findIndex(event => event.event === 'session-launched' && event.session === session);
  const helloAt = events.findIndex(event => event.event === 'hello' && event.name === session);
  assert.ok(acceptedAt >= 0 && helloAt >= 0);
  assert.equal(events.find(event => event.event === 'role-clause' && event.session === session)?.reason, acceptedAt < helloAt ? 'hello' : 'assigned at launch', 'acceptance retires the first grant; a later hello uses the held role');
}

export async function startHub(options: Partial<HubOptions> = {}): Promise<Hub> {
  return createHub({ port: 0, host: '127.0.0.1', secret: TEST_SECRET, ...options });
}

export type SpokeOptions = {
  /** The in-process hub to reach through CLAND_HUB_URL; absent with `discover` or `unconfigured`. */
  hub?: { url: string };
  secret?: string;
  /** Requested name (CLAND_SESSION_NAME). */
  name?: string;
  /** The role the session runs under (CLAND_ROLE). */
  role?: string;
  /**
   * A `discover` spoke with a name connects to a project's hub, which admits only a session holding a role (spec
   * 4.4): the harness first assigns it one, as the human would (`role.set` on the project's socket): `role`, else
   * implementer. False leaves the session roleless, for a test of the refusal.
   */
  assignRole?: boolean;
  /** No hub url and secret at all — the "not started through cland" case. */
  unconfigured?: boolean;
  /** No hub url and secret either: the spoke finds the hub through `.cland/hub.json` from its `cwd` up. */
  discover?: boolean;
  sessionId?: string;
  launchToken?: string;
  cwd?: string;
  heartbeatMs?: number;
  /** How long a request waits for the hub's reply (CLAND_HUB_REQUEST_TIMEOUT_MS). */
  requestTimeoutMs?: number;
  /** How long a silent hub has to welcome the spoke (CLAND_HUB_WELCOME_TIMEOUT_MS). */
  welcomeTimeoutMs?: number;
};

export type Session = {
  client: Client;
  events: ChannelEvent[];
  waitForEvent: (predicate: (e: ChannelEvent) => boolean, timeoutMs?: number) => Promise<ChannelEvent>;
  /** Poll `who()` until every named session is present (the spoke connects asynchronously). */
  waitForPresence: (names: string[], timeoutMs?: number) => Promise<void>;
  /** Call a tool and parse its JSON text result. */
  call: <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<T>;
  /** Everything this spoke has written to stderr, for a failing assertion to quote. */
  log: () => string;
  /** The spoke's process id: a test may pause it (SIGSTOP) to make it fall silent on the wire. */
  pid: number;
  close: () => Promise<void>;
};

/** A spoke's connect on a loaded machine: the loop returns the moment presence shows, so only a real defect pays this. */
export const PRESENCE_DEADLINE_MS = 30_000;

export async function spawnSpoke(options: SpokeOptions): Promise<Session> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    CLAND_SESSION_ID: options.sessionId ?? 'sess-test',
    // reconnect fast in tests
    CLAND_HUB_RECONNECT_MS: '50',
    CLAND_HUB_HEARTBEAT_MS: String(options.heartbeatMs ?? 30_000),
  };
  if (options.discover && !options.cwd) throw new Error('a discovering spoke needs the cwd of a project');
  if (!options.unconfigured && !options.discover) {
    if (!options.hub) throw new Error('spawnSpoke: pass `hub`, `discover` or `unconfigured`');
    env.CLAND_HUB_URL = options.hub.url;
    env.CLAND_HUB_SECRET = options.secret ?? TEST_SECRET;
  }
  if (options.requestTimeoutMs !== undefined) env.CLAND_HUB_REQUEST_TIMEOUT_MS = String(options.requestTimeoutMs);
  if (options.welcomeTimeoutMs !== undefined) env.CLAND_HUB_WELCOME_TIMEOUT_MS = String(options.welcomeTimeoutMs);
  if (options.discover && options.name && options.assignRole !== false) await assignRole(options.cwd as string, options.name, options.role ?? 'implementer');
  if (options.name) env.CLAND_SESSION_NAME = options.name;
  if (options.role) env.CLAND_ROLE = options.role;
  if (options.launchToken) env.CLAND_LAUNCH_TOKEN = options.launchToken;
  const workDir = await mkdtemp(join(tmpdir(), 'cland-spoke-'));
  const cleanup = ownDirectory(undefined, workDir);
  const transport = new StdioClientTransport({ command: process.execPath, args: [SPOKE_ENTRY], env, cwd: options.cwd ?? workDir, stderr: 'pipe' });
  const client = new Client({ name: 'harness', version: '0.0.0' }, { capabilities: {} });
  const events: ChannelEvent[] = [];
  const waiters: Array<{ predicate: (e: ChannelEvent) => boolean; resolve: (e: ChannelEvent) => void }> = [];
  client.setNotificationHandler(ChannelEvent, async (event) => {
    events.push(event);
    for (const w of [...waiters]) {
      if (w.predicate(event)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(event);
      }
    }
  });
  try { await client.connect(transport); }
  catch (error) {
    await client.close();
    if (transport.pid) await killDaemon(transport.pid);
    await cleanup();
    throw error;
  }
  const cleanupSpoke = ownProcess(undefined, transport.pid ?? undefined);
  // Always kept, printed only when asked: a failing case can quote what the spoke decided and why.
  let log = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    log += String(chunk);
    if (process.env.CLAND_TEST_VERBOSE) process.stderr.write(`[spoke ${options.name ?? '?'}] ${chunk}`);
  });

  const call = async <T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const result = await client.callTool({ name, arguments: args });
    const content = (result.content as Array<{ type: string; text?: string }>)[0];
    if (!content || content.type !== 'text' || content.text === undefined) throw new Error(`tool ${name}: no text content`);
    const parsed = JSON.parse(content.text) as T;
    rememberResultProcesses(parsed, options.cwd ?? workDir);
    return parsed;
  };

  const waitForEvent = (predicate: (e: ChannelEvent) => boolean, timeoutMs = 5000): Promise<ChannelEvent> => {
    const hit = events.find(predicate);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no channel event matched within ${timeoutMs}ms; saw ${JSON.stringify(events)}`)), timeoutMs);
      waiters.push({
        predicate,
        resolve: (e) => {
          clearTimeout(timer);
          resolve(e);
        },
      });
    });
  };

  // Through this spoke's own `who`: it returns once this spoke is connected (welcomed: its own calls work) and sees
  // every name. Another spoke's presence is the hub's view, which comes before this spoke has read its welcome.
  const waitForPresence = async (names: string[], timeoutMs = PRESENCE_DEADLINE_MS): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    let last: unknown;
    while (Date.now() < deadline) {
      last = await call<{ ok: boolean; sessions?: Array<{ name: string }> }>('who');
      const sessions = (last as { sessions?: Array<{ name: string }> }).sessions;
      if (Array.isArray(sessions) && names.every((n) => sessions.some((d) => d.name === n))) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`presence never showed ${names.join(',')}; last who(): ${JSON.stringify(last)}\n${log}`);
  };

  return {
    client,
    events,
    log: () => log,
    pid: transport.pid as number,
    waitForEvent,
    waitForPresence,
    call,
    close: async () => {
      await client.close();
      await cleanupSpoke();
      await cleanup();
    },
  };
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** The human assigns `role` to the session `name` on the project's hub found from `cwd` up (its socket, `role.set`). */
export async function assignRole(cwd: string, name: string, role: string): Promise<void> {
  const file = findDiscovery(cwd);
  const discovery = file ? readDiscoveryFile(file) : null;
  if (!discovery) throw new Error(`no hub.json from ${cwd} up: start the project's hub first`);
  const socket = await connectSocket(discovery.socket);
  try {
    socket.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'harness' });
    const welcome = await socket.next();
    if (welcome.type !== 'welcome') throw new Error(`the hub refused the harness: ${JSON.stringify(welcome)}`);
    socket.send({ type: 'role.set', id: 'assign', session: name, role });
    const result = await socket.next();
    if (result.ok !== true) throw new Error(`role.set ${name} ${role}: ${String(result.error)}`);
  } finally {
    socket.close();
  }
}

/** Poll `who()` through `viewer` until `name` has left presence (a close is processed asynchronously). */
export async function waitForAbsence(viewer: Session, name: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // a viewer between connections answers no `sessions`: that says nothing about `name`
    const who = await viewer.call<{ sessions?: Array<{ name: string }> }>('who');
    if (Array.isArray(who.sessions) && !who.sessions.some((d) => d.name === name)) return;
    await sleep(25);
  }
  throw new Error(`${name} never left presence within ${timeoutMs}ms`);
}

// ------------------------------------------------------------------ the daemon seam
// The `cland` CLI run as a separate process in a temporary project, and the hub's Unix socket spoken to
// as JSON lines — the way `cland hub status` and the UI reach a daemon.

export const CLI_ENTRY = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));

export type CliResult = { code: number | null; stdout: string; stderr: string };

/** Run `cland <args>` in `cwd` as its own process, with no `CLAND_*` variable from the test's environment. */
export function cland(cwd: string, ...args: string[]): Promise<CliResult> {
  return clandWithEnv(cwd, {}, ...args);
}

/** `cland` with `extra` added to its environment: a test hook such as CLAND_TEST_TASK_WRITE_GATE, or a daemon that launches a fake harness. */
export async function clandWithEnv(cwd: string, extra: Record<string, string>, ...args: string[]): Promise<CliResult> {
  if (args[0] === 'hub' && ['start', 'serve'].includes(args[1] ?? '')) await isolateVerification(cwd);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  // Doctor normally discovers deleted-project hubs machine-wide. Tests only inspect their own fixture.
  if (args[0] === 'doctor') env.CLAND_TEST_ORPHAN_ROOT = cwd;
  Object.assign(env, extra);
  return new Promise((resolve, reject) => {
    // Merge waits up to 60 s for the hub; the outer process budget must also allow CLI startup.
    const timeout = args[0] === 'merge' ? 65_000 : 30_000;
    execFile(process.execPath, [CLI_ENTRY, ...args], { cwd, env, encoding: 'utf8', timeout }, (err, stdout, stderr) => {
      if (err && typeof err.code !== 'number') reject(err);
      else {
        const daemonPid = /\bpid +(\d+)/.exec(stdout)?.[1];
        if (daemonPid) rememberProcess(Number(daemonPid), cwd);
        try { rememberResultProcesses(JSON.parse(stdout), cwd); } catch { /* plain CLI output */ }
        resolve({ code: err ? (err.code as number) : 0, stdout, stderr });
      }
    });
  });
}

/**
 * A test option for the tests that need a process's start time, which is how the hub knows a pid is still the
 * process it started before it signals it: `{ skip: NO_PS }`. `ps` is setuid, and a sandbox that refuses setuid
 * binaries (Codex's seatbelt, where a sandboxed session runs this suite) leaves the hub unable to stop anything.
 */
export const NO_PS: string | false = processStarted(process.pid) === null ? 'needs `ps` for pid identity, and this sandbox refuses it' : false;

/** A fresh project folder under the system temp dir, removed when the test ends (after its daemon is gone). */
export async function tempProject(t: TestContext, prefix = 'cland-proj-', parent = tmpdir()): Promise<string> {
  const root = await realpath(await mkdtemp(join(parent, prefix)));
  ownDirectory(t, root);
  return root;
}

export type Discovery = { root?: string; socket: string; port: number; secret: string; pid: number; version: string };

export const readDiscovery = async (root: string): Promise<Discovery> => {
  const discovery = JSON.parse(await readFile(join(root, '.cland', 'hub.json'), 'utf8')) as Discovery;
  rememberProcess(discovery.pid, root);
  return { ...discovery, root };
};

export const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/** Give every real scratch-hub launch a fixture-local compatibility fence. */
export async function isolateVerification(root: string): Promise<void> {
  // A scratch hub must never inspect or sweep another run's machine-wide leases.
  const configPath = join(root, '.cland', 'config.toml');
  const source = await readFile(configPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  const config = parseToml(source);
  const verification = config.verification ?? {};
  assert.ok(typeof verification === 'object' && verification !== null && !Array.isArray(verification) && !(verification instanceof Date));
  if (!('lock_path' in verification) || verification.lock_path === '/tmp/cland-suite.lock') {
    verification.lock_path = join(root, 'suite.lock');
    config.verification = verification;
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(configPath, stringifyToml(config));
  }
}

/** Start a fixture without startup orphan inspection; pass { sweep: true } as the fourth argument to opt in.
 * An explicit CLAND_TEST_SKIP_ORPHAN_SWEEP in env takes precedence. Teardown owns the returned PID. */
export async function startDaemon(t: TestContext, root: string, env: Record<string, string> = {}, options: { sweep?: boolean } = {}): Promise<{ result: CliResult; discovery: Discovery }> {
  env = { DIGITALOCEAN_TOKEN: '', CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), CLAND_TEST_SKIP_ORPHAN_SWEEP: options.sweep ? '0' : '1', ...env };
  const result = await clandWithEnv(root, env, 'hub', 'start');
  let discovery: Discovery | null = null;
  try {
    discovery = await readDiscovery(root);
  } catch {
    /* asserted by the caller through `result` */
  }
  const pid = discovery?.pid;
  if (pid !== undefined) ownProcess(t, pid);
  if (result.code !== 0 || !discovery) throw new Error(`cland hub start failed (${result.code}):\n${result.stdout}\n${result.stderr}`);
  return { result, discovery };
}

export async function killDaemon(pid: number): Promise<void> {
  const identity = recordedProcess(pid);
  if (identity) await cleanupOwnedProcesses([identity]);
}

/** A JSON-lines client on the hub's Unix socket: send frames, await the next one. */
export type SocketClient = {
  send: (frame: Record<string, unknown>) => void;
  /** Write bytes as they are: several lines at once, or part of one. */
  write: (raw: string) => void;
  next: (timeoutMs?: number) => Promise<Record<string, unknown>>;
  /** Resolves when the hub closed the connection. */
  closed: Promise<void>;
  close: () => void;
};

export async function connectSocket(path: string): Promise<SocketClient> {
  const socket = createConnection(path);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const frames: Array<Record<string, unknown>> = [];
  const waiters: Array<(f: Record<string, unknown>) => void> = [];
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      const frame = JSON.parse(line) as Record<string, unknown>;
      const w = waiters.shift();
      if (w) w(frame);
      else frames.push(frame);
    }
  });
  const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()));
  socket.on('error', () => {});
  return {
    send: (frame) => socket.write(`${JSON.stringify(frame)}\n`),
    write: (raw) => socket.write(raw),
    next: (timeoutMs = 5000) => {
      const f = frames.shift();
      if (f) return Promise.resolve(f);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no frame on the socket within ${timeoutMs}ms`)), timeoutMs);
        waiters.push((frame) => {
          clearTimeout(timer);
          resolve(frame);
        });
      });
    },
    closed,
    close: () => socket.destroy(),
  };
}

// ------------------------------------------------------------------ the UI's seam
// A scripted UI client: the hub's frames as JSON lines over any byte stream (the Unix socket, or a child
// hub's stdio), requests correlated by id, pushed events collected in order.

export type FrameClient = {
  /** Send a request (an id is added) and resolve with its `result` frame. */
  request: (frame: { type: string } & Record<string, unknown>, timeoutMs?: number) => Promise<{ ok: boolean; value?: unknown; error?: string }>;
  /** Every frame that was not a result: the welcome, refusals, `message` and `delivery` events. */
  frames: Array<Record<string, unknown>>;
  /** The first frame (seen or yet to come) matching `predicate`. */
  waitFor: (predicate: (f: Record<string, unknown>) => boolean, timeoutMs?: number) => Promise<Record<string, unknown>>;
  /** Send a frame as is. */
  send: (frame: Record<string, unknown>) => void;
  close: () => void;
};

export function frameClient(write: (line: string) => void, onData: (fn: (chunk: string) => void) => void, close: () => void, root?: string): FrameClient {
  const frames: Array<Record<string, unknown>> = [];
  const results = new Map<string, (f: Record<string, unknown>) => void>();
  const waiters: Array<{ predicate: (f: Record<string, unknown>) => boolean; resolve: (f: Record<string, unknown>) => void }> = [];
  let buffer = '';
  let nextId = 1;
  onData((chunk) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const frame = JSON.parse(line) as Record<string, unknown>;
      const r = frame.type === 'result' && typeof frame.id === 'string' ? results.get(frame.id) : undefined;
      if (r) {
        results.delete(frame.id as string);
        r(frame);
        continue;
      }
      frames.push(frame);
      for (const w of [...waiters]) {
        if (w.predicate(frame)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(frame);
        }
      }
    }
  });
  const send = (frame: Record<string, unknown>) => write(`${JSON.stringify(frame)}\n`);
  return {
    frames,
    send,
    close,
    request: (frame, timeoutMs = 5000) =>
      new Promise((resolve, reject) => {
        const id = `r${nextId++}`;
        const timer = setTimeout(() => {
          results.delete(id);
          reject(new Error(`no result for ${frame.type} within ${timeoutMs}ms`));
        }, timeoutMs);
        results.set(id, (f) => {
          clearTimeout(timer);
          rememberResultProcesses(f, root);
          resolve(f as { ok: boolean; value?: unknown; error?: string });
        });
        send({ ...frame, id });
      }),
    waitFor: (predicate, timeoutMs = 5000) => {
      const hit = frames.find(predicate);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no frame matched within ${timeoutMs}ms; saw ${JSON.stringify(frames)}`)), timeoutMs);
        waiters.push({
          predicate,
          resolve: (f) => {
            clearTimeout(timer);
            resolve(f);
          },
        });
      });
    },
  };
}

/** A UI client on the daemon's Unix socket, welcomed with the project's secret. */
export async function connectUi(t: TestContext, discovery: Pick<Discovery, 'socket' | 'secret' | 'root'>, client = 'ui'): Promise<FrameClient> {
  const socket = createConnection(discovery.socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  socket.setEncoding('utf8');
  socket.on('error', () => {});
  const ui = frameClient(
    (line) => socket.write(line),
    (fn) => socket.on('data', fn),
    () => socket.destroy(),
    discovery.root,
  );
  t.after(() => ui.close());
  ui.send({ type: 'hello', protocol: 2, secret: discovery.secret, client });
  const welcome = await ui.waitFor((f) => f.type === 'welcome' || f.type === 'error');
  if (welcome.type !== 'welcome') throw new Error(`the hub refused the UI: ${JSON.stringify(welcome)}`);
  return ui;
}

/** Drain a live daemon's queued log and journal writes before a file assertion without a UI client. */
export async function flushProjectLogs(t: TestContext, root: string): Promise<void> {
  const ui = await connectUi(t, await readDiscovery(root));
  try {
    const result = await ui.request({ type: 'hub.status', flushLogs: true });
    assert.equal(result.ok, true, result.error);
  } finally {
    ui.close();
  }
}

/** A UI client on an in-process hub's WebSocket (a client hello works there too), welcomed. */
export async function connectWsUi(t: TestContext, hub: { url: string }, client = 'ui'): Promise<FrameClient> {
  const ws = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  ws.on('error', () => {});
  const ui = frameClient(
    (line) => ws.send(line.trimEnd()),
    (fn) => ws.on('message', (data) => fn(`${data.toString()}\n`)),
    () => ws.terminate(),
  );
  t.after(() => ui.close());
  ui.send({ type: 'hello', protocol: 2, client });
  const welcome = await ui.waitFor((f) => f.type === 'welcome' || f.type === 'error');
  if (welcome.type !== 'welcome') throw new Error(`the hub refused the UI: ${JSON.stringify(welcome)}`);
  return ui;
}

// ------------------------------------------------------------------ the harness process seam
// A fake Claude Code (`test/fakes/claude-code/claude`) first on the PATH of a daemon, so the Claude Code adapter
// launches it as it would launch the real one. Its sessions are killed when the test ends.

export const FAKE_CLAUDE_DIR = fileURLToPath(new URL('./fakes/claude-code', import.meta.url));

export type FakeClaude = {
  /** The environment a daemon is started with: the fake first on the PATH, fast adapter timings. */
  env: Record<string, string>;
  home: string;
  calls: () => Promise<Array<{ at: number; args: string[]; configDir: string }>>;
  /** The fake's live sessions, as `claude agents --json` lists them. */
  sessions: () => Promise<Array<{ pid: number; id: string; sessionId: string; cwd: string; status: string; waitingFor?: string; name: string | null }>>;
  /** What one fake session logged (hooks that failed, tool calls, the mod's bridge). */
  log: (id: string) => Promise<string>;
  /** How a background session was started: the flags `claude --bg` was given. */
  job: (id: string) => Promise<{ name: string | null; model: string | null; effort: string | null }>;
};

export async function fakeClaude(
  t: TestContext,
  timings: { pollMs?: number; injectTimeoutMs?: number; pushTrustMs?: number; turnMs?: number; stopGraceMs?: number; dropFirst?: boolean; lateBg?: boolean | 'bridged'; stopCrash?: boolean; ignoreTerm?: boolean } = {},
): Promise<FakeClaude> {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-claude-')));
  const cleanupHome = ownDirectory(undefined, home);
  const env = {
    PATH: `${FAKE_CLAUDE_DIR}:${process.env.PATH ?? ''}`,
    FAKE_CLAUDE_HOME: home,
    CLAND_CLAUDE_AGENTS_MS: String(timings.pollMs ?? 50),
    FAKE_CLAUDE_TURN_MS: String(timings.turnMs ?? 30),
    CLAND_ADAPTER_POLL_MS: String(timings.pollMs ?? 50),
    CLAND_INJECT_TIMEOUT_MS: String(timings.injectTimeoutMs ?? 5000),
    CLAND_PUSH_TRUST_MS: String(timings.pushTrustMs ?? 100),
    ...(timings.dropFirst ? { FAKE_CLAUDE_DROP_FIRST: '1' } : {}),
    ...(timings.lateBg ? { FAKE_CLAUDE_LATE_BG: timings.lateBg === 'bridged' ? 'bridged' : '1' } : {}),
    ...(timings.stopCrash ? { FAKE_CLAUDE_STOP_CRASH: '1' } : {}),
    ...(timings.ignoreTerm ? { FAKE_CLAUDE_IGNORE_TERM: '1' } : {}),
    ...(timings.stopGraceMs ? { CLAND_STOP_GRACE_MS: String(timings.stopGraceMs) } : {}),
  };
  const sessions = async () => {
    const out = await new Promise<string>((resolve) =>
      execFile(join(FAKE_CLAUDE_DIR, 'claude'), ['agents', '--json'], { env: { ...process.env, ...env }, encoding: 'utf8' }, (_err, stdout) => resolve(stdout)),
    );
    try {
      const result = JSON.parse(out) as Awaited<ReturnType<FakeClaude['sessions']>>;
      rememberResultProcesses(result, home);
      return result;
    } catch {
      return [];
    }
  };
  t.after(async () => {
    for (const s of await sessions()) await killDaemon(s.pid);
    await cleanupHome();
  });
  return {
    env,
    home,
    sessions,
    calls: async () => (await readFile(join(home, 'calls.jsonl'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
    log: async (id) => readFile(join(home, 'jobs', `${id}.log`), 'utf8').catch(() => ''),
    job: async (id) => JSON.parse(await readFile(join(home, 'jobs', `${id}.json`), 'utf8')) as { name: string | null; model: string | null; effort: string | null },
  };
}

/**
 * A launched session's first turn is its role clause, injected by its adapter (spec 4.4); the fake harnesses answer
 * every turn with "pong: <text>". Wait for that answer on a subscribed UI, so the turns a test asserts on come after it.
 */
export const clauseAnswered = (ui: FrameClient, session: string, timeoutMs = 15_000) =>
  ui.waitFor((f) => f.type === 'message' && (f.message as { from: string }).from === session && (f.message as { text: string }).text.startsWith('pong: cland hub: you hold the role'), timeoutMs);

/** Test-only failure budget; production processes never read this setting. */
export function testWaitMs(fallbackMs = 15_000): number {
  const configured = Number(process.env.CLAND_TEST_WAIT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : fallbackMs;
}

/** Claude launches may return before the shared agents schedule discovers their pid. */
export async function withDiscoveredPid<T extends { sessionId: string }>(ui: FrameClient, launched: T): Promise<T & { pid: number }> {
  const pid = await eventually(`pid discovered for ${launched.sessionId}`, async () => {
    const listed = await ui.request({ type: 'session.list' });
    assert.equal(listed.ok, true, listed.error);
    return (listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.sessionId === launched.sessionId)?.pid || undefined;
  }, testWaitMs(45_000));
  return { ...launched, pid };
}

/** Poll until `check` returns a value (not undefined), or fail with what was last seen. */
export async function eventually<T>(what: string, check: () => Promise<T | undefined> | T | undefined, timeoutMs = testWaitMs()): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const v = await check();
      if (v !== undefined) return v;
    } catch (err) {
      last = err;
    }
    await sleep(50);
  }
  throw new Error(`${what}: not within ${timeoutMs} ms${last ? ` (last error: ${String(last)})` : ''}`);
}

// ------------------------------------------------------------------ the fake Codex
// `test/fakes/codex/codex` first on a daemon's PATH, so the Codex adapter launches it as it would the real one. Its
// app-servers are killed when the test ends.

export const FAKE_CODEX_DIR = fileURLToPath(new URL('./fakes/codex', import.meta.url));

export type FakeCodexServer = { pid: number; socket: string; argv: string[]; cwd: string };

export type FakeCodex = {
  env: Record<string, string>;
  home: string;
  /** The live fake app-servers. */
  servers: () => Promise<FakeCodexServer[]>;
  log: (pid: number) => Promise<string>;
};

export async function fakeCodex(t: TestContext, options: { pollMs?: number; injectTimeoutMs?: number; turnMs?: number; env?: Record<string, string> } = {}): Promise<FakeCodex> {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-codex-')));
  const cleanupHome = ownDirectory(undefined, home);
  const env = {
    PATH: `${FAKE_CODEX_DIR}:${process.env.PATH ?? ''}`,
    FAKE_CODEX_HOME: home,
    FAKE_CODEX_TURN_MS: String(options.turnMs ?? 30),
    FAKE_CODEX_REFUSE_MS: '150',
    CLAND_PUSH_TRUST_MS: '100',
    CLAND_ADAPTER_POLL_MS: String(options.pollMs ?? 50),
    CLAND_INJECT_TIMEOUT_MS: String(options.injectTimeoutMs ?? 5000),
    ...options.env,
  };
  const servers = async () => {
    const files = await readdir(join(home, 'servers')).catch(() => [] as string[]);
    const all = await Promise.all(files.map(async (f) => JSON.parse(await readFile(join(home, 'servers', f), 'utf8')) as FakeCodexServer));
    rememberResultProcesses(all, home);
    return all.filter((s) => pidAlive(s.pid));
  };
  t.after(async () => {
    for (const s of await servers()) await killDaemon(s.pid);
    await cleanupHome();
  });
  return { env, home, servers, log: (pid) => readFile(join(home, 'log', `${pid}.log`), 'utf8').catch(() => '') };
}
