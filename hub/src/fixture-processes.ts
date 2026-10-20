// Fixture authority comes from a private open receipt, never from argv or a scratch directory name.
import { realpathSync, statSync, unlinkSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { readFixtureReceipt } from '../../shared/fixture-ownership.ts';
import { processPaths } from './process-paths.ts';
import { run } from './doctor/report.ts';
import { endProcess, systemProcesses, type SystemProcess } from './system-processes.ts';

export type FixtureOrphan = { process: SystemProcess; kind: 'fixture'; root: string; owned: boolean; reason: string };
export type FixtureProcesses = {
  rows: () => Promise<SystemProcess[]>;
  paths: typeof processPaths;
  sameUser: (pid: number) => Promise<boolean>;
  missing: (root: string) => boolean;
  end: typeof endProcess;
};
const within = (path: string, root: string) => path === root || path.startsWith(root + sep);
const missing = (path: string) => { try { statSync(path); return false; } catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT'; } };
function native(deadline?: number): FixtureProcesses {
  return { rows: () => systemProcesses(undefined, deadline), paths: processPaths, missing, end: endProcess,
    sameUser: async pid => {
      const remaining = Math.min(3000, (deadline ?? Date.now() + 3000) - Date.now());
      if (remaining <= 0 || process.getuid === undefined) return false;
      const result = await run('ps', ['-p', String(pid), '-o', 'uid='], process.env, remaining);
      return !result.error && result.code === 0 && /^\d+$/.test(result.stdout.trim()) && Number(result.stdout.trim()) === process.getuid();
    } };
}
const candidate = (row: SystemProcess) => /(?:^|\/)nvim\s+(?:.*\s)?--headless(?:\s|$)|(?:^|\/)stub-hub\.ts(?:\s|$)|(?:^|\/)cland\.ts\s+hub\s+serve(?:\s|$)/.test(row.command);
async function ownedRoots(row: SystemProcess, readers: FixtureProcesses, deadline?: number): Promise<string[]> {
  if (!candidate(row) || !await readers.sameUser(row.pid)) return [];
  const paths = await readers.paths(row.pid, deadline);
  return paths.files.flatMap(path => { const receipt = readFixtureReceipt(path); const birth = Math.floor(Date.parse(row.started) / 1000); return receipt?.pid === row.pid && birth >= receipt.born.min && birth <= receipt.born.max ? receipt.roots : []; });
}
/** scope limits machine discovery in fixture tests; worktree selects live roots during removal. */
export async function findFixtureOrphans(scope?: string, deadline?: number, readers: FixtureProcesses = native(deadline), worktree?: string): Promise<FixtureOrphan[]> {
  const out: FixtureOrphan[] = [];
  for (const row of await readers.rows()) {
    if (row.pid === process.pid || !candidate(row)) continue;
    const roots = await ownedRoots(row, readers, deadline);
    const root = roots.find(root => (scope === undefined || within(root, resolve(scope))) && (worktree === undefined ? readers.missing(root) : within(root, resolve(worktree))));
    if (!root && worktree === undefined && !roots.length) {
      // Old fixtures have no receipt. Report removed cland roots, but never authorize a signal.
      const cwd = (await readers.paths(row.pid, deadline)).cwd;
      const checkout = /(?:^|\s)(\/[^\s]*\/\.cland\/worktrees\/[^/\s]+)\//.exec(row.command)?.[1];
      const scratch = cwd && within(cwd, realpathSync(tmpdir())) && /(?:^|\/)cland-[^/]+(?:\/|$)/.test(cwd) ? cwd : undefined;
      const hint = [checkout, scratch].find(path => path && (scope === undefined || within(path, resolve(scope))) && readers.missing(path));
      if (hint) out.push({ process: row, kind: 'fixture', root: hint, owned: false, reason: 'its fixture root no longer exists; private ownership receipt unavailable' });
    }
    if (root) out.push({ process: row, kind: 'fixture', root, owned: true, reason: worktree === undefined ? 'its fixture root no longer exists' : 'its owning worktree is being removed' });
  }
  return out;
}

export async function sweepFixtureOrphans(log: (entry: Record<string, unknown>) => void, scope?: string, deadline = Date.now() + 12_000, readers: FixtureProcesses = native(deadline), worktree?: string, pending?: () => boolean): Promise<FixtureOrphan[]> {
  const ended: FixtureOrphan[] = [];
  for (const orphan of await findFixtureOrphans(scope, deadline, readers, worktree)) {
    if (!orphan.owned) { log({ event: 'orphan-preserved', pid: orphan.process.pid, reason: orphan.reason }); continue; }
    const current = (await readers.rows()).find(row => row.pid === orphan.process.pid && row.started === orphan.process.started);
    if (!current || !(await ownedRoots(current, readers, deadline)).includes(orphan.root)) continue;
    const canSignal = (rows: SystemProcess[]) => {
      // endProcess retains captured descendants after the original leader exits,
      // and verifies each captured PID/start time immediately before its signal.
      // Absence is not reuse: only a present replacement leader vetoes this tree.
      const leader = rows.find(row => row.pid === current.pid);
      return !pending?.() && (!leader || leader.started === current.started) && (worktree !== undefined || readers.missing(orphan.root));
    };
    const receipts = (await readers.paths(current.pid, deadline)).files.filter(path => readFixtureReceipt(path)?.pid === current.pid);
    let authorized = false;
    const beforeSignal = async () => { authorized = (await ownedRoots(current, readers, deadline)).includes(orphan.root); };
    if (await readers.end({ pid: current.pid, pidStarted: current.started }, () => {}, /cland\.ts\s+hub\s+serve/.test(current.command) ? 5000 : 1000, beforeSignal, { deadline, canSignal: rows => authorized && canSignal(rows) })) {
      for (const path of receipts) {
        if (readFixtureReceipt(path)?.pid !== current.pid) continue;
        try { unlinkSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      }
      ended.push(orphan);
      log({ event: 'orphan-ended', kind: 'fixture', pid: current.pid, root: orphan.root, reason: orphan.reason });
    } else if (worktree !== undefined) throw new Error(`fixture pid ${current.pid} could not be stopped; worktree kept`);
  }
  return ended;
}

/** Every removal path waits for owned writers to exit before invoking Git. Failure preserves the worktree. */
export async function removeWorktreeWithFixtures<T>(path: string, remove: () => Promise<T>, readers?: FixtureProcesses): Promise<T> {
  const deadline = Date.now() + 12_000;
  await sweepFixtureOrphans(() => {}, undefined, deadline, readers, path);
  // A surviving/reparented fixture may have appeared during termination. Fail closed rather than delete its cwd.
  if ((await findFixtureOrphans(undefined, deadline, readers, path)).length) throw new Error('fixture processes remain; worktree kept');
  return remove();
}
