import type { CoverRecord, CoverStatus } from '../protocol.ts';
import type { SuiteJob } from './suites.ts';
import { failingTests } from './shared-defects.ts';

/** Outcome-derived incident data; separate from the executor's process receipt. */
export function deriveCover(job: Readonly<SuiteJob>, log: string): CoverRecord | undefined {
  if (!job.integrated || job.parentRun || !job.outcome || job.outcome.notRun) return undefined;
  // Close-run collection labels receipts after their reporter terminator.
  const text = log.replace(/\x1b\[[0-9;]*m/g, '').replace(/ \[shard-\d+\]$/gm, '');
  const failed = failingTests(text);
  const budgets = [...text.matchAll(/^duration budget: (.+) [\d.]+ s > [\d.]+ s(?: \((?:T[1-4]|Web)\))?(?: \(add to .+ with a reason\))?$/gm)].map(match => match[1]!);
  const hasFailure = failed.length > 0 || /^(?:\s*not ok \d+|✖ (?!failing tests:)|(?:#|ℹ) fail [1-9])/m.test(text);
  if (/^cancelled: (?:queued head changed|submitted head |candidate tree changed)/.test(job.outcome.cause)) return { status: 'cancelled', cause: 'cancel-head', tests: failed };
  if (job.cancelled || job.requesterDied) return { status: 'cancelled', cause: 'cancel-requester', tests: failed };
  if (job.outcome.code === 0) return { status: 'green', cause: null, tests: [] };
  if (job.timedOut || job.outcome.code === 124 || /(?:^|: )(?:run timeout |stalled: no output for )/.test(job.outcome.cause)
    || /failureType: ['"]testTimeoutFailure['"]/.test(text)) return { status: 'red', cause: 'timeout', tests: failed };
  return { status: 'red', cause: budgets.length && !hasFailure ? 'budget' : 'test-failure', tests: [...new Set([...failed, ...budgets])] };
}

export function classifyCover(job: Readonly<SuiteJob>, cause: string, note: string, by: string, at = new Date().toISOString()): CoverRecord {
  if (cause !== 'load-flake') throw new Error('cover classification must be load-flake');
  if (!note.trim()) throw new Error('cover classification requires a nonblank note');
  if (!job.integrated || job.parentRun || job.state !== 'finished' || job.cover?.status !== 'red') throw new Error('only a finished red integrated cover can be classified');
  return { ...job.cover, derivedCause: job.cover.derivedCause ?? job.cover.cause, cause,
    classification: { note: note.trim(), by, at } };
}

export function recentCovers(jobs: readonly SuiteJob[]): CoverStatus[] {
  return jobs.filter(job => job.integrated && !job.parentRun && job.state === 'finished' && job.cover)
    .sort((a, b) => (b.completedAt ?? b.finished ?? '').localeCompare(a.completedAt ?? a.finished ?? ''))
    .slice(0, 10).map(job => ({ id: job.id, head: job.head, branch: job.branch,
      completedAt: job.completedAt ?? job.finished ?? null, cover: job.cover! }));
}
