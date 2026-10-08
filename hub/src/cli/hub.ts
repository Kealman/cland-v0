// `cland hub start | status | stop | serve`: the project's hub daemon, run from the project's root (or
// anywhere inside it).
import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serveProject } from '../hub/daemon.ts';
import { jsonLinesLog } from '../log.ts';
import { layout, pidAlive, projectRoot, readDiscovery, removeDiscovery, type Discovery } from '../project.ts';
import type { HubStatus } from '../protocol.ts';
import { askHub, probe } from './socket-client.ts';

const CLI_ENTRY = fileURLToPath(new URL('../../bin/cland.ts', import.meta.url));
/** How long `start` waits for the daemon to answer, and `stop` for it to exit. */
const START_DEADLINE_MS = 15_000;
const STOP_DEADLINE_MS = 10_000;

export const HUB_USAGE = `  hub start       start the project's hub as a daemon (idempotent)
  hub status      show the running hub and its connected sessions (--json for JSON)
  hub stop        stop the project's hub
  hub serve       run the hub in the foreground (what the daemon runs)
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
  for (const p of s.sessions) lines.push(`  ${p.name}${p.role ? `  (${p.role})` : ''}${p.status ? `  — ${p.status}` : ''}`);
  return `${lines.join('\n')}\n`;
}

/** What `hub.json` says and whether it is true: a live hub, a stale file, or nothing. */
async function inspect(file: string): Promise<{ kind: 'none' } | { kind: 'stale'; d: Discovery } | { kind: 'mute'; d: Discovery } | { kind: 'live'; d: Discovery; status: HubStatus }> {
  const d = readDiscovery(file);
  if (!d) return { kind: 'none' };
  if (!pidAlive(d.pid)) return { kind: 'stale', d };
  const status = await probe(d);
  return status ? { kind: 'live', d, status } : { kind: 'mute', d };
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
  const found = await inspect(l.discovery);
  if (found.kind === 'live') {
    io.out(`hub already running for ${root}\n${describe(found.status)}`);
    return 0;
  }
  if (found.kind === 'mute') {
    io.err(`cland: pid ${found.d.pid} holds ${l.discovery} but does not answer on ${found.d.socket} — run \`cland hub stop\` first\n`);
    return 1;
  }
  if (found.kind === 'stale') {
    io.out(`replacing a stale ${l.discovery} (pid ${found.d.pid} is gone)\n`);
    rmSync(l.discovery, { force: true });
  }

  mkdirSync(l.logDir, { recursive: true });
  const logFd = openSync(l.log, 'a');
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], { cwd: root, detached: true, stdio: ['ignore', logFd, logFd], env: process.env });
  closeSync(logFd);
  child.unref();
  let exited: number | null = null;
  child.once('exit', (code) => (exited = code ?? -1));

  const deadline = Date.now() + START_DEADLINE_MS;
  while (Date.now() < deadline && exited === null) {
    const d = readDiscovery(l.discovery);
    if (d && d.pid === child.pid) {
      const status = await probe(d);
      if (status) {
        io.out(`hub started for ${root}\n${describe(status)}`);
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

async function status(root: string, json: boolean, io: Io): Promise<number> {
  const l = layout(root);
  const found = await inspect(l.discovery);
  switch (found.kind) {
    case 'live':
      io.out(json ? `${JSON.stringify(found.status)}\n` : `hub running for ${root}\n${describe(found.status)}`);
      return 0;
    case 'none':
      io.out(json ? `${JSON.stringify({ running: false, root })}\n` : `no hub running for ${root}\n`);
      return 1;
    case 'stale':
      io.out(json ? `${JSON.stringify({ running: false, root, stale: found.d.pid })}\n` : `no hub running for ${root} (stale ${l.discovery}: pid ${found.d.pid} is gone)\n`);
      return 1;
    case 'mute':
      io.err(`cland: pid ${found.d.pid} holds ${l.discovery} but does not answer on ${found.d.socket}\n`);
      return 1;
  }
}

async function stop(root: string, io: Io): Promise<number> {
  const l = layout(root);
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
      // the socket did not take the request, or the hub did not leave in time: the signal's turn
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
  // a hub that died without cleaning up leaves these; a newer hub's file is never touched
  removeDiscovery(l.discovery, d.pid);
  rmSync(d.socket, { force: true });
  return 0;
}

async function serve(root: string): Promise<number> {
  const log = jsonLinesLog((line) => process.stderr.write(line));
  const daemon = await serveProject(root, { log });
  const onSignal = (signal: NodeJS.Signals) => {
    log({ event: 'signal', signal });
    void daemon.stop();
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
  // a daemon has no terminal to lose
  process.on('SIGHUP', () => log({ event: 'signal', signal: 'SIGHUP', ignored: true }));
  process.stdout.write(`hub serving ${root} on 127.0.0.1:${daemon.discovery.port} and ${daemon.discovery.socket} (pid ${process.pid})\n`);
  await daemon.stopped;
  return 0;
}

/** `cland hub <sub> [flags]`; the process exit code. */
export async function runHub(args: string[], cwd: string = process.cwd(), io: Io = stdio): Promise<number> {
  const [sub, ...rest] = args;
  const root = projectRoot(cwd);
  switch (sub) {
    case 'start':
      return start(root, io);
    case 'status':
      return status(root, rest.includes('--json'), io);
    case 'stop':
      return stop(root, io);
    case 'serve':
      return serve(root);
    default:
      io.err(`cland: unknown hub command "${sub ?? ''}"\n\nusage: cland hub <command>\n\n${HUB_USAGE}`);
      return 2;
  }
}
