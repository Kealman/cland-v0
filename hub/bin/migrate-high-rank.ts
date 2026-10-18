#!/usr/bin/env node
// Run from the project root after T-122 merges and the hub restarts. All changes use the hub.
// Removing high only after ranking makes a successful rerun write nothing; a pending removal retries safely.
import { migrateHighRank } from '../src/tracker/migrate-high-rank.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('./cland.ts', import.meta.url));

async function task<T>(...args: string[]): Promise<T> {
  try {
    const { stdout } = await exec(process.execPath, [cli, 'task', ...args, '--json'], { timeout: 30_000 });
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error((error as { stderr?: string }).stderr?.trim() || String(error));
  }
}


await migrateHighRank(task, json => process.stdout.write(json)).catch(error => {
  process.stderr.write(`rank migration stopped: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
