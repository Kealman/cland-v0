import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

type Git = (...args: string[]) => Promise<string>;
const fetching = new Map<string, Promise<string>>();

/** Linked worktrees update the same remote ref. One bounded fetch serves a burst
 * of admissions, each of which retains the resulting immutable commit. */
export async function fetchSuiteDev(cwd: string, git: Git): Promise<string> {
  const common = await realpath(resolve(cwd, (await git('rev-parse', '--git-common-dir')).trim()));
  let pending = fetching.get(common);
  if (!pending) {
    pending = (async () => {
      await git('fetch', '--no-write-fetch-head', 'origin', '+refs/heads/dev:refs/remotes/origin/dev');
      return (await git('rev-parse', '--verify', 'refs/remotes/origin/dev^{commit}')).trim();
    })();
    fetching.set(common, pending);
    void pending.finally(() => { if (fetching.get(common) === pending) fetching.delete(common); }).catch(() => {});
  }
  return pending;
}

/** Keep useful Git stderr without publishing credentials, URLs or control lines. */
export function selectionFailure(error: unknown, env: NodeJS.ProcessEnv): string {
  // cland-allow-in: Git errors may expose stderr through their prototype.
  const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
  let text = stderr || (error instanceof Error ? error.message.split('\n')[0]! : String(error));
  const secrets = Object.entries(env).filter(([key, value]) => value && /token|secret|password|credential|authorization|api.?key/i.test(key)).map(([, value]) => value!).sort((a, b) => b.length - a.length);
  if (secrets.length) {
    const pattern = new RegExp(secrets.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    text = text.replace(pattern, '[redacted]');
  }
  return text.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[redacted URL]').replace(/[\x00-\x1f\x7f\u2028\u2029]+/g, ' ').slice(0, 300);
}
