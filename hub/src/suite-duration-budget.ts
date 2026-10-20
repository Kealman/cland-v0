// Timing diagnostics and pure merge admission policy over pinned manifest facts.
import { fileTimings, timingKey, TIER_BUDGETS, type DurationManifest, type TestTiming } from './suite-durations.ts';
import type { Tier } from './suite-shards.ts';
import { projectedWall } from './suite-tier-report.ts';

export { TIER_BUDGETS } from './suite-durations.ts';
export type SourceTestIdentity = { patterns: string[]; dynamic: boolean; unchanged?: true };
export type DurationBudgetContext = {
  manifest: DurationManifest; tiers: Record<string, Tier>;
  candidateSources?: Record<string, SourceTestIdentity>;
  base?: { manifest: DurationManifest; tiers: Record<string, Tier>; retained: string[]; sources: Record<string, SourceTestIdentity> };
};
const seconds = (n: number) => Number(n.toFixed(3)).toString();

export function durationBudgetReport(manifest: DurationManifest, tiers: Record<string, Tier>, observations: TestTiming[], base?: DurationBudgetContext['base']): string[] {
  const enforce = manifest.budget.mode === 'enforce';
  const label = enforce ? 'budget' : 'budget (report only)';
  const ratchet = enforce ? 'T3 ratchet' : 'T3 ratchet (report only)';
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
    if (!manifest.files[file]) lines.push(`${label}: missing duration baseline ${file}; observed ${seconds(timing.seconds)} s (${tier})`);
  }
  const ranked = overages.sort((a, b) => (b.now - b.budget) - (a.now - a.budget) || a.key.localeCompare(b.key))
    .map(r => `${enforce ? 'duration budget:' : 'budget (report only): would fail'} ${r.key} ${seconds(r.now)} s > ${seconds(r.budget)} s (${r.tier})`);
  if (base) {
    const { total, projected, missingFiles, unbaselined, uncertain } = t3Projection(tiers, tests, base);
    const allowed = manifest.allow.T3 && projected <= manifest.allow.T3.seconds;
    lines.push(`${ratchet}: ${seconds(projected)} s vs base ${seconds(total)} s${projected > total ? allowed ? '; allowed' : '; would refuse growth (needs T3 allowance)' : ''}${missingFiles || unbaselined ? `; incomplete base timings (${missingFiles} files, ${unbaselined} observed existing tests)` : ''}${uncertain ? `; uncertain source identity (${uncertain} observed tests retained)` : ''}`);
  } else lines.push(`${ratchet}: unavailable (no base manifest)`);
  const legacy = Object.values(manifest.allow).filter(entry => entry.legacy);
  lines.push(`budget legacy allowances: ${legacy.length}; ${seconds(legacy.reduce((sum, entry) => sum + entry.seconds, 0))} s; owner ${manifest.budget.legacyOwner ?? 'E-677'}`);
  return [...ranked, ...lines];
}

/** The ratchet preserves existing source identities independently of timing coverage. */
function t3Projection(tiers: Record<string, Tier>, tests: TestTiming[], base: NonNullable<DurationBudgetContext['base']>) {
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
  return { total, projected, missingFiles, unbaselined, uncertain };
}

