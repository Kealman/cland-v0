// A fresh process per pass releases compiler state and owns its V8 flags.
import { getHeapStatistics } from 'node:v8';
import { testLintFactRecord } from './test-lint.ts';
import type { LintSource } from './test-lint-worker-runner.ts';

process.once('disconnect', () => process.exit(0));
process.once('message', (entries: LintSource[]) => {
  const heapSizeLimitBytes = getHeapStatistics().heap_size_limit;
  process.send!({ type: 'started', pid: process.pid, heapSizeLimitBytes });
  let peakHeapBytes = getHeapStatistics().used_heap_size;
  const facts = entries.map(({ file, text, entry }) => {
    const record = testLintFactRecord(file, text, entry);
    peakHeapBytes = Math.max(peakHeapBytes, getHeapStatistics().used_heap_size);
    return record;
  });
  process.send!({ type: 'completed', files: entries.length, facts, peakHeapBytes, heapSizeLimitBytes }, () => process.disconnect());
});
