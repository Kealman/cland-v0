// A fake OpenCode 2.x: the harness boundary the OpenCode adapter is tested against, over HTTP and SSE as the real
// `opencode serve` speaks it (v2.0.24's routes and event shapes; only what the adapter uses):
//
//   opencode --version                      `opencode v2.0.24-fake`
//   opencode auth list --standalone --format json   one provider with credentials; FAKE_OPENCODE_NO_AUTH=1: `[]`
//   opencode serve --hostname h --port 0    an HTTP server; prints `server listening on http://h:<port>`. HTTP Basic
//       with the user `opencode` and OPENCODE_PASSWORD. It reads OPENCODE_CONFIG and starts its local MCP servers
//       (`mcp.servers.<name>: {type: local, command[], environment}`) when a session is first touched, as the real
//       server loads a location: the real spoke, which connects to the real hub.
//       GET  /api/event                         SSE: `data: {id, type, created, data}`, a `: heartbeat` comment
//       GET  /api/session/active                {data: {<ses>: {type: running}}}
//       POST /api/session {id?, title, model, location}; GET /api/session/{id} (404 when unknown); GET /api/session
//       POST /api/session/{id}/prompt {text, delivery: steer|queue} → {data: {id: msg_…, delivery, …}}
//       GET  /api/session/{id}/permission, POST …/permission/{per}/reply {decision}
//       GET  /api/session/{id}/form, POST …/form/{frm}/reply, DELETE …/form/{frm}
//       GET  /api/model                         one paid model and one free (`opencode/fake-free`); none in the
//                                               first 400 ms, as a real server's catalog loads after it listens
//   opencode --server <url> --session <id> [dir]  the TUI: prints `fake opencode TUI on <url> session <id> (<title>) in <dir>`
//                                                 (dir: the argument, else its cwd).
//
// A turn: `session.execution.started`, then per input `session.inbox.delivered`, `session.step.started {model}`,
// FAKE_OPENCODE_TURN_MS of "thinking" (default 300; a text containing "take your time" thinks 2000 ms), the answer
// through the spoke's `send` ("pong: <text>", into the message's topic, replying to it), `session.step.ended
// {tokens, cost}`; at last `session.execution.succeeded`. A steered input joins the running turn; a queued one waits
// for the next. A text containing "needs approval" first raises `permission.asked` and waits for its reply; one
// containing "needs a form" raises `form.created` and waits for a reply or a cancel.
//
// State lives under FAKE_OPENCODE_HOME: sessions/<ses>.json (shared by every server, like OpenCode's database),
// servers/<pid>.json (the live servers, for the tests' cleanup), prompts/<ses>.log (each prompt and its delivery).
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const HOME = process.env.FAKE_OPENCODE_HOME ?? join(process.env.TMPDIR ?? '/tmp', 'fake-opencode-home');
const SESSIONS = join(HOME, 'sessions');
const SERVERS = join(HOME, 'servers');
const PROMPTS = join(HOME, 'prompts');
for (const d of [SESSIONS, SERVERS, PROMPTS]) mkdirSync(d, { recursive: true });

type ModelRef = { providerID: string; id: string };
type SessionInfo = { id: string; title: string; model: ModelRef; directory: string; created: number };
type McpServer = { type: string; command?: string[]; environment?: Record<string, string> };

const rid = (prefix: string) => `${prefix}_${randomBytes(10).toString('hex')}`;
const flag = (args: string[], ...names: string[]) => {
  for (const n of names) {
    const i = args.indexOf(n);
    if (i >= 0) return args[i + 1];
  }
  return undefined;
};
const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
};

async function main(args: string[]): Promise<number> {
  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write('opencode v2.0.24-fake\n');
    return 0;
  }
  if (args[0] === 'auth' && args[1] === 'list') {
    const providers = process.env.FAKE_OPENCODE_NO_AUTH === '1' ? [] : [{ id: 'fake', name: 'Fake Provider', connections: [{ type: 'env', name: 'FAKE_API_KEY' }] }];
    process.stdout.write(`${JSON.stringify(providers, null, 2)}\n`);
    return 0;
  }
  if (args[0] === 'serve') return serve(args.slice(1));
  const server = flag(args, '--server');
  if (server) {
    // the directory the TUI works in: its positional argument, else its cwd (the real server opens an instance there)
    const valued = new Set(['--server', '--session', '-s', '--prompt']);
    const dir = args.find((a, i) => !a.startsWith('-') && !valued.has(args[i - 1] ?? ''));
    return tui(server, flag(args, '--session', '-s'), dir ?? process.cwd());
  }
  process.stderr.write(`fake opencode: unsupported invocation ${JSON.stringify(args)}\n`);
  return 1;
}

