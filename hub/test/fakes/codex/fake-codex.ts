// A fake Codex: the harness process boundary the Codex adapter is tested against. It honours the surfaces the
// adapter uses, as Codex 0.160.0 does, and nothing else:
//
//   codex --version                       `codex-cli 0.160.0`
//   codex login status                    `Logged in using ChatGPT`; FAKE_CODEX_LOGGED_OUT=1: `Not logged in`, exit 1
//   codex app-server --listen unix://PATH [-c key=value]...
//       JSON-RPC over a WebSocket on the Unix socket: `initialize`, `thread/start`, `thread/resume` (refused with
//       "no rollout found" until the thread had a turn, as the real one), `thread/read`, `turn/start` (with `input`
//       or a `toolOutput`; steers when a turn is active), `turn/steer` (checks `expectedTurnId`),
//       `account/rateLimits/read`. Pushes `thread/status/changed` to every initialized connection and `thread/started`,
//       `turn/started`, `turn/completed`, `thread/tokenUsage/updated` to the thread's subscribers.
//       The MCP servers come from the `-c mcp_servers.<name>.*` overrides; each is started (the real spoke, which
//       connects to the real hub) with only its configured environment beside PATH and HOME.
//       A turn answers each cland envelope it got (as input, tool output or steer) with a `send` through the spoke,
//       "pong: <text>", into the message's topic. A message containing "needs approval" first sets the model's own
//       status line to "idle" through the spoke's `status` tool (the hub must not take it for the state), then asks
//       for a command approval (`item/commandExecution/requestApproval` to the subscribers, status
//       `active [waitingOnApproval]`) and waits for a client's answer, SIGUSR1, or the file `approve` in FAKE_CODEX_HOME.
//   codex resume --remote unix://PATH --cd DIR THREAD
//       exits 2 when any `-c`/`--config`/`--profile`/`-p`/`--enable`/`--disable` is on its command line (the
//       embedded-mode trap); otherwise joins the thread with `thread/resume` and prints
//       `fake codex attached to thread <id> (<status>) in <dir>`.
//
// State lives under FAKE_CODEX_HOME: servers/<pid>.json (pid, socket, argv), threads/<id>.json (the "rollout"),
// log/<pid>.log. FAKE_CODEX_TURN_MS is how long each answer "thinks" (default 300).
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import WebSocket, { WebSocketServer } from 'ws';

