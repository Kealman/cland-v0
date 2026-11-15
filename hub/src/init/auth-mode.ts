import { basename, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { defaultConfig, parseConfig } from './config.ts';

/** Read only the configured mode; absent config uses the project default. */
export function projectAuthMode(root: string, env: NodeJS.ProcessEnv): 'single' | 'users' {
  let text;
  try { text = readFileSync(join(root, '.cland/config.toml'), 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultConfig(basename(root)).auth.mode;
    throw error;
  }
  return parseConfig(text, basename(root), env).auth.mode;
}
