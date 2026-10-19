import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { which } from '../doctor/report.ts';
import { shellQuote } from '../accounts/registry.ts';
import type { SetupHub } from './hub.ts';
import { Cancelled, type Prompter } from './prompter.ts';
import { terminalCommand } from './terminal.ts';

// The pinned launcher used by cland open also downloads Neovim on first use.
const LAUNCHER = fileURLToPath(new URL('../../../nvim/bin/cland-nvim', import.meta.url));

/** Spell commands for the checkout running setup, even when PATH selects a different cland. */
export function clandCommand(env: NodeJS.ProcessEnv, entry = fileURLToPath(new URL('../../bin/cland.ts', import.meta.url))): HandoverOptions['cland'] {
  const onPath = which('cland', env);
  try {
    if (onPath && realpathSync(onPath) === realpathSync(entry)) return { command: 'cland', note: null };
  } catch { /* A broken link cannot name this checkout. */ }
  return { command: `node ${shellQuote(entry)}`, note: onPath ? 'the cland on your PATH is another checkout' : 'cland is not on your PATH' };
}

export type HandoverOptions = {
  root: string;
  env: NodeJS.ProcessEnv;
  interactive: boolean;
  aideRunning: boolean;
  noAide?: boolean;
  attach?: boolean;
  cland: { command: string; note: string | null };
  prompter: Prompter;
  hub: Pick<SetupHub, 'attach'>;
  say(text: string): void;
  run?: typeof terminalCommand;
};

/** The post-summary terminal handover, followed by exactly one closing line. */
export async function handOver(options: HandoverOptions): Promise<void> {
  const { root, env, cland, say, run = terminalCommand } = options;
  const note = cland.note ? ` (${cland.note})` : '';
  if (!options.interactive || options.noAide || !options.aideRunning) {
    say(`open the workbench: ${cland.command}${note}\n`);
    return;
  }
  const stop = `aide-1 may still be running: x on its row in the workbench's sessions panel stops it, or ${cland.command} session stop aide-1`;
  if (options.attach) {
    try {
      const command = await options.hub.attach('aide-1');
      say(`attach aide-1: ${command}\n`);
      say('leave the harness running: in Claude Code, ← returns to the agent view; Ctrl+Z suspends setup together with the attach\n');
      await options.prompter.pause('Press Enter to attach (Ctrl+D: not now)');
      const code = await run('sh', ['-c', command], { cwd: root, env });
      if (code !== 0) say(`the attach ended with exit ${code}\n`);
    } catch (err) {
      if (!(err instanceof Cancelled)) say(`cannot attach aide-1 here: ${err instanceof Error ? err.message : String(err)}\n`);
    }
    say(`${stop}; open the workbench: ${cland.command}${note}\n`);
    return;
  }
  let failure: string | undefined;
  try {
    const code = await run(env.CLAND_LAUNCHER || LAUNCHER, [root], { cwd: root, env: { ...env, CLAND_OPEN_SESSION: 'aide-1' } });
    if (code !== 0) failure = `the workbench ended with exit ${code}`;
  } catch (err) {
    failure = `cannot open the workbench: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (failure) say(`${failure}; ${cland.command} setup --attach attaches aide-1 in this terminal instead\n`);
  say(`${stop}${note}\n`);
}
