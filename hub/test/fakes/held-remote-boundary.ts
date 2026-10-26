import type { TestContext } from 'node:test';
import { abortable, within } from '../../src/executor/droplet/deadline.ts';
import { onCleanup } from '../process-cleanup.ts';
import { FakeClock } from '../fake-clock.ts';

/** Own a held fake producer before launch, including a lost setup receipt. */
export function heldRemoteBoundary(t: TestContext, receipt = true) {
  const clock = new FakeClock();
  const entered = Promise.withResolvers<void>();
  const actual = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const setupAbort = new AbortController();
  const pending = new Set<Promise<unknown>>();
  const cleanup: Array<() => void | Promise<void>> = [];
  let disposing: Promise<void> | undefined;
  const own = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  };
  const dispose = () => disposing ??= (async () => {
    setupAbort.abort(new Error('remote fixture setup cancelled'));
    entered.resolve(); actual.resolve(); release.resolve();
    while (pending.size) await Promise.allSettled([...pending]);
    const failures: unknown[] = [];
    for (const close of cleanup) {
      try { await close(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, 'remote fixture disposal failed');
  })();
  // This resource owner runs before hub and directory disposal, even if the
  // test never resumes from a missing setup receipt or is cancelled externally.
  onCleanup(t, dispose);
  const setup = (work: Promise<void>) => own(within(abortable(work,
    AbortSignal.any([t.signal, setupAbort.signal])), 1000, clock,
  () => new Error('remote fixture setup receipt deadline reached')));
  return {
    clock, setupAbort, own, dispose,
    close: (fn: () => void | Promise<void>) => { cleanup.push(fn); },
    setup: () => setup(entered.promise), actual: () => setup(actual.promise),
    resume: () => release.resolve(),
    hold: () => own((async () => { actual.resolve(); if (receipt) entered.resolve(); await release.promise; })()),
  };
}
