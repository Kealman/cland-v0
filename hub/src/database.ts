import { DatabaseSync } from 'node:sqlite';

/** Every live-store handle waits for competing writers before schema access, including WAL setup. */
export function openDatabase(path: string, open = (path: string) => new DatabaseSync(path)): DatabaseSync {
  const db = open(path);
  try {
    db.exec('pragma busy_timeout = 5000;');
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
