import type { TestContext } from 'node:test';
import { syncBuiltinESMExports } from 'node:module';
import { caseDeadlines, drainFixtureWork } from './case-deadlines.ts';
import { afterCleanup, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import type { FixtureStep } from '../../test-support/fixture-work.ts';

/** Enroll the whole callback before acquisition; restore seams only after its join. */
export function guardedLeaseCase(t: TestContext, releaseOnClose?: () => void, options: {timeoutMs?: number; canRestore?: () => boolean; deferRestore?: boolean; allowCli?: boolean} = {}) {
  const scope = caseDeadlines(t, { timeoutMs: options.timeoutMs ?? 5000, ownership: { beforeDirectories, guardDirectoryRemoval }, ...(releaseOnClose ? { releaseOnClose } : {}) });
  const restorations: Array<() => void> = [];
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restoreGuard: (() => void) | undefined;
  let restored = false;
  const releaseSeams = () => {
    if (restored) return;
    if (options.canRestore && !options.canRestore()) throw new Error('resource closure unconfirmed; fixture seams and native guard retained');
    for (const restore of restorations.reverse()) restore();
    try { guard?.verify(); } finally { restoreGuard?.(); restored = true; }
  };
  afterCleanup(t, async () => {
    await drainFixtureWork();
    if (!options.deferRestore) releaseSeams();
  });
  return { ...scope, releaseSeams, own: scope.run,
    patch(target: object, key: PropertyKey, replacement: unknown) {
      const original = Reflect.get(target, key);
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true; Reflect.set(target, key, original); syncBuiltinESMExports();
      };
      restorations.push(restore); // Register before mutation; no TestContext mock lifetime.
      if (!Reflect.set(target, key, replacement)) throw new Error(`fixture seam refused: ${String(key)}`);
      syncBuiltinESMExports();
      return restore;
    },
    run: (body: (step: FixtureStep) => Promise<void>) => scope.run(async step => {
      guard = await step(() => scope.wait('native guard setup', () => fakeNativeGuard(fn => { restoreGuard = fn; }, { allowCli: options.allowCli ?? false })));
      await body(step);
    }),
  };
}
