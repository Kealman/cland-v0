// T2: connection-owned SQLite statements through injected in-memory databases; no native processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { TrackerIndex } from '../src/tracker/index-db.ts';
import { parseItem } from '../src/tracker/item.ts';
import { projectHub, tempProject } from './harness.ts';
import { caseDeadlines, drainFixtureWork } from './case-deadlines.ts';
import { afterCleanup, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { existsSync } from 'node:fs';

function databaseProbe() {
  const counts = new Map<string, number>();
  const statements: StatementSync[] = [];
  const connections: DatabaseSync[] = [];
  const open = (path: string) => {
    const db = new DatabaseSync(path);
    connections.push(db);
    const prepare = db.prepare.bind(db);
    db.prepare = sql => {
      counts.set(sql, (counts.get(sql) ?? 0) + 1);
      const statement = prepare(sql);
      statements.push(statement);
      return statement;
    };
    return db;
  };
  const close = () => {
    const failures: unknown[] = [];
    for (const db of connections) {
      try { if (db.isOpen) db.close(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, 'probe connections did not close');
  };
  return { open, counts, statements, connections, close };
}

/** Join original setup/body before teardown; restore the guard only after roots and DBs close. */
function guardedReads(t: test.TestContext, body: (fixture: {
  probe: () => ReturnType<typeof databaseProbe>;
  hub: (probe: ReturnType<typeof databaseProbe>) => Promise<Awaited<ReturnType<typeof projectHub>>>;
}) => Promise<void>) {
  let drained = false;
  const scope = caseDeadlines(t, { ownership: { guardDirectoryRemoval,
    beforeDirectories(context, close) {
      beforeDirectories(context, async () => { await close(); drained = true; });
    },
  } });
  const probes: ReturnType<typeof databaseProbe>[] = [];
  const roots = new Set<string>();
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restore: (() => void) | undefined;
  const closeProbes = () => {
    const failures: unknown[] = [];
    for (const probe of probes) try { probe.close(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'read fixture connections did not close');
  };
  // Enroll fallback ownership before any constructor can call probe.open.
  afterCleanup(scope.fixtures, closeProbes);
  afterCleanup(t, async () => {
    await drainFixtureWork();
    assert.ok(drained, 'original fixture work or cleanup incomplete; guard retained');
    for (const root of roots) assert.equal(existsSync(root), false, 'root retained; guard retained');
    for (const probe of probes) for (const db of probe.connections) assert.equal(db.isOpen, false);
    try { guard?.verify(); } finally { restore?.(); }
  });
  return scope.run(async (admit, signal) => {
    await scope.wait('native guard setup', () => admit(async () => {
      guard = await fakeNativeGuard(value => { restore = value; });
    }));
    const probe = () => { const value = databaseProbe(); probes.push(value); return value; };
    await body({ probe, hub: database => scope.wait('hub acquisition', () => admit(async () => {
      const root = await tempProject(scope.fixtures);
      roots.add(root);
      scope.adoptRoot(root);
      signal.throwIfAborted();
      try { return await projectHub(scope.fixtures, root, {}, { openDatabase: database.open }); }
      finally {
        // projectHub enrolled its stop guard before acquiring any DB; append the fallback after it.
        guardDirectoryRemoval(root, closeProbes);
      }
    })) });
  });
}

test('tracker hot reads reuse SQL with fresh bindings and finalize on connection close', t => guardedReads(t, async fixture => {
  for (let connection = 0; connection < 2; connection++) {
    const probe = fixture.probe();
    const index = new TrackerIndex(':memory:', undefined, probe.open);
    try {
      const put = (title: string) => index.put(parseItem(`---\nid: T-1\ntitle: ${title}\nparent: E-2\nlabels: [alpha, beta]\nblocked_by: [T-3]\n---\n## Acceptance criteria\n\n- [ ] C1. Fixture criterion\n`),
        { file: 'fixture.md', hash: title, source: 'hand', indexedAt: 0 });
      put('Before');
      probe.counts.clear();
      for (let round = 0; round < 3; round++) {
        const rows = index.list();
        assert.equal(rows[0]!.title, 'Before');
        assert.equal(index.criteriaCounts(rows[0]!, null).total, 1);
        assert.equal(index.list({ state: 'closed' }).length, 0);
        assert.equal(index.list({ state: 'open' }).length, 1);
        assert.equal(index.get('T-1')!.title, 'Before');
        assert.equal(index.get('T-99'), null);
        assert.equal(index.children('E-2').length, 1);
        assert.equal(index.list({ labels: ['alpha'] }).length, 1);
        assert.equal(index.list({ labels: ['alpha', 'beta', 'alpha'] }).length, 1);
        assert.equal(index.list({ labels: ['alpha', 'missing'] }).length, 0);
      }
      assert.ok(probe.counts.size >= 5, 'positive control: list variants, hydration and point reads reached prepare');
      for (const [sql, count] of probe.counts) assert.equal(count, 1, sql);
      put('After');
      assert.equal(index.list()[0]!.title, 'After');
    } finally { index.close(); }
    for (const statement of probe.statements) assert.throws(() => statement.all());
    assert.throws(() => index.list());
  }
}));

test('hub stop closes the tracker and store connections and finalizes their prepared reads', t => guardedReads(t, async fixture => {
  const probe = fixture.probe();
  const hub = await fixture.hub(probe);
  await hub.stop();
  assert.ok(probe.connections.length >= 2, 'positive control: tracker and Store opened connections');
  assert.ok([...probe.counts.keys()].some(sql => sql.includes('from tracker_items i')));
  assert.ok([...probe.counts.keys()].some(sql => sql.includes('from suite_job_summaries')));
  for (const db of probe.connections) assert.equal(db.isOpen, false);
  for (const statement of probe.statements) assert.throws(() => statement.all());
}));

test('suite summaries and inbox reads reuse final SQL text and finalize on connection close', t => guardedReads(t, async fixture => {
  for (let connection = 0; connection < 2; connection++) {
    const probe = fixture.probe();
    const store = new Store(':memory:', probe.open);
    try {
      probe.counts.clear();
      for (let round = 0; round < 3; round++) {
        assert.deepEqual(store.suiteJobSummaries(), []);
        assert.deepEqual(store.inboxMessages(), []);
        assert.deepEqual(store.inboxWaits(), []);
        assert.equal(store.inboxReplyAt('missing', 'topic-missing'), undefined);
      }
      assert.ok(probe.counts.size >= 4, 'positive control: inbox SQL was prepared');
      assert.equal(probe.counts.get('select value from suite_job_summaries'), 1);
      for (const [sql, count] of probe.counts) assert.equal(count, 1, sql);
      store.setMeta('suite-job:0', JSON.stringify({ position: 0, job: { id: 'fixture-suite', state: 'finished' } }));
      assert.equal(JSON.parse(store.suiteJobSummaries()[0]!).job.id, 'fixture-suite');
      store.waitInInbox({ kind: 'message', id: 'fixture-message', subject: 'fixture', since: '2026-11-19T00:00:00Z' });
      assert.equal(store.inboxWaits()[0]!.id, 'fixture-message');
    } finally { store.close(); }
    for (const statement of probe.statements) assert.throws(() => statement.all());
    assert.throws(() => store.inboxMessages());
  }
}));
