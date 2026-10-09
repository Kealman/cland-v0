// Normalise adapter reports at the hub boundary. Cached input is separate from uncached input;
// reasoning is already included in output and never added again to the total.
import type { SessionUsage, UsageCounts } from '../protocol.ts';

const number = (...values: unknown[]): number | undefined => values.find((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);

function counts(report: Record<string, unknown>): UsageCounts {
  const inputTokens = number(report.inputTokens, report.input_tokens) ?? 0;
  const outputTokens = number(report.outputTokens, report.output_tokens) ?? 0;
  const cacheReadTokens = number(report.cacheReadTokens, report.cache_read_input_tokens) ?? 0;
  const cacheWriteTokens = number(report.cacheWriteTokens, report.cache_creation_input_tokens) ?? 0;
  const cost = number(report.cost, report.costUSD, report.costUsd, report.cost_usd, report.total_cost_usd);
  return {
    totalTokens: number(report.totalTokens) ?? inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens,
    inputTokens,
    outputTokens,
    reasoningTokens: number(report.reasoningTokens) ?? 0,
    cacheReadTokens,
    cacheWriteTokens,
    ...(cost !== undefined ? { cost } : {}),
  };
}

/** Each Claude turn or OpenCode step contributes once; its last report stays available beside the sum. */
export function addUsage(previous: SessionUsage | undefined, report: Record<string, unknown>): SessionUsage {
  const last = counts(report);
  const total = { ...last };
  for (const key of Object.keys(last) as Array<keyof UsageCounts>) total[key] = (previous?.total?.[key] ?? 0) + (last[key] ?? 0);
  if (previous?.total?.cost !== undefined && last.cost === undefined) total.cost = previous.total.cost;
  const model = typeof report.model === 'string' ? report.model : previous?.model;
  return { ...(model ? { model } : {}), total, last };
}

/** Codex already sums the thread; replace, never add, and remove its cached input from inputTokens. */
export function codexCounts(report: unknown): UsageCounts | undefined {
  if (!report || typeof report !== 'object') return undefined;
  const raw = report as Record<string, unknown>;
  const cacheReadTokens = number(raw.cachedInputTokens) ?? 0;
  return counts({ ...raw, inputTokens: Math.max(0, (number(raw.inputTokens) ?? 0) - cacheReadTokens), cacheReadTokens, reasoningTokens: raw.reasoningOutputTokens });
}
