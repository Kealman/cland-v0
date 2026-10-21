// T1: executor overrides and cache eligibility at Suites; worker results are semantic receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';

const remoteReady = async (f: Awaited<ReturnType<typeof suiteUnit>>, id: string) => {
  await f.machine.waits.run(f.when(() => f.status(id).state === 'running' ? true : undefined));
  await f.machine.started(id);
};

for (const integrated of [false, true]) test(`a silent droplet ${integrated ? 'integrated' : 'task'} run times out with its in-flight file and releases the machine`, async t => {
  const f = await suiteUnit(t, { executor: 'droplet' }, 'stall_timeout="3s"');
  f.candidate.branch = integrated ? 'dev' : 't/T-1067';
  const file = 'hub/test/task-prefixes.test.ts';
  f.machine.script({ outcome: 'slow', log: `suite start ${file}\nsuite progress ${JSON.stringify({ event: 'start', id: 'prefixes', file, name: 'prefixes', nesting: 0, at: f.clock.now().getTime() })}\n` });
  const job = await f.launch({ integrated });
  await remoteReady(f, job.id);
  await f.tick(); await f.suites.settled();
  assert.match(await f.log(job.id), /suite start hub\/test\/task-prefixes.test.ts/);
  // The mirrored output is the receipt that starts the silence bound, not launch.
  await f.tick(4000); await f.suites.settled();
  const done = (await f.jobs()).find(run => run.id === job.id)!;
  assert.equal(done.reported, true, 'stall limit publishes a terminal receipt');
  const result = JSON.parse(await readFile(done.result, 'utf8'));
  if (integrated) assert.equal(f.status(job.id).cover?.cause, 'timeout');
  assert.equal(result.code, 124);
  assert.deepEqual(result.progress.unfinished.map((row: { file: string }) => row.file), [file]);
  assert.match(await f.log(job.id), /in flight: hub\/test\/task-prefixes.test.ts/);
  assert.deepEqual(f.api.droplets, []);
  assert.equal(done.cleaned, true);
  assert.ok(f.machine.calls.some(call => call.step === 'cancel' && call.run === job.id));
});

test('new remote bytes reset the pinned stall limit and restart retains that boundary', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' }, 'stall_timeout="3s"');
  const script = { outcome: 'slow' as const, log: 'first output\n' };
  f.machine.script(script);
  const job = await f.launch();
  await remoteReady(f, job.id);
  await f.tick(); await f.suites.settled();
  assert.match(await f.log(job.id), /first output/);
  await f.tick(2000); await f.suites.settled();
  assert.equal(f.status(job.id).reported, false);
  script.log += 'more output\n';
  await f.tick(); await f.suites.settled();
  assert.match(await f.log(job.id), /more output/);
  f.configure('[verification]\nexecutor="droplet"\nstall_timeout="60s"');
  await f.reopen();
  await f.tick(2000); await f.suites.settled();
  assert.equal(f.status(job.id).reported, false, 'new bytes reset the old silence deadline');
  await f.tick(); await f.suites.settled();
  assert.equal(f.status(job.id).reported, true, 'restart and config reload retain the admitted 3s limit');
  const done = (await f.jobs()).find(run => run.id === job.id)!;
  assert.match(done.outcome!.cause, /^stalled: no output/);
  assert.deepEqual(f.api.droplets, []);
});

