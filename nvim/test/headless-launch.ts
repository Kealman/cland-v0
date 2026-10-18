// Only startClient's synchronous headless launch is exempt; no async work inherits it.
import { fileURLToPath } from 'node:url';
import { findNvim } from '../bin/nvim-path.ts';

const init = fileURLToPath(new URL('../init.lua', import.meta.url));
let launching: { bin: string; socket: string } | undefined;
export function headlessNvimLaunch<T>(bin: string, socket: string, launch: () => T): T {
  const previous = launching;
  launching = { bin, socket };
  try { return launch(); }
  finally { launching = previous; }
}
export function isHeadlessNvimLaunch(command: unknown, args: unknown): boolean {
  const expected = ['--clean', '-u', init, '--headless', '--listen', launching?.socket];
  return launching !== undefined && command === launching.bin && command === findNvim() && Array.isArray(args)
    && args.length === expected.length && expected.every((arg, i) => args[i] === arg);
}
