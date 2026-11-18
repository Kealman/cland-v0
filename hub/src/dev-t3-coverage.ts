import type { SuiteJob } from './hub/suites.ts';
import { completeTierPlanReason } from './verification-tier-receipts.ts';

export const DEV_T3_BACKSTOP_MS = 24 * 60 * 60 * 1000;

/** Only positively completed full periodic execution advances the daily baseline. */
export function fullPeriodicDevT3Cover(job: SuiteJob): boolean {
  if (job.occasion !== 'dev-t3' || !job.integrated || job.branch !== 'dev' || job.mode !== 'all'
    || !job.tree || job.state !== 'finished' || !job.reported || !job.artifact
    || job.outcome?.code !== 0 || job.outcome.notRun || job.cached || job.cancelled || job.requesterDied
    || job.parentRun || job.batch || job.devT3Probe || job.webPhase || job.shards?.length
    || job.selection?.mode !== 'full' || job.selection.tests || job.selection.nvimTests || job.selection.shard
    || job.selection.web === 'none' || !job.selection.tiers?.includes('T2') || !job.selection.tiers.includes('T3')) return false;
  const plan = job.commands?.plan;
  return Boolean(plan && ['check', 'T2', 'T3', 'Web'].every(name => plan.some(step => step.name === name))
    && completeTierPlanReason(job) === null);
}

/** Candidate commits may be unrelated; the captured verification tree is identity. */
export function batchDevT3Cover(job: SuiteJob, tree: string): { batch: string; run: string } | null {
  if (!tree || job.tree !== tree || job.occasion !== 'batch' || !job.batch?.id || job.batch.diagnostic
    || job.parentRun || job.devT3Probe || job.mode !== 'all' || job.state !== 'finished'
    || !job.reported || !job.artifact || job.outcome?.code !== 0 || job.outcome.notRun
    || job.cached || job.cancelled || job.requesterDied || job.webPhase || job.shards?.length
    || job.selection?.mode !== 'full' || job.selection.tests || job.selection.nvimTests || job.selection.shard
    || !job.selection.tiers?.includes('T3')) return null;
  const plan = job.commands?.plan;
  if (!plan?.some(step => step.name === 'check') || !plan.some(step => step.name === 'T3') || completeTierPlanReason(job)) return null;
  const ranT1 = job.selection.tiers.includes('T1') && plan.some(step => step.name === 'T1');
  const decision = job.batchT1;
  const memberT1 = decision?.skipped && decision.members.length > 0
    && decision.members.length === job.batch.members.length
    && job.batch.members.every(member => decision.members.filter(proof => proof.item === member.item && proof.head === member.head && Boolean(proof.run)).length === 1);
  if (!ranT1 && !memberT1) return null;
  return { batch: job.batch.id, run: job.id };
}
