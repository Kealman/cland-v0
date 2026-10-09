// Test-only ownership: a temporary directory and the processes rooted in it.
import { execFileSync } from 'node:child_process';
import { readlinkSync, readdirSync, realpathSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { TestContext } from 'node:test';

type ProcessRow = { pid: number; parent: number; group: number; started: string; command: string };
export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function processes(): ProcessRow[] {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,pgid=,lstart=,command='], { encoding: 'utf8' }).split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(.*)$/.exec(line);
    return match ? [{ pid: Number(match[1]), parent: Number(match[2]), group: Number(match[3]), started: match[4]!, command: match[5]! }] : [];
  });
}
function cwdPids(root: string): Set<number> {
  const result = new Set<number>();
  const matches = (path: string) => path === root || path.startsWith(`${root}/`);
  if (process.platform === 'linux') {
    for (const name of readdirSync('/proc')) {
      try { if (matches(readlinkSync(`/proc/${name}/cwd`))) result.add(Number(name)); } catch { /* process exited */ }
    }
  } else {
    let output: string;
    try { output = execFileSync('lsof', ['-n', '-P', '-d', 'cwd', '-Fpn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (error) {
      // lsof exits 1 when there are no matching entries; a missing executable is a cleanup failure.
      if ((error as { status?: number }).status !== 1) throw error;
      output = String((error as { stdout?: string }).stdout ?? '');
    }
    let pid = 0;
    for (const line of output.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1));
      if (line.startsWith('n') && matches(line.slice(1))) result.add(pid);
    }
  }
  return result;
}

/** Kill complete owned process groups, including detached adapters and orphaned hook bridges. */
export async function cleanupProcesses(root?: string, seedPids: number[] = [], report: (line: string) => void = () => {}): Promise<void> {
  const rows = processes();
  const protectedPids = new Set<number>();
  const protectedGroups = new Set<number>();
  let ancestor = rows.find(row => row.pid === process.pid);
  while (ancestor && !protectedPids.has(ancestor.pid)) {
    protectedPids.add(ancestor.pid);
    protectedGroups.add(ancestor.group);
    const parent = ancestor.parent;
    ancestor = rows.find(row => row.pid === parent);
  }
  const selected = root ? cwdPids(root) : new Set<number>();
  for (const pid of seedPids) selected.add(pid);
  if (root) for (const row of rows) if (row.command.includes(root)) selected.add(row.pid);
  for (const pid of protectedPids) selected.delete(pid);
  // Resolve descendants before killing parents, which would reparent hook bridges to init.
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (selected.has(row.parent) && !selected.has(row.pid) && !protectedPids.has(row.pid)) { selected.add(row.pid); changed = true; }
  }
  const targets = rows.filter((row) => selected.has(row.pid));
  const current = new Map(processes().map((row) => [row.pid, row]));
  const groups = new Set<number>();
  for (const row of targets) {
    if (current.get(row.pid)?.started !== row.started) continue;
    report(`cleanup pid ${row.pid}: ${row.command}`);
    try {
      // Preserve the caller and its ancestors, even if their shell command quotes a fixture path.
      if (!protectedGroups.has(row.group) && !groups.has(row.group)) { process.kill(-row.group, 'SIGKILL'); groups.add(row.group); }
      else if (protectedGroups.has(row.group)) process.kill(row.pid, 'SIGKILL');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
  for (let n = 0; n < 100; n++) {
    if (!targets.some((row) => { try { process.kill(row.pid, 0); return true; } catch { return false; } })) return;
    await pause(20);
  }
}

const directories = new Set<string>();
const ownedPids = new Map<number, string>();
let installed = false;
function installSignals(): void {
  if (installed) return;
  installed = true;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    const pids = processes().filter(row => ownedPids.get(row.pid) === row.started).map(row => row.pid);
    void (async () => {
      await cleanupProcesses(undefined, pids);
      for (const dir of directories) {
        await cleanupProcesses(dir);
        await rm(dir, { recursive: true, force: true });
      }
    })().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
}

/** Register immediately after spawn, including fixtures whose cwd is the repository. */
export function ownProcess(t: TestContext | undefined, pid: number | undefined): () => Promise<void> {
  installSignals();
  const started = processes().find(row => row.pid === pid)?.started;
  if (pid !== undefined && started) ownedPids.set(pid, started);
  const cleanup = async () => {
    if (pid !== undefined && started && processes().some(row => row.pid === pid && row.started === started)) await cleanupProcesses(undefined, [pid]);
    if (pid !== undefined && ownedPids.get(pid) === started) ownedPids.delete(pid);
  };
  t?.after(cleanup);
  return cleanup;
}

/** Register before any spawn. Node's test after hooks do not run on SIGINT/SIGTERM. */
export function ownDirectory(t: TestContext | undefined, path: string): () => Promise<void> {
  const root = realpathSync(path);
  directories.add(root);
  installSignals();
  const cleanup = async () => {
    await cleanupProcesses(root);
    await rm(root, { recursive: true, force: true });
    directories.delete(root);
  };
  t?.after(cleanup);
  return cleanup;
}
