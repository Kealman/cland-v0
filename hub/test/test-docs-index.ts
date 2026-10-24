import assert from 'node:assert/strict';

/** Index order is presentation only; membership must remain exactly one-to-one. */
export function assertTestDocIndex(index: string, documents: string[]): void {
  const listed = [...index.matchAll(/\[Notes\]\(([^)]+)\)/g)].map(match => match[1]!).sort();
  assert.deepEqual(listed, [...documents].sort(), 'each per-test document must be indexed exactly once');
}
