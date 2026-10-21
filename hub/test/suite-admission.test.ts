// T2: admission and item cards use real frames with injected candidate facts and worker receipts.
import { packageShards, serializeTierManifest } from '../src/suite-shards.ts';
import { lintHubShards } from '../src/suite-shards.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, eventually, tempProject } from './harness.ts';
import { fixture } from './suite-component-fixture.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { durationFixture, durationOwner } from './duration-fixture.ts';

test('item verification cards survive completion, cache reuse and store reopen', async t => {
  const f = await fixture(t);
  const head = f.facts.head;
  const made = await f.ui.request({ size: 'M', type: 'task.create', title: 'Branch card', branch: 'candidate' });
  const item = (made.value as { item: ItemView }).item;
  await f.ui.request({ type: 'subscribe' });
  await f.spoke.call('subscribe', { subject: { item: item.id }, events: ['task'], digest: 'now' });
  const from = f.ui.frames.length;
  const job = await f.launch();
  const report = await eventually('first result', async () => (await f.results())[0]);
  const card = await eventually('branch verify has the log artifact', async () => {
    const list = await f.ui.request({ type: 'task.list' });
    const card = (list.value as { items: ItemSummary[] }).items.find(i => i.id === item.id);
    return card?.verify?.id === job.id && card.verify.artifact ? card : undefined;
  });
  assert.deepEqual(card.verify, { executor: 'local', id: job.id, state: 'finished', result: 'passed', head, finished: card.verify!.finished, artifact: report.artifacts[0]!.id });
  assert.equal(card.verify!.executor, 'local');
  assert.ok(card.verify!.finished);
  const frames = f.ui.frames.slice(from).filter(frame => frame.type === 'task' && (frame.item as ItemSummary)?.id === item.id);
  assert.equal(frames.filter(frame => (frame.item as ItemSummary).verify?.result === 'passed').length, 1, 'one terminal card, including the artifact');
  for (const frame of frames) assert.equal((frame as { events?: unknown }).events, undefined);
  assert.equal(f.spoke.events.filter(n => n.params.content.includes(item.id)).length, 0, 'no item event delivery');
  const detail = await f.ui.request({ type: 'task.view', item: item.id });
  assert.deepEqual((detail.value as { item: ItemView }).item.verify, card.verify);
  assert.equal(JSON.parse((await cland(f.root, 'task', 'view', item.id, '--json')).stdout).item.verify.executor, 'local');
  const cached = await f.launch();
  assert.equal(cached.cached?.run, job.id);
  await eventually('cached card', async () => {
    const list = await f.ui.request({ type: 'task.list' });
    const card = (list.value as { items: ItemSummary[] }).items.find(i => i.id === item.id);
    return card?.verify?.id === cached.id && card.verify.artifact ? card : undefined;
  });
  assert.match((await cland(f.root, 'task', 'view', item.id)).stdout, /verify +.*passed.*cached/);
  await f.reopen();
  const after = JSON.parse((await cland(f.root, 'task', 'list', '--json')).stdout).items.find((i: { id: string }) => i.id === item.id);
  assert.equal(after.verify.id, cached.id);
  assert.deepEqual(after.verify.cached, cached.cached);
});

for (const result of ['failed', 'cancelled'] as const) test(`item cards expose ${result} receipts after queued null fields`, async t => {
  const f = await fixture(t, 1);
  const read = async () => {
    await f.settle();
    return ((await f.ui.request({ type: 'task.list' })).value as { items: ItemSummary[] }).items[0]!;
  };
  assert.equal((await read()).verify, null);
  if (result === 'cancelled') await mkdir(join(f.root, 'suite.lock'));
  const job = await f.launch();
  if (result === 'cancelled') {
    const queued = (await read()).verify!;
    assert.equal(queued.id, job.id);
    assert.equal(queued.state, 'queued');
    assert.equal(queued.result, null);
    assert.equal(queued.finished, null);
    assert.equal(queued.artifact, null);
    assert.equal((await f.ui.request({ type: 'suite.cancel', suite: job.id })).ok, true);
  }
  const card = await eventually(`${result} card with artifact`, async () => {
    const card = await read();
    return card.verify?.result === result && card.verify.artifact ? card : undefined;
  });
  assert.equal(card.verify!.state, 'finished');
  assert.ok(card.verify!.finished);
  assert.equal(card.verify!.id, job.id);
});

