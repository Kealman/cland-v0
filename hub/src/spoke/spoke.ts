// The spoke: the MCP stdio server a session's harness spawns, and the hub client behind it. Every tool
// answers JSON text; a failure is `{ ok: false, error }` with isError set.
//
// Configuration comes from the environment the adapter launches the session with:
//   CLAND_HUB_URL       the hub's WebSocket url (loopback)
//   CLAND_HUB_SECRET    the per-project secret
//     both absent: the hub is found through `.cland/hub.json` (CLAND_HUB_FILE names it, else the nearest one
//     walking up from the cwd), re-read before every reconnect (a restarted hub listens on a new port)
//   CLAND_SESSION_ID    the harness session id; a restart of the same session takes its name back
//   CLAND_SESSION_NAME  the name to ask for; absent → the hub generates one
//   CLAND_ROLE          the role the session asks for; a project's hub grants it only to a session it launched for
//                       that role, else the session needs a role the human assigned (`cland role set`)
//   CLAND_DELIVERY      `adapter`: the session's harness adapter injects what the spoke accepts (#24), so the spoke
//                       only acks; otherwise the spoke delivers into the session as a Claude Code channel event
//   CLAND_HUB_RECONNECT_MS, CLAND_HUB_HEARTBEAT_MS, CLAND_HUB_REQUEST_TIMEOUT_MS,
//   CLAND_HUB_WELCOME_TIMEOUT_MS   timings, for tests
import { subscriptionInput } from '../subscriptions.ts';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Notification } from '@modelcontextprotocol/sdk/types.js';
import { INSTRUCTIONS } from './instructions.ts';
import { Forbidden, HubClient, Refused, REQUEST_TIMEOUT_MS, WELCOME_TIMEOUT_MS } from './hub-client.ts';
import { TASK_TOOLS, TASK_TOOL_NAMES, taskFrame } from './task-tools.ts';
import { HEARTBEAT_MS, SEND_KINDS, isSendKind, type HandoverNote, type Message, type SendOutcome, type TopicRef } from '../protocol.ts';
import { envelope } from '../adapters/contract.ts';
import { findDiscovery, readDiscovery } from '../project.ts';

const VERSION = '0.1.0';

const TOOLS = [
  { name: 'merge', description: 'Land an open task on its base as one squash commit after clear, current hub verdicts. Coordinator only; never delegate a merge to a sub-agent.', inputSchema: { type: 'object', properties: { item: { type: 'string' } }, required: ['item'] } },
  {
    name: 'artifact.create',
    description: 'Show work through a persistent artifact in a topic. Give exactly one of path (copied) or content. Returns the artifact id and absolute path; posts its chip into the topic.',
    inputSchema: { type: 'object', properties: {
      kind: { type: 'string', enum: ['prompt', 'note', 'page', 'diagram', 'file'] }, title: { type: 'string' },
      path: { type: 'string' }, content: { type: 'string' }, topic: { type: 'string' }, status: { type: 'string', enum: ['draft', 'shared'] },
    }, required: ['kind', 'title', 'topic'] },
  },
  { name: 'artifact.promote', description: 'Copy an artifact into a project-relative repository path. Aides may promote here; the Coordinator promotes from its shell.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' }, path: { type: 'string' } }, required: ['artifact', 'path'] } },
  {
    name: 'send',
    description:
      'Send a message into a topic. Without `to` it is for the human, in the topic (General unless `topic` names another: reply in the topic an event came from); the Coordinator and Aides write to the human anywhere, another role only in a topic where the latest message of the human mentioned it. With `to` it goes to other sessions — session names, `all`, globs over names (`impl-*`), or roles (`reviewer`), exactly as names appear in `from` of inbound events (Aides use names only) — and is recorded in the topic (Agents unless `topic` names another).',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: 'Session names, globs, roles, `all` or `lead T-<n>` (the open item claimant, else Coordinator); omit to write to the human' },
        text: { type: 'string', description: 'The message' },
        kind: { type: 'string', enum: SEND_KINDS, description: 'progress waits for the next turn in a digest; report (default), question and decision start a turn' },
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
    name: 'session.launch',
    description:
      'Launch a new harness session through the hub (its process runs in the background; the human attaches to it from the UI). Returns the session with its state and the command that attaches a terminal to it.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The new session\'s name (lowercase letters, digits, hyphens)' },
        role: { type: 'string', description: 'The role it runs under (coordinator, lead, implementer, reviewer, qa, aide); its launch defaults in .cland/roles.toml fill the harness, model and effort not given' },
        model: { type: 'string', description: "The model; the role's default, else the harness's, when absent" },
        harness: { type: 'string', description: "The harness (`claude-code`, `opencode`); the role's default, else `claude-code`, when absent" },
        effort: { type: 'string', description: "The reasoning effort (Claude Code: low … max); the role's default when absent" },
        cwd: { type: 'string', description: 'The working directory: absolute or relative to the project root; the project root when absent' },
        item: { type: 'string', description: "A Lead's open epic or release (at the project root), or an Implementer's item (T-12): the session starts in the item's task worktree, made first when missing, and the item's claim becomes the session's. Not with cwd" },
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
      'Hand your role (the Coordinator) to another session, live or launched, with a handover note: the next holder continues from the note and the hub, never from your transcript. The note needs four non-empty sections: goals now, work in flight, open decisions, waiting on (an object with those keys, or Markdown with those headings; the `handover` skill drafts it). The role moves at once, your claims move with it, and you get a "role revoked" event: from then on stop acting in the role.',
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

