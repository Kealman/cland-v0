import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';

export { MERGE_USAGE } from './usage.ts';
export async function runMerge(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' }, override: { type: 'string' } } });
  if (positionals.length !== 1) throw new Error(`usage: cland merge <T-id> [--override <reason>] [--json]`);
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'merge', item: positionals[0], ...(values.override === undefined ? {} : { override: values.override }) }, 60_000) as { item: string; commit: string; base: string; cleanup: string; followUp?: { error: string } };
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `${result.item}: merged ${result.commit} onto ${result.base}; ${result.followUp?.error ?? `worktree ${result.cleanup}`}\n`);
  return 0;
}
