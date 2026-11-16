import type { TestContext } from 'node:test';
import { fixtureWork as admittedWork, type FixtureStep } from '../../test-support/fixture-work.ts';
import { beforeDirectories, guardDirectoryRemoval, ownDirectory } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { testWaitMs } from './until.ts';

/** Compose the shared sequence owner before any asynchronous fixture acquisition. */
export function fixtureWork(t: TestContext) {
  const budget = testWaitMs(5000);
  const work = admittedWork(budget);
  const resources = new Set<() => Promise<void>>();
  const roots = new Set<() => Promise<void>>();
  const releases: Array<() => void | Promise<void>> = [];
  const restorations: Array<() => void> = [];
  let admitted = false;
  let settling: Promise<void> | undefined;
  let disposing: Promise<void> | undefined;
  const settle = () => settling ??= within((async () => {
    // close synchronously fences shared admission before releasing any hold.
    const joined = work.close();
    void joined.catch(() => {});
    const failures: unknown[] = [];
    const collect = async (operations: Promise<unknown>[]) => {
      for (const result of await Promise.allSettled(operations)) if (result.status === 'rejected') failures.push(result.reason);
    };
    await collect(releases.map(release => Promise.resolve().then(release)));
    await collect([...resources].map(close => close()));
    await collect([joined]);
    await collect([...resources].map(close => close())); // Adopted after cancellation.
    if (failures.length) throw new AggregateError(failures, 'fixture resources did not settle');
    for (const restore of restorations) restore();
  })(), budget, undefined, () => new Error('fixture admitted work did not drain; root retained'));
  const dispose = () => disposing ??= (async () => {
    await settle(); // Failed joins retain roots and environment.
    for (const remove of roots) await remove();
  })();
  beforeDirectories(t, dispose);
  const scope = (step: FixtureStep, signal: AbortSignal) => ({
    signal,
    root: async (start: () => Promise<string>): Promise<string> => {
      signal.throwIfAborted();
      const root = await step(start);
      // Capture late acquisition before checking cancellation or admitting more work.
      roots.add(ownDirectory(undefined, root));
      guardDirectoryRemoval(root, settle);
      signal.throwIfAborted();
      return root;
    },
    step: async <T>(start: () => T | Promise<T>): Promise<T> => {
      signal.throwIfAborted();
      const value = await step(async () => start());
      signal.throwIfAborted();
      return value;
    },
    acquire: async <T>(start: () => Promise<T>, stop: (value: T) => Promise<void>): Promise<T> => {
      signal.throwIfAborted();
      const value = await step(start);
      let closing: Promise<void> | undefined;
      const close = () => closing ??= Promise.resolve().then(() => stop(value));
      resources.add(close);
      if (signal.aborted) { await close(); signal.throwIfAborted(); }
      return value;
    },
  });
  return {
    dispose,
    release: (release: () => void | Promise<void>) => {
      if (admitted) throw new Error('register fixture holds before admission');
      releases.push(release);
    },
    restore: (restore: () => void) => {
      if (admitted) throw new Error('register fixture restoration before admission');
      restorations.push(restore);
    },
    run: <T>(body: (owned: ReturnType<typeof scope>) => Promise<T>): Promise<T> => {
      if (admitted) throw new Error('fixture work already admitted');
      admitted = true;
      const running = work.run((step, signal) => body(scope(step, AbortSignal.any([t.signal, signal]))));
      return running.then(async value => { await dispose(); return value; }, async error => {
        try { await dispose(); }
        catch (cleanup) { throw new AggregateError([error, cleanup], 'fixture work and settlement failed'); }
        throw error;
      });
    },
  };
}
