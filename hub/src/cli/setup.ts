import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../project.ts';
import { readlinePrompter, type Prompter } from '../setup/prompter.ts';
import { setupMachine } from '../setup/machine.ts';
import { setup } from '../setup/runner.ts';
import { setupHub, type SetupHub } from '../setup/hub.ts';
import { clandCommand, handOver, type HandoverOptions } from '../setup/handover.ts';
import type { SetupMachine } from '../setup/types.ts';
import { VERSION } from '../version.ts';
import { HARNESS_ORDER } from '../setup/steps/harnesses.ts';
import type { HarnessId } from '../doctor/ranges.ts';

export { SETUP_USAGE } from './usage.ts';

type SetupIO = {
  stdinTTY: boolean;
  stdoutTTY: boolean;
  write(text: string): void;
  narrate(text: string): void;
  prompter: Prompter;
  machine: SetupMachine;
  hub: SetupHub;
  run: NonNullable<HandoverOptions['run']>;
};

/** The CLI owns roots, terminal policy and rendering; the runner owns the ordered steps. */
export async function runSetup(args: string[], cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env, io: Partial<SetupIO> = {}): Promise<number> {
  const json = args.includes('--json');
  let dir: string | undefined;
  let harness: HarnessId | undefined;
  let install: HarnessId | undefined;
  const usage = () => new Error('usage: cland setup [dir] [--json] [--yes] [--harness claude-code|codex|opencode] [--install <harness>] [--no-aide] [--attach]');
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--install') {
      const chosen = HARNESS_ORDER.find(id => id === args[i + 1]);
      if (!chosen || install) throw new Error('--install requires one harness: claude-code, codex or opencode');
      install = chosen;
      i++;
    } else if (arg === '--harness') {
      const chosen = HARNESS_ORDER.find(id => id === args[i + 1]);
      if (!chosen || harness) throw usage();
      harness = chosen;
      i++;
    } else if (arg === '--json' || arg === '--yes' || arg === '--no-aide' || arg === '--attach') continue;
    else if (arg.startsWith('--') || dir !== undefined) throw usage();
    else dir = arg;
  }
  const target = resolve(cwd, dir ?? '.');
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`${target} is not a directory`);
  const root = realpathSync(target);
  if (root === realpathSync(homedir())) throw new Error(`cland setup refuses HOME as a project root: ${target}`);
  const discovered = realpathSync(projectRoot(root));
  if (discovered !== root) throw new Error(`cland setup refuses target ${target}: discovered project root ${discovered}; run it in that root explicitly`);
  const interactive = !json && (io.stdinTTY ?? Boolean(process.stdin.isTTY)) && (io.stdoutTTY ?? Boolean(process.stdout.isTTY));
  const write = io.write ?? ((text: string) => { process.stdout.write(text); });
  const narrate = json ? (io.narrate ?? ((text: string) => { process.stderr.write(text); })) : write;
  // Keep installer folders available to later steps and the hub child without changing the caller's env.
  const setupEnv = { ...env };
  const yes = args.includes('--yes');
  const prompter = io.prompter ?? readlinePrompter({ input: process.stdin, output: process.stderr });
  const actions = [install ? `install ${install} requested` : '', harness ? `favourite ${harness} requested` : '', yes ? '--yes allows harmless writes' : ''].filter(Boolean).join('; ') || 'detection only';
  narrate(`cland setup ${VERSION} in ${root}${interactive ? '' : ` — without a terminal: ${actions}`}\n`);
  const { report, code } = await setup({ root, rootSpelling: target, env: setupEnv, interactive, json, yes, noAide: args.includes('--no-aide'), ...(io.hub ? { hub: io.hub } : {}), ...(harness ? { harness } : {}), ...(install ? { install } : {}), narrate,
    prompter,
    machine: io.machine ?? setupMachine(root, setupEnv),
  });
  if (json) write(`${JSON.stringify(report)}\n`);
  else {
    for (const line of report.steps) write(`${line.verdict.padEnd(4)}  ${line.name}  ${line.detail}${line.fix ? ` — ${line.fix}` : ''}\n`);
    write(`${Object.entries(report.summary).map(([verdict, count]) => `${count} ${verdict}`).join(', ')}\n`);
  }
  if (!interactive || code !== 0) narrate('continue: cland setup in a terminal\n');
  await handOver({ root, env: setupEnv, interactive, noAide: args.includes('--no-aide'), attach: args.includes('--attach'),
    aideRunning: code !== 130 && report.steps.some(line => line.name === 'aide' && (line.verdict === 'ok' || line.verdict === 'done')),
    cland: clandCommand(setupEnv), prompter, hub: io.hub ?? setupHub(root, setupEnv), say: narrate, ...(io.run ? { run: io.run } : {}),
  });
  return code;
}
