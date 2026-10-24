import { removeWorktreeWithFixtures } from '../fixture-processes.ts';
// Build squash objects in FIFO order; a detached worktree is only the executor's input.
import { join } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import type { MergeQueueEntry } from '../protocol.ts';
import { MergeError } from '../merge.ts';
import { requireMergeWorktree, mergeTreeFacts, gateMergeTree, territoryGitAsync, TerritoryGitError, type MergeTreeFacts } from '../territory.ts';
import { committedTreeOrThrow } from '../verification-tree.ts';
import { BatchRefusal, type BatchCandidate } from './merge-batches.ts';
import { refusedOverridePaths } from '../merge-override.ts';

/** Git/object and immutable-tree reads, replaceable by an in-process repository provider. */
export type BatchRepository = {
  git(args: string[], input?: string): Promise<string>;
  facts(tree: string, head: string, base: string): Promise<MergeTreeFacts>;
  identity(head: string): Promise<string | null>;
  checkout(candidate: BatchCandidate): Promise<void>;
  remove(candidate: BatchCandidate): Promise<void>;
};

/** Compare immutable candidates, including both sides of renames, using the
 * same documentation/tracker policy that selects immediate merges. Unknown
 * paths and failed reads must never turn into reusable test evidence. */
export async function batchRebuildReason(root: string, tested: BatchCandidate, current: BatchCandidate, env: NodeJS.ProcessEnv = process.env, provider?: BatchRepository): Promise<string | null> {
  const git = provider?.git ?? ((args: string[]) => territoryGitAsync(root, args, false, undefined, env));
  const paths = (await git(['diff', '--name-only', '-z', '--no-renames', tested.head, current.head, '--'])).split('\0').filter(Boolean);
  const inputs = refusedOverridePaths(paths);
  if (!inputs.length) return null;
  const commit = await git(['--literal-pathspecs', 'log', '-1', '--format=%H', current.base, `^${tested.base}`, '--', ...inputs]);
  return `commit ${commit || current.base} changed batch test inputs: ${inputs.join(', ')}`;
}

export async function prepareMergeBatch(root: string, id: string, members: MergeQueueEntry[], env: NodeJS.ProcessEnv = process.env, provider?: BatchRepository, pinnedBase?: string): Promise<BatchCandidate> {
  const repository = provider ?? { git: (args: string[], input?: string) => territoryGitAsync(root, args, false, input, env),
    facts: (tree: string, head: string, base: string) => mergeTreeFacts(root, tree, head, base, undefined, env),
    identity: (head: string) => committedTreeOrThrow(root, head, env),
    checkout: (candidate: BatchCandidate) => checkoutMergeBatch(root, candidate, env),
    remove: (candidate: BatchCandidate) => removeMergeBatch(root, candidate, env) };
  const git = repository.git;
  await requireMergeWorktree(root, undefined, env, (_cwd, args, _marked, input) => git(args, input));
  const base = pinnedBase ?? await git(['rev-parse', 'refs/heads/dev']);
  let head = base;
  const budgetLines: string[] = [];
  for (const entry of members) {
    try {
      const tip = await git(['rev-parse', `refs/heads/${entry.branch}`]);
      if (tip !== entry.head) throw new MergeError('merge-changed', `queued task branch changed during preparation; prepared head ${entry.head}, current head ${tip}`);
      if (entry.verdictBase !== 'dev') throw new MergeError('merge-changed', `queued integration base changed from dev to ${entry.verdictBase}`);
      let tree: string;
      try { tree = (await git(['merge-tree', '--write-tree', '--name-only', '-z', head, tip])).split('\0')[0]!; }
      catch (error) {
        if (error instanceof TerritoryGitError && error.code === 1) throw new MergeError('merge-conflict', `rebase ${entry.branch} on dev`);
        throw error;
      }
      budgetLines.push(...gateMergeTree(await repository.facts(tree, tip, head)));
      head = await git(['commit-tree', tree, '-p', head], `Batch candidate ${entry.item}\n`);
    } catch (error) {
      if (error instanceof MergeError) throw new BatchRefusal(entry, error.message);
      throw error;
    }
  }
  let tree: string | null;
  try {
    tree = await repository.identity(head);
    if (!tree) throw new Error('repository identity returned no tree (Git output unavailable)');
  } catch (error) {
    throw new Error(`cannot identify batch candidate tree for commit ${head}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  const cwd = join(root, '.cland/run/merge-batches', id);
  return { base, head, tree, cwd, budgetLines: [...new Set(budgetLines)] };
}

export async function checkoutMergeBatch(root: string, candidate: BatchCandidate, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await mkdir(join(root, '.cland/run/merge-batches'), { recursive: true });
  // A persisted preparation can survive a crash before admission. Never rewrite
  // a candidate while its worker runs; the controller materializes only before submission.
  const exists = await stat(candidate.cwd).then(() => true, error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  });
  if (exists) {
    const head = await territoryGitAsync(candidate.cwd, ['rev-parse', 'HEAD'], false, undefined, env);
    if (head !== candidate.head) throw new Error('existing batch checkout differs from its durable head');
    return;
  }
  await territoryGitAsync(root, ['worktree', 'add', '--detach', candidate.cwd, candidate.head], false, undefined, env);
}

/** Workers have a final collected receipt before the controller calls this. */
export async function removeMergeBatch(root: string, candidate: BatchCandidate, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const exists = await stat(candidate.cwd).then(() => true, error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  });
  if (exists) await removeWorktreeWithFixtures(candidate.cwd, () => territoryGitAsync(root, ['worktree', 'remove', candidate.cwd], false, undefined, env));
}
