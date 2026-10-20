import { boundedProvider, within } from './deadline.ts';
import { realClock, type Clock } from '../../hub/clock.ts';
import { processHost, type DropletDependencies } from './dependencies.ts';
import { acquireLockWithRetry } from '../../hub/lock.ts';
import type { Store } from '../../hub/store.ts';
import type { LogFn } from '../../log.ts';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { basename } from 'node:path';
import { realpathSync } from 'node:fs';
import { defaultConfig, parseConfig, type ProjectConfig } from '../../init/config.ts';
import { DigitalOceanApi, DigitalOceanError, apiTimeoutMs } from './api.ts';
import { accountRelease, durableJson, leaseDir, liveLease, matchesLease, readLease, readLeases, writeLease, type DropletLease, type WatchdogReceipt } from './lease.ts';
import { pause, testTiming } from './watchdog.ts';
import { deleteLeaseResources, DropletIdentityMismatch, DropletDeletionTimeout } from './cleanup.ts';
import { readRecoveries, recoverSnapshots } from './snapshot-recovery.ts';
import { prepareKey, prepareSnapshot, readSnapshot, staleParts, sameKey, waitForMachine, type PrepareKey, type Prepared } from './prepare.ts';
import { hostLeases, inspectSpend, rememberProject, reserveSpend, settleSpend, reserveShardSpend, releaseShardSpend, retireLegacySpend } from './spend.ts';
import { DropletRun } from './run.ts';
import type { Executor, Released, RunRef } from '../executor.ts';

type PrepareJob = { state: 'running' | 'done' | 'failed'; started: string; finished?: string; step: string; key?: PrepareKey; result?: Prepared; error?: string };

export class RemoteBudgetFull extends Error {
  constructor() { super('remote budget full'); }
}

