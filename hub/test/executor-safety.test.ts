// T3: proves cross-process spend-lock recovery, remote shell timeout, watchdog rearming
// and cleanup after the hub process stops; component admission cases use scripted machines.
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { nativeProjectHub as projectHub, cland, connectUi, eventually, flushProjectLogs, startDaemon, tempProject } from './harness.ts';
import { projectTag } from '../src/executor/droplet/droplet.ts';
import type { DropletLease } from '../src/executor/droplet/lease.ts';
import type { HubStatus } from '../src/protocol.ts';

const exec = promisify(execFile);
const longTest = `node -e "const fs=require('fs');console.log('RUNNING');const t=setInterval(()=>{if(fs.existsSync(process.env.HOME+'/finish'))clearInterval(t)},50)"`;
type Ledger = { entries: { run: string; reservation: number; cost: number | null }[] };
const ledger = async (state: string): Promise<Ledger> => JSON.parse(await readFile(join(state, 'spend.json'), 'utf8'));
async function lease(root: string): Promise<{ value: DropletLease; path: string }> {
  const dir = join(root, '.cland/run/executor/leases');
  const ids = await readdir(dir);
  const records = await Promise.all(ids.map(async id => { const path = join(dir, id, 'lease.json'); return { path, value: JSON.parse(await readFile(path, 'utf8')) as DropletLease }; }));
  return records.sort((a, b) => a.value.created.localeCompare(b.value.created)).at(-1)!;
}

test('concurrent host processes share one reservation lock and recover a dead holder', async t => {
  const state = await tempProject(t, 'spend-lock-');
  const lockModule = resolve('hub/src/hub/lock.ts');
  const spendModule = resolve('hub/src/executor/droplet/spend.ts');
  const env: NodeJS.ProcessEnv = { ...process.env, CLAND_EXECUTOR_STATE: state }; delete env.DIGITALOCEAN_TOKEN;
  await exec(process.execPath, ['--input-type=module', '-e', `import { acquireLockAsync } from ${JSON.stringify(lockModule)}; await acquireLockAsync(${JSON.stringify(join(state, 'spend.json.lock'))}); process.exit(0);`], { env });
  const results = await Promise.all(Array.from({ length: 6 }, (_, id) => exec(process.execPath, ['--input-type=module', '-e', `
    import { reserveSpend } from ${JSON.stringify(spendModule)};
    const created = new Date().toISOString();
    try { await reserveSpend('project-${id}', { lease: 'lease-${id}', run: 'run-${id}', size: 'test', priceHourly: 1, created, deadline: new Date(Date.now()+3600000).toISOString() }, 1.001); console.log('reserved'); }
    catch (error) { console.log(error.message); }
  `], { env })));
  assert.equal(results.filter(r => r.stdout.trim() === 'reserved').length, 1);
  assert.equal(results.filter(r => r.stdout.includes('daily spend cap $1.001 reached')).length, 5);
  assert.equal((await ledger(state)).entries.length, 1);
});

test('the remote shell and the host deadline both end a timed-out run once and release', async t => {
  for (const mode of ['shell', 'host'] as const) await t.test(mode, async t => {
    const f = await fixture(t, { hub: projectHub, test: longTest, config: `lifetime="15m"\nrun_timeout="${mode === 'shell' ? '2s' : '5m'}"`, env: { CLAND_TEST_EXECUTOR_TIMEOUT_GRACE_MS: '50', ...(mode === 'shell' ? { CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS: '200' } : {}) } });
    const run = await f.launch(); await f.remote(run.id);
    if (mode === 'host') {
      // Durable admission predates the configured deadline; reattach through the protocol.
      await f.stop();
      const record = await lease(f.root); record.value.execution!.startedAt = new Date(Date.now() - 400000).toISOString();
      await writeFile(record.path, JSON.stringify(record.value));
      const db = new DatabaseSync(join(f.root, '.cland/hub.db'));
      try {
        const jobs = JSON.parse((db.prepare("select value from meta where key='suite-jobs'").get() as { value: string }).value);
        jobs.find((job: { id: string }) => job.id === run.id).lease = record.value;
        db.prepare("update meta set value=? where key='suite-jobs'").run(JSON.stringify(jobs));
      } finally { db.close(); }
      const restarted = await projectHub(t, f.root, f.env); const ui = await connectUi(t, restarted.discovery);
      assert.match((await f.result(run.id, ui)).text, /run timeout 5m/); assert.equal((await f.messages(run.id, ui)).length, 1);
    } else { assert.match((await f.result(run.id)).text, /run timeout 2s/); assert.equal((await f.messages(run.id)).length, 1); }
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  });
});

