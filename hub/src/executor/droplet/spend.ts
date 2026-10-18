import { realClock, type Clock } from '../../hub/clock.ts';
// The first per-user cland state: all project hubs reserve against the same ledger.
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';
import { acquireLockWithRetry, type LockProcessTable, type LockRetryTiming } from '../../hub/lock.ts';
import { durableJson, readLeases, type DropletLease } from './lease.ts';

type Entry = { project: string; lease: string; run: string; size: string; reservation: number; cost: number | null; created: string; deadline: string; released?: string };
type Ledger = { version: 1; entries: Entry[]; projects?: string[] };
export const spendPath = (env: NodeJS.ProcessEnv = process.env): string => join(env.CLAND_EXECUTOR_STATE ?? join(env.HOME ?? homedir(), '.cland/executor'), 'spend.json');
async function read(path: string): Promise<Ledger> {
  try {
    const ledger = JSON.parse(await readFile(path, 'utf8')) as Ledger;
    if (ledger.version !== 1 || !Array.isArray(ledger.entries) || ledger.entries.some(e => !Number.isFinite(e.reservation) || e.reservation < 0 || e.cost !== null && (!Number.isFinite(e.cost) || e.cost < 0))) throw new Error('invalid executor spend ledger');
    return ledger;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, entries: [] }; throw error; }
}
function totals(ledger: Ledger, clock: Clock) {
  const day = clock.now().toISOString().slice(0, 10);
  // Unconfirmed reservations carry across midnight; a crash must not reset admission.
  const reserved = ledger.entries.filter(e => e.cost === null).reduce((sum, e) => sum + e.reservation, 0);
  const spent = ledger.entries.filter(e => e.released?.startsWith(day)).reduce((sum, e) => sum + (e.cost ?? 0), 0);
  return { day, spent, reserved };
}
async function locked<T>(work: (ledger: Ledger) => T, env: NodeJS.ProcessEnv, timing?: LockRetryTiming): Promise<T> {
  const path = spendPath(env);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const lock = await acquireLockWithRetry(`${path}.lock`, undefined, timing);
  try { const ledger = await read(path); const result = work(ledger); await durableJson(path, ledger); return result; }
  finally { await lock.release(); }
}
export async function reserveSpend(project: string, lease: DropletLease, cap: number, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, wait?: (ms: number) => Promise<void>, processes?: LockProcessTable): Promise<void> {
  await locked(ledger => {
    if (ledger.entries.some(e => e.lease === lease.lease)) return;
    const reservation = Math.max(60000, Date.parse(lease.deadline) - Date.parse(lease.created)) / 3600000 * lease.priceHourly;
    const group = ledger.entries.find(e => e.project === project && e.run === lease.run && e.lease === `reserved:${lease.run}` && e.cost === null);
    const { spent, reserved } = totals(ledger, clock);
    if (spent + reserved - (group?.reservation ?? 0) + reservation > cap) throw new Error(`daily spend cap $${cap} reached`);
    if (group) ledger.entries.splice(ledger.entries.indexOf(group), 1);
    ledger.entries.push({ project, lease: lease.lease, run: lease.run, size: lease.size, reservation, cost: null, created: lease.created, deadline: lease.deadline });
  }, env, { clock, wait, ...(processes ? { processes } : {}) });
}
export async function settleSpend(lease: DropletLease, env: NodeJS.ProcessEnv = process.env, processes?: LockProcessTable): Promise<void> {
  if (lease.state !== 'released' || lease.costUsd === undefined) return;
  await locked(ledger => {
    const entry = ledger.entries.find(e => e.lease === lease.lease);
    if (entry && entry.cost === null) { entry.cost = lease.costUsd!; entry.released = lease.released!; }
  }, env, processes ? { processes } : undefined);
}
export async function inspectSpend(cap: number, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock) {
  return { path: spendPath(env), ...totals(await read(spendPath(env)), clock), cap };
}

/** Register hubs, including pre-ledger leases, before their first automatic sweep. */
export async function rememberProject(project: string, env: NodeJS.ProcessEnv = process.env, processes?: LockProcessTable): Promise<void> {
  await locked(ledger => { ledger.projects ??= []; if (!ledger.projects.includes(project)) ledger.projects.push(project); }, env, processes ? { processes } : undefined);
}
export async function hostLeases(project: string, env: NodeJS.ProcessEnv = process.env): Promise<DropletLease[]> {
  const ledger = await read(spendPath(env));
  const projects = [...new Set([project, ...(ledger.projects ?? []), ...ledger.entries.map(e => e.project)])].filter(isAbsolute);
  // An unreadable project is not proof that its keys are orphaned. Fail the sweep safely.
  return (await Promise.all(projects.map(root => readLeases(root)))).flat();
}

/** Atomic group admission: no provider resources exist when this can refuse. */
export async function reserveShardSpend(project: string, runs: string[], size: string, priceHourly: number, lifetimeMs: number, cap: number, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, processes?: LockProcessTable): Promise<void> {
  await locked(ledger => {
    const missing = runs.filter(run => !ledger.entries.some(e => e.project === project && e.run === run));
    const reservation = Math.max(60000, lifetimeMs) / 3600000 * priceHourly;
    const { spent, reserved } = totals(ledger, clock);
    if (spent + reserved + missing.length * reservation > cap) throw new Error(`daily spend cap $${cap} would be exceeded`);
    const created = clock.now().toISOString(), deadline = new Date(clock.now().getTime() + lifetimeMs).toISOString();
    for (const run of missing) ledger.entries.push({ project, lease: `reserved:${run}`, run, size, reservation, cost: null, created, deadline });
  }, env, processes ? { processes } : undefined);
}
export async function releaseShardSpend(project: string, runs: string[], env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, processes?: LockProcessTable): Promise<void> {
  await locked(ledger => {
    for (const e of ledger.entries) if (e.project === project && runs.includes(e.run) && e.lease === `reserved:${e.run}` && e.cost === null) {
      e.cost = 0; e.released = clock.now().toISOString();
    }
  }, env, processes ? { processes } : undefined);
}
