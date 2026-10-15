// Project-owned servers without a running session. OS paths establish ownership; argv is only a candidate hint.
import { bridgeHubFile } from './process-table.ts';
import { run } from './doctor/report.ts';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { mkdir, readdir, readlink, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { acquireLockAsync, HubLocked, readLock } from './hub/lock.ts';
import { endProcess, systemProcesses, type SystemProcess } from './system-processes.ts';

export type Orphan = { process: SystemProcess; kind: 'harness' | 'hub' | 'bridge'; root: string; owned: boolean; reason: string };
type Session = { name: string; pid: number | null; pid_started: string | null; status: string; cwd: string };
const real = (path: string) => { try { return realpathSync(path); } catch { return resolve(path); } };
const directoryMissing = (path: string) => {
  try { statSync(path); return false; }
  catch (err) { return (err as NodeJS.ErrnoException).code === 'ENOENT'; }
};
const within = (path: string, root: string) => path === root || path.startsWith(root + sep);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sessions(root: string): Session[] | null {
  const path = join(root, '.cland', 'hub.db');
  if (!existsSync(path)) return [];
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (!db.prepare("select name from sqlite_master where type = 'table' and name = 'harness_processes'").get()) return [];
    return db.prepare('select name, pid, pid_started, status, cwd from harness_processes').all() as Session[];
  } catch { return null; } finally { db.close(); }
}

/** Only the calling user's bridge may be swept; failure to inspect means preserve. */
async function ownBridge(row: SystemProcess, deadline?: number): Promise<boolean> {
  if (process.getuid === undefined) return false;
  const uid = await run('ps', ['-p', String(row.pid), '-o', 'uid='], process.env, remaining(deadline));
  return !uid.error && uid.code === 0 && /^\d+$/.test(uid.stdout.trim()) && Number(uid.stdout.trim()) === process.getuid();
}

/** Verify each running root, then preserve its whole current descendant tree. */
function runningTree(table: Session[] | null, rows: SystemProcess[]): Set<number> {
  const protectedPids = new Set<number>();
  for (const p of table ?? []) {
    const root = rows.find(row => row.pid === p.pid);
    if (p.status === 'running' && root && (!p.pid_started || root.started === p.pid_started)) protectedPids.add(root.pid);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (protectedPids.has(row.parent) && !protectedPids.has(row.pid)) { protectedPids.add(row.pid); changed = true; }
  }
  return protectedPids;
}

/** A session row applies to its recorded process and its current descendants, including wrappers. */
function recordedOwner(row: SystemProcess, table: Session[] | null, rows: SystemProcess[]): { session: Session; process: SystemProcess } | undefined {
  const seen = new Set<number>();
  for (let ancestor: SystemProcess | undefined = row; ancestor && !seen.has(ancestor.pid); ancestor = rows.find(p => p.pid === ancestor!.parent)) {
    seen.add(ancestor.pid);
    const session = table?.find(p => p.pid === ancestor!.pid);
    if (session) return { session, process: ancestor };
  }
  return undefined;
}
function identityProblem(owner: ReturnType<typeof recordedOwner>): string | null {
  if (!owner) return null;
  if (!owner.session.pid_started) return 'process identity cannot be verified: recorded start time is unknown';
  return owner.session.pid_started !== owner.process.started ? 'PID was reused; the recorded process is gone' : null;
}

/** Read cwd and open file paths, never the process's environment (which may carry credentials). */
async function pathsOf(pid: number, deadline?: number): Promise<{ cwd: string | null; files: string[] }> {
  if (process.platform === 'linux') {
    const dir = `/proc/${pid}`;
    const cwd = await readlink(join(dir, 'cwd')).catch(() => null);
    const fds = await readdir(join(dir, 'fd')).catch(() => []);
    const files = await Promise.all(fds.map(fd => readlink(join(dir, 'fd', fd)).catch(() => '')));
    return { cwd: cwd?.replace(/ \(deleted\)$/, '') ?? null, files: files.map(path => path.replace(/ \(deleted\)$/, '')) };
  }
  const result = await run('lsof', ['-n', '-P', '-a', '-p', String(pid), '-Ffn'], process.env, remaining(deadline));
  const output = result.error ? '' : result.stdout;
  let fd = ''; let cwd: string | null = null; const files: string[] = [];
  for (const line of output.split('\n')) {
    if (line.startsWith('f')) fd = line.slice(1);
    if (line.startsWith('n')) { const path = line.slice(1).replace(/ \(deleted\)$/, ''); if (fd === 'cwd') cwd = path; else files.push(path); }
  }
  return { cwd, files };
}

