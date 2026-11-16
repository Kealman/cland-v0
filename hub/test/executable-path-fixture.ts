import type { TestContext } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeDirectories, guardDirectoryRemoval, ownDirectory } from './process-cleanup.ts';
import { fixtureWork, type FixtureStep } from '../../test-support/fixture-work.ts';

/** Own setup before root acquisition, including continuations after interrupted awaits. */
export function pathFixture(t: TestContext, prefix: string) {
  const work = fixtureWork();
  let remove: (() => Promise<void>) | undefined;
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    await work.close();
    await remove?.(); // Failed joins retain the root.
  })();
  beforeDirectories(t, close);
  return {
    close,
    run: (sequence: (root: string, step: FixtureStep) => Promise<void>) => work.run(async step => {
      const root = await step(() => mkdtemp(join(tmpdir(), prefix)));
      remove = ownDirectory(undefined, root); // Capture late acquisition before another step.
      guardDirectoryRemoval(root, work.close);
      await sequence(root, step);
    }),
  };
}
