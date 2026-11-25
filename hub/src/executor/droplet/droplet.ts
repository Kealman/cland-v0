import { abortable, boundedProvider, within } from './deadline.ts';
import { realClock, type Clock } from '../../hub/clock.ts';
import { processHost, type DropletDependencies, type Provider } from './dependencies.ts';
import { acquireLockWithRetry } from '../../hub/lock.ts';
import type { Store } from '../../hub/store.ts';
import type { LogFn } from '../../log.ts';
import { createHash, randomUUID } from 'node:crypto';
import { appendFile, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { basename } from 'node:path';
import { realpathSync } from 'node:fs';
import { defaultConfig, parseConfig, type ProjectConfig } from '../../init/config.ts';
import { DigitalOceanApi, DigitalOceanError, DeletionUnconfirmed, apiTimeoutMs, type Droplet, type Key, type Size } from './api.ts';
import { restoreWatchdogDeletions, accountRelease, durableJson, runDirectory, leaseDir, liveLease, matchesLease, readLease, readLeases, writeLease, upgradeWatchdog, type DropletLease, type WatchdogReceipt } from './lease.ts';
import { testTiming, type WatchdogOptions } from './watchdog.ts';
import { deleteLeaseResources, DropletIdentityMismatch, DropletDeletionTimeout } from './cleanup.ts';
import { readRecoveries, recoverSnapshots, claimSnapshotStorage, recoverPoolSnapshots } from './snapshot-recovery.ts';
import { prepareBase, prepareKey, prepareSnapshot, readSnapshot, staleParts, sameKey, snapshotFitsDisk, waitForMachine, type PrepareKey, type Prepared } from './prepare.ts';
import { compactLeaseHistory, hostLeases, inspectSpend, rememberProject, reserveSpend, settleSpend, reserveShardSpend, releaseShardSpend, retireLegacySpend, sweepProjects } from './spend.ts';
import { DropletRun } from './run.ts';
import { withDropletCleanupFailure } from './readiness-deadline.ts';
import { withCleanupFailure } from '../../cleanup-failure.ts';
import type { Executor, PrepareOptions, ReapOptions, Released, RunRef } from '../executor.ts';
import { remoteRedactor } from '../../host/agent/redact.ts';
import { EXECUTOR_CREDENTIALS } from '../../../../shared/executor-credentials.ts';

type Reaped = { deleted: number[]; deletedKeys: number[]; summary: string; unconfirmed?: { droplets: number[]; keys: number[] } };

type PrepareJob = { state: 'running' | 'done' | 'failed'; started: string; finished?: string; step: string; key?: PrepareKey; result?: Prepared; error?: string };
class InspectionTimeout extends Error {}
const inspectionBudgetMs = 5000;

export class RemoteBudgetFull extends Error {
  constructor() { super('remote budget full'); }
}

/** The provider offers no machine for the configured size/regions. No worker ran. */
export class ProviderCapacityUnavailable extends Error {}

/** Owns the project's durable droplet lifecycle, independently of suite delivery. */
export class DropletExecutor implements Executor {
  readonly root: string;
  readonly store: Store | undefined;
  readonly logger: LogFn;
  #observer: DropletRun | undefined;
  #run() { return this.dependencies.run ?? (this.#observer ??= new DropletRun(this.root, this.#env, this.dependencies, this.logger)); }
  #prepareJob: PrepareJob | null = null;
  #prepareWork: Promise<void> | null = null;
  readonly #poolWork = new Set<Promise<Prepared>>();
  #prepareAbort: AbortController | null = null;
  #closing = false;
  #indexRepairNeeded = true;
  readonly #abort = new AbortController();
  #sweepState: 'idle' | 'reconciling' | 'sweeping' | 'deferred' = 'idle';
  #taggedDroplets: number | null = null;
  #keyWork = new Map<string, Promise<PrepareKey>>();
  #staleNotice: string | null = null;
  #inspectionWork = new Map<string, Promise<PrepareKey | null>>();
  readonly #baseReads = new Set<Promise<string>>();
  readonly #reaps = new Set<Promise<Reaped>>();
  readonly #sweeps = new Set<Promise<void>>();
  readonly #reconciles = new Set<Promise<void>>();
  readonly #releases = new Map<string, Promise<Released>>();
  readonly #reservationUnlocks = new Set<() => Promise<void>>();
  readonly #leaseChanges = new Map<string, Promise<unknown>>();
  readonly #env: NodeJS.ProcessEnv;
  readonly clock: Clock;
  readonly dependencies: DropletDependencies;
  readonly projectConfig: (() => ProjectConfig) | undefined;
  constructor(root: string, store?: Store, log: LogFn = () => {}, env: NodeJS.ProcessEnv = process.env, projectConfig?: () => ProjectConfig, dependencies: DropletDependencies = {}) { this.clock = dependencies.clock ?? realClock; this.dependencies = { ...dependencies, api: boundedProvider(dependencies.api ?? new DigitalOceanApi(env, this.clock, undefined, this.#abort.signal), this.clock, apiTimeoutMs(env), undefined, this.#abort.signal) }; this.projectConfig = projectConfig; this.root = realpathSync(root); this.store = store; this.logger = log; this.#env = env; }

  async #wait(ms: number): Promise<void> {
    let timer: ReturnType<Clock['setTimeout']> | undefined;
    try { await abortable(this.dependencies.wait?.(ms) ?? new Promise<void>(resolve => { timer = this.clock.setTimeout(resolve, ms); }), this.#abort.signal); }
    finally { this.clock.clearTimeout(timer); }
  }

  async #config() {
    if (this.projectConfig) return this.projectConfig();
    try { return parseConfig(await readFile(join(this.root, '.cland/config.toml'), 'utf8'), basename(this.root), this.#env); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultConfig(basename(this.root)); throw error; }
  }

  // The scheduler reserves launching jobs; the provider boundary also counts
  // durable leases left by preparation, restarts or unconfirmed acquire cleanup.
  async #reserve(lease: DropletLease, budget: number, deadline: number): Promise<void> {
    await this.#retryReservationUnlocks();
    const path = join(this.root, '.cland/run/executor/budget.lock');
    const lock = await acquireLockWithRetry(path, deadline, { signal: this.#abort.signal, clock: this.clock, wait: this.dependencies.wait, ...(this.dependencies.processes ? { processes: this.dependencies.processes } : {}) });
    let failed = false, primary: unknown;
    try {
      this.#abort.signal.throwIfAborted();
      if ((await readLeases(this.root)).filter(l => l.state !== 'released').length >= budget) throw new RemoteBudgetFull();
      await this.#save(lease);
    } catch (error) { failed = true; primary = error; throw error; }
    finally {
      try { await lock.release(); }
      catch (cleanupError) {
        this.#reservationUnlocks.add(lock.release);
        throw failed ? withDropletCleanupFailure(primary, 'reservation-unlock', cleanupError) : cleanupError;
      }
    }
  }

  async #retryReservationUnlocks(): Promise<void> {
    for (const release of this.#reservationUnlocks) {
      await release();
      this.#reservationUnlocks.delete(release);
    }
  }

  async #save(lease: DropletLease): Promise<void> {
    await writeLease(this.root, lease, this.logger);
    await this.#publishLeases();
  }

  async #publishLeases(): Promise<void> {
    this.store?.setMeta('executor-leases', JSON.stringify((await readLeases(this.root)).filter(l => l.state !== 'released')));
  }

  async #compact(rebuild = false): Promise<boolean> {
    const outcome = await compactLeaseHistory(this.root, this.#env, this.logger, rebuild, this.dependencies.processes);
    if (outcome.status === 'stopped') {
      this.logger({ event: 'executor-lease-maintenance-stopped', reason: outcome.reason });
      return false;
    }
    await this.#publishLeases();
    return true;
  }

  /** Index maintenance cannot replace an already confirmed provider receipt. */
  async #compactAfterRelease(lease: DropletLease): Promise<void> {
    try { await this.#compact(); }
    catch (error) {
      // Keep the previous conservative index for recovery. Even a diagnostic
      // sink failure is ancillary to the durable Released outcome.
      try { this.logger({ event: 'executor-lease-maintenance-deferred', lease: lease.lease, operation: 'compact', error: String(error) }); }
      catch { /* the confirmed lease/accounting receipt remains authoritative */ }
    }
  }

  // Revalidation and the following write must be indivisible with respect to
  // release. Liveness probes and watchdog startup deliberately stay outside.
  async #changeLease<T>(lease: DropletLease, change: () => Promise<T>): Promise<T> {
    const previous = this.#leaseChanges.get(lease.lease) ?? Promise.resolve();
    const work = previous.catch(() => {}).then(change);
    this.#leaseChanges.set(lease.lease, work);
    try { return await work; }
    finally { if (this.#leaseChanges.get(lease.lease) === work) this.#leaseChanges.delete(lease.lease); }
  }

  #watchdogOptions(lease: DropletLease): WatchdogOptions {
    return { checkpoint: watchdog => this.#changeLease(lease, async () => {
      await upgradeWatchdog(this.root, lease, watchdog);
      await this.#publishLeases();
    }) };
  }

  async deliver(lease: DropletLease, run: RunRef, committedOnly = false) { return this.#run().deliver(lease, run, committedOnly); }
  async start(lease: DropletLease, _run: RunRef) { return this.#run().start(lease); }
  async status(lease: DropletLease) { return this.#run().status(lease); }
  async log(lease: DropletLease, offset: number) { return this.#run().log(lease, offset); }
  async cancel(lease: DropletLease, _signal: string) { return this.#run().cancel(lease); }
  async collectCoverage(lease: DropletLease, path: string) { return this.#run().collectCoverage(lease, path); }
  /** A failed transport is not evidence that the provider machine is gone. */
  async confirmMachineMissing(lease: DropletLease): Promise<boolean> {
    if (lease.resource === null) return false;
    try { await (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock)).droplet(lease.resource); }
    catch (error) {
      if (error instanceof DigitalOceanError && error.status === 404) return true;
      throw error;
    }
    return false;
  }

  /** Validate a per-run size; capacity is distinct from invalid price/configuration. */
  async validateSize(size: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    const api = (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock));
    const sizes = await api.sizes();
    const selected = sizes.find(s => s.slug === size);
    if (!selected) throw new Error(`droplet size ${size} is unavailable`);
    await this.#validateSnapshotDisk(size, sizes);
    if (!selected.available) throw new ProviderCapacityUnavailable(`droplet size ${size} is unavailable`);
    if (!Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    const regions = await api.regions();
    if (!config.verification.droplet.regions.some(region => selected.regions.includes(region) && regions.some(r => r.slug === region && r.available && r.sizes.includes(size)))) throw new ProviderCapacityUnavailable(`droplet size ${size} unavailable in configured regions`);
  }

  async reserveShards(runs: string[], overrideSize?: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    if (!await readSnapshot(this.root)) throw new Error('no prepared snapshot; run cland executor prepare');
    const size = overrideSize ?? config.verification.droplet.size;
    const selected = (await (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock)).sizes()).find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    await reserveShardSpend(this.root, runs, size, selected.price_hourly, testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env), config.verification.dailySpendUsd, this.#env, this.clock, this.dependencies.processes, { signal: this.#abort.signal, wait: this.dependencies.wait });
  }
  async releaseShardReservations(runs: string[]): Promise<void> {
    // Synthetic reservations have no lease for settleSpend to recover. Persist
    // their release intent before the parent is allowed to finish reporting.
    const directory = join(this.root, '.cland/run/executor/shard-releases');
    await runDirectory(this.root, directory);
    runs = [...new Set(runs)].sort();
    const path = join(directory, `${createHash('sha256').update(JSON.stringify(runs)).digest('hex')}.json`);
    await durableJson(path, runs);
    await this.#finishShardRelease(path, runs);
  }

  async #finishShardRelease(path: string, runs: string[]): Promise<void> {
    try { await releaseShardSpend(this.root, runs, this.#env, this.clock, this.dependencies.processes, { signal: this.#abort.signal, wait: this.dependencies.wait }); }
    catch (error) {
      this.logger({ event: 'executor-shard-reservations-deferred', runs, error: String(error) });
      // The durable intent, not the closing planner, owns any remaining spend.
      // A later hub retries it during reconciliation; preserve it on stop.
      if (this.#closing) return;
      throw error;
    }
    await rm(path, { force: true });
    this.logger({ event: 'executor-shard-reservations-released', runs });
  }

  async #retryShardReleases(): Promise<void> {
    const directory = join(this.root, '.cland/run/executor/shard-releases');
    const entries = await readdir(directory, { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries) if (entry.isFile() && entry.name.endsWith('.json')) {
      const path = join(directory, entry.name);
      const text = await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (text === null) continue; // A concurrent release already settled it.
      const runs: unknown = JSON.parse(text);
      if (!Array.isArray(runs) || runs.some(run => typeof run !== 'string' || !run)) throw new Error('invalid shard reservation release request');
      await this.#finishShardRelease(path, runs);
    }
  }

  /** Probe transport and regional availability without changing admission or spend. */
  async checkReachability(overrideSize?: string, snapshot?: ProjectConfig): Promise<void> {
    await this.#probeAvailability(overrideSize, snapshot);
  }

  async #probeAvailability(overrideSize?: string, snapshot?: ProjectConfig): Promise<Size> {
    const config = snapshot ?? await this.#config();
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const size = overrideSize ?? config.verification.droplet.size;
    const deadline = this.clock.now().getTime() + 5000;
    const api = boundedProvider(this.dependencies.api!, this.clock, 5000, deadline, this.#abort.signal);
    let sizes: Awaited<ReturnType<Provider['sizes']>>, regions: Awaited<ReturnType<Provider['regions']>>;
    try { sizes = await api.sizes(deadline); regions = await api.regions(deadline); }
    catch (error) { throw new Error(`droplet API reachability probe failed: ${error instanceof Error ? error.message : String(error)}; use cland verify executor local`, { cause: error }); }
    const selected = sizes.find(s => s.slug === size && s.available);
    if (!selected) throw new ProviderCapacityUnavailable(`droplet size ${size} is unavailable`);
    if (!Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    const available = config.verification.droplet.regions.filter(region => selected.regions.includes(region) && regions.some(row => row.slug === region && row.available && row.sizes.includes(size)));
    for (const region of config.verification.droplet.regions) if (!available.includes(region)) this.logger({ event: 'executor-region-skipped', region, reason: `region unavailable for size ${size}` });
    if (!available.length) throw new ProviderCapacityUnavailable(`droplet size ${size} unavailable in regions ${config.verification.droplet.regions.join(', ')}; use cland verify executor local`);
    await this.#validateSnapshotDisk(size, sizes);
    return selected;
  }

  async #validateSnapshotDisk(size: string, sizes: Size[]): Promise<void> {
    const snapshot = await readSnapshot(this.root);
    // Planning remains available before preparation; acquisition still requires
    // an image. Only an existing image can constrain the requested disk.
    if (!snapshot) return;
    this.#requireSnapshotDisk(size, snapshot.minDiskSize, sizes);
  }

  #requireSnapshotDisk(size: string, minimum: number, sizes: Size[]): void {
    if (snapshotFitsDisk(minimum, sizes.find(row => row.slug === size)?.disk)) return;
    const fitting = sizes.filter(row => snapshotFitsDisk(minimum, row.disk)).map(row => row.slug).sort();
    throw new Error(`prepared snapshot disk does not fit size ${size}; fitting sizes: ${fitting.join(", ") || "none"}; run cland executor prepare`);
  }

  /** Remote-required submissions check spend; acquire always reserves atomically. */
  async checkSpend(overrideSize?: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    const selected = await this.#probeAvailability(overrideSize, config);
    const lifetime = testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env);
    const reservation = Math.max(60000, lifetime) / 3600000 * selected.price_hourly;
    const { spent, reserved, cap } = await inspectSpend(config.verification.dailySpendUsd, this.#env, this.clock, this.dependencies.processes);
    if (spent + reserved + reservation > cap) throw new Error(`daily spend cap $${cap} reached`);
  }

  async acquire(run: Pick<RunRef, 'id' | 'size'> & Partial<Pick<RunRef, 'log' | 'leaseDeadline'>>, deadline: string, demo?: DropletLease['demo'], snapshotConfig?: ProjectConfig, admitted?: (lease: DropletLease) => void): Promise<DropletLease> {
    this.#abort.signal.throwIfAborted();
    const config = snapshotConfig ?? await this.#config();
    const runDeadline = Date.parse(deadline);
    if (!Number.isFinite(runDeadline) || runDeadline <= this.clock.now().getTime()) throw new Error('droplet acquisition deadline reached');
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const snapshot = await readSnapshot(this.root);
    if (!snapshot) throw new Error('no prepared snapshot; run cland executor prepare');
    await this.#noticeStale(snapshot, config.verification.provision, runDeadline);
    const lease = await this.#acquire(run, deadline, { size: run.size ?? config.verification.droplet.size, regions: config.verification.droplet.regions.filter(region => snapshot.regions.includes(region)), image: snapshot.image, minDiskSize: snapshot.minDiskSize, ...(demo ? { demo } : {}) }, config, admitted);
    try {
      lease.snapshot = snapshot;
      await this.#save(lease);
      await waitForMachine(this.root, lease, snapshot.key, undefined, this.#abort.signal, this.#env, { ...this.dependencies, wait: ms => this.#wait(ms) });
      return lease;
    }
    catch (error) {
      try { await this.release(lease); }
      catch (cleanupError) { error = withDropletCleanupFailure(error, 'release', cleanupError); }
      throw error;
    }
  }

  async #acquire(run: Pick<RunRef, 'id'> & Partial<Pick<RunRef, 'log' | 'leaseDeadline'>>, deadline: string, input: { size: string; regions: string[]; image: string | number; minDiskSize?: number; user_data?: string; demo?: DropletLease['demo'] }, config: ProjectConfig, admitted?: (lease: DropletLease) => void): Promise<DropletLease> {
    const runDeadline = Date.parse(deadline);
    const api = (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock));
    const { size, regions, image } = input;
    const sizes = await api.sizes(runDeadline);
    const selected = sizes.find(s => s.slug === size && s.available);
    if (!selected) throw new ProviderCapacityUnavailable(`droplet size ${size} is unavailable`);
    if (!Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    if (input.minDiskSize !== undefined) this.#requireSnapshotDisk(size, input.minDiskSize, sizes);
    const offered = await api.regions(runDeadline);
    const candidates = regions.filter(r => selected.regions.includes(r) && offered.some(o => o.slug === r && o.available && o.sizes.includes(size)));
    const region = candidates[0];
    if (!region) throw new ProviderCapacityUnavailable(`droplet size ${size} unavailable in regions ${regions.join(', ')}`);
    const created = this.clock.now().toISOString();
    const lifetimeCap = run.leaseDeadline === undefined ? Infinity : Date.parse(run.leaseDeadline);
    if (!(lifetimeCap > Date.parse(created))) throw new Error('replacement lease lifetime deadline reached or invalid');
    const id = randomUUID();
    const name = `cland-${projectName(config.name)}-${id.replace(/-/g, '').slice(0, 8)}`;
    const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: id, run: run.id, name, tags: ['cland', projectTag(this.root, config.name)], size, region, priceHourly: selected.price_hourly, keyName: `${projectTag(this.root, config.name)}-${id.replace(/-/g, '').slice(0, 8)}`, created,
      ...(input.demo ? { demo: input.demo } : {}), deadline: new Date(Math.min(lifetimeCap, input.demo ? runDeadline : Infinity, Date.parse(created) + testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env))).toISOString(), state: 'creating', resource: null, keyId: null };
    const dir = leaseDir(this.root, lease);
    await runDirectory(this.root, dir);
    try {
      await (this.dependencies.host ?? processHost).createKey(dir, name, this.#env);
      await this.#reserve(lease, config.verification.remoteBudget, runDeadline);
      admitted?.(lease); // Durable lease identity reaches the caller before provider resource creation.
      await reserveSpend(this.root, lease, config.verification.dailySpendUsd, this.#env, this.clock, this.dependencies.wait, this.dependencies.processes, this.#abort.signal);
      this.#abort.signal.throwIfAborted();
      lease.watchdog = await (this.dependencies.host ?? processHost).armWatchdog(dir, this.#env);
      await this.#save(lease);
      const publicKey = await readFile(join(dir, 'key.pub'), 'utf8');
      lease.keyImportStarted = this.clock.now().toISOString();
      await this.#save(lease);
      const key = await api.importKey(lease.keyName, publicKey);
      lease.keyImportFinished = this.clock.now().toISOString();
      lease.keyId = key.id;
      await this.#save(lease);
      const limit = Math.min(runDeadline, Date.parse(lease.deadline), this.clock.now().getTime() + testTiming('CLAND_TEST_DROPLET_ACQUIRE_MS', 300000, this.#env));
      if (this.clock.now().getTime() >= limit) throw new Error('droplet acquisition deadline reached');
      let droplet: Droplet | undefined;
      const refusals: string[] = [];
      for (const candidate of candidates) {
        lease.region = candidate;
        lease.createStarted = this.clock.now().toISOString();
        delete lease.createFinished;
        await this.#save(lease);
        try {
          droplet = await api.create({ name, tags: lease.tags, size, region: candidate, image, ssh_keys: [key.id], ...(input.user_data ? { user_data: input.user_data } : {}) }, limit);
          if (!droplet || !Number.isSafeInteger(droplet.id) || droplet.id <= 0) throw new DigitalOceanError(0, 'response', 'missing valid droplet in create response');
          lease.createFinished = this.clock.now().toISOString();
          break;
        } catch (error) {
          if (!(error instanceof DigitalOceanError) || error.status !== 422 || error.id !== 'unprocessable_entity' || error.message !== 'DigitalOcean 422 unprocessable_entity: Size is not available in this region') throw error;
          lease.createFinished = this.clock.now().toISOString();
          try { await this.#save(lease); }
          catch (cleanupError) { throw withDropletCleanupFailure(error, 'lease-checkpoint', cleanupError); }
          const reason = `${candidate}: ${error.message}`;
          refusals.push(reason);
          if (run.log) {
            try { await appendFile(run.log, `Droplet region refused: ${reason}\n`); }
            catch (sinkError) { throw withCleanupFailure(error, sinkError); }
          }
        }
      }
      if (refusals.length === candidates.length) throw new ProviderCapacityUnavailable(`droplet size ${size} unavailable: ${refusals.join('; ')}`);
      if (!droplet) throw new Error('droplet create did not return a resource');
      lease.resource = droplet.id;
      await this.#save(lease);
      do {
        if (this.clock.now().getTime() >= limit) throw new Error('droplet acquisition deadline reached before active public IPv4');
        const current = await api.droplet(droplet.id, limit);
        const address = current.networks.v4.find(n => n.type === 'public')?.ip_address;
        if (current.status === 'active' && address) {
          lease.address = address; lease.state = 'active';
          await this.#save(lease);
          this.logger({ event: 'executor-lease-active', lease: lease.lease, id: lease.resource, run: lease.run });
          return lease;
        }
        await this.#wait(Math.min(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, this.#env), Math.max(0, limit - this.clock.now().getTime())));
      } while (true);
    } catch (error) {
      if (error instanceof DigitalOceanError && error.status >= 400 && error.status < 500) {
        if (lease.createStarted) lease.createFinished ??= this.clock.now().toISOString();
        else if (lease.keyImportStarted) lease.keyImportFinished ??= this.clock.now().toISOString();
      }
      // Once persisted, even an ambiguous create is cleaned up by name and tags.
      try { await this.#save(lease); }
      catch (cleanupError) { throw withDropletCleanupFailure(error, 'lease-checkpoint', cleanupError); }
      try { await this.release(lease); }
      catch (cleanupError) { error = withDropletCleanupFailure(error, 'release', cleanupError); }
      throw error;
    }
  }

  async #key(capturedProvision?: string, local = false): Promise<PrepareKey> {
    const provision = capturedProvision ?? (await this.#config()).verification.provision;
    const identity = JSON.stringify([provision, local]);
    let work = this.#keyWork.get(identity);
    if (!work) {
      work = (this.dependencies.prepareKey ?? prepareKey)(this.root, this.#env, provision, !local).finally(() => { this.#keyWork.delete(identity); });
      this.#keyWork.set(identity, work);
    }
    return work;
  }

  async #noticeStale(snapshot: import('./prepare.ts').Snapshot, provision: string, deadline: number): Promise<void> {
    // The advisory owns no admission authority, including its metadata accesses.
    try { await this.#publishStale(snapshot, provision, deadline); }
    catch (error) { this.#advisoryFailure(error); }
  }

  #advisoryFailure(error: unknown): void {
    try {
      const redact = remoteRedactor([...EXECUTOR_CREDENTIALS].map(name => this.#env[name] ?? ''));
      this.logger({ event: 'executor-snapshot-advisory-deferred', reason: redact(error instanceof Error ? error.message : String(error)) });
    } catch { /* diagnostics cannot acquire admission authority either */ }
  }

  async #publishStale(snapshot: import('./prepare.ts').Snapshot, provision: string, deadline: number): Promise<void> {
    let current: PrepareKey;
    try { current = await within(this.#key(provision, true), Math.max(0, Math.min(inspectionBudgetMs, deadline - this.clock.now().getTime())), this.clock); }
    catch { return; } // Inspection failure is not evidence of stale inputs.
    const parts = staleParts(snapshot, current);
    if (!parts.length) {
      this.#staleNotice = null;
      this.store?.setMeta('executor-stale-notice', '');
      return;
    }
    const identity = createHash('sha256').update(JSON.stringify([snapshot.key, current])).digest('hex');
    if ((this.store?.meta('executor-stale-notice') ?? this.#staleNotice) === identity || !this.dependencies.snapshotNotice) return;
    const id = `executor-stale:${identity}`;
    const receipt = this.dependencies.snapshotNotice(id, `snapshot ${snapshot.name} image=${snapshot.image} stale: ${parts.join('|')}; run cland executor prepare`);
    if (receipt !== id) return;
    this.store?.setMeta('executor-stale-notice', identity);
    this.#staleNotice = identity;
  }

  async #inspectKey(): Promise<{ key: PrepareKey | null; base: string; reason?: string }> {
    const provision = (await this.#config()).verification.provision;
    // Retain a timed-out observation until a later status read consumes it.
    // Successful consumption removes it: later reads must observe source changes.
    let work = this.#inspectionWork.get(provision);
    if (!work) {
      work = this.#key(provision, true).catch(() => null);
      this.#inspectionWork.set(provision, work);
    }
    // Validate only once the key is consumable. A base read started in parallel
    // could finish before a pending old key, accepting A after the ref moved B.
    const observation = work.then(async key => {
      const base = (this.dependencies.prepareBase ?? prepareBase)(this.root, this.#env);
      this.#baseReads.add(base);
      void base.then(() => this.#baseReads.delete(base), () => this.#baseReads.delete(base));
      return { key, currentBase: await base };
    });
    try {
      const { key, currentBase } = await within(observation, inspectionBudgetMs, this.clock, () => new InspectionTimeout());
      if (this.#inspectionWork.get(provision) === work) this.#inspectionWork.delete(provision);
      return { key: key?.base === currentBase ? key : null, base: currentBase, ...(!key ? { reason: 'local key inspection failed' } : key.base !== currentBase ? { reason: 'local base changed during inspection' } : {}) };
    } catch (error) { return { key: null, base: '', reason: error instanceof InspectionTimeout ? 'local inspection exceeded 5s' : 'local base inspection failed' }; }
  }

  submitPrepare(report: (text: string) => void, authorize: () => void = () => {}): { state: 'submitted'; summary: string } {
    authorize();
    if (this.#closing) throw new Error('hub is stopping');
    if (this.#prepareJob?.state === 'running') throw new Error('snapshot preparation already running');
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const job: PrepareJob = { state: 'running', started: this.clock.now().toISOString(), step: 'key' };
    this.#prepareJob = job;
    this.#prepareAbort = new AbortController();
    this.#prepareWork = this.#key().then(key => { job.key = key; return this.prepare(key, step => { this.#prepareAbort?.signal.throwIfAborted(); authorize(); job.step = step; }); }).then(result => {
      job.state = 'done'; job.finished = this.clock.now().toISOString(); job.result = result; report(result.summary);
      this.#staleNotice = null;
      try { this.store?.setMeta('executor-stale-notice', ''); }
      catch (error) { this.#advisoryFailure(error); }
    }, error => {
      job.state = 'failed'; job.finished = this.clock.now().toISOString(); job.error = error instanceof Error ? error.message : 'snapshot preparation failed';
      const durationMs = this.clock.now().getTime() - Date.parse(job.started);
      if (job.step === 'key') this.logger({ event: 'executor-prepare-failed', key: job.key ?? null, image: null, regions: [], durationMs, lifetimeMs: 0, costUsd: 0, cause: job.error });
      report(`snapshot prepare failed: ${job.error}\nkey ${JSON.stringify(job.key ?? null)}; image none; duration ${Math.round(durationMs / 1000)}s`);
    }).finally(() => { this.#prepareWork = null; this.#prepareAbort = null; });
    return { state: 'submitted', summary: 'snapshot preparation submitted; see cland executor status' };
  }

  prepare(options?: PrepareOptions): Promise<Prepared>;
  /** Compatibility for callers that already captured a backend snapshot key. */
  prepare(key: PrepareKey, step?: (step: string) => void): Promise<Prepared>;
  async prepare(input: PrepareOptions | PrepareKey = {}, progress?: (step: string) => void): Promise<Prepared> {
    const config = await this.#config();
    const key = 'base' in input ? input : await this.#key(config.verification.provision);
    if ((config.verification.provision || undefined) !== key.provisionPath || Boolean(config.verification.provision) !== Boolean(key.provision)) throw new Error('provision input/key mismatch');
    const step = 'base' in input ? progress ?? (() => {}) : input.step ?? (() => {});
    const recoveries = await readRecoveries(this.root);
    if (recoveries.some(record => record.phase !== 'cleanup' || record.requested && record.actionState !== 'completed' && record.actionState !== 'errored')) throw new Error('snapshot recovery pending; see cland executor status');
    const { snapshot_size, prepare_size, size, regions, image } = config.verification.droplet;
    // An absent override retains legacy no-provider reuse, including a key
    // computation already admitted when shutdown begins.
    const current = await readSnapshot(this.root);
    if (snapshot_size === undefined && current && sameKey(current.key, key)) return prepareSnapshot({ dependencies: this.dependencies, env: this.#env, root: this.root, provision: config.verification.provision, prepare: config.verification.prepare, project: projectName(config.name), regions, tags: [], key, store: this.store, log: this.logger, signal: this.#prepareAbort?.signal, step, builder: async () => { throw new Error('current snapshot needs no builder'); }, release: lease => this.release(lease) });
    const builderSize = snapshot_size ?? prepare_size;
    const sizes = await (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock)).sizes();
    const builder = sizes.find(s => s.slug === builderSize && s.available);
    const run = sizes.find(s => s.slug === size && s.available);
    if (!builder || !run || !Number.isFinite(builder.disk) || !Number.isFinite(run.disk)) throw new Error('snapshot builder and size need available disks');
    if (builder.disk! > run.disk!) throw new Error(`verification snapshot builder ${builderSize} disk exceeds run size ${size}`);
    return prepareSnapshot({ dependencies: this.dependencies, env: this.#env, root: this.root, provision: config.verification.provision, prepare: config.verification.prepare, project: projectName(config.name), regions, tags: ['cland', projectTag(this.root, config.name)], key, maxDiskSize: builder.disk!, store: this.store, log: this.logger, signal: this.#prepareAbort?.signal, step,
      builder: user_data => this.#acquire({ id: 'executor-prepare' }, new Date(this.clock.now().getTime() + config.verification.lifetimeMs).toISOString(), { size: builderSize, regions, image, user_data }, config), release: lease => this.release(lease) });
  }

  /** Pool builds share executor admission, watchdog and spend, but never its image pointer. */
  preparePool(pool: string, key: import('../../host/provider/pool-image.ts').PoolImageKey, captured?: import('../../init/config.ts').ProjectConfig): Promise<Prepared> {
    const work = this.#preparePoolOwned(pool, key, captured).finally(() => { this.#poolWork.delete(work); });
    this.#poolWork.add(work);
    return work;
  }
  async #preparePoolOwned(pool: string, key: import('../../host/provider/pool-image.ts').PoolImageKey, captured?: import('../../init/config.ts').ProjectConfig): Promise<Prepared> {
    const { poolSnapshotStorage } = await import('../../host/provider/pool-image.ts');
    const release = claimSnapshotStorage(poolSnapshotStorage(this.root, pool));
    if (!release) throw new Error('pool snapshot operation running');
    try { return await this.#preparePool(pool, key, captured); }
    finally { release(); }
  }
  async #preparePool(pool: string, key: import('../../host/provider/pool-image.ts').PoolImageKey, captured?: import('../../init/config.ts').ProjectConfig): Promise<Prepared> {
    const { parse } = await import('smol-toml');
    const { readHostPools } = await import('../../host/transport-config.ts');
    const { samePoolImageKey, poolSnapshotStorage } = await import('../../host/provider/pool-image.ts');
    const { renderRecipe } = await import('../../image/recipe.ts');
    const { recoverSnapshot } = await import('./snapshot-recovery.ts');
    const config = captured ?? await this.#config();
    const selected = captured ? captured.hosts.pools[pool] : readHostPools(parse(await readFile(join(this.root, '.cland/config.toml'), 'utf8')).hosts).pools[pool];
    if (!selected || selected.provider !== 'digitalocean') throw new Error('DigitalOcean pool unavailable');
    const storage = poolSnapshotStorage(this.root, pool);
    for (const record of await readRecoveries(this.root, storage)) {
      if (!await recoverSnapshot(this.root, record, undefined, this.#env, this.dependencies.api, storage)) throw new Error('pool snapshot recovery pending');
    }
    const { prepare_size, image } = config.verification.droplet;
    const current = await readSnapshot(this.root, storage);
    let baseRef = 'refs/heads/dev';
    let maxDiskSize: number | undefined;
    if (!current || !samePoolImageKey(current.key, key)) {
      const source = await this.#key(config.verification.provision);
      if (source.lock !== key.lock || source.provision !== key.provision || source.provisionPath !== key.provisionPath) throw new Error('pool inputs differ from committed builder source');
      baseRef = source.base;
      const sizes = await this.dependencies.api!.sizes();
      const builder = sizes.find(size => size.slug === prepare_size && size.available);
      const target = sizes.find(size => size.slug === selected.size && size.available);
      maxDiskSize = target?.disk;
      if (!builder || !target || !Number.isFinite(builder.disk) || !Number.isFinite(target.disk) || builder.disk! > target.disk!) throw new Error('pool builder disk exceeds host disk or size unavailable');
    }
    return prepareSnapshot({ root: this.root, env: this.#env, dependencies: this.dependencies, storage,
      ...(maxDiskSize === undefined ? {} : { maxDiskSize }), recipe: renderRecipe({ arch: 'x86_64', node: key.node, harnesses: key.harnesses }), baseRef, keysEqual: samePoolImageKey,
      provision: config.verification.provision, prepare: config.verification.prepare, key,
      project: `${projectName(config.name)}-pool-${pool}`, regions: [selected.region],
      tags: ['cland', projectTag(this.root, config.name), `cland-pool-${pool}`], log: this.logger, signal: this.#abort.signal, step: () => {},
      builder: user_data => this.#acquire({ id: `host-prepare-${pool}` }, new Date(this.clock.now().getTime() + config.verification.lifetimeMs).toISOString(), { size: prepare_size, regions: config.verification.droplet.regions, image, user_data }, config),
      release: lease => this.release(lease),
    });
  }

  async close(): Promise<void> {
    this.#closing = true; this.#prepareAbort?.abort();
    this.#abort.abort(new Error('hub is stopping; executor lease retained for reconciliation'));
    await this.#prepareWork;
    await Promise.allSettled(this.#poolWork);
    await Promise.allSettled(this.#inspectionWork.values());
    await Promise.allSettled(this.#keyWork.values());
    await Promise.allSettled(this.#baseReads);
    await Promise.allSettled(this.#reaps);
    await Promise.allSettled(this.#sweeps);
    await Promise.allSettled(this.#reconciles);
    await Promise.allSettled(this.#releases.values());
    await this.#retryReservationUnlocks();
  }

  async release(lease: DropletLease, deadline?: number): Promise<Released> {
    const pending = this.#releases.get(lease.lease);
    if (pending) return pending;
    const release = this.#release(lease, deadline).finally(() => { this.#releases.delete(lease.lease); });
    this.#releases.set(lease.lease, release);
    const result = await release;
    if (lease.state === 'released') this.#observer?.endObservation(lease, 'released');
    return result;
  }

  async #release(lease: DropletLease, deadline = Infinity): Promise<Released> {
    await this.#changeLease(lease, async () => {
      const persisted = await readLease(leaseDir(this.root, lease));
      if (persisted.name !== lease.name || persisted.lease !== lease.lease) throw new Error('droplet lease identity changed; refusing release');
      Object.assign(lease, persisted);
      await restoreWatchdogDeletions(leaseDir(this.root, lease), lease);
      if (lease.state === 'released') return;
      lease.state = 'releasing';
      await this.#save(lease);
    });
    if (lease.state === 'released') { await settleSpend(lease, this.#env, this.dependencies.processes); await this.#compactAfterRelease(lease); return { lifetimeMs: lease.lifetimeMs ?? 0, costUsd: lease.costUsd ?? 0 }; }
    if (this.#closing) return { lifetimeMs: null, costUsd: null };
    const limit = Math.min(deadline, this.clock.now().getTime() + testTiming('CLAND_TEST_DROPLET_RELEASE_MS', 15000, this.#env));
    if (limit <= this.clock.now().getTime()) return { lifetimeMs: null, costUsd: null };
    let cause: { status?: number; id?: string; message: string } | undefined;
    do {
      try {
        const result = await deleteLeaseResources((this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock)), lease, limit, attention => {
          this.logger({ event: 'executor-release-identity-recheck', lease: lease.lease, id: lease.resource, attention });
        }, testTiming('CLAND_TEST_DROPLET_DELETE_MS', 300000, this.#env), this.clock, this.dependencies.wait, () => this.#save(lease));
        if (result.confirmed) {
          accountRelease(lease, lease.deleteStarted ?? this.clock.now().toISOString(), this.clock);
          await this.#save(lease);
          await settleSpend(lease, this.#env, this.dependencies.processes);
          await (this.dependencies.host ?? processHost).stopWatchdog(lease, this.#env, this.#watchdogOptions(lease));
          await rm(join(leaseDir(this.root, lease), 'key'), { force: true });
          await rm(join(leaseDir(this.root, lease), 'key.pub'), { force: true });
          await this.#compactAfterRelease(lease);
          this.logger({ event: 'executor-lease-released', lease: lease.lease, id: lease.resource, lifetimeMs: lease.lifetimeMs, costUsd: lease.costUsd });
          return { lifetimeMs: lease.lifetimeMs!, costUsd: lease.costUsd! };
        }
        // Retain the first accepted DELETE across short attempts and restarts.
        await this.#save(lease);
      } catch (error) {
        if (this.#closing) break;
        if (error instanceof DropletIdentityMismatch || error instanceof DropletDeletionTimeout) lease.attention = error.attention;
        cause = error instanceof DigitalOceanError ? { status: error.status, id: error.id, message: error.message }
          : { message: error instanceof Error ? error.message : 'resource cleanup failed' };
        // Identity refusals and permanent provider errors remain for recovery;
        // busy actions, throttling, server errors and transport failures can clear.
        if (!(error instanceof DigitalOceanError) || ![0, 409, 422, 429].includes(error.status) && error.status < 500) break;
        this.logger({ event: 'executor-release-retry', lease: lease.lease, id: lease.resource, cause });
      }
      await this.#wait(Math.min(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, this.#env), Math.max(0, limit - this.clock.now().getTime())));
    } while (this.clock.now().getTime() < limit);
    await this.#save(lease);
    this.logger({ event: 'executor-release-unconfirmed', lease: lease.lease, id: lease.resource, cause, ...(lease.attention ? { attention: lease.attention } : {}) });
    return { lifetimeMs: null, costUsd: null };
  }

  async retireLegacy(confirmed: boolean, authorize: () => void) {
    return retireLegacySpend(confirmed, this.#env, this.clock, this.dependencies.processes, undefined, authorize);
  }

  async inspect() {
    for (;;) {
      const job = this.#prepareJob;
      const jobState = job?.state;
      const snapshot = await readSnapshot(this.root);
      const inspection = snapshot ? await this.#inspectKey() : null;
      const key = inspection?.key;
      const freshness = snapshot && key ? staleParts(snapshot, key) : [];
      // Older clients use this exact incomplete value as their readiness fence.
      const freshnessText = snapshot && !key ? 'unknown (inspection deferred)' : freshness.length ? `stale: ${freshness.join('|')}` : 'current';
      const inspectionReason = snapshot && !key ? inspection?.reason ?? 'local inspection unavailable' : undefined;
      const prepare = this.#prepareJob ? { ...this.#prepareJob, elapsedMs: (this.#prepareJob.finished ? Date.parse(this.#prepareJob.finished) : this.clock.now().getTime()) - Date.parse(this.#prepareJob.started) } : null;
      const snapshotRecovery = await readRecoveries(this.root);
      const token = Boolean(this.#env.DIGITALOCEAN_TOKEN);
      const all = await readLeases(this.root);
      const leases = await Promise.all(all.filter(l => l.state !== 'released').map(async l => ({ name: l.name, id: l.resource, region: l.region, size: l.size, state: l.state, ...(l.attention ? { attention: l.attention } : {}), ageMs: this.clock.now().getTime() - Date.parse(l.created), deadline: l.deadline, watchdogAlive: await within((this.dependencies.host ?? processHost).watchdogAlive(l, this.#env, this.#watchdogOptions(l)), 250, this.clock).catch(() => false) })));
      // Capability 1 promises that every transaction preserves legacyRetired and
      // stops reading/writing the legacy ledger once that marker is activated.
      const spend = { ...await inspectSpend((await this.#config()).verification.dailySpendUsd, this.#env, this.clock, this.dependencies.processes, true), legacyRetirement: 1 as const };
      const todayCostUsd = spend.unknownLeases ? null : spend.spent;
      let taggedDroplets: number | null = this.#taggedDroplets;
      let providerError: string | undefined;
      if (token) try { taggedDroplets = (await within(this.dependencies.api!.droplets('cland'), 250, this.clock)).length; this.#taggedDroplets = taggedDroplets; } catch { providerError = 'provider unavailable or deferred'; }
      // A job may replace/restore the record while provider and Git reads yield.
      // Return a coherent snapshot and terminal job state from the same observation.
      if (job !== this.#prepareJob || jobState !== job?.state) continue;
      const summary = [`executor: ${this.#sweepState}`, snapshot ? `snapshot: ${snapshot.name} image=${snapshot.image} ${freshnessText}${inspectionReason ? ` reason=${inspectionReason}` : ''} local=origin/dev@${inspection?.base.slice(0, 12) || 'unknown'} key=${JSON.stringify({ ...snapshot.key, provision: snapshot.key.provision ?? 'none', lock: snapshot.key.lock ?? 'none' })}` : 'snapshot: none', ...(prepare ? [`prepare: ${prepare.state} ${prepare.step} elapsed=${Math.round(prepare.elapsedMs / 1000)}s`] : []), ...snapshotRecovery.map(record => `snapshot recovery: ${record.name} ${record.phase}`), `token: ${token ? 'present' : 'absent (DIGITALOCEAN_TOKEN)'}`, ...(!leases.length ? ['leases: none'] : leases.map(l => `${l.name} id=${l.id ?? 'pending'} ${l.region} ${l.size} ${l.state} age=${Math.round(l.ageMs / 1000)}s deadline=${l.deadline} watchdog=${l.watchdogAlive ? 'alive' : 'dead'}${l.attention ? `; operator attention: ${l.attention.reason === 'deletion-unconfirmed' ? 'deletion not confirmed' : l.attention.reason === 'deletion-timeout' ? 'deletion confirmation timed out' : `identity mismatch (${l.attention.fields.join(', ')})`}, provider status ${l.attention.observed.status}` : ''}`)), `ledger: ${spend.path}`, `today: spent $${spend.spent.toFixed(4)} + reserved $${spend.reserved.toFixed(4)} / cap $${spend.cap}`, `tagged droplets: ${taggedDroplets ?? providerError ?? 'unavailable'}`].join('\n');
      return { reconciliation: this.#sweepState, spend, snapshotRecovery, snapshot: snapshot ? { ...snapshot, freshness: freshnessText, ...(inspectionReason ? { inspectionReason } : {}) } : null, prepare, token, leases, todayCostUsd, taggedDroplets, ...(providerError ? { providerError } : {}), summary: spend.unknownLeases ? `${summary}\nunknown spend: ${spend.unknownLeases} released leases (excluded from known totals)` : summary };
    }
  }

  /** Restart repair and releasing-only retries. General orphan sweeping belongs to the safety stage. */
  reconcile(restart = true): Promise<void> {
    if (this.#closing) return Promise.resolve();
    const work = this.#reconcile(restart).finally(() => { this.#reconciles.delete(work); });
    this.#reconciles.add(work);
    return work;
  }

  async #reconcile(restart: boolean): Promise<void> {
    await this.#retryReservationUnlocks();
    if (restart) this.#indexRepairNeeded = true;
    if (!await this.#compact(this.#indexRepairNeeded)) return;
    if (this.#closing) return;
    this.#indexRepairNeeded = false;
    await this.#retryShardReleases();
    if (this.#env.DIGITALOCEAN_TOKEN) await rememberProject(this.root, this.#env, this.dependencies.processes, this.clock, this.dependencies.wait, this.#abort.signal);
    type OwnedJob = { id: string; reported: boolean; state?: string; outcome: unknown; shards?: OwnedJob[] };
    const jobs = JSON.parse(this.store?.meta('suite-jobs') ?? '[]') as OwnedJob[];
    const owned = new Set(jobs.filter(job => !job.reported && !job.outcome && job.state !== 'queued').flatMap(job => [job.id, ...(job.shards ?? []).filter(shard => !shard.reported && !shard.outcome).map(shard => shard.id)]));
    const deadline = this.clock.now().getTime() + 15000;
    const leases = await readLeases(this.root);
    await settleSpend(leases, this.#env, this.dependencies.processes);
    for (const lease of leases) {
      if (this.#closing || this.clock.now().getTime() >= deadline) throw new Error('lease recovery deferred at deadline');
      const dir = leaseDir(this.root, lease);
      let receipt: WatchdogReceipt | undefined;
      try { receipt = JSON.parse(await readFile(join(dir, 'watchdog.json'), 'utf8')) as WatchdogReceipt; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (receipt && lease.watchdogFired !== receipt.fired) {
        lease.resource ??= receipt.deleted[0] ?? null;
        accountRelease(lease, receipt.deleteStarted, this.clock);
        lease.released = receipt.confirmedAt;
        await this.#save(lease);
        this.logger({ event: 'executor-watchdog-fired', lease: lease.lease, ...receipt });
        lease.watchdogFired = receipt.fired; await this.#save(lease);
        await settleSpend(lease, this.#env, this.dependencies.processes);
      }
      if (lease.state === 'released') {
        await rm(join(dir, 'key'), { force: true }); await rm(join(dir, 'key.pub'), { force: true });
        continue;
      }
      if (!this.#env.DIGITALOCEAN_TOKEN) continue;
      if (lease.state !== 'releasing' && liveLease(lease, this.clock) && (restart || lease.watchdog) && !await (this.dependencies.host ?? processHost).watchdogAlive(lease, this.#env, this.#watchdogOptions(lease))) {
        let watchdog: NonNullable<DropletLease['watchdog']>;
        try { watchdog = await (this.dependencies.host ?? processHost).armWatchdog(dir, this.#env); }
        catch (error) {
          // A concurrent release can make the child exit during its native
          // birth probe. armWatchdog stops it through its owned handle; no rearm
          // is needed once the durable lease has entered release.
          const current = await readLease(dir);
          if (current.state === 'released' || current.state === 'releasing') continue;
          throw error;
        }
        const rearmed = await this.#changeLease(lease, async () => {
          const current = await readLease(dir);
          const sameWatchdog = current.watchdog?.pid === lease.watchdog?.pid && current.watchdog?.startedUtc === lease.watchdog?.startedUtc && current.watchdog?.pidIdentity === lease.watchdog?.pidIdentity;
          Object.assign(lease, current);
          if (lease.state === 'released' || lease.state === 'releasing' || !sameWatchdog) return false;
          lease.watchdog = watchdog;
          await this.#save(lease);
          return true;
        });
        if (rearmed) this.logger({ event: 'executor-watchdog-rearmed', lease: lease.lease, pid: watchdog.pid, deadline: lease.deadline });
        else await (this.dependencies.host ?? processHost).stopWatchdog({ ...lease, watchdog }, this.#env);
      }
      if (lease.state === 'releasing' || Date.parse(lease.deadline) <= this.clock.now().getTime() || restart && (lease.state === 'active' && !lease.execution && !lease.demo && !owned.has(lease.run) || lease.state === 'creating' && lease.resource === null)) await this.release(lease, deadline);
    }
    if (!this.#closing && this.#prepareJob?.state !== 'running') await recoverSnapshots(this.root, this.store, this.logger, this.#env, boundedProvider(this.dependencies.api!, this.clock, 15000, deadline));
    if (!this.#closing) await recoverPoolSnapshots(this.root, this.logger, this.#env, boundedProvider(this.dependencies.api!, this.clock, 15000, deadline));
    await this.#compact();
  }
  sweep(restart = false): Promise<void> {
    if (this.#closing) return Promise.resolve();
    const work = this.#sweep(restart);
    this.#sweeps.add(work);
    return work.finally(() => { this.#sweeps.delete(work); });
  }

  async #sweep(restart: boolean): Promise<void> {
    this.#sweepState = 'reconciling';
    let reapedDroplets = 0, reapedKeys = 0, failures = 0;
    try { await this.reconcile(restart); } catch { failures++; this.logger({ event: 'executor-reconcile-failed', reason: 'lease recovery deferred' }); }
    try { await sweepProjects(this.#env, this.clock, this.logger, this.dependencies.processes, this.dependencies.wait, this.#abort.signal); } catch { failures++; this.logger({ event: 'executor-reconcile-failed', reason: 'project registry sweep deferred' }); }
    this.#sweepState = 'sweeping';
    if (!this.#closing && this.#env.DIGITALOCEAN_TOKEN) try {
      const result = await this.reap(); reapedDroplets = result.deleted.length; reapedKeys = result.deletedKeys.length;
      failures += (result.unconfirmed?.droplets.length ?? 0) + (result.unconfirmed?.keys.length ?? 0);
    } catch { failures++; this.logger({ event: 'executor-reconcile-failed', reason: 'provider sweep deferred' }); }
    this.#sweepState = failures ? 'deferred' : 'idle';
    this.logger({ event: 'executor-sweep', leases: (await readLeases(this.root)).filter(l => l.state !== 'released').length, reapedDroplets, reapedKeys, failures });
  }
  reap(options?: ReapOptions): Promise<Reaped>;
  /** Compatibility for the hub's existing authorization callback. */
  reap(authorize: () => void): Promise<Reaped>;
  async reap(options: ReapOptions | (() => void) = {}) {
    const authorize = typeof options === 'function' ? options : options.authorize ?? (() => {});
    authorize();
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const work = this.#lockedReap(authorize);
    this.#reaps.add(work);
    try { return await work; }
    finally { this.#reaps.delete(work); }
  }

  async #lockedReap(authorize: () => void): Promise<Reaped> {
    const path = join(this.root, '.cland/run/executor/reap.lock');
    await runDirectory(this.root, join(this.root, '.cland/run/executor'));
    const lock = await acquireLockWithRetry(path, this.clock.now().getTime() + 15000, { signal: this.#abort.signal, clock: this.clock, wait: this.dependencies.wait, ...(this.dependencies.processes ? { processes: this.dependencies.processes } : {}) });
    try { return await this.#reap(authorize); }
    finally { await lock.release(); }
  }

  async #reap(authorize: () => void): Promise<Reaped> {
    const config = await this.#config();
    const tag = projectTag(this.root, config.name);
    const deadline = this.clock.now().getTime() + 15000;
    const api = boundedProvider(this.dependencies.api!, this.clock, 15000, deadline);
    const pendingPath = join(this.root, '.cland/run/executor/reap-pending.json');
    const pending: { droplets: Droplet[]; keys: Key[] } = await readFile(pendingPath, 'utf8').then(text => JSON.parse(text)).catch(error => {
      if (error.code === 'ENOENT') return { droplets: [], keys: [] };
      throw error;
    });
    const checkpoint = () => durableJson(pendingPath, pending);
    const deleted: number[] = [];
    const unconfirmed = { droplets: [] as number[], keys: [] as number[] };
    const droplets = await api.droplets('cland');
    this.#taggedDroplets = droplets.length;
    const defer = (kind: 'droplet' | 'key', id: number) => {
      (kind === 'droplet' ? unconfirmed.droplets : unconfirmed.keys).push(id);
      this.logger({ event: 'executor-reap-unconfirmed', kind, id });
    };
    for (const droplet of new Map([...droplets, ...pending.droplets].map(row => [row.id, row])).values()) {
      const retained = pending.droplets.some(row => row.id === droplet.id);
      if (retained) {
        try {
          const current = await api.droplet(droplet.id);
          if (current.id !== droplet.id || current.name !== droplet.name || !droplet.tags.every(tag => current.tags.includes(tag))) { defer('droplet', droplet.id); continue; }
        } catch (error) { if (!(error instanceof DigitalOceanError) || error.status !== 404) throw error; }
      }
      if (this.#closing) throw new Error('provider sweep deferred during shutdown');
      if (!droplet.tags.includes('cland')) continue;
      // Acquire persists ownership before its provider mutation. Read it after
      // the provider list (and after any previous deletion awaits), never before.
      const known = await hostLeases(this.root, this.#env, this.dependencies.processes);
      // A renamed/retagged known resource is an identity refusal, not an
      // orphan. Keep it for operator attention even after its deadline.
      if (known.some(lease => lease.state !== 'released' && lease.resource === droplet.id && !matchesLease(droplet, lease))) { if (retained) defer('droplet', droplet.id); continue; }
      const owner = known.find(lease => matchesLease(droplet, lease));
      if (known.some(lease => matchesLease(droplet, lease) && liveLease(lease, this.clock))) { if (retained) defer('droplet', droplet.id); continue; }
      const age = this.clock.now().getTime() - Date.parse(droplet.created_at);
      const deadline = owner ? Date.parse(owner.deadline) : Date.parse(droplet.created_at) + config.verification.lifetimeMs;
      const reason = retained ? 'pending deletion' : droplet.tags.includes(tag) ? 'no live lease' : this.clock.now().getTime() > deadline + 600000 ? 'past lifetime' : null;
      if (!reason) { if (retained) defer('droplet', droplet.id); continue; }
      if (!retained) { pending.droplets.push(droplet); await checkpoint(); }
      authorize();
      try { await api.deleteDroplet(droplet.id); }
      catch (error) {
        if (!(error instanceof DeletionUnconfirmed)) throw error;
        defer('droplet', droplet.id);
        continue;
      }
      pending.droplets = pending.droplets.filter(row => row.id !== droplet.id);
      await checkpoint();
      deleted.push(droplet.id);
      this.logger({ event: 'executor-reaped', id: droplet.id, name: droplet.name, age, reason });
    }
    const deletedKeys: number[] = [];
    const keys = await api.keys();
    for (const key of new Map([...keys, ...pending.keys].map(row => [row.id, row])).values()) {
      const retained = pending.keys.some(row => row.id === key.id);
      if (retained) {
        try {
          const current = await api.key(key.id);
          if (current.id !== key.id || current.name !== key.name || current.public_key !== key.public_key) { defer('key', key.id); continue; }
        } catch (error) { if (!(error instanceof DigitalOceanError) || error.status !== 404) throw error; }
      }
      if (this.#closing) throw new Error('provider sweep deferred during shutdown');
      const known = await hostLeases(this.root, this.#env, this.dependencies.processes);
      // Provider lists and lease updates can observe opposite sides of a rename.
      if (known.some(lease => liveLease(lease, this.clock) && (lease.keyName === key.name || lease.keyId === key.id))) { if (retained) defer('key', key.id); continue; }
      const legacy = key.name.startsWith(`cland-${projectName(config.name)}-`);
      const oldLease = known.find(lease => lease.keyName === key.name);
      // DO's key object has no creation time: an unaged legacy key stays untouched.
      const oldEnough = oldLease && this.clock.now().getTime() - Date.parse(oldLease.keyImportStarted ?? oldLease.created) > config.verification.lifetimeMs + 600000;
      if (!retained && !key.name.startsWith(`${tag}-`) && !(legacy && oldEnough)) continue;
      if (!retained) { pending.keys.push(key); await checkpoint(); }
      authorize();
      try { await api.deleteKey(key.id); }
      catch (error) {
        if (!(error instanceof DeletionUnconfirmed)) throw error;
        defer('key', key.id);
        continue;
      }
      pending.keys = pending.keys.filter(row => row.id !== key.id);
      await checkpoint();
      deletedKeys.push(key.id);
    }
    const hasPending = unconfirmed.droplets.length + unconfirmed.keys.length > 0;
    return { deleted, deletedKeys, ...(hasPending ? { unconfirmed } : {}), summary: `reaped: ${deleted.length} droplets${deletedKeys.length ? `, ${deletedKeys.length} keys` : ''}${hasPending ? `; unconfirmed droplets: ${unconfirmed.droplets.join(', ') || 'none'}; keys: ${unconfirmed.keys.join(', ') || 'none'}; run reap again` : ''}` };
  }
}

export const projectName = (name: string): string => name.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40) || 'project';
export const projectTag = (root: string, name: string): string => `cland-p-${createHash('sha256').update(`${realpathSync(root)}\0${name}`).digest('hex').slice(0, 12)}`;