test('admission refuses unclassified sources without consuming queue slots', async t => {
  const f = await fixture(t, 0, '', true);
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await mkdir(join(f.root, 'hub/src'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/new.test.ts'), 'setTimeout(() => {}, 1);\n');
  await writeFile(join(f.root, 'hub/src/new.test.ts'), '// another test\n');
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {} }));
  // A hand holder makes an incorrectly admitted request remain observable in the queue.
  await mkdir(join(f.root, 'suite.lock'));
  const before = await f.ui.request({ type: 'hub.status', history: true });
  const failed = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(failed.ok, false, JSON.stringify(failed));
  assert.equal((failed as { code?: string }).code, 'verify-tiers');
  assert.deepEqual((failed as { files?: string[] }).files, ['hub/src/new.test.ts', 'hub/test/new.test.ts']);
  assert.ok(failed.error!.includes('"hub/src/new.test.ts": "T3",'));
  assert.ok(failed.error!.includes('"hub/test/new.test.ts": "T3",'));
  const status = await f.ui.request({ type: 'hub.status', history: true });
  assert.deepEqual((status.value as HubStatus).suites, (before.value as HubStatus).suites, 'refusal creates no durable suite');
  const queue = await f.ui.request({ type: 'suite.queue' });
  assert.deepEqual((queue.value as VerificationQueue).waiters, []);
  const cli = await clandWithEnv(f.root, f.env, 'verify', 'auto', '--report', f.topic, '--to', 'rev', '--json');
  assert.notEqual(cli.code, 0);
  assert.match(cli.stderr, /verify-tiers.*unclassified tests/s);
  assert.equal((await f.results()).length, 0, 'refusal publishes no suite result');
  // Admission table: reuse the same request fixture for the refusal family.
  const manifest = join(f.root, 'hub/test/tiers.json');
  for (const [tests, message, files] of [
    [{ 'hub/src/new.test.ts': 'T3', 'hub/test/new.test.ts': 'T3', 'hub/test/zz.test.ts': 'T3' }, /missing test/, ['hub/test/zz.test.ts']],
    [{ 'hub/src/new.test.ts': 'T0', 'hub/test/new.test.ts': 'T3' }, /invalid tier/, ['hub/src/new.test.ts']],
    [{ 'hub/src/new.test.ts': { tier: 'T3', scenario: '' }, 'hub/test/new.test.ts': 'T3' }, /invalid tier/, ['hub/src/new.test.ts']],
    [{ 'hub/test/new.test.ts': 'T3', 'hub/src/new.test.ts': 'T3' }, /not sorted by path/, ['hub/src/new.test.ts']],
  ] as const) {
    // Deliberately bypass the sorted writer to plant malformed input.
    await writeFile(manifest, JSON.stringify({ version: 1, tests }));
    const refusal = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
    assert.equal(refusal.ok, false);
    assert.equal((refusal as { code?: string }).code, 'verify-tiers');
    assert.match(refusal.error!, message);
    assert.deepEqual((refusal as { files?: string[] }).files, [...files]);
    assert.deepEqual(((await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus).suites, (before.value as HubStatus).suites);
    assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, []);
  }
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {
    'hub/src/new.test.ts': 'T1', 'hub/test/new.test.ts': 'T1',
  } }));
  const resource = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(resource.ok, false);
  assert.match(resource.error!, /T1 test touches machine resources/);
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {
    'hub/src/new.test.ts': 'T3', 'hub/test/new.test.ts': 'T3',
  } }));
  const lifecycle = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(lifecycle.ok, false);
  assert.equal((lifecycle as { code?: string }).code, 'verify-test-lint');
  assert.match(lifecycle.error!, /hub\/src\/new.test.ts:1 \[t3-lifecycle\]/);
  const dry = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'], dryRun: true });
  assert.equal(dry.ok, false);
  assert.equal(dry.error, lifecycle.error, 'dry run returns identical policy refusal lines');
  assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, []);
  await writeFile(join(f.root, 'hub/src/new.test.ts'), '// T3: native process startup\n');
  await writeFile(join(f.root, 'hub/test/new.test.ts'), '// T3: native timeout expiry\nsetTimeout(() => {}, 1); // lint-allow-wall-clock: observes native timer expiry\n');
  const job = await f.launch();
  assert.equal(job.pid, null);
  assert.equal(job.position, 1, 'refused requests consume no queue position');
  await rm(join(f.root, 'suite.lock'), { recursive: true });
  const result = await eventually('classified suite passed', async () => (await f.results())[0]);
  assert.match(result.text, /auto exit 0/);
  // Transition C4: an immutable pre-migration head, including an unsorted legacy map.
  // Neovim was not classified in that format and must remain admissible.
  await rm(manifest);
  await mkdir(join(f.root, 'nvim/test'), { recursive: true });
  await writeFile(join(f.root, 'nvim/test/legacy.test.ts'), '');
  await writeFile(join(f.root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: {
    'hub/test/new.test.ts': 'machine', 'hub/src/new.test.ts': 'free',
  } }));
  assert.deepEqual(await packageShards(f.root, 'full', undefined, undefined, { workers: 3, legacyKeys: new Set() }), [
    { name: 'hub free', resource: 'free', workers: 1, targets: ['hub/src/new.test.ts'] },
    { name: 'hub machine', resource: 'machine', workers: 3, targets: ['hub/test/new.test.ts'] },
    { name: 'Neovim', resource: 'machine', workers: 3, targets: ['nvim/test/**/*.test.ts'] },
  ]);
  const legacy = await f.launch();
  const legacyResult = await eventually('legacy-only candidate result', async () => (await f.results()).find(message => message.id === `suite:${legacy.id}`));
  assert.match(legacyResult.text, /exit 0/);
  // Duration admission uses the candidate's history after dev retires a legacy key.
  const durations = join(f.root, 'hub/test/durations.json');
  const baseline = durationFixture('hub/src/new.test.ts');
  await writeFile(join(f.root, 'hub/src/new.test.ts'), "// T3: native process startup\ntest('old', () => {}); test('expiring', () => {});\n");
  await writeFile(join(f.root, '.cland/tasks/E-677-fixture.md'), durationOwner);
  await writeFile(durations, JSON.stringify(baseline.manifest));
  // The candidate's merge-base manifest owns allowance provenance, even after
  // dev retires a key. Inject that historical receipt instead of running Git.
  f.facts.head = 'c'.repeat(40); f.facts.tree = 'd'.repeat(40);
  f.legacyKeys.add(baseline.legacyKey);
  f.durationContext.base!.manifest = baseline.manifest;
  await mkdir(join(f.root, 'suite.lock'));
  const admitted = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(admitted.ok, true, JSON.stringify(admitted));
  const queued = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(queued.waiters.length, 1, 'untouched legacy allowance admits the branch');
  assert.equal((await f.ui.request({ type: 'suite.cancel', suite: queued.waiters[0]!.id })).ok, true);
  for (const key of ['hub/test/new.test.ts::new', baseline.expiringKey]) {
    const invalid = structuredClone(baseline.manifest);
    invalid.allow[key] = baseline.legacy;
    await writeFile(durations, JSON.stringify(invalid));
    f.facts.head = (key === baseline.expiringKey ? 'e' : 'f').repeat(40);
    f.facts.tree = f.facts.head;
    const refusal = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
    assert.equal(refusal.ok, false, JSON.stringify(refusal));
    assert.equal((refusal as { code?: string }).code, 'verify-tiers');
    assert.ok(refusal.error!.includes(`new duration allowance cannot be legacy: ${key}`));
    assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, [], 'refused legacy entries reserve no slot');
  }
});

