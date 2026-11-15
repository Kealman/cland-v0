/** A fixture owns whole sequences, including continuations between native/FS
 * awaits. A closing scope admits no new step and never releases a pending join. */
export type FixtureStep = <T>(operation: () => Promise<T>) => Promise<T>;
export function fixtureWork(timeoutMs = 35_000) {
  const abort = new AbortController();
  const pending = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;
  const check = () => abort.signal.throwIfAborted();
  const step = <T>(operation: () => Promise<T>): Promise<T> => {
    check();
    // The caller must capture acquired owners before its next step. Checking
    // cancellation after this await could discard a successfully acquired owner.
    return operation();
  };
  const run = <T>(operation: (step: FixtureStep, signal: AbortSignal) => Promise<T>): Promise<T> => {
    check();
    const work = Promise.resolve().then(async () => {
      check();
      const value = await operation(step, abort.signal);
      check();
      return value;
    });
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  };
  const close = (): Promise<void> => {
    if (closing) return closing;
    abort.abort(new Error('fixture work admission closed'));
    const joined = Promise.allSettled([...pending]).then(() => {});
    closing = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([joined, new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`fixture work join incomplete after ${timeoutMs} ms; retain root (${pending.size} admitted sequences)`)), timeoutMs);
        })]);
      } finally { clearTimeout(timer); }
    })();
    return closing;
  };
  return {run, close};
}
