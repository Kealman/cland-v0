import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageShards } from '../src/suite-shards.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { fixture } from './remote-fixture.ts';
import { clandWithEnv, connectUi, eventually, projectHub } from './harness.ts';
import { DropletRun } from '../src/executor/droplet/run.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import type { SuiteSelection } from '../src/suite-selection.ts';
import type { HubStatus } from '../src/protocol.ts';

// Acceptance seam: a candidate config becomes a package plan, including close shards.
test('candidate worker config controls hub and Neovim machine shards while free stays serial', async t => {
  const root = await mkdtemp(join(tmpdir(), 'verification-workers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await mkdir(join(root, '.cland'));
  for (const file of ['free', 'machine']) await writeFile(join(root, `hub/test/${file}.test.ts`), '');
  await writeFile(join(root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: { 'hub/test/free.test.ts': 'free', 'hub/test/machine.test.ts': 'machine' } }));
  const counts = async (executor: 'local' | 'droplet', workers?: number) => (await packageShards(root, 'full', undefined, undefined, { executor, ...(workers === undefined ? {} : { workers }) })).map(shard => shard.workers);
  assert.deepEqual(await counts('local'), [1, 4, 4]);
  assert.deepEqual(await counts('droplet'), [1, 4, 4]);
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nexecutor="droplet"\nworkers=5\n');
  assert.deepEqual(await counts('local'), [1, 5, 5], 'configured default executor does not turn a hand run into a droplet');
  assert.deepEqual(await counts('droplet'), [1, 5, 5], 'absent droplet override inherits workers');
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nworkers=5\n[verification.droplet]\nworkers=8\n');
  assert.deepEqual(await counts('local'), [1, 5, 5]);
  assert.deepEqual(await counts('droplet'), [1, 8, 8]);
  assert.deepEqual(await counts('droplet', 6), [1, 6, 6]);
  assert.deepEqual((await packageShards(root, 'full', { files: ['hub/test/free.test.ts', 'hub/test/machine.test.ts'], nvim: true }, undefined, { executor: 'droplet' })).map(shard => shard.workers), [1, 8, 8]);
  assert.equal((await packageShards(root, 'hub-only', undefined, undefined, { executor: 'droplet' })).at(-1)!.workers, 8, 'smoke uses the same workers');
  const selected: SuiteSelection = { mode: 'hub-selected', files: [], reason: 'fixture coverage', tests: ['hub/test/free.test.ts', 'hub/test/machine.test.ts'], nvimFull: false };
  assert.deepEqual((await packageShards(root, 'hub-selected', undefined, selected, { executor: 'droplet' })).map(shard => shard.workers), [1, 8, 8], 'coverage-selected phases retain the droplet policy');
  assert.deepEqual((await packageShards(root, 'hub-selected', undefined, { ...selected, nvimFull: true }, { executor: 'droplet', workers: 6 })).map(shard => shard.workers), [1, 6, 6], 'run override also controls selected hub and full Neovim');
});

test('worker settings validate positive integers and survive managed config rendering', () => {
  assert.equal(defaultConfig('fixture').verification.workers, 4);
  for (const source of ['', '[verification]\nworkers=5', '[verification]\nworkers=5\n[verification.droplet]\nworkers=8']) {
    const config = parseConfig(source, 'fixture');
    assert.deepEqual(parseConfig(renderConfig(config), 'fixture'), config);
  }
  for (const table of ['verification', 'verification.droplet']) for (const value of ['0', '-1', '1.5', '"6"', 'true']) {
    assert.throws(() => parseConfig(`[${table}]\nworkers=${value}`, 'fixture'), /workers must be a positive integer/);
  }
  assert.throws(() => parseConfig('[verification]\nworkers=9007199254740992', 'fixture'), /cannot be represented losslessly/);
});

const script = `node -e "console.log('WORKERS='+process.env.CLAND_SUITE_WORKERS);console.log('EXECUTOR='+process.env.CLAND_SUITE_EXECUTOR);console.log('# tests 1');console.log('# pass 1')"`;
test('verify persists overrides, delivers remote workers, prices requested size and separates cached measurements', async t => {
  const f = await fixture(t, { hub: projectHub, test: script, config: 'workers=5\nlifetime="15m"\nrun_timeout="5m"\n[verification.droplet]\nworkers=8\n' });
  f.api.sizes.push({ slug: 'c-16', available: true, price_hourly: 0.50, disk: 100, regions: ['lon1'] });
  f.api.regions.find(region => region.slug === 'lon1')!.sizes.push('c-16');
  const defaultRun = await f.launch();
  assert.match((await f.result(defaultRun.id)).text, /workers 8/);
  const log = (id: string) => readFile(join(f.root, '.cland/run/suites', id, 'suite.log'), 'utf8');
  assert.match(await log(defaultRun.id), /WORKERS=8\nEXECUTOR=droplet/);
  const measured = await f.launch('--workers', '6', '--size', 'c-16');
  assert.equal(measured.cached, undefined, 'a different worker count and size must execute');
  const result = await f.result(measured.id);
  assert.match(result.text, /Executor droplet · c-16 lon1/);
  assert.match(result.text, /workers 6 · requested size c-16/);
  assert.match(await log(measured.id), /WORKERS=6\nEXECUTOR=droplet/);
  const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  const job = status.suites!.find(job => job.id === measured.id)!;
  assert.equal(job.workers, 6); assert.equal(job.size, 'c-16');
  const leases = (await import('../src/executor/droplet/lease.ts')).readLeases;
  const lease = (await leases(f.root)).find(lease => lease.run === measured.id)!;
  assert.equal(lease.size, 'c-16'); assert.equal(lease.priceHourly, 0.50);
  assert.equal(lease.costUsd, Math.max(60000, lease.lifetimeMs!) / 3600000 * 0.50);
  const cached = await f.launch('--workers', '6', '--size', 'c-16');
  assert.equal(cached.cached?.run, measured.id);
  await f.result(cached.id);
  const local = await f.launch('--executor', 'local');
  assert.equal(local.cached, undefined, 'local five-worker policy must not reuse remote eight-worker evidence');
  assert.match((await f.result(local.id)).text, /workers 5/);
  assert.match(await log(local.id), /WORKERS=5\nEXECUTOR=local/);
  const localOverride = await f.launch('--executor', 'local', '--workers', '6');
  assert.match((await f.result(localOverride.id)).text, /workers 6/);
  assert.match(await log(localOverride.id), /WORKERS=6\nEXECUTOR=local/);
  for (const args of [['--workers', '0'], ['--workers', '1.5'], ['--size', 'unknown'], ['--executor', 'local', '--size', 'c-16']]) {
    const refused = await clandWithEnv(f.root, f.actor, 'verify', '--report', f.topic, '--to', 'impl', ...args);
    assert.equal(refused.code, 1, refused.stdout);
    assert.match(refused.stderr, /positive integer|unavailable|requires the droplet executor/);
  }
  const refused = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, workers: 0 });
  assert.equal(refused.ok, false);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  await f.stop();
  const restart = await projectHub(t, f.root, f.env);
  const restoredUi = await connectUi(t, restart.discovery);
  const restoredStatus = (await restoredUi.request({ type: 'hub.status' })).value as HubStatus;
  const restored = restoredStatus.suites!.find(job => job.id === measured.id)!;
  assert.equal(restored.workers, 6); assert.equal(restored.size, 'c-16');
});

