import { statDirectory } from '../host/agent/stat-directory.ts';
export { statDirectory } from '../host/agent/stat-directory.ts';

/** Diagnose a removed worktree before a child process reports ENOENT for its binary. */
export async function sessionCwdRefusal(cwd: string): Promise<string | null> {
  return (await statDirectory(cwd)).refusal;
}
