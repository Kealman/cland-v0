// `cland session …`: launch and manage harness sessions through the project's hub (spec 4.3).
import { layout, projectRoot, readDiscovery } from '../project.ts';
import type { HarnessProcessView } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';
import { withRole } from '../names.ts';

export const SESSION_USAGE = `  session launch <name> [--role r] [--model m] [--harness claude-code|opencode|codex] [--effort e] [--cwd dir]
                  launch a harness session through the hub; a role's launch defaults
                  (.cland/roles.toml) fill the harness, model and effort not given
  session list    the sessions the hub launched, with their state (--json for JSON)
  session attach <name>   print the command that attaches a terminal to the session
  session stop <name>     stop the session through its harness
  session resume <name> [--relaunch]   re-find the session's process, or start it again
`;

const flag = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const line = (p: HarnessProcessView): string =>
  `${withRole(p.name, p.role)}  ${p.harness}  ${p.status}  [${p.state}]${p.model ? `  ${p.model}` : ''}  pid ${p.pid ?? '?'}${p.attach ? `\n    attach: ${p.attach}` : ''}`;

export async function runSession(args: string[], cwd: string = process.cwd()): Promise<number> {
  const [sub, ...rest] = args;
  const d = readDiscovery(layout(projectRoot(cwd)).discovery);
  if (!d) {
    process.stderr.write('cland: no hub runs for this project — run `cland hub start`\n');
    return 1;
  }
  const json = rest.includes('--json');
  const valueFlags = new Set(['--role', '--model', '--harness', '--cwd', '--effort']);
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
      const v = (await askHubFrame(
        d,
        { type: 'session.launch', name, ...(role ? { role } : {}), ...(model ? { model } : {}), ...(harness ? { harness } : {}), ...(dir ? { cwd: dir } : {}), ...(effort ? { effort } : {}) },
        60_000,
      )) as { process: HarnessProcessView };
      out(v, `launched ${line(v.process)}`);
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
      if (!name) throw new Error('usage: cland session resume <name> [--relaunch]');
      const v = (await askHubFrame(d, { type: 'session.resume', session: name, relaunch: rest.includes('--relaunch') }, 60_000)) as { found: boolean; reason?: string; process: HarnessProcessView };
      out(v, v.found ? `resumed ${line(v.process)}` : `not found: ${v.reason ?? ''}\n${line(v.process)}`);
      return v.found ? 0 : 1;
    }
    default:
      process.stderr.write(`cland: unknown session command "${sub ?? ''}"\n\nusage: cland session <command>\n\n${SESSION_USAGE}`);
      return 2;
  }
}
