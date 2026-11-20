import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { eventually } from './until.ts';
import type { GitProcess } from '../src/git-command-owner.ts';

export type OwnerTrace = { record: string; parent: number; child?: GitProcess; command?: string[]; class?: string; ownedMode?: string; nativeClose?: { code: number | null; signal: string | null } };

let publication = 0;
export function publishOwnerTrace(path: string, value: OwnerTrace): void {
  const temporary = `${path}.${process.pid}.${++publication}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, path);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* keep the publication failure */ }
    throw error;
  }
}

/** The close observer can publish after the owner's record retires. Join that
 * exact receipt with a bound rather than interpreting an absent trace as close. */
export function readOwnerTrace(path: string, accept: (trace: OwnerTrace) => boolean = () => true): Promise<OwnerTrace> {
  return eventually('original-child ownership trace publication', async () => {
    try {
      const trace = JSON.parse(await readFile(path, 'utf8')) as OwnerTrace;
      return trace && typeof trace.parent === 'number' && accept(trace) ? trace : undefined;
    } catch (error) {
      if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }, 1000);
}
