import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { appendFile, link, rename, open, mkdir, rm, rmdir, truncate, writeFile, chmod, stat, lstat, realpath, readFile } from 'node:fs/promises';
import { statDirectory } from './stat-directory.ts';
import { folderFiles } from './folder.ts';
import { directoryOwners, DirectoryMoveUnknown } from './directory-owner.ts';
export const MOVE_DIRECTORY_CAPABILITY = 'move-directory-v1';
export type DirectoryMoveOptions = { sourceIdentity?: { dev: number; ino: number } };
/** Unsupported is positive non-admission. Ambiguous effects throw DirectoryMoveUnknown. */
export type RenameNoReplace = (source: string, target: string) => Promise<'moved' | 'unsupported'>;
export function parseDirectoryMove(args: Record<string, unknown>): {source: string; target: string; options: DirectoryMoveOptions} {
  const {source, target} = args;
  if (typeof source !== 'string' || !source || source.includes('\0') || typeof target !== 'string' || !target || target.includes('\0')) throw new Error('directory move requires source and target paths');
  const options = args.options as DirectoryMoveOptions | undefined;
  if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) throw new Error('invalid directory move options');
  const identity = options?.sourceIdentity;
  if (identity !== undefined && (!identity || !Number.isSafeInteger(identity.dev) || identity.dev < 0 || !Number.isSafeInteger(identity.ino) || identity.ino < 0)) throw new Error('invalid directory move source identity');
  return {source, target, options: identity ? {sourceIdentity:{dev:identity.dev,ino:identity.ino}} : {}};
}
const rawFileOperations = {
    writeFile: async (path: string, bytes: Uint8Array, options?: {mode?: number; truncate?: number}) => {
      if (options?.truncate !== undefined) {
        if (bytes.byteLength) throw new Error('Host truncate requires empty bytes');
        await truncate(path, options.truncate);
      } else await writeFile(path, bytes, options?.mode === undefined ? {} : { mode: options.mode });
      if (options?.mode !== undefined) await chmod(path, options.mode);
    },
    publishFile: async (path: string, bytes: Uint8Array, options?: {mode?: number; replace?: boolean}): Promise<boolean> => {
      const staging = join(dirname(path), `.stage-${randomUUID()}`);
      const file = await open(staging, 'wx', options?.mode ?? 0o666);
      try {
        try { await file.writeFile(bytes); if (options?.mode !== undefined) await file.chmod(options.mode); await file.sync(); }
        finally { await file.close(); }
        if (options?.replace) await rename(staging, path);
        else {
          try { await link(staging, path); }
          catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false; throw error; }
        }
        return true;
      } finally { await rm(staging, {force: true}); }
    },
    appendFile: async (path: string, bytes: Uint8Array) => { await appendFile(path, bytes); },
    moveDirectory: async (source: string, target: string, options: DirectoryMoveOptions = {}, renameNoReplace?: RenameNoReplace): Promise<void> => {
      const capturedSource = await lstat(source);
      const same = (a: {dev:number;ino:number}, b: {dev:number;ino:number}) => a.dev === b.dev && a.ino === b.ino;
      const changed = (owner: string) => Object.assign(new Error(`${owner} directory identity changed`), {code:'CLAND_PATH_CHANGED'});
      if (!capturedSource.isDirectory() || options.sourceIdentity && !same(capturedSource, options.sourceIdentity)) throw changed('source');
      const native = renameNoReplace ? await renameNoReplace(source, target) : 'unsupported';
      if (native !== 'moved' && native !== 'unsupported') throw new DirectoryMoveUnknown('native directory move returned no outcome receipt');
      if (native === 'unsupported') {
        // Checked fallback: the serialized Host owner excludes competing managed
        // mutations; arbitrary same-user native writers are outside this model.
        await mkdir(target, { mode: 0o700 });
        // A missing/unreadable capture supplies no cleanup authority.
        const reservation = await lstat(target).catch(error => { throw new DirectoryMoveUnknown('directory move reservation ownership could not be observed', {cause:error}); });
        const validateReservation = async () => {
          const current = await lstat(target);
          if (!current.isDirectory() || !same(current, reservation)) throw changed('reservation');
        };
        try {
          const currentSource = await lstat(source);
          if (!currentSource.isDirectory() || !same(currentSource, capturedSource)) throw changed('source');
          await validateReservation();
          await rename(source, target);
        }
        catch (error) {
          try { await validateReservation(); await rmdir(target); }
          catch (cleanup) {
            throw Object.assign(new DirectoryMoveUnknown(`${String(error)}; reservation cleanup incomplete: ${String(cleanup)}`, {cause:error}), {cleanupError:String(cleanup)});
          }
          throw error;
        }
      }
      try {
        const destination = await lstat(target);
        if (!destination.isDirectory() || !same(destination, capturedSource)) throw new DirectoryMoveUnknown('directory move completed with an unknown destination identity');
      } catch (error) {
        if (error instanceof DirectoryMoveUnknown) throw error;
        throw new DirectoryMoveUnknown('directory move destination identity could not be observed', {cause:error});
      }
    },
    stat: async (path: string) => { const info = await stat(path); return {mode: info.mode, size: info.size}; },
    makeDirectory: async (path: string, mode?: number) => { await mkdir(path, mode === undefined ? {} : { mode }); },
    removePath: async (path: string, options?: {directory?: boolean}) => {
      if (options?.directory) await rmdir(path);
      else await rm(path, { force: true });
    },
    freePort: async () => {
      const server = createServer();
      return new Promise<number>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          server.close(error => {
            if (error) reject(error);
            else if (address && typeof address === 'object') resolve(address.port);
            else reject(new Error('could not choose a Host loopback port'));
          });
        });
      });
    },
    statDirectory,
    realpath: (path: string) => realpath(path).catch(() => path),
    fileType: async (path: string) => {
      const info = await lstat(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
      });
      return !info ? 'missing' : info.isSymbolicLink() ? 'symlink' : info.isFile() ? 'file' : info.isDirectory() ? 'directory' : 'other';
    },
    readFile: async (path: string) => {
      if (!(await stat(path)).isFile()) throw new Error('Host readFile requires a regular file');
      return readFile(path);
    },
    listFolder: (path: string) => folderFiles(path),
};

