// Only startClient's synchronous headless launch is exempt; no async work inherits it.
import { fileURLToPath } from 'node:url';
import { findNvim } from '../bin/nvim-path.ts';

const init = fileURLToPath(new URL('../init.lua', import.meta.url));
const launcher = fileURLToPath(new URL('../bin/cland-nvim', import.meta.url));
let launching: { bin: string; socket: string } | undefined;
export function headlessNvimLaunch<T>(bin: string, socket: string, launch: () => T): T {
  const previous = launching;
  launching = { bin, socket };
  try { return launch(); }
  finally { launching = previous; }
}
export function isHeadlessNvimLaunch(command: unknown, args: unknown): boolean {
  const expected = command === launcher ? ['--headless', '--listen', launching?.socket]
    : ['--clean', '-u', init, '--headless', '--listen', launching?.socket];
  return launching !== undefined && launching.bin === findNvim() && (command === launching.bin || command === launcher) && Array.isArray(args)
    && args.length === expected.length && expected.every((arg, i) => args[i] === arg);
}
