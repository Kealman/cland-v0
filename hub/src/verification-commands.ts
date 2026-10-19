import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { defaultConfig, parseConfig } from './init/config.ts';

export type VerificationCommands = { prepare: string; check: string; test: string };

/** Resolve once at admission. Empty template values inherit the hub root's commands. */
export async function verificationCommands(cwd: string, root: string, env: NodeJS.ProcessEnv = process.env): Promise<VerificationCommands> {
  const read = async (dir: string) => {
    const text = await readFile(join(dir, '.cland/config.toml'), 'utf8').catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    return (text === null ? defaultConfig(basename(dir)) : parseConfig(text, basename(dir), env)).verification;
  };
  const candidate = await read(cwd);
  const fallback = resolve(cwd) === resolve(root) ? candidate : await read(root);
  const commands = { prepare: candidate.prepare || fallback.prepare, check: candidate.check || fallback.check, test: candidate.test || fallback.test };
  if (!commands.test) throw new Error("no [verification] test for this project; set it: cland config set verification.test '<command>'");
  return commands;
}

/** Pre-command job records cannot safely infer the commands that were submitted. */
export function recordedCommands(run: { commands?: VerificationCommands }): VerificationCommands {
  if (!run.commands) throw new Error('run has no recorded verification commands; submit verification again');
  return run.commands;
}
