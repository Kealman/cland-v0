import type { TestContext } from 'node:test';
import { caseDeadlines, drainFixtureWork } from './case-deadlines.ts';
import { afterCleanup, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';

type Step = <T>(name: string, work: () => Promise<T>) => Promise<T>;
/** Own caller continuations before setup, through normal/signal fixture cleanup. */
export function suiteCase(t: TestContext, body: (scope: {
  fixtures: TestContext;
  step: Step;
  setup: <T extends { root: string }>(work: (fixtures: TestContext) => Promise<T>) => Promise<T>;
  guardControl: () => void;
  releaseOnClose: (release: () => void) => void;
}) => Promise<void>, options: { native?: boolean } = {}) {
  const releases: Array<() => void> = [];
  const owner = caseDeadlines(t, {
    ownership: { beforeDirectories, guardDirectoryRemoval },
    releaseOnClose: () => { for (const release of releases) release(); },
  });
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restore: (() => void) | undefined;
  afterCleanup(t, async () => {
    // An incomplete caller join retains patches as well as the fixture root.
    await drainFixtureWork();
    try { guard?.verify(); } finally { restore?.(); }
  });
  return owner.wait('whole suite case', () => owner.run(async (admit, signal) => {
    const step: Step = (name, work) => owner.wait(name, () => admit(async () => {
      signal.throwIfAborted();
      const value = await work();
      signal.throwIfAborted();
      return value;
    }));
    if (!options.native) await step('positive native launch guard setup', async () => {
      guard = await fakeNativeGuard(value => { restore = value; });
    });
    await body({ fixtures: owner.fixtures, step, guardControl: () => {
      if (!guard) throw new Error('native guard control unavailable');
      guard.control();
    },
      setup: work => step('fixture setup', async () => {
        const fixture = await work(owner.fixtures);
        // Capture late acquisition before the post-await cancellation fence.
        owner.adoptRoot(fixture.root);
        return fixture;
      }),
      releaseOnClose: release => { releases.push(release); },
    });
  }));
}
