// Test-only ownership: immutable process identities with verified directories or runner ancestry.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readlinkSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { TestContext } from 'node:test';

export type ProcessIdentity = { pid: number; started: string };
type ProcessRow = ProcessIdentity & { parent: number; group: number; command: string };
export const RUN_ID = process.env.TEST_SUITE_RUN_ID ??= randomUUID();
export const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const recorded = new Map<number, ProcessIdentity>();

function processes(): ProcessRow[] {
  return execFileSync('ps', ['ww', '-axo', 'pid=,ppid=,pgid=,lstart=,stat=,command='], { encoding: 'utf8' }).split('\n').flatMap(line => {
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
      const match = /^\s*(\d+)\s+(.*)$/.exec(line);
      const row = rows.find(row => row.pid === Number(match?.[1]));
      // ps eww appends environments to argv. Strip the exact independently observed argv first;
      // a command quoting a marker never establishes environment ownership.
      if (!row || !match?.[2]?.startsWith(`${row.command} `)) continue;
      const environment = match[2].slice(row.command.length);
      const markers = new Set([...environment.matchAll(/(?:^|\s)TEST_SUITE_RUN_ID=([^\s]+)/g)].map(marker => marker[1]!));
      if (markers.size === 1) result.set(row.pid, [...markers][0]!);
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

const directories = new Map<string, { device: number; inode: number }>();
const self = captureProcess(process.pid);
function directoryStillOwned(path: string, identity: { device: number; inode: number }): boolean {
  try { const info = statSync(path); return info.dev === identity.device && info.ino === identity.inode; }
  catch { return false; }
}
function ownership(rows: ProcessRow[], cwd: Map<number, string>, roots: string[], anchors: ProcessIdentity[]): (row: ProcessRow) => boolean {
  const starts = new Map(anchors.map(identity => [identity.pid, identity.started]));
  const table = new Map(rows.map(row => [row.pid, row]));
  return row => {
    if (roots.some(root => within(cwd.get(row.pid) ?? '', root))) return true;
    const visited = new Set<number>();
    let ancestor: ProcessRow | undefined = row;
    while (ancestor && !visited.has(ancestor.pid)) {
      if (starts.get(ancestor.pid) === ancestor.started) return true;
      visited.add(ancestor.pid); ancestor = table.get(ancestor.parent);
    }
    return false;
  };
}
/** Scope candidates, then prove cwd containment or current ancestry to an original runner identity.
 * Environment markers are hints only: macOS flattens other values into marker-looking text.
 * `root` must be verified by the caller; helper-registered roots also retain device/inode proof.
 */
export async function cleanupProcesses(root?: string, seeds: ProcessIdentity[] = [], report: (line: string) => void = () => {}, runId = RUN_ID, anchors: ProcessIdentity[] = self ? [self] : []): Promise<number> {
  const rows = processes();
  const cwd = cwdPaths();
  const markers = runMarkers(rows);
  const roots = [...directories].filter(([path, identity]) => directoryStillOwned(path, identity)).map(([path]) => path);
  if (root) roots.push(root);
  const owned = ownership(rows, cwd, roots, anchors);
  const protectedPids = new Set<number>();
  const protectedGroups = new Set<number>();
  let ancestor = rows.find(row => row.pid === process.pid);
  while (ancestor && !protectedPids.has(ancestor.pid)) {
    protectedPids.add(ancestor.pid); protectedGroups.add(ancestor.group);
    ancestor = rows.find(row => row.pid === ancestor!.parent);
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
  for (const row of rows) {
    const candidate = markers.get(row.pid) === runId || seeds.some(seed => seed.pid === row.pid) || (root && commandNamesRoot(row.command, root));
    if (candidate && !protectedPids.has(row.pid) && !expected.has(row.pid)) report(`preserved pid ${row.pid}: ambiguous ownership; ${row.command}`);
  }
  const current = processes();
  const currentRoots = [...directories].filter(([path, identity]) => directoryStillOwned(path, identity)).map(([path]) => path);
  if (root) currentRoots.push(root);
  const stillOwned = ownership(current, cwdPaths(), currentRoots, anchors);
  const verified = (row: ProcessRow) => expected.get(row.pid)?.started === row.started && stillOwned(row);
  const targets = current.filter(verified);
  const groups = new Set<number>();
  for (const row of targets) {
    if (groups.has(row.group)) continue;
    const leader = current.find(member => member.pid === row.group);
    const members = current.filter(member => member.group === row.group);
    const wholeGroup = !protectedGroups.has(row.group) && leader !== undefined && verified(leader) && members.every(verified);
    report(`cleanup pid ${row.pid}: ${row.command}`);
    try {
      // A group is attempted once even when kill reports that it vanished. Its other
      // captured members cannot establish ownership for a later replacement group.
      if (wholeGroup) { groups.add(row.group); process.kill(-row.group, 'SIGKILL'); }
      else process.kill(row.pid, 'SIGKILL');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') continue;
      if (code !== 'EPERM') throw error;
      // macOS can report EPERM when a group/child is reaped between ps and kill. Do not
      // hide a permission failure for a live captured identity, or retry a replacement PID.
      const signalled = wholeGroup ? targets.filter(target => target.group === row.group) : [row];
      const remaining = processes().filter(current => signalled.some(target => current.pid === target.pid && current.started === target.started));
      if (remaining.length > 0) throw error;
    }
  }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const remaining = processes().filter(row => targets.some(target => target.pid === row.pid && target.started === row.started));
    if (remaining.length === 0) return targets.length;
    await pause(50);
  }
  throw new Error('owned test processes did not exit after SIGKILL');
}

const ownedPids = new Map<number, ProcessIdentity>();
let installed = false;
function installSignals(): void {
  if (installed) return;
  installed = true;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    void (async () => {
      await cleanupProcesses(undefined, [...ownedPids.values()]);
      for (const [dir, identity] of directories) { if (!directoryStillOwned(dir, identity)) continue; await cleanupProcesses(dir); await rm(dir, { recursive: true, force: true }); }
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
  t?.after(async () => { await cleanup(); });
  return cleanup;
}
export function ownDirectory(t: TestContext | undefined, path: string): () => Promise<void> {
  const root = realpathSync(path);
  const info = statSync(root);
  const identity = { device: info.dev, inode: info.ino };
  directories.set(root, identity); installSignals();
  const cleanup = async () => {
    if (directoryStillOwned(root, identity)) { await cleanupProcesses(root); await rm(root, { recursive: true, force: true }); }
    directories.delete(root);
  };
  t?.after(async () => { await cleanup(); });
  return cleanup;
}
