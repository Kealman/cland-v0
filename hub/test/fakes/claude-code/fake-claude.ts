// A fake Claude Code: the harness process boundary the Claude Code adapter is tested against. It honours the
// surfaces the adapter uses, and nothing else:
//
//   claude --bg [--session-id <uuid> | --resume <uuid>] [--name n] [--model m] --mcp-config <json> --settings <json> --plugin-dir <dir>
//       starts a detached session process and prints what 2.1.294 prints (`backgrounded · <id> · <name> …`,
//       `claude attach <id>`). Like the real one, it takes `--session-id` and does not use it: the session's id is
//       its own, starting with the background id.
//       The session starts the configured MCP server (the real spoke, which connects to the real hub), runs the
//       settings hooks (`cland hook …`) as Claude Code does — the JSON payload on stdin, `async` ones not awaited —
//       and loads the plugin's hooks module (the real cland mod) against a small `$`: env, settings, process.run,
//       process.spawn, prompt.submit, clock. A submitted prompt is a turn: UserPromptSubmit and `turn.start`;
//       the answer is a `send` through the spoke ("pong: <text>") into the message's topic; Stop and `turn.complete`.
//       A prompt containing "needs approval" first sets the model's own status line to "idle" through the spoke's
//       `status` tool (the hub must not take it for the state), then raises a PermissionRequest and waits for
//       SIGUSR1 (the approval), then PostToolUse.
//   claude agents --json   the live sessions (pid, id, sessionId, cwd, kind, status, waitingFor)
//   claude attach <id>     prints `fake claude attached to <id>` (each attached client prints it)
//   claude stop <id>       SIGTERM to the session (SessionEnd, then exit)
//
// FAKE_CLAUDE_LATE_BG=1 makes `--bg` return only after the session's SessionStart hook ran.
// FAKE_CLAUDE_DROP_FIRST=1 drops the first prompt the mod submits (as a harness hook would), so it is never confirmed.
// State lives under FAKE_CLAUDE_HOME (sessions/<id>.json, jobs/<id>.json, jobs/<id>.log). FAKE_CLAUDE_TURN_MS is
// how long a turn "thinks" (default 300).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const HOME = process.env.FAKE_CLAUDE_HOME ?? join(process.env.TMPDIR ?? '/tmp', 'fake-claude-home');
const SESSIONS = join(HOME, 'sessions');
const JOBS = join(HOME, 'jobs');
mkdirSync(SESSIONS, { recursive: true });
mkdirSync(JOBS, { recursive: true });
const SELF = fileURLToPath(import.meta.url);

type Job = { id: string; sessionId: string; name: string | null; model: string | null; cwd: string; resume: boolean; mcp: McpConfig; settings: Settings; pluginDir: string | null };
type McpConfig = { mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> };
type HookEntry = { matcher?: string; hooks: Array<{ type: string; command: string; async?: boolean }> };
type Settings = { hooks?: Record<string, HookEntry[]>; env?: Record<string, string> };
type SessionFile = { pid: number; id: string; sessionId: string; cwd: string; kind: 'background'; startedAt: number; name: string | null; status: 'idle' | 'busy' | 'waiting'; waitingFor?: string };

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
};
const writeJson = (file: string, value: unknown) => {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, file);
};
/** A flag's value: inline JSON or a file holding it, as Claude Code takes `--mcp-config` and `--settings`. */
const jsonArg = <T>(raw: string | undefined): T => (raw === undefined ? ({} as T) : raw.trim().startsWith('{') ? (JSON.parse(raw) as T) : (JSON.parse(readFileSync(raw, 'utf8')) as T));
const flag = (args: string[], ...names: string[]) => {
  for (const n of names) {
    const i = args.indexOf(n);
    if (i >= 0) return args[i + 1];
  }
  return undefined;
};

// ------------------------------------------------------------------ the CLI

