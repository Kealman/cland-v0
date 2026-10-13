import type { Store } from '../../hub/store.ts';
import type { LogFn } from '../../log.ts';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { basename } from 'node:path';
import { realpathSync } from 'node:fs';
import { defaultConfig, parseConfig } from '../../init/config.ts';
import { DigitalOceanApi, DigitalOceanError } from './api.ts';
import { accountRelease, leaseDir, liveLease, readLease, readLeases, writeLease, type DropletLease, type WatchdogReceipt } from './lease.ts';
import { armWatchdog, pause, stopWatchdog, testTiming, watchdogAlive } from './watchdog.ts';
import { deleteLeaseResources } from './cleanup.ts';
import type { Executor, Released, RunRef } from '../executor.ts';

const exec = promisify(execFile);

/** Owns the project's durable droplet lifecycle, independently of suite delivery. */
export class DropletExecutor implements Pick<Executor, 'acquire' | 'release'> {
  readonly root: string;
  readonly store: Store | undefined;
  readonly log: LogFn;
  readonly #releases = new Map<string, Promise<Released>>();
  constructor(root: string, store?: Store, log: LogFn = () => {}) { this.root = realpathSync(root); this.store = store; this.log = log; }

  async #config() {
    try { return parseConfig(await readFile(join(this.root, '.cland/config.toml'), 'utf8'), basename(this.root)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultConfig(basename(this.root)); throw error; }
  }

