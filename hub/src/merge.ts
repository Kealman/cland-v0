// Typed gate failures shared by the hub and territory; every failure before landing leaves refs alone.
export type MergeCode = 'merge-git' | 'merge-item' | 'merge-branch' | 'merge-territory' | 'merge-base' | 'merge-checkout'
  | 'review-missing' | 'review-provenance' | 'review-role' | 'review-claimant' | 'review-not-clear' | 'review-stale' | 'review-pending'
  | 'qa-missing' | 'qa-provenance' | 'qa-role' | 'qa-claimant' | 'qa-not-clear' | 'qa-stale' | 'qa-pending'
  | 'merge-conflict' | 'merge-dirty' | 'merge-changed' | 'merge-recovery' | 'verdict-missing';
export class MergeError extends Error {
  readonly code: MergeCode;
  readonly files: string[] | undefined;
  readonly recovery: { commit: string; base: string } | undefined;
  constructor(code: MergeCode, message: string, files?: string[], recovery?: { commit: string; base: string }) { super(`${code}: ${message}`); this.code = code; this.files = files; this.recovery = recovery; }
}
