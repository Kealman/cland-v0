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

/** Operations shared by local and remote implementations. No native handles cross this seam. */
export interface Host {
  readonly name: string;
  spawn(command: HostCommand): Promise<{ pid: number }>;
  run(command: HostCommand): Promise<HostRunResult>;
  identity(pid: number): Promise<HostProcess | null>;
  alive(process: HostProcess): Promise<boolean>;
  /** False means ownership or complete termination could not be proved. */
  stop(process: HostProcess, options?: { graceMs?: number; allowReused?: boolean }): Promise<boolean>;
  statDirectory(path: string): Promise<{ refusal: string | null; identity: { dev: number; ino: number } | null }>;
  realpath(path: string): Promise<string>;
  /** Source type without following symbolic links; ENOENT/ENOTDIR are missing. */
  fileType(path: string): Promise<'file' | 'directory' | 'symlink' | 'other' | 'missing'>;
  readFile(path: string): Promise<Uint8Array>;
  listFolder(path: string): Promise<string[]>;
  worktreeAdd(options: { root: string; path: string; branch: string }): Promise<{ warning?: string }>;
  worktreeRemove(options: { root: string; path: string }): Promise<void>;
  occupants(path: string, sessions: readonly { name: string; cwd: string }[]): Promise<string[]>;
  /** Whether this Host permits idle account polling. Live-session reads are separate. */
  readonly limitPolls: boolean;
  processes(): Promise<HostProcessUsage[]>;
}
