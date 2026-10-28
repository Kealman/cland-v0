// Persisted digest-only bearer capabilities, scoped to one artifact and the minting cookie session.
import { createHash, randomBytes } from 'node:crypto';
import { openArtifactFile } from './artifact-file.ts';
import { open } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import type { ArtifactUrlResult } from '../protocol.ts';
import type { Store } from './store.ts';
import type { WebAuth } from './web-auth.ts';
import { folderName } from './artifact-folder.ts';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export class WebArtifacts {
  readonly #store: Store;
  readonly #auth: WebAuth;
  readonly #openFile: typeof open;
  readonly #prefix: { path: string; realPath: string };

  constructor(store: Store, auth: WebAuth, prefix: { path: string; realPath: string }, openFile: typeof open = open) {
    this.#store = store; this.#auth = auth; this.#openFile = openFile;
    this.#prefix = prefix;
  }

  async #open(path: string): ReturnType<typeof open> {
    return openArtifactFile(path, this.#prefix, this.#openFile);
  }

  mint(session: string, id: string, origin: string): ArtifactUrlResult {
    if (!this.#auth.active(session)) throw new Error('the web session has expired or been revoked');
    const artifact = this.#store.resolveArtifact(id);
    if (!artifact || artifact.fileDeleted) throw new Error('no artifact file is available');
    const name = artifact.folder ? folderName(artifact.entry) : basename(artifact.path);
    const cap = randomBytes(32).toString('hex');
    this.#store.createWebCapability(digest(cap), session, id);
    return { url: `${origin}/a/${cap}/${name.split('/').map(encodeURIComponent).join('/')}` };
  }

  async read(path: string): Promise<{ body: Buffer; name: string } | null> {
    const match = /^\/a\/([a-f0-9]{64})\/(.+)$/.exec(path);
    if (!match) return null;
    const row = this.#store.webCapability(digest(match[1]!));
    if (!row || !this.#auth.active(row.session)) return null;
    const artifact = this.#store.resolveArtifact(row.artifact);
    if (!artifact || artifact.fileDeleted) return null;
    const name = folderName(match[2]);
    if (!artifact.folder && name !== basename(artifact.path)) return null;
    // Keep the authorized lexical path. Canonicalizing a moved file first
    // would turn a substituted owning-folder symlink into a new outside root.
    if (!isAbsolute(artifact.path)) return null;
    const root = resolve(artifact.path);
    const target = artifact.folder ? resolve(root, name) : root;
    if (artifact.folder) {
      const rel = relative(root, target);
      if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) return null;
    }
    const file = await this.#open(target).catch((error: NodeJS.ErrnoException) => {
      if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code ?? '')) return null;
      throw error;
    });
    if (!file) return null;
    try {
      if (!(await file.stat()).isFile()) return null;
      const body = await file.readFile();
      // Revocation or expiry during I/O must also refuse the response.
      if (!this.#auth.active(row.session)) return null;
      return { body, name };
    } finally { await file.close(); }
  }
}
