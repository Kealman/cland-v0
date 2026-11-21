import type { SuiteJob } from './hub/suites.ts';
import { completeTierPlanReason, terminalTierPlanReason } from './verification-tier-receipts.ts';
import { verificationInterrupted } from './verification-plan.ts';

/** A parent cannot borrow a partial group's exit or coverage. Legacy groups fail closed. */
export function batchShardReceiptReason(job: SuiteJob, allowFailure = false): string | null {
  const shards = job.shards;
  if (!shards || !job.plannedShards || job.plannedShards < 2 || shards.length !== job.plannedShards
    || new Set(shards.map(shard => shard.id)).size !== shards.length) return 'missing planned shard receipts';
  for (const shard of shards) {
    if (shard.parentRun !== job.id || shard.tree !== job.tree || shard.head !== job.head
      || !shard.reported || shard.state !== 'finished' || !shard.outcome || !Number.isInteger(shard.outcome.code)
      || (allowFailure ? verificationInterrupted(shard.outcome.code) : shard.outcome.code !== 0) || shard.outcome.notRun
      || shard.cancelled || shard.requesterDied || shard.timedOut || shard.webPhase
      || (allowFailure ? terminalTierPlanReason(shard) : completeTierPlanReason(shard))) return 'failed or incomplete shard receipt';
    if (job.commands?.plan?.some(step => (step.name !== 'Web' || shard.selection?.shard?.nvim)
      && !shard.commands?.plan?.some(actual => actual.name === step.name && actual.command === step.command))) return 'missing shard command';
  }
  const planned = job.tierPlan?.flatMap(row => row.files).sort();
  const executed = shards.flatMap(shard => shard.tierPlan?.flatMap(row => row.files) ?? []).sort();
  if (!planned?.length || JSON.stringify(planned) !== JSON.stringify(executed)) return 'incomplete shard file coverage';
  return null;
}