const positive = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function runSpoke(env: NodeJS.ProcessEnv = process.env): Promise<SpokeRuntime> {
  const log = (line: string) => process.stderr.write(`cland-spoke: ${line}\n`);
  let url = env.CLAND_HUB_URL?.trim();
  let secret = env.CLAND_HUB_SECRET?.trim();
  // No hub in the environment: the project's discovery file, read again before every connect.
  let endpoint: (() => { url: string; secret: string } | null) | undefined;
  const discoveryFile = !url && !secret ? env.CLAND_HUB_FILE?.trim() || findDiscovery(process.cwd()) : null;
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

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS, ...TASK_TOOLS] }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    if (!hub) return text({ ok: false, error: notConfigured }, true);
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
        case 'merge': {
          if (typeof args.item !== 'string') throw new Error('merge needs an item id');
          const value = await hub.request({ type: 'merge', item: args.item }, 60_000) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'artifact.promote': {
          const value = await hub.request({ ...args, type: 'artifact.promote' } as Omit<import('../protocol.ts').ArtifactPromote, 'id'>) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'artifact.create': {
          const value = await hub.request({ ...args, type: 'artifact.create' } as Omit<import('../protocol.ts').ArtifactCreate, 'id'>) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'send': {
          if (args.kind !== undefined && !isSendKind(args.kind)) return text({ ok: false, error: 'send kind must be progress, report, question or decision' }, true);
          const to = Array.isArray(args.to) ? args.to.filter((t): t is string => typeof t === 'string') : [];
          if (typeof args.text !== 'string') return text({ ok: false, error: 'send needs `text`' }, true);
          const value = (await hub.request({
            type: 'send',
            to,
            text: args.text,
            ...(isSendKind(args.kind) ? { kind: args.kind } : {}),
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
        case 'session.launch': {
          if (typeof args.name !== 'string') return text({ ok: false, error: 'session.launch needs `name`' }, true);
          const value = (await hub.request(
            {
              type: 'session.launch',
              name: args.name,
              ...(typeof args.role === 'string' ? { role: args.role } : {}),
              ...(typeof args.model === 'string' ? { model: args.model } : {}),
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
  const exitWithSession = (why: string) => {
    log(`${why} — exiting`);
    hub?.stop();
    process.exit(0);
  };
  server.onclose = () => exitWithSession('the session closed the channel');
  // The SDK's stdio transport listens for data and errors only: a parent that died leaves a spoke whose
  // stdin merely ended — an orphan holding a name on the hub. EOF on stdin is the session ending.
  process.stdin.once('end', () => exitWithSession("the session's stdin ended"));
  process.stdin.once('close', () => exitWithSession("the session's stdin closed"));
  await server.connect(new StdioServerTransport());

  if (!url || !secret) {
    log(notConfigured);
    return { server, hub: null };
  }

  const name = env.CLAND_SESSION_NAME?.trim();
  const role = env.CLAND_ROLE?.trim();
  if (discoveryFile) log(`found the hub through ${discoveryFile}`);
  hub = new HubClient({
    url,
    secret,
    ...(endpoint ? { endpoint } : {}),
    reconnectMs: positive(env.CLAND_HUB_RECONNECT_MS, 1000),
    heartbeatMs: positive(env.CLAND_HUB_HEARTBEAT_MS, HEARTBEAT_MS),
    requestTimeoutMs: positive(env.CLAND_HUB_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS),
    welcomeTimeoutMs: positive(env.CLAND_HUB_WELCOME_TIMEOUT_MS, WELCOME_TIMEOUT_MS),
    log,
    hello: {
      // a session with no id gets a random one: two such spokes must never look like one session
      sessionId: env.CLAND_SESSION_ID?.trim() || `anon-${randomUUID()}`,
      cwd: process.cwd(),
      ...(name ? { name } : {}),
      ...(env.CLAND_LAUNCH_TOKEN ? { launchToken: env.CLAND_LAUNCH_TOKEN } : {}),
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
