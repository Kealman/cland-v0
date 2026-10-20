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

/** Occasion receipts replace the baseline; landed task proofs extend it. */
export function loadGateRepetitions(identity: string, selection: SuiteSelection | undefined, durationTests: Record<string, number>): 0 | 5 {
  if (identity.startsWith('web/test/')) return 0; // Web's latency budget is never measured under repetition load.
  if (selection?.loadGateTests && !selection.loadGateTests.includes(identity)) return 0;
  if (selection?.loadGateFiles && !selection.loadGateFiles.includes(identity.split('::')[0]!)) return 0;
  const known = selection?.loadGateBaseline;
  return (known ? known.tests.includes(identity) : (Object.hasOwn(durationTests, identity) || selection?.loadGateKnownTests?.includes(identity))) ? 0 : 5;
}

/** Pin five-repetition identities before spending on a soak. Serialize repeat costs:
 * each fresh name-filtered process can still pay its whole file's fixture cost.
 * Reserve 20% for load variance plus 60 s for check/coverage/runner overhead.
 */
export function soakDeadlinePlan(selection: SuiteSelection, plan: TierPlan, manifest: DurationManifest | null, timeoutMs: number): SuiteSelection {
  const files = new Set(plan.flatMap(row => row.files));
  if (files.size && !manifest) throw new Error('soak deadline plan refused: missing file duration baseline');
  const budget = timeoutMs / 1000 * 0.8 - 60;
  const base = plan.reduce((sum, row) => sum + row.projectedWall, 0) + files.size;
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
