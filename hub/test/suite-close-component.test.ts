// T2: close-run routing, shard failures and reservation cancellation use scripted machines on the hub clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { integrated } from './close-run-fixture.ts';
import { drive } from './remote-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import type { VerificationQueue } from '../src/protocol.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { Store } from '../src/hub/store.ts';
import { serializeTierManifest, type TierManifest } from '../src/suite-shards.ts';

test('two-shard stage result shows each shard T4 tier line', async t => {
  const f = await integrated(t, '', 2, undefined, { machine: 'scripted' });
  const paths = ['hub/test/soak-one.test.ts', 'hub/test/soak-two.test.ts'];
  const tierPath = join(f.root, 'hub/test/tiers.json');
  const tiers = JSON.parse(await readFile(tierPath, 'utf8')) as TierManifest;
  for (const path of paths) {
    await writeFile(join(f.root, path), '');
    tiers.tests[path] = 'T4';
    f.durationContext.manifest.files[path] = { seconds: 20, tests: 1 };
    f.durationContext.tiers[path] = 'T4';
  }
  await writeFile(tierPath, serializeTierManifest(tiers));
  await writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify(f.durationContext.manifest));
  f.machine.script({ outcome: 'slow' }, { outcome: 'slow' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const job = await f.launch('all', '--fresh', '--occasion', 'stage');
  await startedShards(f, job.id);
  for (const [index, path] of paths.entries()) {
    f.machine.finish(`${job.id}-shard-${index + 1}`, 0, '# tests 1\n# pass 1\n' + `suite timing ${JSON.stringify({ file: path, name: 'soak', seconds: 0.01 })}\n`);
  }
  await f.clock.advance(1000);
  const result = await drive(f, f.result(job.id));
  assert.match(result.text, /shard-1 tier T4: files 1; tests 1; observed 0.01 s/);
  assert.match(result.text, /shard-2 tier T4: files 1; tests 1; observed 0.01 s/);
});

async function startedShards(f: Awaited<ReturnType<typeof integrated>>, id: string) {
  await drive(f, Promise.all([1, 2].map(n => f.machine.started(`${id}-shard-${n}`))));
  await eventually('shard group durably running', async () => {
    const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; state: string }[] }).suites;
    return jobs.find(job => job.id === id)?.state === 'running' ? true : undefined;
  });
}

