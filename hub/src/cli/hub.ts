import { fixtureOwnership } from '../../../shared/fixture-ownership.ts';
// `cland hub start | status | stop | serve`: the project's hub daemon, run from the project's root (or
// anywhere inside it).
import { AutostartDeferred, autostartDeferred, markHubStop, type Starter } from '../hub/startup.ts';
import { spawn } from 'node:child_process';
import { closeSync, fstatSync, mkdirSync, openSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStdioEdge } from '../hub/stdio.ts';
import { jsonLinesLog } from '../log.ts';
import { hubDiscovery, layout, pidAlive, projectRoot, readDiscovery, removeDiscovery, type Discovery, type Layout } from '../project.ts';
import type { HubStatus } from '../protocol.ts';
import { withRole } from '../names.ts';
import { askHub, askHubFrame, probe } from './socket-client.ts';
import { sessionOf } from './actor.ts';
import { journalPath, readJournal } from '../hub/journal.ts';
import { liveHolder } from '../hub/lock.ts';
import { formatAudit, parseSince, readAudit, type AuditFilter } from '../hub/audit.ts';

const CLI_ENTRY = fileURLToPath(new URL('../../bin/cland.ts', import.meta.url));
/** Startup inactivity deadline; progress renews it. Stop has a fixed exit deadline. */
const START_DEADLINE_MS = 15_000;
const STOP_DEADLINE_MS = 10_000;

import { HUB_USAGE } from './usage.ts';
export { HUB_USAGE } from './usage.ts';

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

