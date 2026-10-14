import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { PushResult } from '../territory-push.ts';
import { askHubFrame } from './socket-client.ts';

export { PUSH_USAGE } from './usage.ts';
export async function runPush(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } });
  if (positionals.length) throw new Error('usage: cland push [--json]');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  let result: PushResult;
  try { result = await askHubFrame(d, { type: 'push' }, 120_000) as PushResult; }
  catch (err) {
    if (err instanceof Error && err.message.startsWith('push-outcome-unknown:')) {
      process.stderr.write(`cland: ${err.message}\n`);
      return 2; // unknown publication is distinct from a verified refusal (1)
    }
    throw err;
  }
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `Pushed dev ${result.dev}\n${result.followUp ? `${result.followUp.error}\n` : ''}`);
  return 0;
}
