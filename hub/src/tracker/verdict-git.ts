// Read-only Git facts for verdicts, all asynchronous: no git process ever runs on the hub's event loop (T-67).
// What a request reads is the freshness cache (`freshness.ts`), never these.
import { execFile } from 'node:child_process';

/**
 * One git command in the project: its trimmed output, or null when git said no (a non-zero exit). It rejects when git
 * could not answer at all (not started, timed out, killed): that is no fact to keep. Tests inject one to count spawns.
 */
export type Git = (args: string[], input?: string) => Promise<string | null>;

export function gitIn(root: string): Git {
  return (args, input) =>
    new Promise((resolve, reject) => {
      const child = execFile('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
        if (!err) resolve(stdout.trim());
        else if (typeof err.code === 'number' && !err.killed) resolve(null);
        else reject(err);
      });
      child.stdin?.on('error', () => {});
      child.stdin?.end(input ?? '');
    });
}

export const resolveCommit = (git: Git, ref: string): Promise<string | null> => git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);

/** Every local branch with its tip, in one cheap call; null when the project is no Git repository. */
export async function branchTips(git: Git, resumed: <T>(work: () => T) => T = work => work()): Promise<Map<string, string> | null> {
  const out = await git(['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads/']);
  return resumed(() => {
    if (out === null) return null;
    const tips = new Map<string, string>();
    for (const line of out.split('\n')) {
      const m = /^([0-9a-f]{40,64}) refs\/heads\/(.+)$/.exec(line.trim());
      if (m) tips.set(m[2]!, m[1]!);
    }
    return tips;
  });
}

/** dev is the integration branch; main works in projects that have not adopted the territory yet. */
export const verdictBaseOf = (tips: ReadonlyMap<string, string>): 'dev' | 'main' | null => (tips.has('dev') ? 'dev' : tips.has('main') ? 'main' : null);

/**
 * The patch id of the whole task diff of `sha` against its own merge base with `base`: 'empty' for no diff, null when
 * Git cannot say. Comparing it, not the last commit's patch, keeps a verdict current across a rebase that keeps the diff.
 */
export async function taskPatch(git: Git, base: string, sha: string): Promise<string | null> {
  const mergeBase = await git(['merge-base', `refs/heads/${base}`, sha]);
  if (!mergeBase) return null;
  // Ignore external diff drivers, textconv and user-configured diff algorithms.
  const diff = await git(['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--binary', '--diff-algorithm=myers', '--no-renames', mergeBase, sha, '--']);
  if (diff === null) return null;
  if (!diff) return 'empty';
  const id = await git(['patch-id', '--stable'], diff + '\n');
  return id?.split(/\s+/)[0] || null;
}
