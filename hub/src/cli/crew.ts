import { parse } from 'smol-toml';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { renderCrew, type CrewConfig } from '../crew.ts';
import { askHubFrame } from './socket-client.ts';

export { CREW_USAGE } from './usage.ts';
type Io = { out: (text: string) => void };
const stdio: Io = { out: text => { process.stdout.write(text); } };

export async function runCrew(args: string[], cwd = process.cwd(), io: Io = stdio, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const json = args.includes('--json');
  const [sub, key, input, ...extra] = args.filter(a => a !== '--json');
  if (extra.length || (sub !== 'show' && sub !== 'set') || (sub === 'show' && key !== undefined) || (sub === 'set' && (!key || input === undefined))) throw new Error('usage: cland crew show | set <role>.<key>|leads|idle_from <value> [--json]');
  const discovery = readDiscovery(hubDiscovery(cwd, env));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  let value: unknown;
  if (sub === 'set') {
    // Lists, booleans and integers use TOML syntax; names and a single idle id may be bare.
    try { value = (parse(`value = ${input}`) as Record<string, unknown>).value; }
    catch { value = input; }
    if (key === 'idle_from' && typeof value === 'string') value = [value];
  }
  const result = await askHubFrame(discovery, sub === 'show' ? { type: 'crew.show' } : { type: 'crew.set', key, value }, 3000, env) as { config: CrewConfig; summary: string };
  io.out(json ? `${JSON.stringify(result)}\n` : `${result.summary}\n\n${renderCrew(result.config)}`);
  return 0;
}
