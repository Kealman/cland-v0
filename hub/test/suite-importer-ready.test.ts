// T2: real Suites admission/cache, executor completion and tracker ready frames;
// importer graph, Git and every local executor boundary are in-memory fakes.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { stageCase } from './stage-case-fixture.ts';
import { fixture } from './suite-component-fixture.ts';
import { PlanGit } from './plan-stage-fixture.ts';
import { eventually, inProcessSpoke } from './harness.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef, RunStatus } from '../src/executor/executor.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import type { SuiteStatus } from '../src/protocol.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { taskImporterSelection } from '../src/suite-interactions.ts';
import { verificationSteps } from '../src/verification-plan.ts';
import { tierReceipt } from '../src/verification-tier-receipts.ts';
import type { SuiteSelection } from '../src/suite-selection.ts';
import { fenceFixtureCleanup, drainFixtureCleanup } from './process-cleanup.ts';
import { ownedDatabases } from './owned-tracker.ts';

for (const constructor of ['Tracker', 'Store'] as const) test(`importer fixture retains captured databases and root after ${constructor} initialization and close reject`, t => {
  const scope = stageCase(t);
  const fixtures = scope.resources;
  fenceFixtureCleanup(fixtures);
  let allowClose = false, root = '';
  const connections: DatabaseSync[] = [];
  scope.releaseOnClose(() => { allowClose = true; });
  scope.requireClose(() => drainFixtureCleanup(fixtures));
  return scope.wait('whole partial-constructor case', () => scope.run(async step => {
    const guarded = scope.nativeBoundary();
    const factory = (path: string) => {
      root = path.slice(0, path.lastIndexOf('/.cland/'));
      const db = new DatabaseSync(path);
      connections.push(db);
      if (connections.length === (constructor === 'Tracker' ? 1 : 2)) {
        const exec = db.exec.bind(db), close = db.close.bind(db);
        let calls = 0;
        scope.patch(db, 'exec', (sql: string) => { if (++calls > 1) throw new Error('planted constructor initialization failure'); return exec(sql); });
        scope.patch(db, 'close', () => { if (!allowClose) throw new Error('planted native close rejection'); close(); });
      }
      return db;
    };
    await step(() => scope.wait('planted initialization refusal', () => assert.rejects(() => fixture(fixtures, 0, '', false, {
      patch: scope.patch, openDatabase: factory,
    }), /planted constructor initialization failure/)));
    assert.ok(connections.some(db => db.isOpen), 'the planted close failure leaves a captured native handle');
    await assert.rejects(() => drainFixtureCleanup(fixtures), /planted native close rejection/);
    assert.equal((await stat(root)).isDirectory(), true, 'the actual directory cleanup retains the unresolved root');
    assert.equal(scope.nativeBoundary(), guarded, 'seams and native guard survive rejected close');
    allowClose = true;
    await step(() => scope.wait('positive native handle closure and root removal', () => drainFixtureCleanup(fixtures)));
    assert.equal(connections.every(db => !db.isOpen), true);
    await assert.rejects(() => stat(root), { code: 'ENOENT' });
  }));
});

