import { realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/** Missing locations keep their absolute lexical path, as worktree policy does. */
export const realWorktreePath = (path: string): Promise<string> => realpath(path).catch(() => resolve(path));

/** Compute containment from one resolved snapshot; the pruning owner revalidates it. */
export function resolvedOccupants(path: string, sessions: readonly { name: string }[], cwds: readonly string[]): string[] {
  return [...new Set(sessions.filter((_, n) => cwds[n] === path || cwds[n]!.startsWith(path + sep)).map(session => session.name))];
}

export async function occupants(path: string, sessions: readonly { name: string; cwd: string }[]): Promise<string[]> {
  const [target, cwds] = await Promise.all([
    realWorktreePath(path),
    Promise.all(sessions.map(session => realWorktreePath(session.cwd))),
  ]);
  return resolvedOccupants(target, sessions, cwds);
}
