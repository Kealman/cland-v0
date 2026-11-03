import { join } from 'node:path';

/** Fail fixture setup before native listen/connect, on every platform. */
export function fakeHostSocketPath(home: string): string {
  const path = join(home, '.cland-host/run/agent.sock');
  if (Buffer.byteLength(path, 'utf8') + 1 > 104) {
    throw new Error(`fake host socket exceeds macOS 104-byte budget including NUL: ${path}`);
  }
  return path;
}
