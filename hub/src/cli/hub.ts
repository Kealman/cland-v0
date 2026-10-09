// `cland hub start | status | stop | serve`: the project's hub daemon, run from the project's root (or
// anywhere inside it).
import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serveProject } from '../hub/daemon.ts';
import { createStdioEdge } from '../hub/stdio.ts';
import { jsonLinesLog } from '../log.ts';
import { hubDiscovery, layout, pidAlive, projectRoot, readDiscovery, removeDiscovery, type Discovery, type Layout } from '../project.ts';
import type { HubStatus } from '../protocol.ts';
import { withRole } from '../names.ts';
import { askHub, askHubFrame, probe } from './socket-client.ts';
import { journalPath, readJournal } from '../hub/journal.ts';
import { liveHolder } from '../hub/lock.ts';
import { formatAudit, parseSince, readAudit, type AuditFilter } from '../hub/audit.ts';

const CLI_ENTRY = fileURLToPath(new URL('../../bin/cland.ts', import.meta.url));
/** How long `start` waits for the daemon to answer, and `stop` for it to exit. */
const START_DEADLINE_MS = 15_000;
const STOP_DEADLINE_MS = 10_000;

export const HUB_USAGE = `  hub start       start the project's hub in the background (idempotent)
  hub status      show the running hub and its connected sessions (--json for JSON)
  hub stop        stop the project's hub
  hub serve       run the hub in the foreground (what start runs)
                  --stdio: also speak the UI's frames on stdin/stdout, and stop when stdin ends;
                    when the listeners cannot bind (a sandbox), it goes on over stdio alone
                  --stdio --no-listen: stdio alone, binding nothing
  hub audit       every tool call the hub answered, allowed or refused (.cland/log/hub.log)
                  --session <name> (human: the UI and the CLI), --since <ISO time | 30m, 2h, 1d>, --json
  hub unmute <a> <b>
                  lift the loop breaker's mute of two sessions before its cool-down ends
  hub journal     the journal (.cland/journal.jsonl), oldest first
                  --since <ISO date | 30s | 10m | 2h | 1d>, --kind <event>[,<event>…], --json (the lines as they are)
`;

type Io = { out: (s: string) => void; err: (s: string) => void };
const stdio: Io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const duration = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};

function describe(s: HubStatus): string {
  const lines = [`  pid      ${s.pid}`, `  port     ${s.port} (127.0.0.1)`, `  socket   ${s.socket}`, `  uptime   ${duration(s.uptimeMs)}`, `  version  ${s.version}`, `sessions: ${s.sessions.length}`];
  for (const p of s.sessions) lines.push(`  ${withRole(p.name, p.role)}  [${p.state ?? 'unknown'}]${p.status ? `  — ${p.status}` : ''}`);
  if (s.coordinator !== undefined) lines.push(s.coordinator ? `coordinator: ${s.coordinator}` : 'no coordinator');
  const launched = s.harnesses ?? [];
  if (launched.length) lines.push(`launched: ${launched.length}`);
  for (const h of launched) lines.push(`  ${withRole(h.name, h.role)}  ${h.harness}  ${h.status}  [${h.state}]  pid ${h.pid ?? '?'}${h.attach ? `  — ${h.attach}` : ''}`);
  return `${lines.join('\n')}\n`;
}

/** Whether `pid` is the project's hub: the process holding `.cland/hub.lock`, started when the lock says. */
const ownsProject = (lockFile: string, pid: number): boolean => liveHolder(lockFile)?.pid === pid;

/**
 * What `hub.json` says and whether it is true: a live hub, a stale file (its pid is gone, or is a live
 * process that does not hold the project's lock — a reused pid), a hub that does not answer, or nothing.
 */
