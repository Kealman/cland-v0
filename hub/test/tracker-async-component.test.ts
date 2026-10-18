// T2 component: tracker rules at public APIs, sockets, CLI and in-process MCP.
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import files from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { importIssues, type ImportedIssue } from '../src/tracker/import-github.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { parseItem } from '../src/tracker/item.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { renderConfig, parseConfig } from '../src/init/config.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';

const human = { id: 'human', name: 'human', role: null };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

test('concurrent comments and writes to other items commit in admission order', async t => {
  const root = await tempProject(t);
  const entered = deferred();
  const release = deferred();
  onCleanup(t, () => release.resolve());
  let held = false;
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: {
    ...files,
    rename: async (from, to) => {
      if (held && String(to).includes('T-1-')) { held = false; entered.resolve(); await release.promise; }
      return files.rename(from, to);
    },
  } });
  onCleanup(t, () => tracker.stop());
  await tracker.create(human, { title: 'First' });
  await tracker.create(human, { title: 'Second' });
  held = true;
  const first = tracker.comment(human, 'T-1', 'one');
  await entered.promise;
  const second = tracker.comment(human, 'T-1', 'two');
  let independentDone = false;
  const independent = tracker.comment(human, 'T-2', 'independent').then(() => { independentDone = true; });
  await new Promise(done => setImmediate(done));
  assert.equal(independentDone, false, 'another item waits behind earlier writes');
  assert.equal(tracker.view('T-1').comments.length, 0, 'old item stays intact before rename');
  release.resolve();
  await Promise.all([first, second, independent]);
  assert.deepEqual(tracker.view('T-1').comments.map(c => c.text), ['one', 'two']);
});

test('a verdict returns only after rename and evidence indexing; restart reads the durable verdict', async t => {
  const root = await tempProject(t);
  const entered = deferred();
  const release = deferred();
  onCleanup(t, () => release.resolve());
  let hold = false;
  const db = join(root, '.cland', 'hub.db');
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db, files: { ...files, rename: async (from, to) => {
    if (hold) { hold = false; entered.resolve(); await release.promise; }
    return files.rename(from, to);
  } } });
  const item = await tracker.create(human, { title: 'Durable' });
  hold = true;
  let answered = false;
  const writing = tracker.comment({ id: 'reviewer-id', name: 'rev', role: 'reviewer' }, item.id, 'checked', { verdict: 'review', scope: 'full', result: 'clear', run: 'durable-run' }).then(view => { answered = true; return view; });
  await entered.promise;
  assert.equal(answered, false);
  assert.equal(tracker.view(item.id).verdicts.length, 0);
  release.resolve();
  const result = await writing;
  assert.equal(result.verdicts[0]?.source, 'hub');
  await tracker.stop();
  const restarted = new Tracker({ git: async () => null, readBase: async () => null, root, db });
  onCleanup(t, () => restarted.stop());
  restarted.start();
  const recorded = await restarted.viewAsync(item.id);
  assert.equal(recorded.comments.at(-1)?.verdict?.run, 'durable-run');
  assert.equal(recorded.verdicts[0]?.source, 'hub');
  assert.equal(recorded.verdicts[0]?.writer?.sessionId, 'reviewer-id');
});

test('a watcher scan queued behind a held rename never reindexes the old file over a new commit', async t => {
  const root = await tempProject(t);
  const entered = deferred();
  const release = deferred();
  onCleanup(t, () => release.resolve());
  let hold = false;
  let reads = 0;
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    readFile: async (...args) => { reads++; return files.readFile(...args); },
    rename: async (from, to) => { if (hold) { hold = false; entered.resolve(); await release.promise; } return files.rename(from, to); },
  } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Watched' });
  hold = true;
  const writing = tracker.comment(human, item.id, 'committed');
  await entered.promise;
  const before = reads;
  const scanning = tracker.rescanAsync();
  await new Promise(done => setImmediate(done));
  assert.equal(reads, before, 'watch read waits for the tracker queue');
  release.resolve();
  await Promise.all([writing, scanning]);
  assert.equal(tracker.list()[0]?.verdicts.length, 0);
  assert.deepEqual((await tracker.viewAsync(item.id)).comments.map(c => c.text), ['committed']);
});

