export type ReadinessPhase = 'boot-readiness' | 'delivery-lease-expiry' | 'delivery-budget-expiry' | 'delivery-directory-readiness';
type CleanupStep = 'release' | 'recovery-checkpoint' | 'recovery';

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

/** Keep the producing outcome when later cleanup fails; other errors keep their existing policy. */
export function recordReadinessCleanupFailure(primary: unknown, step: CleanupStep, error: unknown): boolean {
  if (!(primary instanceof ReadinessDeadlineError)) return false;
  primary.cleanupFailures.push({ step, error });
  primary.message += `; cleanup ${step} failed`;
  return true;
}
