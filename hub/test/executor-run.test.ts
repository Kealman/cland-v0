import { DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, flushProjectLogs, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { ownProcess, onCleanup } from './process-cleanup.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { prepareKey, keyHash } from '../src/executor/droplet/prepare.ts';
import type { HubStatus } from '../src/protocol.ts';

const exec = promisify(execFile);
const token = 'sentinel-remote-suite-token';
async function fixture(t: TestContext, options: { typecheck?: string | undefined; test?: string | undefined; executor?: 'local' | 'droplet' } = {}) {
  const root = await tempProject(t, 'remote-run-');
  const territory = await tempProject(t, 'remote-territory-');
  const api = await fakeDigitalOcean(token);
  onCleanup(t, () => api.close());
  const git = async (...args: string[]) => (await exec('git', args, { cwd: root })).stdout.trim();
  await git('init', '-q', '-b', 'dev');
  await git('config', 'user.name', 'Test'); await git('config', 'user.email', 'test@example.com'); await git('config', 'commit.gpgsign', 'false');
  await mkdir(join(root, 'nvim')); await mkdir(join(root, 'hub/src/tracker'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.cland/\nnode_modules/\n');
  await writeFile(join(root, 'nvim/NVIM_VERSION'), 'v0.12.5\n');
  await writeFile(join(root, 'nvim/NVIM_SHA256SUMS'), `${'a'.repeat(64)}  nvim-linux-x86_64.tar.gz\n`);
  const typecheck = options.typecheck ?? 'node -e "process.exit(0)"';
  const script = options.test ?? `node -e "console.log('SELECTION='+process.env.CLAND_SUITE_SELECTION);console.log('COLORS='+process.env.FORCE_COLOR+','+process.env.NO_COLOR);console.log('# tests 1');console.log('# pass 1')"`;
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, workspaces: ['hub'], scripts: { typecheck, test: script } }));
  await writeFile(join(root, 'hub/package.json'), JSON.stringify({ name: 'fixture-hub', scripts: { test: script } }));
  await writeFile(join(root, 'package-lock.json'), '{}\n');
  await git('add', '.'); await git('commit', '-qm', 'Base');
  await exec('git', ['init', '--bare', '-q', territory]);
  await git('remote', 'add', 'origin', territory); await git('push', '-qu', 'origin', 'dev');
  const key = await prepareKey(root);
  const image = { id: 900, name: 'suite-snapshot', regions: ['lon1'], size_gigabytes: 1, min_disk_size: 10, created_at: new Date().toISOString() };
  await api.seedSnapshot(image, key);
  const imageHome = join(api.imageDirs.get(image.id)!, 'home/runner');
  await exec('git', ['clone', '-q', '--no-hardlinks', root, join(imageHome, 'cland')]);
  await exec('git', ['remote', 'remove', 'origin'], { cwd: join(imageHome, 'cland') });
  await mkdir(join(root, '.cland/run/executor'), { recursive: true });
  await writeFile(join(root, '.cland/run/executor/snapshot.json'), JSON.stringify({ image: image.id, name: image.name, key, keyHash: keyHash(key), regions: image.regions, sizeGb: 1, minDiskSize: 10, created: image.created_at }));
  await writeFile(join(root, '.cland/config.toml'), `[verification]\nexecutor = "${options.executor ?? 'droplet'}"\nlock_path = ${JSON.stringify(join(root, '.cland/host.lock'))}\nlifetime = "10m"\n`);
  // The fake machine executes the real delivered shell on either macOS or Linux.
  const bin = join(api.stateRoot, 'bin'); await mkdir(bin);
  await writeFile(join(bin, 'setsid'), '#!/usr/bin/env python3\nimport os,sys\nos.setsid()\nos.execvp(sys.argv[1],sys.argv[1:])\n');
  await writeFile(join(bin, 'timeout'), '#!/usr/bin/env python3\nimport subprocess,sys\na=sys.argv[1:]\na=a[1:] if a[0].startswith("--kill-after") else a\nseconds=float(a.pop(0).rstrip("s"))\np=subprocess.Popen(a)\ntry: sys.exit(p.wait(timeout=seconds))\nexcept subprocess.TimeoutExpired:\n p.terminate()\n try: p.wait(timeout=1)\n except subprocess.TimeoutExpired: p.kill();p.wait()\n sys.exit(124)\n');
  await writeFile(join(bin, 'sha256sum'), `#!${process.execPath}\nconst fs=require('fs'),crypto=require('crypto');console.log(crypto.createHash('sha256').update(fs.readFileSync(process.argv[2])).digest('hex')+'  '+process.argv[2]);\n`);
  await writeFile(join(bin, 'flock'), '#!/usr/bin/env python3\nimport fcntl,sys\ntry: fcntl.flock(int(sys.argv[-1]),fcntl.LOCK_EX|fcntl.LOCK_NB)\nexcept BlockingIOError: sys.exit(1)\n');
  for (const file of ['setsid', 'timeout', 'sha256sum', 'flock']) await chmod(join(bin, file), 0o700);
  const env = { DIGITALOCEAN_TOKEN: token, CLAND_DIGITALOCEAN_API: api.url, CLAND_SSH_BIN: resolve('hub/test/fakes/digitalocean/ssh'), CLAND_SCP_BIN: resolve('hub/test/fakes/digitalocean/scp'), CLAND_TEST_FAKE_MACHINE_ROOT: api.stateRoot, PATH: `${bin}:${process.env.PATH}`, CLAND_TEST_DROPLET_POLL_MS: '20', CLAND_TEST_DROPLET_MACHINE_MS: '2000', CLAND_TEST_DROPLET_RUN_POLL_MS: '50', CLAND_TEST_DROPLET_CANCEL_MS: '500', CLAND_TEST_DROPLET_RELEASE_MS: '500', CLAND_TEST_DROPLET_RETRY_MS: '50' };
  await git('checkout', '-qb', 'task-candidate');
  await writeFile(join(root, 'hub/src/tracker/change.ts'), 'export const candidate = true;\n'); await git('add', 'hub/src/tracker/change.ts'); await git('commit', '-qm', 'Hub change');
  const daemon = await startDaemon(t, root, env);
  const ui = await connectUi(t, daemon.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const spoke = await spawnSpoke({ discover: true, assignRole: false, cwd: root, name: 'impl', sessionId: 'remote-impl', role: 'implementer' });
  onCleanup(t, () => spoke.close()); await spoke.waitForPresence(['impl']);
  const actor = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'remote-impl', CLAND_ROLE: 'implementer' };
  const item = JSON.parse((await cland(root, 'task', 'create', '--size', 'M', 'Remote fixture', '--assignee', 'impl', '--json')).stdout).item.id as string;
  const topic = ((await ui.request({ type: 'topic.create', item, title: 'Remote run' })).value as { topic: { id: string } }).topic.id;
  const launch = async (...args: string[]) => {
    const submitted = await clandWithEnv(root, actor, 'verify', '--report', topic, '--to', 'impl', '--json', ...args);
    assert.equal(submitted.code, 0, submitted.stderr);
    return JSON.parse(submitted.stdout) as { id: string; pid: number | null; cached?: { run: string } };
  };
  const messages = async (id: string, client = ui) => ((await client.request({ type: 'topic.history', topic })).value as { messages: { id: string; text: string }[] }).messages.filter(m => m.id === `suite:${id}`);
  const result = async (id: string, client = ui) => eventually('remote result', async () => (await messages(id, client))[0], 20000);
  const remote = async (id: string, client = ui) => eventually('remote group started', async () => {
    const directory = [...api.machineDirs.values()].at(-1);
    if (!directory) return;
    const home = join(directory, 'home/runner');
    const pgid = await readFile(join(home, 'runs', id, 'pgid'), 'utf8').catch(() => '');
    if (!pgid) { const failure = (await messages(id, client))[0]; if (failure) throw new Error(failure.text); return; }
    ownProcess(t, Number(pgid));
    return { home, run: join(home, 'runs', id) };
  }, 15000);
  return { root, api, git, key, ui, discovery: daemon.discovery, env, actor, item, topic, launch, messages, result, remote };
}

