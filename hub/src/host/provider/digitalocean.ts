import { renderPrelude } from '../prelude.ts';
import { poolImageKey, samePoolImageKey, poolSnapshotStorage } from './pool-image.ts';
import { readSnapshot } from '../../executor/droplet/prepare.ts';
import { DropletExecutor } from '../../executor/droplet/droplet.ts';
import type { DropletDependencies } from '../../executor/droplet/dependencies.ts';
import { generateKeyPairSync, randomUUID, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DigitalOceanApi, DigitalOceanError, RateLimited, type BlockVolume, type Action } from '../../executor/droplet/api.ts';
import { digitalOceanRequestsPerMinute } from '../../executor/droplet/endpoint.ts';
import { projectTag } from '../../executor/droplet/droplet.ts';
import { realClock, type Clock } from '../../hub/clock.ts';
import { declareHostProvider, type HostProviderDeclarations, type HostProviderDeclarationState } from './declarations.ts';
import type { HostProvider, Machine, AcquireOptions, AcquireResult, MachineStatus, ReleaseResult, ReapOptions, ReapResult, PrepareResult, Volume, CreateVolumeOptions, CreateVolumeResult, ListVolumesResult, AttachVolumeResult, DetachVolumeResult, SnapshotVolumeResult, DeleteVolumeResult } from './provider.ts';

export type ReapTarget = { machineId?: string | undefined; keyName?: string | undefined };
export type DigitalOceanHostProviderOptions = {
  root: string; env: NodeJS.ProcessEnv; api?: DigitalOceanApi; clock?: Clock;
  dependencies?: DropletDependencies;
  size?: string; image?: string | number; pool?: string;
  /** Owner holds its admission lock, checks the exact target and either skips
   * (undefined) or joins remove() before releasing the lock. No host ownership
   * can be published for this target while remove is in flight. Before calling
   * remove, persist a retirement reservation for BOTH exact identities. Retain
   * it after incomplete, unknown/throw and restart, refusing all matching claims.
   * Reconciliation uses that reservation; clear it only after released confirms
   * both native resources absent. Releasing the lock never clears retirement. */
  admitReap?: (target: ReapTarget, remove: () => Promise<ReleaseResult>) => Promise<ReleaseResult | undefined>;
  /** Compatibility only: a snapshot without admitReap cannot authorize reap. */
  ownedMachineIds?: () => Promise<ReadonlySet<string>>;
};
type Record = { region?: string; name: string; project: string; pool: string; tags: string[]; keyName: string; keyId?: number; dropletId?: number; machine?: Machine; privateKey: string; userData?: string; retiring?: boolean };
/** Machine and volume provisioning. One registry owns a state root; operations serialize.
 * intent-*.json persists name/tags/key before POST; unknown creates stay recoverable.
 * Pool images and recovery records live separately under .cland/run/hosts. */
