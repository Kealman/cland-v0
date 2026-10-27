// T2: doctor's ownership reader contends with a real SQLite writer in another JS thread.
// DatabaseSync blocks its thread; a worker lets the lock owner observe BUSY and release it without sleeps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../src/hub/store.ts';
import { sessionShell } from './session-credential-fixture.ts';
import { tempProject } from './harness.ts';
import { ownInitWriter } from './init-writer-owner.ts';

test('doctor reads the ownership snapshot after an overlapping exclusive writer releases', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const writer = new DatabaseSync(join(root, '.cland', 'hub.db'));
  const owner = ownInitWriter(t, writer);
  // DELETE mode makes an exclusive writer block readers too; WAL normally lets them coexist.
  writer.exec(`pragma journal_mode = delete;
    create table harness_processes (name text, pid integer, pid_started text, status text, cwd text);
    insert into harness_processes values ('impl', 42, 'original-start', 'running', '/project');
    begin exclusive`);
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const { DatabaseSync } = require('node:sqlite');
    const assert = require('node:assert/strict');
    const prepare = DatabaseSync.prototype.prepare;
    let observed = false;
    DatabaseSync.prototype.prepare = function(sql) {
      if (!observed && sql.includes('sqlite_master')) {
        observed = true;
        const timeout = prepare.call(this, 'pragma busy_timeout').get().timeout;
        this.exec('pragma busy_timeout = 0');
        try {
          assert.throws(() => prepare.call(this, sql).get(), error => error.errcode === 5);
        } finally { this.exec('pragma busy_timeout = ' + timeout); }
        parentPort.postMessage({ type: 'busy', timeout });
      }
      return prepare.call(this, sql);
    };
    import(workerData.module).then(({ orphanSessions }) => {
      parentPort.postMessage({ type: 'result', rows: orphanSessions(workerData.root) });
    });
  `, { eval: true, workerData: { root, module: new URL('../src/orphans.ts', import.meta.url).href } });
  owner.attach(worker);
  const exited = once(worker, 'exit', { signal: t.signal });
  let busy = false;
  let rows: unknown;
  worker.on('message', message => {
    if (message.type === 'busy') {
      busy = true;
      // The old reader's zero failure window expires while the writer is held.
      // A waiting reader may proceed only after the actual BUSY receipt above.
      if (message.timeout > 0) writer.exec('commit');
    }
    if (message.type === 'result') rows = message.rows;
  });
  try {
    assert.deepEqual(await exited, [0]);
    assert.equal(busy, true, 'the doctor connection actually encountered the held write lock');
    assert.deepEqual(rows, [{ name: 'impl', pid: 42, pid_started: 'original-start', status: 'running', cwd: '/project' }]);
  } finally { await owner.cleanup(); }
});

test('authorization fixture reads an existing credential while a stopped WAL writer holds the store', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const path = join(root, '.cland/hub.db');
  const credential = randomUUID();
  const seeded = new Store(path);
  try {
    seeded.rememberSession('coord', 0);
    seeded.rememberSessionId('coord', 'held-coord');
    seeded.rememberRole('coord', 'coordinator');
    seeded.rememberSessionCredential('held-coord', credential);
    // Reproduce the full Store's once-only backfill trying to acquire a writer.
    seeded.clearMeta('visibility-artifact-refs');
  } finally { seeded.close(); }
  const writer = new DatabaseSync(path);
  const owner = ownInitWriter(t, writer);
  writer.exec("begin immediate; insert into meta values ('held-writer', 'uncommitted')");
  const competing = new DatabaseSync(path, { timeout: 0 });
  try {
    assert.throws(() => competing.exec('begin immediate'), error => (error as { errcode?: number }).errcode === 5,
      'positive control: the exact fixture database has a held native WAL writer');
    const start = performance.now();
    try {
      const shell = sessionShell(root, { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'held-coord' });
      assert.equal(shell.CLAND_LAUNCH_TOKEN === credential, true, 'the existing session credential is preserved');
      assert.deepEqual(sessionShell(root, { CLAND_SESSION_NAME: 'unknown' }), { CLAND_SESSION_NAME: 'unknown' });
      assert.equal(writer.prepare("select value from meta where key='held-writer'").get()?.value, 'uncommitted',
        'the fixture read did not release or replace the writer');
    } finally {
      t.diagnostic(`fixture credential open/read ${Math.round(performance.now() - start)} ms; held WAL writer; ${process.platform}/${process.arch}; no hub or child process`);
    }
  } finally { competing.close(); await owner.cleanup(); }
});
