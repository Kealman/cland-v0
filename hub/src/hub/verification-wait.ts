import { realClock, type Clock } from './clock.ts';
// Queue wait uses durable admission facts, independently of run-time recovery estimates.
import type { QueueWaitMetrics, QueueWaitStats } from '../protocol.ts';
import type { SuiteJob } from './suites.ts';
import type { Store } from './store.ts';
import type { LogFn } from '../log.ts';

type WaitRun = Pick<SuiteJob, 'executor' | 'queued' | 'admittedAt' | 'completedAt' | 'finished' | 'cached' | 'parentRun'>;
const HOUR = 3_600_000;

export function queueWaitMetrics(jobs: readonly WaitRun[], now: number, targetP90Ms: number): QueueWaitMetrics {
  const completed = jobs.map((job, index) => ({ job, index,
    // A cache hit borrows the source finish for expiry, not its own completion window.
    at: Date.parse((job.cached ? job.completedAt : job.finished ?? job.completedAt) ?? ''),
  })).filter(({ job, at }) => !job.parentRun && Number.isFinite(at) && at <= now)
    .sort((a, b) => b.at - a.at || b.index - a.index);
  const stats = (runs: typeof completed): QueueWaitStats => {
    const waits = runs.flatMap(({ job, at }) => {
      if (job.cached) return [];
      const queued = Date.parse(job.queued ?? ''), admitted = Date.parse(job.admittedAt ?? '');
      return Number.isFinite(queued) && Number.isFinite(admitted) && admitted >= queued && admitted <= at ? [admitted - queued] : [];
    }).sort((a, b) => a - b);
    const n = waits.length;
    return { count: n, cacheHits: runs.filter(({ job }) => job.cached).length,
      p50Ms: n ? n % 2 ? waits[Math.floor(n / 2)]! : (waits[n / 2 - 1]! + waits[n / 2]!) / 2 : null,
      p90Ms: n ? waits[Math.ceil(n * 0.9) - 1]! : null };
  };
  const window = (executor: 'local' | 'droplet', hours: boolean) => {
    const runs = completed.filter(({ job }) => job.executor === executor);
    return stats(hours ? runs.filter(({ at }) => at >= now - 24 * HOUR) : runs.slice(0, 50));
  };
  return { targetP90Ms,
    last24Hours: { local: window('local', true), droplet: window('droplet', true) },
    last50Runs: { local: window('local', false), droplet: window('droplet', false) } };
}

/** The scheduler owns the clock; a durable UTC-hour checkpoint survives hub restarts. */
export class VerificationWait {
  readonly #clock: Clock;
  readonly #store: Store;
  readonly #jobs: readonly WaitRun[];
  #targetP90Ms: number;
  readonly #log: LogFn | undefined;
  #hour: number;
  constructor(store: Store, jobs: readonly WaitRun[], targetP90Ms = 1_200_000, log?: LogFn, clock: Clock = realClock) {
    this.#clock = clock;
    this.#store = store; this.#jobs = jobs; this.#targetP90Ms = targetP90Ms; this.#log = log;
    this.#hour = Number(store.meta('verification-wait-hour') ?? -1);
  }
  configure(targetP90Ms: number): void { this.#targetP90Ms = targetP90Ms; }
  snapshot(now = this.#clock.now().getTime()): QueueWaitMetrics { return queueWaitMetrics(this.#jobs, now, this.#targetP90Ms); }
  record(now = this.#clock.now().getTime()): void {
    const hour = Math.floor(now / HOUR);
    if (!this.#log || hour <= this.#hour) return;
    this.#log({ event: 'verification-wait', at: new Date(now).toISOString(), ...this.snapshot(now) });
    this.#hour = hour;
    this.#store.setMeta('verification-wait-hour', String(hour));
  }
}
