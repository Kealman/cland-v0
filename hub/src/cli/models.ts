import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { ModelsAnswer } from '../models.ts';
import { MODELS_USAGE } from './usage.ts';

export async function runModels(args: string[], cwd = process.cwd()): Promise<number> {
  const harness = args[0];
  let account: string | undefined;
  let refresh = false;
  let json = false;
  const usage = () => new Error(`usage: cland ${MODELS_USAGE.trim()}`);
  if (!harness || !['claude-code', 'codex', 'opencode'].includes(harness)) throw usage();
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--refresh') refresh = true;
    else if (arg === '--json') json = true;
    else if (arg === '--account' && !account && args[i + 1] && !args[i + 1]!.startsWith('-')) account = args[++i];
    else throw usage();
  }
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const { cached, ...result } = await askHubFrame(discovery, { type: 'models.list', harness, ...(account ? { account } : {}), refresh }, 15_000) as ModelsAnswer;
  if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(result.probedAt)) / 60_000));
    const age = cached ? `cached ${minutes >= 60 ? `${Math.floor(minutes / 60)} h` : `${minutes} min`} ago` : 'probed now';
    process.stdout.write(result.models.map(m => `${m.id}${m.default ? ' (default)' : ''}`).join('\n') + `\n${result.source} · ${age}\n`);
  }
  return 0;
}
