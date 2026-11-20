import { constants, openSync, readSync, fstatSync, fsyncSync, closeSync, lstatSync, realpathSync, readlinkSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, basename } from 'node:path';
import type { AliasClosure } from './fixture-cleanup-plan.ts';

export const aliasClosureFile = 'alias-closed.json';
export function invalidateAliasClosure(storage: string): void {
  try { unlinkSync(join(storage, aliasClosureFile)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
/** Caller has joined listeners, peers and children before entering teardown. */
export function recordAliasClosure(path: string, target: string): void {
  const alias = lstatSync(path), storage = lstatSync(target);
  const proof: AliasClosure = { version: 1, boundary: 'listeners-peers-children-drained', path, target,
    alias: { dev: alias.dev, ino: alias.ino }, storage: { dev: storage.dev, ino: storage.ino } };
  const temporary = join(target, aliasClosureFile + '.' + randomUUID() + '.pending');
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(proof)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, join(target, aliasClosureFile));
  const directory = openSync(target, 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}
/** Bounded, no-follow receipt read. A legacy alias or any uncertainty stays kept. */
export function readAliasClosure(path: string): AliasClosure | null {
  let fd: number | undefined;
  try {
    if (!/^ct-[a-f0-9]{32}$/.test(basename(path))) return null;
    const alias = lstatSync(path), target = readlinkSync(path);
    if (!alias.isSymbolicLink() || alias.uid !== process.getuid?.() || basename(target) !== '.fixture-sockets' || realpathSync(target) !== target) return null;
    const storage = lstatSync(target);
    if (!storage.isDirectory() || storage.uid !== alias.uid || (storage.mode & 0o077) !== 0 || readlinkSync(join(target, 'alias')) !== path) return null;
    fd = openSync(join(target, aliasClosureFile), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = fstatSync(fd);
    if (!info.isFile() || info.uid !== alias.uid || (info.mode & 0o077) !== 0) return null;
    const buffer = Buffer.alloc(4097);
    let kept = 0;
    while (kept < buffer.length) { const n = readSync(fd, buffer, kept, buffer.length - kept, null); if (!n) break; kept += n; }
    if (kept > 4096) return null;
    const proof = JSON.parse(buffer.subarray(0, kept).toString()) as AliasClosure;
    if (proof.version !== 1 || proof.boundary !== 'listeners-peers-children-drained' || proof.path !== path || proof.target !== target ||
      proof.alias.dev !== alias.dev || proof.alias.ino !== alias.ino || proof.storage.dev !== storage.dev || proof.storage.ino !== storage.ino) return null;
    // Parent canonicality prevents an aliased literal path from escaping its plan.
    if (realpathSync(dirname(path)) !== dirname(path)) return null;
    return proof;
  } catch { return null; }
  finally { if (fd !== undefined) closeSync(fd); }
}
