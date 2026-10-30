/** Probe wrappers must not retain arguments/results as node:test mocks do. */
import type { TestContext } from 'node:test';
import { syncBuiltinESMExports } from 'node:module';

export function memoryInstrumentation(t: TestContext) {
  const restore: Array<() => void> = [];
  t.after(() => {
    for (const undo of restore.reverse()) undo();
    syncBuiltinESMExports();
  });
  return (target: object, method: PropertyKey, replacement: unknown): void => {
    const original = Reflect.get(target, method);
    Reflect.set(target, method, replacement);
    restore.push(() => { Reflect.set(target, method, original); });
  };
}
