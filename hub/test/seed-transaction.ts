import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { withCleanupFailure } from '../src/cleanup-failure.ts';

/** Join public index writers to one fixture-owned transaction. Restore before observation. */
export async function seedTransaction<T>(connection: DatabaseSync, seed: () => Promise<T>): Promise<T> {
  const exec = connection.exec, prepare = connection.prepare;
  const statements = new Map<string, StatementSync>();
  exec.call(connection, 'begin immediate');
  connection.exec = sql => { if (sql !== 'begin immediate' && sql !== 'commit') exec.call(connection, sql); };
  connection.prepare = sql => {
    let statement = statements.get(sql);
    if (!statement) { statement = prepare.call(connection, sql); statements.set(sql, statement); }
    return statement;
  };
  try {
    const value = await seed();
    exec.call(connection, 'commit');
    return value;
  } catch (error) {
    try { if (connection.isTransaction) exec.call(connection, 'rollback'); }
    catch (cleanup) { throw withCleanupFailure(error, cleanup); }
    throw error;
  } finally { connection.exec = exec; connection.prepare = prepare; }
}