/** Owns the project's durable droplet lifecycle, independently of suite delivery. */
export class DropletExecutor implements Pick<Executor, 'acquire' | 'deliver' | 'start' | 'status' | 'log' | 'cancel' | 'release'> {
  readonly root: string;
  readonly store: Store | undefined;
  readonly logger: LogFn;
  #prepareJob: PrepareJob | null = null;
  #prepareWork: Promise<void> | null = null;
  #prepareAbort: AbortController | null = null;
  #closing = false;
  #sweepState: 'idle' | 'reconciling' | 'sweeping' | 'deferred' = 'idle';
  #taggedDroplets: number | null = null;
  #keyWork: Promise<PrepareKey> | null = null;
  readonly #releases = new Map<string, Promise<Released>>();
  readonly #leaseChanges = new Map<string, Promise<unknown>>();
  readonly #env: NodeJS.ProcessEnv;
  readonly clock: Clock;
  readonly dependencies: DropletDependencies;
  readonly projectConfig: (() => ProjectConfig) | undefined;
  constructor(root: string, store?: Store, log: LogFn = () => {}, env: NodeJS.ProcessEnv = process.env, projectConfig?: () => ProjectConfig, dependencies: DropletDependencies = {}) { this.clock = dependencies.clock ?? realClock; this.dependencies = { ...dependencies, api: boundedProvider(dependencies.api ?? new DigitalOceanApi(env, this.clock), this.clock, apiTimeoutMs(env)) }; this.projectConfig = projectConfig; this.root = realpathSync(root); this.store = store; this.logger = log; this.#env = env; }

  #wait(ms: number): Promise<void> { return this.dependencies.wait?.(ms) ?? pause(ms, this.clock); }

  async #config() {
    if (this.projectConfig) return this.projectConfig();
    try { return parseConfig(await readFile(join(this.root, '.cland/config.toml'), 'utf8'), basename(this.root), this.#env); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultConfig(basename(this.root)); throw error; }
  }

  // The scheduler reserves launching jobs; the provider boundary also counts
  // durable leases left by preparation, restarts or unconfirmed acquire cleanup.
  async #reserve(lease: DropletLease, budget: number, deadline: number): Promise<void> {
    const path = join(this.root, '.cland/run/executor/budget.lock');
    const lock = await acquireLockWithRetry(path, deadline, { clock: this.clock, wait: this.dependencies.wait, ...(this.dependencies.processes ? { processes: this.dependencies.processes } : {}) });
    try {
      if ((await readLeases(this.root)).filter(l => l.state !== 'released').length >= budget) throw new RemoteBudgetFull();
      await this.#save(lease);
    } finally { await lock.release(); }
  }

  async #save(lease: DropletLease): Promise<void> {
    await writeLease(this.root, lease);
    this.store?.setMeta('executor-leases', JSON.stringify(await readLeases(this.root)));
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

  async deliver(lease: DropletLease, run: RunRef, committedOnly = false) { return (this.dependencies.run ?? new DropletRun(this.root, this.#env, this.dependencies)).deliver(lease, run, committedOnly); }
  async start(lease: DropletLease, _run: RunRef) { return (this.dependencies.run ?? new DropletRun(this.root, this.#env, this.dependencies)).start(lease); }
  async status(lease: DropletLease) { return (this.dependencies.run ?? new DropletRun(this.root, this.#env, this.dependencies)).status(lease); }
  async log(lease: DropletLease, offset: number) { return (this.dependencies.run ?? new DropletRun(this.root, this.#env, this.dependencies)).log(lease, offset); }
  async cancel(lease: DropletLease, _signal: string) { return (this.dependencies.run ?? new DropletRun(this.root, this.#env, this.dependencies)).cancel(lease); }
  async collectCoverage(lease: DropletLease, path: string) { return (this.dependencies.run ?? new DropletRun(this.root, this.#env, this.dependencies)).collectCoverage(lease, path); }

  /** Refuse an unsupported per-run size before the request enters the queue. */
  async validateSize(size: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    const api = (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock));
    const selected = (await api.sizes()).find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    const regions = await api.regions();
    if (!config.verification.droplet.regions.some(region => selected.regions.includes(region) && regions.some(r => r.slug === region && r.available && r.sizes.includes(size)))) throw new Error(`droplet size ${size} unavailable in configured regions`);
  }

  async reserveShards(runs: string[], overrideSize?: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    if (!await readSnapshot(this.root)) throw new Error('no prepared snapshot; run cland executor prepare');
    const size = overrideSize ?? config.verification.droplet.size;
    const selected = (await (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock)).sizes()).find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    await reserveShardSpend(this.root, runs, size, selected.price_hourly, testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env), config.verification.dailySpendUsd, this.#env, this.clock, this.dependencies.processes);
  }
  async releaseShardReservations(runs: string[]): Promise<void> {
    // Synthetic reservations have no lease for settleSpend to recover. Persist
    // their release intent before the parent is allowed to finish reporting.
    const directory = join(this.root, '.cland/run/executor/shard-releases');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    runs = [...new Set(runs)].sort();
    const path = join(directory, `${createHash('sha256').update(JSON.stringify(runs)).digest('hex')}.json`);
    await durableJson(path, runs);
    await this.#finishShardRelease(path, runs);
  }

  async #finishShardRelease(path: string, runs: string[]): Promise<void> {
    try { await releaseShardSpend(this.root, runs, this.#env, this.clock, this.dependencies.processes); }
    catch (error) {
      this.logger({ event: 'executor-shard-reservations-deferred', runs, error: String(error) });
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

  /** Submission check only; acquire still reserves atomically against other hubs. */
  async checkSpend(overrideSize?: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const size = overrideSize ?? config.verification.droplet.size;
    const selected = (await (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock)).sizes()).find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    const lifetime = testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env);
    const reservation = Math.max(60000, lifetime) / 3600000 * selected.price_hourly;
    const { spent, reserved, cap } = await inspectSpend(config.verification.dailySpendUsd, this.#env, this.clock, this.dependencies.processes);
    if (spent + reserved + reservation > cap) throw new Error(`daily spend cap $${cap} reached`);
  }

  async acquire(run: Pick<RunRef, 'id' | 'size'>, deadline: string, demo?: DropletLease['demo'], snapshotConfig?: ProjectConfig): Promise<DropletLease> {
    const config = snapshotConfig ?? await this.#config();
    const runDeadline = Date.parse(deadline);
    if (!Number.isFinite(runDeadline) || runDeadline <= this.clock.now().getTime()) throw new Error('droplet acquisition deadline reached');
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const snapshot = await readSnapshot(this.root);
    if (!snapshot) throw new Error('no prepared snapshot; run cland executor prepare');
    const lease = await this.#acquire(run, deadline, { size: run.size ?? config.verification.droplet.size, regions: config.verification.droplet.regions.filter(region => snapshot.regions.includes(region)), image: snapshot.image, minDiskSize: snapshot.minDiskSize, ...(demo ? { demo } : {}) }, config);
    try {
      lease.snapshot = snapshot;
      await this.#save(lease);
      await waitForMachine(this.root, lease, snapshot.key, undefined, undefined, this.#env, this.dependencies);
      return lease;
    }
    catch (error) { await this.release(lease); throw error; }
  }

  async #acquire(run: Pick<RunRef, 'id'>, deadline: string, input: { size: string; regions: string[]; image: string | number; minDiskSize?: number; user_data?: string; demo?: DropletLease['demo'] }, config: ProjectConfig): Promise<DropletLease> {
    const runDeadline = Date.parse(deadline);
    const api = (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock));
    const { size, regions, image } = input;
    const sizes = await api.sizes(runDeadline);
    const selected = sizes.find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    if (input.minDiskSize !== undefined && (!Number.isFinite(selected.disk) || selected.disk! < input.minDiskSize)) throw new Error(`prepared snapshot disk does not fit size ${size}`);
    const offered = await api.regions(runDeadline);
    const region = regions.find(r => selected.regions.includes(r) && offered.some(o => o.slug === r && o.available && o.sizes.includes(size)));
    if (!region) throw new Error(`droplet size ${size} unavailable in regions ${regions.join(', ')}`);
    const created = this.clock.now().toISOString();
    const id = randomUUID();
    const name = `cland-${projectName(config.name)}-${id.replace(/-/g, '').slice(0, 8)}`;
    const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: id, run: run.id, name, tags: ['cland', projectTag(this.root, config.name)], size, region, priceHourly: selected.price_hourly, keyName: `${projectTag(this.root, config.name)}-${id.replace(/-/g, '').slice(0, 8)}`, created,
      ...(input.demo ? { demo: input.demo } : {}), deadline: new Date(Math.min(input.demo ? runDeadline : Infinity, Date.parse(created) + testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env))).toISOString(), state: 'creating', resource: null, keyId: null };
    const dir = leaseDir(this.root, lease);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    try {
      await (this.dependencies.host ?? processHost).createKey(dir, name, this.#env);
      await this.#reserve(lease, config.verification.remoteBudget, runDeadline);
      await reserveSpend(this.root, lease, config.verification.dailySpendUsd, this.#env, this.clock, this.dependencies.wait, this.dependencies.processes);
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
      lease.createStarted = this.clock.now().toISOString();
      await this.#save(lease);
      const droplet = await api.create({ name, tags: lease.tags, size, region, image, ssh_keys: [key.id], ...(input.user_data ? { user_data: input.user_data } : {}) }, limit);
      lease.createFinished = this.clock.now().toISOString();
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
      await this.#save(lease);
      await this.release(lease);
      throw error;
    }
  }

  #key(): Promise<PrepareKey> {
    this.#keyWork ??= (this.dependencies.prepareKey ?? prepareKey)(this.root, this.#env).finally(() => { this.#keyWork = null; });
    return this.#keyWork;
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
    }, error => {
      job.state = 'failed'; job.finished = this.clock.now().toISOString(); job.error = error instanceof Error ? error.message : 'snapshot preparation failed';
      const durationMs = this.clock.now().getTime() - Date.parse(job.started);
      if (job.step === 'key') this.logger({ event: 'executor-prepare-failed', key: job.key ?? null, image: null, regions: [], durationMs, lifetimeMs: 0, costUsd: 0, cause: job.error });
      report(`snapshot prepare failed: ${job.error}\nkey ${JSON.stringify(job.key ?? null)}; image none; duration ${Math.round(durationMs / 1000)}s`);
    }).finally(() => { this.#prepareWork = null; this.#prepareAbort = null; });
    return { state: 'submitted', summary: 'snapshot preparation submitted; see cland executor status' };
  }

  async prepare(key: PrepareKey, step: (step: string) => void = () => {}): Promise<Prepared> {
    const recoveries = await readRecoveries(this.root);
    if (recoveries.some(record => record.phase !== 'cleanup' || record.requested && record.actionState !== 'completed' && record.actionState !== 'errored')) throw new Error('snapshot recovery pending; see cland executor status');
    const config = await this.#config();
    const { prepare_size, size, regions, image } = config.verification.droplet;
    const current = await readSnapshot(this.root);
    if (current && sameKey(current.key, key)) return prepareSnapshot({ dependencies: this.dependencies, env: this.#env, root: this.root, prepare: config.verification.prepare, project: projectName(config.name), regions, tags: [], key, store: this.store, log: this.logger, signal: this.#prepareAbort?.signal, step, builder: async () => { throw new Error('current snapshot needs no builder'); }, release: lease => this.release(lease) });
    const sizes = await (this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock)).sizes();
    const builder = sizes.find(s => s.slug === prepare_size && s.available);
    const run = sizes.find(s => s.slug === size && s.available);
    if (!builder || !run || !Number.isFinite(builder.disk) || !Number.isFinite(run.disk)) throw new Error('prepare_size and size need available disks');
    if (builder.disk! > run.disk!) throw new Error(`verification.droplet.prepare_size ${prepare_size} disk exceeds run size ${size}`);
    return prepareSnapshot({ dependencies: this.dependencies, env: this.#env, root: this.root, prepare: config.verification.prepare, project: projectName(config.name), regions, tags: ['cland', projectTag(this.root, config.name)], key, maxDiskSize: run.disk!, store: this.store, log: this.logger, signal: this.#prepareAbort?.signal, step,
      builder: user_data => this.#acquire({ id: 'executor-prepare' }, new Date(this.clock.now().getTime() + config.verification.lifetimeMs).toISOString(), { size: prepare_size, regions, image, user_data }, config), release: lease => this.release(lease) });
  }

  async close(): Promise<void> {
    this.#closing = true; this.#prepareAbort?.abort();
    await this.#prepareWork;
  }

  async release(lease: DropletLease, deadline?: number): Promise<Released> {
    const pending = this.#releases.get(lease.lease);
    if (pending) return pending;
    const release = this.#release(lease, deadline).finally(() => { this.#releases.delete(lease.lease); });
    this.#releases.set(lease.lease, release);
    return release;
  }

  async #release(lease: DropletLease, deadline = Infinity): Promise<Released> {
    await this.#changeLease(lease, async () => {
      const persisted = await readLease(leaseDir(this.root, lease));
      if (persisted.name !== lease.name || persisted.lease !== lease.lease) throw new Error('droplet lease identity changed; refusing release');
      Object.assign(lease, persisted);
      if (lease.state === 'released') return;
      lease.state = 'releasing';
      await this.#save(lease);
    });
    if (lease.state === 'released') { await settleSpend(lease, this.#env, this.dependencies.processes); return { lifetimeMs: lease.lifetimeMs ?? 0, costUsd: lease.costUsd ?? 0 }; }
    const limit = Math.min(deadline, this.clock.now().getTime() + testTiming('CLAND_TEST_DROPLET_RELEASE_MS', 15000, this.#env));
    if (limit <= this.clock.now().getTime()) return { lifetimeMs: null, costUsd: null };
    let cause: { status?: number; id?: string; message: string } | undefined;
    do {
      try {
        const result = await deleteLeaseResources((this.dependencies.api ?? new DigitalOceanApi(this.#env, this.clock)), lease, limit, attention => {
          this.logger({ event: 'executor-release-identity-recheck', lease: lease.lease, id: lease.resource, attention });
        }, testTiming('CLAND_TEST_DROPLET_DELETE_MS', 300000, this.#env), this.clock, this.dependencies.wait);
        delete lease.attention;
        if (result.confirmed) {
          accountRelease(lease, lease.deleteStarted ?? this.clock.now().toISOString(), this.clock);
          await this.#save(lease);
          await settleSpend(lease, this.#env, this.dependencies.processes);
          await (this.dependencies.host ?? processHost).stopWatchdog(lease, this.#env);
          await rm(join(leaseDir(this.root, lease), 'key'), { force: true });
          await rm(join(leaseDir(this.root, lease), 'key.pub'), { force: true });
          this.logger({ event: 'executor-lease-released', lease: lease.lease, id: lease.resource, lifetimeMs: lease.lifetimeMs, costUsd: lease.costUsd });
          return { lifetimeMs: lease.lifetimeMs!, costUsd: lease.costUsd! };
        }
        // Retain the first accepted DELETE across short attempts and restarts.
        await this.#save(lease);
      } catch (error) {
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
      const key = snapshot ? await within(this.#key(), 250, this.clock).catch(() => null) : null;
      const freshness = snapshot && key ? staleParts(snapshot, key) : [];
      const freshnessText = snapshot && !key ? 'unknown (inspection deferred)' : freshness.length ? `stale: ${freshness.join('|')}` : 'current';
      const prepare = this.#prepareJob ? { ...this.#prepareJob, elapsedMs: (this.#prepareJob.finished ? Date.parse(this.#prepareJob.finished) : this.clock.now().getTime()) - Date.parse(this.#prepareJob.started) } : null;
      const snapshotRecovery = await readRecoveries(this.root);
      const token = Boolean(this.#env.DIGITALOCEAN_TOKEN);
      const all = await readLeases(this.root);
      const leases = await Promise.all(all.filter(l => l.state !== 'released').map(async l => ({ name: l.name, id: l.resource, region: l.region, size: l.size, state: l.state, ...(l.attention ? { attention: l.attention } : {}), ageMs: this.clock.now().getTime() - Date.parse(l.created), deadline: l.deadline, watchdogAlive: await within((this.dependencies.host ?? processHost).watchdogAlive(l, this.#env), 250, this.clock).catch(() => false) })));
      // Capability 1 promises that every transaction preserves legacyRetired and
      // stops reading/writing the legacy ledger once that marker is activated.
      const spend = { ...await inspectSpend((await this.#config()).verification.dailySpendUsd, this.#env, this.clock, this.dependencies.processes, true), legacyRetirement: 1 as const };
      const todayCostUsd = spend.spent;
      let taggedDroplets: number | null = this.#taggedDroplets;
      let providerError: string | undefined;
      if (token) try { taggedDroplets = (await within(this.dependencies.api!.droplets('cland'), 250, this.clock)).length; this.#taggedDroplets = taggedDroplets; } catch { providerError = 'provider unavailable or deferred'; }
      // A job may replace/restore the record while provider and Git reads yield.
      // Return a coherent snapshot and terminal job state from the same observation.
      if (job !== this.#prepareJob || jobState !== job?.state) continue;
      const summary = [`executor: ${this.#sweepState}`, snapshot ? `snapshot: ${snapshot.name} image=${snapshot.image} ${freshnessText} key=${JSON.stringify({ ...snapshot.key, nvim: snapshot.key.nvim ?? 'none', lock: snapshot.key.lock ?? 'none' })}` : 'snapshot: none', ...(prepare ? [`prepare: ${prepare.state} ${prepare.step} elapsed=${Math.round(prepare.elapsedMs / 1000)}s`] : []), ...snapshotRecovery.map(record => `snapshot recovery: ${record.name} ${record.phase}`), `token: ${token ? 'present' : 'absent (DIGITALOCEAN_TOKEN)'}`, ...(!leases.length ? ['leases: none'] : leases.map(l => `${l.name} id=${l.id ?? 'pending'} ${l.region} ${l.size} ${l.state} age=${Math.round(l.ageMs / 1000)}s deadline=${l.deadline} watchdog=${l.watchdogAlive ? 'alive' : 'dead'}${l.attention ? `; operator attention: ${l.attention.reason === 'deletion-timeout' ? 'deletion confirmation timed out' : `identity mismatch (${l.attention.fields.join(', ')})`}, provider status ${l.attention.observed.status}` : ''}`)), `ledger: ${spend.path}`, `today: spent $${spend.spent.toFixed(4)} + reserved $${spend.reserved.toFixed(4)} / cap $${spend.cap}`, `tagged droplets: ${taggedDroplets ?? providerError ?? 'unavailable'}`].join('\n');
      return { reconciliation: this.#sweepState, spend, snapshotRecovery, snapshot: snapshot ? { ...snapshot, freshness: freshnessText } : null, prepare, token, leases, todayCostUsd, taggedDroplets, ...(providerError ? { providerError } : {}), summary };
    }
  }

  /** Restart repair and releasing-only retries. General orphan sweeping belongs to the safety stage. */
  async reconcile(restart = true): Promise<void> {
    await this.#retryShardReleases();
    if (this.#env.DIGITALOCEAN_TOKEN) await rememberProject(this.root, this.#env, this.dependencies.processes, this.clock, this.dependencies.wait);
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
      if (lease.state !== 'releasing' && liveLease(lease, this.clock) && (restart || lease.watchdog) && !await (this.dependencies.host ?? processHost).watchdogAlive(lease, this.#env)) {
        const watchdog = await (this.dependencies.host ?? processHost).armWatchdog(dir, this.#env);
        const rearmed = await this.#changeLease(lease, async () => {
          const current = await readLease(dir);
          const sameWatchdog = current.watchdog?.pid === lease.watchdog?.pid && current.watchdog?.startedUtc === lease.watchdog?.startedUtc;
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
    this.store?.setMeta('executor-leases', JSON.stringify(await readLeases(this.root)));
  }
  async sweep(restart = false): Promise<void> {
    if (this.#closing) return;
    this.#sweepState = 'reconciling';
    let reapedDroplets = 0, reapedKeys = 0, failures = 0;
    try { await this.reconcile(restart); } catch { failures++; this.logger({ event: 'executor-reconcile-failed', reason: 'lease recovery deferred' }); }
    this.#sweepState = 'sweeping';
    if (!this.#closing && this.#env.DIGITALOCEAN_TOKEN) try {
      const result = await this.reap(); reapedDroplets = result.deleted.length; reapedKeys = result.deletedKeys.length;
    } catch { failures++; this.logger({ event: 'executor-reconcile-failed', reason: 'provider sweep deferred' }); }
    this.#sweepState = failures ? 'deferred' : 'idle';
    this.logger({ event: 'executor-sweep', leases: (await readLeases(this.root)).filter(l => l.state !== 'released').length, reapedDroplets, reapedKeys, failures });
  }
  async reap(authorize: () => void = () => {}) {
    authorize();
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const config = await this.#config();
    const tag = projectTag(this.root, config.name);
    const deadline = this.clock.now().getTime() + 15000;
    const api = boundedProvider(this.dependencies.api!, this.clock, 15000, deadline);
    const deleted: number[] = [];
    const droplets = await api.droplets('cland');
    this.#taggedDroplets = droplets.length;
    for (const droplet of droplets) {
      if (this.#closing) throw new Error('provider sweep deferred during shutdown');
      if (!droplet.tags.includes('cland')) continue;
      // Acquire persists ownership before its provider mutation. Read it after
      // the provider list (and after any previous deletion awaits), never before.
      const known = await hostLeases(this.root, this.#env, this.dependencies.processes);
      // A renamed/retagged known resource is an identity refusal, not an
      // orphan. Keep it for operator attention even after its deadline.
      if (known.some(lease => lease.state !== 'released' && lease.resource === droplet.id && !matchesLease(droplet, lease))) continue;
      const owner = known.find(lease => matchesLease(droplet, lease));
      if (known.some(lease => matchesLease(droplet, lease) && liveLease(lease, this.clock))) continue;
      const age = this.clock.now().getTime() - Date.parse(droplet.created_at);
      const deadline = owner ? Date.parse(owner.deadline) : Date.parse(droplet.created_at) + config.verification.lifetimeMs;
      const reason = droplet.tags.includes(tag) ? 'no live lease' : this.clock.now().getTime() > deadline + 600000 ? 'past lifetime' : null;
      if (!reason) continue;
      authorize();
      await api.deleteDroplet(droplet.id);
      const limit = this.clock.now().getTime() + testTiming('CLAND_TEST_DROPLET_RELEASE_MS', 15000, this.#env);
      let stillListed;
      do {
        stillListed = (await api.droplets('cland')).some(d => d.id === droplet.id);
        if (stillListed) await this.#wait(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, this.#env));
      } while (stillListed && this.clock.now().getTime() < limit);
      if (stillListed) throw new Error(`droplet ${droplet.id} deletion not yet confirmed; run reap again`);
      deleted.push(droplet.id);
      this.logger({ event: 'executor-reaped', id: droplet.id, name: droplet.name, age, reason });
    }
    const deletedKeys: number[] = [];
    for (const key of await api.keys()) {
      if (this.#closing) throw new Error('provider sweep deferred during shutdown');
      const known = await hostLeases(this.root, this.#env, this.dependencies.processes);
      // Provider lists and lease updates can observe opposite sides of a rename.
      if (known.some(lease => liveLease(lease, this.clock) && (lease.keyName === key.name || lease.keyId === key.id))) continue;
      const legacy = key.name.startsWith(`cland-${projectName(config.name)}-`);
      const oldLease = known.find(lease => lease.keyName === key.name);
      // DO's key object has no creation time: an unaged legacy key stays untouched.
      const oldEnough = oldLease && this.clock.now().getTime() - Date.parse(oldLease.keyImportStarted ?? oldLease.created) > config.verification.lifetimeMs + 600000;
      if (!key.name.startsWith(`${tag}-`) && !(legacy && oldEnough)) continue;
      authorize(); await api.deleteKey(key.id); deletedKeys.push(key.id);
    }
    return { deleted, deletedKeys, summary: `reaped: ${deleted.length} droplets` };
  }
}

export const projectName = (name: string): string => name.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40) || 'project';
export const projectTag = (root: string, name: string): string => `cland-p-${createHash('sha256').update(`${realpathSync(root)}\0${name}`).digest('hex').slice(0, 12)}`;
