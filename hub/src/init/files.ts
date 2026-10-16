// What provisioning writes with: a file is written only when its bytes would change (so `cland init` run twice
// changes nothing, mtimes included), and every step reports what it did to one path.
//
// Nothing is written through a symlink (review of #39): every component of a destination inside the project, the
// file and each folder above it, is `lstat`ed first, and a link among them leaves the path alone (`kept`, note
// `symlink: …`). The write itself goes to a fresh temporary file (`O_CREAT|O_EXCL`, which never follows a link) that
// is renamed over the destination, so a link planted after the check is replaced, never written through. The folders
// above are pinned by device and inode from the check to the rename (`writeAtomic`), so a folder swapped for a link
// in between refuses the write.
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';

/**
 * What one step did to one path: `created` and `updated` are cland's writes, `unchanged` a managed part already
 * current, `kept` something of the user's left alone (with the reason), `removed` a managed part cland no longer ships.
 */
export type Action = 'created' | 'updated' | 'unchanged' | 'kept' | 'removed';
export type Change = { path: string; action: Action; note?: string };

/** Collects the changes of one run, paths relative to the project root. */
export class Report {
  readonly root: string;
  readonly changes: Change[] = [];
  constructor(root: string) {
    this.root = root;
  }
  add(path: string, action: Action, note?: string): void {
    this.changes.push({ path: relative(this.root, path) || '.', action, ...(note ? { note } : {}) });
  }
}

export function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * The first symlink on the way from `root` (exclusive) to `path` (inclusive), relative to `root`, or null when
 * there is none (components that do not exist yet are not links). A path outside `root` counts as one: it is refused.
 */
export function symlinkOnPath(root: string, path: string): string | null {
  const rel = relative(root, path);
  if (rel === '') return null;
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) return rel;
  let at = root;
  for (const part of rel.split(sep)) {
    at = join(at, part);
    try {
      if (lstatSync(at).isSymbolicLink()) return relative(root, at);
    } catch {
      return null; // absent: nothing below it exists either
    }
  }
  return null;
}

/** The note a path refused for a link carries. */
export const symlinkNote = (link: string): string => `symlink: ${link} is a symbolic link; cland does not write through it (replace it with a real file or folder, then run cland update)`;

/** Report `path` as kept when a link lies on it; true when it does. */
export function refuseSymlink(report: Report, path: string): boolean {
  const link = symlinkOnPath(report.root, path);
  if (link === null) return false;
  report.add(path, 'kept', symlinkNote(link));
  return true;
}

/** The folders from `root` (inclusive) down to `dir` (inclusive), each by its device and inode; or the first one, relative
 *  to `root`, that is a link or no folder (`root` itself is followed: it is where the project is). */
function folderChain(root: string, dir: string): Array<{ path: string; dev: number; ino: number }> | string {
  const chain: Array<{ path: string; dev: number; ino: number }> = [];
  const top = statSync(root);
  chain.push({ path: root, dev: top.dev, ino: top.ino });
  const rel = relative(root, dir);
  if (rel === '') return chain;
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) return rel;
  let at = root;
  for (const part of rel.split(sep)) {
    at = join(at, part);
    let s;
    try {
      s = lstatSync(at);
    } catch {
      return relative(root, at);
    }
    if (s.isSymbolicLink() || !s.isDirectory()) return relative(root, at);
    chain.push({ path: at, dev: s.dev, ino: s.ino });
  }
  return chain;
}

/** The first folder of `chain` that is no longer the one it was (replaced, moved, a link now), relative to `root`. */
function chainChanged(root: string, chain: Array<{ path: string; dev: number; ino: number }>): string | null {
  for (const [i, f] of chain.entries()) {
    let s;
    try {
      s = i === 0 ? statSync(f.path) : lstatSync(f.path);
    } catch {
      return relative(root, f.path) || '.';
    }
    if ((i > 0 && s.isSymbolicLink()) || !s.isDirectory() || s.dev !== f.dev || s.ino !== f.ino) return relative(root, f.path) || '.';
  }
  return null;
}

/**
 * Write `data` to `path` (inside `root`) by a temporary file renamed over it: never half-written, never through a link.
 * The exclusive create protects only the last component, so the folders above are pinned too: each one from `root`
 * down is `lstat`ed (a link refuses the write) and its device and inode noted before the temporary file is created,
 * and compared again just before the rename. A folder swapped in between (for a link, or another folder) refuses the
 * write and removes the temporary file. Returns null when written, else the folder (relative to `root`) that refused.
 *
 * What remains: Node has no `openat`/`renameat`, so a swap in the instant between the second check and the rename
 * still lands the file through the swapped folder; and a temporary file created in a folder that was then moved
 * away is left there (its name is `.<random>.cland-tmp`).
 * When `expected` is supplied, refuse if the destination's bytes changed since the caller read them.
 */
export function writeAtomic(root: string, path: string, data: string | Buffer, expected?: string): string | null {
  const dir = dirname(path);
  // what exists of the way down is checked before anything is created on it
  const link = symlinkOnPath(root, dir);
  if (link !== null) return link;
  mkdirSync(dir, { recursive: true });
  const chain = folderChain(root, dir);
  if (typeof chain === 'string') return chain;
  let mode = 0o666;
  try {
    const s = lstatSync(path);
    if (s.isFile()) mode = s.mode & 0o7777;
  } catch {
    /* absent */
  }
  testPause(path);
  const tmp = join(dir, `.${randomBytes(6).toString('hex')}.cland-tmp`);
  const fd = openSync(tmp, 'wx', mode);
  try {
    writeSync(fd, typeof data === 'string' ? Buffer.from(data) : data);
  } catch (err) {
    closeSync(fd);
    rmSync(tmp, { force: true });
    throw err;
  }
  closeSync(fd);
  const changed = chainChanged(root, chain);
  if (changed !== null) {
    rmSync(tmp, { force: true });
    return changed;
  }
  if (expected !== undefined) {
    try {
      if (readFileSync(path, 'utf8') !== expected) throw new Error('file changed while setting it; retry');
    } catch (error) {
      rmSync(tmp, { force: true });
      throw error;
    }
  }
  renameSync(tmp, path);
  return null;
}

/** For tests only: `CLAND_TEST_INIT_WRITE_PAUSE_MS` holds the write of the path ending in
 *  `CLAND_TEST_INIT_WRITE_PAUSE_PATH` still after its checks, before its temporary file is created, and says so on stderr. */
function testPause(path: string): void {
  const ms = Number(process.env.CLAND_TEST_INIT_WRITE_PAUSE_MS ?? 0);
  const which = process.env.CLAND_TEST_INIT_WRITE_PAUSE_PATH;
  if (!(ms > 0) || !which || !path.endsWith(which)) return;
  writeSync(2, `cland: test pause before writing ${which}\n`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Write `text` unless the file already holds exactly that; reports created, updated or unchanged (or kept: a link). */
export function writeIfChanged(report: Report, path: string, text: string, current?: string | null): void {
  if (refuseSymlink(report, path)) return;
  if (current === undefined) current = readText(path);
  if (current === text) {
    report.add(path, 'unchanged');
    return;
  }
  const refused = writeAtomic(report.root, path, text);
  if (refused !== null) return report.add(path, 'kept', symlinkNote(refused));
  report.add(path, current === null ? 'created' : 'updated');
}

/** Whether a whole file is cland's: it carries the mark (in its first lines, where every managed file puts it). */
export const isManagedFile = (text: string): boolean => text.split('\n').slice(0, 3).some((l) => /managed by cland\b/.test(l));
