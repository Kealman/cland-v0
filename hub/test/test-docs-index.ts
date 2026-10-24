import assert from 'node:assert/strict';

/** Index order is presentation only. Git's union merge can keep an identical row twice when two
 * branches index the same document, so identical rows count once; membership stays one-to-one. */
export function assertTestDocIndex(index: string, documents: string[]): void {
  const rows = [...new Set(index.split('\n').map(line => line.trim()).filter(line => /\[Notes\]\(/.test(line)))];
  const listed = rows.flatMap(row => [...row.matchAll(/\[Notes\]\(([^)]+)\)/g)].map(match => match[1]!)).sort();
  assert.deepEqual(listed, [...documents].sort(), 'each per-test document must be indexed exactly once');
}
