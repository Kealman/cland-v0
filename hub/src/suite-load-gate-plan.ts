import type { DurationManifest } from './suite-durations.ts';
import type { TierPlan } from './suite-tier-report.ts';
import type { SuiteSelection } from './suite-selection.ts';

/** T4 already generates soak load; parallel repeats would measure contention
 * against the base phase instead of the test's own latency contract.
 */
export function skipT4LoadRepetitions(selection: SuiteSelection, plan: TierPlan): SuiteSelection {
  const soakFiles = plan.filter(row => row.tier === 'T4').flatMap(row => row.files);
  if (!selection.loadGate || !soakFiles.length) return selection;
  const files = plan.filter(row => row.tier !== 'T4').flatMap(row => row.files);
  return { ...selection,
    loadGateFiles: files.filter(file => !selection.loadGateFiles || selection.loadGateFiles.includes(file)),
    reason: `${selection.reason}; load gate: T4 repetitions skipped; ${soakFiles.length} files run in base phase only` };
}

/** Only the gate's completed 5/5 success line supplies proof; skips, partials and
 * quarantined failures deliberately have different formats. Retain exact names.
 */
export function loadProofIdentities(log: string): string[] {
  return [...new Set(log.split('\n').flatMap(line => {
    const match = /^load gate: ((?:hub\/(?:src|test)|nvim\/test)\/[^\r\n]+\.test\.ts::[^\r\n]+) 5\/5 passed$/.exec(line);
    return match ? [match[1]!] : [];
  }))].sort();
}

/** Legacy failures lack an attempt count: interrupted and complete failures have
 * the same text. Only positive success/quarantine totals prove completion. */
export function loadGateCompletionSummary(log: string): { complete: number; unknown: number } {
  const complete = new Set<string>(), unknown = new Set<string>(), skipped = new Set<string>();
  for (const line of log.split('\n')) {
    const start = /^load gate start: (.+::.+); five repetitions alongside phase$/.exec(line);
    if (start) unknown.add(start[1]!);
    const result = /^(?:✖ |quarantine )?load gate: (.+::.+) ([0-5])\/5 passed(?:; ([0-5])\/5 quarantined failures)?$/.exec(line);
    if (result) {
      if (Number(result[2]) + Number(result[3] ?? 0) === 5) complete.add(result[1]!);
      else unknown.add(result[1]!);
    }
    const skip = /^load gate: (.+::.+) skipped, not load-gated; 5\/5 skipped; reasons:/.exec(line);
    if (skip) skipped.add(skip[1]!);
  }
  for (const identity of [...complete, ...skipped]) unknown.delete(identity);
  return { complete: complete.size, unknown: unknown.size };
}

/** Occasion receipts replace the baseline; landed task proofs extend it. */
export function loadGateRepetitions(identity: string, selection: SuiteSelection | undefined, durationTests: Record<string, number>): 0 | 5 {
  if (selection?.durationCheck?.files.includes(identity.split('::')[0]!)) return 0; // Task process identities execute once.
  if (identity.startsWith('web/test/')) return 0; // Web's latency budget is never measured under repetition load.
  if (selection?.loadGateTests && !selection.loadGateTests.includes(identity)) return 0;
  if (selection?.loadGateFiles && !selection.loadGateFiles.includes(identity.split('::')[0]!)) return 0;
  const known = selection?.loadGateBaseline;
  return (known ? known.tests.includes(identity) : (Object.hasOwn(durationTests, identity) || selection?.loadGateKnownTests?.includes(identity))) ? 0 : 5;
}

/** Pin five-repetition identities before spending on a soak. Serialize repeat costs:
 * each fresh name-filtered process can still pay its whole file's fixture cost.
 * Reserve base file costs without assuming worker speedup under contention.
 * Reserve 20% for load variance plus 60 s for check/coverage/runner overhead.
 */
export function soakDeadlinePlan(selection: SuiteSelection, plan: TierPlan, manifest: DurationManifest | null, timeoutMs: number): SuiteSelection {
  const files = new Set(plan.flatMap(row => row.files));
  if (files.size && !manifest) throw new Error('soak deadline plan refused: missing file duration baseline');
  const budget = timeoutMs / 1000 * 0.8 - 60;
  const base = plan.reduce((sum, row) => sum + Math.max(row.projectedWall,
    row.phases?.reduce((cost, phase) => cost + phase.weights.reduce((total, weight) => total + weight, 0), 0) ?? row.seconds), 0) + files.size;
  if (base > budget) throw new Error(`soak deadline plan refused: base projection ${base.toFixed(1)} s exceeds ${budget.toFixed(1)} s after 20% margin and 60 s overhead`);
  let projected = base;
  const tests: string[] = [];
  const eligible = Object.keys(manifest?.tests ?? {}).sort().filter(identity => files.has(identity.split('::')[0]!) && manifest!.files[identity.split('::')[0]!] && loadGateRepetitions(identity, selection, manifest!.tests));
  for (const identity of eligible) {
    const cost = 5 * (Math.max(manifest!.files[identity.split('::')[0]!]!.seconds, manifest!.tests[identity]!) + 1);
    if (projected + cost > budget) continue;
    projected += cost;
    tests.push(identity);
  }
  return { ...selection, loadGateTests: tests,
    reason: `${selection.reason}; soak deadline plan: ${tests.length}/${eligible.length} identities repeated five times; projected ${projected.toFixed(1)} s <= ${budget.toFixed(1)} s (20% margin + 60 s overhead); unmeasured identities not repeated; ${plan.reduce((sum, row) => sum + row.missing, 0)} files use median base projection` };
}
