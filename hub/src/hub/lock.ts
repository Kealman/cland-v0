// The project's hub lock, `.cland/hub.lock`: whoever holds it is the project's one hub. Taken before the
// hub prepares anything (the secret, the store, the sockets) and released last, so two starts at the same
// instant cannot both get past it, and a replacement cannot bind while the old hub is still shutting down.
//
// The file is created whole or not at all (written aside, then hard-linked into place, which fails when
// the name exists) and holds the holder's pid and its process start time. A lock whose pid is gone, or
// whose pid now belongs to a process started at another time (the pid was reused), is stale and broken.
// Every lifecycle change holds a crash-recoverable directory guard (`hub.lock.break`), so a stale-lock
// recoverer cannot remove what another starter just created.
import fs from 'node:fs/promises';
import { realClock, type Clock } from './clock.ts';
import { withCleanup, withCleanupAsync } from '../cleanup.ts';
import { randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers';
import { spawnSync } from 'node:child_process';
import { linkSync, readFileSync, rmSync, writeFileSync, mkdirSync, renameSync, rmdirSync, readdirSync, lstatSync } from 'node:fs';
import { run } from '../doctor/report.ts';
import type { Resumed } from './worktrees.ts';
import { pidAlive } from '../project.ts';

export type LockHolder = {
  pid: number;
  /** The holder's process start time as `ps -o lstart=` prints it; null when `ps` could not tell. */
  started: string | null;
  /** New ownership records use a pinned ps timezone; older records have no basis. */
  startedUtc?: string | null;
  /** New lock instances have a nonce; older pid/start-time records remain readable. */
  token?: string;
};

/** `ps -o lstart=`'s answer as the lock stores it; null when it said nothing. */
export const parseStarted = (stdout: string): string | null => stdout.trim().replace(/\s+/g, ' ') || null;

/** How long the daemon's own `ps` probe may take before it counts as "cannot say". */
const PS_TIMEOUT_MS = 3000;

/** The start time of a live process, as `ps` prints it; null when it is gone or `ps` cannot say (in time). */
export function processStarted(pid: number, timezone?: 'UTC'): string | null {
  const r = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', timeout: PS_TIMEOUT_MS, killSignal: 'SIGKILL', ...(timezone ? { env: { ...process.env, TZ: timezone, LC_ALL: 'C' } } : {}) });
  if (r.status !== 0 || r.error) return null;
  return parseStarted(r.stdout);
}

type StartedProbe = { promise: Promise<string | null>; resolve: (started: string | null) => void };
type StartedBatch = { probes: Map<number, StartedProbe>; pending: Map<number, StartedProbe> };
const startedBatches = new WeakMap<NodeJS.ProcessEnv, Map<string, StartedBatch>>();

/** Compatible callers in one turn share a targeted ps. Keep only in-flight identities. */
function startedProbe(pid: number, timeoutMs: number, timezone?: 'UTC', env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (!Number.isSafeInteger(pid) || pid <= 0) return Promise.resolve(null);
  let batches = startedBatches.get(env);
  if (!batches) { batches = new Map(); startedBatches.set(env, batches); }
  const key = `${timezone ?? 'local'}:${timeoutMs}`;
  let batch = batches.get(key);
  if (!batch) {
    batch = { probes: new Map(), pending: new Map() };
    batches.set(key, batch);
  }
  const existing = batch.probes.get(pid);
  if (existing) return existing.promise;
  const probe = Promise.withResolvers<string | null>();
  batch.probes.set(pid, probe);
  batch.pending.set(pid, probe);
  if (batch.pending.size === 1) {
    const owned = batch;
    setImmediate(() => {
      const pending = owned.pending;
      owned.pending = new Map();
      void (async () => {
        const identities = new Map<number, string>();
        try {
          const result = await run('ps', ['-o', 'pid=,lstart=', '-p', [...pending.keys()].join(',')], timezone ? { ...env, TZ: timezone, LC_ALL: 'C' } : env, timeoutMs);
          // ps can return 1 for a missing PID while still printing the live subset.
          if (!result.error && (result.code === 0 || result.code === 1)) {
            for (const line of result.stdout.split('\n')) {
              const match = /^\s*(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s*$/.exec(line);
              if (match) identities.set(Number(match[1]), parseStarted(match[2]!)!);
            }
          }
        } catch {
          // Native probe failures provide no identity proof.
        } finally {
          // Remove before waking callers, so their next call always reads afresh.
          for (const [pid, probe] of pending) {
            owned.probes.delete(pid);
            probe.resolve(identities.get(pid) ?? null);
          }
          if (!owned.probes.size) batches.delete(key);
        }
      })();
    });
  }
  return probe.promise;
}

/** `processStarted` without blocking: batch compatible reads, resume each caller separately. */
export async function processStartedAsync(pid: number, timeoutMs = PS_TIMEOUT_MS, resumed: Resumed = work => work(), timezone?: 'UTC', env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const started = await startedProbe(pid, timeoutMs, timezone, env);
  return resumed(() => started);
}

/** This process's own start time, asked once: it never changes. */
let ownStarted: Promise<string | null> | null = null;
let ownUtcStarted: Promise<string | null> | null = null;
let ownSynchronousStarted: string | null = null;

export function readLock(path: string): LockHolder | null {
  try {
    const v = JSON.parse(readFileSync(path, 'utf8')) as Partial<LockHolder>;
    if (typeof v.pid !== 'number') return null;
    return { pid: v.pid, started: typeof v.started === 'string' ? v.started : null, ...(typeof v.startedUtc === 'string' || v.startedUtc === null ? { startedUtc: v.startedUtc } : {}) };
  } catch {
    return null;
  }
}

// `ps` failing for a live pid says nothing either way: keep the lock rather than break a live hub's
export function sameProcess(holder: LockHolder, now: string | null): boolean {
  const expected = holder.startedUtc === undefined ? holder.started : holder.startedUtc;
  if (expected === null || now === null || now === expected) return true;
  if (holder.startedUtc !== undefined) return false;
  // Legacy lstart has no timezone. UTC-12 through UTC+14 can describe the same
  // process 26 hours apart; that ambiguity is never evidence for a destructive sweep.
  const before = Date.parse(`${holder.started} UTC`), current = Date.parse(`${now} UTC`);
  return Number.isFinite(before) && Number.isFinite(current) && Math.abs(before - current) <= 26 * 60 * 60 * 1000;
}

/** The native facts needed to verify synchronous hub-lock ownership. */
export type LockProcessTable = {
  alive: (pid: number) => boolean;
  started: (pid: number, timezone?: 'UTC') => string | null;
};
const nativeProcesses: LockProcessTable = { alive: pidAlive, started: processStarted };

/** Whether the process the lock names is still the one that took it. */
export function holderAlive(holder: LockHolder, processes: LockProcessTable = nativeProcesses): boolean {
  if (!processes.alive(holder.pid)) return false;
  return holder.started === null || sameProcess(holder, processes.started(holder.pid, holder.startedUtc === undefined ? undefined : 'UTC'));
}

/** The live holder of the lock at `path`, or null when nobody (live) holds it. */
export function liveHolder(path: string): LockHolder | null {
  const holder = readLock(path);
  return holder && holderAlive(holder) ? holder : null;
}

/**
 * `liveHolder` without blocking: the start-time probe is `startedOf`, which the caller bounds (`cland doctor` runs
 * `ps` with a deadline and kills its process group when it passes). A probe that cannot say counts as the holder.
 */
export async function liveHolderAsync(path: string, startedOf: (pid: number, timezone?: 'UTC') => Promise<string | null>): Promise<LockHolder | null> {
  const holder = readLock(path);
  if (!holder || !pidAlive(holder.pid)) return null;
  if (holder.started === null) return holder;
  return sameProcess(holder, await startedOf(holder.pid, holder.startedUtc === undefined ? undefined : 'UTC')) ? holder : null;
}

// Creation, stale removal and release all hold the same guard. Its directory is installed nonempty in one
// rename. Recovery removes only the dead owner's unique filename, then rmdir (which preserves a successor's
// nonempty directory). This avoids check/unlink races, including two recoverers and an empty-directory rename.
type RecordSnapshot = { exists: boolean; holder: LockHolder | null };
const parseHolder = (text: string): LockHolder | null => {
  try {
    const v = JSON.parse(text) as Partial<LockHolder>;
    if (typeof v.pid !== 'number') return null;
    return { pid: v.pid, started: typeof v.started === 'string' ? v.started : null, ...(typeof v.startedUtc === 'string' || v.startedUtc === null ? { startedUtc: v.startedUtc } : {}), ...(typeof v.token === 'string' ? { token: v.token } : {}) };
  } catch { return null; } // malformed bytes are distinct from a failed filesystem read
};
const absent = (err: unknown) => (err as NodeJS.ErrnoException).code === 'ENOENT';
const occupied = (err: unknown) => ['EEXIST', 'ENOTEMPTY'].includes((err as NodeJS.ErrnoException).code ?? '');
const sameHolder = (a: LockHolder | null, b: LockHolder) => a?.pid === b.pid && a.started === b.started && a.startedUtc === b.startedUtc && a.token === b.token;

function recordSync(path: string): RecordSnapshot {
  try { return { exists: true, holder: parseHolder(readFileSync(path, 'utf8')) }; }
  catch (err) { if (absent(err)) return { exists: false, holder: null }; throw err; }
}
async function recordAsync(path: string, resumed: Resumed): Promise<RecordSnapshot> {
  try {
    const text = await fs.readFile(path, 'utf8');
    return resumed(() => ({ exists: true, holder: parseHolder(text) }));
  } catch (err) { return resumed(() => { if (absent(err)) return { exists: false, holder: null }; throw err; }); }
}

function emptyGuardSync(path: string): void {
  try { rmdirSync(path); } catch (err) { if (!absent(err) && !occupied(err)) throw err; }
}
async function emptyGuardAsync(path: string, resumed: Resumed): Promise<void> {
  try { await fs.rmdir(path); }
  catch (err) { resumed(() => { if (!absent(err) && !occupied(err)) throw err; }); }
}

function recoverGuardSync(path: string, processes: LockProcessTable): void {
  let names: string[];
  try {
    if (!lstatSync(path).isDirectory()) throw new Error(`lock guard ${path} is not a directory; preserve it and remove it after its owner stops`);
    names = readdirSync(path);
  } catch (err) { if (absent(err)) return; throw err; }
  for (const name of names) {
    if (!/^[a-f0-9-]+\.owner$/.test(name)) throw new Error(`invalid lock guard ${path}`);
    const record = recordSync(`${path}/${name}`);
    if (!record.exists) continue;
    if (!record.holder) throw new Error(`unreadable lock guard owner ${path}/${name}`);
    if (holderAlive(record.holder, processes)) return;
    rmSync(`${path}/${name}`, { force: true });
  }
  emptyGuardSync(path);
}
async function recoverGuardAsync(path: string, resumed: Resumed, deadline?: number): Promise<void> {
  let names: string[];
  try {
    const stat = await fs.lstat(path);
    resumed(() => { if (!stat.isDirectory()) throw new Error(`lock guard ${path} is not a directory; preserve it and remove it after its owner stops`); });
    names = await fs.readdir(path);
  } catch (err) { if (resumed(() => absent(err))) return; throw err; }
  for (const name of names) {
    resumed(() => { if (!/^[a-f0-9-]+\.owner$/.test(name)) throw new Error(`invalid lock guard ${path}`); });
    const record = await recordAsync(`${path}/${name}`, resumed);
    if (!record.exists) continue;
    const holder = resumed(() => {
      if (!record.holder) throw new Error(`unreadable lock guard owner ${path}/${name}`);
      return record.holder;
    });
    if (resumed(() => pidAlive(holder.pid))) {
      const now = holder.started === null ? null : await processStartedAsync(holder.pid, lockTimeout(deadline), resumed, holder.startedUtc === undefined ? undefined : 'UTC');
      if (resumed(() => sameProcess(holder, now))) return;
    }
    await fs.rm(`${path}/${name}`, { force: true });
  }
  await emptyGuardAsync(path, resumed);
}

function takeGuardSync(path: string, me: LockHolder, processes: LockProcessTable): (() => void) | null {
  const name = `${randomUUID()}.owner`;
  const tmp = `${path}.${name}.tmp`;
  mkdirSync(tmp, { mode: 0o700 });
  return withCleanup(() => {
    writeFileSync(`${tmp}/${name}`, JSON.stringify(me), { mode: 0o600, flag: 'wx' });
    try { renameSync(tmp, path); }
    catch (err) { if (!occupied(err)) throw err; recoverGuardSync(path, processes); return null; }
    return () => { rmSync(`${path}/${name}`, { force: true }); emptyGuardSync(path); };
  }, () => rmSync(tmp, { recursive: true, force: true }));
}
async function takeGuardAsync(path: string, me: LockHolder, resumed: Resumed, deadline?: number): Promise<(() => Promise<void>) | null> {
  const name = `${randomUUID()}.owner`;
  const tmp = `${path}.${name}.tmp`;
  await fs.mkdir(tmp, { mode: 0o700 });
  return withCleanupAsync(async () => {
    await fs.writeFile(`${tmp}/${name}`, JSON.stringify(me), { mode: 0o600, flag: 'wx' });
    try { await fs.rename(tmp, path); }
    catch (err) {
      resumed(() => { if (!occupied(err)) throw err; });
      await recoverGuardAsync(path, resumed, deadline);
      return null;
    }
    return resumed(() => async () => { await fs.rm(`${path}/${name}`, { force: true }); await emptyGuardAsync(path, resumed); });
  }, () => fs.rm(tmp, { recursive: true, force: true }), resumed);
}

/** Create a whole main lock, exclusively, while the guard is held. */
function createExclusive(path: string, text: string): boolean {
  const tmp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600, flag: 'wx' });
  return withCleanup(() => {
    try { linkSync(tmp, path); return true; }
    catch (err) { if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false; throw err; }
  }, () => rmSync(tmp, { force: true }));
}
async function createExclusiveAsync(path: string, text: string, resumed: Resumed): Promise<boolean> {
  const tmp = `${path}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, text, { mode: 0o600, flag: 'wx' });
  return withCleanupAsync(async () => {
    try { await fs.link(tmp, path); return resumed(() => true); }
    catch (err) { return resumed(() => { if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false; throw err; }); }
  }, () => fs.rm(tmp, { force: true }), resumed);
}

export class HubLocked extends Error {
  readonly holder: LockHolder;
  constructor(holder: LockHolder) { super(`another hub holds the project's lock (pid ${holder.pid})`); this.holder = holder; }
}
export type HubLock = { holder: LockHolder; release: () => void };
export type AsyncHubLock = { holder: LockHolder; release: () => Promise<void> };
const pauseSync = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
const pauseAsync = () => new Promise(resolve => setTimeout(resolve, 20));

