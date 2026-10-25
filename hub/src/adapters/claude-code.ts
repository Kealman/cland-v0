import { withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';
import { harnessBinary } from '../doctor/harnesses.ts';
import { realClock, type Clock, type ClockTimer } from '../hub/clock.ts';
import { processAlive } from './processes.ts';
// The Claude Code adapter (spec 4.3, research `harness-surfaces` §1). Claude Code has no server a host can
// join; everything comes from inside each session or from its own CLI:
//
//   spawn    `claude --bg --session-id <uuid> --name <name> [--model m] [--effort e] --mcp-config <json> --settings <json>
//            --plugin-dir <cland mod>` in the session's cwd. The MCP config starts the spoke with the session's
//            identity; the settings add the cland hooks and the variables the mod reads. Both use private files
//            whose paths are passed to the CLI. The hub's secret is never on the command line — the spoke,
//            the hooks and the mod read the project's `hub.json`.
//            Settings also supply worktree.bgIsolation = "none" only when neither .claude/settings.json nor
//            .claude/settings.local.json in the session's cwd sets it. Each launch/relaunch reads both files:
//            inline settings outrank files, so always passing it would defeat a human's local override.
//            A session launched with an item (its cwd is the item's task worktree) also gets a `WorktreeCreate`
//            hook, `cland hook worktree-create`, which refuses every worktree the harness would make and names the
//            session's own (T-20 decision D8): its sub-agents work there too.
//   attach   `claude attach <background id>`, the harness's own.
//   inject   the cland mod (`hub/mod/cland`): it keeps a bridge to the hub (`cland hook bridge`), submits each
//            message with `$.prompt.submit` (which waits for the session to be idle). Only a turn-start
//            carrying the message's envelope confirms it; `cland hook injected` is submission acceptance.
//   state    the hooks (`cland hook <event>`: SessionStart, UserPromptSubmit, Stop, StopFailure, PermissionRequest,
//            PostToolUse, Notification, Elicitation) and the mod's `turn.start`/`turn.complete` (which also fires on
//            an interrupt, where `Stop` does not) — pushed, reliable; `claude agents --json`, polled, as the fallback.
//   stop     `claude stop <background id>`, then verified process-tree SIGTERM/SIGKILL; the process stays watched until
//            its pid is gone, and a stop that cannot confirm that fails (the row stays running, supervised).
//   resume   re-find the process by its session id or background id in `claude agents --json` (a pid alone
//            never: it may be reused by another process); or relaunch it with `claude --bg --resume <uuid>` and
//            the same flags (they are not restored by the harness).
//
// Not used: the session's inbox socket (its message format is undocumented) and channels (a research preview).
import { sessionRunDirectory } from '../../../shared/session-credential.ts';
import { continueWith, wait, untimed } from './continuations.ts';
import { LaunchFiles } from './launch-files.ts';
import type { Resumed } from '../hub/worktrees.ts';
import { execFile, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Message, SessionState, SessionUsage, TopicRef } from '../protocol.ts';
import { accountPrefix } from '../accounts/registry.ts';
import { addUsage } from './usage.ts';
import { processStarted } from './processes.ts';
import { endProcess } from '../system-processes.ts';
import { turnError } from './turn-error.ts';
import { claudeWindows } from '../accounts/limits.ts';
import { envelope, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type InjectFrame, type Interpretation, type LaunchPolicy, type Permissions, type ResumeResult, type SpawnRequest } from './contract.ts';



export const CLAUDE_CODE = 'claude-code';

/** The cland mod, loaded into every session the adapter launches (`--plugin-dir`). */
export const MOD_DIR = fileURLToPath(new URL('../../mod/cland', import.meta.url));

export const CLAUDE_CODE_CLAUSE_AT_SPAWN = false;

export const CLAUDE_CODE_CAPABILITIES: Capabilities = {
  terminal: 'none',
  // the transcript format is internal to Claude Code and changes between versions
  history: 'none',
  // the mod's `turn.complete` carries the turn's usage and model
  usage: 'reliable',
  // no documented way to switch a running session's model from outside
  setModel: 'none',
  // approvals stay in the harness's TUI in v0 (spec 4.3)
  approvalRelay: 'none',
  states: {
    // UserPromptSubmit and the mod's turn.start
    busy: 'reliable',
    // Stop and the mod's turn.complete (an interrupt included)
    idle: 'reliable',
    // PermissionRequest
    'waiting for approval': 'reliable',
    // AskUserQuestion arrives as a PermissionRequest; Elicitation; agents --json `waitingFor`
    'waiting for human': 'heuristic',
  },
};

/** Keep background sessions in the project's working copy (spec v0.1.4 §3.2). */
export const BG_ISOLATION = 'none';

/** Managed Claude hook events and their CLI handlers, including the local Bash guard. */
export const HOOK_EVENTS: Readonly<Record<string, string>> = {
  PreToolUse: 'literal-rm',
  SessionStart: 'session-start',
  UserPromptSubmit: 'turn-start',
  Stop: 'turn-end',
  StopFailure: 'turn-end',
  PermissionRequest: 'permission',
  PostToolUse: 'tool-done',
  Notification: 'notification',
  Elicitation: 'elicitation',
  SessionEnd: 'session-end',
  SubagentStart: 'subagent-start',
  SubagentStop: 'subagent-stop',
};

/** One entry of `claude agents --json` (agent view, research preview): only the fields cland reads. */
type AgentEntry = { pid?: number; id?: string; sessionId?: string; status?: string; state?: string; waitingFor?: string; cwd?: string };

export type ClaudeCodeOptions = {
  /** Shared hub time for directory polling; native transport deadlines stay real. */
  clock?: Clock;
  /** Process identity fact; production reads the native process start time. */
  processStarted?: (pid: number, resumed?: Resumed) => Promise<string | null>;
  /** Native process liveness boundary; tests supply synthetic process facts. */
  pidAlive?: (pid: number) => boolean;
  /** The `claude` executable: `CLAND_CLAUDE_BIN`, PATH, then the installer folders. */
  bin?: string;
  /** How often the processes' pids are checked (no CLI), ms. */
  pollMs?: number;
  /** Re-exec observation window after a missing PID; default 1 second. Injectable for clock-driven tests. */
  reexecGraceMs?: number;
  /** How long an inject waits for the mod's confirmation before it stays `delivered`, ms. */
  injectTimeoutMs?: number;
  /** Shared agents interval, ms; default 30 seconds. Short values are for fake harnesses. */
  agentsMs?: number;
  /** How long a stop waits for the pid to go, after `claude stop` and again after SIGTERM, ms. */
  stopGraceMs?: number;
  /** The environment the harness is started in (cland's own variables are removed). */
  env?: NodeJS.ProcessEnv;
};

const sq = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/** A signal from `claude agents --json` as a cland state. */
export function stateOfAgent(entry: AgentEntry): SessionState {
  switch (entry.status) {
    case 'busy':
      return 'busy';
    case 'idle':
      return 'idle';
    case 'waiting':
      return entry.waitingFor === 'permission prompt' || entry.waitingFor === 'sandbox request' ? 'waiting for approval' : 'waiting for human';
    default:
      return 'unknown';
  }
}

/** What one hook or mod event means for the session. */
export function interpret(event: string, payload: Record<string, unknown>): Interpretation {
  const ids = (text: unknown): string[] => (typeof text === 'string' ? [...text.matchAll(/msg_id="([^"]+)"/g)].map((m) => m[1] as string) : Array.isArray(payload.ids) ? payload.ids.filter((x): x is string => typeof x === 'string') : []);
  switch (event) {
    case 'mod-measure':
      return { rateLimits: { windows: claudeWindows(payload.rateLimits) } };
    case 'subagent-start': {
      const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input as Record<string, unknown> : undefined;
      const model = typeof payload.model === 'string' && payload.model ? payload.model : input?.model;
      return { subagent: {
        ...(typeof payload.agent_id === 'string' ? { id: payload.agent_id } : {}),
        ...(typeof payload.agent_type === 'string' ? { type: payload.agent_type } : {}),
        ...(typeof model === 'string' && model ? { model } : {}),
      } };
    }
    case 'subagent-stop':
      return {};
    case 'session-start':
      return { state: 'idle', ...(typeof payload.model === 'string' ? { model: payload.model } : {}) };
    case 'turn-start':
    case 'mod-turn-start': {
      const confirms = ids(payload.prompt ?? payload.text);
      return { state: 'busy', ...(confirms.length ? { confirms } : {}) };
    }
    case 'turn-end':
      return { state: 'idle', ...(payload.hook_event_name === 'StopFailure' && payload.error === 'rate_limit' ? { limitHit: { reason: 'rate_limit' } } : {}), ...(payload.hook_event_name === 'StopFailure' || payload.error ? { turnError: turnError(payload.error_details ?? payload.error) } : {}) };
    case 'mod-turn-complete': {
      const usage = typeof payload.usage === 'object' && payload.usage !== null ? (payload.usage as Record<string, unknown>) : undefined;
      return { state: 'idle', ...(usage ? { usage } : {}), ...(usage && typeof usage.model === 'string' ? { model: usage.model } : {}) };
    }
    case 'permission': {
      // The hook CLI forwards the Bash command line, never the rest of its tool input.
      const command = typeof payload.approvalCommand === 'string' ? payload.approvalCommand
        : typeof payload.tool_name === 'string' && payload.tool_name !== 'AskUserQuestion' ? payload.tool_name : undefined;
      return { state: payload.tool_name === 'AskUserQuestion' ? 'waiting for human' : 'waiting for approval', ...(command !== undefined ? { approvalCommand: command } : {}) };
    }
    case 'tool-done':
      return { state: 'busy' };
    case 'elicitation':
      return { state: 'waiting for human' };
    case 'notification':
      if (payload.notification_type === 'idle_prompt') return { state: 'idle' };
      if (payload.notification_type === 'elicitation_dialog') return { state: 'waiting for human' };
      return {};
    default:
      return {};
  }
}

type Pending = { resolve: () => void; reject: (err: Error) => void; timer: ClockTimer };
type Prompt = { messages?: string[]; resolve?: (messages: string[]) => void };
/** Enough recent prompts for delayed hooks; eviction drops uncertain attribution rather than guessing. */
const PROMPT_HISTORY_LIMIT = 64;

type DirectorySchedule = {
  configDir: string; lastAgentsAt: number; signedOut: boolean; signedOutAt: number; signedOutId: string;
  entries: AgentEntry[] | null; agentsVersion: number; agentsFlight: Promise<AgentEntry[] | null> | null;
};
const AUTH_VARIABLES = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'] as const;

export class ClaudeCodeAdapter implements HarnessAdapter {
  readonly harness = CLAUDE_CODE;
  readonly capabilities = CLAUDE_CODE_CAPABILITIES;
  readonly clauseAtSpawn = CLAUDE_CODE_CLAUSE_AT_SPAWN;
  readonly #host: AdapterHost;
  readonly #clock: Clock;
  readonly #bin: string;
  readonly #pollMs: number;
  readonly #injectTimeoutMs: number;
  readonly #agentsMs: number;
  readonly #configDir: string;
  #closed = false;
  #closing: Promise<void> | undefined;
  readonly #commands = new Set<{ cancel: () => void; settled: Promise<void> }>();
  readonly #directories = new Map<string, DirectorySchedule>();
  readonly #stopGraceMs: number;
  readonly #env: NodeJS.ProcessEnv;
  readonly #processEnv: NodeJS.ProcessEnv;
  readonly #processStarted: NonNullable<ClaudeCodeOptions['processStarted']>;
  readonly #pidAlive: (pid: number) => boolean;
  readonly #reexecGraceMs: number;
  readonly #missingSince = new Map<string, number>();
  readonly #reexecTimers = new Map<string, ClockTimer>();
  #polling = false;
  /** Watched processes by session id. */
  readonly #watched = new Map<string, HarnessProcess>();
  /** The mod's bridge of each session: where inject frames go. */
  readonly #bridges = new Map<string, (frame: InjectFrame) => boolean>();
  readonly #pending = new Map<string, Pending>();
  readonly #prompts = new Map<string, Map<string, Prompt>>();
  /** Running totals and the last usage the mod reported, by session id. */
  readonly #usage = new Map<string, SessionUsage>();
  /** Sessions being stopped: still watched, but their exit is the stop's to report. */
  readonly #stopping = new Set<string>();
  #timer: ClockTimer | null = null;

  constructor(host: AdapterHost, options: ClaudeCodeOptions = {}) {
    this.#host = host;
    this.#clock = options.clock ?? realClock;
    this.#processEnv = options.env ?? process.env;
    this.#processStarted = options.processStarted ?? ((pid, resumed) => processStarted(pid, undefined, resumed, undefined, this.#processEnv));
    this.#pidAlive = options.pidAlive ?? pidAlive;
    this.#reexecGraceMs = options.reexecGraceMs ?? 1000;
    this.#bin = options.bin ?? harnessBinary('claude-code', this.#processEnv);
    this.#pollMs = options.pollMs ?? 5000;
    this.#injectTimeoutMs = options.injectTimeoutMs ?? 60_000;
    this.#agentsMs = options.agentsMs ?? 30_000;
    this.#host.log({ event: 'claude-schedule', agentsMs: this.#agentsMs, pollMs: this.#pollMs });
    this.#stopGraceMs = options.stopGraceMs ?? 5000;
    const env: NodeJS.ProcessEnv = {};
    for (const [k, v] of Object.entries(withoutExecutorCredentials(options.env ?? process.env))) if (!k.startsWith('CLAND_') || k === 'CLAND_CLAUDE_BIN') env[k] = v;
    this.#env = env;
    this.#configDir = resolve(env.CLAUDE_CONFIG_DIR || join(env.HOME || homedir(), '.claude'));
    if (env.CLAUDE_CONFIG_DIR) this.#env.CLAUDE_CONFIG_DIR = this.#configDir;
  }

  /**
   * The CLAUDE_CONFIG_DIR a launch passes: the hub's own when it inherited one, else none, so an unpinned session
   * runs on the human's default profile. Claude Code treats any explicit value, even ~/.claude, as a separate
   * profile: signed out and without the project's trust (T-603). An account's directory comes in its accountEnv.
   */
  #inheritedEnv(): Record<string, string> {
    return this.#env.CLAUDE_CONFIG_DIR ? { CLAUDE_CONFIG_DIR: this.#configDir } : {};
  }

  /** `CLAUDE_CONFIG_DIR=<dir> ` when the row's commands run with the variable set, else nothing: the remedies' prefix. */
  #dirPrefix(p: Pick<HarnessProcess, 'accountEnv'>): string {
    const dir = p.accountEnv?.CLAUDE_CONFIG_DIR || this.#env.CLAUDE_CONFIG_DIR;
    return dir ? `CLAUDE_CONFIG_DIR=${sq(resolve(dir))} ` : '';
  }

  /** A row freezes its effective directory: an account's, or the hub's inherited one; the default is the bookkeeping fallback. */
  #directory(p: Pick<HarnessProcess, 'accountEnv'>): DirectorySchedule {
    const configDir = resolve(p.accountEnv?.CLAUDE_CONFIG_DIR || this.#configDir);
    let schedule = this.#directories.get(configDir);
    if (schedule) return schedule;
    schedule = { configDir, lastAgentsAt: 0, signedOut: false, signedOutAt: 0, signedOutId: '', entries: null, agentsVersion: 0, agentsFlight: null };
    const saved = this.#host.adapterState?.read(`claude-poll:${configDir}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        schedule.lastAgentsAt = typeof state.lastAt === 'number' ? state.lastAt : 0;
        schedule.signedOut = state.signedOut === true;
        schedule.signedOutId = typeof state.signedOutId === 'string' ? state.signedOutId : '';
        schedule.signedOutAt = typeof state.signedOutAt === 'number' ? state.signedOutAt : 0;
        schedule.entries = Array.isArray(state.entries) ? state.entries : null;
      } catch { /* Old or invalid state gives the default schedule. */ }
    }
    this.#directories.set(configDir, schedule);
    return schedule;
  }

  // ---------------------------------------------------------------- the harness's CLI

  #run(args: string[], cwd: string, p: Pick<HarnessProcess, 'account' | 'accountEnv'>, timeoutMs = 30_000, resumed: Resumed = untimed, launchToken?: string): Promise<{ code: number; stdout: string; stderr: string }> {
    if (this.#closed) return Promise.reject(new Error('the Claude adapter is closed'));
    const env = withoutExecutorCredentials({ ...this.#env, ...p.accountEnv });
    if (p.account) for (const key of AUTH_VARIABLES) delete env[key];
    let child: ChildProcess | undefined;
    const work = new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
      child = execFile(this.#bin, args, { cwd, env: { ...env, DISABLE_AUTOUPDATER: '1', ...(launchToken ? { CLAND_LAUNCH_TOKEN: launchToken } : {}) }, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => resumed(() => {
        if (err && typeof err.code !== 'number') reject(new Error(`${this.#bin} ${args[0] ?? ''}: ${err.message}`));
        else resolve({ code: err ? (err.code as number) : 0, stdout, stderr });
      }));
    });
    // execFile's callback follows child close and clears its native deadline.
    // Retain ownership through that receipt, including failed commands.
    const command = { cancel: () => { child?.kill('SIGKILL'); }, settled: work.then(() => {}, () => {}) };
    this.#commands.add(command);
    void command.settled.then(() => this.#commands.delete(command));
    return work;
  }

  #saveSchedule(d: DirectorySchedule): void {
    this.#host.adapterState?.write(`claude-poll:${d.configDir}`, JSON.stringify({ lastAt: d.lastAgentsAt, signedOut: d.signedOut, signedOutAt: d.signedOutAt, signedOutId: d.signedOutId, entries: d.entries }));
  }

  #markSignedOut(p: HarnessProcess, at = this.#clock.now().getTime()): void {
    const d = this.#directory(p);
    d.signedOutAt = Math.max(d.signedOutAt, at);
    if (d.signedOut) { this.#saveSchedule(d); return; }
    d.signedOut = true;
    d.signedOutId = randomUUID();
    d.entries = null;
    this.#saveSchedule(d);
    for (const watched of this.#watched.values()) if (this.#directory(watched) === d) this.#host.signal(watched.sessionId, { state: 'unknown', source: 'signed-out', at });
    this.#host.log({ event: 'claude-signed-out', configDir: d.configDir, account: p.account ?? null, login: `${this.#dirPrefix(p)}claude auth login` });
  }

  #recovered(d: DirectorySchedule, at = this.#clock.now().getTime()): void {
    if (!d.signedOut || at < d.signedOutAt) return;
    d.signedOut = false;
    this.#saveSchedule(d);
  }

  #agents(p: HarnessProcess, resumed: Resumed = untimed, refresh = false): Promise<AgentEntry[] | null> {
    const d = this.#directory(p);
    if (this.#closed || d.signedOut || ![...this.#watched.values()].some(watched => this.#directory(watched) === d)) return Promise.resolve(null);
    if (d.agentsFlight) return d.agentsFlight;
    if (!refresh && this.#clock.now().getTime() - d.lastAgentsAt < this.#agentsMs) return Promise.resolve(d.entries);
    d.lastAgentsAt = this.#clock.now().getTime();
    this.#saveSchedule(d);
    d.agentsFlight = continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, AgentEntry[] | null, unknown> {
      try {
        const r = yield* wait(this.#run(['agents', '--json'], this.#host.root, p, 15000, resumed));
        if (this.#closed || d.signedOut) return null;
        const parsed: unknown = r.code === 0 ? JSON.parse(r.stdout) : null;
        d.entries = Array.isArray(parsed) ? (parsed as AgentEntry[]) : null;
        d.agentsVersion++;
        this.#saveSchedule(d);
        return d.entries;
      } catch { d.entries = null; return null; }
      finally {
        d.agentsFlight = null;
        if (!this.#closed) {
          // Count from completion as well as invocation: slow CLI startup cannot shorten
          // the observable 30-second floor, and a restart retains either timestamp.
          d.lastAgentsAt = this.#clock.now().getTime();
          this.#saveSchedule(d);
        }
      }
    }).call(this), resumed);
    return d.agentsFlight;
  }

  /** The entry of this session: by its session id, else its background id. A pid is only a match for an entry
   *  that names no session of its own — pids are reused, and a reused one belongs to another session. */
  #find(entries: AgentEntry[], p: Pick<HarnessProcess, 'sessionId' | 'harnessSessionId' | 'harnessId' | 'pid'>): AgentEntry | undefined {
    return (
      entries.find((e) => e.sessionId === (p.harnessSessionId ?? p.sessionId)) ??
      (p.harnessId ? entries.find((e) => e.id === p.harnessId) : undefined) ??
      (p.pid !== null ? entries.find((e) => e.pid === p.pid && e.sessionId === undefined && e.id === undefined) : undefined)
    );
  }

  // ---------------------------------------------------------------- launch

  /** The command a hook runs: `cland hook <event>` naming the session, its launch and the hub, nothing secret. */
  #hookCommand(event: string, name: string, launch: string): string {
    return [this.#host.node, this.#host.cli, 'hook', event, '--session', name, '--launch', launch, '--hub-file', this.#host.discoveryFile].map(sq).join(' ');
  }

  /** The flags that make a session cland's: the spoke, the hooks, the mod. Given again on a relaunch. `worktree`:
   *  the session's own task worktree, where the harness's own worktrees are refused. */
  async #sessionFlags(name: string, role: string | null, sessionId: string, cwd: string, worktree: string | null, files: LaunchFiles, launchToken?: string): Promise<string[]> {
    const spokeEnv: Record<string, string> = {
      CLAND_HUB_FILE: this.#host.discoveryFile,
      CLAND_SESSION_ID: sessionId,
      CLAND_SESSION_NAME: name,
      // the adapter injects: the spoke only accepts deliveries
      CLAND_DELIVERY: 'adapter',
      // --bg starts a supervised process that does not inherit the launching CLI's environment.
      // The spoke's accepted hello must prove which pending launch owns its brief.
      ...(launchToken ? { CLAND_LAUNCH_TOKEN: launchToken } : {}),
      ...(role ? { CLAND_ROLE: role } : {}),
    };
    const mcp = { mcpServers: { cland: { type: 'stdio', command: this.#host.node, args: [this.#host.spoke], env: spokeEnv } } };
    const hooks: Record<string, unknown[]> = {};
    for (const [hookEvent, event] of Object.entries(HOOK_EVENTS)) {
      // The Bash guard is synchronous: exit 2 refuses the tool. Signals stay async.
      hooks[hookEvent] = [{ ...(hookEvent === 'PreToolUse' ? { matcher: 'Bash' } : {}), hooks: [{ type: 'command', command: this.#hookCommand(event, name, sessionId), ...(hookEvent === 'PreToolUse' ? {} : { async: true }), timeout: 10 }] }];
    }
    // not async: its exit status is the refusal
    if (worktree !== null) hooks.WorktreeCreate = [{ hooks: [{ type: 'command', command: `${this.#hookCommand('worktree-create', name, sessionId)} --worktree ${sq(worktree)}`, timeout: 10 }] }];
    const configuredIsolation = await Promise.all(['settings.json', 'settings.local.json'].map(async file => {
      try {
        const settings = JSON.parse(await readFile(join(cwd, '.claude', file), 'utf8'));
        return Object.hasOwn(settings?.worktree ?? {}, 'bgIsolation');
      } catch { return false; } // Unreadable or malformed files do not set the key.
    }));
    const settings = {
      hooks,
      ...(configuredIsolation.some(Boolean) ? {} : { worktree: { bgIsolation: BG_ISOLATION } }),
      // what the mod reads to find its session and the hub
      env: { DISABLE_AUTOUPDATER: '1', CLAND_SESSION_NAME: name, CLAND_SESSION_ID: sessionId, ...(launchToken ? { CLAND_LAUNCH_TOKEN: launchToken } : {}), CLAND_HUB_FILE: this.#host.discoveryFile, CLAND_NODE: this.#host.node, CLAND_CLI: this.#host.cli },
    };
    // --bg does not retain the launcher's environment. Private settings survive native re-exec;
    // the command line carries only paths, never the session credential.
    const directory = sessionRunDirectory(dirname(this.#host.discoveryFile), sessionId);
    await files.directory(directory, 0o700);
    const mcpFile = join(directory, 'mcp.json');
    const settingsFile = join(directory, 'settings.json');
    await files.file(mcpFile);
    await writeFile(mcpFile, JSON.stringify(mcp), { mode: 0o600 });
    await files.file(settingsFile);
    await writeFile(settingsFile, JSON.stringify(settings), { mode: 0o600 });
    return ['--mcp-config', mcpFile, '--settings', settingsFile, '--plugin-dir', MOD_DIR];
  }

  /** The background id `claude --bg` printed (`claude attach <id>`). */
  static parseBackgroundId(stdout: string): string | null {
    return /claude attach (\S+)/.exec(stdout)?.[1]?.replace(/[`'".,]+$/, '') ?? /\(([0-9a-f]{6,})\)/.exec(stdout)?.[1] ?? /\b([0-9a-f]{8})\b/.exec(stdout)?.[1] ?? null;
  }

  async #launch(p: Omit<HarnessProcess, 'pid' | 'harnessId' | 'startedAt' | 'status'>, resume: boolean, effort: string | null = null, resumed: Resumed = untimed, launchToken?: string, authorize: () => void = () => {}, permissions: Permissions | null = null): Promise<HarnessProcess> {
    return continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, HarnessProcess, unknown> {
      const files = new LaunchFiles(resumed);
      let launched: HarnessProcess | undefined;
      let backgroundStarted = false;
      try {
        const worktree = p.item && p.role !== 'lead' ? p.cwd : null;
        // `--bg` picks its own session id (observed with 2.1.294: `--session-id` is accepted and not used); the
        // spoke and the hub keep cland's id, and the harness's own is recorded as `harnessSessionId`
        const args = [
          '--bg',
          ...(resume ? ['--resume', p.harnessSessionId ?? p.sessionId] : ['--session-id', p.sessionId]),
          '--name',
          p.name,
          ...(p.model ? ['--model', p.model] : []),
          ...(effort ? ['--effort', effort] : []),
          // roles.toml `permissions = "skip"`: the session never stops at a permission prompt or an auto-mode classifier
          ...(permissions === 'skip' ? ['--dangerously-skip-permissions'] : []),
          ...(permissions === 'auto' ? ['--permission-mode', 'auto'] : []),
          ...yield* wait(this.#sessionFlags(p.name, p.role, p.sessionId, p.cwd, worktree, files, launchToken)),
        ];
        authorize();
        const d = this.#directory(p);
        const warning = d.signedOut ? `Claude config directory ${d.configDir} is latched signed out; this explicit launch is a recovery attempt.` : undefined;
        const prefix = this.#dirPrefix(p);
        const remedy = p.account ? `\nAccount ${p.account}, directory ${d.configDir}: sign in with ${prefix}claude auth login, or trust the project once with ${prefix}claude in ${p.cwd}.` : '';
        const r = yield* wait(this.#run(args, p.cwd, p, undefined, resumed, launchToken).catch(error => {
          throw new Error(`${error instanceof Error ? error.message : String(error)}${remedy}`);
        }));
        const harnessId = ClaudeCodeAdapter.parseBackgroundId(r.stdout);
        backgroundStarted = r.code === 0;
        launched = { ...p, pid: null, harnessId, startedAt: new Date().toISOString(), status: 'running', ...(warning ? { warning } : {}) };
        if (r.code !== 0 && /(?:token|oauth|authentication).*(?:expired|expiry)|(?:expired|expiry).*(?:token|oauth|authentication)/i.test(r.stderr + r.stdout)) this.#markSignedOut(launched);
        if (r.code !== 0) throw new Error(`${warning ? `warning: ${warning}\n` : ''}claude --bg failed (exit ${r.code}): ${(r.stderr || r.stdout).trim().slice(0, 500)}${remedy}`);
        this.#recovered(d);
        this.watch(launched);
        this.#host.log({ event: 'harness-launched', harness: this.harness, session: p.name, harnessId, resume, out: r.stdout.trim().slice(0, 300) });
        // the session's process: agent view lists it once its supervisor started it
        const previous = d.agentsVersion;
        const entries = yield* wait(this.#agents(launched, resumed));
        const found = entries && d.agentsVersion > previous ? this.#find(entries, launched) : undefined;
        if (found?.pid !== undefined) {
          launched.pid = found.pid;
          launched.harnessSessionId = found.sessionId ?? p.harnessSessionId;
          launched.pidStarted = yield* wait(this.#processStarted(found.pid, resumed));
        }
        if (launched.pid === null) this.#host.log({ event: 'harness-pid-unknown', harness: this.harness, session: p.name, harnessId });
        files.commit();
        return launched;
      } catch (err) {
        // A successful --bg can own a child even when its output has no parsed id.
        // A failed stop leaves its private files intact with the watched process.
        if (launched && (backgroundStarted || launched.harnessId || launched.pid !== null)) yield* wait(this.stop(launched, resumed));
        yield* wait(files.rollback());
        throw err;
      }
    }).call(this), resumed);
  }

  spawn(request: SpawnRequest, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<HarnessProcess> {
    return this.#launch({ account: request.account ?? null, accountEnv: { ...this.#inheritedEnv(), ...request.accountEnv }, name: request.name, harness: this.harness, role: request.role, model: request.model, cwd: request.cwd, sessionId: request.sessionId ?? randomUUID(), harnessSessionId: request.resumeConversation ?? null, item: request.item ?? null }, request.resumeConversation !== undefined, request.effort ?? null, resumed, request.launchToken, authorize, request.permissions ?? null);
  }

  attachCommand(p: HarnessProcess): string {
    const bin = this.#bin === 'claude' ? 'claude' : sq(this.#bin);
    return (p.account ? accountPrefix(p.accountEnv) : '') + `${bin} attach ${sq(p.harnessId ?? p.name).replace(/^'([\w-]+)'$/, '$1')}`;
  }

  // ---------------------------------------------------------------- inject

  /** The mod's bridge for a session connected; returns its disconnect. */
  bridge(p: HarnessProcess, send: (frame: InjectFrame) => boolean): () => void {
    this.#bridges.set(p.sessionId, send);
    return () => {
      if (this.#bridges.get(p.sessionId) === send) this.#bridges.delete(p.sessionId);
    };
  }

  hasBridge(p: HarnessProcess): boolean {
    return this.#bridges.has(p.sessionId);
  }

  inject(p: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void> {
    const send = this.#bridges.get(p.sessionId);
    if (!send) return Promise.reject(new Error('the cland mod of this session is not connected (the inbox socket is not used: its message format is undocumented)'));
    const key = `${p.sessionId}:${message.id}`;
    const existing = this.#pending.get(key);
    if (existing) {
      this.#clock.clearTimeout(existing.timer);
      existing.reject(new Error('superseded by a retry'));
    }
    return new Promise<void>((resolve, reject) => {
      const timer = this.#clock.setTimeout(() => {
        this.#pending.delete(key);
        reject(new Error(`the mod did not confirm the turn within ${this.#injectTimeoutMs} ms`));
      }, this.#injectTimeoutMs);
      this.#pending.set(key, { resolve, reject, timer });
      if (!send({ type: 'inject', session: p.name, message: message.id, text: envelope(message, topic) })) {
        this.#clock.clearTimeout(timer);
        this.#pending.delete(key);
        reject(new Error("the mod's bridge is closed"));
      }
    });
  }

  confirm(p: HarnessProcess, messageId: string): void {
    const key = `${p.sessionId}:${messageId}`;
    const pending = this.#pending.get(key);
    if (!pending) return;
    this.#pending.delete(key);
    this.#clock.clearTimeout(pending.timer);
    pending.resolve();
  }

  interpret(event: string, payload: Record<string, unknown>, p?: HarnessProcess, at = this.#clock.now().getTime()): Interpretation {
    // Hooks may learn the native conversation before discovery does (including /clear).
    // Sessions persists it; keep the watched launch on that same authoritative identity.
    const watched = p && this.#watched.get(p.sessionId);
    if (watched && typeof payload.session_id === 'string' && payload.session_id) watched.harnessSessionId = payload.session_id;
    const meaning = interpret(event, payload);
    if (p && event === 'turn-end' && payload.hook_event_name === 'StopFailure' && payload.error === 'authentication_failed') {
      this.#markSignedOut(p, at);
      meaning.state = 'unknown';
      const d = this.#directory(p);
      meaning.turnError = `signed out: ${d.configDir}${p.account ? ` (account ${p.account})` : ''}; see the Agents notice`;
      meaning.failureAudience = 'senders';
      meaning.failureDedupe = { key: d.configDir, episode: d.signedOutId };
    } else if (p && (event === 'session-start' || event === 'turn-end') && payload.hook_event_name !== 'StopFailure' && !payload.error) this.#recovered(this.#directory(p), at);
    const id = typeof payload.prompt_id === 'string' ? payload.prompt_id : null;
    if (!p || !id || (event !== 'turn-start' && !meaning.turnError)) return meaning;
    const prompts = this.#prompts.get(p.sessionId) ?? new Map<string, Prompt>();
    this.#prompts.set(p.sessionId, prompts);
    const prompt = prompts.get(id) ?? {};
    prompts.set(id, prompt);
    if (event === 'turn-start') {
      prompt.messages = meaning.confirms ?? [];
      prompt.resolve?.(prompt.messages);
      delete prompt.resolve;
    } else {
      meaning.failureMessages = prompt.messages !== undefined ? Promise.resolve(prompt.messages) : new Promise((resolve) => { prompt.resolve = resolve; });
    }
    while (prompts.size > PROMPT_HISTORY_LIMIT) {
      const oldest = prompts.keys().next().value as string;
      prompts.get(oldest)?.resolve?.([]);
      prompts.delete(oldest);
    }
    return meaning;
  }

  stateReason(p: HarnessProcess): string | null { return this.#directory(p).signedOut ? 'signed-out' : null; }

  noteUsage(p: HarnessProcess, usage: Record<string, unknown>): void {
    // A restarted hub starts with no in-memory total: the row's last report seeds this launch's sum.
    this.#usage.set(p.sessionId, addUsage(this.#usage.get(p.sessionId) ?? p.usage ?? undefined, usage));
  }

  usage(p: HarnessProcess): SessionUsage | null {
    return this.#usage.get(p.sessionId) ?? null;
  }

  forget(sessionId: string): void { this.unwatch(sessionId); this.#usage.delete(sessionId); }

  // ---------------------------------------------------------------- watch: the polled fallback and liveness

  watch(p: HarnessProcess): void {
    this.#watched.set(p.sessionId, p);
    if (!this.#timer) {
      this.#timer = this.#clock.setInterval(() => void this.#poll(), this.#pollMs);
      this.#timer.unref();
    }
  }

  #unwatch(sessionId: string): void {
    this.#clearMissing(sessionId);
    for (const prompt of this.#prompts.get(sessionId)?.values() ?? []) prompt.resolve?.([]);
    this.#prompts.delete(sessionId);
    this.#watched.delete(sessionId);
    if (this.#watched.size === 0 && this.#timer) {
      this.#clock.clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  unwatch(sessionId: string): void {
    this.#unwatch(sessionId);
    this.#bridges.delete(sessionId);
  }

  #clearMissing(sessionId: string): void {
    this.#missingSince.delete(sessionId);
    this.#clock.clearTimeout(this.#reexecTimers.get(sessionId));
    this.#reexecTimers.delete(sessionId);
  }

  async #poll(): Promise<void> {
    if (this.#closed || this.#polling || this.#watched.size === 0) return;
    this.#polling = true;
    try {
      // A supervisor may replace its process while retaining the native conversation.
      // A short grace permits replacement while genuine deaths still publish promptly.
      for (const p of [...this.#watched.values()]) {
        if (this.#stopping.has(p.sessionId)) continue;
        if (p.pid !== null && !this.#pidAlive(p.pid)) {
          if (!this.#missingSince.has(p.sessionId)) {
            this.#missingSince.set(p.sessionId, this.#clock.now().getTime());
            const timer = this.#clock.setTimeout(() => {
              this.#reexecTimers.delete(p.sessionId);
              void this.#poll();
            }, this.#reexecGraceMs);
            timer.unref();
            this.#reexecTimers.set(p.sessionId, timer);
          }
        } else this.#clearMissing(p.sessionId);
      }
      if (this.#watched.size === 0) return;
      const directories = new Map<DirectorySchedule, HarnessProcess>();
      const changedIdentity = new Set<string>();
      for (const p of this.#watched.values()) if (!this.#stopping.has(p.sessionId)) directories.set(this.#directory(p), p);
      await Promise.all([...directories].map(async ([d, representative]) => {
        const conversations = new Map([...this.#watched.values()].filter(p => this.#directory(p) === d).map(p => [p.sessionId, p.harnessSessionId]));
        // Launch/resume can own a bounded query independently of this poll.
        // Settle it before deciding whether grace requires a fresh observation.
        const flight = d.agentsFlight;
        if (flight) await flight;
        const at = this.#clock.now().getTime();
        // A reconnect can follow the last scheduled snapshot. Before releasing
        // ownership, observe native identity once more at the grace boundary.
        const recovery = [...this.#watched.values()].some(p => {
          const since = this.#missingSince.get(p.sessionId);
          return this.#directory(p) === d && since !== undefined && at - since >= this.#reexecGraceMs;
        });
        if (d.signedOut || (!flight && !recovery && at - d.lastAgentsAt < this.#agentsMs)) return;
        const entries = await this.#agents(representative, untimed, recovery);
        for (const p of [...this.#watched.values()]) {
          if (this.#stopping.has(p.sessionId) || this.#directory(p) !== d) continue;
          const entry = entries ? this.#find(entries, p) : undefined;
          if (conversations.has(p.sessionId) && conversations.get(p.sessionId) !== p.harnessSessionId && entry?.sessionId !== p.harnessSessionId) {
            changedIdentity.add(p.sessionId);
            continue;
          }
          if (!entry) continue;
          if (entry.pid !== undefined && entry.pid !== p.pid && this.#pidAlive(entry.pid)
            && ((p.pid === null && p.harnessSessionId === null) || entry.sessionId === (p.harnessSessionId ?? p.sessionId))) {
            const nativeId = p.harnessSessionId, previousPid = p.pid;
            const started = await this.#processStarted(entry.pid);
            // A stop, relaunch or shutdown while probing cannot acquire the old launch's PID.
            if (this.#closed || this.#watched.get(p.sessionId) !== p || this.#stopping.has(p.sessionId)) continue;
            if (p.harnessSessionId !== nativeId || p.pid !== previousPid) {
              // A hook advanced the authoritative conversation during the native probe.
              // Reconcile it on the next bounded poll before any grace-expiry exit.
              changedIdentity.add(p.sessionId);
              continue;
            }
            if (!started || !this.#pidAlive(entry.pid)) continue;
            p.pid = entry.pid;
            p.pidStarted = started;
            p.harnessSessionId = entry.sessionId ?? p.harnessSessionId;
            this.#clearMissing(p.sessionId);
            this.#host.recordPid(p.sessionId, entry.pid, started, entry.sessionId);
          }
          this.#host.signal(p.sessionId, { state: stateOfAgent(entry), source: 'poll', at });
        }
      }));
      for (const p of [...this.#watched.values()]) {
        const since = this.#missingSince.get(p.sessionId);
        if (!changedIdentity.has(p.sessionId) && !this.#stopping.has(p.sessionId) && since !== undefined && this.#clock.now().getTime() - since >= this.#reexecGraceMs
          && p.pid !== null && !this.#pidAlive(p.pid)) {
          this.#unwatch(p.sessionId);
          this.#host.exited(p.sessionId, `pid ${p.pid} is gone after the ${this.#reexecGraceMs}ms re-exec grace`);
        }
      }
    } finally { this.#polling = false; }
  }

  // ---------------------------------------------------------------- stop, resume

  async stop(p: HarnessProcess, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<void> {
    // watched until the process is known to be gone: a stop that fails leaves it supervised
    this.#stopping.add(p.sessionId);
    let ended = false;
    try {
      let stopped = false;
      const cliStop = async () => {
        if (p.harnessId) {
          resumed(authorize);
          try {
            const r = await this.#run(['stop', p.harnessId], p.cwd, p);
            resumed(() => {
              stopped = r.code === 0;
              if (!stopped) this.#host.log({ event: 'harness-stop-failed', session: p.name, out: (r.stderr || r.stdout).trim().slice(0, 300) });
            });
          } catch (err) {
            resumed(() => this.#host.log({ event: 'harness-stop-failed', session: p.name, error: err instanceof Error ? err.message : String(err) }));
          }
        }
      };
      if (p.pid === null) {
        await cliStop();
        if (!stopped) throw new Error(`could not stop "${p.name}": \`claude stop\` failed and its pid is unknown; it is still watched`);
      } else {
        if (!await endProcess(p, (entry) => this.#host.log({ ...entry, harness: this.harness, session: p.name }), this.#stopGraceMs, cliStop, { env: this.#processEnv, resumed, authorize, allowReused: p.status === 'exited' })) throw new Error(`could not stop "${p.name}": its process identity cannot be verified; it is still watched`);
      }
      ended = true;
    } finally {
      resumed(() => {
        if (ended) this.#unwatch(p.sessionId);
        this.#stopping.delete(p.sessionId);
      });
    }
  }

  async resume(p: HarnessProcess, options: { launchToken?: string; relaunch?: boolean; authorize?: () => void; policy?: LaunchPolicy; resumed?: Resumed } = {}): Promise<ResumeResult> {
    return continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, ResumeResult, unknown> {
      const resumed = options.resumed ?? untimed;
      // Pre-T-603 unpinned rows froze the bookkeeping fallback as an explicit profile,
      // which Claude treats as separate from the trusted default. Keep named accounts
      // and richer overlays intact; let a legacy default row inherit today's hub env.
      if (!p.account && p.accountEnv?.CLAUDE_CONFIG_DIR && Object.keys(p.accountEnv).length === 1
        && resolve(p.accountEnv.CLAUDE_CONFIG_DIR) === resolve(this.#env.HOME || homedir(), '.claude')) {
        p.accountEnv = this.#inheritedEnv();
      }
      p.accountEnv ??= this.#inheritedEnv();
      const d = this.#directory(p);
      this.watch(p);
      if (d.signedOut && !options.relaunch) {
        if (p.pid !== null && !pidAlive(p.pid)) {
          this.#unwatch(p.sessionId);
          return { found: false, reason: 'recorded pid is gone (Claude directory is signed out)' };
        }
        return { found: true, process: { ...p, status: 'running' }, state: 'unknown' };
      }
      const previous = d.agentsVersion;
      let entries = (yield* wait(this.#agents(p, resumed))) ?? [];
      // A recent snapshot may predate this launch. Startup discovery waits for the shared
      // slot rather than treating a suppressed query as evidence that the session exited.
      const cached = d.agentsVersion === previous;
      const candidate = this.#find(entries, p);
      if (!d.signedOut && (!candidate || (cached && (!p.pidStarted || p.pid !== candidate.pid))) && this.#clock.now().getTime() - d.lastAgentsAt < this.#agentsMs) {
        yield* wait(new Promise<void>(resolve => this.#clock.setTimeout(resolve, Math.max(1, this.#agentsMs - (this.#clock.now().getTime() - d.lastAgentsAt)))));
        entries = (yield* wait(this.#agents(p, resumed))) ?? [];
      }
      // Authentication may fail while a shared query or the next slot is awaited.
      if (d.signedOut && !options.relaunch) {
        if (p.pid !== null && !pidAlive(p.pid)) {
          this.#unwatch(p.sessionId);
          return { found: false, reason: 'recorded pid is gone (Claude directory is signed out)' };
        }
        return { found: true, process: { ...p, status: 'running' }, state: 'unknown' };
      }
      const entry = this.#find(entries, p);
      const pid = entry?.pid ?? p.pid;
      // the same session: listed under its own session id (or background id), with a live process
      const identity = entry && pid !== null && pid !== undefined && p.pid === pid && p.pidStarted ? yield* wait(this.#processStarted(pid, resumed)) : null;
      if (entry && pid !== null && pid !== undefined && pidAlive(pid) && (!p.pidStarted || p.pid !== pid || identity === p.pidStarted)) {
        const process: HarnessProcess = { ...p, pid, harnessId: p.harnessId ?? entry.id ?? null, harnessSessionId: entry.sessionId ?? p.harnessSessionId, status: 'running' };
        return { found: true, process, state: stateOfAgent(entry) };
      }
      this.#unwatch(p.sessionId);
      if (!options.relaunch) {
        // A directory miss or an unavailable start probe is not proof of exit. A contradictory native
        // identity at this PID *is* proof that it is not ours, even with a same-second start stamp.
        const conflicting = entries.some(e => e.pid === p.pid && e !== entry && (e.sessionId !== undefined || e.id !== undefined));
        const readStarted = entry && p.pid === pid ? async () => identity : this.#processStarted;
        const alive = !conflicting && (yield* wait(processAlive(p, resumed, this.#processEnv, readStarted)));
        return { found: false, reason: entry ? 'listed by claude agents, but its process identity could not be verified' : 'not listed by claude agents --json', alive };
      }
      yield* wait(this.stop(p, options.resumed));
      const process = yield* wait(this.#launch({ account: p.account ?? null, accountEnv: p.accountEnv, name: p.name, harness: p.harness, role: p.role, model: p.model, cwd: p.cwd, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId, item: p.item ?? null }, true, p.effort ?? null, resumed, options.launchToken, options.authorize ?? (() => {}), options.policy?.permissions ?? null));
      return { found: true, process, state: 'unknown' };
    }).call(this), options.resumed ?? untimed);
  }

  close(): void | Promise<void> {
    if (this.#closed) return this.#closing;
    this.#closed = true;
    for (const prompts of this.#prompts.values()) for (const prompt of prompts.values()) prompt.resolve?.([]);
    this.#prompts.clear();
    if (this.#timer) this.#clock.clearInterval(this.#timer);
    this.#timer = null;
    for (const timer of this.#reexecTimers.values()) this.#clock.clearTimeout(timer);
    this.#reexecTimers.clear();
    this.#missingSince.clear();
    this.#watched.clear();
    for (const pending of this.#pending.values()) {
      this.#clock.clearTimeout(pending.timer);
      pending.reject(new Error('the hub is stopping'));
    }
    this.#pending.clear();
    const commands = [...this.#commands];
    for (const command of commands) command.cancel();
    if (commands.length) this.#closing = Promise.all(commands.map(command => command.settled)).then(() => {});
    return this.#closing;
  }
}
