import { withCleanupFailure } from '../../cleanup-failure.ts';

export type ReadinessPhase = 'boot-readiness' | 'delivery-lease-expiry' | 'delivery-budget-expiry' | 'delivery-directory-readiness';
type CleanupStep = 'release' | 'recovery-checkpoint' | 'recovery' | 'lease-checkpoint' | 'reservation-unlock';

/** Producer-owned receipt; the message's phase is for people, never parsing. */
export class ReadinessDeadlineError extends Error {
  readonly cleanupFailures: Array<{ step: CleanupStep; error: unknown }> = [];
  readonly phase: ReadinessPhase;
  readonly deadlineMs: number;
  readonly observedMs: number;
  constructor(phase: ReadinessPhase, deadlineMs: number, observedMs: number) {
    super(`machine readiness deadline reached (${phase})`);
    this.name = 'ReadinessDeadlineError';
    this.phase = phase;
    this.deadlineMs = deadlineMs;
    this.observedMs = observedMs;
  }
}

/** Retain the existing typed readiness receipt for older callers. */
export function recordReadinessCleanupFailure(primary: unknown, step: CleanupStep, error: unknown): boolean {
  if (!(primary instanceof ReadinessDeadlineError)) return false;
  primary.cleanupFailures.push({ step, error });
  primary.message += `; cleanup ${step} failed`;
  return true;
}
/** Keep primary identity and wrapper causes, including non-readiness failures. */
export function withDropletCleanupFailure(primary: unknown, step: CleanupStep, error: unknown): unknown {
  recordReadinessCleanupFailure(primary, step, error);
  return withCleanupFailure(primary, error);
}
