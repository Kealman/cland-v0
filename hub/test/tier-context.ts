// Test identity is queried only on a resource call, never on every async operation.
export type TierTestContext = { fullName: string };
export function tierTestName(getContext: (() => TierTestContext | undefined) | undefined, warn: (line: string) => void): () => string {
  if (!getContext) {
    warn('tier-mismatch warning: node:test.getTestContext unavailable; resource trips have file-only attribution');
    return () => '(file only)';
  }
  return () => getContext()?.fullName ?? '(module initialization or file cleanup)';
}
