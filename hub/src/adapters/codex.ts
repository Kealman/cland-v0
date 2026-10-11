// The Codex adapter (spec 4.3, research `harness-surfaces` §2). Codex runs each session on an app-server the hub
// owns, one per session, and the hub joins it as a client:
//
//   spawn    `codex app-server --listen unix://<socket>` in the session's cwd, detached (it outlives the hub), with the
//            spoke as an MCP server given by `-c mcp_servers.cland.*` overrides on the app-server's command line only —
//            nothing is written to `~/.codex/config.toml`, and the TUI never gets a `-c` (spec 9, the embedded-mode trap).
//            Then `thread/start` with the model, and a first turn carrying the role's clause: until a thread has a
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
//   policy   `thread/start` (and the `thread/resume` of a relaunch) carries `approvalPolicy` — `never` unless
//            roles.toml says otherwise, so a launched session does not stop to ask — and `permissions`, the role's
//            sandbox: a built-in profile, or the profile `cland` that further `-c` overrides on the app-server's
//            command line define (`threadPolicy` below).
//
// An approval a session does ask for stays in the attached TUI: the hub never answers a server request; it only
// shows `waiting for approval`.
// The process table keeps the socket as `harnessId` and the thread id as `harnessSessionId`.
import { continueWith, wait, untimed } from './continuations.ts';
import type { Resumed } from '../hub/worktrees.ts';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, open, readFile, realpath, rm, stat } from 'node:fs/promises';
import { FailedLaunches, LaunchFiles } from './launch-files.ts';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { turnError } from './turn-error.ts';
import type { Message, SessionState, SessionUsage, TopicRef } from '../protocol.ts';
import { codexCounts } from './usage.ts';
import { VERSION } from '../version.ts';
import { envelope, envelopeIds, InjectUncertain, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type Interpretation, type LaunchPolicy, type ResumeResult, type SpawnRequest } from './contract.ts';
import { AppServerClient, RpcError, RpcNoAnswer, type ServerRequest } from './codex/app-server.ts';
import { processAlive } from './processes.ts';
import { endProcess } from '../system-processes.ts';



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

/**
 * The first turn: the role's clause (#29) as the hub renders it, so the hub does not inject it again at the session's
 * first hello; the delivery note says how hub events arrive. A launch with no role (the session will be refused
 * until the human assigns one, and then gets its clause through the hub) carries the note alone.
 */
export function firstTurn(name: string, clause: string | null | undefined): string {
  const note = 'Messages from the human and from other sessions arrive as `hub_event` tool outputs or as <channel source="cland"> blocks. Answer them with the cland `send` tool: text printed in this terminal reaches no one.';
  return clause ? `${clause}\n\n${note}` : `You are "${name}", a session of cland with no role yet. ${note} Wait for the hub's events.`;
}

/** An item of a turn, as `item/completed` and `thread/read` give it. */
type TurnItem = { type?: unknown; name?: unknown; namespace?: unknown; output?: unknown; content?: Array<{ text?: unknown }> };

/** How an input reached the app-server: text (`turn/steer`, or `turn/start` with `input`), or the `hub_event` tool
 *  output of a `turn/start` into an idle thread. */
type InputShape = 'text' | 'toolOutput';

/** An input the turn took up, with its shape, or null for any other item. Measured with Codex 0.160.0 (T-68): text
 *  input is a `userMessage` with text content; a `toolOutput` is a `functionCallOutput` carrying the tool's `name`,
 *  `namespace` and `output`. */
function turnInput(item: TurnItem | undefined): { shape: InputShape; text: string } | null {
  if (item?.type === 'userMessage') return { shape: 'text', text: (item.content ?? []).map((c) => (typeof c.text === 'string' ? c.text : '')).join('\n') };
  if (item?.type === 'functionCallOutput' && item.name === 'hub_event' && item.namespace === 'cland') {
    if (typeof item.output === 'string') return { shape: 'toolOutput', text: item.output };
    if (Array.isArray(item.output)) return { shape: 'toolOutput', text: item.output.map((c: { text?: unknown }) => (typeof c?.text === 'string' ? c.text : '')).join('\n') };
  }
  return null;
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

/** `-c` overrides for the app-server (never the TUI): the spoke as the `cland` MCP server, with the session's identity.
 *  The launch's sandbox adds its own (`threadPolicy`). */
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
    // The credential travels through the process environment, never a command-line value.
    ...set('env_vars', ['CLAND_LAUNCH_TOKEN']),
    ...Object.entries(env).flatMap(([k, v]) => set(`env.${k}`, v)),
    ...set('enabled', true),
    // the thread does not start without the hub's tools
    ...set('required', true),
    // the session's own way to the hub: its calls are checked by the hub, not prompted in the TUI
    ...set('default_tools_approval_mode', 'approve'),
  ];
}

/** The name of the permissions profile a launch defines for its thread. */
export const CLAND_PROFILE = 'cland';

const real = (path: string, resumed: Resumed = untimed): Promise<string> => realpath(path).then(value => resumed(() => value), () => resumed(() => path));
const isDir = (path: string, resumed: Resumed = untimed): Promise<boolean> => stat(path).then(info => resumed(() => info.isDirectory()), () => resumed(() => false));
const under = (path: string, dir: string): boolean => path === dir || path.startsWith(dir + sep);

/** The git directory a worktree's `.git` file points at, or null (a main worktree, or no repository). */
async function worktreeGitDir(cwd: string, resumed: Resumed = untimed): Promise<string | null> {
  return continueWith((function* (): Generator<Promise<unknown>, string | null, unknown> {
    try {
      const m = /^gitdir: (.+)$/m.exec((yield* wait(readFile(join(cwd, '.git'), 'utf8'))));
      return m ? yield* wait(real(isAbsolute(m[1] as string) ? (m[1] as string) : resolve(cwd, m[1] as string), resumed)) : null;
    } catch {
      return null;
    }
  })(), resumed);
}

