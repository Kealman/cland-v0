// Shared compatibility lease for hand runners and hub-admitted verification workers.
import { type Stats, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { link, mkdir, readFile, realpath, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { acquireLockAsync, processStartedAsync, HubLocked } from './hub/lock.ts';
import { pidAlive } from './project.ts';
import { run } from './doctor/report.ts';
import { fileURLToPath } from 'node:url';
import type { ProcessIdentity } from '../test/process-cleanup.ts';
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export type Holder = { pid: number; started: string | null; since: string; token: string; root?: string; worktree?: string; queued?: string; phase?: number; device?: number; inode?: number; runner?: ProcessIdentity };
export type Lease = { publish: () => Promise<void>; release: () => Promise<void> };
const RECOVERY_GRACE_MS = 1000;
async function holderAt(path: string): Promise<Holder | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (typeof value === 'object' && value !== null && 'pid' in value && 'token' in value && Number.isInteger(value.pid) && Number(value.pid) > 0 && typeof value.token === 'string') {
      const parsed = value as Partial<Holder>;
      return { ...parsed, pid: Number(value.pid), started: typeof parsed.started === 'string' ? parsed.started : null, since: parsed.since ?? parsed.started ?? 'unknown', token: value.token };
    }
  } catch { /* no complete ownership record */ }
  return null;
}
const readableStart = (started: string | null): boolean => started !== null && /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(started);
// Old runners stored an invocation ISO timestamp, not ps identity. Keep live unknowns held.
function remaining(deadline?: number): number {
  const ms = deadline === undefined ? 3000 : deadline - Date.now();
  if (ms <= 0) throw new Error('compatibility inspection deadline reached; ownership preserved');
  return Math.min(3000, ms);
}
async function liveHolder(holder: Holder, deadline?: number): Promise<boolean> {
  if (!pidAlive(holder.pid)) return false;
  if (!readableStart(holder.started)) return true;
  const now = await processStartedAsync(holder.pid, remaining(deadline));
  return now === null || now === holder.started;
}

async function publish(path: string, holder: Holder, exclusive = false): Promise<void> {
  const staging = `${path}.${holder.token}`;
  await writeFile(staging, JSON.stringify(holder), { mode: 0o600 });
  try { if (exclusive) await link(staging, path); else await rename(staging, path); }
  finally { await rm(staging, { force: true }); }
}
export async function sweep(holder: Holder): Promise<void> {
  // Worker-local process discovery; the daemon runs this in a bounded subprocess.
  const { captureRunProcesses, cleanupProcesses } = await import('../test/process-cleanup.ts');
  const ownedRoot = async () => {
    if (!holder.root) return undefined;
    const info = await stat(holder.root).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    const plannedRoot = join(await realpath('/tmp'), `cland-suite-${holder.token}${holder.phase === undefined ? '' : `-${holder.phase}`}`);
    const identityMatches = holder.device === undefined && holder.inode === undefined ? holder.root === plannedRoot : info?.dev === holder.device && info?.ino === holder.inode;
    if (info && !identityMatches) throw new Error('suite root identity changed; refusing cleanup');
    return info ? holder.root : undefined;
  };
  // The run marker is unique per invocation, including workers whose cwd is the repository.
  for (let n = 0; n < 10; n++) {
    const anchors = holder.runner ? [holder.runner] : [];
    const count = await cleanupProcesses(await ownedRoot(), [...captureRunProcesses(holder.token), ...anchors], line => process.stderr.write(`${line}\n`), holder.token, anchors);
    if (count === 0) break;
    if (n === 9) throw new Error('old suite still owns live processes; refusing to start another suite');
  }
  const root = await ownedRoot();
  if (root) await rm(root, { recursive: true, force: true });
}

async function liveTickets(queueDir: string, deadline?: number): Promise<Array<Holder & { queued: string }>> {
  const tickets: Array<Holder & { queued: string }> = [];
  for (const name of await readdir(queueDir)) {
    if (!name.endsWith('.json')) continue;
    const path = join(queueDir, name);
    const waiting = await holderAt(path);
    if (!waiting && !await stat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; })) continue;
    if (!waiting || typeof waiting.queued !== 'string' || !/^\d+$/.test(waiting.queued)) throw new Error(`invalid suite ticket ${path}`);
    if (!await liveHolder(waiting, deadline)) await rm(path, { force: true });
    else tickets.push({ ...waiting, queued: waiting.queued });
  }
  return tickets.sort((a, b) => BigInt(a.queued) < BigInt(b.queued) ? -1 : BigInt(a.queued) > BigInt(b.queued) ? 1 : a.token.localeCompare(b.token));
}