test('the periodic sweep reaps strays, re-arms a killed watchdog and retries failed provider cleanup', async t => {
  const f = await fixture(t, { hub: projectHub, test: longTest, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '200' } });
  const run = await f.launch(); const machine = await f.remote(run.id);
  const record = await lease(f.root); process.kill(record.value.watchdog!.pid, 'SIGKILL');
  const tag = projectTag(f.root, f.root.split('/').at(-1)!);
  f.api.droplets.push({ id: 8000, name: 'stray', tags: ['cland', tag], status: 'active', created_at: new Date().toISOString(), networks: { v4: [] } });
  f.api.faults.deleteError = 503;
  await eventually('dead watchdog rearmed', async () => (await lease(f.root)).value.watchdog!.pid !== record.value.watchdog!.pid ? true : undefined);
  await eventually('failed sweep recorded', async () => { await flushProjectLogs(t, f.root); return (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).includes('"failures":1') ? true : undefined; });
  f.api.faults.deleteError = 0;
  await eventually('stray reaped on next sweep', () => !f.api.droplets.some(d => d.id === 8000) ? true : undefined);
  await writeFile(join(machine.home, 'finish'), 'done'); await f.result(run.id);
  await flushProjectLogs(t, f.root);
  const journal = await eventually('completed sweep journalled', async () => { await flushProjectLogs(t, f.root); const journal = await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8'); return journal.includes('"reapedDroplets":1') ? journal : undefined; });
  assert.match(journal, /executor-watchdog-rearmed/); assert.match(journal, /executor-sweep/); assert.match(journal, /"reapedDroplets":1/);
});

test('prepare, run, fallback, cancel and stopped-hub watchdog leave the sentinel nowhere', async t => {
  const f = await fixture(t, { test: longTest, config: 'lifetime="20s"\nrun_timeout="18s"', env: { CLAND_TEST_EXECUTOR_MARGIN_MS: '1', CLAND_TEST_EXECUTOR_COLLECTION_MARGIN_MS: '1', CLAND_TEST_EXECUTOR_LIFETIME_MS: '4000' } });
  await rm(join(f.root, '.cland/run/executor/snapshot.json'));
  assert.equal((await cland(f.root, 'executor', 'prepare', '--report', 'general')).code, 0);
  await eventually('prepare finished', async () => {
    const value = (await f.ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string } };
    if (value.prepare?.state === 'failed') throw new Error(value.prepare.error);
    return value.prepare?.state === 'done' ? true : undefined;
  }, 20000);
  const cancelled = await f.launch(); await f.remote(cancelled.id);
  await cland(f.root, 'verify', 'cancel', cancelled.id); await f.result(cancelled.id);
  f.api.faults.create = 422; f.api.faults.echoToken = true;
  const fallback = await f.launch('--fresh');
  await eventually('fallback became local', async () => ((await f.ui.request({ type: 'hub.status' })).value as HubStatus).suites!.find(s => s.id === fallback.id)?.executor === 'local' ? true : undefined);
  await cland(f.root, 'verify', 'cancel', fallback.id); await f.result(fallback.id);
  f.api.faults.create = 0;
  const crash = await f.launch('--fresh'); await f.remote(crash.id);
  const lines = (await exec('ps', ['-ww', '-e', '-o', 'pid=,ppid=,command='])).stdout;
  assert.ok(!lines.includes('sentinel-remote-suite-token'));
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  await eventually('watchdog deleted after stopped hub', () => f.api.droplets.length === 0 && f.api.keys.length === 0 ? true : undefined, 25000);
  const restart = await startDaemon(t, f.root, f.env); const ui = await connectUi(t, restart.discovery);
  assert.match((await f.result(crash.id, ui)).text, /remote machine lifetime expired/);
  assert.equal((await f.messages(crash.id, ui)).length, 1);
  // The shortened lifetime can publish the crash result before the fallback lease's release settles.
  await eventually('all executor leases finish releasing', async () => {
    const status = (await ui.request({ type: 'executor.status' })).value as { leases: unknown[] };
    return status.leases.length === 0 ? true : undefined;
  });
  const status = JSON.parse((await cland(f.root, 'executor', 'status', '--json')).stdout);
  assert.deepEqual(status.leases, []); assert.equal(status.taggedDroplets, 0); assert.equal(status.spend.reserved, 0);
  await flushProjectLogs(t, f.root);
  const journal = await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8');
  assert.match(journal, /executor-watchdog-fired/); assert.match(journal, /executor-sweep/);
  // Live resource/result/journal checks are complete. Stop the restarted hub before
  // auditing persisted bytes, so its spend-ledger sweeps cannot rotate lock directories.
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const scan = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (entry.isFile()) assert.ok(!(await readFile(path)).includes(Buffer.from('sentinel-remote-suite-token')), `sentinel absent: ${entry.name}`);
    }
  };
  await scan(join(f.root, '.cland')); await scan(f.api.stateRoot);
  assert.ok(!JSON.stringify(f.api.requests).includes('sentinel-remote-suite-token'));
});
