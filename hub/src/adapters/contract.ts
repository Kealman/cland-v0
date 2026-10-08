// The harness adapter contract (spec 4.3, decision #12). An adapter is a TypeScript module inside the hub
// that launches one kind of harness, tells the hub what each session is doing, and hands it messages.
//
// Mandatory: spawn, attachCommand, inject (confirming `injected`), a state stream, stop, resume.
// Optional: history, usage, setModel, approval relay — each declared in the capability table and never
// emulated when declared `none`. Every state signal is published with its reliability too.
import type { Message, SessionState, TopicRef } from '../protocol.ts';

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
  status: 'running' | 'exited' | 'stopped';
  /** The process's start time as `ps -o lstart=` printed it when the hub recorded the pid: what proves a live pid is
   *  still this process before any signal (`processes.ts` `signalProcess`). Null when unknown. */
  pidStarted?: string | null;
};

export type SpawnRequest = {
  name: string;
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
};

/** A state signal from the harness, with where it came from and when it happened (ms epoch): an older signal
 *  than the last one applied is dropped, so out-of-order hooks never move a session back. */
export type StateSignal = { state: SessionState; source: string; at: number };

/** What the hub gives an adapter: the project, how a launched session reaches the hub, and where signals go. */
export type AdapterHost = {
  root: string;
  /** The project's `.cland/hub.json`: the spoke, the hooks and the mod find the hub through it, so no secret is put on a command line. */
  discoveryFile: string;
  /** The node binary and the `cland` CLI entry that hooks and the mod call (`cland hook …`). */
  node: string;
  cli: string;
  /** The spoke's entry, which the harness starts as its MCP server. */
  spoke: string;
  log: (entry: Record<string, unknown>) => void;
  /** A state signal the adapter read from outside the session (a poll); push signals come through the hub's `session.signal`. */
  signal: (sessionId: string, signal: StateSignal) => void;
  /** The adapter learnt the session's pid after the launch (its supervisor started it late). */
  recordPid: (sessionId: string, pid: number) => void;
  /** The process is gone without cland stopping it: the hub sets `unknown` and journals it. */
  exited: (sessionId: string, detail: string) => void;
};

/** What one signal from inside the session (a hook, the mod) means: a state, the model, usage, messages it confirms. */
export type Interpretation = { state?: SessionState; model?: string; usage?: Record<string, unknown>; confirms?: string[] };

/** The frame an in-session bridge receives: submit this message as a turn, then confirm it. */
export type InjectFrame = { type: 'inject'; session: string; message: string; text: string };

export type ResumeResult = { found: true; process: HarnessProcess; state: SessionState } | { found: false; reason: string };

export interface HarnessAdapter {
  readonly harness: string;
  readonly capabilities: Capabilities;
  /** The launch's first turn carries the role's clause (`SpawnRequest.clause`). */
  readonly clauseAtSpawn?: boolean;
  /** Launch a session; resolves once the harness process runs, with its process-table row. */
  spawn(request: SpawnRequest): Promise<HarnessProcess>;
  /** The command a terminal runs to attach to the live session (a string, so a UI re-runs it intact). */
  attachCommand(process: HarnessProcess): string;
  /**
   * Hand a message to the session as a turn. Resolves when the harness confirmed it (stage `injected`);
   * rejects when it could not be handed over or was not confirmed in time — the message then stays
   * `delivered` and the hub retries it at the next `idle`.
   */
  inject(process: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void>;
  /** A confirmation the harness sent through the hub (the mod's `injected`): settles a pending inject. */
  confirm(process: HarnessProcess, messageId: string): void;
  /** What a signal posted from inside the session (`cland hook <event>`, with the harness's payload) means. */
  interpret(event: string, payload: Record<string, unknown>): Interpretation;
  /** An in-session bridge connected (the Claude Code mod): inject frames go to `send`. Returns its disconnect. */
  bridge?(process: HarnessProcess, send: (frame: InjectFrame) => boolean): () => void;
  /** The latest usage the harness reported (only where `capabilities.usage` is not `none`). */
  usage?(process: HarnessProcess): Record<string, unknown> | null;
  noteUsage?(process: HarnessProcess, usage: Record<string, unknown>): void;
  /** The session was renamed (`process` is its row under the new name): files the adapter keeps by name follow it. */
  renamed?(process: HarnessProcess, from: string): void;
  /** Start watching a process (after spawn or resume): the polled fallback and the liveness check. */
  watch(process: HarnessProcess): void;
  /** Stop through the harness; the process table then says `stopped`. */
  stop(process: HarnessProcess): Promise<void>;
  /**
   * Re-find a process from the table after a hub restart: alive and still the same session → `found`, with
   * what the harness says it is doing. With `relaunch`, a process that is gone is started again on its own
   * conversation id.
   */
  resume(process: HarnessProcess, options?: { relaunch?: boolean }): Promise<ResumeResult>;
  /** The hub stops: timers end; the harness processes keep running (they outlive the hub). */
  close(): void;
}

/** The message as the harness reads it: the same envelope the spoke's channel event used, so the spoke's
 *  instructions describe it (from, from_kind, msg_id, topic …). Attribute values are escaped. */
export function envelope(message: Message, topic: TopicRef | null): string {
  const attrs: Array<[string, string]> = [
    ['source', 'cland'],
    ['from', message.from],
    ['from_kind', message.fromKind],
    ...(message.fromRole !== undefined ? ([['from_role', message.fromRole]] as Array<[string, string]>) : []),
    ['via', message.via],
    ['to', message.to.join(',')],
    ['msg_id', message.id],
    ...(message.replyTo !== undefined ? ([['reply_to', message.replyTo]] as Array<[string, string]>) : []),
    ['ts', message.ts],
    ...(topic ? ([['topic', topic.id], ['topic_title', topic.title]] as Array<[string, string]>) : message.topic !== undefined ? ([['topic', message.topic]] as Array<[string, string]>) : []),
  ];
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<channel ${attrs.map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>\n${message.text}\n</channel>\n${replyHint(message, topic)}`;
}

/**
 * One line after the envelope that names the way back. The spoke's MCP instructions say the same, but a prompt
 * submitted by the mod reads as a plain turn: in the first real smoke (Claude Code 2.1.294, Haiku) the model
 * answered in its terminal, where nobody sees it.
 */
export function replyHint(message: Message, topic: TopicRef | null): string {
  const topicId = topic?.id ?? message.topic;
  const where = topicId !== undefined ? `topic "${topicId}"` : 'no topic';
  if (message.fromKind === 'human') return `To answer, call the cland \`send\` tool with ${where} and no \`to\`; text printed in this terminal reaches no one.`;
  if (message.fromKind === 'agent') return `To answer, call the cland \`send\` tool with to ["${message.from}"], ${where} and reply_to "${message.id}"; text printed in this terminal reaches no one.`;
  return 'This is a notice from the cland hub; text printed in this terminal reaches no one.';
}

/** The message id an envelope carries, or null: a turn whose prompt carries one confirms that message. */
export function envelopeIds(text: string): string[] {
  return [...text.matchAll(/<channel source="cland"[^>]* msg_id="([^"]+)"/g)].map((m) => m[1] as string);
}
