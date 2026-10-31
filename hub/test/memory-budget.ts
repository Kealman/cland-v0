/** Numeric, report-only memory comparisons; callers own measurement completion. */
export type MemoryReading = { heapUsed: number; rss: number };
export type MemoryLimits = { heap?: number; rss?: number };
export const DEFAULT_MEMORY_LIMITS: Readonly<MemoryLimits> = Object.freeze({ heap: 256 * 1024 * 1024, rss: 768 * 1024 * 1024 });
export function memoryBudgetReport(readiness: MemoryReading | null, rest: MemoryReading | null, limits: MemoryLimits, intervalMaximum: MemoryReading | null = null) {
  const compare = (bytes: number | undefined, budget: number | undefined) => ({
    bytes: bytes ?? null, budget: budget ?? null,
    status: bytes === undefined ? 'unavailable' : budget === undefined ? 'unconfigured' : bytes > budget ? 'over' : 'within',
  });
  const phase = (reading: MemoryReading | null) => ({ heap: compare(reading?.heapUsed, limits.heap), rss: compare(reading?.rss, limits.rss) });
  return { mode: 'report' as const, limitScope: 'endpoints' as const, readiness: phase(readiness), rest: phase(rest), intervalMaximum: phase(intervalMaximum) };
}


export function formatMemoryBudgetReport(report: ReturnType<typeof memoryBudgetReport>): string {
  const value = (reading: typeof report.readiness.heap) => reading.bytes === null
    ? 'unavailable' : `${(reading.bytes / (1024 * 1024)).toFixed(1)} MiB (${reading.status})`;
  const line = (name: string, reading: typeof report.readiness) => `${name}: heap ${value(reading.heap)}; RSS ${value(reading.rss)}`;
  return [line('readiness', report.readiness), line('rest endpoint', report.rest),
    line('interval maximum', report.intervalMaximum),
    'Limits govern readiness and rest endpoints; interval maxima are informational; report-only.',
  ].join('\n');
}
