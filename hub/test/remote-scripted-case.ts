import type { TestContext } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { stageCase } from './stage-case-fixture.ts';
import { beforeDirectories, fenceFixtureCleanup, onCleanup } from './process-cleanup.ts';

/** This caller owns every registered fixture close, including partial DB opens.
 * A rejected cleanup keeps the same retryable owner, roots and native guard. */
export function scriptedCase(t: TestContext) {
  const scope = stageCase(t);
  const fixtures = scope.resources;
  fenceFixtureCleanup(fixtures);
  const ownResource = (close: () => Promise<void> | undefined) => {
    let pending: Promise<void> | undefined;
    const begin = () => {
      if (pending) return pending;
      try { pending = close(); }
      catch (error) { pending = Promise.reject(error); }
      // No acquisition yet: do not cache a successful close for a late owner.
      return pending ?? Promise.resolve();
    };
    scope.releaseOnClose(() => { void begin().catch(() => {}); });
    onCleanup(fixtures, async () => {
      const attempt = begin();
      try { await attempt; }
      catch (error) { if (pending === attempt) pending = undefined; throw error; }
    });
  };
  const databases: DatabaseSync[] = [];
  const openDatabase = (path: string) => {
    let database: DatabaseSync | undefined;
    // projectHub registered its stop before entering this acquisition seam.
    // Native fallback closure therefore follows its stop, before root removal.
    beforeDirectories(fixtures, async () => {
      if (database?.isOpen) database.close();
      if (database?.isOpen) throw new Error('scripted fixture database close unconfirmed');
    });
    database = new DatabaseSync(path);
    databases.push(database);
    return database;
  };
  return { ...scope, fixtures, databases, openDatabase, ownResource };
}
