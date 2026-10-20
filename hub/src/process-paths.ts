// OS filesystem evidence only; never read environments.
import { run } from './doctor/report.ts';
import { readdir, readlink } from 'node:fs/promises';
import { join } from 'node:path';

/** Read cwd and open file paths, never the process's environment (which may carry credentials). */
export async function processPaths(pid: number, deadline?: number): Promise<{ cwd: string | null; files: string[] }> {
  if (process.platform === 'linux') {
    const dir = `/proc/${pid}`;
    const cwd = await readlink(join(dir, 'cwd')).catch(() => null);
    const fds = await readdir(join(dir, 'fd')).catch(() => []);
    const files = await Promise.all(fds.map(fd => readlink(join(dir, 'fd', fd)).catch(() => '')));
    return { cwd: cwd?.replace(/ \(deleted\)$/, '') ?? null, files: files.map(path => path.replace(/ \(deleted\)$/, '')) };
  }
  const timeout = Math.min(3000, (deadline ?? Date.now() + 3000) - Date.now());
  if (timeout <= 0) throw new Error('orphan sweep deadline reached; remaining candidates preserved');
  const result = await run('lsof', ['-n', '-P', '-a', '-p', String(pid), '-Ffn'], process.env, timeout);
  const output = result.error ? '' : result.stdout;
  let fd = ''; let cwd: string | null = null; const files: string[] = [];
  for (const line of output.split('\n')) {
    if (line.startsWith('f')) fd = line.slice(1);
    if (line.startsWith('n')) { const path = line.slice(1).replace(/ \(deleted\)$/, ''); if (fd === 'cwd') cwd = path; else files.push(path); }
  }
  return { cwd, files };
}
