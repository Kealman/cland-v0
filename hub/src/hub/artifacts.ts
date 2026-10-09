// Persistent artifact files and their hub index. Publication runs in the index transaction;
// a refused publication leaves neither an index entry nor a file.
import { mkdir, open, rm, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve } from 'node:path';
import type { Artifact, ArtifactCreate, ArtifactKind } from '../protocol.ts';
import type { Store } from './store.ts';

export type ArtifactErrorCode = 'artifact-kind' | 'artifact-source' | 'artifact-topic' | 'artifact-title' | 'artifact-unavailable';
export class ArtifactError extends Error {
  readonly code: ArtifactErrorCode;
  constructor(code: ArtifactErrorCode, message: string) { super(message); this.code = code; }
}
const extensions: Record<ArtifactKind, string> = { prompt: '.md', note: '.md', page: '.html', diagram: '.mmd', file: '.txt' };

export async function createArtifact(store: Store, root: string | undefined, request: ArtifactCreate, actor: { name: string; cwd: string }, publish: (a: Artifact) => void, resumed: <T>(work: () => T) => T, authorize: () => void, readSource: (path: string) => Promise<Buffer>): Promise<Artifact> {
  if (!root) throw new ArtifactError('artifact-unavailable', 'this hub serves no project for artifacts');
  if (!(typeof request.kind === 'string' && Object.hasOwn(extensions, request.kind))) throw new ArtifactError('artifact-kind', 'kind must be prompt, note, page, diagram or file');
  if (typeof request.title !== 'string' || !request.title.trim()) throw new ArtifactError('artifact-title', 'an artifact needs a title');
  if (/[\u0000-\u001f\u007f]/.test(request.title)) throw new ArtifactError('artifact-title', 'an artifact title must be one line without control characters');
  if (request.status !== undefined && request.status !== 'draft' && request.status !== 'shared') throw new ArtifactError('artifact-source', 'status must be draft or shared');
  if (request.status === 'draft' && request.kind !== 'prompt') throw new ArtifactError('artifact-kind', 'only prompts can be drafts');
  const title = request.title.trim();
  const kind = request.kind as ArtifactKind;
  if ((request.path === undefined) === (request.content === undefined)) throw new ArtifactError('artifact-source', 'give exactly one of path or content');
  const dir = join(root, '.cland', 'artifacts');
  let content: Buffer;
  let extension = extensions[kind];
  if (request.path !== undefined) {
    if (typeof request.path !== 'string' || !request.path) throw new ArtifactError('artifact-source', 'path must name a file');
    const source = isAbsolute(request.path) ? request.path : resolve(actor.cwd, request.path);
    const unreadable = () => resumed(() => { throw new ArtifactError('artifact-source', `cannot read artifact file "${request.path}"`); });
    const info = await stat(source).catch(unreadable);
    const reading = resumed(() => {
      authorize();
      if (!info.isFile()) throw new ArtifactError('artifact-source', `artifact source "${request.path}" is not a regular file`);
      const ext = extname(source);
      if (/^\.[a-zA-Z0-9]{1,16}$/.test(ext)) extension = ext.toLowerCase();
      return readSource(source).catch(unreadable);
    });
    content = await reading;
  } else {
    if (typeof request.content !== 'string') throw new ArtifactError('artifact-source', 'content must be text');
    content = Buffer.from(request.content);
  }
  await resumed(() => { authorize(); return mkdir(dir, { recursive: true }); });
  const prepared = resumed(() => {
    authorize();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'artifact';
    const id = store.nextArtifactId(); // caller serializes creations: reserved across the file write
    const path = join(dir, `${id}-${slug}${extension}`);
    return { id, path, opening: open(path, 'wx') };
  });
  let written = false;
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const opened = await prepared.opening;
    await resumed(() => { file = opened; written = true; authorize(); return opened.writeFile(content); });
    await resumed(() => { authorize(); return opened.close(); });
    return resumed(() => {
      file = undefined;
      authorize(); // topic, caller identity, and permissions are read again after file preparation
      const artifact = store.registerArtifact((id) => {
        if (id !== prepared.id) throw new Error('artifact reservation moved');
        return { id, title, kind, path: prepared.path, creator: actor.name, time: new Date().toISOString(), topic: request.topic, status: request.status ?? 'shared' };
      }, publish);
      return artifact;
    });
  } catch (err) {
    // The serialized creation still owns this filename; cleanup needs no topic or caller authority.
    await resumed(() => Promise.all([file?.close(), written ? rm(prepared.path, { force: true }) : undefined]));
    return resumed(() => { throw err; });
  }
}
