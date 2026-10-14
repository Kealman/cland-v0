import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { Accounts } from '../accounts/registry.ts';

export const ACCOUNT_USAGE = `  account list [--json]   list the user-level account names, harnesses and paths\n`;
export async function runAccount(args: string[], cwd = process.cwd()): Promise<number> {
  if (args[0] !== 'list' || args.slice(1).some(a => a !== '--json')) throw new Error(`usage: cland account list [--json]`);
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(discovery, { type: 'account.list' }) as Accounts;
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    if (result.error) process.stderr.write(`${result.error}\n`);
    process.stdout.write(result.accounts.map(a => `${a.name}  ${a.harness}  ${a.path ?? 'harness default'}`).join('\n') + '\n');
  }
  return result.error ? 1 : 0;
}