async function inspect(l: Layout): Promise<{ kind: 'none' } | { kind: 'stale'; d: Discovery; why: string } | { kind: 'mute'; d: Discovery } | { kind: 'live'; d: Discovery; status: HubStatus }> {
  const d = readDiscovery(l.discovery);
  if (!d) return { kind: 'none' };
  if (!pidAlive(d.pid)) return { kind: 'stale', d, why: `pid ${d.pid} is gone` };
  const status = await probe(d);
  if (status) return { kind: 'live', d, status };
  return ownsProject(l.lock, d.pid) ? { kind: 'mute', d } : { kind: 'stale', d, why: `pid ${d.pid} is not this project's hub` };
}

async function waitForExit(pid: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!pidAlive(pid)) return true;
    await sleep(25);
  }
  return !pidAlive(pid);
}

async function start(root: string, io: Io): Promise<number> {
  const l = layout(root);
  const found = await inspect(l);
  if (found.kind === 'live') {
    io.out(`hub already running for ${root}\n${describe(found.status)}`);
    return 0;
  }
  if (found.kind === 'mute') {
    io.err(`cland: pid ${found.d.pid} holds ${l.discovery} but does not answer on ${found.d.socket} — run \`cland hub stop\` first\n`);
    return 1;
  }
  if (found.kind === 'stale') {
    io.out(`replacing a stale ${l.discovery} (${found.why})\n`);
    rmSync(l.discovery, { force: true });
  }

  mkdirSync(l.logDir, { recursive: true });
  const logFd = openSync(l.log, 'a');
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], { cwd: root, detached: true, stdio: ['ignore', logFd, logFd], env: process.env });
  closeSync(logFd);
  child.unref();
  let exited: number | null = null;
  child.once('exit', (code) => (exited = code ?? -1));

  // Our child serves, or — when another start got the project's lock first — exits, and the hub to report
  // is the lock's holder: either way the answer is the hub `hub.json` names once it answers.
  const deadline = Date.now() + START_DEADLINE_MS;
  while (Date.now() < deadline) {
    const holder = liveHolder(l.lock);
    if (exited !== null && holder === null) break;
    const d = readDiscovery(l.discovery);
    if (d && (d.pid === child.pid || d.pid === holder?.pid)) {
      const status = await probe(d);
      if (status) {
        io.out(d.pid === child.pid ? `hub started for ${root}\n${describe(status)}` : `hub already running for ${root}\n${describe(status)}`);
        return 0;
      }
    }
    await sleep(50);
  }
  if (exited === null && child.pid !== undefined) child.kill('SIGKILL');
  let tail = '';
  try {
    tail = readFileSync(l.log, 'utf8').split('\n').slice(-15).join('\n');
  } catch {
    /* no log */
  }
  io.err(`cland: the hub did not start${exited !== null ? ` (exited with ${exited})` : ` within ${START_DEADLINE_MS / 1000} s`}; ${l.log}:\n${tail}\n`);
  return 1;
}

async function status(l: Layout, json: boolean, io: Io): Promise<number> {
  const root = l.root;
  const found = await inspect(l);
  switch (found.kind) {
    case 'live':
      io.out(json ? `${JSON.stringify(found.status)}\n` : `hub running for ${found.status.root}\n${describe(found.status)}`);
      return 0;
    case 'none':
      io.out(json ? `${JSON.stringify({ running: false, root })}\n` : `no hub running for ${root}\n`);
      return 1;
    case 'stale':
      io.out(json ? `${JSON.stringify({ running: false, root, stale: found.d.pid })}\n` : `no hub running for ${root} (stale ${l.discovery}: ${found.why})\n`);
      return 1;
    case 'mute':
      io.err(`cland: pid ${found.d.pid} holds ${l.discovery} but does not answer on ${found.d.socket}\n`);
      return 1;
  }
}

