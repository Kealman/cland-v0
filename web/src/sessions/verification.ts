import type { VerificationHolder, VerificationQueue } from '../../../shared/wire/index.ts';

/** The read-only subset consumed from executor.status. No provider operations. */
export type ExecutorStatus = { spend: { spent: number; cap: number } };
export type QueueRow = { slot: string; session: string; item: string; detail: string; since: string; time: string; eta: string };

// Match Neovim's duration and estimate semantics, including unknown values.
function duration(ms: number | null | undefined): string {
  if (ms == null) return '?';
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
}
const eta = (ms: number | null | undefined) => ms == null ? '?' : `~${duration(ms)}`;
const name = (holder: VerificationHolder) => holder.kind === 'hand run' && holder.session !== 'human' ? 'hand run' : holder.session ?? 'human';

/** Pure presentation: elapsed is time since receipt, never the hub's wall clock. */
export function verificationModel(queue: VerificationQueue | null | undefined, elapsed: number, executor?: ExecutorStatus | null) {
  const age = (ms: number | null) => duration(ms == null ? null : ms + Math.max(0, elapsed));
  const running = (holder: VerificationHolder, slot: string): QueueRow => ({
    slot, session: name(holder), item: holder.item ?? '—',
    detail: [holder.occasion ?? holder.mode ?? 'mode unknown', ...(holder.shard ? [holder.shard] : []),
      ...(holder.executor === 'droplet' ? [`droplet ${holder.machine?.name ?? 'acquiring'} · ${holder.machine?.size ?? 'unknown'} · ${holder.machine?.region ?? 'unknown'}`]
        : [`pid ${holder.pid ?? 'unknown'}`, holder.worktree ?? 'unknown worktree'])].join(' · '),
    since: holder.since ?? 'unknown', time: age(holder.runMs), eta: eta(holder.etaMs),
  });
  const holder = queue?.holder;
  const remote = queue?.remote ?? [];
  const waiters = queue?.waiters ?? [];
  const remoteBudget = queue?.remoteBudget ?? '?';
  let summary = `verify: ${!queue ? '—' : holder ? `${name(holder)} ${age(holder.runMs)}` : !remote.length && !waiters.length ? 'idle' : 'free'}`;
  if (queue) summary += ` · remote ${remote.length}/${remoteBudget}`;
  if (waiters.length) summary += ` · ${waiters.length} waiting`;
  const remoteEstimates = remote.flatMap(row => row.etaMs == null ? [] : [row.etaMs]);
  const next = waiters.length ? waiters[0]!.etaMs : holder ? holder.etaMs : remoteEstimates.length ? Math.min(...remoteEstimates) : null;
  if (holder || waiters.length || remote.length) summary += ` · next ${eta(next)}`;
  const metrics = queue?.metrics;
  return {
    summary,
    local: holder ? running(holder, 'local 1/1') : null,
    remote: remote.map((row, index) => running(row, `remote ${index + 1}/${remoteBudget}`)),
    waiters: waiters.map(row => ({ slot: `waiting ${row.position}`, session: row.session, item: row.item ?? '—',
      detail: `${row.occasion ?? row.mode} · executor ${row.executor ?? 'unknown'} · ${row.worktree}`, since: row.queuedAt ?? 'unknown', time: age(row.waitMs), eta: eta(row.etaMs) })),
    metrics: metrics ? `last ${metrics.count}/${metrics.window} runs · run median ${duration(metrics.run.medianMs)}, p90 ${duration(metrics.run.p90Ms)} · wait median ${duration(metrics.wait.medianMs)}, p90 ${duration(metrics.wait.p90Ms)}` : 'last 20 runs · —',
    spend: executor ? `droplets today $${executor.spend.spent.toFixed(2)} of the $${executor.spend.cap.toFixed(2)} cap` : 'droplets today —',
  };
}
