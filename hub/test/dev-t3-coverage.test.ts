// T1: structured periodic-cover policy, no hub, executor or native imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { batchDevT3Cover, fullPeriodicDevT3Cover } from '../src/dev-t3-coverage.ts';
import { tierReceipt } from '../src/verification-tier-receipts.ts';
import type { SuiteJob } from '../src/hub/suites.ts';

const plan = [{ name: 'check', command: 'check' }, { name: 'T1', command: 'unit' }, { name: 'T3', command: 'integration' }] as const;
function cover(changes: Partial<SuiteJob> = {}): SuiteJob {
  return { id: 'run', tree: 'tree', head: 'candidate-head', occasion: 'batch', mode: 'all', state: 'finished', reported: true,
    artifact: 'A-1', outcome: { code: 0, cause: 'completed' }, batch: { id: 'batch', members: [] },
    selection: { mode: 'full', reason: 'batch', files: [], tiers: ['T1', 'T3'] },
    commands: { check: 'check', test: 'test', prepare: '', plan: [...plan] },
    tierReceipts: plan.map(step => tierReceipt({ id: 'run', tree: 'tree' }, step, 0)), ...changes } as SuiteJob;
}

test('a complete batch covers the identical dev tree without commit ancestry', () => {
  assert.deepEqual(batchDevT3Cover(cover(), 'tree'), { batch: 'batch', run: 'run' });
});

test('omitted batch T1 requires named proofs for every pinned member', () => {
  const job = cover();
  job.batch!.members = [{ item: 'T-1', head: 'head' }] as NonNullable<SuiteJob['batch']>['members'];
  job.selection!.tiers = ['T3'];
  job.commands!.plan = plan.filter(step => step.name !== 'T1');
  job.tierReceipts = job.tierReceipts!.filter(row => row.tier !== 'T1');
  assert.equal(batchDevT3Cover(job, 'tree'), null);
  job.batchT1 = { skipped: true, members: [{ item: 'T-1', head: 'head', run: 'member-run' }] };
  assert.deepEqual(batchDevT3Cover(job, 'tree'), { batch: 'batch', run: 'run' });
  for (const members of [[], [{ item: 'T-1', head: 'old', run: 'member-run' }], [{ item: 'T-2', head: 'head', run: 'member-run' }]]) {
    job.batchT1.members = members;
    assert.equal(batchDevT3Cover(job, 'tree'), null);
  }
});

for (const [name, changes] of Object.entries({
  'different tree': { tree: 'other' }, 'legacy missing rows': { tierReceipts: [] },
  'nonbatch': { occasion: 'stage' },
  'red': { outcome: { code: 1, cause: 'failed' } }, 'unexecuted': { outcome: { code: 0, cause: 'missing', notRun: 'infrastructure' } },
  'unreported': { reported: false }, 'no artifact': { artifact: null }, 'unfinished': { state: 'running' },
  'cached': { cached: { run: 'old', head: 'head', tree: 'tree' } }, 'cancelled': { cancelled: true },
  'requester lost': { requesterDied: true }, 'missing Web': { webPhase: { status: 'not-run', reason: 'missing' } },
  'diagnostic': { batch: { id: 'batch', members: [], diagnostic: { key: 'key', files: [] } } },
  'subset': { selection: { mode: 'full', reason: 'subset', files: [], tests: [], tiers: ['T1', 'T3'] } },
} as Record<string, Partial<SuiteJob>>)) test(`${name} batch supplies no periodic coverage`, () => {
  assert.equal(batchDevT3Cover(cover(changes), 'tree'), null);
});