async function main(args: string[]): Promise<number> {
  const [first] = args;
  if (first === '__session') return runSession(args[1] as string);
  if (first === 'agents') {
    const entries = readdirSync(SESSIONS)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson<SessionFile>(join(SESSIONS, f)))
      .filter((s): s is SessionFile => s !== null && alive(s.pid));
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    return 0;
  }
  if (first === 'attach') {
    const s = readJson<SessionFile>(join(SESSIONS, `${args[1]}.json`));
    if (!s || !alive(s.pid)) {
      process.stderr.write(`no background session ${args[1]}\n`);
      return 1;
    }
    process.stdout.write(`fake claude attached to ${args[1]} (${s.name ?? 'unnamed'})\n`);
    return 0;
  }
  if (first === 'stop' || first === 'kill') {
    const s = readJson<SessionFile>(join(SESSIONS, `${args[1]}.json`));
    if (s && alive(s.pid)) process.kill(s.pid, 'SIGTERM');
    process.stdout.write(`stopped ${args[1]}\n`);
    return 0;
  }
  if (args.includes('--bg') || args.includes('--background')) return startBackground(args);
  process.stderr.write(`fake claude: unsupported invocation ${JSON.stringify(args)}\n`);
  return 1;
}

async function startBackground(args: string[]): Promise<number> {
  const resumeOf = flag(args, '--resume', '-r');
  const previous = resumeOf ? readdirSync(JOBS).filter((f) => f.endsWith('.json')).map((f) => readJson<Job>(join(JOBS, f))).find((j) => j?.sessionId === resumeOf) : undefined;
  const id = previous?.id ?? randomBytes(4).toString('hex');
  const job: Job = {
    id,
    sessionId: previous?.sessionId ?? `${id}${crypto.randomUUID().slice(8)}`,
    name: flag(args, '--name', '-n') ?? null,
    model: flag(args, '--model') ?? null,
    cwd: process.cwd(),
    resume: resumeOf !== undefined,
    mcp: jsonArg<McpConfig>(flag(args, '--mcp-config')),
    settings: jsonArg<Settings>(flag(args, '--settings')),
    pluginDir: flag(args, '--plugin-dir') ?? null,
  };
  writeJson(join(JOBS, `${id}.json`), job);
  const child = spawn(process.execPath, [SELF, '__session', id], { cwd: job.cwd, detached: true, stdio: 'ignore', env: process.env });
  child.unref();
  // the supervisor has the session once its file names a live pid
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const s = readJson<SessionFile>(join(SESSIONS, `${id}.json`));
    if (s && s.pid === child.pid) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  // FAKE_CLAUDE_LATE_BG=1: return only once the session ran its SessionStart hook, as the real one can
  if (process.env.FAKE_CLAUDE_LATE_BG === '1') {
    while (Date.now() < deadline && !readFileSync(join(JOBS, `${id}.log`), { encoding: 'utf8', flag: 'a+' }).includes('session ready')) await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, 300));
  }
  process.stdout.write(`backgrounded · ${id} · ${job.name ?? 'session'} (idle — send a prompt to start)\n  claude attach ${id}    open in this terminal\n  claude stop ${id}      stop this session\n`);
  return 0;
}

// ------------------------------------------------------------------ the session process

