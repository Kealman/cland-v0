// The harness adapter contract (spec 4.3, decision #12). An adapter is a TypeScript module inside the hub
// that launches one kind of harness, tells the hub what each session is doing, and hands it messages.
//
// Mandatory: spawn, attachCommand, inject (confirming `injected`), a state stream, stop, resume.
// Optional: history, usage, setModel, approval relay — each declared in the capability table and never
// emulated when declared `none`. Every state signal is published with its reliability too.
import type { Resumed } from '../hub/worktrees.ts';
import type { Message, SessionState, SessionUsage, TopicRef } from '../protocol.ts';

/** How far a signal or a capability can be trusted. `none`: the adapter does not have it, and nothing pretends it does. */
export type Reliability = 'reliable' | 'heuristic' | 'none';

export type Capabilities = {
  /** Optional capabilities (spec 4.3). */
  history: Reliability;
  usage: Reliability;
  setModel: Reliability;
  approvalRelay: Reliability;
  /** Each state the adapter can report, and how far its signal can be trusted. `unknown` is always available. */
  states: Record<Exclude<SessionState, 'unknown'>, Reliability>;
};

/** A harness process the hub launched: a row of the process table (`./processes.ts`). */
export type HarnessProcess = {
  /** The cland session name. */
  name: string;
  /** The adapter's name (`claude-code`). */
  harness: string;
  role: string | null;
  model: string | null;
  cwd: string;
  pid: number | null;
  /** The harness's own handle for the session: what attach and stop take (Claude Code: the background session id). */
  harnessId: string | null;
  /** The conversation's id (Claude Code: the session UUID); also the spoke's `CLAND_SESSION_ID`, so the hub
   *  maps the harness, its hooks and its spoke to one session. */
  sessionId: string;
  /** The harness's own conversation id where it chose one itself (Claude Code's `--bg` does not take `--session-id`):
   *  what `--resume` takes and what its hooks carry as `session_id`. */
  harnessSessionId: string | null;
  startedAt: string;
  stoppedAt?: string | null;
  /** Latest crew item retained after claims/holds are released. Never a resume claim. */
  cleanupItem?: string | null;
  cleanupHeldAt?: string | null;
  archivedAt?: string | null;
  archivedBy?: 'hand' | 'rule' | null;
  status: 'running' | 'exited' | 'stopped';
  /** The Lead’s epic or release, or the item whose task worktree the session was launched in (`session.launch` with an item; its cwd is that
   *  worktree), else null. */
  item?: string | null;
  /** Original launch brief text or artifact id; null on older rows. */
  launchBrief?: string | null;
  effort?: string | null;
  /** The process's start time as `ps -o lstart=` printed it when the hub recorded the pid: what proves a live pid is
   *  still this process before any signal (`system-processes.ts` `endProcess`). Null when unknown. */
  pidStarted?: string | null;
  /** Warning attached to this explicit launch result. */
  warning?: string;
};

/** Whether a launched session stops to ask before a command its sandbox refuses (roles.toml's `approval`). */
export const APPROVALS = ['never', 'on-request', 'untrusted'] as const;
export type Approval = (typeof APPROVALS)[number];

export const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const;
export const SANDBOX_NETWORKS = ['none', 'local', 'full'] as const;

/** Whether a launched Claude Code session skips its permission checks (roles.toml's `permissions = "skip"`:
 *  `claude --dangerously-skip-permissions`). Adapters whose harness takes no such flag ignore it. */
export const PERMISSIONS = ['skip'] as const;
export type Permissions = (typeof PERMISSIONS)[number];

/**
 * What a launched session's commands may touch (roles.toml's `sandbox`, `writable_roots` and `network`), in
 * harness-neutral terms; the adapter turns it into its harness's own settings.
 */
