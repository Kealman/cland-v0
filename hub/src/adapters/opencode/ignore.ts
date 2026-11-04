import type { Host } from '../../host/host.ts';
import { join } from 'node:path';
import type { Resumed } from '../../hub/worktrees.ts';
import { continueWith, wait } from '../continuations.ts';
const GENERATED_IGNORE = '# managed by cland: generated OpenCode configs and server passwords, never committed\n*\n';

/** Publish new metadata without clobbering; repair existing contents only by appending the missing rule. */
export async function prepareIgnore(root: string, resumed: Resumed, log: (entry: Record<string, unknown>) => void, host: Host): Promise<void> {
  return continueWith((function* (): Generator<Promise<unknown>, void, unknown> {
    const ignore = join(root, '.gitignore');
    function* wildcard(content: string): Generator<Promise<unknown>, void, unknown> {
      if (content.split(/\r?\n/).includes('*')) return;
      // Always include a separator: a concurrent edit may have removed the final newline.
      yield* wait(host.appendFile(ignore, Buffer.from('\n*\n')));
    }
    let before: string | null;
    try { before = yield* wait(host.readFile(ignore).then(bytes => Buffer.from(bytes).toString('utf8'))); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; before = null; }
    if (before !== null) { yield* wildcard(before); return; }
    let current: string | null;
    try { current = yield* wait(host.readFile(ignore).then(bytes => Buffer.from(bytes).toString('utf8'))); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; current = null; }
    const conflict = () => log({ event: 'opencode-ignore-conflict', path: ignore, warning: 'shared .gitignore changed during launch preparation; preserved its contents and added only a missing wildcard rule' });
    if (current !== null) { conflict(); yield* wildcard(current); return; }
    // No-clobber publication also protects a file created after the last read.
    if (!(yield* wait(host.publishFile(ignore, Buffer.from(GENERATED_IGNORE))))) {
      conflict();
      yield* wildcard(yield* wait(host.readFile(ignore).then(bytes => Buffer.from(bytes).toString('utf8'))));
    }
  })(), resumed);
}

