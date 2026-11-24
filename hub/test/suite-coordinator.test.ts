// T1: Coordinator admission uses stored identity and semantic executor receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { stat } from 'node:fs/promises';
import { reportCase as retentionCase } from './suite-report-case.ts';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import streams from 'node:fs';
import fs from 'node:fs/promises';

test('failed result reports are visible and retry without replacing finalized logs', t => {
 const scope = retentionCase(t);
 return scope.run(async admit => {
  const step = <T>(_name: string, work: () => Promise<T>) => admit(() => scope.wait(_name, work));
  const f = await step('setup', () => scope.unit({ patch: scope.patch }));
  let attempts = 0;
  f.beforeReport(async () => { attempts++; throw new Error('recipient unavailable'); });
  const run = await step('admit', () => f.launch());
  await step('complete', () => f.finish(run.id, 0, '# tests 1\n# pass 1\n', false));
  assert.equal(attempts, 1);
  assert.deepEqual(f.logs.filter(e => e.event === 'suite-report-failed').map(e => [e.id, e.error]), [[run.id, 'recipient unavailable']]);
  const job = (await f.jobs()).find(j => j.id === run.id)!;
  const original = await stat(job.log);
  await step('early tick', async () => { await f.tick(); await f.suites.settled(); });
  assert.equal(attempts, 1);
  await step('retry due', async () => { await f.tick(5000); await f.suites.settled(); });
  assert.equal(attempts, 2);
  assert.equal((await stat(job.log)).ino, original.ino, 'no atomic log replacement on retry');
  await step('recover reporter', async () => {
    f.beforeReport(async () => { attempts++; });
    await f.tick(10000); await f.suites.settled();
  });
  assert.equal(f.status(run.id).reported, true);
  assert.equal(attempts, 3);
 });
});

test('shared legacy log retries retain each run evidence through restart', t => {
 const scope = retentionCase(t);
 return scope.run(async step => {
  const f = await step(() => scope.unit({ patch: scope.patch }));
  const first = await step(() => f.launch());
  await step(() => f.finish(first.id));
  const template = (await f.jobs()).find(j => j.id === first.id)!;
  const shared = join(f.root, 'legacy.log');
  let rewrites = 0, snapshots = 0;
  const rename = fs.rename, copy = fs.copyFile;
  scope.patch(fs, 'rename', async (...args: Parameters<typeof rename>) => {
    if (args[1] === shared) rewrites++;
    return rename(...args);
  });
  scope.patch(fs, 'copyFile', async (...args: Parameters<typeof copy>) => {
    if (args[0] === shared) snapshots++;
    return copy(...args);
  });
  await writeFile(shared, 'first evidence\n# tests 1\n# pass 1\n');
  const a = { ...template, id: 'legacy-a', log: shared, artifact: null, reported: false, provenanceFinalized: false };
  delete a.finalizedLog;
  const b = { ...a, id: 'legacy-b', head: 'c'.repeat(40) };
  let fail = true;
  const evidence = new Map<string, string>();
  f.beforeReport(async job => {
    evidence.set(job.id, await readFile(job.log, 'utf8'));
    if (job.id === a.id && fail) throw new Error('recipient unavailable');
  });
  await step(() => f.reopen([a]));
  await step(async () => { await f.tick(); await f.suites.settled(); });
  assert.equal(f.status(a.id).error, 'recipient unavailable');
  const savedA = (await f.jobs()).find(j => j.id === a.id)!;
  await writeFile(shared, 'second evidence\n# tests 1\n# pass 1\n');
  await step(() => f.reopen([savedA, b]));
  await step(async () => { await f.tick(); await f.suites.settled(); });
  assert.equal(f.status(b.id).reported, true);
  assert.match(evidence.get(b.id)!, /second evidence/);
  assert.match(evidence.get(b.id)!, new RegExp(b.head));
  fail = false;
  await step(() => f.reopen());
  await step(async () => { await f.tick(5000); await f.suites.settled(); });
  assert.equal(f.status(a.id).reported, true);
  assert.match(evidence.get(a.id)!, /first evidence/);
  assert.doesNotMatch(evidence.get(a.id)!, /second evidence/);
  assert.match(evidence.get(a.id)!, new RegExp(a.head));
  assert.equal(rewrites, 2, 'one finalization per run, none on the restarted retry');
  assert.equal(snapshots, 2, 'one immutable copy per run, none on the restarted retry');
 });
});

for (const priorReport of [false, true]) test(`evidence failure is a secondary diagnostic only after a report attempt (${priorReport})`, t => {
 const scope = retentionCase(t);
 return scope.run(async step => {
  const f = await step(() => scope.unit({ patch: scope.patch }));
  let attempts = 0, failEvidence = !priorReport;
  f.beforeReport(async () => { attempts++; throw new Error('recipient unavailable'); });
  const create = streams.createReadStream;
  scope.patch(streams, 'createReadStream', (...args: Parameters<typeof create>) => {
    if (failEvidence && String(args[0]).endsWith('/finalized.log')) throw new Error('evidence unavailable');
    return create(...args);
  });
  const run = await step(() => f.launch());
  await step(() => f.finish(run.id, 0, '# tests 1\n# pass 1\n', false));
  if (priorReport) {
    assert.equal(attempts, 1);
    failEvidence = true;
    await step(async () => { await f.tick(5000); await f.suites.settled(); });
  }
  const saved = (await f.jobs()).find(j => j.id === run.id)!;
  assert.equal(attempts, priorReport ? 1 : 0);
  assert.equal(f.logs.filter(e => e.event === 'suite-report-failed').length, priorReport ? 1 : 0);
  if (priorReport) {
    assert.equal(saved.reportFailure?.error, 'recipient unavailable');
    assert.equal(saved.reportFailure?.secondary, 'evidence unavailable');
  } else assert.equal(saved.reportFailure, undefined);
 });
});

