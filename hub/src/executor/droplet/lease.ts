import { realClock, type Clock } from '../../hub/clock.ts';
import { createHash, randomUUID } from 'node:crypto';
import { open, mkdir, opendir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, relative, sep } from 'node:path';
import type { Droplet } from './api.ts';
import type { Lease } from '../executor.ts';
import type { LogFn } from '../../log.ts';

export type ReleaseAttention = {
  reason?: 'deletion-timeout' | 'deletion-unconfirmed';
  fields: Array<'id' | 'name' | 'tags'>;
  expected: { id?: number | null; name: string; tags: string[] };
  observed: { id?: number; name: string; tags: string[]; status: string };
};

export type DeletionTracking = { droplets: { id: number; started?: string }[]; keys: number[] };

export type DropletLease = Lease & {
  kind: 'droplet'; provider: 'digitalocean'; lease: string; name: string;
  tags: string[]; size: string; region: string; priceHourly: number; keyName: string;
  state: 'creating' | 'active' | 'releasing' | 'released';
  resource: number | null; keyId: number | null; address?: string;
  keyImportStarted?: string; keyImportFinished?: string;
  createStarted?: string; createFinished?: string; deleteStarted?: string; released?: string;
  lifetimeMs?: number; costUsd?: number; watchdogFired?: string;
  attention?: ReleaseAttention;
  deletions?: DeletionTracking;
  snapshot?: import('./prepare.ts').Snapshot;
  demo?: { epic: string; commit: string; ready?: boolean; commands?: import('../../verification-commands.ts').VerificationCommands };
  execution?: { head: string; delivered?: boolean; deliveryLogEnd?: number; started?: boolean; startedAt?: string; unreachableSince?: string };
  watchdog?: { pid: number; startedUtc: string; pidIdentity?: string };
};
export type WatchdogReceipt = { fired: string; deleted: number[]; confirmedAt: string; deleteStarted: string };

