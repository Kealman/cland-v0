import { readFile, writeFile, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { territoryPath, withTerritoryLockAsync } from '../territory.ts';
import { HOST_PUSH_TIMEOUT_MS } from './git-daemon.ts';
import { assertTerritoryLock, territoryLockHeld } from '../territory-lock-context.ts';

export const branchLeasePath = (root: string) => join(territoryPath(root), 'cland-branch-leases');
/** Snapshot the exact lease owners while the caller owns the territory lock. */
export async function branchLeaseOwnersLocked(root: string, branch: string): Promise<string[]> {
  assertTerritoryLock(root);
  return (await read(root)).filter(row => row.branch === branch).map(row => row.host).sort();
}
type Lease = { host: string; branch: string };
async function read(root: string): Promise<Lease[]> {
  const territory = await lstat(territoryPath(root)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (territory?.isSymbolicLink()) throw new Error('branch leases: refusing symlink territory');
  const info = await lstat(branchLeasePath(root)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (info?.isSymbolicLink()) throw new Error('branch leases: refusing symlink');
  const text = await readFile(branchLeasePath(root), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return text.split('\n').filter(Boolean).map(line => {
    const [host, branch, extra] = line.split('\t');
    if (!host || !branch || extra !== undefined) throw new Error('invalid branch lease record');
    validate(host, branch);
    return { host, branch };
  });
}
async function write(root: string, leases: Lease[]): Promise<void> {
  assertTerritoryLock(root);
  const path = branchLeasePath(root);
  const temporary = `${path}.${randomUUID()}`;
  await writeFile(temporary, leases.map(({ host, branch }) => `${host}\t${branch}\n`).sort().join(''), { mode: 0o600, flag: 'wx' });
  try { await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
function validate(host: string, branch: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(host)) throw new Error('invalid host id');
  if (!branch.startsWith('t/') || /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) || branch.includes('..') || branch.includes('@{') || branch.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.') || part.endsWith('.lock'))) throw new Error('lease requires a valid t/ task branch');
}
export async function grantBranchLease(root: string, host: string, branch: string): Promise<void> {
  validate(host, branch);
  await withTerritoryLockAsync(root, () => grantBranchLeaseLocked(root, host, branch));
}
/** Atomic launch already owns this matching-root lock; never acquire or wait here. */
export async function grantBranchLeaseLocked(root: string, host: string, branch: string): Promise<void> {
  if (!territoryLockHeld(root)) throw Object.assign(new Error('branch lease grant requires an active matching territory lock'), {name:'TerritoryLockRequired'});
  validate(host, branch);
  const leases = await read(root);
  if (!leases.some(row => row.host === host && row.branch === branch)) await write(root, [...leases, {host, branch}]);
}
export const BRANCH_REVOKE_WAIT_MS = HOST_PUSH_TIMEOUT_MS + 2_000;
export async function revokeBranchLease(root: string, host: string, branch: string, options: { waitMs?: number } = {}): Promise<void> {
  validate(host, branch);
  if (territoryLockHeld(root)) return revokeBranchLeasesLocked(root, branch, host);
  await withTerritoryLockAsync(root, () => revokeBranchLeasesLocked(root, branch, host), undefined, options.waitMs ?? BRANCH_REVOKE_WAIT_MS);
}
/** Merge callers already own the territory lock. An absent list needs no mutation. */
export async function revokeBranchLeasesLocked(root: string, branch: string, host?: string): Promise<void> {
  const leases = await read(root);
  const keep = leases.filter(row => row.branch !== branch || (host !== undefined && row.host !== host));
  if (keep.length !== leases.length) await write(root, keep);
}

/** Replace every holder of this branch in one durable write while the caller owns the territory. */
export async function transferBranchLeaseLocked(root: string, host: string, branch: string): Promise<void> {
  assertTerritoryLock(root);
  validate(host, branch);
  const leases = await read(root);
  await write(root, [...leases.filter(row => row.branch !== branch), { host, branch }]);
}
