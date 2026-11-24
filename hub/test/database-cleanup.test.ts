// T2: injected SQLite handles; no native database or process is opened.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.ts';
import { tipChurnFixture } from './tip-churn-fixture.ts';
import { fixtureNativeGuard } from './fake-native-guard.ts';

function primaryWithCleanup(actual: unknown, primary: Error, cleanup: Error) {
  assert.equal(actual, primary);
  assert.ok(primary.cause instanceof AggregateError);
  assert.deepEqual(primary.cause.errors, [cleanup]);
  return true;
}

test('database pragma rejection retains the primary error when close rejects', async t => {
  await fixtureNativeGuard(t);
  const primary = new Error('injected pragma rejection'), cleanup = new Error('injected close rejection');
  let closes = 0;
  const db = { exec() { throw primary; }, close() { closes++; throw cleanup; } } as unknown as DatabaseSync;
  assert.throws(() => openDatabase('unused', () => db), error => primaryWithCleanup(error, primary, cleanup));
  assert.equal(closes, 1);
});

test('database initialization returns its handle and successful cleanup preserves a rejection', async t => {
  await fixtureNativeGuard(t);
  let closes = 0;
  const statements: string[] = [];
  const db = { exec(sql: string) { statements.push(sql); }, close() { closes++; } } as unknown as DatabaseSync;
  assert.equal(openDatabase('unused', () => db), db);
  assert.deepEqual(statements, ['pragma busy_timeout = 5000;']);
  assert.equal(closes, 0);
  const primary = new Error('injected pragma rejection');
  db.exec = () => { throw primary; };
  assert.throws(() => openDatabase('unused', () => db), error => error === primary);
  assert.equal(closes, 1);
  assert.equal(primary.cause, undefined);
});

for (const phase of ['schema', 'seed'] as const) test(`tip churn ${phase} rejection retains the primary error when close rejects`, async t => {
  await fixtureNativeGuard(t);
  const root = await mkdtemp(join(tmpdir(), 'cland-database-cleanup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const primary = new Error(`injected ${phase} rejection`), cleanup = new Error('injected close rejection');
  let closes = 0;
  const db = {
    exec(sql: string) {
      if (phase === 'schema' && sql.includes('journal_mode')) throw primary;
    },
    prepare(sql: string) {
      if (phase === 'seed' && sql === 'delete from tracker_meta where key = ?') throw primary;
      return { get() { return {}; }, all() { return []; } };
    },
    close() { closes++; throw cleanup; },
  } as unknown as DatabaseSync;
  await assert.rejects(tipChurnFixture(root, { requireClose() {} }, () => db), error => primaryWithCleanup(error, primary, cleanup));
  assert.equal(closes, 1);
});
