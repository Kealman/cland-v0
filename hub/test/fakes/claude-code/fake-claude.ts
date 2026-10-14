// A fake Claude Code: the harness process boundary the Claude Code adapter is tested against. It honours the
// surfaces the adapter uses, and nothing else:
//
//   claude --bg [--session-id <uuid> | --resume <uuid>] [--name n] [--model m] [--effort e] --mcp-config <json> --settings <json> --plugin-dir <dir>
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
//       SIGUSR1 (the approval), then PostToolUse. A prompt that is "rename to <name>" calls the spoke's `rename`
//       tool first. A prompt that is `[@<name> ]cland <args…>` runs the cland CLI (`$CLAND_NODE $CLAND_CLI <args…>`,
//       split on spaces) in the session's own environment, as a Bash tool call would, and answers
//       "ran: cland <args…>: exit <code>" with its stdout and stderr instead of the pong. A prompt that is
//       `worktree <name>` asks for a worktree as `--worktree` and sub-agents do: the WorktreeCreate hooks run with
//       `{name}` (awaited, whatever `async` says); the first that exits non-zero refuses it, a zero exit's stdout is
//       the path; with no hook, the default. It answers "worktree <name>: refused (exit <code>): <stderr>",
//       "worktree <name>: <path>" or "worktree <name>: default git worktree".
//   claude -p /usage --output-format stream-json --verbose   assistant usage_report from CONFIG_DIR/usage-report.json
//   claude agents --json   the live sessions (pid, id, sessionId, cwd, kind, status, waitingFor)
//       CONFIG_DIR/agents-hold gates entry until agents-release, with agents-started/finished PID receipts.
//       CONFIG_DIR/agents-omit hides entries to model a supervisor that has not published its PID yet.
//   claude attach <id>     prints `fake claude attached to <id>` (each attached client prints it)
//   claude stop <id>       SIGTERM to the session (SessionEnd, then exit)
//   claude --version       `2.1.294 (Claude Code)` (FAKE_CLAUDE_VERSION overrides the number), for `cland doctor`
//   claude auth status --json   `{"loggedIn": true, "authMethod": "claude.ai", …}`; FAKE_CLAUDE_LOGGED_OUT=1: false, exit 1
//
// Like the real one, a session also runs the hooks of the project's `.claude/settings.json` (before the `--settings`
// ones), and reads its instructions: `CLAUDE.md` with its `@<path>` imports, or `AGENTS.md` when there is no
// `CLAUDE.md` (spec 4.9). What it loaded is written to jobs/<id>.context.json: the instruction files and their text,
// and the hook commands per event.
// FAKE_CLAUDE_LATE_BG=1 makes `--bg` return only after the session's SessionStart hook ran to its end (an `async`
// hook's process too: it has posted to the hub); =bridged, only after the mod's bridge was also answered by the hub.
// FAKE_CLAUDE_STOP_CRASH=1 makes `claude stop` die by a signal without stopping anything.
// FAKE_CLAUDE_IGNORE_TERM=1 makes the session ignore SIGTERM (only SIGKILL ends it).
// FAKE_CLAUDE_DROP_FIRST=1 drops the first prompt the mod submits (as a harness hook would), so it is never confirmed.
// State lives under FAKE_CLAUDE_HOME (sessions/<id>.json, jobs/<id>.json, jobs/<id>.log). FAKE_CLAUDE_TURN_MS is
// how long a turn "thinks" (default 300).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const HOME = process.env.FAKE_CLAUDE_HOME ?? join(process.env.TMPDIR ?? '/tmp', 'fake-claude-home');
const SESSIONS = join(HOME, 'sessions');
const JOBS = join(HOME, 'jobs');
mkdirSync(SESSIONS, { recursive: true });
mkdirSync(JOBS, { recursive: true });
const CONFIG_DIR = resolve(process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME ?? '', '.claude'));
const AUTH_VARIABLES = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'];
const SELF = fileURLToPath(import.meta.url);

