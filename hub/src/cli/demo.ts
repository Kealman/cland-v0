import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';

export async function runDemo(args: string[], cwd = process.cwd()): Promise<number> {
  const [sub, epic, ...rest] = args;
  if (!['start', 'exec', 'stop', 'status'].includes(sub ?? '') || !epic) throw new Error('usage: cland demo start|exec|stop|status <epic> [--commit <sha>] [--json] | exec <epic> -- <command…>');
  const json = sub !== 'exec' && rest.includes('--json');
  const flags = rest.filter(a => a !== '--json');
  let commit: string | undefined;
  if ((sub === 'start' || sub === 'status') && flags.length === 2 && flags[0] === '--commit') commit = flags.splice(0, 2)[1];
  if (sub === 'exec' ? rest[0] !== '--' || rest.length < 2 : flags.length) throw new Error('invalid demo arguments');
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(discovery, { type: `demo.${sub}`, epic, ...(commit ? { commit } : {}), ...(sub === 'exec' ? { command: rest.slice(1) } : {}) }, 86400000) as { summary: string; stdout?: string; stderr?: string; code?: number };
  if (sub === 'exec') { process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); return result.code ?? 1; }
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.summary}\n`);
  return 0;
}
