import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { defaultConfig, parseConfig } from './init/config.ts';

export type SuiteLimits = { testTimeoutMs: number; stallTimeoutMs: number; workers: number; loadGateWorkers: number; testTimeoutIsDefault?: boolean };

/** Only an absent source setting authorizes default scaling. Legacy admitted
 * snapshots without provenance stay exact in the runner. */
export function suiteLimitsFromSource(text: string | null, name: string, executor: 'local' | 'droplet' = 'local', env: NodeJS.ProcessEnv = process.env): SuiteLimits {
  let configured = false;
  const config = text === null ? defaultConfig(name) : parseConfig(text, name, env, { onConfiguredTestTimeout: () => { configured = true; } });
  return { loadGateWorkers: config.verification.loadGateWorkers, workers: executor === 'droplet' ? config.verification.droplet.workers ?? config.verification.workers : config.verification.workers, testTimeoutMs: config.verification.testTimeoutMs, stallTimeoutMs: config.verification.stallTimeoutMs, testTimeoutIsDefault: !configured };
}

/** Package runners and workers use the candidate's committed timeout and worker policy. */
export async function suiteLimits(cwd: string, executor: 'local' | 'droplet' = 'local', env: NodeJS.ProcessEnv = process.env): Promise<SuiteLimits> {
  if (env.CLAND_SUITE_LIMITS_CWD === resolve(cwd) && env.CLAND_SUITE_LIMITS) return JSON.parse(env.CLAND_SUITE_LIMITS) as SuiteLimits;
  const text = await readFile(join(cwd, '.cland/config.toml'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return suiteLimitsFromSource(text, basename(cwd), executor, env);
}
