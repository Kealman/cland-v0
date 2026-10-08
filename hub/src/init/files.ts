// What provisioning writes with: a file is written only when its bytes would change (so `cland init` run twice
// changes nothing, mtimes included), and every step reports what it did to one path.
//
// Nothing is written through a symlink (review of #39): every component of a destination inside the project, the
// file and each folder above it, is `lstat`ed first, and a link among them leaves the path alone (`kept`, note
// `symlink: …`). The write itself goes to a fresh temporary file (`O_CREAT|O_EXCL`, which never follows a link) that
// is renamed over the destination, so a link planted after the check is replaced, never written through.
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs';
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

/** Write `data` to `path` by a temporary file renamed over it: never through a link, never half-written. */
export function writeAtomic(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  let mode = 0o666;
  try {
    const s = lstatSync(path);
    if (s.isFile()) mode = s.mode & 0o7777;
  } catch {
    /* absent */
  }
  const tmp = join(dirname(path), `.${randomBytes(6).toString('hex')}.cland-tmp`);
  const fd = openSync(tmp, 'wx', mode);
  try {
    writeSync(fd, typeof data === 'string' ? Buffer.from(data) : data);
  } catch (err) {
    closeSync(fd);
    rmSync(tmp, { force: true });
    throw err;
  }
  closeSync(fd);
  renameSync(tmp, path);
}

/** Write `text` unless the file already holds exactly that; reports created, updated or unchanged (or kept: a link). */
export function writeIfChanged(report: Report, path: string, text: string, current?: string | null): void {
  if (refuseSymlink(report, path)) return;
  if (current === undefined) current = readText(path);
  if (current === text) {
    report.add(path, 'unchanged');
    return;
  }
  writeAtomic(path, text);
  report.add(path, current === null ? 'created' : 'updated');
}

/** Whether a whole file is cland's: it carries the mark (in its first lines, where every managed file puts it). */
export const isManagedFile = (text: string): boolean => text.split('\n').slice(0, 3).some((l) => /managed by cland\b/.test(l));
