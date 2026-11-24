import { retentionCase } from './suite-retention-fixture.ts';

/** Report regressions retain all seams until original work and native close join. */
export function reportCase(...args: Parameters<typeof retentionCase>) {
  const scope = retentionCase(...args);
  return { ...scope, run: (body: Parameters<typeof scope.run>[0]) =>
    scope.wait('whole report case', () => scope.run(step =>
      body(work => step(() => scope.wait('report operation', work))))) };
}
