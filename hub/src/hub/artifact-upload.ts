import { mkdir, open, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { Artifact, ArtifactUpload } from '../protocol.ts';
import type { Store } from './store.ts';
import { InvalidArgument } from '../tool-arguments.ts';
import type { RemoteRedactor } from '../remote/redact.ts';
import { ArtifactError, artifactCreation } from './artifacts.ts';

const mimeExtensions: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'application/pdf': '.pdf', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'text/plain': '.txt' };

/** Prepare files under the shared creation queue, then register all rows and the message atomically. */
export function uploadArtifacts<T>(store: Store, root: string, request: ArtifactUpload, bytes: readonly Buffer[] | undefined, maxMb: number, publish: (artifacts: Artifact[]) => T, authorize: () => void, replay: () => T | undefined, resumed: <R>(work: () => R) => R, now: () => Date, redactor?: Pick<RemoteRedactor, 'containsSecret' | 'text'>): Promise<T> {
  return artifactCreation(store, () => resumed(async () => {
    authorize();
    const previous = replay();
    if (previous !== undefined) return previous;
    const invalid = (reason: string): never => { throw new InvalidArgument(`invalid upload: ${reason}`); };
    if (!request.files.length || request.files.length > 10) invalid('give 1 to 10 files');
    if (bytes && bytes.length !== request.files.length) invalid('file bytes do not match metadata');
    const checkSecret = (data: Buffer, name: string) => {
      if (redactor?.containsSecret(data)) throw new ArtifactError('secret-in-upload', `secret-in-upload: ${redactor.text(name)}`);
    };
    const files = request.files.map((file, i) => {
      if (!file || typeof file.name !== 'string' || typeof file.mime !== 'string') return invalid('each file needs a name and MIME type');
      const name = file.name.replace(/\\/g, '/').split('/').pop()!.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || 'file';
      const mime = /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(file.mime) ? file.mime.toLowerCase() : 'application/octet-stream';
      let data = bytes?.[i];
      if (!data) {
        if (typeof file.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) return invalid('data must be base64');
        data = Buffer.from(file.data, 'base64');
      }
      if (!Buffer.isBuffer(data) || data.length > maxMb * 1024 * 1024) return invalid('file exceeds artifacts.max_upload_mb');
      // Own the exact checked bytes across asynchronous preparation; native callers
      // may reuse or mutate their input buffer after handing it to the conversation.
      data = Buffer.from(data);
      checkSecret(data, name);
      const ext = extname(name);
      const extension = /^\.[a-zA-Z0-9]{1,16}$/.test(ext) ? ext.toLowerCase() : mimeExtensions[mime] ?? '.bin';
      return { name, data, extension };
    });
    const written: string[] = [];
    try {
      await resumed(() => mkdir(join(root, '.cland/artifacts'), { recursive: true }));
      const first = resumed(() => Number(store.nextArtifactId().slice(2)));
      const artifacts: Artifact[] = [];
      for (const [i, file] of files.entries()) {
        resumed(authorize);
        const id = `A-${first + i}`;
        const slug = file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80) || 'file';
        const path = join(root, '.cland/artifacts', `${id}-${slug}${file.extension}`);
        const handle = await resumed(() => open(path, 'wx'));
        written.push(path);
        try { await resumed(() => handle.writeFile(file.data)); } finally { await resumed(() => handle.close()); }
        artifacts.push({ id, title: file.name, kind: 'file', path, creator: 'human', creatorKind: 'human', creatorRole: null, topic: request.topic, status: 'shared', time: now().toISOString() });
      }
      return resumed(() => {
        authorize();
        for (const file of files) checkSecret(file.data, file.name);
        return store.transaction(() => {
          for (const artifact of artifacts) store.registerArtifact(id => {
            if (id !== artifact.id) throw new Error('artifact reservation moved');
            return artifact;
          }, () => {});
          return publish(artifacts);
        });
      });
    } catch (error) {
      await resumed(() => Promise.all(written.map(path => rm(path, { force: true }))));
      throw error;
    }
  }));
}