test('remote completion waits for its timestamp before reporting, settling cost and caching', async t => {
  const f = await fixture(t, { hub: projectHub });
  const entered = join(f.root, '.cland/date-entered');
  const release = join(f.root, '.cland/date-release');
  const completed = join(f.root, '.cland/date-completed');
  // Hold the real shell's completion timestamp, after it opens the output file.
  await writeFile(join(f.env.PATH.split(':')[0]!, 'date'), `#!${process.execPath}
const fs=require('node:fs'),cp=require('node:child_process');
fs.writeFileSync(${JSON.stringify(entered)},'entered');
const deadline=Date.now()+20000;
const timer=setInterval(()=>{
  if(!fs.existsSync(${JSON.stringify(release)})&&Date.now()<deadline)return;
  clearInterval(timer);
  const result=cp.spawnSync('/bin/date',process.argv.slice(2),{stdio:'inherit'});
  fs.writeFileSync(${JSON.stringify(completed)},'completed');
  process.exitCode=result.status??1;
},10);
`, { mode: 0o700 });
  const run = await f.launch();
  const remote = await f.remote(run.id);
  const marker = join(remote.run, 'done');
  try {
    await eventually('date reaches the completion boundary', () => readFile(entered, 'utf8').catch(() => undefined), 20000);
    const lease = (await readLeases(f.root)).find(lease => lease.run === run.id)!;
    const observer = new DropletRun(f.root, f.env);
    assert.equal((await observer.status(lease)).state, 'running');
    assert.deepEqual(await f.messages(run.id), [], 'no final report while date is held');
    await assert.rejects(readFile(marker), { code: 'ENOENT' }, 'completion marker is not published early');
    // An older runner may still expose an empty marker; the reader must wait too.
    await writeFile(marker, '');
    try {
      assert.equal((await observer.status(lease)).state, 'running', 'empty marker is incomplete');
      assert.deepEqual(await f.messages(run.id), []);
    } finally { await rm(marker, { force: true }); }
  } finally {
    await writeFile(release, 'release');
    // Observe the worker receipt before starting the downstream report wait.
    await eventually('date completed', () => readFile(completed, 'utf8').catch(() => undefined), 20000);
  }
  const finished = await eventually('completion timestamp published', async () => (await readFile(marker, 'utf8').catch(() => '')).trim() || undefined, 20000);
  assert.ok(Number.isFinite(Date.parse(finished)));
  await f.result(run.id);
  const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
  const job = status.suites!.find(job => job.id === run.id)!;
  assert.equal(job.finished, finished);
  assert.equal(job.reported, true);
  assert.equal(job.outcome?.code, 0);
  const lease = (await readLeases(f.root)).find(lease => lease.run === run.id)!;
  assert.equal(lease.state, 'released');
  assert.ok(Number.isFinite(lease.lifetimeMs) && lease.lifetimeMs! > 0);
  assert.ok(Number.isFinite(lease.costUsd) && lease.costUsd! > 0);
  const cached = await f.launch();
  assert.equal(cached.cached?.run, run.id);
  await f.result(cached.id);
  assert.equal((await f.messages(run.id)).length, 1, 'completion is reported once');
});

