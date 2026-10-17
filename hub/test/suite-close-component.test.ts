// T2: shard failure aggregation and cancellation during reservation use scripted machines on the hub clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { integrated } from './close-run-fixture.ts';
import { drive } from './remote-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import type { VerificationQueue } from '../src/protocol.ts';

async function startedShards(f: Awaited<ReturnType<typeof integrated>>, id: string) {
  await drive(f, Promise.all([1, 2].map(n => f.machine.started(`${id}-shard-${n}`))));
  await eventually('shard group durably running', async () => {
    const jobs = ((await f.ui.request({ type: 'hub.status' })).value as { suites: { id: string; state: string }[] }).suites;
    return jobs.find(job => job.id === id)?.state === 'running' ? true : undefined;
  });
}

test('a failed shard fails one merged result with its label and no automatic rerun', async t => {
  const f = await integrated(t, '', 2, undefined, { machine: 'scripted' });
  f.machine.script({ outcome: 'slow' }, { outcome: 'slow' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const job = await f.launch('all', '--fresh', '--occasion', 'stage');
  await startedShards(f, job.id);
  f.machine.finish(`${job.id}-shard-1`, 0);
  f.machine.finish(`${job.id}-shard-2`, 1, '# tests 1\n# fail 1\nnot ok 1 - shard example\n');
  await f.clock.advance(1000);
  const result = await drive(f, f.result(job.id));
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

test('a sharding fallback publishes one warning frame and one whole-run result', async t => {
  const f = await integrated(t, 'daily_spend_usd=0.1', 2, undefined, { machine: 'scripted' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const job = await f.launch('all', '--fresh', '--occasion', 'stage');
  await drive(f, f.machine.started(job.id));
  await eventually('fallback durably running', async () => {
    const jobs = ((await f.ui.request({ type: 'hub.status' })).value as { suites: { id: string; state: string }[] }).suites;
    return jobs.find(run => run.id === job.id)?.state === 'running' ? true : undefined;
  });
  await f.clock.advance(1000);
  assert.match((await drive(f, f.result(job.id))).text, /exit 0/);
  const history = (await f.ui.request({ type: 'topic.history', topic: f.topic })).value as { messages: { text: string; severity?: string }[] };
  assert.deepEqual(history.messages.filter(m => m.text.startsWith('sharding skipped:')).map(m => [m.text, m.severity]), [['sharding skipped: daily spend cap $0.1 would be exceeded', 'warn']]);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.deepEqual(f.api.droplets, []);
});
