// The spoke: the MCP stdio server a session's harness spawns, and the hub client behind it. Every tool
// answers JSON text; a failure is `{ ok: false, error }` with isError set.
//
// Configuration comes from the environment the adapter launches the session with:
//   CLAND_HUB_URL       the hub's WebSocket url (loopback)
//   CLAND_HUB_SECRET    the per-project secret
//     both absent: the hub is found through `.cland/hub.json`, the nearest one walking up from the cwd,
//     re-read before every reconnect (a restarted hub listens on a new port)
//   CLAND_SESSION_ID    the harness session id; a restart of the same session takes its name back
//   CLAND_SESSION_NAME  the name to ask for; absent → the hub generates one
//   CLAND_ROLE          the role the session runs under
//   CLAND_HUB_RECONNECT_MS, CLAND_HUB_HEARTBEAT_MS, CLAND_HUB_REQUEST_TIMEOUT_MS   timings, for tests
// TODO(#24): the adapters launch sessions in the project, where discovery finds the hub.
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Notification } from '@modelcontextprotocol/sdk/types.js';
import { INSTRUCTIONS } from './instructions.ts';
import { HubClient, REQUEST_TIMEOUT_MS } from './hub-client.ts';
import { HEARTBEAT_MS, type Message, type SendOutcome } from '../protocol.ts';
import { findDiscovery, readDiscovery } from '../project.ts';

const VERSION = '0.1.0';

const TOOLS = [
  {
    name: 'send',
    description: 'Send a message to other sessions on the hub. Addressees are session names, `all`, globs over names (`impl-*`), or roles (`reviewer`) — exactly as names appear in `from` of inbound events.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Session names, globs, roles or `all`' },
        text: { type: 'string', description: 'The message' },
        reply_to: { type: 'string', description: 'msg_id of the event being answered' },
      },
      required: ['to', 'text'],
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
    description: 'Take another name. Lowercase letters, digits, hyphens, 1–24 chars; reserved: all, hub and the role names; a name another live session holds is refused.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'history',
    description: 'Your recent traffic on the hub (sent by you or addressed to you), oldest first — what you missed while restarting. Up to 50.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many, at most 50 (default 50)' },
        with: { type: 'string', description: 'Only messages exchanged with this session' },
      },
    },
  },
] as const;

const text = (value: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

/** The event attributes for one delivered message; keys are identifiers, values strings. */
export function metaOf(message: Message): Record<string, string> {
  const meta: Record<string, string> = {
    from: message.from,
    from_kind: message.fromKind,
    via: message.via,
    to: message.to.join(','),
    msg_id: message.id,
    ts: message.ts,
  };
  if (message.fromRole !== undefined) meta.from_role = message.fromRole;
  if (message.replyTo !== undefined) meta.reply_to = message.replyTo;
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
const deliverToSession = (server: SpokeServer, message: Message): Promise<void> =>
  server.notification({ method: 'notifications/claude/channel', params: { content: message.text, meta: metaOf(message) } });

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
  const discoveryFile = !url && !secret ? findDiscovery(process.cwd()) : null;
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

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS] }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    if (!hub) return text({ ok: false, error: notConfigured }, true);
    try {
      switch (req.params.name) {
        case 'send': {
          const to = Array.isArray(args.to) ? args.to.filter((t): t is string => typeof t === 'string') : [];
          if (to.length === 0 || typeof args.text !== 'string') return text({ ok: false, error: 'send needs `to` (a non-empty list of names) and `text`' }, true);
          const value = (await hub.request({ type: 'send', to, text: args.text, ...(typeof args.reply_to === 'string' ? { replyTo: args.reply_to } : {}) })) as { outcomes: SendOutcome[] };
          return text({ ok: true, outcomes: value.outcomes });
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
          })) as { messages: Message[] };
          return text({ ok: true, messages: value.messages.map((m) => ({ ...metaOf(m), text: m.text })) });
        }
        default:
          return text({ ok: false, error: `unknown tool ${req.params.name}` }, true);
      }
    } catch (err) {
      return text({ ok: false, error: err instanceof Error ? err.message : String(err) }, true);
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
    log,
    hello: {
      // a session with no id gets a random one: two such spokes must never look like one session
      sessionId: env.CLAND_SESSION_ID?.trim() || `anon-${randomUUID()}`,
      cwd: process.cwd(),
      ...(name ? { name } : {}),
      ...(role ? { role } : {}),
    },
  });
  hub.on('deliver', (message) => {
    deliverToSession(server, message).catch((err: unknown) => log(`could not deliver ${message.id} to the session: ${err instanceof Error ? err.message : String(err)}`));
  });
  hub.start();
  return { server, hub };
}
