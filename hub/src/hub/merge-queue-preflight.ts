// Immutable Git objects only; the caller holds the territory/worktree serialization.
import type { MergeQueueEntry } from '../protocol.ts';
import { MergeError } from '../merge.ts';
import { TerritoryGitError, mergeConflictFiles } from '../territory.ts';

type Git = (args: string[], input?: string) => Promise<string>;

export async function checkQueuedMerge(base: string, candidate: string, branch: string, item: string, entries: readonly MergeQueueEntry[], git: Git): Promise<void> {
  const members = entries.filter(entry => entry.item !== item);
  if (!members.length) return;
  const merge = async (left: string, right: string, context: string): Promise<string> => {
    try { return (await git(['merge-tree', '--write-tree', '--name-only', '-z', left, right])).split('\0')[0]!; }
    catch (error) {
      if (!(error instanceof TerritoryGitError) || error.code !== 1) throw error;
      const files = mergeConflictFiles(error.stdout);
      throw new MergeError('merge-conflict', `${context}; conflicts: ${files.join(', ')}`, files);
    }
  };
  // Keep the dev-conflict recovery instruction when dev itself is the cause.
  await merge(base, candidate, `rebase ${branch} on dev`);
  let head = base;
  const prefixes: Array<{ member: MergeQueueEntry; head: string }> = [];
  for (const member of members) {
    const tree = await merge(head, member.head, `queued member ${member.item} (${member.branch}, ${member.head}) conflicts with the preceding queue`);
    head = await git(['commit-tree', tree, '-p', head], `Queue preflight ${member.item}\n`);
    prefixes.push({ member, head });
  }
  const context = (member: MergeQueueEntry) => `${item} conflicts with queued member ${member.item} (${member.branch}, ${member.head})`;
  try { await merge(head, candidate, context(members.at(-1)!)); }
  catch (error) {
    if (!(error instanceof MergeError) || error.code !== 'merge-conflict') throw error;
    // Diagnose only a conflicting final queue: a later member may resolve an
    // earlier overlap. Prefix merge-tree receipts identify the introducing member.
    for (const prefix of prefixes.slice(0, -1)) await merge(prefix.head, candidate, context(prefix.member));
    throw error;
  }
}
