// T2: Suites scheduler with semantic executors and a guarded native boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { stageCase } from './stage-case-fixture.ts';
import { tierReceipt } from '../src/verification-tier-receipts.ts';
import type { SuiteJob } from '../src/hub/suites.ts';

const HOUR = 3_600_000;
const fullPlan = [{ name: 'check', command: 'check' }, { name: 'T2', command: 'component' },
  { name: 'T3', command: 'integration' }, { name: 'Web', command: 'web' }] as const;
function fullPeriodic(job: SuiteJob) {
  job.occasion = 'dev-t3'; job.integrated = true; job.branch = 'dev';
  job.selection!.tiers = ['T2', 'T3'];
  job.commands!.plan = [...fullPlan];
  job.tierReceipts = fullPlan.map(step => tierReceipt(job, step, 0));
  job.lease = Object.assign(job.lease!, { execution: { started: true, startedAt: job.queued } });
}
function batch(job: SuiteJob) {
  job.occasion = 'batch'; job.branch = ''; job.integrated = false; job.head = 'unrelated-candidate';
  job.batch = { id: 'batch-proof', members: [{ item: 'T-1', head: 'member-head' }] as NonNullable<SuiteJob['batch']>['members'] };
  job.commands!.plan = [{ name: 'check', command: 'check' }, { name: 'T1', command: 'unit' }, { name: 'T3', command: 'integration' }];
  job.selection!.tiers = ['T1', 'T3'];
  job.tierReceipts = job.commands!.plan.map(step => tierReceipt(job, step, 0));
}
function fullSelection(job: Pick<SuiteJob, 'selection'>) {
  assert.deepEqual(job.selection?.tiers, ['T2', 'T3']);
  assert.equal(job.selection?.mode, 'full');
  assert.notEqual(job.selection?.web, 'none', 'full periodic selection retains Web');
}

