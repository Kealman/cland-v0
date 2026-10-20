// T2: demo release state transitions on the hub clock, in-process provider and scripted machine.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { flushProjectLogs } from './harness.ts';
import { fixture } from './remote-fixture.ts';
import { readLease } from '../src/executor/droplet/lease.ts';
import { drive } from './remote-clock.ts';

test('demo stop keeps an accepted active deletion pending beyond two seconds and confirms a later 404', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000', CLAND_TEST_DROPLET_RELEASE_MS: '100' } });
  const epic = ((await drive(f, f.ui.request({ type: 'task.create', title: 'Slow deleting demo', kind: 'epic' }))).value as { item: { id: string } }).item.id;
  const started = await drive(f, f.ui.request({ type: 'demo.start', epic })); assert.equal(started.ok, true, started.error);
  const dir = join(f.root, '.cland/run/executor/leases', (started.value as { lease: string }).lease);
  f.api.faults.deletePolls = Number.MAX_SAFE_INTEGER; f.api.faults.stripTagsOnDelete = true;
  const stopped = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(stopped.ok, true, stopped.error);
  assert.equal((stopped.value as { state: string }).state, 'releasing');
  assert.equal((stopped.value as { attention?: unknown }).attention, undefined);
  const pending = await readLease(dir);
  assert.ok(pending.deleteStarted); assert.equal(pending.attention, undefined);
  await f.clock.advance(2101);
  assert.ok(f.clock.now().getTime() - Date.parse(pending.deleteStarted!) > 2100);
  assert.equal(f.api.droplets[0]!.status, 'active'); assert.deepEqual(f.api.droplets[0]!.tags, []);
  const stillPending = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(stillPending.ok, true, stillPending.error);
  assert.equal((stillPending.value as { state: string }).state, 'releasing');
  assert.equal((stillPending.value as { attention?: unknown }).attention, undefined);
  f.api.droplets.splice(0);
  const confirmed = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(confirmed.ok, true, confirmed.error);
  assert.equal((confirmed.value as { state: string }).state, 'released');
  assert.equal((confirmed.value as { attention?: unknown }).attention, undefined);
  assert.equal((await readLease(dir)).state, 'released');
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
});

test('demo stop reports accepted deletion timeouts with either tag state', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000', CLAND_TEST_DROPLET_RELEASE_MS: '100', CLAND_TEST_DROPLET_DELETE_MS: '500' } });
  for (const stripTags of [true, false]) {
    f.api.requests.length = 0; // Each table row retains the original per-lease request census.
    assert.equal((await drive(f, f.ui.request({ type: 'role.set', session: 'demo-coord', role: 'coordinator' }))).ok, true);
    const epic = ((await drive(f, f.ui.request({ type: 'task.create', title: 'Stuck deleting demo', kind: 'epic' }))).value as { item: { id: string } }).item.id;
    const topic = ((await drive(f, f.ui.request({ type: 'topic.create', item: epic, title: 'Stuck deleting demo' }))).value as { topic: { id: string } }).topic.id;
    const started = await drive(f, f.ui.request({ type: 'demo.start', epic })); assert.equal(started.ok, true, started.error);
    const dir = join(f.root, '.cland/run/executor/leases', (started.value as { lease: string }).lease);
    f.api.faults.deletePolls = Number.MAX_SAFE_INTEGER; f.api.faults.stripTagsOnDelete = stripTags;
    try {
      const pending = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(pending.ok, true, pending.error);
      assert.equal((pending.value as { state: string }).state, 'releasing');
      assert.equal((pending.value as { attention?: unknown }).attention, undefined);
      const accepted = (await readLease(dir)).deleteStarted!; assert.ok(accepted);
      await f.clock.advance(501);
      assert.ok(f.clock.now().getTime() - Date.parse(accepted) > 500);
      const expired = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(expired.ok, true, expired.error);
      assert.equal((expired.value as { state: string }).state, 'releasing');
      assert.ok((expired.value as { attention?: unknown }).attention, 'a live resource past the accepted deletion bound needs attention');
      assert.deepEqual((expired.value as { attention: { fields: string[] } }).attention.fields, stripTags ? ['tags'] : []);
      assert.equal((expired.value as { attention: { reason?: string } }).attention.reason, 'deletion-timeout');
      assert.match((expired.value as { summary: string }).summary, /deletion confirmation timed out/);
      assert.doesNotMatch((expired.value as { summary: string }).summary, /identity mismatch/);
      const persisted = await readLease(dir);
      assert.equal(persisted.deleteStarted, accepted); assert.deepEqual(persisted.attention?.fields, stripTags ? ['tags'] : []);
      const status = await drive(f, f.ui.request({ type: 'executor.status' })); assert.equal(status.ok, true, status.error);
      assert.match((status.value as { summary: string }).summary, /deletion confirmation timed out/);
      const history = await drive(f, f.ui.request({ type: 'topic.history', topic })); assert.equal(history.ok, true, history.error);
      const alerts = (history.value as { messages: { text: string }[] }).messages.filter(m => /operator attention/.test(m.text));
      assert.equal(alerts.length, 1);
      assert.match(alerts[0]!.text, /deletion confirmation timed out/); assert.doesNotMatch(alerts[0]!.text, /identity mismatch|deletion refused/);
      assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
    } finally {
      f.api.droplets.splice(0);
      await drive(f, f.ui.request({ type: 'demo.stop', epic }));
    }
  }
});

