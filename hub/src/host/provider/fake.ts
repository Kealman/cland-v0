import { parsePoolName } from '../pool-name.ts';
import { keyHash } from '../../executor/droplet/prepare.ts';
import { durableJson } from '../../executor/droplet/lease.ts';
import type { PoolImageKey } from './pool-image.ts';
import { declareHostProvider, type HostProviderDeclarationInput, type HostProviderDeclarations } from './declarations.ts';
import { readFile, writeFile, opendir, stat, unlink, mkdir } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostDirectory } from '../../../../shared/fake-host-directory.ts';
import { createFakeHost } from '../../../../shared/fake-host-machine.ts';
import type { HostProvider, Machine, AcquireOptions, AcquireResult, MachineStatus, ReleaseResult, ReleaseObserver, ReapOptions, ReapResult, PrepareResult, Volume, CreateVolumeOptions, CreateVolumeResult, DeleteVolumeResult, ListVolumesResult, AttachVolumeResult, DetachVolumeResult, SnapshotVolumeResult } from './provider.ts';

import { parseFakeVolumeRecord, isFakeVolumeId, type FakeVolumeRecord as VolumeRecord } from './fake-volume-record.ts';
type Record = { region?: string; machine: Machine; project: string; pool: string; leaseId?:string|undefined; readyAt: number; neverBoot: boolean };
export type FakeHostProviderOptions = {
  declarations?: HostProviderDeclarationInput;
  env: NodeJS.ProcessEnv; now?: () => number; bootDelayMs?: number;
  neverBoot?: boolean; refuseUntil?: string; failAcquire?: boolean;
  /** Simulates an acknowledged delete which did not delete the machine. */
  ignoreDelete?: boolean;
  ignoreVolumeDelete?: boolean;
  snapshotWindowMs?: number;
  buildTimeMs?: number;
  wait?: (ms: number) => Promise<void>;
};
/** Directory-only provider: never starts a transport, process or socket; image delay is opt-in.
 * The caller adds acquired ids to CLAND_FAKE_HOSTS before transport startup. */