type Job = { configDir: string; authVariables: string[]; id: string; sessionId: string; name: string | null; model: string | null; effort: string | null; cwd: string; resume: boolean; mcp: McpConfig; settings: Settings; pluginDir: string | null };
type McpConfig = { mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> };
type HookEntry = { matcher?: string; hooks: Array<{ type: string; command: string; async?: boolean }> };
type Settings = { hooks?: Record<string, HookEntry[]>; env?: Record<string, string> };
type SessionFile = { configDir: string; pid: number; id: string; sessionId: string; cwd: string; kind: 'background'; startedAt: number; name: string | null; status: 'idle' | 'busy' | 'waiting'; waitingFor?: string };

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
  const configDir = CONFIG_DIR;
  if (first === 'agents' && existsSync(join(CONFIG_DIR, 'agents-hold'))) {
    writeFileSync(join(CONFIG_DIR, 'agents-started'), String(process.pid));
    while (!existsSync(join(CONFIG_DIR, 'agents-release'))) await new Promise(r => setTimeout(r, 10));
  }
  appendFileSync(join(HOME, 'calls.jsonl'), `${JSON.stringify({ at: Date.now(), args, configDir })}\n`);
  appendFileSync(join(HOME, 'invocations.jsonl'), `${JSON.stringify({ at: Date.now(), args, subcommand: first, configDir, CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR ?? null })}\n`);
  if ((first === 'agents' || args.includes('--bg')) && (existsSync(join(HOME, 'logged-out')) || existsSync(join(CONFIG_DIR, 'logged-out')))) {
    process.stderr.write('OAuth token has expired. Please run claude auth login.\n');
    if (first === 'agents' && existsSync(join(CONFIG_DIR, 'agents-hold'))) writeFileSync(join(CONFIG_DIR, 'agents-finished'), String(process.pid));
    return 1;
  }
  if (first === '-p' && args[1] === '/usage') {
    appendFileSync(join(HOME, 'polls.jsonl'), JSON.stringify({ at: Date.now(), pid: process.pid, args, cwd: process.cwd(), env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('CLAND_') || key === 'CLAUDE_CONFIG_DIR' || AUTH_VARIABLES.includes(key))) }) + '\n');
    if (existsSync(join(CONFIG_DIR, 'usage-hang'))) {
      process.on('SIGTERM', () => {});
      const descendant = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
      writeFileSync(join(CONFIG_DIR, 'usage-descendant'), String(descendant.pid));
      await new Promise<void>(() => { setInterval(() => {}, 1000); });
    }
    if (existsSync(join(CONFIG_DIR, 'usage-fail'))) { process.stderr.write('429 rate limited — private output\n'); return 1; }
    if (existsSync(join(CONFIG_DIR, 'logged-out'))) { process.stderr.write('Not logged in\n'); return 1; }
    const usage = readFileSync(join(CONFIG_DIR, 'usage-report.json'), 'utf8');
    if (existsSync(join(CONFIG_DIR, 'usage-hold'))) {
      while (!existsSync(join(CONFIG_DIR, 'usage-release'))) await new Promise(r => setTimeout(r, 10));
    }
    process.stdout.write(JSON.stringify({ type: 'assistant', usage_report: JSON.parse(usage) }) + '\n');
    return 0;
  }
  if (first === '--version' || first === '-v') {
    process.stdout.write(`${process.env.FAKE_CLAUDE_VERSION ?? '2.1.294'} (Claude Code)\n`);
    return 0;
  }
  if (first === 'auth' && args[1] === 'status') {
    const loggedIn = process.env.FAKE_CLAUDE_LOGGED_OUT !== '1';
    process.stdout.write(`${JSON.stringify({ loggedIn, authMethod: loggedIn ? 'claude.ai' : 'none', apiProvider: 'firstParty' }, null, 2)}\n`);
    return loggedIn ? 0 : 1;
  }
  if (first === 'agents') {
    const entries = readdirSync(SESSIONS)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson<SessionFile>(join(SESSIONS, f)))
      .filter((s): s is SessionFile => s !== null && s.configDir === CONFIG_DIR && alive(s.pid) && !existsSync(join(CONFIG_DIR, 'agents-omit')));
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    return 0;
  }
  if (first === 'attach') {
    const s = readJson<SessionFile>(join(SESSIONS, `${args[1]}.json`));
    if (!s || s.configDir !== CONFIG_DIR || !alive(s.pid)) {
      process.stderr.write(`no background session ${args[1]}\n`);
      return 1;
    }
    process.stdout.write(`fake claude attached to ${args[1]} (${s.name ?? 'unnamed'})\n`);
    return 0;
  }
  if (first === 'stop' || first === 'kill') {
    if (process.env.FAKE_CLAUDE_STOP_CRASH === '1') process.kill(process.pid, 'SIGKILL');
    const s = readJson<SessionFile>(join(SESSIONS, `${args[1]}.json`));
    if (s && s.configDir === CONFIG_DIR && alive(s.pid)) process.kill(s.pid, 'SIGTERM');
    process.stdout.write(`stopped ${args[1]}\n`);
    return 0;
  }
  if (args.includes('--bg') || args.includes('--background')) return startBackground(args);
  process.stderr.write(`fake claude: unsupported invocation ${JSON.stringify(args)}\n`);
  return 1;
}

