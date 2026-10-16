import { randomUUID } from 'node:crypto';
import { open, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Droplet } from './api.ts';
import type { Lease } from '../executor.ts';

export type ReleaseAttention = {
  fields: Array<'name' | 'tags'>;
  expected: { name: string; tags: string[] };
  observed: { name: string; tags: string[]; status: string };
};

export type DropletLease = Lease & {
  kind: 'droplet'; provider: 'digitalocean'; lease: string; name: string;
  tags: string[]; size: string; region: string; priceHourly: number; keyName: string;
  state: 'creating' | 'active' | 'releasing' | 'released';
  resource: number | null; keyId: number | null; address?: string;
  keyImportStarted?: string; keyImportFinished?: string;
  createStarted?: string; createFinished?: string; deleteStarted?: string; released?: string;
  lifetimeMs?: number; costUsd?: number; watchdogFired?: string;
  attention?: ReleaseAttention;
  demo?: { epic: string; commit: string; ready?: boolean };
  execution?: { head: string; delivered?: boolean; started?: boolean; startedAt?: string; unreachableSince?: string };
  watchdog?: { pid: number; startedUtc: string };
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
export async function writeLease(root: string, lease: DropletLease): Promise<void> {
  const dir = leaseDir(root, lease);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await durableJson(join(dir, 'lease.json'), lease);
}
export async function readLease(dir: string): Promise<DropletLease> {
  const lease = JSON.parse(await readFile(join(dir, 'lease.json'), 'utf8')) as DropletLease;
  if (lease.provider !== 'digitalocean' || !lease.name || !lease.tags.includes('cland') || !Number.isFinite(Date.parse(lease.deadline))) throw new Error('invalid droplet lease');
  return lease;
}
export async function readLeases(root: string): Promise<DropletLease[]> {
  let entries;
  try { entries = await readdir(leaseRoot(root), { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const leases: DropletLease[] = [];
  for (const entry of entries) if (entry.isDirectory()) {
    try { leases.push(await readLease(join(leaseRoot(root), entry.name))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return leases;
}
export const matchesLease = (droplet: Droplet, lease: DropletLease): boolean => droplet.name === lease.name && lease.tags.every(tag => droplet.tags.includes(tag));
export const liveLease = (lease: DropletLease): boolean => lease.state !== 'released' && Date.parse(lease.deadline) > Date.now();
export function accountRelease(lease: DropletLease, deletedAt: string): void {
  delete lease.attention;
  lease.deleteStarted ??= deletedAt;
  const billable = lease.createStarted && lease.resource !== null;
  lease.lifetimeMs = billable ? Math.max(0, Date.parse(lease.deleteStarted) - Date.parse(lease.createStarted!)) : 0;
  lease.costUsd = billable ? Math.max(60000, lease.lifetimeMs) / 3600000 * lease.priceHourly : 0;
  lease.state = 'released'; lease.released = new Date().toISOString();
}
