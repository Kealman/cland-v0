import { createHash } from 'node:crypto';
import { territoryGitAsync as git } from './territory.ts';
import type { Resumed } from './hub/worktrees.ts';

export type HomebrewPlan = { tap: string; branch: 'main'; file: 'Formula/cland.rb'; version: string; url: string; sha256?: string; commit?: string };
export type HomebrewResult = { status: 'skipped'; message: string } | (HomebrewPlan & { status: 'planned' | 'published' });

export function renderFormula(template: string, source: { version: string; url: string; sha256: string }): string {
  if (!/^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/.test(source.version)
    || !/^https:\/\/[^\s"\\]+$/.test(source.url) || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('Invalid Homebrew source version, URL or sha256');
  for (const key of ['VERSION', 'URL', 'SHA256']) if (!template.includes(`@@${key}@@`)) throw new Error(`Homebrew template lacks ${key}`);
  return template.replaceAll('@@VERSION@@', source.version.slice(1)).replaceAll('@@URL@@', source.url).replaceAll('@@SHA256@@', source.sha256);
}

export function homebrewDescription(result: HomebrewResult): string {
  return result.status === 'skipped' ? result.message
    : `Homebrew ${result.status}: ${result.tap} ${result.branch} ${result.file} ${result.version}\n${result.url}\nsha256 ${result.sha256 ?? 'computed from the published tag tarball after the product push'}${result.commit ? `\ntap commit ${result.commit}` : ''}`;
}

/** Hash the actual published archive, with a bounded lifetime and byte count. */
export async function archiveSha256(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`Homebrew archive download failed: HTTP ${response.status}`);
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 64 * 1024 * 1024) throw new Error('Homebrew archive exceeds 64 MiB');
    hash.update(chunk);
  }
  if (!bytes) throw new Error('Homebrew archive is empty');
  return hash.digest('hex');
}

/** Change one tree entry without a checkout or index; keep every unrelated tap path. */
async function replaceEntry(root: string, tree: string | null, name: string, mode: string, kind: string, object: string, env: NodeJS.ProcessEnv, run: typeof git): Promise<string> {
  const rows = tree ? (await run(root, ['ls-tree', '-z', tree], false, undefined, env)).split('\0').filter(Boolean) : [];
  const kept = rows.filter(row => row.slice(row.indexOf('\t') + 1) !== name);
  kept.push(`${mode} ${kind} ${object}\t${name}`);
  return (await run(root, ['mktree', '-z'], false, kept.join('\0') + '\0', env)).trim();
}

/** Called only within the authorized release transaction, after product publication.
 * The push lease protects races; the commit's parent proves a fast-forward.
 * Compare the actual remote file on retry to recover a lost successful push reply.
 */
export async function publishFormula(root: string, plan: HomebrewPlan, formula: string, resumed: Resumed, authorize: () => void, env: NodeJS.ProcessEnv, run: typeof git = git): Promise<string> {
  const remote = `https://github.com/${plan.tap}.git`;
  resumed(authorize);
  const refs = await run(root, ['ls-remote', '--refs', '--', remote, `refs/heads/${plan.branch}`], false, undefined, env);
  const before = refs.split(/\s+/)[0];
  if (before) await run(root, ['fetch', '--no-auto-maintenance', '--no-tags', '--no-write-fetch-head', '--refmap=', '--', remote, before], false, undefined, env);
  resumed(authorize);
  const blob = await run(root, ['hash-object', '-w', '--stdin'], false, formula, env);
  if (before) {
    const previous = await run(root, ['rev-parse', '--verify', `${before}:${plan.file}`], false, undefined, env).catch(() => null);
    if (previous === blob) return before;
  }
  const subtree = before ? await run(root, ['rev-parse', '--verify', `${before}:Formula`], false, undefined, env).catch(() => null) : null;
  const formulaTree = await replaceEntry(root, subtree, 'cland.rb', '100644', 'blob', blob, env, run);
  const tree = await replaceEntry(root, before || null, 'Formula', '040000', 'tree', formulaTree, env, run);
  const commit = await run(root, ['commit-tree', tree, ...(before ? ['-p', before] : [])], false, `cland ${plan.version}\n\nSource: ${plan.url}\nSHA256: ${plan.sha256}\n`, env);
  resumed(authorize);
  await run(root, ['push', `--force-with-lease=refs/heads/${plan.branch}:${before ?? ''}`, '--', remote, `${commit}:refs/heads/${plan.branch}`], true, undefined, env);
  return commit;
}
