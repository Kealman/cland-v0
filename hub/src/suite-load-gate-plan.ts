import type { DurationManifest } from './suite-durations.ts';
import type { TierPlan } from './suite-tier-report.ts';
import type { SuiteSelection } from './suite-selection.ts';

// A-19799 / d5150de3: T0–T4 took ~4480 s; T1–T4 worker projection
// was 2066.985 s, with Web still unexecuted. Round 4480/2066.985 upward.
// Charging T0's unknown share here is conservative; this is a calibration,
// not an observed per-tier time or a successful complete soak receipt.
export const SOAK_WALL_CALIBRATION = 2.17;
export const SOAK_RUNNER_STARTED = /^suite runner started (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/;

/** Remote run.sh writes both this start line and /done on its own clock.
 * Older logs without a native start receipt leave the interval unknown. */
export function soakExecutionSeconds(log: string, remoteFinishedAt: string | undefined): number | null {
  const marker = new RegExp(SOAK_RUNNER_STARTED.source, 'gm');
  const start = marker.exec(log);
  if (!start || marker.exec(log)) return null;
  const seconds = (Date.parse(remoteFinishedAt ?? '') - Date.parse(start[1]!)) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function soakCalibration(receipt: { projected: number; observed: number } | null): number {
  return receipt && Number.isFinite(receipt.projected) && receipt.projected > 0 && Number.isFinite(receipt.observed) && receipt.observed > 0
    ? Math.max(SOAK_WALL_CALIBRATION, receipt.observed / receipt.projected) : SOAK_WALL_CALIBRATION;
}

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
  // Keep only the current line alongside the identity sets, never an array of
  // retained history. Do not import suite-log here: it owns native file IO.
  let offset = 0;
  while (offset < log.length) {
    const newline = log.indexOf('\n', offset);
    const line = log.slice(offset, newline < 0 ? log.length : newline);
    offset = newline < 0 ? log.length : newline + 1;
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
  for (const identity of complete) unknown.delete(identity);
  for (const identity of skipped) unknown.delete(identity);
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
 * Calibrate worker estimates against observed contention; oversized bases use
 * serial calibrated file costs while rotating contiguous prefixes in each tier.
 * Reserve 20% for load variance plus 60 s for check/coverage/runner overhead.
 */
export function soakDeadlinePlan(selection: SuiteSelection, plan: TierPlan, manifest: DurationManifest | null, timeoutMs: number, cursors: Record<string, number> = {}, calibration = SOAK_WALL_CALIBRATION): SuiteSelection {
  let files = new Set(plan.flatMap(row => row.files));
  if (files.size && !manifest) throw new Error('soak deadline plan refused: missing file duration baseline');
  const budget = timeoutMs / 1000 * 0.8 - 60;
  let base = plan.reduce((sum, row) => sum + row.projectedWall * calibration, 0) + files.size;
  if (base > budget) {
    const rows = plan.filter(row => row.files.length).map(row => {
      const weights = row.phases?.flatMap(phase => phase.weights);
      const entries = row.files.map((file, i) => ({ file, cost: (weights?.[i] ?? manifest?.files[file]?.seconds ?? Math.max(row.seconds, row.projectedWall) / row.files.length) * calibration + 1 }));
      const offset = (cursors[row.tier] ?? 0) % entries.length;
      return { tier: row.tier, entries: [...entries.slice(offset), ...entries.slice(0, offset)], taken: 1 };
    });
    const first = rows.reduce((sum, row) => sum + row.entries[0]!.cost, 0);
    if (first > budget) throw new Error(`soak deadline plan refused: base projection ${base.toFixed(1)} s exceeds ${budget.toFixed(1)} s; first rotating file in each tier needs ${first.toFixed(1)} s; unexecuted coverage: ${[...files].join(', ')}; deadline reserve 20% + 60 s`);
    base = first;
    let advanced = true;
    while (advanced) {
      advanced = false;
      for (const row of rows) {
        const next = row.entries[row.taken];
        if (!next || base + next.cost > budget) continue;
        base += next.cost; row.taken++; advanced = true;
      }
    }
    files = new Set(rows.flatMap(row => row.entries.slice(0, row.taken).map(entry => entry.file)));
    selection = { ...selection, shard: { files: [...files].filter(file => file.startsWith('hub/')), nvim: true },
      nvimTests: [...files].filter(file => file.startsWith('nvim/')), batchTests: { Web: [...files].filter(file => file.startsWith('web/')) },
      reason: `${selection.reason}; rotating base, full cycle at most ${Math.max(...rows.map(row => row.entries.length))} admitted nights with unchanged manifest and calibration; unexecuted coverage (deadline reserve 20% + 60 s): ${rows.filter(row => row.taken < row.entries.length).map(row => `${row.tier}: ${row.entries.length - row.taken} files (${row.entries.slice(row.taken, row.taken + 2).map(entry => entry.file).join(', ')}); full list in suite.log`).join('; ')}` };
  }
  let projected = base;
  const tests: string[] = [];
  const eligible = Object.keys(manifest?.tests ?? {}).sort().filter(identity => files.has(identity.split('::')[0]!) && manifest!.files[identity.split('::')[0]!] && loadGateRepetitions(identity, selection, manifest!.tests));
  for (const identity of eligible) {
    const cost = 5 * (Math.max(manifest!.files[identity.split('::')[0]!]!.seconds, manifest!.tests[identity]!) * calibration + 1);
    if (projected + cost > budget) continue;
    projected += cost;
    tests.push(identity);
  }
  return { ...selection, loadGateTests: tests,
    reason: `${selection.reason}; soak deadline plan: ${tests.length}/${eligible.length} identities repeated five times; projected ${projected.toFixed(1)} s <= ${budget.toFixed(1)} s (20% margin + 60 s overhead); base calibration ${calibration} from latest completion or A-19799 floor (4480/2066.985 rounded upward); unmeasured identities not repeated; ${plan.reduce((sum, row) => sum + row.missing, 0)} files use median base projection` };
}
