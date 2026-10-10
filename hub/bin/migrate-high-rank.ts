#!/usr/bin/env node
// Run from the project root after T-122 merges and the hub restarts. All changes use the hub.
// Removing high only after ranking makes a successful rerun write nothing; a pending removal retries safely.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('./cland.ts', import.meta.url));
type Item = { id: string; rank: number; parent: string | null; labels: string[] };

async function task<T>(...args: string[]): Promise<T> {
  try {
    const { stdout } = await exec(process.execPath, [cli, 'task', ...args, '--json'], { timeout: 30_000 });
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error((error as { stderr?: string }).stderr?.trim() || String(error));
  }
}

async function migrate(): Promise<void> {
  const { items } = await task<{ items: Item[] }>('list');
  const high = items.filter(item => item.labels.includes('high'));
  const groups = new Map<string | null, string[]>();
  for (const item of high) groups.set(item.parent, [...(groups.get(item.parent) ?? []), item.id]);
  const multiple = [...groups].filter(([, ids]) => ids.length > 1);
  if (multiple.length) throw new Error(`multiple high items under the same parent: ${multiple.map(([parent, ids]) => `${parent ?? 'no parent'}: ${ids.join(', ')}`).join('; ')}; nothing was changed`);
  const moved: Array<{ id: string; parent: string | null; from: number; to: number; changed: string[] }> = [];
  const retired: string[] = [];
  try {
    for (const old of high) {
      // Singleton groups have no order to lose. A failed label removal can safely retry from tracker state.
      if (items.find(item => item.parent === old.parent)?.id !== old.id) {
        const { item, changed } = await task<{ item: Item; changed: string[] }>('rank', old.id, '--top');
        if (changed.length) moved.push({ id: old.id, parent: item.parent, from: old.rank, to: item.rank, changed });
      }
      await task('edit', old.id, '--remove-label', 'high');
      retired.push(old.id);
    }
  } finally {
    // Preserve the committed-prefix report even when a later label removal fails.
    process.stdout.write(`${JSON.stringify({ moved, retired })}\n`);
  }
}

await migrate().catch(error => {
  process.stderr.write(`rank migration stopped: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
