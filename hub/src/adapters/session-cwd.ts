import { stat } from 'node:fs/promises';

/** Diagnose a removed worktree before a child process reports ENOENT for its binary. */
export async function sessionCwdRefusal(cwd: string): Promise<string | null> {
  try {
    return (await stat(cwd)).isDirectory() ? null : `session cwd ${cwd} is not a directory`;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return `session cwd ${cwd} no longer exists`;
    throw error;
  }
}
