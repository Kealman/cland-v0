import { acquireLockAsync, HubLocked } from '../../hub/lock.ts';
import type { Store } from '../../hub/store.ts';
import type { LogFn } from '../../log.ts';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { basename } from 'node:path';
import { realpathSync } from 'node:fs';
import { defaultConfig, parseConfig, type ProjectConfig } from '../../init/config.ts';
import { DigitalOceanApi, DigitalOceanError } from './api.ts';
import { accountRelease, leaseDir, liveLease, matchesLease, readLease, readLeases, writeLease, type DropletLease, type WatchdogReceipt } from './lease.ts';
import { armWatchdog, pause, stopWatchdog, testTiming, watchdogAlive } from './watchdog.ts';
import { deleteLeaseResources, DropletIdentityMismatch } from './cleanup.ts';
import { readRecoveries, recoverSnapshots } from './snapshot-recovery.ts';
import { machineEnv } from './machine.ts';
import { prepareKey, prepareSnapshot, readSnapshot, staleParts, sameKey, waitForMachine, type PrepareKey, type Prepared } from './prepare.ts';
import { hostLeases, inspectSpend, rememberProject, reserveSpend, settleSpend, reserveShardSpend, releaseShardSpend } from './spend.ts';
import { DropletRun } from './run.ts';
import type { Executor, Released, RunRef } from '../executor.ts';

