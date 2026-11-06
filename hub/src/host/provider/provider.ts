/** Host provisioning is independent of verification's Executor. Provider tokens
 * and native resource details stay behind this interface, on the hub. */
export type HostArchitecture = 'x86_64' | 'arm64';
export type Machine = { id: string; address: string; architecture: HostArchitecture; created: string };
export type AcquireOptions = { project: string; pool: string; architecture: HostArchitecture };
export type Failed = { state: 'failed'; reason: string };
export type AcquireResult = { state: 'created'; machine: Machine } | { state: 'refused'; reason: string; retryAt: string } | Failed;
export type MachineStatus = { state: 'booting' | 'ready' | 'gone' } | Failed;
export type ReleaseResult = { state: 'released' } | { state: 'incomplete'; reason: string };
export type PrepareResult = { state: 'prepared' | 'current'; summary: string } | Failed;
export type ReapOptions = { project: string; pool: string };
export type ReapResult = { state: 'reaped'; released: string[]; incomplete: string[] } | Failed;
export interface HostProvider {
  readonly transport: 'ssh';
  acquire(options: AcquireOptions): Promise<AcquireResult>;
  prepare(): Promise<PrepareResult>;
  status(machine: Machine): Promise<MachineStatus>;
  /** Caller first drains sessions and host transports. Success requires a
   * positive read of native absence, including every associated key. */
  release(machine: Machine): Promise<ReleaseResult>;
  reap(options: ReapOptions): Promise<ReapResult>;
}
