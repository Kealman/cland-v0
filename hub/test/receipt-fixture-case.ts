import type { TestContext } from 'node:test';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval, fenceFixtureCleanup } from './process-cleanup.ts';
import { fixtureNativeGuard } from './fake-native-guard.ts';
import { testWaitMs } from './until.ts';
import type { Clock } from '../src/hub/clock.ts';

export type ReceiptStep = <T>(name: string, operation: () => Promise<T>, timeoutMs?: number) => Promise<T>;

/** Own the original acceptance caller before setup, including signal teardown.
 * Hooks from fixture helpers run only after the original work joins.
 * Fake cases default to fenced cleanup: a rejected close retains the positively
 * controlled native launch guard until cleanup is repaired and retried.
 * Optional completion headroom extends owner teardown, while ordinary steps
 * retain the setup default. A step must opt into its own completion bound.
 */
export function receiptFixtureCase(t: TestContext, native: boolean, body: (fixtures: TestContext, step: ReceiptStep, adoptRoot: (root: string) => void, release: (action: () => void) => void) => Promise<void>, options: { completionMs?: number; clock?: Clock } = {}) {
  if (!native) fenceFixtureCleanup(t);
  const releases: Array<() => void> = [];
  const setupMs = testWaitMs(native ? 60000 : 5000);
  const scope = caseDeadlines(t, {
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.completionMs === undefined ? {} : { joinTimeoutMs: options.completionMs }),
    timeoutMs: Math.max(setupMs, options.completionMs ?? setupMs),
    ownership: { beforeDirectories, guardDirectoryRemoval },
    releaseOnClose: () => { for (const release of releases) release(); },
  });
  return scope.run(async (admit, signal) => {
    const combined = AbortSignal.any([signal, t.signal]);
    const step: ReceiptStep = (name, operation, timeoutMs = setupMs) => scope.wait(name, () => admit(async () => {
      combined.throwIfAborted();
      return operation();
    }), timeoutMs);
    if (!native) await step('positive native guard setup', () => fixtureNativeGuard(scope.fixtures));
    return body(scope.fixtures, step, root => scope.adoptRoot(root), action => { releases.push(action); });
  });
}