const exec = promisify(execFile);
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
  #keyWork: Promise<PrepareKey> | null = null;
  readonly #releases = new Map<string, Promise<Released>>();
  readonly #leaseChanges = new Map<string, Promise<unknown>>();
  readonly #env: NodeJS.ProcessEnv;
  readonly projectConfig: (() => ProjectConfig) | undefined;
  constructor(root: string, store?: Store, log: LogFn = () => {}, env: NodeJS.ProcessEnv = process.env, projectConfig?: () => ProjectConfig) { this.projectConfig = projectConfig; this.root = realpathSync(root); this.store = store; this.logger = log; this.#env = env; }

  async #config() {
    if (this.projectConfig) return this.projectConfig();
    try { return parseConfig(await readFile(join(this.root, '.cland/config.toml'), 'utf8'), basename(this.root), this.#env); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultConfig(basename(this.root)); throw error; }
  }

  // The scheduler reserves launching jobs; the provider boundary also counts
  // durable leases left by preparation, restarts or unconfirmed acquire cleanup.
  async #reserve(lease: DropletLease, budget: number, deadline: number): Promise<void> {
    const path = join(this.root, '.cland/run/executor/budget.lock');
    for (;;) {
      let lock;
      try { lock = await acquireLockAsync(path, undefined, deadline, 'UTC'); }
      catch (error) { if (!(error instanceof HubLocked) || Date.now() >= deadline) throw error; await pause(25); continue; }
      try {
        if ((await readLeases(this.root)).filter(l => l.state !== 'released').length >= budget) throw new RemoteBudgetFull();
        await this.#save(lease);
        return;
      } finally { await lock.release(); }
    }
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

  async deliver(lease: DropletLease, run: RunRef) { return new DropletRun(this.root, this.#env).deliver(lease, run); }
  async start(lease: DropletLease, _run: RunRef) { return new DropletRun(this.root, this.#env).start(lease); }
  async status(lease: DropletLease) { return new DropletRun(this.root, this.#env).status(lease); }
  async log(lease: DropletLease, offset: number) { return new DropletRun(this.root, this.#env).log(lease, offset); }
  async cancel(lease: DropletLease, _signal: string) { return new DropletRun(this.root, this.#env).cancel(lease); }
  async collectCoverage(lease: DropletLease, path: string) { return new DropletRun(this.root, this.#env).collectCoverage(lease, path); }

  /** Refuse an unsupported per-run size before the request enters the queue. */
  async validateSize(size: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    const api = new DigitalOceanApi(this.#env);
    const selected = (await api.sizes()).find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    const regions = await api.regions();
    if (!config.verification.droplet.regions.some(region => selected.regions.includes(region) && regions.some(r => r.slug === region && r.available && r.sizes.includes(size)))) throw new Error(`droplet size ${size} unavailable in configured regions`);
  }

  async reserveShards(runs: string[], overrideSize?: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    if (!await readSnapshot(this.root)) throw new Error('no prepared snapshot; run cland executor prepare');
    const size = overrideSize ?? config.verification.droplet.size;
    const selected = (await new DigitalOceanApi(this.#env).sizes()).find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    await reserveShardSpend(this.root, runs, size, selected.price_hourly, testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env), config.verification.dailySpendUsd, this.#env);
  }
  async releaseShardReservations(runs: string[]): Promise<void> { await releaseShardSpend(this.root, runs, this.#env); }

  /** Submission check only; acquire still reserves atomically against other hubs. */
  async checkSpend(overrideSize?: string, snapshot?: ProjectConfig): Promise<void> {
    const config = snapshot ?? await this.#config();
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const size = overrideSize ?? config.verification.droplet.size;
    const selected = (await new DigitalOceanApi(this.#env).sizes()).find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    const lifetime = testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env);
    const reservation = Math.max(60000, lifetime) / 3600000 * selected.price_hourly;
    const { spent, reserved, cap } = await inspectSpend(config.verification.dailySpendUsd, this.#env);
    if (spent + reserved + reservation > cap) throw new Error(`daily spend cap $${cap} reached`);
  }

  async acquire(run: Pick<RunRef, 'id' | 'size'>, deadline: string, demo?: DropletLease['demo'], snapshotConfig?: ProjectConfig): Promise<DropletLease> {
    const config = snapshotConfig ?? await this.#config();
    const runDeadline = Date.parse(deadline);
    if (!Number.isFinite(runDeadline) || runDeadline <= Date.now()) throw new Error('droplet acquisition deadline reached');
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const snapshot = await readSnapshot(this.root);
    if (!snapshot) throw new Error('no prepared snapshot; run cland executor prepare');
    const lease = await this.#acquire(run, deadline, { size: run.size ?? config.verification.droplet.size, regions: config.verification.droplet.regions.filter(region => snapshot.regions.includes(region)), image: snapshot.image, minDiskSize: snapshot.minDiskSize, ...(demo ? { demo } : {}) }, config);
    try { await waitForMachine(this.root, lease, snapshot.key, undefined, undefined, this.#env); return lease; }
    catch (error) { await this.release(lease); throw error; }
  }

  async #acquire(run: Pick<RunRef, 'id'>, deadline: string, input: { size: string; regions: string[]; image: string | number; minDiskSize?: number; user_data?: string; demo?: DropletLease['demo'] }, config: ProjectConfig): Promise<DropletLease> {
    const runDeadline = Date.parse(deadline);
    const api = new DigitalOceanApi(this.#env);
    const { size, regions, image } = input;
    const sizes = await api.sizes(runDeadline);
    const selected = sizes.find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    if (input.minDiskSize !== undefined && (!Number.isFinite(selected.disk) || selected.disk! < input.minDiskSize)) throw new Error(`prepared snapshot disk does not fit size ${size}`);
    const offered = await api.regions(runDeadline);
    const region = regions.find(r => selected.regions.includes(r) && offered.some(o => o.slug === r && o.available && o.sizes.includes(size)));
    if (!region) throw new Error(`droplet size ${size} unavailable in regions ${regions.join(', ')}`);
    const created = new Date().toISOString();
    const id = randomUUID();
    const name = `cland-${projectName(config.name)}-${id.replace(/-/g, '').slice(0, 8)}`;
    const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: id, run: run.id, name, tags: ['cland', projectTag(this.root, config.name)], size, region, priceHourly: selected.price_hourly, keyName: `${projectTag(this.root, config.name)}-${id.replace(/-/g, '').slice(0, 8)}`, created,
      ...(input.demo ? { demo: input.demo } : {}), deadline: new Date(Math.min(input.demo ? runDeadline : Infinity, Date.parse(created) + testTiming('CLAND_TEST_EXECUTOR_LIFETIME_MS', config.verification.lifetimeMs, this.#env))).toISOString(), state: 'creating', resource: null, keyId: null };
    const dir = leaseDir(this.root, lease);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    try {
      await exec('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', join(dir, 'key'), '-C', name], { timeout: 15000, env: machineEnv(this.#env) });
      await chmod(join(dir, 'key'), 0o600);
      await this.#reserve(lease, config.verification.remoteBudget, Math.min(runDeadline, Date.now() + 15000));
      await reserveSpend(this.root, lease, config.verification.dailySpendUsd, this.#env);
      lease.watchdog = await armWatchdog(dir, this.#env);
      await this.#save(lease);
      const publicKey = await readFile(join(dir, 'key.pub'), 'utf8');
      lease.keyImportStarted = new Date().toISOString();
      await this.#save(lease);
      const key = await api.importKey(lease.keyName, publicKey);
      lease.keyImportFinished = new Date().toISOString();
      lease.keyId = key.id;
      await this.#save(lease);
      const limit = Math.min(runDeadline, Date.parse(lease.deadline), Date.now() + testTiming('CLAND_TEST_DROPLET_ACQUIRE_MS', 300000, this.#env));
      if (Date.now() >= limit) throw new Error('droplet acquisition deadline reached');
      lease.createStarted = new Date().toISOString();
      await this.#save(lease);
      const droplet = await api.create({ name, tags: lease.tags, size, region, image, ssh_keys: [key.id], ...(input.user_data ? { user_data: input.user_data } : {}) }, limit);
      lease.createFinished = new Date().toISOString();
      lease.resource = droplet.id;
      await this.#save(lease);
      do {
        if (Date.now() >= limit) throw new Error('droplet acquisition deadline reached before active public IPv4');
        const current = await api.droplet(droplet.id, limit);
        const address = current.networks.v4.find(n => n.type === 'public')?.ip_address;
        if (current.status === 'active' && address) {
          lease.address = address; lease.state = 'active';
          await this.#save(lease);
          this.logger({ event: 'executor-lease-active', lease: lease.lease, id: lease.resource, run: lease.run });
          return lease;
        }
        await pause(Math.min(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, this.#env), Math.max(0, limit - Date.now())));
      } while (true);
    } catch (error) {
      if (error instanceof DigitalOceanError && error.status >= 400 && error.status < 500) {
        if (lease.createStarted) lease.createFinished ??= new Date().toISOString();
        else if (lease.keyImportStarted) lease.keyImportFinished ??= new Date().toISOString();
      }
      // Once persisted, even an ambiguous create is cleaned up by name and tags.
      await this.#save(lease);
      await this.release(lease);
      throw error;
    }
  }

  #key(): Promise<PrepareKey> {
    this.#keyWork ??= prepareKey(this.root, this.#env).finally(() => { this.#keyWork = null; });
    return this.#keyWork;
  }

  submitPrepare(report: (text: string) => void, authorize: () => void = () => {}): { state: 'submitted'; summary: string } {
    authorize();
    if (this.#closing) throw new Error('hub is stopping');
    if (this.#prepareJob?.state === 'running') throw new Error('snapshot preparation already running');
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const job: PrepareJob = { state: 'running', started: new Date().toISOString(), step: 'key' };
    this.#prepareJob = job;
    this.#prepareAbort = new AbortController();
    this.#prepareWork = this.#key().then(key => { job.key = key; return this.prepare(key, step => { this.#prepareAbort?.signal.throwIfAborted(); authorize(); job.step = step; }); }).then(result => {
      job.state = 'done'; job.finished = new Date().toISOString(); job.result = result; report(result.summary);
    }, error => {
      job.state = 'failed'; job.finished = new Date().toISOString(); job.error = error instanceof Error ? error.message : 'snapshot preparation failed';
      const durationMs = Date.now() - Date.parse(job.started);
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
    if (current && sameKey(current.key, key)) return prepareSnapshot({ env: this.#env, root: this.root, project: projectName(config.name), regions, tags: [], key, store: this.store, log: this.logger, signal: this.#prepareAbort?.signal, step, builder: async () => { throw new Error('current snapshot needs no builder'); }, release: lease => this.release(lease) });
    const sizes = await new DigitalOceanApi(this.#env).sizes();
    const builder = sizes.find(s => s.slug === prepare_size && s.available);
    const run = sizes.find(s => s.slug === size && s.available);
    if (!builder || !run || !Number.isFinite(builder.disk) || !Number.isFinite(run.disk)) throw new Error('prepare_size and size need available disks');
    if (builder.disk! > run.disk!) throw new Error(`verification.droplet.prepare_size ${prepare_size} disk exceeds run size ${size}`);
    return prepareSnapshot({ env: this.#env, root: this.root, project: projectName(config.name), regions, tags: ['cland', projectTag(this.root, config.name)], key, maxDiskSize: run.disk!, store: this.store, log: this.logger, signal: this.#prepareAbort?.signal, step,
      builder: user_data => this.#acquire({ id: 'executor-prepare' }, new Date(Date.now() + config.verification.lifetimeMs).toISOString(), { size: prepare_size, regions, image, user_data }, config), release: lease => this.release(lease) });
  }

  async close(): Promise<void> {
    this.#closing = true; this.#prepareAbort?.abort();
    await this.#prepareWork;
  }

  async release(lease: DropletLease): Promise<Released> {
    const pending = this.#releases.get(lease.lease);
    if (pending) return pending;
    const release = this.#release(lease).finally(() => { this.#releases.delete(lease.lease); });
    this.#releases.set(lease.lease, release);
    return release;
  }

  async #release(lease: DropletLease): Promise<Released> {
    await this.#changeLease(lease, async () => {
      const persisted = await readLease(leaseDir(this.root, lease));
      if (persisted.name !== lease.name || persisted.lease !== lease.lease) throw new Error('droplet lease identity changed; refusing release');
      Object.assign(lease, persisted);
      if (lease.state === 'released') return;
      lease.state = 'releasing';
      await this.#save(lease);
    });
    if (lease.state === 'released') { await settleSpend(lease, this.#env); return { lifetimeMs: lease.lifetimeMs ?? 0, costUsd: lease.costUsd ?? 0 }; }
    const limit = Date.now() + testTiming('CLAND_TEST_DROPLET_RELEASE_MS', 15000, this.#env);
    let cause: { status?: number; id?: string; message: string } | undefined;
    do {
      try {
        const result = await deleteLeaseResources(new DigitalOceanApi(this.#env), lease, limit, attention => {
          this.logger({ event: 'executor-release-identity-recheck', lease: lease.lease, id: lease.resource, attention });
        });
        delete lease.attention;
        if (result.confirmed) {
          accountRelease(lease, lease.deleteStarted ?? new Date().toISOString());
          await this.#save(lease);
          await settleSpend(lease, this.#env);
          await stopWatchdog(lease, this.#env);
          await rm(join(leaseDir(this.root, lease), 'key'), { force: true });
          await rm(join(leaseDir(this.root, lease), 'key.pub'), { force: true });
          this.logger({ event: 'executor-lease-released', lease: lease.lease, id: lease.resource, lifetimeMs: lease.lifetimeMs, costUsd: lease.costUsd });
          return { lifetimeMs: lease.lifetimeMs!, costUsd: lease.costUsd! };
        }
      } catch (error) {
        if (error instanceof DropletIdentityMismatch) lease.attention = error.attention;
        cause = error instanceof DigitalOceanError ? { status: error.status, id: error.id, message: error.message }
          : { message: error instanceof Error ? error.message : 'resource cleanup failed' };
        // Identity refusals and permanent provider errors remain for recovery;
        // busy actions, throttling, server errors and transport failures can clear.
        if (!(error instanceof DigitalOceanError) || ![0, 409, 422, 429].includes(error.status) && error.status < 500) break;
        this.logger({ event: 'executor-release-retry', lease: lease.lease, id: lease.resource, cause });
      }
      await pause(Math.min(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, this.#env), Math.max(0, limit - Date.now())));
    } while (Date.now() < limit);
    await this.#save(lease);
    this.logger({ event: 'executor-release-unconfirmed', lease: lease.lease, id: lease.resource, cause, ...(lease.attention ? { attention: lease.attention } : {}) });
    return { lifetimeMs: null, costUsd: null };
  }

  async inspect() {
    for (;;) {
      const job = this.#prepareJob;
      const jobState = job?.state;
      const snapshot = await readSnapshot(this.root);
      const freshness = snapshot ? staleParts(snapshot, await this.#key()) : [];
      const prepare = this.#prepareJob ? { ...this.#prepareJob, elapsedMs: (this.#prepareJob.finished ? Date.parse(this.#prepareJob.finished) : Date.now()) - Date.parse(this.#prepareJob.started) } : null;
      const snapshotRecovery = await readRecoveries(this.root);
      const token = Boolean(this.#env.DIGITALOCEAN_TOKEN);
      const all = await readLeases(this.root);
      const leases = await Promise.all(all.filter(l => l.state !== 'released').map(async l => ({ name: l.name, id: l.resource, region: l.region, size: l.size, state: l.state, ...(l.attention ? { attention: l.attention } : {}), ageMs: Date.now() - Date.parse(l.created), deadline: l.deadline, watchdogAlive: await watchdogAlive(l, this.#env) })));
      const spend = await inspectSpend((await this.#config()).verification.dailySpendUsd, this.#env);
      const todayCostUsd = spend.spent;
      let taggedDroplets: number | null = null;
      let providerError: string | undefined;
      if (token) try { taggedDroplets = (await new DigitalOceanApi(this.#env).droplets('cland')).length; } catch { providerError = 'provider unavailable'; }
      // A job may replace/restore the record while provider and Git reads yield.
      // Return a coherent snapshot and terminal job state from the same observation.
      if (job !== this.#prepareJob || jobState !== job?.state) continue;
      const summary = [snapshot ? `snapshot: ${snapshot.name} image=${snapshot.image} ${freshness.length ? `stale: ${freshness.join('|')}` : 'current'} key=${JSON.stringify(snapshot.key)}` : 'snapshot: none', ...(prepare ? [`prepare: ${prepare.state} ${prepare.step} elapsed=${Math.round(prepare.elapsedMs / 1000)}s`] : []), ...snapshotRecovery.map(record => `snapshot recovery: ${record.name} ${record.phase}`), `token: ${token ? 'present' : 'absent (DIGITALOCEAN_TOKEN)'}`, ...(!leases.length ? ['leases: none'] : leases.map(l => `${l.name} id=${l.id ?? 'pending'} ${l.region} ${l.size} ${l.state} age=${Math.round(l.ageMs / 1000)}s deadline=${l.deadline} watchdog=${l.watchdogAlive ? 'alive' : 'dead'}${l.attention ? `; operator attention: identity mismatch (${l.attention.fields.join(', ')}), provider status ${l.attention.observed.status}` : ''}`)), `ledger: ${spend.path}`, `today: spent $${spend.spent.toFixed(4)} + reserved $${spend.reserved.toFixed(4)} / cap $${spend.cap}`, `tagged droplets: ${taggedDroplets ?? providerError ?? 'unavailable'}`].join('\n');
      return { spend, snapshotRecovery, snapshot: snapshot ? { ...snapshot, freshness: freshness.length ? `stale: ${freshness.join('|')}` : 'current' } : null, prepare, token, leases, todayCostUsd, taggedDroplets, ...(providerError ? { providerError } : {}), summary };
    }
  }

  /** Restart repair and releasing-only retries. General orphan sweeping belongs to the safety stage. */
  async reconcile(restart = true): Promise<void> {
    if (this.#env.DIGITALOCEAN_TOKEN) await rememberProject(this.root, this.#env);
    type OwnedJob = { id: string; reported: boolean; state?: string; outcome: unknown; shards?: OwnedJob[] };
    const jobs = JSON.parse(this.store?.meta('suite-jobs') ?? '[]') as OwnedJob[];
    const owned = new Set(jobs.filter(job => !job.reported && !job.outcome && job.state !== 'queued').flatMap(job => [job.id, ...(job.shards ?? []).filter(shard => !shard.reported && !shard.outcome).map(shard => shard.id)]));
    for (const lease of await readLeases(this.root)) {
      const dir = leaseDir(this.root, lease);
      let receipt: WatchdogReceipt | undefined;
      try { receipt = JSON.parse(await readFile(join(dir, 'watchdog.json'), 'utf8')) as WatchdogReceipt; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (receipt && lease.watchdogFired !== receipt.fired) {
        lease.resource ??= receipt.deleted[0] ?? null;
        accountRelease(lease, receipt.deleteStarted);
        lease.released = receipt.confirmedAt;
        await this.#save(lease);
        this.logger({ event: 'executor-watchdog-fired', lease: lease.lease, ...receipt });
        lease.watchdogFired = receipt.fired; await this.#save(lease);
      }
      if (lease.state === 'released') {
        await settleSpend(lease, this.#env);
        await rm(join(dir, 'key'), { force: true }); await rm(join(dir, 'key.pub'), { force: true });
        continue;
      }
      if (!this.#env.DIGITALOCEAN_TOKEN) continue;
      if (lease.state !== 'releasing' && liveLease(lease) && (restart || lease.watchdog) && !await watchdogAlive(lease, this.#env)) {
        const watchdog = await armWatchdog(dir, this.#env);
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
        else await stopWatchdog({ ...lease, watchdog }, this.#env);
      }
      if (lease.state === 'releasing' || Date.parse(lease.deadline) <= Date.now() || restart && (lease.state === 'active' && !lease.execution && !lease.demo && !owned.has(lease.run) || lease.state === 'creating' && lease.resource === null)) await this.release(lease);
    }
    if (this.#prepareJob?.state !== 'running') await recoverSnapshots(this.root, this.store, this.logger, this.#env);
    this.store?.setMeta('executor-leases', JSON.stringify(await readLeases(this.root)));
  }
  async sweep(restart = false): Promise<void> {
    let reapedDroplets = 0, reapedKeys = 0, failures = 0;
    try { await this.reconcile(restart); } catch { failures++; this.logger({ event: 'executor-reconcile-failed', reason: 'lease recovery deferred' }); }
    if (this.#env.DIGITALOCEAN_TOKEN) try {
      const result = await this.reap(); reapedDroplets = result.deleted.length; reapedKeys = result.deletedKeys.length;
    } catch { failures++; this.logger({ event: 'executor-reconcile-failed', reason: 'provider sweep deferred' }); }
    this.logger({ event: 'executor-sweep', leases: (await readLeases(this.root)).filter(l => l.state !== 'released').length, reapedDroplets, reapedKeys, failures });
  }
  async reap(authorize: () => void = () => {}) {
    authorize();
    if (!this.#env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const config = await this.#config();
    const tag = projectTag(this.root, config.name);
    const api = new DigitalOceanApi(this.#env);
    const deleted: number[] = [];
    for (const droplet of await api.droplets('cland')) {
      if (!droplet.tags.includes('cland')) continue;
      // Acquire persists ownership before its provider mutation. Read it after
      // the provider list (and after any previous deletion awaits), never before.
      const known = await hostLeases(this.root, this.#env);
      // A renamed/retagged known resource is an identity refusal, not an
      // orphan. Keep it for operator attention even after its deadline.
      if (known.some(lease => lease.state !== 'released' && lease.resource === droplet.id && !matchesLease(droplet, lease))) continue;
      const owner = known.find(lease => matchesLease(droplet, lease));
      if (known.some(lease => matchesLease(droplet, lease) && liveLease(lease))) continue;
      const age = Date.now() - Date.parse(droplet.created_at);
      const deadline = owner ? Date.parse(owner.deadline) : Date.parse(droplet.created_at) + config.verification.lifetimeMs;
      const reason = droplet.tags.includes(tag) ? 'no live lease' : Date.now() > deadline + 600000 ? 'past lifetime' : null;
      if (!reason) continue;
      authorize();
      await api.deleteDroplet(droplet.id);
      const limit = Date.now() + testTiming('CLAND_TEST_DROPLET_RELEASE_MS', 15000, this.#env);
      let stillListed;
      do {
        stillListed = (await api.droplets('cland')).some(d => d.id === droplet.id);
        if (stillListed) await pause(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, this.#env));
      } while (stillListed && Date.now() < limit);
      if (stillListed) throw new Error(`droplet ${droplet.id} deletion not yet confirmed; run reap again`);
      deleted.push(droplet.id);
      this.logger({ event: 'executor-reaped', id: droplet.id, name: droplet.name, age, reason });
    }
    const deletedKeys: number[] = [];
    for (const key of await api.keys()) {
      const known = await hostLeases(this.root, this.#env);
      // Provider lists and lease updates can observe opposite sides of a rename.
      if (known.some(lease => liveLease(lease) && (lease.keyName === key.name || lease.keyId === key.id))) continue;
      const legacy = key.name.startsWith(`cland-${projectName(config.name)}-`);
      const oldLease = known.find(lease => lease.keyName === key.name);
      // DO's key object has no creation time: an unaged legacy key stays untouched.
      const oldEnough = oldLease && Date.now() - Date.parse(oldLease.keyImportStarted ?? oldLease.created) > config.verification.lifetimeMs + 600000;
      if (!key.name.startsWith(`${tag}-`) && !(legacy && oldEnough)) continue;
      authorize(); await api.deleteKey(key.id); deletedKeys.push(key.id);
    }
    return { deleted, deletedKeys, summary: `reaped: ${deleted.length} droplets` };
  }
}

export const projectName = (name: string): string => name.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40) || 'project';
export const projectTag = (root: string, name: string): string => `cland-p-${createHash('sha256').update(`${realpathSync(root)}\0${name}`).digest('hex').slice(0, 12)}`;
