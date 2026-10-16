import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { defaultConfig, parseConfig } from './init/config.ts';

export type SuiteLimits = { testTimeoutMs: number; stallTimeoutMs: number; workers: number; loadGateWorkers: number };

/** Package runners and workers use the candidate's committed timeout and worker policy. */
export async function suiteLimits(cwd: string, executor: 'local' | 'droplet' = 'local', env: NodeJS.ProcessEnv = process.env): Promise<SuiteLimits> {
  if (env.CLAND_SUITE_LIMITS_CWD === resolve(cwd) && env.CLAND_SUITE_LIMITS) return JSON.parse(env.CLAND_SUITE_LIMITS) as SuiteLimits;
  const text = await readFile(join(cwd, '.cland/config.toml'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const config = text === null ? defaultConfig(basename(cwd)) : parseConfig(text, basename(cwd), env);
  return { loadGateWorkers: config.verification.loadGateWorkers, workers: executor === 'droplet' ? config.verification.droplet.workers ?? config.verification.workers : config.verification.workers, testTimeoutMs: config.verification.testTimeoutMs, stallTimeoutMs: config.verification.stallTimeoutMs };
}
