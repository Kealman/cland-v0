// A folder has a single index entry. Its regular files are discovered only when requested.
import { folderFiles as scanFolder } from '../host/agent/folder.ts';
import { isAbsolute, join } from 'node:path';
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

export function folderFiles(root: string, resumed: Resumed = body => body()): Promise<string[]> {
  return scanFolder(root, resumed, message => new ArtifactError('artifact-source', message));
}
