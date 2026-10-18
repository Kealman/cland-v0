// The spoke: the MCP stdio server a session's harness spawns, and the hub client behind it. Every tool
// answers JSON text; a failure is `{ ok: false, error }` with isError set.
//
// Configuration comes from the environment the adapter launches the session with:
//   CLAND_HUB_URL       the hub's WebSocket url (loopback)
//   CLAND_HUB_SECRET    the per-project secret
//     both absent: the hub is found through `.cland/hub.json` (CLAND_HUB_FILE names it, else the nearest one
//     walking up from the cwd), re-read before every reconnect (a restarted hub listens on a new port)
//   CLAND_SESSION_ID    the harness session id; a restart of the same session takes its name back
//   CLAND_SESSION_NAME  the name to ask for; an unbound spoke discovering a project hub stays disconnected
//   CLAND_ROLE          the role the session asks for; a project's hub grants it only to a session it launched for
//                       that role, else the session needs a role the human assigned (`cland role set`)
//   CLAND_DELIVERY      `adapter`: the session's harness adapter injects what the spoke accepts (#24), so the spoke
//                       only acks; otherwise the spoke delivers into the session as a Claude Code channel event
//   CLAND_HUB_RECONNECT_MS, CLAND_HUB_KEEPALIVE_MS, CLAND_HUB_REQUEST_TIMEOUT_MS,
//   CLAND_HUB_WELCOME_TIMEOUT_MS   timings, for tests
import { subscriptionInput } from '../subscriptions.ts';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Notification } from '@modelcontextprotocol/sdk/types.js';
import { INSTRUCTIONS } from './instructions.ts';
import { Forbidden, HubClient, Refused, REQUEST_TIMEOUT_MS, WELCOME_TIMEOUT_MS } from './hub-client.ts';
import { RULE_TOOLS, RULE_TOOL_NAMES } from './rule-tools.ts';
import type { RuleRequest } from '../protocol.ts';
import type { DistributiveOmit } from './hub-client.ts';
import { TASK_TOOLS, TASK_TOOL_NAMES, taskFrame } from './task-tools.ts';
import { VERIFY_OCCASIONS, KEEPALIVE_MS, SEND_KINDS, isSendKind, type HandoverNote, type Message, type SendOutcome, type TopicRef } from '../protocol.ts';
import { envelope } from '../adapters/contract.ts';
import { findDiscovery, readDiscovery } from '../project.ts';
import { Journal, journalPath } from '../hub/journal.ts';
import { hasRoleMappedSession } from '../hub/store.ts';
import { VERSION } from '../version.ts';