async function runSession(id: string): Promise<number> {
  const job = readJson<Job>(join(JOBS, `${id}.json`));
  if (!job) return 1;
  const logFile = join(JOBS, `${id}.log`);
  const log = (line: string) => appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  const env: Record<string, string> = { ...(process.env as Record<string, string>), ...(job.settings.env ?? {}) };
  const file = join(SESSIONS, `${id}.json`);
  const state: SessionFile = { pid: process.pid, id, sessionId: job.sessionId, cwd: job.cwd, kind: 'background', startedAt: Date.now(), name: job.name, status: 'idle' };
  const setStatus = (status: SessionFile['status'], waitingFor?: string) => {
    state.status = status;
    if (waitingFor) state.waitingFor = waitingFor;
    else delete state.waitingFor;
    writeJson(file, state);
  };
  setStatus('idle');

  // the settings hooks: a shell command, the payload on stdin; `async` ones run in the background
  const runHooks = async (event: string, payload: Record<string, unknown>) => {
    for (const entry of job.settings.hooks?.[event] ?? []) {
      for (const h of entry.hooks) {
        if (h.type !== 'command') continue;
        const run = new Promise<void>((resolve) => {
          const child = spawn('sh', ['-c', h.command], { cwd: job.cwd, env, stdio: ['pipe', 'ignore', 'pipe'] });
          let err = '';
          child.stderr.on('data', (c: Buffer) => (err += String(c)));
          child.on('close', (code) => {
            if (code !== 0 || err) log(`hook ${event} exited ${code}: ${err.trim()}`);
            resolve();
          });
          child.on('error', () => resolve());
          child.stdin.end(JSON.stringify({ session_id: job.sessionId, hook_event_name: event, cwd: job.cwd, ...payload }));
        });
        if (!h.async) await run;
      }
    }
  };

  // the MCP servers: the real spoke, connected to the real hub
  const tools = new Map<string, Client>();
  for (const [name, server] of Object.entries(job.mcp.mcpServers ?? {})) {
    const client = new Client({ name: 'fake-claude', version: '0.0.0' }, { capabilities: {} });
    const transport = new StdioClientTransport({ command: server.command, args: server.args ?? [], env: { ...env, ...(server.env ?? {}) }, cwd: job.cwd, stderr: 'pipe' });
    transport.stderr?.on('data', (c: Buffer) => log(`[mcp ${name}] ${String(c).trim()}`));
    await client.connect(transport);
    tools.set(name, client);
  }
  const callTool = async (name: string, args: Record<string, unknown>) => {
    const client = tools.get('cland');
    if (!client) return null;
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text?: string }>)[0]?.text ?? '';
    log(`tool ${name} → ${text}`);
    return text;
  };

  // the plugin's hooks module, against a small `$`
  type Hook = ($: unknown, e: Record<string, unknown>, next: (e: Record<string, unknown>) => Promise<unknown>) => Promise<unknown>;
  const modHooks = new Map<string, Hook[]>();
  const queue: Array<{ text: string; started: () => void }> = [];
  let wake: (() => void) | null = null;
  const children = new Set<ReturnType<typeof spawn>>();
  let dropped = false;
  const $ = {
    env: { get: async (name: string) => env[name] },
    settings: { read: async () => job.settings },
    clock: { now: async () => Date.now(), sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) },
    process: {
      run: (argv: string[], init: { stdin?: string; timeoutMs?: number } = {}) =>
        new Promise((resolve, reject) => {
          const child = spawn(argv[0] as string, argv.slice(1), { cwd: job.cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
          let stdout = '';
          let stderr = '';
          child.stdout.on('data', (c: Buffer) => (stdout += String(c)));
          child.stderr.on('data', (c: Buffer) => (stderr += String(c)));
          const timer = setTimeout(() => child.kill('SIGKILL'), init.timeoutMs ?? 30_000);
          child.on('error', reject);
          child.on('close', (code) => {
            clearTimeout(timer);
            if (stderr.trim()) log(`process.run ${argv.slice(2, 4).join(' ')}: ${stderr.trim()}`);
            resolve({ exitCode: code ?? 1, stdout, stderr });
          });
          child.stdin.end(init.stdin ?? '');
        }),
      spawn: ({ argv }: { argv: string[] }) => {
        const child = spawn(argv[0] as string, argv.slice(1), { cwd: job.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
        children.add(child);
        const pieces: Array<{ stream: 'stdout' | 'stderr'; text: string }> = [];
        let ended: { code: number | null; signal: string | null } | null = null;
        let notify: (() => void) | null = null;
        const push = () => {
          notify?.();
          notify = null;
        };
        child.stdout?.on('data', (c: Buffer) => (pieces.push({ stream: 'stdout', text: String(c) }), push()));
        child.stderr?.on('data', (c: Buffer) => {
          log(`[spawned ${argv.slice(2, 4).join(' ')}] ${String(c).trim()}`);
          pieces.push({ stream: 'stderr', text: String(c) });
          push();
        });
        child.on('close', (code, signal) => ((ended = { code, signal }), children.delete(child), push()));
        return (async function* () {
          try {
            for (;;) {
              const piece = pieces.shift();
              if (piece) {
                yield piece;
                continue;
              }
              if (ended) return ended;
              await new Promise<void>((r) => (notify = r));
            }
          } finally {
            if (!ended) child.kill();
          }
        })();
      },
    },
    prompt: {
      submit: ({ text }: { text: string }) =>
        new Promise<{ text: string } | { drop: string }>((resolve) => {
          // FAKE_CLAUDE_DROP_FIRST: a hook of the harness drops the first submitted prompt (the mod must not confirm it)
          if (env.FAKE_CLAUDE_DROP_FIRST === '1' && !dropped) {
            dropped = true;
            log('dropped the first submitted prompt');
            resolve({ drop: 'dropped by a test hook' });
            return;
          }
          queue.push({ text, started: () => resolve({ text }) });
          wake?.();
        }),
    },
    ui: { log: (line: string) => log(`ui.log ${line}`), status: () => {}, toast: () => {} },
  };
  const dispatch = async (event: string, e: Record<string, unknown>, core: (e: Record<string, unknown>) => unknown) => {
    const chain = modHooks.get(event) ?? [];
    const at = (i: number) => async (input: Record<string, unknown>): Promise<unknown> => (i < chain.length ? (chain[i] as Hook)($, input, at(i + 1)) : core(input));
    try {
      return await at(0)(e);
    } catch (err) {
      log(`mod hook ${event} failed: ${err instanceof Error ? err.stack : String(err)}`);
      return undefined;
    }
  };
  if (job.pluginDir) {
    const manifest = readJson<{ modules: string[] }>(join(job.pluginDir, 'hooks', 'hooks.json'));
    for (const m of manifest?.modules ?? []) {
      const mod = (await import(pathToFileURL(join(job.pluginDir, 'hooks', m)).href)) as { register: (on: (event: string, hook: Hook) => void, options: unknown) => void };
      mod.register((event, hook) => modHooks.set(event, [...(modHooks.get(event) ?? []), hook]), {});
    }
    log(`loaded mod hooks: ${[...modHooks.keys()].join(', ')}`);
  }

  let approve: (() => void) | null = null;
  process.on('SIGUSR1', () => {
    approve?.();
    approve = null;
  });
  const shutdown = async () => {
    await runHooks('SessionEnd', { reason: 'other' });
    for (const c of children) c.kill();
    for (const client of tools.values()) await client.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());

  await runHooks('SessionStart', { source: job.resume ? 'resume' : 'startup', model: job.model ?? 'claude-fake-1' });
  await dispatch('session.start', { cwd: job.cwd, surface: 'terminal', isInteractive: true }, (e) => ({ cwd: e.cwd }));
  log('session ready');

  const turnMs = Number(env.FAKE_CLAUDE_TURN_MS ?? 300);
  for (;;) {
    const next = queue.shift();
    if (!next) {
      await new Promise<void>((r) => (wake = r));
      wake = null;
      continue;
    }
    log(`submitted: ${next.text}`);
    const turnId = randomBytes(4).toString('hex');
    const started = Date.now();
    setStatus('busy');
    await runHooks('UserPromptSubmit', { prompt: next.text });
    await dispatch('turn.start', { text: next.text, turnId }, () => ({ turnId }));
    next.started();
    await new Promise((r) => setTimeout(r, turnMs));
    const body = /<channel [^>]*>\n([\s\S]*)\n<\/channel>/.exec(next.text)?.[1] ?? next.text;
    if (body.includes('needs approval')) {
      await callTool('status', { text: 'idle' });
      setStatus('waiting', 'permission prompt');
      await runHooks('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'touch approved' } });
      await new Promise<void>((r) => (approve = r));
      setStatus('busy');
      await runHooks('PostToolUse', { tool_name: 'Bash' });
      await new Promise((r) => setTimeout(r, turnMs));
    }
    const topic = /\btopic="([^"]+)"/.exec(next.text)?.[1];
    const msgId = /\bmsg_id="([^"]+)"/.exec(next.text)?.[1];
    await callTool('send', { text: `pong: ${body}`, ...(topic ? { topic } : {}), ...(msgId ? { reply_to: msgId } : {}) });
    setStatus('idle');
    await runHooks('Stop', { last_assistant_message: `pong: ${body}` });
    await dispatch('turn.complete', { turnId, answer: `pong: ${body}`, durationMs: Date.now() - started, isAborted: false, reason: 'answer', usage: { model: job.model ?? 'claude-fake-1', inputTokens: 10, outputTokens: 2 } }, (e) => ({ text: e.answer }));
  }
}

process.exitCode = await main(process.argv.slice(2));