for (const scenario of ['batch', 'member-T1', 'partial-batch', 'partial-fresh-cover', 'legacy', 'different-tree', 'backstop', 'unchanged', 'phase-offset', 'unproven-baseline'] as const) {
  test(`periodic batch-tree coverage and daily full-run backstop: ${scenario}`, async t => {
    const owner = stageCase(t);
    await owner.wait('whole callback', () => owner.run(async step => {
      const wait = <T>(name: string, start: () => Promise<T>) => step(() => owner.wait(name, start));
      const { notices, fixture, started, saved, jobs } = await wait('complete scenario setup', async () => {
        const notices: string[] = [];
        const fixture = await wait('fixture setup', () => suiteUnit(owner.fixtures, { machineReceiptsOnly: true,
          onSoakNotice: (_id, text) => { notices.push(text); },
        }, 'dev_t3_every="8h"'));
        owner.adoptRoot(fixture.root);
        // Restore semantic mocks only after suiteUnit has stopped and removed its root.
        owner.fixtures.after(() => t.mock.restoreAll());
        fixture.candidate.branch = 'dev';
        fixture.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: fixture.candidate.head };
        await wait('initial scheduler tick', () => fixture.tick());
        await wait('initial scheduler settlement', () => fixture.suites.settled());
        const started = fixture.clock.now().getTime();
        const submission = await wait('semantic cover submission', () => fixture.launch({ mode: 'all', executor: 'local', occasion: 'stage', integrated: true }));
        await wait('semantic execution receipt', () => fixture.when(() => fixture.delivered.has(submission.id) ? true : undefined));
        if (scenario === 'phase-offset') fixture.clock.block(HOUR);
        await wait('durable cover result', () => fixture.finish(submission.id));
        let jobs = await wait('durable job read', () => fixture.jobs());
        const saved = jobs.find(job => job.id === submission.id)!;
        if (scenario === 'unchanged') fullPeriodic(saved);
        else if (scenario === 'phase-offset') {
          fullPeriodic(saved);
          fixture.candidate.tree = 'changed-tree';
          fixture.candidate.head = 'changed-head';
          fixture.candidate.selection.fetchedDev = fixture.candidate.head;
          const next = await wait('changed-tree semantic batch', () => fixture.launch({ mode: 'all', executor: 'local', occasion: 'stage', integrated: true }));
          await wait('changed-tree execution', () => fixture.when(() => fixture.delivered.has(next.id) ? true : undefined));
          await wait('changed-tree durable result', () => fixture.finish(next.id));
          jobs = await wait('durable changed-tree jobs', () => fixture.jobs());
          jobs[jobs.findIndex(job => job.id === saved.id)] = saved;
          batch(jobs.find(job => job.id === next.id)!);
        } else if (scenario === 'partial-fresh-cover') {
          saved.selection!.batchTests = { T3: ['hub/test/affected.test.ts'] };
          saved.completedAt = saved.finished = new Date(started + 7.5 * HOUR).toISOString();
        } else {
          batch(saved);
          if (scenario === 'partial-batch') saved.selection!.batchTests = { T3: ['hub/test/affected.test.ts'] };
          if (scenario === 'member-T1') {
            saved.commands!.plan = saved.commands!.plan!.filter(step => step.name !== 'T1');
            saved.selection!.tiers = ['T3'];
            saved.batchT1 = { skipped: true, members: [{ item: 'T-1', head: 'member-head', run: 'member-proof' }] };
            saved.tierReceipts = saved.commands!.plan.map(step => tierReceipt(saved, step, 0));
          }
          if (scenario === 'legacy') delete saved.tierReceipts;
          if (scenario === 'different-tree') saved.tree = 'different';
        }
        return { notices, fixture, started, saved, jobs };
      });
      const at = async (target: number, seed?: SuiteJob[]) => {
        fixture.clock.block(target - fixture.clock.now().getTime() - 1000);
        await wait('scheduler reopen', () => fixture.reopen(seed));
        await wait('due scheduler tick', () => fixture.tick());
        await wait('due scheduler settlement', () => fixture.suites.settled());
      };
      const periodic = () => fixture.suites.status().filter(job => job.occasion === 'dev-t3' && job.id !== saved.id);
      await at(started + 8 * HOUR, jobs);
      const suppressed = ['batch', 'member-T1', 'backstop', 'phase-offset', 'unproven-baseline'].includes(scenario);
      assert.equal(periodic().length, !suppressed && scenario !== 'unchanged' ? 1 : 0);
      if (suppressed) assert.match(notices[0] ?? '', /green batch batch-proof run /);
      if (scenario === 'backstop' || scenario === 'unchanged') {
        await at(started + 32 * HOUR);
        assert.equal(periodic().length, scenario === 'backstop' ? 1 : 0);
        if (periodic()[0]) fullSelection(periodic()[0]!);
      }
      if (scenario === 'phase-offset') {
        await at(started + 16 * HOUR); await at(started + 24 * HOUR);
        const deadline = Date.parse(saved.completedAt ?? saved.finished!) + 24 * HOUR;
        await at(deadline - 1000);
        assert.equal(periodic().length, 0, 'no full run before completion-relative deadline');
        await wait('exact backstop tick', () => fixture.tick());
        await wait('backstop settlement', () => fixture.suites.settled());
        assert.equal(periodic().length, 1, '24h deadline bypasses the 8h skip throttle after restart');
        fullSelection(periodic()[0]!);
        await wait('no duplicate tick', () => fixture.tick());
        await wait('no duplicate settlement', () => fixture.suites.settled());
        assert.equal(periodic().length, 1);
      }
      if (scenario === 'unproven-baseline') {
        const retained = await wait('retained batch read', () => fixture.jobs());
        const unknown = structuredClone(saved);
        unknown.id = 'unproven-periodic'; delete unknown.batch;
        unknown.tree = 'unproven-old-tree';
        fullPeriodic(unknown);
        delete unknown.tierReceipts;
        unknown.completedAt = unknown.finished = new Date(started + 20 * HOUR).toISOString();
        retained.push(unknown);
        await at(started + 24 * HOUR, retained);
        assert.equal(periodic().filter(job => job.id !== unknown.id).length, 0);
        await at(started + 32 * HOUR);
        const admitted = periodic().filter(job => job.id !== unknown.id);
        assert.equal(admitted.length, 1, 'unproven green metadata cannot extend batch suppression');
        fullSelection(admitted[0]!);
      }
    }));
  });
}
