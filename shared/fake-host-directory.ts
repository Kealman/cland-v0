import { validateFakeHost } from './fake-layout.ts';
import { dirname, join } from 'node:path';
import { fixtureSocketPath } from './fixture-sockets.ts';

/** Shared fake transport layout; keep key readers on the same short alias as writers. */
export function hostDirectory(root: string, name: string): string {
  validateFakeHost(root,name);
  return join(dirname(fixtureSocketPath(root, 'fake-hosts')), name);
}
