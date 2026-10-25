import { processIdentities } from '../src/process-identity.ts';
// Test-only ownership: registered groups for teardown; directory/ancestry discovery for phase recovery.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readlinkSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import type { TestContext } from 'node:test';
import { parseProcessTable, processTableArgs, retainProcessAncestry, type SystemProcess } from '../src/process-table.ts';

export type ProcessIdentity = { pid: number; started: string; identity?: string | null; identityError?: string; group?: number };
type ProcessRow = SystemProcess;
export const RUN_ID = process.env.TEST_SUITE_RUN_ID ??= randomUUID();
export const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const recorded = new Map<number, ProcessIdentity>();
const observedThisTurn = new Map<number, ProcessIdentity>();
const settled = new Set<ProcessIdentity>();
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
}

function groupMembers(groups: number[]): number[] {
  let members: string;
  // cland-allow-child-env: read-only OS discovery for fixture groups; no account, provider or Git operation
  try { members = execFileSync('pgrep', ['-g', groups.join(',')], { encoding: 'utf8' }); }
  catch (error) {
    if ((error as { status?: number }).status !== 1) throw error;
    members = String((error as { stdout?: string }).stdout ?? '');
  }
  return members.trim().split(/\s+/).filter(Boolean).map(Number);
}
function processes(pids?: number[], groups: number[] = []): ProcessRow[] {
  if (groups.length) pids = [...new Set([...(pids ?? []), ...groupMembers(groups)])];
  if (pids?.length === 0) return [];
  let output: string;
  // cland-allow-child-env: read-only OS discovery tool for fixture cleanup; no account, provider or Git operation
  try { output = execFileSync('ps', processTableArgs(pids), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' } }); }
  catch (error) {
    if (!pids || (error as { status?: number }).status !== 1) throw error;
    output = String((error as { stdout?: string }).stdout ?? '');
  }
  const selected = parseProcessTable(output).map(row => row.pid);
  if (!selected.length) return [];
  const errors = new Map<number, string>();
  const before = processIdentities(selected, (pid, error) => errors.set(pid, `before ownership snapshot: ${error}`));
  // The first listing only selects PIDs. Bind ownership facts to one incarnation
  // by bracketing the authoritative listing with stable native births.
  // cland-allow-child-env: read-only native ownership snapshot; caller owns fixture environment
  try { output = execFileSync('ps', processTableArgs(selected), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' } }); }
  catch (error) {
    if ((error as { status?: number }).status !== 1) throw error;
    output = String((error as { stdout?: string }).stdout ?? '');
  }
  // Only the final native state can supersede an older running ps row. A zombie
  // has no writer left, although its parent may not have reaped its PID yet.
  const exited = new Set<number>();
  const after = processIdentities(selected, (pid, error) => errors.set(pid, `after ownership snapshot: ${error}`), pid => exited.add(pid));
  return retainProcessAncestry(parseProcessTable(output), exited).map(row => {
    const identity = before.get(row.pid) && before.get(row.pid) === after.get(row.pid) ? before.get(row.pid)! : null;
    return { ...row, identity, ...(!identity ? { identityError: exited.has(row.pid) ? 'native exit observed; listed descendants are not confirmed gone' : errors.get(row.pid) ?? 'native birth unavailable or changed across ownership snapshot' } : {}) };
  });
}
function requireIdentities(expected: Iterable<ProcessIdentity>, current: ProcessRow[]): void {
  for (const target of expected) {
    if (target.pid === process.pid) continue; // the invoking worker can never be a cleanup target
    const row = current.find(row => row.pid === target.pid);
    if (row && (!target.identity || !row.identity) && alive(target.pid)) throw new Error(`native process identity unavailable for pid ${target.pid}; fixture preserved; captured: ${target.identityError ?? (target.identity ? 'known' : 'missing')}; current: ${row.identityError ?? (row.identity ? 'known' : 'missing')}`);
  }
}
/** Capture at spawn/first API observation, never after a remembered child has exited. */
export function captureProcess(pid: number | undefined): ProcessIdentity | null {
  if (pid === undefined) return null;
  const row = processes([pid]).find(row => row.pid === pid);
  if (!row) return null;
  const identity = { pid: row.pid, started: row.started, identity: row.identity ?? null, ...(row.identityError ? { identityError: row.identityError } : {}), group: row.group };
  if (identity.identity) {
    // Registration can reuse the observation its caller just made, before any
    // asynchronous boundary. Reads and destructive revalidation always stay fresh.
    observedThisTurn.set(pid, identity);
    queueMicrotask(() => { if (observedThisTurn.get(pid) === identity) observedThisTurn.delete(pid); });
  }
  return identity;
}
const directoryProcesses = new Map<string, Set<ProcessIdentity>>();
const contextProcesses = new WeakMap<TestContext, Set<ProcessIdentity>>();
type CleanupStep = () => unknown | Promise<unknown>;
const signalDirectoryCleanup = new Set<CleanupStep>();
const contextCleanup = new WeakMap<TestContext, { resources: CleanupStep[]; directories: CleanupStep[]; hubs: CleanupStep[]; checks: CleanupStep[] }>();
function cleanupSteps(t: TestContext) {
  let steps = contextCleanup.get(t);
  if (!steps) {
    steps = { resources: [], directories: [], hubs: [], checks: [] };
    contextCleanup.set(t, steps);
    const owned = steps;
    t.after(async () => {
      const errors: unknown[] = [];
      // Native after hooks stop at their first failure. One ownership hook keeps
      // every resource disposal running, and removes directories only afterwards.
      for (const step of [...owned.resources, ...owned.hubs, ...owned.directories, ...owned.checks]) {
        try { await step(); } catch (error) { errors.push(error); }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, 'test fixture cleanup failed');
    });
  }
  return steps;
}
/** Stop writers before directory removal, including when signals bypass after hooks. */
export function beforeDirectories(t: TestContext, step: CleanupStep): void {
  const steps = cleanupSteps(t);
  let running: Promise<unknown> | undefined;
  const run = () => running ??= Promise.resolve().then(step);
  steps.hubs.push(run);
  signalDirectoryCleanup.add(run);
  steps.checks.push(() => { signalDirectoryCleanup.delete(run); });
  installSignals();
}

/** Check fixture leaks after owned resources and directories have been disposed. */
export function afterCleanup(t: TestContext, check: CleanupStep): void { cleanupSteps(t).checks.push(check); }

/** Dispose fixture resources in registration order, before any owned directory is removed. */
export function onCleanup(t: TestContext, step: CleanupStep): void {
  cleanupSteps(t).resources.push(step);
}
export function rememberProcess(pid: number | undefined, root?: string): void {
  if (pid === undefined || pid === process.pid) return;
  if (!recorded.has(pid)) {
    const identity = captureProcess(pid);
    if (identity) recorded.set(pid, identity);
  }
  if (root && recorded.has(pid)) {
    for (const [directory, pids] of directoryProcesses) if (within(root, directory)) pids.add(recorded.get(pid)!);
  }
}
export const recordedProcess = (pid: number): ProcessIdentity | undefined => {
  const identity = recorded.get(pid);
  return identity && !settled.has(identity) ? identity : undefined;
};
export function rememberResultProcesses(value: unknown, root?: string): void {
  const observations: Array<{ pid: number; root: string | undefined }> = [];
  const collect = (entry: unknown, directory?: string) => {
    if (!entry || typeof entry !== 'object') return;
    if ('cwd' in entry && typeof entry.cwd === 'string') directory = entry.cwd;
    if ('pid' in entry && typeof entry.pid === 'number' && entry.pid !== process.pid) observations.push({ pid: entry.pid, root: directory });
    for (const child of Object.values(entry)) if (typeof child === 'object') collect(child, directory);
  };
  collect(value, root);
  const missing = [...new Set(observations.map(entry => entry.pid).filter(pid => !recorded.has(pid)))];
  for (const row of processes(missing)) recorded.set(row.pid, { pid: row.pid, started: row.started, identity: row.identity ?? null, ...(row.identityError ? { identityError: row.identityError } : {}), group: row.group });
  for (const entry of observations) if (recorded.has(entry.pid)) rememberProcess(entry.pid, entry.root);
}
const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
function commandNamesRoot(command: string, root: string): boolean {
  return command.split(/[\s"'=,]+/).some(part => within(part.replace(/^(?:file|unix):\/\//, ''), root));
}
function cwdPaths(pids?: number[]): Map<number, string> {
  const result = new Map<number, string>();
  if (pids?.length === 0) return result;
  if (process.platform === 'linux') {
    for (const name of pids ?? readdirSync('/proc')) {
      try { result.set(Number(name), readlinkSync(`/proc/${name}/cwd`).replace(/ \(deleted\)$/, '')); } catch { /* exited */ }
    }
  } else {
    let output: string;
    // cland-allow-child-env: read-only OS discovery tool for fixture cleanup; no account, provider or Git operation
    try { output = execFileSync('lsof', ['-n', '-P', ...(pids ? ['-a', '-p', pids.join(',')] : []), '-d', 'cwd', '-Fpn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
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
    // cland-allow-child-env: read-only OS discovery tool for fixture cleanup; no account, provider or Git operation
    const output = execFileSync('ps', ['eww', '-axo', 'pid=,command='], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const byPid = new Map(rows.map(row => [row.pid, row]));
    for (const line of output.split('\n')) {
      const match = /^\s*(\d+)\s+(.*)$/.exec(line);
      const row = byPid.get(Number(match?.[1]));
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

type DirectoryOptions = { beforeRemove?: CleanupStep; removeTimeoutMs?: number };
const directories = new Map<string, { device: number; inode: number } & DirectoryOptions>();
let self: ProcessRow | undefined;
let inspectedSelf = false;
// A worker with no children needs no OS identity. Native cleanup still captures
// its immutable identity before inspecting or signalling any owned process.
function selfProcess(): ProcessRow | undefined {
  if (!inspectedSelf) { self = processes([process.pid]).find(row => row.pid === process.pid); inspectedSelf = true; }
  return self;
}
function directoryStillOwned(path: string, identity: { device: number; inode: number }): boolean {
  try { const info = statSync(path); return info.dev === identity.device && info.ino === identity.inode; }
  catch { return false; }
}
function ownership(rows: ProcessRow[], cwd: Map<number, string>, roots: string[], anchors: ProcessIdentity[]): (row: ProcessRow) => boolean {
  const starts = new Map(anchors.map(identity => [identity.pid, identity.identity]));
  const table = new Map(rows.map(row => [row.pid, row]));
  return row => {
    if (roots.some(root => within(cwd.get(row.pid) ?? '', root))) return true;
    const visited = new Set<number>();
    let ancestor: ProcessRow | undefined = row;
    while (ancestor && !visited.has(ancestor.pid)) {
      if (ancestor.identity != null && starts.get(ancestor.pid) === ancestor.identity) return true;
      visited.add(ancestor.pid); ancestor = table.get(ancestor.parent);
    }
    return false;
  };
}
/** Scope candidates, then prove cwd containment or current ancestry to an original runner identity.
 * Environment markers are hints only: macOS flattens other values into marker-looking text.
 * `root` must be verified by the caller; helper-registered roots also retain device/inode proof.
 */
export async function cleanupProcesses(root?: string, seeds: ProcessIdentity[] = [], report?: (line: string) => void, runId = RUN_ID, anchors: ProcessIdentity[] = selfProcess() ? [selfProcess()!] : [], options: { discover?: boolean } = {}): Promise<number> {
  if (seeds.length && !options.discover) return cleanupRecordedProcesses(seeds, report, anchors, root, runId);
  return cleanupDiscoveredProcesses(root, seeds, report, runId, anchors);
}

async function cleanupDiscoveredProcesses(root?: string, seeds: ProcessIdentity[] = [], report?: (line: string) => void, runId = RUN_ID, anchors: ProcessIdentity[] = selfProcess() ? [selfProcess()!] : []): Promise<number> {
  const rows = processes();
  const markers = report ? runMarkers(rows) : new Map<number, string>();
  // Seed cleanup needs cwd proof only for the seeds and their descendants. Root
  // sweeps still inspect every cwd, including an unrecorded/reparented child.
  const candidates = new Set(seeds.map(seed => seed.pid));
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (candidates.has(row.parent) && !candidates.has(row.pid)) { candidates.add(row.pid); changed = true; }
  }
  const cwd = cwdPaths(root ? undefined : [...candidates]);
  const roots = [...directories].filter(([path, identity]) => directoryStillOwned(path, identity)).map(([path]) => path);
  if (root) roots.push(root);
  const owned = ownership(rows, cwd, roots, anchors);
  // A registered PID which was replaced cannot regain ownership from its cwd.
  // Its new descendants belong to that replacement, not the recorded fixture.
  requireIdentities(seeds, rows);
  const protectedPids = new Set(seeds.filter(seed => rows.some(row => row.pid === seed.pid && (row.identity == null || row.identity !== seed.identity || seed.group !== undefined && row.group !== seed.group))).map(seed => seed.pid));
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (protectedPids.has(row.parent) && !protectedPids.has(row.pid)) { protectedPids.add(row.pid); changed = true; }
  }
  const protectedGroups = new Set<number>();
  let ancestor = rows.find(row => row.pid === process.pid);
  const ancestors = new Set<number>();
  while (ancestor && !ancestors.has(ancestor.pid)) {
    ancestors.add(ancestor.pid);
    protectedPids.add(ancestor.pid); protectedGroups.add(ancestor.group);
    ancestor = rows.find(row => row.pid === ancestor!.parent);
  }
  const expected = new Map<number, ProcessIdentity>();
  for (const seed of seeds) {
    const row = rows.find(row => row.pid === seed.pid);
    if (row?.identity != null && row.identity === seed.identity && owned(row)) expected.set(row.pid, seed);
  }
  if (root) for (const row of rows) {
    if (owned(row) && (within(cwd.get(row.pid) ?? '', root) || commandNamesRoot(row.command, root) || markers.get(row.pid) === runId)) expected.set(row.pid, row);
  }
  for (const pid of protectedPids) expected.delete(pid);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (expected.has(row.parent) && !expected.has(row.pid) && !protectedPids.has(row.pid) && owned(row)) {
      expected.set(row.pid, row); changed = true;
    }
  }
  if (report) {
    for (const row of rows) {
      const candidate = markers.get(row.pid) === runId || seeds.some(seed => seed.pid === row.pid) || (root && commandNamesRoot(row.command, root));
      if (candidate && !protectedPids.has(row.pid) && !expected.has(row.pid)) report(`preserved pid ${row.pid}: ambiguous ownership; ${row.command}`);
    }
  }
  // Count this phase's bridge identities in the existing discovery snapshot.
  // A marker selects a candidate, but never authorizes terminating it.
  const bridges = report ? rows.filter(row => /(?:^|\/)cland\.ts\s+hook\s+bridge(?:\s|$)/.test(row.command) &&
    (markers.get(row.pid) === runId || (root && commandNamesRoot(row.command, root)))) : [];
  const bridgeReceipt = () => {
    if (!report) return;
    const remaining = bridges.length ? processes(bridges.map(row => row.pid)).filter(row => bridges.some(before => before.pid === row.pid && before.identity != null && before.identity === row.identity)).length : 0;
    report(`suite hook bridges: before cleanup ${bridges.length}; after cleanup ${remaining}`);
    if (remaining) throw new Error(`suite left ${remaining} hook bridge process(es); ambiguous ownership preserved`);
  };
  // With no captured target there is nothing to revalidate or signal.
  if (expected.size === 0) { bridgeReceipt(); return 0; }
  const current = processes([...expected.keys(), ...anchors.map(anchor => anchor.pid)], [...new Set(rows.filter(row => expected.has(row.pid)).map(row => row.group).filter(group => !protectedGroups.has(group)))]);
  const currentRoots = [...directories].filter(([path, identity]) => directoryStillOwned(path, identity)).map(([path]) => path);
  if (root) currentRoots.push(root);
  const expectedGroups = new Set(rows.filter(row => expected.has(row.pid)).map(row => row.group));
  const currentCwd = cwdPaths(current.map(row => row.pid));
  const stillOwned = ownership(current, currentCwd, currentRoots, [...anchors, ...expected.values()]);
  // A member may fork between discovery and this targeted group snapshot. Retain
  // the original anchors and require current ancestry/cwd proof for every late member.
  for (const row of current) if (!expected.has(row.pid) && !protectedPids.has(row.pid) && expectedGroups.has(row.group) && stillOwned(row)) expected.set(row.pid, row);
  const verified = (row: ProcessRow) => row.identity != null && expected.get(row.pid)?.identity === row.identity && stillOwned(row);
  requireIdentities(expected.values(), current);
  const targets = current.filter(verified);
  const groups = new Set<number>();
  for (const row of targets) {
    if (groups.has(row.group)) continue;
    const leader = current.find(member => member.pid === row.group);
    const members = current.filter(member => member.group === row.group);
    const wholeGroup = !protectedGroups.has(row.group) && leader !== undefined && verified(leader) && members.every(verified);
    report?.(`cleanup pid ${row.pid}: ${row.command}`);
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
      const remaining = processes(signalled.map(target => target.pid)).filter(current => signalled.some(target => current.pid === target.pid && current.identity != null && current.identity === target.identity));
      if (remaining.length > 0) throw error;
    }
  }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const inspected = processes(targets.map(target => target.pid));
    requireIdentities(targets, inspected);
    const remaining = inspected.filter(row => targets.some(target => target.pid === row.pid && target.identity != null && target.identity === row.identity));
    if (remaining.length === 0) { bridgeReceipt(); return targets.length; }
    await pause(50);
  }
  throw new Error('owned test processes did not exit after SIGKILL');
}

/** Kill registered identities and verified descendants in their captured groups, without a machine scan.
 * Non-leaders receive positive-PID signals only. An unrelated group member prevents a group signal.
 */
const newerThanSelf = (row: ProcessIdentity) => Date.parse(row.started) >= (selfProcess() ? Date.parse(selfProcess()!.started) : -Infinity);
let protectedPids: Set<number> | undefined;
export async function cleanupOwnedProcesses(seeds: ProcessIdentity[]): Promise<void> {
  await cleanupRecordedProcesses(seeds);
}

async function cleanupRecordedProcesses(seeds: ProcessIdentity[], report?: (line: string) => void, anchors: ProcessIdentity[] = [], root?: string, runId = RUN_ID): Promise<number> {
  const pending = seeds.filter(seed => !settled.has(seed));
  // A native absent-PID receipt plus an empty targeted group census establishes
  // that no captured group writer remains. No ownership snapshot or self/ancestor
  // inspection is needed unless there is something left to terminate.
  if (pending.length && pending.every(seed => seed.pid > 1 && seed.group === seed.pid && !alive(seed.pid)) &&
      groupMembers(pending.map(seed => seed.pid)).length === 0) {
    for (const seed of pending) settled.add(seed);
    return 0;
  }
  seeds = seeds.filter(seed => {
    if (settled.has(seed)) return false;
    // An exited leader can leave its captured group alive. Absence settles only
    // non-leaders; groups require a targeted membership probe before settling.
    if (alive(seed.pid) || seed.group === seed.pid && seed.pid !== selfProcess()?.group) return true;
    settled.add(seed); return false;
  });
  if (!seeds.length) return 0;
  if (!protectedPids) {
    protectedPids = new Set([process.pid]);
    for (let pid = selfProcess()?.parent; pid && !protectedPids.has(pid);) {
      protectedPids.add(pid);
      const ancestor = processes([pid])[0];
      if (!ancestor) break;
      pid = ancestor.parent;
    }
  }
  const protectedForCleanup = protectedPids;
  const groups = seeds.filter(seed => seed.group === seed.pid && seed.pid !== selfProcess()?.group && !protectedForCleanup.has(seed.pid) && newerThanSelf(seed)).map(seed => seed.pid);
  const rows = processes([...seeds.filter(seed => alive(seed.pid)).map(seed => seed.pid), ...anchors.map(anchor => anchor.pid)], groups);
  requireIdentities(seeds, rows);
  // A live PID whose original identity cannot be verified needs the full proof.
  // A gone leader may still have selected survivors: retain the targeted cwd path.
  if ([...seeds, ...anchors].some(seed => alive(seed.pid) && !rows.some(row => row.pid === seed.pid && row.identity != null && row.identity === seed.identity && (seed.group === undefined || row.group === seed.group)))) {
    return cleanupDiscoveredProcesses(root, seeds, report, runId, anchors);
  }
  const expected = new Map<number, ProcessRow>();
  for (const seed of seeds) {
    const row = rows.find(row => row.pid === seed.pid);
    if (row && !protectedForCleanup.has(row.pid) && newerThanSelf(row) && row.identity != null && row.identity === seed.identity && (seed.group === undefined || row.group === seed.group)) expected.set(row.pid, row);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (expected.has(row.parent) && !expected.has(row.pid) && !protectedForCleanup.has(row.pid) && newerThanSelf(row)) {
      expected.set(row.pid, row); changed = true;
    }
  }
  // A hook can outlive the shell that launched it while retaining the session's group.
  // Probe cwd only for those selected members whose parent chain no longer proves ownership.
  const roots = [...directories].filter(([path, identity]) => directoryStillOwned(path, identity)).map(([path]) => path);
  const retainedGroups = groups.filter(group => expected.has(group) || !rows.some(row => row.pid === group));
  const unproven = rows.filter(row => !expected.has(row.pid) && !protectedForCleanup.has(row.pid) && newerThanSelf(row) && retainedGroups.includes(row.group));
  const inspectedCwd = roots.length > 0 && unproven.length > 0;
  if (inspectedCwd) {
    const cwd = cwdPaths(unproven.map(row => row.pid));
    for (const row of unproven) if (roots.some(root => within(cwd.get(row.pid) ?? '', root))) expected.set(row.pid, row);
  }
  if (!expected.size) {
    for (const seed of seeds) settled.add(seed);
    return 0;
  }
  // This targeted snapshot verifies the seeds and ancestry of every current group member.
  const current = inspectedCwd ? processes([...expected.keys()], groups) : rows;
  const verified = (row: ProcessRow) => row.identity != null && expected.get(row.pid)?.identity === row.identity && expected.get(row.pid)?.group === row.group;
  requireIdentities(expected.values(), current);
  const targets = current.filter(verified);
  const signalledGroups = new Set<number>();
  for (const row of targets) {
    if (signalledGroups.has(row.group)) continue;
    const leader = current.find(member => member.pid === row.group);
    const wholeGroup = groups.includes(row.group) && leader !== undefined && verified(leader) && current.filter(member => member.group === row.group).every(verified);
    if (wholeGroup) signalledGroups.add(row.group);
    report?.(`cleanup pid ${row.pid}: ${row.command}`);
    try { process.kill(wholeGroup ? -row.group : row.pid, 'SIGKILL'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') continue;
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
      const signalled = wholeGroup ? targets.filter(target => target.group === row.group) : [row];
      if (processes(signalled.map(target => target.pid)).some(verified)) throw error;
    }
  }
  const deadline = Date.now() + 5000;
  while (targets.some(target => alive(target.pid))) {
    const inspected = processes(targets.map(target => target.pid));
    requireIdentities(targets, inspected);
    if (!inspected.some(verified)) break;
    if (Date.now() >= deadline) throw new Error('owned test processes did not exit after SIGKILL');
    await pause(50);
  }
  for (const seed of seeds) settled.add(seed);
  return targets.length;
}

const ownedPids = new Map<number, ProcessIdentity>();
let installed = false;
function installSignals(): void {
  if (installed) return;
  installed = true;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    void (async () => {
      const seeds = [...new Map([...recorded, ...ownedPids]).values()];
      await cleanupOwnedProcesses(seeds);
      for (const step of signalDirectoryCleanup) await step();
      for (const [dir, identity] of directories) {
        if (!directoryStillOwned(dir, identity)) continue;
        // SIGTERM can interrupt a raw launch or hub start before its CLI receipt
        // registers the detached hub. Recover writers by the still-owned root,
        // not argv or an environment marker, before deleting their project.
        // Retain original identities even after recorded cleanup: replacement
        // PIDs and their descendants cannot regain ownership through this root.
        await cleanupProcesses(dir, seeds, undefined, RUN_ID, undefined, { discover: true });
      }
      // A project's hub may also write into the worker's account fixture. Stop
      // writers in every root before removing even the first directory.
      for (const [dir, identity] of directories) if (directoryStillOwned(dir, identity)) await identity.beforeRemove?.();
      for (const [dir, identity] of directories) if (directoryStillOwned(dir, identity)) await removeDirectory(dir, identity.removeTimeoutMs);
    })().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
}
export function ownProcess(t: TestContext | undefined, pid: number | undefined): () => Promise<void> {
  installSignals();
  const identity = pid === undefined ? null : recordedProcess(pid) ?? observedThisTurn.get(pid) ?? captureProcess(pid);
  if (pid !== undefined) observedThisTurn.delete(pid);
  if (identity) {
    ownedPids.set(identity.pid, identity); recorded.set(identity.pid, identity);
    if (t) {
      let pids = contextProcesses.get(t);
      if (!pids) { pids = new Set(); contextProcesses.set(t, pids); }
      pids.add(identity);
    }
  }
  let cleaned = false;
  const cleanup = async () => {
    if (identity && !cleaned) {
      await cleanupOwnedProcesses([identity]);
      cleaned = true;
      if (ownedPids.get(identity.pid) === identity) ownedPids.delete(identity.pid);
    }
  };
  if (t) onCleanup(t, cleanup);
  return cleanup;
}
async function removeDirectory(root: string, timeoutMs = 0): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { await rm(root, { recursive: true, force: true }); return; }
    catch (error) {
      if (!timeoutMs || !['ENOTEMPTY', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      if (Date.now() >= deadline) {
        const remaining = await readdir(root, { recursive: true }).catch(failure => [`<listing failed: ${String(failure)}>`]);
        throw new Error(`fixture cleanup could not remove ${root} within ${timeoutMs} ms; remaining paths: ${remaining.sort().join(', ') || '<none observed>'}`, { cause: error });
      }
      await pause(Math.min(25, deadline - Date.now()));
    }
  }
}

export function ownDirectory(t: TestContext | undefined, path: string, options: DirectoryOptions = {}): () => Promise<void> {
  const root = realpathSync(path);
  const info = statSync(root);
  const identity = { device: info.dev, inode: info.ino, ...options };
  directories.set(root, identity); directoryProcesses.set(root, new Set()); installSignals();
  const cleanup = async () => {
    if (directoryStillOwned(root, identity)) {
      await options.beforeRemove?.();
      const identities = new Set([...(directoryProcesses.get(root) ?? []), ...(t ? contextProcesses.get(t) ?? [] : [])]);
      await cleanupOwnedProcesses([...identities]);
      await removeDirectory(root, options.removeTimeoutMs);
    }
    directories.delete(root); directoryProcesses.delete(root);
  };
  if (t) cleanupSteps(t).directories.push(cleanup);
  return cleanup;
}
