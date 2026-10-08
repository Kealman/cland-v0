// The Codex adapter (spec 4.3, research `harness-surfaces` §2). Codex runs each session on an app-server the hub
// owns, one per session, and the hub joins it as a client:
//
//   spawn    `codex app-server --listen unix://<socket>` in the session's cwd, detached (it outlives the hub), with the
//            spoke as an MCP server given by `-c mcp_servers.cland.*` overrides on the app-server's command line only —
//            nothing is written to `~/.codex/config.toml`, and the TUI never gets a `-c` (spec 9, the embedded-mode trap).
//            Then `thread/start` with the model, and a first turn carrying the session's clause: until a thread has a
//            turn it has no rollout, and `thread/resume` (what attach and a restarted hub use) fails on it.
//   attach   `codex resume --remote unix://<socket> --cd <cwd> <threadId>`: no `-c`, no `--profile`.
//   inject   `turn/start` with a tool output named `hub_event` when the thread is idle (the wake-up BCAS used);
//            `turn/steer` into the active turn otherwise. The JSON-RPC result confirms `injected`.
//   state    `thread/status/changed`, keyed by the thread id: `idle`, `active` with the flags `waitingOnApproval`
//            and `waitingOnUserInput`. Pushed by the app-server to every connection; reliable.
//   usage    `thread/tokenUsage/updated` and `account/rateLimits/read` / `account/rateLimits/updated`.
//   stop     SIGTERM to the app-server (its MCP children, the spoke among them, end with it).
//   resume   the pid is alive and the socket answers `thread/resume` for the recorded thread; else, with `relaunch`,
//            a new app-server on the same socket resumes the thread from its rollout.
//
// Approvals stay in the attached TUI: the hub never answers a server request; it only shows `waiting for approval`.
// The process table keeps the socket as `harnessId` and the thread id as `harnessSessionId`.
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Message, SessionState, TopicRef } from '../protocol.ts';
import { VERSION } from '../version.ts';
import { envelope, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type Interpretation, type ResumeResult, type SpawnRequest } from './contract.ts';
import { AppServerClient, RpcError, type ServerRequest } from './codex/app-server.ts';

export const CODEX = 'codex';

/** The oldest Codex whose app-server takes `turn/start` with a `toolOutput` (BCAS verified 0.153.4). */
export const MIN_CODEX_VERSION: readonly [number, number, number] = [0, 153, 4];

export const CODEX_CAPABILITIES: Capabilities = {
  // rollouts are on disk, but `Thread.path` is marked unstable and the format is not a stable interface
  history: 'none',
  // `thread/tokenUsage/updated` per turn and the account's rate limits
  usage: 'reliable',
  // `turn/start` takes a model, but nothing switches a running session's model from outside in v0
  setModel: 'none',
  // approvals stay in the attached TUI in v0 (spec 4.3)
  approvalRelay: 'none',
  states: {
    // `thread/status/changed`, pushed by the app-server
    busy: 'reliable',
    idle: 'reliable',
    'waiting for approval': 'reliable',
    'waiting for human': 'reliable',
  },
};

/** The clause the first turn carries. A placeholder until roles exist (#29). */
export function placeholderClause(name: string, role: string | null): string {
  return [
    `You are "${name}", a session of cland${role ? ` in the role ${role}` : ''}.`,
    'Messages from the human and from other sessions arrive as `hub_event` tool outputs or as <channel source="cland"> blocks.',
    'Answer them with the cland `send` tool: text printed in this terminal reaches no one.',
    'Nothing to do yet: reply with the single word "ready".',
  ].join('\n');
}

/** A thread status from the app-server as a cland state. */
export function stateOfStatus(status: unknown): SessionState {
  if (!status || typeof status !== 'object') return 'unknown';
  const s = status as { type?: unknown; activeFlags?: unknown };
  switch (s.type) {
    case 'idle':
      return 'idle';
    // a core error ends the turn; the thread takes the next one
    case 'systemError':
      return 'idle';
    case 'active': {
      const flags = Array.isArray(s.activeFlags) ? s.activeFlags : [];
      if (flags.includes('waitingOnApproval')) return 'waiting for approval';
      if (flags.includes('waitingOnUserInput')) return 'waiting for human';
      return 'busy';
    }
    default:
      return 'unknown';
  }
}