async function startBackground(args: string[]): Promise<number> {
  const resumeOf = flag(args, '--resume', '-r');
  const previous = resumeOf ? readdirSync(JOBS).filter((f) => f.endsWith('.json')).map((f) => readJson<Job>(join(JOBS, f))).find((j) => j?.sessionId === resumeOf && j.configDir === CONFIG_DIR) : undefined;
  const id = previous?.id ?? randomBytes(4).toString('hex');
  const job: Job = {
    configDir: CONFIG_DIR, authVariables: AUTH_VARIABLES.filter(key => Object.hasOwn(process.env, key)),
    id,
    sessionId: previous?.sessionId ?? `${id}${crypto.randomUUID().slice(8)}`,
    name: flag(args, '--name', '-n') ?? null,
    model: flag(args, '--model') ?? null,
    effort: flag(args, '--effort') ?? null,
    cwd: process.cwd(),
    resume: resumeOf !== undefined,
    mcp: jsonArg<McpConfig>(flag(args, '--mcp-config')),
    settings: jsonArg<Settings>(flag(args, '--settings')),
    pluginDir: flag(args, '--plugin-dir') ?? null,
  };
  writeJson(join(JOBS, `${id}.json`), job);
  // Native background sessions do not retain the launching CLI's cland environment.
  // Session settings and MCP config must carry every identity field they need.
  const child = spawn(process.execPath, [SELF, '__session', id], {
    cwd: job.cwd, detached: true, stdio: 'ignore',
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_'))),
  });
  child.unref();
  // the supervisor has the session once its file names a live pid
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const s = readJson<SessionFile>(join(SESSIONS, `${id}.json`));
    if (s && s.pid === child.pid) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  // FAKE_CLAUDE_LATE_BG=1: return only once the session ran its SessionStart hook, as the real one can
  const late = process.env.FAKE_CLAUDE_LATE_BG;
  if (late === '1' || late === 'bridged') {
    const marker = late === 'bridged' ? 'mod bridge bridged' : 'hooks SessionStart done';
    while (Date.now() < deadline && !readFileSync(join(JOBS, `${id}.log`), { encoding: 'utf8', flag: 'a+' }).includes(marker)) await new Promise((r) => setTimeout(r, 20));
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
  const state: SessionFile = { configDir: job.configDir, pid: process.pid, id, sessionId: job.sessionId, cwd: job.cwd, kind: 'background', startedAt: Date.now(), name: job.name, status: 'idle' };
  const setStatus = (status: SessionFile['status'], waitingFor?: string) => {
    state.status = status;
    if (waitingFor) state.waitingFor = waitingFor;
    else delete state.waitingFor;
    writeJson(file, state);
  };
  setStatus('idle');

  // the hooks: the project's settings, then the `--settings` ones
  const project = readJson<Settings>(join(job.cwd, '.claude', 'settings.json')) ?? {};
  const hooksOf = (event: string): HookEntry[] => [...(project.hooks?.[event] ?? []), ...(job.settings.hooks?.[event] ?? [])];
  // the instructions: CLAUDE.md and what it imports, else AGENTS.md
  const instructions: Array<{ file: string; text: string }> = [];
  const claudeMd = join(job.cwd, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    const text = readFileSync(claudeMd, 'utf8');
    instructions.push({ file: 'CLAUDE.md', text });
    for (const m of text.matchAll(/^@(\S+)[ \t]*$/gm)) {
      const file = m[1] as string;
      if (existsSync(join(job.cwd, file))) instructions.push({ file, text: readFileSync(join(job.cwd, file), 'utf8') });
    }
  } else if (existsSync(join(job.cwd, 'AGENTS.md'))) instructions.push({ file: 'AGENTS.md', text: readFileSync(join(job.cwd, 'AGENTS.md'), 'utf8') });
  const events = new Set([...Object.keys(project.hooks ?? {}), ...Object.keys(job.settings.hooks ?? {})]);
  writeJson(join(JOBS, `${id}.context.json`), { instructions, hooks: Object.fromEntries([...events].map((e) => [e, hooksOf(e).flatMap((h) => h.hooks.map((x) => x.command))])) });

  // the settings hooks: a shell command, the payload on stdin; `async` ones run in the background
  let promptId: string | undefined;
  const runHooks = async (event: string, payload: Record<string, unknown>) => {
    const background: Array<Promise<void>> = [];
    for (const entry of hooksOf(event)) {
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
          // A hook may exit without reading its payload. Its exit code still decides the hook outcome.
          child.stdin.on('error', () => {});
          child.stdin.end(JSON.stringify({ session_id: job.sessionId, prompt_id: promptId, hook_event_name: event, cwd: job.cwd, ...payload }));
        });
        if (!h.async) await run;
        else background.push(run);
      }
    }
    // when the event's background hooks have all exited (each `cland hook` waits for the hub's answer)
    void Promise.all(background).then(() => log(`hooks ${event} done`));
  };

  // WorktreeCreate replaces Claude Code's own `git worktree add`: its stdout is the path, a non-zero exit refuses
  const createWorktree = async (name: string): Promise<string> => {
    const commands = hooksOf('WorktreeCreate').flatMap((e) => e.hooks.filter((h) => h.type === 'command').map((h) => h.command));
    if (!commands.length) return `worktree ${name}: default git worktree`;
    for (const command of commands) {
      const r = await new Promise<{ code: number | null; out: string; err: string }>((resolve) => {
        const child = spawn('sh', ['-c', command], { cwd: job.cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        child.stdout.on('data', (c: Buffer) => (out += String(c)));
        child.stderr.on('data', (c: Buffer) => (err += String(c)));
        child.on('close', (code) => resolve({ code, out, err }));
        child.on('error', (e) => resolve({ code: -1, out, err: e.message }));
        child.stdin.on('error', () => {});
        child.stdin.end(JSON.stringify({ session_id: job.sessionId, hook_event_name: 'WorktreeCreate', cwd: job.cwd, name }));
      });
      log(`hook WorktreeCreate exited ${r.code}: ${r.err.trim()}`);
      if (r.code !== 0) return `worktree ${name}: refused (exit ${r.code}): ${r.err.trim()}`;
      if (r.out.trim()) return `worktree ${name}: ${r.out.trim()}`;
    }
    return `worktree ${name}: default git worktree`;
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
            if (argv[3] === 'mod-measure') log(`mod-measure posted: ${init.stdin}`);
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
        child.stdout?.on('data', (c: Buffer) => {
          if (String(c).includes('"type":"bridged"')) log('mod bridge bridged');
          pieces.push({ stream: 'stdout', text: String(c) });
          push();
        });
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
  let measuredLimits = '[]';
  const dispatch = async (event: string, e: Record<string, unknown>, core: (e: Record<string, unknown>) => unknown) => {
    const chain = modHooks.get(event) ?? [];
    const at = (i: number) => async (input: Record<string, unknown>): Promise<unknown> => (i < chain.length ? (chain[i] as Hook)($, input, at(i + 1)) : core(input));
    try {
      const result = await at(0)(e);
      if (event === 'turn.complete') {
        const rateLimits = readJson<unknown[]>(join(env.CLAUDE_CONFIG_DIR || join(env.HOME ?? '', '.claude'), 'rate-limits.json')) ?? [];
        const changed = JSON.stringify(rateLimits) !== measuredLimits;
        measuredLimits = JSON.stringify(rateLimits);
        await dispatch('session.measure', { context: { used: 900 }, cost: { total: 7 }, rateLimits, changed: changed ? ['rateLimits', 'context', 'cost'] : ['context', 'cost'] }, () => ({}));
        log('session.measure done');
      }
      return result;
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
  process.on('SIGTERM', () => {
    if (env.FAKE_CLAUDE_IGNORE_TERM === '1') log('ignored SIGTERM');
    else void shutdown();
  });

  await runHooks('SessionStart', { source: job.resume ? 'resume' : 'startup', ...(job.model ? { model: job.model } : {}) });
  await dispatch('session.start', { cwd: job.cwd, surface: 'terminal', isInteractive: true }, (e) => ({ cwd: e.cwd }));
  log('session ready');

  // a session lives until it is stopped, with or without an MCP server holding the loop open
  setInterval(() => {}, 1 << 30);
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
    promptId = turnId;
    const started = Date.now();
    setStatus('busy');
    await runHooks('UserPromptSubmit', { prompt: next.text });
    await dispatch('turn.start', { text: next.text, turnId }, () => ({ turnId }));
    next.started();
    await new Promise((r) => setTimeout(r, turnMs));
    const channels = [...next.text.matchAll(/<channel ([^>]*)>\n([\s\S]*?)\n<\/channel>/g)];
    const command = channels.find((channel) => {
      if (/\bkind="(?:event|progress)"/.test(channel[1] ?? '')) return false;
      const text = (channel[2] ?? '').trim();
      return /^(?:@\S+\s+)*(?:worktree\s+\S+|cland\s+.+)$/.test(text)
        || /^rename to \S+$/.test(text)
        || text.includes('fail this turn')
        || text.includes('hit the usage limit')
        || text.includes('hit an overloaded error')
        || text.includes('needs approval');
    });
    const body = command?.[2] ?? /<channel [^>]*>\n([\s\S]*)\n<\/channel>/.exec(next.text)?.[1] ?? next.text;
    const actionable = command !== undefined || channels.length === 0;
    if (actionable && (body.includes('fail this turn') || body.includes('hit the usage limit') || body.includes('hit an overloaded error'))) {
      setStatus('idle');
      await runHooks('StopFailure', { error: body.includes('hit the usage limit') ? 'rate_limit' : body.includes('hit an overloaded error') ? 'overloaded' : 'server_error', error_details: body.includes('hit the usage limit') || body.includes('hit an overloaded error') ? '429 Too Many Requests' : 'Upstream request failed: Endpoint is unavailable\nupstream details' });
      await dispatch('turn.complete', { turnId, isAborted: false, reason: 'error' }, () => ({}));
      continue;
    }
    if (body.includes('spawn subagents')) {
      for (const [agent_id, model] of [['known-child', 'claude-child-1'], ['unknown-child', null]]) {
        await runHooks('SubagentStart', { agent_id, agent_type: 'Explore', ...(model ? { model } : {}) });
        await runHooks('SubagentStop', { agent_id, agent_type: 'Explore' });
      }
    }
    const rename = actionable ? /^rename to (\S+)$/.exec(body.trim()) : null;
    if (rename) await callTool('rename', { name: rename[1] });
    if (actionable && body.includes('needs approval')) {
      await callTool('status', { text: 'idle' });
      setStatus('waiting', 'permission prompt');
      await runHooks('PermissionRequest', { tool_name: body.includes('needs approval for Edit') ? 'Edit' : 'Bash', tool_input: { command: 'touch approved', content: 'PRIVATE-TOOL-INPUT' } });
      await new Promise<void>((r) => (approve = r));
      setStatus('busy');
      await runHooks('PostToolUse', { tool_name: 'Bash' });
      await new Promise((r) => setTimeout(r, turnMs));
    }
    const envelope = command?.[1] ?? next.text;
    const topic = /\btopic="([^"]+)"/.exec(envelope)?.[1];
    const msgId = /\bmsg_id="([^"]+)"/.exec(envelope)?.[1];
    const wanted = actionable ? /^(?:@\S+\s+)*worktree\s+(\S+)$/.exec(body.trim()) : null;
    if (wanted) {
      const ran = await createWorktree(wanted[1] as string);
      log(ran);
      await callTool('send', { text: ran, ...(topic ? { topic } : {}), ...(msgId ? { reply_to: msgId } : {}) });
      setStatus('idle');
      await runHooks('Stop', { last_assistant_message: ran });
      await dispatch('turn.complete', { turnId, answer: ran, durationMs: Date.now() - started, isAborted: false, reason: 'answer' }, (e) => ({ text: e.answer }));
      continue;
    }
    const cli = actionable ? /^(?:@\S+\s+)*cland\s+(.+)$/.exec(body.trim()) : null;
    if (cli) {
      const argv = (cli[1] as string).split(/\s+/);
      const ran = await new Promise<string>((resolve) => {
        const child = spawn(env.CLAND_NODE ?? process.execPath, [env.CLAND_CLI as string, ...argv], { cwd: job.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        child.stdout.on('data', (c: Buffer) => (out += String(c)));
        child.stderr.on('data', (c: Buffer) => (out += String(c)));
        child.on('close', (code) => resolve(`ran: cland ${cli[1]}: exit ${code}\n${out.trim()}`));
      });
      log(ran);
      await callTool('send', { text: ran, ...(topic ? { topic } : {}), ...(msgId ? { reply_to: msgId } : {}) });
      setStatus('idle');
      await runHooks('Stop', { last_assistant_message: ran });
      await dispatch('turn.complete', { turnId, answer: ran, durationMs: Date.now() - started, isAborted: false, reason: 'answer', usage: { model: job.model ?? 'claude-fake-1', input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 4, cache_creation_input_tokens: 3 } }, (e) => ({ text: e.answer }));
      continue;
    }
    await callTool('send', { text: `pong: ${body}`, ...(topic ? { topic } : {}), ...(msgId ? { reply_to: msgId } : {}) });
    setStatus('idle');
    await runHooks('Stop', { last_assistant_message: `pong: ${body}` });
    await dispatch('turn.complete', { turnId, answer: `pong: ${body}`, durationMs: Date.now() - started, isAborted: false, reason: 'answer', usage: { model: job.model ?? 'claude-fake-1', input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 4, cache_creation_input_tokens: 3 } }, (e) => ({ text: e.answer }));
  }
}

process.exitCode = await main(process.argv.slice(2));
