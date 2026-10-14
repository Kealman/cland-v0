import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { defaultConfig, parseConfig } from './init/config.ts';

/** Package runners and workers use the candidate's committed timeout policy. */
export async function suiteLimits(cwd: string): Promise<{ testTimeoutMs: number; stallTimeoutMs: number }> {
  const text = await readFile(join(cwd, '.cland/config.toml'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const config = text === null ? defaultConfig(basename(cwd)) : parseConfig(text, basename(cwd));
  return { testTimeoutMs: config.verification.testTimeoutMs, stallTimeoutMs: config.verification.stallTimeoutMs };
}
