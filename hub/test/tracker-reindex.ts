import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { TestContext } from 'node:test';
import { flushProjectLogs, until } from './harness.ts';
import { completeJournalLines } from './journal-lines.ts';

/** Arm the exact file's durable re-index receipt before the external write.
 * Previous edits and startup scans cannot satisfy this observation. */
export async function reindexedAfter(t: TestContext, root: string, file: string, edit: () => Promise<void>): Promise<void> {
  await observedAfter(t, root, file, edit, 'task-reindexed');
}

/** Deletions have a removal receipt rather than a re-index receipt. */
export async function removedAfter(t: TestContext, root: string, file: string, edit: () => Promise<void>): Promise<void> {
  await observedAfter(t, root, file, edit, 'task-removed');
}

async function observedAfter(t: TestContext, root: string, file: string, edit: () => Promise<void>, event: string): Promise<void> {
  const records = async () => {
    await flushProjectLogs(t, root);
    return completeJournalLines(await readFile(join(root, '.cland/log/hub.log'), 'utf8'))
      .filter(line => line.startsWith('{')).map(line => JSON.parse(line) as Record<string, unknown>);
  };
  const before = (await records()).length;
  await edit();
  let receipt: Record<string, unknown> | undefined;
  await until(async () => {
    receipt = (await records()).slice(before).find(record =>
      record.event === event && record.file === basename(file) && (event === 'task-removed' || record.source === 'hand'));
    return receipt !== undefined;
  }, { what: `watcher ${event} receipt for ${basename(file)}`, timeoutMs: 15_000 });
  assert.ok(receipt, `the hand edit of ${basename(file)} has its ${event} receipt`);
}
