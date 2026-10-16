// A candidate is the committed tree outside tracker items and the project rulebook.
// Dirty builds never supply cache evidence.
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const excludedPaths = ['.cland/tasks', '.cland/RULES.md'];
export const candidatePathspec = ['.', ...excludedPaths.map(path => `:(exclude)${path}`)];
/** Pass undefined for head to identify the current candidate, allowing metadata-only commits. */
export async function candidateTree(cwd: string, head: string | undefined, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const git = async (args: string[]) => (await exec('git', args, { cwd, env, timeout: 10_000, maxBuffer: 8 * 1024 * 1024 })).stdout.trim();
  try {
    const current = head === undefined;
    head ??= await git(['rev-parse', 'HEAD']);
    // A package directory can execute different npm scripts for the same root tree.
    if (await git(['rev-parse', '--show-prefix'])) return null;
    if (await git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...candidatePathspec])) return null;
    const tree = await committedTree(cwd, head, env);
    if (current) {
      // Resolve HEAD in the comparison itself: metadata commits can overlap hashing.
      if (await git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', '--ignore-submodules=none', head, 'HEAD', '--', ...candidatePathspec])) return null;
      if (await git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...candidatePathspec])) return null;
      return tree;
    }
    return await git(['rev-parse', 'HEAD']) === head ? tree : null;
  } catch { return null; }
}

/** Historical evidence uses the same tree identity without requiring that build to be checked out. */
export async function committedTree(cwd: string, head: string, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), 'cland-candidate-'));
  try {
    const git = async (args: string[], index = false) => (await exec('git', args, {
      cwd, timeout: 10_000, maxBuffer: 8 * 1024 * 1024,
      env: { ...env, ...(index ? { GIT_INDEX_FILE: join(dir, 'index') } : {}) },
    })).stdout.trim();
    // A private index neither reads nor changes the user's staged changes.
    await git(['read-tree', head], true);
    await git(['rm', '--quiet', '-r', '--cached', '--ignore-unmatch', '--', ...excludedPaths], true);
    const tree = await git(['write-tree'], true);
    return tree;
  } catch { return null; }
  finally { await rm(dir, { recursive: true, force: true }); }
}
