import type { PoolImageKey } from './pool-image.ts';
import type { HostProviderDeclarationState } from './declarations.ts';
/** Host provisioning is independent of verification's Executor. Provider tokens
 * and native resource details stay behind this interface, on the hub. */
export type HostArchitecture = 'x86_64' | 'arm64';
export type Machine = { id: string; address: string; architecture: HostArchitecture; created: string };
export type AcquireOptions = { project: string; pool: string; architecture: HostArchitecture; region?: string };
export type Failed = { state: 'failed'; reason: string };
export type AcquireResult = { state: 'created'; machine: Machine } | { state: 'refused'; reason: string; retryAt: string } | Failed;
export type MachineStatus = { state: 'booting' | 'ready' | 'gone' } | Failed;
export type ReleaseResult = { state: 'released' } | { state: 'incomplete'; reason: string };
export type PrepareResult = { state: 'prepared' | 'current'; summary: string } | Failed;
export type ReapOptions = { project: string; pool: string };
export type ReapResult = { state: 'reaped'; released: string[]; incomplete: string[] } | Failed;
export interface HostProvider {
  readonly transport: 'ssh';
  readonly declarations: HostProviderDeclarationState;
  acquire(options: AcquireOptions): Promise<AcquireResult>;
  prepare(options?: { pool: string; key: PoolImageKey }): Promise<PrepareResult>;
  status(machine: Machine): Promise<MachineStatus>;
  /** Caller first drains sessions and host transports. Success requires a
   * positive read of native absence, including every associated key. */
  release(machine: Machine): Promise<ReleaseResult>;
  reap(options: ReapOptions): Promise<ReapResult>;
  snapshotVolume(volume: Volume): Promise<SnapshotVolumeResult>;
  attachVolume(volume: Volume, machine: Machine): Promise<AttachVolumeResult>;
  detachVolume(volume: Volume, machine: Machine): Promise<DetachVolumeResult>;
  createVolume(options: CreateVolumeOptions): Promise<CreateVolumeResult>;
  listVolumes(options: { project: string }): Promise<ListVolumesResult>;
  /** Caller drains volume users before deletion; success requires a read of absence. */
  deleteVolume(volume: Volume): Promise<DeleteVolumeResult>;
}

export type Volume = { id: string; project: string; name: string; region: string; sizeGiB: number; created: string; attachedTo: string | null };
export type CreateVolumeOptions = { project: string; name: string; region: string; sizeGiB: number };
export type CreateVolumeResult = { state: 'created'; volume: Volume } | Failed;
export type DeleteVolumeResult = { state: 'deleted' } | { state: 'incomplete'; reason: string } | { state: 'refused'; reason: 'attached' };
export type ListVolumesResult = { state: 'listed'; volumes: Volume[] } | Failed;

export type VolumeRefusal = { state: 'refused'; reason: 'attached elsewhere' | 'region mismatch' | 'project mismatch' | 'machine unavailable' };
export type AttachVolumeResult = { state: 'attached' } | VolumeRefusal | Failed;
export type DetachVolumeResult = { state: 'detached' } | VolumeRefusal | Failed;

export type VolumeSnapshot = { id: string; volumeId: string; created: string };
export type SnapshotVolumeResult = { state: 'snapshotted'; snapshot: VolumeSnapshot } | { state: 'refused'; reason: 'rate limited'; retryAt: string } | Failed;