export type Sandbox = {
  /** `read-only`: nothing is written; `workspace-write`: the session's cwd and the temp dir; `danger-full-access`: no sandbox. */
  mode: (typeof SANDBOX_MODES)[number];
  /** With `workspace-write`: directories writable beside the cwd, absolute. A root that holds a `.git` directory is
   *  writable with it, and so is the cwd's own git directory when it lies there (a worktree's). */
  writableRoots: string[];
  /** `none`: no network; `local`: Unix sockets under the project's `.cland/`, the cwd and the temp dir, and
   *  loopback, with every other host refused; `full`: the whole network. */
  network: (typeof SANDBOX_NETWORKS)[number];
};

/** How a launch is allowed to act: read from roles.toml as it is at the launch, and again at a relaunch. */
export type LaunchPolicy = {
  /** Absent: the adapter's default (Codex: `never`, so a launched session never waits on an approval). */
  approval?: Approval | null;
  /** Absent: the harness's own sandbox. */
  sandbox?: Sandbox | null;
  /** `skip`: the session runs with every permission check bypassed (Claude Code); absent: the harness's own settings. */
  permissions?: Permissions | null;
};

export type SpawnRequest = LaunchPolicy & {
  name: string;
  /** Only explicit fresh resume retains a stopped cland identity on a new conversation. */
  sessionId?: string;
  /** Restart an idle pool member on its native conversation, with a fresh cland launch identity. */
  resumeConversation?: string;
  /** Hub-issued credential carried by this launch's spoke hello; never inferred from a session name. */
  launchToken?: string;
  role: string | null;
  /** The model to run; the harness's default when null. */
  model: string | null;
  cwd: string;
  /** The reasoning effort (roles.toml's launch default); the harness's default when absent. An adapter whose
   *  harness takes none ignores it. */
  effort?: string | null;
  /** The role's clause as the holder reads it, for an adapter that must give a new session a first turn (Codex:
   *  a thread has no rollout before one). An adapter that uses it declares `clauseAtSpawn`, and the hub does not
   *  inject the clause again at the session's first hello. */
  clause?: string | null;
  /** A one-time launch brief, carried after the clause by an adapter with `clauseAtSpawn`. */
  brief?: Message;
  /** The item the session was launched for: its cwd is the item's task worktree. A harness that makes worktrees of
   *  its own is told to refuse them there (decision D8). */
  item?: string | null;
};

/** A native sub-agent start; absent model means unknown, never the parent model. */
export type SubagentLaunch = { id?: string; type?: string; model?: string };
/** A harness report with optional state and launch metadata. State ordering drops older signals. */
export type StateSignal = { state?: SessionState; source: string; at: number; approvalCommand?: string; model?: string; subagent?: SubagentLaunch };

/** What the hub gives an adapter: the project, how a launched session reaches the hub, and where signals go. */
export type AdapterHost = {
  root: string;
  /** The sessions layer takes failed handshakes into its durable pending-stop receipts. */
  durableLaunchRecovery?: boolean;
  /** The project's `.cland/hub.json`: the spoke, the hooks and the mod find the hub through it, so no secret is put on a command line. */
  discoveryFile: string;
  /** The node binary and the `cland` CLI entry that hooks and the mod call (`cland hook …`). */
  node: string;
  cli: string;
  /** The spoke's entry, which the harness starts as its MCP server. */
  spoke: string;
  log: (entry: Record<string, unknown>) => void;
  /** Project-local durable adapter state, in hub.db's meta table. */
  adapterState?: { read: (key: string) => string | null; write: (key: string, value: string) => void };
  /** A native harness report (state, model or sub-agent start); hook reports use `session.signal`. */
  signal: (sessionId: string, signal: StateSignal) => void;
  /** Adapter-owned usage changed; the hub coalesces snapshots per session. */
  usageChanged?: (sessionId: string) => void;
  /** A turn ended in error, with the hub messages that fed it (including steers), when known. */
  turnFailed?: (sessionId: string, error: string, messages: string[]) => void;
  /** Sender attribution learned after the failure notice (a pending admission just settled). */
  notifyFailureSenders?: (sessionId: string, error: string, messages: string[]) => void;
  /** The adapter learnt the session's pid after the launch (its supervisor started it late). */
  recordPid: (sessionId: string, pid: number) => void;
  /** The adapter's own connection to the session came back (a reconnect): what waits for an inject is retried now,
   *  whether or not the state changed (an idle session reconnected to is still idle). */
  reconnected?: (sessionId: string) => void;
  /** The process is gone without cland stopping it: the hub sets `unknown` and journals it. */
  exited: (sessionId: string, detail: string) => void;
};

