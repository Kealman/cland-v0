import type { TestContext } from 'node:test';
import type { FixtureStep } from '../../test-support/fixture-work.ts';
import { stageCase } from './stage-case-fixture.ts';
import { fenceFixtureCleanup } from './process-cleanup.ts';

const owners = new WeakMap<TestContext, { scope: ReturnType<typeof stageCase>; step: FixtureStep }>();

export function lifecycleOwner(t: TestContext) {
  const owner = owners.get(t);
  if (!owner) throw new Error('lifecycle fixture requires an owned callback');
  return owner;
}

/** Own the complete callback and retryable resource cleanup before acquisition. */
export function ownedCase(body: (t: TestContext) => Promise<void>) {
  return async (t: TestContext) => {
    fenceFixtureCleanup(t);
    const scope = stageCase(t);
    // Case callbacks release controlled holds/CLI edges before original work
    // joins. Fixture cleanup uses scope.fixtures, after positive resource close.
    const context = new Proxy(t, { get(target, key) {
      if (key === 'after') return (release: () => void) => scope.releaseOnClose(release);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    await scope.run(async step => { owners.set(context, { scope, step }); await body(context); });
  };
}
