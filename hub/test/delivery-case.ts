import type { TestContext } from 'node:test';
import type { FixtureStep } from '../../test-support/fixture-work.ts';
import { stageCase } from './stage-case-fixture.ts';
import { testDeadlineMs } from './until.ts';

/** Positive writer close gates root removal and restoration, including partial setup. */
export function deliveryCase(t: TestContext) {
  const scope = stageCase(t);
  return { ...scope,
    run<T>(setup: (step: FixtureStep) => Promise<T>, body: (value: T, step: FixtureStep) => Promise<void>) {
      return scope.wait('whole delivery case', () => scope.run(async admit => {
        const step: FixtureStep = start => admit(() => scope.wait('delivery operation', start, testDeadlineMs(30_000)));
        const value = await step(() => scope.wait('full delivery setup', () => setup(step), testDeadlineMs(30_000)));
        await step(() => scope.wait('full delivery body', () => body(value, step), testDeadlineMs(30_000)));
      }), testDeadlineMs(90_000));
    },
  };
}