  async #save(lease: DropletLease): Promise<void> {
    await writeLease(this.root, lease);
    this.store?.setMeta('executor-leases', JSON.stringify(await readLeases(this.root)));
  }

  async acquire(run: Pick<RunRef, 'id'>, deadline: string): Promise<DropletLease> {
    const runDeadline = Date.parse(deadline);
    if (!Number.isFinite(runDeadline) || runDeadline <= Date.now()) throw new Error('droplet acquisition deadline reached');
    const config = await this.#config();
    const api = new DigitalOceanApi();
    const { size, regions, image } = config.verification.droplet;
    const sizes = await api.sizes(runDeadline);
    const selected = sizes.find(s => s.slug === size && s.available);
    if (!selected || !Number.isFinite(selected.price_hourly) || selected.price_hourly < 0) throw new Error(`droplet size ${size} is unavailable or has no valid price`);
    const offered = await api.regions(runDeadline);
    const region = regions.find(r => selected.regions.includes(r) && offered.some(o => o.slug === r && o.available && o.sizes.includes(size)));
    if (!region) throw new Error(`droplet size ${size} unavailable in regions ${regions.join(', ')}`);
    const created = new Date().toISOString();
    const id = randomUUID();
    const name = `cland-${projectName(config.name)}-${id.replace(/-/g, '').slice(0, 8)}`;
    const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: id, run: run.id, name, tags: ['cland', projectTag(this.root, config.name)], size, region, priceHourly: selected.price_hourly, keyName: name, created,
      deadline: new Date(Date.parse(created) + config.verification.lifetimeMs).toISOString(), state: 'creating', resource: null, keyId: null };
    const dir = leaseDir(this.root, lease);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    try {
      await exec('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', join(dir, 'key'), '-C', name], { timeout: 15000 });
      await chmod(join(dir, 'key'), 0o600);
      await this.#save(lease);
      lease.watchdog = await armWatchdog(dir);
      await this.#save(lease);
      const publicKey = await readFile(join(dir, 'key.pub'), 'utf8');
      lease.keyImportStarted = new Date().toISOString();
      await this.#save(lease);
      const key = await api.importKey(name, publicKey);
      lease.keyImportFinished = new Date().toISOString();
      lease.keyId = key.id;
      await this.#save(lease);
      const limit = Math.min(runDeadline, Date.parse(lease.deadline), Date.now() + testTiming('CLAND_TEST_DROPLET_ACQUIRE_MS', 300000));
      if (Date.now() >= limit) throw new Error('droplet acquisition deadline reached');
      lease.createStarted = new Date().toISOString();
      await this.#save(lease);
      const droplet = await api.create({ name, tags: lease.tags, size, region, image, ssh_keys: [key.id] }, limit);
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
          this.log({ event: 'executor-lease-active', lease: lease.lease, id: lease.resource, run: lease.run });
          return lease;
        }
        await pause(Math.min(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000), Math.max(0, limit - Date.now())));
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

  async release(lease: DropletLease): Promise<Released> {
    const pending = this.#releases.get(lease.lease);
    if (pending) return pending;
    const release = this.#release(lease).finally(() => { this.#releases.delete(lease.lease); });
    this.#releases.set(lease.lease, release);
    return release;
  }

  async #release(lease: DropletLease): Promise<Released> {
    const persisted = await readLease(leaseDir(this.root, lease));
    if (persisted.name !== lease.name || persisted.lease !== lease.lease) throw new Error('droplet lease identity changed; refusing release');
    Object.assign(lease, persisted);
    if (lease.state === 'released') return { lifetimeMs: lease.lifetimeMs ?? 0, costUsd: lease.costUsd ?? 0 };
    lease.state = 'releasing';
    await this.#save(lease);
    const limit = Date.now() + testTiming('CLAND_TEST_DROPLET_RELEASE_MS', 15000);
    try {
      do {
        const result = await deleteLeaseResources(new DigitalOceanApi(), lease);
        if (result.confirmed) {
          accountRelease(lease, lease.deleteStarted ?? new Date().toISOString());
          await this.#save(lease);
          await stopWatchdog(lease);
          await rm(join(leaseDir(this.root, lease), 'key'), { force: true });
          await rm(join(leaseDir(this.root, lease), 'key.pub'), { force: true });
          this.log({ event: 'executor-lease-released', lease: lease.lease, id: lease.resource, lifetimeMs: lease.lifetimeMs, costUsd: lease.costUsd });
          return { lifetimeMs: lease.lifetimeMs!, costUsd: lease.costUsd! };
        }
        await pause(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000));
      } while (Date.now() < limit);
    } catch { /* the durable releasing lease is retried by the hub and the watchdog */ }
    await this.#save(lease);
    this.log({ event: 'executor-release-unconfirmed', lease: lease.lease, id: lease.resource });
    return { lifetimeMs: null, costUsd: null };
  }

  async inspect() {
    const token = Boolean(process.env.DIGITALOCEAN_TOKEN);
    const all = await readLeases(this.root);
    const leases = await Promise.all(all.filter(l => l.state !== 'released').map(async l => ({ name: l.name, id: l.resource, region: l.region, size: l.size, state: l.state, ageMs: Date.now() - Date.parse(l.created), deadline: l.deadline, watchdogAlive: await watchdogAlive(l) })));
    const today = new Date().toISOString().slice(0, 10);
    const todayCostUsd = all.filter(l => l.state === 'released' && l.released?.startsWith(today)).reduce((total, l) => total + (l.costUsd ?? 0), 0);
    let taggedDroplets: number | null = null;
    let providerError: string | undefined;
    if (token) try { taggedDroplets = (await new DigitalOceanApi().droplets('cland')).length; } catch { providerError = 'provider unavailable'; }
    const summary = [`token: ${token ? 'present' : 'absent (DIGITALOCEAN_TOKEN)'}`, ...(!leases.length ? ['leases: none'] : leases.map(l => `${l.name} id=${l.id ?? 'pending'} ${l.region} ${l.size} ${l.state} age=${Math.round(l.ageMs / 1000)}s deadline=${l.deadline} watchdog=${l.watchdogAlive ? 'alive' : 'dead'}`)), `today: $${todayCostUsd.toFixed(4)}`, `tagged droplets: ${taggedDroplets ?? providerError ?? 'unavailable'}`].join('\n');
    return { token, leases, todayCostUsd, taggedDroplets, ...(providerError ? { providerError } : {}), summary };
  }

  /** Restart repair and releasing-only retries. General orphan sweeping belongs to the safety stage. */
  async reconcile(restart = true): Promise<void> {
    for (const lease of await readLeases(this.root)) {
      const dir = leaseDir(this.root, lease);
      let receipt: WatchdogReceipt | undefined;
      try { receipt = JSON.parse(await readFile(join(dir, 'watchdog.json'), 'utf8')) as WatchdogReceipt; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (receipt && lease.state !== 'released') {
        lease.resource ??= receipt.deleted[0] ?? null;
        accountRelease(lease, receipt.deleteStarted);
        lease.released = receipt.confirmedAt;
        await this.#save(lease);
        this.log({ event: 'executor-watchdog-fired', lease: lease.lease, ...receipt });
      }
      if (lease.state === 'released') {
        await rm(join(dir, 'key'), { force: true }); await rm(join(dir, 'key.pub'), { force: true });
        continue;
      }
      if (!process.env.DIGITALOCEAN_TOKEN) continue;
      if (liveLease(lease) && (restart || lease.watchdog) && !await watchdogAlive(lease)) {
        lease.watchdog = await armWatchdog(dir); await this.#save(lease);
        this.log({ event: 'executor-watchdog-rearmed', lease: lease.lease, pid: lease.watchdog.pid, deadline: lease.deadline });
      }
      if (lease.state === 'releasing' || Date.parse(lease.deadline) <= Date.now() || restart && (lease.state === 'active' || lease.state === 'creating' && lease.resource === null)) await this.release(lease);
    }
    this.store?.setMeta('executor-leases', JSON.stringify(await readLeases(this.root)));
  }
  async reap(authorize: () => void = () => {}) {
    authorize();
    if (!process.env.DIGITALOCEAN_TOKEN) throw new Error('DIGITALOCEAN_TOKEN is required');
    const config = await this.#config();
    const tag = projectTag(this.root, config.name);
    const leases = await readLeases(this.root);
    const live = leases.filter(liveLease);
    const api = new DigitalOceanApi();
    const deleted: number[] = [];
    for (const droplet of await api.droplets('cland')) {
      if (!droplet.tags.includes('cland')) continue;
      const age = Date.now() - Date.parse(droplet.created_at);
      const reason = age > config.verification.lifetimeMs + 600000 ? 'past lifetime' : droplet.tags.includes(tag) && !live.some(l => l.resource === droplet.id || l.name === droplet.name) ? 'no live lease' : null;
      if (!reason) continue;
      authorize();
      await api.deleteDroplet(droplet.id);
      const limit = Date.now() + testTiming('CLAND_TEST_DROPLET_RELEASE_MS', 15000);
      let stillListed;
      do {
        stillListed = (await api.droplets('cland')).some(d => d.id === droplet.id);
        if (stillListed) await pause(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000));
      } while (stillListed && Date.now() < limit);
      if (stillListed) throw new Error(`droplet ${droplet.id} deletion not yet confirmed; run reap again`);
      deleted.push(droplet.id);
      this.log({ event: 'executor-reaped', id: droplet.id, name: droplet.name, age, reason });
    }
    for (const key of await api.keys()) if (key.name.startsWith(`cland-${projectName(config.name)}-`) && !live.some(l => l.keyName === key.name)) { authorize(); await api.deleteKey(key.id); }
    return { deleted, summary: `reaped: ${deleted.length} droplets` };
  }
}

export const projectName = (name: string): string => name.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40) || 'project';
export const projectTag = (root: string, name: string): string => `cland-p-${createHash('sha256').update(`${realpathSync(root)}\0${name}`).digest('hex').slice(0, 12)}`;