/** `-c` overrides for the app-server (never the TUI): the spoke as the `cland` MCP server, with the session's identity. */
export function mcpOverrides(host: Pick<AdapterHost, 'node' | 'spoke' | 'discoveryFile'>, name: string, role: string | null, sessionId: string): string[] {
  const env: Record<string, string> = {
    CLAND_HUB_FILE: host.discoveryFile,
    CLAND_SESSION_ID: sessionId,
    CLAND_SESSION_NAME: name,
    // the adapter injects: the spoke only accepts deliveries
    CLAND_DELIVERY: 'adapter',
    ...(role ? { CLAND_ROLE: role } : {}),
  };
  // a JSON string or array is a TOML basic string or array
  const set = (key: string, value: unknown) => ['-c', `mcp_servers.cland.${key}=${JSON.stringify(value)}`];
  return [
    ...set('command', host.node),
    ...set('args', [host.spoke]),
    ...Object.entries(env).flatMap(([k, v]) => set(`env.${k}`, v)),
    ...set('enabled', true),
    // the thread does not start without the hub's tools
    ...set('required', true),
    // the session's own way to the hub: its calls are checked by the hub, not prompted in the TUI
    ...set('default_tools_approval_mode', 'approve'),
  ];
}

export type CodexOptions = {
  /** The `codex` executable: `CLAND_CODEX_BIN`, else `codex` on the PATH. */
  bin?: string;
  /** How often the app-servers' pids are checked and lost connections re-made, ms. */
  pollMs?: number;
  /** How long an inject waits for the JSON-RPC result before it stays `delivered`, ms. */
  injectTimeoutMs?: number;
  /** How long a launch waits for the app-server's socket and the thread, ms. */
  spawnDeadlineMs?: number;
  /** The environment the app-server is started in (cland's own variables are removed). */
  env?: NodeJS.ProcessEnv;
};

const sq = (s: string): string => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** What the hub knows of one session's app-server. */
type Live = {
  p: HarnessProcess;
  client: AppServerClient | null;
  connecting: Promise<void> | null;
  /** The last state the app-server reported for the thread (kept so a signal that came before the
   *  process-table row was written is not lost). */
  state: SessionState;
  /** The active turn's id, from `turn/started` and `turn/start`: what `turn/steer` must name. */
  turnId: string | null;
  tokens: Record<string, unknown> | null;
  rateLimits: Record<string, unknown> | null;
};

type ThreadResult = { thread: { id: string; status?: unknown; model?: string }; model?: string };

export class CodexAdapter implements HarnessAdapter {
  readonly harness = CODEX;
  readonly capabilities = CODEX_CAPABILITIES;
  readonly #host: AdapterHost;
  readonly #bin: string;
  readonly #pollMs: number;
  readonly #injectTimeoutMs: number;
  readonly #spawnDeadlineMs: number;
  readonly #env: NodeJS.ProcessEnv;
  /** By cland session id. */
  readonly #live = new Map<string, Live>();
  /** Watched session ids: their pids are checked and their connections kept. */
  readonly #watched = new Set<string>();
  #timer: NodeJS.Timeout | null = null;
  #versionChecked = false;
  #closed = false;

  constructor(host: AdapterHost, options: CodexOptions = {}) {
    this.#host = host;
    this.#bin = options.bin ?? process.env.CLAND_CODEX_BIN ?? 'codex';
    this.#pollMs = options.pollMs ?? 5000;
    this.#injectTimeoutMs = options.injectTimeoutMs ?? 60_000;
    this.#spawnDeadlineMs = options.spawnDeadlineMs ?? 30_000;
    const env: NodeJS.ProcessEnv = {};
    for (const [k, v] of Object.entries(options.env ?? process.env)) if (!k.startsWith('CLAND_') || k === 'CLAND_CODEX_BIN') env[k] = v;
    this.#env = env;
  }

  // ---------------------------------------------------------------- the app-server process

