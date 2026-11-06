import type { HostWorktreeRecord } from './task-worktrees.ts';

/** Stable-session intent pins the native generation whose authority may be released. */
export type HostRelaunchIntent = {
  sourceGeneration: string;
  sourceHost: string;
  targetHost: string;
  item: string;
  cause: string;
  phase: 'admitted' | 'prepared' | 'failed';
  tree?: HostWorktreeRecord;
  failure?: string;
};
export type HostRelaunchCompletion = {
  intentKey: string;
  sourceGeneration: string;
  tree: HostWorktreeRecord;
  note: string;
};
export const hostRelaunchIntentKey = (sessionId: string) => `host-relaunch-intent:${sessionId}`;
export const hostRelaunchWarningKey = (generation: string) => `host-relaunch:${generation}`;
