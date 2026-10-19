import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { defaultConfig, parseConfig } from './init/config.ts';
import type { TierCommands } from './verification-plan.ts';

export type VerificationCommands = TierCommands;

/** File presence identifies cland's suite; older runners may lack capabilities. */
export async function clandRunner(cwd: string): Promise<{ inheritedLease: boolean; reduceCoverage: boolean } | null> {
  const source = await readFile(join(cwd, 'hub/test/run-suite.ts'), 'utf8').catch(error => {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  });
  return source === null ? null : { inheritedLease: source.includes('inheritedLease'), reduceCoverage: source.includes('reduceCoverage') };
}

/** Resolve once at admission. A candidate's explicit whole test takes precedence over root tiers. */
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
  const tierKeys = [['test_unit', 'T1'], ['test_component', 'T2'], ['test_integration', 'T3'], ['test_soak', 'T4']] as const;
  if (candidate.test && !tierKeys.some(([key]) => candidate[key])) return commands;
  const tiers: NonNullable<TierCommands['tiers']> = {};
  for (const [key, tier] of tierKeys) {
    const line = candidate[key] || fallback[key];
    if (line) tiers[tier] = line;
  }
  if (Object.keys(tiers).length) return { ...commands, tiers };
  if (!commands.test) throw new Error("no [verification] test for this project; set it: cland config set verification.test '<command>'");
  return commands;
}

/** Pre-command job records cannot safely infer the commands that were submitted. */
export function recordedCommands(run: { commands?: VerificationCommands }): VerificationCommands {
  if (!run.commands) throw new Error('run has no recorded verification commands; submit verification again');
  return run.commands;
}
