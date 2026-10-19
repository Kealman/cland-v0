// T3: SIGKILL before the integration ref moves leaves a durable checkout snapshot recovered by a new hub process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, killDaemon, startDaemon } from './harness.ts';
import { git, ok, json, task, review, indexLockProject } from './merge-native-support.ts';


test('a crash before the integration ref moves retains checkout recovery and can merge after restart', async (t) => {
  const { root, rev, discovery } = await indexLockProject(t, 'crash-before-ref', startDaemon);
  const work = await task(root);
  await review(rev, work.id);
  const before = git(root, 'rev-parse', 'dev');
  const interrupted = await cland(root, 'merge', work.id);
  assert.notEqual(interrupted.code, 0);
  await killDaemon(discovery.pid);
  assert.ok(existsSync(join(root, '.cland', 'before-ref-crash')));
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), before);
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  const receipt = db.prepare('select checkout_recovery from tracker_merges where item_id = ?').get(work.id);
  db.close();
  assert.ok(receipt?.checkout_recovery, 'unlanded mutation must retain its durable checkout snapshot');
  await startDaemon(t, root);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), retry.commit);
});
