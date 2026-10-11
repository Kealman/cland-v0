import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { ReleaseResult, SyncResult } from '../release.ts';
import { askHubFrame } from './socket-client.ts';

export const RELEASE_USAGE = `  release <vX.Y.Z> [--dry-run] [--json]   publish dev as GitHub main and an annotated tag atomically; Coordinator's shell or human
  release --item T-n [<vX.Y.Z>] [--dry-run] [--json]   publish the release item's version and notes, then close it
  sync [--json]          fetch GitHub main and replay unreleased dev commits; never pushes to GitHub
`;
export async function runRelease(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, item: { type: 'string' } } });
  if (positionals.length > 1) throw new Error(values.item === undefined ? 'usage: cland release <vX.Y.Z> [--dry-run] [--json]' : 'usage: cland release --item T-n [<vX.Y.Z>] [--dry-run] [--json]');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'release', ...(positionals[0] === undefined ? {} : { version: positionals[0] }), ...(values.item === undefined ? {} : { item: values.item }), dryRun: values['dry-run'] === true }, 120_000) as ReleaseResult;
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `${result.dryRun ? 'Would release' : 'Released'} ${result.version} at ${result.commit}\n${result.notes}\n${result.refs.map(ref => `github ${ref}`).join('\n')}\n${result.followUp ? `${result.followUp.error}\n` : ''}`);
  return 0;
}

export async function runSync(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } });
  if (positionals.length) throw new Error('usage: cland sync [--json]');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'sync' }, 120_000) as SyncResult;
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `Synced main ${result.main}; dev ${result.dev}\n${result.followUp ? `${result.followUp.error}\n` : ''}`);
  return 0;
}
