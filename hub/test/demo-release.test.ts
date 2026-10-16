import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub } from './harness.ts';
import { fixture } from './remote-fixture.ts';

test('demo stop confirms provider absence on retry after an accepted delete', async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Absent demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  const lease = (started.value as { lease: string }).lease;
  // The droplet is deleted, but its key is still present past this release attempt.
  f.api.beforeKeyList(async () => { f.api.droplets.splice(0); });
  f.api.faults.keyDeleteFailures.push(403);
  const first = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(first.ok, true, first.error);
  assert.equal((first.value as { state: string }).state, 'releasing');
  assert.deepEqual(f.api.droplets, []);
  const retried = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(retried.ok, true, retried.error);
  assert.equal((retried.value as { state: string }).state, 'released');
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  assert.equal(JSON.parse(await readFile(join(f.root, '.cland/run/executor/leases', lease, 'lease.json'), 'utf8')).state, 'released');
});

test('demo stop waits for an archived droplet with stripped tags to become absent', async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Deleting demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  f.api.faults.deletePolls = 2;
  f.api.faults.archiveOnDelete = true;
  const stopped = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(stopped.ok, true, stopped.error);
  assert.equal((stopped.value as { state: string }).state, 'released');
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
});

test('demo identity mismatch preserves the resource and exposes operator attention with an alert', async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'demo-coord', role: 'coordinator' })).ok, true);
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Foreign demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const topic = ((await f.ui.request({ type: 'topic.create', item: epic, title: 'Foreign demo' })).value as { topic: { id: string } }).topic.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  const droplet = f.api.droplets[0]!;
  const originalName = droplet.name;
  const originalTags = [...droplet.tags];
  const originalStatus = droplet.status;
  try {
    droplet.name = 'foreign-resource'; droplet.tags = ['cland'];
    const stopped = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(stopped.ok, true, stopped.error);
    const value = stopped.value as { state: string; attention?: { fields: string[]; expected: { name: string; tags: string[] }; observed: { name: string; tags: string[]; status: string } }; summary: string };
    assert.equal(value.state, 'releasing');
    assert.deepEqual(value.attention?.fields, ['name', 'tags']);
    assert.deepEqual(value.attention?.expected, { name: originalName, tags: originalTags });
    assert.deepEqual(value.attention?.observed, { name: 'foreign-resource', tags: ['cland'], status: 'active' });
    assert.match(value.summary, /operator attention/);
    assert.equal(f.api.droplets.length, 1);
    assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 0);
    // An archive status alone never authorizes deletion of a mismatched resource.
    droplet.status = 'archive'; droplet.tags = originalTags;
    const again = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(again.ok, true, again.error);
    assert.equal((again.value as { attention: { observed: { status: string } } }).attention.observed.status, 'archive');
    // Reconciliation's orphan sweep must respect the identity refusal, too.
    const reaped = await f.ui.request({ type: 'executor.reap' }); assert.equal(reaped.ok, true, reaped.error);
    assert.equal(f.api.droplets.length, 1);
    assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 0);
    const history = await f.ui.request({ type: 'topic.history', topic }); assert.equal(history.ok, true, history.error);
    const messages = (history.value as { messages: { text: string; to: string[] }[] }).messages.filter(m => /operator attention/.test(m.text));
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0]!.to, ['demo-coord']);
    const status = await f.ui.request({ type: 'demo.status', epic }); assert.equal(status.ok, true, status.error);
    assert.deepEqual((status.value as { attention: unknown }).attention, (again.value as { attention: unknown }).attention);
  } finally {
    // Restore the identity before fixture teardown so it can release its own machine.
    droplet.name = originalName; droplet.tags = originalTags; droplet.status = originalStatus;
    const recovered = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(recovered.ok, true, recovered.error);
    assert.equal((recovered.value as { state: string; attention?: unknown }).state, 'released');
    assert.equal((recovered.value as { attention?: unknown }).attention, undefined);
  }
});
