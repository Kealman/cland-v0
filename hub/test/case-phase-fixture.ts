import { AsyncLocalStorage } from 'node:async_hooks';
import type test from 'node:test';
import { casePhases, type CasePhase } from './case-phase-recorder.ts';

const active = new AsyncLocalStorage<ReturnType<typeof casePhases>>();
type Body = (t: test.TestContext) => void | Promise<void>;
type CaseTest = {
  (name: string, body: Body): Promise<void>;
  (name: string, options: test.TestOptions, body: Body): Promise<void>;
};

/** No caller names, paths, output or per-operation history are retained. */
export function phase<T>(name: CasePhase, work: () => Promise<T>): Promise<T> {
  return active.getStore()?.measure(name, work) ?? work();
}
export function phaseSync<T>(name: CasePhase, work: () => T): T {
  const recorder = active.getStore();
  return recorder ? recorder.measureSync(name, work) : work();
}

/** Preserve the existing case owner. Phases are inclusive and may overlap;
 * the body envelope is not a sum of these aggregates. */
export function phaseTests(base: CaseTest, file: string): CaseTest {
  return ((...args: unknown[]) => {
    const callback = args.at(-1) as (t: test.TestContext) => unknown;
    return Reflect.apply(base, undefined, [...args.slice(0, -1), async (t: test.TestContext) => {
      const phases = casePhases(() => performance.now());
      const started = performance.now();
      let outcome = 'incomplete';
      await active.run(phases, async () => {
        try { await callback(t); outcome = 'completed'; }
        catch (error) { outcome = 'failed'; throw error; }
        finally {
          const bodyFinished = performance.now();
          // Registered after fixture hooks, so the second envelope includes their
          // joins. A hook failure still belongs to node:test, never this report.
          t.after(() => t.diagnostic(`case phases ${JSON.stringify({ version: 1, file, name: t.name,
            outcome, bodyMilliseconds: bodyFinished - started,
            afterBodyObservationMilliseconds: performance.now() - bodyFinished,
            importCompileMilliseconds: null, phases: phases.snapshot() })}`));
        }
      });
    }]);
  }) as CaseTest;
}