  async #checkVersion(cwd: string): Promise<void> {
    if (this.#versionChecked) return;
    const out = await new Promise<string>((resolve, reject) =>
      execFile(this.#bin, ['--version'], { cwd, env: this.#env, encoding: 'utf8', timeout: 15_000 }, (err, stdout) => (err ? reject(new Error(`${this.#bin} --version: ${err.message}`)) : resolve(stdout))),
    );
    const v = /(\d+)\.(\d+)\.(\d+)/.exec(out);
    const [a, b, c] = MIN_CODEX_VERSION;
    const n = v ? [Number(v[1]), Number(v[2]), Number(v[3])] : null;
    if (!n || n[0]! < a || (n[0] === a && (n[1]! < b || (n[1] === b && n[2]! < c)))) throw new Error(`Codex ${MIN_CODEX_VERSION.join('.')} or newer is needed (the app-server's toolOutput turns); found: ${out.trim() || 'nothing'}`);
    this.#versionChecked = true;
  }

  /** The session's socket: in `.cland/run/`, or in the temp directory when that path is too long for a Unix socket. */
  #socketPath(sessionId: string): string {
    const file = `cx-${sessionId.replace(/-/g, '').slice(0, 12)}.sock`;
    const inProject = join(dirname(this.#host.discoveryFile), 'run', file);
    // sun_path is 104 bytes on macOS, 108 on Linux
    return Buffer.byteLength(inProject) <= 100 ? inProject : join(tmpdir(), `cland-${file}`);
  }

  /** Start an app-server on the socket; resolves with its pid once it answers there. */
  async #startServer(p: Pick<HarnessProcess, 'name' | 'role' | 'sessionId' | 'cwd'>, socket: string): Promise<{ pid: number; client: AppServerClient }> {
    mkdirSync(dirname(socket), { recursive: true, mode: 0o700 });
    rmSync(socket, { force: true });
    const logDir = join(dirname(this.#host.discoveryFile), 'log');
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, `codex-${p.name}.log`);
    const out = openSync(logFile, 'a');
    const args = ['app-server', '--listen', `unix://${socket}`, ...mcpOverrides(this.#host, p.name, p.role, p.sessionId)];
    let exited: string | null = null;
    let pid: number | undefined;
    try {
      // detached, in its own process group: it outlives the hub, and its MCP children (the spoke) go with it
      const child = spawn(this.#bin, args, { cwd: p.cwd, env: this.#env, detached: true, stdio: ['ignore', out, out] });
      child.once('exit', (code, signal) => (exited = `exited (${code ?? signal})`));
      child.once('error', (err) => (exited = err.message));
      child.unref();
      pid = child.pid;
    } finally {
      closeSync(out);
    }
    this.#host.log({ event: 'harness-launched', harness: this.harness, session: p.name, pid: pid ?? null, socket });
    const deadline = Date.now() + this.#spawnDeadlineMs;
    for (;;) {
      if (exited !== null || pid === undefined) throw new Error(`codex app-server ${exited ?? 'did not start'}: ${tail(logFile)}`);
      try {
        const client = await this.#connectTo(socket);
        return { pid, client };
      } catch (err) {
        if (Date.now() > deadline) {
          if (pidAlive(pid)) process.kill(pid, 'SIGTERM');
          throw new Error(`codex app-server did not answer on ${socket} within ${this.#spawnDeadlineMs} ms (${err instanceof Error ? err.message : String(err)}): ${tail(logFile)}`);
        }
        await sleep(100);
      }
    }
  }

  #connectTo(socket: string): Promise<AppServerClient> {
    return AppServerClient.connect(socket, { client: { name: 'cland_hub', title: 'cland hub', version: VERSION }, timeoutMs: this.#spawnDeadlineMs, connectTimeoutMs: 3000 });
  }

  /** Listen to one app-server connection for one session's thread. */
  #attach(live: Live, client: AppServerClient): void {
    live.client = client;
    const mine = (params: Record<string, unknown>) => params.threadId === live.p.harnessSessionId;
    client.on('notification', (method: string, params: Record<string, unknown>) => {
      switch (method) {
        case 'thread/status/changed':
          if (!mine(params)) return;
          this.#setState(live, stateOfStatus(params.status));
          return;
        case 'turn/started': {
          const id = (params.turn as { id?: unknown } | undefined)?.id;
          if (mine(params) && typeof id === 'string') live.turnId = id;
          return;
        }
        case 'turn/completed':
          if (!mine(params)) return;
          live.turnId = null;
          void this.#readRateLimits(live);
          return;
        case 'thread/tokenUsage/updated':
          if (mine(params) && params.tokenUsage && typeof params.tokenUsage === 'object') live.tokens = params.tokenUsage as Record<string, unknown>;
          return;
        case 'account/rateLimits/updated':
          if (params.rateLimits && typeof params.rateLimits === 'object') live.rateLimits = params.rateLimits as Record<string, unknown>;
          return;
        case 'thread/closed':
          if (mine(params)) this.#host.log({ event: 'harness-thread-closed', harness: this.harness, session: live.p.name, thread: live.p.harnessSessionId });
          return;
        default:
          return;
      }
    });
    client.on('serverRequest', (request: ServerRequest) => {
      // approvals and questions are the attached TUI's; the hub only shows the state the app-server reports
      if (request.params.threadId === undefined || mine(request.params)) this.#host.log({ event: 'harness-request', harness: this.harness, session: live.p.name, method: request.method });
    });
    client.on('close', () => {
      if (live.client === client) live.client = null;
      if (this.#closed || !this.#watched.has(live.p.sessionId)) return;
      // a closed connection is a dead app-server, or one the next poll reconnects to
      if (live.p.pid !== null && !pidAlive(live.p.pid)) this.#gone(live, `pid ${live.p.pid} is gone`);
    });
  }

  #setState(live: Live, state: SessionState): void {
    live.state = state;
    if (state === 'idle') live.turnId = null;
    this.#host.signal(live.p.sessionId, { state, source: 'app-server', at: Date.now() });
  }

  async #readRateLimits(live: Live): Promise<void> {
    try {
      const r = await live.client?.request<{ rateLimits?: Record<string, unknown> }>('account/rateLimits/read', {}, 15_000);
      if (r?.rateLimits) live.rateLimits = r.rateLimits;
    } catch {
      // an account without rate limits (an API key) has none to read
    }
  }

  /** Subscribe a fresh connection to the thread: `thread/resume` (which needs a rollout), else `thread/read`. */
  async #subscribe(live: Live, client: AppServerClient, extra: Record<string, unknown> = {}): Promise<{ state: SessionState; model: string | null }> {
    const threadId = live.p.harnessSessionId as string;
    try {
      const r = await client.request<ThreadResult>('thread/resume', { threadId, ...extra });
      return { state: stateOfStatus(r.thread.status), model: r.model ?? r.thread.model ?? null };
    } catch (err) {
      if (!(err instanceof RpcError) || Object.keys(extra).length) throw err;
      // a thread with no turn yet has no rollout: still loaded, and its status is broadcast to every connection
      const r = await client.request<ThreadResult>('thread/read', { threadId });
      return { state: stateOfStatus(r.thread.status), model: r.thread.model ?? null };
    }
  }

  #gone(live: Live, detail: string): void {
    this.#unwatch(live.p.sessionId);
    live.client?.close();
    live.client = null;
    this.#host.exited(live.p.sessionId, detail);
  }

  // ---------------------------------------------------------------- launch

  async spawn(request: SpawnRequest): Promise<HarnessProcess> {
    await this.#checkVersion(request.cwd);
    const sessionId = randomUUID();
    const socket = this.#socketPath(sessionId);
    const base = { name: request.name, role: request.role, sessionId, cwd: request.cwd };
    const { pid, client } = await this.#startServer(base, socket);
    try {
      const started = await client.request<ThreadResult>('thread/start', { cwd: request.cwd, ...(request.model ? { model: request.model } : {}) });
      const threadId = started.thread.id;
      const p: HarnessProcess = {
        ...base,
        harness: this.harness,
        model: started.model ?? started.thread.model ?? request.model,
        pid,
        harnessId: socket,
        harnessSessionId: threadId,
        startedAt: new Date().toISOString(),
        status: 'running',
      };
      const live: Live = { p, client: null, connecting: null, state: stateOfStatus(started.thread.status), turnId: null, tokens: null, rateLimits: null };
      this.#live.set(sessionId, live);
      this.#attach(live, client);
      void this.#readRateLimits(live);
      // the first turn carries the clause: the thread gets its rollout, so attach and resume work
      const turn = await client.request<{ turn?: { id?: string } }>('turn/start', { threadId, input: [{ type: 'text', text: placeholderClause(request.name, request.role), text_elements: [] }] });
      // the turn is accepted: the thread is active, though its `thread/status/changed` may come after this result
      // (seen with 0.160.0); a launch never reports the idle that preceded the clause turn
      if (typeof turn.turn?.id === 'string') live.turnId ??= turn.turn.id;
      if (live.state === 'idle') live.state = 'busy';
      this.#host.log({ event: 'harness-thread-started', harness: this.harness, session: request.name, thread: threadId, model: p.model });
      return p;
    } catch (err) {
      client.close();
      this.#live.delete(sessionId);
      if (pidAlive(pid)) process.kill(pid, 'SIGTERM');
      rmSync(socket, { force: true });
      throw err;
    }
  }

  attachCommand(p: HarnessProcess): string {
    // never a `-c` or a `--profile`: either one puts the TUI in embedded mode, where it has no external surface
    const bin = this.#bin === 'codex' ? 'codex' : sq(this.#bin);
    return [bin, 'resume', '--remote', sq(`unix://${p.harnessId ?? this.#socketPath(p.sessionId)}`), '--cd', sq(p.cwd), sq(p.harnessSessionId ?? '')].join(' ');
  }

  // ---------------------------------------------------------------- inject

  async inject(p: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void> {
    const live = this.#live.get(p.sessionId);
    const client = live?.client;
    if (!live || !client || client.closed) throw new Error('the hub is not connected to this session\'s app-server');
    const threadId = p.harnessSessionId as string;
    const text = envelope(message, topic);
    const input = [{ type: 'text', text, text_elements: [] }];
    // into the active turn
    for (let attempt = 0; attempt < 2 && live.turnId; attempt++) {
      const expected = live.turnId;
      try {
        await client.request('turn/steer', { threadId, expectedTurnId: expected, input }, this.#injectTimeoutMs);
        this.#host.log({ event: 'harness-steered', harness: this.harness, session: p.name, id: message.id, turn: expected });
        return;
      } catch (err) {
        if (!(err instanceof RpcError)) throw err;
        // the turn ended (or another began) in between: try again on what is current now; a turn id the
        // app-server refuses and nothing replaced is stale, and the thread takes a new turn below
        if (live.turnId === expected) live.turnId = null;
      }
    }
    // an active turn whose id the hub missed (it reconnected mid-turn): `turn/start` steers it
    const params = live.state === 'idle' || live.state === 'unknown' ? { threadId, input: [], toolOutput: { name: 'hub_event', namespace: 'cland', output: text } } : { threadId, input };
    const r = await client.request<{ turn?: { id?: string } }>('turn/start', params, this.#injectTimeoutMs);
    if (typeof r.turn?.id === 'string' && live.state !== 'idle') live.turnId ??= r.turn.id;
  }

  /** The app-server's JSON-RPC result is the confirmation: nothing comes through the hub. */
  confirm(): void {}

  /** No hooks: everything comes from the app-server. */
  interpret(): Interpretation {
    return {};
  }

  usage(p: HarnessProcess): Record<string, unknown> | null {
    const live = this.#live.get(p.sessionId);
    if (!live || (!live.tokens && !live.rateLimits)) return null;
    return { ...(p.model ? { model: p.model } : {}), ...(live.tokens ? { tokens: live.tokens } : {}), ...(live.rateLimits ? { rateLimits: live.rateLimits } : {}) };
  }

  // ---------------------------------------------------------------- watch: liveness and the connection

  watch(p: HarnessProcess): void {
    let live = this.#live.get(p.sessionId);
    if (!live) {
      live = { p, client: null, connecting: null, state: 'unknown', turnId: null, tokens: null, rateLimits: null };
      this.#live.set(p.sessionId, live);
    } else live.p = p;
    this.#watched.add(p.sessionId);
    // what the app-server said before the process-table row existed
    if (live.state !== 'unknown') this.#host.signal(p.sessionId, { state: live.state, source: 'app-server', at: Date.now() });
    if (!live.client) void this.#reconnect(live);
    if (!this.#timer) {
      this.#timer = setInterval(() => this.#poll(), this.#pollMs);
      this.#timer.unref();
    }
  }

  #unwatch(sessionId: string): void {
    this.#watched.delete(sessionId);
    if (this.#watched.size === 0 && this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  #poll(): void {
    for (const sessionId of [...this.#watched]) {
      const live = this.#live.get(sessionId);
      if (!live) continue;
      if (live.p.pid !== null && !pidAlive(live.p.pid)) {
        this.#gone(live, `pid ${live.p.pid} is gone`);
        continue;
      }
      if (!live.client) void this.#reconnect(live);
    }
  }

  /** The connection is lost while the app-server runs: connect again and subscribe to the thread. */
  #reconnect(live: Live): Promise<void> {
    if (live.connecting || this.#closed) return live.connecting ?? Promise.resolve();
    const socket = live.p.harnessId;
    if (!socket) return Promise.resolve();
    live.connecting = (async () => {
      let client: AppServerClient | null = null;
      try {
        client = await this.#connectTo(socket);
        this.#attach(live, client);
        const r = await this.#subscribe(live, client);
        if (r.state !== 'unknown') this.#setState(live, r.state);
        void this.#readRateLimits(live);
      } catch (err) {
        client?.close();
        this.#host.log({ event: 'harness-reconnect-failed', harness: this.harness, session: live.p.name, error: err instanceof Error ? err.message : String(err) });
      } finally {
        live.connecting = null;
      }
    })();
    return live.connecting;
  }

  // ---------------------------------------------------------------- stop, resume

  async stop(p: HarnessProcess): Promise<void> {
    this.#unwatch(p.sessionId);
    const live = this.#live.get(p.sessionId);
    live?.client?.close();
    this.#live.delete(p.sessionId);
    if (p.pid !== null && pidAlive(p.pid)) {
      process.kill(p.pid, 'SIGTERM');
      const deadline = Date.now() + 5000;
      while (pidAlive(p.pid) && Date.now() < deadline) await sleep(50);
      if (pidAlive(p.pid)) process.kill(p.pid, 'SIGKILL');
    }
    if (p.harnessId) rmSync(p.harnessId, { force: true });
  }

  async resume(p: HarnessProcess, options: { relaunch?: boolean } = {}): Promise<ResumeResult> {
    const socket = p.harnessId ?? this.#socketPath(p.sessionId);
    if (!p.harnessSessionId) return { found: false, reason: 'no thread id recorded' };
    const live: Live = this.#live.get(p.sessionId) ?? { p, client: null, connecting: null, state: 'unknown', turnId: null, tokens: null, rateLimits: null };
    live.p = p;
    this.#live.set(p.sessionId, live);
    if (p.pid !== null && pidAlive(p.pid) && existsSync(socket)) {
      let client: AppServerClient | null = null;
      try {
        client = await this.#connectTo(socket);
        live.client?.close();
        this.#attach(live, client);
        const r = await this.#subscribe(live, client);
        live.state = r.state;
        void this.#readRateLimits(live);
        return { found: true, process: { ...p, harnessId: socket, model: r.model ?? p.model, status: 'running' }, state: r.state };
      } catch (err) {
        client?.close();
        if (!options.relaunch) return { found: false, reason: `the app-server (pid ${p.pid}) does not answer for thread ${p.harnessSessionId}: ${err instanceof Error ? err.message : String(err)}` };
        process.kill(p.pid, 'SIGTERM');
      }
    } else if (!options.relaunch) {
      return { found: false, reason: p.pid !== null && pidAlive(p.pid) ? `no socket at ${socket}` : `pid ${p.pid ?? '?'} is gone` };
    }
    // a new app-server on the same socket, resuming the thread from its rollout
    const { pid, client } = await this.#startServer(p, socket);
    try {
      this.#attach(live, client);
      const r = await this.#subscribe(live, client, { cwd: p.cwd, ...(p.model ? { model: p.model } : {}) });
      live.state = r.state;
      const relaunched: HarnessProcess = { ...p, pid, harnessId: socket, model: r.model ?? p.model, startedAt: new Date().toISOString(), status: 'running' };
      live.p = relaunched;
      this.#host.log({ event: 'harness-relaunched', harness: this.harness, session: p.name, pid, thread: p.harnessSessionId });
      return { found: true, process: relaunched, state: r.state };
    } catch (err) {
      client.close();
      if (pidAlive(pid)) process.kill(pid, 'SIGTERM');
      throw err;
    }
  }

  close(): void {
    this.#closed = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#watched.clear();
    // the app-servers keep running: a restarted hub re-finds them
    for (const live of this.#live.values()) live.client?.close();
    this.#live.clear();
  }
}

/** The end of a log file, for an error message. */
function tail(file: string): string {
  try {
    return readFileSync(file, 'utf8').trim().split('\n').slice(-5).join(' | ').slice(-800) || '(no output)';
  } catch {
    return '(no output)';
  }
}
