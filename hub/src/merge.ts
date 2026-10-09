// Typed gate failures shared by the hub and territory; every failure before landing leaves refs alone.
export type MergeCode = 'merge-item' | 'merge-branch' | 'merge-territory' | 'merge-base' | 'merge-checkout'
  | 'review-missing' | 'review-provenance' | 'review-role' | 'review-claimant' | 'review-not-clear' | 'review-stale' | 'review-pending'
  | 'qa-missing' | 'qa-provenance' | 'qa-role' | 'qa-claimant' | 'qa-not-clear' | 'qa-stale' | 'qa-pending'
  | 'merge-conflict' | 'merge-dirty' | 'merge-changed';
export class MergeError extends Error {
  readonly code: MergeCode;
  readonly files: string[] | undefined;
  constructor(code: MergeCode, message: string, files?: string[]) { super(`${code}: ${message}`); this.code = code; this.files = files; }
}
