// Only the synchronous launch boundary of the documented CLI helper is exempt.
// Async work and arbitrary CLI lookalikes do not inherit this permission.
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
let launching = false;
export function clandCliLaunch<T>(launch: () => T): T {
  const previous = launching;
  launching = true;
  try { return launch(); }
  finally { launching = previous; }
}
export function isClandCliLaunch(command: unknown, args: unknown): boolean {
  return launching && command === process.execPath && Array.isArray(args) && args[0] === entry;
}
