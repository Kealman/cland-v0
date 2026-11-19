import { after, type TestContext } from 'node:test';
import { tempProject } from './harness.ts';
import { stageCase } from './stage-case-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import type { FixtureStep } from '../../test-support/fixture-work.ts';
import { ensureAccountFixture } from './account-fixture-env.ts';

type Owner = ReturnType<typeof stageCase>;
type Setup = { owner: Owner; root: string; step: FixtureStep };

function fileContext(): TestContext {
  const hooks: Array<() => unknown> = [];
  after(async () => { for (const hook of hooks) await hook(); });
  return { name: 'tracker file fixture', after: (hook: () => unknown) => hooks.push(hook) } as unknown as TestContext;
}

/** One admitted sequence owns acquisition, warmup and its single consumer. */
export async function trackerFileCase<T>(setup: (context: Setup) => Promise<T>, context = fileContext()) {
  const owner = stageCase(context);
  const admitted = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<T>();
  const requested = Promise.withResolvers<(() => Promise<void>) | undefined>();
  const completed = Promise.withResolvers<void>();
  let consumed = false;
  owner.releaseOnClose(() => requested.resolve(undefined));
  const original = owner.run(async step => {
    // The shared admission boundary has its own load-scaled timeout and outcome.
    // Start the item-local setup bound only after its positive receipt.
    await step(() => ensureAccountFixture());
    admitted.resolve();
    const root = await step(async () => {
      const root = await tempProject(owner.fixtures);
      owner.adoptRoot(root);
      return root;
    });
    const value = await step(() => setup({owner, root, step}));
    await step(async () => ready.resolve(value));
    const body = await requested.promise;
    if (body) await step(body);
  });
  void original.then(() => completed.resolve(), error => {
    admitted.reject(error);
    ready.reject(error);
    completed.reject(error);
  });
  void ready.promise.catch(() => {});
  void admitted.promise.catch(() => {});
  void completed.promise.catch(() => {});
  let value: T;
  try {
    await admitted.promise;
    value = await within(ready.promise, 15_000, undefined,
      () => new Error('tracker file setup incomplete; original work and root retained'));
  } catch (error) {
    try { await owner.close(); await owner.restore(); }
    catch (cleanup) {
      if (error instanceof Error) {
        // Keep a native admission/setup outcome selected even if disposal also fails.
        error.cause = new AggregateError([...(error.cause === undefined ? [] : [error.cause]), cleanup],
          'tracker file cleanup incomplete; root and controls retained');
      } else throw new AggregateError([error, cleanup], 'tracker file setup failed; cleanup incomplete');
    }
    throw error;
  }
  return { value, owner,
    run(t: TestContext, body: (context: TestContext) => Promise<void>) {
      if (consumed) throw new Error('tracker file fixture has one consumer');
      consumed = true;
      // Cancellation joins the original callback. Its after-hooks stay with the
      // file owner, so socket/trace controls cannot restore under a late finally.
      t.after(() => owner.close());
      const owned = new Proxy(t, { get(target, key) {
        if (key === 'after') return owner.fixtures.after.bind(owner.fixtures);
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
      requested.resolve(() => body(owned));
      return owner.wait('churn callback completion', () => completed.promise);
    },
  };
}