test('remote verify delivers host selection, runs as runner, reports accounting, contains the token and caches across executors', async t => {
  const f = await fixture(t);
  const job = await f.launch(); const remote = await f.remote(job.id);
  const result = await f.result(job.id);
  assert.match(result.text, /auto exit 0/);
  assert.match(result.text, /Executor droplet · c-8 lon1 · cland-.*lifetime \d+ s · cost \$\d+\.\d{4}/);
  assert.equal((await f.messages(job.id)).length, 1);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  assert.match(log, /mode hub-only/); assert.match(log, /COLORS=0,1/);
  assert.match(log, /\$ npm test\n/);
  const selection = JSON.parse(log.match(/^SELECTION=(.*)$/m)![1]!);
  const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  assert.deepEqual(selection, status.suites!.find(s => s.id === job.id)!.selection);
  assert.ok(log.indexOf('$ npm run typecheck') < log.indexOf('$ npm test'));
  assert.equal(await f.git('rev-parse', 'HEAD'), (await exec('git', ['rev-parse', 'HEAD'], { cwd: join(remote.home, 'cland') })).stdout.trim());
  assert.equal((await exec('git', ['remote'], { cwd: join(remote.home, 'cland') })).stdout, '');
  const calls = await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8');
  assert.match(calls, /runner@203\.0\.113/); assert.match(calls, /tree\.bundle/);
  const view = JSON.parse((await cland(f.root, 'task', 'view', f.item, '--json')).stdout);
  assert.equal(view.item.verify.executor, 'droplet');
  const local = await f.launch('--executor', 'local');
  assert.equal(local.cached!.run, job.id); assert.match((await f.result(local.id)).text, /Executor droplet/);
  const invalid = await clandWithEnv(f.root, f.actor, 'verify', '--executor', 'other', '--report', f.topic);
  assert.equal(invalid.code, 1); assert.match(invalid.stderr, /executor must be local or droplet/);
  const refused = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, executor: 'other' });
  assert.equal(refused.ok, false);
  await flushProjectLogs(t, f.root);
  const scan = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (entry.isFile()) assert.ok(!(await readFile(path)).includes(Buffer.from(token)), `token absent: ${entry.name}`);
    }
  };
  await scan(join(f.root, '.cland'));
  for (const dir of f.api.machineDirs.values()) await scan(dir);
  assert.ok(!calls.includes(token)); assert.ok(!JSON.stringify(f.api.requests).includes(token));
});

