import { AsyncLocalStorage } from 'node:async_hooks';
import { test, type TestContext, type TestOptions } from 'node:test';
import { fixtureWork } from '../../test-support/fixture-work.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import type { Clock } from '../src/hub/clock.ts';
import { fenceFixtureCleanup, onCleanup } from './process-cleanup.ts';
import { testDeadlineMs } from './until.ts';

const owners = new AsyncLocalStorage<ReturnType<typeof mergeOwner>>();
type Body = (t: TestContext) => void | Promise<void>;

/** Install before acquisition; fenced cleanup joins originals before stopping writers. */
export function mergeOwner(t: TestContext) {
  const work = fixtureWork();
  const cleanup = fenceFixtureCleanup(t);
  onCleanup(t, () => work.close());
  const abort = () => { void work.close().catch(() => {}); };
  t.signal.addEventListener('abort', abort, { once: true });
  cleanup.release(() => t.signal.removeEventListener('abort', abort));
  if (t.signal.aborted) abort();
  const owner = {
    release: cleanup.release,
    step<T>(name: string, start: () => Promise<T>, options: { clock?: Clock; timeoutMs?: number } = {}) {
      // Keep the producer enrolled even when its observation deadline rejects.
      const original = work.run(() => start());
      return within(original, testDeadlineMs(30_000, options.clock, options.timeoutMs), options.clock,
        () => new Error(`${name} incomplete; merge fixture retained`));
    },
    run(body: () => Promise<void>): Promise<void> {
      const original: Promise<void> = work.run(() => owners.run(owner, body));
      return within(original, testDeadlineMs(120_000), undefined,
        () => new Error('whole merge callback incomplete; fixture retained'));
    },
  };
  return owner;
}

export function mergeStep<T>(name: string, start: () => Promise<T>) {
  const owner = owners.getStore();
  if (!owner) throw new Error(`${name}: missing pre-acquisition merge owner`);
  return owner.step(name, start);
}

/** Node resets the actual tracker even if after hooks reject. Keep that exact
 * restoration boundary held, including its timer reset, until writers close. */
function fencedMocks(owner: ReturnType<typeof mergeOwner>, tracker: TestContext['mock']) {
  const reset = tracker.reset;
  const restores: Array<() => void> = [];
  let released = false;
  owner.release(() => {
    released = true;
    try { Reflect.apply(reset, tracker, []); }
    catch (error) { released = false; throw error; }
    for (const restore of restores.reverse()) restore();
  });
  for (const [target, key] of [[tracker, 'reset'], [tracker, 'restoreAll'], [tracker.timers, 'reset']] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    const original = Reflect.get(target, key);
    restores.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    });
    Object.defineProperty(target, key, { configurable: true, writable: true, value: () => {
      if (released) Reflect.apply(original, target, []);
    } });
  }
  return tracker;
}

export function mergeContext(t: TestContext) {
  let protectedMock: TestContext['mock'] | undefined;
  // A subtest tears down before its parent; give it its own encompassing owner.
  const owned = new Proxy(t, { get(target, key) {
    if (key === 'test') return (...args: unknown[]) => Reflect.apply(target.test, target, wrap(args));
    if (key === 'mock') return protectedMock ??= fencedMocks(owner, target.mock);
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const owner = mergeOwner(owned);
  return { context: owned, owner };
}
function callback(body: Body): Body {
  return t => {
    const { context, owner } = mergeContext(t);
    return owner.run(async () => { await body(context); });
  };
}
function wrap(args: unknown[]): unknown[] {
  const last = args.length - 1;
  if (typeof args[last] !== 'function') throw new Error('merge case requires a callback');
  return [...args.slice(0, last), callback(args[last] as Body)];
}

export function mergeTest(name: string, body: Body): ReturnType<typeof test>;
export function mergeTest(name: string, options: TestOptions, body: Body): ReturnType<typeof test>;
export function mergeTest(name: string, options: TestOptions | Body, body?: Body) {
  return typeof options === 'function' ? test(name, callback(options)) : test(name, options, callback(body!));
}
