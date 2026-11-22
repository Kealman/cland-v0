import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parseConfig, type ProjectConfig } from './init/config.ts';

export type SuiteLimits = { testTimeoutMs: number; stallTimeoutMs: number; workers: number; loadGateWorkers: number; testTimeoutIsDefault?: boolean };

export function suiteLimitsFromConfig(config: ProjectConfig, executor: 'local' | 'droplet' = 'local', workers?: number): SuiteLimits {
  const v = config.verification;
  return { loadGateWorkers: v.loadGateWorkers, workers: workers ?? (executor === 'droplet' ? v.droplet.workers ?? v.workers : v.workers), testTimeoutMs: v.testTimeoutMs, stallTimeoutMs: v.stallTimeoutMs, ...(v.testTimeoutIsDefault === undefined ? {} : { testTimeoutIsDefault: v.testTimeoutIsDefault }) };
}

/** Only an absent source setting authorizes default scaling. Legacy admitted
 * snapshots without provenance stay exact in the runner. */
export function suiteLimitsFromSource(text: string | null, name: string, executor: 'local' | 'droplet' = 'local', env: NodeJS.ProcessEnv = process.env): SuiteLimits {
  const config = parseConfig(text ?? '', name, env);
  return suiteLimitsFromConfig(config, executor);
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
