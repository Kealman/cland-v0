import type { WorktreeAdd } from './agent/worktrees.ts';

/** Host-local PIDs are meaningful only on the Host that returned them. */
export type HostProcess = { pid: number | null; pidStarted?: string | null; pidIdentity?: string | null };
export type HostCommand = {
  command: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number; signal?: AbortSignal;
  /** Host-side path; spawn appends stdout and stderr, otherwise ignoring both. */
  logFile?: string;
};
export type HostRunResult = { code: number | null; stdout: string; stderr: string; error?: string };
export type { HostProcessUsage } from './agent/process-usage.ts';
import type { HostProcessUsage } from './agent/process-usage.ts';

/** Hub-side final authority after host-side log preparation, immediately before spawn. */
export type HostSpawnOptions = { authorize?: () => void };

/** Hub-side callbacks between process-tree capture and signals; data is transport-neutral. */
export type HostCapturedProcess = { pid: number; pidStarted: string; pidIdentity: string };
export type HostStopOptions = {
  graceMs?: number;
  allowReused?: boolean;
  beforeSignal?: (tree: readonly HostCapturedProcess[]) => Promise<void>;
  authorize?: (tree: readonly HostCapturedProcess[]) => void;
  log?: (entry: Record<string, unknown>) => void;
};

export type HostEndpoint = { socket: string } | { port: number };
export type HostLaunchLayoutInput = { discoveryFile: string; node: string; cli: string; spoke: string };
export type HostLaunchLayout = Readonly<HostLaunchLayoutInput & { runDirectory: string; logDirectory: string; modDir?: string }>;

/** Operations shared by local and remote implementations. No native handles cross this seam. */
export interface Host {
  readonly name: string;
  readonly layout: (input: HostLaunchLayoutInput) => HostLaunchLayout;
  /** Exact bytes; an explicit mode applies to existing files too. truncate requires empty bytes. */
  writeFile(path: string, bytes: Uint8Array, options?: { mode?: number; truncate?: number }): Promise<void>;
  /** One directory; parents are owned and journaled separately by the caller. */
  makeDirectory(path: string, mode?: number): Promise<void>;
  /** Never recursive. directory removes an empty directory only; otherwise unlink the path itself. */
  removePath(path: string, options?: { directory?: boolean }): Promise<void>;
  /** Probe and release an IPv4 loopback port, not a reservation through child bind. */
  freePort(): Promise<number>;
  forward(sessionId: string, endpoint: HostEndpoint): Promise<HostEndpoint>;
  unforward(sessionId: string): Promise<void>;
  /** Native exit receipt resolves once; no process handle crosses the Host seam. */
  spawn(command: HostCommand, options?: HostSpawnOptions): Promise<{ pid: number; exited: Promise<{ code: number | null; signal: string | null }> }>;
  run(command: HostCommand): Promise<HostRunResult>;
  identity(pid: number): Promise<HostProcess | null>;
  /** With neither start nor birth proof, observe PID existence only; this grants no signal authority. */
  alive(process: HostProcess): Promise<boolean>;
  /** False means ownership or complete termination could not be proved. */
  stop(process: HostProcess, options?: HostStopOptions): Promise<boolean>;
  statDirectory(path: string): Promise<{ refusal: string | null; identity: { dev: number; ino: number } | null }>;
  realpath(path: string): Promise<string>;
  /** Source type without following symbolic links; ENOENT/ENOTDIR are missing. */
  fileType(path: string): Promise<'file' | 'directory' | 'symlink' | 'other' | 'missing'>;
  readFile(path: string): Promise<Uint8Array>;
  listFolder(path: string): Promise<string[]>;
  /** Optional territory supplies the captured source path and commit before add; omitted keeps legacy local refs.
   * Await beforeInstall after Git and before install I/O; false skips installs for recovery. */
  worktreeAdd(options: WorktreeAdd): Promise<{ warning?: string }>;
  worktreeRemove(options: { root: string; path: string }): Promise<void>;
  occupants(path: string, sessions: readonly { name: string; cwd: string }[]): Promise<string[]>;
  /** Whether this Host permits idle account polling. Live-session reads are separate. */
  readonly limitPolls: boolean;
  processes(): Promise<HostProcessUsage[]>;
}
