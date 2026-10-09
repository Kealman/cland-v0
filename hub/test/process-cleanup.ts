// Test-only ownership: immutable process identities plus a run marker or owned directory.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readlinkSync, readdirSync, realpathSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { TestContext } from 'node:test';

export type ProcessIdentity = { pid: number; started: string };
type ProcessRow = ProcessIdentity & { parent: number; group: number; command: string };
export const RUN_ID = process.env.TEST_SUITE_RUN_ID ??= randomUUID();
export const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const recorded = new Map<number, ProcessIdentity>();

function processes(): ProcessRow[] {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,pgid=,lstart=,stat=,command='], { encoding: 'utf8' }).split('\n').flatMap(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(\S+)\s+(.*)$/.exec(line);
    return match && !match[5]!.startsWith('Z') ? [{ pid: Number(match[1]), parent: Number(match[2]), group: Number(match[3]), started: match[4]!.replace(/\s+/g, ' '), command: match[6]! }] : [];
  });
}
/** Capture at spawn/first API observation, never after a remembered child has exited. */
export function captureProcess(pid: number | undefined): ProcessIdentity | null {
  const row = processes().find(row => row.pid === pid);
  return row ? { pid: row.pid, started: row.started } : null;
}
export function rememberProcess(pid: number | undefined): void {
  if (pid === undefined || recorded.has(pid)) return;
  const identity = captureProcess(pid);
  if (identity) recorded.set(pid, identity);
}
export const recordedProcess = (pid: number): ProcessIdentity | undefined => recorded.get(pid);
export function rememberResultProcesses(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if ('pid' in value && typeof value.pid === 'number') rememberProcess(value.pid);
  for (const entry of Object.values(value)) if (typeof entry === 'object') rememberResultProcesses(entry);
}
const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
function commandNamesRoot(command: string, root: string): boolean {
  return command.split(/[\s"'=,]+/).some(part => within(part.replace(/^(?:file|unix):\/\//, ''), root));
}
function cwdPaths(): Map<number, string> {
  const result = new Map<number, string>();
  if (process.platform === 'linux') {
    for (const name of readdirSync('/proc')) {
      try { result.set(Number(name), readlinkSync(`/proc/${name}/cwd`).replace(/ \(deleted\)$/, '')); } catch { /* exited */ }
    }
  } else {
    let output: string;
    try { output = execFileSync('lsof', ['-n', '-P', '-d', 'cwd', '-Fpn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (error) {
      if ((error as { status?: number }).status !== 1) throw error;
      output = String((error as { stdout?: string }).stdout ?? '');
    }
    let pid = 0;
    for (const line of output.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1));
      if (line.startsWith('n')) result.set(pid, line.slice(1));
    }
  }
  return result;
}
function runMarkers(rows: ProcessRow[]): Map<number, string> {
  const result = new Map<number, string>();
  if (process.platform === 'linux') {
    for (const row of rows) {
      try {
        const marker = readFileSync(`/proc/${row.pid}/environ`, 'utf8').split('\0').find(entry => entry.startsWith('TEST_SUITE_RUN_ID='));
        if (marker) result.set(row.pid, marker.slice('TEST_SUITE_RUN_ID='.length));
      } catch { /* exited or inaccessible: no ownership proof */ }
    }
  } else {
    // Never log this output: OS environments may contain secrets.
    const output = execFileSync('ps', ['eww', '-axo', 'pid=,command='], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    for (const line of output.split('\n')) {
      const pid = /^\s*(\d+)\s/.exec(line)?.[1];
      const marker = /(?:^|\s)TEST_SUITE_RUN_ID=([^\s]+)/.exec(line)?.[1];
      if (pid && marker) result.set(Number(pid), marker);
    }
  }
  return result;
}

/** Discover abandoned children by the unique inherited run marker, including repository-cwd workers. */
export function captureRunProcesses(runId: string): ProcessIdentity[] {
  const rows = processes();
  const markers = runMarkers(rows);
  return rows.filter(row => markers.get(row.pid) === runId).map(row => ({ pid: row.pid, started: row.started }));
}

/** Select by scope, verify original identity and ownership, then signal only verified processes/groups. */
export async function cleanupProcesses(root?: string, seeds: ProcessIdentity[] = [], report: (line: string) => void = () => {}, runId = RUN_ID): Promise<void> {
  const rows = processes();
  const cwd = cwdPaths();
  const markers = runMarkers(rows);
  const owned = (row: ProcessRow) => markers.get(row.pid) === runId || (root !== undefined && within(cwd.get(row.pid) ?? '', root));
  const protectedPids = new Set<number>();
  const protectedGroups = new Set<number>();
  let ancestor = rows.find(row => row.pid === process.pid);
  while (ancestor && !protectedPids.has(ancestor.pid)) {
    protectedPids.add(ancestor.pid); protectedGroups.add(ancestor.group);
    const parent = ancestor.parent;
    ancestor = rows.find(row => row.pid === parent);
  }
  const expected = new Map<number, ProcessIdentity>();
  for (const seed of seeds) {
    const row = rows.find(row => row.pid === seed.pid);
    if (row?.started === seed.started && owned(row)) expected.set(row.pid, seed);
  }
  if (root) for (const row of rows) {
    if (owned(row) && (within(cwd.get(row.pid) ?? '', root) || commandNamesRoot(row.command, root))) expected.set(row.pid, row);
  }
  for (const pid of protectedPids) expected.delete(pid);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (expected.has(row.parent) && !expected.has(row.pid) && !protectedPids.has(row.pid) && owned(row)) {
      expected.set(row.pid, row); changed = true;
    }
  }
  const current = processes();
  const currentCwd = cwdPaths();
  const currentMarkers = runMarkers(current);
  const verified = (row: ProcessRow) => expected.get(row.pid)?.started === row.started &&
    (currentMarkers.get(row.pid) === runId || (root !== undefined && within(currentCwd.get(row.pid) ?? '', root)));
  const targets = current.filter(verified);
  const groups = new Set<number>();
  for (const row of targets) {
    if (groups.has(row.group)) continue;
    const leader = current.find(member => member.pid === row.group);
    const members = current.filter(member => member.group === row.group);
    // An unrelated group member/leader always prevents a group signal.
    const wholeGroup = !protectedGroups.has(row.group) && leader !== undefined && verified(leader) && members.every(verified);
    report(`cleanup pid ${row.pid}: ${row.command}`);
    try {
      if (wholeGroup) { process.kill(-row.group, 'SIGKILL'); groups.add(row.group); }
      else process.kill(row.pid, 'SIGKILL');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const remaining = processes().filter(row => targets.some(target => target.pid === row.pid && target.started === row.started));
    if (remaining.length === 0) return;
    await pause(50);
  }
  throw new Error('owned test processes did not exit after SIGKILL');
}

const directories = new Set<string>();
const ownedPids = new Map<number, ProcessIdentity>();
let installed = false;
function installSignals(): void {
  if (installed) return;
  installed = true;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    void (async () => {
      await cleanupProcesses(undefined, [...ownedPids.values()]);
      for (const dir of directories) { await cleanupProcesses(dir); await rm(dir, { recursive: true, force: true }); }
    })().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
}
export function ownProcess(t: TestContext | undefined, pid: number | undefined): () => Promise<void> {
  installSignals();
  const identity = captureProcess(pid);
  if (identity) { ownedPids.set(identity.pid, identity); recorded.set(identity.pid, identity); }
  const cleanup = async () => {
    if (identity) {
      await cleanupProcesses(undefined, [identity]);
      if (ownedPids.get(identity.pid) === identity) ownedPids.delete(identity.pid);
    }
  };
  t?.after(cleanup);
  return cleanup;
}
export function ownDirectory(t: TestContext | undefined, path: string): () => Promise<void> {
  const root = realpathSync(path);
  directories.add(root); installSignals();
  const cleanup = async () => { await cleanupProcesses(root); await rm(root, { recursive: true, force: true }); directories.delete(root); };
  t?.after(cleanup);
  return cleanup;
}
