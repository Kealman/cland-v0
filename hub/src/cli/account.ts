import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { AccountList, AccountView } from '../accounts/limits.ts';

export const ACCOUNT_USAGE = `  account list [--json]   list the user-level account names, harnesses, paths and limit windows\n`;
export async function runAccount(args: string[], cwd = process.cwd()): Promise<number> {
  if (args[0] !== 'list' || args.slice(1).some(a => a !== '--json')) throw new Error(`usage: cland account list [--json]`);
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(discovery, { type: 'account.list' }) as AccountList;
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    if (result.error) process.stderr.write(`${result.error}\n`);
    process.stdout.write(result.accounts.map(a => `${a.name}  ${a.harness}  ${a.path ?? 'harness default'}  ${limitsText(a)}`).join('\n') + '\n');
  }
  return result.error ? 1 : 0;
}

function limitsText(account: AccountView): string {
  if (account.harness === 'opencode') return 'no limit data';
  if (!account.at) return 'no reading yet';
  const age = Math.max(0, Math.floor((Date.now() - Date.parse(account.at)) / 60000));
  const windows = account.windows.map(w => `${w.label} ${w.usedPercent}% ↻${new Date(w.resetsAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`).join(' · ') || 'no limit data';
  const source = account.source?.kind === 'session' ? `session ${account.source.session}` : 'poll';
  return `${windows} · ${age}m ago (${source})`;
}