test('remote silence expires between transport polls while a completed run keeps its receipt', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', env: { CLAND_TEST_DROPLET_RUN_POLL_MS: '10000' } }, 'stall_timeout="3s"');
  f.machine.script({ outcome: 'slow', log: 'output\n' });
  const silent = await f.launch();
  await remoteReady(f, silent.id);
  await f.tick(); await f.suites.settled();
  assert.match(await f.log(silent.id), /output/);
  await f.tick(3000); await f.suites.settled();
  assert.equal(f.status(silent.id).reported, true, 'short stall limit does not wait another full 10s poll');
  assert.equal((await f.jobs()).find(run => run.id === silent.id)!.outcome!.code, 124);
  f.machine.script({ outcome: 'slow', log: '' });
  const completed = await f.launch({ fresh: true });
  await remoteReady(f, completed.id);
  await f.tick(); await f.suites.settled();
  f.machine.finish(completed.id, 0, '');
  await f.tick(3000); await f.suites.settled();
  assert.equal(f.status(completed.id).reported, true);
  assert.equal((await f.jobs()).find(run => run.id === completed.id)!.outcome!.code, 0, 'done receipt wins at the silence boundary');
  assert.deepEqual(f.api.droplets, []);
});

test('failed log polls still expire remote silence and retain a valid done receipt', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' }, 'stall_timeout="3s"');
  const file = 'hub/test/silent.test.ts';
  const log = `suite progress ${JSON.stringify({ event: 'start', id: 'silent', file, name: 'silent', nesting: 0, at: f.clock.now().getTime() })}\n`;
  f.machine.script({ outcome: 'slow', log });
  const job = await f.launch(); await remoteReady(f, job.id);
  await f.tick(); await f.suites.settled();
  assert.ok((await f.log(job.id)).includes(log), 'in-flight receipt was durably mirrored');
  const logPoll = t.mock.method(DropletExecutor.prototype, 'log', async () => { throw new Error('log transport unavailable'); });
  await f.tick(4000); await f.suites.settled();
  assert.equal(f.status(job.id).reported, true, 'log read failures cannot bypass the stall deadline');
  const done = (await f.jobs()).find(run => run.id === job.id)!;
  assert.equal(done.outcome!.code, 124);
  assert.match(await f.log(job.id), /in flight: hub\/test\/silent.test.ts/);
  assert.ok(f.machine.calls.some(call => call.step === 'cancel' && call.run === job.id));
  assert.deepEqual(f.api.droplets, []);

  f.machine.script({ outcome: 'slow', log: '' });
  const completed = await f.launch({ fresh: true }); await remoteReady(f, completed.id);
  f.machine.finish(completed.id, 0, '');
  await f.tick(4000); await f.suites.settled();
  assert.equal((await f.jobs()).find(run => run.id === completed.id)!.outcome!.code, 0);
  assert.ok(!f.machine.calls.some(call => call.step === 'cancel' && call.run === completed.id));
  logPoll.mock.restore();
  await f.tick(); await f.suites.settled();
  assert.equal(f.status(completed.id).reported, true);
  assert.deepEqual(f.api.droplets, []);
});

test('a failed output checkpoint cannot leave mirrored bytes with a stale restart deadline', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' }, 'stall_timeout="3s"');
  const script = { outcome: 'slow' as const, log: 'first output\n' };
  f.machine.script(script);
  const job = await f.launch(); await remoteReady(f, job.id);
  await f.tick(); await f.suites.settled();
  assert.match(await f.log(job.id), /first output/);
  await f.tick(); await f.suites.settled();
  const save = f.store.setMeta.bind(f.store);
  t.mock.method(f.store, 'setMeta', (key: string, value: string) => {
    if (key === 'suite-jobs') throw new Error('checkpoint storage unavailable');
    save(key, value);
  });
  script.log += 'second output\n';
  await f.tick(); await f.suites.settled();
  await f.reopen();
  await f.tick(); await f.suites.settled();
  assert.equal(f.status(job.id).reported, false, 'restart must not expire bytes newer than its saved boundary');
  assert.match(await f.log(job.id), /second output/);
  await f.tick(3000); await f.suites.settled();
  assert.equal(f.status(job.id).reported, true);
  assert.equal((await f.jobs()).find(run => run.id === job.id)!.outcome!.code, 124);
});

