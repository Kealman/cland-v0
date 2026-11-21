import { parseTimingReceipts } from './suite-timing-receipts.ts';
import { measuredDurationAllowance } from './duration-allowance.ts';
import type { DurationManifest, TestTiming } from './suite-durations.ts';

export type EnqueueTimingResult = { kind: 'missing' } | { kind: 'clear' } | { kind: 'allowance'; stanzas: DurationManifest['allow'] };

/** Evidence eligibility is independent of duration manifest report/enforce mode. */
export function enqueueTimingPolicy(facts: { run: string; head: string; tree: string; receipts: unknown; known: string[]; allow: Record<string, { seconds: number }>; owner: string; now: number }): EnqueueTimingResult {
  const receipts = parseTimingReceipts(facts.receipts)?.filter(row => row.run === facts.run && row.head === facts.head && row.tree === facts.tree && row.platform === 'linux');
  if (!receipts?.some(row => row.samples.some(sample => sample.outcome === 'pass'))) return { kind: 'missing' };
  const known = new Set(facts.known);
  const worst = new Map<string, TestTiming>();
  for (const row of receipts) for (const sample of row.samples) {
    const key = `${sample.file}::${sample.name}`;
    if (sample.outcome !== 'pass' || sample.seconds < 4 || known.has(key)) continue;
    if (!worst.has(key) || worst.get(key)!.seconds < sample.seconds) worst.set(key, sample);
  }
  const stanzas = Object.fromEntries([...worst].sort(([a], [b]) => a.localeCompare(b)).flatMap(([key, sample]) => {
    if (Object.hasOwn(facts.allow, key) && facts.allow[key]!.seconds >= sample.seconds) return [];
    return [[key, measuredDurationAllowance(sample, 'Linux', facts.owner, facts.now)]];
  }));
  return Object.keys(stanzas).length ? { kind: 'allowance', stanzas } : { kind: 'clear' };
}
