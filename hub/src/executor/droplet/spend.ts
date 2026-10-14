// The first per-user cland state: all project hubs reserve against the same ledger.
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';
import { acquireLockAsync, HubLocked } from '../../hub/lock.ts';
import { durableJson, readLeases, type DropletLease } from './lease.ts';
const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

type Entry = { project: string; lease: string; run: string; size: string; reservation: number; cost: number | null; created: string; deadline: string; released?: string };
type Ledger = { version: 1; entries: Entry[]; projects?: string[] };
export const spendPath = (): string => join(process.env.CLAND_EXECUTOR_STATE ?? join(homedir(), '.cland/executor'), 'spend.json');
async function read(path: string): Promise<Ledger> {
  try {
    const ledger = JSON.parse(await readFile(path, 'utf8')) as Ledger;
    if (ledger.version !== 1 || !Array.isArray(ledger.entries) || ledger.entries.some(e => !Number.isFinite(e.reservation) || e.reservation < 0 || e.cost !== null && (!Number.isFinite(e.cost) || e.cost < 0))) throw new Error('invalid executor spend ledger');
    return ledger;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, entries: [] }; throw error; }
}
function totals(ledger: Ledger) {
  const day = new Date().toISOString().slice(0, 10);
  // Unconfirmed reservations carry across midnight; a crash must not reset admission.
  const reserved = ledger.entries.filter(e => e.cost === null).reduce((sum, e) => sum + e.reservation, 0);
  const spent = ledger.entries.filter(e => e.released?.startsWith(day)).reduce((sum, e) => sum + (e.cost ?? 0), 0);
  return { day, spent, reserved };
}
async function locked<T>(work: (ledger: Ledger) => T): Promise<T> {
  const path = spendPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 15000;
  for (;;) {
    let lock;
    try { lock = await acquireLockAsync(`${path}.lock`, undefined, deadline, 'UTC'); }
    catch (error) { if (!(error instanceof HubLocked) || Date.now() >= deadline) throw error; await pause(25); continue; }
    try { const ledger = await read(path); const result = work(ledger); await durableJson(path, ledger); return result; }
    finally { await lock.release(); }
  }
}
export async function reserveSpend(project: string, lease: DropletLease, cap: number): Promise<void> {
  await locked(ledger => {
    if (ledger.entries.some(e => e.lease === lease.lease)) return;
    const reservation = Math.max(60000, Date.parse(lease.deadline) - Date.parse(lease.created)) / 3600000 * lease.priceHourly;
    const { spent, reserved } = totals(ledger);
    if (spent + reserved + reservation > cap) throw new Error(`daily spend cap $${cap} reached`);
    ledger.entries.push({ project, lease: lease.lease, run: lease.run, size: lease.size, reservation, cost: null, created: lease.created, deadline: lease.deadline });
  });
}
export async function settleSpend(lease: DropletLease): Promise<void> {
  if (lease.state !== 'released' || lease.costUsd === undefined) return;
  await locked(ledger => {
    const entry = ledger.entries.find(e => e.lease === lease.lease);
    if (entry && entry.cost === null) { entry.cost = lease.costUsd!; entry.released = lease.released!; }
  });
}
export async function inspectSpend(cap: number) {
  return { path: spendPath(), ...totals(await read(spendPath())), cap };
}

/** Register hubs, including pre-ledger leases, before their first automatic sweep. */
export async function rememberProject(project: string): Promise<void> {
  await locked(ledger => { ledger.projects ??= []; if (!ledger.projects.includes(project)) ledger.projects.push(project); });
}
export async function hostLeases(project: string): Promise<DropletLease[]> {
  const ledger = await read(spendPath());
  const projects = [...new Set([project, ...(ledger.projects ?? []), ...ledger.entries.map(e => e.project)])].filter(isAbsolute);
  // An unreadable project is not proof that its keys are orphaned. Fail the sweep safely.
  return (await Promise.all(projects.map(root => readLeases(root)))).flat();
}
