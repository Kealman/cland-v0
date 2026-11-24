/** Optional whole-case owner: resource closure precedes all directory disposal. */
export type FixtureLifecycle = {
  requireClose(close: () => Promise<void>): void;
  adoptRoot(root: string, remove: () => Promise<void>): void;
};

/** Register before acquisition. Failed closure remains retryable; concurrent
 * observations share the same producer and successful closure is a receipt. */
export function fixtureResource(lifecycle: FixtureLifecycle | undefined, close: () => Promise<void>) {
  let pending: Promise<void> | undefined;
  let closed = false;
  const join = (): Promise<void> => {
    if (closed) return Promise.resolve();
    if (!pending) {
      const work = Promise.resolve().then(close).then(() => { closed = true; });
      pending = work;
      void work.catch(() => { if (pending === work) pending = undefined; });
    }
    return pending;
  };
  lifecycle?.requireClose(join);
  return join;
}