test('two-shard close reports despite a corrupt spend ledger and the executor sweep retries accounting', async t => {
  const setup = caseDeadlines(t);
  const f = await setup.wait('isolated close fixture', () => integrated(setup.fixtures, '', 2, undefined, { machine: 'scripted' }));
  f.machine.script({ outcome: 'slow' }, { outcome: 'slow' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const job = await f.launch('all', '--fresh', '--occasion', 'stage');
  await setup.wait('two durably running shards', () => startedShards(f, job.id));
  const runs = [1, 2].map(n => `${job.id}-shard-${n}`);
  const path = join(f.root, '.cland/executor-state/spend.json');
  const saved = await readFile(path, 'utf8');
  const log = async () => {
    await f.ui.request({ type: 'hub.status', history: true, flushLogs: true });
    return (await readFile(join(f.root, '.cland/log/hub.log'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  };
  const result = eventually('merged parent receipt with broken ledger', async () => {
    await f.clock.advance(1000);
    await f.verificationSettled();
    return (await f.messages(job.id))[0];
  }, 5000);
  try {
    await writeFile(path, '{"version":0,"entries":[]}');
    for (const run of runs) f.machine.finish(run, 0);
    const receipt = await result;
    assert.match(receipt.text, /exit 0/);
    assert.match(receipt.text, /tests 2; pass 2/);
    assert.equal((await f.messages(job.id)).length, 1);
    const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    assert.deepEqual(queue.remote, [], 'both scheduler reservations are free while accounting is broken');
    const leases = (await readLeases(f.root)).filter(lease => runs.includes(lease.run));
    assert.equal(leases.length, 2);
    assert.ok(leases.every(lease => lease.state === 'released'), 'provider deletion is durably confirmed');
    assert.deepEqual(f.api.droplets, []);
    const logs = await log();
    for (const run of runs) assert.ok(logs.some(entry => entry.event === 'verification-release-deferred' && entry.id === run));
    assert.ok(logs.some(entry => entry.event === 'verification-shard-release-deferred' && entry.id === job.id && entry.error.includes('invalid executor spend ledger')));
    assert.ok(logs.some(entry => entry.event === 'executor-reconcile-failed'));
    assert.equal(await readFile(path, 'utf8'), '{"version":0,"entries":[]}', 'reporting must not repair or discard the broken ledger');
  } finally {
    await writeFile(path, saved);
  }
  await f.verificationSettled();
  await f.clock.advance(1000);
  await eventually('executor sweep settles both released shard leases', async () => {
    const ledger = JSON.parse(await readFile(path, 'utf8')) as { entries: { run: string; cost: number | null }[] };
    return runs.every(run => ledger.entries.some(entry => entry.run === run && entry.cost !== null)) ? true : undefined;
  });
  const ledger = JSON.parse(await readFile(path, 'utf8')) as { entries: { run: string; cost: number | null }[] };
  for (const lease of (await readLeases(f.root)).filter(lease => runs.includes(lease.run))) {
    assert.equal(ledger.entries.find(entry => entry.run === lease.run)!.cost, lease.costUsd);
  }
  await eventually('successful accounting retry recorded', async () => (await log()).findLast(entry => entry.event === 'executor-sweep')?.failures === 0 ? true : undefined);
  assert.equal((await f.messages(job.id)).length, 1, 'accounting recovery does not duplicate the parent receipt');
});

test('pre-lease shard failures retain reservation release through executor restart', async t => {
  const setup = caseDeadlines(t);
  const f = await setup.wait('isolated close fixture', () => integrated(setup.fixtures, '', 2, undefined, { machine: 'scripted' }));
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const path = join(f.root, '.cland/executor-state/spend.json');
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  onCleanup(setup.fixtures, () => release.resolve());
  let acquiring = 0;
  f.api.beforeSizes(async () => {
    const ledger = JSON.parse(await readFile(path, 'utf8').catch(() => '{"entries":[]}')) as { entries: { lease: string }[] };
    if (ledger.entries.filter(entry => entry.lease.startsWith('reserved:')).length !== 2) return;
    if (++acquiring === 2) entered.resolve();
    await release.promise;
  });
  const job = await f.launch('all', '--fresh', '--occasion', 'stage');
  await setup.wait('both shards reach pre-lease provider lookup', () => entered.promise);
  const saved = await readFile(path, 'utf8');
  assert.deepEqual(await readLeases(f.root), []);
  const result = eventually('failed parent receipt with broken ledger', async () => {
    await f.clock.advance(1000);
    await f.verificationSettled();
    return (await f.messages(job.id))[0];
  }, 5000);
  await writeFile(path, '{"version":0,"entries":[]}');
  f.api.sizes[0]!.available = false;
  release.resolve();
  assert.match((await result).text, /exit 1/);
  assert.deepEqual(await readLeases(f.root), [], 'no real lease can own these synthetic reservations');
  assert.equal((await f.messages(job.id)).length, 1);
  assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).remote, []);
  const receiptPath = join(f.root, '.cland/run/suites', job.id, 'result.json');
  const receipt = await readFile(receiptPath, 'utf8');
  await f.stop();
  await writeFile(path, saved);
  f.api.sizes[0]!.available = true;
  const logs: Record<string, unknown>[] = [];
  const executor = new DropletExecutor(f.root, undefined, entry => logs.push(entry), f.env, undefined, f.dependencies);
  await drive(f, executor.sweep(true));
  const ledger = JSON.parse(await readFile(path, 'utf8')) as { entries: { lease: string; cost: number | null }[] };
  assert.equal(ledger.entries.length, 2);
  assert.ok(ledger.entries.every(entry => entry.lease.startsWith('reserved:') && entry.cost === 0), 'the restarted sweep clears every unacquired reservation');
  assert.ok(logs.some(entry => entry.event === 'executor-shard-reservations-released'));
  assert.ok(logs.some(entry => entry.event === 'executor-sweep' && entry.failures === 0));
  await drive(f, executor.sweep());
  assert.equal(await readFile(receiptPath, 'utf8'), receipt);
  const store = new Store(join(f.root, '.cland/hub.db'));
  try { assert.equal(store.topicMessages(f.topic, 50).filter(message => message.id === `suite:${job.id}`).length, 1); }
  finally { store.close(); }
});

test('a Coordinator integrated batch reserves two shards without stage provenance', async t => {
  const f = await integrated(t, 'daily_spend_usd=3', 2, undefined, { machine: 'scripted' });
  // A soak file must not displace ordinary files onto one shard in the batch plan.
  const soak = 'hub/test/soak.test.ts';
  await writeFile(join(f.root, soak), '');
  const tierPath = join(f.root, 'hub/test/tiers.json');
  const tiers = JSON.parse(await readFile(tierPath, 'utf8')) as TierManifest;
  tiers.tests[soak] = 'T4';
  await writeFile(tierPath, serializeTierManifest(tiers));
  f.durationContext.manifest.files[soak] = { seconds: 1000, tests: 1 };
  f.durationContext.tiers[soak] = 'T4';
  await writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify(f.durationContext.manifest));
  f.machine.script({ outcome: 'slow' }, { outcome: 'slow' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  let reservations: number[] = [];
  f.api.beforeCreate(async () => {
    if (reservations.length) return;
    const ledger = JSON.parse(await readFile(join(f.root, '.cland/executor-state/spend.json'), 'utf8')) as { entries: { reservation: number; cost: number | null }[] };
    reservations = ledger.entries.filter(e => e.cost === null).map(e => e.reservation);
  });
  const job = await f.launch('all', '--fresh');
  const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.ok(queue.remote);
  assert.equal(queue.remote.length, 2, 'the batch occupies both remote slots');
  assert.ok(queue.remote.every(run => !run.occasion));
  await startedShards(f, job.id);
  assert.deepEqual(reservations, [0.0625, 0.0625], 'both lifetimes reserved before either create');
  f.machine.finish(`${job.id}-shard-1`, 0);
  f.machine.finish(`${job.id}-shard-2`, 0);
  await f.clock.advance(1000);
  const result = await drive(f, f.result(job.id));
  assert.match(result.text, /exit 0/);
  assert.match(result.text, /tests 2; pass 2/);
  for (const shard of ['shard-1', 'shard-2']) assert.match(result.text, new RegExp(`shard duration ${shard}.*c-8.*[\\d.]+s.*cost \\$`));
  assert.match(result.text, /total cost \$/);
  for (const shard of ['shard-1', 'shard-2']) assert.match(result.text, new RegExp(`${shard} tier T1: files 1;`));
  assert.doesNotMatch(result.text, /tier T4:/);
  assert.doesNotMatch(result.text, /occasion |stage cover/);
  assert.equal((await f.messages(job.id)).length, 1);
  assert.deepEqual(f.api.droplets, []);
});

test('live and restored shards separate remote execution from collection in one failed merged result', async t => {
  const f = await integrated(t, '', 2, undefined, { machine: 'scripted' });
  f.machine.script({ outcome: 'slow' }, { outcome: 'slow' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const job = await f.launch('all', '--fresh', '--occasion', 'stage');
  await startedShards(f, job.id);
  await f.clock.advance(4000);
  await f.verificationSettled();
  const finished = f.clock.now().toISOString();
  const status = (await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; admittedAt: string }[] };
  const admittedAt = status.suites.find(run => run.id === job.id)!.admittedAt;
  f.machine.finish(`${job.id}-shard-1`, 0);
  f.machine.finish(`${job.id}-shard-2`, 1, '# tests 1\n# fail 1\nnot ok 1 - shard example\n');
  // The second shard is recovered from its durable receipt, without live status.
  await writeFile(join(f.root, '.cland/run/suites', `${job.id}-shard-2`, 'suite.log'), '# tests 1\n# fail 1\nnot ok 1 - shard example\n');
  await writeFile(join(f.root, '.cland/run/suites', `${job.id}-shard-2`, 'result.json'), JSON.stringify({ code: 1, finished }));
  await f.clock.advance(7000);
  const result = await drive(f, f.result(job.id));
  const execution = ((Date.parse(finished) - Date.parse(admittedAt)) / 1000).toFixed(2);
  for (const shard of ['shard-1', 'shard-2']) {
    const duration = result.text.split('\n').find(line => line.startsWith(`shard duration ${shard} `))!;
    assert.ok(duration.includes(` · ${execution}s · `), duration);
    assert.match(duration, /; admission through remote finish/);
    assert.match(result.text, new RegExp(`shard collection ${shard} [\\d.]+s; remote finish through collection complete`));
  }
  const collection = [...result.text.matchAll(/shard collection shard-\d+ ([\d.]+)s/g)].map(match => Number(match[1]));
  assert.equal(collection.length, 2);
  assert.ok(collection.every(seconds => seconds >= 7 && seconds < 8), result.text);
  const wall = Number(result.text.match(/suite duration ([\d.]+)s; overall wall from admission through collection/)?.[1]);
  assert.ok(wall >= (Date.parse(finished) - Date.parse(admittedAt)) / 1000 + 7, result.text);
  assert.match(result.text, /exit 1; shard-2: exit 1/);
  assert.match(result.text, /tests 2; pass 1; fail 1|tests 2; fail 1; pass 1/);
  assert.match(result.text, /not ok 1 - shard example \[shard-2\]/);
  assert.equal((await f.messages(job.id)).length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
  assert.deepEqual(f.api.droplets, []);
});

test('cancelling while provider sizes are held joins reservation before reporting and leaves zero reserved spend', async t => {
  const f = await integrated(t, 'daily_spend_usd=3', 2, undefined, { machine: 'scripted' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  onCleanup(t, () => release.resolve());
  f.api.beforeSizes(async () => { entered.resolve(); await release.promise; });
  const submission = f.launch('all', '--fresh', '--occasion', 'stage');
  await entered.promise;
  const q = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  const id = q.waiters[0]!.id;
  assert.equal((await f.ui.request({ type: 'suite.cancel', suite: id })).ok, true);
  await f.clock.advance(1000);
  assert.equal((await f.messages(id)).length, 0, 'no result while reservation completion is held');
  release.resolve();
  assert.equal((await submission).id, id);
  await f.clock.advance(1000);
  const result = await drive(f, f.result(id));
  assert.match(result.text, /cancelled/);
  const executor = (await f.ui.request({ type: 'executor.status' })).value as { taggedDroplets: number; spend: { reserved: number; spent: number } };
  assert.equal(executor.spend.reserved, 0, 'late reservation placeholders must be released before the result');
  assert.equal(executor.spend.spent, 0);
  assert.equal(executor.taggedDroplets, 0);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  assert.equal((await f.messages(id)).length, 1);
});

test('a batch sharding fallback publishes one warning frame and one whole-run result', async t => {
  const f = await integrated(t, 'daily_spend_usd=0.1', 2, undefined, { machine: 'scripted' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const job = await f.launch('all', '--fresh');
  await drive(f, f.machine.started(job.id));
  await eventually('fallback durably running', async () => {
    const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; state: string }[] }).suites;
    return jobs.find(run => run.id === job.id)?.state === 'running' ? true : undefined;
  });
  await f.clock.advance(1000);
  assert.match((await drive(f, f.result(job.id))).text, /exit 0/);
  const history = (await f.ui.request({ type: 'topic.history', topic: f.topic })).value as { messages: { text: string; severity?: string }[] };
  assert.deepEqual(history.messages.filter(m => m.text.startsWith('sharding skipped:')).map(m => [m.text, m.severity]), [['sharding skipped: daily spend cap $0.1 would be exceeded', 'warn']]);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.deepEqual(f.api.droplets, []);
});

test('task heads and non-Coordinator batches keep one remote slot', async t => {
  const f = await integrated(t, '', 2, undefined, { machine: 'scripted' });
  for (const request of [
    { role: 'implementer', branch: 'dev', mode: 'auto' },
    { role: 'coordinator', branch: 'task-candidate', mode: 'all' },
  ]) {
    f.candidate.branch = request.branch;
    assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: request.role })).ok, true);
    const job = await f.launch(request.mode, '--fresh');
    const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    assert.ok(queue.remote);
    assert.deepEqual(queue.remote.map(run => run.id), [job.id]);
    await drive(f, f.machine.started(job.id));
    await eventually('whole run durably running', async () => {
      const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; state: string }[] }).suites;
      return jobs.find(run => run.id === job.id)?.state === 'running' ? true : undefined;
    });
    await f.clock.advance(1000);
    assert.match((await drive(f, f.result(job.id))).text, /exit 0/);
  }
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
});

test('another project stage close skips sharding and runs once without a check', async t => {
  const f = await integrated(t, '', 2, undefined, { machine: 'scripted', stack: 'other', check: '', test: 'printf project-test' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const job = await f.launch('all', '--fresh', '--occasion', 'stage');
  const history = (await f.ui.request({ type: 'topic.history', topic: f.topic })).value as { messages: { text: string; severity?: string }[] };
  assert.deepEqual(history.messages.filter(m => m.text.startsWith('sharding skipped:')).map(m => [m.text, m.severity]), [['sharding skipped: project commands are not sharded', 'warn']]);
  await drive(f, f.machine.started(job.id));
  await f.verificationSettled();
  await f.clock.advance(1000);
  const result = await drive(f, f.result(job.id));
  assert.match(result.text, /all exit 0/);
  assert.match(result.text, /stage cover/);
  assert.match(await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8'), /Host gate: check not set/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.equal((await f.messages(job.id)).length, 1);
  assert.deepEqual(f.api.droplets, []);
});
