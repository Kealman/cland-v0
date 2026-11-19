import { basename, isAbsolute, join } from 'node:path';
import { closeSync, constants, fstatSync, linkSync, openSync, readSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export const fakeStorageDirectory = (root:string) => join(root,'.fixture-sockets');

/** Runtime identities belong to their original root, never its copies/images. */
export const fixtureCopyFilter = (source: string): boolean => basename(source) !== '.fixture-sockets';

/** Called only after the owner validates its private storage directory. Ignore
 * this file too, before any runtime receipt, marker or reciprocal alias exists.
 * Publish complete bytes without replacing an existing file or following links. */
export function ignoreFixtureStorage(directory: string): void {
  const ignore = join(directory, '.gitignore');
  const validate = () => {
    const fd = openSync(ignore, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = fstatSync(fd);
      if (!info.isFile() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0 || info.size !== 2) throw new Error('fixture storage ignore is not private or complete');
      const bytes = Buffer.alloc(3), kept = readSync(fd, bytes, 0, bytes.length, 0);
      if (kept !== 2 || bytes.subarray(0, kept).toString() !== '*\n') throw new Error('fixture storage ignore is not private or complete');
    } finally { closeSync(fd); }
  };
  try { validate(); return; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const temporary = join(directory, `.gitignore-${randomUUID()}`);
  writeFileSync(temporary, '*\n', { flag: 'wx', mode: 0o600 });
  const failures: unknown[] = [];
  try {
    try { linkSync(temporary, ignore); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    validate();
  } catch (error) { failures.push(error); }
  try { unlinkSync(temporary); } catch (error) { failures.push(error); }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'fixture storage ignore publication and cleanup failed', { cause: failures[0] });
}
export function validateFakeHost(root:string,name:string):void {
  if(!isAbsolute(root)||!/^[a-zA-Z0-9_-]+$/.test(name))throw new Error('invalid fake host root/name');
}
export function fakeMachineStorageDirectory(root:string,name:string):string {
  validateFakeHost(root,name);return join(fakeStorageDirectory(root),name);
}

/** Lexical login mount mapping; callers validate attachment and ancestors. */
export const fakeLoginMountPath = (directory:string, path:string):string => join(directory,path);