const actor = { name: 'display', sessionId: 'coordinator-id', shell: true as const };
function register(f: Awaited<ReturnType<typeof suiteUnit>>, role = 'coordinator') {
  f.store.rememberSession('actual', f.clock.now().getTime());
  f.store.rememberSessionId('actual', actor.sessionId);
  f.store.rememberRole('actual', role);
}

test('coordinator_suites defaults, validates and round trips', () => {
  assert.equal(parseConfig('', 'test', {}).verification.coordinatorSuites, 1);
  const config = parseConfig('[verification]\ncoordinator_suites=2', 'test', {});
  assert.equal(parseConfig(renderConfig(config), 'test', {}).verification.coordinatorSuites, 2);
  for (const value of ['0', '-1', '1.5', '"2"', 'true']) {
    assert.throws(() => parseConfig(`[verification]\ncoordinator_suites=${value}`, 'test', {}), /verification.coordinator_suites must be a positive integer/);
  }
});

test('Coordinator admits two keys, joins retries after restart and queues at remote capacity', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true }, 'coordinator_suites=2');
  register(f);
  const first = await f.launch({ actor, executor: 'droplet' });
  await f.machine.waits.run(f.when(() => f.status(first.id).state === 'running' ? true : undefined));
  await f.machine.started(first.id);
  f.candidate.head = 'b'.repeat(40);
  const second = await f.launch({ actor, executor: 'droplet' });
  assert.notEqual(first.id, second.id);
  assert.equal(f.status(second.id).state, 'queued');
  assert.equal(f.suites.snapshot().remote!.length, 1);
  await f.reopen();
  assert.equal((await f.launch({ actor, executor: 'droplet' })).id, second.id);
  f.candidate.head = 'a'.repeat(40);
  assert.equal((await f.launch({ actor, executor: 'droplet' })).id, first.id);
  f.candidate.head = 'c'.repeat(40);
  await assert.rejects(f.launch({ actor, executor: 'droplet' }), { message: 'this session already has a suite queued or running (coordinator_suites cap 2)' });
  assert.equal(f.suites.status().length, 2);
});

for (const role of ['coordinator', 'implementer', 'reviewer', 'qa', null]) test(`local and role bounds remain (${role})`, async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true }, 'coordinator_suites=2');
  if (role) register(f, role);
  f.hold(true);
  await f.launch({ actor, executor: 'local' });
  f.candidate.head = 'b'.repeat(40);
  await assert.rejects(f.launch({ actor, executor: 'local' }), { message: 'this session already has a suite queued or running' });
  if (role !== 'coordinator') {
    await assert.rejects(f.launch({ actor: { ...actor, name: 'coordinator' }, executor: 'droplet' }), { message: 'this session already has a suite queued or running' });
  }
});


test('two Coordinator droplet keys execute concurrently within the remote budget', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 2, machineReceiptsOnly: true }, 'coordinator_suites=2');
  register(f);
  const first = await f.launch({ actor, executor: 'droplet' });
  f.candidate.head = 'b'.repeat(40);
  const second = await f.launch({ actor, executor: 'droplet' });
  for (const run of [first, second]) {
    await f.machine.waits.run(f.when(() => f.status(run.id).state === 'running' ? true : undefined));
    await f.machine.started(run.id);
  }
  assert.equal(f.suites.snapshot().remote!.length, 2);
  assert.equal(f.status(first.id).state, 'running');
  assert.equal(f.status(second.id).state, 'running');
});


test('Coordinator default cap retains the old refusal', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', machineReceiptsOnly: true });
  register(f);
  await f.launch({ actor, executor: 'droplet' });
  f.candidate.head = 'b'.repeat(40);
  await assert.rejects(f.launch({ actor, executor: 'droplet' }), { message: 'this session already has a suite queued or running' });
});

test('a local-only matching key cannot bypass the Coordinator droplet cap', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true }, 'coordinator_suites=2');
  register(f);
  f.hold(true);
  const local = await f.launch({ actor, executor: 'local' });
  for (const head of ['b', 'c']) {
    f.candidate.head = head.repeat(40);
    await f.launch({ actor, executor: 'droplet' });
  }
  f.candidate.head = 'a'.repeat(40);
  await assert.rejects(f.launch({ actor, executor: 'droplet' }), { message: 'this session already has a suite queued or running (coordinator_suites cap 2)' });
  assert.equal((await f.launch({ actor, executor: 'local' })).id, local.id);
  assert.equal(f.suites.status().length, 3);
});