/** What one signal from inside the session (a hook, the mod) means: a state, the model, usage, messages it confirms. */
export type Interpretation = { state?: SessionState; approvalCommand?: string; model?: string; subagent?: SubagentLaunch; usage?: Record<string, unknown>; confirms?: string[]; turnError?: string; failureAudience?: 'senders'; failureDedupe?: { key: string; episode: string }; failureMessages?: Promise<string[]> };

/** The frame an in-session bridge receives: submit this message as a turn, then confirm it. */
export type InjectFrame = { type: 'inject'; session: string; message: string; text: string };

export type ResumeResult = { found: true; process: HarnessProcess; state: SessionState } | { found: false; reason: string };

export interface HarnessAdapter {
  readonly harness: string;
  readonly capabilities: Capabilities;
  /** The launch's first turn carries the role's clause (`SpawnRequest.clause`). */
  readonly clauseAtSpawn?: boolean;
  /** Launch a session; resolves once the harness process runs, with its process-table row.
   * Recheck authorize after preparation, immediately before process creation and native first-turn admission. */
  spawn(request: SpawnRequest, resumed?: Resumed, authorize?: () => void): Promise<HarnessProcess>;
  /** The command a terminal runs to attach to the live session (a string, so a UI re-runs it intact). */
  attachCommand(process: HarnessProcess): string;
  /**
   * Hand a message to the session as a turn. Resolves when the harness confirmed it (stage `injected`);
   * rejects when it could not be handed over or was not confirmed in time — the message then stays
   * `delivered` and the hub retries it at the next `idle`. Rejects with `InjectUncertain` when the request reached
   * the harness and its answer never came: the delivery is `uncertain`, never retried on its own.
   */
  inject(process: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void>;
  /** A confirmation the harness sent through the hub (the mod's `injected`): settles a pending inject. */
  confirm(process: HarnessProcess, messageId: string): void;
  /** What a signal posted from inside the session (`cland hook <event>`, with the harness's payload) means. */
  interpret(event: string, payload: Record<string, unknown>, process?: HarnessProcess, at?: number): Interpretation;
  /** An in-session bridge connected (the Claude Code mod): inject frames go to `send`. Returns its disconnect. */
  bridge?(process: HarnessProcess, send: (frame: InjectFrame) => boolean): () => void;
  /** Why a watched session's state is unknown, when discovery is suppressed. */
  stateReason?(process: HarnessProcess): string | null;
  /** Running totals and latest turn/step (only where `capabilities.usage` is not `none`). */
  usage?(process: HarnessProcess): SessionUsage | null;
  noteUsage?(process: HarnessProcess, usage: Record<string, unknown>): void;
  /** Prune adapter-owned totals and supervision for an archived terminal row. */
  forget?(sessionId: string): void;
  /** The session was renamed (`process` is its row under the new name): files the adapter keeps by name follow it. */
  renamed?(process: HarnessProcess, from: string): void;
  /** Start watching a process (after spawn or resume): the polled fallback and the liveness check. */
  watch(process: HarnessProcess): void;
  /** Dispose identity-owned supervision after verified exit, without signalling any process. */
  unwatch?(sessionId: string): void;
  /** Stop through the harness; the process table then says `stopped`. */
  stop(process: HarnessProcess, resumed?: Resumed, authorize?: () => void): Promise<void>;
  /**
   * Re-find a process from the table after a hub restart: alive and still the same session → `found`, with
   * what the harness says it is doing. With `relaunch`, a process that is gone is started again on its own
   * conversation id, under `policy` (its role's launch defaults as they are now).
   */
  resume(process: HarnessProcess, options?: { relaunch?: boolean; policy?: LaunchPolicy; resumed?: Resumed }): Promise<ResumeResult>;
  /** The hub stops: timers end; the harness processes keep running (they outlive the hub). */
  close(): void;
}

/**
 * An inject whose outcome is unknown: the request reached the harness and no answer came (a deadline, a lost
 * connection), so the turn may or may not have started. The hub marks the delivery `uncertain` and never replays it
 * on its own: only the human's `session.retry`, or an adapter that proves the turn did not start, sends it again.
 */
export class InjectUncertain extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InjectUncertain';
  }
}