test('a verdict rechecks its writer after a deferred temporary write, before committing evidence', async t => {
  const root = await tempProject(t);
  const entered = deferred();
  const release = deferred();
  onCleanup(t, () => release.resolve());
  let hold = false;
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    writeFile: async (...args) => {
      await files.writeFile(...args);
      if (hold) { hold = false; entered.resolve(); await release.promise; }
    },
  } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Writer' });
  const writer = { id: 'reviewer-id', name: 'rev', role: 'reviewer' };
  hold = true;
  let role = 'reviewer';
  const writing = tracker.comment(writer, item.id, 'checked', { verdict: 'review', scope: 'full', result: 'clear', run: 'writer-run' }, undefined, () => ({ ...writer, role }));
  await entered.promise;
  role = 'implementer';
  release.resolve();
  await assert.rejects(writing, /writer changed/);
  assert.equal((await tracker.viewAsync(item.id)).comments.length, 0);
  assert.equal(tracker.list()[0]?.verdicts.length, 0);
});


const imported: ImportedIssue = { number: 1, url: 'https://example.com/1', title: 'Imported', body: '', labels: [], state: 'open', assignee: null, parent: null, blocked_by: [], comments: [], created: '2026-01-01T00:00:00.000Z' };

test('an async view waits for previously admitted writes on that item', async t => {
  const root = await tempProject(t);
  const entered = deferred();
  const release = deferred();
  onCleanup(t, () => release.resolve());
  let hold = false;
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files, rename: async (...args) => {
    if (hold) { hold = false; entered.resolve(); await release.promise; }
    return files.rename(...args);
  } } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Read your writes' });
  hold = true;
  const writing = tracker.comment(human, item.id, 'visible');
  await entered.promise;
  let answered = false;
  const reading = tracker.viewAsync(item.id).then(view => { answered = true; return view; });
  await new Promise(done => setImmediate(done));
  assert.equal(answered, false);
  release.resolve();
  await writing;
  assert.deepEqual((await reading).comments.map(c => c.text), ['visible']);
});

test('concurrent first imports reserve their lookup before I/O and create one item for the same GitHub reference', async t => {
  const root = await tempProject(t);
  const entered = deferred();
  const release = deferred();
  onCleanup(t, () => release.resolve());
  let hold = true;
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files, readdir: async (...args) => {
    if (hold) { hold = false; entered.resolve(); await release.promise; }
    return files.readdir(...args);
  } } });
  onCleanup(t, () => tracker.stop());
  const request = { type: 'task.import' as const, id: 'import', repo: 'test/project', issues: [imported] };
  const first = importIssues(tracker, human, request);
  await entered.promise;
  const second = importIssues(tracker, human, request);
  release.resolve();
  const results = await Promise.all([first, second]);
  assert.deepEqual(results.map(r => r.results[0]?.id), ['T-1', 'T-1']);
  assert.deepEqual(results.map(r => r.results[0]?.outcome), ['created', 'unchanged']);
  assert.equal(tracker.list().length, 1);
});

test('a held watcher read of a file whose frontmatter id moved shares the close mutation queue', async t => {
  const root = await tempProject(t);
  const entered = deferred();
  const release = deferred();
  onCleanup(t, () => release.resolve());
  let hold = false;
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files, readFile: async (...args) => {
    const text = await files.readFile(...args);
    if (hold) { hold = false; entered.resolve(); await release.promise; }
    return text;
  } } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Moved identity' });
  const path = join(root, item.path);
  await files.writeFile(path, (await files.readFile(path, 'utf8')).replace('id: T-1', 'id: T-2'));
  await tracker.rescanAsync();
  assert.equal(tracker.list()[0]?.id, 'T-2');
  hold = true;
  const scanning = tracker.rescanAsync();
  await entered.promise;
  let closed = false;
  const closing = tracker.close(human, 'T-2').then(view => { closed = true; return view; });
  await new Promise(done => setImmediate(done));
  assert.equal(closed, false);
  release.resolve();
  await Promise.all([scanning, closing]);
  assert.equal(tracker.list()[0]?.state, 'closed');
  assert.equal((await tracker.viewAsync('T-2')).state, 'closed');
});

test('parse/change and write preparation in one continuation count their combined blocking time once', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(0);
  let slowChange = false;
  let slowWrite = false;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock.now().getTime(), log: r => records.push(r) });
  const tracker = new Tracker({ clock, git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), parse: (...args) => {
    if (slowChange) { slowChange = false; clock.block(200); }
    return parseItem(...args);
  }, files: { ...files, writeFile: (...args) => {
    if (slowWrite) { slowWrite = false; clock.block(200); }
    return files.writeFile(...args);
  } } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Timing' });
  slowChange = true;
  slowWrite = true;
  await tracker.comment(human, item.id, 'measured', undefined, guard.resumer('task.comment', 'timing'));
  assert.deepEqual(records.filter(r => r.event === 'slow-request').map(r => [r.tool, r.phase, r.ms]), [['task.comment', 'resumed', 400]]);
});

