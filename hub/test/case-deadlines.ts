// Named failure deadlines retain operation ownership until asynchronous work settles.
import type { TestContext } from 'node:test';
import { realClock, type Clock } from '../src/hub/clock.ts';
import { fixtureWork as admittedFixtureWork } from '../../test-support/fixture-work.ts';

const fixtureWork = new Set<Promise<unknown>>();
const DEADLINE_MS = 30_000;

function own<T>(work: Promise<T>): Promise<T> {
  fixtureWork.add(work);
  void work.then(() => fixtureWork.delete(work), () => fixtureWork.delete(work));
  return work;
}

async function bounded<T>(name: string, work: Promise<T>, clock: Clock, timeoutMs: number): Promise<T> {
  const expired = Promise.withResolvers<never>();
  const failure = new Error(`${name}: deadline exceeded after ${timeoutMs} ms`);
  const timer = clock.setTimeout(() => expired.reject(failure), timeoutMs);
  try { return await Promise.race([work, expired.promise]); }
  catch (cause) {
    if (cause === failure) throw cause;
    throw new Error(`${name}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
  finally { clock.clearTimeout(timer); }
}

/** Worker account/state directories cannot disappear beneath a timed-out case's writers.
 * A drain failure deliberately retains them for the runner's owned-process recovery. */
export async function drainFixtureWork(clock: Clock = realClock, timeoutMs = DEADLINE_MS): Promise<void> {
  await bounded('worker fixture drainage (directories retained on failure)', (async () => {
    while (fixtureWork.size) await Promise.allSettled([...fixtureWork]);
  })(), clock, timeoutMs);
}

export function caseDeadlines(t: TestContext, options: { clock?: Clock; timeoutMs?: number; joinTimeoutMs?: number;
  ownership?: {
    beforeDirectories: (context: TestContext, close: () => Promise<unknown>) => void;
    guardDirectoryRemoval: (root: string, join: () => Promise<unknown>) => void;
  };
  releaseOnClose?: () => void;
} = {}) {
  const clock = options.clock ?? realClock;
  const timeoutMs = options.timeoutMs ?? DEADLINE_MS;
  const pending = new Set<Promise<unknown>>();
  const sequence = admittedFixtureWork(options.joinTimeoutMs);
  const hooks: Array<() => Promise<void>> = [];
  const completedHooks = new Set<() => Promise<void>>();
  const wait = <T>(operation: string, run: () => Promise<T>, operationTimeoutMs = timeoutMs): Promise<T> => {
    const work = own(Promise.resolve().then(run));
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return bounded(`${t.name}: ${operation}`, work, clock, operationTimeoutMs);
  };
  let joined: Promise<void> | undefined, cleanup: Promise<void> | undefined;
  const join = () => {
    if (joined) return joined;
    // Fence before releasing held work through this same normal/signal owner.
    const closing = sequence.close();
    let releaseError: unknown;
    try { options.releaseOnClose?.(); } catch (error) { releaseError = error; }
    joined = own((async () => {
      await closing;
      while (pending.size) await Promise.allSettled([...pending]);
      if (releaseError) throw releaseError;
    })());
    return joined;
  };
  const close = () => {
    if (!cleanup) {
      const work = own((async () => {
        await join();
        const failures: unknown[] = [];
        for (const hook of hooks) {
          if (completedHooks.has(hook)) continue;
          try { await hook(); completedHooks.add(hook); } catch (error) { failures.push(error); }
        }
        if (failures.length) throw new AggregateError(failures, `${t.name}: fixture cleanup failed`);
      })());
      cleanup = work;
      // A failed observation retains in-flight cleanup. Only a settled rejection
      // permits retry, preserving completed hooks and the joined admission fence.
      void work.catch(() => { if (cleanup === work) cleanup = undefined; });
    }
    // If this deadline fails, cleanup remains owned and continues in order;
    // worker directory removal is gated by drainFixtureWork, not this race.
    return bounded(`${t.name}: fixture teardown`, cleanup, clock, timeoutMs);
  };
  // Injection keeps wait-only T1 users free of native cleanup imports. Whole
  // cases must enroll the shared normal/signal owner before any acquisition.
  if (options.ownership) options.ownership.beforeDirectories(t, close);
  else t.after(close);
  const fixtures = new Proxy(t, {
    get(target, key) {
      if (key === 'after') {
        const after: TestContext['after'] = (fn) => {
          hooks.push(() => new Promise<void>((resolve, reject) => {
            const done = (error?: unknown) => error ? reject(error) : resolve();
            const result = fn?.(target, done);
            if (!fn || fn.length < 2) void Promise.resolve(result).then(() => resolve(), reject);
          }));
        };
        return after;
      }
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { wait, fixtures,
    adoptRoot(root: string) {
      if (!options.ownership) throw new Error('whole-case root adoption requires shared cleanup ownership');
      options.ownership.guardDirectoryRemoval(root, join);
    },
    run<T>(operation: Parameters<typeof sequence.run<T>>[0]) {
      if (!options.ownership) throw new Error('whole-case admission requires shared cleanup ownership');
      return sequence.run(operation);
    },
  };
}
