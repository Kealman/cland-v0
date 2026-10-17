// Candidate branches opt into the expanded check; older packages keep typecheck.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function suiteCheckCommand(cwd: string): Promise<string[]> {
  const scripts = await readFile(join(cwd, 'package.json'), 'utf8').then(text => (JSON.parse(text) as { scripts?: Record<string, string> }).scripts, error => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  return ['run', scripts?.['test:lint'] && scripts.check ? 'check' : 'typecheck'];
}