export function acquireLock(path: string, processes: LockProcessTable = nativeProcesses): HubLock {
  // Only this process's own lock identity is immutable while it lives. Null is
  // retried; processStarted and every inspection of another PID remain fresh.
  const started = processes === nativeProcesses ? (ownSynchronousStarted ??= processStarted(process.pid)) : processes.started(process.pid);
  const me = { pid: process.pid, started, token: randomUUID() };
  const text = `${JSON.stringify(me)}\n`;
  const guarded = <T>(work: () => T): T => {
    for (let attempt = 0; attempt < 250; attempt++) {
      const release = takeGuardSync(`${path}.break`, me, processes);
      if (!release) { pauseSync(); continue; }
      return withCleanup(work, release);
    }
    throw new Error(`could not take guard for ${path}`);
  };
  for (let attempt = 0; attempt < 50; attempt++) {
    const acquired = guarded(() => {
      if (createExclusive(path, text)) return true;
      const record = recordSync(path);
      if (!record.exists) return false; // absent means retry creation, never unlink
      if (record.holder && holderAlive(record.holder, processes)) throw new HubLocked(record.holder);
      rmSync(path, { force: true }); // creators and releasers are excluded until this guard is released
      return false;
    });
    if (acquired) return { holder: me, release: () => {
      // Shutdown and repeated release must not create a guard for an absent lock or directory.
      if (!sameHolder(recordSync(path).holder, me)) return;
      try { guarded(() => { if (sameHolder(recordSync(path).holder, me)) rmSync(path, { force: true }); }); }
      catch (err) {
        // The directory may disappear after the ownership check, before guard creation.
        if (absent(err) && !recordSync(path).exists) return;
        throw err;
      }
    } };
  }
  throw new Error(`could not take ${path}: it keeps changing under this process`);
}

