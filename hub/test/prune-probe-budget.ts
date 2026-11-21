import assert from 'node:assert/strict';
import type { InspectionTrace } from './prune-inspection-trace.ts';

export function assertPruneProbeBudget(trace: InspectionTrace, budgetMs: number): void {
  assert.equal(trace.omitted, 0, 'complete probe receipt');
  assert.ok(Number.isFinite(budgetMs) && budgetMs > 0, 'recorded stop deadline');
  const steps = trace.steps;
  assert.ok(steps.every(step => step.completed !== undefined), 'every native probe closed');
  let index = 0, rounds = 0, signals = 0, ownerProbes = 0, checkpointSeen = false;
  const births = steps.some(step => step.kind === 'perl');
  const take = (kind: string) => {
    assert.equal(steps[index]?.kind, kind, `batched round at step ${index}`);
    return steps[index++]!;
  };
  // macOS reads the caller chain once; Linux uses proc stat. These are
  // single-PID snapshots, distinct from the subsequent batched rounds.
  while (steps[index]?.kind === 'ps' && steps[index]!.parsedRows !== undefined && steps[index]!.selectedPids === 1) {
    const step = take('ps');
    assert.equal(step.selector, 'pids', 'no full-table caller scan');
    assert.equal(step.parsedRows, 1, 'one caller link');
    assert.ok(index <= 64, 'bounded caller ancestry');
  }
  while (index < steps.length) {
    if (steps[index]!.kind === 'ownership-checkpoint') { checkpointSeen = true; index++; continue; }
    if (steps[index]!.kind === 'ps' && steps[index]!.parsedRows === undefined) {
      const step = take('ps');
      assert.equal(step.selector, 'pids', 'selected signal target');
      assert.equal(step.selectedPids, 1, 'one Git signal target');
      if (!steps[index + (births ? 1 : 0)]?.kind.startsWith('signal:')) {
        assert.ok(!checkpointSeen && ++ownerProbes <= 1, 'at most one fresh ownership probe before checkpoint');
        continue;
      }
      if (births) take('perl');
      assert.ok(steps[index]?.kind.startsWith('signal:'), 'fresh signal probe immediately precedes signal');
      index++; signals++;
      assert.ok(signals <= 3, 'single Git receives TERM, STOP and KILL at most once');
      continue;
    }
    // A single Git has no children: at most one parent discovery, one
    // authoritative ps, and one native birth batch on each side per round.
    if (steps[index]!.kind === 'pgrep') take('pgrep');
    if (births) take('perl');
    const step = take('ps');
    assert.equal(step.selector, 'pids', 'no full-table snapshot');
    assert.ok(step.parsedRows !== undefined && step.parsedRows > 0 && step.parsedRows <= 65 && step.selectedPids! > 1 && step.selectedPids! <= 65 && !step.rowOutputTruncated, 'batched owned Git and caller rows, at most 65');
    if (births) take('perl');
    rounds++;
  }
  assert.ok(rounds > 0, 'authoritative snapshot observed');
  // Non-polling phases need at most eight snapshots. Further freeze polls
  // sleep 20ms; grace/exit polls sleep 50ms. The shared deadline bounds both.
  assert.ok(rounds <= 8 + Math.ceil(budgetMs / 20), 'poll rounds bounded by stop deadline');
}
