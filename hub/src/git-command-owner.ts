// Active Git writers have a durable admission receipt before their launch gate opens.
import { randomUUID } from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { mkdir, open, opendir, realpath, stat, lstat, unlink } from 'node:fs/promises';
import { constants, opendirSync } from 'node:fs';
import { durableJson } from './executor/droplet/lease.ts';
import { projectGitDirectory } from './git-maintenance.ts';
import { processStartedAsync as processStarted } from './hub/lock.ts';
import { processIdentityAsync } from './process-identity.ts';
import { endProcess } from './system-processes.ts';
import { withTerritoryReservation } from './territory.ts';
import { territoryLockContext } from './territory-lock-context.ts';

export type GitProcess = { pid: number; pidStarted: string; pidIdentity: string };
export type GitClose = { code: number | null; signal: string | null };
export type GitCommandRecord = {
  version: 1; id: string; root: string; rootDev: string; rootIno: string; host: string; uid: number;
  parent: GitProcess; child: GitProcess | null; captured: GitProcess[];
  phase: 'preparing' | 'running' | 'cleanup'; released: boolean; closed?: GitClose;
};
export type GitCommandLease = {
  path: string;
  bind(child: GitProcess): Promise<void>;
  releaseGate(): Promise<void>;
  checkpoint(tree: readonly GitProcess[]): Promise<void>;
  incomplete(): Promise<void>;
  close(receipt: GitClose): Promise<void>;
  clear(): Promise<void>;
  onRecovery?(retry: () => Promise<boolean>, owner?: object): void;
  onLive?(child: GitProcess, originalAlive: () => boolean): void;
};
const directory = (root: string) => join(root, '.cland/run/git-command-owners');
const active = new Map<string, GitCommandRecord>();
const admissions = new Map<string, { row: GitCommandRecord; parent: GitProcess; child: GitProcess; reservation: { active: boolean }; originalAlive: () => boolean }>();
const retries = new Map<string, { retry: () => Promise<boolean>; owner: object | undefined }>();
const sameBirth = (a: GitProcess | null, b: GitProcess | null) => !!a && !!b && a.pid === b.pid && a.pidStarted === b.pidStarted && a.pidIdentity === b.pidIdentity;
function liveAdmission(path: string, row: GitCommandRecord): boolean {
  const proof = admissions.get(path);
  return !!proof && active.get(path) === proof.row && proof.reservation.active && proof.originalAlive()
    && row.id === proof.row.id && row.rootDev === proof.row.rootDev && row.rootIno === proof.row.rootIno
    && row.parent.pid === process.pid && sameBirth(row.parent, proof.parent) && sameBirth(proof.row.parent, proof.parent)
    && sameBirth(row.child, proof.child) && sameBirth(proof.row.child, proof.child)
    && row.phase === 'running' && proof.row.phase === 'running' && row.released && proof.row.released
    && row.closed === undefined && proof.row.closed === undefined && row.captured.length === 0 && proof.row.captured.length === 0;
}
let parent: Promise<GitProcess> | undefined;
async function parentIdentity(env: NodeJS.ProcessEnv): Promise<GitProcess> {
  return parent ??= (async () => {
    const pidStarted = await processStarted(process.pid, undefined, undefined, undefined, env);
    const pidIdentity = await processIdentityAsync(process.pid, env);
    if (!pidStarted || !pidIdentity) throw new Error('cannot establish Git command parent identity');
    return { pid: process.pid, pidStarted, pidIdentity };
  })().catch(error => { parent = undefined; throw error; });
}
export async function gitCommandRoot(cwd: string): Promise<string> {
  const common = await projectGitDirectory(cwd);
  const path = resolve(common ?? cwd);
  return realpath(path.endsWith('/.cland/territory.git') ? dirname(dirname(path)) : common ? dirname(path) : path);
}
export class GitCommandRecoveryRequired extends Error {
  readonly code = 'CLAND_GIT_RECOVERY_REQUIRED';
  readonly path: string;
  constructor(path: string, reason: string) { super(`Git writer recovery required: ${path}; ${reason}; territory writes fenced`); this.path = path; }
}
/** Every record is fenced to this exact directory, user and machine before native classification. */
export function parseGitCommandRecord(text: string, root: string, identity: { dev: bigint; ino: bigint }): GitCommandRecord {
  const row = JSON.parse(text) as GitCommandRecord;
  const process = (p: GitProcess | null) => !!p && Number.isSafeInteger(p.pid) && p.pid > 1 && typeof p.pidStarted === 'string' && !!p.pidStarted && typeof p.pidIdentity === 'string' && !!p.pidIdentity;
  if (row.version !== 1 || !/^[a-f0-9-]{36}$/.test(row.id) || row.root !== root || row.rootDev !== identity.dev.toString() || row.rootIno !== identity.ino.toString() || row.host !== hostname() || row.uid !== userInfo().uid || !process(row.parent) || row.child !== null && !process(row.child) || !Array.isArray(row.captured) || row.captured.length > 256 || !row.captured.every(process) || !['preparing', 'running', 'cleanup'].includes(row.phase) || typeof row.released !== 'boolean' || row.released && row.child === null) throw new Error('invalid or copied Git writer ownership receipt');
  if (row.child === null && row.captured.length !== 0) throw new Error('invalid or copied Git writer ownership receipt: unbound captured descendants');
  return row;
}
async function readRecord(path: string, root: string, identity: { dev: bigint; ino: bigint }): Promise<GitCommandRecord> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await file.stat();
      const privateFile = info.isFile() && info.uid === userInfo().uid && (info.mode & 0o077) === 0;
      if (!privateFile || info.nlink !== 1) {
        if (privateFile && info.nlink === 0) {
          // durableJson atomically replaces checkpoints. An unlinked opened
          // inode is not the current receipt; prove replacement before retrying.
          const current = await lstat(path);
          if (current.isFile() && (current.dev !== info.dev || current.ino !== info.ino)) continue;
        }
        throw new Error('private ownership receipt required: regular file, current native uid and one link');
      }
      const bytes = Buffer.alloc(65_537);
      const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
      if (bytesRead > 65_536) throw new Error('Git writer receipt exceeds 64 KiB');
      return parseGitCommandRecord(bytes.subarray(0, bytesRead).toString('utf8'), root, identity);
    } finally { await file.close(); }
  }
  throw new Error('Git writer receipt changed across four bounded read attempts; retry owner retained');
}
export async function prepareGitCommand(cwd: string, env: NodeJS.ProcessEnv, parentProbe = parentIdentity, requester?: object, services?: GitRecoveryServices, readOnly = false): Promise<GitCommandLease> {
  const root = await gitCommandRoot(cwd);
  await recoverGitCommands(root, env, services, requester);
  if (readOnly) {
    // Read admission keeps the unknown-writer fence, but the original native
    // command owner alone joins this harmless reader. No durable writer exists.
    const complete = async () => {};
    return { path: '', bind: complete, releaseGate: complete, checkpoint: complete, incomplete: complete, close: complete, clear: complete };
  }
  const held = territoryLockContext.getStore();
  const reservation = held?.active && await realpath(held.root) === root && held.active ? held : undefined;
  const info = await stat(root, { bigint: true });
  const row: GitCommandRecord = { version: 1, id: randomUUID(), root, rootDev: info.dev.toString(), rootIno: info.ino.toString(),
    host: hostname(), uid: userInfo().uid, parent: await parentProbe(env), child: null, captured: [], phase: 'preparing', released: false };
  await mkdir(directory(root), { recursive: true, mode: 0o700 });
  const path = join(directory(root), `${row.id}.json`);
  let tail = Promise.resolve();
  let cleared = false;
  const save = (change: () => void, publish = true) => {
    const work = tail.then(async () => {
      if (cleared) return; // A joined native close cannot resurrect retired ownership.
      const current = await stat(root, { bigint: true });
      if (current.dev !== info.dev || current.ino !== info.ino) throw new Error('Git command root identity changed before checkpoint');
      change(); if (publish) await durableJson(path, row);
    });
    tail = work.catch(() => {});
    return work;
  };
  active.set(path, row);
  return { path,
    onRecovery: (retry, owner) => { retries.set(path, { retry, owner }); },
    onLive: (child, originalAlive) => {
      if (reservation?.active && row.parent.pid === process.pid && sameBirth(row.child, child) && row.phase === 'running' && row.released) {
        admissions.set(path, { row, parent: { ...row.parent }, child: { ...child }, reservation, originalAlive });
      }
    },
    bind: child => save(() => { row.child = child; }, false),
    releaseGate: () => save(() => {
      if (!row.child) throw new Error('Git writer gate requires a captured native birth');
      row.released = true; row.phase = 'running';
    }),
    checkpoint: tree => save(() => {
      const captured = new Map(row.captured.map(p => [p.pid, p]));
      for (const p of tree) captured.set(p.pid, p);
      if (captured.size > 256) throw new Error('Git writer tree capture exceeds 256 identities');
      row.captured = [...captured.values()];
    }),
    incomplete: () => save(() => { row.phase = 'cleanup'; }),
    close: receipt => save(() => { row.closed = receipt; }),
    clear: () => {
      const work = tail.then(async () => {
        if (cleared) return;
        // Serialize retirement with every checkpoint. A recovery may already
        // have retired this exact token after positive native absence.
        try {
          const current = await readRecord(path, root, await stat(root, { bigint: true }));
          if (current.id !== row.id) throw new Error('Git command receipt changed before cleanup');
          await unlink(path);
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        cleared = true;
        active.delete(path);
        admissions.delete(path);
        retries.delete(path);
      });
      tail = work.catch(() => {});
      return work;
    },
  };
}
export type GitRecoveryServices = {
  reserve?<T>(work: () => Promise<T>): Promise<T>;
  parentState(row: GitProcess): Promise<'alive' | 'gone' | 'unknown'>;
  end: typeof endProcess;
};
async function parentState(row: GitProcess, env: NodeJS.ProcessEnv): Promise<'alive' | 'gone' | 'unknown'> {
  try { process.kill(row.pid, 0); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return 'gone';
    if (code !== 'EPERM') return 'unknown';
  }
  let exited = false;
  const identity = await processIdentityAsync(row.pid, env, undefined, () => { exited = true; });
  if (exited) return 'gone';
  return identity === null ? 'unknown' : identity === row.pidIdentity ? 'alive' : 'gone';
}
/** Startup and async territory admission share this exact recovery policy. */
export async function recoverGitCommands(root: string, env: NodeJS.ProcessEnv = process.env, supplied?: GitRecoveryServices, requester?: object): Promise<void> {
  root = await realpath(root);
  // Current in-process admission proofs were captured under their owner's
  // still-held reservation. They need no new lock or fresh native PID probe.
  // Every other record still goes through serialized recovery before effects.
  let entries;
  try { entries = await opendir(directory(root)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  let found = false, count = 0;
  const observed: Array<{ path: string; row: GitCommandRecord }> = [];
  const info = await stat(root, { bigint: true });
  for await (const entry of entries) {
    if (++count > 256) { found = true; break; }
    if (!entry.name.endsWith('.json')) continue;
    const path = join(directory(root), entry.name);
    try {
      const row = await readRecord(path, root, info);
      if (entry.name !== `${row.id}.json` || !liveAdmission(path, row)) { found = true; break; }
      observed.push({ path, row });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      found = true; break;
    }
  }
  if (!found) found = observed.some(({ path, row }) => !liveAdmission(path, row));
  if (!found) return;
  const operation = () => recoverReserved(root, env, supplied, requester);
  const held = territoryLockContext.getStore();
  if (held?.active && await realpath(held.root) === root && held.active) return operation();
  try { return await (supplied?.reserve ? supplied.reserve(operation) : withTerritoryReservation(root, operation)); }
  catch (error) {
    if (error instanceof GitCommandRecoveryRequired) throw error;
    throw new GitCommandRecoveryRequired(directory(root), `recovery reservation: ${(error as Error).message}`);
  }
}
async function recoverReserved(root: string, env: NodeJS.ProcessEnv, supplied?: GitRecoveryServices, requester?: object): Promise<void> {
  const info = await stat(root, { bigint: true });
  let entries;
  try { entries = await opendir(directory(root)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const io = supplied ?? { end: endProcess, parentState: (row: GitProcess) => parentState(row, env) };
  let count = 0;
  for await (const entry of entries) {
    if (++count > 256) throw new GitCommandRecoveryRequired(directory(root), 'active receipt census exceeds 256 entries');
    if (!entry.name.endsWith('.json')) continue; // durableJson temporary files never authorize a launch
    const path = join(directory(root), entry.name);
    let row;
    try { row = await readRecord(path, root, info); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; // The enumerated receipt was retired before open.
      throw new GitCommandRecoveryRequired(path, (error as Error).message);
    }
    if (entry.name !== `${row.id}.json`) throw new GitCommandRecoveryRequired(path, 'receipt identity does not match its file');
    const local = active.get(path);
    if (local?.id === row.id) {
      if (!sameBirth(local.parent, row.parent) || row.child !== null && !sameBirth(local.child, row.child)) throw new GitCommandRecoveryRequired(path, 'record birth differs from its current owner');
      if (local.phase === 'cleanup') {
        const retry = retries.get(path);
        // A cancelled owner's pending preparation must unwind, rather than
        // await cancellation that is itself joining that preparation.
        if (!retry || requester !== undefined && retry.owner === requester || !await retry.retry()) throw new GitCommandRecoveryRequired(path, 'live retry owner retains unconfirmed native work');
      }
      continue;
    }
    const state = await io.parentState(row.parent);
    if (state === 'alive' && row.phase !== 'cleanup') continue;
    if (state !== 'gone') throw new GitCommandRecoveryRequired(path, state === 'alive' ? 'live retry owner retains unconfirmed native work' : 'parent native identity unknown');
    if (!row.released && row.child === null) {
      // No gate-release receipt exists; Git could not have started.
      await unlink(path); continue;
    }
    const captured = new Map(row.captured.map(p => [p.pid, p]));
    let complete = true;
    if (row.child) {
      const receipt = row.child;
      complete = await io.end(receipt, () => {}, 100, async () => {
        if (captured.size > 256) throw new Error('Git writer tree capture exceeds 256 identities');
        row.captured = [...captured.values()]; await durableJson(path, row);
      }, { env, deadline: Date.now() + 1000, allowReused: true, onCaptured: tree => {
        for (const p of tree) captured.set(p.pid, p);
      } });
    }
    for (const p of captured.values()) if (p.pid !== row.child?.pid) {
      complete = await io.end(p, () => {}, 100, undefined, { env, deadline: Date.now() + 1000, allowReused: true }) && complete;
    }
    if (!complete) throw new GitCommandRecoveryRequired(path, 'native stop unconfirmed; retry startup or the retained command owner');
    await unlink(path);
    active.delete(path);
    admissions.delete(path);
    retries.delete(path);
  }
}
/** Synchronous init never signals from persisted rows; async startup performs reconciliation. */
export function assertNoGitCommandRecovery(root: string): void {
  const path = directory(resolve(root));
  let entries;
  try { entries = opendirSync(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  try {
    let count = 0;
    for (let entry = entries.readSync(); entry; entry = entries.readSync()) {
      if (++count > 256 || entry.name.endsWith('.json')) throw new GitCommandRecoveryRequired(path, 'retry the live owner or restart for native Git recovery');
    }
  } finally { entries.closeSync(); }
}
