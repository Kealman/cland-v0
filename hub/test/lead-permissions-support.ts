import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { onCleanup } from './process-cleanup.ts';
import { testWaitMs } from './harness.ts';

/** Register before fixture setup: release and observe every held operation before peers,
 * hubs or roots close. The timer is a failure bound, never a synchronization wait. */
export function heldOperations(t: TestContext) {
  const releases: Array<() => void> = [];
  const pending = new Set<Promise<void>>();
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    for (const release of releases) release();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([...pending]),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('held operations did not settle before fixture teardown')), testWaitMs(30_000)); }),
      ]);
    } finally { clearTimeout(timeout); }
  })();
  onCleanup(t, close);
  return {
    close,
    track<T>(operation: Promise<T>): Promise<T> {
      assert.equal(closing, undefined, 'no operation starts after fixture teardown');
      const receipt = operation.then(() => {}, () => {});
      pending.add(receipt);
      void receipt.then(() => pending.delete(receipt));
      return operation;
    },
    gate() {
      assert.equal(closing, undefined, 'no barrier starts after fixture teardown');
      let enter!: () => void;
      let release!: () => void;
      const entered = new Promise<void>(resolve => { enter = resolve; });
      const released = new Promise<void>(resolve => { release = resolve; });
      releases.push(release);
      return { entered, released, enter, release };
    },
  };
}
