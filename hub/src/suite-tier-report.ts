// Reporting only: tier projections never participate in a run's exit decision.
import { glob } from 'node:fs/promises';
import { packageShards, readTierAssignments, type Tier, type SuiteShard, type DurationHistory } from './suite-shards.ts';
import { readDurationManifest, type TestTiming } from './suite-durations.ts';
import type { SuiteSelection } from './suite-selection.ts';
import type { MergeQueueEntry, MergeBatchStatus } from './protocol.ts';

/** Deferred coverage is a queue observation, never a passing T3 receipt. */
export function taskTierEvidence(selection: SuiteSelection | undefined, queue: { enabled: boolean; batchTiers?: SuiteSelection['tiers']; entries: MergeQueueEntry[]; batch: MergeBatchStatus | null }, item: string | null): string | null {
  if (selection?.tiers?.join(',') !== 'T1,T2') return null;
  if (!queue.enabled) return 'T3: in the merge batch; queue disabled; process evidence unavailable';
  const coverage = queue.batchTiers && !queue.batchTiers.includes('T3') ? 'T3: periodic dev and integrated occasions; absent from configured batch tiers' : 'T3: in the merge batch';
  const position = queue.entries.findIndex(entry => entry.item === item);
  const batch = queue.batch;
  return `${coverage}; ${position < 0 ? 'queue enabled; item awaiting enqueue' : `queue position ${position + 1}`}; batch ${batch ? `${batch.id} (${batch.failed ? `blocked: ${batch.failed}` : batch.run ?? 'preparing'})` : 'idle'}`;
}

export type TierPlan = Array<{ tier: Tier; files: string[]; tests: number; seconds: number; projectedWall: number; workers: number; missing: number; wallBudget?: number; phases?: Array<{ weights: number[]; serial: boolean }> }>;
export type SuiteDryRun = { dryRun: true; head: string; executor: 'local' | 'droplet'; workers: number; selection: SuiteSelection; tiers: TierPlan; lines: string[] };
const seconds = (n: number) => Number(n.toFixed(3)).toString();
const budgets: Record<Tier, number | null> = { T1: 120, T2: 480, T3: 900, T4: null, Web: 40 };

/** Expand the actual package phases, including smoke, deduplicating planned files. */
export async function planTierReport(cwd: string, selection: SuiteSelection, workers: number, phases?: SuiteShard[], history: DurationHistory = {}): Promise<TierPlan> {
  const tiers = await readTierAssignments(cwd);
  if (!tiers) return [];
  const manifest = await readDurationManifest(cwd);
  const known = Object.values(manifest?.files ?? {}).map(f => f.seconds).sort((a, b) => a - b);
  const median = known.length ? known.length % 2 ? known[Math.floor(known.length / 2)]! : (known[known.length / 2 - 1]! + known[known.length / 2]!) / 2 : 1;
  const result: TierPlan = [];
  const seen = new Set<string>();
  for (const phase of phases ?? await packageShards(cwd, selection.mode, selection.shard, selection, { workers, ...history })) {
    const paths: string[] = [];
    for await (const path of glob(phase.targets, { cwd })) if (!seen.has(path) && tiers.has(path)) { seen.add(path); paths.push(path); }
    for (const tier of ['T1', 'T2', 'T3', 'T4', 'Web'] as const) {
      const files = paths.filter(path => tiers.get(path) === tier).sort();
      if (!files.length) continue;
      let row = result.find(row => row.tier === tier);
      if (!row) result.push(row = { tier, files: [], tests: 0, seconds: 0, projectedWall: 0, workers: phase.workers, missing: 0, phases: [] });
      const wallBudget = manifest?.budget[tier]?.wallSeconds;
      if (wallBudget !== undefined) row.wallBudget = wallBudget;
      row.files.push(...files);
      for (const file of files) {
        const baseline = manifest?.files[file];
        row.tests += baseline?.tests ?? 0;
        row.seconds += baseline?.seconds ?? 0;
        if (!baseline) row.missing++;
      }
      // Same longest-processing-time placement and unknown-file median as close runs.
      // Package phases run sequentially, so sum each phase's projected wall.
      const weights = files.map(file => manifest?.files[file]?.seconds ?? median);
      row.phases!.push({ weights, serial: phase.resource === 'free' });
      row.projectedWall += projectedWall(weights, phase.workers);
    }
  }
  return result.sort((a, b) => a.tier.localeCompare(b.tier));
}

export function projectedWall(weights: number[], workers: number): number {
  const lanes = Array.from({ length: workers }, () => 0);
  for (const weight of [...weights].sort((a, b) => b - a)) {
    const lane = lanes.indexOf(Math.min(...lanes));
    lanes[lane]! += weight;
  }
  return Math.max(...lanes);
}

/** Admission can change the worker policy or fall back to the local executor. */
export function tierPlanWorkers(plan: TierPlan, workers: number): TierPlan {
  return plan.map(row => row.tier === 'Web' ? row : row.phases ? { ...row,
    workers: row.phases.every(phase => phase.serial) ? 1 : workers,
    projectedWall: row.phases.reduce((sum, phase) => sum + projectedWall(phase.weights, phase.serial ? 1 : workers), 0),
  } : row);
}

export function timingReceipts(log: string): TestTiming[] {
  return [...log.matchAll(/^suite timing (\{[^\n]+\})/gm)].flatMap(match => {
    try {
      const row = JSON.parse(match[1]!) as TestTiming;
      return typeof row.file === 'string' && typeof row.name === 'string' && Number.isFinite(row.seconds) && row.seconds >= 0 ? [row] : [];
    } catch { return []; }
  });
}

export function tierReport(plan: TierPlan, observed?: TestTiming[]): string[] {
  if (!plan.length) return [];
  const lines = plan.map(row => {
    const receipts = observed?.filter(test => row.files.includes(test.file));
    const budget = row.wallBudget ?? budgets[row.tier];
    return `tier ${row.tier}: files ${row.files.length}; tests ${receipts ? receipts.length : `${row.tests} planned`}; observed ${receipts?.length ? `${seconds(receipts.reduce((sum, t) => sum + t.seconds, 0))} s` : 'unavailable'}; projected wall ${seconds(row.projectedWall)} s at ${row.workers} workers; wall budget ${budget === null ? 'none' : `${budget} s`}${budget !== null && row.projectedWall > budget ? '; over wall (report only)' : ''}${row.missing ? `; ${row.missing} files missing duration baseline (median projection)` : ''}`;
  });
  const total = plan.reduce((sum, row) => sum + row.seconds, 0);
  const sum = (tiers: Tier[]) => plan.filter(row => tiers.includes(row.tier)).reduce((n, row) => n + row.seconds, 0);
  lines.push(`tier share: T1+T2 ${total ? seconds(100 * sum(['T1', 'T2']) / total) : 'unavailable'} % of ${seconds(total)} s (T3 ${seconds(sum(['T3']))} s, T4 ${seconds(sum(['T4']))} s${sum(['Web']) ? `, Web ${seconds(sum(['Web']))} s` : ''})`);
  return lines;
}
