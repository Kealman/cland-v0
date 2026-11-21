import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPruneProbeBudget } from './prune-probe-budget.ts';

// Replay the observed probe seam with a held exit: each additional poll is a
// complete batched birth/selected-ps/birth round, not another PID's probe.
const slowExit = (count = 10) => {
  let at = 0;
  const step = (kind: string, extra = {}) => ({ kind, started: at++, completed: at, ...extra });
  const snapshot = () => [step('perl'), step('ps', { selector: 'pids', parsedRows: 11, selectedPids: 11 }), step('perl')];
  return { omitted: 0, proc: { calls: 0, subtotalMs: 0, failures: 0 }, steps: [
    ...Array.from({ length: 10 }, () => step('ps', { selector: 'pids', parsedRows: 1, selectedPids: 1 })),
    ...Array.from({ length: count }, () => snapshot()).flat(),
  ] };
};

test('held exit permits extra batched polling rounds inside the stop deadline', () => {
  assertPruneProbeBudget(slowExit(), 1000);
});

test('polling budget rejects per-PID birth spawns, whole-table scans and excessive rounds', () => {
  const perPid = slowExit();
  perPid.steps.splice(12, 0, { kind: 'perl', started: 12, completed: 13 });
  assert.throws(() => assertPruneProbeBudget(perPid, 1000), /batched round/);
  const fullScan = slowExit();
  Object.assign(fullScan.steps[11]!, { selector: 'all' });
  assert.throws(() => assertPruneProbeBudget(fullScan, 1000), /full-table/);
  const perPidPs = slowExit();
  Object.assign(perPidPs.steps[11]!, { selectedPids: 1 });
  assert.throws(() => assertPruneProbeBudget(perPidPs, 1000), /batched owned Git/);
  const perPidDiscovery = slowExit();
  perPidDiscovery.steps.splice(10, 0, { kind: 'pgrep', started: 10, completed: 11 }, { kind: 'pgrep', started: 11, completed: 12 });
  assert.throws(() => assertPruneProbeBudget(perPidDiscovery, 1000), /batched round/);
  assert.throws(() => assertPruneProbeBudget(slowExit(59), 1000), /poll rounds/);
});

test('Linux batched snapshots need no Perl and signal probes remain separate', () => {
  const trace = slowExit();
  trace.steps = trace.steps.filter(step => step.kind !== 'perl').slice(10);
  trace.steps.splice(1, 0,
    { kind: 'ps', started: 1, completed: 2, ...{ selector: 'pids', selectedPids: 1 } },
    { kind: 'signal:SIGTERM', started: 2, completed: 2 });
  assertPruneProbeBudget(trace, 1000);
});
