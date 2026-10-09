// Read-only Git facts for verdicts. No cached refs: an external commit or rebase must be seen on view.
import { execFileSync } from 'node:child_process';

function git(root: string, args: string[], input?: string): string | null {
  try {
    return execFileSync('git', args, { cwd: root, input, encoding: 'utf8', timeout: 5000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}
export const resolveCommit = (root: string, ref: string): string | null => git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
export const branchTip = (root: string, branch: string | null): string | null => branch ? resolveCommit(root, `refs/heads/${branch}`) : null;

/** dev is the integration branch; main works in projects that have not adopted the territory yet. */
export function verdictBase(root: string): 'dev' | 'main' | null {
  if (branchTip(root, 'dev')) return 'dev';
  return branchTip(root, 'main') ? 'main' : null;
}

/** Compare the whole task diff, not just the last commit's patch, against each commit's own merge base. */
export function verdictCurrent(root: string, commit: string | undefined, tip: string | null, base: string | null): boolean {
  if (!commit || !tip) return false;
  const resolved = /^[0-9a-f]{4,64}$/i.test(commit) ? resolveCommit(root, commit) : null;
  if (!resolved) return false;
  if (resolved === tip) return true;
  if (!base) return false;
  const patch = (sha: string): string | null => {
    const mergeBase = git(root, ['merge-base', `refs/heads/${base}`, sha]);
    if (!mergeBase) return null;
    // Ignore external diff drivers, textconv and user-configured diff algorithms.
    const diff = git(root, ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--binary', '--diff-algorithm=myers', '--no-renames', mergeBase, sha, '--']);
    if (diff === null) return null;
    if (!diff) return 'empty';
    const id = git(root, ['patch-id', '--stable'], diff + '\n');
    return id?.split(/\s+/)[0] || null;
  };
  const reviewed = patch(resolved);
  return reviewed !== null && reviewed === patch(tip);
}
