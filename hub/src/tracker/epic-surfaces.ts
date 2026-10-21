// Shared by lane merge holds and demo freshness. Callers supply the epic's task descendants;
// Git's Item trailers, rather than branch names or the current diff, identify their landed surfaces.
import { territoryGitAsync } from '../territory.ts';
import type { Git } from './verdict-git.ts';
import { idNumber, normalizeId } from './item.ts';

export async function epicMergeFiles(root: string, tasks: readonly string[], ref = 'dev', env: NodeJS.ProcessEnv = process.env, git: Git = args => territoryGitAsync(root, args, undefined, undefined, env)): Promise<string[]> {
  return mergeFiles(git, tasks, ref);
}

async function checked(git: Git, args: string[]): Promise<string> {
  const result = await git(args);
  if (result === null) throw new Error('Git could not read epic demo surfaces');
  return result;
}
async function mergeFiles(git: Git, tasks: readonly string[], ref: string): Promise<string[]> {
  if (!tasks.length) return [];
  const numbers = new Set(tasks.map(idNumber));
  const files = new Set<string>();
  for (const entry of await history(git, ref, true)) {
    const trailers = entry.trailers.split('\n').flatMap(line => {
      const id = line.trim();
      return normalizeId(id) ? [idNumber(id)] : [];
    });
    if (!trailers.some(n => numbers.has(n))) continue;
    for (const file of entry.files) files.add(file);
  }
  return [...files].sort();
}

/** Raw -z records frame paths by their metadata, so whitespace/newlines in a path
 * remain bytes rather than delimiters. First-parent diff display is independent
 * of traversal: a demo range must also include edits on merged side branches. */
async function history(git: Git, ref: string, firstParent = false): Promise<Array<{ commit: string; trailers: string; files: string[] }>> {
  const out = await checked(git, ['log', ...(firstParent ? ['--first-parent'] : ['--reverse']), '--format=%H%x00%(trailers:key=Item,valueonly)%x00',
    '--raw', '-z', '--no-abbrev', '--root', '--diff-merges=first-parent', '--no-renames', ref, '--']);
  const tokens = out.split('\0');
  const entries: Array<{ commit: string; trailers: string; files: string[] }> = [];
  let i = 0;
  while (i < tokens.length) {
    if (!tokens[i]!.trim()) { i++; continue; }
    if (/^\n?:[0-7]{6} [0-7]{6} [0-9a-f]+ [0-9a-f]+ [A-Z][0-9]*$/.test(tokens[i]!)) {
      i++;
      const path = tokens[i++];
      if (!path || !entries.length) throw new Error('Malformed Git history path');
      entries.at(-1)!.files.push(path);
      continue;
    }
    const commit = tokens[i++]!.trim();
    if (!/^[0-9a-f]{40,64}$/.test(commit)) throw new Error('Malformed Git history commit');
    const trailers = tokens[i++]!;
    entries.push({ commit, trailers, files: [] });
  }
  return entries;
}

export type DemoFreshness = { current: boolean; reason?: string; conflicts?: Array<{ commit: string; files: string[] }> };
/** Every intervening commit counts, even a reverted edit; rename detection is disabled to retain both paths. */
export async function epicDemoFreshness(git: Git, tasks: readonly string[], commit: string, tip: string): Promise<DemoFreshness> {
  if (await git(['merge-base', '--is-ancestor', commit, tip]) === null) return { current: false, reason: `demo commit ${commit} is not on dev` };
  if (commit === tip) return { current: true };
  const surfaces = new Set(await mergeFiles(git, tasks, tip));
  const conflicts: Array<{ commit: string; files: string[] }> = [];
  for (const entry of await history(git, `${commit}..${tip}`)) {
    const files = [...new Set(entry.files.filter(file => surfaces.has(file)))].sort();
    if (files.length) conflicts.push({ commit: entry.commit, files });
  }
  return conflicts.length ? { current: false, conflicts, reason: conflicts.map(c => `${c.commit}: ${c.files.join(', ')}`).join('; ') } : { current: true };
}
