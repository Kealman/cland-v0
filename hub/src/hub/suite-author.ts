import type { SuiteJob } from './suites.ts';

/** Existing occasion facts also identify hub-owned runs restored from older records. */
export function suiteAuthor(job: Pick<SuiteJob, 'actor' | 'occasion' | 'batch' | 'devT3Probe'>): string {
  return job.actor?.name ?? (job.batch || job.devT3Probe || job.occasion === 'dev-t3' || job.occasion === 'soak' ? 'hub' : 'human');
}