for (const legacy of [false, true]) test(legacy
  ? 'same-head T0–T2 cache requires fresh importer completion before final ready evidence'
  : 'same-head importer completion supplies the final ready verification', t => {
  const scope = stageCase(t);
  const readDatabase = ownedDatabases(scope);
  // Resource hooks (including partial startup) close before manual seams restore.
  const fixtures = new Proxy(scope.resources, { get(target, key) {
    if (key === 'mock') return { method: scope.patch };
    return Reflect.get(target, key, target);
  } }) as TestContext;
  return scope.wait('whole importer completion case', () => scope.run(async step => {
    const git = new PlanGit();
    git.branches.set('t/importer', git.head);
    const f = await step(() => scope.wait('component setup', () => fixture(fixtures, 0, '[merge]\nqueue=true\n', false,
      { git: git.read, readBase: async () => 'dev', tiers: true, patch: scope.patch })));
    f.facts.branch = 't/importer';
    const reviewer = await step(() => scope.wait('reviewer setup', () => inProcessSpoke(fixtures, { discover: true, cwd: f.root, name: 'rev', sessionId: 'importer-reviewer', role: 'reviewer', clock: f.clock })));
    const request = async (frame: { type: string } & Record<string, unknown>) => {
      const response = await f.ui.request(frame); assert.equal(response.ok, true, response.error); return response.value;
    };
    const read = async () => { await f.clock.advance(100); return (await request({ type: 'task.view', item: f.item }) as { item: ItemView }).item; };
    await step(() => scope.wait('source review and criteria setup', async () => {
      await request({ type: 'task.link', item: f.item, branch: f.facts.branch });
      await request({ type: 'task.edit', item: f.item, body: '## Acceptance criteria\n- [ ] C1. Importer verification completes at this head' });
      await request({ type: 'task.criterion', item: f.item, op: 'done', criterion: 'C1' });
      const review = await reviewer.call<{ ok: boolean; error?: string }>('task.comment', { id: f.item, verdict: 'review', scope: 'full', result: 'clear', run: 'source-review' });
      assert.equal(review.ok, true, review.error);
    }));
    const base: SuiteSelection = { mode: 'hub-selected', files: ['hub/src/parser.ts'], tests: ['hub/test/component.test.ts'], reason: 'fake coverage', tiers: ['T1', 'T2'], web: 'none' };
    f.facts.selection = base;
    if (legacy) {
      const earlier = await step(() => scope.wait('old T0–T2 admission', () => f.launch()));
      await step(() => scope.wait('old T0–T2 durable completion', () => eventually('old result', async () => (await f.results()).find(row => row.id === `suite:${earlier.id}`))));
      const hit = await step(() => scope.wait('positive legacy cache control', () => f.launch()));
      assert.equal(hit.cached?.run, earlier.id, 'the existing same-head T0–T2 receipt is actually cache eligible');
      await step(() => scope.wait('legacy cache report', () => eventually('cached result', async () => (await f.results()).find(row => row.id === `suite:${hit.id}`))));
    }
    f.facts.selection = await step(() => scope.wait('fake importer graph', () => taskImporterSelection(f.root, base,
      new Map([['hub/test/native.test.ts', 'T3'], ['hub/test/unrelated.test.ts', 'T3']]), async (_root, changed, candidates) => {
        assert.deepEqual(changed, ['hub/src/parser.ts']);
        assert.deepEqual(candidates, ['hub/test/native.test.ts', 'hub/test/unrelated.test.ts']);
        return ['hub/test/native.test.ts'];
      })));
    const launched = Promise.withResolvers<RunRef>();
    scope.patch(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => {
      f.executions.push(structuredClone(run));
      await writeFile(run.log, 'fake importer worker awaits completion\n');
      launched.resolve(run);
    });
    const admission = await step(() => scope.wait('selected verification admission', () => f.launch()));
    assert.equal(admission.cached, undefined, 'a same-head receipt missing importers cannot satisfy the new selection');
    const run = await step(() => scope.wait('executor observed selected run', () => launched.promise));
    assert.equal(run.id, admission.id);
    assert.equal(run.head, git.head);
    assert.deepEqual(run.selection?.durationCheck?.files, ['hub/test/native.test.ts']);
    assert.deepEqual(verificationSteps(run.commands!).map(value => value.name), ['check', 'T1', 'T2', 'T3']);
    assert.notEqual((await read()).status, 'ready', 'source review alone does not verify the criterion');
    const producer: RunStatus = { state: 'done', code: 0, finished: f.clock.now().toISOString(),
      tierReceipts: verificationSteps(run.commands!).map(value => tierReceipt(run, value, 0)),
      platform: { os: 'darwin', arch: 'arm64', release: 'fixture', node: process.version, nvim: 'none' } };
    // Publish the producer's completion, then wait for its persisted public receipt.
    f.receipts.set(run.id, producer);
    await step(() => scope.wait('durable selected completion', () => eventually('importer result', async () => {
      await f.settle();
      const status = await request({ type: 'hub.status', history: true }) as { suites: SuiteStatus[] };
      return status.suites.find(value => value.id === run.id && value.reported && value.outcome?.code === 0);
    })));
    const reader = readDatabase(join(f.root, '.cland/hub.db'), path => new DatabaseSync(path, { readOnly: true }));
    try {
      const persisted = JSON.parse(reader.prepare('select value from meta where key = ?').get(`suite-job:${run.id}`)!.value as string) as { job: SuiteJob };
      assert.equal(persisted.job.head, run.head);
      assert.deepEqual(persisted.job.selection?.durationCheck?.files, ['hub/test/native.test.ts']);
      assert.deepEqual(persisted.job.tierReceipts, producer.tierReceipts);
    } finally { reader.close(); }
    const final = await step(() => scope.wait('final reviewer verification', () => reviewer.call<{ ok: boolean; error?: string }>('task.comment', {
      id: f.item, verdict: 'review', scope: 'full', result: 'clear', run: `verified-${run.id}`, verified: 'all', text: `Verified importer completion ${run.id} at ${run.head}`,
    })));
    assert.equal(final.ok, true, final.error);
    const ready = await step(() => scope.wait('ready item at selected completion', () => eventually('ready item', async () => { const view = await read(); if (view.status !== 'ready') throw new Error(JSON.stringify({ status: view.status, criteria: view.criteria, verdicts: view.verdicts, qa: view.qaPolicy })); return view; }, { timeoutMs: 1000, behaviour: 'ready item' })));
    assert.equal(ready.verify?.id, run.id);
    assert.equal(ready.verify?.head, run.head);
    assert.equal(ready.verify?.result, 'passed');
    assert.equal(ready.verify?.cached, undefined);
    assert.equal(ready.criteria[0]!.marks.some(value => value.kind === 'verified' && value.commit === run.head && value.run === `verified-${run.id}`), true);
  }), 15000);
});
