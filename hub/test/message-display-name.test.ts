// T1: common Store message projection, using only a disposable SQLite root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Store } from '../src/hub/store.ts';

test('human display names resolve at read time and disappear in single mode', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-author-')), path = join(root, 'authors.db');
  const store = new Store(path);
  const db = new DatabaseSync(path);
  t.after(async () => { db.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  db.prepare('insert into users values (?,?,?,?,?,?)').run('first', 'first-user', 'First Name', 'admin', 'active', 1);
  db.prepare("insert into auth_state values (1,'users',1)").run();
  const ts = new Date().toISOString();
  store.createTopic('general', 'General', null, ts);
  store.record({ id: 'authored', from: 'human', fromKind: 'human', via: 'hub', to: [], topic: 'general', text: 'words', ts, userId: 'first' }, [], Date.now());
  assert.equal(store.message('authored')?.userDisplayName, 'First Name');
  db.prepare('update users set display_name=? where id=?').run('Renamed Person', 'first');
  assert.equal(store.message('authored')?.userDisplayName, 'Renamed Person');
  db.prepare("update auth_state set mode='single'").run();
  assert.equal(store.message('authored')?.userDisplayName, undefined);
});
