// T1: real in-memory SQLite, fake filesystem; no hub, child processes or live paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs/promises';
import { Store } from '../src/hub/store.ts';
import { ArtifactLifecycle } from '../src/hub/artifact-lifecycle.ts';

test('one cleanup pass decodes the 8,000-artifact index at most once across 200 folders', async t => {
  let indexValue: string | undefined;
  let indexDecodes = 0;
  const parse = JSON.parse;
  t.mock.method(JSON, 'parse', (value: string, reviver?: Parameters<typeof JSON.parse>[1]) => {
    if (value === indexValue) {
      indexValue = undefined;
      indexDecodes++;
      // Fail early on the old quadratic implementation instead of decoding millions of rows.
      assert.ok(indexDecodes <= 8000, `full artifact index decoded more than once: ${indexDecodes} row decodes`);
    }
    return parse(value, reviver);
  });
  const store = new Store(':memory:', path => {
    const db = new DatabaseSync(path), prepare = db.prepare;
    db.prepare = function(sql) {
      const statement = prepare.call(this, sql);
      if (sql === 'select value from artifacts order by number') {
        const all = statement.all.bind(statement);
        statement.all = function() {
          return all().map(row => ({
            get value() { indexValue = row.value as string; return indexValue; },
          }));
        };
      }
      return statement;
    };
    return db;
  });
  t.after(() => store.close());
  store.transaction(() => {
    for (let i = 0; i < 8000; i++) store.registerArtifact(id => ({
      id, title: `Generated ${i}`, kind: 'note', topic: 'general', creator: 'fixture', creatorKind: 'agent',
      time: '2026-10-01T00:00:00.000Z', path: `/fixture/artifacts/${id}`,
      ...(i < 200 ? { status: 'shared', folder: true, entry: 'index.md' } as const : {
        status: 'moved', movedTo: { folder: `A-${i % 200 + 1}`, path: `${id}.md` },
      } as const),
    }), () => {});
  });
  // Every old hard link is already absent; the pass still visits every owner and redirect.
  const files = { ...fs, lstat: async () => { throw Object.assign(new Error('missing fixture path'), { code: 'ENOENT' }); } };
  await new ArtifactLifecycle(store, '/fixture', () => {}, files).cleanup(30, Date.parse('2026-10-24T00:00:00.000Z'));
  assert.equal(indexDecodes, 8000, 'one complete index snapshot, excluding fresh point reads');
  assert.equal(store.artifact('A-8000')?.movedTo?.folder, 'A-200');
  assert.equal(store.artifact('A-200')?.fileDeleted, undefined);
});