test('import composition after file I/O is measured as resumed work', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(0);
  let slow = false;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock.now().getTime(), log: r => records.push(r) });
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files, readdir: async (...args) => {
    const names = await files.readdir(...args);
    slow = true;
    return names;
  } } });
  onCleanup(t, () => tracker.stop());
  const issue = { ...imported, get title() { if (slow) { slow = false; clock.block(400); } return 'Timed import'; } };
  await importIssues(tracker, human, { type: 'task.import', id: 'timing', repo: 'test/project', issues: [issue] }, guard.resumer('task.import', 'timing'));
  assert.deepEqual(records.filter(r => r.event === 'slow-request').map(r => [r.tool, r.phase, r.ms]), [['task.import', 'resumed', 400]]);
});


test('post-commit logging and handle-close preparation count as one resumed continuation', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(0);
  let slow = false;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock.now().getTime(), log: r => records.push(r) });
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), log: r => {
    if (slow && r.event === 'task-written') clock.block(200);
  }, files: { ...files, open: async (...args) => {
    const fd = await files.open(...args);
    const close = fd.close.bind(fd);
    fd.close = () => { if (slow) clock.block(200); return close(); };
    return fd;
  } } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Close timing' });
  slow = true;
  await tracker.comment(human, item.id, 'measured', undefined, guard.resumer('task.comment', 'timing'));
  assert.deepEqual(records.filter(r => r.event === 'slow-request').map(r => [r.tool, r.phase, r.ms]), [['task.comment', 'resumed', 400]]);
});


test('a hand rename and reindex while comments wait cannot split their commit queue', async t => {
  const root = await tempProject(t);
  const entered = deferred();
  const release = deferred();
  onCleanup(t, () => release.resolve());
  let hold = false;
  let commentOpens = 0;
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    open: (...args) => { if (String(args[0]).includes('T-1-')) commentOpens++; return files.open(...args); },
    rename: async (from, to) => { if (hold) { hold = false; entered.resolve(); await release.promise; } return files.rename(from, to); },
  } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Rename target' });
  await tracker.create(human, { title: 'Queue blocker' });
  hold = true;
  const blocker = tracker.comment(human, 'T-2', 'held');
  await entered.promise;
  const first = tracker.comment(human, item.id, 'before rename');
  const renamed = join(root, '.cland', 'tasks', 'T-1-renamed.md');
  await files.rename(join(root, item.path), renamed);
  // Model an already-admitted external reindex before later callers enter the queue.
  tracker.rescan();
  const second = tracker.comment(human, item.id, 'after rename');
  await new Promise(done => setImmediate(done));
  assert.equal(commentOpens, 0, 'all comments wait on the same tracker tail despite the new file key');
  release.resolve();
  await Promise.all([blocker, first, second]);
  assert.equal((await tracker.viewAsync(item.id)).file, 'T-1-renamed.md');
  assert.deepEqual((await tracker.viewAsync(item.id)).comments.map(c => c.text), ['before rename', 'after rename']);
});

test('watcher metadata lookup and indexing count 150 + 150 ms as one resumed continuation', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(0);
  let metadata = false;
  let indexing = false;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock.now().getTime(), log: r => records.push(r) });
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function(this: DatabaseSync, ...args: Parameters<typeof prepare>) {
    if (metadata) { metadata = false; clock.block(150); }
    return prepare.apply(this, args);
  });
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), log: r => {
    if (indexing && r.event === 'task-reindexed') { indexing = false; clock.block(150); }
  }, files: { ...files, readFile: async (...args) => {
    const text = await files.readFile(...args);
    metadata = true;
    return text;
  } } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Watch timing' });
  await files.writeFile(join(root, item.path), (await files.readFile(join(root, item.path), 'utf8')).replace('title: Watch timing', 'title: Hand timing'));
  indexing = true;
  await tracker.rescanAsync(guard.resumer('tracker.watch', 'timing'));
  assert.deepEqual(records.filter(r => r.event === 'slow-request').map(r => [r.tool, r.phase, r.ms]), [['tracker.watch', 'resumed', 300]]);
});


