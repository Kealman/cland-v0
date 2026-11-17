// Package runners reserve EX_TEMPFAIL for an incomplete infrastructure outcome.
export const SUITE_INFRASTRUCTURE_EXIT = 75;
export const suiteInfrastructureLine = (line: string): boolean => line.startsWith('suite infrastructure: ');
export function suiteCommandOutcome(code: number, cause: string) {
  return { code, cause, ...(code === SUITE_INFRASTRUCTURE_EXIT && suiteInfrastructureLine(cause) ? { notRun: 'infrastructure' as const } : {}) };
}
