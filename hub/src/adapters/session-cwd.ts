import { stat } from 'node:fs/promises';

export async function statDirectory(path: string): Promise<{ refusal: string | null; identity: { dev: number; ino: number } | null }> {
  try {
    const info = await stat(path);
    return info.isDirectory() ? { refusal: null, identity: { dev: info.dev, ino: info.ino } }
      : { refusal: `session cwd ${path} is not a directory`, identity: null };
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return { refusal: `session cwd ${path} no longer exists`, identity: null };
    throw error;
  }
}

/** Diagnose a removed worktree before a child process reports ENOENT for its binary. */
export async function sessionCwdRefusal(cwd: string): Promise<string | null> {
  return (await statDirectory(cwd)).refusal;
}
