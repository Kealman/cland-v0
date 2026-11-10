import {authorizeSnapshot,SnapshotSendRefused,type SnapshotVolumeOptions} from './provider.ts';
import { fakeVolumePath, fakeVolumeContentsDirectory, fakeVolumeContents, readFakeMachine, fakeMachineStatus, listFakeVolumes, readFakeVolume, type FakeMachineRecord } from '../agent/fake-volume-contents.ts';
import { parsePoolName } from '../pool-name.ts';
import { keyHash } from '../../executor/droplet/prepare.ts';
import { durableJson } from '../../executor/droplet/lease.ts';
import type { PoolImageKey } from './pool-image.ts';
import { declareHostProvider, type HostProviderDeclarationInput, type HostProviderDeclarations } from './declarations.ts';
import { readFile, writeFile, opendir, stat, unlink, mkdir, cp, rm } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostDirectory } from '../../../../shared/fake-host-directory.ts';
import { createFakeHost } from '../../../../shared/fake-host-machine.ts';
import type { HostProvider, Machine, AcquireOptions, AcquireResult, MachineStatus, ReleaseResult, ReleaseObserver, ReapOptions, ReapResult, PrepareResult, Volume, CreateVolumeOptions, CreateVolumeResult, DeleteVolumeResult, ListVolumesResult, AttachVolumeResult, DetachVolumeResult, SnapshotVolumeResult } from './provider.ts';

