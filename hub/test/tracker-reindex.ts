import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { TestContext } from 'node:test';
import { flushProjectLogs, until } from './harness.ts';
import { completeJournalLines } from './journal-lines.ts';

/** Arm the exact file's durable re-index receipt before the external write.
 * Previous edits and startup scans cannot satisfy this observation. */
export async function reindexedAfter(t: TestContext, root: string, file: string, edit: () => Promise<void>): Promise<void> {
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
      record.event === 'task-reindexed' && record.file === basename(file) && record.source === 'hand');
    return receipt !== undefined;
  }, { what: `watcher re-index receipt for ${basename(file)}` });
  assert.ok(receipt, `the hand edit of ${basename(file)} was re-indexed`);
}
