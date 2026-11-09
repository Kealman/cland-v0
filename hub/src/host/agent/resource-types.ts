// Transport-neutral resource identities; no hub runtime dependencies.
export type HostArchitecture = 'x86_64' | 'arm64';
export type Machine = { id: string; address: string; architecture: HostArchitecture; created: string };
export type Volume = { id: string; project: string; name: string; region: string; sizeGiB: number; created: string; attachedTo: string | null };
export type VolumeSnapshot = { id: string; volumeId: string; created: string };
export type LoginDisk = { op: 'mount' | 'umount' | 'freeze' | 'thaw'; volume: string; path: string };