class LockAcquisitionTimeout extends Error {}

function lockTimeout(deadline?: number): number {
  const ms = deadline === undefined ? PS_TIMEOUT_MS : deadline - Date.now();
  if (ms <= 0) throw new LockAcquisitionTimeout('lock acquisition deadline reached');
  return Math.min(PS_TIMEOUT_MS, ms);
}

export async function acquireLockAsync(path: string, resumed: Resumed = work => work(), deadline?: number, timezone?: 'UTC'): Promise<AsyncHubLock> {
  lockTimeout(deadline);
  ownStarted ??= processStartedAsync(process.pid, lockTimeout(deadline));
  const started = await ownStarted;
  const startedUtc = timezone ? await (ownUtcStarted ??= processStartedAsync(process.pid, lockTimeout(deadline), undefined, timezone)) : undefined;
  const { me, text } = resumed(() => {
    const me = { pid: process.pid, started, ...(startedUtc !== undefined ? { startedUtc } : {}), token: randomUUID() };
    return { me, text: `${JSON.stringify(me)}\n` };
  });
  const guarded = async <T>(work: () => Promise<T>, limit?: number): Promise<T> => {
    for (let attempt = 0; attempt < 250; attempt++) {
      lockTimeout(limit);
      const release = await takeGuardAsync(`${path}.break`, me, resumed, limit);
      if (!release) { await pauseAsync(); continue; }
      return withCleanupAsync(work, release, resumed);
    }
    return resumed(() => { throw new LockAcquisitionTimeout(`could not take guard for ${path}`); });
  };
  for (let attempt = 0; attempt < 50; attempt++) {
    lockTimeout(deadline);
    const acquired = await guarded(async () => {
      if (await createExclusiveAsync(path, text, resumed)) return true;
      const record = await recordAsync(path, resumed);
      if (!record.exists) return false;
      if (record.holder && resumed(() => pidAlive(record.holder!.pid))) {
        const holder = record.holder;
        const now = holder.started === null ? null : await processStartedAsync(holder.pid, lockTimeout(deadline), resumed, holder.startedUtc === undefined ? undefined : 'UTC');
        resumed(() => { if (sameProcess(holder, now)) throw new HubLocked(holder); });
      }
      await fs.rm(path, { force: true });
      return false;
    }, deadline);
    if (acquired) return resumed(() => ({ holder: me, release: async () => {
      const record = await recordAsync(path, resumed);
      if (!resumed(() => sameHolder(record.holder, me))) return;
      try {
        await guarded(async () => {
          const current = await recordAsync(path, resumed);
          if (resumed(() => sameHolder(current.holder, me))) await fs.rm(path, { force: true });
        }, deadline === undefined ? undefined : Date.now() + 2000);
      } catch (err) {
        if (resumed(() => absent(err))) {
          const current = await recordAsync(path, resumed);
          if (resumed(() => !current.exists)) return;
        }
        resumed(() => { throw err; });
      }
    } }));
  }
  return resumed(() => { throw new Error(`could not take ${path}: it keeps changing under this process`); });
}

