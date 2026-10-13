// `cland session …`: launch and manage harness sessions through the project's hub (spec 4.3).
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { SessionResumeAnswer } from '../adapters/sessions.ts';
import type { HarnessProcessView } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';
import { withRole } from '../names.ts';

export const SESSION_USAGE = `  session launch <name> [--role r] [--model m] [--harness claude-code|opencode|codex] [--effort e] [--cwd dir | --item T-<n>] [--brief text|A-<n>]
                  launch a harness session through the hub; a role's launch defaults
                  (.cland/roles.toml) fill the harness, model and effort not given; --item starts an
                  Implementer in its task worktree, or a Lead on an open epic/release at the root, with its claim;
                  --brief delivers text or an artifact's content once after the role clause
  session list    the sessions the hub launched, with their state (--json for JSON)
  session attach <name>   print the command that attaches a terminal to the session
  session stop <name>     stop the session through its harness
  session resume <name> [--relaunch | --fresh]   re-find the session's process; --relaunch starts a new one on the same
                  conversation, stopping the old one first when it still runs (keeps its role and valid item claim); --fresh starts a new
                  conversation with the recorded brief when native resume cannot
  session retry <name> <message id>    send again a message whose inject got no answer
                  (its delivery is uncertain: the turn may have started; never retried on its own)
`;

const flag = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const line = (p: HarnessProcessView): string =>
  `${withRole(p.name, p.role)}  ${p.harness}  ${p.status}  [${p.state}]${p.model ? `  ${p.model}` : ''}  pid ${p.pid ?? '?'}${p.attach ? `\n    attach: ${p.attach}` : ''}`;

export async function runSession(args: string[], cwd: string = process.cwd()): Promise<number> {
  const [sub, ...rest] = args;
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) {
    process.stderr.write('cland: no hub runs for this project — run `cland hub start`\n');
    return 1;
  }
  const json = rest.includes('--json');
  const valueFlags = new Set(['--role', '--model', '--harness', '--cwd', '--effort', '--item', '--brief']);
  const name = rest.find((a, i) => !a.startsWith('--') && !valueFlags.has(rest[i - 1] ?? ''));
  const out = (value: unknown, text: string) => process.stdout.write(json ? `${JSON.stringify(value)}\n` : `${text}\n`);
  switch (sub) {
    case 'launch': {
      if (!name) throw new Error('usage: cland session launch <name> [--role r] [--model m]');
      const role = flag(rest, '--role');
      const model = flag(rest, '--model');
      const harness = flag(rest, '--harness');
      const dir = flag(rest, '--cwd');
      const effort = flag(rest, '--effort');
      const item = flag(rest, '--item');
      const brief = flag(rest, '--brief');
      if (rest.includes('--brief') && brief === undefined) throw new Error('--brief needs text or an artifact id A-<n>');
      const v = (await askHubFrame(
        d,
        { type: 'session.launch', name, ...(role ? { role } : {}), ...(model ? { model } : {}), ...(harness ? { harness } : {}), ...(dir ? { cwd: dir } : {}), ...(effort ? { effort } : {}), ...(item ? { item } : {}), ...(brief !== undefined ? { brief } : {}) },
        60_000,
      )) as { process: HarnessProcessView; claim?: { session: string } | null; worktree?: { path: string; branch: string } | null; reason?: string };
      const where = item ? `\n    ${item}: ${v.worktree ? `worktree ${v.worktree.path} on ${v.worktree.branch}` : (v.reason ?? 'no worktree')}; claimed by ${v.claim?.session ?? '-'}` : '';
      out(v, `launched ${line(v.process)}${where}`);
      return 0;
    }
    case 'list': {
      const v = (await askHubFrame(d, { type: 'session.list' })) as { processes: HarnessProcessView[]; coordinator?: string | null };
      out(v, `${v.processes.length ? v.processes.map(line).join('\n') : 'no sessions launched'}\n${v.coordinator ? `coordinator: ${v.coordinator}` : 'no coordinator'}`);
      return 0;
    }
    case 'attach': {
      if (!name) throw new Error('usage: cland session attach <name>');
      const v = (await askHubFrame(d, { type: 'session.attach', session: name })) as { command: string };
      out(v, v.command);
      return 0;
    }
    case 'stop': {
      if (!name) throw new Error('usage: cland session stop <name>');
      const v = (await askHubFrame(d, { type: 'session.stop', session: name }, 30_000)) as { process: HarnessProcessView };
      out(v, `stopped ${line(v.process)}`);
      return 0;
    }
    case 'resume': {
      if (!name) throw new Error('usage: cland session resume <name> [--relaunch | --fresh]');
      const v = (await askHubFrame(d, { type: 'session.resume', session: name, relaunch: rest.includes('--relaunch'), fresh: rest.includes('--fresh') }, 60_000)) as SessionResumeAnswer;
      const notes = v.notes.length ? `\n    ${v.notes.join(' · ')}` : '';
      const hint = v.fresh ? `\n    cland session resume ${name} --fresh (${v.fresh.brief === null ? 'no brief recorded' : 'with its recorded brief'})` : '';
      out(v, v.found ? `resumed ${line(v.process)}${notes}` : `cannot resume ${name}: ${v.reason ?? ''}${notes}${hint}`);
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
