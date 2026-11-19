import { invalidateHostAdmission } from '../../host/admission-fence.ts';
import { positiveNonAcquisition, type HostNonAcquisitionReceipt } from '../../host/acquisition-receipt.ts';
export type { HostNonAcquisitionReceipt } from '../../host/acquisition-receipt.ts';
import { parsePoolName } from '../../host/pool-name.ts';
import { realClock, type Clock } from '../../hub/clock.ts';
// The first per-user cland state: all project hubs reserve against the same ledger.
import { mkdir, readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { userHome, userStateDirectory, legacySpendPath as legacyPath } from '../../state-paths.ts';
import { acquireLockAsync, acquireLockWithRetry, type LockProcessTable, type LockRetryTiming } from '../../hub/lock.ts';
import { compactLeaseIndex, durableJson, readLeases, type DropletLease, type LeaseCompaction } from './lease.ts';
import { registeredHubSpendStatus, type SpendHubStatus } from './spend-hubs.ts';

type Entry = { category?: 'verify' | 'hosts'; pool?: string; priceHourly?: number; billingMinimumMs?: number; project: string; lease: string; run: string; size: string; reservation: number; cost: number | null; created: string; deadline: string; released?: string; spendReceipt?: { reason: 'ledger-entry-missing'; project: string; lease: string; released: string } };
type MissingProject = { project: string; since: string; pruned?: true };
type Ledger = { version: 1; entries: Entry[]; projects?: string[]; missingProjects?: MissingProject[]; legacyRetired?: true };
export const spendPath = (env: NodeJS.ProcessEnv = process.env): string => join(userStateDirectory(env), 'spend.json');
/** The same persisted absence receipt governs ingestion, settlement and views. */
export function hasUnknownSpend(entry: Entry): boolean {
  const receipt = entry.spendReceipt;
  if (receipt === undefined) return false;
  if (!receipt || typeof receipt !== 'object' || receipt.reason !== 'ledger-entry-missing'
    || typeof entry.project !== 'string' || !entry.project || receipt.project !== entry.project
    || typeof entry.lease !== 'string' || !entry.lease || receipt.lease !== entry.lease
    || typeof receipt.released !== 'string' || !Number.isFinite(Date.parse(receipt.released)) || receipt.released !== entry.released
    || entry.cost !== null || category(entry) !== 'verify') throw new Error('invalid executor spend receipt');
  return true;
}
async function readExisting(path: string): Promise<Ledger | null> {
  try {
    const ledger = JSON.parse(await readFile(path, 'utf8')) as Ledger;
    if (ledger.version !== 1 || !Array.isArray(ledger.entries) || ledger.entries.some(e => !Number.isFinite(e.reservation) || e.reservation < 0 || e.cost !== null && (!Number.isFinite(e.cost) || e.cost < 0))) throw new Error('invalid executor spend ledger');
    for (const entry of ledger.entries) hasUnknownSpend(entry);
    return ledger;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
const read = async (path: string): Promise<Ledger> => await readExisting(path) ?? { version: 1, entries: [] };

/** Atomically published ledgers can be observed without locking or migration. */
async function observe(env: NodeJS.ProcessEnv): Promise<Ledger> {
  const current = await read(spendPath(env));
  if (current.legacyRetired) return current;
  const old = legacyPath(env);
  return reconcile(current, old ? await readExisting(old) ?? { version: 1, entries: [] } : { version: 1, entries: [] });
}

/** Both files may have been used by live hubs. Keep every lease and the more
 * conservative settlement for duplicates; an empty/stale copy cannot reset spend. */
function reconcile(current: Ledger, legacy: Ledger): Ledger {
  const entries = new Map<string, Entry>();
  for (const entry of [...current.entries, ...legacy.entries]) {
    const key = JSON.stringify([entry.project, entry.lease]);
    const existing = entries.get(key);
    if (!existing) { entries.set(key, { ...entry }); continue; }
    existing.reservation = Math.max(existing.reservation, entry.reservation);
    const unknown = hasUnknownSpend(existing) ? existing.spendReceipt : hasUnknownSpend(entry) ? entry.spendReceipt : undefined;
    if (unknown) {
      // An older writer's pending/zero row cannot resolve terminal uncertainty.
      existing.cost = null; existing.spendReceipt = unknown; existing.released = unknown.released;
    } else {
      if (entry.cost !== null) existing.cost = Math.max(existing.cost ?? 0, entry.cost);
      if (entry.released && (!existing.released || entry.released > existing.released)) existing.released = entry.released;
    }
  }
  // A real lease replaces its shard reservation. Retained legacy bytes must
  // not resurrect the group after reserveSpend consumed it in the new ledger.
  const actualRuns = new Set([...entries.values()].filter(e => category(e) === 'verify' && e.lease !== `reserved:${e.run}`).map(e => JSON.stringify([e.project, e.run])));
  const result: Ledger = { version: 1, entries: [...entries.values()].filter(e => category(e) === 'hosts' || e.lease !== `reserved:${e.run}` || e.cost !== null || !actualRuns.has(JSON.stringify([e.project, e.run]))) };
  if (current.projects || legacy.projects) result.projects = [...new Set([...(current.projects ?? []), ...(legacy.projects ?? [])])];
  const missing = new Map([...(legacy.missingProjects ?? []), ...(current.missingProjects ?? [])].map(record => [record.project, record]));
  if (missing.size) {
    result.missingProjects = [...missing.values()];
    if (result.projects) result.projects = result.projects.filter(project => !missing.get(project)?.pruned);
  }
  return result;
}
function totals(ledger: Ledger, clock: Clock) {
  const day = clock.now().toISOString().slice(0, 10);
  // Unconfirmed reservations carry across midnight; a crash must not reset admission.
  const reserved = ledger.entries.filter(e => e.cost === null && !hasUnknownSpend(e)).reduce((sum, e) => sum + e.reservation, 0);
  const spent = ledger.entries.filter(e => e.released?.startsWith(day)).reduce((sum, e) => sum + (e.cost ?? 0), 0);
  return { day, spent, reserved };
}
async function locked<T>(work: (ledger: Ledger) => T | Promise<T>, env: NodeJS.ProcessEnv, timing?: LockRetryTiming, maxWaitMs = 60000): Promise<T> {
  const path = spendPath(env);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  // Filesystem contention progresses independently of the hub scheduling clock.
  // An explicit wait keeps scripted lock tests deterministic; ledger timestamps
  // and spend windows still use the caller's clock in the transaction itself.
  const clock = timing?.wait ? timing.clock ?? realClock : realClock;
  const lock = await acquireLockWithRetry(`${path}.lock`, clock.now().getTime() + maxWaitMs, { ...timing, clock });
  let legacyLock;
  try {
    let ledger = await read(path);
    const old = legacyPath(env);
    if (!ledger.legacyRetired && old && old !== path && await readExisting(old)) {
      // Old hubs still serialize on this lock. Always take new then old, and
      // retain the legacy file until an explicit cleanup after those hubs stop.
      const [currentStat, oldStat] = await Promise.all([stat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; }), stat(old)]);
      // Aliased directories/files must never make the holder wait on itself.
      if (!currentStat || currentStat.dev !== oldStat.dev || currentStat.ino !== oldStat.ino) {
        // Never wait for another lock while holding the current ledger. Deferral
        // unwinds the current lock; the next sweep retries both from scratch.
        legacyLock = await acquireLockAsync(`${old}.lock`, undefined, Date.now() + 1000, 'UTC', timing?.processes, timing?.signal);
      }
      const legacy = await read(old);
      ledger = reconcile(ledger, legacy);
      await durableJson(path, ledger);
      if (JSON.stringify(await read(path)) !== JSON.stringify(ledger)) throw new Error(`executor spend migration verification failed: ${old} -> ${path}`);
      const log = join(dirname(path), 'spend-migration.json');
      try { await readFile(log); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await durableJson(log, { event: 'executor-spend-migrated', from: old, to: path });
      }
    }
    const before = JSON.stringify(ledger);
    timing?.signal?.throwIfAborted();
    const result = await work(ledger);
    // Mixed-version hubs read only the legacy file. Publish mutations there
    // first while holding both locks, so a crash cannot hide new reservations
    // from old admission. Read-only migration preserves the original bytes.
    if (!ledger.legacyRetired && legacyLock && old && JSON.stringify(ledger) !== before) await durableJson(old, ledger);
    await durableJson(path, ledger);
    return result;
  }
  finally { try { await legacyLock?.release(); } finally { await lock.release(); } }
}
async function load(env: NodeJS.ProcessEnv, timing?: LockRetryTiming, maxWaitMs = 60000): Promise<Ledger> {
  const current = await read(spendPath(env));
  if (current.legacyRetired) return current;
  const old = legacyPath(env);
  return old && old !== spendPath(env) && await readExisting(old) ? locked(ledger => ledger, env, timing, maxWaitMs) : current;
}

/** Explicit, fail-closed retirement. Both ledger locks cover compatibility
 * checks, the archival snapshot and the final activation in the primary ledger. */
export async function retireLegacySpend(confirmed: boolean, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, processes?: LockProcessTable, hubStatus: (project: string) => Promise<SpendHubStatus> = registeredHubSpendStatus, authorize: () => void = () => {}) {
  const path = spendPath(env), old = legacyPath(env);
  if (!old || old === path) throw new Error('legacy retirement requires the default user ledger, without CLAND_EXECUTOR_STATE');
  const currentStat = await stat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  const oldStat = await stat(old);
  if (currentStat && currentStat.dev === oldStat.dev && currentStat.ino === oldStat.ino) throw new Error('legacy retirement refused: primary and legacy ledgers alias the same file');
  return locked(async ledger => {
    const projects = [...new Set([...(ledger.projects ?? []), ...ledger.entries.map(entry => entry.project)])].sort();
    const checked = `registered projects: ${projects.length ? projects.join(', ') : '(none)'}`;
    if (!confirmed) throw new Error(`legacy retirement requires --confirm-registered-hubs; ${checked}`);
    const receipt = join(dirname(path), 'spend-retirement.json');
    if (ledger.legacyRetired) return { path, receipt, projects, summary: `legacy spend write-through already retired; receipt: ${receipt}` };
    if (!projects.length) throw new Error(`legacy retirement refused: no registered hubs; ${checked}`);
    for (const project of projects) {
      try {
        if (!isAbsolute(project)) throw new Error('registered project is not an absolute path');
        const status = await hubStatus(project);
        if (status.path !== path) throw new Error('hub does not report the shared new spend path');
        if (status.legacyRetirement !== 1) throw new Error('hub does not support the legacy retirement marker (spend.legacyRetirement=1 required)');
      } catch (error) {
        throw new Error(`legacy retirement refused for ${project}: ${error instanceof Error ? error.message : String(error)}; ${checked}`);
      }
    }
    // Keep the original file byte-for-byte in place, even after activation.
    const legacyBytes = await readFile(old, 'utf8');
    authorize();
    await durableJson(receipt, { event: 'executor-spend-retired', from: old, to: path, at: clock.now().toISOString(), projects, legacyRetirement: 1, legacyBytes });
    authorize();
    ledger.legacyRetired = true;
    return { path, receipt, projects, summary: `legacy spend write-through retired; legacy file retained: ${old}; receipt: ${receipt}` };
  }, env, { clock, ...(processes ? { processes } : {}) });
}
export async function reserveSpend(project: string, lease: DropletLease, cap: number, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, wait?: (ms: number) => Promise<void>, processes?: LockProcessTable, signal?: AbortSignal): Promise<void> {
  await locked(ledger => {
    if (ledger.entries.some(e => e.lease === lease.lease && category(e) === 'hosts')) throw new Error('spend reservation identity conflict');
    if (ledger.entries.some(e => e.lease === lease.lease)) return;
    const reservation = Math.max(60000, Date.parse(lease.deadline) - Date.parse(lease.created)) / 3600000 * lease.priceHourly;
    const group = ledger.entries.find(e => category(e) === 'verify' && e.project === project && e.run === lease.run && e.lease === `reserved:${lease.run}` && e.cost === null);
    const { spent, reserved } = totals(ledger, clock);
    if (spent + reserved - (group?.reservation ?? 0) + reservation > cap) throw new Error(`daily spend cap $${cap} reached`);
    if (group) ledger.entries.splice(ledger.entries.indexOf(group), 1);
    ledger.entries.push({ category: 'verify', project, lease: lease.lease, run: lease.run, size: lease.size, reservation, cost: null, created: lease.created, deadline: lease.deadline });
  }, env, { clock, wait, signal, ...(processes ? { processes } : {}) });
}
/** Recovery settles retained history in one ledger transaction, independent of
 * the number of already-settled leases. Missing entries predate spend tracking. */
export async function settleSpend(input: DropletLease | DropletLease[], env: NodeJS.ProcessEnv = process.env, processes?: LockProcessTable): Promise<void> {
  const released = new Map((Array.isArray(input) ? input : [input])
    .filter(lease => lease.state === 'released' && lease.costUsd !== undefined).map(lease => [lease.lease, lease]));
  if (!released.size) return;
  // Final costs never become reservations again. Skip settled history without
  // taking either lock; revalidate pending entries inside the transaction.
  if (!(await observe(env)).entries.some(entry => category(entry) === 'verify' && entry.cost === null && !hasUnknownSpend(entry) && released.has(entry.lease))) return;
  await locked(ledger => {
    for (const entry of ledger.entries) {
      const lease = released.get(entry.lease);
      if (lease && category(entry) === 'verify' && entry.cost === null && !hasUnknownSpend(entry)) { entry.cost = lease.costUsd!; entry.released = lease.released!; }
    }
  }, env, processes ? { processes } : undefined, 1000);
}
/** Missing historical entries settle with a durable unknown-spend receipt;
 * pending reservations retain recovery files. The ledger is authoritative. */
const compactions = new Map<string, Promise<LeaseCompaction>>();
export function compactLeaseHistory(root: string, env: NodeJS.ProcessEnv, log: (event: Record<string, unknown>) => void, rebuild = false, processes?: LockProcessTable): Promise<LeaseCompaction> {
  const key = JSON.stringify([resolve(root), spendPath(env), rebuild]);
  const current = compactions.get(key);
  if (current) return current;
  const work = (async () => {
    const ledger = await observe(env);
    const settled = new Set(ledger.entries.filter(e => e.project === root && category(e) === 'verify' && (e.cost !== null || hasUnknownSpend(e)) && Boolean(e.released)).map(e => e.lease));
    return compactLeaseIndex(root, settled, async (lease, reason, record) => {
      if (reason === 'record') { log({ event: 'executor-lease-record-missing', lease }); return; }
      if (!record?.released) return;
      if (ledger.entries.some(e => e.project === root && e.lease === lease)) return;
      // The ledger lock proves absence, including concurrent reservations. The
      // receipt is durable before cleanup/index removal or the diagnostic.
      const created = await locked(ledger => {
        if (ledger.entries.some(e => e.project === root && e.lease === lease)) return false;
        const entry: Entry = { project: root, lease, category: 'verify', run: record.run, size: record.size,
          reservation: 0, cost: null, created: record.created, deadline: record.deadline, released: record.released!,
          spendReceipt: { reason: 'ledger-entry-missing', project: root, lease, released: record.released! } };
        hasUnknownSpend(entry);
        ledger.entries.push(entry);
        return true;
      }, env, processes ? { processes } : undefined, 1000);
      if (created) log({ event: 'executor-lease-spend-missing', lease });
      return created;
    }, rebuild, log);
  })().finally(() => { if (compactions.get(key) === work) compactions.delete(key); });
  compactions.set(key, work);
  return work;
}
export async function inspectSpend(cap: number, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, processes?: LockProcessTable, readOnly = false) {
  // Status observes atomically published files. Conservative merging is safe
  // without migration or a lock; only admission needs serialized publication.
  const ledger = readOnly ? await observe(env) : await load(env, { clock, ...(processes ? { processes } : {}) });
  const unknownLeases = ledger.entries.filter(hasUnknownSpend).length;
  return { path: spendPath(env), ...totals(ledger, clock), cap, ...(unknownLeases ? { unknownLeases } : {}) };
}

class InvalidProject extends Error {
  constructor() { super('executor project must be an existing project directory, outside the filesystem root and HOME'); }
}
async function projectDirectory(project: string, env: NodeJS.ProcessEnv): Promise<string> {
  if (!isAbsolute(project)) throw new InvalidProject();
  const root = await realpath(project);
  const home = await realpath(userHome(env)).catch(error => { if (error.code === 'ENOENT') return resolve(userHome(env)); throw error; });
  if (root === dirname(root) || root === home || !(await stat(root)).isDirectory()) throw new InvalidProject();
  try {
    if (!(await stat(join(root, '.cland'))).isDirectory()) throw new InvalidProject();
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new InvalidProject(); throw error; }
  return root;
}

/** Register hubs, including pre-ledger leases, before their first automatic sweep. */
export async function rememberProject(project: string, env: NodeJS.ProcessEnv = process.env, processes?: LockProcessTable, clock: Clock = realClock, wait?: (ms: number) => Promise<void>, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  try { project = await projectDirectory(project, env); } catch { throw new InvalidProject(); }
  await locked(ledger => {
    ledger.projects ??= [];
    if (!ledger.projects.includes(project)) ledger.projects.push(project);
    if (ledger.missingProjects) ledger.missingProjects = ledger.missingProjects.filter(record => record.project !== project);
  }, env, { clock, wait, signal, ...(processes ? { processes } : {}) }, 1000);
}

/** A missing mount or temporarily renamed project gets a full day to return.
 * Keep tombstones for accounting-only roots so retained spend cannot revive a scan. */
export async function sweepProjects(env: NodeJS.ProcessEnv, clock: Clock, log: (event: Record<string, unknown>) => void, processes?: LockProcessTable, wait?: (ms: number) => Promise<void>, signal?: AbortSignal): Promise<void> {
  const timing = { clock, wait, signal, ...(processes ? { processes } : {}) };
  const observed = await load(env, timing, 1000);
  if (!observed.projects?.length && !observed.entries.length && !observed.missingProjects?.length) return;
  const pruned = await locked(async ledger => {
    const missing = new Map((ledger.missingProjects ?? []).map(record => [record.project, record]));
    const pruned: (MissingProject & { reason: string })[] = [];
    const projects = [...new Set([...(ledger.projects ?? []), ...ledger.entries.map(entry => entry.project), ...missing.keys()])];
    for (const project of projects) {
      try {
        await projectDirectory(project, env);
        if (missing.get(project)?.pruned) {
          ledger.projects ??= [];
          if (!ledger.projects.includes(project)) ledger.projects.push(project);
        }
        missing.delete(project);
      }
      catch (error) {
        // Unreadable paths are never evidence that a project is gone.
        const invalid = error instanceof InvalidProject || (error as NodeJS.ErrnoException).code === 'ENOTDIR';
        if (!invalid && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        if (missing.get(project)?.pruned) continue;
        const record = missing.get(project) ?? { project, since: clock.now().toISOString() };
        missing.set(project, record);
        if (invalid || clock.now().getTime() - Date.parse(record.since) >= 24 * 3600000) {
          record.pruned = true;
          pruned.push({ ...record, reason: invalid ? 'invalid project directory' : 'missing directory' });
        }
      }
    }
    ledger.missingProjects = [...missing.values()];
    if (ledger.projects) ledger.projects = ledger.projects.filter(project => !missing.get(project)?.pruned);
    return pruned;
  }, env, timing, 1000);
  // Publication, including legacy write-through, precedes each prune receipt.
  for (const record of pruned) log({ event: 'executor-project-pruned', project: record.project, since: record.since, reason: record.reason });
}
export async function hostLeases(project: string, env: NodeJS.ProcessEnv = process.env, processes?: LockProcessTable): Promise<DropletLease[]> {
  const ledger = await load(env, processes ? { processes } : undefined, 1000);
  const pruned = new Set(ledger.missingProjects?.filter(record => record.pruned).map(record => record.project));
  const projects = [...new Set([project, ...(ledger.projects ?? []), ...ledger.entries.map(e => e.project)])].filter(root => isAbsolute(root) && !pruned.has(root));
  // An unreadable project is not proof that its keys are orphaned. Fail the sweep safely.
  return (await Promise.all(projects.map(root => readLeases(root)))).flat();
}

/** Atomic group admission: no provider resources exist when this can refuse. */
export async function reserveShardSpend(project: string, runs: string[], size: string, priceHourly: number, lifetimeMs: number, cap: number, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, processes?: LockProcessTable, timing?: Pick<LockRetryTiming, 'signal' | 'wait'>): Promise<void> {
  await locked(ledger => {
    if (runs.some(run => ledger.entries.some(e => e.project === project && e.lease === `reserved:${run}` && category(e) === 'hosts'))) throw new Error('spend reservation identity conflict');
    const missing = runs.filter(run => !ledger.entries.some(e => category(e) === 'verify' && e.project === project && e.run === run));
    const reservation = Math.max(60000, lifetimeMs) / 3600000 * priceHourly;
    const { spent, reserved } = totals(ledger, clock);
    if (spent + reserved + missing.length * reservation > cap) throw new Error(`daily spend cap $${cap} would be exceeded`);
    const created = clock.now().toISOString(), deadline = new Date(clock.now().getTime() + lifetimeMs).toISOString();
    for (const run of missing) ledger.entries.push({ category: 'verify', project, lease: `reserved:${run}`, run, size, reservation, cost: null, created, deadline });
  }, env, { ...timing, clock, ...(processes ? { processes } : {}) });
}
export async function releaseShardSpend(project: string, runs: string[], env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, processes?: LockProcessTable, timing?: Pick<LockRetryTiming, 'signal' | 'wait'>): Promise<void> {
  await locked(ledger => {
    for (const e of ledger.entries) if (category(e) === 'verify' && e.project === project && runs.includes(e.run) && e.lease === `reserved:${e.run}` && e.cost === null) {
      e.cost = 0; e.released = clock.now().toISOString();
    }
  }, env, { ...timing, clock, ...(processes ? { processes } : {}) });
}


export type HostSpendReservation = {
  project: string; lease: string; pool: string; size: string;
  priceHourly: number; billingMinimumMs: number; created: string; deadline: string;
};
export type HostSpendCaps = { shared: number; hosts: number };
const category = (entry: Entry): 'verify' | 'hosts' => entry.category ?? 'verify';
function hostCost(input: Pick<HostSpendReservation, 'created' | 'priceHourly' | 'billingMinimumMs'>, end: string): number {
  const lifetime = Date.parse(end) - Date.parse(input.created);
  if (!Number.isFinite(lifetime) || lifetime < 0 || !Number.isFinite(input.priceHourly) || input.priceHourly < 0 || !Number.isFinite(input.billingMinimumMs) || input.billingMinimumMs < 0) throw new Error('invalid host spend lifetime or billing');
  const cost = Math.max(input.billingMinimumMs, lifetime) / 3600000 * input.priceHourly;
  if (!Number.isFinite(cost)) throw new Error('invalid host spend cost');
  return cost;
}
function admitHostSpend(ledger: Ledger, reservation: number, caps: HostSpendCaps, clock: Clock, replacing = 0): void {
  if (![caps.shared, caps.hosts].every(value => Number.isFinite(value) && value >= 0)) throw new Error('invalid host spend cap');
  const all = totals(ledger, clock);
  const hosts = totals({ version: 1, entries: ledger.entries.filter(e => category(e) === 'hosts') }, clock);
  if (all.spent + all.reserved - replacing + reservation > caps.shared) throw new Error(`daily spend cap $${caps.shared} would be exceeded`);
  if (hosts.spent + hosts.reserved - replacing + reservation > caps.hosts) throw new Error(`hosts daily spend cap $${caps.hosts} would be exceeded`);
}
export type HostSpendChange = { day: string; spent: number; reserved: number; pools: string[] };
const hostSpendListeners = new Map<string, Set<{ project: string; changed(value: HostSpendChange): void }>>();
/** Observe committed mutations in this owner; no ledger read or startup scan. */
export function onHostSpendChange(env: NodeJS.ProcessEnv, project: string, changed: (value: HostSpendChange) => void): () => void {
  const path = spendPath(env), listener = { project, changed };
  let listeners = hostSpendListeners.get(path);
  if (!listeners) hostSpendListeners.set(path, listeners = new Set());
  listeners.add(listener);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    listeners.delete(listener);
    if (!listeners.size && hostSpendListeners.get(path) === listeners) hostSpendListeners.delete(path);
  };
}
async function hostSpendMutation(project: string, work: (ledger: Ledger) => void, env: NodeJS.ProcessEnv, timing: LockRetryTiming): Promise<void> {
  const value = await locked(ledger => {
    work(ledger);
    if (!hostSpendListeners.get(spendPath(env))?.size) return;
    // Reuse the transaction's loaded ledger, including conservative legacy reconciliation.
    const entries = ledger.entries.filter(entry => category(entry) === 'hosts');
    const value = totals({ version: 1, entries }, timing.clock ?? realClock);
    const pools = [...new Set(entries.filter(entry => entry.cost === null || entry.released?.startsWith(value.day)).flatMap(entry => entry.pool ? [entry.pool] : []))].sort();
    return { ...value, pools };
  }, env, timing);
  // Durable publication and lock release precede the notice; a notice failure cannot undo spend.
  if (value) for (const listener of hostSpendListeners.get(spendPath(env)) ?? []) {
    if (listener.project !== project) continue;
    try { listener.changed(value); } catch (error) { console.error(error); }
  }
}
/** Persist before provider create. The caller retains this reservation until confirmed absence. */
export async function reserveHostSpend(input: HostSpendReservation, caps: HostSpendCaps, env: NodeJS.ProcessEnv = process.env, timing: LockRetryTiming = {}): Promise<void> {
  parsePoolName(input.pool);
  const reservation = hostCost(input, input.deadline);
  await hostSpendMutation(input.project, ledger => {
    const existing = ledger.entries.find(e => e.project === input.project && e.lease === input.lease);
    if (existing) {
      if (category(existing) !== 'hosts' || existing.pool !== input.pool || existing.created !== input.created || existing.priceHourly !== input.priceHourly || existing.billingMinimumMs !== input.billingMinimumMs || existing.size !== input.size || existing.deadline !== input.deadline) throw new Error('host spend reservation identity conflict');
      return;
    }
    admitHostSpend(ledger, reservation, caps, timing.clock ?? realClock);
    ledger.entries.push({ ...input, category: 'hosts', run: input.lease, reservation, cost: null });
  }, env, timing);
}
/** Settled period totals use UTC settlement dates, excluding pending reservations. */
export async function inspectHostSpend(env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock) {
  return (await inspectHostSpendSnapshot(env,clock)).totals;
}

/** One ledger observation for settled totals and exact admitted host billing. */
export async function inspectHostSpendSnapshot(env: NodeJS.ProcessEnv, clock: Clock, project?:string) {
  const ledger = await observe(env);
  const day = clock.now().toISOString().slice(0, 10), month = day.slice(0, 7);
  type Period = { today: number; month: number; unknownLeases?: number };
  const categories: Record<'verify' | 'hosts', Period> = { verify: { today: 0, month: 0 }, hosts: { today: 0, month: 0 } };
  const pools: Record<string, Period> = Object.create(null);
  for (const entry of ledger.entries) {
    if(project!==undefined&&entry.project!==project)continue;
    const bucket = categories[category(entry)];
    if (hasUnknownSpend(entry)) bucket.unknownLeases = (bucket.unknownLeases ?? 0) + 1;
    const pool = category(entry) === 'hosts' && entry.pool ? pools[entry.pool] ??= { today: 0, month: 0 } : undefined;
    if (entry.cost === null || !entry.released) continue;
    for (const target of [bucket, pool]) if (target) {
      if (entry.released.slice(0, 10) === day) target.today += entry.cost;
      if (entry.released.slice(0, 7) === month) target.month += entry.cost;
    }
  }
  const billing:Record<string,number>=Object.create(null);
  for(const entry of ledger.entries)if(category(entry)==='hosts'&&entry.project===project&&entry.priceHourly!==undefined)billing[entry.lease]=entry.priceHourly;
  return {totals:{day,month,categories,pools},billing};
}

function pendingHostEntry(ledger: Ledger, project: string, lease: string): Entry & { priceHourly: number; billingMinimumMs: number } {
  const entry = ledger.entries.find(e => e.project === project && e.lease === lease && category(e) === 'hosts');
  if (!entry || entry.priceHourly === undefined || entry.billingMinimumMs === undefined) throw new Error('host spend reservation not found or missing billing metadata');
  return entry as Entry & { priceHourly: number; billingMinimumMs: number };
}
/** Exact unsettled host reservation, observed after durable publication. */
export async function hostSpendReservation(project:string,lease:string,env:NodeJS.ProcessEnv) {
 const entry=pendingHostEntry(await observe(env),project,lease);
 if(entry.cost!==null||entry.released)throw Error('host reservation already settled');
 return {project:entry.project,lease:entry.lease,pool:entry.pool!,deadline:entry.deadline};
}
/** Reserve the whole extended lifetime before publishing the new lease deadline. */
export async function renewHostSpend(project: string, lease: string, deadline: string, caps: HostSpendCaps, env: NodeJS.ProcessEnv = process.env, timing: LockRetryTiming = {}): Promise<void> {
  await hostSpendMutation(project, ledger => {
    const entry = pendingHostEntry(ledger, project, lease);
    if (entry.cost !== null) throw new Error('host spend reservation already settled');
    const reservation = hostCost(entry, deadline);
    if (Date.parse(deadline) <= Date.parse(entry.deadline)) return;
    // Existing hosts keep renewing at the hosts sub-cap; the shared cap still applies.
    admitHostSpend(ledger, reservation, { shared: caps.shared, hosts: Number.MAX_VALUE }, timing.clock ?? realClock, entry.reservation);
    entry.reservation = Math.max(entry.reservation, reservation);
    entry.deadline = deadline;
  }, env, timing);
}
/** Only call with confirmed provider absence and the observed real lifetime end. */
export async function settleHostSpend(project: string, lease: string, released: string, env: NodeJS.ProcessEnv = process.env, timing: LockRetryTiming = {}): Promise<void> {
  invalidateHostAdmission(project,lease);
  await hostSpendMutation(project, ledger => {
    const entry = pendingHostEntry(ledger, project, lease);
    const cost = hostCost(entry, released);
    released = new Date(released).toISOString();
    if (entry.cost !== null) {
      if (entry.cost !== cost || entry.released !== released) throw new Error('host spend settlement conflict');
      return;
    }
    entry.cost = cost;
    entry.released = released;
  }, env, timing);
}

/** The caller pins this positive receipt before requesting cancellation. Unknown
 * acquire outcomes must retain their reservation for provider reconciliation. */
export async function cancelHostSpend(identity:{project:string;lease:string},receipt:HostNonAcquisitionReceipt,env:NodeJS.ProcessEnv=process.env,timing:LockRetryTiming={}):Promise<void>{
 if(!positiveNonAcquisition(receipt))throw Error('positive non-acquisition receipt required');
 invalidateHostAdmission(identity.project,identity.lease);
 const released=new Date(receipt.at).toISOString();
 await hostSpendMutation(identity.project, ledger=>{
  const entry=ledger.entries.find(e=>e.project===identity.project&&e.lease===identity.lease&&category(e)==='hosts');
  // A cap refusal did not reserve anything. Its durable no-call receipt is still valid.
  if(!entry)return;
  if(entry.cost!==null){if(entry.cost!==0||entry.released!==released)throw Error('host spend cancellation conflict');return;}
  entry.cost=0;entry.released=released;
 },env,timing);
}
