// T2: doctor's ownership reader contends with a real SQLite writer in another JS thread.
// DatabaseSync blocks its thread; a worker lets the lock owner observe BUSY and release it without sleeps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
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
