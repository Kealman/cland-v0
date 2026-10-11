// Full suites are hub-owned jobs: the CLI only submits the run and exits.
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';

export const SUITE_USAGE = `  suite [all|hub|nvim] [--all] --report <topic|session> [--to <session>] [--json]
                  run typecheck and the package suite detached; post one artifact-backed result
`;

export async function runSuiteCommand(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    report: { type: 'string' }, to: { type: 'string', multiple: true }, all: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { process.stdout.write(SUITE_USAGE); return 0; }
  const requested = positionals[0] ?? 'auto';
  if (positionals.length > 1 || !['auto', 'all', 'hub', 'nvim'].includes(requested) || !values.report?.trim()) throw new Error(SUITE_USAGE.trim());
  const mode = values.all ? 'all' : requested;
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(d, { type: 'suite.start', mode, cwd, report: values.report, ...(values.to ? { to: values.to } : {}) }, 15000) as { id: string; pid: number; topic: string; position: number };
  process.stdout.write((values.json ? JSON.stringify(result) : `suite ${result.id} submitted; worker pid ${result.pid}; project queue position ${result.position}; result in ${result.topic}`) + '\n');
  return 0;
}
