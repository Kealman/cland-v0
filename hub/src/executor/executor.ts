import type { SuiteSelection } from '../suite-selection.ts';

export type ExecutorKind = 'local' | 'droplet';
export type RunRef = {
  id: string; cwd: string; head: string; tree?: string | null; mode: string;
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
export interface Executor {
  acquire(run: RunRef, deadline: string): Promise<Lease>;
  prepare(identity: string): Promise<void>;
  deliver(lease: Lease, run: RunRef): Promise<void>;
  /** Idempotent detached admission; completion is observed through status. */
  start(lease: Lease, run: RunRef): Promise<void>;
  status(lease: Lease): Promise<RunStatus>;
  /** Offsets are bytes, including when the text contains multibyte characters. */
  log(lease: Lease, offset: number): Promise<{ text: string; next: number; bytes?: Uint8Array }>;
  cancel(lease: Lease, signal: string): Promise<void>;
  release(lease: Lease): Promise<Released>;
  reap(olderThanMs?: number): Promise<void>;
}
