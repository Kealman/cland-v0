// Full suites are hub-owned jobs: the CLI only submits the run and exits.
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame, HubTimeout } from './socket-client.ts';
import { realClock, type Clock } from '../hub/clock.ts';
import { isVerifyOccasion, type VerificationQueue } from '../protocol.ts';

import { SUITE_USAGE } from './usage.ts';
export { SUITE_USAGE } from './usage.ts';

export async function runSuiteCommand(args: string[], cwd = process.cwd(), options: { clock?: Clock; env?: NodeJS.ProcessEnv; out?: (text: string) => void; err?: (text: string) => void } = {}): Promise<number> {
  const out = options.out ?? ((text: string) => { process.stdout.write(text); });
  const ask = (d: Parameters<typeof askHubFrame>[0], frame: Parameters<typeof askHubFrame>[1], timeoutMs = 3000) => askHubFrame(d, frame, timeoutMs, options.env ?? process.env, options.clock ?? realClock);
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    'dry-run': { type: 'boolean' }, diagnostics: { type: 'boolean' }, note: { type: 'string' }, workers: { type: 'string' }, size: { type: 'string' }, occasion: { type: 'string' }, executor: { type: 'string' }, report: { type: 'string' }, to: { type: 'string', multiple: true }, all: { type: 'boolean' }, fresh: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  const workers = values.workers === undefined ? undefined : Number(values.workers);
  if (workers !== undefined && (!/^[1-9][0-9]*$/.test(values.workers!) || !Number.isSafeInteger(workers))) throw new Error('--workers must be a positive integer');
  if (values.size !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(values.size)) throw new Error('--size must be a nonempty slug');
  if (values.executor !== undefined && values.executor !== 'local' && values.executor !== 'droplet') throw new Error('--executor must be local or droplet');
  if (values.occasion !== undefined && !isVerifyOccasion(values.occasion)) throw new Error('--occasion must be batch, dev-t3, stage, epic, release or soak (batch and dev-t3 are hub-owned)');
  if (values.help) { out(SUITE_USAGE); return 0; }
  if (values.diagnostics && !values['dry-run']) throw new Error('--diagnostics requires --dry-run');
  if (positionals[0] === 'classify') {
    if (positionals.length !== 3 || !positionals[1]?.trim() || positionals[2] !== 'load-flake' || !values.note?.trim() || values['dry-run'] !== undefined || values.diagnostics !== undefined || values.report !== undefined || values.to !== undefined || values.all !== undefined || values.fresh !== undefined || values.executor !== undefined || values.occasion !== undefined || values.workers !== undefined || values.size !== undefined) throw new Error(SUITE_USAGE.trim());
    const d = readDiscovery(hubDiscovery(cwd));
    if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
    const result = await ask(d, { type: 'suite.classify', suite: positionals[1], cause: 'load-flake', note: values.note }) as { id: string; cover: import('../protocol.ts').CoverRecord };
    out((values.json ? JSON.stringify(result) : `cover ${result.id}: ${result.cover.status} · ${result.cover.cause} (derived ${result.cover.derivedCause}); ${result.cover.classification!.note}`) + '\n');
    return 0;
  }
  if (values.note !== undefined) throw new Error('--note requires verify classify');
  if (positionals[0] === 'queue') {
    if (positionals.length !== 1 || values['dry-run'] !== undefined || values.diagnostics !== undefined || values.report !== undefined || values.to !== undefined || values.all !== undefined || values.fresh !== undefined || values.executor !== undefined || values.occasion !== undefined || values.workers !== undefined || values.size !== undefined) throw new Error(SUITE_USAGE.trim());
    const d = readDiscovery(hubDiscovery(cwd));
    if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
    const q = await ask(d, { type: 'suite.queue' }, 15000) as VerificationQueue;
    const duration = (ms: number | null) => ms === null ? 'unknown' : `${Math.ceil(ms / 1000)}s`;
    const lines = [...(q.batch ? [`batch ${q.batch.id}: ${q.batch.members.map(entry => entry.item).join(', ')} · tree ${q.batch.candidate?.tree ?? 'preparing'}${q.batch.failed ? ` · blocked: ${q.batch.failed}` : ''}`] : []), `local: ${q.localBlocked ? `blocked · ${q.localBlocked.reason}` : q.holder ? `${q.holder.kind === 'hand run' && q.holder.session !== 'human' ? 'hand run' : q.holder.session}${q.holder.occasion ? ` · occasion ${q.holder.occasion}` : ''} · pid ${q.holder.pid ?? 'unknown'} · ${q.holder.worktree ?? 'worktree unknown'} · since ${q.holder.since ?? 'unknown'} · ETA ${duration(q.holder.etaMs)}` : 'none'}`,
      `local fallback: ${q.localFallback ?? true}`,
      ...(q.remote ?? []).map(r => `remote ${q.remote?.length ?? 0}/${q.remoteBudget ?? 4}: ${r.session} · ${r.item ?? r.id} · droplet ${r.machine?.name ?? 'acquiring'} ${r.machine?.size ?? 'unknown'} ${r.machine?.region ?? 'unknown'}${r.occasion ? ` · occasion ${r.occasion}` : ''}${r.shard ? ` · ${r.shard}` : ''} · since ${r.since ?? 'unknown'} · ETA ${duration(r.etaMs)}`),
      ...q.waiters.map(w => `${w.position}. ${w.session} · ${w.item ?? w.id} · ${w.executor ?? 'local'} · ${w.mode}${w.occasion ? ` · occasion ${w.occasion}` : ''}${w.waitingFor === 'remote' ? ' · waiting for remote' : ''} · wait ${duration(w.waitMs)} · ETA ${duration(w.etaMs)}`),
      `last ${q.metrics.window} runs (${q.metrics.count} recorded): wait median ${duration(q.metrics.wait.medianMs)} / p90 ${duration(q.metrics.wait.p90Ms)}; run median ${duration(q.metrics.run.medianMs)} / p90 ${duration(q.metrics.run.p90Ms)}`];
    const wait = q.metrics.queueWait;
    if (wait) {
      lines.push(`queue wait target: p90 < ${duration(wait.targetP90Ms)}`);
      for (const [label, executors] of [['24h', wait.last24Hours], ['last 50', wait.last50Runs]] as const) {
        for (const executor of ['local', 'droplet'] as const) {
          const stats = executors[executor];
          lines.push(`${label} ${executor}: p50 ${duration(stats.p50Ms)} / p90 ${duration(stats.p90Ms)} · ${stats.count} samples · ${stats.cacheHits} cache hits`);
        }
      }
    }
    out((values.json ? JSON.stringify(q) : lines.join('\n')) + '\n');
    return 0;
  }
  if (positionals[0] === 'cancel') {
    if (positionals.length > 2 || values['dry-run'] !== undefined || values.diagnostics !== undefined || values.report !== undefined || values.to !== undefined || values.all !== undefined || values.fresh !== undefined || values.executor !== undefined || values.occasion !== undefined || values.workers !== undefined || values.size !== undefined) throw new Error(SUITE_USAGE.trim());
    const d = readDiscovery(hubDiscovery(cwd));
    if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
    const result = await ask(d, { type: 'suite.cancel', ...(positionals[1] ? { suite: positionals[1] } : {}) }, 15000) as { id: string; topic: string; cancelled: true };
    out((values.json ? JSON.stringify(result) : `suite ${result.id} cancellation requested; result in ${result.topic}`) + '\n');
    return 0;
  }
  const requested = positionals[0] ?? 'auto';
  if (positionals.length > 1 || !['auto', 'all', 'hub', 'nvim'].includes(requested) || (values.report !== undefined && !values.report.trim())) throw new Error(SUITE_USAGE.trim());
  const mode = values.all ? 'all' : requested;
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  // Materialize the default for running hubs whose prior validator requires report.
  const defaultReport = values.report === undefined && !values['dry-run'];
  const result = await ask(d, { type: 'suite.start', mode, cwd, dryRun: values['dry-run'] ?? false, ...(values.diagnostics ? { diagnostics: true } : {}), ...(workers !== undefined ? { workers } : {}), ...(values.size ? { size: values.size } : {}), ...(values.occasion ? { occasion: values.occasion } : {}), fresh: values.fresh ?? false, ...(values.executor ? { executor: values.executor } : {}), report: defaultReport ? 'agents' : values.report, ...(values.to ? { to: values.to } : defaultReport ? { to: ['coordinator'] } : {}) }, values.diagnostics ? 120_000 : 15_000).catch(error => {
    if (!(error instanceof HubTimeout) || !error.requestSent || values['dry-run']) throw error;
    const err = options.err ?? ((text: string) => { process.stderr.write(text); });
    err(`cland: submission sent; no reply within ${error.timeoutMs / 1000} s; check \`cland verify queue\` before resubmitting\n`);
    return null;
  }) as { id: string; pid: number | null; topic: string; position: number; reused?: true; cached?: import('../hub/suites.ts').SuiteJob['cached'] } | import('../suite-tier-report.ts').SuiteDryRun | null;
  // Like AdmissionTimeout, this temporary infrastructure outcome is not a failed run.
  if (result === null) return 75;
  if ('dryRun' in result) {
    out((values.json ? JSON.stringify(result) : `verification dry-run · head ${result.head} · ${result.executor} · ${result.workers} workers\n${result.lines.join('\n')}`) + '\n');
    return 0;
  }
  out((values.json ? JSON.stringify(result) : result.reused ? `already queued/running: ${result.id}; no new run` : `suite ${result.id}${result.cached ? ` cached from ${result.cached.run} at ${result.cached.head} tree ${result.cached.tree}; original occasion ${result.cached.occasion === undefined ? 'unknown' : result.cached.occasion ?? 'none'} executor ${result.cached.executor ?? 'unknown'};` : ' submitted;'} worker pid ${result.pid}; project queue position ${result.position}; result in ${result.topic}`) + '\n');
  return 0;
}
