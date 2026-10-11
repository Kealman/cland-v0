// Full suites are hub-owned jobs: the CLI only submits the run and exits.
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';

export const SUITE_USAGE = `  verify [all|hub|nvim] [--all] [--fresh] --report <topic|session> [--to <session>] [--json]
  suite           alias for verify\n                  run typecheck and the package suite detached; post one artifact-backed result
  verify cancel [<suite id>] [--json]
                  cancel your active suite (human: any explicit id); post its cancelled result
`;

export async function runSuiteCommand(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    report: { type: 'string' }, to: { type: 'string', multiple: true }, all: { type: 'boolean' }, fresh: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { process.stdout.write(SUITE_USAGE); return 0; }
  if (positionals[0] === 'cancel') {
    if (positionals.length > 2 || values.report !== undefined || values.to !== undefined || values.all !== undefined || values.fresh !== undefined) throw new Error(SUITE_USAGE.trim());
    const d = readDiscovery(hubDiscovery(cwd));
    if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
    const result = await askHubFrame(d, { type: 'suite.cancel', ...(positionals[1] ? { suite: positionals[1] } : {}) }, 15000) as { id: string; topic: string; cancelled: true };
    process.stdout.write((values.json ? JSON.stringify(result) : `suite ${result.id} cancellation requested; result in ${result.topic}`) + '\n');
    return 0;
  }
  const requested = positionals[0] ?? 'auto';
  if (positionals.length > 1 || !['auto', 'all', 'hub', 'nvim'].includes(requested) || !values.report?.trim()) throw new Error(SUITE_USAGE.trim());
  const mode = values.all ? 'all' : requested;
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'suite.start', mode, cwd, fresh: values.fresh ?? false, report: values.report, ...(values.to ? { to: values.to } : {}) }, 15000) as { id: string; pid: number | null; topic: string; position: number; cached?: { run: string; head: string; tree: string } };
  process.stdout.write((values.json ? JSON.stringify(result) : `suite ${result.id}${result.cached ? ` cached from ${result.cached.run} at ${result.cached.head} tree ${result.cached.tree};` : ' submitted;'} worker pid ${result.pid}; project queue position ${result.position}; result in ${result.topic}`) + '\n');
  return 0;
}
