// Pure report-only policy: none of these diagnostics participate in exit status.
import { fileTimings, timingKey, type DurationManifest, type TestTiming } from './suite-durations.ts';
import type { Tier } from './suite-shards.ts';

export const TIER_BUDGETS = {
  T1: { testSeconds: 0.5, fileSeconds: 10, wallSeconds: 120 },
  T2: { testSeconds: 2, fileSeconds: 30, wallSeconds: 480 },
  T3: { testSeconds: 10, fileSeconds: 120, wallSeconds: 900 },
  T4: null,
};
export type SourceTestIdentity = { patterns: string[]; dynamic: boolean; unchanged?: true };
export type DurationBudgetContext = {
  manifest: DurationManifest; tiers: Record<string, Tier>;
  base?: { manifest: DurationManifest; tiers: Record<string, Tier>; retained: string[]; sources: Record<string, SourceTestIdentity> };
};
const seconds = (n: number) => Number(n.toFixed(3)).toString();

export function durationBudgetReport(manifest: DurationManifest, tiers: Record<string, Tier>, observations: TestTiming[], base?: DurationBudgetContext['base']): string[] {
  // Smoke repeats contribute one conservative receipt per identity.
  const unique = new Map<string, TestTiming>();
  for (const test of observations) if ((unique.get(timingKey(test))?.seconds ?? -1) < test.seconds) unique.set(timingKey(test), test);
  const tests = [...unique.values()];
  const overages: Array<{ key: string; now: number; budget: number; tier: Tier }> = [];
  const compare = (key: string, now: number, tier: Tier, budget: number) => {
    const allowance = manifest.allow[key];
    if (now > budget && !(allowance && now <= allowance.seconds)) overages.push({ key, now, budget, tier });
  };
  for (const test of tests) {
    const tier = tiers[test.file];
    const budget = tier && (manifest.budget[tier] ?? TIER_BUDGETS[tier]);
    if (budget) compare(timingKey(test), test.seconds, tier!, budget.testSeconds);
  }
  const lines: string[] = [];
  for (const [file, timing] of Object.entries(fileTimings(tests))) {
    const tier = tiers[file];
    if (!tier) continue;
    const budget = manifest.budget[tier] ?? TIER_BUDGETS[tier];
    if (budget) compare(file, timing.seconds, tier, budget.fileSeconds);
    if (!manifest.files[file]) lines.push(`budget (report only): missing duration baseline ${file}; observed ${seconds(timing.seconds)} s (${tier})`);
  }
  const ranked = overages.sort((a, b) => (b.now - b.budget) - (a.now - a.budget) || a.key.localeCompare(b.key))
    .map(r => `budget (report only): would fail ${r.key} ${seconds(r.now)} s > ${seconds(r.budget)} s (${r.tier})`);
  if (base) {
    const retained = new Set(base.retained);
    let total = 0, projected = 0;
    for (const [file, timing] of Object.entries(base.manifest.files)) {
      if (base.tiers[file] !== 'T3') continue;
      total += timing.seconds;
      if (tiers[file] !== 'T3') continue;
      const removed = Object.entries(base.manifest.tests).filter(([key]) => key.startsWith(file + '::') && !retained.has(key)).reduce((sum, [, time]) => sum + time, 0);
      projected += Math.max(0, timing.seconds - removed);
    }
    let unbaselined = 0, uncertain = 0;
    for (const test of tests) {
      if (tiers[test.file] !== 'T3') continue;
      if (base.tiers[test.file] !== 'T3') { projected += test.seconds; continue; }
      if (base.manifest.tests[timingKey(test)] !== undefined) continue;
      const source = base.sources[test.file];
      if (!source) { uncertain++; continue; }
      // Timing coverage is not source identity. An unchanged file, or a title
      // present in the pinned base source, is old even with no timing baseline.
      if (source.unchanged || source.dynamic || source.patterns.some(pattern => new RegExp(pattern, 's').test(test.name))) {
        unbaselined++;
        if (source.dynamic) uncertain++;
      } else projected += test.seconds;
    }
    const missingFiles = Object.keys(base.tiers).filter(file => base.tiers[file] === 'T3' && tiers[file] === 'T3' && !base.manifest.files[file]).length;
    const allowed = manifest.allow.T3 && projected <= manifest.allow.T3.seconds;
    lines.push(`T3 ratchet (report only): ${seconds(projected)} s vs base ${seconds(total)} s${projected > total ? allowed ? '; allowed' : '; would refuse growth (needs T3 allowance)' : ''}${missingFiles || unbaselined ? `; incomplete base timings (${missingFiles} files, ${unbaselined} observed existing tests)` : ''}${uncertain ? `; uncertain source identity (${uncertain} observed tests retained)` : ''}`);
  } else lines.push('T3 ratchet (report only): unavailable (no base manifest)');
  const legacy = Object.values(manifest.allow).filter(entry => entry.legacy);
  lines.push(`budget legacy allowances: ${legacy.length}; ${seconds(legacy.reduce((sum, entry) => sum + entry.seconds, 0))} s; owner E-677`);
  return [...ranked, ...lines];
}

/** Result chips show the ten largest overages; the log keeps every line. */
export function durationBudgetSummary(lines: string[]): string[] {
  const overages = [...new Set(lines.filter(line => line.startsWith('budget (report only): would fail ')))];
  const excess = (line: string) => { const match = / ([\d.]+) s > ([\d.]+) s \(T[1-4]\)$/.exec(line); return match ? Number(match[1]) - Number(match[2]) : 0; };
  const details = [...new Set(lines.filter(line => /^(?:budget \(report only\): missing |T3 ratchet \(report only\):|budget legacy allowances:)/.test(line)))];
  const ratchets = details.filter(line => line.startsWith('T3 ratchet '));
  const lastRatchet = ratchets.findLast(line => !line.includes('unavailable')) ?? ratchets.at(-1);
  return [...overages.sort((a, b) => excess(b) - excess(a) || a.localeCompare(b)).slice(0, 10), ...details.filter(line => !line.startsWith('T3 ratchet ')), ...(lastRatchet ? [lastRatchet] : [])];
}
