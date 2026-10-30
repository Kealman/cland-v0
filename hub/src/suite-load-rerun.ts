import { redactLoadDiagnostic } from './suite-load-diagnostics.ts';
/** Advisory only: a rerun never changes the original cover's exit status. */
export type LoadRepetitionFailure = { identity: string; repetition: number; timeout: boolean };
export function eligibleLoadRerun(input: { platform: string; cover: boolean; ordinaryFailed: boolean; failures: LoadRepetitionFailure[]; recent: string[] }): string | null {
  const failure = input.failures[0];
  return input.platform === 'darwin' && input.cover && !input.ordinaryFailed
    && input.failures.length === 1 && failure && !failure.timeout && input.recent.includes(failure.identity)
    ? failure.identity : null;
}
export type RecentCover = { completed: number; green: boolean; identities: string[] };
/** The caller supplies the already loaded completed-cover index, oldest first.
 * Missing evidence occupies a window slot and supplies no passing identity. */
export function recentCoverGreens(covers: RecentCover[], now: number): string[] {
  return [...new Set(covers.slice(-5).flatMap(cover => cover.green && now >= cover.completed
    && now - cover.completed <= 7 * 86400000 ? cover.identities : []))].sort();
}

/** Redact before bounding so a truncated secret can never escape the filter. */
export function serializeLoadRerunReceipt(facts: Record<string, unknown>, diagnostics: unknown, env: NodeJS.ProcessEnv): string {
  const clean = redactLoadDiagnostic({ ...facts, diagnostics }, env);
  const { diagnostics: detail, ...native } = clean;
  return JSON.stringify({ ...native, diagnosticTail: JSON.stringify(detail).slice(-65_536) });
}