import { parseFakeVolumeRecord, type FakeVolumeRecord as VolumeRecord } from './fake-volume-record.ts';
type Record = FakeMachineRecord;
export type FakeHostProviderOptions = {
  declarations?: HostProviderDeclarationInput;
  env: NodeJS.ProcessEnv; now?: () => number; bootDelayMs?: number;
  neverBoot?: boolean; refuseUntil?: string; failAcquire?: boolean;
  /** Simulates an acknowledged delete which did not delete the machine. */
  ignoreDelete?: boolean;
  ignoreVolumeDelete?: boolean;
  ignoreSnapshotDelete?: boolean;
  /** Simulates failure publishing snapshot removal to the live volume history. */
  failSnapshotHistoryWrite?: boolean;
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
  #volumePath(id:string):string {return fakeVolumePath(this.#root,id);}
  #volume(volume:Volume):Promise<VolumeRecord> {return readFakeVolume(this.#root,volume);}
  async #writeVolume(record: VolumeRecord): Promise<void> {
    await durableJson(this.#volumePath(record.volume.id), record);
  }
  #contents(id:string):string {return fakeVolumeContentsDirectory(this.#root,id);}
  #snapshotContents(id: string): string {
    if (!/^snapshot-[a-f0-9-]+$/.test(id)) throw new Error('invalid snapshot identity');
    return join(this.#root, 'snapshots', id, 'contents');
  }
  async #snapshot(snapshot: import('./provider.ts').VolumeSnapshot | string): Promise<VolumeRecord> {
    const id = typeof snapshot === 'string' ? snapshot : snapshot.id;
    this.#snapshotContents(id);
    const bytes = await readFile(join(this.#root, 'snapshots', id, 'record.json'), 'utf8');
    const record = parseFakeVolumeRecord(bytes, typeof snapshot === 'string' ? JSON.parse(bytes)?.volume?.id : snapshot.volumeId);
    if (record.snapshot?.id !== id || (typeof snapshot !== 'string' && record.snapshot.created !== snapshot.created)) throw new Error('snapshot identity mismatch');
    try { await this.#volume(record.volume); } catch (e) { if (!missing(e)) throw e; }
    return record;
  }
  /** Test-only login-disk seam. Caller drains file users before detach/release. */
  volumeContents(volume:Volume,machine:Machine):Promise<{state:'ready';directory:string}|import('./provider.ts').Failed> {
    return this.#serial(async()=>{try{return await fakeVolumeContents(this.#root,hostDirectory(this.#root,machine.id),volume,machine,this.#now);}catch{return {state:'failed',reason:'fake volume contents unavailable'};}});
  }
  getSnapshot(id: string): Promise<import('./provider.ts').GetSnapshotResult> { return this.#serial(async () => {
    try { return { state: 'found', snapshot: (await this.#snapshot(id)).snapshot! }; }
    catch { return { state: 'failed', reason: 'fake snapshot lookup failed' }; }
  }); }
  listSnapshots(volume: Volume): Promise<import('./provider.ts').ListSnapshotsResult> { return this.#serial(async () => {
    try {
      const record = await this.#volume(volume);
      return { state: 'listed', snapshots: record.snapshots ?? (record.snapshot ? [record.snapshot] : []) };
    } catch (e) { return missing(e) ? { state: 'volume-gone' } : { state: 'failed', reason: 'fake snapshot list failed' }; }
  }); }
  deleteSnapshot(input: import('./provider.ts').VolumeSnapshot | string): Promise<import('./provider.ts').DeleteSnapshotResult> { return this.#serial(async () => {
    try {
      const id = typeof input === 'string' ? input : input.id;
      const contents = this.#snapshotContents(id), path = dirname(contents);
      let snapshot = typeof input === 'string' ? undefined : input;
      try { snapshot = (await this.#snapshot(input)).snapshot!; } catch (e) {
        if (!missing(e)) throw e;
        try { await stat(path); throw new Error('snapshot metadata missing'); } catch (error) { if (!missing(error)) throw error; }
      }
      // Validate retained history before deleting any bytes.
      let volume: VolumeRecord | undefined;
      if (snapshot) try {
        volume = parseFakeVolumeRecord(await readFile(this.#volumePath(snapshot.volumeId), 'utf8'), snapshot.volumeId);
        const receipt = (volume.snapshots ?? (volume.snapshot ? [volume.snapshot] : [])).find(s => s.id === snapshot.id);
        if (receipt && receipt.created !== snapshot.created) throw new Error('snapshot identity mismatch');
      } catch (e) { if (!missing(e)) throw e; }
      if (this.#options.ignoreSnapshotDelete) {
        try { await stat(path); return { state: 'incomplete', reason: 'fake snapshot still exists after delete' }; }
        catch (e) { if (!missing(e)) throw e; }
      }
      // Keep the snapshot's own recovery identity until history publication is
      // durable, so an ID-only retry can finish after provider recreation.
      await rm(contents, { recursive: true, force: true });
      try { await stat(contents); return { state: 'incomplete', reason: 'fake snapshot contents still exist after delete' }; }
      catch (e) { if (!missing(e)) throw e; }
      if (volume) {
        volume.snapshots = (volume.snapshots ?? (volume.snapshot ? [volume.snapshot] : [])).filter(s => s.id !== id);
        if (this.#options.failSnapshotHistoryWrite) throw new Error('fake snapshot history write failed');
        await this.#writeVolume(volume);
      }
      await rm(path, { recursive: true, force: true });
      try { await stat(path); return { state: 'incomplete', reason: 'fake snapshot still exists after delete' }; }
      catch (e) { if (!missing(e)) throw e; }
      return { state: 'deleted' };
    } catch { return { state: 'incomplete', reason: 'fake snapshot deletion unconfirmed' }; }
  }); }
  createVolume(options: CreateVolumeOptions): Promise<CreateVolumeResult> { return this.#serial(async () => {
    if (!options.project || !options.name || !options.region || !Number.isSafeInteger(options.sizeGiB) || options.sizeGiB <= 0) return { state: 'failed', reason: 'invalid volume options' };
    try {
      const source = options.fromSnapshot === undefined ? undefined : await this.#snapshot(options.fromSnapshot);
      if (source && (source.volume.project !== options.project || options.sizeGiB < source.volume.sizeGiB)) throw new Error('snapshot ownership or size mismatch');
      const volume: Volume = { project: options.project, name: options.name, region: source?.volume.region ?? options.region, sizeGiB: options.sizeGiB, id: 'volume-' + randomUUID(), created: new Date(this.#now()).toISOString(), attachedTo: null };
      await mkdir(join(this.#root, 'volumes'), { recursive: true, mode: 0o700 });
      if (source) await cp(this.#snapshotContents(source.snapshot!.id), this.#contents(volume.id), { recursive: true, errorOnExist: true, force: false });
      else await mkdir(this.#contents(volume.id), { mode: 0o700 });
      await this.#writeVolume({ volume });
      return { state: 'created', volume };
    } catch { return { state: 'failed', reason: 'fake volume create failed' }; }
  }); }
  listVolumes(options:{project:string}):Promise<ListVolumesResult> {return this.#serial(()=>listFakeVolumes(this.#root,options.project));}
  snapshotVolume(volume: Volume, options?:SnapshotVolumeOptions): Promise<SnapshotVolumeResult> { return this.#serial(async () => {
    try {
      const record = await this.#volume(volume), now = this.#now();
      const retry = record.lastSnapshotAt === undefined ? undefined : record.lastSnapshotAt + (this.#options.snapshotWindowMs ?? 60_000);
      if (retry !== undefined && now < retry) return { state: 'refused', reason: 'rate limited', retryAt: new Date(retry).toISOString() };
      authorizeSnapshot(options);
      const snapshot = { id: 'snapshot-' + randomUUID(), volumeId: record.volume.id, created: new Date(now).toISOString() };
      // Copy before publishing the receipt; retained legacy volumes start empty.
      await mkdir(this.#contents(volume.id), { recursive: true, mode: 0o700 });
      await mkdir(join(this.#root, 'snapshots', snapshot.id), { recursive: true, mode: 0o700 });
      try{authorizeSnapshot(options);}catch(error){await rm(join(this.#root,'snapshots',snapshot.id),{recursive:true,force:true});throw error;}
      await cp(this.#contents(volume.id), this.#snapshotContents(snapshot.id), { recursive: true });
      await durableJson(join(this.#root, 'snapshots', snapshot.id, 'record.json'), { volume: record.volume, lastSnapshotAt: now, snapshot });
      record.snapshots = [...(record.snapshots ?? (record.snapshot ? [record.snapshot] : [])), snapshot];
      record.lastSnapshotAt = now;
      record.snapshot = snapshot;
      await this.#writeVolume(record);
      return { state: 'snapshotted', snapshot };
    } catch(error) { if(error instanceof SnapshotSendRefused)return {state:'not-sent',reason:'snapshot authorization refused'};return { state: 'failed', reason: 'fake volume snapshot failed' }; }
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
        await rm(this.#contents(volume.id), { recursive: true, force: true });
        try { await unlink(path); } catch (e) { if (!missing(e)) throw e; }
      }
      try { await readFile(path); }
      catch (e) { if (missing(e)) { try { await stat(this.#contents(volume.id)); } catch (error) { if (missing(error)) return { state: 'deleted' }; throw error; } } throw e; }
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
  async #record(machine:Machine):Promise<Record> {return readFakeMachine(hostDirectory(this.#root,machine.id),machine);}
  async #status(machine:Machine):Promise<MachineStatus> {try{return await fakeMachineStatus(hostDirectory(this.#root,machine.id),machine,this.#now);}catch{return {state:'failed',reason:'fake machine read failed'};}}
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
      let volumes;
      try { volumes = await opendir(join(this.#root, 'volumes')); } catch (e) { if (!missing(e)) throw e; }
      if (volumes) for await (const entry of volumes) {
        if (entry.isDirectory()) continue;
        const record = parseFakeVolumeRecord(await readFile(join(this.#root, 'volumes', entry.name), 'utf8'), entry.name.replace(/\.json$/, ''));
        if (record.volume.attachedTo === machine.id) { record.volume.attachedTo = null; await this.#writeVolume(record); }
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
