// `cland session …`: launch and manage harness sessions through the project's hub (spec 4.3).
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { SessionResumeAnswer } from '../adapters/sessions.ts';
import type { HarnessProcessView } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';
import { withRole } from '../names.ts';

import { SESSION_USAGE } from './usage.ts';
export { SESSION_USAGE } from './usage.ts';

const flag = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

export const sessionLine = (p: HarnessProcessView): string =>
  `${withRole(p.name, p.role)}  ${p.harness}  ${p.status}  [${p.stateReason ?? p.state}]${p.model ? `  ${p.model}` : ''}${p.account ? `  account ${p.account}` : ''}  pid ${p.pid ?? '?'}${p.attach ? `\n    attach: ${p.attach}` : ''}`;

export async function runSession(args: string[], cwd: string = process.cwd()): Promise<number> {
  const [sub, ...rest] = args;
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) {
    process.stderr.write('cland: no hub runs for this project — run `cland hub start`\n');
    return 1;
  }
  const json = rest.includes('--json');
  const valueFlags = new Set(['--account', '--role', '--model', '--harness', '--cwd', '--effort', '--item', '--brief']);
  const name = rest.find((a, i) => !a.startsWith('--') && !valueFlags.has(rest[i - 1] ?? ''));
  const out = (value: unknown, text: string) => process.stdout.write(json ? `${JSON.stringify(value)}\n` : `${text}\n`);
  switch (sub) {
    case 'launch': {
      if (!name) throw new Error('usage: cland session launch <name> [--role r] [--model m]');
      const role = flag(rest, '--role');
      const model = flag(rest, '--model');
      const account = flag(rest, '--account');
      if (rest.includes('--account') && account === undefined) throw new Error('--account needs a name');
      const harness = flag(rest, '--harness');
      const dir = flag(rest, '--cwd');
      const effort = flag(rest, '--effort');
      const item = flag(rest, '--item');
      const brief = flag(rest, '--brief');
      if (rest.includes('--brief') && brief === undefined) throw new Error('--brief needs text or an artifact id A-<n>');
      const v = (await askHubFrame(
        d,
        { type: 'session.launch', name, ...(role ? { role } : {}), ...(model ? { model } : {}), ...(harness ? { harness } : {}), ...(account !== undefined ? { account } : {}), ...(dir ? { cwd: dir } : {}), ...(effort ? { effort } : {}), ...(item ? { item } : {}), ...(brief !== undefined ? { brief } : {}) },
        60_000,
      )) as { process: HarnessProcessView; claim?: { session: string } | null; worktree?: { path: string; branch: string } | null; reason?: string };
      const where = item ? `\n    ${item}: ${v.worktree ? `worktree ${v.worktree.path} on ${v.worktree.branch}` : (v.reason ?? 'no worktree')}; claimed by ${v.claim?.session ?? '-'}` : '';
      out(v, `${v.process.warning ? `warning: ${v.process.warning}\n` : ''}launched ${sessionLine(v.process)}${where}`);
      return 0;
    }
    case 'list': {
      const v = (await askHubFrame(d, { type: 'session.list', archived: rest.includes('--archived') })) as { processes: HarnessProcessView[]; coordinator?: string | null; archived: number };
      out(v, `${v.processes.length ? v.processes.map(sessionLine).join('\n') : 'no sessions launched'}\n${v.coordinator ? `coordinator: ${v.coordinator}` : 'no coordinator'}\narchived: ${v.archived}`);
      return 0;
    }
    case 'attach': {
      if (!name) throw new Error('usage: cland session attach <name>');
      const v = (await askHubFrame(d, { type: 'session.attach', session: name })) as { command: string };
      out(v, v.command);
      return 0;
    }
    case 'archive': {
      if (!name) throw new Error('usage: cland session archive <name>');
      const v = (await askHubFrame(d, { type: 'session.archive', session: name })) as { process: HarnessProcessView };
      out(v, `archived ${sessionLine(v.process)}`);
      return 0;
    }
    case 'prune': {
      const olderThan = flag(rest, '--older-than');
      if (!olderThan) throw new Error('usage: cland session prune --older-than <duration> [--dry-run]');
      const v = await askHubFrame(d, { type: 'session.prune', olderThan, dryRun: rest.includes('--dry-run') }) as { names: string[]; dryRun: boolean };
      out(v, `${v.dryRun ? 'would prune' : 'pruned'} ${v.names.length} session(s)${v.names.length ? ': ' + v.names.join(', ') : ''}`);
      return 0;
    }
    case 'stop': {
      if (!name) throw new Error('usage: cland session stop <name>');
      const v = (await askHubFrame(d, { type: 'session.stop', session: name }, 30_000)) as { process: HarnessProcessView };
      out(v, `stopped ${sessionLine(v.process)}`);
      return 0;
    }
    case 'resume': {
      if (!name) throw new Error('usage: cland session resume <name> [--relaunch | --fresh]');
      const v = (await askHubFrame(d, { type: 'session.resume', session: name, relaunch: rest.includes('--relaunch'), fresh: rest.includes('--fresh') }, 60_000)) as SessionResumeAnswer;
      const notes = v.notes.length ? `\n    ${v.notes.join(' · ')}` : '';
      const hint = v.fresh ? `\n    cland session resume ${name} --fresh (${v.fresh.brief === null ? 'no brief recorded' : 'with its recorded brief'})` : '';
      out(v, v.found ? `resumed ${sessionLine(v.process)}${notes}` : `cannot resume ${name}: ${v.reason ?? ''}${notes}${hint}`);
      return v.found ? 0 : 1;
    }
    case 'retry': {
      const message = rest.filter((a) => !a.startsWith('--'))[1];
      if (!name || !message) throw new Error('usage: cland session retry <name> <message id>');
      const v = (await askHubFrame(d, { type: 'session.retry', session: name, message }, 30_000)) as { retried: boolean };
      out(v, `retried ${message} for ${name}`);
      return 0;
    }
    default:
      process.stderr.write(`cland: unknown session command "${sub ?? ''}"\n\nusage: cland session <command>\n\n${SESSION_USAGE}`);
      return 2;
  }
}