/** The message as the harness reads it: the same envelope the spoke's channel event used, so the spoke's
 *  instructions describe it (from, from_kind, msg_id, topic …). Attribute values are escaped. */
export function envelope(message: Message, topic: TopicRef | null): string {
  const digest = message.digest?.length
    ? `${message.digest.every(note => note.kind === 'progress') ? `Progress digest (${message.digest.length} notes` : `Turn digest (${message.digest.length} entries`}, oldest first):\n${message.digest.map(note => note.detail?.summary === true ? note.text : envelope(note, null)).join('\n')}\nNext delivery:\n`
    : '';
  const attrs: Array<[string, string]> = [
    ['source', 'cland'],
    ['from', message.from],
    ['from_kind', message.fromKind],
    ...(message.kind !== undefined ? ([['kind', message.kind]] as Array<[string, string]>) : []),
    ...(message.fromRole !== undefined ? ([['from_role', message.fromRole]] as Array<[string, string]>) : []),
    ['via', message.via],
    ['to', message.to.join(',')],
    ['msg_id', message.id],
    ...(message.replyTo !== undefined ? ([['reply_to', message.replyTo]] as Array<[string, string]>) : []),
    ...(message.answerTo !== undefined ? ([['answer_to', message.answerTo]] as Array<[string, string]>) : []),
    ['ts', message.ts],
    ...(message.artifacts?.length ? [['artifacts', JSON.stringify(message.artifacts)]] as Array<[string, string]> : []),
    ...(message.artifact ? [['artifact_id', message.artifact.id], ['artifact_path', message.artifact.path]] as Array<[string, string]> : []),
    ...(topic ? ([['topic', topic.id], ['topic_title', topic.title]] as Array<[string, string]>) : message.topic !== undefined ? ([['topic', message.topic]] as Array<[string, string]>) : []),
  ];
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `${digest}<channel ${attrs.map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>\n${message.text}\n</channel>\n${replyHint(message, topic)}`;
}

/**
 * One line after the envelope that names the way back. The spoke's MCP instructions say the same, but a prompt
 * submitted by the mod reads as a plain turn: in the first real smoke (Claude Code 2.1.294, Haiku) the model
 * answered in its terminal, where nobody sees it.
 */
export function replyHint(message: Message, topic: TopicRef | null): string {
  const topicId = topic?.id ?? message.topic;
  const where = topicId !== undefined ? `topic "${topicId}"` : 'no topic';
  if (message.ask?.to !== undefined && message.ask.state === 'open') return `To answer, call the cland \`ask.answer\` tool with ask "${message.id}" and text; to forward unchanged one level, call \`ask.forward\` with ask "${message.id}". Text printed in this terminal reaches no one.`;
  if (message.fromKind === 'human') return `To answer, call the cland \`send\` tool with ${where} and no \`to\`; text printed in this terminal reaches no one.`;
  if (message.fromKind === 'agent') return `To answer, call the cland \`send\` tool with to ["${message.from}"], ${where} and reply_to "${message.id}"; text printed in this terminal reaches no one.`;
  return 'This is a notice from the cland hub; text printed in this terminal reaches no one.';
}

/** The message id an envelope carries, or null: a turn whose prompt carries one confirms that message. */
export function envelopeIds(text: string): string[] {
  return [...text.matchAll(/<channel source="cland"[^>]* msg_id="([^"]+)"/g)].map((m) => m[1] as string);
}
