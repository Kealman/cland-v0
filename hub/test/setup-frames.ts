import type { TestContext } from 'node:test';
import type { FrameClient, SocketClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { testSetupWaitMs } from './until.ts';

/** Receipt headroom, owned until teardown; product latency bounds use the client directly. */
export function setupFrames(t: TestContext, client: FrameClient, reason: string, signal?: AbortSignal) {
  const owner = setupReceipts(t, reason, signal);
  return {
    waitFor: (predicate: Parameters<FrameClient['waitFor']>[0]) => owner.own(() => client.waitFor(predicate, testSetupWaitMs(), owner.signal)),
    request: (frame: Parameters<FrameClient['request']>[0]) => owner.own(() => client.request(frame, testSetupWaitMs(), owner.signal)),
    close: owner.close,
  };
}

export function setupSocket(t: TestContext, client: SocketClient, reason: string, signal?: AbortSignal) {
  const owner = setupReceipts(t, reason, signal);
  return { next: () => owner.own(() => client.next(testSetupWaitMs(), owner.signal)), close: owner.close };
}

function setupReceipts(t: TestContext, reason: string, parent?: AbortSignal) {
  const abort = new AbortController();
  const signal = AbortSignal.any([t.signal, abort.signal, ...(parent ? [parent] : [])]);
  const pending = new Set<Promise<unknown>>();
  const close = async () => {
    abort.abort(new Error(`${reason}: fixture teardown`));
    await Promise.allSettled([...pending]);
  };
  onCleanup(t, close);
  const own = <T>(run: () => Promise<T>): Promise<T> => {
    const work = run().catch(cause => { throw new Error(`${reason}: receipt failed`, { cause }); });
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  };
  return { own, signal, close };
}
