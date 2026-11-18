import { lstat, readlink, realpath } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';

export class DirectoryMoveUnknown extends Error {
  readonly code = 'CLAND_DIRECTORY_MOVE_UNKNOWN';
  readonly moveOutcome = 'unknown';
}

const overlaps = (a: string, b: string) => a === b || a.startsWith(b.endsWith(sep) ? b : b + sep) || b.startsWith(a.endsWith(sep) ? a : a + sep);
const conflicts = (a: readonly string[], b: readonly string[]) => a.some(left => b.some(right => overlaps(left, right)));
async function canonical(path: string): Promise<string> {
  const suffix: string[] = [];
  let current = resolve(path);
  let links = 0;
  for (;;) {
    try { return resolve(await realpath(current), ...suffix); }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      const info = await lstat(current).catch(failure => {
        if (['ENOENT', 'ENOTDIR'].includes((failure as NodeJS.ErrnoException).code ?? '')) return null;
        throw failure;
      });
      // realpath cannot resolve a dangling final link, although a following
      // write/open may create its referent. Retain that directory's authority.
      if (info?.isSymbolicLink()) {
        if (++links > 40) throw Object.assign(new Error('Host file symlink chain did not stabilize'), {code:'ELOOP'});
        current = resolve(dirname(current), await readlink(current));
        continue;
      }
      const parent = dirname(current);
      if (parent === current) throw error;
      suffix.unshift(basename(current)); current = parent;
    }
  }
}
async function keysFor(paths: readonly string[]): Promise<string[]> {
  return [...new Set([...paths.map(path => resolve(path)), ...await Promise.all(paths.map(canonical))])].sort();
}

/** One process owns Host-managed filesystem mutations. Overlapping directories
 * serialize; disjoint session directories proceed independently. Native writers
 * outside this owner are outside the supported concurrency model. */
class DirectoryOwners {
  #active = new Set<readonly string[]>();
  #waiting: Array<{keys: readonly string[]; grant: (release: () => void) => void}> = [];
  #fenced: Array<{keys: readonly string[]; cause: unknown}> = [];
  #check(keys: readonly string[]): void {
    const fence = this.#fenced.find(row => conflicts(keys, row.keys));
    if (fence) throw Object.assign(new Error('Host directory owner fenced after an unknown move', {cause:fence.cause}), {code:'CLAND_DIRECTORY_OWNER_FENCED'});
  }
  #pump(): void {
    for (let i = 0; i < this.#waiting.length;) {
      const request = this.#waiting[i]!;
      if ([...this.#active].some(keys => conflicts(keys, request.keys)) || this.#waiting.slice(0, i).some(row => conflicts(row.keys, request.keys))) { i++; continue; }
      this.#waiting.splice(i, 1); this.#active.add(request.keys);
      request.grant(() => { this.#active.delete(request.keys); this.#pump(); });
    }
  }
  /** Following a file also owns its entry directory and canonical referent. */
  runFile<T>(path: string, operation: () => Promise<T>): Promise<T> {
    return this.run([dirname(path), path], operation);
  }
  async run<T>(paths: readonly string[], operation: () => Promise<T>): Promise<T> {
    // Re-resolve after admission: a preceding Host owner may have moved an alias.
    for (let attempt = 0; attempt < 8; attempt++) {
      const keys = await keysFor(paths); this.#check(keys);
      const release = await new Promise<() => void>(grant => { this.#waiting.push({keys,grant}); this.#pump(); });
      try {
        this.#check(keys);
        if (JSON.stringify(await keysFor(paths)) !== JSON.stringify(keys)) continue;
        try { return await operation(); }
        catch (error) {
          if (error instanceof DirectoryMoveUnknown) this.#fenced.push({keys,cause:error});
          throw error;
        }
      } finally { release(); }
    }
    throw new Error('Host directory owner path did not stabilize');
  }
}

export const directoryOwners = new DirectoryOwners();
