import type { HostArchitecture, Machine, Volume, VolumeSnapshot } from '../agent/resource-types.ts';
export type { HostArchitecture, Machine, Volume, VolumeSnapshot } from '../agent/resource-types.ts';
import type { PoolImageKey } from './pool-image.ts';
import type { HostProviderDeclarationState } from './declarations.ts';
/** Host provisioning is independent of verification's Executor. Provider tokens
 * and native resource details stay behind this interface, on the hub. */
export type HostCreateAdmission = { provider:string; root:string; project:string; lease?: import('../host-leases.ts').HostLease; watchdog?: import('../host-watchdog.ts').HostWatchdogIdentity; reservation?: {project:string;lease:string;pool:string;deadline:string} };
export type HostSshIdentity = {environment?:{CLAND_FAKE_HOSTS:string};user?:string;clientKeyPath:string;knownHosts:string;home:string;node:string};
export type AcquireOptions = { signal?:AbortSignal; admission?:HostCreateAdmission; size?:string; project: string; pool: string; architecture: HostArchitecture; region?: string; userData?: string; image?: PoolImageKey };
export type CreateAdmission = { state:'allowed' } | { state:'refused'; reason:string; retryAt?:string };
export type Failed = { state: 'failed'; reason: string };
export type AcquireResult = { state: 'created'; machine: Machine; ssh?:HostSshIdentity } | { state: 'refused'; reason: string; retryAt: string;nonAcquisition?:import('../acquisition-receipt.ts').ProviderNonAcquisitionReceipt } | Failed;
export type StatusReadScope = {signal?:AbortSignal;deadline?:number};
export type MachineStatus = { state: 'booting' | 'ready' | 'gone' } | Failed;
export type ReleaseRead = {resource:'machine'|'key';read:string};
export type ReleaseObserver = (receipt:ReleaseRead)=>void;
export type ReleaseResult = { state: 'released' } | { state: 'incomplete'; reason: string };
export type PrepareResult = { state: 'prepared' | 'current'; summary: string } | Failed;
export type ReapOptions = { project: string; pool: string };
export type ReapResult = { state: 'reaped'; released: string[]; incomplete: string[] } | Failed;
export interface HostProvider {
  readonly transport: 'ssh';
  readonly declarations: HostProviderDeclarationState;
  /** Side-effect free: no API call or resource admission. */
  createAdmission(admission?:HostCreateAdmission): CreateAdmission;
  acquire(options: AcquireOptions): Promise<AcquireResult>;
  releaseAdmission?(project:string,pool:string,id:string):Promise<{state:'released';nonAcquisition:import('../acquisition-receipt.ts').ProviderNonAcquisitionReceipt}|Extract<ReleaseResult,{state:'incomplete'}>>;
  findAdmission?(project:string,pool:string,id:string):Promise<Machine|undefined>;
  prepare(options?: { pool: string; key: PoolImageKey }): Promise<PrepareResult>;
  /** Scoped reads must join cancellation before rejecting, freeing the provider for release. */
  status(machine: Machine, scope?:StatusReadScope): Promise<MachineStatus>;
  /** Caller first drains sessions and host transports. Success requires a
   * positive read of native absence, including every associated key. */
  release(machine: Machine, confirm?:ReleaseObserver): Promise<ReleaseResult>;
  reap(options: ReapOptions): Promise<ReapResult>;
  getSnapshot(id: string): Promise<GetSnapshotResult>;
  listSnapshots(volume: Volume): Promise<ListSnapshotsResult>;
  deleteSnapshot(snapshot: VolumeSnapshot | string): Promise<DeleteSnapshotResult>;
  snapshotVolume(volume: Volume): Promise<SnapshotVolumeResult>;
  attachVolume(volume: Volume, machine: Machine): Promise<AttachVolumeResult>;
  detachVolume(volume: Volume, machine: Machine): Promise<DetachVolumeResult>;
  createVolume(options: CreateVolumeOptions): Promise<CreateVolumeResult>;
  listVolumes(options: { project: string }): Promise<ListVolumesResult>;
  /** Caller drains volume users before deletion; success requires a read of absence. */
  deleteVolume(volume: Volume): Promise<DeleteVolumeResult>;
}

export type CreateVolumeOptions = { project: string; name: string; region: string; sizeGiB: number; fromSnapshot?: VolumeSnapshot | string };
export type CreateVolumeResult = { state: 'created'; volume: Volume } | { state: 'refused'; reason: string; retryAt?: string } | Failed;
export type DeleteVolumeResult = { state: 'deleted' } | { state: 'incomplete'; reason: string } | { state: 'refused'; reason: 'attached' };
export type ListVolumesResult = { state: 'listed'; volumes: Volume[] } | Failed;

export type VolumeRefusal = { state: 'refused'; reason: 'attached elsewhere' | 'region mismatch' | 'project mismatch' | 'machine unavailable' };
export type AttachVolumeResult = { state: 'attached' } | VolumeRefusal | Failed;
export type DetachVolumeResult = { state: 'detached' } | VolumeRefusal | Failed;

export type SnapshotVolumeResult = { state: 'snapshotted'; snapshot: VolumeSnapshot } | { state: 'refused'; reason: 'rate limited'; retryAt: string } | Failed;

export type ListSnapshotsResult = { state: 'listed'; snapshots: VolumeSnapshot[] } | { state: 'volume-gone' } | Failed;
export type GetSnapshotResult = { state: 'found'; snapshot: VolumeSnapshot } | Failed;
export type DeleteSnapshotResult = { state: 'deleted' } | { state: 'incomplete'; reason: string } | Failed;
