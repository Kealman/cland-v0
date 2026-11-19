// Component CLI subjects: production parsing/rendering over the fixture socket.
import { runAuth, runUser } from '../src/cli/auth.ts';
import { runWeb } from '../src/cli/web.ts';
import { runRole } from '../src/cli/role.ts';
import { runMerge } from '../src/cli/merge.ts';
import { runTask } from '../src/cli/task.ts';
import { runSuiteCommand } from '../src/cli/suite.ts';
import { runHub } from '../src/cli/hub.ts';
import type { CliResult } from './harness.ts';
import { withFixtureCli } from './fixture-hub-cli.ts';

export async function fixtureCommandWithEnv(root: string, env: Record<string, string>, command: string, ...args: string[]): Promise<CliResult> {
  return withFixtureCli(root, env, async identity => {
    let stdout = '', stderr = '';
    const out = (text: string) => { stdout += text; };
    const err = (text: string) => { stderr += text; };
    try {
      let code: number;
      switch (command) {
        case 'hub': code = await runHub(args, root, { out, err }, { hostIdentity: identity }); break;
        case 'auth': code = await runAuth(args, root, out); break;
        case 'user': code = await runUser(args, root, out); break;
        case 'web': code = await runWeb(args, root, out); break;
        case 'role': code = await runRole(args, root, { out, err }); break;
        case 'merge': code = await runMerge(args, root, out); break;
        case 'task': code = await runTask(args, root, { out, err }); break;
        case 'verify': code = await runSuiteCommand(args, root, { out, err, env: process.env }); break;
        default: throw new Error(`unsupported fixture command: ${command}`);
      }
      return { code, stdout, stderr };
    } catch (error) { return { code: 1, stdout, stderr: stderr + (error instanceof Error ? error.message : String(error)) }; }
  });
}

export const fixtureCommand = (root: string, command: string, ...args: string[]) => fixtureCommandWithEnv(root, {}, command, ...args);