for (const capture of ['before change', 'after change'] as const) test(`candidate capture ${capture} refuses head races before queue admission`, async t => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'suite.lock'));
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const barrier = async () => { entered.resolve(); await release.promise; };
  if (capture === 'before change') f.beforeInspect(barrier);
  else f.beforeCapture(barrier);
  const pending = f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  await entered.promise;
  f.facts.head = 'c'.repeat(40);
  // A capture after the change observes the unclassified immutable source;
  // a capture before it reaches the final HEAD fence. Both reserve no slot.
  if (capture === 'after change') {
    const snapshot = await tempProject(t, 'cland-captured-source-');
    await mkdir(join(snapshot, 'hub/test'), { recursive: true });
    await writeFile(join(snapshot, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {} }));
    await writeFile(join(snapshot, 'hub/test/advanced.test.ts'), '// unclassified submitted source\n');
    f.immutable(async head => {
      assert.equal(head, f.facts.head, 'immutable inspection uses the advanced captured head');
      await lintHubShards(snapshot, { legacyKeys: new Set() });
    });
  }
  release.resolve();
  const failed = await pending;
  assert.equal(failed.ok, false, JSON.stringify(failed));
  assert.match(failed.error!, capture === 'before change' ? /head changed during submission/ : /verify-tiers.*advanced\.test\.ts/s);
  const status = await f.ui.request({ type: 'hub.status', history: true });
  assert.deepEqual((status.value as HubStatus).suites, [], 'head change cannot reserve a suite');
  const queue = await f.ui.request({ type: 'suite.queue' });
  assert.deepEqual((queue.value as VerificationQueue).waiters, []);
});