// ------------------------------------------------------------------ the TUI client

async function tui(url: string, session: string | undefined, dir: string): Promise<number> {
  const headers = process.env.OPENCODE_PASSWORD ? { authorization: `Basic ${Buffer.from(`opencode:${process.env.OPENCODE_PASSWORD}`).toString('base64')}` } : undefined;
  const res = await fetch(`${url}/api/session/${session ?? ''}`, headers ? { headers } : {}).catch((err: Error) => ({ ok: false, status: 0, text: async () => err.message }) as const);
  if (!res.ok) {
    process.stderr.write(`Error: Server at ${url} answered ${res.status}: ${await res.text()}\n`);
    return 1;
  }
  const info = ((await (res as Response).json()) as { data: SessionInfo }).data;
  process.stdout.write(`fake opencode TUI on ${url} session ${info.id} (${info.title}) in ${dir}\n`);
  return 0;
}

// ------------------------------------------------------------------ the server

async function serve(args: string[]): Promise<number> {
  const hostname = flag(args, '--hostname') ?? '127.0.0.1';
  const port = Number(flag(args, '--port') ?? 0);
  const password = process.env.OPENCODE_PASSWORD ?? '';
  const config = process.env.OPENCODE_CONFIG ? readJson<{ mcp?: { servers?: Record<string, McpServer> } }>(process.env.OPENCODE_CONFIG) : null;
  const turnMs = Number(process.env.FAKE_OPENCODE_TURN_MS ?? 300);
  const log = (line: string) => appendFileSync(join(HOME, `server-${process.pid}.log`), `${new Date().toISOString()} ${line}\n`);

  // ---------------------------------------------------------------- events
  const streams = new Set<ServerResponse>();
  const emit = (type: string, data: Record<string, unknown>) => {
    const line = `data: ${JSON.stringify({ id: rid('evt'), created: Date.now(), type, location: { directory: process.cwd() }, data })}\n\n`;
    for (const s of streams) s.write(line);
  };

  // ---------------------------------------------------------------- the MCP servers, started with the location
  const mcp = new Map<string, Client>();
  let location: Promise<void> | null = null;
  const loadLocation = () =>
    (location ??= (async () => {
      for (const [name, server] of Object.entries(config?.mcp?.servers ?? {})) {
        if (server.type !== 'local' || !server.command?.length) continue;
        const client = new Client({ name: 'fake-opencode', version: '0.0.0' }, { capabilities: {} });
        const transport = new StdioClientTransport({ command: server.command[0] as string, args: server.command.slice(1), env: { ...(process.env as Record<string, string>), ...(server.environment ?? {}) }, cwd: process.cwd(), stderr: 'pipe' });
        transport.stderr?.on('data', (c: Buffer) => log(`[mcp ${name}] ${String(c).trim()}`));
        try {
          await client.connect(transport);
          mcp.set(name, client);
          log(`mcp ${name} connected`);
        } catch (err) {
          log(`mcp ${name} failed: ${String(err)}`);
        }
      }
    })());
  const callTool = async (name: string, args: Record<string, unknown>) => {
    await loadLocation();
    const client = mcp.get('cland');
    if (!client) return null;
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text?: string }>)[0]?.text ?? '';
    log(`tool ${name} → ${text}`);
    return text;
  };

  // ---------------------------------------------------------------- sessions and turns
  const sessionFile = (id: string) => join(SESSIONS, `${id}.json`);
  const getSession = (id: string) => readJson<SessionInfo>(sessionFile(id));
  type Pending = { resolve: (reply: string) => void };
  type Run = { inputs: string[]; queued: string[] };
  const runs = new Map<string, Run>();
  const permissions = new Map<string, Map<string, Pending & { action: string }>>();
  const forms = new Map<string, Map<string, Pending & { title: string }>>();
  const of = <V>(m: Map<string, Map<string, V>>, sid: string) => m.get(sid) ?? m.set(sid, new Map()).get(sid)!;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const answer = async (session: SessionInfo, text: string) => {
    emit('session.step.started', { sessionID: session.id, agent: 'build', model: session.model, assistantMessageID: rid('msg') });
    const body = /<channel [^>]*>\n([\s\S]*)\n<\/channel>/.exec(text)?.[1] ?? text;
    await sleep(body.includes('take your time') ? 2000 : turnMs);
    if (body.includes('needs approval')) {
      const id = rid('per');
      const reply = await new Promise<string>((resolve) => {
        of(permissions, session.id).set(id, { resolve, action: 'external_directory' });
        emit('permission.asked', { id, sessionID: session.id, action: 'external_directory', resources: ['/etc/fake'] });
      });
      log(`permission ${id} → ${reply}`);
      await sleep(turnMs);
    }
    if (body.includes('needs a form')) {
      const id = rid('frm');
      const reply = await new Promise<string>((resolve) => {
        of(forms, session.id).set(id, { resolve, title: 'Which one?' });
        emit('form.created', { form: { id, sessionID: session.id, title: 'Which one?', fields: [{ key: 'q0', type: 'string', title: 'Which one?' }], metadata: { kind: 'question' } } });
      });
      log(`form ${id} → ${reply}`);
      await sleep(turnMs);
    }
    const topic = /\btopic="([^"]+)"/.exec(text)?.[1];
    const msgId = /\bmsg_id="([^"]+)"/.exec(text)?.[1];
    await callTool('send', { text: `pong: ${body}`, ...(topic ? { topic } : {}), ...(msgId ? { reply_to: msgId } : {}) }).catch((err: unknown) => log(`send failed: ${String(err)}`));
    emit('session.step.ended', { sessionID: session.id, finish: 'stop', cost: 0.25, tokens: { input: 10, output: 2, reasoning: 1, cache: { read: 4, write: 3 } } });
    emit('session.usage.updated', { sessionID: session.id, cost: 0.25, tokens: { input: 10, output: 2, reasoning: 1, cache: { read: 4, write: 3 } } });
  };

  const execute = async (session: SessionInfo, run: Run) => {
    emit('session.execution.started', { sessionID: session.id });
    for (let input = run.inputs.shift(); input !== undefined; input = run.inputs.shift()) {
      emit('session.inbox.delivered', { sessionID: session.id });
      await answer(session, input);
    }
    emit('session.execution.succeeded', { sessionID: session.id });
    if (run.queued.length) {
      run.inputs.push(run.queued.shift() as string);
      void execute(session, run);
    } else runs.delete(session.id);
  };

  // ---------------------------------------------------------------- HTTP
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const readBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
    let raw = '';
    for await (const c of req) raw += String(c);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  };
  const notFound = (res: ServerResponse, id: string) => send(res, 404, { _tag: 'SessionNotFoundError', sessionID: id, message: `Session not found: ${id}` });

  const started = Date.now();
  const server = createServer(async (req, res) => {
    try {
      const expected = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
      if (password && req.headers.authorization !== expected) return send(res, 401, { _tag: 'UnauthorizedError', message: 'Unauthorized' });
      const url = new URL(req.url ?? '/', 'http://x');
      const parts = url.pathname.split('/').filter(Boolean); // api, session, <id>, …
      const method = req.method ?? 'GET';
      if (url.pathname === '/api/event' && method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify({ id: rid('evt'), type: 'server.connected', data: {} })}\n\n`);
        streams.add(res);
        const beat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
        req.on('close', () => {
          clearInterval(beat);
          streams.delete(res);
        });
        return;
      }
      // like the real one, a fresh server lists no model until its catalog has loaded
      if (url.pathname === '/api/model' && method === 'GET' && Date.now() - started < 400) return send(res, 200, { data: [] });
      if (url.pathname === '/api/model' && method === 'GET')
        return send(res, 200, {
          data: [
            { id: 'fake-paid', providerID: 'opencode', status: 'active', enabled: true, capabilities: { tools: true }, cost: [{ input: 1, output: 4 }] },
            { id: 'fake-free', providerID: 'opencode', status: 'active', enabled: true, capabilities: { tools: true }, cost: [{ input: 0, output: 0 }] },
          ],
        });
      if (url.pathname === '/api/mcp' && method === 'GET') return send(res, 200, { data: [...mcp.keys()].map((name) => ({ name, status: { status: 'connected' } })) });
      if (url.pathname === '/api/session/active' && method === 'GET') return send(res, 200, { data: Object.fromEntries([...runs.keys()].map((id) => [id, { type: 'running' }])) });
      if (url.pathname === '/api/session' && method === 'GET') return send(res, 200, { data: readdirSync(SESSIONS).map((f) => readJson<SessionInfo>(join(SESSIONS, f))).filter(Boolean), cursor: {} });
      if (url.pathname === '/api/session' && method === 'POST') {
        const body = await readBody(req);
        const id = typeof body.id === 'string' ? body.id : rid('ses');
        const info: SessionInfo = {
          id,
          title: typeof body.title === 'string' ? body.title : id,
          model: (body.model as ModelRef | null) ?? { providerID: 'opencode', id: 'fake-default' },
          directory: (body.location as { directory?: string } | null)?.directory ?? process.cwd(),
          created: Date.now(),
        };
        writeFileSync(sessionFile(id), JSON.stringify(info));
        void loadLocation();
        return send(res, 200, { data: info });
      }
      if (parts[0] === 'api' && parts[1] === 'session' && parts[2]) {
        const sid = parts[2];
        const session = getSession(sid);
        if (!session) return notFound(res, sid);
        void loadLocation();
        if (parts.length === 3 && method === 'GET') return send(res, 200, { data: session });
        if (parts[3] === 'prompt' && method === 'POST') {
          const body = await readBody(req);
          const text = String(body.text ?? '');
          const delivery = body.delivery === 'steer' ? 'steer' : 'queue';
          const id = rid('msg');
          appendFileSync(join(PROMPTS, `${sid}.log`), `prompt ${delivery}${runs.has(sid) ? ' (running)' : ''}: ${text}\n`);
          emit('session.inbox.enqueued', { inboxID: id, sessionID: sid, item: { type: 'user', payload: { text }, delivery } });
          send(res, 200, { data: { id, sessionID: sid, time: { created: Date.now() }, type: 'user', payload: { text }, delivery } });
          const run = runs.get(sid);
          if (!run) {
            const fresh: Run = { inputs: [text], queued: [] };
            runs.set(sid, fresh);
            void execute(session, fresh);
          } else if (delivery === 'steer') run.inputs.push(text);
          else run.queued.push(text);
          return;
        }
        if (parts[3] === 'permission' && parts.length === 4 && method === 'GET') return send(res, 200, { data: [...of(permissions, sid)].map(([id, p]) => ({ id, sessionID: sid, action: p.action, resources: [] })) });
        if (parts[3] === 'permission' && parts[5] === 'reply' && method === 'POST') {
          const pending = of(permissions, sid).get(parts[4] as string);
          if (!pending) return send(res, 404, { _tag: 'PermissionNotFoundError' });
          const reply = String((await readBody(req)).decision ?? 'once');
          of(permissions, sid).delete(parts[4] as string);
          emit('permission.replied', { sessionID: sid, requestID: parts[4], reply });
          pending.resolve(reply);
          return send(res, 200, { data: true });
        }
        if (parts[3] === 'form' && parts.length === 4 && method === 'GET') return send(res, 200, { data: [...of(forms, sid)].map(([id, f]) => ({ id, sessionID: sid, title: f.title, fields: [] })) });
        if (parts[3] === 'form' && parts[4]) {
          const pending = of(forms, sid).get(parts[4]);
          if (!pending) return send(res, 404, { _tag: 'FormNotFoundError' });
          if (parts[5] === 'reply' && method === 'POST') {
            await readBody(req);
            of(forms, sid).delete(parts[4]);
            emit('form.replied', { id: parts[4], sessionID: sid });
            pending.resolve('replied');
            return send(res, 200, { data: true });
          }
          if (parts.length === 5 && method === 'DELETE') {
            of(forms, sid).delete(parts[4]);
            emit('form.cancelled', { id: parts[4], sessionID: sid });
            pending.resolve('cancelled');
            return send(res, 200, { data: true });
          }
        }
      }
      send(res, 404, { _tag: 'NotFound', path: url.pathname });
    } catch (err) {
      log(`request failed: ${err instanceof Error ? err.stack : String(err)}`);
      if (!res.headersSent) send(res, 500, { message: String(err) });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, hostname, resolve));
  const address = server.address();
  const url = `http://${hostname}:${typeof address === 'object' && address ? address.port : port}`;
  writeFileSync(join(SERVERS, `${process.pid}.json`), JSON.stringify({ pid: process.pid, url, cwd: process.cwd(), config: process.env.OPENCODE_CONFIG ?? null }));
  process.stdout.write(`server listening on ${url}\n`);

  const shutdown = async () => {
    for (const s of streams) s.end();
    for (const c of mcp.values()) await c.close().catch(() => {});
    rmSync(join(SERVERS, `${process.pid}.json`), { force: true });
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
  return new Promise<number>(() => {});
}

process.exitCode = await main(process.argv.slice(2));
