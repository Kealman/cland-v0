// The caller holds the project lock. Publish a private bind atomically over a stale endpoint.
import { chmodSync, lstatSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { Server } from 'node:net';

export async function bindUnixSocket(server: Server, path: string): Promise<() => boolean> {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // Bound under a name of this process's own, then renamed into place (replacing a stale file there).
  // Node removes the name it bound when the server closes; that name is gone by then, so the close can
  // never remove a socket another hub has put at `path` since.
  const staging = join(dirname(path), `.h${randomBytes(3).toString('hex')}`);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(staging, () => resolve());
  });
  let bound: ReturnType<typeof lstatSync>;
  try {
    // only this user may even try the secret
    chmodSync(staging, 0o600);
    bound = lstatSync(staging);
    renameSync(staging, path);
  } catch (err) {
    // not in place: nothing this edge bound may outlive the failure
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(staging, { force: true });
    throw err;
  }
  // the file this edge bound: on close, only that file is removed
  return () => {
    try {
      const now = lstatSync(path);
      if (now.ino !== bound.ino || now.dev !== bound.dev) return false;
      rmSync(path, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return true;
  };
}
