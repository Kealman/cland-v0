// Shared by lane merge holds and demo freshness. Callers supply the epic's task descendants;
// Git's Item trailers, rather than branch names or the current diff, identify their landed surfaces.
import { territoryGitAsync } from '../territory.ts';
import { idNumber, normalizeId } from './item.ts';

export async function epicMergeFiles(root: string, tasks: readonly string[], ref = 'dev', env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  if (!tasks.length) return [];
  const numbers = new Set(tasks.map(idNumber));
  const log = await territoryGitAsync(root, ['log', '--first-parent', '--format=%H%x00%(trailers:key=Item,valueonly)%x00', ref, '--'], undefined, undefined, env);
  const entries = log.split('\0');
  const files = new Set<string>();
  for (let i = 0; i + 1 < entries.length; i += 2) {
    const commit = entries[i]!.trim();
    const trailers = entries[i + 1]!.split('\n').flatMap(line => {
      const id = line.trim();
      return normalizeId(id) ? [idNumber(id)] : [];
    });
    if (!trailers.some(n => numbers.has(n))) continue;
    // Disabling rename detection retains both the old and new path, including deletions.
    const changed = await territoryGitAsync(root, ['diff-tree', '--root', '-r', '--no-renames', '--name-only', '-z', commit, '--'], undefined, undefined, env);
    for (const file of changed.split('\0').slice(1).filter(Boolean)) files.add(file);
  }
  return [...files].sort();
}