/** Merge admission uses the complete candidate manifest, never a task's selected subset. */
export function checkMergeBudgets(context: DurationBudgetContext, workers: number): { failures: string[]; lines: string[] } {
  const { manifest, tiers, base } = context;
  const failures: string[] = [], lines: string[] = [];
  if (manifest.budget.mode !== 'enforce') return { failures, lines };
  const tests = Object.entries(manifest.tests).map(([key, seconds]) => {
    const at = key.indexOf('::');
    return { file: key.slice(0, at), name: key.slice(at + 2), seconds };
  });
  const estimates: Record<string, number> = {};
  if (base) for (const [file, source] of Object.entries(context.candidateSources ?? {})) {
    if (tiers[file] !== 'T3') continue;
    const previous = base.tiers[file] === 'T3' ? base.sources[file] : undefined;
    if (previous?.unchanged || previous?.dynamic) continue;
    const names = tests.filter(test => test.file === file).map(test => test.name);
    const count = source.patterns.filter(pattern => !previous?.patterns.includes(pattern) && !names.some(name => new RegExp(pattern, 's').test(name))).length
      + (source.dynamic && !previous?.dynamic ? 1 : 0);
    if (count) estimates[file] = count * (manifest.budget.T3 ?? TIER_BUDGETS.T3).testSeconds;
  }
  const estimated = Object.values(estimates).reduce((sum, time) => sum + time, 0);
  const estimate = estimated ? `; ${seconds(estimated)} s estimated (no receipt)` : '';
  if (base) {
    const projection = t3Projection(tiers, tests, base);
    const projected = projection.projected + estimated;
    if (projected > projection.total && !(manifest.allow.T3 && projected <= manifest.allow.T3.seconds)) failures.push(`merge-budget: T3 growth ${seconds(projected)} s > base ${seconds(projection.total)} s (needs T3 allowance)${estimate}`);
    else if (estimated) lines.push(`merge-budget: T3 projection ${seconds(projected)} s${estimate}`);
  }
  const wall = (data: DurationManifest, assignments: Record<string, Tier>, tier: Tier) => {
    const known = Object.values(data.files).map(row => row.seconds).sort((a, b) => a - b);
    const median = known.length ? known.length % 2 ? known[Math.floor(known.length / 2)]! : (known[known.length / 2 - 1]! + known[known.length / 2]!) / 2 : 1;
    const files = Object.keys(assignments).filter(file => assignments[file] === tier);
    const weight = (file: string) => data === manifest && estimates[file] ? (data.files[file]?.seconds ?? 0) + estimates[file]! : data.files[file]?.seconds ?? median;
    // Hub and Neovim package phases execute sequentially.
    return [false, true].reduce((sum, nvim) => sum + projectedWall(files.filter(file => file.startsWith('nvim/') === nvim).map(weight), workers), 0);
  };
  for (const tier of ['T2', 'T3'] as const) {
    const limit = (manifest.budget[tier] ?? TIER_BUDGETS[tier]).wallSeconds;
    if (tier === 'T3') {
      if (!base) { lines.push('T3 wall unavailable (no base manifest)'); continue; }
      const baseWall = wall(base.manifest, base.tiers, tier);
      if (baseWall >= limit) { lines.push(`T3 wall ${seconds(limit)} s not yet enforced: base ${seconds(baseWall)} s`); continue; }
    }
    const projected = wall(manifest, tiers, tier);
    if (projected > limit) failures.push(`merge-budget: ${tier} projected wall ${seconds(projected)} s > ${seconds(limit)} s at ${workers} workers${tier === 'T3' ? estimate : ''}`);
  }
  return { failures, lines };
}

/** Result chips show the ten largest overages and count missing baselines; the log keeps every line. */
export function durationBudgetSummary(lines: string[]): string[] {
  const overages = [...new Set(lines.filter(line => /^(?:budget \(report only\): would fail |duration budget:)/.test(line)))];
  const excess = (line: string) => { const match = / ([\d.]+) s > ([\d.]+) s \((?:T[1-4]|Web)\)$/.exec(line); return match ? Number(match[1]) - Number(match[2]) : 0; };
  const details = [...new Set(lines.filter(line => /^(?:budget(?: \(report only\))?: missing |T3 ratchet(?: \(report only\))?:|budget legacy allowances:)/.test(line)))];
  const ratchets = details.filter(line => line.startsWith('T3 ratchet'));
  const lastRatchet = ratchets.findLast(line => !line.includes('unavailable')) ?? ratchets.at(-1);
  const missing = details.filter(line => /^budget(?: \(report only\))?: missing /.test(line));
  return [...overages.sort((a, b) => excess(b) - excess(a) || a.localeCompare(b)).slice(0, 10),
    ...(missing.length ? [`budget missing baselines: ${missing.length}`] : []),
    ...details.filter(line => line.startsWith('budget legacy allowances:')), ...(lastRatchet ? [lastRatchet] : [])];
}
