// The Claude Code adapter (spec 4.3, research `harness-surfaces` §1). Claude Code has no server a host can
// join; everything comes from inside each session or from its own CLI:
//
//   spawn    `claude --bg --session-id <uuid> --name <name> [--model m] [--effort e] --mcp-config <json> --settings <json>
//            --plugin-dir <cland mod>` in the session's cwd. The MCP config starts the spoke with the session's
//            identity; the settings add the cland hooks and the variables the mod reads. Both are passed inline:
//            nothing is written into the project. The hub's secret is never on the command line — the spoke,
//            the hooks and the mod read the project's `hub.json`.
//            A session launched with an item (its cwd is the item's task worktree) also gets a `WorktreeCreate`
//            hook, `cland hook worktree-create`, which refuses every worktree the harness would make and names the
//            session's own (T-20 decision D8): its sub-agents work there too.
//   attach   `claude attach <background id>`, the harness's own.
//   inject   the cland mod (`hub/mod/cland`): it keeps a bridge to the hub (`cland hook bridge`), submits each
//            message with `$.prompt.submit` (which waits for the session to be idle) and confirms it with
//            `cland hook injected`. A turn whose prompt carries the message's envelope confirms it too.
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
import { continueWith, wait, untimed } from './continuations.ts';
import type { Resumed } from '../hub/worktrees.ts';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Message, SessionState, SessionUsage, TopicRef } from '../protocol.ts';
import { addUsage } from './usage.ts';
import { processStarted } from './processes.ts';
import { endProcess } from '../system-processes.ts';
import { turnError } from './turn-error.ts';
import { envelope, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type InjectFrame, type Interpretation, type LaunchPolicy, type Permissions, type ResumeResult, type SpawnRequest } from './contract.ts';



export const CLAUDE_CODE = 'claude-code';

/** The cland mod, loaded into every session the adapter launches (`--plugin-dir`). */
export const MOD_DIR = fileURLToPath(new URL('../../mod/cland', import.meta.url));

