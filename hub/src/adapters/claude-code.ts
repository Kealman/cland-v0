import { deadLoginReason } from '../host/login-signals.ts';
import { memoryFloorDetails } from '../host/agent/memory.ts';
import { generationAdapter } from './generation-adapter.ts';
import { terminalAccountPrefix, writeAttachRecord } from '../host/attach.ts';
import { MissingClaudeGeneration } from '../host/host.ts';
import { claudeBackgroundId } from '../host/agent/claude.ts';
import { hostCommandEnvironment } from '../host/command-environment.ts';
import { LOCAL_MOD_DIR as MOD_DIR } from '../host/launch-layout.ts';
import { isLinuxIdentity } from '../host/process-host.ts';
import { launchGenerationKey, launchOwnerKey } from './launch-generation.ts';
import { withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';
import { harnessBinary } from '../doctor/harnesses.ts';
import { realClock, type Clock, type ClockTimer } from '../hub/clock.ts';
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
import { createHash } from 'node:crypto';
import { continueWith, wait, untimed } from './continuations.ts';
import { LaunchFiles, FailedLaunches } from './launch-files.ts';
import { boundedSettlement, type LaunchSettled } from './launch-settlement.ts';
import type { Host } from '../host/host.ts';
import type { Resumed } from '../hub/worktrees.ts';
import { claudeLocalHost } from './claude-code-local.ts';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import type { Message, SessionState, SessionUsage, TopicRef } from '../protocol.ts';
import { accountPrefix } from '../accounts/registry.ts';
import { addUsage } from './usage.ts';
import { turnError } from './turn-error.ts';
import { claudeWindows } from '../accounts/limits.ts';
import { envelope, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type InjectFrame, type Interpretation, type Permissions, type ResumeResult, type ResumeOptions, type SpawnRequest } from './contract.ts';



export const CLAUDE_CODE = 'claude-code';

/** The cland mod, loaded into every session the adapter launches (`--plugin-dir`). */
export { LOCAL_MOD_DIR as MOD_DIR } from '../host/launch-layout.ts';

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

type FailedClaudeGeneration={generation:string;process:HarnessProcess;privateDirectory:string;previousGeneration:string|null;previousDirectory?:string;phase:'prepared'|'launching'|'settled';attempts?:number;nativeConfirmed?:boolean};
type TerminalSettlement={generation:string;attempts:number;cause:string};
/** One entry of `claude agents --json` (agent view, research preview): only the fields cland reads. */
type AgentEntry = { pid?: number; id?: string; sessionId?: string; status?: string; state?: string; waitingFor?: string; cwd?: string };

export type ClaudeCodeOptions = {
  /** Shared hub time for directory polling; native transport deadlines stay real. */
  clock?: Clock;
  /** Process identity fact; production reads the native process start time. */
  processStarted?: (pid: number, resumed?: Resumed) => Promise<string | null>;
  processIdentity?: (pid: number) => Promise<string | null>;
  /** Legacy local fixture observers; never override a non-local Host. Production uses Host operations. */
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
  local: boolean; configDir: string; lastAgentsAt: number; signedOut: boolean; signedOutAt: number; signedOutId: string;
  observedLaunches: Map<string, { process: HarnessProcess; job: string | null }>; observationRevision: number; entries: AgentEntry[] | null; agentsVersion: number; agentsFlight: Promise<AgentEntry[] | null> | null;
};
const AUTH_VARIABLES = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'] as const;

type ClaudeLaunch = Omit<HarnessProcess, 'pid' | 'harnessId' | 'startedAt' | 'status'>;

type SharedDirectoryState = {
  schedules: Map<string, DirectorySchedule>;
  watched: Set<HarnessProcess>;
  revision: number;
  signal: AdapterHost['signal'];
};

export class ClaudeCodeAdapter implements HarnessAdapter {
  declare releaseUnreachableGeneration: NonNullable<HarnessAdapter['releaseUnreachableGeneration']>;
  readonly harness = CLAUDE_CODE;
  readonly relaunchStopsProcess = true;
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
  readonly #nativeInspections = new Map<string, Promise<import('./contract.ts').NativeJobInspection>>();
  readonly #commands = new Set<{ cancel: () => void; settled: Promise<void> }>();
  readonly #directories = new Map<string, DirectorySchedule>();
  readonly #stopGraceMs: number;
  readonly #env: NodeJS.ProcessEnv;
  readonly #processEnv: NodeJS.ProcessEnv;
  readonly #local: Host;
  readonly #syntheticProcesses: boolean;
  readonly #reexecGraceMs: number;
  readonly #missingSince = new Map<string, number>();
  readonly #reexecTimers = new Map<string, ClockTimer>();
  #polling = false;
  #pollFlight: Promise<void> | undefined;
  readonly #resumes = new Set<Promise<ResumeResult>>();
  readonly #recoveries:FailedLaunches;
  readonly #failedGenerations=new Map<string,FailedClaudeGeneration>();
  readonly #launchSettlements=new Map<string,LaunchSettled>();
  readonly #settlementWriters=new Set<Promise<void>>();
  readonly #launchCleanups = new Map<string, { process: HarnessProcess; files: LaunchFiles; error?: unknown }>();
  readonly #resumeWaits = new Map<ClockTimer, () => void>();
  /** Watched processes by session id. */
  readonly #watched = new Map<string, HarnessProcess>();
  /** The mod's bridge of each session: where inject frames go. */
  readonly #releasedStops = new Set<string>();
  readonly #forgets = new Map<string, () => Promise<void>>();
  readonly #confirmedStops = new Set<string>();
  readonly #releases = new Map<string, () => Promise<void>>();
  readonly #launches = new Set<Promise<HarnessProcess>>();
  readonly #terminalSettlements = new Map<string,TerminalSettlement>();
  readonly #stopFailures = new Map<string,string>();
  readonly #launchDirectories = new Map<string, string>();
  readonly #bridges = new Map<string, { send: (frame: InjectFrame) => boolean; generation: string | null }>();
  readonly #pending = new Map<string, Pending>();
  readonly #prompts = new Map<string, Map<string, Prompt>>();
  readonly #approvalWaits = new Map<string, { key: string; agent: string | undefined; prompt: string | undefined; tool: string | undefined; command: string | undefined }>();
  /** Running totals and the last usage the mod reported, by session id. */
  readonly #usage = new Map<string, SessionUsage>();
  /** Sessions being stopped: still watched, but their exit is the stop's to report. */
  readonly #stopping = new Set<string>();
  /** Directory-confirmed launches; an initial discovery miss is not retirement. */
  readonly #listed = new Set<string>();
  readonly #directoryState: SharedDirectoryState;
  readonly #activity = new Map<string, { revision: number; pendingIdentity?: true }>();
  #timer: ClockTimer | null = null;

  constructor(host: AdapterHost, options: ClaudeCodeOptions = {}, generationScope = false, directoryState?: SharedDirectoryState) {
    this.#host = host;
    this.#directoryState = directoryState ?? { schedules: new Map(), watched: new Set(), revision: 0, signal: host.signal };
    this.#recoveries=new FailedLaunches(host.log,1000,host.durableLaunchRecovery);
    this.#clock = options.clock ?? realClock;
    this.#processEnv = options.env ?? process.env;
    this.#syntheticProcesses = !!(options.processStarted || options.processIdentity || options.pidAlive);
    this.#local = claudeLocalHost(options, entry => { if (!this.#closed) this.#host.log(entry); });
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
    const Adapter = new.target;
    if (!generationScope) return generationAdapter(this, host, scoped => new Adapter(scoped, options, true, this.#directoryState));
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

  /** Local rows share a directory schedule; nonlocal discovery belongs to one session.
   * A row freezes its effective directory: an account's, or the hub's inherited one; the default is the bookkeeping fallback. */
  #directory(p: Pick<HarnessProcess, 'accountEnv' | 'host' | 'sessionId'>): DirectorySchedule {
    const configDir = resolve(p.accountEnv?.CLAUDE_CONFIG_DIR || this.#configDir);
    const key = (p.host ?? 'local') === 'local' ? configDir : JSON.stringify([p.host, p.sessionId, configDir]);
    const schedules = (p.host ?? 'local') === 'local' ? this.#directoryState.schedules : this.#directories;
    let schedule = schedules.get(key);
    if (schedule) return schedule;
    schedule = { local: (p.host ?? 'local') === 'local', configDir, lastAgentsAt: 0, signedOut: false, signedOutAt: 0, signedOutId: '', observedLaunches: new Map(), observationRevision: 0, entries: null, agentsVersion: 0, agentsFlight: null };
    const saved = (p.host ?? 'local') === 'local' ? this.#host.adapterState?.read(`claude-poll:${configDir}`) : null;
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
    schedules.set(key, schedule);
    return schedule;
  }

  // ---------------------------------------------------------------- the harness's CLI

  #machine(p: HarnessProcess | ClaudeLaunch): Host {
    const selected = 'status' in p ? this.#host.hostForProcess?.(p) : this.#host.hostForLaunch?.(p);
    // Preserve the existing synthetic standalone/component process seam. It never
    // overrides a non-local Host; production supplies no synthetic observers.
    return selected && !(selected.name === 'local' && this.#syntheticProcesses) ? selected : this.#local;
  }

  #pidAlive(p: HarnessProcess, pid: number): Promise<boolean> { return this.#machine(p).alive((p.host ?? 'local') !== 'local' && p.pid === pid ? p : { pid }); }

  #run(args: string[], cwd: string, p: HarnessProcess | ClaudeLaunch, timeoutMs = 30_000, resumed: Resumed = untimed, launchToken?: string, cleanup = false): Promise<{ code: number; stdout: string; stderr: string }> {
    if (this.#closed && !cleanup) return Promise.reject(new Error('the Claude adapter is closed'));
    const env = withoutExecutorCredentials({ ...this.#env, ...p.accountEnv });
    if (p.account) for (const key of AUTH_VARIABLES) delete env[key];
    const controller = new AbortController();
    const machine = this.#machine(p);
    const commandInput = { command: this.#bin, args, cwd, env: hostCommandEnvironment(machine, env, { ...(machine.name === 'local' ? {} : p.accountEnv), DISABLE_AUTOUPDATER: '1', ...(launchToken && machine.name === 'local' ? { CLAND_LAUNCH_TOKEN: launchToken } : {}) }), timeoutMs, signal: controller.signal };
    const generation=this.#launchDirectories.get(p.sessionId);
    const work = (args[0]==='--bg' && machine.launchClaude && generation ? machine.launchClaude(commandInput,basename(generation)) : machine.run(commandInput)).then(r => resumed(() => {
      if (r.error || r.code === null) throw new Error(`${this.#bin} ${args[0] ?? ''}: ${r.error ?? 'command ended without an exit code'}`);
      return { code: r.code, stdout: r.stdout, stderr: r.stderr };
    }));
    const command = { cancel: () => controller.abort(), settled: work.then(() => {}, () => {}) };
    this.#commands.add(command);
    void command.settled.then(() => this.#commands.delete(command));
    return work;
  }

  #saveSchedule(d: DirectorySchedule): void {
    if (!d.local) return;
    this.#host.adapterState?.write(`claude-poll:${d.configDir}`, JSON.stringify({ lastAt: d.lastAgentsAt, signedOut: d.signedOut, signedOutAt: d.signedOutAt, signedOutId: d.signedOutId, entries: d.entries }));
  }

  #markSignedOut(p: HarnessProcess, at = this.#clock.now().getTime()): void {
    if (this.#closed) return;
    const d = this.#directory(p);
    d.signedOutAt = Math.max(d.signedOutAt, at);
    if (d.signedOut) { this.#saveSchedule(d); return; }
    d.signedOut = true;
    d.signedOutId = randomUUID();
    d.entries = null;
    this.#saveSchedule(d);
    for (const watched of (d.local ? this.#directoryState.watched : this.#watched.values())) if (this.#directory(watched) === d) this.#directoryState.signal(watched.sessionId, { state: 'unknown', source: 'signed-out', at });
    this.#host.log({ event: 'claude-signed-out', configDir: d.configDir, account: p.account ?? null, login: `${this.#dirPrefix(p)}claude auth login` });
  }

  #recovered(d: DirectorySchedule, at = this.#clock.now().getTime()): void {
    if (this.#closed) return;
    if (!d.signedOut || at < d.signedOutAt) return;
    d.signedOut = false;
    this.#saveSchedule(d);
  }

  #agents(p: HarnessProcess, resumed: Resumed = untimed, refresh = false): Promise<AgentEntry[] | null> {
    const d = this.#directory(p);
    if (this.#closed || d.signedOut || ![...(d.local ? this.#directoryState.watched : this.#watched.values())].some(watched => this.#directory(watched) === d)) return Promise.resolve(null);
    if (d.agentsFlight) return d.agentsFlight;
    if (!refresh && this.#clock.now().getTime() - d.lastAgentsAt < this.#agentsMs) return Promise.resolve(d.entries);
    d.lastAgentsAt = this.#clock.now().getTime();
    this.#saveSchedule(d);
    d.agentsFlight = continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, AgentEntry[] | null, unknown> {
      try {
        d.observationRevision = this.#directoryState.revision;
        d.observedLaunches = new Map([...(d.local ? this.#directoryState.watched : this.#watched.values())].filter(w => this.#directory(w) === d).map(w => [w.sessionId, { process: w, job: w.harnessId }]));
        const r = yield* wait(this.#run(['agents', '--json'], this.#host.root, p, 15000, resumed));
        if (this.#closed || d.signedOut) return null;
        const parsed: unknown = r.code === 0 ? JSON.parse(r.stdout) : null;
        d.entries = Array.isArray(parsed) ? (parsed as AgentEntry[]) : null;
        d.agentsVersion++;
        this.#saveSchedule(d);
        return d.entries;
      } catch { if (!this.#closed) d.entries = null; return null; }
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

  /** Current evidence needs a new invocation after this boundary, not completion of an older query. */
  async #agentsAfterCurrent(p: HarnessProcess, resumed: Resumed, authorize: () => void, boundary: 'stop' | 'hook' | 'launch', cleanup = false): Promise<AgentEntry[] | null> {
    const earlier = this.#directory(p).agentsFlight;
    if (earlier) {
      this.#host.log({ event: `harness-${boundary}-await-query`, session: p.name, harnessId: p.harnessId });
      await earlier;
    }
    resumed(authorize);
    if (cleanup && this.#closed) {
      try {
        const result = await this.#run(['agents', '--json'], this.#host.root, p, 15000, resumed, undefined, true);
        const entries: unknown = result.code === 0 ? JSON.parse(result.stdout) : null;
        return Array.isArray(entries) ? entries as AgentEntry[] : null;
      } catch { return null; }
    }
    // Any flight admitted while the earlier one drained was invoked after this
    // evidence request, and is safe to share. Otherwise this invokes that new query.
    return this.#agents(p, resumed, true);
  }

  /** The entry of this session: by its session id, else its background id. A pid is only a match for an entry
   *  that names no session of its own — pids are reused, and a reused one belongs to another session. */
  #find(entries: AgentEntry[], p: Pick<HarnessProcess, 'sessionId' | 'harnessSessionId' | 'harnessId' | 'pid'>): AgentEntry | undefined {
    return (
      (p.harnessId ? entries.find((e) => e.id === p.harnessId) : undefined) ??
      entries.find((e) => e.sessionId === (p.harnessSessionId ?? p.sessionId)) ??
      (p.pid !== null ? entries.find((e) => e.pid === p.pid && e.sessionId === undefined && e.id === undefined) : undefined)
    );
  }

  /** Fresh remote PID proof belongs only to the captured native owner. */
  #ownsCandidate(p: HarnessProcess, entry: AgentEntry): boolean {
    if ((p.host ?? 'local') === 'local') return true;
    return (p.harnessId ? entry.id === p.harnessId : entry.sessionId === (p.harnessSessionId ?? p.sessionId))
      && (p.harnessSessionId === null || entry.sessionId === p.harnessSessionId);
  }

  /** Terminal observations belong to the admitted job, even when conversations are shared. */
  #job(entries: AgentEntry[], p: HarnessProcess): AgentEntry | undefined {
    return p.harnessId ? entries.find(e => e.id === p.harnessId) : this.#find(entries, p);
  }

  // ---------------------------------------------------------------- launch

  /** The command a hook runs: `cland hook <event>` naming the session, its launch and the hub, nothing secret. */
  #hookCommand(event: string, name: string, launch: string, layout: ReturnType<Host['layout']>): string {
    return [layout.node, layout.cli, 'hook', event, '--session', name, '--launch', launch, '--hub-file', layout.discoveryFile].map(sq).join(' ');
  }

  /** The flags that make a session cland's: the spoke, the hooks, the mod. Given again on a relaunch. `worktree`:
   *  the session's own task worktree, where the harness's own worktrees are refused. */
  async #sessionFlags(name: string, role: string | null, sessionId: string, cwd: string, worktree: string | null, files: LaunchFiles, launchToken?: string, machine: Host = this.#local): Promise<string[]> {
    const layout = machine.layout(this.#host);
    const modDir = layout.modDir ?? (machine.name === 'local' ? MOD_DIR : undefined);
    if (!modDir) throw new Error('remote layout has no mod directory yet');
    const launchId = randomUUID();
    const spokeEnv: Record<string, string> = {
      CLAND_LAUNCH_ID: launchId,
      CLAND_HUB_FILE: layout.discoveryFile,
      CLAND_SESSION_ID: sessionId,
      CLAND_SESSION_NAME: name,
      // the adapter injects: the spoke only accepts deliveries
      CLAND_DELIVERY: 'adapter',
      // --bg starts a supervised process that does not inherit the launching CLI's environment.
      // The spoke's accepted hello must prove which pending launch owns its brief.
      ...(launchToken ? { CLAND_LAUNCH_TOKEN: launchToken } : {}),
      ...(role ? { CLAND_ROLE: role } : {}),
    };
    const mcp = { mcpServers: { cland: { type: 'stdio', command: layout.node, args: [layout.spoke], env: spokeEnv } } };
    const hooks: Record<string, unknown[]> = {};
    for (const [hookEvent, event] of Object.entries(HOOK_EVENTS)) {
      // The Bash guard is synchronous: exit 2 refuses the tool. Signals stay async.
      hooks[hookEvent] = [{ ...(hookEvent === 'PreToolUse' ? { matcher: 'Bash' } : {}), hooks: [{ type: 'command', command: this.#hookCommand(event, name, launchId, layout), ...(hookEvent === 'PreToolUse' ? {} : { async: true }), timeout: 10 }] }];
    }
    // not async: its exit status is the refusal
    if (worktree !== null) hooks.WorktreeCreate = [{ hooks: [{ type: 'command', command: `${this.#hookCommand('worktree-create', name, launchId, layout)} --worktree ${sq(worktree)}`, timeout: 10 }] }];
    const configuredIsolation = await Promise.all(['settings.json', 'settings.local.json'].map(async file => {
      try {
        const settings = JSON.parse(Buffer.from(await machine.readFile(join(cwd, '.claude', file))).toString('utf8'));
        return Object.hasOwn(settings?.worktree ?? {}, 'bgIsolation');
      } catch { return false; } // Unreadable or malformed files do not set the key.
    }));
    const settings = {
      hooks,
      ...(configuredIsolation.some(Boolean) ? {} : { worktree: { bgIsolation: BG_ISOLATION } }),
      // what the mod reads to find its session and the hub
      env: { CLAND_LAUNCH_ID: launchId, DISABLE_AUTOUPDATER: '1', CLAND_SESSION_NAME: name, CLAND_SESSION_ID: sessionId, ...(launchToken ? { CLAND_LAUNCH_TOKEN: launchToken } : {}), CLAND_HUB_FILE: layout.discoveryFile, CLAND_NODE: layout.node, CLAND_CLI: layout.cli },
    };
    // --bg does not retain the launcher's environment. Private settings survive native re-exec;
    // the command line carries only paths, never the session credential.
    const directory = join(layout.runDirectory, 'sessions', createHash('sha256').update(sessionId).digest('hex'), launchId);
    const writer=machine.name==='local'?files:new LaunchFiles(files.resumed,machine);
    await writer.directory(directory,0o700);
    if(machine.name!=='local'){this.#launchDirectories.set(sessionId,directory);this.#setGeneration(sessionId,launchId);}
    const mcpFile = join(directory, 'mcp.json');
    const settingsFile = join(directory, 'settings.json');
    await writer.write(mcpFile, Buffer.from(JSON.stringify(mcp)), 0o600);
    await writer.write(settingsFile, Buffer.from(JSON.stringify(settings)), 0o600);
    if(machine.name!=='local')writer.commit();
    this.#setGeneration(sessionId, launchId);
    return ['--mcp-config', mcpFile, '--settings', settingsFile, '--plugin-dir', modDir];
  }

  #cleanupKey(p:HarnessProcess):string {return JSON.stringify([p.sessionId,p.harnessId,p.pidIdentity,p.startedAt,this.#host.adapterState?.read(launchGenerationKey(p.sessionId)),this.#launchDirectories.get(p.sessionId)]);}
  #rememberAdoption(p:HarnessProcess,receipt:Awaited<ReturnType<NonNullable<Host['adopt']>>>):HarnessProcess {
    const process={...p,...receipt.process,harnessId:receipt.job,harnessSessionId:receipt.session};
    if(receipt.release)this.#releases.set(p.sessionId,receipt.release);
    if(receipt.forget)this.#forgets.set(p.sessionId,receipt.forget);
    if(receipt.released)this.#releasedStops.add(this.#cleanupKey(process));
    return process;
  }

  #saveFailedGeneration(record:FailedClaudeGeneration):void {
    this.#host.adapterState?.write('claude-failed:'+record.process.sessionId,JSON.stringify(record));
    this.#failedGenerations.set(record.process.sessionId,record);
  }
  #failedGeneration(sessionId:string,metadataOnly=false):FailedClaudeGeneration|undefined {
    const active=this.#failedGenerations.get(sessionId);if(active)return active;
    const saved=this.#host.adapterState?.read('claude-failed:'+sessionId);if(!saved)return;
    try {
      const record=JSON.parse(saved) as FailedClaudeGeneration;
      if(record.process.sessionId===sessionId&&record.process.harness===this.harness&&/^[a-f0-9-]{36}$/.test(record.generation)
        && ['prepared','launching','settled'].includes(record.phase)
        && (record.phase!=='prepared'||record.process.pid===null&&record.process.harnessId===null)
        && basename(record.privateDirectory)===record.generation&&basename(dirname(record.privateDirectory))===createHash('sha256').update(sessionId).digest('hex')
        && (metadataOnly||record.privateDirectory===join(this.#machine(record.process).layout(this.#host).runDirectory,'sessions',createHash('sha256').update(sessionId).digest('hex'),record.generation)))return record;
    }catch{}
    throw new Error('Claude cleanup-incomplete: failed generation state unavailable');
  }
  settleFailedLaunch(p:HarnessProcess):void|Promise<void> {
    if((p.host??'local')==='local')return;
    return this.#failedSettlement(p)();
  }
  #failedSettlement(p:HarnessProcess):LaunchSettled {
    const record=this.#failedGeneration(p.sessionId);
    if(!record||(record.process.host??'local')!==(p.host??'local'))throw new Error('Claude cleanup-incomplete: failed generation state missing or mismatched');
    const generation=this.#host.adapterState?.read(launchGenerationKey(p.sessionId));
    if(generation!==undefined&&generation!==null&&generation!==record.generation&&!(record.phase==='settled'&&generation===(record.previousGeneration??'')))throw new Error('Claude cleanup-incomplete: failed generation changed');
    const key=p.sessionId+':'+record.generation,active=this.#launchSettlements.get(key);if(active)return active;
    const finish=boundedSettlement(()=>{
      const work=Promise.resolve().then(async()=>{
        if(record.phase==='settled')return;
        this.#saveFailedGeneration(record);
        const machine=this.#machine(record.process);
        this.#launchDirectories.set(p.sessionId,record.privateDirectory);
        if(record.phase==='launching'){
          if(!machine.adopt)throw new Error('Claude cleanup-incomplete: adoption unavailable');
          let adopted:Awaited<ReturnType<NonNullable<Host['adopt']>>>;
          try{adopted=await machine.adopt(record.generation);}catch(error){
            if(!(error instanceof MissingClaudeGeneration)||error.generation!==record.generation||this.#host.adapterState?.read('claude-cleanup:'+p.sessionId)!==record.generation)throw error;
            await error.forget();adopted={process:{pid:null},job:'',session:'',released:true};
          }
          if(adopted.process.pid!==null){
            record.process=this.#rememberAdoption(record.process,adopted);this.#saveFailedGeneration(record);
            if(record.nativeConfirmed)this.#confirmedStops.add(this.#cleanupKey(record.process));
            if(!record.nativeConfirmed&&!adopted.released){
              if((record.attempts??0)>=2)throw new Error('Claude cleanup-incomplete: failed-launch native settlement retry exhausted');
              record.attempts=(record.attempts??0)+1;this.#saveFailedGeneration(record);
            }
            await this.#stop(record.process,untimed,()=>{},true,Date.now()+this.#stopGraceMs,true);
          }
        }else{
          for(const file of ['mcp.json','settings.json'])await machine.removePath(join(record.privateDirectory,file)).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});
          await machine.removePath(record.privateDirectory,{directory:true}).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});
        }
        this.#saveFailedGeneration({...record,phase:'settled',process:{...record.process,accountEnv:null}});
        this.#setGeneration(p.sessionId,record.previousGeneration??'');
        if(record.previousDirectory)this.#launchDirectories.set(p.sessionId,record.previousDirectory);else this.#launchDirectories.delete(p.sessionId);
        this.#host.adapterState?.write('claude-cleanup:'+p.sessionId,'');
      });
      this.#settlementWriters.add(work);void work.then(()=>this.#settlementWriters.delete(work),()=>this.#settlementWriters.delete(work));return work;
    });
    this.#launchSettlements.set(key,finish);return finish;
  }

  #setGeneration(sessionId: string, generation: string): void {
    if (this.#host.launchGeneration) this.#host.launchGeneration(sessionId, generation);
    else {
      this.#host.adapterState?.write(launchGenerationKey(sessionId), generation);
      if (generation) this.#host.adapterState?.write(launchOwnerKey(generation), sessionId);
    }
    this.#bridges.delete(sessionId);
  }

  /** The background id `claude --bg` printed (`claude attach <id>`). */
  static parseBackgroundId(stdout: string): string | null {
    return claudeBackgroundId(stdout);
  }

  async #launch(p: ClaudeLaunch, resume: boolean, effort: string | null = null, resumed: Resumed = untimed, launchToken?: string, authorize: () => void = () => {}, permissions: Permissions | null = null): Promise<HarnessProcess> {
    return continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, HarnessProcess, unknown> {
      const files = new LaunchFiles(resumed, this.#host.hostForLaunch?.(p));
      let launched: HarnessProcess | undefined;
      let backgroundStarted = false;
      let attempted=false;
      const previousDirectory=this.#launchDirectories.get(p.sessionId);
      const previousGeneration = this.#host.adapterState?.read(launchGenerationKey(p.sessionId));
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
          ...yield* wait(this.#sessionFlags(p.name, p.role, p.sessionId, p.cwd, worktree, files, launchToken, this.#machine(p))),
        ];
        authorize();
        const d = this.#directory(p);
        const warning = d.signedOut ? `Claude config directory ${d.configDir} is latched signed out; this explicit launch is a recovery attempt.` : undefined;
        const prefix = this.#dirPrefix(p);
        const remedy = p.account ? `\nAccount ${p.account}, directory ${d.configDir}: sign in with ${prefix}claude auth login, or trust the project once with ${prefix}claude in ${p.cwd}.` : '';
        if(this.#machine(p).name!=='local')this.#saveFailedGeneration({generation:basename(this.#launchDirectories.get(p.sessionId)!),process:{...p,pid:null,harnessId:null,startedAt:new Date().toISOString(),status:'running'},privateDirectory:this.#launchDirectories.get(p.sessionId)!,previousGeneration:previousGeneration??null,...(previousDirectory?{previousDirectory}:{}),phase:'launching'});
        attempted=true;
        const r = yield* wait(this.#run(args, p.cwd, p, undefined, resumed, launchToken).catch(error => {
          if(memoryFloorDetails(error))throw error;
          throw Object.assign(new Error(`${error instanceof Error ? error.message : String(error)}${remedy}`),{code:(error as NodeJS.ErrnoException).code});
        }));
        const harnessId = ClaudeCodeAdapter.parseBackgroundId(r.stdout);
        backgroundStarted = r.code === 0;
        launched = { ...p, pid: null, harnessId, startedAt: new Date().toISOString(), status: 'running', ...(warning ? { warning } : {}) };
        if (r.code !== 0 && /(?:token|oauth|authentication).*(?:expired|expiry)|(?:expired|expiry).*(?:token|oauth|authentication)/i.test(r.stderr + r.stdout)) this.#markSignedOut(launched);
        if (r.code !== 0) throw new Error(`${warning ? `warning: ${warning}\n` : ''}claude --bg failed (exit ${r.code}): ${(r.stderr || r.stdout).trim().slice(0, 500)}${remedy}`);
        if (this.#closed && !this.#machine(launched).adopt) throw new Error('the Claude adapter is closed');
        this.#recovered(d);
        if(!this.#closed)this.watch(launched);
        this.#host.log({ event: 'harness-launched', harness: this.harness, session: p.name, harnessId, resume, out: r.stdout.trim().slice(0, 300) });
        // the session's process: agent view lists it once its supervisor started it
        const previous = d.agentsVersion;
        const machine=this.#machine(launched);
        const adopted=machine.adopt && machine.launchClaude ? yield* wait(machine.adopt(basename(this.#launchDirectories.get(p.sessionId)!))) : undefined;
        if(adopted)Object.assign(launched,this.#rememberAdoption(launched,adopted));
        const entries = adopted ? null : yield* wait((launched.host ?? 'local') === 'local'
          ? this.#agents(launched, resumed)
          : this.#agentsAfterCurrent(launched, resumed, authorize, 'launch'));
        const found = entries && d.agentsVersion > previous ? this.#find(entries, launched) : undefined;
        if (entries && this.#job(entries, launched)) this.#listed.add(launched.sessionId);
        if (found?.pid !== undefined) {
          launched.pid = found.pid;
          launched.harnessSessionId = found.sessionId ?? p.harnessSessionId;
          const proof = yield* wait(this.#machine(launched).identity(found.pid));
          launched.pidStarted = proof?.pidStarted ?? null;
          launched.pidIdentity = proof?.pidIdentity ?? null;
        }
        if (launched.pid === null) this.#host.log({ event: 'harness-pid-unknown', harness: this.harness, session: p.name, harnessId });
        if (this.#closed) throw new Error('the Claude adapter is closed');
        yield* wait(writeAttachRecord(machine, machine.layout(this.#host).runDirectory, launched, this.attachCommand(launched, true), files));
        files.commit();
        if(this.#machine(p).name!=='local'){this.#host.adapterState?.write('claude-failed:'+p.sessionId,'');this.#failedGenerations.delete(p.sessionId);}
        return launched;
      } catch (err) {
        const directory=this.#launchDirectories.get(p.sessionId);
        if(this.#machine(p).name!=='local'&&directory&&directory!==previousDirectory){
          const previous=this.#failedGeneration(p.sessionId);
          const record=(previous?.generation===basename(directory)?previous:undefined)??{generation:basename(directory),process:launched??{...p,pid:null,harnessId:null,startedAt:new Date().toISOString(),status:'running'},privateDirectory:directory,previousGeneration:previousGeneration??null,...(previousDirectory?{previousDirectory}:{}),phase:attempted?'launching' as const:'prepared' as const};
          if(launched)record.process={...launched};
          if(!launched&&!backgroundStarted&&((err as NodeJS.ErrnoException).code==='CLAND_AGENT_ADMISSION_REFUSED'||memoryFloorDetails(err)))record.phase='prepared';
          try{this.#saveFailedGeneration(record);}catch(checkpoint){this.#failedGenerations.set(p.sessionId,record);err=new Error('Claude cleanup-incomplete: failed generation checkpoint unavailable',{cause:checkpoint});}
          const finish:LaunchSettled=()=>this.#failedSettlement(record.process)();
          return yield* wait(this.#recoveries.failed(p.sessionId,p.name,files,err,finish));
        }
        if((err as NodeJS.ErrnoException).code==='CLAND_NATIVE_INCOMPLETE'){
          this.#launchCleanups.set(p.sessionId,{process:launched??{...p,pid:null,harnessId:null,startedAt:new Date().toISOString(),status:'running'},files,error:err});
          throw err;
        }
        // Retain the accepted native launch and its files until both native stop
        // and rollback complete, including when shutdown interrupted discovery.
        if (launched && (backgroundStarted || launched.harnessId || launched.pid !== null)) {
          const cleanup = { process: launched, files };
          this.#launchCleanups.set(p.sessionId, cleanup);
          try {
            yield* wait(this.#stop(launched, resumed, () => {}, true));
            this.#setGeneration(p.sessionId, previousGeneration ?? '');
            yield* wait(files.rollback());
            this.#launchCleanups.delete(p.sessionId);
            if(previousDirectory)this.#launchDirectories.set(p.sessionId,previousDirectory);else this.#launchDirectories.delete(p.sessionId);
          } catch (error) {
            this.#launchCleanups.set(p.sessionId, { ...cleanup, error });
            throw error;
          }
        } else {
          this.#setGeneration(p.sessionId, previousGeneration ?? '');
          yield* wait(files.rollback());
          if(previousDirectory)this.#launchDirectories.set(p.sessionId,previousDirectory);else this.#launchDirectories.delete(p.sessionId);
        }
        throw err;
      }
    }).call(this), resumed);
  }

  spawn(request: SpawnRequest, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<HarnessProcess> {
    const work = this.#launch({ ...(request.host !== undefined ? { host: request.host } : {}), account: request.account ?? null, accountEnv: { ...((this.#host.hostForLaunch?.(request)?.name ?? request.host ?? 'local') === 'local' ? this.#inheritedEnv() : {}), ...request.accountEnv }, name: request.name, harness: this.harness, role: request.role, model: request.model, cwd: request.cwd, sessionId: request.sessionId ?? randomUUID(), harnessSessionId: request.resumeConversation ?? null, item: request.item ?? null }, request.resumeConversation !== undefined, request.effort ?? null, resumed, request.launchToken, authorize, request.permissions ?? null);
    this.#launches.add(work);
    void work.then(()=>this.#launches.delete(work),()=>this.#launches.delete(work));
    return work;
  }

  nativeSessionHint(p: HarnessProcess, result?: import('./contract.ts').NativeJobInspection): void {
    if (result?.kind === 'unavailable') return;
    this.#noteActivity(p.sessionId, result === undefined);
  }

  #noteActivity(sessionId: string, pendingIdentity = false): void {
    this.#activity.set(sessionId, { revision: ++this.#directoryState.revision, ...(pendingIdentity ? { pendingIdentity: true as const } : {}) });
  }

  duplicateHarness(p: HarnessProcess, nativeId: string): Promise<import('./contract.ts').NativeJobInspection> {
    const key = JSON.stringify([p.sessionId, p.harnessId, p.startedAt, this.#host.adapterState?.read(launchGenerationKey(p.sessionId)), nativeId]);
    const existing = this.#nativeInspections.get(key);
    if (existing) return existing;
    const work = this.#agentsAfterCurrent(p, untimed, () => {}, 'hook').then(entries => {
      const other = entries?.find(e => e.sessionId === nativeId && e.id && e.id !== p.harnessId);
      const own = entries?.find(e => e.id === p.harnessId);
      if (own && other?.id) return { kind: 'duplicate' as const, job: { id: other.id, pid: other.pid ?? null } };
      return own?.sessionId === nativeId ? { kind: 'same-job' as const } : { kind: 'unavailable' as const };
    }).finally(() => { this.#nativeInspections.delete(key); });
    this.#nativeInspections.set(key, work);
    return work;
  }

  attachCommand(p: HarnessProcess, terminal = false): string {
    const bin = this.#bin === 'claude' ? 'claude' : sq(this.#bin);
    return (terminal ? terminalAccountPrefix(p.accountEnv) : p.account ? accountPrefix(p.accountEnv) : '') + (terminal ? 'exec ' : '') + `${bin} attach ${sq(p.harnessId ?? p.name).replace(/^'([\w-]+)'$/, '$1')}`;
  }

  // ---------------------------------------------------------------- inject

  /** The mod's bridge for a session connected; returns its disconnect. */
  bridge(p: HarnessProcess, send: (frame: InjectFrame) => boolean): () => boolean {
    const bridge = { send, generation: this.#host.adapterState?.read(launchGenerationKey(p.sessionId)) ?? null };
    this.#bridges.set(p.sessionId, bridge);
    return () => {
      const current = this.#bridges.get(p.sessionId) === bridge;
      if (current) this.#bridges.delete(p.sessionId);
      return current;
    };
  }

  #currentBridge(p: HarnessProcess) {
    const bridge = this.#bridges.get(p.sessionId);
    if (bridge && bridge.generation !== (this.#host.adapterState?.read(launchGenerationKey(p.sessionId)) ?? null)) {
      this.#bridges.delete(p.sessionId);
      return undefined;
    }
    return bridge;
  }

  hasBridge(p: HarnessProcess): boolean {
    return this.#currentBridge(p) !== undefined;
  }

  inject(p: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void> {
    const send = this.#currentBridge(p)?.send;
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

  interpret(event: string, payload: Record<string, unknown>, p?: HarnessProcess, at = this.#clock.now().getTime(), stateCurrent = true): Interpretation {
    // Hooks may learn the native conversation before discovery does (including /clear).
    // Sessions persists it; keep the watched launch on that same authoritative identity.
    const watched = p && this.#watched.get(p.sessionId);
    if (watched && typeof payload.session_id === 'string' && payload.session_id) watched.harnessSessionId = payload.session_id;
    const meaning = interpret(event, payload);
    if (p && stateCurrent) {
      const pending = this.#approvalWaits.get(p.sessionId);
      const agent = typeof payload.agent_id === 'string' ? payload.agent_id : undefined;
      const prompt = typeof payload.prompt_id === 'string' ? payload.prompt_id : undefined;
      const tool = typeof payload.tool_use_id === 'string' ? payload.tool_use_id : undefined;
      if (event === 'permission' && meaning.state === 'waiting for approval') {
        const key = JSON.stringify([agent ?? null, tool ?? prompt ?? null]);
        this.#approvalWaits.set(p.sessionId, { key, agent, prompt, tool, command: meaning.approvalCommand });
        meaning.approvalPrompt = key;
      } else if (pending) {
        const sameOwner = pending.agent ? agent === pending.agent : !agent;
        const resolved = event === 'session-end' || sameOwner && (
          event === 'subagent-stop' || event === 'tool-done' && (pending.tool ? tool === pending.tool : !pending.prompt || prompt === pending.prompt)
          || (event === 'turn-start' || event === 'turn-end') && (!pending.prompt || prompt === pending.prompt));
        if (resolved) {
          this.#approvalWaits.delete(p.sessionId);
          if (!meaning.state) meaning.state = event === 'session-end' ? 'unknown' : 'busy';
        }
        else if (meaning.state) {
          meaning.state = 'waiting for approval';
          if (pending.command !== undefined) meaning.approvalCommand = pending.command;
          meaning.approvalPrompt = pending.key;
        }
      }
    }
    if (watched && meaning.state) this.#noteActivity(watched.sessionId);
    const dead = p && (p.host ?? 'local') !== 'local' && event === 'turn-end' && payload.hook_event_name === 'StopFailure' ? deadLoginReason(this.harness, payload) : undefined;
    if (p && dead) this.#host.loginDead?.(p.sessionId, {reason:dead});
    if (p && (p.host ?? 'local') === 'local' && event === 'turn-end' && payload.hook_event_name === 'StopFailure' && payload.error === 'authentication_failed') {
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

  stateReason(p: HarnessProcess): string | null {
    const terminal=this.#terminal(p);
    const failure=terminal?.cause??this.#stopFailure(p);
    return failure ? `cleanup-incomplete: ${failure}` : this.#directory(p).signedOut ? 'signed-out' : null;
  }

  noteUsage(p: HarnessProcess, usage: Record<string, unknown>): void {
    // A restarted hub starts with no in-memory total: the row's last report seeds this launch's sum.
    this.#usage.set(p.sessionId, addUsage(this.#usage.get(p.sessionId) ?? p.usage ?? undefined, usage));
  }

  usage(p: HarnessProcess): SessionUsage | null {
    return this.#usage.get(p.sessionId) ?? null;
  }

  forget(sessionId: string): void {
    const record=this.#failedGeneration(sessionId,true);
    if(record){
      const current=this.#host.adapterState?.read(launchGenerationKey(sessionId));
      if(record.phase!=='settled'||current!=null&&current!==record.generation&&current!==(record.previousGeneration??''))return;
      this.#host.adapterState?.write('claude-failed:'+sessionId,'');
      this.#failedGenerations.delete(sessionId);this.#launchSettlements.delete(sessionId+':'+record.generation);
    }
    this.unwatch(sessionId);this.#usage.delete(sessionId);
  }

  // ---------------------------------------------------------------- watch: the polled fallback and liveness

  watch(p: HarnessProcess): void {
    const previous = this.#watched.get(p.sessionId);
    if (previous) this.#directoryState.watched.delete(previous);
    this.#watched.set(p.sessionId, p);
    if ((p.host ?? 'local') === 'local') this.#directoryState.watched.add(p);
    if (!this.#timer) {
      this.#timer = this.#clock.setInterval(() => void this.#poll(), this.#pollMs);
      this.#timer.unref();
    }
  }

  #unwatch(sessionId: string): void {
    this.#clearMissing(sessionId);
    for (const prompt of this.#prompts.get(sessionId)?.values() ?? []) prompt.resolve?.([]);
    this.#prompts.delete(sessionId);
    this.#approvalWaits.delete(sessionId);
    const watched = this.#watched.get(sessionId);
    if (watched) this.#directoryState.watched.delete(watched);
    this.#watched.delete(sessionId);
    this.#listed.delete(sessionId);
    this.#activity.delete(sessionId);
    for (const d of this.#directories.values()) d.observedLaunches.delete(sessionId);
    if (this.#watched.size === 0 && this.#timer) {
      this.#clock.clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  unwatch(sessionId: string): void {
    this.#unwatch(sessionId);
    this.#bridges.delete(sessionId);
    for (const [key, pending] of this.#pending) if (key.startsWith(`${sessionId}:`)) {
      this.#pending.delete(key);
      this.#clock.clearTimeout(pending.timer);
      pending.reject(new Error('native launch ended before turn confirmation'));
    }
  }

  #clearMissing(sessionId: string): void {
    this.#missingSince.delete(sessionId);
    this.#clock.clearTimeout(this.#reexecTimers.get(sessionId));
    this.#reexecTimers.delete(sessionId);
  }

  #poll(): Promise<void> {
    if (this.#pollFlight) return this.#pollFlight;
    const flight = this.#pollOnce();
    this.#pollFlight = flight;
    void flight.finally(() => { if (this.#pollFlight === flight) this.#pollFlight = undefined; }).catch(() => {});
    return flight;
  }

  async #pollOnce(): Promise<void> {
    if (this.#closed || this.#polling || this.#watched.size === 0) return;
    this.#polling = true;
    try {
      // A supervisor may replace its process while retaining the native conversation.
      // A short grace permits replacement while genuine deaths still publish promptly.
      for (const p of [...this.#watched.values()]) {
        if (this.#stopping.has(p.sessionId)||this.#terminal(p)||this.#stopFailure(p)) continue;
        const pid = p.pid;
        const alive = pid === null || await this.#pidAlive(p, pid);
        if (this.#closed || this.#watched.get(p.sessionId) !== p || this.#stopping.has(p.sessionId) || p.pid !== pid) continue;
        if (!alive) {
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
      // Subscription logins on other hosts must never run a CLI from a timer.
      for (const p of this.#watched.values()) if ((p.host ?? 'local') === 'local' && !this.#stopping.has(p.sessionId)) directories.set(this.#directory(p), p);
      await Promise.all([...directories].map(async ([d, representative]) => {
        const conversations = new Map([...this.#watched.values()].filter(p => this.#directory(p) === d).map(p => [p.sessionId, p.harnessSessionId]));
        // Launch/resume can own a bounded query independently of this poll.
        // Settle it before deciding whether grace requires a fresh observation.
        const version = d.agentsVersion;
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
          if (this.#closed || this.#stopping.has(p.sessionId) || this.#directory(p) !== d || !conversations.has(p.sessionId)) continue;
          const observed = d.observedLaunches.get(p.sessionId);
          if (observed?.process !== p || observed.job !== p.harnessId) {
            changedIdentity.add(p.sessionId);
            this.#host.log({ event: 'claude-observation-stale', session: p.name, reason: 'launch-replaced' });
            continue;
          }
          // The same activity owner distinguishes unproven conversation changes
          // from ordinary hooks, which must still allow verified PID discovery.
          if (this.#activity.get(p.sessionId)?.pendingIdentity) {
            changedIdentity.add(p.sessionId);
            continue;
          }
          const entry = entries ? this.#find(entries, p) : undefined;
          if (conversations.has(p.sessionId) && conversations.get(p.sessionId) !== p.harnessSessionId && entry?.sessionId !== p.harnessSessionId) {
            changedIdentity.add(p.sessionId);
            continue;
          }
          // Only a completed successful native query can retire a job. Cached,
          // failed and signed-out observations carry no terminal authority.
          const missingSince = this.#missingSince.get(p.sessionId);
          const job = entries ? this.#job(entries, p) : undefined;
          const matchingDone = job?.status === 'done';
          // Newer hooks fence terminal/state authority, not independently verified PID acquisition.
          let newerHook = (this.#activity.get(p.sessionId)?.revision ?? 0) > d.observationRevision;
          if (newerHook) changedIdentity.add(p.sessionId);
          const replacing = missingSince !== undefined && at - missingSince < this.#reexecGraceMs;
          // Native discovery can omit a live job; retain its PID for reconnect and explicit stop.
          const disappeared = !job && this.#listed.has(p.sessionId) && (p.pid === null || !await this.#pidAlive(p, p.pid));
          if (this.#closed || this.#watched.get(p.sessionId) !== p || this.#stopping.has(p.sessionId)) continue;
          if (p.harnessId !== observed.job) continue;
          newerHook ||= (this.#activity.get(p.sessionId)?.revision ?? 0) > d.observationRevision;
          if (newerHook) changedIdentity.add(p.sessionId);
          if (!newerHook && entries && d.agentsVersion > version && !replacing && (matchingDone || disappeared)) {
            this.#unwatch(p.sessionId);
            this.#host.exited(p.sessionId, job ? 'Claude background job reports done' : 'Claude background job disappeared from agents --json', 'retired');
            continue;
          }
          if (!entry || matchingDone) continue;
          if (job) this.#listed.add(p.sessionId);
          if (entry.pid !== undefined && entry.pid !== p.pid && this.#ownsCandidate(p, entry) && ((p.host ?? 'local') !== 'local' || await this.#pidAlive(p, entry.pid))
            && ((p.pid === null && p.harnessSessionId === null) || entry.sessionId === (p.harnessSessionId ?? p.sessionId))) {
            if (this.#closed || this.#watched.get(p.sessionId) !== p || this.#stopping.has(p.sessionId)) continue;
            const nativeId = p.harnessSessionId, previousPid = p.pid;
            const proof = await this.#machine(p).identity(entry.pid);
            const started = proof?.pidStarted;
            const identity = proof?.pidIdentity ?? null;
            // A stop, relaunch or shutdown while probing cannot acquire the old launch's PID.
            if (this.#closed || this.#watched.get(p.sessionId) !== p || this.#stopping.has(p.sessionId)) continue;
            if (p.harnessSessionId !== nativeId || p.pid !== previousPid || p.harnessId !== observed.job || this.#activity.get(p.sessionId)?.pendingIdentity) {
              // A hook or watch replacement advanced the identity during the native probe.
              // Reconcile it on the next bounded poll before any grace-expiry exit.
              changedIdentity.add(p.sessionId);
              this.#host.log({ event: 'claude-observation-stale', session: p.name, reason: 'identity-changed-during-probe' });
              continue;
            }
            const candidate = (p.host ?? 'local') === 'local' ? p : { ...p, pid: entry.pid, pidStarted: started ?? null, pidIdentity: identity };
            if (((p.host ?? 'local') === 'local' ? !started : !isLinuxIdentity(identity)) || !await this.#pidAlive(candidate, entry.pid)) continue;
            if (this.#closed || this.#watched.get(p.sessionId) !== p || this.#stopping.has(p.sessionId) || p.harnessSessionId !== nativeId || p.pid !== previousPid || p.harnessId !== observed.job || this.#activity.get(p.sessionId)?.pendingIdentity) continue;
            p.pid = entry.pid;
            p.pidStarted = started ?? null;
            p.pidIdentity = identity;
            p.harnessSessionId = entry.sessionId ?? p.harnessSessionId;
            this.#clearMissing(p.sessionId);
            this.#host.recordPid(p.sessionId, entry.pid, started ?? null, entry.sessionId, identity);
          }
          if ((this.#activity.get(p.sessionId)?.revision ?? 0) <= d.observationRevision) this.#host.signal(p.sessionId, { state: this.#approvalWaits.has(p.sessionId) ? 'waiting for approval' : stateOfAgent(entry), source: 'poll', at });
        }
      }));
      for (const p of [...this.#watched.values()]) {
        const since = this.#missingSince.get(p.sessionId);
        const pid = p.pid;
        if (!this.#closed && !this.#terminal(p) && !this.#stopFailure(p) && !changedIdentity.has(p.sessionId) && !this.#stopping.has(p.sessionId) && since !== undefined && this.#clock.now().getTime() - since >= this.#reexecGraceMs
          && pid !== null && !await this.#pidAlive(p, pid)) {
          if (this.#closed || this.#watched.get(p.sessionId) !== p || this.#stopping.has(p.sessionId) || p.pid !== pid) continue;
          const detail=`pid ${p.pid} is gone after the ${this.#reexecGraceMs}ms re-exec grace`;
          if((p.host??'local')!=='local'&&this.#machine(p).adopt)await this.#settleTerminal(p,detail);
          else {this.#unwatch(p.sessionId);this.#host.exited(p.sessionId,detail);}
        }
      }
    } finally { this.#polling = false; }
  }

  #stopFailure(p:HarnessProcess):string|null|undefined {return this.#stopFailures.get(this.#cleanupKey(p))??this.#host.adapterState?.read(this.#stopFailureKey(p));}
  #stopFailureKey(p:HarnessProcess):string {return 'claude-stop-failure:'+p.sessionId+':'+(this.#host.adapterState?.read(launchGenerationKey(p.sessionId))??this.#cleanupKey(p));}

  #terminal(p:HarnessProcess):TerminalSettlement|undefined {
    const active=this.#terminalSettlements.get(this.#cleanupKey(p));if(active)return active;
    const generation=this.#host.adapterState?.read(launchGenerationKey(p.sessionId));
    try {
      const record=JSON.parse(this.#host.adapterState?.read('claude-terminal:'+p.sessionId)??'null') as TerminalSettlement|null;
      if(record&&record.generation===generation&&Number.isInteger(record.attempts)&&record.attempts>0&&typeof record.cause==='string')return record;
    }catch{/* A malformed marker grants no native authority. */}
    return undefined;
  }

  /** One terminal event owns cleanup; the only automatic retry is re-adopt
   * on the next hub start. Timers never retry native commands. */
  async #settleTerminal(p:HarnessProcess,detail:string,recovery=false):Promise<void> {
    const key=this.#cleanupKey(p),previous=this.#terminal(p);
    if(previous&&!recovery)return;
    if(previous&&previous.attempts>=2)throw new Error(`Claude cleanup-incomplete: ${previous.cause}`);
    const record:TerminalSettlement={generation:this.#host.adapterState?.read(launchGenerationKey(p.sessionId))??basename(this.#launchDirectories.get(p.sessionId)??''),attempts:(previous?.attempts??0)+1,cause:'terminal settlement pending'};
    const retain=()=>{this.#terminalSettlements.set(key,record);this.#host.adapterState?.write('claude-terminal:'+p.sessionId,JSON.stringify(record));};
    retain();
    try {
      await this.#stop(p,untimed,()=>{},true,Date.now()+this.#stopGraceMs);
      this.#terminalSettlements.delete(key);
      if(!recovery)this.#host.exited(p.sessionId,detail);
    } catch(error) {
      record.cause=error instanceof Error?error.message:String(error);retain();
      this.#host.signal(p.sessionId,{state:'unknown',source:'cleanup-incomplete',at:this.#clock.now().getTime()});
      this.#host.log({event:'harness-cleanup-incomplete',session:p.name,generation:record.generation,error:record.cause});
      if(recovery)throw error;
    }
  }

  // ---------------------------------------------------------------- stop, resume

  stop(p: HarnessProcess, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<void> {
    return this.#stop(p, resumed, authorize);
  }

  async #stop(p: HarnessProcess, resumed: Resumed = untimed, authorize: () => void = () => {}, cleanup = false, deadline?:number, retainCheckpoint=false): Promise<void> {
    // watched until the process is known to be gone: a stop that fails leaves it supervised
    this.#stopping.add(p.sessionId);
    let ended = false;
    const settlement=this.#cleanupKey(p),failureKey=this.#stopFailureKey(p);
    try {
      if(!this.#confirmedStops.has(settlement)&&!this.#releasedStops.has(settlement)){
      let stopped = false;
      let attempted = false;
      const remaining=()=>{const ms=deadline===undefined?undefined:deadline-Date.now();if(ms!==undefined&&ms<=0)throw new Error('Claude terminal settlement deadline exceeded');return ms;};
      const cliStop = async () => {
        if (p.harnessId) {
          attempted = true;
          resumed(authorize);
          try {
            const r = await this.#run(['stop', p.harnessId], p.cwd, p, remaining(), resumed, undefined, cleanup);
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
        if ((p.host ?? 'local') !== 'local') throw new Error(`could not stop "${p.name}": its process identity cannot be verified; it is still watched`);
        await cliStop();
      } else {
        let reason = '';
        const endedProcess = await this.#machine(p).stop(p, { log: (entry) => {
          if (typeof entry.reason === 'string') reason = entry.reason;
          this.#host.log({ ...entry, harness: this.harness, session: p.name });
        }, graceMs: this.#stopGraceMs, ...((p.host ?? 'local') === 'local' || !this.#machine(p).adopt ? { beforeSignal: cliStop } : {}), authorize: () => resumed(authorize), allowReused: p.status === 'exited' });
        if (!attempted && (endedProcess || (p.host ?? 'local') === 'local')) await cliStop();
        if (!endedProcess) throw new Error(`could not stop "${p.name}": its process identity cannot be verified; it is still watched${reason ? ` (${reason})` : ''}`);
      }
      if (!stopped) {
        // OS exit cannot settle a supervised native job: its daemon can respawn it.
        // A failed stop is releasable only after a fresh successful job listing
        // positively confirms the captured job absent.
        const confirmAbsent=async():Promise<AgentEntry[]|null>=>{
          try {
            const result=await this.#run(['agents','--json'],p.cwd,p,remaining(),resumed,undefined,cleanup);
            const parsed:unknown=result.code===0?JSON.parse(result.stdout):null;
            return Array.isArray(parsed)?parsed as AgentEntry[]:null;
          }catch{return null;}
        };
        const entries=p.harnessId?(deadline===undefined?await this.#agentsAfterCurrent(p,resumed,authorize,'stop',cleanup):await confirmAbsent()):null;
        if (!entries || entries.some(entry => entry.id === p.harnessId)) {
          throw new Error(`could not stop "${p.name}": native job stop is unconfirmed; it is still watched`);
        }
      }
      this.#confirmedStops.add(settlement);
      }
      const failure=this.#failedGeneration(p.sessionId);
      if(failure&&failure.phase!=='settled'&&!failure.nativeConfirmed){failure.nativeConfirmed=true;this.#saveFailedGeneration(failure);}
      await this.#releases.get(p.sessionId)?.();
      this.#releases.delete(p.sessionId);
      this.#releasedStops.add(settlement);
      if ((p.host ?? 'local') !== 'local') {
        const machine = this.#machine(p);
        const generation = this.#host.adapterState?.read(launchGenerationKey(p.sessionId));
        const directory = this.#launchDirectories.get(p.sessionId) ?? (generation && /^[a-f0-9-]{36}$/.test(generation)
          ? join(machine.layout(this.#host).runDirectory, 'sessions', createHash('sha256').update(p.sessionId).digest('hex'), generation) : undefined);
        if (directory) {
          for (const file of ['mcp.json', 'settings.json']) await machine.removePath(join(directory, file)).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
          await machine.removePath(directory, { directory: true }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
        }
      }
      const forget=this.#forgets.get(p.sessionId);
      if(forget){
        const generation=this.#host.adapterState?.read(launchGenerationKey(p.sessionId));
        if(generation)this.#host.adapterState?.write('claude-cleanup:'+p.sessionId,generation);
        await forget();
        if(generation&&!retainCheckpoint)this.#host.adapterState?.write('claude-cleanup:'+p.sessionId,'');
      }
      this.#forgets.delete(p.sessionId);this.#launchDirectories.delete(p.sessionId);this.#releasedStops.delete(settlement);
      this.#confirmedStops.delete(settlement);
      this.#terminalSettlements.delete(settlement);
      this.#stopFailures.delete(settlement);this.#host.adapterState?.write(failureKey,'');
      this.#host.adapterState?.write('claude-terminal:'+p.sessionId,'');
      ended = true;
    } catch(error) {
      if((p.host??'local')!=='local'){
        const cause=error instanceof Error?error.message:String(error);
        this.#stopFailures.set(settlement,cause);this.#host.adapterState?.write(failureKey,cause);
        this.#host.signal(p.sessionId,{state:'unknown',source:'cleanup-incomplete',at:this.#clock.now().getTime()});
      }
      throw error;
    } finally {
      resumed(() => {
        if (ended) this.unwatch(p.sessionId);
        this.#stopping.delete(p.sessionId);
      });
    }
  }

  async resume(p: HarnessProcess, options: ResumeOptions = {}): Promise<ResumeResult> {
    const completion = Promise.withResolvers<ResumeResult>();
    this.#resumes.add(completion.promise);
    void completion.promise.then(() => this.#resumes.delete(completion.promise), () => this.#resumes.delete(completion.promise));
    const continuation: Resumed = work => (options.resumed ?? untimed)(() => {
      if (this.#closed) throw new Error('the Claude adapter is closed');
      return work();
    });
    void continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, ResumeResult, unknown> {
      const resumed = options.resumed ?? untimed;
      // Pre-T-603 unpinned rows froze the bookkeeping fallback as an explicit profile,
      // which Claude treats as separate from the trusted default. Keep named accounts
      // and richer overlays intact; let a legacy default row inherit today's hub env.
      if (!p.account && p.accountEnv?.CLAUDE_CONFIG_DIR && Object.keys(p.accountEnv).length === 1
        && resolve(p.accountEnv.CLAUDE_CONFIG_DIR) === resolve(this.#env.HOME || homedir(), '.claude')) {
        p.accountEnv = (p.host ?? 'local') === 'local' ? this.#inheritedEnv() : {};
      }
      p.accountEnv ??= (p.host ?? 'local') === 'local' ? this.#inheritedEnv() : {};
      const d = this.#directory(p);
      this.watch(p);
      const remote = (p.host ?? 'local') !== 'local';
      const machine=this.#machine(p),generation=this.#host.adapterState?.read(launchGenerationKey(p.sessionId));
      if(remote && machine.adopt && generation){
        let adopted:Awaited<ReturnType<NonNullable<Host['adopt']>>>;
        try{adopted=yield* wait(machine.adopt(generation));}catch(error){
          if(!(error instanceof MissingClaudeGeneration)||error.generation!==generation||this.#host.adapterState?.read('claude-cleanup:'+p.sessionId)!==generation)throw error;
          yield* wait(error.forget());this.#host.adapterState?.write('claude-cleanup:'+p.sessionId,'');
          this.#stopFailures.delete(this.#cleanupKey(p));this.#host.adapterState?.write(this.#stopFailureKey(p),'');
          this.#host.adapterState?.write('claude-terminal:'+p.sessionId,'');this.unwatch(p.sessionId);
          return {found:false,alive:false,reason:'Claude confirmed private cleanup completed after recovery'};
        }
        const recovered=this.#rememberAdoption(p,adopted);
        if(!options.relaunch&&this.#stopFailure(p)&&!this.#terminal(p)&&!adopted.released){
          return {found:false,alive:true,reason:'Claude cleanup-incomplete; explicit re-stop required'};
        }
        if(adopted.closed && !options.relaunch){
          yield* wait(this.#terminal(recovered)?this.#settleTerminal(recovered,'',true):this.stop(recovered,resumed,options.authorize));
          return {found:false,alive:false,reason:'Claude native cleanup completed after recovery'};
        }
      }
      const owner = { pid: p.pid, job: p.harnessId, conversation: p.harnessSessionId };
      const checkOwner = () => {
        if (remote && (this.#watched.get(p.sessionId) !== p || this.#stopping.has(p.sessionId) || p.pid !== owner.pid || p.harnessId !== owner.job || p.harnessSessionId !== owner.conversation || this.#activity.get(p.sessionId)?.pendingIdentity)) throw new Error('Claude session changed while resuming');
      };
      if (d.signedOut && !options.relaunch) {
        if (p.pid !== null && !(yield* wait(this.#pidAlive(p, p.pid)))) {
          this.#unwatch(p.sessionId);
          return { found: false, reason: 'recorded pid is gone (Claude directory is signed out)' };
        }
        return { found: true, process: { ...p, status: 'running' }, state: 'unknown' };
      }
      if (options.relaunch) {
        yield* wait(this.stop(p, resumed, options.authorize));
        const current = resumed(() => options.stopped?.()) ?? p;
        const process = yield* wait(this.#launch({ ...current }, true, current.effort ?? null, resumed, options.launchToken, options.authorize, options.policy?.permissions ?? null));
        return { found: true, process, state: 'unknown' };
      }
      const previous = d.agentsVersion;
      let entries = (yield* wait(this.#agents(p, resumed, remote))) ?? [];
      // A recent snapshot may predate this launch. Startup discovery waits for the shared
      // slot rather than treating a suppressed query as evidence that the session exited.
      const cached = d.agentsVersion === previous;
      const candidate = this.#find(entries, p);
      if (!remote && !d.signedOut && (!candidate || (cached && (!p.pidStarted || p.pid !== candidate.pid))) && this.#clock.now().getTime() - d.lastAgentsAt < this.#agentsMs) {
        yield* wait(new Promise<void>(resolve => {
          const done = () => { this.#resumeWaits.delete(timer); resolve(); };
          const timer = this.#clock.setTimeout(done, Math.max(1, this.#agentsMs - (this.#clock.now().getTime() - d.lastAgentsAt)));
          this.#resumeWaits.set(timer, done);
        }));
        entries = (yield* wait(this.#agents(p, resumed))) ?? [];
      }
      // Authentication may fail while a shared query or the next slot is awaited.
      if (d.signedOut && !options.relaunch) {
        if (p.pid !== null && !(yield* wait(this.#pidAlive(p, p.pid)))) {
          this.#unwatch(p.sessionId);
          return { found: false, reason: 'recorded pid is gone (Claude directory is signed out)' };
        }
        return { found: true, process: { ...p, status: 'running' }, state: 'unknown' };
      }
      checkOwner();
      const entry = this.#find(entries, p);
      const pid = entry?.pid ?? p.pid;
      // the same session: listed under its own session id (or background id), with a live process
      const proof = entry && this.#ownsCandidate(p, entry) && pid !== null && pid !== undefined ? yield* wait(this.#machine(p).identity(pid)) : null;
      const identity = proof?.pidStarted ?? null;
      const birth = proof?.pidIdentity ?? null;
      checkOwner();
      const candidateProcess = remote && pid !== p.pid ? { ...p, pid: pid ?? null, pidStarted: identity, pidIdentity: birth } : p;
      const candidateAlive = entry && this.#ownsCandidate(p, entry) && pid !== null && pid !== undefined && (yield* wait(this.#pidAlive(candidateProcess, pid)));
      checkOwner();
      if (candidateAlive && entry && pid !== null && pid !== undefined && (!p.pidStarted || p.pid !== pid || identity === p.pidStarted) && (!p.pidIdentity || p.pid !== pid || birth === p.pidIdentity)) {
        const machine=this.#machine(p),generation=this.#host.adapterState?.read(launchGenerationKey(p.sessionId));
        if(remote && machine.adopt && generation){
          const adopted=yield* wait(machine.adopt(generation));
          this.#rememberAdoption(p,adopted);
          if(adopted.process.pid!==pid || adopted.process.pidIdentity!==birth || adopted.job!==p.harnessId || adopted.session!==entry.sessionId)throw new Error('Claude resumed worker does not match its launch receipt');
        }
        const process: HarnessProcess = { ...p, pid, ...(remote && p.pid !== pid ? { pidStarted: identity } : {}), pidIdentity: p.pid === pid ? p.pidIdentity ?? null : birth, harnessId: p.harnessId ?? entry.id ?? null, harnessSessionId: entry.sessionId ?? p.harnessSessionId, status: 'running' };
        return { found: true, process, state: stateOfAgent(entry) };
      }
      this.#unwatch(p.sessionId);
      // A directory miss or an unavailable start probe is not proof of exit. A contradictory native
      // identity at this PID *is* proof that it is not ours, even with a same-second start stamp.
      const conflicting = entries.some(e => e.pid === p.pid && e !== entry && (e.sessionId !== undefined || e.id !== undefined));
      const alive = !conflicting && (yield* wait(this.#machine(p).alive(p)));
      return { found: false, reason: entry ? 'listed by claude agents, but its process identity could not be verified' : 'not listed by claude agents --json', alive };
    }).call(this), continuation).then(completion.resolve, completion.reject);
    return completion.promise;
  }

  assertLaunchAvailable(name: string): void { this.#recoveries.assertAvailable(name); }

  async detachUnreachable(): Promise<Array<'transport' | 'forward' | 'watch' | 'in-flight'>> {
    const dropped: Array<'transport' | 'forward' | 'watch' | 'in-flight'> = [];
    if (this.#bridges.size) dropped.push('transport');
    if (this.#watched.size) dropped.push('watch');
    if (this.#pending.size || this.#commands.size || this.#pollFlight) dropped.push('in-flight');
    this.#closed = true;
    this.#recoveries.close();
    this.#bridges.clear();
    for (const prompts of this.#prompts.values()) for (const prompt of prompts.values()) prompt.resolve?.([]);
    this.#prompts.clear();
    this.#approvalWaits.clear();
    if (this.#timer) this.#clock.clearInterval(this.#timer);
    this.#timer = null;
    for (const timer of this.#reexecTimers.values()) this.#clock.clearTimeout(timer);
    this.#reexecTimers.clear();
    this.#missingSince.clear();
    for (const watched of this.#watched.values()) this.#directoryState.watched.delete(watched);
    this.#watched.clear();
    this.#listed.clear();
    this.#activity.clear();
    for (const pending of this.#pending.values()) {
      this.#clock.clearTimeout(pending.timer);
      pending.reject(new Error('native generation is unreachable'));
    }
    this.#pending.clear();
    for (const [timer, done] of this.#resumeWaits) { this.#clock.clearTimeout(timer); done(); }
    await Promise.allSettled([...this.#commands].map(command => command.settled));
    await Promise.allSettled([...this.#nativeInspections.values(), ...this.#launches, ...this.#resumes, ...(this.#pollFlight ? [this.#pollFlight] : [])]);
    await this.#recoveries.drain();
    while (this.#settlementWriters.size) await Promise.allSettled([...this.#settlementWriters]);
    return dropped;
  }

  close(): void | Promise<void> {
    if (this.#closed) return this.#closing;
    this.#closed = true;
    this.#recoveries.close();
    this.#bridges.clear();
    for (const prompts of this.#prompts.values()) for (const prompt of prompts.values()) prompt.resolve?.([]);
    this.#prompts.clear();
    this.#approvalWaits.clear();
    if (this.#timer) this.#clock.clearInterval(this.#timer);
    this.#timer = null;
    for (const timer of this.#reexecTimers.values()) this.#clock.clearTimeout(timer);
    this.#reexecTimers.clear();
    this.#missingSince.clear();
    for (const watched of this.#watched.values()) this.#directoryState.watched.delete(watched);
    this.#watched.clear();
    this.#listed.clear();
    this.#activity.clear();
    for (const d of this.#directories.values()) d.observedLaunches.clear();
    for (const pending of this.#pending.values()) {
      this.#clock.clearTimeout(pending.timer);
      pending.reject(new Error('the hub is stopping'));
    }
    this.#pending.clear();
    for (const [timer, done] of this.#resumeWaits) { this.#clock.clearTimeout(timer); done(); }
    const commands = [...this.#commands];
    for (const command of commands) command.cancel();
    const drains = [...commands.map(command => command.settled), ...this.#nativeInspections.values(), ...this.#launches, ...this.#resumes, ...(this.#pollFlight ? [this.#pollFlight] : [])].map(work => work.then(() => {}, () => {}));
    if (drains.length || this.#launchCleanups.size || this.#settlementWriters.size || !this.#host.durableLaunchRecovery&&[...this.#failedGenerations.values()].some(record=>record.phase!=='settled')) this.#closing = Promise.all(drains).then(async () => {
      await this.#recoveries.drain();
      while(this.#settlementWriters.size)await Promise.allSettled([...this.#settlementWriters]);
      if(!this.#host.durableLaunchRecovery&&[...this.#failedGenerations.values()].some(record=>record.phase!=='settled'))throw new Error('Claude launch cleanup incomplete: failed generation remains supervised');
      if (this.#launchCleanups.size) throw new Error(`Claude launch cleanup incomplete: ${[...this.#launchCleanups.values()].map(({ process: p, error }) => `${p.name} job ${p.harnessId ?? 'unknown'} pid ${p.pid ?? 'unknown'}: ${error instanceof Error ? error.message : 'native cleanup unconfirmed'}`).join('; ')}`);
    });
    return this.#closing;
  }
}
