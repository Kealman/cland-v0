import assert from 'node:assert/strict';
import { lstat } from 'node:fs/promises';
import type { TestContext } from 'node:test';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { caseDeadlines } from './case-deadlines.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { tempProject } from './harness.ts';
import { afterCleanup, beforeDirectories, guardDirectoryRemoval, onCleanup, ownProcess } from './process-cleanup.ts';
import { testWaitMs } from './until.ts';

type Owned<T> = { value: T; close: () => Promise<void> };
type CloseOrder = { afterJoin?: boolean };
export type ResidueCase = {
  signal: AbortSignal;
  step<T>(name: string, operation: () => Promise<T>): Promise<T>;
  root(prefix?: string, parent?: string): Promise<string>;
  own<T>(value: T, close: (value: T) => void | Promise<void>, order?: CloseOrder): Owned<T>;
  acquire<T>(name: string, acquire: () => T | Promise<T>, close: (value: T) => void | Promise<void>, order?: CloseOrder): Promise<Owned<T>>;
  restore(operation: () => void): void;
};

/** Item-local composition: keep original work, resources, roots and seams in
 * that order. A rejected resource close never becomes permission to remove roots
 * or restore the native guard. No other fixture family is migrated here. */
export function residueControl(t: TestContext, options: { native?: boolean } = {}) {
  const roots = new Set<string>();
  const outstanding = new Set<() => Promise<void>>();
  const beforeJoin = new Set<() => Promise<void>>();
  const restorations: Array<() => void> = [];
  const releases: Array<() => void> = [];
  let closeCase: (() => Promise<unknown>) | undefined;
  let admitted = false;
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restoreGuard: (() => void) | undefined;
  const scope = caseDeadlines(t, {
    timeoutMs: testWaitMs(options.native ? 10_000 : 5000),
    ownership: {
      beforeDirectories: (context, close) => { closeCase = close; beforeDirectories(context, close); },
      guardDirectoryRemoval,
    },
    releaseOnClose: () => {
      const failures: unknown[] = [];
      for (const release of releases) { try { release(); } catch (error) { failures.push(error); } }
      // A body can be observing a child's close. Request known resource stops
      // before joining that observation; the hook below still owns each result.
      for (const close of beforeJoin) void close().catch(() => {});
      if (failures.length) throw new AggregateError(failures, 'fixture hold release failed');
    },
  });
  const requireResourcesClosed = () => {
    if (outstanding.size) throw new Error('fixture resource closure unconfirmed; roots and seams retained');
  };
  // Enroll before acquisition; process-cleanup runs checks after its directory
  // phase. A missing root is observed separately from the resource receipts.
  afterCleanup(scope.fixtures, async () => {
    requireResourcesClosed();
    for (const root of roots) await assert.rejects(lstat(root), { code: 'ENOENT' });
    guard?.verify();
    for (const restore of [...restorations].reverse()) restore();
    restoreGuard?.();
  });
  const own = <T>(value: T, stop: (value: T) => void | Promise<void>, order: CloseOrder = {}): Owned<T> => {
    let closing: Promise<void> | undefined;
    const close = () => closing ??= Promise.resolve().then(() => stop(value)).then(() => { outstanding.delete(close); beforeJoin.delete(close); });
    outstanding.add(close);
    if (!order.afterJoin) beforeJoin.add(close);
    onCleanup(scope.fixtures, close);
    return { value, close };
  };
  return {
    release(operation: () => void) {
      if (admitted) throw new Error('register hold releases before fixture admission');
      releases.push(operation);
    },
    close: () => { assert.ok(closeCase); return closeCase(); },
    run<T>(body: (control: ResidueCase) => Promise<T>): Promise<T> {
      if (admitted) throw new Error('fixture sequence already admitted');
      admitted = true;
      return scope.run(async (admit, originalSignal) => {
        const signal = AbortSignal.any([t.signal, originalSignal]);
        const step = <V>(name: string, operation: () => Promise<V>): Promise<V> => scope.wait(name, () => admit(async () => {
          signal.throwIfAborted();
          const value = await operation();
          signal.throwIfAborted();
          return value;
        }));
        const control: ResidueCase = {
          signal, step, own,
          root: (prefix, parent) => step('fixture root setup', async () => {
            const root = await tempProject(scope.fixtures, prefix, parent);
            roots.add(root);
            scope.adoptRoot(root);
            guardDirectoryRemoval(root, requireResourcesClosed);
            return root;
          }),
          acquire: (name, acquire, stop, order) => step(name, async () => own(await acquire(), stop, order)),
          restore: operation => { restorations.push(operation); },
        };
        if (!options.native) await step('counted native guard setup', async () => {
          guard = await fakeNativeGuard(restore => { restoreGuard = restore; });
        });
        return body(control);
      });
    },
  };
}

/** Called inside the original producer: install close observation and a cleanup
 * slot before native identity capture can reject. No launch snapshot is closure. */
export function residueChild(c: ResidueCase, name: string, start: () => ChildProcess, ipc = false) {
  return c.step(name, async () => {
    const child = start();
    const firstMessage = ipc ? once(child, 'message', { signal: c.signal }) : undefined;
    void firstMessage?.catch(() => {}); // The original body observes it, or cancellation owns the rejection.
    let tail = Buffer.alloc(0);
    const append = (bytes: Buffer | string) => {
      const chunk = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      tail = chunk.byteLength >= 4000 ? Buffer.from(chunk.subarray(-4000))
        : Buffer.concat([tail.subarray(Math.max(0, tail.byteLength + chunk.byteLength - 4000)), chunk]);
    };
    const closed = new Promise<[number | null, NodeJS.Signals | null]>(resolve => child.once('close', (code, signal) => resolve([code, signal])));
    child.on('error', error => append(String(error)));
    for (const stream of [child.stdout, child.stderr]) stream?.on('data', append);
    let stop: (() => Promise<void>) | undefined;
    const owner = c.own(child, async () => {
      if (!stop) throw new Error('native child ownership capture incomplete; root retained');
      await stop();
      await closed;
    });
    stop = ownProcess(undefined, child.pid);
    const observe = <T>(boundary: string, operation: () => Promise<T>) => c.step(boundary, operation).catch(error => {
      throw new Error(`incomplete ${boundary}: exit ${child.exitCode ?? 'pending'}, signal ${child.signalCode ?? 'none'}; tail: ${tail.toString('utf8')}`, { cause: error });
    });
    return { child, closed, firstMessage, close: owner.close, observe, diagnostic: () => tail.toString('utf8') };
  });
}
