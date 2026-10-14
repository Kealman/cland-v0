import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import { limitUntil, type AccountList, type AccountView } from '../accounts/limits.ts';

export { ACCOUNT_USAGE } from './usage.ts';
export async function runAccount(args: string[], cwd = process.cwd()): Promise<number> {
  const clear = args[0] === 'clear' && args.length === 2 && !!args[1];
  if (!clear && (args[0] !== 'list' || args.slice(1).some(a => a !== '--json' && a !== '--refresh'))) throw new Error(`usage: cland account list [--refresh] [--json] | clear <name>`);
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  if (clear) {
    const result = await askHubFrame(discovery, { type: 'account.clear', account: args[1]! }) as { account: string; cleared: boolean };
    process.stdout.write(`account ${result.account}: ${result.cleared ? 'limit cleared' : 'no limited mark'}\n`);
    return 0;
  }
  const refresh = args.includes('--refresh');
  // Two bounded polls at a time; a large registry can require several batches.
  const count = refresh ? (await askHubFrame(discovery, { type: 'account.list' }) as AccountList).accounts.length : 0;
  const result = await askHubFrame(discovery, { type: refresh ? 'account.poll' : 'account.list' }, refresh ? (1 + Math.ceil(count / 2)) * 30_000 : 3000) as AccountList;
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    if (result.error) process.stderr.write(`${result.error}\n`);
    process.stdout.write(result.accounts.map(a => `${a.name}  ${a.harness}  ${a.path ?? 'harness default'}  ${limitsText(a)}`).join('\n') + '\n');
  }
  return result.error ? 1 : 0;
}

function limitsText(account: AccountView): string {
  if (account.limited) return `limited · until ${limitUntil(account.limited.resetsAt)}`;
  if (account.harness === 'opencode') return 'no limit data';
  if (account.signedOut) return 'signed out';
  if (!account.at) return 'no reading yet';
  const age = Math.max(0, Math.floor((Date.now() - Date.parse(account.at)) / 60000));
  const windows = account.windows.map(w => `${w.label} ${w.usedPercent}% ↻${new Date(w.resetsAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`).join(' · ') || 'no limit data';
  const source = account.source?.kind === 'session' ? `session ${account.source.session}` : 'poll';
  return `${windows} · ${age}m ago (${source})`;
}
