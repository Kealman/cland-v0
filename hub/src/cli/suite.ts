// Full suites are hub-owned jobs: the CLI only submits the run and exits.
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { VerificationQueue } from '../protocol.ts';

export const SUITE_USAGE = `  verify [all|hub|nvim] [--all] [--fresh] [--executor local|droplet] --report <topic|session> [--to <session>] [--json]
  suite           alias for verify\n                  run typecheck and the package suite detached; post one artifact-backed result
  verify cancel [<suite id>] [--json]
                  cancel your active suite (human: any explicit id); post its cancelled result
  verify queue [--json]
                  show holder, ordered waiters, waits, admission ETA and recent timing metrics
`;

export async function runSuiteCommand(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    executor: { type: 'string' }, report: { type: 'string' }, to: { type: 'string', multiple: true }, all: { type: 'boolean' }, fresh: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.executor !== undefined && values.executor !== 'local' && values.executor !== 'droplet') throw new Error('--executor must be local or droplet');
  if (values.help) { process.stdout.write(SUITE_USAGE); return 0; }
  if (positionals[0] === 'queue') {
    if (positionals.length !== 1 || values.report !== undefined || values.to !== undefined || values.all !== undefined || values.fresh !== undefined || values.executor !== undefined) throw new Error(SUITE_USAGE.trim());
    const d = readDiscovery(hubDiscovery(cwd));
    if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
    const q = await askHubFrame(d, { type: 'suite.queue' }, 15000) as VerificationQueue;
    const duration = (ms: number | null) => ms === null ? 'unknown' : `${Math.ceil(ms / 1000)}s`;
    const lines = [`holder: ${q.holder ? `${q.holder.kind === 'hand run' && q.holder.session !== 'human' ? 'hand run' : q.holder.session} · pid ${q.holder.pid ?? 'unknown'} · ${q.holder.worktree ?? 'worktree unknown'} · since ${q.holder.since ?? 'unknown'} · ETA ${duration(q.holder.etaMs)}` : 'none'}`,
      ...q.waiters.map(w => `${w.position}. ${w.session} · ${w.item ?? w.id} · ${w.mode} · wait ${duration(w.waitMs)} · ETA ${duration(w.etaMs)}`),
      `last ${q.metrics.window} runs (${q.metrics.count} recorded): wait median ${duration(q.metrics.wait.medianMs)} / p90 ${duration(q.metrics.wait.p90Ms)}; run median ${duration(q.metrics.run.medianMs)} / p90 ${duration(q.metrics.run.p90Ms)}`];
    process.stdout.write((values.json ? JSON.stringify(q) : lines.join('\n')) + '\n');
    return 0;
  }
  if (positionals[0] === 'cancel') {
    if (positionals.length > 2 || values.report !== undefined || values.to !== undefined || values.all !== undefined || values.fresh !== undefined || values.executor !== undefined) throw new Error(SUITE_USAGE.trim());
    const d = readDiscovery(hubDiscovery(cwd));
    if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
    const result = await askHubFrame(d, { type: 'suite.cancel', ...(positionals[1] ? { suite: positionals[1] } : {}) }, 15000) as { id: string; topic: string; cancelled: true };
    process.stdout.write((values.json ? JSON.stringify(result) : `suite ${result.id} cancellation requested; result in ${result.topic}`) + '\n');
    return 0;
  }
  const requested = positionals[0] ?? 'auto';
  if (positionals.length > 1 || !['auto', 'all', 'hub', 'nvim'].includes(requested) || !values.report?.trim()) throw new Error(SUITE_USAGE.trim());
  const mode = values.all ? 'all' : requested;
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'suite.start', mode, cwd, fresh: values.fresh ?? false, ...(values.executor ? { executor: values.executor } : {}), report: values.report, ...(values.to ? { to: values.to } : {}) }, 15000) as { id: string; pid: number | null; topic: string; position: number; cached?: { run: string; head: string; tree: string } };
  process.stdout.write((values.json ? JSON.stringify(result) : `suite ${result.id}${result.cached ? ` cached from ${result.cached.run} at ${result.cached.head} tree ${result.cached.tree};` : ' submitted;'} worker pid ${result.pid}; project queue position ${result.position}; result in ${result.topic}`) + '\n');
  return 0;
}
