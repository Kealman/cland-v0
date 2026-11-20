import type { TestContext } from 'node:test';
import { caseDeadlines } from '../../hub/test/case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval, fenceFixtureCleanup } from '../../hub/test/process-cleanup.ts';

export type JourneyScope = {
  signal: AbortSignal;
  adoptRoot(root: string): void;
  setup<T>(name: string, work: () => Promise<T>): Promise<T>;
  step<T>(name: string, work: () => Promise<T>): Promise<T>;
};

/** Enroll the original callback before its first acquisition, including late results.
 * Shared normal/signal cleanup joins that callback, then closes every resource;
 * the fenced fixture context retains roots and seams on incomplete close. */
export function createJourneyOwner(t: TestContext) {
  let close!: () => Promise<unknown>;
  const owner = caseDeadlines(t, { timeoutMs: 60000, ownership: {
    beforeDirectories: (context, stop) => { close = stop; beforeDirectories(context, stop); }, guardDirectoryRemoval,
  } });
  fenceFixtureCleanup(owner.fixtures);
  const run = (driver: (t: TestContext, scope: JourneyScope) => Promise<void>) => owner.run(async (admit, signal) => {
    const scope: JourneyScope = {
      signal,
      adoptRoot: root => owner.adoptRoot(root),
      setup: (name, work) => owner.wait(`setup: ${name}`, () => admit(work)),
      step: (name, work) => owner.wait(`behaviour: ${name}`, () => admit(work)),
    };
    await driver(owner.fixtures, scope);
  });
  return { close: () => close(), fixtures: owner.fixtures, run };
}

export function ownedJourney(driver: (t: TestContext, scope: JourneyScope) => Promise<void>) {
  return (t: TestContext) => createJourneyOwner(t).run(driver);
}