test('demo stop confirms a slow earlier deletion with empty tags and frees its slot and reservation', async t => {
  const f = await fixture(t, { machine: 'scripted', config: 'remote_budget = 1\n', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000', CLAND_TEST_DROPLET_RELEASE_MS: '5000', CLAND_TEST_DROPLET_POLL_MS: '1000' } });
  const epic = ((await drive(f, f.ui.request({ type: 'task.create', title: 'Already deleting demo', kind: 'epic' }))).value as { item: { id: string } }).item.id;
  const started = await drive(f, f.ui.request({ type: 'demo.start', epic })); assert.equal(started.ok, true, started.error);
  const lease = (started.value as { lease: string }).lease;
  const other = ((await f.ui.request({ type: 'task.create', title: 'Next demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const blocked = await f.ui.request({ type: 'demo.start', epic: other });
  assert.equal(blocked.ok, false); assert.match(blocked.error!, /remote budget full/);
  const droplet = f.api.droplets[0]!;
  const create = f.api.requests.find(r => r.method === 'POST' && r.path === '/v2/droplets');
  assert.deepEqual(create?.body?.tags, ['cland', droplet.tags.find(tag => tag.startsWith('cland-p-'))]);
  assert.match(droplet.tags[1]!, /^cland-p-[a-f0-9]{12}$/);
  // No local DELETE acknowledgement: another actor began destruction. The
  // provider keeps returning the same untagged id for longer than two seconds.
  f.api.faults.deletePolls = 16;
  f.api.faults.stripTagsOnDelete = true;
  const provider = f.api.provider;
  await provider.deleteDroplet(droplet.id);
  const tearingDown = await provider.droplet(droplet.id);
  assert.equal(tearingDown.status, 'active'); assert.deepEqual(tearingDown.tags, []);
  const before = f.clock.now().getTime();
  const stopped = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(stopped.ok, true, stopped.error);
  t.diagnostic(JSON.stringify({ create: { method: create!.method, path: create!.path, name: create!.body!.name, tags: create!.body!.tags }, teardown: { id: tearingDown.id, name: tearingDown.name, tags: tearingDown.tags, status: tearingDown.status }, release: stopped.value }));
  assert.equal((stopped.value as { state: string }).state, 'released');
  assert.equal((stopped.value as { attention?: unknown }).attention, undefined);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
  const persisted = JSON.parse(await readFile(join(f.root, '.cland/run/executor/leases', lease, 'lease.json'), 'utf8'));
  assert.equal(persisted.state, 'released'); assert.equal(persisted.attention, undefined);
  assert.ok(f.clock.now().getTime() - before > 2000);
  const status = await drive(f, f.ui.request({ type: 'executor.status' })); assert.equal(status.ok, true, status.error);
  const value = status.value as { leases: unknown[]; spend: { reserved: number; spent: number } };
  assert.deepEqual(value.leases, []);
  assert.equal(value.spend.reserved, 0); assert.ok(value.spend.spent > 0);
  f.api.faults.deletePolls = 0;
  const next = await drive(f, f.ui.request({ type: 'demo.start', epic: other })); assert.equal(next.ok, true, next.error);
  const finished = await drive(f, f.ui.request({ type: 'demo.stop', epic: other })); assert.equal(finished.ok, true, finished.error);
  assert.equal((finished.value as { state: string }).state, 'released');
  await flushProjectLogs(t, f.root);
  assert.match(await readFile(join(f.root, '.cland/log/hub.log'), 'utf8'), /executor-release-identity-recheck/);
});

test('demo stop refuses changed resource identities after accepted deletion', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000', CLAND_TEST_DROPLET_RELEASE_MS: '100' } });
  for (const field of ['id', 'name', 'tags'] as const) {
    f.api.requests.length = 0; // Each table row retains the original per-lease request census.
    const epic = ((await drive(f, f.ui.request({ type: 'task.create', title: 'Changed deleting demo', kind: 'epic' }))).value as { item: { id: string } }).item.id;
    assert.equal((await drive(f, f.ui.request({ type: 'demo.start', epic }))).ok, true);
    const droplet = f.api.droplets[0]!;
    f.api.faults.deletePolls = Number.MAX_SAFE_INTEGER; f.api.faults.stripTagsOnDelete = true;
    try {
      const pending = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(pending.ok, true, pending.error);
      assert.equal((pending.value as { attention?: unknown }).attention, undefined);
      if (field === 'id') f.api.faults.dropletResponseId = droplet.id + 1;
      else if (field === 'name') droplet.name = 'foreign-resource';
      else droplet.tags = ['cland', 'cland-p-foreign'];
      const refused = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(refused.ok, true, refused.error);
      assert.equal((refused.value as { state: string }).state, 'releasing');
      assert.deepEqual((refused.value as { attention: { fields: string[] } }).attention.fields, field === 'tags' ? ['tags'] : [field, 'tags']);
      assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
    } finally {
      f.api.droplets.splice(0); f.api.faults.dropletResponseId = 0;
      await drive(f, f.ui.request({ type: 'demo.stop', epic }));
    }
  }
});

test('demo stop clears persistent mismatch attention after provider absence', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  for (const field of ['tags', 'id'] as const) {
    f.api.requests.length = 0; // Each table row retains the original per-lease request census.
    const epic = ((await drive(f, f.ui.request({ type: 'task.create', title: 'Mismatched demo', kind: 'epic' }))).value as { item: { id: string } }).item.id;
    const started = await drive(f, f.ui.request({ type: 'demo.start', epic })); assert.equal(started.ok, true, started.error);
    const droplet = f.api.droplets[0]!;
    if (field === 'tags') droplet.tags = ['cland', 'cland-p-foreign'];
    else f.api.faults.dropletResponseId = droplet.id + 1;
    const stopped = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(stopped.ok, true, stopped.error);
    assert.equal((stopped.value as { state: string }).state, 'releasing');
    assert.deepEqual((stopped.value as { attention: { fields: string[] } }).attention.fields, [field]);
    assert.equal(f.api.droplets.length, 1);
    assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 0);
    await flushProjectLogs(t, f.root);
    assert.match(await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8'), /executor-release-unconfirmed/);
    // A different actor finishes teardown; the next release must clear old attention.
    f.api.faults.dropletResponseId = 0;
    await f.api.provider.deleteDroplet(droplet.id);
    const retried = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(retried.ok, true, retried.error);
    assert.equal((retried.value as { state: string }).state, 'released');
    assert.equal((retried.value as { attention?: unknown }).attention, undefined);
    const lease = (started.value as { lease: string }).lease;
    const persisted = await readLease(join(f.root, '.cland/run/executor/leases', lease));
    assert.equal(persisted.state, 'released'); assert.equal(persisted.attention, undefined);
  }
});


test('demo stop confirms provider absence on retry after an accepted delete', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const epic = ((await drive(f, f.ui.request({ type: 'task.create', title: 'Absent demo', kind: 'epic' }))).value as { item: { id: string } }).item.id;
  const started = await drive(f, f.ui.request({ type: 'demo.start', epic })); assert.equal(started.ok, true, started.error);
  const lease = (started.value as { lease: string }).lease;
  // The droplet is deleted, but its key is still present past this release attempt.
  f.api.beforeKeyList(async () => { f.api.droplets.splice(0); });
  f.api.faults.keyDeleteFailures.push(403);
  const first = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(first.ok, true, first.error);
  assert.equal((first.value as { state: string }).state, 'releasing');
  assert.deepEqual(f.api.droplets, []);
  const retried = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(retried.ok, true, retried.error);
  assert.equal((retried.value as { state: string }).state, 'released');
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  assert.equal(JSON.parse(await readFile(join(f.root, '.cland/run/executor/leases', lease, 'lease.json'), 'utf8')).state, 'released');
});


test('demo identity mismatch preserves the resource and exposes operator attention with an alert', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  assert.equal((await drive(f, f.ui.request({ type: 'role.set', session: 'demo-coord', role: 'coordinator' }))).ok, true);
  const epic = ((await drive(f, f.ui.request({ type: 'task.create', title: 'Foreign demo', kind: 'epic' }))).value as { item: { id: string } }).item.id;
  const topic = ((await drive(f, f.ui.request({ type: 'topic.create', item: epic, title: 'Foreign demo' }))).value as { topic: { id: string } }).topic.id;
  const started = await drive(f, f.ui.request({ type: 'demo.start', epic })); assert.equal(started.ok, true, started.error);
  const droplet = f.api.droplets[0]!;
  const originalName = droplet.name;
  const originalTags = [...droplet.tags];
  const originalStatus = droplet.status;
  try {
    droplet.name = 'foreign-resource'; droplet.tags = ['cland'];
    const stopped = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(stopped.ok, true, stopped.error);
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
    const again = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(again.ok, true, again.error);
    assert.equal((again.value as { attention: { observed: { status: string } } }).attention.observed.status, 'archive');
    // Reconciliation's orphan sweep must respect the identity refusal, too.
    const reaped = await drive(f, f.ui.request({ type: 'executor.reap' })); assert.equal(reaped.ok, true, reaped.error);
    assert.equal(f.api.droplets.length, 1);
    assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 0);
    const history = await drive(f, f.ui.request({ type: 'topic.history', topic })); assert.equal(history.ok, true, history.error);
    const messages = (history.value as { messages: { text: string; to: string[] }[] }).messages.filter(m => /operator attention/.test(m.text));
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0]!.to, ['demo-coord']);
    const status = await drive(f, f.ui.request({ type: 'demo.status', epic })); assert.equal(status.ok, true, status.error);
    assert.deepEqual((status.value as { attention: unknown }).attention, (again.value as { attention: unknown }).attention);
  } finally {
    // Restore the identity before fixture teardown so it can release its own machine.
    droplet.name = originalName; droplet.tags = originalTags; droplet.status = originalStatus;
    const recovered = await drive(f, f.ui.request({ type: 'demo.stop', epic })); assert.equal(recovered.ok, true, recovered.error);
    assert.equal((recovered.value as { state: string; attention?: unknown }).state, 'released');
    assert.equal((recovered.value as { attention?: unknown }).attention, undefined);
  }
});

