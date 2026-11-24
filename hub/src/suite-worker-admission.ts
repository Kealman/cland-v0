import type { Clock } from '../../shared/clock.ts';
import { suiteCommandOutcome } from './suite-infrastructure.ts';
import type { Platform } from './executor/executor.ts';

// Admission policy is independent of filesystem access and native process signals.
export async function waitForWorkerAdmission(options: {
  gate: () => Promise<boolean>;
  signal: () => string | null;
  clock: Clock;
}): Promise<{ admitted: boolean; cause: string }> {
  const deadline = options.clock.now().getTime() + 15000;
  for (;;) {
    const ready = await options.gate();
    const signal = options.signal();
    if (signal) return { admitted: false, cause: `worker interrupted by ${signal}` };
    if (ready) return { admitted: true, cause: '' };
    if (options.clock.now().getTime() >= deadline) return { admitted: false, cause: 'worker admission gate wait expired after 15000 ms' };
    await new Promise<void>(resolve => options.clock.setTimeout(resolve, 25));
  }
}

type WorkerOutcome = { code: number; cause: string; platform?: Platform; tierReceipts?: import('./verification-tier-receipts.ts').TierReceipt[]; timingReceipts?: import('./suite-timing-receipts.ts').TimingReceipt[] };
export type WorkerCompletion = WorkerOutcome & { finished: string; notRun?: 'infrastructure' };

/** The executable worker delegates admission and its terminal receipt to this owner. */
export async function runWorkerWithAdmission(options: {
  gate: () => Promise<boolean>;
  signal: () => string | null;
  clock: Clock;
  run: () => Promise<WorkerOutcome>;
  log: (line: string) => void;
  diagnostic?: (line: string) => void;
  persist: (receipt: WorkerCompletion) => Promise<void>;
}): Promise<void> {
  const admission = await waitForWorkerAdmission(options);
  let outcome: WorkerOutcome = { code: 1, cause: admission.cause };
  if (admission.admitted) {
    try { outcome = await options.run(); }
    catch (error) { outcome = { code: 1, cause: error instanceof Error ? error.message : String(error) }; }
  }
  const signal = options.signal();
  if (signal) outcome = { ...outcome, code: signal === 'SIGINT' ? 130 : 143, cause: `worker interrupted by ${signal}` };
  try { options.log(`\nFinished: exit ${outcome.code}${outcome.cause ? `; ${outcome.cause}` : ''}\n`); }
  catch (error) {
    try { options.diagnostic?.(`secondary diagnostic: worker terminal logging failed: ${String(error)}`); }
    catch { /* Diagnostic sinks cannot replace the worker outcome or skip persistence. */ }
  }
  // Local readers treat publication as done; keep it after all diagnostic callbacks.
  await options.persist({ ...outcome, ...suiteCommandOutcome(outcome.code, outcome.cause), finished: options.clock.now().toISOString() });
}

export function compatibilityCleanupCause(cause: string, error: unknown): string {
  const cleanup = `compatibility cleanup failed: ${String(error)}`;
  return cause ? `${cause}; ${cleanup}` : cleanup;
}