export async function durableJson(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.${randomUUID()}.tmp`;
  const file = await open(tmp, 'wx', 0o600);
  try { await file.writeFile(`${JSON.stringify(value)}\n`); await file.sync(); }
  finally { await file.close(); }
  try {
    await rename(tmp, path);
    const parent = await open(dirname(path), 'r');
    try { await parent.sync(); } finally { await parent.close(); }
  } finally { await rm(tmp, { force: true }); }
}
export const leaseRoot = (root: string): string => join(root, '.cland/run/executor/leases');
export const leaseDir = (root: string, lease: DropletLease): string => join(leaseRoot(root), lease.lease);
const indexPath = (root: string) => join(leaseRoot(root), '..', 'lease-index.json');
type LeaseIndex = { version: 1; leases: string[] };
/** Both first-publication owners share count and unchanged-write semantics. */
async function publishIndex(root: string, previous: LeaseIndex | null, leases: string[], read: number, log?: LogFn): Promise<void> {
  if (previous ? leases.length === previous.leases.length && leases.every((id, i) => id === previous.leases[i]) : read === 0) return;
  await durableJson(indexPath(root), { version: 1, leases });
  if (!previous) {
    try { log?.({ event: 'executor-lease-index-migrated', read, indexed: leases.length, settled: read - leases.length }); }
    catch {
      // Diagnostics cannot interrupt the remaining lease publication or replace
      // a status receipt. Offer one secondary notice; a broken sink stays ancillary.
      try { log?.({ event: 'executor-lease-index-log-failed', cause: 'sink-threw' }); }
      catch { /* No diagnostic delivery is claimed when both attempts fail. */ }
    }
  }
}
const validLeaseId = (id: unknown): id is string => typeof id === 'string' && Boolean(id) && id !== '.' && id !== '..' && !/[\\/]/.test(id);
async function readIndex(root: string): Promise<LeaseIndex | null> {
  try {
    const value = JSON.parse(await readFile(indexPath(root), 'utf8'));
    if (!value || value.version !== 1 || !Array.isArray(value.leases) || !value.leases.every(validLeaseId)) throw new Error('invalid executor lease index');
    return { version: 1, leases: value.leases };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
async function directoryIds(root: string): Promise<string[]> {
  try { return (await readdir(leaseRoot(root), { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
/** History is retained for explicit audit and direct recovery lookups only. */
export async function readLeaseHistory(root: string): Promise<DropletLease[]> {
  return readIds(root, await directoryIds(root));
}
const demoRoot = (root: string) => join(leaseRoot(root), '..', 'demo-leases');
const reportRoot = (root: string) => join(leaseRoot(root), '..', 'demo-reports');
const demoPath = (root: string, epic: string) => join(demoRoot(root), `${createHash('sha256').update(epic).digest('hex')}.json`);
async function pointer(path: string): Promise<{ lease: string; epic?: string; created: string } | null> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    if (!validLeaseId(value.lease) || !Number.isFinite(Date.parse(value.created))) throw new Error('invalid cold demo pointer');
    return value;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
async function archiveDemo(root: string, lease: DropletLease): Promise<void> {
  if (!lease.demo) return;
  const path = demoPath(root, lease.demo.epic), old = await pointer(path);
  if (!old || `${lease.created}/${lease.lease}` > `${old.created}/${old.lease}`) await durableJson(path, { lease: lease.lease, created: lease.created, epic: lease.demo.epic });
  try {
    const reported = JSON.parse(await readFile(join(leaseDir(root, lease), 'demo-reported.json'), 'utf8'));
    if (reported.lease !== lease.lease) throw new Error('demo report receipt identity mismatch');
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const pendingPath = join(reportRoot(root), `${lease.lease}.json`), pending = await pointer(pendingPath);
    if (pending && (pending.lease !== lease.lease || pending.created !== lease.created)) throw new Error('demo report identity mismatch');
    if (!pending) await durableJson(pendingPath, { lease: lease.lease, created: lease.created });
  }
}
/** Positive tracker reporting precedes this checkpoint and queue removal. */
export async function acknowledgeDemoReport(root: string, lease: DropletLease): Promise<void> {
  await durableJson(join(leaseDir(root, lease), 'demo-reported.json'), { lease: lease.lease });
  await rm(join(reportRoot(root), `${lease.lease}.json`), { force: true });
}
/** Status reads one cold epic pointer. Background recovery drains at most 32
 * pending report receipts per call, never enumerating historical epics. */
export async function readDemoLeases(root: string, epic?: string): Promise<DropletLease[]> {
  const index = await readIndex(root);
  if (!index) return (await readLeaseHistory(root)).filter(l => l.demo && (epic === undefined || l.demo.epic === epic));
  const latest: string[] = [];
  if (epic !== undefined) {
    const value = await pointer(demoPath(root, epic));
    if (value && value.epic !== epic) throw new Error('cold demo identity mismatch');
    if (value) latest.push(value.lease);
  } else {
    try {
      let visited = 0;
      for await (const entry of await opendir(reportRoot(root))) {
        if (!entry.isFile()) throw new Error('invalid demo report queue entry');
        const value = await pointer(join(reportRoot(root), entry.name));
        if (value && entry.name !== `${value.lease}.json`) throw new Error('demo report queue identity mismatch');
        if (value) latest.push(value.lease);
        if (++visited >= 32) break;
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return (await readIds(root, [...new Set([...index.leases, ...latest])])).filter(l => l.demo && (epic === undefined || l.demo.epic === epic));
}
async function readIds(root: string, ids: string[], requireFiles = false): Promise<DropletLease[]> {
  const leases: DropletLease[] = [];
  for (const id of ids) {
    try { leases.push(await readLease(join(leaseRoot(root), id))); }
    catch (error) { if (requireFiles || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return leases;
}
/** Serialized with writers. A crash before publication leaves the old,
 * conservative index. Startup repair includes files from older writers. */
export type LeaseCompaction = { status: 'compacted' } | { status: 'stopped'; reason: 'run-directory-missing' };
/** Each mkdir owns one level only; no check-then-recursive-mkdir race. */
async function ownDirectory(path: string): Promise<void> {
  try { await mkdir(path, { mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
}
/** Create owned child levels only; the hub owns the existing run anchor. */
export async function runDirectory(root: string, path: string): Promise<void> {
  const anchor = resolve(root, '.cland/run');
  const suffix = relative(anchor, resolve(path));
  if (!suffix || suffix === '..' || suffix.startsWith(`..${sep}`)) throw new Error('directory must be below .cland/run');
  let current = anchor;
  for (const part of suffix.split(sep)) { current = join(current, part); await ownDirectory(current); }
}
export async function compactLeaseIndex(root: string, settled: ReadonlySet<string>, missing: (lease: string, reason: 'spend' | 'record', record?: DropletLease) => void | boolean | Promise<void | boolean>, rebuild = false, log?: LogFn): Promise<LeaseCompaction> {
  let outcome: LeaseCompaction = { status: 'compacted' };
  await leaseWrite(leaseRoot(root), async () => {
    try {
      await runDirectory(root, join(root, '.cland/run/executor'));
      const index = await readIndex(root);
      const ids = rebuild ? [...new Set([...(index?.leases ?? []), ...await directoryIds(root)])] : index?.leases ?? await directoryIds(root);
      await ownDirectory(demoRoot(root));
      await ownDirectory(reportRoot(root));
      const keep: string[] = [];
      for (const id of ids) {
        let lease: DropletLease;
        try { lease = await readLease(join(leaseRoot(root), id)); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          keep.push(id); await missing(id, 'record'); continue;
        }
        if (lease.lease !== id) throw new Error('lease directory identity mismatch');
        if (lease.state === 'released' && (settled.has(lease.lease) || await missing(lease.lease, 'spend', lease) === true)) {
          // Settlement is not local cleanup. Preserve membership until both key
          // removals have completed, including recovery after a partial removal.
          await rm(join(leaseDir(root, lease), 'key'), { force: true });
          await rm(join(leaseDir(root, lease), 'key.pub'), { force: true });
          await archiveDemo(root, lease);
          continue;
        }
        keep.push(id);
      }
      await ownDirectory(leaseRoot(root));
      await publishIndex(root, index, keep, ids.length, log);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // An unrelated missing record is not evidence that the owner vanished.
      try { await stat(join(root, '.cland/run')); }
      catch (receipt) {
        if ((receipt as NodeJS.ErrnoException).code !== 'ENOENT') throw receipt;
        outcome = { status: 'stopped', reason: 'run-directory-missing' };
        return;
      }
      throw error;
    }
  });
  return outcome;
}
const writes = new Map<string, Promise<void>>();
async function leaseWrite(dir: string, work: () => Promise<void>): Promise<void> {
  const key = resolve(dir);
  const previous = writes.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(work);
  writes.set(key, pending);
  try { await pending; }
  finally { if (writes.get(key) === pending) writes.delete(key); }
}
const sameWatchdog = (left: DropletLease['watchdog'], right: DropletLease['watchdog']): boolean => Boolean(left && right && left.pid === right.pid && left.startedUtc === right.startedUtc);
export async function writeLease(root: string, lease: DropletLease, log?: LogFn): Promise<void> {
  const dir = leaseDir(root, lease);
  await leaseWrite(leaseRoot(root), async () => {
    await runDirectory(root, dir);
    const index = await readIndex(root);
    // Admit before writing: a crash can add a missing-file read, never hide a lease.
    if (!index || !index.leases.includes(lease.lease)) {
      const ids = index?.leases ?? await directoryIds(root);
      const next = [...new Set([...ids, lease.lease])];
      await publishIndex(root, index, next, next.length, log);
    }
    let current: DropletLease | undefined;
    try { current = await readLease(dir); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    // A provider/run writer can still hold the old shape while inspection
    // checkpoints native ownership. That identity must never be downgraded.
    if (sameWatchdog(current?.watchdog, lease.watchdog) && !lease.watchdog!.pidIdentity && current?.watchdog?.pidIdentity) {
      lease.watchdog = { ...lease.watchdog!, pidIdentity: current.watchdog.pidIdentity };
    }
    await durableJson(join(dir, 'lease.json'), lease);
  });
}
/** Patch only ownership, using the same queue as every full lease writer. */
export async function upgradeWatchdog(root: string, lease: DropletLease, watchdog: NonNullable<DropletLease['watchdog']>): Promise<void> {
  const dir = leaseDir(root, lease);
  await leaseWrite(leaseRoot(root), async () => {
    const current = await readLease(dir);
    const recorded = current.watchdog;
    if (!sameWatchdog(recorded, watchdog) || recorded?.pidIdentity && recorded.pidIdentity !== watchdog.pidIdentity) throw new Error('watchdog changed while upgrading its legacy process identity');
    current.watchdog = watchdog;
    await durableJson(join(dir, 'lease.json'), current);
  });
}
export async function readLease(dir: string): Promise<DropletLease> {
  const lease = JSON.parse(await readFile(join(dir, 'lease.json'), 'utf8')) as DropletLease;
  if (lease.provider !== 'digitalocean' || !lease.name || !lease.tags.includes('cland') || !Number.isFinite(Date.parse(lease.deadline))) throw new Error('invalid droplet lease');
  return lease;
}
export async function readLeases(root: string, options: { requireFiles?: boolean } = {}): Promise<DropletLease[]> {
  return readIds(root, (await readIndex(root))?.leases ?? await directoryIds(root), options.requireFiles);
}
export const matchesLease = (droplet: Droplet, lease: DropletLease): boolean => droplet.name === lease.name && lease.tags.every(tag => droplet.tags.includes(tag));
export const liveLease = (lease: DropletLease, clock: Clock = realClock): boolean => lease.state !== 'released' && Date.parse(lease.deadline) > clock.now().getTime();
export function accountRelease(lease: DropletLease, deletedAt: string, clock: Clock = realClock): void {
  delete lease.attention;
  lease.deleteStarted ??= deletedAt;
  const billable = lease.createStarted && lease.resource !== null;
  lease.lifetimeMs = billable ? Math.max(0, Date.parse(lease.deleteStarted) - Date.parse(lease.createStarted!)) : 0;
  lease.costUsd = billable ? Math.max(60000, lease.lifetimeMs) / 3600000 * lease.priceHourly : 0;
  lease.state = 'released'; lease.released = clock.now().toISOString();
}

/** Tracking only grows: absence must be reconfirmed by id, never inferred from a list. */
export function mergeDeletions(lease: DropletLease, other?: DeletionTracking): DeletionTracking {
  const droplets = new Map<number, { id: number; started?: string }>();
  for (const row of [...(lease.deletions?.droplets ?? []), ...(other?.droplets ?? []), ...(lease.resource === null ? [] : [{ id: lease.resource, ...(!lease.deletions && lease.deleteStarted ? { started: lease.deleteStarted } : {}) }])]) {
    const old = droplets.get(row.id);
    droplets.set(row.id, { id: row.id, ...(old?.started || row.started ? { started: [old?.started, row.started].filter((v): v is string => Boolean(v)).sort()[0]! } : {}) });
  }
  lease.deletions = { droplets: [...droplets.values()], keys: [...new Set([...(lease.deletions?.keys ?? []), ...(other?.keys ?? []), ...(lease.keyId === null ? [] : [lease.keyId])])] };
  const started = lease.deletions.droplets.map(row => row.started).filter((v): v is string => Boolean(v)).sort()[0];
  if (started && (!lease.deleteStarted || started < lease.deleteStarted)) lease.deleteStarted = started;
  return lease.deletions;
}
export async function restoreWatchdogDeletions(dir: string, lease: DropletLease): Promise<void> {
  let tracking: DeletionTracking | undefined;
  try { tracking = JSON.parse(await readFile(join(dir, 'watchdog-cleanup.json'), 'utf8')) as DeletionTracking; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  mergeDeletions(lease, tracking);
}
