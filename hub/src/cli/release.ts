import { webReleaseDescription } from '../release-web.ts';
import { homebrewDescription } from '../homebrew.ts';
import { parseArgs } from 'node:util';
import { hubDiscovery, projectRoot, readDiscovery } from '../project.ts';
import type { ReleaseResult, SyncResult } from '../release.ts';
import { defaultBranch } from '../territory.ts';
import { askHubFrame } from './socket-client.ts';
import { RELEASE_USAGE } from './usage.ts';

export { RELEASE_USAGE } from './usage.ts';
export function releaseDescription(result: ReleaseResult): string {
  return `${result.dryRun ? 'Would release' : 'Released'} ${result.version} at ${result.commit}\n${result.notes}\n${result.refs.map(ref => `github ${ref}`).join('\n')}\n${result.homebrew ? `${homebrewDescription(result.homebrew)}\n` : ''}${result.followUp ? `${result.followUp.error}\n` : ''}${result.webBundle ? `${webReleaseDescription(result.webBundle, result.version)}\n` : ''}`;
}
export async function runRelease(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, item: { type: 'string' } } });
  if (values.help) { process.stdout.write(RELEASE_USAGE); return 0; }
  if (positionals.length > 1) throw new Error(values.item === undefined ? 'usage: cland release <vX.Y.Z> [--dry-run] [--json]' : 'usage: cland release --item T-n [<vX.Y.Z>] [--dry-run] [--json]');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'release', ...(positionals[0] === undefined ? {} : { version: positionals[0] }), ...(values.item === undefined ? {} : { item: values.item }), dryRun: values['dry-run'] === true }, 1_800_000) as ReleaseResult;
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : releaseDescription(result));
  return 0;
}

export async function runSync(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' } } });
  if (values.help) { process.stdout.write(RELEASE_USAGE); return 0; }
  if (positionals.length) throw new Error('usage: cland sync [--json]');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'sync' }, 120_000) as SyncResult;
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `Synced ${defaultBranch(d.root ?? projectRoot(cwd))} ${result.main}; dev ${result.dev}\n${result.followUp ? `${result.followUp.error}\n` : ''}`);
  return 0;
}
