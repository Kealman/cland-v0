import { opendir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { projectGitDirectory } from './git-maintenance.ts';

/** Diagnostic only: bounded metadata scan, never remove locks or follow symlinks. */
export async function gitLockReport(cwd: string): Promise<string> {
  const pending = [join(cwd, '.git'), join(cwd, '.cland', 'territory.git')];
  const locks: string[] = [];
  let remaining = 512;
  let incomplete = false;
  try { const common = await projectGitDirectory(cwd); if (common && !pending.includes(common)) pending.push(common); }
  catch { incomplete = true; }
  // A bare territory command already runs in its metadata directory.
  if (await lstat(join(cwd, 'HEAD')).then(row => row.isFile(), () => false)) pending.push(cwd);
  for (let at = 0; at < pending.length && remaining > 0; at++) {
    const path = pending[at]!;
    try {
      const info = await lstat(path);
      if (info.isSymbolicLink()) { incomplete = true; continue; }
      if (info.isFile() && path === join(cwd, '.git')) {
        // The shared parser above resolves common metadata. Private worktree
        // locks require operator inspection; never imply a complete census.
        incomplete = true;
        continue;
      }
      const directory = await opendir(path);
      for await (const entry of directory) {
        if (--remaining < 0) break;
        if (entry.name.endsWith('.lock')) locks.push(join(path, entry.name));
        if (entry.isDirectory() && (at >= 2 || entry.name === 'refs' || entry.name === 'worktrees')) {
          if (entry.name !== 'objects' && entry.name !== 'logs') pending.push(join(path, entry.name));
        }
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') incomplete = true; }
  }
  return `Git locks retained: ${locks.join(', ') || 'none observed'}${incomplete || remaining <= 0 ? ' (scan incomplete)' : ''}`;
}
