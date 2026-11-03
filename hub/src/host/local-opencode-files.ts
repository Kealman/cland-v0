// Local atomic shared-ignore publication; remote equivalent is tracked by T-1644.
import { link, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Resumed } from '../hub/worktrees.ts';
import { continueWith, wait } from '../adapters/continuations.ts';
import type { LaunchFiles } from '../adapters/launch-files.ts';
const GENERATED_IGNORE = '# managed by cland: generated OpenCode configs and server passwords, never committed\n*\n';

/** Publish new metadata without clobbering; repair existing contents only by appending the missing rule. */
export async function prepareIgnore(root: string, transaction: LaunchFiles, resumed: Resumed, log: (entry: Record<string, unknown>) => void): Promise<void> {
  return continueWith((function* (): Generator<Promise<unknown>, void, unknown> {
    const ignore = join(root, '.gitignore');
    function* wildcard(content: string): Generator<Promise<unknown>, void, unknown> {
      if (content.split(/\r?\n/).includes('*')) return;
      // Always include a separator: a concurrent edit may have removed the final newline.
      yield* wait(writeFile(ignore, '\n*\n', { flag: 'a' }));
    }
    let before: string | null;
    try { before = yield* wait(readFile(ignore, 'utf8')); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; before = null; }
    if (before !== null) { yield* wildcard(before); return; }
    const staging = join(root, `.stage-${randomUUID()}.gitignore`);
    transaction.removeOnFailure(staging);
    try {
      yield* wait(writeFile(staging, GENERATED_IGNORE, { flag: 'wx' }));
      let current: string | null;
      try { current = yield* wait(readFile(ignore, 'utf8')); }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; current = null; }
      const conflict = () => log({ event: 'opencode-ignore-conflict', path: ignore, warning: 'shared .gitignore changed during launch preparation; preserved its contents and added only a missing wildcard rule' });
      if (current !== null) { conflict(); yield* wildcard(current); return; }
      // No-clobber publication also protects a file created after the last read.
      try { yield* wait(link(staging, ignore)); }
      catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        conflict();
        yield* wildcard(yield* wait(readFile(ignore, 'utf8')));
      }
    } finally { yield* wait(rm(staging, { force: true })); }
  })(), resumed);
}

