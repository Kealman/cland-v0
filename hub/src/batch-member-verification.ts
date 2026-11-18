import type { SuiteJob } from './hub/suites.ts';
import type { MergeQueueEntry } from './protocol.ts';
import { parseTierReceipts } from './verification-tier-receipts.ts';
import { verificationInterrupted } from './verification-plan.ts';

export type BatchT1 = { skipped: boolean; members: Array<{ item: string; head: string; run: string; sourceRun?: string }>; reason?: string };

/** Exact identity belongs to the member request; cached content proof belongs to its source. */
export function memberVerificationReason(member: Pick<MergeQueueEntry, 'item' | 'head' | 'branch'>, job: SuiteJob, source?: SuiteJob): string | null {
  if (job.head !== member.head) return 'verify head differs from pinned head';
  if (job.item !== member.item || job.branch !== member.branch || job.mode !== 'auto' || job.integrated || job.occasion || job.batch || job.parentRun || job.devT3Probe) return 'not a mode-free member verify';
  const green = (run: SuiteJob) => run.reported && run.artifact && run.tree && run.outcome?.code === 0 && !run.outcome.notRun && !run.cancelled && !run.requesterDied && !run.webPhase;
  if (!green(job)) return 'no complete green receipt';
  const proof = job.cached ? source : job;
  if (!proof || !green(proof) || proof.cached || proof.tree !== job.tree
    || job.cached && (job.cached.run !== proof.id || job.cached.tree !== proof.tree)) return 'cache source receipt does not match';
  const plan = proof.commands?.plan;
  if (!plan || !['check', 'T1', 'T2'].every(name => plan.some(step => step.name === name))
    || !proof.selection?.tiers?.includes('T1') || !proof.selection.tiers.includes('T2') || proof.selection.shard) return 'receipt does not cover T0–T2';
  const rows = parseTierReceipts(proof.tierReceipts);
  if (!rows || rows.some(row => row.run !== proof.id || row.tree !== proof.tree)) return 'missing producer tier receipts';
  const key = (row: typeof rows[number]) => JSON.stringify([row.tier, row.run, row.tree, row.command]);
  for (const [index, row] of rows.entries()) {
    if (row.completion === 'complete' && row.exit === 0) continue;
    if (row.exit !== null && verificationInterrupted(row.exit) && rows.slice(index + 1).some(later => key(later) === key(row) && later.exit === 0 && later.completion === 'complete')) continue;
    return 'failed or incomplete producer tier receipt';
  }
  if (plan.some(step => !rows.some(row => row.tier === (step.name === 'check' ? 'T0' : step.name)
    && row.command === step.command && row.exit === 0 && row.completion === 'complete'))) return 'missing complete passing step receipt';
  return null;
}

export function batchT1Summary(decision?: BatchT1): string {
  if (!decision) return 'T1 policy unavailable (legacy receipt)';
  return decision.skipped ? `T1 skipped; member verifies ${decision.members.map(member => `${member.item} run ${member.run} head ${member.head}${member.sourceRun ? ` receipt ${member.sourceRun}` : ''}`).join(', ')}`
    : `T1 retained: ${decision.reason ?? 'member receipt unavailable'}`;
}
