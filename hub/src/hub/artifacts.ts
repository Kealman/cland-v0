import { realClock, type Clock } from './clock.ts';
// Persistent artifact files and their hub index. Publication runs in the index transaction;
// a refused publication leaves neither an index entry nor a file.
import { lstat, mkdir, open, rm } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import type { Artifact, ArtifactCreate, ArtifactKind } from '../protocol.ts';
import { folderFiles, folderName } from './artifact-folder.ts';
import type { Store } from './store.ts';

export type ArtifactErrorCode = 'artifact-kind' | 'artifact-source' | 'artifact-topic' | 'artifact-title' | 'artifact-unavailable' | 'artifact-path' | 'artifact-busy';
export class ArtifactError extends Error {
  readonly code: ArtifactErrorCode;
  constructor(code: ArtifactErrorCode, message: string) { super(message); this.code = code; }
}
const extensions: Record<ArtifactKind, string> = { prompt: '.md', note: '.md', page: '.html', diagram: '.mmd', file: '.txt' };

const creations = new WeakMap<Store, Promise<unknown>>();

/** All callers sharing an index serialize preparation through registration or cleanup. */
export function createArtifact(...args: Parameters<typeof prepareArtifact>): Promise<Artifact> {
  const store = args[0], resumed = args[5];
  const operation = (creations.get(store) ?? Promise.resolve()).then(() => resumed(() => prepareArtifact(...args)));
  creations.set(store, operation.catch(() => {}));
  return operation;
}

async function prepareArtifact(store: Store, root: string | undefined, request: ArtifactCreate, actor: { name: string; cwd: string; kind: 'human' | 'agent'; role: () => string | null }, publish: (a: Artifact) => void, resumed: <T>(work: () => T) => T, authorize: () => void, readSource: (path: string) => Promise<Buffer>, clock: Clock = realClock): Promise<Artifact> {
  if (!root) throw new ArtifactError('artifact-unavailable', 'this hub serves no project for artifacts');
  if (!(typeof request.kind === 'string' && Object.hasOwn(extensions, request.kind))) throw new ArtifactError('artifact-kind', 'kind must be prompt, note, page, diagram or file');
  if (typeof request.title !== 'string' || !request.title.trim()) throw new ArtifactError('artifact-title', 'an artifact needs a title');
  if (/[\u0000-\u001f\u007f]/.test(request.title)) throw new ArtifactError('artifact-title', 'an artifact title must be one line without control characters');
  if (request.status !== undefined && request.status !== 'draft' && request.status !== 'shared') throw new ArtifactError('artifact-source', 'status must be draft or shared');
  if (request.status === 'draft' && request.kind !== 'prompt') throw new ArtifactError('artifact-kind', 'only prompts can be drafts');
  const title = request.title.trim();
  const kind = request.kind as ArtifactKind;
  if (request.folder !== undefined && typeof request.folder !== 'boolean') throw new ArtifactError('artifact-source', 'folder must be a boolean');
  if ((request.path === undefined) === (request.content === undefined) && !(request.folder === true && request.path === undefined && request.content === undefined)) throw new ArtifactError('artifact-source', 'give exactly one of path or content');
  const dir = join(root, '.cland', 'artifacts');
  let content: Buffer = Buffer.alloc(0);
  let folder = request.folder === true;
  let entry: string | undefined;
  let sources: { name: string; path: string }[] = [];
  let extension = extensions[kind];
  if (request.path !== undefined) {
    if (typeof request.path !== 'string' || !request.path) throw new ArtifactError('artifact-source', 'path must name a file or directory');
    const source = isAbsolute(request.path) ? request.path : resolve(actor.cwd, request.path);
    const unreadable = () => resumed(() => { throw new ArtifactError('artifact-source', `cannot read artifact source "${request.path}"`); });
    const info = await lstat(source).catch(unreadable);
    if (resumed(() => { authorize(); return info.isDirectory(); })) {
      folder = true;
      const names = await resumed(() => { authorize(); return folderFiles(source, resumed); });
      resumed(() => {
        const selected = request.entry ?? names.find(n => n.endsWith('.md'));
        if (selected === undefined) throw new ArtifactError('artifact-source', 'a folder needs a Markdown entry or an explicit entry file');
        entry = folderName(selected);
        if (!names.includes(entry)) throw new ArtifactError('artifact-source', 'the entry must name a regular file in the folder');
        sources = names.map(name => ({ name, path: join(source, name) }));
      });
    } else {
      const reading = resumed(() => {
        authorize();
        if (!info.isFile()) throw new ArtifactError('artifact-source', `artifact source "${request.path}" is not a regular file`);
        const ext = extname(source);
        if (/^\.[a-zA-Z0-9]{1,16}$/.test(ext)) extension = ext.toLowerCase();
        return readSource(source).catch(unreadable);
      });
      const bytes = await reading;
      resumed(() => { content = bytes; });
      if (folder) throw new ArtifactError('artifact-source', 'folder with path requires a directory');
    }
  } else {
    if (request.content !== undefined && typeof request.content !== 'string') throw new ArtifactError('artifact-source', 'content must be text');
    content = Buffer.from(request.content ?? '');
    if (folder) entry = folderName(request.entry ?? 'index.md');
  }
  if (!folder && request.entry !== undefined) throw new ArtifactError('artifact-source', 'entry is only for folders');
  await resumed(() => { authorize(); return mkdir(dir, { recursive: true }); });
  const prepared = resumed(() => {
    authorize();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'artifact';
    const id = store.nextArtifactId(); // the per-store creation queue holds this id across the file write
    const path = join(dir, `${id}-${slug}${folder ? '' : extension}`);
    return { id, path, opening: folder ? mkdir(path) : open(path, 'wx') };
  });
  let written = false;
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const opened = await prepared.opening;
    await resumed(async () => {
      if (!folder) file = opened as Awaited<ReturnType<typeof open>>;
      written = true; authorize();
      if (folder) {
        const files = sources.length ? sources : [{ name: entry!, path: '' }];
        for (const source of files) {
          const bytes = source.path ? await resumed(() => { authorize(); return readSource(source.path); }) : content;
          const target = resumed(() => join(prepared.path, source.name));
          await resumed(() => { authorize(); return mkdir(dirname(target), { recursive: true }); });
          const handle = await resumed(() => { authorize(); return open(target, 'wx'); });
          try { await resumed(() => { authorize(); return handle.writeFile(bytes); }); }
          finally { await resumed(() => handle.close()); }
        }
      } else {
        await file!.writeFile(content);
        await resumed(() => { authorize(); return file!.close(); });
      }
    });
    return resumed(() => {
      file = undefined;
      authorize(); // topic, caller identity, and permissions are read again after file preparation
      const artifact = store.registerArtifact((id) => {
        if (id !== prepared.id) throw new Error('artifact reservation moved');
        return { id, title, kind, path: prepared.path, creator: actor.name, creatorKind: actor.kind, creatorRole: actor.role(), ...(folder ? { folder: true, entry: entry! } : {}), time: clock.now().toISOString(), topic: request.topic, status: request.status ?? 'shared' };
      }, publish);
      return artifact;
    });
  } catch (err) {
    // The serialized creation still owns this filename; cleanup needs no topic or caller authority.
    await resumed(() => Promise.all([file?.close(), written ? rm(prepared.path, { recursive: folder, force: true }) : undefined]));
    return resumed(() => { throw err; });
  }
}
