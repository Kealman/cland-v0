// T1: heartbeat actionability uses committed Store facts and a fake clock, without sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { heartbeatDigest } from '../src/hub/heartbeat.ts';
import { Store } from '../src/hub/store.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import type { ItemSummary } from '../src/tracker/tracker.ts';
import { FakeClock } from './fake-clock.ts';

test('ended runs leave the stale digest on item closure or a later posted result while history stays intact', t => {
  const clock = new FakeClock();
  const store = new Store();
  t.after(() => store.close());
  const at = clock.now().toISOString();
  const items: ItemSummary[] = ['T-1', 'T-2', 'T-3'].map(id => ({
    id, kind: 'task', title: id, state: 'open', status: 'in progress', rank: 10,
    labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null,
    created: at, updated: at, file: `${id}.md`, claim: null, holds: [], verdicts: [],
    verdictBase: null, criteria: { total: 0, done: 0, verified: 0, stale: 0, failed: 0 },
  }));
  const run = (id: string, item: string | null, sequence: number, reported = false): SuiteJob => ({
    id, item, sequence, mode: 'auto', executor: 'local', cwd: '/project', topic: 'agents', to: [],
    actor: null, head: 'head', branch: 'task', log: '', result: '', gate: '', pid: null,
    queued: at, started: at, finished: at, state: 'finished', outcome: { code: 0, cause: 'exit' },
    artifact: null, reported, error: null,
  });
  const history = [run('z-older-posted', 'T-2', 0, true), run('closed', 'T-1', 1), run('superseded', 'T-2', 2)];
  for (const job of history) store.setMeta(`suite-job:${job.id}`, JSON.stringify({ position: job.sequence, job }));
  const active = [run('open', 'T-3', 3), run('unbound', null, 4)];
  store.setMeta('suite-jobs', JSON.stringify(active));
  const savedHistory = store.suiteJobHistory();
  const savedActive = store.meta('suite-jobs');
  const digest = () => heartbeatDigest(store, items, 1000, clock.now().getTime(), 0, 1000);
  clock.block(2000);
  assert.equal(digest().stale, 4, 'an earlier posted result does not hide a later unreported run');
  assert.match(digest().text, /run superseded ended without a posted result · age 2s/);

  items[0]!.state = 'closed';
  assert.equal(digest().stale, 3);
  assert.doesNotMatch(digest().text, /run closed /);
  assert.deepEqual(store.suiteJobHistory(), savedHistory);
  assert.equal(store.meta('suite-jobs'), savedActive);

  const later = run('a-later-result', 'T-2', 5);
  // Cached results retain an older execution timestamp; admission order decides which run is later.
  later.finished = '2020-01-01T00:00:00.000Z';
  const saveLater = () => store.setMeta(`suite-job:${later.id}`, JSON.stringify({ position: 5, job: later }));
  saveLater();
  assert.equal(digest().stale, 4, 'a later run without publication cannot supersede the missing result');
  later.reported = true;
  saveLater();
  const withResult = store.suiteJobHistory();
  assert.equal(digest().stale, 2);
  assert.doesNotMatch(digest().text, /run (closed|superseded|a-later-result) /);
  assert.match(digest().text, /run open ended without a posted result/);
  assert.match(digest().text, /run unbound ended without a posted result/);
  assert.deepEqual(store.suiteJobHistory(), withResult, 'rendering never rewrites run history');
  for (const job of history) assert.equal(store.meta(`suite-job:${job.id}`), JSON.stringify({ position: job.sequence, job }));
  assert.equal(store.meta('suite-jobs'), savedActive, 'rendering never changes the active run record');
});
