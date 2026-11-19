// The QA allocator owns this executable channel; cases receive no grant variables.
import { lstatSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureRootPreload } from './fixture-root-preload.ts';

const word = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
export type QaNodeDescriptor = { version: 1; node: string; files: Array<{ target: string; path: string; bytes: string; dev: number; ino: number; mode: number; size: number }> };

/** Called only with the run directory just allocated by the QA owner. */
export function prepareQaNode(root: string | null): QaNodeDescriptor {
  if (root === null) return { version: 1, node: process.execPath, files: [] };
  const preload = join(root, 'qa-node-preload.mjs'), shim = join(root, 'qa-node');
  const code = fixtureRootPreload(root, true);
  const script = `#!/bin/sh\nexec ${word(process.execPath)} --import ${word(preload)} "$@"\n`;
  writeFileSync(preload, code, { flag: 'wx', mode: 0o600 });
  writeFileSync(shim, script, { flag: 'wx', mode: 0o700 });
  return { version: 1, node: shim, files: [['shim', shim, script], ['preload', preload, code]].map(([target, path, bytes]) => {
    const info = lstatSync(path!);
    if (!Number.isSafeInteger(info.dev) || !Number.isSafeInteger(info.ino)) throw new Error('QA executable identity unavailable');
    return { target: target!, path: path!, bytes: bytes!, dev: info.dev, ino: info.ino, mode: info.mode, size: info.size };
  }) };
}
