// Project-owned servers without a running session. OS paths establish ownership; argv is only a candidate hint.
import { run } from './doctor/report.ts';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { readdir, readlink } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { endProcess, systemProcesses, type SystemProcess } from './system-processes.ts';

export type Orphan = { process: SystemProcess; kind: 'harness' | 'hub'; root: string; owned: boolean; reason: string };
type Session = { pid: number | null; pid_started: string | null; status: string; cwd: string };
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
    return db.prepare('select pid, pid_started, status, cwd from harness_processes').all() as Session[];
  } catch { return null; } finally { db.close(); }
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

export async function findOrphans(root: string, includeHubs = false, deadline?: number): Promise<Orphan[]> {
  root = real(root);
  let table: Session[] | null;
  try { table = sessions(root); } catch { table = null; }
  const rows = await systemProcesses(undefined, deadline);
  try { table = sessions(root); } catch { table = null; }
  const protectedPids = runningTree(table, rows);
  const out: Orphan[] = [];
  await parallel(rows, async row => {
    remaining(deadline);
    if (row.pid === process.pid || protectedPids.has(row.pid)) return;
    const harness = /(?:^|\/)opencode\s+serve\b|(?:^|\/)fake-opencode\.ts\s+serve\b/.test(row.command) ? 'opencode'
      : /(?:^|\/)codex\s+app-server\b|(?:^|\/)fake-codex\.ts\s+app-server\b/.test(row.command) ? 'codex' : null;
    const hub = includeHubs && /^(?:\S*\/)?node\s+.+\/cland\.ts\s+hub\s+serve(?:\s|$)/.test(row.command);
    const recorded = table?.find(p => p.pid === row.pid && p.pid_started === row.started);
    if (!harness && !hub && !recorded) return;
    const paths = await pathsOf(row.pid, deadline);
    const cwd = paths.cwd === null ? null : real(paths.cwd);
    if (hub) {
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
    const cwdOwned = cwd !== null && (within(cwd, root) || table?.some(p => real(p.cwd) === cwd));
    const owned = table !== null && Boolean(cwdOwned);
    out.push({ process: row, kind: 'harness', root, owned, reason: owned ? 'no running session owns it' : 'ambiguous ownership: cannot verify the process table or cwd' });
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
export type SweepOptions = { pending?: () => boolean; deadline?: number };
/** Recheck current running trees and in-flight reservations in the same stretch as each signal. */
export async function sweepOrphans(root: string, log: (entry: Record<string, unknown>) => void, kind: 'harness' | 'hub' = 'harness', options: SweepOptions = {}): Promise<Orphan[]> {
  const deadline = options.deadline ?? Date.now() + 12_000;
  const ended: Orphan[] = [];
  const candidates = (await findOrphans(root, kind === 'hub', deadline)).filter(p => p.kind === kind);
  await parallel(candidates, async candidate => {
    if (!candidate.owned) { log({ event: 'orphan-preserved', pid: candidate.process.pid, reason: candidate.reason }); return; }
    const canSignal = (rows: SystemProcess[]) => {
      if (options.pending?.()) return false;
      if (kind === 'hub') return directoryMissing(candidate.root);
      let table: Session[] | null;
      try { table = sessions(root); } catch { return false; }
      if (table === null) return false;
      const protectedPids = runningTree(table, rows);
      const tree = new Set([candidate.process.pid]);
      for (let changed = true; changed;) {
        changed = false;
        for (const row of rows) if (tree.has(row.parent) && !tree.has(row.pid)) { tree.add(row.pid); changed = true; }
      }
      return ![...tree].some(pid => protectedPids.has(pid));
    };
    // Repeat the OS cwd check after discovery; argv or an old session row alone is insufficient.
    const paths = await pathsOf(candidate.process.pid, deadline);
    let table: Session[] | null;
    try { table = sessions(root); } catch { table = null; }
    const cwdOwned = paths.cwd !== null && (within(real(paths.cwd), real(root)) || table?.some(p => real(p.cwd) === real(paths.cwd!)));
    if (kind === 'harness' && !cwdOwned) return;
    if (await endProcess({ pid: candidate.process.pid, pidStarted: candidate.process.started }, () => {}, 1000, undefined, { deadline, canSignal })) {
      log({ event: 'orphan-ended', pid: candidate.process.pid, kind: candidate.kind, root: candidate.root, reason: candidate.reason });
      ended.push(candidate);
    } else log({ event: 'orphan-preserved', pid: candidate.process.pid, reason: 'a running session or pending launch protects it, or its identity cannot be verified' });
  });
  return ended;
}
