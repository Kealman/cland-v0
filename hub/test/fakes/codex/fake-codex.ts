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
//       Every further `thread/start` starts the servers again, as the real app-server does: a second spoke with the
//       session's identity, while the first thread's turns keep calling their tools through the first.
//       A turn answers each cland envelope it got (as input, tool output or steer) with a `send` through the spoke,
//       "pong: <text>", into the message's topic. A message containing "needs approval" first sets the model's own
//       status line to "idle" through the spoke's `status` tool (the hub must not take it for the state), then asks
//       for a command approval (`item/commandExecution/requestApproval` to the subscribers, status
//       `active [waitingOnApproval]`) and waits for a client's answer, SIGUSR1, or the file `approve` in FAKE_CODEX_HOME.
//       Scripted review and QA (#41): when FAKE_CODEX_HOME holds `verdicts.json` ({"review"?: Script, "qa"?: Script},
//       Script = {result, text, run}) and a message's first line is `review request T-n` or `qa request T-n`, the
//       answer is what the Reviewer and QA clauses ask for instead of the pong: a `task.comment` on T-n with the
//       verdict header, then a `send` back to the sender: `<kind> <result> T-n (run <run>)`, or, when the hub refused
//       the comment, `<kind> refused T-n: <error>`.
//   codex resume --remote unix://PATH --cd DIR THREAD
//       exits 2 when any `-c`/`--config`/`--profile`/`-p`/`--enable`/`--disable` is on its command line (the
//       embedded-mode trap); otherwise joins the thread with `thread/resume` and prints
//       `fake codex attached to thread <id> (<status>) in <dir>`.
//
//   Failure modes for the hub's robustness tests: FAKE_CODEX_FAIL_FIRST_TURN=1 refuses a thread's first turn once the
//   spoke is in the hub (its `who` answers: a launch that fails after the session said hello); a message whose text contains "lose the answer" runs as a turn but its
//   `turn/start` (or `turn/steer`) result is never sent, the first time only (an ambiguous inject); one containing
//   "garble the answer" starts its turn and answers with a frame that is not JSON, and one containing "drop the
//   connection" starts its turn and drops the client's connection instead of answering (the first time only); SIGUSR2 drops every
//   client connection and refuses new ones for FAKE_CODEX_REFUSE_MS (default 1500; a lost connection while the
//   app-server lives). A body `rename to <name>` calls the spoke's `rename` tool before the pong. Each `turn/start`
//   logs its `effort` when given. A turn announces each input it takes up (`item/completed`): as the real 0.160.0, a
//   `toolOutput` is a `functionCallOutput` item (`name`, `namespace`, `output`) and text input a `userMessage`; and
//   `thread/read` with `includeTurns` returns the turns with those items. A steer whose text contains "drop this
//   steer" is accepted (its result says so) and never taken up, the first time only. Each `thread/start` and `thread/resume` logs its params as one line of JSON, and is
//   refused when it names `permissions` together with `sandbox`, or a `permissions` id that is neither built-in
//   (`:read-only`, `:workspace`, `:danger-full-access`) nor defined by a `-c permissions.<id>=…` override on the
//   command line. (The real one also accepts a profile defined in the request's `config`, and then fails every turn
//   with "failed to load workspace requirements": the fake refuses that at once.)
//
// T-50 ordering probes: "late rejected/unanswered steer" waits for release-steer-response after completion;
// "pending steer response" answers after completion (accept/accept dropped/reject). The file new-turn-during-read
// starts a newer turn at readback, held until release-newer-turn; "drop recovery in newer turn" drops that recovery
// once. "fail recovered turn before response" completes the recovery as failed before replying; "refuse recovered
// request" refuses it, and "drop every recovery" admits empty recovery turns to test the bounded failure outcome.
// T-68: an input containing "record an unknown item" is recorded as an item of a type no Codex has (`hubInput`), as
// a future app-server might, so the hub's reader cannot classify the turn; one containing "leave unannounced" is
// recorded but never announced (`item/completed` missed), so only the turn's record shows it; one containing "lose
// its envelope" is recorded as a `userMessage` holding only the body (a shape the input was not sent in, no
// envelope id); a thread whose turns hold "fail the readback" refuses `thread/read` with `includeTurns`.
// Launch admission probes: hold-version / hold-thread-start wait for release-version / release-thread-start,
// publishing version-running / thread-start-running before their response.
// Recovery probes: hold-thread-resume waits for release-thread-resume, publishing thread-resume-running;
// fail-thread-resume or cannot-resume refuses native resume without ending the server; fresh thread/start still works.
// State lives under FAKE_CODEX_HOME: servers/<pid>.json (pid, socket, argv, its CLAND_* environment and PATH), threads/<id>.json (the "rollout"),
// log/<pid>.log. FAKE_CODEX_TURN_MS is how long each answer "thinks" (default 300). FAKE_CODEX_TERM_DELAY_MS is how long the
// app-server takes to exit after SIGTERM (default 0), its turn running on meanwhile.
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

