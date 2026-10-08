// The project's hub lock, `.cland/hub.lock`: whoever holds it is the project's one hub. Taken before the
// hub prepares anything (the secret, the store, the sockets) and released last, so two starts at the same
// instant cannot both get past it, and a replacement cannot bind while the old hub is still shutting down.
//
// The file is created whole or not at all (written aside, then hard-linked into place, which fails when
// the name exists) and holds the holder's pid and its process start time. A lock whose pid is gone, or
// whose pid now belongs to a process started at another time (the pid was reused), is stale and broken.
// Breaking is itself guarded (`hub.lock.break`, created the same way), so two starters that both found the
// same stale lock cannot each remove what the other just created.
import { spawnSync } from 'node:child_process';
import { linkSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { pidAlive } from '../project.ts';

export type LockHolder = {
  pid: number;
  /** The holder's process start time as `ps -o lstart=` prints it; null when `ps` could not tell. */
  started: string | null;
};

/** A breaker that crashed mid-break leaves its guard behind; past this age the guard is ignored. */
const BREAK_GUARD_STALE_MS = 10_000;

/** The start time of a live process, as `ps` prints it; null when it is gone or `ps` cannot say. */
export function processStarted(pid: number): string | null {
  const r = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const s = r.stdout.trim().replace(/\s+/g, ' ');
  return s || null;
}

export function readLock(path: string): LockHolder | null {
  try {
    const v = JSON.parse(readFileSync(path, 'utf8')) as Partial<LockHolder>;
    if (typeof v.pid !== 'number') return null;
    return { pid: v.pid, started: typeof v.started === 'string' ? v.started : null };
  } catch {
    return null;
  }
}

/** Whether the process the lock names is still the one that took it. */
export function holderAlive(holder: LockHolder): boolean {
  if (!pidAlive(holder.pid)) return false;
  if (holder.started === null) return true;
  const now = processStarted(holder.pid);
  // `ps` failing for a live pid says nothing either way: keep the lock rather than break a live hub's
  return now === null || now === holder.started;
}

/** The live holder of the lock at `path`, or null when nobody (live) holds it. */
export function liveHolder(path: string): LockHolder | null {
  const holder = readLock(path);
  return holder && holderAlive(holder) ? holder : null;
}

/** Create `path` with `text`, whole, only if it does not exist yet; false when it does. */
function createExclusive(path: string, text: string): boolean {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600 });
  try {
    linkSync(tmp, path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw err;
  } finally {
    rmSync(tmp, { force: true });
  }
}

export class HubLocked extends Error {
  readonly holder: LockHolder;
  constructor(holder: LockHolder) {
    super(`another hub holds the project's lock (pid ${holder.pid})`);
    this.holder = holder;
  }
}

export type HubLock = { holder: LockHolder; release: () => void };

/**
 * Take the lock for this process, breaking a stale one; throws HubLocked when a live process holds it.
 */
export function acquireLock(path: string): HubLock {
  const me: LockHolder = { pid: process.pid, started: processStarted(process.pid) };
  const text = `${JSON.stringify(me)}\n`;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (createExclusive(path, text)) {
      return {
        holder: me,
        // only our own lock is ever removed: a successor's is left alone
        release: () => {
          if (readLock(path)?.pid === me.pid) rmSync(path, { force: true });
        },
      };
    }
    const holder = readLock(path);
    if (holder === null) {
      // linked whole, so an unreadable lock is not one being written: it is junk, and broken like a stale one
      breakStale(path, null);
      continue;
    }
    if (holderAlive(holder)) throw new HubLocked(holder);
    breakStale(path, holder);
  }
  throw new Error(`could not take ${path}: it keeps changing under this process`);
}

/** Remove the lock at `path` if it is still `stale` (null: still unreadable), under the break guard. */
function breakStale(path: string, stale: LockHolder | null): void {
  const guard = `${path}.break`;
  if (!createExclusive(guard, `${process.pid}\n`)) {
    try {
      if (Date.now() - statSync(guard).mtimeMs > BREAK_GUARD_STALE_MS) rmSync(guard, { force: true });
    } catch {
      /* the other breaker finished */
    }
    // another starter is breaking it: let it, then look again
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    return;
  }
  try {
    const now = readLock(path);
    const same = stale === null ? now === null : now !== null && now.pid === stale.pid && now.started === stale.started;
    if (same) rmSync(path, { force: true });
  } finally {
    rmSync(guard, { force: true });
  }
}
