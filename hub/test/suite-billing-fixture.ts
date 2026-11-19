import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { afterCleanup } from './process-cleanup.ts';
import { guardedLeaseCase } from './executor-lease-fixture.ts';

/** Only the billing proof opts in; rejected cleanup never grants restoration. */
export function billingCase(t: TestContext, options: { onIncomplete?: (repair: { finishCleanup: () => Promise<void>; releaseSeams: () => void }) => Promise<void> } = {}) {
  const closers: Array<{ run: () => Promise<void>; closed: boolean }> = [];
  const roots = new Set<string>();
  let joined = false, rootsRemoved = false, repairJoined = true;
  const scope = guardedLeaseCase(t, undefined, { deferRestore: true,
    canRestore: () => joined && repairJoined && rootsRemoved && closers.every(close => close.closed) });
  // This hook runs only after caseDeadlines joins the original admitted body.
  scope.fixtures.after(() => { joined = true; });
  const fixtures = new Proxy(scope.fixtures, {
    get(target, key) {
      if (key === 'after') return (fn: Parameters<TestContext['after']>[0]) => {
        const close = { closed: false, run: () => new Promise<void>((resolve, reject) => {
          const result = fn?.(target, error => error ? reject(error) : resolve());
          if (!fn || fn.length < 2) void Promise.resolve(result).then(() => resolve(), reject);
        }) };
        closers.push(close);
        scope.fixtures.after(async () => {
          try { await close.run(); close.closed = true; }
          catch (error) { if (!options.onIncomplete) throw error; }
        });
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const confirmRoots = async () => {
    assert.ok(joined && closers.every(close => close.closed), 'resource closure unconfirmed; native guard retained');
    for (const root of roots) await assert.rejects(stat(root), { code: 'ENOENT' });
    rootsRemoved = true;
  };
  afterCleanup(t, async () => {
    if (closers.some(close => !close.closed) && options.onIncomplete) {
      repairJoined = false;
      await options.onIncomplete({ releaseSeams: scope.releaseSeams, finishCleanup: async () => {
        assert.ok(joined, 'original callback must join before repair');
        for (const close of closers) if (!close.closed) { await close.run(); close.closed = true; }
        await confirmRoots();
      } });
      repairJoined = true;
    }
    await confirmRoots();
    scope.releaseSeams();
  });
  return { ...scope, fixtures, adoptRoot(root: string) { roots.add(root); scope.adoptRoot(root); } };
}
