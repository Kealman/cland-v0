// The test harness for the two seams:
//   1. the spoke's MCP stdio surface — the real spoke process, driven by the SDK's client
//   2. the hub's WebSocket edge — an in-process hub on an ephemeral port
//   3. the daemon — `cland hub …` run as its own process in a temporary project, and its Unix socket
// Nothing here reaches into either side's state; everything goes through the seams.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
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

export const SPOKE_ENTRY = fileURLToPath(new URL('../bin/cland-spoke.ts', import.meta.url));

/** The tools the spoke serves — the one list every surface assertion reads. */
export const DOCUMENTED_TOOLS = ['history', 'rename', 'send', 'session.launch', 'status', 'task.claim', 'task.close', 'task.comment', 'task.create', 'task.edit', 'task.link', 'task.list', 'task.view', 'who'] as const;

export const ChannelEvent = z.object({
  method: z.literal('notifications/claude/channel'),
  params: z.object({ content: z.string(), meta: z.record(z.string(), z.string()).optional() }),
});
export type ChannelEvent = z.infer<typeof ChannelEvent>;

export const TEST_SECRET = 'test-secret';

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
  /** No hub url and secret at all — the "not started through cland" case. */
  unconfigured?: boolean;
  /** No hub url and secret either: the spoke finds the hub through `.cland/hub.json` from its `cwd` up. */
  discover?: boolean;
  sessionId?: string;
  cwd?: string;
  heartbeatMs?: number;
  /** How long a request waits for the hub's reply (CLAND_HUB_REQUEST_TIMEOUT_MS). */
  requestTimeoutMs?: number;
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
  const workDir = await mkdtemp(join(tmpdir(), 'cland-spoke-'));
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
  if (options.name) env.CLAND_SESSION_NAME = options.name;
  if (options.role) env.CLAND_ROLE = options.role;
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
  await client.connect(transport);
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
    return JSON.parse(content.text) as T;
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

  const waitForPresence = async (names: string[], timeoutMs = PRESENCE_DEADLINE_MS): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    let last: unknown;
    while (Date.now() < deadline) {
      last = await call<{ ok: boolean; sessions?: Array<{ name: string }> }>('who');
      const sessions = (last as { sessions?: Array<{ name: string }> }).sessions ?? [];
      if (names.every((n) => sessions.some((d) => d.name === n))) return;
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
      await rm(workDir, { recursive: true, force: true });
    },
  };
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Poll `who()` through `viewer` until `name` has left presence (a close is processed asynchronously). */
export async function waitForAbsence(viewer: Session, name: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const who = await viewer.call<{ sessions: Array<{ name: string }> }>('who');
    if (!who.sessions.some((d) => d.name === name)) return;
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

/** `cland` with `extra` added to its environment: a test timing such as CLAND_TEST_TASK_WRITE_PAUSE_MS, or a daemon that launches a fake harness. */
export function clandWithEnv(cwd: string, extra: Record<string, string>, ...args: string[]): Promise<CliResult> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  Object.assign(env, extra);
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [CLI_ENTRY, ...args], { cwd, env, encoding: 'utf8', timeout: 30_000 }, (err, stdout, stderr) => {
      if (err && typeof err.code !== 'number') reject(err);
      else resolve({ code: err ? (err.code as number) : 0, stdout, stderr });
    });
  });
}

/** A fresh project folder under the system temp dir, removed when the test ends (after its daemon is gone). */
export async function tempProject(t: TestContext, prefix = 'cland-proj-'): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

export type Discovery = { socket: string; port: number; secret: string; pid: number; version: string };

export const readDiscovery = async (root: string): Promise<Discovery> => JSON.parse(await readFile(join(root, '.cland', 'hub.json'), 'utf8')) as Discovery;

export const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/**
 * `cland hub start` in `root`; the daemon it leaves behind is killed when the test ends, whatever happened.
 * Registered before the start returns, so even a failing assertion right after cannot leak a process.
 */