const TOOLS = [
  { name: 'verify', description: 'With dryRun, return admission and tier projections without queueing; diagnostics opts into the slower report-only reachability graph. Otherwise submit verification and return immediately; the hub posts one result. Occasion shards integrated dev full close runs: Coordinator stage/epic/release, QA epic. Omit occasion for batch/task runs.', inputSchema: { type: 'object', properties: { dryRun: { type: 'boolean' }, diagnostics: { type: 'boolean' }, mode: { type: 'string', enum: ['auto', 'all', 'hub', 'nvim'] }, cwd: { type: 'string' }, report: { type: 'string' }, to: { type: 'array', items: { type: 'string' } }, fresh: { type: 'boolean' }, workers: { type: 'integer', minimum: 1 }, size: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]*$' }, executor: { type: 'string', enum: ['local', 'droplet'] }, occasion: { type: 'string', enum: Object.values(VERIFY_OCCASIONS) } }, required: ['cwd'], anyOf: [{ required: ['report'] }, { properties: { dryRun: { const: true } }, required: ['dryRun'] }] } },
  { name: 'merge.queue', description: 'List durable merge queue entries in FIFO order.', inputSchema: { type: 'object', properties: {} } },
  { name: 'merge', description: 'Queue or land an open task on its base as one squash commit after clear, current hub verdicts. Coordinator or a supervising Lead within its scheduled subtree; never delegate a merge to a sub-agent.', inputSchema: { type: 'object', properties: { item: { type: 'string' }, cancel: { type: 'boolean' } }, required: ['item'] } },
  {
    name: 'artifact.create',
    description: 'Show work through a persistent artifact in a topic. Give a file or directory path (copied), content, or folder: true with optional entry and content. Returns the artifact id and absolute path; posts its chip into the topic.',
    inputSchema: { type: 'object', properties: {
      kind: { type: 'string', enum: ['prompt', 'note', 'page', 'diagram', 'file'] }, title: { type: 'string' },
      path: { type: 'string' }, content: { type: 'string' }, folder: { type: 'boolean' }, entry: { type: 'string' }, topic: { type: 'string' }, status: { type: 'string', enum: ['draft', 'shared'] },
    }, required: ['kind', 'title', 'topic'] },
  },
  { name: 'artifact.keep', description: 'Keep an artifact from retention, or release it with kept: false. Agents cannot change human or Aide artifacts.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' }, kept: { type: 'boolean' } }, required: ['artifact'] } },
  { name: 'artifact.archive', description: 'Archive an artifact explicitly. Human and Aide bytes are retained.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' } }, required: ['artifact'] } },
  { name: 'artifact.move', description: 'Absorb a file artifact into a folder; its old id redirects to that file. Folder moves are refused.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' }, folder: { type: 'string' }, name: { type: 'string' } }, required: ['artifact', 'folder'] } },
  { name: 'artifact.list', description: 'List artifacts, or resolve one id and list its folder files on request.', inputSchema: { type: 'object', properties: { topic: { type: 'string' }, artifact: { type: 'string' } } } },
  { name: 'artifact.promote', description: 'Copy an artifact into a project-relative repository path. Aides may promote here; the Coordinator promotes from its shell.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' }, path: { type: 'string' } }, required: ['artifact', 'path'] } },
  {
    name: 'send',
    description:
      'Send a message into a topic. Without `to` it is for the human, in the topic (General unless `topic` names another: reply in the topic an event came from); the Coordinator and Aides write to the human anywhere, another role only in a topic where the latest message of the human mentioned it. Exception: any session may send kind request to the human, with request review, qa or handover and a known subject (item, artifact or session). request and subject are forbidden on other kinds. With `to` it goes to other sessions — session names, `all`, globs over names (`impl-*`), or roles (`reviewer`), exactly as names appear in `from` of inbound events (Aides use names only) — and is recorded in the topic (Agents unless `topic` names another). A lead\'s `review request T-<n>` to `reviewer` or `qa request T-<n>` to `qa` in Agents or the item topic reaches one live verifier: the previous verifier, otherwise a free holder. The outcome\'s `resolvedTo` names that session. If none is eligible, `queued` waits for the next free verifier; the hub delivers automatically and sends the lead an assignment or refusal notice. Wait instead of resending. With none live, report the staffing blocker so one can be launched.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: 'Session names, globs, roles, `all` or `lead T-<n>` (the nearest lead up the open item chain, skipping the sender’s own claims, then Coordinator); omit to write to the human' },
        text: { type: 'string', description: 'The message' },
        kind: { type: 'string', enum: SEND_KINDS, description: 'progress waits for the next turn in a digest; report (default), question and decision start a turn' },
        request: { type: 'string', enum: ['review', 'qa', 'handover'], description: 'Required with kind request, addressed only to the human; any session may send one' },
        subject: { type: 'string', description: 'Required with kind request: a known item (T-n), artifact (A-n) or session name' },
        artifacts: { type: 'array', items: { type: 'string' }, description: 'Artifact ids in this topic to attach; deliveries carry their durable paths' },
        topic: { type: 'string', description: 'The topic id (the `topic` of the event being answered); default General for the human, Agents between sessions' },
        reply_to: { type: 'string', description: 'msg_id of the event being answered' },
      },
      required: ['text'],
    },
  },
  {
    name: 'subscribe',
    description: "Receive hub events about sessions, items, topics, roles or subtrees; turn digests are default, now steers where supported. Returns a durable caller-owned subscription; repeated identical requests return the same id.",
    inputSchema: { type: 'object', properties: {
      subject: { type: 'object', oneOf: [
        { properties: { session: { type: 'string' } }, required: ['session'], additionalProperties: false },
        ...['item', 'topic', 'role', 'subtree'].map(key => ({ properties: { [key]: { type: 'string' } }, required: [key], additionalProperties: false })),
      ] },
      events: { type: 'array', items: { type: 'string', enum: ['session.state', 'task', 'topic', 'usage', 'artifact'] }, minItems: 1 },
      digest: { type: 'string', enum: ['turn', 'now'] },
      threshold: { type: 'object', oneOf: ['cost', 'tokens'].map(key => ({ properties: { [key]: { type: 'number', exclusiveMinimum: 0 } }, required: [key], additionalProperties: false })) },
    }, required: ['subject', 'events'] },
  },
  {
    name: 'unsubscribe',
    description: 'Remove one of your subscriptions. Stops future events; already recorded deliveries remain queued for the next turn.',
    inputSchema: { type: 'object', properties: { subscription: { type: 'string' } }, required: ['subscription'] },
  },
  {
    name: 'subscriptions',
    description: 'List your durable event subscriptions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'topic.create',
    description:
      "Open a topic: the Coordinator any topic, an Implementer only one bound to its own item (Reviewer and QA open none; questions for the human go to the Coordinator with send). A title is required; `item` binds it to a unit of work (T-12), which has one topic at most. The topic shows in the human's list with its first message: write into it with send(topic).",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the topic is about' },
        item: { type: 'string', description: 'The item it is bound to (T-12); omit for an unbound topic' },
      },
      required: ['title'],
    },
  },
  {
    name: 'resolve',
    description: "Clear a topic's wait (waiting for agent, waiting for human) back to open, when nothing in it waits any more. The Coordinator's tool.",
    inputSchema: { type: 'object', properties: { topic: { type: 'string', description: 'The topic id' } }, required: ['topic'] },
  },
  { name: 'ask.forward', description: 'Forward an incoming open question unchanged to the next lead; the Coordinator forwards it to the human. Pass the delivered msg_id. The hub preserves its topic and question.', inputSchema: { type: 'object', properties: { ask: { type: 'string' } }, required: ['ask'] } },
  { name: 'ask.answer', description: 'Answer an incoming open question locally. Pass the delivered msg_id and answer text; the reply carries answer_to and settles the waiting state. A forwarded question waits for its upstream answer first.', inputSchema: { type: 'object', properties: { ask: { type: 'string' }, text: { type: 'string' } }, required: ['ask', 'text'] } },
  {
    name: 'ask',
    description:
      "Ask the human a question in a topic (the Coordinator only): numbered options (at most 9; the human answers with a key) and, unless `free` is false, room for a free answer. The topic waits for the human until the answer arrives as an event with `answer_to` set to this ask's id (and from_kind=\"human\"). `resolve` on the topic withdraws open asks; closing the topic cancels them. Several asks may be open at once.",
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The topic id to ask in (General is `general`)' },
        question: { type: 'string', description: 'The question, self-contained' },
        options: { type: 'array', items: { type: 'string' }, description: 'The options, one line each, in order (1 first); may be empty when only a free answer fits' },
        free: { type: 'boolean', description: 'Whether a free answer is welcome beside the options (default true)' },
      },
      required: ['topic', 'question', 'options'],
    },
  },
  {
    name: 'who',
    description: 'List the sessions connected to the hub: name, role, status, connected since.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'status',
    description: 'Set the one line other sessions and the human see about you in who().',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Your status line (≤ 200 chars)' } }, required: ['text'] },
  },
  {
    name: 'rename',
    description: 'Take another name (the Coordinator only: names never change for other roles). Lowercase letters, digits, hyphens, 1–24 chars; reserved: all, hub and the role names; a name another live session holds is refused.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'session.archive',
    description: 'Archive a stopped or exited session; a live session must be stopped first. The journal is retained.',
    inputSchema: { type: 'object', properties: { session: { type: 'string' } }, required: ['session'] },
  },
  {
    name: 'session.prune',
    description: 'Delete archived session records older than a stop-age duration (1s, 1m, 1h, 1d). dryRun lists names without deleting. Journal and traffic are retained.',
    inputSchema: { type: 'object', properties: { olderThan: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['olderThan'] },
  },
  {
    name: 'session.launch',
    description:
      'Launch a new harness session through the hub (its process runs in the background; the human attaches to it from the UI). Returns the session with its state and the command that attaches a terminal to it.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The new session\'s name (lowercase letters, digits, hyphens)' },
        role: { type: 'string', description: 'The role it runs under (coordinator, lead, implementer, reviewer, qa, aide); its launch defaults in .cland/roles.toml fill the harness, model, effort and account not given' },
        model: { type: 'string', description: "The model; the role's default, else the harness's, when absent" },
        harness: { type: 'string', description: "The harness (`claude-code`, `opencode`, `codex`); the role's default, else `claude-code`, when absent" },
        account: { type: 'string', description: 'Account name from accounts.toml; overrides the role account and selects its harness when harness is absent' },
        effort: { type: 'string', description: "The reasoning effort (Claude Code: low … max); the role's default when absent" },
        cwd: { type: 'string', description: 'The working directory: absolute or relative to the project root; the project root when absent' },
        item: { type: 'string', description: "A Lead's open container (at the project root), or an Implementer, Reviewer or QA item (T-12). Task worktrees are prepared first; Implementers take the claim, verifiers leave it intact. A calling Lead must name an item in its subtree. Not with cwd" },
        brief: { type: 'string', description: 'The first task: text, or an artifact id A-<n> whose content is read at launch. Delivered once after the role clause; never repeated on reconnect' },
      },
      required: ['name'],
    },
  },
  {
    name: 'history',
    description: 'Your recent traffic on the hub (sent by you or addressed to you), oldest first — what you missed while restarting. Up to 50. With topic: Agents accepts item and session filters over the whole record; both intersect.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many, at most 50 (default 50)' },
        with: { type: 'string', description: 'Only messages exchanged with this session' },
        item: { type: 'string', description: 'On Agents: an item id (T-12); notices naming it or its bound topic' },
        session: { type: 'string', description: 'On Agents: traffic from, to or about this session; intersects item when both are given' },
        topic: { type: 'string', description: "A topic id: that topic's latest messages instead of your own traffic (the topics `role.state` lists as waiting)" },
      },
    },
  },
  {
    name: 'role.handover',
    description:
      'Hand your Coordinator role or your claimed Lead node to another session, live or launched, with a handover note: the next holder continues from the note and the hub, never from your transcript. The note needs four non-empty sections: goals now, work in flight, open decisions, waiting on (an object with those keys, or Markdown with those headings; the `handover` skill drafts it). The role moves at once; a Lead receiver must be unclaimed, and its node claim and default subscriptions follow the note, and you get a "role revoked" event: from then on stop acting in the role.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'The session that takes the role' },
        note: {
          description: 'The handover note: { goals_now, work_in_flight, open_decisions, waiting_on }, or Markdown with the headings "Goals now", "Work in flight", "Open decisions", "Waiting on"',
          anyOf: [
            { type: 'string' },
            {
              type: 'object',
              properties: { goals_now: { type: 'string' }, work_in_flight: { type: 'string' }, open_decisions: { type: 'string' }, waiting_on: { type: 'string' } },
              required: ['goals_now', 'work_in_flight', 'open_decisions', 'waiting_on'],
            },
          ],
        },
        then: { type: 'string', enum: ['implementer'], description: 'Stay on as an Implementer instead of keeping no role' },
      },
      required: ['to', 'note'],
    },
  },
  {
    name: 'role.state',
    description:
      "Your role's state as the hub keeps it: the latest handover note, the topics waiting for the role (read one with `history` and its `topic`), the open asks, and the tracker claims you hold. Pull it when you take over a role.",
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

const text = (value: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

/** The event attributes for one delivered message; keys are identifiers, values strings. */
export function metaOf(message: Message, topic?: TopicRef): Record<string, string> {
  const meta: Record<string, string> = {
    from: message.from,
    from_kind: message.fromKind,
    via: message.via,
    to: message.to.join(','),
    msg_id: message.id,
    ts: message.ts,
  };
  if (message.artifacts?.length) meta.artifacts = JSON.stringify(message.artifacts);
  if (message.artifact) {
    meta.artifact_id = message.artifact.id;
    meta.artifact_path = message.artifact.path;
    meta.artifact = JSON.stringify(message.artifact);
  }
  if (message.fromRole !== undefined) meta.from_role = message.fromRole;
  if (message.replyTo !== undefined) meta.reply_to = message.replyTo;
  // a hub notice: its kind (`mute`, …) and its typed facts (a mute's refusal: code, rule, until, pair)
  if (message.kind !== undefined) meta.kind = message.kind;
  if (message.detail !== undefined) meta.detail = JSON.stringify(message.detail);
  if (message.answerTo !== undefined) meta.answer_to = message.answerTo;
  if (message.answered_as !== undefined) meta.answered_as = message.answered_as;
  if (message.answered_by !== undefined) meta.answered_by = message.answered_by;
  if (message.relayed_by !== undefined) meta.relayed_by = message.relayed_by;
  if (message.ask?.to !== undefined) meta.ask_to = message.ask.to;
  if (message.ask?.forwarded !== undefined) meta.ask_forwarded = message.ask.forwarded;
  if (topic) {
    meta.topic = topic.id;
    meta.topic_title = topic.title;
    if (topic.item) meta.topic_item = topic.item;
  } else if (message.topic !== undefined) meta.topic = message.topic;
  return meta;
}

/**
 * Delivery into the session: Claude Code's channel notification. It is the only harness-specific
 * piece of the spoke and stays here, isolated, until the adapters own delivery.
 * TODO(#24): the Claude Code adapter takes this over; Codex and OpenCode deliver through their own adapters.
 */
type ChannelNotification = Notification & {
  method: 'notifications/claude/channel';
  params: { content: string; meta?: Record<string, string> };
};
export type SpokeServer = Server<never, ChannelNotification>;
const CHANNEL_CAPABILITY = { 'claude/channel': {} };
const deliverToSession = (server: SpokeServer, message: Message, topic?: TopicRef): Promise<void> =>
  server.notification({ method: 'notifications/claude/channel', params: { content: message.digest?.length ? envelope(message, topic ?? null) : message.text, meta: metaOf(message, topic) } });

export type SpokeRuntime = { server: SpokeServer; hub: HubClient | null };

export type SpokeOptions = {
  transport?: Transport;
  exit?: (code: number) => void;
  /** Discovery and hello use this directory without changing the host process's cwd. */
  cwd?: string;
  log?: (line: string) => void;
};

const positive = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function runSpoke(env: NodeJS.ProcessEnv = process.env, options: SpokeOptions = {}): Promise<SpokeRuntime> {
  const log = options.log ?? ((line: string) => { process.stderr.write(`cland-spoke: ${line}\n`); });
  const cwd = options.cwd ?? process.cwd();
  const transport = options.transport ?? new StdioServerTransport();
  const exit = options.exit ?? ((code: number) => process.exit(code));
  let url = env.CLAND_HUB_URL?.trim();
  let secret = env.CLAND_HUB_SECRET?.trim();
  // No hub in the environment: the project's discovery file, read again before every connect.
  let endpoint: (() => { url: string; secret: string } | null) | undefined;
  const discoveryFile = !url && !secret ? env.CLAND_HUB_FILE?.trim() || findDiscovery(cwd) : null;
  if (discoveryFile) {
    endpoint = () => {
      const d = readDiscovery(discoveryFile);
      return d ? { url: `ws://127.0.0.1:${d.port}`, secret: d.secret } : null;
    };
    const first = endpoint();
    if (first) ({ url, secret } = first);
  }

  const server: SpokeServer = new Server<never, ChannelNotification>(
    { name: 'cland', version: VERSION },
    { capabilities: { experimental: CHANNEL_CAPABILITY, tools: {} }, instructions: INSTRUCTIONS },
  );

  let hub: HubClient | null = null;
  const notConfigured = 'this session is not connected to a cland hub: CLAND_HUB_URL and CLAND_HUB_SECRET are not set and no .cland/hub.json was found from the cwd up — run `cland hub start` in the project, or start the session through cland';
  const name = env.CLAND_SESSION_NAME?.trim();
  const launchToken = env.CLAND_LAUNCH_TOKEN?.trim();
  const sessionId = env.CLAND_SESSION_ID?.trim();
  const projectRoot = discoveryFile ? readDiscovery(discoveryFile)?.root : undefined;
  const clandDir = discoveryFile ? projectRoot ? join(projectRoot, '.cland') : dirname(discoveryFile) : null;
  let mapped = false;
  if (clandDir && !name && !launchToken && sessionId) {
    try { mapped = hasRoleMappedSession(join(clandDir, 'hub.db'), sessionId); }
    catch (err) { log(`could not read this session's role mapping: ${err instanceof Error ? err.message : String(err)}`); }
  }
  // A discovered project requires a name, an existing session-id role mapping, or a hub launch credential.
  // CLAND_ROLE alone is only a request; it does not bind a spare harness process to this project.
  const skipped = discoveryFile && !name && !launchToken && !mapped
    ? 'cland hub connection skipped: no CLAND_SESSION_NAME, mapped session role or hub launch credential — start the session through cland, or set CLAND_SESSION_NAME to a name assigned with `cland role set`'
    : null;

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS, ...TASK_TOOLS, ...RULE_TOOLS] }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    if (!hub) return text({ ok: false, error: skipped ?? notConfigured }, true);
    try {
      switch (req.params.name) {
        case 'subscribe': {
          const input = subscriptionInput(args.subject, args.events, args.digest, args.threshold);
          const value = await hub.request({ type: 'event.subscribe', ...input }) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'unsubscribe': {
          if (typeof args.subscription !== 'string') throw new Error('unsubscribe needs a subscription id');
          const value = await hub.request({ type: 'event.unsubscribe', subscription: args.subscription }) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'subscriptions': {
          const value = await hub.request({ type: 'event.subscriptions' }) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'verify': {
          const value = await hub.request({ ...args, type: 'suite.start', mode: args.mode ?? 'auto' } as Omit<import('../protocol.ts').SuiteStart, 'id'>, args.diagnostics === true ? 120_000 : 15_000) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'merge.queue': {
          const value = await hub.request({ type: 'merge.queue' }) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'merge': {
          if (typeof args.item !== 'string') throw new Error('merge needs an item id');
          const value = await hub.request({ type: 'merge', item: args.item, ...(args.cancel === undefined ? {} : { cancel: args.cancel as boolean }) }, 60_000) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'artifact.keep':
        case 'artifact.archive':
        case 'artifact.move': {
          const value = await hub.request({ ...args, type: req.params.name } as Omit<import('../protocol.ts').ArtifactKeep, 'id'>) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'artifact.promote': {
          const value = await hub.request({ ...args, type: 'artifact.promote' } as Omit<import('../protocol.ts').ArtifactPromote, 'id'>) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'artifact.list':
        case 'artifact.create': {
          const value = await hub.request({ ...args, type: req.params.name } as Omit<import('../protocol.ts').ArtifactCreate, 'id'>) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'send': {
          if (args.kind !== undefined && !isSendKind(args.kind)) return text({ ok: false, error: 'send kind must be progress, report, question, decision or request' }, true);
          const to = Array.isArray(args.to) ? args.to.filter((t): t is string => typeof t === 'string') : [];
          if (typeof args.text !== 'string') return text({ ok: false, error: 'send needs `text`' }, true);
          const value = (await hub.request({
            type: 'send',
            to,
            text: args.text,
            ...(isSendKind(args.kind) ? { kind: args.kind } : {}),
            ...(args.request !== undefined ? { request: args.request as import('../protocol.ts').RequestKind } : {}),
            ...(args.subject !== undefined ? { subject: args.subject as string } : {}),
            ...(args.artifacts !== undefined ? { artifacts: args.artifacts as string[] } : {}),
            ...(typeof args.reply_to === 'string' ? { replyTo: args.reply_to } : {}),
            ...(typeof args.topic === 'string' ? { topic: args.topic } : {}),
          })) as { outcomes: SendOutcome[]; topic: TopicRef };
          return text({ ok: true, outcomes: value.outcomes, topic: value.topic });
        }
        case 'topic.create': {
          if (typeof args.title !== 'string' || !args.title.trim()) return text({ ok: false, error: 'topic.create needs a `title`' }, true);
          const value = (await hub.request({ type: 'topic.create', title: args.title, ...(typeof args.item === 'string' ? { item: args.item } : {}) })) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'resolve': {
          if (typeof args.topic !== 'string') return text({ ok: false, error: 'resolve needs `topic`' }, true);
          const value = (await hub.request({ type: 'resolve', topic: args.topic })) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'ask.forward':
        case 'ask.answer': {
          if (typeof args.ask !== 'string' || (req.params.name === 'ask.answer' && typeof args.text !== 'string')) return text({ ok: false, error: 'ask.forward needs ask; ask.answer needs ask and text' }, true);
          const frame = req.params.name === 'ask.forward' ? { type: 'ask.forward' as const, ask: args.ask } : { type: 'ask.answer' as const, ask: args.ask, text: args.text as string };
          const value = await hub.request(frame) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'ask': {
          if (typeof args.topic !== 'string' || typeof args.question !== 'string') return text({ ok: false, error: 'ask needs `topic` and `question`' }, true);
          const options = Array.isArray(args.options) ? args.options.filter((o): o is string => typeof o === 'string') : [];
          const value = (await hub.request({ type: 'ask', topic: args.topic, question: args.question, options, ...(typeof args.free === 'boolean' ? { free: args.free } : {}) })) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'who': {
          const value = await hub.who();
          const note = hub.lastRefusal;
          return text({ ok: true, ...value, ...(note ? { note } : {}) });
        }
        case 'status': {
          if (typeof args.text !== 'string') return text({ ok: false, error: 'status needs `text`' }, true);
          const value = (await hub.request({ type: 'status', text: args.text })) as { status: string | null };
          return text({ ok: true, status: value.status });
        }
        case 'rename': {
          if (typeof args.name !== 'string') return text({ ok: false, error: 'rename needs `name`' }, true);
          const value = (await hub.request({ type: 'rename', name: args.name })) as { name: string };
          hub.renamed(value.name);
          return text({ ok: true, name: value.name });
        }
        case 'history': {
          const value = (await hub.request({
            type: 'history',
            ...(typeof args.limit === 'number' ? { limit: args.limit } : {}),
            ...(typeof args.with === 'string' ? { with: args.with } : {}),
            ...(typeof args.topic === 'string' ? { topic: args.topic } : {}),
            ...(typeof args.item === 'string' ? { item: args.item } : {}),
            ...(typeof args.session === 'string' ? { session: args.session } : {}),
          })) as { messages: Message[] };
          return text({ ok: true, messages: value.messages.map((m) => ({ ...metaOf(m), text: m.text })) });
        }
        case 'role.handover': {
          if (typeof args.to !== 'string') return text({ ok: false, error: 'role.handover needs `to`' }, true);
          const value = (await hub.request({
            type: 'role.handover',
            to: args.to,
            ...(typeof args.note === 'string' || (typeof args.note === 'object' && args.note !== null) ? { note: args.note as HandoverNote | string } : {}),
            ...(typeof args.then === 'string' ? { then: args.then } : {}),
          })) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'role.state': {
          const value = (await hub.request({ type: 'role.state' })) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'session.archive': {
          if (typeof args.session !== 'string') return text({ ok: false, error: 'session.archive needs `session`' }, true);
          const value = await hub.request({ type: 'session.archive', session: args.session });
          return text({ ok: true, ...(value as Record<string, unknown>) });
        }
        case 'session.prune': {
          if (typeof args.olderThan !== 'string') return text({ ok: false, error: 'session.prune needs `olderThan`' }, true);
          const value = await hub.request({ type: 'session.prune', olderThan: args.olderThan, ...(typeof args.dryRun === 'boolean' ? { dryRun: args.dryRun } : {}) });
          return text({ ok: true, ...(value as Record<string, unknown>) });
        }
        case 'session.launch': {
          if (typeof args.name !== 'string') return text({ ok: false, error: 'session.launch needs `name`' }, true);
          const value = (await hub.request(
            {
              type: 'session.launch',
              name: args.name,
              ...(typeof args.role === 'string' ? { role: args.role } : {}),
              ...(typeof args.model === 'string' ? { model: args.model } : {}),
              ...(typeof args.account === 'string' ? { account: args.account } : {}),
              ...(typeof args.harness === 'string' ? { harness: args.harness } : {}),
              ...(typeof args.effort === 'string' ? { effort: args.effort } : {}),
              ...(typeof args.cwd === 'string' ? { cwd: args.cwd } : {}),
              ...(typeof args.item === 'string' ? { item: args.item } : {}),
              ...(typeof args.brief === 'string' ? { brief: args.brief } : {}),
            },
            60_000,
          )) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        default:
          if (RULE_TOOL_NAMES.has(req.params.name)) {
            const value = await hub.request({ ...args, type: req.params.name } as DistributiveOmit<RuleRequest, 'id'>);
            return text({ ok: true, ...value as Record<string, unknown> });
          }
          if (TASK_TOOL_NAMES.has(req.params.name)) {
            const value = (await hub.request(taskFrame(req.params.name, args))) as Record<string, unknown>;
            return text({ ok: true, ...value });
          }
          return text({ ok: false, error: `unknown tool ${req.params.name}` }, true);
      }
    } catch (err) {
      // a refusal by the hub's permission table reaches the model typed: what was missing, for which role, why
      if (err instanceof Forbidden) return text({ ok: false, error: err.message, code: 'forbidden', permission: err.permission, role: err.role, reason: err.reason }, true);
      if (err instanceof Refused) return text({ ok: false, error: err.message, code: err.code, ...(err.missing ? { missing: err.missing } : {}), ...(err.files ? { files: err.files } : {}) }, true);
      // a hygiene refusal reaches the model typed too
      const refusal = err instanceof Error && 'refusal' in err ? (err as Error & { refusal: unknown }).refusal : undefined;
      return text({ ok: false, error: err instanceof Error ? err.message : String(err), ...(refusal ? { refusal } : {}) }, true);
    }
  });

  // The harness closing our stdin is the session ending: an orphaned spoke must not outlive it
  // (the hub-outage rule is "never exit on a hub failure", not "never exit").
  let ended = false;
  const stdinEnded = () => exitWithSession("the session's stdin ended");
  const stdinClosed = () => exitWithSession("the session's stdin closed");
  const removeStdinListeners = () => {
    process.stdin.removeListener('end', stdinEnded);
    process.stdin.removeListener('close', stdinClosed);
  };
  const exitWithSession = (why: string) => {
    if (ended) return;
    ended = true;
    removeStdinListeners();
    log(`${why} — exiting`);
    hub?.stop();
    exit(0);
  };
  server.onclose = () => exitWithSession('the session closed the channel');
  // The SDK's stdio transport listens for data and errors only: a parent that died leaves a spoke whose
  // stdin merely ended — an orphan holding a name on the hub. EOF on stdin is the session ending.
  if (transport instanceof StdioServerTransport) {
    process.stdin.once('end', stdinEnded);
    process.stdin.once('close', stdinClosed);
  }
  try { await server.connect(transport); }
  catch (error) { removeStdinListeners(); throw error; }
  if (ended) return { server, hub: null };

  if (skipped && clandDir) {
    log(skipped);
    const journal = new Journal(journalPath(clandDir));
    journal.write({ event: 'spoke-connection-skipped', cwd, reason: skipped });
    try { await journal.close(); }
    catch (err) { log(`could not journal the skipped connection: ${err instanceof Error ? err.message : String(err)}`); }
    return { server, hub: null };
  }

  if (!url || !secret) {
    log(notConfigured);
    return { server, hub: null };
  }

  const role = env.CLAND_ROLE?.trim();
  if (discoveryFile) log(`found the hub through ${discoveryFile}`);
  hub = new HubClient({
    url,
    secret,
    ...(endpoint ? { endpoint } : {}),
    reconnectMs: positive(env.CLAND_HUB_RECONNECT_MS, 1000),
    keepaliveMs: positive(env.CLAND_HUB_KEEPALIVE_MS, KEEPALIVE_MS),
    requestTimeoutMs: positive(env.CLAND_HUB_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS),
    welcomeTimeoutMs: positive(env.CLAND_HUB_WELCOME_TIMEOUT_MS, WELCOME_TIMEOUT_MS),
    log,
    hello: {
      // a session with no id gets a random one: two such spokes must never look like one session
      sessionId: sessionId || `anon-${randomUUID()}`,
      cwd,
      ...(name ? { name } : {}),
      ...(launchToken ? { launchToken } : {}),
      ...(role ? { role } : {}),
    },
  });
  // a session launched by an adapter is injected by it; the spoke's ack is the `delivered` stage
  const adapterDelivers = env.CLAND_DELIVERY?.trim() === 'adapter';
  if (adapterDelivers) log('delivery into the session is the adapter\'s (CLAND_DELIVERY=adapter): accepting only');
  hub.on('deliver', (message, topic) => {
    if (adapterDelivers) return;
    deliverToSession(server, message, topic).catch((err: unknown) => log(`could not deliver ${message.id} to the session: ${err instanceof Error ? err.message : String(err)}`));
  });
  // the role clause is a hub event like a message: the adapter injects it, or the channel carries it
  hub.on('role', (message, clause) => {
    if (adapterDelivers) return;
    server
      .notification({
        method: 'notifications/claude/channel',
        params: {
          content: message.text,
          meta: {
            ...metaOf(message),
            kind: 'role',
            role: clause.role ?? '',
            // a handover (#31): the note is in the text; who held the role, or where it went
            ...(clause.note ? { handover_from: clause.from ?? '' } : {}),
            ...(clause.reason !== undefined ? { reason: clause.reason } : {}),
            ...(clause.to !== undefined ? { handed_to: clause.to } : {}),
          },
        },
      })
      .catch((err: unknown) => log(`could not deliver the role clause ${message.id} to the session: ${err instanceof Error ? err.message : String(err)}`));
  });
  hub.start();
  return { server, hub };
}
