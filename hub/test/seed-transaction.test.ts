import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { seedTransaction } from './seed-transaction.ts';

test('seed failure remains primary when transaction rollback fails', async () => {
  const primary = new Error('seed failed');
  const cleanup = new Error('rollback failed');
  const commands: string[] = [];
  const connection = {
    isTransaction: true,
    exec(sql: string) {
      commands.push(sql);
      if (sql === 'rollback') throw cleanup;
    },
    prepare() { throw new Error('unexpected prepare'); },
  } as unknown as DatabaseSync;
  const { exec, prepare } = connection;
  await assert.rejects(seedTransaction(connection, async () => { throw primary; }), error => {
    assert.equal(error, primary);
    assert.ok(primary.cause instanceof AggregateError);
    assert.deepEqual(primary.cause.errors, [cleanup]);
    return true;
  });
  assert.deepEqual(commands, ['begin immediate', 'rollback']);
  assert.equal(connection.exec, exec);
  assert.equal(connection.prepare, prepare);
});