test('printed success never replaces complete identity-bound producer receipts', () => {
  const legacy = cover(); delete legacy.tierReceipts; delete legacy.batch;
  assert.equal(batchDevT3Cover(legacy, 'tree'), null);
  for (const rows of [[], ...['run', 'tree', 'command'].map(key => cover().tierReceipts!.map(row => ({ ...row, [key]: 'foreign' }))),
    cover().tierReceipts!.map(row => ({ ...row, exit: 1 })),
    cover().tierReceipts!.map(row => ({ ...row, exit: null, completion: 'incomplete' as const })),
  ]) assert.equal(batchDevT3Cover(cover({ tierReceipts: rows, outcome: { code: 0, cause: 'tier T1: exit 0; tier T3: exit 0' } }), 'tree'), null);
});

test('only ordered interrupted steps superseded by the same command can cover dev', () => {
  const rows = cover().tierReceipts!;
  const interrupted = { ...rows[0]!, exit: 143 };
  assert.ok(batchDevT3Cover(cover({ tierReceipts: [interrupted, ...rows] }), 'tree'));
  assert.equal(batchDevT3Cover(cover({ tierReceipts: [...rows, interrupted] }), 'tree'), null);
  assert.equal(batchDevT3Cover(cover({ tierReceipts: [{ ...interrupted, exit: 1 }, ...rows] }), 'tree'), null);
});

function periodic(): SuiteJob {
  const job = cover({ occasion: 'dev-t3', integrated: true, branch: 'dev' });
  delete job.batch;
  job.selection!.tiers = ['T2', 'T3'];
  job.commands!.plan = [{ name: 'check', command: 'check' }, { name: 'T2', command: 'component' },
    { name: 'T3', command: 'integration' }, { name: 'Web', command: 'web' }];
  job.tierReceipts = job.commands!.plan.map(step => tierReceipt(job, step, 0));
  return job;
}

test('daily baseline requires a complete full periodic selection and producer plan', () => {
  assert.equal(fullPeriodicDevT3Cover(periodic()), true);
  for (const name of ['check', 'T2', 'T3', 'Web']) {
    const job = periodic();
    job.commands!.plan = job.commands!.plan!.filter(step => step.name !== name);
    assert.equal(fullPeriodicDevT3Cover(job), false, `missing planned ${name}`);
    const incomplete = periodic();
    incomplete.tierReceipts = incomplete.tierReceipts!.filter(row => row.tier !== (name === 'check' ? 'T0' : name));
    assert.equal(fullPeriodicDevT3Cover(incomplete), false, `missing executed ${name}`);
  }
  for (const key of ['tierReceipts', 'commands', 'selection'] as const) {
    const job = periodic(); delete job[key];
    assert.equal(fullPeriodicDevT3Cover(job), false);
  }
  const noArtifact = periodic(); noArtifact.artifact = null;
  assert.equal(fullPeriodicDevT3Cover(noArtifact), false);
});

test('legacy partial diagnostic and foreign periodic records do not advance the daily baseline', () => {
  const changes: Array<(job: SuiteJob) => void> = [
    job => { job.state = 'running'; }, job => { job.reported = false; },
    job => { job.integrated = false; }, job => { job.branch = 'task'; }, job => { job.mode = 'auto'; },
    job => { job.selection!.tests = []; }, job => { job.selection!.nvimTests = []; },
    job => { job.selection!.shard = { files: [], nvim: false }; }, job => { job.selection!.web = 'none'; },
    job => { job.selection!.tiers = ['T3']; }, job => { job.devT3Probe = { key: 'probe', files: [] }; },
    job => { job.cached = { run: 'old', tree: 'tree', head: 'head' }; }, job => { job.cancelled = true; },
    job => { job.outcome = { code: 0, cause: 'unexecuted', notRun: 'infrastructure' }; },
    job => { job.tierReceipts = job.tierReceipts!.map(row => ({ ...row, tree: 'foreign' })); },
    job => { job.tierReceipts = job.tierReceipts!.map(row => ({ ...row, exit: null, completion: 'incomplete' })); },
  ];
  for (const change of changes) {
    const job = periodic(); change(job);
    assert.equal(fullPeriodicDevT3Cover(job), false);
  }
});
