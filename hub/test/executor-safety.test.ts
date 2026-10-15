import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rm, readdir, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { projectHub, cland, clandWithEnv, connectUi, eventually, flushProjectLogs, startDaemon, tempProject } from './harness.ts';
import { projectTag } from '../src/executor/droplet/droplet.ts';
import { warningSeverity } from '../src/hub/visibility.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';
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

test('timeout and spend config validate and survive rendering', () => {
  assert.throws(() => parseConfig('[verification]\nlifetime="15m"\nrun_timeout="6m"', 'test'), /lifetime 15m.*run_timeout 6m/);
  for (const value of ['-1', '"5"', 'nan']) assert.throws(() => parseConfig(`[verification]\ndaily_spend_usd=${value}`, 'test'), /daily_spend_usd/);
  assert.throws(() => parseConfig('[verification]\nrun_timeout="oops"', 'test'), /run_timeout/);
  const config = parseConfig('[verification]\nlifetime="60m"\nrun_timeout="50m"\ndaily_spend_usd=3', 'test');
  assert.deepEqual(parseConfig(renderConfig(config), 'test'), config);
});

test('invalid timeout margins refuse hub startup with both values', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nlifetime="15m"\nrun_timeout="6m"');
  const refused = await clandWithEnv(root, { DIGITALOCEAN_TOKEN: '' }, 'hub', 'start');
  assert.equal(refused.code, 1); assert.match(refused.stderr, /lifetime 15m.*run_timeout 6m/);
});

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

test('all remote admission refusals persist a local job, one warn notice and one journal event', async t => {
  for (const cause of ['token', '422', '500', 'snapshot', 'region'] as const) await t.test(cause, async t => {
    const f = await fixture(t, { hub: projectHub, env: cause === 'token' ? { DIGITALOCEAN_TOKEN: '' } : {} });
    if (cause === '422' || cause === '500') { f.api.faults.create = Number(cause); f.api.faults.echoToken = true; }
    if (cause === 'snapshot') await rm(join(f.root, '.cland/run/executor/snapshot.json'));
    if (cause === 'region') f.api.regions.splice(0);
    const run = await f.launch();
    assert.match((await f.result(run.id)).text, /Executor local/);
    const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
    assert.equal(status.suites!.find(s => s.id === run.id)!.executor, 'local');
    const history = ((await f.ui.request({ type: 'topic.history', topic: f.topic })).value as { messages: { text: string; severity?: string }[] }).messages;
    const notices = history.filter(m => m.text.includes('droplet unavailable'));
    assert.equal(notices.length, 1); assert.equal(notices[0]!.severity, 'warn');
    assert.match(notices[0]!.text, new RegExp(cause === 'token' ? 'DIGITALOCEAN_TOKEN' : cause === 'snapshot' ? 'no prepared snapshot' : cause === 'region' ? 'unavailable in regions' : cause));
    const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(journal.filter(r => r.event === 'verification-executor-fallback' && r.id === run.id).length, 1);
    assert.equal(warningSeverity('inbox', { kind: 'executor-fallback' }), 'warn');
    const events = JSON.stringify((await f.ui.request({ type: 'events.list' })).value);
    assert.ok(events.includes('droplet unavailable')); assert.ok(events.includes('"warning":true'));
    assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, cause === '422' || cause === '500' ? 1 : 0);
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  });
});

