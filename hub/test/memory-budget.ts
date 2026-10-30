/** Numeric, report-only memory comparisons; callers own measurement completion. */
export type MemoryReading = { heapUsed: number; rss: number };
export type MemoryLimits = { heap?: number; rss?: number };
export const DEFAULT_MEMORY_LIMITS: Readonly<MemoryLimits> = Object.freeze({ heap: 256 * 1024 * 1024, rss: 768 * 1024 * 1024 });
export function memoryBudgetReport(readiness: MemoryReading | null, rest: MemoryReading | null, limits: MemoryLimits) {
  const compare = (bytes: number | undefined, budget: number | undefined) => ({
    bytes: bytes ?? null, budget: budget ?? null,
    status: bytes === undefined ? 'unavailable' : budget === undefined ? 'unconfigured' : bytes > budget ? 'over' : 'within',
  });
  const phase = (reading: MemoryReading | null) => ({ heap: compare(reading?.heapUsed, limits.heap), rss: compare(reading?.rss, limits.rss) });
  return { mode: 'report' as const, readiness: phase(readiness), rest: phase(rest) };
}
