// Publish the root's committed dev and refresh origin/dev, without changing the checkout. Caller holds the territory lock.
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { hasTerritory, territoryGitAsync as git, territoryPath, TerritoryGitError } from './territory.ts';
import type { Resumed } from './hub/worktrees.ts';

export type PushCode = 'push-territory' | 'push-state' | 'push-behind' | 'push-changed' | 'push-git' | 'push-outcome-unknown';
export class PushError extends Error {
  readonly code: PushCode;
  constructor(code: PushCode, message: string) { super(`${code}: ${message}`); this.code = code; }
}
export type PushResult = { dev: string; previous: string; followUp?: { step: string; error: string } };

export async function pushDev(root: string, resumed: Resumed, authorize: () => void, run: typeof git = git, env: NodeJS.ProcessEnv = process.env): Promise<PushResult> {
  const execute = run;
  run = (cwd, args, marked, input) => execute(cwd, args, marked, input, env);
  resumed(authorize);
  const managed = await hasTerritory(root, env, run);
  resumed(() => { if (!managed) throw new PushError('push-territory', 'the project has no managed territory'); });
  for (const operation of ['release', 'sync', 'publish']) {
    const pending = await access(join(root, '.cland', `${operation}.tmp`)).then(() => true, err => {
      return resumed(() => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; });
    });
    resumed(() => { if (pending) throw new PushError('push-state', `finish pending cland ${operation} before pushing dev`); });
  }
  const checkout = await run(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  resumed(() => { if (checkout !== 'dev') throw new PushError('push-state', 'the project root must be on dev'); });
  const dev = await run(root, ['rev-parse', '--verify', 'refs/heads/dev']);
  const previous = await run(territoryPath(root), ['rev-parse', '--verify', 'refs/heads/dev']);
  // Fetch objects only: remote work must be nameable even if this root has never seen it. No tracking ref or FETCH_HEAD.
  await run(root, ['fetch', '--no-write-fetch-head', '--no-tags', territoryPath(root), previous]);
  const ancestor = await run(root, ['merge-base', '--is-ancestor', previous, dev]).then(() => true, err => resumed(() => { if (err instanceof TerritoryGitError && err.code === 1) return false; throw err; }));
  if (!ancestor) {
    const commits = await run(root, ['log', '--format=%h %s', `${dev}..${previous}`, '--']);
    resumed(() => { throw new PushError('push-behind', `territory dev has commits the root lacks:\n${commits}\nreconcile dev before cland push; only a fast-forward is allowed`); });
  }
  const current = await run(root, ['rev-parse', '--verify', 'refs/heads/dev']);
  const currentCheckout = await run(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  resumed(() => {
    authorize();
    if (current !== dev || currentCheckout !== 'dev') throw new PushError('push-changed', 'the root moved while dev was checked; try again');
  });
  try {
    // Pin the checked commit, never a configurable remote/push URL, never force.
    await run(root, ['push', territoryPath(root), `${dev}:refs/heads/dev`], true);
  } catch (err) {
    // A transport can lose its reply after acceptance. Confirm the pinned commit before calling it a refusal.
    let actual: string;
    try { actual = await run(territoryPath(root), ['rev-parse', '--verify', 'refs/heads/dev']); }
    catch (confirmation) {
      resumed(() => { throw new PushError('push-outcome-unknown', `publication outcome is unknown for dev ${dev}; verify territory dev and retry cland push. Push failed: ${String(err)}; confirmation failed: ${String(confirmation)}`); });
      throw confirmation;
    }
    resumed(() => { if (actual !== dev) throw new PushError('push-git', err instanceof Error ? err.message : String(err)); });
  }
  try {
    await run(root, ['update-ref', 'refs/remotes/origin/dev', dev]);
  } catch (err) {
    return resumed(() => ({ dev, previous, followUp: { step: 'tracking-ref', error: `pushed; follow-up failed: origin/dev: ${String(err)}; retry cland push` } }));
  }
  return resumed(() => ({ dev, previous }));
}
