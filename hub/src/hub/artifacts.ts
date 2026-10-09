// Persistent artifact files and their hub index. Publication runs in the index transaction;
// a refused publication leaves neither an index entry nor a file.
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, join, resolve } from 'node:path';
import type { Artifact, ArtifactCreate, ArtifactKind } from '../protocol.ts';
import type { Store } from './store.ts';

export type ArtifactErrorCode = 'artifact-kind' | 'artifact-source' | 'artifact-topic' | 'artifact-title' | 'artifact-unavailable';
export class ArtifactError extends Error {
  readonly code: ArtifactErrorCode;
  constructor(code: ArtifactErrorCode, message: string) { super(message); this.code = code; }
}
const extensions: Record<ArtifactKind, string> = { prompt: '.md', note: '.md', page: '.html', diagram: '.mmd', file: '.txt' };

export function createArtifact(store: Store, root: string | undefined, request: ArtifactCreate, actor: { name: string; cwd: string }, publish: (a: Artifact) => void): Artifact {
  if (!root) throw new ArtifactError('artifact-unavailable', 'this hub serves no project for artifacts');
  if (!(typeof request.kind === 'string' && Object.hasOwn(extensions, request.kind))) throw new ArtifactError('artifact-kind', 'kind must be prompt, note, page, diagram or file');
  if (typeof request.title !== 'string' || !request.title.trim()) throw new ArtifactError('artifact-title', 'an artifact needs a title');
  if (/[\u0000-\u001f\u007f]/.test(request.title)) throw new ArtifactError('artifact-title', 'an artifact title must be one line without control characters');
  const title = request.title.trim();
  const kind = request.kind as ArtifactKind;
  if ((request.path === undefined) === (request.content === undefined)) throw new ArtifactError('artifact-source', 'give exactly one of path or content');
  let content: Buffer;
  let extension = extensions[kind];
  if (request.path !== undefined) {
    if (typeof request.path !== 'string' || !request.path) throw new ArtifactError('artifact-source', 'path must name a file');
    const source = isAbsolute(request.path) ? request.path : resolve(actor.cwd, request.path);
    try {
      if (!statSync(source).isFile()) throw new Error('not a regular file');
      content = readFileSync(source);
    } catch { throw new ArtifactError('artifact-source', `cannot read artifact file "${request.path}"`); }
    const ext = extname(source);
    if (/^\.[a-zA-Z0-9]{1,16}$/.test(ext)) extension = ext.toLowerCase();
  } else {
    if (typeof request.content !== 'string') throw new ArtifactError('artifact-source', 'content must be text');
    content = Buffer.from(request.content);
  }
  const dir = join(root, '.cland', 'artifacts');
  mkdirSync(dir, { recursive: true });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'artifact';
  let path: string | undefined;
  let written = false;
  try {
    return store.registerArtifact((id) => {
      path = join(dir, `${id}-${slug}${extension}`);
      writeFileSync(path, content, { flag: 'wx' });
      written = true;
      return { id, title, kind, path, creator: actor.name, time: new Date().toISOString(), topic: request.topic, status: 'shared' };
    }, publish);
  } catch (err) {
    if (written && path) rmSync(path, { force: true });
    throw err;
  }
}
