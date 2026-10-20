import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { WebLinkResult } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';
import { WEB_USAGE } from './usage.ts';

export async function runWeb(args: string[], cwd = process.cwd()): Promise<number> {
  const { values } = parseArgs({ args, options: { 'no-open': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { process.stdout.write(WEB_USAGE); return 0; }
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  // askHubFrame includes the shell's CLAND_SESSION_* actor; the hub refuses it.
  const { url } = await askHubFrame(d, { type: 'web.link' }) as WebLinkResult;
  process.stdout.write(`${url}\n`);
  if (values['no-open']) return 0;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'linux' ? 'xdg-open' : null;
  if (!command) throw new Error('browser opening is supported on macOS and Linux; use --no-open');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [url], { stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}; use the printed link`)));
  });
  return 0;
}