export class DigitalOceanHostProvider implements HostProvider {
  readonly transport = 'ssh' as const;
  #declarations: HostProviderDeclarationState = Object.freeze({ state: 'unavailable', reason: 'DigitalOcean declarations not loaded' });
  get declarations(): HostProviderDeclarationState { return this.#declarations; }
  #refresh: Promise<HostProviderDeclarationState> | undefined;
  refreshDeclarations(): Promise<HostProviderDeclarationState> {
    if (this.#refresh) return this.#refresh;
    this.#refresh = (async () => {
      try {
        const sizes = await this.#api.sizes();
        const account = await this.#api.account() as { droplet_limit?: unknown };
        const candidate: HostProviderDeclarations = declareHostProvider({
          prices: Object.fromEntries(sizes.map(size => [size.slug, { livePerHour: size.price_hourly, idleComputePerHour: 0 }])),
          stoppedBills: true, billingGranularityMs: 1000, billingMinimumMs: 60_000,
          tokenConfinement: 'account', apiRequestsPerMinute: digitalOceanRequestsPerMinute,
          machineLimit: account.droplet_limit as number, architectures: ['x86_64'], extraAddressPerHour: 0,
        });
        this.#declarations = candidate;
      } catch (e) {
        if (e instanceof RateLimited) this.#pauseUntil(e.retryAt);
        // Keep the last complete declaration; no provider diagnostics.
      }
      return this.#declarations;
    })().finally(() => { this.#refresh = undefined; });
    return this.#refresh;
  }

  readonly #options: DigitalOceanHostProviderOptions;
  readonly #api: DigitalOceanApi;
  readonly #clock: Clock;
  readonly #directory: string;
  #createRetryAt = 0;
  readonly #snapshotRefusals = new Map<string, { identity: string; retryAt: number }>();
  #tail: Promise<unknown> = Promise.resolve();
  constructor(options: DigitalOceanHostProviderOptions) {
    this.#options = options; this.#clock = options.clock ?? realClock;
    this.#api = options.api ?? new DigitalOceanApi(options.env, this.#clock);
    this.#directory = join(options.root, '.cland', 'host-provider', 'digitalocean');
  }
  #serial<T>(work: () => Promise<T>): Promise<T> { const p = this.#tail.then(work); this.#tail = p.catch(() => {}); return p; }
  async #write(name: string, value: unknown): Promise<void> {
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
    const path = join(this.#directory, name);
    await writeFile(path + '.pending', JSON.stringify(value), { mode: 0o600 });
    await rename(path + '.pending', path);
  }
  async #records(): Promise<Record[]> {
    let names: string[];
    try { names = await readdir(this.#directory); } catch (e) { if (missing(e)) return []; throw e; }
    const records: Record[] = [];
    for (const name of names) if (/^intent-[a-f0-9-]+\.json$/.test(name)) records.push(JSON.parse(await readFile(join(this.#directory, name), 'utf8')) as Record);
    return records;
  }
  #save(record: Record): Promise<void> { return this.#write(`intent-${record.name.slice('cland-host-'.length)}.json`, record); }
  acquire(options: AcquireOptions): Promise<AcquireResult> { return this.#serial(async () => {
    if (!['lon1', 'fra1', 'ams3'].includes(options.region ?? 'lon1')) return { state: 'failed', reason: 'region unsupported' };
    if (this.#options.pool !== undefined && this.#options.pool !== options.pool) return { state: 'failed', reason: 'machine pool mismatch' };
    if (options.architecture !== 'x86_64' || !options.project || !/^[a-zA-Z0-9-]+$/.test(options.pool)) return { state: 'failed', reason: 'machine options unsupported' };
    // No project setting can enable production host.create before pool admission.
    if (!this.#options.api || this.#options.env.CLAND_FAKE_HOST_ROOT !== this.#options.root) return { state: 'refused', reason: 'DigitalOcean host.create requires E-1534 host lease, watchdog and spend', retryAt: new Date(this.#clock.now().getTime() + 60_000).toISOString() };
    let image: number;
    try {
      const storage = poolSnapshotStorage(this.#options.root, options.pool);
      const snapshot = await readSnapshot(this.#options.root, storage);
      if (!snapshot || !samePoolImageKey(snapshot.key, await poolImageKey(this.#options.root, this.#options.env, 'digitalocean')) || !snapshot.regions.includes(options.region ?? 'lon1')) throw new Error('pool image missing or stale');
      image = snapshot.image;
    } catch { return { state: 'refused', reason: 'run cland host prepare: pool image missing or stale', retryAt: new Date(this.#clock.now().getTime() + 60_000).toISOString() }; }
    if (this.#clock.now().getTime() < this.#createRetryAt) return this.#paused();
    if ('state' in this.#declarations) {
      await this.refreshDeclarations();
      if (this.#clock.now().getTime() < this.#createRetryAt) return this.#paused();
      if ('state' in this.#declarations) return { state: 'refused', reason: this.#declarations.reason, retryAt: new Date(this.#clock.now().getTime() + 60_000).toISOString() };
    }
    let accepted = false;
    try {
      const id = randomUUID(), tag = projectTag(this.#options.root, options.project);
      const pair = generateKeyPairSync('ed25519');
      const publicBytes = Buffer.from(pair.publicKey.export({ format: 'jwk' }).x!, 'base64url');
      const prefix = Buffer.from('0000000b7373682d6564323535313900000020', 'hex');
      const record: Record = { name: `cland-host-${id}`, project: options.project, pool: options.pool, region: options.region ?? 'lon1', tags: ['cland', tag, `cland-pool-${options.pool}`, `cland-host-${id}`], keyName: `${tag}-pool-${options.pool}-host-${id}`, privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
      record.userData = digitalOceanPrelude();
      await this.#save(record);
      const key = await this.#api.importKey(record.keyName, `ssh-ed25519 ${Buffer.concat([prefix, publicBytes]).toString('base64')}`);
      record.keyId = key.id; await this.#save(record);
      const droplet = await this.#api.create({ name: record.name, tags: record.tags, region: options.region ?? 'lon1', size: this.#options.size ?? 's-2vcpu-4gb', image, ssh_keys: [key.id], user_data: record.userData });
      accepted = true;
      record.dropletId = droplet.id; await this.#save(record);
      // GET is the address observation, never the launch reply.
      const observed = await this.#api.droplet(droplet.id);
      const machine: Machine = { id: String(droplet.id), address: observed.networks.v4.find(a => a.type === 'public')?.ip_address ?? '', architecture: options.architecture, created: droplet.created_at };
      record.machine = machine; await this.#save(record);
      if (!machine.address) return { state: 'failed', reason: 'machine address not yet observed; retained for reap' };
      return { state: 'created', machine };
    } catch (e) {
      if (e instanceof RateLimited || e instanceof DigitalOceanError && e.status === 422 && (e.id === 'droplet_limit' || /droplet.*limit|limit.*droplet/i.test(e.message))) {
        this.#pauseUntil(e.retryAt);
        if (!accepted) return this.#paused();
      }
      return { state: 'failed', reason: 'DigitalOcean create failed; retained for reap' };
    }
  }); }
  #pauseUntil(retryAt: number | undefined): void {
    const now = this.#clock.now().getTime();
    this.#createRetryAt = Math.max(this.#createRetryAt, now + 1, retryAt ?? now + 60_000);
  }
  #paused(): AcquireResult { return { state: 'refused', reason: 'DigitalOcean creation paused', retryAt: new Date(this.#createRetryAt).toISOString() }; }
  async #record(machine: Machine): Promise<Record> {
    const record = (await this.#records()).find(r => r.machine?.id === machine.id);
    if (!record?.machine || (['id', 'address', 'created', 'architecture'] as const).some(k => record.machine![k] !== machine[k])) throw new Error('machine identity mismatch');
    return record;
  }
  status(machine: Machine): Promise<MachineStatus> { return this.#serial(async () => {
    try {
      await this.#record(machine);
      const d = await this.#api.droplet(Number(machine.id));
      if (d.id !== Number(machine.id)) return { state: 'failed', reason: 'machine identity mismatch' };
      if (d.status === 'active') return { state: 'ready' };
      if (d.status === 'new') return { state: 'booting' };
      return { state: 'failed', reason: 'machine unavailable' };
    } catch (e) { return e instanceof DigitalOceanError && e.status === 404 ? { state: 'gone' } : { state: 'failed', reason: 'DigitalOcean status failed' }; }
  }); }
  async #delete(id: number, keyIds: number[]): Promise<ReleaseResult> {
    try { await this.#api.deleteDroplet(id); for (const keyId of keyIds) await this.#api.deleteKey(keyId); return { state: 'released' }; }
    catch { return { state: 'incomplete', reason: 'DigitalOcean deletion unconfirmed' }; }
  }
  async #retire(record: Record): Promise<ReleaseResult> {
    record.retiring = true;
    await this.#save(record);
    let result: ReleaseResult;
    if (record.dropletId !== undefined) result = await this.#delete(record.dropletId, record.keyId === undefined ? [] : [record.keyId]);
    else {
      try { if (record.keyId !== undefined) await this.#api.deleteKey(record.keyId); result = { state: 'released' }; }
      catch { result = { state: 'incomplete', reason: 'DigitalOcean key deletion unconfirmed' }; }
    }
    return result;
  }
  async #settled(record: Record, result: ReleaseResult | undefined): Promise<void> {
    // Owner callback returns only after its durable retirement acknowledgement.
    // A lost/throwing acknowledgement must leave this target discoverable.
    if (result?.state === 'released') { record.retiring = false; await this.#save(record); }
  }
  release(machine: Machine): Promise<ReleaseResult> { return this.#serial(async () => {
    try { const r = await this.#record(machine), result = await this.#retire(r); await this.#settled(r, result); return result; }
    catch { return { state: 'incomplete', reason: 'machine ownership unconfirmed' }; }
  }); }
  reap(options: ReapOptions): Promise<ReapResult> { return this.#serial(async () => {
    try {
      const tag = projectTag(this.#options.root, options.project), poolTag = `cland-pool-${options.pool}`;
      if (this.#options.ownedMachineIds && !this.#options.admitReap) return { state: 'failed', reason: 'reap requires owner-held deletion admission' };
      const records = await this.#records();
      // Without an owner integration this provider has no host records. With
      // one, the owner must fence its writes through each admitted deletion.
      const admit = this.#options.admitReap ?? (async (_target: ReapTarget, remove: () => Promise<ReleaseResult>) => remove());
      const droplets = await this.#api.droplets(tag), keys = await this.#api.keys();
      const selected = droplets.filter(d => d.tags.includes('cland') && d.tags.includes(tag) && d.tags.includes(poolTag));
      const released: string[] = [], incomplete: string[] = [];
      const protectedKeys = new Set<number>();
      const processed = new Set<Record>();
      for (const d of selected) {
        let record = records.find(r => r.name === d.name && r.project === options.project && r.pool === options.pool);
        const key = keys.find(k => { const identity = keyIdentity(k.name, tag); return identity?.pool === options.pool && identity.intent === d.name.slice('cland-host-'.length); });
        if (record) processed.add(record);
        const result = await admit({ machineId: String(d.id), keyName: key?.name ?? record?.keyName }, async () => {
          // Capture the observed association before deletion. An incomplete
          // droplet can disappear from a list while its key remains visible.
          record ??= { name: /^cland-host-[a-f0-9-]{36}$/.test(d.name) ? d.name : `cland-host-${randomUUID()}`, project: options.project, pool: options.pool, tags: d.tags, keyName: key?.name ?? '', privateKey: '' };
          record.dropletId = d.id;
          if (key) record.keyId = key.id;
          if (!records.includes(record)) records.push(record);
          processed.add(record);
          return this.#retire(record);
        });
        if (record) await this.#settled(record, result);
        if (!result) { if (key) protectedKeys.add(key.id); continue; }
        (result.state === 'released' ? released : incomplete).push(String(d.id));
        if (result.state !== 'released' && key) protectedKeys.add(key.id);
      }
      // Only keys whose pool is known from a pre-create intent or selected droplet
      // are eligible. An unowned pool must never delete another pool's key.
      for (const key of keys) {
        if (keyIdentity(key.name, tag)?.pool !== options.pool || protectedKeys.has(key.id)) continue;
        let record = records.find(r => r.keyName === key.name && r.project === options.project && r.pool === options.pool);
        if (record && selected.some(d => d.name === record?.name)) continue;
        if (record) processed.add(record);
        const result = await admit({ machineId: record?.dropletId === undefined ? undefined : String(record.dropletId), keyName: key.name }, async () => {
          record ??= { name: `cland-host-${keyIdentity(key.name, tag)!.intent}`, project: options.project, pool: options.pool, tags: ['cland', tag, poolTag], keyName: key.name, privateKey: '' };
          record.keyId = key.id;
          if (!records.includes(record)) records.push(record);
          processed.add(record);
          return this.#retire(record);
        });
        if (record) await this.#settled(record, result);
        if (result?.state === 'incomplete') incomplete.push(`key:${key.id}`);
      }
      // Lists are discovery, never a settlement receipt. Retirements whose
      // final GET failed remain discoverable even when both lists are empty.
      for (const record of records) {
        if (!record.retiring || processed.has(record) || record.project !== options.project || record.pool !== options.pool) continue;
        const id = record.dropletId === undefined ? `key:${record.keyId}` : String(record.dropletId);
        const result = await admit({ machineId: record.dropletId === undefined ? undefined : String(record.dropletId), keyName: record.keyName }, () => this.#retire(record));
        await this.#settled(record, result);
        if (result) (result.state === 'released' ? released : incomplete).push(id);
      }
      return { state: 'reaped', released, incomplete };
    } catch { return { state: 'failed', reason: 'DigitalOcean reap inventory failed' }; }
  }); }
  prepare(options?: Parameters<HostProvider['prepare']>[0]): Promise<PrepareResult> { return this.#serial(async () => {
    if (!options) {
      try { options = { pool: this.#options.pool ?? 'agents', key: await poolImageKey(this.#options.root, this.#options.env, 'digitalocean') }; }
      catch { return { state: 'failed', reason: 'run cland host prepare with a configured pool' }; }
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(options.pool)) return { state: 'failed', reason: 'run cland host prepare with a configured pool' };
    const executor = new DropletExecutor(this.#options.root, undefined, () => {}, this.#options.env, undefined, { ...this.#options.dependencies, api: this.#api, clock: this.#clock });
    try {
      const result = await executor.preparePool(options.pool, options.key);
      return { state: result.state, summary: result.summary };
    } catch { return { state: 'failed', reason: 'DigitalOcean pool image preparation failed; recovery retained' }; }
    finally { await executor.close(); }
  }); }
  // Volume creates share the machine creation pause: account-wide 429s must
  // not cascade through a second resource type. Snapshot window refusals keep
  // their native retry time; the API also applies its shared token budget.
  createVolume(options: CreateVolumeOptions): Promise<CreateVolumeResult> { return this.#serial(async () => {
    try {
      const pools = new Set((await this.#records()).filter(r => r.project === options.project).map(r => r.pool));
      const pool = this.#options.pool ?? (pools.size === 1 ? [...pools][0] : undefined);
      if (!pool) return { state: 'refused', reason: 'volume pool unavailable' };
      if (!/^[a-zA-Z0-9-]+$/.test(pool) || !options.project || options.sizeGiB !== 1 || !['lon1', 'fra1', 'ams3'].includes(options.region)) return { state: 'failed', reason: 'volume options unsupported' };
      if (!this.#options.api || this.#options.env.CLAND_FAKE_HOST_ROOT !== this.#options.root) return { state: 'refused', reason: 'DigitalOcean volume acquisition is test-only' };
      if (this.#clock.now().getTime() < this.#createRetryAt) return { state: 'refused', reason: 'DigitalOcean creation paused', retryAt: new Date(this.#createRetryAt).toISOString() };
      const volume = await this.#api.createVolume({ name: options.name, region: options.region, size_gigabytes: 1, tags: ['cland', projectTag(this.#options.root, options.project), `cland-pool-${pool}`] });
      return { state: 'created', volume: this.#volume(volume, options.project) };
    } catch (e) {
      if (e instanceof RateLimited) { this.#pauseUntil(e.retryAt); return { state: 'refused', reason: 'DigitalOcean creation paused', retryAt: new Date(this.#createRetryAt).toISOString() }; }
      return { state: 'failed', reason: 'DigitalOcean volume create unconfirmed' };
    }
  }); }
  #volume(v: BlockVolume, project: string): Volume { return { id: v.id, name: v.name, project, region: v.region.slug, sizeGiB: v.size_gigabytes, created: v.created_at, attachedTo: v.droplet_ids[0] === undefined ? null : String(v.droplet_ids[0]) }; }
  async #ownedVolume(volume: Volume): Promise<BlockVolume> {
    const v = await this.#api.volume(volume.id);
    if (!v.tags.includes('cland') || !v.tags.includes(projectTag(this.#options.root, volume.project)) || v.name !== volume.name || v.region.slug !== volume.region || v.created_at !== volume.created || v.size_gigabytes !== volume.sizeGiB) throw new Error('volume identity mismatch');
    return v;
  }
  listVolumes(options: { project: string }): Promise<ListVolumesResult> { return this.#serial(async () => {
    try { const tag = projectTag(this.#options.root, options.project); return { state: 'listed', volumes: (await this.#api.volumes(tag)).filter(v => v.tags.includes('cland') && v.tags.includes(tag)).map(v => this.#volume(v, options.project)) }; }
    catch { return { state: 'failed', reason: 'DigitalOcean volume inventory failed' }; }
  }); }
  async #awaitVolumeAction(action: Action): Promise<void> {
    const deadline = this.#clock.now().getTime() + 60000;
    while (action.status === 'in-progress') {
      action = await this.#api.action(action.id, deadline);
      if (action.status === 'in-progress') await new Promise<void>(resolve => this.#clock.setTimeout(resolve, 100));
    }
    if (action.status !== 'completed') throw new Error('volume action failed');
  }
  attachVolume(volume: Volume, machine: Machine): Promise<AttachVolumeResult> { return this.#serial(async () => await this.#attachment(volume, machine, 'attach') as AttachVolumeResult); }
  detachVolume(volume: Volume, machine: Machine): Promise<DetachVolumeResult> { return this.#serial(async () => await this.#attachment(volume, machine, 'detach') as DetachVolumeResult); }
  async #attachment(volume: Volume, machine: Machine, type: 'attach' | 'detach'): Promise<AttachVolumeResult | DetachVolumeResult> {
    try {
      const record = await this.#record(machine), v = await this.#ownedVolume(volume);
      if (record.project !== volume.project) return { state: 'refused', reason: 'project mismatch' };
      const created = this.#options.pool && this.#options.pool !== record.pool;
      if (created) return { state: 'failed', reason: 'machine pool mismatch' };
      const observed = await this.#api.droplet(Number(machine.id));
      if (observed.id !== Number(machine.id) || observed.status !== 'active') return { state: 'refused', reason: 'machine unavailable' };
      if (!v.tags.includes(`cland-pool-${record.pool}`)) return { state: 'failed', reason: 'volume pool mismatch' };
      // The admitted create intent supplies the region independently of caller data.
      if (record.region !== volume.region) return { state: 'refused', reason: 'region mismatch' };
      if (v.droplet_ids.some(id => String(id) !== machine.id)) return { state: 'refused', reason: 'attached elsewhere' };
      if (type === 'attach' ? v.droplet_ids.length === 0 : v.droplet_ids.length > 0) await this.#awaitVolumeAction(await this.#api.volumeAction(v.id, type, Number(machine.id), volume.region));
      return type === 'attach' ? { state: 'attached' } : { state: 'detached' };
    } catch { return { state: 'failed', reason: 'DigitalOcean volume action unconfirmed' }; }
  }
  snapshotVolume(volume: Volume): Promise<SnapshotVolumeResult> { return this.#serial(async () => {
    const identity = JSON.stringify([volume.id, volume.project, volume.name, volume.region, volume.sizeGiB, volume.created]);
    const known = this.#snapshotRefusals.get(volume.id);
    if (known?.identity === identity && this.#clock.now().getTime() < known.retryAt) return { state: 'refused', reason: 'rate limited', retryAt: new Date(known.retryAt).toISOString() };
    let validated = false;
    try { await this.#ownedVolume(volume); validated = true; const snapshot = await this.#api.volumeSnapshot(volume.id, `cland-${randomUUID()}`); return { state: 'snapshotted', snapshot: { id: snapshot.id, volumeId: volume.id, created: snapshot.created_at } }; }
    catch (e) {
      if (e instanceof RateLimited && e.retryAt !== undefined) {
        if (validated) this.#snapshotRefusals.set(volume.id, { identity, retryAt: e.retryAt });
        return { state: 'refused', reason: 'rate limited', retryAt: new Date(e.retryAt).toISOString() };
      }
      return { state: 'failed', reason: 'DigitalOcean volume snapshot unconfirmed' };
    }
  }); }
  deleteVolume(volume: Volume): Promise<DeleteVolumeResult> { return this.#serial(async () => {
    try {
      try { const v = await this.#ownedVolume(volume); if (v.droplet_ids.length) return { state: 'refused', reason: 'attached' }; }
      catch (e) { if (!(e instanceof DigitalOceanError && e.status === 404)) throw e; }
      await this.#api.deleteVolume(volume.id); return { state: 'deleted' };
    } catch { return { state: 'incomplete', reason: 'DigitalOcean volume not deleted' }; }
  }); }

}
function missing(e: unknown): boolean { return (e as NodeJS.ErrnoException).code === 'ENOENT'; }

/** Fixed UUID suffix makes the pool identity exact even when it contains -host-. */
function keyIdentity(name: string, project: string): { pool: string; intent: string } | undefined {
  const prefix = `${project}-pool-`;
  if (!name.startsWith(prefix)) return;
  const match = /^([a-zA-Z0-9-]+)-host-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(name.slice(prefix.length));
  return match ? { pool: match[1]!, intent: match[2]! } : undefined;
}

function digitalOceanPrelude(): string {
  const pair = generateKeyPairSync('ed25519');
  const publicBytes = Buffer.from(pair.publicKey.export({ format: 'jwk' }).x!, 'base64url');
  const prefix = Buffer.from('0000000b7373682d6564323535313900000020', 'hex');
  return renderPrelude({ hostKey: openSshPrivateKey(pair.privateKey.export({ format: 'jwk' }), publicBytes), hostPublicKey: `ssh-ed25519 ${Buffer.concat([prefix, publicBytes]).toString('base64')}`, providerSteps: 'rm -f /etc/udev/rules.d/99-digitalocean-automount.rules' });
}

/** OpenSSH's unencrypted ed25519 container; PKCS8 is not an sshd host key. */
function openSshPrivateKey(jwk: { d?: string }, publicKey: Buffer): string {
  const uint = (n: number) => { const value = Buffer.alloc(4); value.writeUInt32BE(n); return value; };
  const field = (value: Buffer | string) => { const bytes = Buffer.from(value); return Buffer.concat([uint(bytes.length), bytes]); };
  const publicBlob = Buffer.concat([field('ssh-ed25519'), field(publicKey)]);
  const check = randomBytes(4);
  let privateBlob = Buffer.concat([check, check, field('ssh-ed25519'), field(publicKey), field(Buffer.concat([Buffer.from(jwk.d!, 'base64url'), publicKey])), field('')]);
  const padding = 8 - privateBlob.length % 8;
  privateBlob = Buffer.concat([privateBlob, Buffer.from(Array.from({ length: padding }, (_, i) => i + 1))]);
  const bytes = Buffer.concat([Buffer.from('openssh-key-v1\0'), field('none'), field('none'), field(''), uint(1), field(publicBlob), field(privateBlob)]);
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${bytes.toString('base64').match(/.{1,70}/g)!.join('\n')}\n-----END OPENSSH PRIVATE KEY-----\n`;
}
