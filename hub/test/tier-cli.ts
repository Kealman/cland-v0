// Only the synchronous launch of these shipped CLI subjects is exempt.
// Async work and arbitrary CLI lookalikes do not inherit this permission.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
const recorder = fileURLToPath(new URL('../../.agents/skills/qa/qa-record.sh', import.meta.url));
const migration = fileURLToPath(new URL('../bin/migrate-v01-release.ts', import.meta.url));
const migrationPreload = fileURLToPath(new URL('./v01-migration-cli-preload.ts', import.meta.url));
let launching = false;
export function clandCliLaunch<T>(launch: () => T): T {
  const previous = launching;
  launching = true;
  try { return launch(); }
  finally { launching = previous; }
}
export function isClandCliLaunch(command: unknown, args: unknown): boolean {
  if (!launching || !Array.isArray(args)) return false;
  const pathIs = (value: unknown, expected: string) => typeof value === 'string' && resolve(value) === resolve(expected);
  if (pathIs(command, process.execPath)) return pathIs(args[0], entry)
    || args[0] === '--import' && pathIs(args[1], migrationPreload) && pathIs(args[2], migration);
  return pathIs(command, '/bin/sh') && pathIs(args[0], recorder);
}
