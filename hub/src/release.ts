import type { HomebrewResult } from './homebrew.ts';
export type ReleaseCode = 'release-item' | 'release-version' | 'release-tag' | 'release-empty' | 'release-github' | 'release-behind'
  | 'release-t3' | 'release-state' | 'release-territory' | 'release-changed' | 'sync-dirty' | 'sync-conflict' | 'sync-behind' | 'sync-recovery';

export class ReleaseError extends Error {
  readonly code: ReleaseCode;
  readonly files: string[] | undefined;
  constructor(code: ReleaseCode, message: string, files?: string[]) {
    super(`${code}: ${message}`); this.code = code; this.files = files;
  }
}

export type ReleaseResult = {
  version: string; commit: string; notes: string; refs: string[]; dryRun: boolean;
  homebrew?: HomebrewResult;
  followUp?: { step: string; error: string };
};

export type SyncResult = { main: string; dev: string; followUp?: { step: string; error: string } };
