import type { VerificationQueue } from '../protocol.ts';
import type { ItemSummary } from '../tracker/tracker.ts';
import type { SuiteJob } from './suites.ts';
import type { Store } from './store.ts';
import type { DropletLease } from '../executor/droplet/lease.ts';
import { suiteAuthor } from './suite-author.ts';
import { blockedDevT3Searches } from './dev-t3-search.ts';

/** Build from committed hub facts at the firing; no tools, Git or network work on the clock. */
export function heartbeatDigest(store: Store, items: ItemSummary[], interval: number, now: number, idleMs: number, runTimeoutMs: number, queue?: VerificationQueue) {
  const flight: string[] = [], stale: string[] = [];
  const age = (since: number) => `${Math.max(0, Math.floor((now - since) / 1000))}s`;
  const statuses = ['in progress', 'review', 'qa', 'ready', 'planned', 'backlog', 'done'];
  const blockedSearches = blockedDevT3Searches(store);
  for (const blocked of blockedSearches.rows) {
    stale.push(`dev T3 search ${blocked.run} blocked · ${blocked.file} · attempts ${blocked.attempts} · age ${age(Date.parse(blocked.since))} · ${blocked.reason}`);
  }
  const blockedOmitted = blockedSearches.omitted === null ? 'older blocked files: unknown'
    : blockedSearches.omitted ? `${blockedSearches.omitted} older blocked files omitted` : '';
  const byStatus = (item: ItemSummary) => { const rank = statuses.indexOf(item.status ?? ''); return rank < 0 ? statuses.length : rank; };
  for (const item of items.slice().sort((a, b) => byStatus(a) - byStatus(b))) {
    if (item.state !== 'open') continue;
    if (item.claim) flight.push(`${item.id} ${item.status ?? item.state} · ${item.claim.session}`);
    const since = store.heartbeatItemSince(item.id, item.status ?? item.state, Date.parse(item.updated), now);
    if (now - since < interval) continue;
    if (item.status === 'ready') stale.push(`${item.id} ready, not merged · age ${age(since)}`);
    const requestSince = Math.max(since, ...item.verdicts.filter(v => v.verdict === 'review').map(v => Date.parse(v.at) + 1));
    if (item.status === 'review' && !item.verdicts.some(v => v.verdict === 'review' && v.current === true)
        && !store.pendingReview(item.id, requestSince)) {
      stale.push(`${item.id} review without a pending request or verdict at its head · age ${age(since)}`);
    }
  }
  for (const ask of store.openAsks()) {
    flight.push(`ask ${ask.id} · ${ask.topic} · ${ask.question}`);
    if (now - Date.parse(ask.ts) >= interval) stale.push(`ask ${ask.id} unanswered · age ${age(Date.parse(ask.ts))}`);
  }
  for (const session of store.knownSessions()) {
    const id = store.sessionIdOf(session.name);
    const state = id ? store.meta(`heartbeat-state:${id}`) : null;
    if (!state || idleMs <= 0) continue;
    const idle = JSON.parse(state) as { state: string; since: number };
    if (idle.state === 'idle' && now - idle.since >= idleMs) stale.push(`${session.name} idle · age ${age(idle.since)}`);
  }
  for (const run of [queue?.holder, ...(queue?.remote ?? []), ...(queue?.waiters ?? [])]) {
    if (run?.kind === 'hand run') flight.push(`run ${run.id ?? 'human'} ${'since' in run ? 'running' : 'queued'} · ${run.session ?? 'human'}`);
  }
  const jobs: SuiteJob[] = [...store.suiteJobSummaries().map(text => {
    const { position, job } = JSON.parse(text) as { position: number; job: SuiteJob };
    return { ...job, sequence: job.sequence ?? position };
  }), ...JSON.parse(store.meta('suite-jobs') ?? '[]')];
  const closed = new Set(items.filter(item => item.state === 'closed').map(item => item.id));
  const posted = new Map<string, number>();
  for (const job of jobs) {
    // Admission order survives cached execution timestamps and out-of-order completion.
    if (job.item && job.reported && job.outcome && job.sequence !== undefined) posted.set(job.item, Math.max(posted.get(job.item) ?? -1, job.sequence));
  }
  const leases = new Map<string, DropletLease>();
  for (const job of jobs) {
    if (job.reported) continue;
    if (!job.outcome && !job.reported) flight.push(`run ${job.id} ${job.state ?? 'running'} · ${suiteAuthor(job)}${job.item ? ` · ${job.item}` : ''}`);
    const started = Date.parse(job.started ?? job.admittedAt ?? '');
    if (!job.outcome && !job.reported && Number.isFinite(started) && now - started > runTimeoutMs) stale.push(`run ${job.id} past its timeout · age ${age(started)}`);
    const resolved = job.item && (closed.has(job.item) || job.sequence !== undefined && (posted.get(job.item) ?? -1) > job.sequence);
    if (job.outcome && !job.reported && !resolved) stale.push(`run ${job.id} ${job.reportFailure ? `report failed: ${job.reportFailure.error}${job.reportFailure.secondary ? `; secondary inspection error: ${job.reportFailure.secondary}` : ''}` : 'ended without a posted result'} · age ${age(Date.parse(job.finished ?? job.completedAt ?? job.started ?? job.queued ?? new Date(now).toISOString()))}`);
    const lease = job.lease as DropletLease | undefined;
    if (lease?.kind === 'droplet') leases.set(lease.lease, lease);
  }
  // Executor snapshots also include builder leases and machines no longer attached to a run.
  for (const lease of JSON.parse(store.meta('executor-leases') ?? '[]') as DropletLease[]) leases.set(lease.lease, lease);
  for (const lease of leases.values()) {
    if (lease.state !== 'released' && Date.parse(lease.deadline) > now) flight.push(`lease ${lease.name} · ${lease.state} · expires ${lease.deadline}`);
  }
  const section = (title: string, rows: string[], count = String(rows.length), empty = 'none') => `${title} (${count})\n${rows.slice(0, 10).map(row => `- ${row.replace(/[\r\n]+/g, ' ')}`).join('\n') || `- ${empty}`}${rows.length > 10 ? `\n- and ${rows.length - 10} more` : ''}`;
  const knownStale = stale.length + (blockedSearches.omitted ?? 0);
  // The numeric field remains compatible; incomplete totals explicitly carry
  // a lower-bound disposition through every notice/log consumer.
  const counts = { inFlight: flight.length, stale: Math.min(Number.MAX_SAFE_INTEGER, knownStale),
    staleComplete: blockedSearches.omitted !== null && Number.isSafeInteger(knownStale) };
  const staleLabel = counts.staleComplete ? String(counts.stale) : `at least ${counts.stale}; total unknown`;
  const soak = store.meta('soak-coverage');
  const retention = store.meta('suite-retention-progress');
  const progress = retention ? JSON.parse(retention) as {passes:number;at:string;backlog:number;removed:number;unindexed:{scanned:number;removed:number;continuing:boolean}} : null;
  const retentionText = progress ? `\n\nSuite retention\n${progress.passes} passes by last scheduler owner; last ${progress.at}; indexed backlog ${progress.backlog} (includes protected runs), removed ${progress.removed}; last directory pass scanned ${progress.unindexed.scanned}, removed ${progress.unindexed.removed}, discovery ${progress.unindexed.continuing?'continuing':'complete'}` : '';
  return { text: `${section('In flight', flight)}\n\n${section('Stale', stale, staleLabel, counts.staleComplete ? 'none' : 'none observed')}${blockedOmitted ? `\n${blockedOmitted}` : ''}${soak ? `\n\nSoak coverage\n${soak}` : ''}${retentionText}`, ...counts, counts, staleLabel };
}