export const fileOperations = {
  ...rawFileOperations,
  writeFile: (...args: Parameters<typeof rawFileOperations.writeFile>) => directoryOwners.runFile(args[0], () => rawFileOperations.writeFile(...args)),
  publishFile: (...args: Parameters<typeof rawFileOperations.publishFile>) => directoryOwners.run([dirname(args[0])], () => rawFileOperations.publishFile(...args)),
  appendFile: (...args: Parameters<typeof rawFileOperations.appendFile>) => directoryOwners.runFile(args[0], () => rawFileOperations.appendFile(...args)),
  makeDirectory: (...args: Parameters<typeof rawFileOperations.makeDirectory>) => directoryOwners.run([args[0]], () => rawFileOperations.makeDirectory(...args)),
  removePath: (...args: Parameters<typeof rawFileOperations.removePath>) => directoryOwners.run([args[1]?.directory ? args[0] : dirname(args[0])], () => rawFileOperations.removePath(...args)),
  moveDirectory: (source: string, target: string, options?: DirectoryMoveOptions) => directoryOwners.run([source,target], () => rawFileOperations.moveDirectory(source,target,options)),
};

export function createFileOperations(backend: {renameNoReplace: RenameNoReplace}) {
  return {...fileOperations,
    moveDirectory: (source: string, target: string, options?: DirectoryMoveOptions) => directoryOwners.run([source,target], () => rawFileOperations.moveDirectory(source,target,options,backend.renameNoReplace)),
  };
}