// Call only while holding every recovery guard. A blocked lock remains owned through cleanup.
async function inspectLocks(dirs: string[], deadline?: number, recover = sweep): Promise<{ previous: Holder | null; info: Stats | null; blockedDir: string | null }> {
  for (const dir of dirs) {
    const ownerPath = `${dir}.owner`;
    const info = await stat(dir).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    const holder = await holderAt(ownerPath) ?? await holderAt(join(dir, 'holder.json'));
    if (holder && !await liveHolder(holder, deadline)) {
      const owner = await stat(ownerPath).catch(() => null);
      if (Date.now() - (owner?.mtimeMs ?? info?.mtimeMs ?? 0) >= RECOVERY_GRACE_MS) {
        await recover(holder);
        await rm(dir, { recursive: true, force: true });
        await rm(ownerPath, { force: true });
        await rm(`${ownerPath}.${holder.token}`, { force: true });
        process.stderr.write(`taking over stale suite lock held by pid ${holder.pid}\n`);
        continue;
      }
    }
    if (info || holder) return { previous: holder, info, blockedDir: dir };
  }
  return { previous: null, info: null, blockedDir: null };
}

export async function acquire(dirs: string[], interrupted: () => boolean, holder: Holder): Promise<Lease[]> {
  const primary = dirs[0];
  if (!primary) return [];
  // Registration never waits for a polled guard. Publish a whole ticket before
  // the first admission attempt, retaining its order through guard contention.
  // The persistent queue survives release/recovery of the ownership directories.
  const queueDir = `${primary}.queue`;
  const ticketPath = join(queueDir, `${holder.token}.json`);
  const ticket = { ...holder, queued: process.hrtime.bigint().toString() };
  mkdirSync(queueDir, { recursive: true, mode: 0o700 });
  const staging = `${ticketPath}.${holder.token}`;
  try {
    writeFileSync(staging, JSON.stringify(ticket), { mode: 0o600 });
    renameSync(staging, ticketPath);
  } finally { rmSync(staging, { force: true }); }
  let position = 1; let total = 1;
  let last = ''; let lastQueue = ''; let lastPrinted = 0;
  try {
    while (!interrupted()) {
      const guards: Awaited<ReturnType<typeof acquireLockAsync>>[] = [];
      let previous: Holder | null = null;
      let info: Stats | null = null;
      let blockedDir = primary;
      try {
        // Hold every recovery guard while inspecting/admitting the phase. Legacy
        // runners release these guards before waiting on the next lock, so this
        // cannot form a cycle with their Neovim-first acquisition order.
        for (const dir of dirs) guards.push(await acquireLockAsync(`${dir}.reaper`));
        const tickets = await liveTickets(queueDir);
        position = tickets.findIndex(waiting => waiting.token === holder.token) + 1;
        total = tickets.length;
        if (!position) throw new Error('suite ticket disappeared while waiting');
        const inspected = await inspectLocks(dirs);
        previous = inspected.previous; info = inspected.info;
        blockedDir = inspected.blockedDir ?? primary;
        const blocked = inspected.blockedDir !== null;
        if (!blocked && position === 1 && !interrupted()) {
          const leases: Lease[] = [];
          const installed: Array<{ dir: string; created: boolean }> = [];
          try {
            for (const dir of dirs) {
              const ownerPath = `${dir}.owner`;
              const metadataPath = join(dir, 'holder.json');
              // Publish identity before mkdir, covering death in the metadata gap.
              await publish(ownerPath, holder, true);
              const pending = { dir, created: false };
              installed.push(pending);
              await mkdir(dir);
              pending.created = true;
              await publish(metadataPath, holder);
              leases.push({
                publish: async () => {
                  await publish(ownerPath, holder);
                  await publish(metadataPath, holder);
                },
                release: async () => {
                  if ((await holderAt(ownerPath))?.token !== holder.token) return;
                  await rm(dir, { recursive: true, force: true });
                  await rm(ownerPath, { force: true });
                },
              });
            }
            await rm(ticketPath, { force: true });
            return leases;
          } catch (error) {
            // Roll back only what this attempt installed; preserve a manual mkdir
            // that raced publication, and leave all waiter tickets intact.
            for (const { dir, created } of installed.reverse()) {
              if ((await holderAt(`${dir}.owner`))?.token !== holder.token) continue;
              if (created) await rm(dir, { recursive: true, force: true });
              await rm(`${dir}.owner`, { force: true });
            }
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            continue;
          }
        }
      } catch (error) {
        const contended = error instanceof Error && dirs.some(dir => error.message === `could not take ${dir}.reaper: it keeps changing under this process`);
        if (!(error instanceof HubLocked) && !contended && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const tickets = await liveTickets(queueDir);
        position = tickets.findIndex(waiting => waiting.token === holder.token) + 1;
        total = tickets.length;
        for (const dir of dirs) {
          previous = await holderAt(`${dir}.owner`) ?? await holderAt(join(dir, 'holder.json'));
          info = await stat(dir).catch(() => null);
          blockedDir = dir;
          if (previous || info) break;
        }
      } finally { for (const guard of guards.reverse()) await guard.release(); }
      const age = Math.max(0, Date.now() - (info?.mtimeMs ?? Date.now()));
      const line = previous ? `waiting for the suite lock held by pid ${previous.pid} since ${previous.since ?? previous.started}${readableStart(previous.started) ? '' : ' (holder from an older version; process start time unavailable)'}` :
        !info ? 'waiting for the suite lock; an earlier live ticket has admission priority' :
        `waiting for the suite lock; age ${Math.floor(age / 1000)}s; no owner recorded (a manual lock); if no suite is running, remove it with \`rmdir ${blockedDir}\``;
      const queue = `${position}/${total}`;
      const message = `${line}; queue position ${queue}; holder worktree ${previous?.worktree ?? 'unavailable'}`;
      if ((message !== last && previous !== null) || queue !== lastQueue || Date.now() - lastPrinted >= 60_000 || !lastPrinted) {
        process.stderr.write(`${message}\n`); last = message; lastQueue = queue; lastPrinted = Date.now();
        if (!previous && info && age >= 15 * 60_000) process.stderr.write('WARNING: ownerless manual suite lock is over 15 minutes old and cannot recover automatically; verify no suite is running before removing it.\n');
      }
      await pause(250);
    }
    throw new Error('suite interrupted while waiting for the lock');
  } finally { await rm(ticketPath, { force: true }); }
}


/** Inspect under the same guards used by hand runners; stale owners are swept before admission. */
export async function compatibilityOccupied(dirs: string[]): Promise<boolean> {
  const deadline = Date.now() + 5000;
  const recover = async (holder: Holder) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = await run(process.execPath, [fileURLToPath(new URL('./suite-recovery.ts', import.meta.url)), JSON.stringify(holder)], env, Math.max(1, deadline - Date.now()));
    if (result.code !== 0 || result.error) throw new Error(`compatibility recovery failed; ownership preserved: ${result.error ?? result.stderr.trim()}`);
  };
  const guards: Awaited<ReturnType<typeof acquireLockAsync>>[] = [];
  try {
    for (const dir of dirs) guards.push(await acquireLockAsync(`${dir}.reaper`, work => work(), deadline));
    if ((await inspectLocks(dirs, deadline, recover)).blockedDir !== null) return true;
    const queue = `${dirs[0]}.queue`;
    return existsSync(queue) && (await liveTickets(queue, deadline)).length > 0;
  } catch (error) { if (error instanceof HubLocked) return true; throw error; }
  finally { for (const guard of guards.reverse()) await guard.release(); }
}

