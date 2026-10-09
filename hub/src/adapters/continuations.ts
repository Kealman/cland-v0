import type { Resumed } from '../hub/worktrees.ts';

export const untimed: Resumed = work => work();

/** A typed await inside a lifecycle continuation. */
export function* wait<T>(promise: Promise<T>): Generator<Promise<unknown>, T, unknown> {
  return (yield promise) as T;
}

/** Time each uninterrupted lifecycle stretch, including catch/finally and the next I/O's initiation.
 * A generator keeps adjacent work in one scope; the scope ends at each wait, never spanning I/O. */
export function continueWith<T>(work: Generator<Promise<unknown>, T, unknown>, resumed: Resumed = untimed): Promise<T> {
  const step = (kind: 'next' | 'throw', value?: unknown): Promise<T> => {
    try {
      return resumed(() => {
        const next = work[kind](value);
        return next.done ? Promise.resolve(next.value) : next.value.then(value => step('next', value), error => step('throw', error));
      });
    } catch (error) { return Promise.reject(error); }
  };
  return step('next');
}
