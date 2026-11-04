import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { appendFile, link, rename, open, mkdir, rm, rmdir, truncate, writeFile, chmod, stat, lstat, realpath, readFile } from 'node:fs/promises';
import { statDirectory } from './stat-directory.ts';
import { folderFiles } from './folder.ts';
export const fileOperations = {
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
