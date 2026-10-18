// Named failure deadlines retain operation ownership until asynchronous work settles.
import type { TestContext } from 'node:test';
import { realClock, type Clock } from '../src/hub/clock.ts';

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

export function caseDeadlines(t: TestContext, options: { clock?: Clock; timeoutMs?: number } = {}) {
  const clock = options.clock ?? realClock;
  const timeoutMs = options.timeoutMs ?? DEADLINE_MS;
  const pending = new Set<Promise<unknown>>();
  const hooks: Array<() => Promise<void>> = [];
  const wait = <T>(operation: string, run: () => Promise<T>): Promise<T> => {
    const work = own(Promise.resolve().then(run));
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return bounded(`${t.name}: ${operation}`, work, clock, timeoutMs);
  };
  // Install before even tempProject can yield. Late startup can safely add its
  // stop hooks while drainage holds this single owner ahead of directory cleanup.
  t.after(() => {
    const cleanup = own((async () => {
      while (pending.size) await Promise.allSettled([...pending]);
      const failures: unknown[] = [];
      for (const hook of hooks) {
        try { await hook(); } catch (error) { failures.push(error); }
      }
      if (failures.length) throw new AggregateError(failures, `${t.name}: fixture cleanup failed`);
    })());
    // If this deadline fails, cleanup remains owned and continues in order;
    // worker directory removal is gated by drainFixtureWork, not this race.
    return bounded(`${t.name}: fixture teardown`, cleanup, clock, timeoutMs);
  });
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
  return { wait, fixtures };
}
