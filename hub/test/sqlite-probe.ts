// Fixture-owned native SQLite tracing/faults. No builtin or prototype is replaced.
import { DatabaseSync } from 'node:sqlite';
import type { TestContext } from 'node:test';
type Prepare = DatabaseSync['prepare'];
export function sqliteProbe() {
  const originals = new WeakMap<DatabaseSync, Prepare>();
  let intercept: Prepare | undefined;
  return {
    open: (path: string): DatabaseSync => {
      const db = new DatabaseSync(path);
      const native = db.prepare;
      originals.set(db, native);
      db.prepare = function (...args) { return (intercept ?? native).apply(this, args); };
      return db;
    },
    prepare: function (this: DatabaseSync, ...args: Parameters<Prepare>) {
      const native = originals.get(this);
      if (!native) throw new Error('SQLite connection does not belong to this probe');
      return native.apply(this, args);
    },
    mock: (t: TestContext, replacement: Prepare) => {
      const previous = intercept;
      intercept = replacement;
      t.after(() => { intercept = previous; });
    },
  };
}
