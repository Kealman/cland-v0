/** Manual selection-only probe. Input must be a disposable journal copy. */
import { readStartupJournal } from '../src/hub/journal.ts';
import { performance } from 'node:perf_hooks';

if (process.argv.includes('--help') || !process.argv[2]) {
  console.log('Usage: node hub/test/measure-startup-journal.ts SCRATCH_JOURNAL\nReports selection work bytes, selected count and process memory immediately after selection. Excludes hub startup, other replay and post-GC retained memory. Never pass the live journal. No budget enforcement.');
} else {
  const started = performance.now();
  const stats = { bytesRead: 0, peakBufferedBytes: 0 };
  const records = await readStartupJournal(process.argv[2], stats);
  console.log(JSON.stringify({ scope: 'selection only; output records included in process memory, excluded from buffer work guard', platform: process.platform, node: process.version, records: records.length, stats, elapsedMs: performance.now() - started, memory: process.memoryUsage() }));
}
