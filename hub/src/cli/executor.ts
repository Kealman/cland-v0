import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';

export const EXECUTOR_USAGE = `  executor status [--json]  token presence, live droplet leases and today's cost
  executor reap [--json]    delete orphaned and expired cland droplets
`;
export async function runExecutor(args: string[], cwd = process.cwd()): Promise<number> {
  const json = args.includes('--json');
  const [sub, ...extra] = args.filter(a => a !== '--json');
  if (extra.length || (sub !== 'status' && sub !== 'reap')) throw new Error('usage: cland executor status|reap [--json]');
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(discovery, { type: sub === 'status' ? 'executor.status' : 'executor.reap' }, sub === 'status' ? 30000 : 300000) as { summary: string };
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.summary}\n`);
  return 0;
}
