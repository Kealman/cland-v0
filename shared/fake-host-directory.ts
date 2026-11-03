import { dirname, isAbsolute, join } from 'node:path';
import { fixtureSocketPath } from './fixture-sockets.ts';

/** Shared fake transport layout; keep key readers on the same short alias as writers. */
export function hostDirectory(root: string, name: string): string {
  if (!isAbsolute(root) || !/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('invalid fake host root/name');
  return join(dirname(fixtureSocketPath(root, 'fake-hosts')), name);
}
