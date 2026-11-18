import type { TestContext } from 'node:test';
import { caseDeadlines } from './case-deadlines.ts';
import { afterCleanup, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { tempProject } from './harness.ts';
import type { FixtureStep } from '../../test-support/fixture-work.ts';
import { syncBuiltinESMExports } from 'node:module';
import { existsSync } from 'node:fs';

/** Own the original callback before acquisition; keep seams on incomplete cleanup. */
export function renameCase(t: TestContext, body: (fixture: {
  step: FixtureStep; root: () => Promise<string>;
  mocks: { method: <T extends object>(target: T, key: keyof T, implementation: unknown) => void };
  dispose: (close: () => Promise<void>) => void;
}) => Promise<void>, guarded = true): Promise<void> {
  const scope = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  const seams: Array<() => void> = [];
  const mocks = { method<T extends object>(target: T, key: keyof T, implementation: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) throw new Error('fixture seam requires an own method');
    Object.defineProperty(target, key, { ...descriptor, value: implementation });
    seams.push(() => Object.defineProperty(target, key, descriptor));
  } };
  const disposals: Array<() => Promise<void>> = [];
  const roots = new Set<string>();
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restoreGuard: (() => void) | undefined;
  let resourceClosure: Promise<void> | undefined;
  const closeResources = () => resourceClosure ??= scope.wait('resource cleanup', async () => {
    // Do not restore globals or remove roots after an incomplete owner join.
    for (const close of [...disposals].reverse()) await close();
    guard?.verify();
  });
  scope.fixtures.after(closeResources);
  afterCleanup(t, async () => {
    await closeResources();
    for (const root of roots) if (existsSync(root)) throw new Error('rename fixture root retained; native guard and seams retained');
    guard?.verify();
    for (const restore of seams.reverse()) restore();
    syncBuiltinESMExports();
    restoreGuard?.();
  });
  return scope.run(async step => {
    if (guarded) await scope.wait('native guard setup', () => step(async () => {
      guard = await fakeNativeGuard(restore => { restoreGuard = restore; });
    }));
    return body({
      step: operation => scope.wait('rename boundary', () => step(operation)),
      root: () => scope.wait('root setup', () => step(async () => {
        const root = await tempProject(scope.fixtures);
        roots.add(root);
        scope.adoptRoot(root);
        guardDirectoryRemoval(root, closeResources);
        return root;
      })),
      mocks,
      dispose: close => { disposals.push(close); },
    });
  });
}
