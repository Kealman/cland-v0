// T1: Coordinator admission uses stored identity and semantic executor receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';

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
