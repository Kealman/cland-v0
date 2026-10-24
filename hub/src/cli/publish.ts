import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { PublishResult } from '../territory-publish.ts';
import { askHubFrame } from './socket-client.ts';
import { RELEASE_USAGE } from './usage.ts';

export async function runPublish(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, item: { type: 'string' } } });
  if (values.help) { process.stdout.write(RELEASE_USAGE); return 0; }
  if (positionals.length !== 1 || !values.item) throw new Error('usage: cland publish <branch> --item T-n [--dry-run] [--json]');
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(discovery, { type: 'publish', branch: positionals[0]!, item: values.item, dryRun: values['dry-run'] === true }, 120_000) as PublishResult;
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `${result.dryRun ? 'Would publish' : 'Published'} ${result.branch} (${result.source})\n${result.commits.map(commit => `${commit.commit} ${commit.subject}`).join('\n')}\nPaths:\n${result.paths.join('\n')}\nGitHub default branch and site: ${result.main}\ndev: ${result.dev}\n${result.followUp ? `${result.followUp.error}\n` : ''}`);
  return 0;
}
