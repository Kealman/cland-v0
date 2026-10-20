// Fixture-owned native SQLite tracing/faults. No builtin or prototype is replaced.
import { DatabaseSync } from 'node:sqlite';
import type { TestContext } from 'node:test';
type Prepare = DatabaseSync['prepare'];
type Trace = (this: DatabaseSync, sql: string, method: 'get' | 'all' | 'run', bindings: unknown[], result: unknown) => void;
export function sqliteProbe() {
  const originals = new WeakMap<DatabaseSync, Prepare>();
  let intercept: Prepare | undefined;
  let trace: Trace | undefined;
  let before: ((sql: string, method: 'get' | 'all' | 'run', bindings: unknown[]) => void) | undefined;
  return {
    open: (path: string): DatabaseSync => {
      const db = new DatabaseSync(path);
      const native = db.prepare;
      originals.set(db, native);
      db.prepare = function (...args) {
        const statement = (intercept ?? native).apply(this, args);
        for (const method of ['get', 'all', 'run'] as const) {
          const execute = statement[method];
          statement[method] = function (...bindings: unknown[]) {
            before?.(args[0], method, bindings);
            const result = Reflect.apply(execute, this, bindings);
            trace?.call(db, args[0], method, bindings, result);
            return result;
          };
        }
        return statement;
      };
      return db;
    },
    prepare: function (this: DatabaseSync, ...args: Parameters<Prepare>) {
      const native = originals.get(this);
      if (!native) throw new Error('SQLite connection does not belong to this probe');
      return native.apply(this, args);
    },
    before: (t: TestContext, listener: NonNullable<typeof before>) => {
      const previous = before;
      before = listener;
      t.after(() => { before = previous; });
    },
    trace: (t: TestContext, listener: Trace) => {
      const previous = trace;
      trace = listener;
      t.after(() => { trace = previous; });
    },
    mock: (t: TestContext, replacement: Prepare) => {
      const previous = intercept;
      intercept = replacement;
      t.after(() => { intercept = previous; });
    },
  };
}
