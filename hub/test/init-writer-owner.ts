// One cancellation owner for init's concurrent SQLite writer and worker thread.
import type { TestContext } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Worker } from 'node:worker_threads';
import { onCleanup } from './process-cleanup.ts';

export function ownInitWriter(t: TestContext, writer: DatabaseSync) {
  let worker: Worker | undefined;
  let disposed: Promise<void> | undefined;
  const state = { writerClosed: false, workerJoined: false };
  const cleanup = () => disposed ??= (async () => {
    try { writer.close(); state.writerClosed = true; }
    finally {
      if (worker) { await worker.terminate(); state.workerJoined = true; }
    }
  })();
  // onCleanup runs before ownDirectory even when cancellation starts teardown
  // without waiting for the test body. Concurrent callers join one disposal.
  onCleanup(t, cleanup);
  return {
    attach: (thread: Worker) => { worker = thread; },
    cleanup,
    state,
  };
}