/** Where the app-servers' sockets live when the project's `.cland/run/` is too deep for a Unix socket path. */
const tmpRunDir = (resumed: Resumed = untimed): Promise<string> => real(tmpdir(), resumed).then(path => resumed(() => join(path, 'cland-run')));

/** A value as TOML, for a `-c key=value` override: JSON's strings, numbers, booleans and arrays are TOML's; an object is an inline table. */
const toml = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(toml).join(',')}]`;
  if (v !== null && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}=${toml(x)}`).join(',')}}`;
  return JSON.stringify(v);
};

/** How a launch's approval and sandbox reach Codex: `thread` in `thread/start` (and the `thread/resume` of a
 *  relaunch), `overrides` as `-c` values on the app-server's command line. */
export type ThreadPolicy = { thread: { approvalPolicy: string; permissions?: string }; overrides: string[] };

/**
 * A launch's approval and sandbox for Codex 0.160.0 (measured: `docs/review-and-qa.md`, "The Codex sandbox").
 * Approvals are never asked unless the launch says otherwise. A sandbox that is a built-in permissions profile is
 * named in `thread/start`; any other is the profile `cland`, which only the app-server's own configuration can
 * define (a profile defined in `thread/start`'s `config` is accepted there, and then every turn fails with "failed
 * to load workspace requirements"):
 *
 *   filesystem  each writable root, and — since Codex keeps git directories read-only inside a writable root —
 *               the root's `.git` and the cwd's own git directory when it lies there (a worktree's), so the
 *               session commits on its branch. (A root that is itself a linked worktree has no `.git` directory
 *               of its own: nothing is added for it.)
 *   network     `local`: Unix sockets under the project's `.cland/` (the hub's socket), the cwd and the temp dir
 *               (where tests start their hubs), and loopback. `features.network_proxy` is what closes the rest:
 *               without it `network.enabled` opens the whole network. The app-servers' own sockets are denied:
 *               one of them takes `command/exec` under any profile, which would be a way out of the sandbox.
 *               `full`: the whole network, the proxy off.
 */
export async function threadPolicy(host: Pick<AdapterHost, 'discoveryFile'>, cwd: string, policy: LaunchPolicy, resumed: Resumed = untimed): Promise<ThreadPolicy> {
  return continueWith((function* (): Generator<Promise<unknown>, ThreadPolicy, unknown> {
    const approvalPolicy = policy.approval ?? 'never';
    const box = policy.sandbox;
    if (!box)
      return { thread: { approvalPolicy }, overrides: [] };
    if (box.mode === 'danger-full-access')
      return { thread: { approvalPolicy, permissions: ':danger-full-access' }, overrides: [] };
    const base = box.mode === 'read-only' ? ':read-only' : ':workspace';
    if (box.writableRoots.length === 0 && box.network === 'none')
      return { thread: { approvalPolicy, permissions: base }, overrides: [] };
    const filesystem: Record<string, string> = {};
    const gitDirs: string[] = [];
    for (const root of yield* wait(Promise.all(box.writableRoots.map(root => real(root, resumed))))) {
      filesystem[root] = 'write';
      const git = join(root, '.git');
      if (yield* wait(isDir(git, resumed)))
        gitDirs.push(git);
    }
    const own = yield* wait(worktreeGitDir(cwd, resumed));
    for (const git of gitDirs)
      filesystem[git] = 'write';
    if (own !== null && gitDirs.some((git) => under(own, git)))
      filesystem[own] = 'write';
    let network: Record<string, unknown> | null = null;
    if (box.network === 'local') {
      const cland = yield* wait(real(dirname(host.discoveryFile), resumed));
      const unix_sockets: Record<string, string> = { [cland]: 'allow', [yield* wait(real(cwd, resumed))]: 'allow', [yield* wait(real(tmpdir(), resumed))]: 'allow', [join(cland, 'run')]: 'deny', [yield* wait(tmpRunDir(resumed))]: 'deny' };
      network = { enabled: true, allow_local_binding: true, unix_sockets };
    }
    else if (box.network === 'full')
      network = { enabled: true };
    const profile = { extends: base, ...(Object.keys(filesystem).length ? { filesystem } : {}), ...(network ? { network } : {}) };
    return {
      thread: { approvalPolicy, permissions: CLAND_PROFILE },
      overrides: [
        // Codex wants a default beside any profile it is given; the thread names the same one
        `default_permissions=${toml(CLAND_PROFILE)}`,
        `permissions.${CLAND_PROFILE}=${toml(profile)}`,
        ...(network ? [`features.network_proxy=${toml(box.network === 'local')}`] : []),
      ],
    };
  })(), resumed);
}

export type CodexOptions = {
  /** Grace before a verified process tree is killed. */
  stopGraceMs?: number;
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
  /** Monotonic arrival order for state and approval metadata, including events received during awaits. */
  eventSequence: number;
  approvalCommand?: string;
  /** The active turn's id, from `turn/started` and `turn/start`: what `turn/steer` must name. */
  turnId: string | null;
  tokens: Record<string, unknown> | null;
  rateLimits: Record<string, unknown> | null;
};

/** An accepted input not yet seen taken up: its envelope, the shape it was admitted in, and how often it was
 *  delivered again. */
type OwedInput = { text: string; shape: InputShape; recoveries: number };

type PendingInput = { id: string; takenUp: Set<string> };

type ThreadResult = { thread: { id: string; status?: unknown; model?: string }; model?: string };
type SubscriptionSnapshot = { state: SessionState; model: string | null; sequence: number };

export class CodexAdapter implements HarnessAdapter {
  readonly harness = CODEX;
  readonly capabilities = CODEX_CAPABILITIES;
  readonly clauseAtSpawn = true;
  readonly #host: AdapterHost;
  readonly #recoveries: FailedLaunches;
  readonly #bin: string;
  readonly #pollMs: number;
  readonly #stopGraceMs: number;
  readonly #injectTimeoutMs: number;
  readonly #spawnDeadlineMs: number;
  readonly #env: NodeJS.ProcessEnv;
  /** By cland session id. */
  readonly #live = new Map<string, Live>();
  /** Watched session ids: their pids are checked and their connections kept. */
  readonly #watched = new Set<string>();
  /** Inputs being admitted, then associated with the actual turn id (idle can precede completion). */
  readonly #admissions = new Map<string, number>();
  readonly #pendingInputs = new Map<string, Set<PendingInput>>();
  readonly #completedTurns = new Map<string, string | null>();
  readonly #turnInputs = new Map<string, Set<string>>();
  /** Steers the app-server accepted that their turn has not been seen to take up: by `sessionId:turnId`, each
   *  message id with its envelope and recovery count. A turn that ends with one left gets it again (`#redeliver`). */
  readonly #steers = new Map<string, Map<string, OwedInput>>();
  readonly #earlyFailures = new Map<string, string[]>();
  #timer: NodeJS.Timeout | null = null;
  #versionChecked = false;
  #tmpRun = join(tmpdir(), 'cland-run');
  #closed = false;
  readonly #stopping = new Set<string>();

  constructor(host: AdapterHost, options: CodexOptions = {}) {
    this.#host = host;
    this.#recoveries = new FailedLaunches(host.log, 1000, host.durableLaunchRecovery);
    this.#bin = options.bin ?? process.env.CLAND_CODEX_BIN ?? 'codex';
    this.#pollMs = options.pollMs ?? 5000;
    this.#stopGraceMs = options.stopGraceMs ?? 5000;
    this.#injectTimeoutMs = options.injectTimeoutMs ?? 60_000;
    this.#spawnDeadlineMs = options.spawnDeadlineMs ?? 30_000;
    const env: NodeJS.ProcessEnv = {};
    for (const [k, v] of Object.entries(options.env ?? process.env)) if (!k.startsWith('CLAND_') || k === 'CLAND_CODEX_BIN') env[k] = v;
    this.#env = env;
  }

  // ---------------------------------------------------------------- the app-server process

  async #checkVersion(cwd: string, resumed: Resumed = untimed): Promise<void> {
    return continueWith((function* (this: CodexAdapter): Generator<Promise<unknown>, void, unknown> {
      if (this.#versionChecked)
        return;
      const out = yield* wait(new Promise<string>((resolve, reject) => execFile(this.#bin, ['--version'], { cwd, env: this.#env, encoding: 'utf8', timeout: 15000 }, (err, stdout) => (err ? reject(new Error(`${this.#bin} --version: ${err.message}`)) : resolve(stdout)))));
      const v = /(\d+)\.(\d+)\.(\d+)/.exec(out);
      const [a, b, c] = MIN_CODEX_VERSION;
      const n = v ? [Number(v[1]), Number(v[2]), Number(v[3])] : null;
      if (!n || n[0]! < a || (n[0] === a && (n[1]! < b || (n[1] === b && n[2]! < c))))
        throw new Error(`Codex ${MIN_CODEX_VERSION.join('.')} or newer is needed (the app-server's toolOutput turns); found: ${out.trim() || 'nothing'}`);
      this.#versionChecked = true;
    }).call(this), resumed);
  }

  /** The session's socket: in `.cland/run/`, or in the temp directory's `cland-run/` when that path is too long for
   *  a Unix socket. Both directories are closed to a sandboxed session (`threadPolicy`). */
  #socketPath(sessionId: string): string {
    const file = `cx-${sessionId.replace(/-/g, '').slice(0, 12)}.sock`;
    const inProject = join(dirname(this.#host.discoveryFile), 'run', file);
    // sun_path is 104 bytes on macOS, 108 on Linux
    return Buffer.byteLength(inProject) <= 100 ? inProject : join(this.#tmpRun, file);
  }

  /** Start an app-server on the socket; resolves with its pid once it answers there. */
  async #startServer(p: Pick<HarnessProcess, 'name' | 'role' | 'sessionId' | 'cwd'>, socket: string, overrides: string[], files: LaunchFiles, resumed: Resumed = untimed, launchToken?: string, authorize: () => void = () => {}): Promise<{ pid: number; client: AppServerClient }> {
    return continueWith((function* (this: CodexAdapter): Generator<Promise<unknown>, {
      pid: number;
      client: AppServerClient;
    }, unknown> {
      yield* wait(files.directory(dirname(socket), 0o700));
      yield* wait(rm(socket, { force: true }));
      files.removeOnFailure(socket);
      const logDir = join(dirname(this.#host.discoveryFile), 'log');
      yield* wait(files.directory(logDir));
      const logFile = join(logDir, `codex-${p.name}.log`);
      yield* wait(files.file(logFile, true));
      const args = ['app-server', '--listen', `unix://${socket}`, ...mcpOverrides(this.#host, p.name, p.role, p.sessionId), ...overrides.flatMap((o) => ['-c', o])];
      const out = yield* wait(open(logFile, 'a'));
      let exited: string | null = null;
      let pid: number | undefined;
      try {
        // detached, in its own process group: it outlives the hub, and its MCP children (the spoke) go with it
        // the session's shell inherits the app-server's environment: `cland` run there acts as the session, not as the
        // human, and `node` is the hub's own, whatever else the PATH holds (a Node outside the engines range fails the suite)
        const env = {
          ...this.#env,
          PATH: [dirname(this.#host.node), this.#env.PATH].filter(Boolean).join(delimiter),
          CLAND_SESSION_ID: p.sessionId,
          CLAND_SESSION_NAME: p.name,
          ...(launchToken ? { CLAND_LAUNCH_TOKEN: launchToken } : {}),
          ...(p.role ? { CLAND_ROLE: p.role } : {}),
        };
        authorize();
        const child = spawn(this.#bin, args, { cwd: p.cwd, env, detached: true, stdio: ['ignore', out.fd, out.fd] });
        child.once('exit', (code, signal) => (exited = `exited (${code ?? signal})`));
        child.once('error', (err) => (exited = err.message));
        child.unref();
        files.child(child, this.#host.log, this.#stopGraceMs);
        pid = child.pid;
      } finally {
        yield* wait(out.close());
      }
      this.#host.log({ event: 'harness-launched', harness: this.harness, session: p.name, pid: pid ?? null, socket });
      const deadline = Date.now() + this.#spawnDeadlineMs;
      for (;;) {
        if (exited !== null || pid === undefined)
          throw new Error(`codex app-server ${exited ?? 'did not start'}: ${yield* wait(tail(logFile, resumed))}`);
        try {
          const client = yield* wait(this.#connectTo(socket));
          return { pid, client };
        } catch (err) {
          if (Date.now() > deadline) {
            throw new Error(`codex app-server did not answer on ${socket} within ${this.#spawnDeadlineMs} ms (${err instanceof Error ? err.message : String(err)}): ${yield* wait(tail(logFile, resumed))}`);
          }
          yield* wait(sleep(100));
        }
      }
    }).call(this), resumed);
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
        case 'item/started':
        case 'item/completed': {
          // an input the turn took up is an item of the turn (`turnInput`): a message seen there is no longer owed
          const input = mine(params) ? turnInput(params.item as TurnItem | undefined) : null;
          if (input) this.#takenUp(live.p.sessionId, String(params.turnId), input.text);
          return;
        }
        case 'turn/started': {
          const id = (params.turn as { id?: unknown } | undefined)?.id;
          if (mine(params) && typeof id === 'string') {
            live.turnId = id;
          }
          return;
        }
        case 'turn/completed': {
          if (!mine(params)) return;
          const turn = params.turn as { id?: string; status?: string; error?: unknown } | undefined;
          const key = `${live.p.sessionId}:${turn?.id ?? live.turnId}`;
          const messages = [...(this.#turnInputs.get(key) ?? [])];
          this.#turnInputs.delete(key);
          const error = turn?.error || turn?.status === 'failed' ? turnError(turn?.error) : null;
          if (this.#admissions.has(live.p.sessionId)) this.#completedTurns.set(key, error);
          if (error) {
            if (this.#watched.has(live.p.sessionId)) this.#host.turnFailed?.(live.p.sessionId, error, messages);
            else this.#earlyFailures.set(live.p.sessionId, [...(this.#earlyFailures.get(live.p.sessionId) ?? []), error]);
          }
          if (!turn?.id || live.turnId === turn.id) live.turnId = null;
          // a turn that failed reported the messages it held above (`turnFailed`); one that ended well owes
          // nothing only once every steer it accepted is among its inputs
          const owed = this.#steers.get(key);
          this.#steers.delete(key);
          if (owed?.size && !error && turn?.id) void this.#redeliver(live, turn.id, owed);
          void this.#readRateLimits(live);
          return;
        }
        case 'thread/tokenUsage/updated':
          if (mine(params) && params.tokenUsage && typeof params.tokenUsage === 'object') {
            live.tokens = params.tokenUsage as Record<string, unknown>;
            this.#host.usageChanged?.(live.p.sessionId);
          }
          return;
        case 'account/rateLimits/updated':
          if (params.rateLimits && typeof params.rateLimits === 'object') {
            live.rateLimits = params.rateLimits as Record<string, unknown>;
            this.#host.usageChanged?.(live.p.sessionId);
          }
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
      if (request.params.threadId !== undefined && !mine(request.params)) return;
      this.#host.log({ event: 'harness-request', harness: this.harness, session: live.p.name, method: request.method });
      if (request.method.startsWith('item/') && request.method.endsWith('/requestApproval')) {
        live.eventSequence++;
        // Keep state authoritative from thread/status/changed; requests only enrich its metadata.
        live.approvalCommand = request.method === 'item/commandExecution/requestApproval' && typeof request.params.command === 'string'
          ? request.params.command : request.method.split('/')[1] ?? request.method;
        if (live.state === 'waiting for approval') this.#setState(live, live.state);
      }
    });
    client.on('close', () => {
      if (live.client === client) live.client = null;
      if (this.#closed || !this.#watched.has(live.p.sessionId)) return;
      // a closed connection is a dead app-server, or one the next poll reconnects to
      if (live.p.pid !== null && !pidAlive(live.p.pid)) this.#gone(live, `pid ${live.p.pid} is gone`);
    });
  }

  #updateState(live: Live, state: SessionState): void {
    live.eventSequence++;
    live.state = state;
    // Metadata belongs to this waiting episode, whether state comes from an event or a current snapshot.
    if (state !== 'waiting for approval') delete live.approvalCommand;
    if (state === 'idle') live.turnId = null;
  }

  #setState(live: Live, state: SessionState): void {
    this.#updateState(live, state);
    this.#host.signal(live.p.sessionId, { state, source: 'app-server', at: Date.now(), ...(live.approvalCommand !== undefined ? { approvalCommand: live.approvalCommand } : {}) });
  }

  async #readRateLimits(live: Live): Promise<void> {
    try {
      const r = await live.client?.request<{ rateLimits?: Record<string, unknown> }>('account/rateLimits/read', {}, 15_000);
      if (r?.rateLimits) {
        live.rateLimits = r.rateLimits;
        this.#host.usageChanged?.(live.p.sessionId);
      }
    } catch {
      // an account without rate limits (an API key) has none to read
    }
  }

  /** Subscribe a fresh connection to the thread: `thread/resume` (which needs a rollout), else `thread/read`. */
  async #subscribe(live: Live, client: AppServerClient, extra: Record<string, unknown> = {}, resumed: Resumed = untimed): Promise<SubscriptionSnapshot> {
    return continueWith((function* (this: CodexAdapter): Generator<Promise<unknown>, SubscriptionSnapshot, unknown> {
      const threadId = live.p.harnessSessionId as string;
      const sequence = live.eventSequence;
      try {
        const r = (yield* wait(client.request<ThreadResult>('thread/resume', { threadId, ...extra })));
        return { state: stateOfStatus(r.thread.status), model: r.model ?? r.thread.model ?? null, sequence };
      } catch (err) {
        if (!(err instanceof RpcError) || Object.keys(extra).length)
          throw err;
        // a thread with no turn yet has no rollout: still loaded, and its status is broadcast to every connection
        const r = (yield* wait(client.request<ThreadResult>('thread/read', { threadId })));
        return { state: stateOfStatus(r.thread.status), model: r.thread.model ?? null, sequence };
      }
    }).call(this), resumed);
  }

  #snapshotIsCurrent(live: Live, snapshot: SubscriptionSnapshot): boolean {
    // Re-read after subscribe: an event received during its await supersedes this earlier snapshot.
    return live.eventSequence === snapshot.sequence;
  }

  #gone(live: Live, detail: string): void {
    if (this.#stopping.has(live.p.sessionId)) return;
    this.#updateState(live, 'unknown');
    this.#unwatch(live.p.sessionId);
    live.client?.close();
    live.client = null;
    this.#host.exited(live.p.sessionId, detail);
  }

  // ---------------------------------------------------------------- launch

  async spawn(request: SpawnRequest, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<HarnessProcess> {
    return continueWith((function* (this: CodexAdapter): Generator<Promise<unknown>, HarnessProcess, unknown> {
      this.#recoveries.assertAvailable(request.name);
      yield* wait(this.#checkVersion(request.cwd, resumed));
      authorize();
      const files = new LaunchFiles(resumed);
      const sessionId = randomUUID();
      this.#tmpRun = yield* wait(tmpRunDir(resumed));
      const socket = this.#socketPath(sessionId);
      const base = { name: request.name, role: request.role, sessionId, cwd: request.cwd };
      let pid: number | undefined;
      let client: AppServerClient | undefined;
      try {
        const policy = yield* wait(this.#threadPolicy(request.cwd, request, files, resumed));
        ({ pid, client } = yield* wait(this.#startServer(base, socket, policy.overrides, files, resumed, request.launchToken, authorize)));
        authorize();
        const started = yield* wait(client.request<ThreadResult>('thread/start', { cwd: request.cwd, ...(request.model ? { model: request.model } : {}), ...policy.thread }));
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
        const live: Live = { p, client: null, connecting: null, state: stateOfStatus(started.thread.status), eventSequence: 0, turnId: null, tokens: null, rateLimits: null };
        this.#live.set(sessionId, live);
        this.#attach(live, client);
        void this.#readRateLimits(live);
        // the first turn carries the clause: the thread gets its rollout, so attach and resume work
        // the launch's effort (roles.toml) rides on the first turn: `turn/start` takes it for this turn and the next ones
        authorize();
        const turn = yield* wait(client.request<{
          turn?: {
            id?: string;
          };
        }>('turn/start', { threadId, input: [{ type: 'text', text: firstTurn(request.name, request.clause) + (request.brief ? `\n\n${envelope(request.brief, null)}` : ''), text_elements: [] }], ...(request.effort ? { effort: request.effort } : {}) }));
        // the turn is accepted: the thread is active, though its `thread/status/changed` may come after this result
        // (seen with 0.160.0); a launch never reports the idle that preceded the clause turn
        if (typeof turn.turn?.id === 'string')
          live.turnId ??= turn.turn.id;
        if (live.state === 'idle')
          live.state = 'busy';
        this.#host.log({ event: 'harness-thread-started', harness: this.harness, session: request.name, thread: threadId, model: p.model });
        files.commit();
        return p;
      } catch (err) {
        return yield* wait(this.#recoveries.failed(sessionId, request.name, files, err, () => {
          client?.close();
          this.#live.delete(sessionId);
        }));
      }
    }).call(this), resumed);
  }

  /** The launch's settings for Codex; the directories the sandbox denies sockets in exist first (Codex ignores a
   *  socket path it cannot normalize, and a deny that is ignored is a hole). */
  async #threadPolicy(cwd: string, policy: LaunchPolicy, files: LaunchFiles, resumed: Resumed = untimed): Promise<ThreadPolicy> {
    return continueWith((function* (this: CodexAdapter): Generator<Promise<unknown>, ThreadPolicy, unknown> {
      if (policy.sandbox?.network === 'local')
        for (const dir of [join(dirname(this.#host.discoveryFile), 'run'), yield* wait(tmpRunDir(resumed))])
          yield* wait(files.directory(dir, 0o700));
      return yield* wait(threadPolicy(this.#host, cwd, policy, resumed));
    }).call(this), resumed);
  }

  attachCommand(p: HarnessProcess): string {
    // never a `-c` or a `--profile`: either one puts the TUI in embedded mode, where it has no external surface
    const bin = this.#bin === 'codex' ? 'codex' : sq(this.#bin);
    return [bin, 'resume', '--remote', sq(`unix://${p.harnessId ?? this.#socketPath(p.sessionId)}`), '--cd', sq(p.cwd), sq(p.harnessSessionId ?? '')].join(' ');
  }

  // ---------------------------------------------------------------- inject

  /** The turn took up an input: the steers whose envelope it carries are owed no more. */
  #takenUp(sessionId: string, turnId: string, text: string): void {
    const ids = envelopeIds(text);
    if (ids.length === 0) return;
    for (const pending of this.#pendingInputs.get(sessionId) ?? []) {
      if (ids.includes(pending.id)) pending.takenUp.add(turnId);
    }
    const key = `${sessionId}:${turnId}`;
    const owed = this.#steers.get(key);
    if (!owed) return;
    for (const id of ids) owed.delete(id);
    if (owed.size === 0) this.#steers.delete(key);
  }

  /**
   * A turn ended well with inputs it had accepted and was not seen to take up. Its own record decides (the
   * notification may have been missed, or have come before the input's result): what is not among the turn's
   * inputs is handed over again as a turn of its own. The record is read as `turnInput` knows it; an input owed in
   * a shape the record does not show at all (a tool output starts its own turn, so that turn must show one; a steer
   * may join a turn of either shape, so that turn must show some input) is not judged, and neither is a record that
   * cannot be read: they are reported (`harness-turn-unread`, one per readback) and not delivered again. A message delivered once
   * and unverified is the lesser harm than a turn run twice and a false alarm (T-68). Measured with Codex 0.160.0,
   * an accepted steer was always taken up: this is the guard for the case it is not.
   */
  async #redeliver(live: Live, turnId: string, owed: Map<string, OwedInput>): Promise<void> {
    const client = live.client;
    const threadId = live.p.harnessSessionId as string;
    let inputs: Array<{ shape: InputShape; text: string }> | null = null;
    let unreadBecause = "the turn's record shows no input item of the shape it was admitted in";
    try {
      if (!client || client.closed) throw new Error("the hub is not connected to this session's app-server");
      const r = await client.request<{ thread: { turns?: Array<{ id?: string; items?: TurnItem[] }> } }>('thread/read', { threadId, includeTurns: true }, 15_000);
      const turn = r.thread.turns?.find((t) => t.id === turnId);
      if (!turn) throw new Error("the turn is not in the thread's record");
      inputs = (turn.items ?? []).map(turnInput).filter((i) => i !== null);
    } catch (err) {
      unreadBecause = err instanceof Error ? err.message : String(err);
    }
    const unread: string[] = [];
    for (const [id, obligation] of owed) {
      if (inputs?.some((i) => envelopeIds(i.text).includes(id))) {
        owed.delete(id);
        continue;
      }
      const judged = inputs?.some((i) => obligation.shape === 'text' || i.shape === obligation.shape) ?? false;
      if (!judged) {
        unread.push(id);
        owed.delete(id);
      }
    }
    if (unread.length > 0) this.#host.log({ event: 'harness-turn-unread', harness: this.harness, session: live.p.name, turn: turnId, ids: unread, error: unreadBecause });
    for (const [id, obligation] of owed) {
      try {
        // A newer turn may itself drop a recovery. Track every accepted attempt, but stop
        // after two recoveries and report the failure rather than silently losing or looping.
        if (obligation.recoveries >= 2) throw new Error('the message was still missing after two redeliveries');
        await this.#withAdmission(live.p.sessionId, id, async (pending) => {
          if (!client || client.closed) throw new Error("the hub is not connected to this session's app-server");
          const idle = live.state === 'idle' || live.state === 'unknown';
          const text = obligation.text;
          const params = idle ? { threadId, input: [], toolOutput: { name: 'hub_event', namespace: 'cland', output: text } } : { threadId, input: [{ type: 'text', text, text_elements: [] }] };
          const r = await client.request<{ turn?: { id?: string } }>('turn/start', params, this.#injectTimeoutMs);
          if (typeof r.turn?.id !== 'string') throw new Error('the app-server accepted redelivery without a turn id');
          this.#acceptedInput(live, r.turn.id, id, { text, shape: idle ? 'toolOutput' : 'text', recoveries: obligation.recoveries + 1 }, pending);
          if (live.state !== 'idle') live.turnId ??= r.turn.id;
          this.#host.log({ event: 'harness-redelivered', harness: this.harness, session: live.p.name, id, turn: turnId, admittedTurn: r.turn.id, intoActiveTurn: !idle });
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.#host.log({ event: 'harness-redelivery-failed', harness: this.harness, session: live.p.name, id, turn: turnId, error });
        this.#host.notifyFailureSenders?.(live.p.sessionId, `redelivery failed: ${error}`, [id]);
      }
    }
  }

  /** Reconcile acceptance with consumption and completion, in whichever order they arrive. */
  #acceptedInput(live: Live, turnId: string, id: string, obligation: OwedInput, pending: PendingInput): void {
    const sessionId = live.p.sessionId;
    this.#admitInput(sessionId, turnId, id);
    if (pending.takenUp.has(turnId)) return;
    const key = `${sessionId}:${turnId}`;
    const owed = this.#steers.get(key) ?? new Map<string, OwedInput>();
    owed.set(id, obligation);
    if (this.#completedTurns.has(key)) {
      if (this.#completedTurns.get(key) === null) void this.#redeliver(live, turnId, owed);
    } else this.#steers.set(key, owed);
  }

  #admitInput(sessionId: string, turnId: string, messageId: string): void {
    const key = `${sessionId}:${turnId}`;
    if (this.#completedTurns.has(key)) {
      const error = this.#completedTurns.get(key);
      if (error) this.#host.notifyFailureSenders?.(sessionId, error, [messageId]);
      return;
    }
    const inputs = this.#turnInputs.get(key) ?? new Set<string>();
    inputs.add(messageId);
    this.#turnInputs.set(key, inputs);
  }

  async inject(p: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void> {
    await this.#withAdmission(p.sessionId, message.id, (pending) => this.#inject(p, message, topic, pending));
  }

  /** Original injections and recoveries share the same completion/late-response reconciliation. */
  async #withAdmission(sessionId: string, messageId: string, work: (pending: PendingInput) => Promise<void>): Promise<void> {
    const pending: PendingInput = { id: messageId, takenUp: new Set() };
    const inputs = this.#pendingInputs.get(sessionId) ?? new Set<PendingInput>();
    this.#pendingInputs.set(sessionId, inputs);
    inputs.add(pending);
    this.#admissions.set(sessionId, (this.#admissions.get(sessionId) ?? 0) + 1);
    try {
      await work(pending);
    } finally {
      inputs.delete(pending);
      if (inputs.size === 0) this.#pendingInputs.delete(sessionId);
      const remaining = (this.#admissions.get(sessionId) ?? 1) - 1;
      if (remaining > 0) this.#admissions.set(sessionId, remaining);
      else {
        this.#admissions.delete(sessionId);
        for (const key of this.#completedTurns.keys()) if (key.startsWith(`${sessionId}:`)) this.#completedTurns.delete(key);
      }
    }
  }

  async #inject(p: HarnessProcess, message: Message, topic: TopicRef | null, pending: PendingInput): Promise<void> {
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
        this.#acceptedInput(live, expected, message.id, { text, shape: 'text', recoveries: 0 }, pending);
        this.#host.log({ event: 'harness-steered', harness: this.harness, session: p.name, id: message.id, turn: expected });
        return;
      } catch (err) {
        // sent and never answered: the steer may have landed, so it is never sent again on its own
        if (err instanceof RpcNoAnswer) throw new InjectUncertain(`turn/steer: ${err.message}`);
        if (!(err instanceof RpcError)) throw err;
        // the turn ended (or another began) in between: try again on what is current now; a turn id the
        // app-server refuses and nothing replaced is stale, and the thread takes a new turn below
        if (live.turnId === expected) live.turnId = null;
      }
    }
    // an active turn whose id the hub missed (it reconnected mid-turn): `turn/start` steers it
    const shape: InputShape = live.state === 'idle' || live.state === 'unknown' ? 'toolOutput' : 'text';
    const params = shape === 'toolOutput' ? { threadId, input: [], toolOutput: { name: 'hub_event', namespace: 'cland', output: text } } : { threadId, input };
    let r: { turn?: { id?: string } };
    try {
      r = await client.request<{ turn?: { id?: string } }>('turn/start', params, this.#injectTimeoutMs);
    } catch (err) {
      if (err instanceof RpcNoAnswer) throw new InjectUncertain(`turn/start: ${err.message}`);
      throw err;
    }
    if (typeof r.turn?.id === 'string') this.#acceptedInput(live, r.turn.id, message.id, { text, shape, recoveries: 0 }, pending);
    if (typeof r.turn?.id === 'string' && live.state !== 'idle') live.turnId ??= r.turn.id;
  }

  /** The app-server's JSON-RPC result is the confirmation: nothing comes through the hub. */
  confirm(): void {}

  /** No hooks: everything comes from the app-server. */
  interpret(): Interpretation {
    return {};
  }

  usage(p: HarnessProcess): SessionUsage | null {
    const live = this.#live.get(p.sessionId);
    if (!live || (!live.tokens && !live.rateLimits)) return null;
    const total = codexCounts(live.tokens?.total);
    const last = codexCounts(live.tokens?.last);
    return {
      ...(p.model ? { model: p.model } : {}),
      ...(total ? { total } : {}),
      ...(last ? { last } : {}),
      ...(live.tokens ? { tokens: live.tokens } : {}),
      ...(live.rateLimits ? { rateLimits: live.rateLimits } : {}),
    };
  }

  // ---------------------------------------------------------------- watch: liveness and the connection

  watch(p: HarnessProcess): void {
    let live = this.#live.get(p.sessionId);
    if (!live) {
      live = { p, client: null, connecting: null, state: 'unknown', eventSequence: 0, turnId: null, tokens: null, rateLimits: null };
      this.#live.set(p.sessionId, live);
    } else live.p = p;
    this.#watched.add(p.sessionId);
    for (const error of this.#earlyFailures.get(p.sessionId) ?? []) this.#host.turnFailed?.(p.sessionId, error, []);
    this.#earlyFailures.delete(p.sessionId);
    // what the app-server said before the process-table row existed
    if (live.state !== 'unknown') this.#host.signal(p.sessionId, { state: live.state, source: 'app-server', at: Date.now(), ...(live.approvalCommand !== undefined ? { approvalCommand: live.approvalCommand } : {}) });
    if (!live.client) void this.#reconnect(live);
    if (!this.#timer) {
      this.#timer = setInterval(() => this.#poll(), this.#pollMs);
      this.#timer.unref();
    }
  }

  #unwatch(sessionId: string): void {
    this.#admissions.delete(sessionId);
    this.#pendingInputs.delete(sessionId);
    for (const key of this.#completedTurns.keys()) if (key.startsWith(`${sessionId}:`)) this.#completedTurns.delete(key);
    this.#earlyFailures.delete(sessionId);
    for (const key of this.#turnInputs.keys()) if (key.startsWith(`${sessionId}:`)) this.#turnInputs.delete(key);
    for (const key of this.#steers.keys()) if (key.startsWith(`${sessionId}:`)) this.#steers.delete(key);
    this.#watched.delete(sessionId);
    if (this.#watched.size === 0 && this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  unwatch(sessionId: string): void {
    this.#unwatch(sessionId);
    this.#live.get(sessionId)?.client?.close();
    this.#live.delete(sessionId);
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
    if (live.connecting || this.#closed || this.#stopping.has(live.p.sessionId)) return live.connecting ?? Promise.resolve();
    const socket = live.p.harnessId;
    if (!socket) return Promise.resolve();
    live.connecting = (async () => {
      let client: AppServerClient | null = null;
      try {
        client = await this.#connectTo(socket);
        if (this.#closed || this.#live.get(live.p.sessionId) !== live) { client.close(); return; }
        this.#attach(live, client);
        const r = await this.#subscribe(live, client);
        if (this.#closed || this.#live.get(live.p.sessionId) !== live) { client.close(); return; }
        if (this.#snapshotIsCurrent(live, r) && r.state !== 'unknown') this.#setState(live, r.state);
        void this.#readRateLimits(live);
        // a message whose inject failed while the connection was down waits for no state change: retried now
        this.#host.reconnected?.(live.p.sessionId);
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

  async stop(p: HarnessProcess, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<void> {
    this.#stopping.add(p.sessionId);
    let ended = false;
    try {
      if (!await endProcess(p, (entry) => this.#host.log({ ...entry, harness: this.harness, session: p.name }), this.#stopGraceMs, undefined, { resumed, authorize, allowReused: p.status === 'exited' })) throw new Error(`could not stop "${p.name}": its process identity cannot be verified; it is still watched`);
      ended = true;
    } finally {
      resumed(() => {
        if (ended) {
          this.#unwatch(p.sessionId);
          const live = this.#live.get(p.sessionId);
          if (live) this.#updateState(live, 'unknown');
          live?.client?.close();
          this.#live.delete(p.sessionId);
        }
        this.#stopping.delete(p.sessionId);
      });
      if (ended && p.harnessId) await rm(p.harnessId, { force: true });
    }
  }

  async resume(p: HarnessProcess, options: { relaunch?: boolean; policy?: LaunchPolicy; resumed?: Resumed } = {}): Promise<ResumeResult> {
    return continueWith((function* (this: CodexAdapter): Generator<Promise<unknown>, ResumeResult, unknown> {
      const resumed = options.resumed ?? untimed;
      this.#recoveries.assertAvailable(p.name, p.sessionId);
      if (!p.harnessId)
        this.#tmpRun = yield* wait(tmpRunDir(resumed));
      const socket = p.harnessId ?? this.#socketPath(p.sessionId);
      if (!p.harnessSessionId)
        return { found: false, reason: 'no thread id recorded' };
      const live: Live = this.#live.get(p.sessionId) ?? { p, client: null, connecting: null, state: 'unknown', eventSequence: 0, turnId: null, tokens: null, rateLimits: null };
      live.p = p;
      this.#live.set(p.sessionId, live);
      if ((yield* wait(processAlive(p, options.resumed))) && (yield* wait(access(socket).then(() => true, () => false)))) {
        let client: AppServerClient | null = null;
        try {
          client = yield* wait(this.#connectTo(socket));
          live.client?.close();
          this.#attach(live, client);
          const r = yield* wait(this.#subscribe(live, client, {}, resumed));
          if (this.#snapshotIsCurrent(live, r)) this.#updateState(live, r.state);
          void this.#readRateLimits(live);
          return { found: true, process: { ...p, harnessId: socket, model: r.model ?? p.model, status: 'running' }, state: live.state };
        } catch (err) {
          client?.close();
          if (!options.relaunch)
            return { found: false, reason: `the app-server (pid ${p.pid}) does not answer for thread ${p.harnessSessionId}: ${err instanceof Error ? err.message : String(err)}` };
        }
      }
      else if (!options.relaunch) {
        return { found: false, reason: (yield* wait(processAlive(p, options.resumed))) ? `no socket at ${socket}` : p.pid !== null && pidAlive(p.pid) ? `pid ${p.pid} belongs to another process now` : `pid ${p.pid ?? '?'} is gone` };
      }
      yield* wait(this.stop(p, options.resumed));
      this.#live.set(p.sessionId, live);
      // a new app-server on the same socket, resuming the thread from its rollout
      const files = new LaunchFiles(resumed);
      let pid: number | undefined;
      let client: AppServerClient | undefined;
      try {
        const policy = yield* wait(this.#threadPolicy(p.cwd, options.policy ?? {}, files, resumed));
        ({ pid, client } = yield* wait(this.#startServer(p, socket, policy.overrides, files, resumed)));
        this.#attach(live, client);
        const r = yield* wait(this.#subscribe(live, client, { cwd: p.cwd, ...(p.model ? { model: p.model } : {}), ...policy.thread }, resumed));
        if (this.#snapshotIsCurrent(live, r)) this.#updateState(live, r.state);
        const relaunched: HarnessProcess = { ...p, pid, harnessId: socket, model: r.model ?? p.model, startedAt: new Date().toISOString(), status: 'running' };
        live.p = relaunched;
        this.#host.log({ event: 'harness-relaunched', harness: this.harness, session: p.name, pid, thread: p.harnessSessionId });
        files.commit();
        return { found: true, process: relaunched, state: live.state };
      } catch (err) {
        return yield* wait(this.#recoveries.failed(p.sessionId, p.name, files, err, () => {
          client?.close();
          this.#live.delete(p.sessionId);
        }));
      }
    }).call(this), options.resumed ?? untimed);
  }

  close(): void {
    this.#recoveries.close();
    this.#admissions.clear();
    this.#completedTurns.clear();
    this.#turnInputs.clear();
    this.#steers.clear();
    this.#earlyFailures.clear();
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
async function tail(file: string, resumed: Resumed = untimed): Promise<string> {
  return continueWith((function* (): Generator<Promise<unknown>, string, unknown> {
    try {
      return ((yield* wait(readFile(file, 'utf8')))).trim().split('\n').slice(-5).join(' | ').slice(-800) || '(no output)';
    } catch {
      return '(no output)';
    }
  })(), resumed);
}