export type InheritedLease = { dirs: string[]; pid: number; started: string; token: string };
export function inheritedLease(): InheritedLease | null {
  if (!process.env.CLAND_SUITE_LEASE) return null;
  const value = JSON.parse(process.env.CLAND_SUITE_LEASE) as InheritedLease;
  if (!Array.isArray(value.dirs) || !value.dirs.every(d => typeof d === 'string') || !Number.isSafeInteger(value.pid) || value.pid <= 0 || typeof value.started !== 'string' || typeof value.token !== 'string') throw new Error('invalid inherited suite lease');
  return value;
}
/** A package runner borrows only the positively verified worker lease, retaining recovery metadata. */
export async function borrowLease(dirs: string[], holder: Holder): Promise<Lease[] | null> {
  const inherited = inheritedLease();
  if (!inherited || JSON.stringify(dirs) !== JSON.stringify(inherited.dirs)) return null;
  for (const dir of dirs) {
    const owner = await holderAt(`${dir}.owner`);
    if (!owner || owner.pid !== inherited.pid || owner.started !== inherited.started || owner.token !== inherited.token || !await liveHolder(owner)) throw new Error('inherited suite lease is no longer held');
  }
  holder.pid = inherited.pid; holder.started = inherited.started; holder.token = inherited.token;
  holder.root = join(await realpath('/tmp'), `cland-suite-${holder.token}`);
  const leases = dirs.map(dir => ({ publish: async () => {
    await publish(`${dir}.owner`, holder);
    await publish(join(dir, 'holder.json'), holder);
  }, release: async () => {} }));
  // Match standalone acquisition: durable planned ownership precedes the first mkdir.
  for (const lease of leases) await lease.publish();
  return leases;
}

/** Preserve exclusion until detached package processes and their owned root are gone. */
export async function sweepLease(dirs: string[], token: string): Promise<void> {
  for (const dir of dirs) {
    const holder = await holderAt(`${dir}.owner`);
    if (holder?.token === token) { await sweep(holder); return; }
  }
}
