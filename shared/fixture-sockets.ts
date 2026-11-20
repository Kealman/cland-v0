import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { opendir } from 'node:fs/promises';

import { fakeStorageDirectory as socketDirectory, ignoreFixtureStorage } from './fake-layout.ts';
import { FIXTURE_HOST_SOCKET_ROOT, FIXTURE_OWNED_ROOT } from './fixture-roots.ts';
import { invalidateAliasClosure, recordAliasClosure } from './fixture-alias-closure.ts';
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const optedInRoots = new Map<string, {device:number;inode:number}>();

/** Allocation grants are scoped to the exact scratch inode, including descendants. */
export function allocatedFixtureRoot(path: string): boolean {
  for (const [root, identity] of optedInRoots) {
    if (path !== root && !path.startsWith(root + '/')) continue;
    try { const info = lstatSync(root); if (info.dev === identity.device && info.ino === identity.inode) return true; } catch { /* missing grant */ }
  }
  for (const key of [FIXTURE_OWNED_ROOT, FIXTURE_HOST_SOCKET_ROOT]) {
    const inherited = process.env[key];
    if (!inherited) continue;
    try { const root = realpathSync(inherited); if (root !== '/' && (path === root || path.startsWith(root + '/'))) return true; } catch { /* missing grant */ }
  }
  return false;
}

/** Short endpoints for explicitly owned fixture projects only. */
export function fixtureFallbackSocket(root: string, endpoint: string): string | undefined {
  // Ordinary path planning stays pure, including callers with nonexistent roots.
  if (!optedInRoots.has(root) && process.env[FIXTURE_HOST_SOCKET_ROOT] !== root) return;
  return fixtureHostSocketDirectory(root, 'endpoints') === undefined ? undefined : fixtureSocketPath(root, endpoint);
}

/** Register without adding root entries. Persist only at first allocation;
 * child launchers carry the exact root through the shared fixture environment. */
export function enableFixtureHostSockets(root: string): () => void {
  const canonical = realpathSync(root), info = lstatSync(canonical);
  const registered = {device:info.dev,inode:info.ino};
  optedInRoots.set(canonical,registered);
  return () => { if (optedInRoots.get(canonical) === registered) optedInRoots.delete(canonical); };
}

export function fixtureHostSocketDirectory(root: string, id: string): string | undefined {
  const directory = socketDirectory(root), marker = join(directory, 'host-paths');
  if (!existsSync(marker)) {
    let canonical:string;
    try { canonical = realpathSync(root); } catch (error) { if (missing(error)) return; throw error; }
    const registered = optedInRoots.get(canonical), info = lstatSync(canonical);
    const inherited = process.env[FIXTURE_HOST_SOCKET_ROOT];
    let childOptIn = false;
    if (inherited && isAbsolute(inherited) && inherited !== '/') {
      try { childOptIn = realpathSync(inherited) === canonical; } catch (error) { if (!missing(error)) throw error; }
    }
    if (!(registered?.device === info.dev && registered.inode === info.ino) && !childOptIn) return;
    mkdirSync(directory, {recursive:true,mode:0o700});
    privateDirectory(directory);
    ignoreFixtureStorage(directory);
    try { writeFileSync(marker, '', {mode:0o600,flag:'wx'}); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  const alias = dirname(fixtureSocketPath(root, 'host-paths'));
  return join(alias, createHash('sha256').update(id).digest('hex').slice(0, 16));
}

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
  invalidateAliasClosure(directory);
  ignoreFixtureStorage(directory);
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
  // Capture this owner's grants before traversal. A replacement registration
  // must retain its own identity when the old scope finishes disposal.
  const registrations = [...optedInRoots].filter(([path]) => path === canonical || path.startsWith(canonical + '/'));
  // Stream only the disposable tree, without following any symlink. A killed
  // worker may have allocated under a nested fixture root unknown to its parent.
  const keys = new Set<string>(), pending = [canonical];
  while (pending.length) {
    const path = pending.pop()!;
    const entries = await opendir(path);
    for await (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.fixture-sockets') keys.add(path);
      pending.push(join(path, entry.name));
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
        recordAliasClosure(alias, directory);
        unlinkSync(alias);
      } catch (error) { if (!missing(error)) throw error; }
      unlinkSync(record);
    } catch (error) { if (!missing(error)) throw error; }
  }
  for (const [path, identity] of registrations) {
    if (optedInRoots.get(path) === identity) optedInRoots.delete(path);
  }
}
