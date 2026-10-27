// T2: scratch SQLite exec tracing through Store's native connection seam; no process launches.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { tempProject } from './harness.ts';

/** Observe actual SQLite DDL at Store's injected native connection boundary. */
function statusMigrationTrace(t: TestContext) {
  const writes: string[] = [];
  const open = (path: string) => {
    const db = new DatabaseSync(path);
    const exec = db.exec.bind(db);
    t.mock.method(db, 'exec', (sql: string) => {
      if (/^\s*alter table remote_status\b/i.test(sql)) writes.push(sql);
      return exec(sql);
    });
    return db;
  };
  return { open, writes };
}

test('fresh remote status includes stop cause without an ALTER migration write', async t => {
  const root = await tempProject(t);
  const trace = statusMigrationTrace(t);
  const store = new Store(join(root, 'hub.db'), trace.open);
  try {
    assert.deepEqual(trace.writes, [], 'fresh schema must include stop_cause in CREATE TABLE');
    const remote = store.remotes.forMessenger('telegram');
    remote.setStatus({ disabled: true, reason: 'sanitized stop', stopCause: 'token' });
    assert.deepEqual(remote.status(), { disabled: true, reason: 'sanitized stop', stopCause: 'token' });
  } finally { store.close(); }
});

test('legacy remote status migrates additively and structured stop causes survive reopening and clear on recovery', async t => {
  const root = await tempProject(t);
  const path = join(root, 'hub.db');
  const legacy = new DatabaseSync(path);
  try {
    legacy.exec(`create table remote_status (messenger text primary key, disabled integer not null, reason text);
      insert into remote_status values ('telegram', 1, 'legacy sanitized reason')`);
  } finally { legacy.close(); }
  const trace = statusMigrationTrace(t);
  const first = new Store(path, trace.open);
  try {
    const remote = first.remotes.forMessenger('telegram');
    assert.deepEqual(trace.writes, ['alter table remote_status add column stop_cause text']);
    assert.deepEqual(remote.status(), { disabled: true, reason: 'legacy sanitized reason' });
    remote.setStatus({ disabled: true, reason: 'current sanitized reason', stopCause: 'token' });
  } finally { first.close(); }
  trace.writes.length = 0;
  const reopened = new Store(path, trace.open);
  try {
    const remote = reopened.remotes.forMessenger('telegram');
    assert.deepEqual(trace.writes, [], 'an already migrated database performs no stop-cause ALTER');
    assert.deepEqual(remote.status(), { disabled: true, reason: 'current sanitized reason', stopCause: 'token' });
    remote.setStatus({ disabled: false, reason: null });
    assert.deepEqual(remote.status(), { disabled: false, reason: null });
  } finally { reopened.close(); }
});

