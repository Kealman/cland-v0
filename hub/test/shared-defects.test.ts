// Real spec reporter excerpts from A-3637, A-3657 and A-3645 (2026-10-16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { failingTests, reportSharedDefects } from '../src/hub/shared-defects.ts';
import { HubCore } from '../src/hub/core.ts';
import { Store } from '../src/hub/store.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { tempProject } from './harness.ts';

test('receipt failures retain file and test identity across assertion lines and timestamped load gates', async () => {
  const logs = await Promise.all(['3637', '3657', '3645'].map(id => readFile(new URL(`./fixtures/shared-defects/A-${id}.log`, import.meta.url), 'utf8')));
  const worker = 'hub/test/verification-workers.test.ts::verify persists overrides, delivers remote workers, prices requested size and separates cached measurements';
  const gate = 'hub/test/suite-runner.test.ts::a live older-version holder with start <timestamp> keeps its lock';
  assert.deepEqual(failingTests(logs[0]!), [worker]);
  assert.deepEqual(failingTests(logs[1]!), [gate, worker]);
  assert.deepEqual(failingTests(logs[2]!), [gate, 'hub/test/heartbeat.test.ts::the digest ages review and ready items and open asks, caps both sections, and includes claimed sessions']);
});

test('failure history survives reopening, expires at 72 hours and commits one notice across concurrent retries', async t => {
  const root = await tempProject(t);
  const database = join(root, 'history.sqlite');
  let core = new HubCore({ store: new Store(database) });
  t.after(() => { core.close(); core.store.close(); });
  const reopen = () => { core.close(); core.store.close(); core = new HubCore({ store: new Store(database) }); };
  const log = await readFile(new URL('./fixtures/shared-defects/A-3637.log', import.meta.url), 'utf8');
  const start = Date.parse('2026-10-16T01:00:00Z');
  const job = (id: string, branch: string, at: number): SuiteJob => ({
    id, branch, head: 'unknown', cwd: root, mode: 'auto', topic: 'agents', to: [], actor: null,
    log: '', result: '', gate: '', pid: null, started: null, outcome: { code: 1, cause: '' },
    artifact: null, reported: false, error: null, executor: 'local', item: 'T-1', completedAt: new Date(at).toISOString(),
  });
  const report = (job: SuiteJob, at: number) => reportSharedDefects(core, job, log, { id: `A-${job.id}`, path: `/logs/${job.id}` }, () => {}, at);
  const notices = () => core.topicHistory('agents').messages.filter(m => m.kind === 'shared-defect');
  await report(job('first', 'a', start), start);
  reopen();
  const later = start + 72 * 60 * 60 * 1000 + 1;
  await report(job('second', 'b', later), later);
  assert.equal(notices().length, 0, 'the old branch has expired');
  await report(job('first', 'a', start), later);
  assert.equal(notices().length, 0, 'replaying an expired result cannot refresh it');
  await Promise.all([report(job('third', 'c', later + 1), later + 1), report(job('third', 'c', later + 1), later + 1)]);
  assert.equal(notices().length, 1);
  assert.match(notices()[0]!.text, /Run second/);
  assert.match(notices()[0]!.text, /Run third/);
  assert.doesNotMatch(notices()[0]!.text, /Run first/);
  reopen();
  await report(job('fourth', 'd', later + 2), later + 2);
  assert.equal(notices().length, 1, 'notice deduplication survives restart');
});

test('passing, cancelled, cached, integrated and unbound results cannot establish a shared defect', async t => {
  const root = await tempProject(t);
  const core = new HubCore();
  t.after(() => { core.close(); core.store.close(); });
  const log = await readFile(new URL('./fixtures/shared-defects/A-3637.log', import.meta.url), 'utf8');
  const job: SuiteJob = { id: 'task', branch: 'task', head: 'unknown', cwd: root, mode: 'auto', topic: 'agents', to: [], actor: null, log: '', result: '', gate: '', pid: null, started: null, outcome: { code: 1, cause: '' }, artifact: null, reported: false, error: null, executor: 'local', item: 'T-1' };
  for (const extra of [{ outcome: { code: 0, cause: '' } }, { cancelled: true }, { requesterDied: true }, { cached: { run: 'old', tree: 'tree', head: 'head' } }, { integrated: true }, { item: null }, { item: 'E-2' }]) {
    await reportSharedDefects(core, { ...job, id: String(JSON.stringify(extra)), branch: 'other', ...extra }, log, { id: 'A-other', path: '/logs/other' }, () => {});
  }
  await reportSharedDefects(core, job, log, { id: 'A-task', path: '/logs/task' }, () => {});
  assert.equal(core.topicHistory('agents').messages.filter(m => m.kind === 'shared-defect').length, 0);
});