type VerdictKind = 'review' | 'qa';
type VerdictScript = { result: 'clear' | 'not clear'; text: string; run: string };
const parseJson = <T>(text: string | null): T | null => {
  try {
    return text === null ? null : (JSON.parse(text) as T);
  } catch {
    return null;
  }
};

type Status = { type: 'idle' } | { type: 'notLoaded' } | { type: 'active'; activeFlags: string[] };
type ThreadFile = { id: string; cwd: string; model: string; turns: number };

// ------------------------------------------------------------------ the CLI

async function main(args: string[]): Promise<number> {
  if (args[0] === '--version' || args[0] === '-V') {
    appendFileSync(join(HOME, 'version-probes.jsonl'), JSON.stringify({ CODEX_HOME: process.env.CODEX_HOME ?? null }) + '\n');
    if (existsSync(join(HOME, 'hold-version'))) {
      writeFileSync(join(HOME, 'version-running'), 'ready');
      while (!existsSync(join(HOME, 'release-version'))) await sleep(5);
    }
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
type Item = { text: string; tool?: { name: string; namespace?: string } | undefined };
type TurnItem =
  | { type: 'userMessage'; id: string; content: Array<{ type: 'text'; text: string }> }
  | { type: 'functionCallOutput'; id: string; name: string; namespace: string | null; output: string }
  | { type: 'hubInput'; id: string; payload: string };
type TurnRecord = { id: string; status: string; items: TurnItem[] };
type Thread = ThreadFile & { status: Status; turnId: string | null; queue: Item[]; tokens: number; history?: TurnRecord[] };

async function appServer(args: string[]): Promise<number> {
  const listen = flag(args, '--listen') ?? '';
  if (!listen.startsWith('unix://')) {
    process.stderr.write('fake codex: only --listen unix://PATH is faked\n');
    return 1;
  }
  const socket = listen.slice('unix://'.length);
  const logFile = join(HOME, 'log', `${process.pid}.log`);
  const log = (line: string) => appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  writeFileSync(join(HOME, 'servers', `${process.pid}.json`), JSON.stringify({ pid: process.pid, socket, argv: args, cwd: process.cwd(), env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('CLAND_') || k === 'CODEX_HOME')), path: process.env.PATH ?? '' }));
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
  type Server = { command: string; args?: string[]; env?: Record<string, string>; env_vars?: string[]; enabled?: boolean };
  // One set of MCP server processes per thread, as the real app-server starts them (measured with 0.160.0: every
  // `thread/start` spawns the configured servers again, with the same environment). The first set is the session's
  // thread's: its turns call their tools through it for as long as the app-server lives.
  const startMcp = async (): Promise<void> => {
    for (const [name, server] of Object.entries((config.mcp_servers ?? {}) as Record<string, Server>)) {
      if (server.enabled === false) continue;
      const client = new Client({ name: 'fake-codex', version: VERSION }, { capabilities: {} });
      const env: Record<string, string> = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...(server.env ?? {}) };
      for (const key of server.env_vars ?? []) {
        const value = process.env[key];
        if (value !== undefined) env[key] = value;
      }
      const transport = new StdioClientTransport({ command: server.command, args: server.args ?? [], env, cwd: process.cwd(), stderr: 'pipe' });
      transport.stderr?.on('data', (c: Buffer) => log(`[mcp ${name}] ${String(c).trim()}`));
      await client.connect(transport);
      const first = !mcp.has(name);
      if (first) mcp.set(name, client);
      log(`mcp ${name} ready${first ? '' : ' (another thread\'s)'}`);
    }
  };
  const mcpReady = startMcp().catch((err: unknown) => log(`mcp startup failed: ${err instanceof Error ? err.message : String(err)}`));
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
  let usedPercent = 6;
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

  const waitForApproval = (t: Thread, itemId: string, fileApproval = false) =>
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
      for (const c of conns) if (c.subscribed.has(t.id)) send(c, { id: `approval-${itemId}-${n++}`, method: fileApproval ? 'item/fileChange/requestApproval' : 'item/commandExecution/requestApproval', params: { threadId: t.id, turnId: t.turnId, itemId, ...(fileApproval ? { content: 'PRIVATE-TOOL-INPUT' } : { command: 'touch approved' }) } });
    });

  const runTurn = async (t: Thread) => {
    let repeatUsage = false;
    let limitsOnly = false;
    let usageBurst = false;
    const turnId = t.turnId as string;
    let error: { message: string } | null = null;
    const record: TurnRecord = { id: turnId, status: 'inProgress', items: [] };
    (t.history ??= []).push(record);
    for (let item = t.queue.shift(); item; item = t.queue.shift()) {
      // Consumption receipts separate real harness inputs from RPC admission/debug echoes.
      appendFileSync(join(HOME, 'log', `${process.pid}.inputs.jsonl`), `${JSON.stringify({ turnId, text: item.text })}\n`);
      log(`turn ${turnId} item: ${item.text}`);
      // as the real one: an input the turn takes up becomes an item of the turn, and is announced; a tool output is a
      // functionCallOutput (measured with 0.160.0, T-68), text input a userMessage
      const taken: TurnItem = item.text.includes('record an unknown item')
        ? { type: 'hubInput', id: randomUUID(), payload: item.text }
        : item.text.includes('lose its envelope')
          ? { type: 'userMessage', id: randomUUID(), content: [{ type: 'text', text: /<channel [^>]*>\n([\s\S]*?)\n<\/channel>/.exec(item.text)?.[1] ?? '' }] }
          : item.tool
            ? { type: 'functionCallOutput', id: `fco_${randomUUID()}`, name: item.tool.name, namespace: item.tool.namespace ?? null, output: item.text }
            : { type: 'userMessage', id: randomUUID(), content: [{ type: 'text', text: item.text }] };
      record.items.push(taken);
      repeatUsage ||= item.text.includes('repeat usage');
      limitsOnly ||= item.text.includes('rate limits only');
      usageBurst ||= item.text.includes('usage burst');
      if (!item.text.includes('leave unannounced')) toSubscribers(t.id, 'item/completed', { threadId: t.id, turnId, item: taken });
      if (item.text === 'newer recovery turn') {
        while (!existsSync(join(HOME, 'release-newer-turn'))) await sleep(5);
      }
      await sleep(TURN_MS);
      const body = /<channel [^>]*>\n([\s\S]*?)\n<\/channel>/.exec(item.text)?.[1];
      if (body?.includes('spawn legacy subagent')) {
        toSubscribers(t.id, 'item/completed', { threadId: t.id, turnId, item: { type: 'collabAgentToolCall', id: randomUUID(), tool: 'spawnAgent', status: 'completed', senderThreadId: t.id, receiverThreadIds: ['legacy-child'], model: 'gpt-legacy-1', prompt: null, reasoningEffort: null, agentsStates: {} } });
      }
      if (body?.includes('spawn subagents')) {
        for (const [agentThreadId, model] of [['known-child', 'gpt-child-1'], ['unknown-child', null]]) {
          toSubscribers(t.id, 'item/completed', { threadId: t.id, turnId, item: { type: 'collabAgentToolCall', id: randomUUID(), tool: 'spawnAgent', status: 'completed', receiverThreadIds: [agentThreadId], model: null } });
          const child = { type: 'subAgentActivity', id: randomUUID(), kind: 'started', agentThreadId, agentPath: '/child', model, reasoningEffort: null };
          if (model === null) toSubscribers(t.id, 'item/started', { threadId: t.id, turnId, item: child });
          toSubscribers(t.id, 'item/completed', { threadId: t.id, turnId, item: child });
          toSubscribers(t.id, 'item/started', { threadId: t.id, turnId, item: { ...child, kind: 'completed' } });
        }
      }
      if (body === undefined) continue; // the clause, or text that is no cland message: nothing to answer
      if (body.includes('fail this turn') || body.includes('fail recovered turn before response')) {
        error = { message: 'Upstream request failed: Endpoint is unavailable\nupstream details' };
        t.queue.length = 0;
        break;
      }
      if (body.includes('needs approval')) {
        await callTool('status', { text: 'idle' });
        const itemId = randomUUID();
        setStatus(t, { type: 'active', activeFlags: ['waitingOnApproval'] });
        await waitForApproval(t, itemId, body.includes('needs approval for fileChange'));
        for (const c of conns) if (c.subscribed.has(t.id)) send(c, { method: 'serverRequest/resolved', params: { threadId: t.id, requestId: itemId } });
        setStatus(t, { type: 'active', activeFlags: [] });
        await sleep(TURN_MS);
      }
      const topic = /\btopic="([^"]+)"/.exec(item.text)?.[1];
      const msgId = /\bmsg_id="([^"]+)"/.exec(item.text)?.[1];
      const where = { ...(topic ? { topic } : {}), ...(msgId ? { reply_to: msgId } : {}) };
      const request = /^(review|qa) request (T-\d+)\b/.exec(body);
      const script = request ? readJson<Partial<Record<VerdictKind, VerdictScript>>>(join(HOME, 'verdicts.json'))?.[request[1] as VerdictKind] : undefined;
      if (request && script) {
        const kind = request[1] as VerdictKind;
        const itemId = request[2] as string;
        const from = /\bfrom="([^"]+)"/.exec(item.text)?.[1] ?? 'coordinator';
        const answer = await callTool('task.comment', { id: itemId, verdict: kind, ...(kind === 'review' ? { scope: 'full' } : {}), result: script.result, run: script.run, text: script.text });
        const parsed = parseJson<{ ok: boolean; error?: string }>(answer);
        const report = parsed?.ok ? `${kind} ${script.result} ${itemId} (run ${script.run})` : `${kind} refused ${itemId}: ${parsed?.error ?? answer ?? 'no answer'}`;
        await callTool('send', { to: [from], text: report, ...where });
        continue;
      }
      const rename = /^rename to ([a-z0-9-]+)$/.exec(body);
      if (rename) await callTool('rename', { name: rename[1] });
      await callTool('send', { text: `pong: ${body}`, ...where });
    }
    if (!repeatUsage && !limitsOnly) t.tokens += 12;
    const usage = { totalTokens: 12, inputTokens: 10, cachedInputTokens: 6, outputTokens: 2, reasoningOutputTokens: 1 };
    const total = { totalTokens: t.tokens, inputTokens: t.tokens / 12 * 10, cachedInputTokens: t.tokens / 12 * 6, outputTokens: t.tokens / 12 * 2, reasoningOutputTokens: t.tokens / 12 };
    for (let report = 0; report < (usageBurst ? 10 : 1); report++)
      toSubscribers(t.id, 'thread/tokenUsage/updated', { threadId: t.id, turnId, tokenUsage: { total, last: usage, modelContextWindow: repeatUsage ? 100000 : 200000 } });
    if (limitsOnly) {
      usedPercent = 9;
      toSubscribers(t.id, 'account/rateLimits/updated', { rateLimits: { limitId: 'codex', primary: { usedPercent, windowDurationMins: 10080, resetsAt: 1791955620 }, secondary: null } });
    }
    save(t);
    t.turnId = null;
    // as the real one: idle is sent before turn/completed
    setStatus(t, { type: 'idle' });
    record.status = error ? 'failed' : 'completed';
    toSubscribers(t.id, 'turn/completed', { threadId: t.id, turn: { id: turnId, status: record.status, error, items: [] } });
  };

  const toolOf = (params: Record<string, unknown>): Item['tool'] => {
    const tool = params.toolOutput as { name?: unknown; namespace?: unknown } | undefined;
    return tool && typeof tool.name === 'string' ? { name: tool.name, ...(typeof tool.namespace === 'string' ? { namespace: tool.namespace } : {}) } : undefined;
  };
  const textOf = (params: Record<string, unknown>): string => {
    const tool = params.toolOutput as { name?: string; output?: unknown } | undefined;
    if (tool && typeof tool.output === 'string') return tool.output;
    return ((params.input ?? []) as Array<{ type: string; text?: string }>).map((i) => i.text ?? '').join('\n');
  };

  type Answer = { result: unknown } | { error: { code: number; message: string } } | { lost: true } | { garbled: true } | { dropped: true };
  const lost = new Set<string>();
  const loseOnce = (text: string): boolean => {
    if (!text.includes('lose the answer') || lost.has(text)) return false;
    lost.add(text);
    log('the answer is lost');
    return true;
  };
  // after the turn was accepted: its answer is a frame that is not JSON, or the connection drops instead (once each)
  const spoilOnce = (text: string): Answer | null => {
    const mode = text.includes('garble the answer') ? 'garbled' : text.includes('drop the connection') ? 'dropped' : null;
    if (mode === null || lost.has(text)) return null;
    lost.add(text);
    log(`the answer is ${mode}`);
    return mode === 'garbled' ? { garbled: true } : { dropped: true };
  };
  /** Why the real app-server would refuse a thread's permissions, or null. */
  const permissionsRefusal = (params: Record<string, unknown>): string | null => {
    const id = params.permissions;
    if (id === undefined || id === null) return null;
    if (params.sandbox !== undefined && params.sandbox !== null) return '`permissions` cannot be combined with `sandbox`';
    const defined = args.some((a, i) => args[i - 1] === '-c' && a.startsWith(`permissions.${String(id)}=`));
    return [':read-only', ':workspace', ':danger-full-access'].includes(id as string) || defined ? null : `unknown permissions profile \`${String(id)}\``;
  };
  const handle = async (c: Conn, method: string, params: Record<string, unknown>): Promise<Answer> => {
    switch (method) {
      case 'initialize':
        c.initialized = true;
        return { result: { userAgent: `fake-codex/${VERSION}`, platformFamily: 'unix' } };
      case 'thread/start': {
        log(`thread/start ${JSON.stringify(params)}`);
        if (existsSync(join(HOME, 'hold-thread-start'))) {
          writeFileSync(join(HOME, 'thread-start-running'), 'ready');
          while (!existsSync(join(HOME, 'release-thread-start'))) await sleep(5);
        }
        const refusal = permissionsRefusal(params);
        if (refusal) return { error: { code: -32600, message: refusal } };
        await mcpReady;
        if (threads.size > 0) await startMcp().catch((err: unknown) => log(`mcp startup failed: ${err instanceof Error ? err.message : String(err)}`));
        const t: Thread = { id: randomUUID(), cwd: (params.cwd as string) ?? process.cwd(), model: (params.model as string) ?? 'gpt-fake-1', turns: 0, status: { type: 'idle' }, turnId: null, queue: [], tokens: 0 };
        threads.set(t.id, t);
        save(t);
        c.subscribed.add(t.id);
        setImmediate(() => toSubscribers(t.id, 'thread/started', { thread: view(t) }));
        return { result: { thread: view(t), model: t.model } };
      }
      case 'thread/resume': {
        log(`thread/resume ${JSON.stringify(params)}`);
        if (existsSync(join(HOME, 'hold-thread-resume'))) {
          writeFileSync(join(HOME, 'thread-resume-running'), 'ready');
          while (!existsSync(join(HOME, 'release-thread-resume'))) await sleep(5);
        }
        if ((existsSync(join(HOME, 'fail-thread-resume')) || existsSync(join(HOME, 'cannot-resume')))) return { error: { code: -32603, message: 'planted thread resume failure' } };
        const refusal = permissionsRefusal(params);
        if (refusal) return { error: { code: -32600, message: refusal } };
        const t = load(params.threadId as string);
        if (!t || t.turns === 0) return { error: { code: -32600, message: `no rollout found for thread id ${String(params.threadId)}` } };
        if (typeof params.model === 'string') t.model = params.model;
        if (typeof params.cwd === 'string') { t.cwd = params.cwd; save(t); }
        c.subscribed.add(t.id);
        if (existsSync(join(HOME, 'idle-subscribe'))) {
          rmSync(join(HOME, 'idle-subscribe'));
          // Approval completed while detached: report idle, then a new waiting episode without metadata.
          t.status = { type: 'idle' };
          const poll = setInterval(() => {
            if (!existsSync(join(HOME, 'waiting-without-command'))) return;
            rmSync(join(HOME, 'waiting-without-command'));
            clearInterval(poll);
            setStatus(t, { type: 'active', activeFlags: ['waitingOnApproval'] });
          }, 5);
          poll.unref();
        }
        const deferred = join(HOME, 'defer-subscribe');
        if (existsSync(deferred)) {
          const order = readFileSync(deferred, 'utf8');
          rmSync(deferred);
          // A snapshot taken before the approval event, delivered after it.
          const snapshot = { ...view(t), status: { type: 'active', activeFlags: [] } };
          send(c, { id: 'deferred-approval', method: 'item/commandExecution/requestApproval', params: { threadId: t.id, command: 'touch deferred-approved', content: 'PRIVATE-TOOL-INPUT' } });
          if (order === 'state-first') setStatus(t, { type: 'active', activeFlags: ['waitingOnApproval'] });
          log('approval during deferred subscribe');
          while (!existsSync(join(HOME, 'release-subscribe'))) await sleep(5);
          rmSync(join(HOME, 'release-subscribe'));
          setImmediate(() => setStatus(t, { type: 'active', activeFlags: ['waitingOnApproval'] }));
          return { result: { thread: snapshot, model: t.model } };
        }
        return { result: { thread: view(t), model: t.model } };
      }
      case 'thread/read': {
        const t = threads.get(params.threadId as string) ?? load(params.threadId as string);
        if (!t) return { error: { code: -32600, message: `thread not found: ${String(params.threadId)}` } };
        if (params.includeTurns === true && JSON.stringify(t.history ?? []).includes('fail the readback')) return { error: { code: -32603, message: 'readback refused' } };
        if (params.includeTurns === true && existsSync(join(HOME, 'new-turn-during-read'))) {
          rmSync(join(HOME, 'new-turn-during-read'));
          t.turnId = randomUUID();
          t.queue.push({ text: 'newer recovery turn' });
          setStatus(t, { type: 'active', activeFlags: [] });
          toSubscribers(t.id, 'turn/started', { threadId: t.id, turn: { id: t.turnId, status: 'inProgress', items: [] } });
          void runTurn(t);
          log('newer turn started during readback');
        }
        return { result: { thread: { ...view(t), turns: params.includeTurns === true ? (t.history ?? []) : [] } } };
      }
      case 'turn/start': {
        const t = threads.get(params.threadId as string);
        if (!t) return { error: { code: -32600, message: `thread not loaded: ${String(params.threadId)}` } };
        const text = textOf(params);
        if (text.includes('refuse recovered request')) return { error: { code: -32603, message: 'recovery request refused' } };
        if (process.env.FAKE_CODEX_FAIL_FIRST_TURN === '1' && t.turns === 0 && !t.turnId) {
          // the turn fails once the spoke is in the hub (its `who` answers): a failure after the session said hello
          const deadline = Date.now() + 15_000;
          while (Date.now() < deadline && parseJson<{ ok?: boolean }>(await callTool('who', {}))?.ok !== true) await sleep(50);
          return { error: { code: -32603, message: 'the model refused the first turn (FAKE_CODEX_FAIL_FIRST_TURN)' } };
        }
        const lose = loseOnce(text);
        if (t.turnId) {
          // an active turn: turn/start steers it, including a recovery which that newer turn may drop.
          if (text.includes('drop recovery in newer turn') && !lost.has(`recovery:${text}`)) {
            lost.add(`recovery:${text}`);
            log(`recovery accepted and dropped in newer turn: ${text}`);
            return { result: { turn: { id: t.turnId, status: 'inProgress', items: [] } } };
          }
          t.queue.push({ text, tool: toolOf(params) });
          log(`steered by turn/start: ${text}`);
          return lose ? { lost: true } : { result: { turn: { id: t.turnId, status: 'inProgress', items: [] } } };
        }
        // A real first input materializes the rollout before model completion.
        t.turns += 1;
        save(t);
        t.turnId = randomUUID();
        t.queue.push({ text: text.includes('drop every recovery') ? 'ignored recovery input' : text, tool: toolOf(params) });
        log(`turn/start ${params.toolOutput ? `toolOutput ${(params.toolOutput as { name: string }).name}` : 'input'}${typeof params.effort === 'string' ? ` effort=${params.effort}` : ''}`);
        setStatus(t, { type: 'active', activeFlags: [] });
        toSubscribers(t.id, 'turn/started', { threadId: t.id, turn: { id: t.turnId, status: 'inProgress', items: [] } });
        if (process.env.FAKE_CODEX_SUBAGENT_AT_LAUNCH === '1' && t.turns === 1) {
          toSubscribers(t.id, 'item/completed', { threadId: t.id, turnId: t.turnId, item: { type: 'subAgentActivity', id: randomUUID(), kind: 'started', agentThreadId: 'early-child', model: 'gpt-early-child', agentPath: '/child', reasoningEffort: null } });
        }
        const acceptedTurn = t.turnId;
        void runTurn(t);
        if (text.includes('fail recovered turn before response')) {
          while (t.turnId === acceptedTurn) await sleep(5);
          log('recovered turn failed before response');
          return { result: { turn: { id: acceptedTurn, status: 'failed', items: [] } } };
        }
        const spoiled = spoilOnce(text);
        if (spoiled) return spoiled;
        return lose ? { lost: true } : { result: { turn: { id: t.turnId, status: 'inProgress', items: [] } } };
      }
      case 'turn/steer': {
        const t = threads.get(params.threadId as string);
        if (!t?.turnId) return { error: { code: -32600, message: 'no active turn to steer' } };
        if (params.expectedTurnId !== t.turnId) return { error: { code: -32600, message: `expected turn ${String(params.expectedTurnId)}, active turn is ${t.turnId}` } };
        const text = textOf(params);
        if (text.includes('late rejected steer') || text.includes('late unanswered steer')) {
          const expected = t.turnId;
          log(`pending late steer: ${text}`);
          while (t.turnId === expected) await sleep(5);
          log('late steer completed before response');
          while (!existsSync(join(HOME, 'release-steer-response'))) await sleep(5);
          log('late steer response released');
          return text.includes('late unanswered steer') ? { lost: true } : { error: { code: -32600, message: 'no active turn to steer' } };
        }
        if (text.includes('pending steer response')) {
          log(`pending response: ${/<channel [^>]*>\n([\s\S]*?)\n<\/channel>/.exec(text)?.[1]}`);
          const expected = t.turnId;
          const accepted = text.includes('accept pending steer response') || text.includes('accept dropped pending steer response');
          if (accepted && !text.includes('accept dropped')) t.queue.push({ text });
          while (t.turnId === expected) await sleep(5);
          await sleep(50); // completion reaches the hub before this admission result
          return accepted ? { result: { turnId: expected } } : { error: { code: -32600, message: 'no active turn to steer' } };
        }
        // an accepted steer the turn never takes up (what T-50 guards against; the real 0.160.0 was not seen to do it)
        if (text.includes('drop this steer') && !lost.has(text)) {
          lost.add(text);
          log(`turn/steer ${t.turnId} accepted and dropped: ${text}`);
          return { result: { turnId: t.turnId } };
        }
        t.queue.push({ text });
        log(`turn/steer ${t.turnId}: ${text}`);
        return loseOnce(text) ? { lost: true } : { result: { turnId: t.turnId } };
      }
      case 'account/rateLimits/read':
        return { result: { rateLimits: { limitId: 'codex', primary: { usedPercent, windowDurationMins: 10080, resetsAt: 1791955620 }, secondary: null } } };
      default:
        return { error: { code: -32601, message: `method not found: ${method}` } };
    }
  };

  const http = createServer();
  const wss = new WebSocketServer({ server: http, perMessageDeflate: false });
  let refuseUntil = 0;
  wss.on('connection', (ws) => {
    if (Date.now() < refuseUntil) {
      ws.terminate();
      return;
    }
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
      void handle(c, m.method, m.params ?? {}).then((answer) => {
        if ('garbled' in answer) c.ws.send('{"id": this is not json');
        else if ('dropped' in answer) c.ws.terminate();
        else if (!('lost' in answer)) send(c, { id: m.id, ...answer });
      });
    });
  });
  rmSync(socket, { force: true });
  await new Promise<void>((resolve) => http.listen(socket, resolve));
  log('listening');

  process.on('SIGUSR1', () => approveAll?.());
  process.on('SIGUSR2', () => {
    refuseUntil = Date.now() + Number(process.env.FAKE_CODEX_REFUSE_MS ?? 1500);
    log('dropping every client connection');
    for (const c of conns) c.ws.terminate();
  });
  const shutdown = async () => {
    log('SIGTERM');
    // FAKE_CODEX_TERM_DELAY_MS: how long the app-server takes to go once told to (its turn runs on meanwhile)
    await sleep(Number(process.env.FAKE_CODEX_TERM_DELAY_MS ?? 0));
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