test('scan candidate selection and first read dispatch count as one resumed continuation', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(0);
  let candidates = false;
  let dispatch = false;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock.now().getTime(), log: r => records.push(r) });
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function(this: DatabaseSync, ...args: Parameters<typeof prepare>) {
    if (candidates) { candidates = false; clock.block(150); }
    return prepare.apply(this, args);
  });
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    readdir: async (...args) => { const names = await files.readdir(...args); candidates = true; return names; },
    readFile: (...args) => { if (dispatch) { dispatch = false; clock.block(150); } return files.readFile(...args); },
  } });
  onCleanup(t, () => tracker.stop());
  await tracker.create(human, { title: 'Scan dispatch' });
  candidates = false;
  dispatch = true;
  await tracker.rescanAsync(guard.resumer('tracker.watch', 'timing'));
  assert.deepEqual(records.filter(r => r.event === 'slow-request').map(r => [r.tool, r.phase, r.ms]), [['tracker.watch', 'resumed', 300]]);
});

test('partial read handling and dispatch of the next read count as one resumed continuation', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(0);
  let measured = false;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock.now().getTime(), log: r => records.push(r) });
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    open: async (...args) => {
      const fd = await files.open(...args);
      const read = fd.read.bind(fd);
      let partial = false;
      t.mock.method(fd, 'read', (buffer: Buffer, offset: number, length: number, position: number) => {
        if (!measured) return read(buffer, offset, length, position);
        if (partial) { measured = false; clock.block(150); return read(buffer, offset, length, position); }
        partial = true;
        return read(buffer, offset, Math.min(10, length), position).then(result => ({ buffer: result.buffer,
          get bytesRead() { clock.block(150); return result.bytesRead; },
        }));
      });
      return fd;
    },
  } });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Partial read' });
  measured = true;
  await tracker.comment(human, item.id, 'measured', undefined, guard.resumer('task.comment', 'timing'));
  assert.deepEqual(records.filter(r => r.event === 'slow-request').map(r => [r.tool, r.phase, r.ms]), [['task.comment', 'resumed', 300]]);
});

test('a failed child scan drains slow reads before admitting the next tracker write', async t => {
  const root = await tempProject(t);
  const slowEntered = deferred();
  const failingEntered = deferred();
  const release = deferred();
  let armed = false;
  let slowFinished = false;
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db'), files: {
    ...files,
    readFile: async (...args) => {
      if (armed && String(args[0]).endsWith('T-2-slow.md')) {
        slowEntered.resolve();
        await release.promise;
        slowFinished = true;
      }
      if (armed && (String(args[0]).endsWith('T-3-failing.md') || String(args[0]).endsWith('T-4-other-failure.md'))) {
        failingEntered.resolve();
        throw new Error('scan read failed');
      }
      return files.readFile(...args);
    },
  } });
  onCleanup(t, () => release.resolve()); onCleanup(t, () => tracker.stop());
  await tracker.create(human, { title: 'Container', kind: 'epic' });
  await tracker.create(human, { title: 'Slow' });
  await tracker.create(human, { title: 'Failing' });
  await tracker.create(human, { title: 'Other failure' });
  armed = true;
  let closeSettled = false;
  const closing = tracker.close(human, 'T-1').then(() => null, error => error).then(result => { closeSettled = true; return result; });
  await Promise.all([slowEntered.promise, failingEntered.promise]);
  let nextDone = false;
  const next = tracker.comment(human, 'T-1', 'after refusal').then(() => { nextDone = true; });
  await new Promise(done => setImmediate(done));
  assert.equal(closeSettled, false, 'refusal must wait for the outstanding scan read');
  assert.equal(nextDone, false, 'the next queued write cannot overtake unfinished scan work');
  armed = false;
  release.resolve();
  const refusal = String(await closing);
  assert.match(refusal, /T-3-failing\.md.*scan read failed/);
  assert.match(refusal, /T-4-other-failure\.md.*scan read failed/);
  await next;
  assert.equal(slowFinished, true);
  assert.equal(tracker.view('T-1').state, 'open');
  assert.equal(tracker.view('T-1').comments[0]?.text, 'after refusal');
});

