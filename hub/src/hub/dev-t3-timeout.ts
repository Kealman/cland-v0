import type { SuiteJob } from './suites.ts';
import { failingTests } from './shared-defects.ts';
import { suiteProgress } from '../suite-progress.ts';
import { incompleteTierSteps } from '../verification-tier-receipts.ts';

/** Native deadline receipts establish capacity exhaustion; positive failures win. */
export function periodicCapacityTimeout(job: Readonly<SuiteJob>, log: string): boolean {
  const sources = job.shards ?? [job];
  const text = log.replace(/\x1b\[[0-9;]*m/g, '').replace(/ \[shard-\d+\]$/gm, '');
  return job.occasion === 'dev-t3' && !job.cancelled && !job.requesterDied && !job.outcome?.notRun
    && job.outcome?.code !== 0
    && sources.some(source => source.timedOut === true)
    && !sources.some(source => source.outcome && source.outcome.code !== 0 && !source.timedOut && source !== job)
    && !sources.some(source => source.tierReceipts?.some(row => row.exit !== null && row.exit !== 0 && row.exit !== 124 && row.exit !== 143))
    && failingTests(text).length === 0
    && !suiteProgress(text, 0)?.completed.some(row => row.outcome === 'fail');
}

/** Missing or interrupted receipts remain unexecuted/incomplete, including old producers. */
export function periodicMissingTiers(job: Readonly<SuiteJob>): string[] {
  return [...new Set((job.shards ?? [job]).flatMap(source => {
    const plan = source.commands?.plan;
    if (!plan) return [...(source.selection?.tiers ?? ['T2', 'T3']), ...(source.selection?.web === 'none' ? [] : ['Web'])];
    return incompleteTierSteps(source).map(step => step.name === 'check' ? 'T0' : step.name);
  }))];
}
