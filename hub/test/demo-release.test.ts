import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eventually, flushProjectLogs, pidAlive, projectHub } from './harness.ts';
import { fixture } from './remote-fixture.ts';
import { DigitalOceanApi } from '../src/executor/droplet/api.ts';
import { readLease, writeLease } from '../src/executor/droplet/lease.ts';
import { armWatchdog, stopWatchdog } from '../src/executor/droplet/watchdog.ts';
import { ownProcess } from './process-cleanup.ts';

test('demo stop confirms an earlier delete whose active droplet has lost its tags', async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Already deleting demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  const lease = (started.value as { lease: string }).lease;
  const droplet = f.api.droplets[0]!;
  const create = f.api.requests.find(r => r.method === 'POST' && r.path === '/v2/droplets');
  assert.deepEqual(create?.body?.tags, ['cland', droplet.tags.find(tag => tag.startsWith('cland-p-'))]);
  assert.match(droplet.tags[1]!, /^cland-p-[a-f0-9]{12}$/);
  f.api.faults.deletePolls = 4;
  f.api.faults.stripTagsOnDelete = true;
  const provider = new DigitalOceanApi(f.env);
  await provider.deleteDroplet(droplet.id);
  const tearingDown = await provider.droplet(droplet.id);
  assert.equal(tearingDown.status, 'active'); assert.deepEqual(tearingDown.tags, []);
  const stopped = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(stopped.ok, true, stopped.error);
  t.diagnostic(JSON.stringify({ create: { method: create!.method, path: create!.path, name: create!.body!.name, tags: create!.body!.tags }, teardown: { id: tearingDown.id, name: tearingDown.name, tags: tearingDown.tags, status: tearingDown.status }, release: stopped.value }));
  assert.equal((stopped.value as { state: string }).state, 'released');
  assert.equal((stopped.value as { attention?: unknown }).attention, undefined);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
  const persisted = JSON.parse(await readFile(join(f.root, '.cland/run/executor/leases', lease, 'lease.json'), 'utf8'));
  assert.equal(persisted.state, 'released'); assert.equal(persisted.attention, undefined);
  await flushProjectLogs(t, f.root);
  assert.match(await readFile(join(f.root, '.cland/log/hub.log'), 'utf8'), /executor-release-identity-recheck/);
});

for (const field of ['tags', 'id'] as const) test(`demo stop refuses a persistent ${field} mismatch and clears attention after a later 404`, async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Mismatched demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  const droplet = f.api.droplets[0]!;
  if (field === 'tags') droplet.tags = [];
  else f.api.faults.dropletResponseId = droplet.id + 1;
  const stopped = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(stopped.ok, true, stopped.error);
  assert.equal((stopped.value as { state: string }).state, 'releasing');
  assert.deepEqual((stopped.value as { attention: { fields: string[] } }).attention.fields, [field]);
  assert.equal(f.api.droplets.length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 0);
  await flushProjectLogs(t, f.root);
  assert.match(await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8'), /executor-release-unconfirmed/);
  // A different actor finishes teardown; the next release must clear old attention.
  f.api.faults.dropletResponseId = 0;
  await new DigitalOceanApi(f.env).deleteDroplet(droplet.id);
  const retried = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(retried.ok, true, retried.error);
  assert.equal((retried.value as { state: string }).state, 'released');
  assert.equal((retried.value as { attention?: unknown }).attention, undefined);
  const lease = (started.value as { lease: string }).lease;
  const persisted = await readLease(join(f.root, '.cland/run/executor/leases', lease));
  assert.equal(persisted.state, 'released'); assert.equal(persisted.attention, undefined);
});

test('the detached demo watchdog confirms an active droplet losing tags during its delete', async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000', CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '20' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Watchdog demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  const dir = join(f.root, '.cland/run/executor/leases', (started.value as { lease: string }).lease);
  const lease = await readLease(dir);
  await f.stop();
  await stopWatchdog(lease, f.env);
  await eventually('original watchdog is gone', () => !pidAlive(lease.watchdog!.pid) ? true : undefined);
  f.api.faults.deletePolls = 3; f.api.faults.stripTagsOnDelete = true;
  await writeLease(f.root, { ...lease, deadline: new Date().toISOString() });
  // An ordinary retry would wait 10s. The receipt within 8s must come from
  // the shared bounded identity recheck, without another DELETE attempt.
  const watchdog = await armWatchdog(dir, { ...process.env, ...f.env, CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '10000' });
  ownProcess(t, watchdog.pid);
  const receipt = await eventually('watchdog confirms provider absence', async () => {
    try { return JSON.parse(await readFile(join(dir, 'watchdog.json'), 'utf8')); } catch { return undefined; }
  }, 8000);
  assert.deepEqual(receipt.deleted, [lease.resource]);
  await eventually('watchdog exits after confirming absence', () => !pidAlive(watchdog.pid) ? true : undefined);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
  const recheck = JSON.parse((await readFile(join(dir, 'watchdog.log'), 'utf8')).trim());
  assert.deepEqual(recheck.attention.fields, ['tags']);
  assert.equal(recheck.attention.observed.status, 'active');
});

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
    assert.deepEqual(value.attention?.expected, { id: droplet.id, name: originalName, tags: originalTags });
    assert.deepEqual(value.attention?.observed, { id: droplet.id, name: 'foreign-resource', tags: ['cland'], status: 'active' });
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