async function stop(l: Layout, rootKnown: boolean, io: Io): Promise<number> {
  const root = l.root;
  const d = readDiscovery(l.discovery);
  if (!d) {
    io.out(`no hub running for ${root}\n`);
    return 0;
  }
  if (pidAlive(d.pid)) {
    let asked = true;
    try {
      await askHub(d, 'hub.stop');
    } catch {
      asked = false;
    }
    if (!(asked && (await waitForExit(d.pid, STOP_DEADLINE_MS)))) {
      if (!rootKnown) {
        io.err(`cland: cannot verify the project root for ${l.discovery}; pid ${d.pid} is left running\n`);
        return 1;
      }
      // The socket did not take the request, or the hub did not leave in time: the signal's turn — but only
      // for the process that holds the project's lock. Any other is a stranger behind a reused pid.
      if (!ownsProject(l.lock, d.pid)) {
        removeDiscovery(l.discovery, d.pid);
        io.out(`pid ${d.pid} named by ${l.discovery} is not this project's hub (it does not hold ${l.lock}); left it running and removed the stale ${l.discovery}\n`);
        return 0;
      }
      process.kill(d.pid, 'SIGTERM');
      if (!(await waitForExit(d.pid, STOP_DEADLINE_MS))) {
        io.err(`cland: pid ${d.pid} did not exit after SIGTERM; it is left running\n`);
        return 1;
      }
    }
    io.out(`hub stopped for ${root} (pid ${d.pid})\n`);
  } else {
    io.out(`removed a stale ${l.discovery} (pid ${d.pid} was gone)\n`);
  }
  // A hub that stopped cleanly removed its own files. One that died without cleaning up leaves hub.json
  // naming it, and its socket: those go, unless another hub holds the project's lock by now (its socket
  // may already stand at that path). A newer hub's hub.json is never touched.
  if (readDiscovery(l.discovery)?.pid === d.pid) {
    removeDiscovery(l.discovery, d.pid);
    // A copied discovery may still name the old hub after the canonical file names a replacement.
    const canonical = layout(root).discovery;
    const current = rootKnown ? readDiscovery(canonical) : null;
    const ownsSocket = l.discovery === canonical || current?.pid === d.pid;
    if (rootKnown && ownsSocket && liveHolder(l.lock) === null) rmSync(d.socket, { force: true });
  }
  return 0;
}

async function serve(root: string, stdio: boolean, listen: boolean, io: Io): Promise<number> {
  if (!listen && !stdio) {
    io.err('cland: --no-listen needs --stdio: a hub with neither could not be reached\n');
    return 2;
  }
  const log = jsonLinesLog((line) => process.stderr.write(line));
  // A stdio hub serves its parent even where listening is forbidden; the project's lock is taken either way.
  const daemon = await serveProject(root, { log, listen: !listen ? 'never' : stdio ? 'optional' : 'required' });
  if (stdio) {
    // a UI spawned this hub as its child: stdout carries frames only, and the parent leaving stops the hub
    createStdioEdge({ input: process.stdin, output: process.stdout, dispatcher: daemon.hub.dispatcher, log, onEnd: () => void daemon.stop() });
  }
  const onSignal = (signal: NodeJS.Signals) => {
    log({ event: 'signal', signal });
    void daemon.stop();
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
  // a daemon has no terminal to lose
  process.on('SIGHUP', () => log({ event: 'signal', signal: 'SIGHUP', ignored: true }));
  const where = daemon.discovery ? `127.0.0.1:${daemon.discovery.port} and ${daemon.discovery.socket}${stdio ? ' and stdio' : ''}` : 'stdio only, no listeners';
  (stdio ? process.stderr : process.stdout).write(`hub serving ${root} on ${where} (pid ${process.pid})\n`);
  await daemon.stopped;
  return 0;
}

/** `cland hub audit`: the audit records in the hub's log, oldest first; one JSON object per line with `--json`. */
function audit(root: string, args: string[], io: Io): number {
  const filter: AuditFilter = {};
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = (): string | null => {
      const v = args[i + 1];
      i++;
      return v === undefined || v.startsWith('--') ? null : v;
    };
    if (a === '--json') json = true;
    else if (a === '--session') {
      const v = value();
      if (v === null) return usageError(io, '--session needs a session name');
      filter.session = v;
    } else if (a === '--since') {
      const v = value();
      const since = v === null ? null : parseSince(v);
      if (since === null) return usageError(io, `--since needs an ISO time or a span such as 30m, 2h, 1d${v ? ` (not "${v}")` : ''}`);
      filter.since = since;
    } else return usageError(io, `unknown argument "${a}"`);
  }
  let text = '';
  try {
    text = readFileSync(layout(root).log, 'utf8');
  } catch {
    /* no log yet: no calls */
  }
  const records = readAudit(text, filter);
  for (const r of records) io.out(json ? `${JSON.stringify(r)}\n` : `${formatAudit(r)}\n`);
  if (!json && !records.length) io.out('no tool calls recorded\n');
  return 0;
}

