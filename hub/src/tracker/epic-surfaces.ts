// Shared by lane merge holds and demo freshness. Callers supply the epic's task descendants;
// Git's Item trailers, rather than branch names or the current diff, identify their landed surfaces.
import { territoryGitAsync } from '../territory.ts';
import type { Git } from './verdict-git.ts';
import { idNumber, normalizeId } from './item.ts';

export async function epicMergeFiles(root: string, tasks: readonly string[], ref = 'dev', env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  return mergeFiles(args => territoryGitAsync(root, args, undefined, undefined, env), tasks, ref);
}

async function checked(git: Git, args: string[]): Promise<string> {
  const result = await git(args);
  if (result === null) throw new Error('Git could not read epic demo surfaces');
  return result;
}
async function mergeFiles(git: Git, tasks: readonly string[], ref: string): Promise<string[]> {
  if (!tasks.length) return [];
  const numbers = new Set(tasks.map(idNumber));
  const log = await checked(git, ['log', '--first-parent', '--format=%H%x00%(trailers:key=Item,valueonly)%x00', ref, '--']);
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
    const changed = await checked(git, ['diff-tree', '--root', '-r', '-m', '--first-parent', '--no-renames', '--name-only', '-z', commit, '--']);
    for (const file of changed.split('\0').slice(1).filter(Boolean)) files.add(file);
  }
  return [...files].sort();
}

export type DemoFreshness = { current: boolean; reason?: string; conflicts?: Array<{ commit: string; files: string[] }> };
/** Every intervening commit counts, even a reverted edit; rename detection is disabled to retain both paths. */
export async function epicDemoFreshness(git: Git, tasks: readonly string[], commit: string, tip: string): Promise<DemoFreshness> {
  if (await git(['merge-base', '--is-ancestor', commit, tip]) === null) return { current: false, reason: `demo commit ${commit} is not on dev` };
  if (commit === tip) return { current: true };
  const surfaces = new Set(await mergeFiles(git, tasks, tip));
  const commits = (await checked(git, ['rev-list', '--reverse', `${commit}..${tip}`, '--'])).split('\n').filter(Boolean);
  const conflicts: Array<{ commit: string; files: string[] }> = [];
  for (const sha of commits) {
    const changed = await checked(git, ['diff-tree', '--root', '-r', '-m', '--first-parent', '--no-renames', '--name-only', '-z', sha, '--']);
    const files = [...new Set(changed.split('\0').filter(file => surfaces.has(file)))].sort();
    if (files.length) conflicts.push({ commit: sha, files });
  }
  return conflicts.length ? { current: false, conflicts, reason: conflicts.map(c => `${c.commit}: ${c.files.join(', ')}`).join('; ') } : { current: true };
}
