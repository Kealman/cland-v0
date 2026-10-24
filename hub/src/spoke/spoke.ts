import type { Clock } from '../hub/clock.ts';
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
import { sendRecipients } from '../send-input.ts';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Notification } from '@modelcontextprotocol/sdk/types.js';
import { INSTRUCTIONS } from './instructions.ts';
import { TOOLS } from './tools.ts';
import { InvalidArgument, validateToolArguments } from '../tool-arguments.ts';
import { Forbidden, HubClient, Refused, REQUEST_TIMEOUT_MS, WELCOME_TIMEOUT_MS } from './hub-client.ts';
import { RULE_TOOL_NAMES } from './rule-tools.ts';
import type { RuleRequest } from '../protocol.ts';
import type { DistributiveOmit } from './hub-client.ts';
import { TASK_TOOL_NAMES, taskFrame } from './task-tools.ts';
import { KEEPALIVE_MS, isSendKind, type HandoverNote, type Message, type SendOutcome, type TopicRef } from '../protocol.ts';
import { envelope } from '../adapters/contract.ts';
import { findDiscovery, readDiscovery } from '../project.ts';
import { Journal, journalPath } from '../hub/journal.ts';
import { hasRoleMappedSession } from '../hub/store.ts';
import { VERSION } from '../version.ts';


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
  clock?: Clock;
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

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS] }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    if (!hub) return text({ ok: false, error: skipped ?? notConfigured }, true);
    try {
      validateToolArguments(req.params.name, args);
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
          const value = await hub.request({ ...args, type: 'suite.start', mode: args.mode === undefined ? 'auto' : args.mode } as Omit<import('../protocol.ts').SuiteStart, 'id'>, args.diagnostics === true ? 120_000 : 15_000) as Record<string, unknown>;
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
        case 'artifact.create': {
          // Folder publication queues behind other creations and copies files serially;
          // allow two minutes for that work rather than the ordinary loopback reply budget.
          const value = await hub.request({ ...args, type: 'artifact.create' } as Omit<import('../protocol.ts').ArtifactCreate, 'id'>, 120_000) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'artifact.list': {
          const value = await hub.request({ ...args, type: 'artifact.list' } as Omit<import('../protocol.ts').ArtifactList, 'id'>) as Record<string, unknown>;
          return text({ ok: true, ...value });
        }
        case 'send': {
          if (args.kind !== undefined && !isSendKind(args.kind)) return text({ ok: false, error: 'send kind must be progress, report, question, decision or request' }, true);
          const to = sendRecipients(args.to);
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
      if (err instanceof InvalidArgument) return text({ ok: false, error: err.message, code: err.code, reason: err.reason }, true);
      // a refusal by the hub's permission table reaches the model typed: what was missing, for which role, why
      if (err instanceof Forbidden) return text({ ok: false, error: err.message, code: 'forbidden', permission: err.permission, role: err.role, reason: err.reason }, true);
      if (err instanceof Refused) return text({ ok: false, error: err.message, code: err.code, ...(err.reason !== undefined ? { reason: err.reason } : {}), ...(err.missing ? { missing: err.missing } : {}), ...(err.files ? { files: err.files } : {}) }, true);
      // a hygiene refusal reaches the model typed too
      // cland-allow-in: Error subclasses may expose a hygiene refusal through their prototype.
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
    ...(options.clock ? { clock: options.clock } : {}),
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