const usageError = (io: Io, why: string): number => {
  io.err(`cland: hub audit: ${why}\n\nusage: cland hub <command>\n\n${HUB_USAGE}`);
  return 2;
};
async function unmute(l: Layout, names: string[], io: Io): Promise<number> {
  const [a, b] = names;
  if (!a || !b || names.length !== 2) {
    io.err('usage: cland hub unmute <session> <session>\n');
    return 2;
  }
  const d = readDiscovery(l.discovery);
  if (!d) {
    io.err(`cland: no hub running for ${l.root}: a mute is lifted on the running hub (it is kept in hub.db until then)\n`);
    return 1;
  }
  try {
    const r = (await askHubFrame(d, { type: 'hygiene.unmute', a, b })) as { lifted: boolean; pair: [string, string] };
    io.out(r.lifted ? `unmuted ${r.pair.join(' ↔ ')}\n` : `${r.pair.join(' ↔ ')} was not muted (its count starts afresh)\n`);
    return 0;
  } catch (err) {
    io.err(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

/** One journal record as a line: the time, the event, and its fields. */
function journalLine(r: Record<string, unknown>): string {
  const { ts, event, ...rest } = r;
  const fields = Object.entries(rest)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  return `${String(ts)}  ${String(event)}${fields ? `  ${fields}` : ''}`;
}

function journal(root: string, args: string[], io: Io): number {
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const since = flag('--since');
  const kind = flag('--kind');
  try {
    const records = readJournal(journalPath(layout(root).dir), { ...(since !== undefined ? { since } : {}), ...(kind !== undefined ? { kinds: kind.split(',').map((k) => k.trim()).filter(Boolean) } : {}) });
    const json = args.includes('--json');
    for (const r of records) io.out(`${json ? JSON.stringify(r) : journalLine(r)}\n`);
    return 0;
  } catch (err) {
    io.err(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }
}

/** `cland hub <sub> [flags]`; the process exit code. */
export async function runHub(args: string[], cwd: string = process.cwd(), io: Io = stdio): Promise<number> {
  const [sub, ...rest] = args;
  const root = projectRoot(cwd);
  // Start/serve own the cwd's project. Discovery records an existing hub's actual root, independent
  // of where the file lives. Older copies need a successful probe before lock checks or cleanup.
  const discovery = hubDiscovery(cwd);
  const overridden = process.env.CLAND_HUB_FILE?.trim() && ['status', 'stop', 'unmute'].includes(sub ?? '');
  const d = overridden ? readDiscovery(discovery) : null;
  let target = overridden ? d?.root ?? null : root;
  if (overridden && sub === 'stop' && target === null) {
    target = (d && await probe(d))?.root ?? null;
  }
  const l = { ...layout(target ?? root), discovery };
  switch (sub) {
    case 'start':
      return start(root, io);
    case 'status':
      return status(l, rest.includes('--json'), io);
    case 'stop':
      return stop(l, target !== null, io);
    case 'audit':
      return audit(root, rest, io);
    case 'unmute':
      return unmute(l, rest, io);
    case 'journal':
      return journal(root, rest, io);
    case 'serve':
      return serve(root, rest.includes('--stdio') || (rest.includes('--transport') && rest[rest.indexOf('--transport') + 1] === 'stdio'), !rest.includes('--no-listen'), io);
    default:
      io.err(`cland: unknown hub command "${sub ?? ''}"\n\nusage: cland hub <command>\n\n${HUB_USAGE}`);
      return 2;
  }
}
