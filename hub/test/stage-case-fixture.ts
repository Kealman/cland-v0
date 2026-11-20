import type { TestContext } from 'node:test';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fixtureWork, type FixtureStep } from '../../test-support/fixture-work.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { afterCleanup, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';

/** Item-local owner. A settled rejection never supplies a writer-close receipt. */
export function stageCase(t: TestContext, options: { native?: boolean } = {}) {
  const original = fixtureWork();
  const pending = new Set<Promise<unknown>>();
  const required: Array<{ close: () => Promise<void>; done: boolean }> = [];
  const hooks: Array<() => Promise<void>> = [];
  const restorations: Array<() => void> = [];
  const releases: Array<() => void> = [];
  let released = false;
  let joined = false, cleanupSettled = false, restored = false;
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restoreGuard: (() => void) | undefined;
  let attempt: Promise<void> | undefined;
  const bound = <T>(name: string, work: Promise<T>, timeoutMs = 5000) => within(work, timeoutMs, undefined, () => new Error(`${t.name}: ${name} incomplete; fixture retained`));
  const wait = <T>(name: string, start: () => Promise<T>, timeoutMs = 5000) => {
    const work = Promise.resolve().then(start);
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return bound(name, work, timeoutMs);
  };
  const join = async () => {
    if (joined) return;
    const closing = original.close(); // Fence before releasing controlled holds.
    if (!released) { released = true; for (const release of releases) release(); }
    await closing;
    while (pending.size) await Promise.allSettled([...pending]);
    joined = true;
  };
  const confirmed = () => joined && required.every(receipt => receipt.done);
  const close = (): Promise<void> => {
    if (restored && confirmed() && cleanupSettled) return Promise.resolve();
    if (!attempt) {
      const work = (async () => {
        await join();
        for (const receipt of required) if (!receipt.done) {
          await receipt.close();
          receipt.done = true;
        }
        const failures: unknown[] = [];
        for (const hook of hooks) {
          try { await hook(); } catch (error) { failures.push(error); }
        }
        cleanupSettled = true;
        if (failures.length) throw new AggregateError(failures, 'stage ancillary cleanup failed after confirmed writer close');
      })();
      attempt = work;
      // Retain the actual promise beyond a failed observation deadline.
      void work.then(() => {}, () => { if (attempt === work) attempt = undefined; });
    }
    return bound('cleanup', attempt);
  };
  beforeDirectories(t, close);
  // Fence admission in the abort dispatch itself; normal hooks may run later.
  // close retains the original producer and required close receipts on failure.
  const signal = t.signal;
  const abort = () => { void close().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const restore = async () => {
    if (restored) return;
    if (!confirmed() || !cleanupSettled) throw new Error('stage resource close unconfirmed; seams and native guard retained');
    for (const undo of restorations.reverse()) undo();
    try { guard?.verify(); } finally { restoreGuard?.(); restored = true; }
  };
  afterCleanup(t, async () => {
    await restore();
    signal?.removeEventListener('abort', abort);
  });
  const requireClose = (close: () => Promise<void>) => {
    if (joined) throw new Error('resource acquisition after original-work join');
    required.push({ close, done: false });
  };
  const context = (register: (hook: () => Promise<void>) => void) => new Proxy(t, { get(target, key) {
    if (key === 'after') return (fn: Parameters<TestContext['after']>[0]) => {
      register(() => new Promise<void>((resolve, reject) => {
        const done = (error?: unknown) => error ? reject(error) : resolve();
        try {
          const result = fn?.(target, done);
          if (!fn || fn.length < 2) void Promise.resolve(result).then(() => resolve(), reject);
        } catch (error) { reject(error); }
      }));
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const fixtures = context(hook => hooks.push(hook));
  // Fixture helpers register their partial-startup stop callback here before
  // acquisition, so a failed observation cannot lose the returned owner.
  const resources = context(requireClose);
  return { wait, fixtures, resources, close, restore, nativeBoundary: () => cp.spawn,
    releaseOnClose(release: () => void) { releases.push(release); },
    adoptRoot(root: string) {
      guardDirectoryRemoval(root, async () => {
        await join();
        if (!confirmed()) throw new Error('stage resource close unconfirmed; root retained');
      });
    },
    requireClose,
    patch(target: object, key: PropertyKey, value: unknown) {
      const previous = Reflect.get(target, key);
      restorations.push(() => { Reflect.set(target, key, previous); syncBuiltinESMExports(); });
      if (!Reflect.set(target, key, value)) throw new Error(`stage fixture seam refused: ${String(key)}`);
      syncBuiltinESMExports();
    },
    run: (body: (step: FixtureStep) => Promise<void>) => original.run(async step => {
      if (!options.native) guard = await step(() => wait('native guard setup', () => fakeNativeGuard(undo => { restoreGuard = undo; })));
      await body(step);
    }),
  };
}