export class FakeHostProvider implements HostProvider {
  readonly transport = 'ssh' as const;
  readonly declarations: HostProviderDeclarations;
  readonly #root: string;
  readonly #options: FakeHostProviderOptions;
  readonly #now: () => number;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(options: FakeHostProviderOptions) {
    const root = options.env.CLAND_FAKE_HOST_ROOT;
    if (!root || !isAbsolute(root)) throw new Error('fake provider requires an absolute CLAND_FAKE_HOST_ROOT test environment');
    if (!Number.isFinite(options.bootDelayMs ?? 0) || (options.bootDelayMs ?? 0) < 0) throw new Error('fake provider requires a nonnegative boot delay');
    if (options.refuseUntil !== undefined && !Number.isFinite(Date.parse(options.refuseUntil))) throw new Error('fake provider requires a valid retry time');
    if (!Number.isSafeInteger(options.snapshotWindowMs ?? 60_000) || (options.snapshotWindowMs ?? 60_000) <= 0) throw new Error('fake provider requires a positive snapshot window');
    if (!Number.isFinite(options.buildTimeMs ?? 0) || (options.buildTimeMs ?? 0) < 0) throw new Error('invalid fake image build time');
    this.declarations = declareHostProvider(options.declarations ?? {
      prices: { fake: { livePerHour: 0, idleComputePerHour: 0 } },
      stoppedBills: false, billingGranularityMs: 1000, billingMinimumMs: 60_000,
      tokenConfinement: 'resource', apiRequestsPerMinute: 60, machineLimit: 100,
      architectures: ['x86_64', 'arm64'], extraAddressPerHour: 0,
    });
    this.#root = root; this.#options = { ...options }; this.#now = options.now ?? Date.now;
  }
  // A lifecycle operation drains its own writes before settling. Reap calls the
  // private operations to avoid recursively taking this serialization boundary.
  #serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(work); this.#tail = result.catch(() => {}); return result;
  }
  #volumePath(id: string): string {
    if (!isFakeVolumeId(id)) throw new Error('invalid volume identity');
    return join(this.#root, 'volumes', id + '.json');
  }
  async #volume(volume: Volume): Promise<VolumeRecord> {
    const record = parseFakeVolumeRecord(await readFile(this.#volumePath(volume.id), 'utf8'), volume.id);
    for (const key of ['id', 'project', 'name', 'region', 'sizeGiB', 'created'] as const) {
      if (record.volume[key] !== volume[key]) throw new Error('volume identity mismatch');
    }
    return record;
  }
  async #writeVolume(record: VolumeRecord): Promise<void> {
    await writeFile(this.#volumePath(record.volume.id), JSON.stringify(record), { mode: 0o600 });
  }
  createVolume(options: CreateVolumeOptions): Promise<CreateVolumeResult> { return this.#serial(async () => {
    if (!options.project || !options.name || !options.region || !Number.isSafeInteger(options.sizeGiB) || options.sizeGiB <= 0) return { state: 'failed', reason: 'invalid volume options' };
    try {
      const volume: Volume = { ...options, id: 'volume-' + randomUUID(), created: new Date(this.#now()).toISOString(), attachedTo: null };
      await mkdir(join(this.#root, 'volumes'), { recursive: true, mode: 0o700 });
      await this.#writeVolume({ volume });
      return { state: 'created', volume };
    } catch { return { state: 'failed', reason: 'fake volume create failed' }; }
  }); }
  listVolumes(options: { project: string }): Promise<ListVolumesResult> { return this.#serial(async () => {
    try {
      let directory;
      try { directory = await opendir(join(this.#root, 'volumes')); }
      catch (e) { if (missing(e)) return { state: 'listed', volumes: [] }; throw e; }
      const volumes: Volume[] = [];
      for await (const entry of directory) {
        const record = parseFakeVolumeRecord(await readFile(join(this.#root, 'volumes', entry.name), 'utf8'), entry.name.replace(/\.json$/, ''));
        if (record.volume.project === options.project) volumes.push(record.volume);
      }
      return { state: 'listed', volumes: volumes.sort((a, b) => a.id.localeCompare(b.id)) };
    } catch { return { state: 'failed', reason: 'fake volume list failed' }; }
  }); }
  snapshotVolume(volume: Volume): Promise<SnapshotVolumeResult> { return this.#serial(async () => {
    try {
      const record = await this.#volume(volume), now = this.#now();
      const retry = record.lastSnapshotAt === undefined ? undefined : record.lastSnapshotAt + (this.#options.snapshotWindowMs ?? 60_000);
      if (retry !== undefined && now < retry) return { state: 'refused', reason: 'rate limited', retryAt: new Date(retry).toISOString() };
      const snapshot = { id: 'snapshot-' + randomUUID(), volumeId: record.volume.id, created: new Date(now).toISOString() };
      record.lastSnapshotAt = now;
      record.snapshot = snapshot;
      await this.#writeVolume(record);
      return { state: 'snapshotted', snapshot };
    } catch { return { state: 'failed', reason: 'fake volume snapshot failed' }; }
  }); }
  attachVolume(volume: Volume, machine: Machine): Promise<AttachVolumeResult> { return this.#serial(async () => {
    try {
      const record = await this.#volume(volume), host = await this.#record(machine);
      if ((await this.#status(machine)).state !== 'ready') return { state: 'refused', reason: 'machine unavailable' };
      if (host.project !== record.volume.project) return { state: 'refused', reason: 'project mismatch' };
      if ((host.region ?? 'fake-1') !== record.volume.region) return { state: 'refused', reason: 'region mismatch' };
      if (record.volume.attachedTo && record.volume.attachedTo !== machine.id) return { state: 'refused', reason: 'attached elsewhere' };
      record.volume.attachedTo = machine.id;
      await this.#writeVolume(record);
      return { state: 'attached' };
    } catch { return { state: 'failed', reason: 'fake volume attach failed' }; }
  }); }
  detachVolume(volume: Volume, machine: Machine): Promise<DetachVolumeResult> { return this.#serial(async () => {
    try {
      const record = await this.#volume(volume);
      await this.#record(machine);
      if (record.volume.attachedTo && record.volume.attachedTo !== machine.id) return { state: 'refused', reason: 'attached elsewhere' };
      record.volume.attachedTo = null;
      await this.#writeVolume(record);
      return { state: 'detached' };
    } catch { return { state: 'failed', reason: 'fake volume detach failed' }; }
  }); }
  deleteVolume(volume: Volume): Promise<DeleteVolumeResult> { return this.#serial(async () => {
    try {
      const path = this.#volumePath(volume.id);
      let record;
      try { record = await this.#volume(volume); }
      catch (e) { if (!missing(e)) throw e; }
      if (record?.volume.attachedTo) return { state: 'refused', reason: 'attached' };
      if (!this.#options.ignoreVolumeDelete) {
        try { await unlink(path); } catch (e) { if (!missing(e)) throw e; }
      }
      try { await readFile(path); }
      catch (e) { if (missing(e)) return { state: 'deleted' }; throw e; }
      return { state: 'incomplete', reason: 'fake volume still exists after delete' };
    } catch { return { state: 'incomplete', reason: 'fake volume deletion unconfirmed' }; }
  }); }
  prepare(options?: { pool: string; key: PoolImageKey }): Promise<PrepareResult> { return this.#serial(async () => {
    if (options) {
      try { parsePoolName(options.pool); } catch { return { state: 'failed', reason: 'invalid pool' }; }
      const path = join(this.#root, 'images', options.pool + '.json');
      try {
        const old = JSON.parse(await readFile(path, 'utf8').catch(e => { if (missing(e)) return 'null'; throw e; }));
        const digest = keyHash(options.key);
        if (old?.key && keyHash(old.key) === old.digest && old.digest === digest) return { state: 'current', summary: 'fake image current' };
        const delay = this.#options.buildTimeMs ?? 0;
        if (delay) await (this.#options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(delay);
        await mkdir(join(this.#root, 'images'), { recursive: true, mode: 0o700 });
        await durableJson(path, { key: options.key, digest, built: this.#now(), buildTimeMs: delay });
        return { state: 'prepared', summary: 'fake image prepared' };
      } catch { return { state: 'failed', reason: 'fake image preparation failed' }; }
    }
    const path = join(this.#root, 'provider-image');
    try { await readFile(path); return { state: 'current', summary: 'fake image current' }; }
    catch (e) { if (!missing(e)) return { state: 'failed', reason: 'fake image read failed' }; }
    try { await writeFile(path, 'fake-image-v1', { flag: 'wx', mode: 0o600 }); return { state: 'prepared', summary: 'fake image prepared' }; }
    catch { return { state: 'failed', reason: 'fake image preparation failed' }; }
  }); }
  createAdmission(): {state:'allowed'} { return {state:'allowed'}; }
  acquire(options: AcquireOptions): Promise<AcquireResult> { return this.#serial(async () => {
    try { parsePoolName(options.pool); } catch { return { state: 'failed', reason: 'invalid pool' }; }
    if (!this.declarations.architectures.includes(options.architecture)) return { state: 'failed', reason: 'fake architecture unsupported' };
    if (this.#options.refuseUntil && Date.parse(this.#options.refuseUntil) > this.#now()) return { state: 'refused', reason: 'fake capacity unavailable', retryAt: this.#options.refuseUntil };
    if (this.#options.failAcquire) return { state: 'failed', reason: 'fake create failed' };
    if (options.image) {
      try {
        const image = JSON.parse(await readFile(join(this.#root, 'images', options.pool + '.json'), 'utf8'));
        if (image.digest !== keyHash(options.image) || keyHash(image.key) !== image.digest) throw new Error('stale image');
      } catch { return { state: 'failed', reason: `pool image is not current; run cland host prepare ${options.pool}` }; }
    }
    const id = 'fake-' + randomUUID().replaceAll('-', '').slice(0, 12);
    const machine: Machine = { id, address: id, architecture: options.architecture, created: new Date(this.#now()).toISOString() };
    try {
      const publicKey = options.userData?.match(/'([^'\n]*ssh-ed25519 [^'\n]+)' > \/etc\/ssh\/ssh_host_ed25519_key.pub/ )?.[1];
      if (options.userData !== undefined && !publicKey) throw new Error('missing prelude public key');
      const host = await createFakeHost(this.#root, id);
      if (publicKey) {
        await writeFile(join(host.directory, 'host-key.pub'), publicKey);
      }
      const record: Record = { leaseId:options.admission?.lease?.id, region: options.region ?? 'fake-1', machine, project: options.project, pool: options.pool, readyAt: this.#now() + (this.#options.bootDelayMs ?? 0), neverBoot: this.#options.neverBoot ?? false };
      await writeFile(join(host.directory, 'provider.json'), JSON.stringify(record), { mode: 0o600 });
      return { state: 'created', machine, ssh:{environment:{CLAND_FAKE_HOSTS:[this.#options.env.CLAND_FAKE_HOSTS,machine.address].filter(Boolean).join(',')},clientKeyPath:join(host.directory,'client-key'),knownHosts:`${machine.address} ${publicKey??(await readFile(join(host.directory,'host-key.pub'),'utf8')).trim()}\n`,home:join(host.directory,'home'),node:process.execPath} };
    } catch { return { state: 'failed', reason: 'fake create failed' }; }
  }); }
  async findAdmission(project:string,pool:string,id:string):Promise<Machine|undefined> {
    const matches:Machine[]=[];
    for await(const entry of await opendir(dirname(hostDirectory(this.#root,'admission')))) {
      if(!entry.isDirectory())continue;
      try {const record=JSON.parse(await readFile(join(dirname(hostDirectory(this.#root,'admission')),entry.name,'provider.json'),'utf8')) as Record;if(record.leaseId===id&&record.project===project&&record.pool===pool)matches.push(record.machine);}catch(error){if(!missing(error))throw error;}
    }
    return matches.length===1?matches[0]:undefined;
  }
  async #record(machine: Machine): Promise<Record> {
    const record = JSON.parse(await readFile(join(hostDirectory(this.#root, machine.id), 'provider.json'), 'utf8')) as Record;
    const captured = record.machine;
    if (captured.id !== machine.id || captured.created !== machine.created || captured.address !== machine.address || captured.architecture !== machine.architecture) throw new Error('machine identity mismatch');
    return record;
  }
  async #status(machine: Machine): Promise<MachineStatus> {
    try {
      const directory = hostDirectory(this.#root, machine.id);
      try { await stat(directory); } catch (e) { if (missing(e)) return { state: 'gone' }; throw e; }
      const record = await this.#record(machine);
      try {
        const marker = await readFile(join(directory, 'gone'), 'utf8');
        if (marker !== 'deleted') return { state: 'failed', reason: 'fake machine unavailable' };
        for (const key of ['host-key.pub', 'client-key', 'known_hosts']) {
          try { await stat(join(directory, key)); return { state: 'failed', reason: 'fake machine key retained' }; }
          catch (e) { if (!missing(e)) throw e; }
        }
        return { state: 'gone' };
      }
      catch (e) { if (!missing(e)) throw e; }
      if (record.neverBoot) return { state: 'failed', reason: 'fake machine will not boot' };
      return { state: this.#now() < record.readyAt ? 'booting' : 'ready' };
    } catch (e) { return { state: 'failed', reason: 'fake machine read failed' }; }
  }
  status(machine: Machine, scope?:import('./provider.ts').StatusReadScope): Promise<MachineStatus> {
    const read=async()=>{scope?.signal?.throwIfAborted();const result=await this.#status(machine);scope?.signal?.throwIfAborted();return result;};
    return scope?read():this.#serial(read);
  }
  async #release(machine: Machine, confirm?:ReleaseObserver): Promise<ReleaseResult> {
    try {
      await this.#record(machine);
      const directory = hostDirectory(this.#root, machine.id);
      if (!this.#options.ignoreDelete) {
        for (const key of ['host-key.pub', 'client-key', 'known_hosts']) {
          try { await unlink(join(directory, key)); } catch (e) { if (!missing(e)) throw e; }
        }
        await writeFile(join(directory, 'gone'), 'deleted');
      }
      if ((await this.#status(machine)).state !== 'gone') return {state:'incomplete',reason:'fake machine still exists after delete'};
      confirm?.({resource:'machine',read:`read ${join(directory,'gone')}: deleted`});
      for (const key of ['host-key.pub','client-key','known_hosts']) {
        try { await stat(join(directory,key)); return {state:'incomplete',reason:'fake key still exists after delete'}; }
        catch(e){if(!missing(e))throw e;}
      }
      confirm?.({resource:'key',read:`stat ${directory}/{host-key.pub,client-key,known_hosts}: ENOENT`});
      return {state:'released'};
    } catch { return { state: 'incomplete', reason: 'fake machine deletion unconfirmed' }; }
  }
  release(machine: Machine, confirm?:ReleaseObserver): Promise<ReleaseResult> { return this.#serial(() => this.#release(machine,confirm)); }
  reap(options: ReapOptions): Promise<ReapResult> { return this.#serial(async () => {
    try { parsePoolName(options.pool); } catch { return { state: 'failed', reason: 'invalid pool' }; }
    const released: string[] = [], incomplete: string[] = [];
    try {
      let directory;
      try { directory = await opendir(join(this.#root, '.fixture-sockets')); }
      catch (e) { if (missing(e)) return { state: 'reaped', released, incomplete }; throw e; }
      for await (const entry of directory) {
        if (!entry.isDirectory() || !entry.name.startsWith('fake-')) continue;
        const record = JSON.parse(await readFile(join(this.#root, '.fixture-sockets', entry.name, 'provider.json'), 'utf8')) as Record;
        if (record.project !== options.project || record.pool !== options.pool || (await this.#status(record.machine)).state === 'gone') continue;
        ((await this.#release(record.machine)).state === 'released' ? released : incomplete).push(record.machine.id);
      }
      return { state: 'reaped', released, incomplete };
    } catch (e) { return { state: 'failed', reason: 'fake reap read failed' }; }
  }); }
}
function missing(e: unknown): boolean { return (e as NodeJS.ErrnoException).code === 'ENOENT'; }
