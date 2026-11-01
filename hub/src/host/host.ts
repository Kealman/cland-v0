/** Host-local PIDs are meaningful only on the Host that returned them. */
export type HostProcess = { pid: number | null; pidStarted?: string | null; pidIdentity?: string | null };
export type HostCommand = { command: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number; signal?: AbortSignal };
export type HostRunResult = { code: number | null; stdout: string; stderr: string; error?: string };
export type HostProcessUsage = {
  pid: number;
  parent: number;
  /** Resident bytes and ps CPU percentage, summed over this PID and its descendants. */
  rssBytes: number;
  cpuPercent: number;
};

/** Process operations shared by local and remote implementations. No native handles cross this seam. */
export interface Host {
  readonly name: string;
  spawn(command: HostCommand): Promise<{ pid: number }>;
  run(command: HostCommand): Promise<HostRunResult>;
  identity(pid: number): Promise<HostProcess | null>;
  alive(process: HostProcess): Promise<boolean>;
  /** False means ownership or complete termination could not be proved. */
  stop(process: HostProcess): Promise<boolean>;
  processes(): Promise<HostProcessUsage[]>;
}
