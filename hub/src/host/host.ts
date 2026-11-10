import type { WorktreeAdd } from './agent/worktrees.ts';

/** Host-local PIDs are meaningful only on the Host that returned them. */
export type HostProcess = { pid: number | null; pidStarted?: string | null; pidIdentity?: string | null };
export type { LoginDisk } from './agent/resource-types.ts';
import type { LoginDisk } from './agent/resource-types.ts';
export type HostCommand = {
  command: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number; signal?: AbortSignal;
  /** Host-side path; spawn appends stdout and stderr, otherwise ignoring both. */
  logFile?: string;
};
/** Additive native and generation-bound proof; absent fields never establish non-admission. */
export type HostRunResult = { code: number | null; stdout: string; stderr: string; error?: string; nativeAdmission?: 'no-process'; claudeAdmission?: { generation: string; outcome: 'refused-before-spawn' } };
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
  /** Older Hosts may lack the login-disk operation; callers must refuse then. */
  loginDisk?(input: LoginDisk): Promise<void>;
  /** Synchronous existing transport/admission observation; absent retains legacy behavior. */
  loginDiskReachable?(): boolean;
  /** A fresh host capacity observation, including agent memory reports. */
  onCapacityChanged?(listener: (availableBytes: number) => void): () => void;
  readonly name: string;
  /** Drain the existing leased agent ref-push owner; absent agents refuse admission. */
  flushBranch?(path: string, branch: string): Promise<void>;
  /** Separate human terminal connection; absent on older/test Hosts. */
  terminalAttachCommand?(name: string): string;
  readonly layout: (input: HostLaunchLayoutInput) => HostLaunchLayout;
  /** Exact bytes; an explicit mode applies to existing files too. truncate requires empty bytes. */
  writeFile(path: string, bytes: Uint8Array, options?: { mode?: number; truncate?: number }): Promise<void>;
  /** Atomically publish complete bytes. Default preserves existing paths and returns false;
   * replace atomically replaces them. Staging is cleaned before resolution. */
  publishFile(path: string, bytes: Uint8Array, options?: { mode?: number; replace?: boolean }): Promise<boolean>;
  /** Append exact bytes with O_APPEND; creates a missing file using the process umask. */
  appendFile(path: string, bytes: Uint8Array): Promise<void>;
  /** Follows links, like native stat; missing paths reject with ENOENT. */
  stat(path: string): Promise<{ mode: number; size: number }>;
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
  /** Optional agent-owned Claude launch and discovery; older agents refuse explicitly. */
  launchClaude?(command: HostCommand, generation: string): Promise<HostRunResult>;
  /** Consume the native worker pinned by the agent, never a caller PID. */
  adopt?(generation: string): Promise<{ process: HostProcess; job: string; session: string; closed?: boolean; released?: boolean; release?: () => Promise<void>; forget?: () => Promise<void> }>;
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
  worktreeAdd(options: WorktreeAdd): Promise<{ warning?: string; checkout?: import('./agent/prepared-checkout.ts').CheckoutOwnership }>;
  worktreeRemove(options: { root: string; path: string }): Promise<void>;
  occupants(path: string, sessions: readonly { name: string; cwd: string }[]): Promise<string[]>;
  /** Whether this Host permits idle account polling. Live-session reads are separate. */
  readonly limitPolls: boolean;
  processes(): Promise<HostProcessUsage[]>;
}

/** Exact absent-generation receipt; carries only idempotent metadata cleanup, never process authority. */
export class MissingClaudeGeneration extends Error {
  readonly generation:string;
  readonly forget:()=>Promise<void>;
  constructor(generation:string,forget:()=>Promise<void>){super('Claude generation receipt missing');this.generation=generation;this.forget=forget;}
}
