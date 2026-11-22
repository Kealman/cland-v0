// Typed gate failures shared by the hub and territory; every failure before landing leaves refs alone.
export const MERGE_PREFLIGHT_REPLY_MS = 30 * 60_000;
export type MergeCode = 'merge-bare' | 'merge-git' | 'merge-item' | 'merge-branch' | 'merge-territory' | 'merge-base' | 'merge-unpublished' | 'merge-checkout'
  | 'merge-verification' | 'merge-not-ready'
  | 'review-missing' | 'review-provenance' | 'review-role' | 'review-claimant' | 'review-not-clear' | 'review-stale' | 'review-pending'
  | 'qa-missing' | 'qa-provenance' | 'qa-role' | 'qa-claimant' | 'qa-not-clear' | 'qa-stale' | 'qa-pending'
  | 'merge-hold' | 'merge-budget' | 'merge-test-lint' | 'merge-tiers' | 'merge-shards' | 'merge-override-scope' | 'merge-conflict' | 'merge-dirty' | 'merge-changed' | 'merge-recovery' | 'verdict-missing' | 'criteria-incomplete';
export class MergeError extends Error {
  readonly code: MergeCode;
  readonly files: string[] | undefined;
  readonly recovery: { commit: string; base: string } | undefined;
  constructor(code: MergeCode, message: string, files?: string[], recovery?: { commit: string; base: string }) { super(`${code}: ${message}`); this.code = code; this.files = files; this.recovery = recovery; }
}

/** Internal infrastructure identity; wire consumers retain the existing Git code. */
export class MergeLintReadError extends MergeError {
  constructor(message: string) { super('merge-git', message); }
}
