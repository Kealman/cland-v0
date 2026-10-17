// T3: real worker delivery and host-receipt reuse, SSH interruption, provider loss, cancellation,
// watchdog reaping and hub-crash reconciliation require real process boundaries.
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, cland, clandWithEnv, connectUi, eventually, flushProjectLogs, startDaemon, tempProject, pidAlive } from './harness.ts';
import { ownProcess, onCleanup } from './process-cleanup.ts';
import type { HubStatus } from '../src/protocol.ts';
import { fixture } from './remote-fixture.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { candidateTree } from '../src/verification-tree.ts';

const exec = promisify(execFile);
const token = 'sentinel-remote-suite-token';

for (const dirty of ['tracker', 'source'] as const) test(`remote delivery ${dirty === 'tracker' ? 'bundles committed tracker state despite later tracker writes' : 'refuses and names source changes after submission'}`, async t => {
  const f = await fixture(t, { hub: projectHub });
  const view = JSON.parse((await cland(f.root, 'task', 'view', f.item, '--json')).stdout);
  const tracker = view.item.path as string;
  await f.git('add', '-f', tracker);
  await f.git('commit', '-qm', 'Committed tracker');
  const committed = await readFile(join(f.root, tracker), 'utf8');
  const head = await f.git('rev-parse', 'HEAD');
  const path = dirty === 'tracker' ? tracker : 'hub/src/tracker/change.ts';
  f.api.beforeCreate(async () => {
    await writeFile(join(f.root, path), 'uncommitted state\n');
    await f.git('add', '-f', path);
  });
  const job = await f.launch('--fresh');
  const result = await f.result(job.id);
  if (dirty === 'source') {
    assert.match(result.text, /dirty.*worktree cannot be bundled for droplet.*hub\/src\/tracker\/change\.ts/);
    assert.doesNotMatch(await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8'), /\$ npm test/);
  } else {
    assert.match(result.text, /exit 0/);
    for (const directory of f.api.machineDirs.values()) {
      const cwd = join(directory, 'home/runner/cland');
      assert.equal((await exec('git', ['rev-parse', 'HEAD'], { cwd })).stdout.trim(), head);
      assert.equal(await readFile(join(cwd, tracker), 'utf8'), committed);
      assert.equal((await exec('git', ['status', '--porcelain'], { cwd })).stdout, '');
    }
    assert.equal(await readFile(join(f.root, tracker), 'utf8'), 'uncommitted state\n');
  }
  assert.deepEqual(f.api.droplets, []);
});

test('remote verify delivers host selection, runs as runner, reports accounting, contains the token and caches across executors', async t => {
  const hostMargin = process.env.CLAND_TEST_EXECUTOR_MARGIN_MS;
  const gitEnv = { GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT, GIT_CONFIG_KEY_0: process.env.GIT_CONFIG_KEY_0, GIT_CONFIG_VALUE_0: process.env.GIT_CONFIG_VALUE_0 };
  const excludes = join(await tempProject(t), 'git-excludes');
  await writeFile(excludes, 'env-only-untracked\n');
  const f = await fixture(t, {
    hub: projectHub,
    config: 'lifetime = "3m"\nrun_timeout = "1m"\n',
    env: { CLAND_TEST_EXECUTOR_MARGIN_MS: '1000', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.excludesFile', GIT_CONFIG_VALUE_0: excludes },
  });
  await writeFile(join(f.root, 'env-only-untracked'), 'ignored only by this hub');
  assert.match(await f.git('status', '--porcelain'), /env-only-untracked/);
  const index = await readFile(join(f.root, '.git/index'));
  const job = await f.launch(); const remote = await f.remote(job.id);
  const result = await f.result(job.id);
  assert.match(result.text, /auto exit 0/);
  assert.equal(process.env.CLAND_TEST_EXECUTOR_MARGIN_MS, hostMargin);
  assert.deepEqual({ GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT, GIT_CONFIG_KEY_0: process.env.GIT_CONFIG_KEY_0, GIT_CONFIG_VALUE_0: process.env.GIT_CONFIG_VALUE_0 }, gitEnv);
  assert.deepEqual(await readFile(join(f.root, '.git/index')), index, 'candidate provenance uses a private index');
  assert.match(await readFile(join(f.root, '.cland/run/suites', job.id, 'run.sh'), 'utf8'), /^seconds=60$/m);
  assert.match(result.text, /Executor droplet · c-8 lon1 · cland-.*lifetime \d+ s · cost \$\d+\.\d{4}/);
  assert.equal((await f.messages(job.id)).length, 1);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  assert.match(log, /mode hub-only/); assert.match(log, /COLORS=0,1/);
  assert.match(log, /\$ npm test\n/);
  const selection = JSON.parse(log.match(/^SELECTION=(.*)$/m)![1]!);
  const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  assert.deepEqual(selection, status.suites!.find(s => s.id === job.id)!.selection);
  // T3: the real delivered worker must reuse the host receipt across the machine boundary.
  const tree = await candidateTree(f.root, undefined, f.env);
  assert.ok(tree);
  const expectedReceipt = `typecheck: host gate at ${tree} (not repeated)`;
  let receiptDiagnostic = '';
  if (!log.includes(expectedReceipt)) {
    const remoteLog = await readFile(join(remote.run, 'suite.log'), 'utf8');
    const laterLog = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
    const script = await readFile(join(f.root, '.cland/run/suites', job.id, 'run.sh'), 'utf8');
    const db = new DatabaseSync(join(f.root, '.cland/hub.db'), { readOnly: true });
    let remoteLogStart: number | undefined;
    try {
      const row = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
      remoteLogStart = (JSON.parse(row.value) as { id: string; remoteLogStart?: number }[]).find(run => run.id === job.id)?.remoteLogStart;
    } finally { db.close(); }
    const markers = (text: string) => text.match(/typecheck:[^\r\n]*/g) ?? [];
    receiptDiagnostic = `host receipt mismatch: ${JSON.stringify({ expected: tree, generated: script.match(/typecheck: host gate at ([0-9a-f]{40})/)?.[1], local: markers(log), laterLocal: markers(laterLog), remote: markers(remoteLog), remoteLogStart, localBytes: Buffer.byteLength(log), remoteBytes: Buffer.byteLength(remoteLog) })}`;
  }
  assert.ok(log.includes(expectedReceipt), receiptDiagnostic);
  assert.ok(result.text.includes(`typecheck: host gate at ${tree} (not repeated)`));
  assert.doesNotMatch(log, /\$ npm run typecheck/);
  assert.ok(log.indexOf('Host gate: npm run typecheck') < log.indexOf('$ npm test'));
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
  // Live checks are complete. Stop ledger sweeps before auditing persisted bytes,
  // so transient lock entries cannot disappear between readdir and readFile.
  await f.stop();
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

test('host typecheck failure creates no machine; remote typecheck stops tests and failed tests retain failures', async t => {
  const controls = join(await tempProject(t), 'failure-kind');
  await writeFile(controls, 'host');
  const hostHome = join(await tempProject(t), 'home/runner');
  await mkdir(hostHome, { recursive: true });
  const readKind = `require('fs').readFileSync(${JSON.stringify(controls)},'utf8')`;
  const f = await fixture(t, { hub: projectHub, env: { HOME: hostHome },
    typecheck: `node -e ${JSON.stringify(`const kind=${readKind};process.exit(kind==='host'?2:kind==='remote'&&!process.env.CLAND_TEST_FAKE_MACHINE_ROOT?3:0)`)}`,
    test: `node -e ${JSON.stringify(`if(${readKind}==='test'){console.log('not ok 1 - remote failure');process.exit(4)}console.log('# tests 1');console.log('# pass 1')`)}` });
  for (const kind of ['host', 'remote', 'test'] as const) await t.test(kind, async () => {
    await writeFile(controls, kind);
    // T3: plant a changed committed checkout before the real remote worker starts.
    await f.api.setMachineFaults({ checkoutDifference: kind === 'remote' });
    const job = await f.launch('--fresh');
    const report = await f.result(job.id);
    if (kind === 'host') { assert.match(report.text, /host typecheck failed/); assert.equal(f.api.machineDirs.size, 0); }
    else {
      assert.match(report.text, new RegExp(`exit ${kind === 'remote' ? 3 : 4}`));
      const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
      if (kind === 'remote') {
        assert.doesNotMatch(log, /\$ npm test/);
        assert.match(log, /typecheck: droplet/);
        assert.match(log, /\$ npm run typecheck/);
        assert.doesNotMatch(log, /not repeated/);
      }
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
  await eventually('released worker completed', async () => await readFile(join(remote.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
  assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
  const log = await readFile(localLog, 'utf8');
  assert.equal(log.split('\n').filter(line => line === 'INCREMENTAL 😀').length, 1); assert.equal(log.split('\n').filter(line => line === 'FINAL 😀').length, 1);
  assert.equal((await f.messages(job.id, ui)).length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
});

test('provider loss and verify cancel each report once and release the machine and key', async t => {
  const f = await fixture(t, { hub: projectHub, test: longTest });
  for (const kind of ['lost', 'cancel'] as const) await t.test(kind, async () => {
    const job = await f.launch('--fresh'); const remote = await f.remote(job.id);
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
  const f = await fixture(t, { hub: projectHub, test: longTest, env: { CLAND_TEST_DROPLET_WATCHDOG_STOP_MS: '500' } });
  for (const fault of ['startReplyLost', 'startMarkerOnly'] as const) await t.test(fault, async () => {
    await f.api.setMachineFaults({ startReplyLost: 0, startMarkerOnly: 0, [fault]: 1 });
    const job = await f.launch('--fresh'); const remote = await f.remote(job.id);
    await eventually('suite remains running', async () => (await readFile(join(remote.run, 'suite.log'), 'utf8').catch(() => '')).includes('\nINCREMENTAL 😀\n') ? true : undefined);
    assert.equal((await f.messages(job.id)).length, 0);
    const lease = (await readLeases(f.root)).find(lease => lease.run === job.id)!;
    const watchdog = lease.watchdog!.pid;
    ownProcess(t, watchdog);
    // A stopped watchdog cannot acknowledge SIGTERM. Release must bound its wait,
    // escalate, and reap the child before publishing the suite result.
    if (fault === 'startReplyLost') {
      process.kill(watchdog, 'SIGSTOP');
      await eventually('watchdog is stopped', async () => (await exec('ps', ['-o', 'stat=', '-p', String(watchdog)])).stdout.trim().startsWith('T') ? true : undefined);
    }
    await writeFile(join(remote.home, 'finish'), 'done');
    await eventually('worker completed after release', async () => await readFile(join(remote.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
    assert.match((await f.result(job.id)).text, /auto exit 0/);
    await eventually('released watchdog exits after release acknowledgement', () => !pidAlive(watchdog) ? true : undefined);
    assert.equal(pidAlive(watchdog), false, 'the released watchdog has exited before fixture removal');
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
  await eventually('released worker completed', async () => await readFile(join(remote.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
  assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
  const calls = (await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(calls.filter(call => call.mode === 'ssh' && call.args.at(-1).includes('git checkout --detach')).length, 1);
  assert.equal((await f.messages(job.id, ui)).length, 1);
});

test('a restored launching suite reuses only an existing ref at the same head', async t => {
  const f = await fixture(t, { test: longTest });
  let discovery = f.discovery;
  let creates = 0;
  for (const kind of ['same head', 'different head'] as const) await t.test(kind, async () => {
    const gate = join(f.api.stateRoot, `delivery-${kind.replace(' ', '-')}`);
    onCleanup(t, () => writeFile(gate, 'released'));
    await f.api.setMachineFaults({ blockFile: gate, blockCommand: 'mkdir -p' });
    const submitted = await clandWithEnv(f.root, f.actor, 'verify', '--fresh', '--report', f.topic, '--to', 'impl', '--json');
    assert.equal(submitted.code, 0, submitted.stderr);
    const job = JSON.parse(submitted.stdout) as { id: string };
    await eventually('acquired lease reached delivery', async () => {
      const calls = await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8').catch(() => '');
      return calls.split('\n').some(line => line.includes(job.id) && line.includes('mkdir -p')) ? true : undefined;
    });
    process.kill(discovery.pid, 'SIGKILL');
    await eventually('crashed hub PID is gone', () => !pidAlive(discovery.pid) ? true : undefined);
    assert.equal(pidAlive(discovery.pid), false);
    // A crash during bundling can leave this ref behind before delivery starts.
    const ref = `refs/cland/suites/${job.id}`;
    const head = await f.git('rev-parse', 'HEAD');
    const existing = kind === 'same head' ? head : await f.git('rev-parse', 'HEAD^');
    await f.git('update-ref', ref, existing);
    await writeFile(gate, 'released');
    await f.api.setMachineFaults({ blockCommand: '' });
    const restart = await startDaemon(t, f.root, f.env); discovery = restart.discovery; const ui = await connectUi(t, discovery);
    if (kind === 'same head') {
      const remote = await f.remote(job.id, ui);
      await writeFile(join(remote.home, 'finish'), 'done');
      await eventually('restored worker completed', async () => await readFile(join(remote.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
      assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
      assert.equal(await f.git('for-each-ref', '--format=%(refname)', ref), '');
    } else {
      const result = await f.result(job.id, ui);
      assert.match(result.text, /auto exit 1/);
      assert.ok(result.text.includes(`suite ref ${ref} points at ${existing}; expected ${head}`), result.text);
      assert.equal(await f.git('rev-parse', ref), existing);
    }
    assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, ++creates);
    assert.equal((await f.messages(job.id, ui)).length, 1);
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  });
});