test('executor overrides bypass host compatibility locks and dirty remote candidates are refused', async t => {
  const f = await fixture(t, { executor: 'local' });
  await mkdir(join(f.root, '.cland/host.lock'));
  const remote = await f.launch('--executor', 'droplet');
  assert.match((await f.result(remote.id)).text, /Executor droplet/);
  await writeFile(join(f.root, 'hub/src/tracker/change.ts'), 'dirty');
  const dirty = await clandWithEnv(f.root, f.actor, 'verify', '--executor', 'droplet', '--report', f.topic, '--to', 'impl');
  assert.equal(dirty.code, 1); assert.match(dirty.stderr, /dirty worktree/);
});

test('a local override executes locally despite a droplet default', async t => {
  const f = await fixture(t);
  const job = await f.launch('--executor', 'local', '--fresh');
  if (job.pid) ownProcess(t, job.pid);
  assert.match((await f.result(job.id)).text, /Executor local/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});

test('host typecheck failure creates no machine; remote typecheck stops tests and failed tests retain failures', async t => {
  for (const kind of ['host', 'remote', 'test'] as const) await t.test(kind, async t => {
    const f = await fixture(t, { typecheck: kind === 'host' ? 'node -e "process.exit(2)"' : kind === 'remote' ? `node -e "process.exit(process.env.HOME.includes('home/runner')?3:0)"` : undefined,
      test: kind === 'test' ? `node -e "console.log('not ok 1 - remote failure');process.exit(4)"` : undefined });
    const job = await f.launch();
    const report = await f.result(job.id);
    if (kind === 'host') { assert.match(report.text, /host typecheck failed/); assert.equal(f.api.machineDirs.size, 0); }
    else {
      assert.match(report.text, new RegExp(`exit ${kind === 'remote' ? 3 : 4}`));
      const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
      if (kind === 'remote') assert.doesNotMatch(log, /\$ npm test/);
      else assert.match(report.text, /remote failure/);
    }
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  });
});

const longTest = `node -e "const fs=require('fs');console.log('INCREMENTAL 😀');const t=setInterval(()=>{if(fs.existsSync(process.env.HOME+'/finish')){console.log('FINAL 😀');clearInterval(t)}},50)"`;
test('incremental byte logs survive SSH failure and hub restart and report once', async t => {
  const f = await fixture(t, { test: longTest });
  const job = await f.launch(); const remote = await f.remote(job.id);
  const localLog = join(f.root, '.cland/run/suites', job.id, 'suite.log');
  await eventually('incremental output', async () => (await readFile(localLog, 'utf8')).includes('INCREMENTAL 😀') ? true : undefined);
  await f.api.setMachineFaults({ sshFailures: 4 });
  await eventually('failed poll is retried', async () => {
    const calls = await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8');
    return calls.trim().split('\n').map(line => JSON.parse(line)).filter(call => call.mode === 'ssh' && call.faults.sshFailures > 0).length >= 4 ? true : undefined;
  });
  assert.equal((await f.messages(job.id)).length, 0);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  await f.api.setMachineFaults({ sshFailures: 0 });
  const restarted = await startDaemon(t, f.root, f.env); const ui = await connectUi(t, restarted.discovery);
  await eventually('reattached live run', async () => { const status = (await ui.request({ type: 'hub.status' })).value as HubStatus; return status.suites!.find(s => s.id === job.id)?.state === 'running' ? true : undefined; });
  assert.equal(f.api.droplets.length, 1); assert.equal((await f.messages(job.id, ui)).length, 0);
  await writeFile(join(remote.home, 'finish'), 'done');
  assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
  const log = await readFile(localLog, 'utf8');
  assert.equal(log.split('\n').filter(line => line === 'INCREMENTAL 😀').length, 1); assert.equal(log.split('\n').filter(line => line === 'FINAL 😀').length, 1);
  assert.equal((await f.messages(job.id, ui)).length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
});

test('provider loss and verify cancel each report once and release the machine and key', async t => {
  for (const kind of ['lost', 'cancel'] as const) await t.test(kind, async t => {
    const f = await fixture(t, { test: longTest });
    const job = await f.launch(); const remote = await f.remote(job.id);
    await eventually('remote suite started', async () => (await readFile(join(remote.run, 'suite.log'), 'utf8').catch(() => '')).includes('INCREMENTAL') ? true : undefined);
    if (kind === 'lost') f.api.droplets.splice(0);
    else assert.equal((await clandWithEnv(f.root, f.actor, 'verify', 'cancel', job.id)).code, 0);
    const report = await f.result(job.id);
    assert.match(report.text, kind === 'lost' ? /remote machine lost/ : /exit 143; cancelled/);
    assert.equal((await f.messages(job.id)).length, 1);
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
    if (kind === 'cancel') assert.equal((await readFile(join(remote.run, 'exit'), 'utf8')).trim(), '143');
  });
});


test('remote start reconciles executed-but-lost replies and marker-only interruptions', async t => {
  for (const fault of ['startReplyLost', 'startMarkerOnly'] as const) await t.test(fault, async t => {
    const f = await fixture(t, { test: longTest });
    await f.api.setMachineFaults({ [fault]: 1 });
    const job = await f.launch(); const remote = await f.remote(job.id);
    await eventually('suite remains running', async () => (await readFile(join(remote.run, 'suite.log'), 'utf8').catch(() => '')).includes('\nINCREMENTAL 😀\n') ? true : undefined);
    assert.equal((await f.messages(job.id)).length, 0);
    await writeFile(join(remote.home, 'finish'), 'done');
    assert.match((await f.result(job.id)).text, /auto exit 0/);
    const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
    assert.equal(log.split('\n').filter(line => line === 'INCREMENTAL 😀').length, 1);
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  });
});

test('restart reloads the lease after admission and never redelivers or cleans the live checkout', async t => {
  const f = await fixture(t, { test: longTest });
  const job = await f.launch(); const remote = await f.remote(job.id);
  await eventually('local poll collected first bytes', async () => (await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8')).includes('\nINCREMENTAL 😀\n') ? true : undefined);
  const pgid = await readFile(join(remote.run, 'pgid'), 'utf8');
  await writeFile(join(remote.home, 'cland/live-checkout-evidence'), 'must survive restart');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  // Simulate a crash after lease.json recorded admission but before hub.db's save.
  const db = new DatabaseSync(join(f.root, '.cland/hub.db'));
  try {
    const row = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const jobs = JSON.parse(row.value);
    const stale = jobs.find((run: { id: string }) => run.id === job.id);
    stale.state = 'launching'; delete stale.lease.execution;
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(jobs));
  } finally { db.close(); }
  const restart = await startDaemon(t, f.root, f.env); const ui = await connectUi(t, restart.discovery);
  await eventually('restored job running', async () => ((await ui.request({ type: 'hub.status' })).value as HubStatus).suites!.find(run => run.id === job.id)?.state === 'running' ? true : undefined);
  assert.equal(await readFile(join(remote.home, 'cland/live-checkout-evidence'), 'utf8'), 'must survive restart');
  assert.equal(await readFile(join(remote.run, 'pgid'), 'utf8'), pgid);
  await writeFile(join(remote.home, 'finish'), 'done');
  assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
  const calls = (await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(calls.filter(call => call.mode === 'ssh' && call.args.at(-1).includes('git checkout --detach')).length, 1);
  assert.equal((await f.messages(job.id, ui)).length, 1);
});

test('a crash after acquire preserves the launching suite lease before delivery', async t => {
  const f = await fixture(t, { test: longTest });
  await f.api.setMachineFaults({ delayMs: 4000, delayCommand: 'mkdir -p' });
  const job = await f.launch();
  await eventually('acquired lease reached delivery', async () => {
    const calls = await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8').catch(() => '');
    return calls.includes('mkdir -p') ? true : undefined;
  });
  process.kill(f.discovery.pid, 'SIGKILL');
  await f.api.setMachineFaults({ delayMs: 0 });
  const restart = await startDaemon(t, f.root, f.env); const ui = await connectUi(t, restart.discovery);
  const remote = await f.remote(job.id, ui);
  await writeFile(join(remote.home, 'finish'), 'done');
  assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.equal((await f.messages(job.id, ui)).length, 1);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
});
