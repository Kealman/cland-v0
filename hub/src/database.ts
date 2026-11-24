import { DatabaseSync } from 'node:sqlite';
import { withCleanupFailure } from './cleanup-failure.ts';

/** Every live-store handle waits for competing writers before schema access, including WAL setup. */
export function openDatabase(path: string, open = (path: string) => new DatabaseSync(path)): DatabaseSync {
  const db = open(path);
  try {
    db.exec('pragma busy_timeout = 5000;');
    return db;
  } catch (error) {
    try { db.close(); }
    catch (cleanup) { throw withCleanupFailure(error, cleanup); }
    throw error;
  }
}
