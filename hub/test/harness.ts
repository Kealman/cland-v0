// The test harness for the two seams:
//   1. the spoke's MCP stdio surface — the real spoke process, driven by the SDK's client
//   2. the hub's WebSocket edge — an in-process hub on an ephemeral port
// Nothing here reaches into either side's state; everything goes through the seams.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { createHub, type Hub, type HubOptions } from '../src/hub/server.ts';

export const SPOKE_ENTRY = fileURLToPath(new URL('../bin/cland-spoke.ts', import.meta.url));

/** The tools the spoke serves — the one list every surface assertion reads. */
export const DOCUMENTED_TOOLS = ['history', 'rename', 'send', 'status', 'who'] as const;

export const ChannelEvent = z.object({
  method: z.literal('notifications/claude/channel'),
  params: z.object({ content: z.string(), meta: z.record(z.string(), z.string()).optional() }),
});
export type ChannelEvent = z.infer<typeof ChannelEvent>;

export const TEST_SECRET = 'test-secret';

export async function startHub(options: Partial<HubOptions> = {}): Promise<Hub> {
  return createHub({ port: 0, host: '127.0.0.1', secret: TEST_SECRET, ...options });
}

export type SpokeOptions = {
  hub: { url: string };
  secret?: string;
  /** Requested name (CLAND_SESSION_NAME). */
  name?: string;
  /** The role the session runs under (CLAND_ROLE). */
  role?: string;
  /** No hub url and secret at all — the "not started through cland" case. */
  unconfigured?: boolean;
  sessionId?: string;
  cwd?: string;
  heartbeatMs?: number;
};

export type Session = {
  client: Client;
  events: ChannelEvent[];
  waitForEvent: (predicate: (e: ChannelEvent) => boolean, timeoutMs?: number) => Promise<ChannelEvent>;
  /** Poll `who()` until every named session is present (the spoke connects asynchronously). */
  waitForPresence: (names: string[], timeoutMs?: number) => Promise<void>;
  /** Call a tool and parse its JSON text result. */
  call: <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<T>;
  /** Everything this spoke has written to stderr, for a failing assertion to quote. */
  log: () => string;
  close: () => Promise<void>;
};

/** A spoke's connect on a loaded machine: the loop returns the moment presence shows, so only a real defect pays this. */
export const PRESENCE_DEADLINE_MS = 30_000;

export async function spawnSpoke(options: SpokeOptions): Promise<Session> {
  const workDir = await mkdtemp(join(tmpdir(), 'cland-spoke-'));
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    CLAND_SESSION_ID: options.sessionId ?? 'sess-test',
    // reconnect fast in tests
    CLAND_HUB_RECONNECT_MS: '50',
    CLAND_HUB_HEARTBEAT_MS: String(options.heartbeatMs ?? 30_000),
  };
  if (!options.unconfigured) {
    env.CLAND_HUB_URL = options.hub.url;
    env.CLAND_HUB_SECRET = options.secret ?? TEST_SECRET;
  }
  if (options.name) env.CLAND_SESSION_NAME = options.name;
  if (options.role) env.CLAND_ROLE = options.role;
  const transport = new StdioClientTransport({ command: process.execPath, args: [SPOKE_ENTRY], env, cwd: options.cwd ?? workDir, stderr: 'pipe' });
  const client = new Client({ name: 'harness', version: '0.0.0' }, { capabilities: {} });
  const events: ChannelEvent[] = [];
  const waiters: Array<{ predicate: (e: ChannelEvent) => boolean; resolve: (e: ChannelEvent) => void }> = [];
  client.setNotificationHandler(ChannelEvent, async (event) => {
    events.push(event);
    for (const w of [...waiters]) {
      if (w.predicate(event)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(event);
      }
    }
  });
  await client.connect(transport);
  // Always kept, printed only when asked: a failing case can quote what the spoke decided and why.
  let log = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    log += String(chunk);
    if (process.env.CLAND_TEST_VERBOSE) process.stderr.write(`[spoke ${options.name ?? '?'}] ${chunk}`);
  });

  const call = async <T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const result = await client.callTool({ name, arguments: args });
    const content = (result.content as Array<{ type: string; text?: string }>)[0];
    if (!content || content.type !== 'text' || content.text === undefined) throw new Error(`tool ${name}: no text content`);
    return JSON.parse(content.text) as T;
  };

  const waitForEvent = (predicate: (e: ChannelEvent) => boolean, timeoutMs = 5000): Promise<ChannelEvent> => {
    const hit = events.find(predicate);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no channel event matched within ${timeoutMs}ms; saw ${JSON.stringify(events)}`)), timeoutMs);
      waiters.push({
        predicate,
        resolve: (e) => {
          clearTimeout(timer);
          resolve(e);
        },
      });
    });
  };

  const waitForPresence = async (names: string[], timeoutMs = PRESENCE_DEADLINE_MS): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    let last: unknown;
    while (Date.now() < deadline) {
      last = await call<{ ok: boolean; sessions?: Array<{ name: string }> }>('who');
      const sessions = (last as { sessions?: Array<{ name: string }> }).sessions ?? [];
      if (names.every((n) => sessions.some((d) => d.name === n))) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`presence never showed ${names.join(',')}; last who(): ${JSON.stringify(last)}\n${log}`);
  };

  return {
    client,
    events,
    log: () => log,
    waitForEvent,
    waitForPresence,
    call,
    close: async () => {
      await client.close();
      await rm(workDir, { recursive: true, force: true });
    },
  };
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Poll `who()` through `viewer` until `name` has left presence (a close is processed asynchronously). */
export async function waitForAbsence(viewer: Session, name: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const who = await viewer.call<{ sessions: Array<{ name: string }> }>('who');
    if (!who.sessions.some((d) => d.name === name)) return;
    await sleep(25);
  }
  throw new Error(`${name} never left presence within ${timeoutMs}ms`);
}
