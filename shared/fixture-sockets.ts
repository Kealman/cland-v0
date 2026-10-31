import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readlinkSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { opendir } from 'node:fs/promises';

const socketDirectory = (root: string) => join(root, '.fixture-sockets');
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

function privateDirectory(path: string): void {
  const info = lstatSync(path);
  if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0) throw new Error('fixture socket directory is not private');
}
function validAlias(alias: string): void {
  if (dirname(alias) !== realpathSync('/tmp') || !/^ct-[a-f0-9]{32}$/.test(alias.slice(alias.lastIndexOf('/') + 1))) throw new Error('invalid fixture socket alias');
}

/** Actual socket nodes stay under the disposable root. Only a short symlink
 * lives outside it. Its reciprocal record precedes native alias creation so a
 * surviving directory owner can recover without the allocating worker's Map.
 */
export function fixtureSocketPath(root: string, endpoint: string): string {
  const key = realpathSync(root), directory = socketDirectory(key);
  try { mkdirSync(directory, { mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  privateDirectory(directory);
  const record = join(directory, 'alias');
  let alias: string;
  try { alias = readlinkSync(record); }
  catch (error) {
    if (!missing(error)) throw error;
    alias = join(realpathSync('/tmp'), `ct-${randomUUID().replaceAll('-', '')}`);
    try { symlinkSync(alias, record); }
    catch (failure) {
      if ((failure as NodeJS.ErrnoException).code !== 'EEXIST') throw failure;
      alias = readlinkSync(record);
    }
  }
  validAlias(alias);
  try { symlinkSync(directory, alias); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || readlinkSync(alias) !== directory) throw error;
  }
  const identity = createHash('sha256').update(endpoint).digest('hex').slice(0, 40);
  const path = join(alias, `${identity}.sock`);
  if (Buffer.byteLength(path, 'utf8') + 1 >= 104) throw new Error('fixture socket path including NUL must be under 104 UTF-8 bytes');
  return path;
}

/** Called only after positive listener/peer/child drainage. Recovery reads the
 * exact owned root, never sweeps /tmp, and only unlinks a verified reciprocal
 * symlink. Recursive socket-node deletion stays with ordinary root removal.
 */
export async function removeFixtureSockets(root: string): Promise<void> {
  let canonical: string;
  try { canonical = realpathSync(root); }
  catch (error) { if (!missing(error)) throw error; return; }
  // Stream only the disposable tree, without following any symlink. A killed
  // worker may have allocated under a nested fixture root unknown to its parent.
  const keys = new Set<string>(), pending = [canonical];
  while (pending.length) {
    const path = pending.pop()!;
    const entries = await opendir(path);
    for await (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.fixture-sockets') keys.add(path);
      else pending.push(join(path, entry.name));
    }
  }
  for (const key of keys) {
    const directory = socketDirectory(key), record = join(directory, 'alias');
    try {
      privateDirectory(directory);
      const alias = readlinkSync(record);
      validAlias(alias);
      try {
        if (readlinkSync(alias) !== directory) throw new Error('fixture socket alias ownership changed');
        unlinkSync(alias);
      } catch (error) { if (!missing(error)) throw error; }
      unlinkSync(record);
    } catch (error) { if (!missing(error)) throw error; }
  }
}
