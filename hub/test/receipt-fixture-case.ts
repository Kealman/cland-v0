import type { TestContext } from 'node:test';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { fixtureNativeGuard } from './fake-native-guard.ts';
import { testWaitMs } from './until.ts';

export type ReceiptStep = <T>(name: string, operation: () => Promise<T>) => Promise<T>;

/** Own the original acceptance caller before setup, including signal teardown.
 * Hooks from fixture helpers run only after the fenced original work joins.
 * Fake cases keep the positively controlled launch guard through those hooks.
 */
export function receiptFixtureCase(t: TestContext, native: boolean, body: (fixtures: TestContext, step: ReceiptStep, adoptRoot: (root: string) => void, release: (action: () => void) => void) => Promise<void>) {
  const releases: Array<() => void> = [];
  const scope = caseDeadlines(t, { timeoutMs: testWaitMs(native ? 60000 : 5000), ownership: { beforeDirectories, guardDirectoryRemoval }, releaseOnClose: () => { for (const release of releases) release(); } });
  return scope.run(async (admit, signal) => {
    const combined = AbortSignal.any([signal, t.signal]);
    const step: ReceiptStep = (name, operation) => scope.wait(name, () => admit(async () => {
      combined.throwIfAborted();
      return operation();
    }));
    if (!native) await step('positive native guard setup', () => fixtureNativeGuard(scope.fixtures));
    return body(scope.fixtures, step, root => scope.adoptRoot(root), action => { releases.push(action); });
  });
}