test('tracker fatal_stall defaults to 60 seconds and accepts only positive durations', () => {
  assert.equal(parseConfig('', 'fixture').tracker.fatalStallMs, 60000);
  const configured = parseConfig('[tracker]\nfatal_stall = "2m"', 'fixture');
  assert.equal(configured.tracker.fatalStallMs, 120000);
  assert.equal(parseConfig(renderConfig(configured), 'fixture').tracker.fatalStallMs, 120000);
  assert.equal(parseConfig('[tracker]\nfatal_stall = "2147483s"', 'fixture').tracker.fatalStallMs, 2147483000);
  for (const value of ['2147484s', '30d']) {
    assert.throws(() => parseConfig(`[tracker]\nfatal_stall = "${value}"`, 'fixture'), /tracker.fatal_stall must not exceed 2147483s/);
  }
  for (const value of ['0', '-1', '"0.5s"', '"0s"', '"-1s"', '"no"', 'true']) {
    assert.throws(() => parseConfig(`[tracker]\nfatal_stall = ${value}`, 'fixture'), /tracker.fatal_stall must be a positive duration/);
  }
});

test('tracker stop abandons a held write and queued view, and a released write cannot resume publication', async t => {
  const root = await tempProject(t);
  const entered = deferred(), release = deferred();
  let hold = false;
  const events: Record<string, unknown>[] = [];
  const clock = new FakeClock();
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, clock, root, db: join(root, '.cland', 'hub.db'), storageStallMs: 20, stopTimeoutMs: 20,
    log: entry => events.push(entry), files: { ...files, writeFile: async (...args) => {
      await files.writeFile(...args);
      if (hold) { hold = false; entered.resolve(); await release.promise; }
    } },
  });
  onCleanup(t, () => release.resolve()); onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Held' });
  const before = await files.readFile(join(root, item.path), 'utf8');
  hold = true;
  const writing = tracker.comment(human, item.id, 'abandoned');
  const refusedWrite = assert.rejects(writing, /tracker storage abandoned/);
  await entered.promise;
  const reading = tracker.viewAsync(item.id);
  const refusedRead = assert.rejects(reading, /tracker storage abandoned/);
  const stopping = tracker.stop();
  assert.equal(tracker.stop(), stopping, 'stop is idempotent');
  await clock.advance(20);
  await stopping;
  release.resolve();
  await Promise.all([refusedWrite, refusedRead]);
  await new Promise(done => setImmediate(done)); // let the native write's actual continuation run
  assert.deepEqual(tracker.storageStatus().abandoned.map(op => [op.operation, op.item]), [['comment', 'T-1'], ['view', 'T-1']]);
  assert.equal(events.filter(e => e.event === 'tracker-storage-abandoned').length, 1);
  assert.equal(await files.readFile(join(root, item.path), 'utf8'), before);
  await assert.rejects(tracker.comment(human, item.id, 'later'), /tracker storage abandoned/);
});

test('stall detection leaves the queue held and clears health when the operation finishes', async t => {
  const root = await tempProject(t);
  const entered = deferred(), release = deferred(), stalled = deferred();
  let hold = false;
  const fatal: unknown[] = [];
  const events: Record<string, unknown>[] = [];
  const clock = new FakeClock();
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, clock, root, db: join(root, '.cland', 'hub.db'), storageStallMs: 100, storageFatalMs: 300,
    onStorageFatal: operation => fatal.push(operation),
    log: entry => { events.push(entry); if (entry.event === 'tracker-storage-stalled' && entry.operation === 'comment') stalled.resolve(); },
    files: { ...files, writeFile: async (...args) => {
      await files.writeFile(...args);
      if (hold) { hold = false; entered.resolve(); await release.promise; }
    } },
  });
  onCleanup(t, () => release.resolve()); onCleanup(t, () => tracker.stop());
  const item = await tracker.create(human, { title: 'Recovers' });
  hold = true;
  const writing = tracker.comment(human, item.id, 'first');
  await entered.promise;
  let answered = false;
  const second = tracker.comment(human, item.id, 'second').then(() => { answered = true; });
  await clock.advance(100);
  await stalled.promise;
  assert.equal(tracker.storageStatus().stalled, true);
  assert.equal(tracker.storageStatus().queued, 1);
  assert.equal(answered, false, 'a stall never admits the next write');
  assert.equal(tracker.view(item.id).comments.length, 0);
  release.resolve();
  await Promise.all([writing, second]);
  await clock.advance(300);
  assert.deepEqual(fatal, [], 'a finished operation must cancel its fatal deadline');
  assert.deepEqual(tracker.storageStatus(), { stalled: false, active: null, queued: 0, abandoned: [] });
  assert.deepEqual(tracker.view(item.id).comments.map(c => c.text), ['first', 'second']);
  assert.equal(events.filter(e => e.event === 'tracker-storage-stalled' && e.operation === 'comment').length, 1);
  await tracker.stop();
  assert.equal(events.some(e => e.event === 'tracker-storage-abandoned'), false);
});
