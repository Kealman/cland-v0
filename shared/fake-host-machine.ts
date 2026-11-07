import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostDirectory } from './fake-host-directory.ts';

export async function createFakeHost(root: string, name: string) {
  const directory = hostDirectory(root, name);
  const home = join(directory, 'home');
  fakeHostSocketPath(home);
  const run = join(home, '.cland-host/run');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // A fake machine can live inside a disposable Git project. Never stage its
  // keys or concurrently renamed runtime checkpoints into that project's seed.
  await writeFile(join(directory, '.gitignore'), '*\n');
  await mkdir(run, { recursive: true, mode: 0o700 });
  const key = `ssh-ed25519 ${Buffer.from(`fake-host:${name}`).toString('base64')}`;
  await writeFile(join(directory, 'host-key.pub'), key);
  await writeFile(join(directory, 'client-key'), 'FAKE CLIENT KEY\n', { mode: 0o600 });
  await writeFile(join(directory, 'boot-id'), randomUUID());
  await writeFile(join(directory, 'available-memory'), JSON.stringify({availableBytes:8 * 1024 ** 3}));
  const knownHosts = join(directory, 'known_hosts');
  await writeFile(knownHosts, `${name} ${key}\n`);
  return { directory, home, run, knownHosts, bootId: join(directory, 'boot-id'), key };
}

/** Fail fixture setup before native listen/connect, on every platform. */
export function fakeHostSocketPath(home: string): string {
  const path = join(home, '.cland-host/run/agent.sock');
  if (Buffer.byteLength(path, 'utf8') + 1 > 104) {
    throw new Error(`fake host socket exceeds macOS 104-byte budget including NUL: ${path}`);
  }
  return path;
}