/** Wait through transient executor contention, without changing the hub lock's fail-fast contract. */
export type LockRetryTiming = { clock?: Clock; wait?: ((ms: number) => Promise<void>) | undefined };
export async function acquireLockWithRetry(path: string, deadline?: number, timing: LockRetryTiming = {}): Promise<AsyncHubLock> {
  const clock = timing.clock ?? realClock;
  const started = clock.now().getTime();
  deadline ??= started + 60000;
  const limit = Math.min(deadline, started + 60000);
  let backoff = 25;
  let last: unknown;
  while (clock.now().getTime() < limit) {
    // OS identity probes retain native deadlines; only contention/backoff uses hub time.
    try { return await acquireLockAsync(path, undefined, Date.now() + Math.min(15000, limit - clock.now().getTime()), 'UTC'); }
    catch (error) {
      // Cleanup failures keep their primary error type; they are not safe contention.
      if (!(error instanceof HubLocked || error instanceof LockAcquisitionTimeout) || error.message.includes('; cleanup failed:')) throw error;
      last = error;
    }
    const remaining = limit - clock.now().getTime();
    if (remaining <= 0) break;
    const ms = Math.min(backoff, remaining);
    await (timing.wait?.(ms) ?? new Promise<void>(resolve => clock.setTimeout(resolve, ms)));
    backoff = Math.min(backoff * 2, 1000);
  }
  throw new Error(`lock ${path}: acquisition deadline reached after waiting ${clock.now().getTime() - started} ms`, { cause: last });
}
