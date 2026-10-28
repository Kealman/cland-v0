import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** Open each untrusted component without following links; the returned descriptor owns the bytes. */
export async function openArtifactFile(path: string, prefix: { path: string; realPath: string }, openFile: typeof open = open): ReturnType<typeof open> {
  const flags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
  // Resolve only the trusted project prefix, once at edge creation. The
  // artifact suffix stays lexical so a substituted folder cannot authorize
  // an outside target. Legacy paths outside the prefix get no such rewrite.
  const rel = relative(prefix.path, path);
  const inside = !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
  const base = inside ? prefix.realPath : '/';
  const parts = (inside ? rel : path).split('/').filter(Boolean);
  if (process.platform === 'darwin') {
    // Darwin sys/fcntl.h: O_NOFOLLOW_ANY rejects symlinks in every path component
    // atomically during open (Node does not expose this SDK constant).
    // O_NOFOLLOW_ANY includes the leaf guard; Darwin rejects combining it
    // with O_NOFOLLOW with EINVAL, even on a path with no symlinks.
    return openFile(resolve(base, ...parts), constants.O_RDONLY | constants.O_NONBLOCK | 0x20000000);
  }
  if (process.platform !== 'linux') throw new Error('artifact file confinement requires macOS or Linux');
  // A directory descriptor stays anchored across rename/symlink replacement.
  // Each proc-fd-relative open has exactly one untrusted component, guarded
  // by O_NOFOLLOW; no checked absolute pathname is reopened at the leaf.
  let directory = await openFile(base, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    for (const part of parts.slice(0, -1)) {
      const next = await openFile(`/proc/self/fd/${directory.fd}/${part}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const previous = directory;
      directory = next;
      await previous.close();
    }
    return await openFile(`/proc/self/fd/${directory.fd}/${parts.at(-1)!}`, flags);
  } finally { await directory.close(); }
}
