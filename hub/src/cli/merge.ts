import { dependencyInstallText } from '../dependency-install.ts';
import type { DependencyInstall } from '../protocol.ts';
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { MergeBatchStatus, MergeQueueEntry } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';
import { MERGE_USAGE } from './usage.ts';

export { MERGE_USAGE } from './usage.ts';
export async function runMerge(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' }, override: { type: 'string' }, cancel: { type: 'boolean' } } });
  if (values.help) { process.stdout.write(MERGE_USAGE); return 0; }
  if (positionals.length !== 1) throw new Error('usage: cland merge <T-id> [--override <reason> | --cancel] [--json], or cland merge queue [--json]');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  if (positionals[0] === 'queue') {
    if (values.override !== undefined || values.cancel) throw new Error('merge queue accepts only --json');
    const result = await askHubFrame(d, { type: 'merge.queue' }) as { entries: MergeQueueEntry[]; batch?: MergeBatchStatus | null };
    const batch = result.batch ? `batch ${result.batch.id}: ${result.batch.members.map(entry => entry.item).join(', ')} · tree ${result.batch.candidate?.tree ?? 'preparing'}${result.batch.failed ? ` · blocked: ${result.batch.failed}` : ''}\n` : '';
    process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : batch + (result.entries.length
      ? result.entries.map((entry, index) => `${index + 1} ${entry.item} ${entry.branch} ${entry.head} since ${entry.enqueued} by ${entry.by.name}${entry.dependencies ? `\n  ${dependencyInstallText(entry.dependencies)}` : ''}\n`).join('') : 'merge queue empty\n'));
    return 0;
  }
  const result = await askHubFrame(d, { type: 'merge', item: positionals[0], ...(values.override === undefined ? {} : { override: values.override }), ...(values.cancel ? { cancel: true } : {}) }, 60_000) as { dependencies?: DependencyInstall; item: string; queued?: number; cancelled?: boolean; commit?: string; base?: string; cleanup?: string; budgetLines?: string[]; followUp?: { error: string } };
  const text = result.queued !== undefined ? `queued ${result.queued}` : result.cancelled !== undefined ? result.cancelled ? 'cancelled' : 'not queued' : `merged ${result.commit} onto ${result.base}; ${result.followUp?.error ?? `worktree ${result.cleanup}`}`;
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `${result.item}: ${text}\n`);
  if (!values.json && result.dependencies) process.stdout.write(dependencyInstallText(result.dependencies) + '\n');
  if (!values.json) for (const line of result.budgetLines ?? []) process.stdout.write(line + '\n');
  return 0;
}
