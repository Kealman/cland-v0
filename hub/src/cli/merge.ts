import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';

export const MERGE_USAGE = `  merge <T-id> [--json]   land one task as a squash commit on its task base (dev); Coordinator or human
    --override <reason>   the human's shell only: skip verdicts, record why; conflicts still refuse
`;
export async function runMerge(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' }, override: { type: 'string' } } });
  if (positionals.length !== 1) throw new Error(`usage: cland merge <T-id> [--override <reason>] [--json]`);
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'merge', item: positionals[0], ...(values.override === undefined ? {} : { override: values.override }) }, 60_000) as { item: string; commit: string; base: string; cleanup: string };
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `${result.item}: merged ${result.commit} onto ${result.base}; worktree ${result.cleanup}\n`);
  return 0;
}