export async function startDaemon(t: TestContext, root: string, env: Record<string, string> = {}): Promise<{ result: CliResult; discovery: Discovery }> {
  const result = await clandWithEnv(root, env, 'hub', 'start');
  let discovery: Discovery | null = null;
  try {
    discovery = await readDiscovery(root);
  } catch {
    /* asserted by the caller through `result` */
  }
  const pid = discovery?.pid;
  if (pid !== undefined) t.after(() => killDaemon(pid));
  if (result.code !== 0 || !discovery) throw new Error(`cland hub start failed (${result.code}):\n${result.stdout}\n${result.stderr}`);
  return { result, discovery };
}

export async function killDaemon(pid: number): Promise<void> {
  if (!pidAlive(pid)) return;
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* gone already */
  }
  const deadline = Date.now() + 5000;
  while (pidAlive(pid) && Date.now() < deadline) await sleep(20);
}

/** A JSON-lines client on the hub's Unix socket: send frames, await the next one. */
export type SocketClient = {
  send: (frame: Record<string, unknown>) => void;
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

export function frameClient(write: (line: string) => void, onData: (fn: (chunk: string) => void) => void, close: () => void): FrameClient {
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
export async function connectUi(t: TestContext, discovery: Pick<Discovery, 'socket' | 'secret'>, client = 'ui'): Promise<FrameClient> {
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
  );
  t.after(() => ui.close());
  ui.send({ type: 'hello', protocol: 2, secret: discovery.secret, client });
  const welcome = await ui.waitFor((f) => f.type === 'welcome' || f.type === 'error');
  if (welcome.type !== 'welcome') throw new Error(`the hub refused the UI: ${JSON.stringify(welcome)}`);
  return ui;
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
  /** The fake's live sessions, as `claude agents --json` lists them. */
  sessions: () => Promise<Array<{ pid: number; id: string; sessionId: string; status: string; waitingFor?: string; name: string | null }>>;
  /** What one fake session logged (hooks that failed, tool calls, the mod's bridge). */
  log: (id: string) => Promise<string>;
};

export async function fakeClaude(t: TestContext, timings: { pollMs?: number; injectTimeoutMs?: number; pushTrustMs?: number; turnMs?: number; dropFirst?: boolean; lateBg?: boolean } = {}): Promise<FakeClaude> {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-claude-')));
  const env = {
    PATH: `${FAKE_CLAUDE_DIR}:${process.env.PATH ?? ''}`,
    FAKE_CLAUDE_HOME: home,
    FAKE_CLAUDE_TURN_MS: String(timings.turnMs ?? 300),
    CLAND_ADAPTER_POLL_MS: String(timings.pollMs ?? 200),
    CLAND_INJECT_TIMEOUT_MS: String(timings.injectTimeoutMs ?? 5000),
    CLAND_PUSH_TRUST_MS: String(timings.pushTrustMs ?? 1000),
    ...(timings.dropFirst ? { FAKE_CLAUDE_DROP_FIRST: '1' } : {}),
    ...(timings.lateBg ? { FAKE_CLAUDE_LATE_BG: '1' } : {}),
  };
  const sessions = async () => {
    const out = await new Promise<string>((resolve) =>
      execFile(join(FAKE_CLAUDE_DIR, 'claude'), ['agents', '--json'], { env: { ...process.env, ...env }, encoding: 'utf8' }, (_err, stdout) => resolve(stdout)),
    );
    try {
      return JSON.parse(out) as Awaited<ReturnType<FakeClaude['sessions']>>;
    } catch {
      return [];
    }
  };
  t.after(async () => {
    for (const s of await sessions()) await killDaemon(s.pid);
    await rm(home, { recursive: true, force: true });
  });
  return { env, home, sessions, log: async (id) => readFile(join(home, 'jobs', `${id}.log`), 'utf8').catch(() => '') };
}

/** Poll until `check` returns a value (not undefined), or fail with what was last seen. */
export async function eventually<T>(what: string, check: () => Promise<T | undefined> | T | undefined, timeoutMs = 15_000): Promise<T> {
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
