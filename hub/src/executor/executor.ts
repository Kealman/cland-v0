import type { SuiteSelection } from '../suite-selection.ts';

export type ExecutorKind = 'local' | 'droplet';
export type HostGate = { tree: string | null; command: string; code: number };
export type RunRef = {
  commands?: import('../verification-commands.ts').VerificationCommands;
  hostGate?: HostGate;
  limits?: import('../suite-limits.ts').SuiteLimits;
  config?: import('../init/config.ts').ProjectConfig;
  id: string; cwd: string; head: string; tree?: string | null; mode: string; integrated?: boolean;
  selection?: SuiteSelection; log: string; result: string; gate: string;
  queued?: string; locks?: string[]; workers?: number; size?: string;
};
/** Persisted with the run. Only the backend interprets resource. */
export type Lease = { kind: ExecutorKind; run: string; created: string; deadline: string; resource: unknown };
export type Platform = { os: string; arch: string; release: string; node: string; nvim: string };
export type RunStatus = {
  state: 'pending' | 'running' | 'done' | 'lost' | 'paused' | 'unknown';
  code?: number; cause?: string; finished?: string; platform?: Platform;
};
export type Released = { lifetimeMs: number | null; costUsd: number | null };
/** Backend-owned preparation inputs (image keys, for example) stay behind the interface. */
export type PrepareOptions = { step?: (step: string) => void };
export type ReapOptions = { authorize?: () => void };
export type NotApplicable = { state: 'not-applicable'; summary: string };
export type PrepareResult = NotApplicable | ({ state: 'current' | 'prepared'; summary: string; durationMs: number } & Released);
/** Resource identifiers and provider accounting remain backend-owned. */
export type ReapResult = NotApplicable | { summary: string };
export interface Executor {
  acquire(run: RunRef, deadline: string): Promise<Lease>;
  prepare(options?: PrepareOptions): Promise<PrepareResult>;
  deliver(lease: Lease, run: RunRef): Promise<void>;
  /** Idempotent detached admission; completion is observed through status. */
  start(lease: Lease, run: RunRef): Promise<void>;
  status(lease: Lease): Promise<RunStatus>;
  /** Offsets are bytes, including when the text contains multibyte characters. */
  log(lease: Lease, offset: number): Promise<{ text: string; next: number; bytes?: Uint8Array }>;
  cancel(lease: Lease, signal: string): Promise<void>;
  release(lease: Lease): Promise<Released>;
  reap(options?: ReapOptions): Promise<ReapResult>;
}