test('requested size reserves its own price before create and fallback restores local configured workers', async t => {
  // A 15-minute c-8 reservation costs $0.0625; c-16 costs $0.125 and exceeds $0.10.
  const f = await fixture(t, { hub: projectHub, test: script, config: 'workers=5\nlifetime="15m"\nrun_timeout="5m"\ndaily_spend_usd=0.10\n[verification.droplet]\nworkers=8\n' });
  f.api.sizes.push({ slug: 'c-16', available: true, price_hourly: 0.50, disk: 100, regions: ['lon1'] });
  f.api.regions.find(region => region.slug === 'lon1')!.sizes.push('c-16');
  const explicit = await clandWithEnv(f.root, f.actor, 'verify', '--executor', 'droplet', '--size', 'c-16', '--report', f.topic, '--to', 'impl', '--json');
  assert.equal(explicit.code, 1, 'explicit droplet admission must price the requested c-16 rather than the configured c-8');
  assert.match(explicit.stderr, /daily spend cap \$0\.1 reached/);
  const queue = (await f.ui.request({ type: 'suite.queue' })).value as { waiters: unknown[]; remote: unknown[] };
  assert.deepEqual(queue.waiters, []); assert.deepEqual(queue.remote, []);
  const job = await f.launch('--size', 'c-16');
  const result = await f.result(job.id);
  assert.match(result.text, /Executor local/);
  assert.match(result.text, /workers 5 · requested size c-16/);
  const history = (await f.ui.request({ type: 'topic.history', topic: f.topic })).value as { messages: { text: string }[] };
  assert.ok(history.messages.some(message => /droplet unavailable.*daily spend cap/.test(message.text)), JSON.stringify(history));
  assert.equal(f.api.requests.filter(request => request.method === 'POST' && request.path === '/v2/droplets').length, 0);
  assert.match(await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8'), /WORKERS=5\nEXECUTOR=local/);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
});
