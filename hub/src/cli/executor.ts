import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';

export { EXECUTOR_USAGE } from './usage.ts';
export async function runExecutor(args: string[], cwd = process.cwd()): Promise<number> {
  const json = args.includes('--json');
  const [sub, ...extra] = args.filter(a => a !== '--json');
  let report: string | undefined;
  const confirmRegisteredHubs = sub === 'retire-legacy' && extra[0] === '--confirm-registered-hubs';
  if (confirmRegisteredHubs) extra.shift();
  if (sub === 'prepare' && extra[0] === '--report' && extra.length === 2) report = extra.splice(0, 2)[1];
  if (extra.length || !['status', 'reap', 'prepare', 'retire-legacy'].includes(sub ?? '')) throw new Error('usage: cland executor status|reap|prepare|retire-legacy [--confirm-registered-hubs] [--report <topic>] [--json]');
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(discovery, { type: `executor.${sub}`, ...(report ? { report } : {}), ...(sub === 'retire-legacy' ? { confirmRegisteredHubs } : {}) }, sub === 'reap' || sub === 'retire-legacy' ? 300000 : 30000) as { summary: string };
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.summary}\n`);
  return 0;
}