test('replaying output after a checkpoint-before-append restart keeps its original silence boundary', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' }, 'stall_timeout="3s"');
  const script = { outcome: 'slow' as const, log: 'first output\n' };
  f.machine.script(script);
  const job = await f.launch(); await remoteReady(f, job.id);
  await f.tick(); await f.suites.settled();
  const before = await f.log(job.id);
  assert.match(before, /first output/);
  script.log += 'second output\n';
  await f.tick(); await f.suites.settled();
  assert.match(await f.log(job.id), /second output/);
  const saved = (await f.jobs()).find(run => run.id === job.id)!;
  // Seed the durable crash boundary: checkpoint committed, append not committed.
  await f.suites.close();
  await writeFile(saved.log, before);
  await f.reopen();
  await f.tick(); await f.suites.settled();
  assert.match(await f.log(job.id), /second output/, 'missing mirror bytes were replayed');
  await f.tick(2000); await f.suites.settled();
  assert.equal(f.status(job.id).reported, true, 'replayed bytes cannot renew an already observed output boundary');
  assert.equal((await f.jobs()).find(run => run.id === job.id)!.outcome!.code, 124);
});

test('explicit droplet reuses only droplet greens while omitted executor keeps cross-executor reuse', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', machineReceiptsOnly: true });
  const local = await f.launch({ executor: 'local' }); await f.finish(local.id);
  assert.equal(f.status(local.id).executor, 'local');
  const defaultHit = await f.launch(); assert.equal(defaultHit.cached?.run, local.id); await f.result(defaultHit.id);
  assert.equal(f.status(defaultHit.id).executor, 'local');
  const remote = await f.launch({ executor: 'droplet' }); assert.equal(remote.cached, undefined);
  await remoteReady(f, remote.id); await f.finish(remote.id);
  assert.equal(f.status(remote.id).executor, 'droplet');
  assert.match(await f.log(remote.id), /Cache bypassed: explicit --executor droplet requires a droplet green; cached green ran locally/);
  const remoteHit = await f.launch({ executor: 'droplet' }); assert.equal(remoteHit.cached?.run, remote.id); await f.result(remoteHit.id);
  assert.equal(f.status(remoteHit.id).executor, 'droplet');
  const newerLocal = await f.launch({ executor: 'local', fresh: true }); await f.finish(newerLocal.id);
  const olderRemoteHit = await f.launch({ executor: 'droplet' }); assert.equal(olderRemoteHit.cached?.run, remote.id); await f.result(olderRemoteHit.id);
  assert.equal(f.status(olderRemoteHit.id).executor, 'droplet');
  const newerDefaultHit = await f.launch(); assert.equal(newerDefaultHit.cached?.run, newerLocal.id); await f.result(newerDefaultHit.id);
  assert.equal(f.status(newerDefaultHit.id).executor, 'local');
  assert.equal(f.acquisitions.length, 1);
});

test('executor overrides bypass host locks and dirty explicit remote candidates refuse', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true });
  f.hold(true, { since: f.clock.now().toISOString(), holder: { pid: 123, started: null, token: 'hand', since: f.clock.now().toISOString() } });
  const remote = await f.launch({ executor: 'droplet' }); await remoteReady(f, remote.id); await f.finish(remote.id);
  assert.equal(f.status(remote.id).executor, 'droplet');
  f.candidate.tree = null;
  await assert.rejects(f.launch({ executor: 'droplet' }), /dirty worktree cannot be bundled for droplet/);
  const queue = await f.suites.queue(); assert.deepEqual(queue.waiters, []);
  assert.equal(queue.holder?.kind, 'hand run'); assert.equal(queue.holder.id, null);
  assert.equal(f.delivered.size, 0, 'no local worker was admitted');
});

test('a local override executes locally despite a droplet default', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', machineReceiptsOnly: true });
  const job = await f.launch({ executor: 'local', fresh: true }); await f.finish(job.id);
  assert.ok(f.delivered.has(job.id)); assert.equal(f.status(job.id).executor, 'local');
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});
