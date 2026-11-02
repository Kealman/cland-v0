// T2: native recovery completion wakes collection after a bounded fake-provider release attempt.
import assert from 'node:assert/strict';
import test from 'node:test';
import { integrated } from './close-run-fixture.ts';
import { drive } from './remote-clock.ts';
import { eventually } from './harness.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { onCleanup } from './process-cleanup.ts';

test('executor recovery publishes a completed shard group without another scheduler tick', async t => {
  const resume = Promise.withResolvers<void>();
  onCleanup(t, () => resume.resolve());
  const f = await integrated(t, '', 2, undefined, { machine: 'scripted' });
  f.machine.script({ outcome: 'slow' }, { outcome: 'slow' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const job = await drive(f, f.launch('all', '--fresh', '--occasion', 'stage'));
  await drive(f, Promise.all([1, 2].map(n => f.machine.started(`${job.id}-shard-${n}`))));
  await eventually('durably running shard group', async () => {
    const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; state: string }[] }).suites;
    return jobs.some(row => row.id === job.id && row.state === 'running') ? true : undefined;
  });
  let entered = false;
  f.api.beforeDropletRead(async id => {
    if (entered || !f.api.requests.some(row => row.method === 'DELETE' && row.path === `/v2/droplets/${id}`)) return;
    const leases = await readLeases(f.root);
    if (!leases.some(lease => lease.deletions?.droplets.some(row => row.id === id && row.started))) return;
    entered = true; await resume.promise;
  });
  f.machine.finish(`${job.id}-shard-1`, 0);
  f.machine.finish(`${job.id}-shard-2`, 1, '# tests 1\n# fail 1\nnot ok 1 - shard example\n');
  await f.clock.advance(1000);
  try {
    await eventually('accepted DELETE confirmation GET held', () => entered ? true : undefined, 2000);
    // The checkpoint/read outlives the fixture's 500 ms release budget.
    await f.clock.advance(600);
  } finally { resume.resolve(); }
  const receipt = await drive(f, eventually('parent receipt after recovery completion', async () => (await f.messages(job.id))[0], 3000));
  assert.match(receipt.text, /exit 1; shard-2: exit 1/);
  assert.equal((await f.messages(job.id)).length, 1);
  assert.deepEqual(f.api.droplets, []);
  assert.deepEqual(f.api.keys, []);
});