const VERSION = '0.160.0';
const HOME = process.env.FAKE_CODEX_HOME ?? join(process.env.TMPDIR ?? '/tmp', 'fake-codex-home');
for (const d of ['servers', 'threads', 'log']) mkdirSync(join(HOME, d), { recursive: true });
const TURN_MS = Number(process.env.FAKE_CODEX_TURN_MS ?? 300);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
};
const flag = (args: string[], name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

type Status = { type: 'idle' } | { type: 'notLoaded' } | { type: 'active'; activeFlags: string[] };
type ThreadFile = { id: string; cwd: string; model: string; turns: number };

// ------------------------------------------------------------------ the CLI

async function main(args: string[]): Promise<number> {
  if (args[0] === '--version' || args[0] === '-V') {
    process.stdout.write(`codex-cli ${VERSION}\n`);
    return 0;
  }
  if (args[0] === 'login' && args[1] === 'status') {
    if (process.env.FAKE_CODEX_LOGGED_OUT === '1') {
      process.stderr.write('Not logged in\n');
      return 1;
    }
    process.stderr.write('Logged in using ChatGPT\n');
    return 0;
  }
  if (args[0] === 'app-server') return appServer(args.slice(1));
  if (args[0] === 'resume') return resume(args.slice(1));
  process.stderr.write(`fake codex: unsupported invocation ${JSON.stringify(args)}\n`);
  return 1;
}

async function resume(args: string[]): Promise<number> {
  const forbidden = args.filter((a) => ['-c', '--config', '-p', '--profile', '--enable', '--disable'].includes(a) || a.startsWith('--config=') || a.startsWith('--profile='));
  if (forbidden.length) {
    process.stderr.write(`fake codex: ${forbidden.join(' ')} on the TUI puts it in embedded mode; refused\n`);
    return 2;
  }
  const remote = flag(args, '--remote');
  const cd = flag(args, '--cd') ?? flag(args, '-C') ?? process.cwd();
  const positional = args.filter((a, i) => !a.startsWith('-') && !['--remote', '--cd', '-C'].includes(args[i - 1] ?? ''));
  const threadId = positional[0];
  if (!remote?.startsWith('unix://') || !threadId) {
    process.stderr.write('fake codex: resume needs --remote unix://PATH and a thread id\n');
    return 1;
  }
  const ws = new WebSocket(`ws+unix://${remote.slice('unix://'.length)}:/`, { perMessageDeflate: false });
  const answers = new Map<number, (m: Record<string, unknown>) => void>();
  ws.on('message', (data) => {
    const m = JSON.parse(String(data)) as Record<string, unknown>;
    if (typeof m.id === 'number' && m.method === undefined) answers.get(m.id)?.(m);
  });
  const ask = (id: number, method: string, params: unknown) =>
    new Promise<Record<string, unknown>>((resolve) => {
      answers.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  try {
    await new Promise<void>((resolve, reject) => (ws.once('open', () => resolve()), ws.once('error', reject)));
  } catch (err) {
    process.stderr.write(`fake codex: cannot connect to ${remote}: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
  await ask(1, 'initialize', { clientInfo: { name: 'codex-tui', version: VERSION } });
  ws.send(JSON.stringify({ method: 'initialized' }));
  const r = await ask(2, 'thread/resume', { threadId });
  ws.close();
  if (r.error) {
    process.stderr.write(`fake codex: ${(r.error as { message: string }).message}\n`);
    return 1;
  }
  const status = ((r.result as { thread: { status: Status } }).thread.status as Status).type;
  process.stdout.write(`fake codex attached to thread ${threadId} (${status}) in ${cd}\n`);
  return 0;
}

// ------------------------------------------------------------------ the app-server

type Conn = { ws: WebSocket; initialized: boolean; subscribed: Set<string> };
type Item = { text: string };
type Thread = ThreadFile & { status: Status; turnId: string | null; queue: Item[]; tokens: number };

async function appServer(args: string[]): Promise<number> {
  const listen = flag(args, '--listen') ?? '';
  if (!listen.startsWith('unix://')) {
    process.stderr.write('fake codex: only --listen unix://PATH is faked\n');
    return 1;
  }
  const socket = listen.slice('unix://'.length);
  const logFile = join(HOME, 'log', `${process.pid}.log`);
  const log = (line: string) => appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  writeFileSync(join(HOME, 'servers', `${process.pid}.json`), JSON.stringify({ pid: process.pid, socket, argv: args, cwd: process.cwd() }));
  log(`app-server ${JSON.stringify(args)}`);

  // `-c key=value`: the value is TOML; the overrides cland passes are JSON-compatible
  const config: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '-c') continue;
    const kv = args[++i] ?? '';
    const eq = kv.indexOf('=');
    const key = kv.slice(0, eq);
    const raw = kv.slice(eq + 1);
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
    let node = config;
    const parts = key.split('.');
    for (const part of parts.slice(0, -1)) node = (node[part] ??= {}) as Record<string, unknown>;
    node[parts.at(-1) as string] = value;
  }

  // the MCP servers, started once: the real spoke, connected to the real hub
  const mcp = new Map<string, Client>();
  type Server = { command: string; args?: string[]; env?: Record<string, string>; enabled?: boolean };
  const mcpReady = (async () => {
    for (const [name, server] of Object.entries((config.mcp_servers ?? {}) as Record<string, Server>)) {
      if (server.enabled === false) continue;
      const client = new Client({ name: 'fake-codex', version: VERSION }, { capabilities: {} });
      const env: Record<string, string> = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...(server.env ?? {}) };
      const transport = new StdioClientTransport({ command: server.command, args: server.args ?? [], env, cwd: process.cwd(), stderr: 'pipe' });
      transport.stderr?.on('data', (c: Buffer) => log(`[mcp ${name}] ${String(c).trim()}`));
      await client.connect(transport);
      mcp.set(name, client);
      log(`mcp ${name} ready`);
    }
  })().catch((err: unknown) => log(`mcp startup failed: ${err instanceof Error ? err.message : String(err)}`));
  const callTool = async (name: string, toolArgs: Record<string, unknown>) => {
    const client = mcp.get('cland');
    if (!client) return null;
    const r = await client.callTool({ name, arguments: toolArgs });
    const text = (r.content as Array<{ text?: string }>)[0]?.text ?? '';
    log(`tool ${name} → ${text}`);
    return text;
  };

  const conns = new Set<Conn>();
  const threads = new Map<string, Thread>();
  const pendingApprovals = new Map<string, () => void>();
  let approveAll: (() => void) | null = null;
  const send = (c: Conn, frame: unknown) => {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(frame));
  };
  const toSubscribers = (threadId: string, method: string, params: unknown) => {
    for (const c of conns) if (c.subscribed.has(threadId)) send(c, { method, params });
  };
  const setStatus = (t: Thread, status: Status) => {
    t.status = status;
    log(`status ${t.id} ${JSON.stringify(status)}`);
    // broadcast to every initialized connection, subscribed or not
    for (const c of conns) if (c.initialized) send(c, { method: 'thread/status/changed', params: { threadId: t.id, status } });
  };
  const view = (t: Thread) => ({ id: t.id, cwd: t.cwd, model: t.model, status: t.status, ephemeral: false, cliVersion: VERSION, turns: [] });
  const save = (t: Thread) => writeFileSync(join(HOME, 'threads', `${t.id}.json`), JSON.stringify({ id: t.id, cwd: t.cwd, model: t.model, turns: t.turns } satisfies ThreadFile));
  const load = (id: string): Thread | null => {
    const loaded = threads.get(id);
    if (loaded) return loaded;
    const file = readJson<ThreadFile>(join(HOME, 'threads', `${id}.json`));
    if (!file || file.turns === 0) return null;
    const t: Thread = { ...file, status: { type: 'idle' }, turnId: null, queue: [], tokens: 0 };
    threads.set(id, t);
    return t;
  };

  const waitForApproval = (t: Thread, itemId: string) =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearInterval(poll);
        pendingApprovals.delete(itemId);
        approveAll = null;
        resolve();
      };
      pendingApprovals.set(itemId, done);
      approveAll = done;
      const control = join(HOME, 'approve');
      const poll = setInterval(() => {
        if (existsSync(control)) {
          rmSync(control, { force: true });
          done();
        }
      }, 50);
      let n = 0;
      for (const c of conns) if (c.subscribed.has(t.id)) send(c, { id: `approval-${itemId}-${n++}`, method: 'item/commandExecution/requestApproval', params: { threadId: t.id, turnId: t.turnId, itemId, command: 'touch approved' } });
    });

  const runTurn = async (t: Thread) => {
    const turnId = t.turnId as string;
    for (let item = t.queue.shift(); item; item = t.queue.shift()) {
      log(`turn ${turnId} item: ${item.text}`);
      await sleep(TURN_MS);
      const body = /<channel [^>]*>\n([\s\S]*?)\n<\/channel>/.exec(item.text)?.[1];
      if (body === undefined) continue; // the clause, or text that is no cland message: nothing to answer
      if (body.includes('needs approval')) {
        await callTool('status', { text: 'idle' });
        const itemId = randomUUID();
        setStatus(t, { type: 'active', activeFlags: ['waitingOnApproval'] });
        await waitForApproval(t, itemId);
        for (const c of conns) if (c.subscribed.has(t.id)) send(c, { method: 'serverRequest/resolved', params: { threadId: t.id, requestId: itemId } });
        setStatus(t, { type: 'active', activeFlags: [] });
        await sleep(TURN_MS);
      }
      const topic = /\btopic="([^"]+)"/.exec(item.text)?.[1];
      const msgId = /\bmsg_id="([^"]+)"/.exec(item.text)?.[1];
      await callTool('send', { text: `pong: ${body}`, ...(topic ? { topic } : {}), ...(msgId ? { reply_to: msgId } : {}) });
    }
    t.tokens += 12;
    const usage = { totalTokens: 12, inputTokens: 10, cachedInputTokens: 0, outputTokens: 2, reasoningOutputTokens: 0 };
    toSubscribers(t.id, 'thread/tokenUsage/updated', { threadId: t.id, turnId, tokenUsage: { total: { ...usage, totalTokens: t.tokens }, last: usage, modelContextWindow: 200000 } });
    t.turns += 1;
    save(t);
    t.turnId = null;
    // as the real one: idle is sent before turn/completed
    setStatus(t, { type: 'idle' });
    toSubscribers(t.id, 'turn/completed', { threadId: t.id, turn: { id: turnId, status: 'completed', items: [] } });
  };

  const textOf = (params: Record<string, unknown>): string => {
    const tool = params.toolOutput as { name?: string; output?: unknown } | undefined;
    if (tool && typeof tool.output === 'string') return tool.output;
    return ((params.input ?? []) as Array<{ type: string; text?: string }>).map((i) => i.text ?? '').join('\n');
  };

  type Answer = { result: unknown } | { error: { code: number; message: string } };
  const handle = async (c: Conn, method: string, params: Record<string, unknown>): Promise<Answer> => {
    switch (method) {
      case 'initialize':
        c.initialized = true;
        return { result: { userAgent: `fake-codex/${VERSION}`, platformFamily: 'unix' } };
      case 'thread/start': {
        await mcpReady;
        const t: Thread = { id: randomUUID(), cwd: (params.cwd as string) ?? process.cwd(), model: (params.model as string) ?? 'gpt-fake-1', turns: 0, status: { type: 'idle' }, turnId: null, queue: [], tokens: 0 };
        threads.set(t.id, t);
        save(t);
        c.subscribed.add(t.id);
        setImmediate(() => toSubscribers(t.id, 'thread/started', { thread: view(t) }));
        return { result: { thread: view(t), model: t.model } };
      }
      case 'thread/resume': {
        const t = load(params.threadId as string);
        if (!t || t.turns === 0) return { error: { code: -32600, message: `no rollout found for thread id ${String(params.threadId)}` } };
        if (typeof params.model === 'string') t.model = params.model;
        c.subscribed.add(t.id);
        return { result: { thread: view(t), model: t.model } };
      }
      case 'thread/read': {
        const t = threads.get(params.threadId as string) ?? load(params.threadId as string);
        if (!t) return { error: { code: -32600, message: `thread not found: ${String(params.threadId)}` } };
        return { result: { thread: view(t) } };
      }
      case 'turn/start': {
        const t = threads.get(params.threadId as string);
        if (!t) return { error: { code: -32600, message: `thread not loaded: ${String(params.threadId)}` } };
        const text = textOf(params);
        if (t.turnId) {
          // an active turn: turn/start steers it
          t.queue.push({ text });
          log(`steered by turn/start: ${text}`);
          return { result: { turn: { id: t.turnId, status: 'inProgress', items: [] } } };
        }
        t.turnId = randomUUID();
        t.queue.push({ text });
        log(`turn/start ${params.toolOutput ? `toolOutput ${(params.toolOutput as { name: string }).name}` : 'input'}`);
        setStatus(t, { type: 'active', activeFlags: [] });
        toSubscribers(t.id, 'turn/started', { threadId: t.id, turn: { id: t.turnId, status: 'inProgress', items: [] } });
        void runTurn(t);
        return { result: { turn: { id: t.turnId, status: 'inProgress', items: [] } } };
      }
      case 'turn/steer': {
        const t = threads.get(params.threadId as string);
        if (!t?.turnId) return { error: { code: -32600, message: 'no active turn to steer' } };
        if (params.expectedTurnId !== t.turnId) return { error: { code: -32600, message: `expected turn ${String(params.expectedTurnId)}, active turn is ${t.turnId}` } };
        const text = textOf(params);
        t.queue.push({ text });
        log(`turn/steer ${t.turnId}: ${text}`);
        return { result: { turnId: t.turnId } };
      }
      case 'account/rateLimits/read':
        return { result: { rateLimits: { limitId: 'codex', primary: { usedPercent: 6, windowDurationMins: 10080, resetsAt: 1791955620 }, secondary: null } } };
      default:
        return { error: { code: -32601, message: `method not found: ${method}` } };
    }
  };

  const http = createServer();
  const wss = new WebSocketServer({ server: http, perMessageDeflate: false });
  wss.on('connection', (ws) => {
    const c: Conn = { ws, initialized: false, subscribed: new Set() };
    conns.add(c);
    ws.on('close', () => conns.delete(c));
    ws.on('message', (data) => {
      const m = JSON.parse(String(data)) as { id?: string | number; method?: string; params?: Record<string, unknown>; result?: unknown };
      if (m.method === undefined) {
        // a client's answer to an approval request
        const itemId = typeof m.id === 'string' ? /^approval-(.+)-\d+$/.exec(m.id)?.[1] : undefined;
        if (itemId) pendingApprovals.get(itemId)?.();
        return;
      }
      if (m.id === undefined) return; // a notification (`initialized`)
      void handle(c, m.method, m.params ?? {}).then((answer) => send(c, { id: m.id, ...answer }));
    });
  });
  rmSync(socket, { force: true });
  await new Promise<void>((resolve) => http.listen(socket, resolve));
  log('listening');

  process.on('SIGUSR1', () => approveAll?.());
  const shutdown = async () => {
    log('SIGTERM');
    for (const client of mcp.values()) await client.close().catch(() => {});
    for (const c of conns) c.ws.terminate();
    http.close();
    rmSync(socket, { force: true });
    rmSync(join(HOME, 'servers', `${process.pid}.json`), { force: true });
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
  await new Promise<never>(() => {});
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
