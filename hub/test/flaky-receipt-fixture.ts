import type { TestContext } from 'node:test';
import { syncBuiltinESMExports } from 'node:module';
import { afterCleanup, beforeDirectories, fenceFixtureCleanup, ownDirectory } from './process-cleanup.ts';
import { suiteCase } from './suite-case-fixture.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { tierReceipt } from '../src/verification-tier-receipts.ts';
import { verificationSteps } from '../src/verification-plan.ts';

export const filedWebIdentity = 'web/test/smoke.test.ts::known Web flake';

/** Emit native-shaped receipts at the fake executor boundary; no browser runs. */
export async function finishFiledWebRepeats(f: Awaited<ReturnType<typeof suiteUnit>>, step: Parameters<Parameters<typeof suiteCase>[1]>[0]['step'], id: string) {
  const original = (await step('read Web producer plan', () => f.jobs())).find(job => job.id === id)!;
  const progress = (file: string, outcome: 'pass' | 'fail') => ['test', 'file'].map(type => 'suite progress ' + JSON.stringify({ event: 'finish', id: `${file}-${type}`, file, name: type === 'file' ? file : 'known Web flake', type, at: 1, nesting: 0, outcome, seconds: 0.01 })).join('\n') + '\n';
  const failures = 'suite test failures [{"file":"web/test/smoke.test.ts","name":"known Web flake"}]\n';
  f.machine.script(...Array.from({ length: 5 }, () => ({ outcome: 'slow' as const, log: '' })));
  if (original.executor === 'droplet') await step('observe original Web admission', () => f.machine.waits.run(f.machine.started(id)));
  await step('record filed Web failure', () => f.finish(id, 1, 'tier T0: exit 0; duration 1 s; output tail: check\ntier T1: exit 0; duration 1 s; output tail: unit\ntier Web: exit 1; duration 1 s; output tail: Web\n' + failures + progress('hub/test/example.test.ts', 'pass') + progress('web/test/smoke.test.ts', 'fail'), false,
    verificationSteps(original.commands!).map(row => tierReceipt(original, row, row.name === 'Web' ? 1 : 0))));
  for (let round = 0; round < 5; round++) {
    await step('advance Web repeat scheduler', () => f.tick(5000));
    await step('join Web repeat scheduler', () => f.suites.settled());
    const child = (await step('read Web repeat owner', () => f.jobs())).find(job => job.batch?.diagnostic?.key === `flaky-${id}-${round}`);
    if (!child) throw new Error(`Web round ${round + 1} not admitted`);
    if (child.executor === 'droplet') await step('observe Web repeat admission', () => f.machine.waits.run(f.machine.started(child.id)));
    await step('record same-tree Web pass', () => f.finish(child.id, 0, progress('web/test/smoke.test.ts', 'pass') + 'suite test failures []\n', true,
      verificationSteps(child.commands!).map(row => tierReceipt(child, row, 0))));
  }
  await step('settle Web refusal', () => f.tick(5000));
  await step('join Web refusal', () => f.suites.settled());
}

/** T-1891's resources must positively close before roots, patches or guard release. */
export function flakyReceiptCase(t: TestContext, body: Parameters<typeof suiteCase>[1]) {
  fenceFixtureCleanup(t);
  const restorations: Array<() => void> = [];
  afterCleanup(t, () => { for (const restore of restorations.toReversed()) restore(); });
  return suiteCase(t, scope => {
    const fixtures = new Proxy(scope.fixtures, { get(target, key) {
      // Register after suiteCase's original-work join, outside its ancillary hooks.
      if (key === 'after') return (close: () => unknown) => beforeDirectories(t, close);
      if (key === 'mock') return { method(object: object, name: PropertyKey, replacement: unknown) {
        const previous = Object.getOwnPropertyDescriptor(object, name);
        restorations.push(() => {
          if (previous) Object.defineProperty(object, name, previous);
          else Reflect.deleteProperty(object, name);
          syncBuiltinESMExports();
        });
        Object.defineProperty(object, name, { configurable: true, writable: true, value: replacement });
        syncBuiltinESMExports();
        return replacement;
      } };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    return body({ ...scope, fixtures, setup: work => scope.setup(() => work(fixtures)) });
  });
}

export function ownedSuiteUnit(t: TestContext, fixtures: TestContext, options: Parameters<typeof suiteUnit>[1] = {}, source = '', accounting = false) {
  return suiteUnit(fixtures, { ...options, deferRootRemoval: true, onRoot: root => {
    ownDirectory(t, root);
    options.onRoot?.(root);
  } }, source, accounting);
}
