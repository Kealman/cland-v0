import { parse } from 'smol-toml';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { ConfigSetResult } from '../hub/configuration.ts';
import { defaultConfig, renderConfig } from '../init/config.ts';

export async function runConfig(args: string[], cwd = process.cwd()): Promise<number> {
  const json = args.includes('--json');
  const [sub, key, input, ...extra] = args.filter(a => a !== '--json');
  if (sub !== 'set' || !key || input === undefined || extra.length) throw new Error('usage: cland config set <section.key> <value> [--json]');
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const templateValue = key.split('.').reduce<unknown>((table, part) =>
    table && typeof table === 'object' ? Reflect.get(table, part) : undefined, parse(renderConfig(defaultConfig(''))));
  // A string key takes argv literally, even when it looks like a TOML value.
  let value: unknown = input;
  if (typeof templateValue !== 'string') {
    try { value = (parse(`value = ${input}`) as Record<string, unknown>).value; }
    catch { /* Non-TOML input is left for the config parser to validate. */ }
  }
  const result = await askHubFrame(discovery, { type: 'config.set', key, value }) as ConfigSetResult;
  const applies = result.applies === 'now' ? 'applies now' : result.applies === 'restart' ? 'applies at the next hub start; restart the hub to apply' : result.applies;
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.key} = ${JSON.stringify(result.value)}; ${applies}\n`);
  return 0;
}