async function describe(s: HubStatus): Promise<string> {
  const lines = [`  pid      ${s.pid}`, `  port     ${s.port} (127.0.0.1)`, `  socket   ${s.socket}`, `  uptime   ${duration(s.uptimeMs)}`, `  version  ${s.version}`];
  if (s.web) {
    const { addressHost } = await import('../web-address.ts');
    lines.push(s.web.available ? `  web      http://${addressHost(s.web.bind ?? '127.0.0.1')}:${s.web.port}/` : `  web      unavailable on ${addressHost(s.web.bind ?? '127.0.0.1')}:${s.web.port}: ${s.web.reason ?? 'unknown reason'}`);
  }
  if (s.priority?.warning) lines.push(`warning: ${s.priority.warning.detail}; fix: ${s.priority.warning.fix}`);
  lines.push(`sessions: ${s.sessions.length}`);
  for (const p of s.sessions) lines.push(`  ${withRole(p.name, p.role)}  [${p.state ?? 'unknown'}]${p.status ? `  — ${p.status}` : ''}`);
  if (s.config) lines.push(`config: loaded ${s.config.loadedAt} · source commit ${s.config.sourceCommit ?? 'uncommitted / no Git history'}`);
  if (s.coordinator !== undefined) lines.push(s.coordinator ? `coordinator: ${s.coordinator}` : 'no coordinator');
  if (s.covers) {
    lines.push(`covers: ${s.covers.length}`);
    for (const run of s.covers) lines.push(`  ${run.id} · ${run.cover.status} · ${run.cover.cause ?? 'none'} · head ${run.head}${run.cover.classification ? ` · derived ${run.cover.derivedCause}; ${run.cover.classification.note}` : ''}`);
  }
  if (s.requests) {
    const last = s.requests.lastSlow;
    lines.push(`requests: ${s.requests.slow} slow${last ? ` (latest ${last.tool} from ${last.client}, ${last.ms} ms at ${last.at})` : ''} · ${s.requests.slowAnswers ?? 0} slow answers · ${s.requests.replayed} answered again (too fast)`);
  }
  const launched = s.harnesses ?? [];
  const storage = s.tracker?.storage;
  if (storage?.stalled) lines.push(`tracker storage: stalled · ${storage.active?.operation} · ${storage.active?.item ?? 'tracker-wide'} · ${Math.round(storage.active?.elapsedMs ?? 0)} ms · ${storage.queued} queued`);
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
export async function inspect(l: Layout): Promise<{ kind: 'none' } | { kind: 'stale'; d: Discovery; why: string } | { kind: 'mute'; d: Discovery } | { kind: 'live'; d: Discovery }> {
  const d = readDiscovery(l.discovery);
  if (!d) return { kind: 'none' };
  if (!pidAlive(d.pid)) return { kind: 'stale', d, why: `pid ${d.pid} is gone` };
  if (await probe(d)) return { kind: 'live', d };
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

export async function startProjectHub(root: string, io: Io, starter: Starter, autostart: boolean, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const since = new Date();
  const l = layout(root);
  if (autostart && autostartDeferred(root)) {
    io.out(`${new AutostartDeferred().message}\n`);
    return 0;
  }
  const found = await inspect(l);
  if (found.kind === 'live') {
    io.out(`hub already running for ${root} (pid ${found.d.pid})\n`);
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
  const logStart = fstatSync(logFd).size;
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve', '--starter', JSON.stringify(starter), ...(autostart ? ['--autostart'] : [])], { cwd: root, detached: true, stdio: ['ignore', logFd, logFd], env });
  closeSync(logFd);
  child.unref();
  let exited: number | null = null;
  child.once('exit', (code) => (exited = code ?? -1));

  // Our child serves, or — when another start got the project's lock first — exits, and the hub to report
  // is the lock's holder: either way the answer is the hub `hub.json` names once it answers.
  let deadline = Date.now() + START_DEADLINE_MS;
  let logSize = logStart;
  for (;;) {
    // Opening storage and restoring sessions can exceed 15 s on a healthy hub.
    // Only this attempt's appended log bytes renew the inactivity deadline.
    try {
      const size = statSync(l.log).size;
      if (size > logSize) deadline = Date.now() + START_DEADLINE_MS;
      logSize = size;
    } catch { /* no progress logged */ }
    if (Date.now() >= deadline) break;
    const holder = liveHolder(l.lock);
    if (exited !== null && holder === null) {
      if (autostart && autostartDeferred(root)) {
        io.out(`${new AutostartDeferred().message}\n`);
        return 0;
      }
      break;
    }
    const d = readDiscovery(l.discovery);
    if (d && (d.pid === child.pid || d.pid === holder?.pid)) {
      if (await probe(d)) {
        for (const entry of readJournal(journalPath(l.dir), { since: since.toISOString(), kinds: ['orphan-ended', 'orphan-preserved', 'orphan-sweep-failed'] })) {
          io.out(entry.event === 'orphan-ended' ? `ended orphan ${entry.kind} pid ${entry.pid}: ${entry.reason}\n` : entry.event === 'orphan-preserved' ? `preserved possible orphan pid ${entry.pid}: ${entry.reason}\n` : `orphan sweep: ${entry.reason}\n`);
        }
        io.out('orphan cleanup runs in the background; cland doctor reports what ended\n');
        io.out(d.pid === child.pid ? `hub started for ${root} (pid ${d.pid})\n` : `hub already running for ${root} (pid ${d.pid})\n`);
        return 0;
      }
    }
    await sleep(50);
  }
  let log = '';
  let tail = '';
  try {
    // Ignore earlier starts, including their stalled operations and suite sizes.
    log = readFileSync(l.log).subarray(logStart).toString('utf8');
    tail = log.split('\n').slice(-15).join('\n');
  } catch {
    /* no log */
  }
  const { startupDiagnostic } = await import('./startup-diagnostic.ts');
  io.err(`cland: the hub did not start${exited !== null ? ` (exited with ${exited})` : ` after ${START_DEADLINE_MS / 1000} s without startup log progress`}; ${startupDiagnostic(log)}; ${l.log}:\n${tail}\n`);
  if (exited === null && child.pid !== undefined) child.kill('SIGKILL');
  return 1;
}

async function status(l: Layout, json: boolean, io: Io, history = false): Promise<number> {
  const root = l.root;
  const found = await inspect(l);
  switch (found.kind) {
    case 'live': {
      try {
        const full = await askHubFrame(found.d, { type: 'hub.status', ...(history ? { history: true } : {}) }) as HubStatus;
        io.out(json ? `${JSON.stringify(full)}\n` : `hub running for ${full.root}\n${await describe(full)}`);
      } catch (error) {
        const statusError = error instanceof Error ? error.message : String(error);
        io.out(json ? `${JSON.stringify({ running: true, root: found.d.root ?? root, pid: found.d.pid, statusError })}\n`
          : `hub running for ${found.d.root ?? root} (pid ${found.d.pid})\nfull status unavailable: ${statusError}\n`);
      }
      return 0;
    }
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
    } catch (err) {
      // the hub answered, and said no (a session's shell without the grant): the signal is not a way around it
      if (err instanceof Error && err.message.startsWith('forbidden: ')) {
        io.err(`cland: ${err.message}\n`);
        return 1;
      }
      // no answer, from a session's shell: nothing says the session may stop the hub, so nothing is signalled.
      // (The human's fallback below stays, and so does a session's once the hub accepted its request.)
      const session = sessionOf(process.env);
      if (session !== undefined) {
        io.err(`cland: the hub did not confirm hub.stop (${err instanceof Error ? err.message : String(err)}); this shell is session ${session.name}'s ($CLAND_SESSION_*), so pid ${d.pid} is not signalled\n`);
        return 1;
      }
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
      markHubStop(root);
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

async function serve(root: string, stdio: boolean, listen: boolean, io: Io, starter: Starter, autostart: boolean): Promise<number> {
  // Explicit fixture launch only; ordinary human hubs never carry this ownership receipt.
  if (process.env.CLAND_TEST_FIXTURE_ROOT === root) {
    const owner = fixtureOwnership([root, fileURLToPath(new URL('../../../', import.meta.url))]);
    process.once('exit', () => { owner.close(); owner.remove(); });
  }
  if (!listen && !stdio) {
    io.err('cland: --no-listen needs --stdio: a hub with neither could not be reached\n');
    return 2;
  }
  // A stdio hub serves its parent even where listening is forbidden; the project's lock is taken either way.
  const { serveProject } = await import('../hub/daemon.ts');
  const { STORAGE_STOP_MS } = await import('../tracker/tracker.ts');
  let daemon;
  try {
    daemon = await serveProject(root, { listen: !listen ? 'never' : stdio ? 'optional' : 'required', starter, autostart });
  } catch (err) {
    if (!(err instanceof AutostartDeferred)) throw err;
    io.out(`${err.message}\n`);
    return 0;
  }
  const log = daemon.log;
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
  process.on('SIGHUP', () => { log({ event: 'signal', signal: 'SIGHUP' }); void daemon.reload().catch(() => {}); });
  const where = daemon.discovery ? `127.0.0.1:${daemon.discovery.port} and ${daemon.discovery.socket}${stdio ? ' and stdio' : ''}` : 'stdio only, no listeners';
  (stdio ? process.stderr : process.stdout).write(`hub serving ${root} on ${where} (pid ${process.pid})\n`);
  let fatalTimer: NodeJS.Timeout | undefined;
  let cleanupExpired = false;
  try {
    await Promise.race([daemon.stopped, daemon.storageFailed.then(() => new Promise<void>(resolve => {
      // Shutdown dependencies (including log I/O) must not keep a failed writer alive.
      fatalTimer = setTimeout(() => { cleanupExpired = true; resolve(); }, STORAGE_STOP_MS);
    }))]);
  } finally { clearTimeout(fatalTimer); }
  if (cleanupExpired) io.err('cland: tracker storage failure: shutdown deadline expired; exiting with code 1 before cleanup completed\n');
  // A native operation can retain the event loop after bounded storage abandonment.
  // Normal cleanup flushes shutdown logs; the fatal deadline also bounds stalled cleanup.
  if (daemon.storageAbandoned) process.exit(1);
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
  // Only these three values travel to the detached child; never forward environment metadata.
  const client = rest.includes('--client') ? rest[rest.indexOf('--client') + 1] : 'cli';
  let starter: Starter = { client: client === 'nvim' || client === 'other' ? client : 'cli', parentPid: process.ppid, cwd };
  if (sub === 'serve' && rest.includes('--starter')) {
    const value = JSON.parse(rest[rest.indexOf('--starter') + 1] ?? '') as Partial<Starter>;
    if ((value.client !== 'cli' && value.client !== 'nvim' && value.client !== 'other') || typeof value.parentPid !== 'number' || !Number.isSafeInteger(value.parentPid) || value.parentPid <= 0 || typeof value.cwd !== 'string') {
      io.err('cland: invalid hub starter metadata\n');
      return 2;
    }
    starter = { client: value.client, parentPid: value.parentPid, cwd: value.cwd };
  }
  // Start/serve own the cwd's project. Discovery records an existing hub's actual root, independent
  // of where the file lives. Older copies need a successful probe before lock checks or cleanup.
  const discovery = hubDiscovery(cwd);
  const overridden = process.env.CLAND_HUB_FILE?.trim() && ['status', 'stop', 'reload', 'unmute', 'subscriptions'].includes(sub ?? '');
  const d = overridden ? readDiscovery(discovery) : null;
  let target = overridden ? d?.root ?? null : root;
  if (overridden && sub === 'stop' && target === null) {
    try { target = d ? (await askHub(d, 'hub.status') as HubStatus).root : null; }
    catch { target = null; }
  }
  const l = { ...layout(target ?? root), discovery };
  switch (sub) {
    case 'start':
      return startProjectHub(root, io, starter, rest.includes('--autostart'));
    case 'subscriptions': {
      const hub = readDiscovery(l.discovery);
      if (!hub) throw new Error('no hub running');
      const result = await askHubFrame(hub, { type: 'hub.subscriptions' }) as { subscriptions: Array<Record<string, unknown>> };
      io.out(rest.includes('--json') ? `${JSON.stringify(result)}\n` : `${result.subscriptions.map(s => `${s.subscriber} · ${s.id} · ${JSON.stringify(s.subject)} · ${(s.events as string[]).join(', ')} · ${s.digest}`).join('\n') || 'no subscriptions'}\n`);
      return 0;
    }
    case 'reload': {
      const d = readDiscovery(l.discovery);
      if (!d) { io.err('cland: no hub running\n'); return 1; }
      try {
        const value = await askHub(d, 'hub.reload');
        io.out(`config reloaded: ${JSON.stringify(value)}\n`);
        return 0;
      } catch (error) { io.err(`cland: ${error instanceof Error ? error.message : String(error)}\n`); return 1; }
    }
    case 'status':
      return status(l, rest.includes('--json'), io, rest.includes('--history'));
    case 'stop':
      return stop(l, target !== null, io);
    case 'audit':
      return audit(root, rest, io);
    case 'unmute':
      return unmute(l, rest, io);
    case 'journal':
      return journal(root, rest, io);
    case 'serve':
      return serve(root, rest.includes('--stdio') || (rest.includes('--transport') && rest[rest.indexOf('--transport') + 1] === 'stdio'), !rest.includes('--no-listen'), io, starter, rest.includes('--autostart'));
    default:
      io.err(`cland: unknown hub command "${sub ?? ''}"\n\nusage: cland hub <command>\n\n${HUB_USAGE}`);
      return 2;
  }
}