/** Cwd containment or descent from a pid/start-time-verified project wrapper establishes ownership. */
async function ownership(row: SystemProcess, table: Session[] | null, rows: SystemProcess[], root: string, cwd: string | null, deadline?: number): Promise<{ owned: boolean; reason: string; wrapper?: SystemProcess }> {
  const owner = recordedOwner(row, table, rows);
  const session = owner ? `session ${owner.session.name} (${owner.session.status}); ` : '';
  const problem = identityProblem(owner);
  if (problem) return { owned: false, reason: session + problem };
  let owned = table !== null && cwd !== null && within(real(cwd), real(root));
  let wrapper: SystemProcess | undefined;
  if (!owned && table !== null && owner && owner.process.pid !== row.pid) {
    const paths = await pathsOf(owner.process.pid, deadline);
    if (paths.cwd !== null && within(real(paths.cwd), real(root))) { owned = true; wrapper = owner.process; }
  }
  return { owned, reason: session + (owned ? 'no running session owns it' : 'ambiguous ownership: cannot verify the process table, project cwd or wrapper'), ...(wrapper ? { wrapper } : {}) };
}

export async function findOrphans(root: string, includeHubs = false, deadline?: number, hubScopeRoot?: string): Promise<Orphan[]> {
  root = real(root);
  if (hubScopeRoot !== undefined) hubScopeRoot = real(hubScopeRoot);
  let table: Session[] | null;
  try { table = sessions(root); } catch { table = null; }
  const rows = await systemProcesses(undefined, deadline);
  try { table = sessions(root); } catch { table = null; }
  const protectedPids = runningTree(table, rows);
  const out: Orphan[] = [];
  await parallel(rows, async row => {
    remaining(deadline);
    if (row.pid === process.pid || protectedPids.has(row.pid)) return;
    const bridgeFile = includeHubs ? bridgeHubFile(row.command) : null;
    if (bridgeFile) {
      if (hubScopeRoot !== undefined && !within(bridgeFile, hubScopeRoot)) return;
      if (directoryMissing(bridgeFile) && await ownBridge(row, deadline)) out.push({ process: row, kind: 'bridge', root: resolve(bridgeFile, '../..'), owned: true, reason: 'its hub file no longer exists' });
      return;
    }
    const harness = /(?:^|\/)opencode\s+serve\b|(?:^|\/)fake-opencode\.ts\s+serve\b/.test(row.command) ? 'opencode'
      : /(?:^|\/)codex\s+app-server\b|(?:^|\/)fake-codex\.ts\s+app-server\b/.test(row.command) ? 'codex' : null;
    const hub = includeHubs && /^(?:\S*\/)?node\s+.+\/cland\.ts\s+hub\s+serve(?:\s|$)/.test(row.command);
    const recorded = recordedOwner(row, table, rows);
    if (!harness && !hub && !table?.some(p => p.pid === row.pid)) return;
    const paths = await pathsOf(row.pid, deadline);
    const cwd = paths.cwd === null ? null : real(paths.cwd);
    if (hub) {
      if (hubScopeRoot !== undefined && (cwd === null || !within(cwd, hubScopeRoot))) return;
      // A removed project is proved by the daemon's cwd and its still-open project log/database.
      if (cwd !== null && directoryMissing(cwd) && paths.files.some(path => within(path, join(cwd, '.cland')))) out.push({ process: row, kind: 'hub', root: cwd, owned: true, reason: 'its project directory no longer exists' });
      return;
    }
    const socket = harness === 'codex' && new RegExp(`(?:^|\\s)unix://${escape(join(root, '.cland', 'run'))}/cx-[^\\s/]+\\.sock(?:\\s|$)`).test(row.command);
    const log = harness === 'opencode'
      ? paths.files.some(path => within(path, join(root, '.cland', 'opencode')) && path.endsWith('/serve.log'))
      : harness === 'codex' && paths.files.some(path => within(path, join(root, '.cland', 'log')) && /^codex-.+\.log$/.test(basename(path)));
    const candidate = recorded !== undefined || socket || log;
    if (!candidate) return;
    const proof = await ownership(row, table, rows, root, cwd, deadline);
    out.push({ process: row, kind: 'harness', root, owned: proof.owned, reason: proof.reason });
  });
  return out;
}

