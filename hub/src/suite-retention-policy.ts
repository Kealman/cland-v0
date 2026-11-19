/** Filesystem-independent retention policy; unknown directories never grant ownership. */
export type RetentionRun = { id: string; occasion: string; sequence: number; settled: boolean };
export const SUITE_RUNS_PER_OCCASION = 20;
export const SUITE_RETENTION_PASS_LIMIT = 4096;
export const SUITE_RETENTION_BATCH_SIZE = 32;
// Human's one-off rule 27 exception: General, 2026-11-19 18:36Z,
// answer to ask 2da0c7c7, relayed by Coordinator 2af3e8a9. T-1992 includes C6.
export const SUITE_UNINDEXED_RETENTION_REMOVE = true;
export function suiteRetentionReport(reasons:Record<string,number>,total:number,removed:number,mode:'live'|'report') {
  const decisions=Object.values(reasons).reduce((sum,count)=>sum+count,0);
  const wouldRetire=reasons.eligible??0,pending=reasons.pending??0;
  return {mode,total,classified:decisions-pending,pending,kept:decisions-pending-wouldRetire,wouldRetire,removed,reasons};
}
export const SUITE_RETENTION_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export function suiteRunOldEnough(settledAt: string | undefined, now: number, minimumAgeMs = SUITE_RETENTION_MIN_AGE_MS): boolean {
  const settled = Date.parse(settledAt ?? '');
  return Number.isFinite(now) && Number.isFinite(settled) && minimumAgeMs >= 0 && now - settled >= minimumAgeMs;
}
export function suiteRetentionCandidates(runs: readonly RetentionRun[], referenced: ReadonlySet<string>, keep = SUITE_RUNS_PER_OCCASION): string[] {
  if (!Number.isSafeInteger(keep) || keep < 1) throw new Error('suite retention must be a positive integer');
  const recent = new Set<string>();
  const counts = new Map<string, number>();
  for (const run of [...runs].sort((a, b) => b.sequence - a.sequence || b.id.localeCompare(a.id))) {
    const count = counts.get(run.occasion) ?? 0;
    if (count < keep) recent.add(run.id);
    counts.set(run.occasion, count + 1);
  }
  return runs.filter(run => run.settled && !referenced.has(run.id) && !recent.has(run.id)).map(run => run.id);
}
