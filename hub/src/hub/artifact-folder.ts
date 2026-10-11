// A folder has a single index entry. Its regular files are discovered only when requested.
import { lstat, readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import type { Artifact } from '../protocol.ts';
import { ArtifactError } from './artifacts.ts';
import type { Resumed } from './artifact-lifecycle.ts';

export function artifactEntry(a: Artifact): string { return a.folder ? join(a.path, a.entry!) : a.path; }

export function folderName(name: unknown): string {
  if (typeof name !== 'string' || !name || isAbsolute(name) || /[\\\u0000-\u001f\u007f]/.test(name) || name.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new ArtifactError('artifact-path', 'use a relative file name inside the folder, without dot segments or control characters');
  }
  return name;
}

export async function folderFiles(root: string, resumed: Resumed = body => body()): Promise<string[]> {
  const result: string[] = [];
  const walk = async (path: string): Promise<void> => {
    const info = await lstat(path);
    const names = await resumed(() => {
      if (info.isSymbolicLink()) throw new ArtifactError('artifact-source', 'artifact folders cannot contain symbolic links');
      if (info.isFile()) { result.push(relative(root, path).split(sep).join('/')); return null; }
      if (!info.isDirectory()) throw new ArtifactError('artifact-source', 'artifact folders contain only regular files and directories');
      return readdir(path);
    });
    const children = resumed(() => names ? names.sort().map(name => join(path, name)) : []);
    for (const child of children) await resumed(() => walk(child));
  };
  await walk(root);
  return resumed(() => result.sort());
}