/** Parallel workers share a deadline and always settle before the caller closes its resources. */
async function parallel<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = await Promise.allSettled(Array.from({ length: Math.min(items.length, 8) }, async () => {
    while (next < items.length) await work(items[next++]!);
  }));
  const failure = workers.find(worker => worker.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}
function remaining(deadline?: number): number {
  const ms = deadline === undefined ? 3000 : Math.min(3000, deadline - Date.now());
  if (ms <= 0) throw new Error('orphan sweep deadline reached; remaining candidates preserved');
  return ms;
}
export type SweepOptions = { pending?: () => boolean; deadline?: number; hubScopeRoot?: string };
export class SweepBusy extends Error {
  constructor() { super('sweep busy: another sweep holds this project’s lock'); }
}
/** Startup and external doctors share one crash-recoverable, PID/start-time-verified project lock. */
export async function sweepOrphans(root: string, log: (entry: Record<string, unknown>) => void, kind: 'harness' | 'hub' | 'bridge' = 'harness', options: SweepOptions = {}): Promise<Orphan[]> {
  try {
    const deadline = options.deadline ?? Date.now() + 12_000;
    for (const path of [join(root, '.cland'), join(root, '.cland', 'run')]) {
      try { await mkdir(path); }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err; }
    }
    let lock;
    try { lock = await acquireLockAsync(join(root, '.cland', 'run', 'orphan-sweep.lock'), undefined, deadline); }
    catch (err) {
      if (err instanceof HubLocked) { log({ event: 'orphan-sweep-busy', reason: 'sweep busy' }); throw new SweepBusy(); }
      throw err;
    }
    try { return await sweepUnlocked(root, log, kind, { ...options, deadline }); }
    finally { await lock.release(); }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // Recursive project deletion can remove a lock parent before it removes the root.
      for (const path of [root, join(root, '.cland'), join(root, '.cland', 'run')]) {
        const removed = await stat(path).then(() => false, error => error.code === 'ENOENT');
        if (removed) { log({ event: 'orphan-sweep-skipped', reason: 'project-removed' }); return []; }
      }
    }
    throw err;
  }
}
/** Recheck current running trees and in-flight reservations in the same stretch as each signal. */
async function sweepUnlocked(root: string, log: (entry: Record<string, unknown>) => void, kind: 'harness' | 'hub' | 'bridge' = 'harness', options: SweepOptions = {}): Promise<Orphan[]> {
  const deadline = options.deadline ?? Date.now() + 12_000;
  const ended: Orphan[] = [];
  const candidates = (await findOrphans(root, kind !== 'harness', deadline, options.hubScopeRoot)).filter(p => p.kind === kind);
  const rows = await systemProcesses(undefined, deadline);
  const byPid = new Map(rows.map(row => [row.pid, row]));
  const claims = new Map<number, symbol>();
  const worker = async (candidate: Orphan) => {
    if (!candidate.owned) { log({ event: 'orphan-preserved', pid: candidate.process.pid, reason: candidate.reason }); return; }
    const token = Symbol();
    const claim = (identity: SystemProcess) => {
      const owner = claims.get(identity.pid);
      if (owner !== undefined && owner !== token) return false;
      claims.set(identity.pid, token);
      return true;
    };
    if (!claim(candidate.process)) return;
    // Repeat OS ownership after discovery; argv and an old row alone never authorize a signal.
    const paths = await pathsOf(candidate.process.pid, deadline);
    const rows = await systemProcesses(undefined, deadline);
    let table: Session[] | null;
    try { table = sessions(root); } catch { table = null; }
    const current = rows.find(p => p.pid === candidate.process.pid && p.started === candidate.process.started);
    if (!current) return;
    const proof = await ownership(current, table, rows, root, paths.cwd, deadline);
    if (kind === 'bridge' && (!bridgeHubFile(current.command) || !await ownBridge(current, deadline))) return;
    if (kind === 'harness' && !proof.owned) { log({ event: 'orphan-preserved', pid: current.pid, reason: proof.reason }); return; }
    if (kind === 'hub' && (paths.cwd === null || real(paths.cwd) !== candidate.root || !paths.files.some(path => within(path, join(candidate.root, '.cland'))))) return;
    const canSignal = (rows: SystemProcess[]) => {
      if (options.pending?.()) return false;
      if (kind === 'bridge') {
        const current = rows.find(p => p.pid === candidate.process.pid && p.started === candidate.process.started);
        const file = current && bridgeHubFile(current.command);
        return Boolean(file && file === bridgeHubFile(candidate.process.command) && directoryMissing(file));
      }
      if (kind === 'hub') return directoryMissing(candidate.root);
      let table: Session[] | null;
      try { table = sessions(root); } catch { return false; }
      if (table === null) return false;
      const current = rows.find(p => p.pid === candidate.process.pid && p.started === candidate.process.started);
      const owner = current && recordedOwner(current, table, rows);
      if (identityProblem(owner)) return false;
      // An external doctor cannot see the live hub's spawn-to-row reservations. Unpublished servers wait
      // for that hub to stop; the hub's own background sweep uses its in-memory pending callback instead.
      // A captured recorded wrapper's descendants stay published even after that wrapper exits.
      const holder = readLock(join(root, '.cland', 'hub.lock'));
      const recorded = table.some(p => p.pid === candidate.process.pid && p.pid_started === candidate.process.started);
      if (!owner && !recorded && holder && holder.pid !== process.pid && rows.some(row => row.pid === holder.pid && (!holder.started || row.started === holder.started))) return false;
      if (proof.wrapper) {
        if (!owner || owner.process.pid !== proof.wrapper.pid || owner.process.started !== proof.wrapper.started) return false;
      }
      const protectedPids = runningTree(table, rows);
      const tree = new Set([candidate.process.pid]);
      for (let changed = true; changed;) {
        changed = false;
        for (const row of rows) if (tree.has(row.parent) && !tree.has(row.pid)) { tree.add(row.pid); changed = true; }
      }
      return ![...tree].some(pid => protectedPids.has(pid));
    };
    let terminated = false;
    if (await endProcess({ pid: candidate.process.pid, pidStarted: candidate.process.started }, entry => { if (entry.event === 'harness-ended') terminated = true; }, 1000, undefined, { deadline, canSignal, claim })) {
      if (!terminated) return; // another owner settled it; only that owner reports completion
      log({ event: 'orphan-ended', pid: candidate.process.pid, kind: candidate.kind, root: candidate.root, reason: candidate.reason });
      ended.push(candidate);
    } else log({ event: 'orphan-preserved', pid: candidate.process.pid, reason: 'a running session or pending launch protects it, or its identity cannot be verified' });
  };
  // Ancestor candidates run first, but descendants remain queued until actually captured and claimed.
  // If an ancestor exits before capture, its independently owned child still gets a fresh worker.
  let queued = candidates;
  while (queued.length) {
    const ancestors = new Map(queued.filter(p => p.owned).map(p => [p.process.pid, p.process.started]));
    const ready = queued.filter(candidate => {
      if (!candidate.owned) return true;
      let row = byPid.get(candidate.process.pid);
      if (!row || row.started !== candidate.process.started) return true;
      const seen = new Set([row.pid]);
      while ((row = byPid.get(row.parent)) && !seen.has(row.pid)) {
        seen.add(row.pid);
        if (ancestors.get(row.pid) === row.started) return false;
      }
      return true;
    });
    if (!ready.length) ready.push(queued[0]!);
    await parallel(ready, worker);
    const settled = new Set(ready);
    queued = queued.filter(candidate => !settled.has(candidate));
  }
  return ended;
}
