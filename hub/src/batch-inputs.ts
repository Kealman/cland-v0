import type { SuiteJob } from './hub/suites.ts';

export type BatchInputProof = Pick<SuiteJob, 'selection' | 'commands' | 'batchT1'>;

/** Narrow repository policy: T3 has no release-log reader. The source guard in
 * merge-batches.test.ts fences future T3/T4 site-source readers. Unknown plans
 * and T1 omitted using member receipts cannot borrow this exemption. */
export function unreadBatchReleaseLog(path: string, proof?: BatchInputProof): boolean {
  if (!path.startsWith('site/src/content/log/') || path.includes('/../') || path.includes('/./')) return false;
  if (proof?.selection?.tiers?.join(',') !== 'T3' || proof.batchT1?.skipped) return false;
  const commands = proof.commands;
  if (!commands?.plan || commands.prepare && commands.prepare !== 'node hub/bin/verify-prepare.ts') return false;
  if (commands.check && !['true', 'npm run check', 'npm run typecheck'].includes(commands.check)) return false;
  const runtime = commands.plan.filter(step => step.name !== 'check');
  return runtime.length === 1 && runtime[0]!.name === 'T3'
    && runtime[0]!.command === 'node hub/test/run-suite.ts --tier T3';
}

/** Deliberately conservative: split path construction also names the site root. */
export function namesSiteSource(source: string): boolean {
  return /site\/src/.test(source) || /["'`]site["'`]/.test(source) && /["'`]src["'`]/.test(source);
}