test('demo release keeps virtual time frozen while provider I/O is held', { timeout: 15000 }, async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000', CLAND_TEST_DROPLET_RELEASE_MS: '500' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Held provider demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  const entered = Promise.withResolvers<void>(), resume = Promise.withResolvers<void>(), completed = Promise.withResolvers<void>();
  let held = false;
  f.api.beforeKeyList(async () => {
    if (held) return;
    held = true; entered.resolve();
    await resume.promise;
    completed.resolve();
  });
  f.api.faults.deletePolls = 3;
  const before = f.clock.now().getTime();
  const stopping = drive(f, f.ui.request({ type: 'demo.stop', epic }));
  void stopping.catch(() => {});
  try {
    await entered.promise;
    // A completed independent frame proves I/O progressed while this provider
    // call stayed held; neither its API deadline nor the release budget may age.
    const status = await f.ui.request({ type: 'demo.status', epic });
    assert.equal(status.ok, true, status.error);
    assert.equal((status.value as { state: string }).state, 'releasing');
    assert.equal(f.clock.now().getTime(), before);
    assert.equal(f.api.keys.length, 1);
  } finally {
    resume.resolve();
    await completed.promise;
    const stopped = await stopping;
    assert.equal(stopped.ok, true, stopped.error);
    assert.equal((stopped.value as { state: string }).state, 'released');
  }
  assert.deepEqual(f.api.droplets, []);
  assert.deepEqual(f.api.keys, []);
});