test('two protocol projects reserve against one cap and confirmed release replaces the reservation', async t => {
  const state = await tempProject(t, 'shared-spend-');
  const first = await fixture(t, { hub: projectHub, test: longTest, config: 'lifetime="15m"\nrun_timeout="5m"\ndaily_spend_usd=0.063', env: { CLAND_EXECUTOR_STATE: state } });
  const run = await first.launch(); const machine = await first.remote(run.id);
  assert.equal((await ledger(state)).entries[0]!.reservation, 0.0625);
  assert.equal((await ledger(state)).entries[0]!.cost, null);
  const second = await fixture(t, { hub: projectHub, config: 'lifetime="15m"\nrun_timeout="5m"\ndaily_spend_usd=0.063', env: { CLAND_EXECUTOR_STATE: state } });
  const refused = await second.launch();
  assert.match((await second.result(refused.id)).text, /Executor local/);
  const history = JSON.stringify((await second.ui.request({ type: 'topic.history', topic: second.topic })).value);
  assert.match(history, /daily spend cap \$0.063 reached/);
  assert.equal(second.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  first.api.faults.deleteError = 503;
  await writeFile(join(machine.home, 'finish'), 'done');
  await eventually('release stays reserved', async () => (await lease(first.root)).value.state === 'releasing' ? true : undefined);
  assert.equal((await ledger(state)).entries[0]!.cost, null);
  first.api.faults.deleteError = 0;
  await first.result(run.id);
  const entry = (await ledger(state)).entries[0]!;
  assert.ok(entry.cost! > 0 && entry.cost! < entry.reservation);
  const status = JSON.parse((await cland(second.root, 'executor', 'status', '--json')).stdout);
  assert.equal(status.spend.path, join(state, 'spend.json'));
  assert.equal(status.spend.spent, entry.cost); assert.equal(status.spend.reserved, 0); assert.equal(status.spend.cap, 0.063);
});

test('the remote shell and the host deadline both end a timed-out run once and release', async t => {
  for (const mode of ['shell', 'host'] as const) await t.test(mode, async t => {
    const f = await fixture(t, { test: longTest, config: `lifetime="15m"\nrun_timeout="${mode === 'shell' ? '2s' : '5m'}"`, env: { CLAND_TEST_EXECUTOR_TIMEOUT_GRACE_MS: '50', ...(mode === 'shell' ? { CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS: '200' } : {}) } });
    const run = await f.launch(); await f.remote(run.id);
    if (mode === 'host') {
      // Durable admission predates the configured deadline; reattach through the protocol.
      await cland(f.root, 'hub', 'stop');
      const record = await lease(f.root); record.value.execution!.startedAt = new Date(Date.now() - 400000).toISOString();
      await writeFile(record.path, JSON.stringify(record.value));
      const db = new DatabaseSync(join(f.root, '.cland/hub.db'));
      try {
        const jobs = JSON.parse((db.prepare("select value from meta where key='suite-jobs'").get() as { value: string }).value);
        jobs.find((job: { id: string }) => job.id === run.id).lease = record.value;
        db.prepare("update meta set value=? where key='suite-jobs'").run(JSON.stringify(jobs));
      } finally { db.close(); }
      const restarted = await startDaemon(t, f.root, f.env); const ui = await connectUi(t, restarted.discovery);
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

test('same-name hubs preserve each other’s in-flight keys and conservatively age legacy keys', async t => {
  const state = await tempProject(t, 'key-host-state-');
  const first = await fixture(t, { hub: projectHub, name: 'same', test: longTest, env: { CLAND_EXECUTOR_STATE: state, CLAND_TEST_EXECUTOR_SWEEP_MS: '200' } });
  const second = await fixture(t, { hub: projectHub, name: 'same', api: first.api, test: longTest, env: { CLAND_EXECUTOR_STATE: state, CLAND_TEST_EXECUTOR_SWEEP_MS: '200' } });
  let resume!: () => void;
  const blocked = new Promise<void>(resolve => { resume = resolve; });
  let creates = 0;
  first.api.beforeCreate(() => { creates++; return blocked; });
  const a = await first.launch(); const b = await second.launch();
  try {
    await eventually('both creates blocked with durable key identities', () => creates === 2 ? true : undefined);
    const left = await lease(first.root); const right = await lease(second.root);
    const tagA = projectTag(first.root, 'same'), tagB = projectTag(second.root, 'same');
    assert.ok(left.value.keyName.startsWith(`${tagA}-`)); assert.ok(right.value.keyName.startsWith(`${tagB}-`));
    assert.notEqual(tagA, tagB);
    for (const f of [first, second]) assert.equal((await cland(f.root, 'executor', 'reap')).code, 0);
    assert.equal(first.api.keys.length, 2);

    // The other project's live legacy lease is old enough but still protects its key.
    const foreignKey = first.api.keys.find(key => key.name === right.value.keyName)!;
    const originalName = foreignKey.name;
    right.value.keyName = 'cland-same-live'; right.value.keyImportStarted = new Date(Date.now() - 3600000).toISOString();
    await writeLease(second.root, right.value);
    // A list taken before the rename can still carry the old name. The imported
    // key's stable provider id must protect it across that observation window.
    assert.equal((await cland(first.root, 'executor', 'reap')).code, 0);
    assert.ok(first.api.keys.some(key => key.id === foreignKey.id), 'a live key survives a stale provider name');
    foreignKey.name = right.value.keyName;
    const old = new Date(Date.now() - 3600000).toISOString();
    for (const [id, name, created] of [[8100, 'cland-same-old', old], [8101, 'cland-same-young', new Date().toISOString()]] as const) {
      first.api.keys.push({ id, name, public_key: 'public' });
      const history: DropletLease = { ...left.value, lease: `legacy-${id}`, keyName: name, keyImportStarted: created, created, state: 'released', resource: null, costUsd: 0, released: created };
      delete history.watchdog; delete history.execution;
      await writeLease(second.root, history);
    }
    first.api.keys.push({ id: 8102, name: 'cland-same-unknown-age', public_key: 'public' });
    assert.equal((await cland(first.root, 'executor', 'reap')).code, 0);
    assert.ok(!first.api.keys.some(key => key.id === 8100));
    assert.ok(first.api.keys.some(key => key.id === 8101)); assert.ok(first.api.keys.some(key => key.id === 8102));
    assert.ok(first.api.keys.some(key => key.name === 'cland-same-live'));
    foreignKey.name = originalName; right.value.keyName = originalName; delete right.value.keyImportStarted;
    await writeLease(second.root, right.value);
    resume();
    const machineA = await first.remote(a.id), machineB = await second.remote(b.id);
    await writeFile(join(machineA.home, 'finish'), 'done'); await writeFile(join(machineB.home, 'finish'), 'done');
    await first.result(a.id); await second.result(b.id);
    assert.deepEqual(first.api.droplets, []);
  } catch (error) {
    for (const f of [first, second]) {
      await flushProjectLogs(t, f.root);
      t.diagnostic((await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).split('\n').filter(line => /executor-|suite-/.test(line)).join('\n'));
    }
    throw error;
  } finally {
    // Release the provider barrier and settle both acquisitions before the fake
    // provider removes its snapshots, including when an assertion fails.
    resume();
    for (const [f, run] of [[first, a], [second, b]] as const) await cland(f.root, 'verify', 'cancel', run.id);
    await first.result(a.id); await second.result(b.id);
    for (const f of [first, second]) await f.stop();
  }
});

test('a short-lived hub preserves a foreign live lease beyond its own lifetime threshold', async t => {
  const state = await tempProject(t, 'foreign-lifetime-');
  const short = await fixture(t, { hub: projectHub, env: { CLAND_EXECUTOR_STATE: state } });
  const long = await fixture(t, { hub: projectHub, api: short.api, test: longTest, config: 'lifetime="110m"\nrun_timeout="75m"', env: { CLAND_EXECUTOR_STATE: state } });
  const run = await long.launch(); const machine = await long.remote(run.id);
  const record = await lease(long.root);
  const droplet = short.api.droplets.find(d => d.id === record.value.resource)!;
  droplet.created_at = new Date(Date.now() - 30 * 60000).toISOString();
  assert.equal((await cland(short.root, 'executor', 'reap')).code, 0);
  assert.ok(short.api.droplets.some(d => d.id === droplet.id));
  assert.ok(!short.api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/droplets/${droplet.id}`));
  await writeFile(join(machine.home, 'finish'), 'done'); await long.result(run.id);
});

test('provider list awaits cannot turn a concurrently acquired droplet or key into an orphan', async t => {
  for (const kind of ['droplet', 'key'] as const) await t.test(kind, async t => {
    const f = await fixture(t, { hub: projectHub, test: longTest, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
    let entered = false, resume!: () => void, allowCreate!: () => void;
    const blocked = new Promise<void>(resolve => { resume = resolve; });
    const create = new Promise<void>(resolve => { allowCreate = resolve; });
    t.after(() => { resume(); allowCreate(); });
    const barrier = async () => { if (entered) return; entered = true; await blocked; };
    if (kind === 'droplet') f.api.beforeDropletList(barrier);
    else { f.api.beforeKeyList(barrier); f.api.beforeCreate(() => create); }
    let run: Awaited<ReturnType<typeof f.launch>> | undefined;
    try {
      const reap = cland(f.root, 'executor', 'reap');
      await eventually('provider list is in flight', () => entered ? true : undefined);
      run = await f.launch();
      if (kind === 'key') await eventually('new key imported during list', () => f.api.keys.length === 1 ? true : undefined);
      else await f.remote(run.id);
      const record = await lease(f.root);
      resume();
      assert.equal((await reap).code, 0);
      if (kind === 'key') {
        assert.ok(f.api.keys.some(key => key.name === record.value.keyName));
        assert.ok(!f.api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/account/keys/${record.value.keyId}`));
        allowCreate();
      } else {
        assert.ok(f.api.droplets.some(d => d.id === record.value.resource));
        assert.ok(!f.api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/droplets/${record.value.resource}`));
      }
      const machine = await f.remote(run.id);
      await writeFile(join(machine.home, 'finish'), 'done'); await f.result(run.id);
      assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
    } finally {
      resume(); allowCreate();
      if (run) await cland(f.root, 'verify', 'cancel', run.id);
      await f.stop();
    }
  });
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
