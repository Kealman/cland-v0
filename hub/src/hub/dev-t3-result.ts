import type { SuiteJob } from './suites.ts';
import type { Git } from '../tracker/verdict-git.ts';
import { failingTests } from './shared-defects.ts';
import { deriveCover } from './suite-cover.ts';

export type DevT3Result = {
  event: 'verification-dev-t3-result'; run: string; head: string; tree: string | null;
  previousGreenHead: string | null; previousGreenRun: string | null;
  merges: Array<{ head: string; subject: string }> | null;
  result: 'green' | 'red' | 'not-run'; notRun?: 'infrastructure' | 'provider-capacity'; cause?: string;
  failingFiles: string[]; budgetIdentities?: string[]; artifact: string; path: string;
  durationWarnings?: string[];
};

/** Stable diagnosis input for the periodic-run culprit search (T-887).
 * A null merge list means Git could not establish the range, never an empty range.
 */
export async function devT3Result(job: Readonly<SuiteJob>, log: string, artifact: { id: string; path: string }, git: Git): Promise<DevT3Result> {
  const cover = deriveCover(job, log);
  const previousGreenHead = job.devT3?.previousGreenHead ?? null;
  const range = previousGreenHead ? await git(['log', '--first-parent', '--reverse', '--format=%H%x00%s', `${previousGreenHead}..${job.head}`, '--']).catch(() => null) : null;
  const merges = range === null ? null : range.split('\n').filter(Boolean).map(line => {
    const [head, ...subject] = line.split('\0');
    return { head: head!, subject: subject.join('\0') };
  });
  return { event: 'verification-dev-t3-result', run: job.id, head: job.head, tree: job.tree ?? null,
    previousGreenHead, previousGreenRun: job.devT3?.previousGreenRun ?? null, merges,
    result: job.outcome?.notRun ? 'not-run' : job.outcome?.code === 0 && !job.cancelled && !job.requesterDied ? 'green' : 'red',
    ...(job.outcome?.notRun ? { notRun: job.outcome.notRun, cause: job.outcome.cause } : {}),
    failingFiles: job.outcome?.notRun ? [] : [...new Set(failingTests(log).map(identity => identity.split('::')[0]!))].sort(),
    ...(cover?.cause === 'budget' ? { budgetIdentities: cover.tests } : {}),
    artifact: artifact.id, path: artifact.path };
}
