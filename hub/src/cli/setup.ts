import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../project.ts';
import { readlinePrompter, type Prompter } from '../setup/prompter.ts';
import { setupMachine } from '../setup/machine.ts';
import { setup } from '../setup/runner.ts';
import type { SetupMachine } from '../setup/types.ts';
import { VERSION } from '../version.ts';

export { SETUP_USAGE } from './usage.ts';

type SetupIO = {
  stdinTTY: boolean;
  stdoutTTY: boolean;
  write(text: string): void;
  narrate(text: string): void;
  prompter: Prompter;
  machine: SetupMachine;
};

/** The CLI owns roots, terminal policy and rendering; the runner owns the ordered steps. */
export async function runSetup(args: string[], cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env, io: Partial<SetupIO> = {}): Promise<number> {
  const json = args.includes('--json');
  const [dir, extra] = args.filter(arg => !arg.startsWith('--'));
  if (extra !== undefined || args.some(arg => arg.startsWith('--') && !['--json', '--yes'].includes(arg))) throw new Error('usage: cland setup [dir] [--json] [--yes]');
  const target = resolve(cwd, dir ?? '.');
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`${target} is not a directory`);
  const root = realpathSync(target);
  if (root === realpathSync(homedir())) throw new Error(`cland setup refuses HOME as a project root: ${target}`);
  const discovered = realpathSync(projectRoot(root));
  if (discovered !== root) throw new Error(`cland setup refuses target ${target}: discovered project root ${discovered}; run it in that root explicitly`);
  const interactive = !json && (io.stdinTTY ?? Boolean(process.stdin.isTTY)) && (io.stdoutTTY ?? Boolean(process.stdout.isTTY));
  const write = io.write ?? ((text: string) => { process.stdout.write(text); });
  const narrate = json ? (io.narrate ?? ((text: string) => { process.stderr.write(text); })) : write;
  narrate(`cland setup ${VERSION} in ${root}${interactive ? '' : ' — without a terminal: detection only'}\n`);
  const { report, code } = await setup({ root, env, interactive, yes: args.includes('--yes'),
    prompter: io.prompter ?? readlinePrompter({ input: process.stdin, output: process.stderr }),
    machine: io.machine ?? setupMachine(root, env),
  });
  if (json) write(`${JSON.stringify(report)}\n`);
  else {
    for (const line of report.steps) write(`${line.verdict.padEnd(4)}  ${line.name}  ${line.detail}${line.fix ? ` — ${line.fix}` : ''}\n`);
    write(`${Object.entries(report.summary).map(([verdict, count]) => `${count} ${verdict}`).join(', ')}\n`);
  }
  if (!interactive || code !== 0) narrate('continue: cland setup in a terminal\n');
  else narrate(`next: ${report.next}\n`);
  return code;
}