export const CLAUDE_CODE_CAPABILITIES: Capabilities = {
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

/** The hook events cland listens to, and the `cland hook` event each one runs. */
export const HOOK_EVENTS: Readonly<Record<string, string>> = {
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
  /** The `claude` executable: `CLAND_CLAUDE_BIN`, else `claude` on the PATH. */
  bin?: string;
  /** How often `claude agents --json` is polled and the processes' pids checked, ms. */
  pollMs?: number;
  /** How long an inject waits for the mod's confirmation before it stays `delivered`, ms. */
  injectTimeoutMs?: number;
  /** How long a launch waits for the session to show in `claude agents --json`, ms. */
  spawnDeadlineMs?: number;
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
    case 'subagent-start':
      return { subagent: {
        ...(typeof payload.agent_id === 'string' ? { id: payload.agent_id } : {}),
        ...(typeof payload.agent_type === 'string' ? { type: payload.agent_type } : {}),
        ...(typeof payload.model === 'string' ? { model: payload.model } : {}),
      } };
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
      return { state: 'idle', ...(payload.hook_event_name === 'StopFailure' || payload.error ? { turnError: turnError(payload.error_details ?? payload.error) } : {}) };
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

type Pending = { resolve: () => void; reject: (err: Error) => void; timer: NodeJS.Timeout };
type Prompt = { messages?: string[]; resolve?: (messages: string[]) => void };
/** Enough recent prompts for delayed hooks; eviction drops uncertain attribution rather than guessing. */
const PROMPT_HISTORY_LIMIT = 64;

export class ClaudeCodeAdapter implements HarnessAdapter {
  readonly harness = CLAUDE_CODE;
  readonly capabilities = CLAUDE_CODE_CAPABILITIES;
  readonly #host: AdapterHost;
  readonly #bin: string;
  readonly #pollMs: number;
  readonly #injectTimeoutMs: number;
  readonly #spawnDeadlineMs: number;
  readonly #stopGraceMs: number;
  readonly #env: NodeJS.ProcessEnv;
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
  #timer: NodeJS.Timeout | null = null;
  #polling = false;

  constructor(host: AdapterHost, options: ClaudeCodeOptions = {}) {
    this.#host = host;
    this.#bin = options.bin ?? process.env.CLAND_CLAUDE_BIN ?? 'claude';
    this.#pollMs = options.pollMs ?? 5000;
    this.#injectTimeoutMs = options.injectTimeoutMs ?? 60_000;
    this.#spawnDeadlineMs = options.spawnDeadlineMs ?? 20_000;
    this.#stopGraceMs = options.stopGraceMs ?? 5000;
    const env: NodeJS.ProcessEnv = {};
    for (const [k, v] of Object.entries(options.env ?? process.env)) if (!k.startsWith('CLAND_') || k === 'CLAND_CLAUDE_BIN') env[k] = v;
    this.#env = env;
  }

  // ---------------------------------------------------------------- the harness's CLI

  #run(args: string[], cwd: string, timeoutMs = 30_000, resumed: Resumed = untimed, launchToken?: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(this.#bin, args, { cwd, env: { ...this.#env, ...(launchToken ? { CLAND_LAUNCH_TOKEN: launchToken } : {}) }, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => resumed(() => {
        if (err && typeof err.code !== 'number') reject(new Error(`${this.#bin} ${args[0] ?? ''}: ${err.message}`));
        else resolve({ code: err ? (err.code as number) : 0, stdout, stderr });
      }));
    });
  }

  async #agents(resumed: Resumed = untimed): Promise<AgentEntry[] | null> {
    return continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, AgentEntry[] | null, unknown> {
      try {
        const r = yield* wait(this.#run(['agents', '--json'], this.#host.root, 15000, resumed));
        if (r.code !== 0)
          return null;
        const parsed: unknown = JSON.parse(r.stdout);
        return Array.isArray(parsed) ? (parsed as AgentEntry[]) : null;
      } catch {
        return null;
      }
    }).call(this), resumed);
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
  #sessionFlags(name: string, role: string | null, sessionId: string, worktree: string | null, launchToken?: string): string[] {
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
      // async: a hook never holds the session up; each signal carries its time, so order is restored at the hub
      hooks[hookEvent] = [{ hooks: [{ type: 'command', command: this.#hookCommand(event, name, sessionId), async: true, timeout: 10 }] }];
    }
    // not async: its exit status is the refusal
    if (worktree !== null) hooks.WorktreeCreate = [{ hooks: [{ type: 'command', command: `${this.#hookCommand('worktree-create', name, sessionId)} --worktree ${sq(worktree)}`, timeout: 10 }] }];
    const settings = {
      hooks,
      // what the mod reads to find its session and the hub
      env: { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: sessionId, CLAND_HUB_FILE: this.#host.discoveryFile, CLAND_NODE: this.#host.node, CLAND_CLI: this.#host.cli },
    };
    return ['--mcp-config', JSON.stringify(mcp), '--settings', JSON.stringify(settings), '--plugin-dir', MOD_DIR];
  }

  /** The background id `claude --bg` printed (`claude attach <id>`). */
  static parseBackgroundId(stdout: string): string | null {
    return /claude attach (\S+)/.exec(stdout)?.[1]?.replace(/[`'".,]+$/, '') ?? /\(([0-9a-f]{6,})\)/.exec(stdout)?.[1] ?? /\b([0-9a-f]{8})\b/.exec(stdout)?.[1] ?? null;
  }

  async #launch(p: Omit<HarnessProcess, 'pid' | 'harnessId' | 'startedAt' | 'status'>, resume: boolean, effort: string | null = null, resumed: Resumed = untimed, launchToken?: string, authorize: () => void = () => {}, permissions: Permissions | null = null): Promise<HarnessProcess> {
    return continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, HarnessProcess, unknown> {
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
        ...this.#sessionFlags(p.name, p.role, p.sessionId, worktree, launchToken),
      ];
      authorize();
      const r = yield* wait(this.#run(args, p.cwd, undefined, resumed, launchToken));
      const harnessId = ClaudeCodeAdapter.parseBackgroundId(r.stdout);
      const launched: HarnessProcess = { ...p, pid: null, harnessId, startedAt: new Date().toISOString(), status: 'running' };
      try {
        if (r.code !== 0) throw new Error(`claude --bg failed (exit ${r.code}): ${(r.stderr || r.stdout).trim().slice(0, 500)}`);
        this.#host.log({ event: 'harness-launched', harness: this.harness, session: p.name, harnessId, resume, out: r.stdout.trim().slice(0, 300) });
        // the session's process: agent view lists it once its supervisor started it
        let pid: number | null = null;
        let found: AgentEntry | undefined;
        const deadline = Date.now() + this.#spawnDeadlineMs;
        while (Date.now() < deadline) {
          const entries = yield* wait(this.#agents(resumed));
          found = entries ? this.#find(entries, { sessionId: p.sessionId, harnessSessionId: p.harnessSessionId, harnessId, pid: null }) : undefined;
          if (found?.pid !== undefined) {
            pid = found.pid;
            launched.pid = pid;
            launched.harnessSessionId = found.sessionId ?? p.harnessSessionId;
            launched.pidStarted = yield* wait(processStarted(pid, undefined, resumed));
            break;
          }
          yield* wait(new Promise((resolve) => setTimeout(resolve, Math.min(250, this.#pollMs))));
        }
        if (pid === null)
          this.#host.log({ event: 'harness-pid-unknown', harness: this.harness, session: p.name, harnessId });
        return { ...launched, harnessId: harnessId ?? found?.id ?? null };
      } catch (err) {
        if (launched.harnessId || launched.pid !== null) yield* wait(this.stop(launched, resumed));
        throw err;
      }
    }).call(this), resumed);
  }

  spawn(request: SpawnRequest, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<HarnessProcess> {
    return this.#launch({ name: request.name, harness: this.harness, role: request.role, model: request.model, cwd: request.cwd, sessionId: request.sessionId ?? randomUUID(), harnessSessionId: request.resumeConversation ?? null, item: request.item ?? null }, request.resumeConversation !== undefined, request.effort ?? null, resumed, request.launchToken, authorize, request.permissions ?? null);
  }

  attachCommand(p: HarnessProcess): string {
    const bin = this.#bin === 'claude' ? 'claude' : sq(this.#bin);
    return `${bin} attach ${sq(p.harnessId ?? p.name).replace(/^'([\w-]+)'$/, '$1')}`;
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
      clearTimeout(existing.timer);
      existing.reject(new Error('superseded by a retry'));
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(key);
        reject(new Error(`the mod did not confirm the turn within ${this.#injectTimeoutMs} ms`));
      }, this.#injectTimeoutMs);
      this.#pending.set(key, { resolve, reject, timer });
      if (!send({ type: 'inject', session: p.name, message: message.id, text: envelope(message, topic) })) {
        clearTimeout(timer);
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
    clearTimeout(pending.timer);
    pending.resolve();
  }

  interpret(event: string, payload: Record<string, unknown>, p?: HarnessProcess): Interpretation {
    const meaning = interpret(event, payload);
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

  noteUsage(p: HarnessProcess, usage: Record<string, unknown>): void {
    this.#usage.set(p.sessionId, addUsage(this.#usage.get(p.sessionId), usage));
  }

  usage(p: HarnessProcess): SessionUsage | null {
    return this.#usage.get(p.sessionId) ?? null;
  }

  forget(sessionId: string): void { this.unwatch(sessionId); this.#usage.delete(sessionId); }

  // ---------------------------------------------------------------- watch: the polled fallback and liveness

  watch(p: HarnessProcess): void {
    this.#watched.set(p.sessionId, p);
    if (!this.#timer) {
      this.#timer = setInterval(() => void this.#poll(), this.#pollMs);
      this.#timer.unref();
    }
  }

  #unwatch(sessionId: string): void {
    for (const prompt of this.#prompts.get(sessionId)?.values() ?? []) prompt.resolve?.([]);
    this.#prompts.delete(sessionId);
    this.#watched.delete(sessionId);
    if (this.#watched.size === 0 && this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  unwatch(sessionId: string): void {
    this.#unwatch(sessionId);
    this.#bridges.delete(sessionId);
  }

  async #poll(): Promise<void> {
    if (this.#polling || this.#watched.size === 0) return;
    this.#polling = true;
    try {
      // a pid that is gone is a crash, whatever agent view says
      for (const p of [...this.#watched.values()]) {
        if (this.#stopping.has(p.sessionId)) continue;
        if (p.pid !== null && !pidAlive(p.pid)) {
          this.#unwatch(p.sessionId);
          this.#host.exited(p.sessionId, `pid ${p.pid} is gone`);
        }
      }
      if (this.#watched.size === 0) return;
      const at = Date.now();
      const entries = await this.#agents();
      if (!entries) return;
      for (const p of [...this.#watched.values()]) {
        if (this.#stopping.has(p.sessionId)) continue;
        const entry = this.#find(entries, p);
        if (!entry) continue;
        if (p.pid === null && entry.pid !== undefined) {
          p.pid = entry.pid;
          this.#host.recordPid(p.sessionId, entry.pid);
        }
        this.#host.signal(p.sessionId, { state: stateOfAgent(entry), source: 'poll', at });
      }
    } finally {
      this.#polling = false;
    }
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
            const r = await this.#run(['stop', p.harnessId], p.cwd);
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
        if (!await endProcess(p, (entry) => this.#host.log({ ...entry, harness: this.harness, session: p.name }), this.#stopGraceMs, cliStop, { resumed, authorize, allowReused: p.status === 'exited' })) throw new Error(`could not stop "${p.name}": its process identity cannot be verified; it is still watched`);
      }
      ended = true;
    } finally {
      resumed(() => {
        if (ended) this.#unwatch(p.sessionId);
        this.#stopping.delete(p.sessionId);
      });
    }
  }

  async resume(p: HarnessProcess, options: { relaunch?: boolean; policy?: LaunchPolicy; resumed?: Resumed } = {}): Promise<ResumeResult> {
    return continueWith((function* (this: ClaudeCodeAdapter): Generator<Promise<unknown>, ResumeResult, unknown> {
      const resumed = options.resumed ?? untimed;
      const entries = (yield* wait(this.#agents(resumed))) ?? [];
      const entry = this.#find(entries, p);
      const pid = entry?.pid ?? p.pid;
      // the same session: listed under its own session id (or background id), with a live process
      if (entry && pid !== null && pid !== undefined && pidAlive(pid)) {
        const process: HarnessProcess = { ...p, pid, harnessId: p.harnessId ?? entry.id ?? null, harnessSessionId: entry.sessionId ?? p.harnessSessionId, status: 'running' };
        return { found: true, process, state: stateOfAgent(entry) };
      }
      if (!options.relaunch)
        return { found: false, reason: entry ? 'listed by claude agents, but its process is gone' : 'not listed by claude agents --json' };
      yield* wait(this.stop(p, options.resumed));
      const process = yield* wait(this.#launch({ name: p.name, harness: p.harness, role: p.role, model: p.model, cwd: p.cwd, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId, item: p.item ?? null }, true, p.effort ?? null, resumed, undefined, () => {}, options.policy?.permissions ?? null));
      return { found: true, process, state: 'unknown' };
    }).call(this), options.resumed ?? untimed);
  }

  close(): void {
    for (const prompts of this.#prompts.values()) for (const prompt of prompts.values()) prompt.resolve?.([]);
    this.#prompts.clear();
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#watched.clear();
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('the hub is stopping'));
    }
    this.#pending.clear();
  }
}
